// 宇宙要塞 (2026-10-22 のユーザーの依頼。FORT) の試験。画面なしの版で回す
// 1. 入植した星系には Lv1 が自動で建つ (試合の始めと、あとから入植した星系)。入植地のなくなった星系の要塞は消える
// 2. 命令 fort で 1 段ずつ上がり、Lv10 で止まる。費用は段ごとに増える
// 3. 艦隊戦: 艦隊がいなくても要塞があれば艦隊戦になる。区画は艦隊に数えない。沈んだ区画の数だけ段が下がる。要塞のある星系の勝つ見込みは下がる
// 4. セーブに入って戻る。要塞の項目がない前の版のセーブは、入植した星系に Lv1 を建てて読む
// 5. 地球に届いている記録 (known) に段が入る
// 6. 要塞の傷 (依頼 2026-11-07 の FU-3。docs/fleet-groups.md の 8): 攻め側が退いた艦隊戦のあと、残った区画の傷 (耐久の欠けた割合) が残る。
//    次の艦隊戦の区画はその耐久で始まる。戦っていないあいだ年に FORT.repair ずつ直る。段を上げると薄まる。攻め落とされれば消える。
//    見込み (battleOdds) は傷が深いほど攻め側に良い。セーブと記録 (fw) に入る
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

// 6
{
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const RE = g.realmOf(e);
  if (!g.atWar(g.cap, RE)) g.beginWar(g.cap, RE, g.cap);
  g.battles = g.battles.filter((x) => x.sys !== e); g.sieges = g.sieges.filter((x) => x.sys !== e);
  g.forts[e] = 3; delete g.fortWear[e]; g.garrison[e] = 0;
  // 攻め側が退いた戦い: 区画の耐久を 1.5・3・0.6 にして終える → 傷 = 1 − 5.1 / 9
  g.startBattle(e, g.cap, 1, 0, null);
  const b6 = g.battleAt(e);
  g.battleSync(b6);
  const fs = b6.ud.filter((x) => x[3]);
  check(fs.length === 3 && fs.every((x) => x[0] === F.hp), `無傷の要塞の区画が耐久 ${F.hp} で始まらない (${JSON.stringify(fs)})`);
  [1.5, 3, 0.6].forEach((h, i) => { fs[i][0] = h; });
  b6.ua = [];
  g.battleEnd(b6, RE, g.retreatHome(RE, e));
  const w1 = 1 - 5.1 / (3 * F.hp);
  check(near(g.fortWearOf(e), w1) && g.fortLevel(e) === 3, `攻め側が退いたあとに要塞の傷が残らない (${g.fortWearOf(e)}・期待 ${w1.toFixed(4)})`);
  check(g.battleReports[0]?.fw && near(g.battleReports[0].fw[1], +w1.toFixed(2)), `戦いの報告に要塞の傷がない (${JSON.stringify(g.battleReports[0]?.fw)})`);
  // 次の戦いの区画は欠けた耐久で始まる
  g.startBattle(e, g.cap, 1, 0, null);
  const b7 = g.battleAt(e);
  g.battleSync(b7);
  const fs7 = b7.ud.filter((x) => x[3]);
  check(fs7.length === 3 && fs7.every((x) => near(x[0], F.hp * (1 - g.fortWearOf(e)))), `次の戦いの区画が傷の残った耐久で始まらない (${JSON.stringify(fs7)})`);
  check(g.battleSnap(e)?.fhp !== null && near(g.battleSnap(e).fhp, +(1 - g.fortWearOf(e)).toFixed(2)), `艦隊戦の様子に区画の残りの耐久がない (${g.battleSnap(e)?.fhp})`);
  // 戦っているあいだは直らない
  const wb = g.fortWearOf(e);
  g.fortsRepair(1);
  check(g.fortWearOf(e) === wb, '艦隊戦の最中に要塞の傷が直った');
  g.battles = g.battles.filter((x) => x.sys !== e);
  // 直る: 戦っていないあいだ 1 年で FORT.repair
  g.fortWear[e] = 0.6;
  for (let i = 0; i < 4; i++) g.fortsRepair(0.25);
  check(near(g.fortWearOf(e), 0.6 - F.repair), `要塞の傷が年に ${F.repair} 直らない (${g.fortWearOf(e)})`);
  g.fortsRepair(10);
  check(g.fortWearOf(e) === 0 && !(e in g.fortWear), '直りきった傷が消えない');
  // 段を上げると薄まる (新しい区画は無傷)
  g.fortWear[e] = 0.6; g.forts[e] = 3;
  g.fortBuilt({ sys: e });
  check(g.fortLevel(e) === 4 && near(g.fortWearOf(e), 0.45), `段を上げても傷の割合が薄まらない (${g.fortWearOf(e)})`);
  // 攻め落とされれば消える
  g.forts[e] = 0;
  g.fortWearKeep({ sys: e, ud: [] });
  check(!(e in g.fortWear), '要塞がなくなったのに傷が残る');
  // 見込み: 傷が深いほど攻め側に良い (同じ数なら同じくじで解く)
  check(g.battleOdds(20, 1, 1, 1, 3, 0.9) > g.battleOdds(20, 1, 1, 1, 3, 0), '要塞の傷が深くても攻め側の見込みが上がらない');
  // セーブと記録
  g.forts[e] = 3; g.fortWear[e] = 0.3;
  const s6 = JSON.parse(JSON.stringify(sim.buildSave(g)));
  const g6 = new sim.Game(sim.generateGalaxy({ seed: '6', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  check(g6.restore(s6) && near(g6.fortWearOf(e), 0.3), '要塞の傷がセーブから戻らない');
  delete s6.fortWear;
  const g7 = new sim.Game(sim.generateGalaxy({ seed: '6', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  check(g7.restore(s6) && Object.keys(g7.fortWear).length === 0, '傷の項目がない前の版のセーブを読めない');
  check(near(g.snapshot(e).fw, 0.3), `記録 (snapshot) に要塞の傷がない (${g.snapshot(e).fw})`);
}

console.log(fails.length ? `宇宙要塞 不合格\n${fails.join('\n')}` : `宇宙要塞 合格 (要塞 4 段の星系に 6 艦隊: ${r?.win ? '攻撃側の勝ち' : '防衛側の勝ち'}・沈んだ区画 ${r?.fort?.[1]})`);
process.exit(fails.length ? 1 : 0);
