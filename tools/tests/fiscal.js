// 財政 (税・利子率・予算) の試験: 命令と政治力・選べない値の拒否・光速で広がること・税収と利子と予算の記帳・
// 忠誠度と離反の起きやすさと艦隊の戦力への効き目・保存と読み込み・画面 (横と縦)
// 使い方: node tools/tests/fiscal.js [shots のフォルダ]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{
  args: (c) => [c.shots],
  judge: J.byJson((j) => Object.values(j).every((v) => v.ok && v.bad.every((b) => b === false) && v.pc === 5 && v.now.join() === '1.8,1,0.01' && v.budgetOnly.join() === 'true,0' && v.later.join() === '1.8,0.05'
    && v.loyalty.join() === 'false,true,true' && v.fine.join() === 'true,0.2,-0.0075,0.075' && v.bad2.every((b) => b === false) && v.ok2 && v.ctax.join() === '0.1,0.05,true,1.935,true' && v.hazard && v.fleet[1] > v.fleet[0] && Object.values(v.ledger).every(Boolean) && v.saveLoad && Math.abs(v.ui - 0.095) < 1e-9 && v.wide[0] === v.wide[1] && !v.errs.length), '財政の結果が違う'),
}];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const SHOTS = process.argv[2] || 'shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const out = {};
  for (const [tag, vp] of [['land', { width: 1280, height: 780 }], ['port', { width: 854, height: 1200 }]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(`file://${HTML}?seed=11&home=0`); await p.waitForFunction(() => window.__app && __app.game);
    const r = await p.evaluate(() => {
      const g = __app.game; __app.speed = 0;
      const vassals = () => Object.keys(g.govs).map(Number).filter((id) => id !== 0 && g.isColonized(id) && g.realmOf(id) === 0 && g.govs[id].lord !== null);
      // 地球の国に従属星系ができるまで (60 年から、最長 200 年) 進める
      g.setSpectate(true); for (let i = 0; i < 240 || (!vassals().length && i < 800); i++) g.advance(0.25); g.setSpectate(false);
      const res = {};
      const vs = vassals().sort((a, c) => g.sysDist(0, c) - g.sysDist(0, a));
      const far = vs[0];
      res.far = Math.round(g.sysDist(0, far));
      g.pc = 50;
      // 選べない値: 予算の合計が 10 割を超える・税率が幅の外 (40%)・利子率が刻みの外・前の段階の名前でないもの
      res.bad = [issue('fiscal', { tax: 0.279, rate: 0.05, welfare: 0.6, security: 0.3, military: 0.2 }).ok, issue('fiscal', { tax: 0.4 }).ok, issue('fiscal', { rate: 0.051 }).ok, issue('fiscal', { tax: 'nope' }).ok];
      res.ok = issue('fiscal', { tax: 'heavy', rate: 0.05, welfare: 0.2, security: 0.1, military: 0.1 }).ok; // 前の段階の名前 (重税 = 15.5% × 1.8) も通る
      res.pc = 50 - g.pc; // 税と利子率を変えたので 5
      res.now = [+g.taxK(0).toFixed(3), +g.taxK(far).toFixed(3), g.rateAt(far)]; // 首都はすぐ、遠い星系はまだ前のまま (1・0.01)
      const L0 = g.loyaltyTerms(far).map((t) => t.label);
      for (let i = 0; i < Math.ceil(res.far * 4) + 8; i++) g.advance(0.25);
      const pc0 = g.pc;
      res.budgetOnly = [issue('fiscal', { tax: 'heavy', rate: 0.05, welfare: 0.2, security: 0.2, military: 0.1 }).ok, pc0 - g.pc]; // 予算だけなら政治力は要らない (0)
      const cr0 = g.council;
      for (let i = 0; i < Math.ceil(res.far * 4) + 8; i++) g.advance(0.25);
      res.later = [+g.taxK(far).toFixed(3), g.rateAt(far)];
      const L1 = g.loyaltyTerms(far);
      res.loyalty = [L0.some((l) => l.startsWith('税 (')), L1.some((t) => t.label === '税 (27.9%)' && Math.abs(t.v + 12) < 1e-6), L1.some((t) => t.label === '福祉の予算' && t.v > 0)]; // 重税 (×1.8) の忠誠度 −15 × 0.8 = −12
      // 幅の中の細かい値 (税率 20%・利子率 −0.75%・赤字の上限 7.5%) も通る。マイナスの利子率も選べる (docs/policy-ranges.md)
      res.fine = [issue('fiscal', { tax: 0.2, rate: -0.0075, deficit: 0.075 }).ok, g.fiscal.tax, g.fiscal.rate, g.fiscal.deficit];
      // 消費税と関税 (セッション 20 の 2): 幅の外 (30%) と刻みの外 (10.1%) は拒否、幅の中は通る。消費税は首都の家計の買い物から政府に入る (記帳 ctax)。税の重さは所得への税率と合わせて (0.2 + 0.1) ÷ 0.155
      res.bad2 = [issue('fiscal', { ctax: 0.3 }).ok, issue('fiscal', { tariff: 0.3 }).ok, issue('fiscal', { ctax: 0.101 }).ok];
      res.ok2 = issue('fiscal', { ctax: 0.1, tariff: 0.05 }).ok;
      for (let i = 0; i < Math.ceil(res.far * 4) + 8; i++) g.advance(0.25); // 遠い星系に届くまで進める
      res.ctax = [g.fiscal.ctax, g.fiscal.tariff, g.gov(0).ledger.ctax > 0, +burdenK(g.fiscal).toFixed(3), g.loyaltyTerms(far).some((x) => x.label === '税 (20.0% + 消費税 10.0%)')];
      res.hazard = (g.secessionTerms(far) || []).some((t) => t.label === '治安の予算' && t.f < 1);
      res.fleet = [g.modsOf(0).fleet, +g.fleetMul(0, 0).toFixed(3)];
      const led = g.gov(0).ledger;
      res.ledger = { welfare: led.welfare < 0, security: led.security < 0, military: led.military < 0, interest: !!led.interest }; // 利子は純額 (貯えの利子 − 国債の利子) なので、0 でなく記帳されていればよい
      res.council = +(g.council - cr0).toFixed(2);
      // 保存と読み込み
      const d = JSON.parse(JSON.stringify(buildSave(g)));
      const g2 = new Game(generateGalaxy({ seed: d.seed, starCount: 400, meanSpacing: 4, kind: d.galaxy === 'real' ? 'real' : 'flat', gen: d.gen || 1 }));
      res.saveLoad = g2.restore(d) && JSON.stringify(g2.players[0].fiscal) === JSON.stringify(g.players[0].fiscal) && g2.taxK(far) === g.taxK(far);
      __app.setView('empire'); __app.empireTab = 'goals'; __app.dirty = true;
      return res;
    });
    await p.waitForTimeout(700);
    await p.evaluate(() => { const h = [...document.querySelectorAll('#empire h3')].find((x) => /財政/.test(x.textContent)); if (h) h.scrollIntoView(); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${SHOTS}/fiscal-${tag}.png` });
    // 画面のスライダーから変える (税率を 9.5% に)
    await p.evaluate(() => { __app.game.pc = 50; });
    await p.evaluate(() => { const el = document.querySelector('input[type="range"][data-act="fiscal"][data-k="tax"]'); el.value = '0.095'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    r.ui = await p.evaluate(() => __app.game.fiscal.tax);
    r.wide = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    out[tag] = { ...r, errs };
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
