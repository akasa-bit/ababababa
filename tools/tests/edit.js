// 国家の編集: 種族・特性・国の名前・母星の好み
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const [vw, vh, tag] of [[1280, 780, 'land'], [854, 1200, 'port']]) {
  const p = await b.newPage({ viewport: { width: vw, height: vh } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto(`file://${HTML}?seed=11`); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(600);
  await p.evaluate(() => { if ($('home').hidden) openHome(); });
  await p.fill('#home-seed', '5'); await p.selectOption('#home-nat', '6');
  await p.click('[data-home="new"]'); await p.waitForTimeout(400);
  const cap = await p.evaluate(() => __app.game.nations[2].cap);
  await p.click(`#pick [data-pick="${cap}"]`);
  await p.click(`#pick [data-ed="open"][data-cap="${cap}"]`);
  await p.fill('#pick .ed input[data-ed="species"]', 'ミナモ人'); await p.press('#pick .ed input[data-ed="species"]', 'Enter'); await p.waitForTimeout(300);
  await p.fill('#pick .ed input[data-ed="name"]', 'ミナモ連邦'); await p.press('#pick .ed input[data-ed="name"]', 'Enter'); await p.waitForTimeout(300);
  // clear traits then pick warlike + miners + prolific
  const cur = await p.evaluate(() => [...document.querySelectorAll('#pick .ed [data-tr]:checked')].map((x) => x.dataset.tr));
  for (const t of cur) { await p.click(`#pick .ed [data-tr="${t}"]`); await p.waitForTimeout(150); }
  for (const t of ['warlike', 'miners', 'prolific']) { await p.click(`#pick .ed [data-tr="${t}"]`); await p.waitForTimeout(150); }
  const dis = await p.evaluate(() => document.querySelector('#pick .ed [data-tr="wise"]').disabled);
  // homeworld: pick a far system with a rocky body
  await p.click('#pick .ed [data-ed="home"]');
  const target = await p.evaluate(() => { const g = __app.game; const s = g.galaxy.systems.find((x) => x.id && g.sysDist(0, x.id) > 30 && x.bodies.some((b) => b.type === 'rocky') && !homeworldProblem(g, __app.picking.edit, x.id)); __app.selectSystem(s.id); return s.id; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/edit-${tag}.png` });
  await p.click('#pick .ed [data-ed="body"]'); await p.waitForTimeout(400);
  const r1 = await p.evaluate(() => { const g = __app.game; const n = g.nationOf(__app.picking.edit); return [n.cap, n.name, n.species, n.traits.join(','), JSON.stringify(g.coloniesIn(n.cap)[0].races), __app.picking.humans.join(',')]; });
  await p.screenshot({ path: `shots/edit2-${tag}.png` });
  await p.click('#pick [data-pick="go"]'); await p.waitForTimeout(400);
  const r2 = await p.evaluate(() => { const g = __app.game; for (let i = 0; i < 400; i++) g.advance(0.25); return [g.cap, ME.realm, ME.species, g.realmSystems(g.cap).length, g.nations.map((n) => n.name).join(' ')]; });
  console.log(tag, target, dis, r1, r2, errs.slice(0, 4));
  await p.close();
  }
  await b.close();
})();
