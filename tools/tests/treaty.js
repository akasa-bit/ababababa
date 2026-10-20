// 戦争と講和: 戦争疲弊・講和の申し入れ・講和会議・条約
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 780 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto(`file://${HTML}?seed=11`); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(600);
  const r1 = await p.evaluate(() => {
    if (!$('home').hidden) closeHome(0);
    newGame('7'); const g = __app.game; setSpeed(0); g.foundNations(5); g.setPlayerNation(0);
    for (let i = 0; i < 160; i++) g.advance(0.25); // 40 年
    const e = g.nations[1].cap;
    g.beginWar(0, e, 0);
    const key = g.warKey(0, e);
    g.warStats[key].k[0] = 30; g.warStats[key].k[e] = 5; g.warStats[key].t[0] = 1; // 戦勝点 70
    g.exhaustion[e] = 80;
    // 10 年前に開戦を知った戦争にする (AI の国は、開戦の知らせが首都に届いてから講和を考える)
    g.realmWars[key] = g.warNews[key].year = g.year - 10 - Math.ceil(g.sysDist(0, e));
    for (let i = 0; i < 8; i++) g.advance(0.25);
    return [g.warScore(0, e), g.peaceOffers.length, g.realmSystems(e).length, Math.round(g.gov(e).credits)];
  });

  await p.evaluate(() => { __app.dirty = true; });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'shots/war-offer.png' });
  const acc = await p.$('#rail [data-act="acceptpeace"]');
  if (acc) await acc.click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'shots/war-conf.png' });
  const op = await p.$('#rail [data-act="treatyopen"]');
  if (op) await op.click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/war-treaty.png' });
  // pick two systems + cash (条件のボタンだけ: s + 星系の番号、c + 口の番号。send・close は選ばない)
  const btns = await p.$$eval('#treatybox [data-tr]', (bs) => bs.map((b) => b.dataset.tr));
  for (const t of btns.filter((x) => /^s\d+$/.test(x)).slice(0, 2).concat(btns.filter((x) => /^c\d+$/.test(x)).slice(0, 2))) await p.click(`#treatybox [data-tr="${t}"]`);
  await p.screenshot({ path: 'shots/war-treaty2.png' });
  await p.click('#treatybox [data-tr="send"]');
  await p.waitForTimeout(300);
  const r2 = await p.evaluate(() => { const g = __app.game; const e = g.nations[1].cap; return [g.atWar(0, e), g.conferences.length, g.realmSystems(e).length, Math.round(g.gov(e).credits), g.events.slice(0, 2).map((x) => x.text).join(' / ')]; });
  await p.evaluate(() => __app.setView('empire')); await p.evaluate(() => { __app.empireTab = 'politics'; __app.dirty = true; }); await p.waitForTimeout(800);
  await p.screenshot({ path: 'shots/war-politics.png' });
  console.log(r1, !!acc, !!op, btns.length, r2, errs.slice(0, 5));
  await b.close();
})();
