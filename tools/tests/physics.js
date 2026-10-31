// 物理 (星間の気体と遮蔽・加速の時間・惑星の地表の被曝・スウォームの太陽電池の劣化) の試験。docs/physics.md の 5・6・7・10。ブラウザを使わず、画面なしの版で回す。
// EDITION=game でゲーム版 (2026-10-21 の P6: 遮蔽と加速の時間を入れ、フレアは惑星の欄の表示だけ、太陽電池の劣化はなし。CI では落ちたら止める)、
// EDITION=sim (既定) でシミュレーション版 (全部入り。CI では参考)。
// 1. ゲームに書いた値が、生データから作ったファイルと同じ (ISM ← data/derived/ism.json、SHIELD_DOSE ← data/derived/shield.json)
// 2. ゲームが決めた遮蔽の厚さで、Geant4 の生の点 (均す前) から読んだ線量が限度に合う (統計の誤差のぶん、0.5〜2 倍)。
//    前: 線量 (核子 1 個/cm² あたり) × 当たる核子の数。横: 宇宙線の線量率 × 船の時間
// 3. 試合を回して、航路のある便はすべて遮蔽を持ち、遮蔽の厚さが航路の長さとともに増える
// 4. 加速と減速の遅れが式の値。5. 地表の線量の表と、地球と空気のない星の値
// 6・7. 太陽電池の劣化と素子の作り (シミュレーション版)。ゲーム版は傷まず、フレアは適性を変えず、物理の切り替えのないセーブは物理なしのまま続く
// 使い方: EDITION=game node tools/tests/physics.js [シード] [年数] [国の数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [
  // ゲーム版の分 (遮蔽・加速の時間・フレアの表示。2026-10-21 の P6) は落ちたら止める。シミュレーション版の分 (太陽電池の劣化も) は参考
  { args: ['5', '150'], judge: (o, code) => (code === 0 && o.trim().split('\n')[0].includes('物理 合格') ? '' : '物理 不合格 (ゲーム版)'), env: { EDITION: 'game' } },
  { args: ['5', '150'], judge: (o, code) => (code === 0 && o.trim().split('\n')[0].includes('物理 合格') ? '' : '物理 不合格 (シミュレーション版)'), optional: true, env: { EDITION: 'sim' } },
];
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const H = require('../headless');
const P = require('../physics');
const [seed = '5', years = '150', nations = '0'] = process.argv.slice(2);
const EDITION = process.env.EDITION || 'sim';

const ism = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/ism.json'), 'utf8'));
const sh = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/shield.json'), 'utf8'));
const sim = H.load({ edition: EDITION });
const T = sim.tables;
const PH = T.ED.physics;
const fails = [];
if (EDITION === 'game' ? !(PH.shield && PH.accel && PH.flare === 'show' && !PH.pv) : !(PH.shield && PH.accel && PH.flare === true && PH.pv)) fails.push(`物理の切り替えが決めたものと違う ${JSON.stringify(PH)}`);

// 1
if (Math.abs(T.ISM.nNuc - ism.n_nucleon) > 1e-4) fails.push(`ISM.nNuc ${T.ISM.nNuc} ≠ ism.json ${ism.n_nucleon}`);
if (JSON.stringify(T.SHIELD_DOSE) !== JSON.stringify(sh.game.front)) fails.push('SHIELD_DOSE が shield.json の game.front と違う');
if (JSON.stringify(T.SHIELD_GCR) !== JSON.stringify(sh.game.gcr)) fails.push('SHIELD_GCR が shield.json の game.gcr と違う');

