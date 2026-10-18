// 生成した惑星の η⊕ (保守的なハビタブルゾーンにある、半径 rmin〜1.5 地球半径の惑星の数 ÷ 主星の数)。FGK 型と M 型に分ける (目標 R05・R06)
// 使い方: node tools/eta.js <html の絶対パス> [rmin (既定 0.5。M 型の R06 は 1.0)] [銀河の版 (既定 1)]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`file://${process.argv[2]}?seed=1&home=0`); await p.waitForFunction(() => window.__app && __app.game);
  const r = await p.evaluate(([seeds, rmin, gen]) => {
    const acc = { FGK: [0, 0], M: [0, 0] };
    for (const seed of seeds) {
      const gal = generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen });
      for (const s of gal.systems) for (const st of s.stars.slice(0, 1)) {
        if (st.wd || !/ V$/.test(st.label || '')) continue;
        const k = 'FGK'.includes(st.cls) ? 'FGK' : st.cls === 'M' ? 'M' : null;
        if (!k) continue;
        const hz = habitableZone(st);
        acc[k][1]++;
        for (const bd of s.bodies) {
          if ((bd.host ?? s.stars[0].id) !== st.id && !(bd.host === undefined && st === s.stars[0])) continue;
          if (bd.type === 'belt' || bd.known) continue;
          if (bd.radius >= rmin && bd.radius <= 1.5 && bd.a >= hz.inner && bd.a <= hz.outer) acc[k][0]++;
        }
      }
    }
    return Object.fromEntries(Object.entries(acc).map(([k, [n, d]]) => [k, { planets: n, stars: d, eta: +(n / d).toFixed(3) }]));
  }, [[1, 2, 3, 4, 5, 6, 7, 8], Number(process.argv[3] || 0.5), Number(process.argv[4] || 1)]);
  console.log(JSON.stringify(r), errs.slice(0, 2));
  await b.close();
})();
