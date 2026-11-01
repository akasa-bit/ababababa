// 攻め落とした星系・降伏した国の統治体制 (回 SE11・SE11-Q2 = a。docs/vassal-game.md): 新しい主人の家臣の型で決め直し、前の型と束の欄は消す
// (傀儡政権が倒れたとき puppetFalls と同じ)。前は既定の T04 のままで、試合の結びつきの 43% が T04 だった (事例は 6%)。画面なしの版で回す:
//   1. AI の国が降伏させた国の首都: 前の型・束・現地のエリートが消え、型は勝った国の距離の区分の型 (VASSAL_DATA.ai.types) のどれか
//   2. 人間の国 (観戦でない) が降伏させた国の首都: プレイヤーの「新しい入植地の統治体制」の型になる
//   3. 攻囲で落とした星系も同じ決め直し (newLordRegime) を通る
// 使い方: node tools/tests/conquest.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('攻め落とした星系の型 合格') ? '' : '攻め落とした星系・降伏した国の統治体制が決め直されていない') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const { VASSAL_DATA, BUNDLE } = sim.tables;
const fails = [];
const base = JSON.stringify(sim.buildSave(sim.run(sim.newGame(seed, { nations: 6 }), 30)));
const twin = () => { const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN })); h.restore(JSON.parse(base)); return h; };
const regimeKey = (h, id) => { const gv = h.govs[id]; return gv.direct ? 'direct' : gv.regime || 'T04'; };
const classOf = (h, id, root) => { const d = h.sysDist(id, root); return d < BUNDLE.aiDist[0] ? 'contiguous' : d < BUNDLE.aiDist[1] ? 'near' : 'far'; };
// 前の型は T17 (AI の型の決め方の表のどの区分にもない型) にしておく。決め直さなければ残って分かる
const dirty = (gv) => { Object.assign(gv, { regime: 'T17', law: 'VVVVVVVV', fact: 'SSSSSSSS', elite: 'resist', arrears: 3 }); };

// 1. AI の国どうし: 国家選択の 2 つ目の AI の国が、3 つ目の国を降伏させる
{
  const h = twin();
  const caps = h.nations.map((n) => n.cap).filter((c) => !h.isHuman(c));
  const [win, lose] = [caps[0], caps[1]];
  dirty(h.gov(lose));
  h.surrender(lose, win);
  const gv = h.govs[lose], r = regimeKey(h, lose), cls = classOf(h, lose, win);
  const allowed = Object.keys(VASSAL_DATA.ai.types[cls]);
  if (gv.lord !== win) fails.push(`降伏した国の主人が勝った国でない (${gv.lord} ≠ ${win})`);
  if (!allowed.includes(r)) fails.push(`降伏した国の型 ${r} が、距離の区分 ${cls} の型 (${allowed.join('・')}) にない`);
  if (gv.law || gv.fact || gv.elite || gv.arrears) fails.push('降伏した国に前の束・現地のエリート・滞納が残った');
  console.log('AI の国が降伏させた:', JSON.stringify({ win, lose, cls, regime: r }));
}
// 2. 人間の国 (観戦でない) が降伏させる: プレイヤーの新しい入植地の型
{
  const h = twin();
  h.setSpectate(false);
  const me = h.cap, p = h.players[h.pi];
  p.regime = 'T08';
  const lose = h.nations.map((n) => n.cap).find((c) => c !== me);
  dirty(h.gov(lose));
  h.surrender(lose, me);
  const r = regimeKey(h, lose);
  if (r !== 'T08') fails.push(`人間の国が降伏させた国の型が、プレイヤーの選んだ型 (T08) でない (${r})`);
  console.log('人間の国が降伏させた:', r);
}
// 3. 攻囲で落とした星系も同じ決め直しを通る (newLordRegime を直接呼ぶ)
{
  const h = twin();
  const caps = h.nations.map((n) => n.cap).filter((c) => !h.isHuman(c));
  const id = caps[2];
  dirty(h.gov(id));
  h.newLordRegime(id, caps[0]);
  const gv = h.govs[id], r = regimeKey(h, id);
  if (!Object.keys(VASSAL_DATA.ai.types[classOf(h, id, caps[0])]).includes(r) || gv.law || gv.elite) fails.push(`攻囲で落とした星系の型が決め直されていない (${r})`);
  console.log('攻囲で落とした星系:', r);
}
console.log(fails.length ? `攻め落とした星系の型 不合格: ${fails.join('・')}` : '攻め落とした星系の型 合格');
process.exit(fails.length ? 1 : 0);