// 2: 生の点を ln で直線につなぎ、表より深い所は Geant4 の一番深い 6 点の傾きで延ばす
const rawDose = (run, key, t) => {
  const r = sh.runs[run];
  const pts = r.points.filter((p) => p[key] > 0 && p['d' + key] / p[key] < 0.35);
  if (t >= pts[pts.length - 1].t) { const f = r['tail' + key]; return Math.exp(f.ln_ref - (t - f.t_ref) / f.lambda); }
  const i = pts.findIndex((p) => p.t >= t);
  if (i <= 0) return pts[0][key];
  const a = pts[i - 1], b = pts[i];
  return Math.exp(Math.log(a[key]) + ((t - a.t) / (b.t - a.t)) * (Math.log(b[key]) - Math.log(a[key])));
};
const lims = [];
const check = (what, ratio, l) => { lims.push({ ...l, what, ratio }); if (!(ratio > 0.5 && ratio < 2)) fails.push(`${l.beta}c ${l.ly} 光年 ${l.kind} ${what}: 線量 ÷ 限度 = ${ratio.toFixed(2)}`); };
for (const [beta, run, grun] of [[0.95, 'p95', 'g95'], [0.9, 'p90', 'g90']]) {
  for (const ly of [1, 3, 10, 30, 100]) {
    for (const kind of ['migrant', 'cargo']) {
      const s = sim.evaluate(`shieldOf(${JSON.stringify(kind)}, 1e9, ${beta}, ${ly})`);
      const crew = kind === 'migrant';
      const l = { beta, ly, kind, depth: s.depth, side: s.side, kg: s.kg };
      // 乗る人の限度は、ゲームが選んだ割り振り (share) で前と横に分かれる。前と横の和が限度に収まることも見る
      const front = s.fluence * rawDose(run, crew ? 'H' : 'D', s.depth);
      check('前', front / (crew ? T.SHIELD.crewSv * s.share : T.SHIELD.cargoGy), l);
      if (crew) {
        const side = s.tau * rawDose(grun, 'H', s.side);
        check('横', side / (T.SHIELD.crewSv * (1 - s.share)), l);
        check('合計', (front + side) / T.SHIELD.crewSv, { ...l, share: s.share });
      }
    }
  }
}

// 4. 加速と減速の遅れ: 1g・0.95c で、4.37 光年なら 1.40 年 (式から手で計算した値)。10g の荷は 0.140 年
const ax = [sim.evaluate('accelExtra(4.37, 0.95, 1)'), sim.evaluate('accelExtra(4.37, 0.95, 10)')];
if (Math.abs(ax[0] - 1.4026) > 1e-3 || Math.abs(ax[1] - 0.14026) > 1e-4) fails.push(`加速の遅れ ${ax}`);
// 物理なしの切り替えでは、遮蔽も遅れも 0
const off = sim.evaluate('[shieldOf("migrant", 1e9, 0.95, 10, PHYSICS_OFF).kg, accelExtra(4.37, 0.95, 1, PHYSICS_OFF)]');
if (off[0] !== 0 || off[1] !== 0) fails.push(`物理なしの切り替えで遮蔽 ${off[0]}・遅れ ${off[1]}`);
// 5. 惑星の地表の被曝: 表の値が shield.json と同じ。地球 (1 bar) の地表は限度よりずっと低く、空気のない星の地表は高い
if (JSON.stringify(T.SURFACE_DOSE) !== JSON.stringify(sh.game.surface)) fails.push('SURFACE_DOSE が shield.json と違う');
const fl = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/flares.json'), 'utf8'));
if (JSON.stringify(T.FLARES) !== JSON.stringify(fl.game)) fails.push('FLARES が flares.json と違う');
const earth = sim.evaluate('annualDose(FLARES.sun, 1, 1019.7)'), moon = sim.evaluate('annualDose(FLARES.sun, 1, 0)');
if (!(earth < 1e-3 && moon > earth * 100)) fails.push(`地表の線量 地球 ${earth}・空気なし ${moon}`);
// 6. スウォームの太陽電池の劣化: 表が pv.json と同じ。太陽 (1 AU) はほとんど傷まず、ゲーム版は傷まない (1)
const pv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/pv.json'), 'utf8'));
if (JSON.stringify(T.PV_DAMAGE.ddd) !== JSON.stringify(pv.ddd_by_glass_um)) fails.push('PV_DAMAGE が pv.json と違う');
const rfSun = sim.evaluate('pvRemaining({ cls: "G", lum: 1 }, PV_DAMAGE, true)'), rfM = sim.evaluate('pvRemaining({ cls: "M", lum: 0.005 }, PV_DAMAGE, true)');
const rfOff = sim.evaluate('pvRemaining({ cls: "M", lum: 0.005 }, PV_DAMAGE, false)');
if (!(rfSun > 0.9 && rfSun < 1 && rfM < rfSun && rfOff === 1)) fails.push(`太陽電池の出力の残り 太陽 ${rfSun}・M ${rfM}・切ったとき ${rfOff}`);
// 素子の作りの質量は部品の和 (平板 = 電池 0.0745 + ガラス、集光 = 0.060 + ガラス ÷ 8.5)
const D = T.PV_DESIGNS, glassG = (um) => um * 1e-4 * 2.554;
const sig = { a: 0.0745 + glassG(100), b: 0.0745 + glassG(1000), c: 0.06 + glassG(1000) / 8.5 };
for (const k of Object.keys(sig)) if (Math.abs(D[k].sigma - sig[k]) > 0.002) fails.push(`素子の作り ${k} の質量 ${D[k].sigma} (部品の和 ${sig[k].toFixed(4)})`);

