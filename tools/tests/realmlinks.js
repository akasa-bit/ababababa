// 国の交易路網 (回 KE13・B-129。KE13-Q2 = a。docs/regions.md の 8): AI の国の政府 (首都) は、交易路が 1 本もない自国の星系を、
// いちばん近い自国の交易路網の星系 (か首都) とつなぎ、費用は首都が払う。画面なしの版で回す:
//   1. AI の国: 交易路のない自国の星系が、いちばん近い網の星系とつながり、交易路の費用は首都の帳簿から出る (最初の輸送船は、交易路の持ち主の運送業の会社が
//      次の年に造る)。家臣の政府の資金は減らない
//   2. 国ごとに 1 年 1 本まで
//   3. 首都の資金が費用の 1.5 倍に届かなければ引かない
//   4. 人間の国 (観戦でない) の星系にはつながない (プレイヤーが決める)
// 使い方: node tools/tests/realmlinks.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('国の交易路網 合格') ? '' : '国の交易路網 (首都が交易路のない自国の星系をつなぐ) の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const fails = [];
const base = JSON.stringify(sim.buildSave(sim.run(sim.newGame(seed, { nations: 6 }), 60)));
const twin = () => { const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN })); h.restore(JSON.parse(base)); return h; };
// 交易路のない自国の星系を持つ AI の国を探し、なければ 1 つ作る (自国の星系の交易路を消す)
const setup = (h, human = false) => {
  const roots = [...new Set(h.colonizedSystems().map((s) => h.realmOf(s.id)))].filter((r) => h.isColonized(r) && h.isHuman(r) === human);
  for (const root of roots) {
    const mine = h.colonizedSystems().map((s) => s.id).filter((id) => id !== root && h.realmOf(id) === root);
    if (!mine.length) continue;
    const lone = mine[0];
    h.routes = h.routes.filter((r) => r.a !== lone && r.b !== lone);
    for (const id of mine.slice(1)) h.routes = h.routes.filter((r) => r.a !== id && r.b !== id); // 残りの家臣も外す (首都だけが網)
    return { root, lone, mine };
  }
  return null;
};
// 1・2. AI の国
{
  const h = twin();
  h.setSpectate(false); // 観戦でない (プレイヤーの国だけ人間)
  const s = setup(h);
  if (!s) fails.push('家臣のある AI の国が見つからない');
  else {
    h.cash('test', 5000, { gov: s.root }); // 費用が払えるように首都に資金を足す
    const fr = h.funds(s.root), fv = Object.fromEntries(s.mine.map((id) => [id, h.funds(id)]));
    const n0 = h.routes.length;
    h.realmLinksYearly();
    const added = h.routes.slice(n0);
    if (added.length !== 1) fails.push(`1 年に引いた交易路が 1 本でない (${added.length})`);
    const r = added[0];
    if (r) {
      // 家臣はみな網から外したので、網は首都だけ。首都にいちばん近い家臣とつなぐはず
      const near = s.mine.reduce((m, id) => (m === null || h.sysDist(id, s.root) < h.sysDist(m, s.root) ? id : m), null);
      if (!(r.a === near && r.b === s.root)) fails.push(`首都にいちばん近い家臣 (${near}) と首都をつないでいない (${r.a} ⇄ ${r.b})`);
      if (r.by !== s.root) fails.push(`交易路の払い手が首都でない (${r.by})`);
      if (!(h.funds(s.root) < fr)) fails.push('首都の資金が減っていない');
      for (const id of s.mine) if (h.funds(id) < fv[id] - 1e-6) fails.push(`家臣の星系 ${id} の資金が減った`);
    }
    console.log('AI の国:', JSON.stringify({ root: s.root, vassals: s.mine.length, added: added.map((x) => [x.a, x.b, x.by]) }));
  }
}
// 3. 首都の資金が足りなければ引かない
{
  const h = twin();
  h.setSpectate(false);
  const s = setup(h);
  if (s) {
    h.cash('test', -h.funds(s.root), { gov: s.root });
    const n0 = h.routes.length;
    h.realmLinksYearly();
    if (h.routes.slice(n0).some((r) => r.by === s.root)) fails.push('資金のない首都が交易路を引いた');
  }
}
// 4. 人間の国 (観戦でない) にはつながない
{
  const h = twin();
  h.setSpectate(false);
  const s = setup(h, true);
  if (s) {
    h.cash('test', 5000, { gov: s.root });
    const n0 = h.routes.length;
    h.realmLinksYearly();
    if (h.routes.slice(n0).some((r) => r.by === s.root)) fails.push('人間の国の首都が自動で交易路を引いた');
    console.log('人間の国: 家臣', s.mine.length);
  } else console.log('人間の国: 家臣がない (確かめない)');
}
console.log(fails.length ? `国の交易路網 不合格: ${fails.join('・')}` : '国の交易路網 合格');
process.exit(fails.length ? 1 : 0);
