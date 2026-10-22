// 戦争の終わり方 (回 FU2 の R14 の直し e。WAREND・TREATY.white) の試験。画面なしの版で回す
// 1. 立ち消え: 両方の首都が開戦を知ってから、戦果が WAREND.lapse 年動かない戦争は、講和会議なしで終わる。戦果があれば数え直す
// 2. 小さな勝ち: 戦勝点の差が TREATY.white より小さい講和は白紙講和 (講和会議を開かない)
// 3. 大きく勝っている国: 勝つ見込みが WAREND.decisiveP 以上なら受け入れる線は 100 (降伏を求める)。相手に見込みがなければ全面降伏の講和会議
// 4. 人間の国への降伏の求め: 応じると、求めた国が持ち点 100 で条件を選ぶ講和会議になる
// 使い方: node tools/tests/warend.js
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const W = sim.tables.WAREND, T = sim.tables.TREATY;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const g = sim.newGame('9', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);
const ai = g.nations.map((n) => n.cap).filter((c) => c !== g.cap);
const [a, b] = ai;

// 1
g.beginWar(a, b, a);
const key = g.warKey(a, b);
const known = g.year + Math.max(g.sysDist(a, a), g.sysDist(a, b)) + 2 * g.sysDist(a, b); // 両方が知り、申し入れが行き来できたあと (B-167)
g.year = known + W.lapse - 1;
g.lapseYearly();
check(g.atWar(a, b), '立ち消えが早すぎる');
g.warLoss(a, b, 1, b); // 戦果が動いた
g.year += 2;
g.lapseYearly();
check(g.atWar(a, b), '戦果が動いたのに立ち消えになった');
g.year += W.lapse;
g.lapseYearly();
check(!g.atWar(a, b) && g.lastPeace(key), '戦果が動かない戦争が立ち消えにならない');

// 2
g.beginWar(a, b, a);
g.warStats[g.warKey(a, b)].k[a] = Math.floor((T.white - 1) / 2); // 戦勝点 < white
const conf0 = g.conferences.length + g.confSent.length;
g.makePeace(a, b, a);
check(!g.atWar(a, b) && g.conferences.length + g.confSent.length === conf0, '小さな勝ちで講和会議が開いた');

// 3
g.beginWar(a, b, a);
const ks = g.warKey(a, b);
g.warStats[ks].z = { [a]: 0, [b]: 0 };
for (const x of g.realmSystems(a)) g.garrison[x.id] = 2000; // 相手に見えている艦隊 (光の遅れのぶん古い) より、ずっと多く
for (const x of g.realmSystems(b)) g.garrison[x.id] = 0;
g.recordIntel();
check(g.reservation(a, b) === 100, `大きく勝っている国の受け入れる線が 100 でない (${g.reservation(a, b)})`);
let capit = null;
const orig = g.startConference.bind(g);
g.startConference = (l, w, f) => { capit = { l, w }; return orig(l, w, f); };
const done = g.bargain(a, b, a);
if (g.reservation(b, a) <= W.yieldAt) check(done && capit && capit.l === b && capit.w[0].pts === 100, '見込みのない国が降伏しない');
g.startConference = orig;

// 4
const c = ai.find((x) => x !== a && x !== b && g.realmOf(x) === x) ?? b;
if (g.atWar(a, c)) g.endWar(a, c, a);
const hk = g.warKey(g.cap, c);
g.beginWar(c, g.cap, c);
g.postPeaceOffer(hk, c, g.cap, g.year, true);
let conf = null;
g.startConference = (l, w, f) => { conf = { l, w }; return orig(l, w, f); };
check(g.acceptPeace({ key: hk }).ok && conf && conf.l === g.cap && conf.w[0].realm === c && conf.w[0].pts === 100, '降伏の求めに応じても、持ち点 100 の講和会議にならない');

console.log(fails.length ? `戦争の終わり方 不合格\n${fails.join('\n')}` : '戦争の終わり方 合格');
process.exit(fails.length ? 1 : 0);
