// 国の入植の予算 (回 KE15・B-069。ユーザーの選び「首都が属領の入植を出す」。economy/development.js の askColonyFunds・colonyAskArrived・colonyFundPay) の試験。画面なしの版で回す:
//   1. 入植船の資金が足りない家臣の星系の政府は、国の首都へ光速で願い出る (要求 colask。届くのは光の時間のあと)。すぐには願い直さない
//   2. 願いが首都に届くと、首都 (人間が動かしていない首都) は手元の資金から資金援助で送る (光速で届き、家臣の資金になる)。払えなければ取っておく願いに入り、
//      首都はその額を行政サービスに使わずに取っておく (fiscal.js の debtStep の資本の予算)
//   3. 人間が動かす首都 (観戦でない) には願わない (プレイヤーの資金を勝手に使わない)
// 使い方: node tools/tests/colfund.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('国の入植の予算 合格') ? '' : (o.match(/^国の入植の予算 不合格[^\n]*/m) || ['国の入植の予算の結果が違う'])[0]) }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const { COLONY_FUND } = sim.tables;
const fails = [];
const g = sim.run(sim.newGame(seed, { nations: 6 }), 120); // 観戦: どの首都も AI が動かす
const root = g.cap;
const vassal = g.realmSystems(root).map((s) => s.id).find((id) => id !== root && g.isColonized(id));
if (vassal === undefined) { console.log('国の入植の予算 不合格 (家臣の星系がない)'); process.exit(1); }
const cg = g.govs[root], vg = g.govs[vassal];
const T = Math.max(0, (cg.ledger?.tax || 0) + (cg.ledger?.natives || 0));
const amt = Math.max(1, Math.min(300, 0.5 * COLONY_FUND.share * T)); // 願いの合計の上限 (税収の share 年分) の中
const asks = () => g.requests.filter((q) => q.kind === 'colask' && q.from === vassal);
// 1. 願い出る・すぐには願い直さない
delete vg.colAsk;
g.askColonyFunds(vassal, amt);
const q = asks()[0];
const dt = g.travelYears(vassal, root);
if (!q || q.to !== root || Math.abs(q.arrive - (g.year + dt)) > 1e-9 || Math.abs(q.amt - amt) > 1e-9) fails.push('家臣が首都へ光速で願い出ていない');
g.askColonyFunds(vassal, amt);
if (asks().length !== 1) fails.push('すぐに願い直した');
// 2. 届いたら首都が送る (届く直前の刻みで首都に資金を持たせる。ふだんの首都は手元の資金を行政サービスに使いきっている)
const grantsTo = () => g.requests.filter((x) => x.kind === 'grant' && x.from === root && x.to === vassal);
const before = grantsTo().length;
while (asks().length && q && q.arrive - g.year > 0.25) g.advance(0.25);
delete cg.saveFor; delete cg.colFund;
cg.credits = Math.max(cg.credits, 10 * amt + 1000);
const c0 = cg.credits;
for (let i = 0; i < 4 && asks().length; i++) g.advance(0.25);
if (asks().length) fails.push('願いが首都に届いていない');
const sent = grantsTo().length > before && grantsTo().some((x) => x.auto && Math.abs(x.amt - amt) < 1e-6);
if (!sent) fails.push('首都が家臣の入植船の資金を送っていない');
if (cg.colFund?.length) fails.push('払えるのに取っておく願いに残っている');
// 払えないときは取っておく願いに入る (首都は資本の予算として行政サービスに使わずに取っておく)。たまったら送る
delete cg.colFund; delete cg.saveFor;
cg.credits = 0;
const n1 = grantsTo().length;
g.colonyAskArrived({ kind: 'colask', from: vassal, to: root, amt, sent: g.year, arrive: g.year });
const held = (cg.colFund || []).some((x) => x.to === vassal && Math.abs(x.amt - amt) < 1e-9) && grantsTo().length === n1;
if (!held) fails.push('払えない願いを取っておいていない');
cg.credits = amt + 50;
g.colonyFundPay(root);
if (cg.colFund?.length || grantsTo().length !== n1 + 1) fails.push('たまった資金で取っておいた願いを払っていない');
// 願いの合計は首都の税収の share 年分まで (超える願いは受けない)
delete cg.colFund;
cg.credits = 0;
const T2 = Math.max(0, (cg.ledger?.tax || 0) + (cg.ledger?.natives || 0));
g.colonyAskArrived({ kind: 'colask', from: vassal, to: root, amt: COLONY_FUND.share * T2 + 1, sent: g.year, arrive: g.year });
if (cg.colFund?.length) fails.push('首都の税収の上限を超える願いを受けた');
// 3. 人間が動かす首都 (観戦でない) には願わない
g.setSpectate(false);
delete vg.colAsk;
const n0 = g.requests.length;
g.askColonyFunds(vassal, amt);
if (g.requests.length !== n0) fails.push('人間が動かす首都に願った');
console.log(`首都 ${g.system(root).name}・家臣 ${g.system(vassal).name}・光の時間 ${dt.toFixed(1)} 年・願い ${Math.round(amt)} cr・届く直前の首都の資金 ${Math.round(c0)} cr`);
console.log(fails.length ? `国の入植の予算 不合格 (${fails.join(' / ')})` : '国の入植の予算 合格');
process.exit(fails.length ? 1 : 0);
