// 艦隊群と艦隊戦の見え方 (依頼 2026-11-07 の FU-1・FU-2。docs/fleet-groups.md) の試験。画面なしの版で回す
// 1. 群を作り、決まり (撤退) を変えると、首都から光速で広がり、光が届いた所から効く (届く前の所は前の決まり)
// 2. 群に入れる (fgassign)。群を言わない派遣・自動防衛配備は、群の艦を動かさない。群を言う派遣は、群の艦だけを群のまま送る
// 3. 群の艦隊が自国の星系に着くと、群のまま駐留する (命令で駐留 held には入れない)
// 4. 艦隊戦: 「退かない」の艦は組織力が尽きても退かない。退いた群の艦は群の拠点へ向かい、群に残る。決まりは光が届いてから艦の札に効く
// 5. 自動の艦隊 (自動防衛配備・退却) は、着いた先が他国の星系になっていたら攻め込まず、近くの自国の星系へ回る
// 6. 群の数は駐留の数を超えない (駐留が減ると合わせる)。守備の群は年の切れ目に拠点へ戻る。解いた群は、光が届いた所から自動防衛配備に任せる
// 7. セーブと読み込みで群が残る。群を使ったまま試合を進めても、群の数が駐留を超えない
// 8. 補給線はない (依頼 FU-2): 戦力の倍率は補給の充足率だけで決まる。艦隊戦の様子 (battleSnap) に要塞・見込み・退いている艦・退く先が出る
// 9. 群の艦は持ち主の国の側にだけ入る。攻囲から艦隊戦に戻っても、独立戦争の攻め側になっても、群のまま
// 使い方: node tools/tests/fgroup.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('艦隊群') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const g = sim.newGame('5', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);
const C = g.cap;
// 首都のほかに自国の星系が要るので、いちばん近い他国の星系を家臣にする (試験のための形)
if (!g.realmSystems(C).some((s) => s.id !== C)) {
  const x = g.colonizedSystems().map((s) => s.id).filter((id) => g.realmOf(id) !== C).sort((a, b) => g.sysDist(C, a) - g.sysDist(C, b))[0];
  const gv = g.gov(x); gv.lord = C; gv.independent = false;
}
const own = g.realmSystems(C).map((s) => s.id).filter((id) => id !== C);
const enemy = g.colonizedSystems().map((s) => s.id).filter((id) => g.realmOf(id) !== C).sort((a, b) => g.sysDist(C, b) - g.sysDist(C, a));
check(own.length >= 1, `自国の星系が首都のほかにない (${own.length})`);
check(enemy.length >= 1, '他国の星系がない');
const Y = own[0], E = enemy[0];

// 1. 群を作る・決まりの光の遅れ
const r1 = g.command('fgnew', { name: '試しの群', role: 'atk', ret: 'org', base: C });
const gid = r1.id;
check(r1.ok && g.fgGet(gid)?.name === '試しの群' && g.fgOf().length === 1, `群を作れない (${JSON.stringify(r1)})`);
const t0 = g.year;
check(g.command('fgset', { g: gid, ret: 'never' }).ok, '撤退の決まりを変えられない');
const far = enemy[0], D = g.sysDist(C, far);
check(g.fgEff(g.fgGet(gid), C).ret === 'never', '首都で決まりがすぐ効かない');
check(D > 1 && g.fgEff(g.fgGet(gid), far).ret === 'org', `光が届く前の所で新しい決まりが効いている (${D.toFixed(1)} 光年)`);
const y0 = g.year;
g.year = t0 + D + 0.01;
check(g.fgEff(g.fgGet(gid), far).ret === 'never', '光が届いたあとも前の決まりのまま');
g.year = y0;

// 2. 群に入れる・群を言わない派遣は群の艦を動かさない
g.garrison[C] = 20; g.held[C] = 0; delete g.gship[C];
check(g.command('fgassign', { sys: C, g: gid, n: 12 }).ok && g.gship[C]?.[gid] === 12 && g.fgFree(C) === 8, `群に入れられない (${JSON.stringify(g.gship[C])}・群に入っていない ${g.fgFree(C)})`);
const f0 = g.fleets.length;
g.sendFleet(C, Y, Infinity);
check(g.fleets.length === f0 + 1 && g.fleets[f0].n === 8 && g.fleets[f0].g === undefined && g.garrison[C] === 12 && g.gship[C]?.[gid] === 12, `群を言わない派遣が群の艦を送った (${g.fleets[f0]?.n}・駐留 ${g.garrison[C]}・群 ${g.gship[C]?.[gid]})`);
g.fleets.length = f0;
// 自動防衛配備: 首都の艦は全部が群なので、どこにも送らない
g.autoDefense = true;
g.garrison[Y] = 0;
const req0 = g.requests.length, fl0 = g.fleets.length;
g.autoDefend();
const fromCap = g.fleets.slice(fl0).filter((f) => f.from === C).length + g.requests.slice(req0).filter((q) => q.kind === 'order' && q.act === 'fleet' && Number(q.d.from) === C).length;
check(fromCap === 0 && g.gship[C]?.[gid] === 12, `自動防衛配備が群の艦を動かした (${fromCap})`);
g.fleets.length = fl0; g.requests.length = req0;

