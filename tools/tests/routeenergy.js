// 交易路の受け手の減速のエネルギー (回 FU6・B-173。docs/energy.md の 6) の試験。画面なしの版で回す:
//   送り手は受け手の蓄えを光の遅れのぶん古い記録 (energySeen) で見る・'route' の荷は、出すときに受け手の蓄えが減らず、着いたときに減速の分 (dE) だけ減る・
//   1 便の加速と減速の合計は前と同じ式 (ENERGY_AUDIT の E)
// 使い方: node tools/tests/routeenergy.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('交易路の減速 合格') ? '' : '交易路の受け手の減速のエネルギーの結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const res = {}, near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const g = sim.run(sim.newGame(seed, { nations: 6 }), 60);
// 1. 見えている蓄え: 遠い星系は記録の値、自分の星系はいまの値
{
  const ids = g.colonizedSystems().map((x) => x.id);
  const a = ids[0], b = ids.find((x) => x !== a && g.sysDist(a, x) > 2);
  const rec = g.econSeen(a, b);
  res.seen = near(g.energySeen(a, a), g.energyOf(a)) && (rec ? g.energySeen(a, b) === (rec[3] ?? 0) : g.energySeen(a, b) === 0);
}
// 2. 荷の減速は着いたときに受け手が払う
{
  const booked = [];
  const bookE = g.bookE.bind(g);
  g.bookE = (kind, v, sys) => { if (kind === 'cargo' || kind === 'migrant') booked.push([kind, v, sys, g.year]); return bookE(kind, v, sys); };
  let found = null;
  for (let i = 0; i < 40 && !found; i++) { g.advance(0.25); found = g.cargo.find((p) => p.dE > 0 && p.arrive > g.year + 0.25) || null; }
  if (!found) res.cargo = false;
  else {
    const dest = found.path[found.path.length - 1], dE = found.dE, when = found.arrive;
    booked.length = 0;
    while (g.year < when + 0.3) g.advance(0.25);
    const atDest = booked.filter(([k, v, s, y]) => k === 'cargo' && s === dest && y >= when - 0.26 && near(-v, dE, 1e-9));
    res.cargo = atDest.length >= 1;
    res.cargoNums = [dest, +dE.toExponential(3), +when.toFixed(2)];
  }
}
const ok = Object.entries(res).filter(([k]) => !k.endsWith('Nums')).every(([, v]) => v === true);
console.log(`交易路の減速 ${ok ? '合格' : '不合格'} ${JSON.stringify(res)}`);
process.exitCode = ok ? 0 : 1;
