// エネルギーの記帳の試験 (目標 R07): 記帳した船 1 便ごとのエネルギーを、この試験の中で物理の式から計算し直して比べる。
// 式はゲームのコードを使わずに書く (使うのは効率の値 PROP と光速だけ)。合格は、すべての便で 比 = 1 ± 1e-6
//   交易路 ('route'): 加速も減速もレーザー。加速 = (γ−1)mc² ÷ (レーザー × 帆に当たる割合 × 帆への伝達)。減速はゲーム版は同じ量、シミュレーション版は mc² (γβ − γ + 1) / 2 ÷ (レーザー × 帆に当たる割合)
//   交易路の外 ('free'): 加速はレーザー (反物質の推進剤も運ぶ)、減速は磁気帆と、仕上げの反物質 (作るのに使う電気)
// 帆への伝達は、完全な反射の帆のその瞬間の割合 2β/(1+β) を 0 から β まで積分したもの: 2(γ−1) / (γβ + γ − 1)
// 質量 m は、積み荷と船に遮蔽を足したもの。遮蔽も、この試験の中で、航路の長さと深さと線量の表 (SHIELD_DOSE・SHIELD_GCR) から計算し直す
//   前: 当たる核子 Φ = ISM.nNuc × 航路の長さ、厚さ tf は Φ × 線量(tf) = 限度の前の分。横と後ろ: 宇宙線の線量率(ts) × 船の時間 = 限度の残り
//   質量 = 前面 × (tf + ts) + 横 × ts (円柱。直径は遮蔽が一番軽くなる値を、細長さの範囲で切ったもの)
// 使い方: node tools/tests/energy.js [シード] [年数]   (NAT=1 で国家選択あり、HTML=… で版を選ぶ)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [
  { args: ['5', '150'], judge: J.firstLine('R07', 'R07 不合格') },
  // シミュレーション版 (参考。落ちても CI は止めない。docs/parallel.md の 6)。組み立てに失敗して simulation.html がなければ回さない
  { args: ['5', '150'], judge: J.firstLine('R07', 'R07 不合格 (シミュレーション版)'), optional: true, env: (c) => ({ HTML: c.path.join(c.shots, 'simulation.html') }), needs: (c) => c.path.join(c.shots, 'simulation.html') },
];
if (require.main !== module) return;
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
      audit: ENERGY_AUDIT, prop: PROP, c: C_LIGHT, ism: ISM, sh: SHIELD, dose: SHIELD_DOSE, gcr: SHIELD_GCR, physics: g.physics, simOnly: EDITION === 'sim',
      govs: govs.length, negative: govs.filter(([, v]) => (v.E || 0) < 0).length,
      earth: { E: g.govs[0].E, power: g.power(0), cover: g.swarmCover(0), ledger: g.govs[0].eledger },
      colonies: g.colonies.length, routes: g.routes.length,
    };
  }, [Number(years), !!process.env.NAT]);
  const { audit, prop: P, c } = r;
  const sail = (be) => { const ga = 1 / Math.sqrt(1 - be * be); return (2 * (ga - 1)) / (ga * be + ga - 1); };
  // 遮蔽の質量 [kg] (ゲームのコードを使わずに書く)。前 = 星間の気体、横と後ろ = 宇宙線。船の太さは遮蔽が一番軽くなる値 (細長さの範囲で切る)
  const depth = (tab, key, want) => {
    const ln = tab['ln' + key], t = tab.t;
    if (want >= ln[0]) return 0;
    const i = ln.findIndex((v) => v <= want);
    return i < 0 ? t[t.length - 1] + (ln[ln.length - 1] - want) * tab['lam' + key] : t[i - 1] + ((ln[i - 1] - want) / (ln[i - 1] - ln[i])) * (t[i] - t[i - 1]);
  };
  const shape = (V, tf, ts) => {
    const dk = (a) => Math.cbrt((4 * V) / (Math.PI * a));
    const d = Math.min(dk(r.sh.aspect[0]), Math.max(dk(r.sh.aspect[1]), ts > 0 ? Math.cbrt((8 * V * ts) / (Math.PI * (tf + ts))) : 0));
    return 10 * ((Math.PI * d * d) / 4 * (tf + ts) + ((4 * V) / d) * ts);
  };
  const shieldKg = (x) => {
    if (!(x.ly > 0) || !r.physics.shield) return 0; // 遮蔽は、この試合の物理の切り替え (physics.shield) のとき (2026-10-21 からゲーム版も)
    const crew = r.sh.crew.includes(x.kind), k = x.beta > 0.925 ? '0.95' : '0.9';
    const L = x.ly * 9.4607e17, V = x.m / r.sh.rho[crew ? 'crew' : 'cargo'];
    if (!crew) return shape(V, depth(r.dose[k], 'D', Math.log(r.sh.cargoGy / (r.ism.nNuc * L))), 0);
    // 船の時間 [s]: 1g の加速と減速のあいだは (c/a) atanh β (physics.accel のとき)、そのほかは道のり ÷ γβc。加速を終える前に折り返す短い航路は 2 (c/a) acosh(1 + 道のり ÷ 2(c²/a))
    const ga = 1 / Math.sqrt(1 - x.beta ** 2), T1 = c / 9.80665 / 31557600, xa = T1 * (ga - 1);
    const tau = !r.physics.accel ? L / (ga * x.beta * c * 100) : x.ly >= 2 * xa ? (2 * T1 * Math.atanh(x.beta) + (x.ly - 2 * xa) / (ga * x.beta)) * 31557600 : 2 * T1 * Math.acosh(1 + x.ly / 2 / T1) * 31557600; // 短い航路は中点で折り返す
    const kg = (f) => shape(V, depth(r.dose[k], 'H', Math.log((r.sh.crewSv * f) / (r.ism.nNuc * L))), depth(r.gcr[k], 'H', Math.log((r.sh.crewSv * (1 - f)) / tau)));
    if (r.sh.frontShare) return kg(r.sh.frontShare);
    // 一番軽い割り振り: 0.01〜0.99 を 2,000 に刻んで探し、ゲームの値がそれより重くないことを見る (ゲームは黄金分割)
    let best = Infinity;
    for (let i = 0; i <= 2000; i++) best = Math.min(best, kg(0.01 + (0.98 * i) / 2000));
    return best;
  };
  let worstShield = 0, shieldBad = 0;
  const expect = (x) => {
    const sk = shieldKg(x);
    // 割り振りが決め打ちなら一致するはず (1e-9)。探すときは、ゲームの値 (黄金分割) が、刻みで探した一番軽い値より 1e-4 を超えて重くなく、1e-3 を超えて軽くない
    const q = sk ? x.shield / sk - 1 : x.shield || 0;
    const opt = sk && !r.sh.frontShare && r.sh.crew.includes(x.kind);
    worstShield = Math.max(worstShield, Math.abs(q));
    if (opt ? q > 1e-4 || q < -1e-3 : Math.abs(q) > 1e-9) shieldBad++;
    x = { ...x, m: x.m + (x.shield || 0) }; // 記帳のエネルギーは、(上で確かめた) ゲームの遮蔽の質量を足して計算し直す
    const ga = 1 / Math.sqrt(1 - x.beta * x.beta);
    const chain = P.laser * P.beam * sail(x.beta);
    // 減速: シミュレーション版は、近づく帆を止める光 mc² (γβ − γ + 1) / 2 (加速の時間反転)。ゲーム版は加速と同じ量
    if (x.mode === 'route') return ((ga - 1) * x.m * c * c) / chain + (r.simOnly ? (x.m * c * c * (ga * x.beta - ga + 1)) / 2 / (P.laser * P.beam) : ((ga - 1) * x.m * c * c) / chain);
    const R = Math.exp(Math.atanh(P.magsailTo) / P.amExhaust); // 反物質ロケットの質量比
    return ((ga - 1) * x.m * R * c * c) / chain + ((x.m * (R - 1)) / 2) * c * c / P.amEff;
  };
  let worst = 0;
  const by = {};
  for (const x of audit) {
    const q = x.E / expect(x);
    worst = Math.max(worst, Math.abs(q - 1));
    const k = `${x.kind}/${x.mode}`;
    (by[k] ??= { n: 0, J: 0, m: 0, sh: 0 }); by[k].n++; by[k].J += x.E; by[k].m += x.m; by[k].sh += x.shield || 0;
  }
  const e = (v) => (v === undefined ? '-' : Number(v).toExponential(2));
  const ok = audit.length && worst <= 1e-6 && !shieldBad;
  console.log(`便の数 ${audit.length} ・ |比 − 1| の最大 ${worst.toExponential(2)} (遮蔽の質量 |比 − 1| の最大 ${worstShield.toExponential(2)}・外れ ${shieldBad} 便) ・ R07 ${ok ? '合格' : '不合格'} ・ 物理 ${JSON.stringify(r.physics)}`);
  for (const [k, v] of Object.entries(by)) console.log(`  ${k}: ${v.n} 便、合計 ${e(v.J)} J、遮蔽は質量の ${((100 * v.sh) / v.m).toFixed(2)}%`);
  console.log(`政府 ${r.govs} (蓄えが負 ${r.negative})・入植地 ${r.colonies}・交易路 ${r.routes}`);
  console.log(`太陽系: 覆う割合 ${r.earth.cover.toFixed(3)}・発電 ${e(r.earth.power)} J/年・蓄え ${e(r.earth.E)} J`);
  console.log('太陽系の収支 [J/年]:', Object.entries(r.earth.ledger || {}).map(([k, v]) => `${k} ${e(v)}`).join(' / '), errs.slice(0, 3));
  await b.close();
})();
