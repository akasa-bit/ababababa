// 速さの測り (依頼 2026-11-07 の common-1。docs/perf.md): ブラウザ (Chromium) で、国家選択のある試合を画面なしで進め、1 年あたりの計算の時間 [ms] を測る。
// 終わりの状態の要約 (tools/headless.js の hash と同じ作り方) も出すので、2 つの版の筋が同じかも比べられる (速さを直すときは、要約が main と同じであること)。
// 画面なしの道具 (headless.js) は Node の vm で動かすぶん、ブラウザより 2〜3 倍遅く、重い所の割合も違うので、速さはこちらで測る。
// 使い方: node tools/perf-bench.js [HTML (既定は組み立てた index.html。main と比べるときは node tools/src.js --ref origin/main --out main.html)]
//          [銀河 2,3] [国の数 8] [先に進める年 120] [測る年 20] [--play (観戦でない試合。人間の席は何もしない)]
// 出力: 1 行 1 銀河の JSON { seed, year, cols (入植地の数), msPerYear, hash }
const path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2).filter((a) => a !== '--play');
const play = process.argv.includes('--play');
const [file = path.resolve(__dirname, '..', 'index.html'), seedsS = '2,3', natS = '8', warmS = '120', yS = '20'] = args;
(async () => {
  const b = await chromium.launch();
  for (const seed of seedsS.split(',')) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 780 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`file://${path.resolve(file)}?seed=${seed}&home=0`);
    await p.waitForTimeout(1200);
    const r = await p.evaluate(([seed, nat, warm, yrs, play]) => {
      setSpeed(0);
      const g = new Game(generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: GALAXY_GEN }));
      if (nat > 0) { g.foundNations(nat); g.setPlayerNation(g.nations[1].cap); }
      if (!play) g.setSpectate(true);
      for (let i = 0; i < warm * 4; i++) g.advance(0.25);
      const t0 = performance.now();
      for (let i = 0; i < yrs * 4; i++) g.advance(0.25);
      const ms = performance.now() - t0;
      const d = { ...buildSave(g) };
      delete d.savedAt;
      const t = JSON.stringify(d);
      let h = 0x811c9dc5;
      for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return { year: g.year, cols: g.colonies.length, msPerYear: Math.round((ms / yrs) * 10) / 10, hash: (h >>> 0).toString(36) };
    }, [seed, Number(natS), Number(warmS), Number(yS), play]);
    console.log(JSON.stringify({ seed, ...r, ...(errs.length ? { errs: errs.slice(0, 2) } : {}) }));
    await ctx.close();
  }
  await b.close();
})();
