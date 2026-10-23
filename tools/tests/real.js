// 実在の 3 次元の銀河: 100 年の観戦・回す・傾ける・真上から見る
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: (o) => (/^(land|port) \[ 'real', \d+/m.test(o) && J.noPageErrors(o) ? '' : '実在の銀河が開かない') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const [vw, vh, tag] of [[1280, 780, 'land'], [854, 1200, 'port']]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(`file://${HTML}?seed=11&home=0`); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(800);
    const info = await p.evaluate(() => { const g = __app.game; return [g.galaxy.kind, g.galaxy.systems.length, g.galaxy.radius, g.system(1).name, g.system(1).cat, g.sysDist(0, 1).toFixed(2), g.galaxy.systems.filter((s) => s.bodies.some((b) => b.known)).length]; });
    await p.screenshot({ path: `shots/real-tilt-${tag}.png` });
    await p.click('#topbtn'); await p.waitForTimeout(400);
    await p.screenshot({ path: `shots/real-top-${tag}.png` });
    await p.click('#topbtn'); await p.click('#rotbtn');
    const box = await p.$eval('canvas', (c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.mouse.move(box[0] + 160, box[1] - 60, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `shots/real-rot-${tag}.png` });
    // select Alpha Cen and open its panel
    const r2 = await p.evaluate(() => { const g = __app.game; const s = g.galaxy.systems.find((x) => x.cat === 'GJ 559'); __app.selectSystem(s.id); galaxyView.centerOn(s); __app.dirty = true; return [s.name, s.stars.map((x) => x.label).join('+'), s.bodies.map((x) => `${x.name}${x.known ? '*' : ''}(${x.type},${x.a.toFixed(2)})`).join(' ')]; });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `shots/real-acen-${tag}.png` });
    const r3 = await p.evaluate(() => { const g = __app.game; g.setSpectate(true); for (let i = 0; i < 400; i++) g.advance(0.25); __app.dirty = true; return [g.year.toFixed(0), g.colonizedSystems().length, g.colonizedSystems().slice(0, 12).map((s) => `${s.name}@${g.sysDist(0, s.id).toFixed(1)}`).join(' ')]; });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `shots/real-100y-${tag}.png` });
    console.log(tag, info, r2, r3, errs.slice(0, 5));
    await p.close();
  }
  await b.close();
})();
