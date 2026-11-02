// 定期の資金援助 (依頼 KE-4。2026-11-01。politics/grants.js の setStandingGrant・standingGrantsYearly) の試験。画面なしの版で回す:
//   1. 自国の星系に「毎年 amt cr」を決めると、年に 1 回、首都から amt cr が光速で送られ、届くと受け手の資金になる (止めるまで続く)
//   2. 首都の資金が足りない年は、送れる分だけ送る
//   3. 0 を決めると止まる。ほかの国の星系には決められない
//   4. 決めるときは政治力 (ふつうの資金援助と同じ)、止めるときは要らない。セーブと読み込みで設定が残る
//   5. 首都の税収の割合 (%) でも決められ、その年の額は税収の均し (gv.ledger.tax) × 割合 (KE4-Q1 = c)
// 使い方: node tools/tests/standing.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('定期の資金援助 合格') ? '' : '定期の資金援助の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const fails = [];
const g = sim.run(sim.newGame(seed, { nations: 6 }), 40);
g.setSpectate(false);
g.pc = 100;
const mine = g.colonizedSystems().map((s) => s.id).filter((id) => id !== g.cap && g.realmOf(id) === g.cap);
const other = g.colonizedSystems().map((s) => s.id).find((id) => g.realmOf(id) !== g.cap);
if (!mine.length) { console.log('自国の家臣がない'); process.exit(1); }
const to = mine[0];
// 1. 決める
g.cash('test', 10000, { gov: g.cap });
const pc0 = g.pc;
const r = g.command('grantset', { sys: to, amt: 120 });
if (!r.ok) fails.push(`決められない (${r.reason})`);
if (!(g.pc < pc0)) fails.push('決めるのに政治力が要らなかった');
if (g.me.standing?.[to] !== 120) fails.push('設定が残っていない');
const sent = () => g.requests.filter((q) => q.kind === 'grant' && q.to === to && q.standing);
const n0 = sent().length, f0 = g.funds(g.cap);
g.grantsYearly();
const q = sent().slice(n0);
const amtOf = (x) => x.amt; // 運ぶ途中の額 (cash の way で足される)
if (q.length !== 1 || Math.abs(amtOf(q[0]) - 120) > 1e-6) fails.push(`1 年に送った援助が 120 cr の 1 件でない (${q.map((x) => x.amt).join(',')})`);
if (!(f0 - g.funds(g.cap) >= 120 - 1e-6)) fails.push('首都の資金が減っていない');
// 届くと受け手の資金になる
const fv = g.funds(to);
sim.run(g, Math.ceil(g.travelYears(g.cap, to)) + 1);
if (!(g.funds(to) > fv - 1e-6 || g.requests.every((x) => x.kind !== 'grant' || x.to !== to || x.arrive > g.year))) fails.push('届いた援助が受け手の資金にならない');
// 2. 首都の資金が足りない年は、送れる分だけ
g.cash('test', -g.funds(g.cap) + 50, { gov: g.cap });
const n1 = sent().length;
g.grantsYearly();
const q2 = sent().slice(n1);
if (q2.length !== 1 || !(q2[0].amt <= 50 + 1e-6)) fails.push(`資金が足りない年に送った額が違う (${q2.map((x) => x.amt).join(',')})`);
// 4. セーブと読み込み
const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
h.restore(JSON.parse(JSON.stringify(sim.buildSave(g))));
if (h.players[h.pi].standing?.[to] !== 120) fails.push('セーブと読み込みで設定が消えた');
// 3. 止める・ほかの国
const pc1 = g.pc;
const s = g.command('grantset', { sys: to, amt: 0 });
if (!s.ok || g.me.standing?.[to] !== undefined) fails.push('止められない');
if (g.pc !== pc1) fails.push('止めるのに政治力が要った');
const n2 = sent().length;
g.grantsYearly();
if (sent().length !== n2) fails.push('止めたのに送った');
if (other !== undefined && g.command('grantset', { sys: other, amt: 100 }).ok) fails.push('ほかの国の星系に決められた');
// 5. 税収の割合で決める
g.cash('test', 1e5, { gov: g.cap });
g.pc = 100;
const rp = g.command('grantset', { sys: to, amt: 5, unit: 'pct' });
if (!rp.ok || g.me.standing?.[to]?.pct !== 5) fails.push(`税収の割合で決められない (${rp.reason || JSON.stringify(g.me.standing?.[to])})`);
const tax = Math.max(0, g.gov(g.cap).ledger?.tax || 0);
const n3 = sent().length;
g.grantsYearly();
const q3 = sent().slice(n3);
if (tax >= 20 && (q3.length !== 1 || Math.abs(q3[0].amt - 0.05 * tax) > 1e-6)) fails.push(`税収の 5% を送っていない (税収 ${tax.toFixed(1)}・送った ${q3.map((x) => x.amt.toFixed(1)).join(',')})`);
if (g.command('grantset', { sys: to, amt: 80, unit: 'pct' }).ok && g.me.standing?.[to]?.pct > 50) fails.push('税収の割合の上限 (50%) を超えて決められた');
console.log(JSON.stringify({ to, sent: [q.length, q2.length, q3.length], tax: Math.round(tax), pct5: q3[0]?.amt }));
console.log(fails.length ? `定期の資金援助 不合格: ${fails.join('・')}` : '定期の資金援助 合格');
process.exit(fails.length ? 1 : 0);
