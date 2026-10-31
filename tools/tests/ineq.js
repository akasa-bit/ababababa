// 星系ごとの所得の分け方と土地改革 (回 KE11・B-127。docs/fiscal.md の 12) の試験。画面なしの版で回す:
//   対数正規の 5 分位の分け前の合計が 1 で、σ = 0.65 なら世界銀行の中央値の分け前 (7.0・11.9・16.3・22.2・42.4%) に 1 点以内・
//   1 年回すと入植地のある星系に素の偏りが決まり、同じ銀河の番号なら同じ値・星系ごとに違う・
//   土地改革は法案になる・選べない値を断る・行政の遅れのあとに σ が農業の割合 × 改革の割合 × INEQ.agr だけ下がり、上位 20% の分け前が減る・
//   帰着の表の土地改革の行は家計の分位の合計が 0 で、上の分位が損・下の分位が得・保存と読み込みで素の偏りと σ が残る
// 使い方: node tools/tests/ineq.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('所得の分け方 合格') ? '' : '星系ごとの所得の分け方と土地改革の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const { INEQ } = sim.tables;
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const g = sim.run(sim.newGame(seed, { nations: 6 }), 40);
// 1. 分け前 (首都の素の偏りを、σ がちょうど 0.65 になるようにずらして読む)
{
  const gv = g.govs[g.cap], keep = gv.sgb;
  gv.sgb = keep + (0.65 - g.ineqSigma(g.cap));
  const m = g.quintOf(g.cap), wdi = [7.0, 11.9, 16.3, 22.2, 42.4];
  gv.sgb = keep;
  res.shares = near(m.reduce((a, v) => a + v, 0), 1, 1e-9);
  res.lognormal = m.every((x, i) => Math.abs(100 * x - wdi[i]) < 1); // 当てはまりの差の平均は分位ごとに 0.2〜0.8 点 (data/derived/ineq.json)
  res.shareNums = m.map((x) => +(100 * x).toFixed(2));
}
// 2. 素の偏り
{
  const ids = g.colonizedSystems().map((x) => x.id);
  const h = sim.run(sim.newGame(seed, { nations: 6 }), 40);
  res.base = ids.every((id) => Number.isFinite(g.govs[id].sgb)) && ids.every((id) => h.govs[id]?.sgb === g.govs[id].sgb) && new Set(ids.map((id) => g.govs[id].sgb.toFixed(6))).size > 1;
}
// 3. 土地改革
{
  const save = JSON.stringify(sim.buildSave(g));
  const twin = () => { const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN })); h.restore(JSON.parse(save)); h.setSpectate(false); h.pc = 100; return h; };
  const h = twin();
  res.bad = h.setFiscal({ land: 0.3 }, true).ok === false && h.setFiscal({ land: 1.5 }, true).ok === false;
  const b = twin();
  b.setFiscal({ land: 0.5 });
  res.bill = !!b.bill('fiscal') && b.bill('fiscal').target.land === 0.5 && !(b.fiscal?.land > 0);
  const id = h.cap, s0 = h.ineqSigma(id), q0 = h.quintOf(id)[4];
  let P = 0, A = 0;
  for (const c of h.coloniesIn(id)) { const sh = c.sh; P += c.pop; A += c.pop * ((sh.farm || 0) + (sh.home || 0)); }
  const rows = h.incidenceOf(h.cap, { ...(h.fiscal || sim.tables.FISCAL_DEFAULT), land: 1 }, { ...(h.fiscal || sim.tables.FISCAL_DEFAULT), land: 0 }), r = rows.find((x) => x.k === 'land');
  res.incidence = !!r && near(r.q.reduce((a, v) => a + v, 0), 0, 1e-9) && r.q[4] < 0 && r.q[0] > 0 && near(r.hh, 0, 1e-12);
  h.setFiscal({ land: 1 }, true);
  h.year += sim.tables.ADMIN_LAG.land + 0.01;
  const s1 = h.ineqSigma(id), q1 = h.quintOf(id)[4];
  res.land = near(s0 - s1, Math.min(s0 - INEQ.min, INEQ.agr * (A / P)), 1e-9) && q1 < q0;
  res.landNums = [+s0.toFixed(4), +s1.toFixed(4), +(100 * q0).toFixed(2), +(100 * q1).toFixed(2), +(A / P).toFixed(3)];
  // 上の分位の集団は土地改革で損をする
  const gi = h.groupIncidence(id, { ...h.fiscal, land: 1 }, { ...h.fiscal, land: 0 }, rows);
  res.groups = gi.filter((x) => x.q === 4).every((x) => x.by.land < 0) && gi.filter((x) => x.q === 0).every((x) => x.by.land > 0);
  // 保存と読み込み
  const d = JSON.parse(JSON.stringify(sim.buildSave(h)));
  const h2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  h2.restore(d);
  h2.year = h.year;
  res.saveLoad = h2.govs[id].sgb === h.govs[id].sgb && near(h2.ineqSigma(id), s1, 1e-12) && h2.fiscal.land === 1;
}
const ok = ['shares', 'lognormal', 'base', 'bad', 'bill', 'incidence', 'land', 'groups', 'saveLoad'].every((k) => res[k] === true);
console.log(`所得の分け方 ${ok ? '合格' : '不合格'} ${JSON.stringify(res)}`);
process.exit(ok ? 0 : 1);
