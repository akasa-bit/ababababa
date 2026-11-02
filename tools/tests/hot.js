// ホットシート: 交代画面・自動の交代・他国の艦隊への命令の拒否・保存と読込
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: (o) => (o.includes('他国の艦隊には命令できない') && /\[ true, [^\]]*\] \[ true, [^\]]*\] \[\]$/.test(J.last(o)) ? '' : 'ホットシートの結果が違う') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 780 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('moribin-evprefs', JSON.stringify({ popup: false })); } catch {} }); // 重大な知らせの窓は切る (出ると時間が止まり、自動の交代が来ない。窓は newspop で見る)
  await p.goto(`file://${HTML}?seed=11`); await p.waitForFunction(() => window.__app && __app.game);
  await p.waitForTimeout(800);
  await p.evaluate(() => { if ($('home').hidden) openHome(); });
  await p.fill('#home-seed', '5');
  await p.selectOption('#home-nat', '5');
  await p.click('[data-home="new"]'); await p.waitForTimeout(500);
  const caps = await p.evaluate(() => __app.game.nations.map((n) => n.cap));
  await p.click(`#pick [data-human="${caps[2]}"]`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/hot-pick.png' });
  await p.click('#pick [data-pick="go"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/hot-curtain.png' });
  await p.click('#turngo'); await p.waitForTimeout(300);
  const r1 = await p.evaluate(() => { const g = __app.game; return [g.players.map((x) => x.cap).join(','), g.pi, g.cap, $('turnbtn').hidden, $('turnbtn').textContent]; });
  // player 1 issues a fleet order from capital to a nearby system
  const r2 = await p.evaluate(() => { const g = __app.game; const t = g.nearSystems(g.cap).find(([id, d]) => id !== g.cap && d > 2)[0]; const r = issue('fleet', { from: g.cap, sys: t, n: 1 }); issue('set', { key: 'autoDefense', value: true }); return [JSON.stringify(r), t, g.autoDefense]; });
  await p.click('#turnbtn'); await p.waitForTimeout(300);
  const vis = await p.evaluate(() => !$('curtain').hidden);
  await p.click('#turngo'); await p.waitForTimeout(300);
  const r3 = await p.evaluate(() => { const g = __app.game; return [g.pi, g.cap, g.autoDefense, g.knownLog().slice(0, 3).map((l) => l.text).join(' / ')]; });
  // try to order the other player's capital fleet: must fail
  const r4 = await p.evaluate(() => { const g = __app.game; const other = g.players[0].cap; return JSON.stringify(g.asPlayer(g.pi, () => g.commandRaw('fleet', { from: other, sys: g.cap, n: 1 }))); });
  await p.evaluate(() => { __app.turnEvery = 5; __app.turnStart = __app.game.year; setSpeed(SPEEDS[4]); });
  await p.waitForTimeout(3000);
  const r5 = await p.evaluate(() => [!$('curtain').hidden, __app.game.year.toFixed(1), __app.game.pi]);
  await p.screenshot({ path: 'shots/hot-auto.png' });
  await p.click('#turngo');
  await p.evaluate(() => { const g = __app.game; for (let i = 0; i < 400; i++) g.advance(0.25); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'shots/hot-play.png' });
  // save/load roundtrip
  const r6 = await p.evaluate(() => { const g = __app.game; const strip = (x) => { const s = buildSave(x); delete s.savedAt; return JSON.stringify(s); }; const s1 = strip(g); const g2 = new Game(generateGalaxy({ seed: g.galaxy.seed, starCount: 400, meanSpacing: 4, kind: g.galaxy.kind || 'flat', gen: g.galaxy.gen || 1 })); g2.restore(JSON.parse(s1)); SIM = g; return [s1 === strip(g2), g.players.length, Object.keys(g.stackOwner).length]; });
  console.log(r1, r2, vis, r3, r4, r5, r6, errs.slice(0, 5));
  await b.close();
})();
