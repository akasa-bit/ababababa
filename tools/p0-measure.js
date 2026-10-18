// P0 監査の実測: 銀河の統計・離反・交易と距離・人口の伸び (ゲームは変えない)。結果は docs/P0-audit.md
// 使い方: node tools/p0-measure.js <html の絶対パス> <年数> <シード(カンマ区切り)> > out.json
// 観戦モードの地球だけの試合を 1 年ずつ進める。CHROMIUM で Chromium の場所を変えられる
const { chromium } = require('playwright');
const html = process.argv[2], years = Number(process.argv[3] || 300), seeds = (process.argv[4] || '1,2,3,4').split(',');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const out = [];
  for (const seed of seeds) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; });
    await p.goto(`file://${html}?seed=${seed}&home=0`); await p.waitForFunction(() => window.__app && __app.game);
    const r = await p.evaluate(([Y]) => {
      const g = __app.game; __app.speed = 0;
      const gal = g.galaxy, S = gal.systems;
      // --- 銀河 ---
      const cls = {}; let multi = 0, planets = 0, rockyHZ = 0, grade2 = 0, grade3 = 0;
      for (const s of S) {
        const st = s.stars[0]; const c = st.cls || st.type || (st.wd ? 'WD' : '?'); cls[c] = (cls[c] || 0) + 1;
        if (s.stars.length > 1) multi++;
        for (const bd of s.bodies) { if (bd.type === 'belt') continue; planets++; if ((bd.settle?.grade || 0) >= 2) grade2++; if ((bd.settle?.grade || 0) >= 3) grade3++; }
        const lum = s.stars[0].lum; if (lum) { const hz = { i: 0.95 * Math.sqrt(lum), o: 1.37 * Math.sqrt(lum) }; if (s.bodies.some((bd) => bd.type === 'rocky' && bd.a >= hz.i && bd.a <= hz.o)) rockyHZ++; }
      }
      const nn = S.map((s) => Math.min(...S.filter((t) => t !== s).map((t) => Math.hypot(s.x - t.x, s.y - t.y))));
      const radius = Math.max(...S.map((s) => Math.hypot(s.x, s.y)));
      // --- 自動で進める (観戦) ---
      g.setSpectate(true);
      const founded = {}; const indep = []; let maxGrowth = 0; const growthObs = [];
      const origDI = g.declareIndependence.bind(g);
      g.declareIndependence = function (id) { const lord = this.gov(id).lord; indep.push({ id, year: this.year, age: this.year - (this.gov(id).founded ?? this.year), dEarth: this.sysDist(0, id), dLord: lord != null ? this.sysDist(id, lord) : null }); return origDI(id); };
      const series = [];
      for (let y = 0; y < Y; y++) {
        g.advance(1);
        for (const c of g.colonies) if (c.pop > 1 && c.growth > maxGrowth) maxGrowth = c.growth;
        if (y % 50 === 49) series.push({ y: Math.round(g.year), sys: g.colonizedSystems().length, pop: Math.round(g.colonies.reduce((k, c) => k + c.pop, 0)), credits: Math.round(Object.values(g.govs).reduce((k, v) => k + v.credits, 0)), realms: new Set(g.colonizedSystems().map((s) => g.realmOf(s.id))).size });
      }
      // 交易路: 量と距離・両端の人口
      const popAt = (id) => g.coloniesIn(id).reduce((k, c) => k + c.pop, 0);
      const routes = g.routes.map((rt) => ({ d: g.sysDist(rt.a, rt.b), vol: (rt.vol?.[0] || 0) + (rt.vol?.[1] || 0), pa: popAt(rt.a), pb: popAt(rt.b), lv: rt.lv })).filter((x) => x.vol > 0 && x.pa > 0 && x.pb > 0);
      const colonized = g.colonizedSystems().length;
      return { cls, n: S.length, multi, planets, rockyHZ, grade2, grade3, nnMean: nn.reduce((a, x) => a + x, 0) / nn.length, radius, indep, colonizedEver: Object.keys(g.govs).length, colonized, maxGrowth, routes, series, earthPop: g.coloniesIn(0).reduce((k, c) => k + c.pop, 0) };
    }, [years]);
    r.seed = seed; r.errs = errs.slice(0, 3);
    out.push(r);
    await p.close();
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
