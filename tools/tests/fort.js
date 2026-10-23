// 宇宙要塞 (2026-10-22 のユーザーの依頼。FORT) の試験。画面なしの版で回す
// 1. 入植した星系には Lv1 が自動で建つ (試合の始めと、あとから入植した星系)。入植地のなくなった星系の要塞は消える
// 2. 命令 fort で 1 段ずつ上がり、Lv10 で止まる。費用は段ごとに増える
// 3. 艦隊戦: 艦隊がいなくても要塞があれば艦隊戦になる。区画は艦隊に数えない。沈んだ区画の数だけ段が下がる。要塞のある星系の勝つ見込みは下がる
// 4. セーブに入って戻る。要塞の項目がない前の版のセーブは、入植した星系に Lv1 を建てて読む
// 5. 地球に届いている記録 (known) に段が入る
// 使い方: node tools/tests/fort.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('宇宙要塞') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const F = sim.tables.FORT;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const g = sim.newGame('6', { nations: 5, spectate: false });
g.setPlayerNation(0);
check(g.fortLevel(g.cap) === F.auto, '試合の始めに首都の要塞がない');
sim.run(g, 30);
check(g.colonizedSystems().every((x) => g.fortLevel(x.id) >= 0 && g.forts[x.id] !== undefined), '入植した星系に要塞がない');

// 2
g.gov(g.cap).credits += 1e6;
const c1 = g.fortCost(g.cap);
for (let i = 0; i < 15; i++) { g.command('fort', { sys: g.cap }); g.advance(0.25); }
for (let i = 0; i < 80 && g.fortLevel(g.cap) < F.max; i++) { g.command('fort', { sys: g.cap }); g.advance(0.25); }
check(g.fortLevel(g.cap) === F.max, `要塞が Lv${F.max} まで上がらない (Lv${g.fortLevel(g.cap)})`);
check(!g.command('fort', { sys: g.cap }).ok, `Lv${F.max} より上に上がってしまう`);
check(g.fortCost(g.cap).credits > c1.credits, '段が上がっても費用が増えない');

// 3
const e = g.nations.map((n) => n.cap).find((c) => c !== g.cap && g.isColonized(c) && g.realmOf(c) === c);
check(g.battleOdds(10, 2) > g.battleOdds(10, 2, 1, 1, 6), '要塞があっても攻撃側の見込みが下がらない');
g.beginWar(g.cap, e, g.cap);
g.garrison[e] = 0;
g.forts[e] = 4;
g.sieges = g.sieges.filter((s) => s.sys !== e);
g.fleetArrives({ id: g.nextShipId++, from: g.cap, to: e, n: 6, owner: g.cap, depart: g.year - 1, arrive: g.year });
const b = g.battleAt(e);
check(b && !g.sieges.some((s) => s.sys === e), '艦隊がいなくても要塞があるのに、艦隊戦にならない');
let steps = 0;
while (g.battleAt(e) && steps++ < 200) { g.battlesStep(0.25); const bb = g.battleAt(e); if (bb) check(bb.d === 0, '要塞の区画が艦隊に数えられた'); }
const r = g.battleReports[0];
check(r && r.fort && r.fort[0] === 4 && g.fortLevel(e) === 4 - r.fort[1], `沈んだ区画の数だけ段が下がらない (${JSON.stringify(r?.fort)}・Lv${g.fortLevel(e)})`);
if (r?.win) check(g.fortLevel(e) === 0, '攻め落とされたのに要塞が残っている');

// 4
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '6', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && g2.fortLevel(g.cap) === F.max, '要塞の段がセーブから戻らない');
delete saved.forts;
const g3 = new sim.Game(sim.generateGalaxy({ seed: '6', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g3.restore(saved) && g3.colonizedSystems().every((x) => g3.fortLevel(x.id) === F.auto), '前の版のセーブで、入植した星系に Lv1 が建たない');

// 5
check(g.known(g.cap).fort === F.max, '記録 (known) に要塞の段がない');

console.log(fails.length ? `宇宙要塞 不合格\n${fails.join('\n')}` : `宇宙要塞 合格 (要塞 4 段の星系に 6 艦隊: ${r?.win ? '攻撃側の勝ち' : '防衛側の勝ち'}・沈んだ区画 ${r?.fort?.[1]})`);
process.exit(fails.length ? 1 : 0);
