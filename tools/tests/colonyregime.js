// 入植のときに選ぶ統治体制 (依頼 KE-5。2026-11-01): 入植船ごとに、着いてできる星系の政府の型を選べる。画面なしの版で回す:
//   1. 型を選んで送った入植船 (T08) が着くと、新しい星系の政府はその型になる
//   2. 「基本のまま」(型なし) で送ると、着いたときの基本統治形式 (プレイヤーの「新しい入植地の統治体制」。ここでは T13) になる
//   3. 基本統治形式と違う T04 (表の基準の型) を選んでも、その型になる (型の欄は消える)
//   4. 直轄は入植のときには選べない (選んでも基本統治形式のまま)
//   5. 飛んでいるあいだに保存して読み直しても、選んだ型は残る
// 使い方: node tools/tests/colonyregime.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('入植のときの統治体制') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({});
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const g = sim.newGame('3', { nations: 6 });
g.setSpectate(false);
const cap = g.cap;
const goods = (id) => g.system(id).bodies.find((b) => (b.settle?.grade || 0) >= 1);
const ts = g.nearSystems(cap).filter(([id, d]) => id !== cap && d > 3 && !g.isColonized(id) && goods(id)).slice(0, 4).map(([id]) => id);
check(ts.length === 4, `入植できる星系が 4 つ見つからない (${ts.length})`);
g.credits = 1e7;
g.gov(cap).E = 1e40;
Object.assign(g.stockOf(cap), { goods: 1e5, food: 1e5, water: 1e5 });
g.players[g.pi].regime = 'T13';
const picks = ['T08', '', 'T04', 'direct'];
const want = ['T08', 'T13', 'T04', 'T13'];
picks.forEach((r, i) => {
  const res = g.command('candsend', { from: cap, sys: ts[i], body: goods(ts[i]).id, kind: 'planet', ...(r ? { regime: r } : {}) });
  check(res?.ok, `入植船 ${i + 1} を出せない: ${res?.reason || res?.msg}`);
});
// 5. 飛んでいるあいだに保存して読み直す
const save = JSON.stringify(sim.buildSave(g));
const h = new sim.Game(sim.generateGalaxy({ seed: g.galaxy.seed, starCount: 400, meanSpacing: 4, kind: 'real', gen: g.galaxy.gen }));
h.restore(JSON.parse(save));
const regimeKey = (x, id) => { const gv = x.govs[id]; return gv ? (gv.direct ? 'direct' : gv.regime || 'T04') : null; };
for (const [tag, x] of [['そのまま', g], ['読み直し', h]]) {
  for (let i = 0; i < 4 * 80 && ts.some((id) => !x.govs[id]); i++) x.advance(0.25);
  const got = ts.map((id) => regimeKey(x, id));
  console.log(`${tag}: 選んだ型 ${JSON.stringify(picks)} → 新しい星系の型 ${JSON.stringify(got)}`);
  got.forEach((r, i) => check(r === want[i], `${tag}: 入植船 ${i + 1} (選んだ型 ${picks[i] || '基本のまま'}) の星系の型が ${r} (${want[i]} のはず)`));
  check(ts.every((id) => x.govs[id]?.lord === cap), `${tag}: 新しい星系が首都の家臣でない`);
}
console.log(fails.length ? `入植のときの統治体制 不合格\n${fails.join('\n')}` : '入植のときの統治体制 合格');
process.exit(fails.length ? 1 : 0);
