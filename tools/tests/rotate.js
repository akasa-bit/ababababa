// 回したあとの地図が、描き直し (層の使い回しなし) と同じになるか。古い版 (OLD) と比べる
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: (c) => [c.shots, c.path.join(c.root, 'index.html')], judge: (o) => ((o.match(/rotated == fresh redraw: true \[\]/g) || []).length === 2 ? '' : '回したあとの絵が描き直しと違う') }];
if (require.main !== module) return;
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
    // ドラッグのように少しずつ回す (各段で 1 コマ描く)
    for (let i = 0; i < 12; i++) { await p.evaluate(() => { galaxyView.rotateBy(0.06, 0.02); }); await p.waitForTimeout(50); }
    await p.screenshot({ path: `${process.argv[2]}/rot-${tag}-a.png` });
    const a = await p.evaluate(() => galaxyView.canvas.toDataURL());
    await p.evaluate(() => { galaxyView.layers = {}; __app.dirty = true; });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${process.argv[2]}/rot-${tag}-b.png` });
    const c = await p.evaluate(() => galaxyView.canvas.toDataURL());
    console.log(tag, 'rotated == fresh redraw:', a === c, errs.slice(0, 2));
  }
  await b.close();
})();
