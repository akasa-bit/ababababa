// 建設の指令の費用の払い手 (依頼 KE-3。KE13-Q4 = b。2026-11-01): 人間のプレイヤーがほかの自国の星系へ送った建設の指令 (採掘基地・施設・交易路・軍艦・要塞) は、
// 届いて実行されるとき、費用をまるごと指令を出した国の首都が払う (前は届いた先の星系の政府が払い、資金がほぼ 0 の開拓地では実行できなかった)。画面なしの版で回す:
//   1. 資金 0 の自国の家臣の星系に施設の拡張の指令を送ると、届いて実行され、首都の資金が減り、家臣の資金は減らない
//   2. 同じ星系で、指令でなく星系の政府が自分で建てるとき (this.orderBy なし) は、前のとおり星系の政府が払う (資金 0 なら建てられない)
//   3. AI の国の指令は前のまま (届いた先の政府が払う)
// 使い方: node tools/tests/orderpay.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('建設の指令の払い手 合格') ? '' : '建設の指令の費用を、指令を出した首都が払っていない') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const colKey = sim.evaluate('colKey');
const fails = [];
const base = JSON.stringify(sim.buildSave(sim.run(sim.newGame(seed, { nations: 6 }), 40)));
const twin = () => { const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN })); h.restore(JSON.parse(base)); return h; };
const pick = (h) => {
  for (const s of h.colonizedSystems()) {
    if (s.id === h.cap || h.realmOf(s.id) !== h.cap || h.isDirect(s.id)) continue;
    const c = h.coloniesIn(s.id).find((x) => x.lv.mine < 5);
    if (c) return c;
  }
  return null;
};
// 1. 人間のプレイヤーの指令
{
  const h = twin();
  h.setSpectate(false);
  h.pc = 100;
  h.cash('test', 1e5, { gov: h.cap });
  const c = pick(h);
  if (!c) { console.log('自国の家臣の入植地がない'); process.exit(1); }
  h.cash('test', -h.funds(c.sys), { gov: c.sys }); // 家臣の政府の資金を 0 に
  const lv0 = c.lv.mine;
  const r = h.command('upgrade', { col: colKey(c), fac: 'mine' });
  if (!r.ok) fails.push(`指令を送れない (${r.reason})`);
  const q = h.requests.find((x) => x.kind === 'order' && x.act === 'upgrade' && x.to === c.sys);
  if (!q) fails.push('指令が光速の指令になっていない');
  else {
    // 届く直前まで進め、首都と家臣の資金を見てから、届くところを進める
    while (h.year + 0.25 < q.arrive) h.advance(0.25);
    h.cash('test', -h.funds(c.sys), { gov: c.sys });
    const fc = h.funds(h.cap), fv = h.funds(c.sys);
    const cost = h.upgradeCost(c, 'mine').credits;
    h.advance(0.5);
    const done = !h.requests.includes(q);
    const job = h.projects.find((j) => j.type === 'upgrade' && j.col === colKey(c) && j.fac === 'mine') || c.lv.mine > lv0;
    if (!done || !job) fails.push('資金 0 の家臣で、指令が実行されなかった');
    if (!(fc - h.funds(h.cap) >= cost * 0.9)) fails.push(`首都が費用を払っていない (首都の減り ${(fc - h.funds(h.cap)).toFixed(0)}・費用 ${cost})`);
    if (h.funds(c.sys) < fv - 1e-6) fails.push(`家臣の資金が減った (${fv.toFixed(1)} → ${h.funds(c.sys).toFixed(1)})`);
    console.log('人間の指令:', JSON.stringify({ sys: c.sys, cost, capPaid: Math.round(fc - h.funds(h.cap)), vassal: [Math.round(fv), Math.round(h.funds(c.sys))] }));
  }
}
// 2. 指令でないとき (星系の政府が自分で建てる) は前のまま
{
  const h = twin();
  const c = pick(h);
  h.cash('test', -h.funds(c.sys), { gov: c.sys });
  const r = h.upgrade(c, 'mine');
  if (r.ok) fails.push('資金 0 の星系の政府が、自分で建てられた (首都が払った?)');
}
// 3. AI の国の指令は前のまま: AI の国の首都の資金は、家臣での建設で減らない
{
  const h = twin();
  h.setSpectate(false);
  const root = h.nations.map((n) => n.cap).find((r) => !h.isHuman(r) && h.colonizedSystems().some((s) => s.id !== r && h.realmOf(s.id) === r));
  const sys = h.colonizedSystems().find((s) => s.id !== root && h.realmOf(s.id) === root)?.id;
  if (root !== undefined && sys !== undefined) {
    const c = h.coloniesIn(sys).find((x) => x.lv.mine < 5);
    h.cash('test', 1e4, { gov: sys });
    const fr = h.funds(root);
    const pi = h.playerOf(root);
    const r = h.asPlayer(pi, () => { h.orderBy = undefined; return h.upgrade(c, 'mine'); });
    if (r.ok && h.funds(root) < fr - 1e-6) fails.push('AI の国の家臣の建設を首都が払った');
  }
}
console.log(fails.length ? `建設の指令の払い手 不合格: ${fails.join('・')}` : '建設の指令の払い手 合格');
process.exit(fails.length ? 1 : 0);
