// エネルギーの記帳の試験 (目標 R07): 記帳した船 1 便ごとのエネルギーを、この試験の中で物理の式から計算し直して比べる。
// 式はゲームのコードを使わずに書く (使うのは効率の値 PROP と光速だけ)。合格は、すべての便で 比 = 1 ± 1e-6
//   交易路 ('route'): 加速も減速もレーザー。片側 = (γ−1)mc² ÷ (レーザー × 帆に当たる割合 × 帆への伝達)
//   交易路の外 ('free'): 加速はレーザー (反物質の推進剤も運ぶ)、減速は磁気帆と、仕上げの反物質 (作るのに使う電気)
// 帆への伝達は、完全な反射の帆のその瞬間の割合 2β/(1+β) を 0 から β まで積分したもの: 2(γ−1) / (γβ + γ − 1)
// 使い方: node tools/tests/energy.js [シード] [年数]   (NAT=1 で国家選択あり、HTML=… で版を選ぶ)
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const { chromium } = require('playwright');
const [seed = '5', years = '150'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; });
  await p.goto(`file://${HTML}?seed=${seed}&home=0`);
  await p.waitForFunction(() => window.__app && __app.game);
  const r = await p.evaluate(([Y, NAT]) => {
    __app.speed = 0;
    const g = __app.game;
    if (NAT) { g.foundNations(6, 'normal'); g.setPlayerNation(g.nations[0].cap); }
    g.setSpectate(true);
    ENERGY_AUDIT = [];
    for (let i = 0; i < Y * 4; i++) g.advance(0.25);
    const govs = Object.entries(g.govs).filter(([id]) => g.isColonized(Number(id)));
    return {
      audit: ENERGY_AUDIT, prop: PROP, c: C_LIGHT,
      govs: govs.length, negative: govs.filter(([, v]) => (v.E || 0) < 0).length,
      earth: { E: g.govs[0].E, power: g.power(0), cover: g.swarmCover(0), ledger: g.govs[0].eledger },
      colonies: g.colonies.length, routes: g.routes.length,
    };
  }, [Number(years), !!process.env.NAT]);
  const { audit, prop: P, c } = r;
  const sail = (be) => { const ga = 1 / Math.sqrt(1 - be * be); return (2 * (ga - 1)) / (ga * be + ga - 1); };
  const expect = (x) => {
    const ga = 1 / Math.sqrt(1 - x.beta * x.beta);
    const chain = P.laser * P.beam * sail(x.beta);
    if (x.mode === 'route') return (2 * (ga - 1) * x.m * c * c) / chain;
    const R = Math.exp(Math.atanh(P.magsailTo) / P.amExhaust); // 反物質ロケットの質量比
    return ((ga - 1) * x.m * R * c * c) / chain + ((x.m * (R - 1)) / 2) * c * c / P.amEff;
  };
  let worst = 0;
  const by = {};
  for (const x of audit) {
    const q = x.E / expect(x);
    worst = Math.max(worst, Math.abs(q - 1));
    const k = `${x.kind}/${x.mode}`;
    (by[k] ??= { n: 0, J: 0 }); by[k].n++; by[k].J += x.E;
  }
  const e = (v) => (v === undefined ? '-' : Number(v).toExponential(2));
  console.log(`便の数 ${audit.length} ・ |比 − 1| の最大 ${worst.toExponential(2)} ・ R07 ${audit.length && worst <= 1e-6 ? '合格' : '不合格'}`);
  for (const [k, v] of Object.entries(by)) console.log(`  ${k}: ${v.n} 便、合計 ${e(v.J)} J`);
  console.log(`政府 ${r.govs} (蓄えが負 ${r.negative})・入植地 ${r.colonies}・交易路 ${r.routes}`);
  console.log(`太陽系: 覆う割合 ${r.earth.cover.toFixed(3)}・発電 ${e(r.earth.power)} J/年・蓄え ${e(r.earth.E)} J`);
  console.log('太陽系の収支 [J/年]:', Object.entries(r.earth.ledger || {}).map(([k, v]) => `${k} ${e(v)}`).join(' / '), errs.slice(0, 3));
  await b.close();
})();
