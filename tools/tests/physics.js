// 物理 (星間の気体と遮蔽・加速の時間・惑星の地表の被曝) の試験。docs/physics.md の 5・6。ブラウザを使わず、画面なしの版をシミュレーション版として回す
// (物理はシミュレーション版だけに入れた。ゲーム版は物理なしで main と同じ試合になる)。
// 1. ゲームに書いた値が、生データから作ったファイルと同じ (ISM ← data/derived/ism.json、SHIELD_DOSE ← data/derived/shield.json)
// 2. ゲームが決めた遮蔽の厚さで、Geant4 の生の点 (均す前) から読んだ線量が限度に合う (統計の誤差のぶん、0.5〜2 倍)。
//    前: 線量 (核子 1 個/cm² あたり) × 当たる核子の数。横: 宇宙線の線量率 × 船の時間
// 3. 試合を回して、航路のある便はすべて遮蔽を持ち、遮蔽の厚さが航路の長さとともに増える
// 使い方: node tools/tests/physics.js [シード] [年数] [国の数]
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const H = require('../headless');
const P = require('../physics');
const [seed = '5', years = '150', nations = '0'] = process.argv.slice(2);

const ism = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/ism.json'), 'utf8'));
const sh = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/shield.json'), 'utf8'));
const sim = H.load({ edition: 'sim' });
const T = sim.tables;
const fails = [];

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

