// ホーム画面: 開く・閉じる・続きから
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 780 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto(`file://${HTML}?seed=11`); await p.waitForFunction(() => window.__app && __app.game);
  await p.waitForTimeout(800);
  await p.evaluate(() => { if ($('home').hidden) openHome(); });
  await p.evaluate(() => document.querySelector('#home-nat').scrollIntoView());
  await p.screenshot({ path: 'shots/home.png' });
  // classic new game still works
  await p.click('[data-home="new"]'); await p.waitForTimeout(500);
  console.log(await p.evaluate(() => [$('pick').hidden, $('home').hidden, __app.game.cap, !!__app.game.nations, __app.speed]), errs);
  await b.close();
})();