const gD = sim.newGame(seed, { nations: Number(nations) });
const barnard = gD.galaxy.systems.find((s) => s.name === 'バーナード星');
let pvM = {}, autoM = null;
if (EDITION === 'sim') {
  // 7. 素子の作り: 太陽は今の標準 (a) を自動で選び、バーナード星 (M 型星) は集光 (c) を選ぶ。作りを変える指令は届いた星系で効く
  const autoSun = gD.pvAuto(0); autoM = barnard ? gD.pvAuto(barnard.id) : null;
  pvM = barnard ? Object.fromEntries(Object.keys(D).map((k) => [k, gD.pvOf(barnard.id, k)])) : {};
  if (autoSun !== 'a' || autoM !== 'c') fails.push(`自動の作り 太陽 ${autoSun}・バーナード星 ${autoM}`);
  if (barnard && !(pvM.b.rf > pvM.c.rf && pvM.c.rf > pvM.a.rf && pvM.c.rate > pvM.b.rate)) fails.push(`バーナード星の作りごとの値 ${JSON.stringify(pvM)}`);
  sim.run(gD, 1);
  const r0 = gD.command('pvdesign', { sys: gD.cap, value: 'b' });
  if (!r0.ok || gD.pvDesign(gD.cap) !== 'b') fails.push(`作りを変える指令 ${JSON.stringify(r0)}`);
} else {
  // ゲーム版: 太陽電池は傷まず、スウォームは SWARM.doubling のまま広がる。素子の作りの指令は効かない
  const gG = sim.newGame(seed, { nations: Number(nations) });
  gG.year += 10;
  const fG = gG.swarmCover(gG.cap), f0 = gG.govs[gG.cap].sw[0];
  const fExp = 1 / (1 + (1 / f0 - 1) * Math.exp((-Math.LN2 / 5) * (gG.year - gG.govs[gG.cap].sw[1])));
  if (Math.abs(fG - fExp) > 1e-9) fails.push(`ゲーム版のスウォームの広がり ${fG} (式 ${fExp})`);
  if (gG.command('pvdesign', { sys: gG.cap, value: 'b' }).ok) fails.push('ゲーム版で素子の作りの指令が通った');
  // フレアは表示だけ: 地表の線量が限度を超える岩の惑星にも rad があるが、入植適性は変わっていない (適性は radiationOf を切った値と同じ)
  const bodies = gD.galaxy.systems.flatMap((s) => s.bodies.filter((b) => b.rad));
  const hot = bodies.filter((b) => b.rad.surf > T.RADIATION.limitSv);
  if (!bodies.length || !hot.length) fails.push(`惑星の欄に出す地表の線量がない (rad ${bodies.length}・限度超え ${hot.length})`);
  if (hot.some((b) => b.rad.cover <= 0)) fails.push('限度を超える惑星に、地下に要る覆いがない');
  if (hot.some((b) => b.settle.notes.some((n) => n.includes('地表の被曝')))) fails.push('ゲーム版なのに、地表の被曝で入植適性を変えた');
  const simG = H.load({ edition: 'sim' }).newGame(seed, { nations: 0 });
  const grades = (g) => g.galaxy.systems.flatMap((s) => s.bodies.map((b) => b.settle?.grade ?? -1)).join(',');
  const offG = H.load({ edition: EDITION, params: { ED: { physics: { flare: false } } } }).newGame(seed, { nations: 0 });
  if (grades(gD) !== grades(offG)) fails.push('ゲーム版の入植適性が、フレアを切ったときと違う');
  if (simG.galaxy.systems.flatMap((s) => s.bodies.filter((b) => b.rad)).length !== bodies.length) fails.push('シミュレーション版と、地表の線量を持つ惑星の数が違う');
}
// 物理の切り替えのないセーブ (物理を入れる前) は、物理なしのまま続く: 切り替えを抜いたセーブを読んだ試合が、物理なしで作った試合と同じ筋になる
{
  const offSim = H.load({ edition: EDITION, params: { ED: { physics: { shield: false, accel: false, pv: false } } } });
  const g0 = sim.newGame(seed, { nations: 6 });
  const d = JSON.parse(JSON.stringify(sim.buildSave(g0)));
  delete d.physics;
  const g1 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  if (!g1.restore(d)) fails.push('切り替えのないセーブが読めない');
  if (!(g1.physics && !g1.physics.shield && !g1.physics.accel && !g1.physics.pv)) fails.push(`切り替えのないセーブが物理ありで読まれた ${JSON.stringify(g1.physics)}`);
  const g2 = offSim.newGame(seed, { nations: 6 });
  sim.run(g1, 40); offSim.run(g2, 40);
  if (sim.hash(g1) !== offSim.hash(g2)) fails.push('切り替えのないセーブの試合が、物理なしの試合と違う筋になった');
  // 物理ありの試合は、物理なしと違う筋になる (遮蔽の分のエネルギーと加速の遅れ)
  const g3 = sim.newGame(seed, { nations: 6 });
  sim.run(g3, 40);
  if (sim.hash(g3) === offSim.hash(g2)) fails.push('物理ありの試合が、物理なしと同じ筋');
}
// 8. 物理学者の指摘 (P-6。docs/sf-critiques.md): 近づく帆を止める光は加速の (γβ−γ+1)/(γβ+γ−1) 倍 (0.95c で 0.160)。
// ゲーム版は加速と同じ。M 型星の近すぎる岩の惑星 (プロキシマ d) は大気を持たない (ゲーム版は持つ)。乗る人の時計は 0.95c・20 光年で、1g の加速と減速 (physics.accel) の分も入れて 2T atanh β + (道のり − 2T(γ−1)) ÷ γβ
const SL = H.load({ edition: 'sim' }), GL = H.load({ edition: 'game' });
const pr = SL.evaluate('propulsion(1e9, 0.95, "route")'), prG = GL.evaluate('propulsion(1e9, 0.95, "route")');
const gb = 1 / Math.sqrt(1 - 0.95 ** 2), want = (gb * 0.95 - gb + 1) / (gb * 0.95 + gb - 1);
if (Math.abs(pr.dec / pr.acc - want) > 1e-9 || prG.dec !== prG.acc) fails.push(`減速のエネルギー ${pr.dec / pr.acc} (式 ${want})・ゲーム版 ${prG.dec / prG.acc}`);
const prox = (G) => G.galaxy.systems.find((s) => s.cat === 'GJ 559')?.bodies.find((b) => /d$/.test(b.name));
const g1S = SL.newGame('1', { nations: 6 }), g1G = GL.newGame('1', { nations: 6 }); // 銀河 1 のプロキシマ d は、ゲーム版で 3.3 気圧の海の星
const pdS = prox(g1S), pdG = prox(g1G);
if (!pdS || !pdG || !(pdS.pressure === 0 && pdS.stripped && pdG.pressure > 0)) fails.push(`プロキシマ d の大気 シミュレーション ${pdS?.pressure}・ゲーム ${pdG?.pressure}`);
const tG = GL.evaluate('shipTime(20, 0.95)'), T1g = 299792458 / 9.80665 / 31557600, gG95 = 1 / Math.sqrt(1 - 0.95 ** 2);
const tWant = 2 * T1g * Math.atanh(0.95) + (20 - 2 * T1g * (gG95 - 1)) / (gG95 * 0.95);
if (Math.abs(tG - tWant) > 1e-9) fails.push(`乗る人の時計 ${tG} (式 ${tWant})`);
// 進路変更: 止まるまで (c/a)γβ 年 (0.9c・1g で 2.0 年)。止まった点から出直すのは、いちばん近い自国の星系のレーザーの光が届いてから (B-169)
let flt = null;
for (let k = 0; k < 40 && !flt; k++) { SL.run(g1S, 2); flt = g1S.fleets.find((f) => f.arrive - g1S.year > 3 && !f.prev); }
if (flt) {
  const other = g1S.galaxy.systems.find((s) => s.id !== flt.to && s.id !== flt.from).id;
  g1S.redirectFleet(flt.id, other);
  const ts = ((299792458 / 9.80665 / 31557600) * 0.9) / Math.sqrt(1 - 0.81), leg = flt.prev.at(-1);
  const stop = leg?.arrive - g1S.year, wait = leg?.toXY ? g1S.laserBase(flt.owner ?? 0, leg.toXY).d : NaN;
  if (!(leg?.toXY && stop > 0 && stop <= ts + 1e-6)) fails.push(`進路変更で止まるまで ${stop} 年 (多くて ${ts})`);
  if (!(Math.abs(flt.depart - leg?.arrive - wait) < 1e-6)) fails.push(`止まった点から出直すまで ${flt.depart - leg?.arrive} 年 (レーザーの光が届くまで ${wait} 年)`);
} else fails.push('進路変更を試す艦隊がない');
// 3
const { rows } = P.voyages(seed, Number(years), Number(nations), null, EDITION);
const withLy = rows.filter((x) => x.ly > 0);
const noShield = withLy.filter((x) => !(x.shield > 0));
if (!rows.length) fails.push('便がない');
if (noShield.length) fails.push(`航路があるのに遮蔽のない便 ${noShield.length}`);
const d1 = sim.evaluate('shieldOf("migrant", 1e9, 0.95, 5).depth'), d2 = sim.evaluate('shieldOf("migrant", 1e9, 0.95, 50).depth');
if (!(d2 > d1)) fails.push('遮蔽の厚さが航路の長さで増えない');
const sum = P.summarize(rows);

