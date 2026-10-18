// 動かした (ずらして拡大した) あとの地図が、描き直し (層の使い回しなし) と同じになるか。古い版 (OLD) と比べる
// (前は 3 次元の地図を回して確かめていた。いまの地図は真上からの平面なので、ずらす・拡大するで確かめる)
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const [tag, file] of [['old', process.argv[3]], ['new', HTML]]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 780 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(`file://${file}?seed=4&home=0`); await p.waitForFunction(() => window.__app && __app.game);
    await p.waitForTimeout(1200);
    // ドラッグのように少しずつずらし、拡大する (各段で 1 コマ描く)
    for (let i = 0; i < 12; i++) { await p.evaluate(() => { galaxyView.cam.x += 0.7; galaxyView.cam.y -= 0.4; galaxyView.zoomAt(1.04, innerWidth / 3, innerHeight / 2); __app.dirty = true; }); await p.waitForTimeout(50); }
    await p.screenshot({ path: `${process.argv[2]}/rot-${tag}-a.png` });
    const a = await p.evaluate(() => galaxyView.canvas.toDataURL());
    await p.evaluate(() => { galaxyView.layers = {}; __app.dirty = true; });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${process.argv[2]}/rot-${tag}-b.png` });
    const c = await p.evaluate(() => galaxyView.canvas.toDataURL());
    console.log(tag, 'moved == fresh redraw:', a === c, errs.slice(0, 2));
  }
  await b.close();
})();
