// 医療の水準と 65 歳以上の死亡率・戦争と税収の試験 (ユーザーの依頼 2026-11-08 の common-5。docs/research/health-mortality.md・war-fiscal.md)。画面なしの版で回す:
//   医療: 標準 (100%) なら倍率 1 で前と同じ・0% と 300% の倍率がデータの式 (1 + 0.7227 (L − 1))^−0.0436 に合う・1 刻みで 65 歳以上の死者だけがその倍率で変わり、64 歳までは変わらない・
//     払えた割合 apaid が水準に掛かる
//   戦争: 戦争疲弊では税収が減らない (疲弊 0 と 100 で同じ)・独立された元の国は、独立戦争の間だけ税収 × 0.95・終われば戻る・独立した側は減らない
// 使い方: node tools/tests/healthwar.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['5'], judge: (o) => (o.includes('医療と戦争の税 合格') ? '' : '医療の水準と死亡率・戦争と税収の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '5'] = process.argv.slice(2);
const sim = H.load({});
const { DEMO } = sim.tables;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const res = {};
const g = sim.newGame(seed, { nations: 6 });
g.setSpectate(true);
sim.run(g, 30);

// 1. 医療の水準 → 65 歳以上の死亡
const kOf = (L) => Math.pow(1 + DEMO.healthMort.share * (L - 1), DEMO.healthMort.beta);
res.data = near(kOf(0), 1.0575, 1e-3) && near(kOf(3), 0.9618, 1e-3);
const c = g.colonies.filter((x) => x.age).sort((a, b) => b.pop - a.pop)[0];
res.std = g.healthLvAt(c.sys) === 1;
const o0 = DEMO.work[1] + 1;
const step = (L) => {
  const x = { ...c, age: { f: [...c.age.f], m: [...c.age.m] }, edu: c.edu ? JSON.parse(JSON.stringify(c.edu)) : c.edu };
  g.healthLvAt = () => L;
  g.demoStep(x, 0.25, 1, 0);
  delete g.healthLvAt;
  return { x };
};
const s1 = step(1), s0 = step(0), s3 = step(3);
const bins = (s) => s.x.age.f.map((v, a) => v + s.x.age.m[a]);
const b1 = bins(s1), b0 = bins(s0), b3 = bins(s3);
// 64 歳まで (いちばん上の 64 歳のきざみから 65 歳へ上がる分も含めて) は同じ
res.young = b1.slice(0, o0).every((v, a) => v === b0[a] && v === b3[a]);
// 65 歳以上の生き残りの差は、刻みの前の人数 × (sv − sv^k) の和にちょうど合う (64 歳から上がってくる分はどの L でも同じなので差し引きで消える)
const old = (b) => b.slice(o0).reduce((k, v) => k + v, 0);
const rt = g.demoRates(c, 0.25 / (sim.tables.ED.generation / 28));
const gap = (L) => { const k = kOf(L); let v = 0; for (let a = o0; a < DEMO.bins; a++) v += c.age.f[a] * (rt.sf[a] - Math.pow(rt.sf[a], k)) + c.age.m[a] * (rt.sm[a] - Math.pow(rt.sm[a], k)); return v; };
const dead1 = (() => { let v = 0; for (let a = o0; a < DEMO.bins; a++) v += c.age.f[a] * (1 - rt.sf[a]) + c.age.m[a] * (1 - rt.sm[a]); return v; })();
res.gap = near(old(b1) - old(b0), gap(0), 1e-6) && near(old(b1) - old(b3), gap(3), 1e-6);
res.order = old(b0) < old(b1) && old(b1) < old(b3);
// 65 歳以上の死者の比 (0% と 300%) は倍率とほぼ同じ (死亡の確率が小さいので 1 − sv^k ≈ k (1 − sv))
res.deaths = { L0: +((dead1 + old(b1) - old(b0)) / dead1).toFixed(4), L3: +((dead1 + old(b1) - old(b3)) / dead1).toFixed(4), k0: +kOf(0).toFixed(4), k3: +kOf(3).toFixed(4) };
res.ratio = Math.abs(res.deaths.L0 - res.deaths.k0) < 0.01 && Math.abs(res.deaths.L3 - res.deaths.k3) < 0.01;
// 払えた割合が水準に掛かる
const gv = g.gov(c.sys), ap = gv.apaid;
gv.apaid = 0.5;
res.apaid = near(g.healthLvAt(c.sys), 0.5 * (g.fiscalAt(c.sys).budget?.health ?? 1));
gv.apaid = ap;

// 2. 戦争と税収
const r = g.cap, other = Number(Object.keys(g.govs).find((k) => Number(k) !== r && g.realmOf(Number(k)) === Number(k) && g.isColonized(Number(k))));
const taxOf = () => { const cr = g.gov(r).credits; g.earn('tax', 100, r); const d = g.gov(r).credits - cr; g.gov(r).credits = cr; g.gov(r).led.tax -= d; return d; };
const ex0 = g.exhaustion[r];
g.exhaustion[r] = 0;
const t0 = taxOf();
g.exhaustion[r] = 100;
const t100 = taxOf();
res.exhaust = near(t0, t100);
// 独立戦争: 元の国 r が、独立した国 other と戦っている間だけ × 0.95
const key = g.warKey(other, r);
const had = { w: g.realmWars[key], s: g.warStats[key] };
g.realmWars[key] = g.year; g.warStats[key] = { k: {}, t: {}, cv: r };
const tCivil = taxOf();
const cOther = (() => { const cr = g.gov(other).credits; g.earn('tax', 100, other); const d = g.gov(other).credits - cr; g.gov(other).credits = cr; g.gov(other).led.tax -= d; return d; })();
g.warStats[key].cv = undefined;
const tWar = taxOf(); // 国家間戦争 (印なし) は減らない
g.warStats[key].cv = r;
delete g.realmWars[key]; // 戦争が終わる (warStats は年ごとに片づく)
const tAfter = taxOf();
if (had.w !== undefined) g.realmWars[key] = had.w; else delete g.realmWars[key];
if (had.s) g.warStats[key] = had.s; else delete g.warStats[key];
g.exhaustion[r] = ex0;
res.civil = near(tCivil, 0.95 * t0) && near(tWar, t0) && near(tAfter, t0);
res.rebelSide = cOther > 0 && !g.civilWarOf(other);
// 実際の独立で印が付く: 地球の国の家臣を独立させる (独立戦争になるまで試す)
let marked = null;
for (let i = 0; i < 40 && marked === null; i++) {
  const v = Object.keys(g.govs).map(Number).find((id) => id !== g.cap && g.isColonized(id) && g.realmOf(id) === g.cap && g.govs[id].lord !== null);
  if (v === undefined) { sim.run(g, 10); continue; }
  g.declareIndependence(v);
  if (g.lastIndependence?.war) marked = g.warStats[g.warKey(v, g.cap)]?.cv === g.cap && g.civilWarOf(g.cap);
}
res.marked = marked;
const ok = res.data && res.std && res.young && res.gap && res.order && res.ratio && res.apaid && res.exhaust && res.civil && res.rebelSide && res.marked === true;
console.log(JSON.stringify(res));
console.log(ok ? '医療と戦争の税 合格' : '医療と戦争の税 不合格');
process.exitCode = ok ? 0 : 1;
