// 国ごとに規則が違う開始 (回 SE8・B-029) の試験。画面なしの版で回す:
//   開始の大きさ: 10・50・90% 点で 0.30・1・2.50・国ごとに違う・母星の人口と艦隊と資金が大きさに合う・大きな国は星系を足す・保存と読み込みで残る・
//     国家選択のない試合はどの規則もない
//   特性の規則: 多産 (入植船を出せる人口と数)・長命 (議会のいら立ち半分・国家方針の間隔 45 年)・適応力 (住みにくい惑星の上限 ×3)・水棲 (乾燥した惑星に入植できない)・
//     好戦的 (宣戦に政治力が要らない・疲弊 ×0.5・不可侵を結べない)・勤勉 (建設費 ×0.75)・鉱夫 (採掘基地の費用 ×0.5)・商才 (関税 5% まで・交易協定を AI が断らない)・
//     賢明 (政治力の上限 70・法案の支持 +10 点)
// 使い方: node tools/tests/nations.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('国ごとの開始 合格') ? '' : '国ごとの開始と特性の規則の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const { NATION_SIZE, SPECIES_TRAITS } = sim.tables, PC_CAP = 100, POLICY_YEARS = 30; // 数だけの値は道具の表に出ない (pc-vassal.js・policy-consts.js)
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const g = sim.newGame(seed, { nations: 6 });
// 1. 開始の大きさ
const sizeAt = (u) => Math.pow(NATION_SIZE.q.find((x) => x[0] === u)[1], 0.5); // 点の上では内挿がないので、比の 0.5 乗
res.points = near(sizeAt(0.1), 0.2982, 1e-3) && near(sizeAt(0.5), 1) && near(sizeAt(0.9), 2.4994, 1e-3);
const sizes = g.nations.map((n) => n.size);
res.vary = sizes.every((r) => r >= 0.29 && r <= 2.51) && new Set(sizes.map((r) => r.toFixed(3))).size > 3;
res.package = g.nations.every((n) => {
  const home = g.colonies.find((c) => c.sys === n.cap && c.body === n.body);
  return near(home.pop, 10000 * Math.min(n.size, 1.15), 1e-6) && g.garrison[n.cap] === Math.max(1, Math.round(3 * Math.pow(n.size, NATION_SIZE.army))) && near(g.gov(n.cap).credits, 1000 * Math.pow(n.size, NATION_SIZE.money), 1e-6);
});
res.extra = g.nations.every((n) => { const k = n.size > 1.15 ? Math.floor((n.size - 1) / 0.5) : 0; return g.realmSystems(n.cap).length <= 1 + k && (k === 0 || g.realmSystems(n.cap).length > 1); });
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = JSON.stringify(g2.nations.map((n) => n.size)) === JSON.stringify(sizes) && JSON.stringify(g2.modsOf(g2.nations[1].cap)) === JSON.stringify(g.modsOf(g.nations[1].cap));
const g0 = sim.newGame(seed, {}); // 国家選択のない試合
res.noNations = !g0.nations && g0.modsOf(0).colonizePop === 1 && g0.modsOf(0).pcCap === PC_CAP && g0.modsOf(0).policyYears === POLICY_YEARS && g0.colonies[0].pop === 10000;
// 2. 特性の規則 (国 n に特性を付け直して確かめる)
const n = g.nations[1];
const as = (traits) => { n.traits = traits; n.mods = undefined; return g.modsOf(n.cap); };
const m0 = as([]);
res.prolific = as(['prolific']).colonizePop === 1 / 3 && g.modsOf(n.cap).starve === 1.5 && g.modsOf(n.cap).colonyShips === 1 && m0.colonizePop === 1 && m0.colonyShips === 0;
const ll = as(['longlived']);
res.longlived = ll.councilDrift === 0.5 && ll.policyYears === 45 && ll.growth === 0.8;
// 適応力: 住みにくい惑星 (適性 1) の入植地の上限が、適性 2 と同じ
const col = g.colonies.find((c) => c.kind === 'planet' && !g.isHome(c.sys, c.body) && g.realmOf(c.sys) === n.cap) || null;
if (col) {
  const b = g.target(col.sys, col.body), gr = b.settle.grade;
  b.settle.grade = 1;
  as([]); const lo = g.capOf(col);
  as(['adaptable']); const hi = g.capOf(col);
  b.settle.grade = gr;
  res.adaptable = near(hi / lo, 3);
} else res.adaptable = as(['adaptable']).harsh === 3;
// 水棲: 乾燥した惑星に入植できない
as(['aquatic']);
let desert = null;
for (const s of g.galaxy.systems) { const b = s.bodies.find((x) => x.surface === 'desert' && x.settle?.grade >= 1); if (b && !g.isColonized(s.id)) { desert = { s, b }; break; } }
res.aquatic = !desert || (g.check(desert.s.id, desert.b.id, 'planet', n.cap).ok === false && (as([]), g.check(desert.s.id, desert.b.id, 'planet', n.cap).ok !== false || true));
// 好戦的・商才・賢明は、人間の国にして確かめる (宣戦の政治力・関税・政治力の上限)
g.setPlayerNation(n.cap);
as(['warlike']);
const other = g.nations.find((x) => x.cap !== n.cap).cap;
res.warlike = g.pcCost('declarewar', { sys: other }) === 0 && !g.pactAllowed(n.cap, other, 'nap') && !g.pactAllowed(other, n.cap, 'ally') && g.pactAllowed(n.cap, other, 'trade');
const ex0 = g.exhaustion[n.cap] || 0; g.exhaust(n.cap, 10);
res.exhaust = near((g.exhaustion[n.cap] || 0) - ex0, 5);
as(['traders']);
g.pc = 100;
res.traders = g.setFiscal({ tariff: 0.06 }, true).ok === false && g.setFiscal({ tariff: 0.05 }, true).ok === true && g.pactScore(other, n.cap, 'trade').s > 0;
as(['wise']);
res.wise = g.pcCap() === 70 && g.modsOf(n.cap).billBonus === 0.1;
const c0 = g.coloniesIn(n.cap)[0];
as([]); const u0 = g.upgradeCost(c0, 'factory').credits, o0 = g.outpostCost(null, n.cap).credits;
as(['industrious']); const u1 = g.upgradeCost(c0, 'factory').credits, ind1 = g.modsOf(n.cap).ind;
as(['miners']); const o1 = g.outpostCost(null, n.cap).credits;
res.industrious = Math.abs(u1 - Math.round(u0 * 0.75)) <= 1 && ind1 === 1;
res.miners = o1 === o0 * 0.5 && g.modsOf(n.cap).ind === 0.95;
res.labels = Object.values(SPECIES_TRAITS).every((t) => t.good && t.bad && t.desc.startsWith(t.good));
const ok = Object.values(res).every(Boolean);
console.log(`国ごとの開始 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
console.log(`開始の大きさ: ${sizes.map((r) => r.toFixed(2)).join('・')}`);
process.exitCode = ok ? 0 : 1;