// 3
// 4. 加速と減速の遅れ: 1g・0.95c で、4.37 光年なら 1.40 年 (式から手で計算した値)。10g の荷は 0.140 年
const ax = [sim.evaluate('accelExtra(4.37, 0.95, 1)'), sim.evaluate('accelExtra(4.37, 0.95, 10)')];
if (Math.abs(ax[0] - 1.4026) > 1e-3 || Math.abs(ax[1] - 0.14026) > 1e-4) fails.push(`加速の遅れ ${ax}`);
// 5. 惑星の地表の被曝: 表の値が shield.json と同じ。地球 (1 bar) の地表は限度よりずっと低く、空気のない星の地表は高い
if (JSON.stringify(T.SURFACE_DOSE) !== JSON.stringify(sh.game.surface)) fails.push('SURFACE_DOSE が shield.json と違う');
const fl = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/flares.json'), 'utf8'));
if (JSON.stringify(T.FLARES) !== JSON.stringify(fl.game)) fails.push('FLARES が flares.json と違う');
const earth = sim.evaluate('annualDose(FLARES.sun, 1, 1019.7)'), moon = sim.evaluate('annualDose(FLARES.sun, 1, 0)');
if (!(earth < 1e-3 && moon > earth * 100)) fails.push(`地表の線量 地球 ${earth}・空気なし ${moon}`);
// 6. スウォームの太陽電池の劣化: 表が pv.json と同じ。太陽 (1 AU) はほとんど傷まず、ゲーム版は傷まない (1)
const pv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/pv.json'), 'utf8'));
if (JSON.stringify(T.PV_DAMAGE.ddd) !== JSON.stringify(pv.ddd_by_glass_um)) fails.push('PV_DAMAGE が pv.json と違う');
const rfSun = sim.evaluate('pvRemaining({ cls: "G", lum: 1 })'), rfM = sim.evaluate('pvRemaining({ cls: "M", lum: 0.005 })');
const rfGame = H.load().evaluate('pvRemaining({ cls: "M", lum: 0.005 })');
if (!(rfSun > 0.9 && rfSun < 1 && rfM < rfSun && rfGame === 1)) fails.push(`太陽電池の出力の残り 太陽 ${rfSun}・M ${rfM}・ゲーム版 ${rfGame}`);
// 7. 素子の作り: 質量は部品の和 (平板 = 電池 0.0745 + ガラス、集光 = 0.060 + ガラス ÷ 8.5)。太陽は今の標準 (a) を自動で選び、
// バーナード星 (M 型星) は集光 (c) を選ぶ。作りを変える指令は届いた星系で効き、ゲーム版の広がり方は SWARM.doubling のまま
const D = T.PV_DESIGNS, glassG = (um) => um * 1e-4 * 2.554;
const sig = { a: 0.0745 + glassG(100), b: 0.0745 + glassG(1000), c: 0.06 + glassG(1000) / 8.5 };
for (const k of Object.keys(sig)) if (Math.abs(D[k].sigma - sig[k]) > 0.002) fails.push(`素子の作り ${k} の質量 ${D[k].sigma} (部品の和 ${sig[k].toFixed(4)})`);
const gD = sim.newGame(seed, { nations: Number(nations) });
const barnard = gD.galaxy.systems.find((s) => s.name === 'バーナード星');
const autoSun = gD.pvAuto(0), autoM = barnard ? gD.pvAuto(barnard.id) : null;
const pvM = barnard ? Object.fromEntries(Object.keys(D).map((k) => [k, gD.pvOf(barnard.id, k)])) : {};
if (autoSun !== 'a' || autoM !== 'c') fails.push(`自動の作り 太陽 ${autoSun}・バーナード星 ${autoM}`);
if (barnard && !(pvM.b.rf > pvM.c.rf && pvM.c.rf > pvM.a.rf && pvM.c.rate > pvM.b.rate)) fails.push(`バーナード星の作りごとの値 ${JSON.stringify(pvM)}`);
sim.run(gD, 1);
const r0 = gD.command('pvdesign', { sys: gD.cap, value: 'b' });
if (!r0.ok || gD.pvDesign(gD.cap) !== 'b') fails.push(`作りを変える指令 ${JSON.stringify(r0)}`);
const gG = H.load().newGame(seed, { nations: Number(nations) });
gG.year += 10;
const fG = gG.swarmCover(gG.cap), f0 = gG.govs[gG.cap].sw[0];
const fExp = 1 / (1 + (1 / f0 - 1) * Math.exp((-Math.LN2 / 5) * (gG.year - gG.govs[gG.cap].sw[1])));
if (Math.abs(fG - fExp) > 1e-9) fails.push(`ゲーム版のスウォームの広がり ${fG} (式 ${fExp})`);
// 8. 物理学者の指摘 (P-6。docs/sf-critiques.md): 近づく帆を止める光は加速の (γβ−γ+1)/(γβ+γ−1) 倍 (0.95c で 0.160)。
// ゲーム版は加速と同じ。M 型星の近すぎる岩の惑星 (プロキシマ d) は大気を持たない (ゲーム版は持つ)。乗る人の時計は 0.95c・20 光年で 6.6 年 (ゲーム版)
const pr = sim.evaluate('propulsion(1e9, 0.95, "route")'), prG = H.load().evaluate('propulsion(1e9, 0.95, "route")');
const gb = 1 / Math.sqrt(1 - 0.95 ** 2), want = (gb * 0.95 - gb + 1) / (gb * 0.95 + gb - 1);
if (Math.abs(pr.dec / pr.acc - want) > 1e-9 || prG.dec !== prG.acc) fails.push(`減速のエネルギー ${pr.dec / pr.acc} (式 ${want})・ゲーム版 ${prG.dec / prG.acc}`);
const prox = (G) => G.galaxy.systems.find((s) => s.cat === 'GJ 559')?.bodies.find((b) => /d$/.test(b.name));
const g1S = sim.newGame('1', { nations: 6 }), g1G = H.load().newGame('1', { nations: 6 }); // 銀河 1 のプロキシマ d は、ゲーム版で 3.3 気圧の海の星
const pdS = prox(g1S), pdG = prox(g1G);
if (!pdS || !pdG || !(pdS.pressure === 0 && pdS.stripped && pdG.pressure > 0)) fails.push(`プロキシマ d の大気 シミュレーション ${pdS?.pressure}・ゲーム ${pdG?.pressure}`);
const tG = H.load().evaluate('shipTime(20, 0.95)');
if (Math.abs(tG - 20 * Math.sqrt(1 - 0.95 ** 2) / 0.95) > 1e-9) fails.push(`乗る人の時計 ${tG}`);
// 進路変更: 止まるまで (c/a)γβ 年 (0.9c・1g で 2.0 年)
let flt = null;
for (let k = 0; k < 40 && !flt; k++) { sim.run(g1S, 2); flt = g1S.fleets.find((f) => f.arrive - g1S.year > 3 && !f.prev); }
if (flt) {
  const other = g1S.galaxy.systems.find((s) => s.id !== flt.to && s.id !== flt.from).id;
  g1S.redirectFleet(flt.id, other);
  const ts = ((299792458 / 9.80665 / 31557600) * 0.9) / Math.sqrt(1 - 0.81), leg = flt.prev.at(-1);
  if (!(leg?.toXY && flt.depart > g1S.year && flt.depart - g1S.year <= ts + 1e-6)) fails.push(`進路変更で止まるまで ${flt.depart - g1S.year} 年 (多くて ${ts})`);
} else fails.push('進路変更を試す艦隊がない');
const { rows } = P.voyages(seed, Number(years), Number(nations), null);
const withLy = rows.filter((x) => x.ly > 0);
const noShield = withLy.filter((x) => !(x.shield > 0));
if (!rows.length) fails.push('便がない');
if (noShield.length) fails.push(`航路があるのに遮蔽のない便 ${noShield.length}`);
const d1 = sim.evaluate('shieldOf("migrant", 1e9, 0.95, 5).depth'), d2 = sim.evaluate('shieldOf("migrant", 1e9, 0.95, 50).depth');
if (!(d2 > d1)) fails.push('遮蔽の厚さが航路の長さで増えない');
const sum = P.summarize(rows);