// 3. 群を言う派遣と、着いた群の艦隊
check(g.sendFleet(C, Y, 5, '', null, undefined, gid).ok && g.fleets[g.fleets.length - 1].g === gid && g.gship[C]?.[gid] === 7, '群を言う派遣が群の艦を送らない');
const fy = g.fleets[g.fleets.length - 1];
const heldY = g.held[Y] || 0, garY = g.garrison[Y] || 0;
g.fleets = g.fleets.filter((f) => f !== fy);
g.fleetArrives(fy);
check(g.gship[Y]?.[gid] === 5 && (g.held[Y] || 0) === heldY && g.garrison[Y] === garY + 5, `着いた群の艦が群のまま駐留しない (群 ${g.gship[Y]?.[gid]}・held ${g.held[Y]})`);

// 4. 艦隊戦の札: 「退かない」の艦は退かない。退いた群の艦は拠点へ
const BATTLE = sim.evaluate('BATTLE');
const u = [[[1, 0.1, -1, 0, gid, 1], [1, 0.1, -1]], [[1, 1, -1]]];
g.battleRound(u, [1, 1], [1, 1], () => 0.99, [true, true], { sunk: [0, 0], esc: [0, 0] });
check(u[0][0][2] === -1 && u[0][1][2] === BATTLE.retRounds, `「退かない」の艦が退いた、か、ほかの艦が退かない (${u[0][0][2]}・${u[0][1][2]})`);
const out = { sunk: [0, 0], esc: [3, 0], eg: [{ [gid]: 2 }, {}] };
const fb = g.fleets.length;
g.battleCount({ sys: E, realm: C, sunk: [0, 0], esc: [0, 0], ua: [], ud: [] }, out, g.realmOf(E), g.retreatHome(g.realmOf(E), E));
const back = g.fleets.slice(fb);
const toBase = back.find((f) => f.g === gid);
check(toBase && toBase.n === 2 && toBase.to === C && toBase.ret, `退いた群の艦が拠点へ向かわない (${JSON.stringify(toBase)})`);
check(back.some((f) => f.g === undefined && f.n === 1 && f.auto), '退いた群でない艦が前と同じに退かない');
g.fleets.length = fb;
// 光の遅れ: 艦隊戦の場所に決まりが届くまでは前の決まりの札
const bt = { sys: far, fg: 1, ua: [[1, 1, -1, 0, gid, 0]], ud: [] };
g.fgSet({ g: gid, ret: 'org' }); g.fgSet({ g: gid, ret: 'never' });
g.fgBattleSync(bt);
check(bt.ua[0][5] === 0, '届く前に「退かない」が艦隊戦の艦に効いた');
const y1 = g.year; g.year = g.fgGet(gid).at + D + 0.01; g.fgBattleSync(bt); g.year = y1;
check(bt.ua[0][5] === 1, '届いたあとも「退かない」が艦隊戦の艦に効かない');

// 5. 自動の艦隊は他国の星系に攻め込まない
const nb = g.battles.length, ns = g.sieges.length, nf = g.fleets.length;
g.fleetArrives({ id: g.nextShipId++, from: C, to: E, n: 2, owner: C, auto: true, depart: g.year, arrive: g.year });
const div = g.fleets.slice(nf).find((f) => f.from === E && f.owner === C);
check(g.battles.length === nb && g.sieges.length === ns && div && g.realmOf(div.to) === C, `自動の艦隊が他国の星系に攻め込んだ (艦隊戦 ${g.battles.length - nb}・攻囲 ${g.sieges.length - ns}・回った先 ${div?.to})`);
g.fleets.length = nf;

