// 2 つの版 (index.html と simulation.html) が開き、題名・見出し・保存の名前が分かれているか (使い方: node editions.js <写しの出力先>)
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const f of ['index.html', 'simulation.html']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 780 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`file://${ROOT}/${f}?seed=4`); await p.waitForFunction(() => window.__app && __app.game);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${process.argv[2]}/home-${f}.png` });
    const r = await p.evaluate(async () => { await __app.storeReady; const g = __app.game; for (let i = 0; i < 40; i++) g.advance(0.25); return [document.title, $('brand').textContent, EDITION, STORE, GENERATION_YEARS, SAVE_KEY, Object.keys(localStorage).join(',')]; });
    console.log(f, JSON.stringify(r), errs.slice(0, 3));
  }
  await b.close();
})();