console.log(`物理 ${fails.length ? '不合格' : '合格'} (${EDITION === 'game' ? 'ゲーム版' : 'シミュレーション版'}) ・ 便 ${rows.length} ・ 限度との比 ${Math.min(...lims.map((l) => l.ratio)).toFixed(2)}〜${Math.max(...lims.map((l) => l.ratio)).toFixed(2)}`);
for (const l of lims.filter((l) => l.ly === 10 && l.what !== '合計')) console.log(`  ${l.beta}c・10 光年・${l.kind}・${l.what}: 水 ${((l.what === '前' ? l.depth : l.side) / 100).toFixed(2)} m、線量 ÷ 限度 ${l.ratio.toFixed(2)} (1e9 kg の船の遮蔽 ${(l.kg / 1e9 * 100).toFixed(1)}%)`);
for (const l of lims.filter((l) => l.what === '合計' && l.ly === 10)) console.log(`  ${l.beta}c・10 光年・乗る人: 限度のうち前に ${(100 * l.share).toFixed(0)}%、前と横の和 ÷ 限度 ${l.ratio.toFixed(2)}`);
for (const [k, v] of Object.entries(sum)) console.log(`  ${k}: ${v.n} 便・航路の長さの中央値 ${v.lyMedian.toFixed(1)} 光年・遮蔽の厚さの中央値 ${(v.depthMedian / 100).toFixed(1)} m・遮蔽 ÷ 質量 の中央値 ${(100 * v.fracMedian).toFixed(2)}% (最大 ${(100 * v.fracMax).toFixed(1)}%)`);
console.log(`  加速の遅れ (4.37 光年・0.95c): 1g で ${ax[0].toFixed(2)} 年・10g で ${ax[1].toFixed(3)} 年`);
console.log(`  地表の 1 年の線量 (太陽から 1 AU): 地球の大気の下 ${(earth * 1e3).toFixed(3)} mSv・空気なし ${(moon * 1e3).toFixed(0)} mSv`);
console.log(`  スウォームの太陽電池の出力の残り (15 年で取り替え): 太陽 ${rfSun.toFixed(3)}・M 型星の中央値の陽子で光度 0.005 ${rfM.toFixed(3)}${EDITION === 'game' ? ' (ゲーム版では使わない)' : ''}`);
if (barnard && autoM) console.log(`  素子の作り (バーナード星): ${Object.entries(pvM).map(([k, v]) => `${k} 出力の残り ${v.rf.toFixed(2)}・倍の年数 ${(Math.LN2 / v.rate).toFixed(1)} 年`).join('・')} → 自動は ${autoM}`);
for (const f of fails) console.log('  ×', f);
process.exit(fails.length ? 1 : 0);