// 6. 数を合わせる・守備の群は拠点へ戻る・解く
g.garrison[Y] = 3;
g.fgStep();
check((g.gship[Y]?.[gid] || 0) <= 3, `群の数が駐留を超えたまま (${g.gship[Y]?.[gid]})`);
g.fgSet({ g: gid, role: 'hold', base: C });
g.year = g.fgGet(gid).at + g.sysDist(C, Y) + 0.01;
g.autoTimer = 0;
const nh = g.fleets.length;
g.fgStep();
const ret = g.fleets.slice(nh).find((f) => f.from === Y && f.to === C && f.g === gid);
check(ret && !g.gship[Y]?.[gid], `守備の群が拠点へ戻らない (${JSON.stringify(ret)})`);
g.fgSet({ g: gid, role: 'gone' });
check(!g.fgOf().some((x) => x.id === gid) && g.fgCount(C) === 0, `解いた群が首都で残っている (${g.fgCount(C)})`);

// 7. セーブ・群を使ったまま進める
const g7 = sim.newGame('3', { nations: 5, spectate: false });
g7.setPlayerNation(0);
sim.run(g7, 20);
const c7 = g7.cap;
g7.garrison[c7] = (g7.garrison[c7] || 0) + 10;
const a7 = g7.command('fgnew', { role: 'atk', ret: 'never', base: c7 }).id;
g7.command('fgassign', { sys: c7, g: a7, n: 6 });
const saved = JSON.parse(JSON.stringify(sim.buildSave(g7)));
const g8 = new sim.Game(sim.generateGalaxy({ seed: '3', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g8.restore(saved) && JSON.stringify(g8.fgroups) === JSON.stringify(g7.fgroups) && JSON.stringify(g8.gship) === JSON.stringify(g7.gship), '群がセーブから戻らない');
let over = 0;
for (let i = 0; i < 30 * 4; i++) {
  g7.advance(0.25);
  for (const [k, m] of Object.entries(g7.gship)) if (Object.values(m).reduce((s, v) => s + v, 0) > (g7.garrison[k] || 0)) over++;
}
check(over === 0, `群の数が駐留を超えた (${over} 回)`);

// 8. 補給線はない・艦隊戦の様子
check(g.fleetEff(1) === 1 && g.fleetEff(0) === 0.5 && g.fleetEff.length <= 1, '戦力の倍率が補給の充足率だけで決まらない');
g.garrison[E] = 2;
g.startBattle(E, C, 6, 0, null, { [gid]: 0 });
const snap = g.battleSnap(E);
check(snap && snap.a === 6 && 'fort' in snap && 'odds' in snap && Array.isArray(snap.going) && Array.isArray(snap.to), `艦隊戦の様子が足りない (${JSON.stringify(snap)})`);
g.battles = g.battles.filter((b) => b.sys !== E);

// 9. 群の艦は持ち主の国の側にだけ入る (独立などで残っていた、ほかの国の群の数は捨てる)・攻囲から艦隊戦に戻っても群のまま・独立戦争の攻め側に群のまま入る
const g9 = g.command('fgnew', { role: 'atk', ret: 'never', base: C }).id;
g.garrison[E] = 2; g.gship[E] = { [g9]: 2 };
g.startBattle(E, g.realmOf(E), 3, 0, null);
const b9 = g.battleAt(E);
check(b9 && !b9.ud.some((x) => x[4] === g9) && !g.gship[E], `ほかの国の群の艦が守り側に入った (${JSON.stringify(b9?.ud)})`);
g.battles = g.battles.filter((b) => b.sys !== E);
const RE = g.realmOf(E);
if (!g.atWar(C, RE)) g.beginWar(C, RE);
g.garrison[E] = 0; g.forts[E] = 0;
g.sieges = g.sieges.filter((x) => x.sys !== E);
g.sieges.push({ sys: E, realm: C, ships: 5, progress: 0.1, start: g.year, gs: { [g9]: 3 } });
g.garrison[E] = 1;
g.siegesYearly();
const b9b = g.battleAt(E);
check(b9b && b9b.ua.filter((x) => x[4] === g9).length === 3 && b9b.ua.filter((x) => x[4] === g9).every((x) => x[5] === 1), `攻囲から艦隊戦に戻ると群の札がなくなる (${JSON.stringify(b9b?.ua)})`);
g.battles = g.battles.filter((b) => b.sys !== E);
g.garrison[Y] = 6; g.held[Y] = 1; g.gship[Y] = { [g9]: 4 };
const t9 = g.fgTakeAll(Y, 3);
check(t9 && t9[g9] === 3 && !g.gship[Y], `独立戦争で群の艦を取り出せない (${JSON.stringify(t9)})`);

console.log(`群 ${g.fgroups.length}・艦隊戦の様子 ${JSON.stringify(snap)}`);
console.log(fails.length ? `艦隊群 不合格 (${fails.join(' / ')})` : '艦隊群 合格');
process.exit(fails.length ? 1 : 0);