console.log(`物理 ${fails.length ? '不合格' : '合格'} ・ 便 ${rows.length} ・ 限度との比 ${Math.min(...lims.map((l) => l.ratio)).toFixed(2)}〜${Math.max(...lims.map((l) => l.ratio)).toFixed(2)}`);
for (const l of lims.filter((l) => l.ly === 10 && l.what !== '合計')) console.log(`  ${l.beta}c・10 光年・${l.kind}・${l.what}: 水 ${((l.what === '前' ? l.depth : l.side) / 100).toFixed(2)} m、線量 ÷ 限度 ${l.ratio.toFixed(2)} (1e9 kg の船の遮蔽 ${(l.kg / 1e9 * 100).toFixed(1)}%)`);
for (const l of lims.filter((l) => l.what === '合計' && l.ly === 10)) console.log(`  ${l.beta}c・10 光年・乗る人: 限度のうち前に ${(100 * l.share).toFixed(0)}%、前と横の和 ÷ 限度 ${l.ratio.toFixed(2)}`);
for (const [k, v] of Object.entries(sum)) console.log(`  ${k}: ${v.n} 便・航路の長さの中央値 ${v.lyMedian.toFixed(1)} 光年・遮蔽の厚さの中央値 ${(v.depthMedian / 100).toFixed(1)} m・遮蔽 ÷ 質量 の中央値 ${(100 * v.fracMedian).toFixed(2)}% (最大 ${(100 * v.fracMax).toFixed(1)}%)`);
console.log(`  加速の遅れ (4.37 光年・0.95c): 1g で ${ax[0].toFixed(2)} 年・10g で ${ax[1].toFixed(3)} 年`);
console.log(`  地表の 1 年の線量 (太陽から 1 AU): 地球の大気の下 ${(earth * 1e3).toFixed(3)} mSv・空気なし ${(moon * 1e3).toFixed(0)} mSv`);
console.log(`  スウォームの太陽電池の出力の残り (15 年で取り替え): 太陽 ${rfSun.toFixed(3)}・M 型星の中央値の陽子で光度 0.005 ${rfM.toFixed(3)}`);
if (barnard) console.log(`  素子の作り (バーナード星): ${Object.entries(pvM).map(([k, v]) => `${k} 出力の残り ${v.rf.toFixed(2)}・倍の年数 ${(Math.LN2 / v.rate).toFixed(1)} 年`).join('・')} → 自動は ${autoM}`);
for (const f of fails) console.log('  ×', f);
process.exit(fails.length ? 1 : 0);
