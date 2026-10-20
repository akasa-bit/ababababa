// 物理 (星間の気体と遮蔽) の試験。docs/physics.md の 5。ブラウザを使わず、画面なしの版で回す。
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
const sim = H.load();
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
for (const f of fails) console.log('  ×', f);
process.exit(fails.length ? 1 : 0);
