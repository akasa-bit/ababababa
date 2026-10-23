// 市場 (段 5) の試験: 値段が決まった幅に入る、在庫が少ないほど高い、就業の割合の合計が 1 で、どの部門もほぼ 0.1% 以上 (下限をかけてから合計を 1 にし直すので、少し下回ることがある)、
// 方針 (FOCUS) の命令は断る、保存と読み込みで値段と就業が変わらない、開始時の生産性の倍率が産出に効いて保存に残る。
// 構造転換 (段 5 の 3): 1 人あたりの実質の所得が測れていて保存に残る、サービスの割合と工業品の需要と研究者の数が所得とともに増える、工業品の需要の所得の弾力性が
// 高い所得で 1 を下回る (こぶ型)、発展段階の名前が所得で変わる。画面なしの版で回す
// 使い方: node tools/tests/market.js [シード] [年数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: ['3', '80'], judge: (o) => (o.includes('市場 合格') ? '' : '市場の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', years = '80'] = process.argv.slice(2);
const sim = H.load({});
const { PRICE, MARKET, STRUCTURE } = sim.tables;
const g = sim.run(sim.newGame(seed, { nations: 6 }), Number(years));
const res = {};
let bad = 0, n = 0;
const base = (r) => PRICE[r] * MARKET.level / STRUCTURE.modern; // 基準の値段 (basePrice)
for (const m of Object.values(g.market)) for (const [r, p] of Object.entries(m.p)) { n++; if (!(p >= base(r) * MARKET.min * 0.999 && p <= base(r) * MARKET.max * 1.001)) bad++; }
res.pricesInRange = !bad && n > 0;
// 在庫が少ないほど高い (同じふだんの消費で、在庫を半分にした値段)
res.scarceIsDear = g.priceAt('food', 50, 100) > g.priceAt('food', 100, 100);
const sums = g.colonies.map((c) => Object.values(c.sh).reduce((a, v) => a + v, 0));
res.sharesSumTo1 = sums.every((v) => Math.abs(v - 1) < 1e-9);
res.sharesFloor = g.colonies.every((c) => Object.values(c.sh).every((v) => v >= 0.0009));
res.someServices = g.colonies.some((c) => c.sh.serv > 0.05);
const col = g.colonies[0];
res.focusRefused = g.exec('focus', { col: `${col.sys}|${col.body}|${col.kind}`, value: 'farm' }).ok === false && g.setFocusAll('farm').ok === false;
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = JSON.stringify(g2.market) === JSON.stringify(g.market) && JSON.stringify(g2.colonies.map((c) => c.sh)) === JSON.stringify(g.colonies.map((c) => c.sh));
// 構造転換
res.incomeMeasured = g.colonies.filter((c) => c.pop >= 1).every((c) => Number.isFinite(c.inc) && c.inc > 0) && g2.colonies.every((c, i) => c.inc === g.colonies[i].inc);
res.servRises = g.servShare(1000) < g.servShare(8000) && g.servShare(8000) < g.servShare(50000) && g.servShare(50000) > 0.5;
res.goodsRise = g.goodsNeed(1000) < g.goodsNeed(8000) && g.goodsNeed(8000) < g.goodsNeed(50000);
const elastic = (y) => (Math.log(g.goodsNeed(y * 1.01)) - Math.log(g.goodsNeed(y))) / Math.log(1.01);
res.goodsHump = elastic(2000) > 1 && elastic(50000) < 1;
res.researchRises = g.researchers(1000) < g.researchers(50000);
res.stages = sim.evaluate('stageName(1000)') === '農業期' && sim.evaluate('stageName(5000)') === '工業化期' && sim.evaluate('stageName(10000)') === '成熟期' && sim.evaluate('stageName(30000)') === '脱工業期';
res.modernSet = STRUCTURE.modern === 6; // ユーザーが選ぶまで世界の平均 (docs/status/C.md)
// 開始時の生産性: 倍率が 1 人あたりの産出と採掘基地に効き、保存と読み込みで残る。自分で決める値は幅に収める
const y1 = g.yieldOf(col, 'farm');
g.productivity = 252.76;
res.productivity = Math.abs(g.yieldOf(col, 'farm') / y1 - 252.76) < 1e-9;
const d2 = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g3 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g3.restore(d2);
res.productivitySaved = g3.productivity === 252.76;
const { PRODUCTIVITY_RANGE } = sim.tables;
res.productivityRange = PRODUCTIVITY_RANGE[0] === 0.1 && PRODUCTIVITY_RANGE[1] === 1000;
const ok = Object.values(res).every(Boolean);
console.log(`市場 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
process.exitCode = ok ? 0 : 1;
