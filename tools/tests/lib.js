// 国家の保管庫: ホーム画面の「国家づくり」で作った国を保存し、新しいゲームで使う
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: (o) => (J.noPageErrors(o) ? '' : 'ページの誤り') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const [vw, vh, tag] of [[1280, 780, 'land'], [854, 1200, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto(`file://${HTML}?seed=11`); await p.waitForFunction(() => window.__app && __app.game && Store.ready); await p.waitForTimeout(500);
  await p.evaluate(() => { if ($('home').hidden) openHome(); });
  await p.click('[data-home="tab"][data-t="nations"]');
  const mk = async (sp, suf, traits, env, dist) => {
    await p.click('[data-home="natnew"]');
    await p.fill('#ne-species', sp); await p.press('#ne-species', 'Tab'); await p.waitForTimeout(150);
    await p.selectOption('#ne-suffix', suf); await p.waitForTimeout(150);
    for (const t of traits) { await p.click(`.ne-tr[value="${t}"]`); await p.waitForTimeout(100); }
    await p.selectOption('#ne-env', env); await p.selectOption('#ne-dist', dist);
    if (tag === 'land' && sp === 'ミナーラ人') await p.screenshot({ path: `shots/lib-edit-${tag}.png` });
    await p.click('[data-home="natsave"]'); await p.waitForTimeout(200);
  };
  await mk('ミナーラ人', '独立国', ['aquatic', 'traders', 'wise'], 'ocean', 'far');
  await mk('ゴルザ人', '帝国', ['warlike', 'miners'], 'desert', 'near');
  await p.screenshot({ path: `shots/lib-list-${tag}.png` });
  // reload: persisted?
  await p.reload(); await p.waitForFunction(() => window.__app && __app.game && Store.ready); await p.waitForTimeout(400);
  const lib = await p.evaluate(() => NationLib.list.map((n) => `${n.name}/${n.species}/${n.traits.join('+')}/${n.env}/${n.dist}`));
  await p.evaluate(() => { if ($('home').hidden) openHome(); });
  await p.fill('#home-seed', '9'); await p.selectOption('#home-nat', '5');
  for (const el of await p.$$('#home .home-lib')) await el.check();
  await p.screenshot({ path: `shots/lib-newgame-${tag}.png` });
  await p.click('[data-home="new"]'); await p.click('[data-home="new"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/lib-pick-${tag}.png` });
  const r = await p.evaluate(() => { const g = __app.game; return g.nations.map((n) => { const b = g.target(n.cap, n.body); return `${n.name}[${n.traits.join('+')}] ${b.surface} ${g.sysDist(0, n.cap).toFixed(0)}ly`; }).concat(['humans:' + __app.picking.humans.map((c) => g.nationOf(c).name).join(',')]); });
  await p.click('#pick [data-pick="go"]'); await p.waitForTimeout(300);
  const r2 = await p.evaluate(() => { const g = __app.game; for (let i = 0; i < 200; i++) g.advance(0.25); return [ME.realm, ME.species, g.realmSystems(g.cap).length, g.events.slice(0, 3).map((e) => e.text).join(' / ')]; });
  console.log(tag, lib, r, r2, errs.slice(0, 4));
  await ctx.close();
  }
  await b.close();
})();
