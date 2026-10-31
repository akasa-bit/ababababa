// 価格統制と交易の規制 (回 KE9・B-008) の試験。画面なしの版で回す:
//   値段の上限で首都の市場の値段が止まる・配給で不足のときに星系の入植地が同じ割合だけ買える (配給がないと先に買う入植地が取る)・
//   輸出禁止はその資源だけ・禁輸は両向き・同じ国の中は止めない・帰着の表 (値段の上限) の足し算が 0・選べない値を断る・法案になる・保存と読み込みで残る
// 使い方: node tools/tests/controls.js [シード] [年数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3', '60'], judge: (o) => (o.includes('価格統制 合格') ? '' : '価格統制と交易の規制の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', years = '60'] = process.argv.slice(2);
const sim = H.load({});
const { FISCAL_DEFAULT } = sim.tables;
const g = sim.run(sim.newGame(seed, { nations: 6 }), Number(years)); // 観戦で国を育ててから、人間が動かす
g.setSpectate(false);
g.pc = 100;
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const cap = g.cap, other = g.nations.find((n) => n.cap !== cap && g.realmAlive(n.cap)).cap;
const base = (r) => sim.evaluate(`basePrice('${r}')`);
// 1. 選べない値
res.bad = g.setFiscal({ ceil: { food: 0.3 } }, true).ok === false && g.setFiscal({ ration: { metal: true } }, true).ok === false && g.setFiscal({ embargo: { [cap]: true } }, true).ok === false;
// 2. 値段の上限
const before = g.price(cap, 'food') / base('food');
res.set = g.setFiscal({ ceil: { food: 0.5 }, ban: { metal: true }, embargo: { [other]: true } }, true).ok;
for (let i = 0; i < 4; i++) g.advance(0.25);
// 闇市 (回 KE12): 上限で切った値段は、上限 + BLACK.evasion × (切らない値段 − 上限)。値段をいまの在庫で決め直して (刻み 0 の marketStep)、切らない値段と比べる
{
  const { BLACK } = sim.tables, c = 0.5 * base('food');
  g.marketStep(1e-12);
  const free = g.priceAt('food', g.stockOf(cap).food, g.market[cap].u.food), p = g.price(cap, 'food');
  res.ceil = free > c ? near(p, c + BLACK.evasion * (free - c), 1e-9) : near(p, free, 1e-9);
  res.ceilNums = [+(p / base('food')).toFixed(4), +(free / base('food')).toFixed(4), BLACK.evasion];
}
// 3. 輸出禁止と禁輸
const mine = g.realmSystems(cap).map((s) => s.id), third = g.nations.find((n) => n.cap !== cap && n.cap !== other && g.realmAlive(n.cap))?.cap;
res.ban = g.tradeBarred(third, cap, 'metal') && !g.tradeBarred(third, cap, 'food') && !g.tradeBarred(cap, third, 'metal') && (mine.length < 2 || !g.tradeBarred(mine[1], cap, 'metal'));
res.embargo = g.tradeBarred(other, cap, 'food') && g.tradeBarred(cap, other, 'food');
// 4. 帰着の表 (値段の上限): 部門を足すと 0
const rows = g.incidenceOf(cap, { ...FISCAL_DEFAULT, ceil: { food: 0.5, goods: 0.5 } }, FISCAL_DEFAULT);
res.incidence = rows.every((r) => near(r.hh + r.fm + r.gov + r.row, 0, 1e-9)) && (rows.find((r) => r.k === 'ceil')?.hh || 0) >= 0;
// 5. 配給: 入植地が 2 つ以上ある星系 (ふつうは国の本星の星系) で、その国を人間の国にして在庫を減らし、1 刻み進めて食料の充足率をくらべる
const sysOf = g.galaxy.systems.map((s) => s.id).find((id) => g.realmAlive(g.realmOf(id)) && g.coloniesIn(id).filter((c) => c.pop > 0.5).length >= 2);
const satSpread = (ration) => {
  const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
  const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  h.restore(d);
  h.setPlayerNation(h.realmOf(sysOf));
  h.pc = 100;
  if (!h.setFiscal({ ceil: {}, ban: {}, embargo: {}, ration: ration ? { food: true } : {} }, true).ok && ration) return 1;
  for (let i = 0; i < 4; i++) h.advance(0.25); // 配給が効くまで (行政の遅れ 0.15 年)
  // 人口を 3 倍にして入植地に同じだけ分け、星系で作る量より多く食べるようにする (在庫は 0 から。刻みの中で作った分を分け合う)
  const cs = h.coloniesIn(sysOf).filter((c) => c.pop > 0.5), P = cs.reduce((a, c) => a + c.pop, 0);
  for (const c of cs) c.pop = (3 * P) / cs.length;
  h.stockOf(sysOf).food = 0;
  h.advance(0.25);
  const s = cs.map((c) => c.sat.food);
  return Math.max(...s) - Math.min(...s);
};
const sp1 = sysOf === undefined ? 0 : satSpread(true), sp0 = sysOf === undefined ? 0 : satSpread(false);
res.ration = sysOf === undefined || (sp1 < 0.05 && sp0 > sp1);
// 6. 法案になる・保存と読み込み
g.setFiscal({ ceil: { food: 0.5, goods: 1 }, ban: { metal: true }, embargo: { [other]: true } }, true);
res.bill = g.setFiscal({ ceil: { food: 0.75 } }).ok && (!!g.bill('fiscal') && g.billText('fiscal', g.bill('fiscal').target).includes('値段の上限') || g.fiscal.ceil.food === 0.75);
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = JSON.stringify(g2.players[g2.pi].fiscal) === JSON.stringify(g.players[g.pi].fiscal) && g2.tradeBarred(other, cap, 'food');
// 7. AI の国は規制を持たない (禁輸された国も、ほかの国とは売り買いできる)
res.ai = !g.fiscalAt(other).ceil?.food && (third === undefined || !g.tradeBarred(third, other, 'food'));
const ok = Object.values(res).every(Boolean);
console.log(`価格統制 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
console.log(`食料の値段: 上限の前 ×${before.toFixed(2)} → 上限 ×0.5 のあと ×${(g2.price(cap, 'food') / base('food')).toFixed(2)}・配給を見た星系 ${sysOf ?? 'なし'} (充足率の差: 配給あり ${sp1.toFixed(3)}・なし ${sp0.toFixed(3)})`);
process.exitCode = ok ? 0 : 1;
