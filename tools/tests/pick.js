// 国家選択: 横と縦の画面で選び、AI の国にもする (使い方: node pick.js <写しの出力先>)
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const [vw, vh, tag] of [[1280, 780, 'land'], [854, 1200, 'port']]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(`file://${HTML}?seed=11`); await p.waitForFunction(() => window.__app && __app.game);
    await p.waitForTimeout(800);
    await p.evaluate(() => { if ($('home').hidden) openHome(); });
    await p.selectOption('#home-nat', '6'); await p.selectOption('#home-hc', 'hard');
    await p.click('[data-home="new"]'); await p.click('[data-home="new"]');
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/pick-${tag}.png` });
    const caps = await p.evaluate(() => __app.game.nations.map((n) => n.cap));
    await p.click(`#pick [data-pick="${caps[2]}"]`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/pick2-${tag}.png` });
    await p.click('#pick [data-pick="go"]');
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const g = __app.game; for (let i = 0; i < 400; i++) g.advance(0.25); __app.dirty = true; return [g.cap, g.nationOf(g.cap).name, g.handicap, g.realmSystems(g.cap).length, g.year.toFixed(0), g.credits.toFixed(0)]; });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/play-${tag}.png` });
    await p.evaluate(() => __app.setView('empire')); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/emp-${tag}.png` });
    console.log(tag, r.join(' '), errs.slice(0, 5));
    await p.close();
  }
  await b.close();
})();
