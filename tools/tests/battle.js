// 艦隊戦 (B-034。HOI4 の海戦を元にした形) の試験。画面なしの版で回す
// 1. 勝つ見込み: 0〜1、兵力が多いほど高い、同じ入力なら同じ値 (試合の乱数を使わない)
// 2. 入植星系での艦隊戦: 時間をかけて進み、途中で着いた艦隊が加わり、終われば攻囲か駐留になる。沈んだ数が戦勝点と戦死者に入り、退いた艦は自国の星系へ戻る
// 3. 報告: battleReports に残り、セーブに入って戻る
// 4. 古いセーブの艦隊戦 (艦の一覧がない) も続けられる
// 5. 入植していない星系での艦隊戦は着いた時点で解ける
// 6. 法則: 2 倍の兵力で勝つのは 65〜88%、ランチェスター則の指数は 0.2〜0.8 (ゲーム版の補正。tools/battles-headless.js で詳しく)
// 使い方: node tools/tests/battle.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('艦隊戦') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const g = sim.newGame('5', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);

// 1
const p1 = g.battleOdds(10, 10), p2 = g.battleOdds(20, 10), p3 = g.battleOdds(5, 10);
check(p1 >= 0 && p1 <= 1 && p2 > p1 && p1 > p3, `見込みが兵力の順になっていない (${p3}・${p1}・${p2})`);
const rs = g.rs;
check(g.battleOdds(20, 10) === p2 && g.rs === rs, '見込みが試合の乱数を動かした、か毎回違う');
check(g.battleOdds(0, 5) === 0 && g.battleOdds(5, 0) === 1, '片方が 0 艦隊のときの見込みが違う');

// 2
const e = g.nations.map((n) => n.cap).find((c) => c !== g.cap);
const eSys = g.realmSystems(e).map((x) => x.id);
g.beginWar(g.cap, e, g.cap);
const key = g.warKey(g.cap, e);
g.garrison[e] = 12;
g.startBattle(e, g.cap, 12, 0, undefined);
const b = g.battleAt(e);
check(b && b.a === 12 && b.d === 12 && b.odds > 0.2 && b.odds < 0.8, '艦隊戦が始まらない、か見込みが変');
const fleets0 = g.fleets.length;
g.battlesStep(0.25);
let a0 = 12;
if (g.battleAt(e)) { g.battleAt(e).a += 3; g.battleAt(e).a0 += 3; a0 = 15; } // 途中で着いた 3 艦隊
let steps = 0;
while (g.battleAt(e) && steps++ < 200) g.battlesStep(0.25);
check(!g.battleAt(e), '艦隊戦が終わらない');
const r = g.battleReports[0];
check(r && r.sys === e && r.a0 === a0 && r.d0 === 12, `報告がない、か投入した数が違う (${JSON.stringify(r)})`);
const st = g.warStats[key];
check(st && (st.k[g.cap] || 0) === r.sunk[1] && (st.k[e] || 0) === r.sunk[0], '沈んだ数が戦果に入っていない');
check(st.dead === (r.sunk[0] + r.sunk[1]) * sim.tables.BATTLE.crew && r.dead === st.dead, '戦死者の数が違う');
check(r.sunk[0] + r.esc[0] <= a0 && r.sunk[1] + r.esc[1] <= 12, '沈んだ・退いた数が投入より多い');
const esc0 = g.fleets.slice(fleets0).filter((f) => (f.owner ?? 0) === g.cap).reduce((k, f) => k + f.n, 0);
check(esc0 === r.esc[0], `退いた攻撃側の艦が帰っていない (${esc0} / ${r.esc[0]})`);
if (eSys.length > 1) { const n = g.fleets.slice(fleets0).filter((f) => f.owner === e && f.from === e).reduce((k, f) => k + f.n, 0); check(n === r.esc[1], `退いた防衛側の艦が帰っていない (${n} / ${r.esc[1]} ${JSON.stringify(g.fleets.slice(fleets0).map((f) => [f.owner, f.n, f.from, f.to]))} ${JSON.stringify(r)})`); }
if (r.win) check(g.sieges.some((s) => s.sys === e && s.realm === g.cap && s.ships === a0 - r.sunk[0] - r.esc[0]), '勝った攻撃側の攻囲が始まらない');
else check((g.garrison[e] || 0) >= 12 - r.sunk[1] - r.esc[1], '勝った防衛側が駐留に戻らない');

// 3
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '5', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && g2.battleReports.length === g.battleReports.length && g2.battleReports[0].sunk.join() === r.sunk.join(), '艦隊戦の報告がセーブから戻らない');

// 4
g.garrison[e] = 6;
g.battles.push({ sys: e, realm: g.cap, a: 6, d: 6, a0: 6, d0: 6, start: g.year, progress: 0 }); // 前の版の形
g.sieges = g.sieges.filter((s) => s.sys !== e);
steps = 0;
while (g.battleAt(e) && steps++ < 200) g.battlesStep(0.25);
check(!g.battleAt(e) && g.battleReports[0].a0 === 6, '前の版の艦隊戦が続けられない');

// 5
const empty = g.galaxy.systems.find((s) => !g.isColonized(s.id) && !(g.garrison[s.id] > 0) && g.sysDist(s.id, e) < 30);
if (empty) {
  g.garrison[empty.id] = 8; g.setStackOwner(empty.id, e);
  const n0 = g.battleReports.length;
  g.fleetArrives({ id: g.nextShipId++, from: g.cap, to: empty.id, n: 8, owner: g.cap, depart: g.year - 1, arrive: g.year });
  check(g.battleReports.length === n0 + 1 && g.battleReports[0].sys === empty.id, '入植していない星系の艦隊戦が解けない');
}

// 6
const B = sim.tables.BATTLE;
let w2 = 0, n2 = 0;
for (let i = 0; i < 600; i++) {
  const u = [Array.from({ length: 20 }, () => [1, 1, -1]), Array.from({ length: 10 }, () => [1, 1, -1])];
  const out = { sunk: [0, 0], esc: [0, 0] };
  const eff = [g.battleLuck(B.luck), g.battleLuck(B.luck)], mor = [g.battleLuck(B.morale), g.battleLuck(B.morale)]; // 戦いごとに 1 回引く
  let k = 0;
  while (k++ < B.rounds * 20 && g.battleRound(u, eff, mor, () => g.rand(), [true, true], out));
  n2++; if (u[0].some((x) => x[2] < 0) && !u[1].some((x) => x[2] < 0)) w2++;
}
check(w2 / n2 > 0.65 && w2 / n2 < 0.88, `2 倍の兵力で勝つ割合が ${Math.round((100 * w2) / n2)}%`);

console.log(fails.length ? `艦隊戦 不合格\n${fails.join('\n')}` : `艦隊戦 合格 (12 対 12 の見込み ${Math.round(b.odds * 100)}%・2 倍の兵力で ${Math.round((100 * w2) / n2)}% 勝ち)`);
process.exit(fails.length ? 1 : 0);
