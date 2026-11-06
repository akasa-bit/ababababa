// 作戦の手引き (最初の時代。screen/eras-score.js の guideSteps。B-043) の試験。画面なしの版で回す:
//   1. 始めたとき (自分ではまだ何もしていない) は、3 つの手のどれにも ✓ がついていない。よその国が首都へ引いた交易路があっても、
//      2 つめ (交易路で結ぶ) は済んでいない (回 GA13: よその国の交易路も数えていて、始めたときから 2 つめに ✓ がついていた)
//   2. 自分の国の星系と首都を結ぶ交易路があれば、2 つめが済む (時代の課題の「交易路」と同じ数え方)
// 使い方: node tools/tests/guide.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['11'], judge: (o) => (o.includes('作戦の手引き 合格') ? '' : (o.match(/^作戦の手引き 不合格[^\n]*/m) || ['作戦の手引きの結果が違う'])[0]) }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '11'] = process.argv.slice(2);
const sim = H.load({});
const fails = [];
// 1. 始めたとき: 人間の国として 1 年進める (命令は出さない)
const g = sim.newGame(seed, { nations: 4, spectate: false });
sim.run(g, 1);
const cap = g.cap;
const foreign = g.routes.filter((r) => (r.a === cap || r.b === cap) && !(g.realmOf(r.a) === cap && g.realmOf(r.b) === cap));
const st = g.guideSteps();
if (!st) fails.push('始めたときに手引きが出ない');
else {
  const done = st.steps.map((x) => (x.done ? 1 : 0)).join('');
  if (done !== '000') fails.push(`何もしていないのに済んだ手がある (${done}・よその国の交易路 ${foreign.length} 本)`);
}
// 2. 観戦で進めて自分の国の星系と交易路ができたら、2 つめが済む
const g2 = sim.run(sim.newGame(seed, { nations: 4 }), 40);
g2.setSpectate(false);
const own = g2.realmRoutes(g2.cap);
const st2 = g2.guideSteps();
const done2 = st2 ? st2.steps[1].done : true; // 3 つとも済めば手引きは消える (null)
if (own > 0 && !done2) fails.push(`自分の国の交易路が ${own} 本あるのに、2 つめが済んでいない`);
if (own === 0 && done2 && st2) fails.push('自分の国の交易路がないのに、2 つめが済んでいる');
console.log(`よその国から首都への交易路 ${foreign.length} 本・40 年あとの自分の国の交易路 ${own} 本 (2 つめ ${done2 ? '済み' : 'まだ'})`);
console.log(fails.length ? `作戦の手引き 不合格 (${fails.join(' / ')})` : '作戦の手引き 合格');
process.exit(fails.length ? 1 : 0);
