// 市場 (段 5) の試験: 値段が決まった幅に入る、在庫が少ないほど高い、就業の割合の合計が 1 で、どの部門もほぼ 1% 以上 (1% の下限をかけてから合計を 1 にし直すので、少し下回ることがある)、
// 方針 (FOCUS) の命令は断る、保存と読み込みで値段と就業が変わらない、開始時の生産性の倍率が産出に効いて保存に残る。画面なしの版で回す
// 使い方: node tools/tests/market.js [シード] [年数]
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', years = '80'] = process.argv.slice(2);
const sim = H.load({});
const { PRICE, MARKET } = sim.tables;
const g = sim.run(sim.newGame(seed, { nations: 6 }), Number(years));
const res = {};
let bad = 0, n = 0;
for (const m of Object.values(g.market)) for (const [r, p] of Object.entries(m.p)) { n++; if (!(p >= PRICE[r] * MARKET.level * MARKET.min * 0.999 && p <= PRICE[r] * MARKET.level * MARKET.max * 1.001)) bad++; }
res.pricesInRange = !bad && n > 0;
// 在庫が少ないほど高い (同じふだんの消費で、在庫を半分にした値段)
res.scarceIsDear = g.priceAt('food', 50, 100) > g.priceAt('food', 100, 100);
const sums = g.colonies.map((c) => Object.values(c.sh).reduce((a, v) => a + v, 0));
res.sharesSumTo1 = sums.every((v) => Math.abs(v - 1) < 1e-9);
res.sharesFloor = g.colonies.every((c) => Object.values(c.sh).every((v) => v >= 0.009));
res.someServices = g.colonies.some((c) => c.sh.serv > 0.05);
const col = g.colonies[0];
res.focusRefused = g.exec('focus', { col: `${col.sys}|${col.body}|${col.kind}`, value: 'farm' }).ok === false && g.setFocusAll('farm').ok === false;
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = JSON.stringify(g2.market) === JSON.stringify(g.market) && JSON.stringify(g2.colonies.map((c) => c.sh)) === JSON.stringify(g.colonies.map((c) => c.sh));
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
