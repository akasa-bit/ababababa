// 遅れて届く外交 (回 SE2・B-026) の試験。画面なしの版で回す
// 1. 申し入れは光速で相手の首都に届いてから答えが出る。受けた国は今から、申し入れた国は返事が届いてから縛られる
// 2. 交易協定: 縛られている買い手の国は、相手の国に関税を掛けない
// 3. AI の国からの申し入れは「決めること」として届き、受けると協定になる
// 4. 防衛同盟: 同盟国が宣戦されると、知らせが届いた年に AI の同盟国は参戦し、人間の国には「参戦するか」が届く。断ると破約 (議会の支持が下がる)
// 5. 不可侵の相手に宣戦すると破約。破約の多い国の申し入れは受けにくい
// 6. セーブと読み込みで協定が残る
// 使い方: node tools/tests/pacts.js
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const T = sim.tables;

const g = sim.newGame('7', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);
g.diplo = { pacts: [], sent: [], breach: {} };
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
const others = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.realmAlive(c)).sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b));
const [e, f] = others;
const d = g.sysDist(g.cap, e);
check(others.length >= 3 && d > 1, `相手の国が足りない・近すぎる (${others.length} 国・${d.toFixed(1)} 光年)`);
const step = (years) => { for (let i = 0; i < Math.ceil(years * 4); i++) g.advance(0.25); };

// 1
g.pc = 100;
const r1 = g.command('pact', { sys: e, pact: 'trade', gift: 3000 });
check(r1.ok && g.pc < 100, `申し入れが送れない、か政治力が減らない (${JSON.stringify(r1)}・${g.pc})`);
check(g.diplo.sent.length === 1 && Math.abs(g.diplo.sent[0].at - (g.year + d)) < 1e-9, '申し入れの届く年が光速と違う');
check(!g.command('pact', { sys: e, pact: 'trade' }).ok, '同じ申し入れを 2 つ送れてしまった');
step(d - 0.6);
check(!g.pactBetween(g.cap, e, 'trade'), '申し入れが光より速く届いた');
step(1.5);
const p = g.pactBetween(g.cap, e, 'trade');
check(p && p.a === g.cap && p.b === e, '贈り物をたくさん添えた交易協定が結ばれない');
if (p) {
  check(g.pactBound(p, e) && !g.pactBound(p, g.cap), '受けた国は今から、申し入れた国は返事が届いてから縛られるはず');
  check(Math.abs(p.onA - (p.onB + d)) < 1e-9, '返事の届く年が光速と違う');
  // 2
  g.fiscalAt = () => ({ tariff: 0.1 }); // 関税の率そのものは経済の財政 (変えた知らせが届いてから効く) なので、ここでは置く
  const buyerE = e, sellerMe = g.cap;
  check(g.tariffFor(buyerE, sellerMe) === 0, '縛られている買い手の国が関税を掛けた');
  check(g.tariffFor(sellerMe, buyerE) === 0.1, `返事が届く前に、申し入れた国の関税が消えた (${g.tariffFor(sellerMe, buyerE)})`);
  g.year = p.onA + 0.01;
  check(g.tariffFor(sellerMe, buyerE) === 0, '返事が届いたあとも関税が掛かる');
}

// 3
const nDec = g.decisions.length;
g.proposePact({ sys: g.cap, pact: 'nap' }, f);
step(g.sysDist(f, g.cap) + 1.2);
const dec = g.decisions.find((x) => x.kind === 'pact' && x.from === f && x.state === 'open');
check(g.decisions.length > nDec && dec, 'AI の国からの申し入れが「決めること」として届かない');
if (dec) {
  check(dec.seen <= g.year + 1e-9, '自分の首都に届いた申し入れが、すぐ見えない');
  g.command('decide', { sys: dec.sys, id: dec.id, opt: 'accept' });
  const q = g.pactBetween(f, g.cap, 'nap');
  check(q && g.pactBound(q, g.cap) && !g.pactBound(q, f), '受けた不可侵が、こちらは今から・相手は返事が届いてから、になっていない');
}

// 4: 同盟の試験は、いちばん近い 2 国 (h と al) で。f2 が h に宣戦する。こちらも h と同盟
const pairs = others.flatMap((x) => others.filter((y) => y > x).map((y) => [x, y])).sort((u, v) => g.sysDist(...u) - g.sysDist(...v));
const [h, al] = pairs[0];
const f2 = others.filter((x) => x !== h && x !== al).sort((x, y) => g.sysDist(h, x) - g.sysDist(h, y))[0];
for (const x of [h, al, f2]) for (const y of [g.cap, h, al, f2]) if (x !== y && g.atWar(x, y)) g.endWar(x, y);
g.diplo.pacts = g.diplo.pacts.filter((x) => ![x.a, x.b].some((r) => [h, al, f2].includes(r)) || x.kind !== 'ally');
g.diplo.pacts.push({ id: 9001, kind: 'ally', a: g.cap, b: h, since: g.year, until: g.year + 300, onA: g.year, onB: g.year, called: [] }); // 遠い同盟国にも開戦の知らせが届くまで切れないように
g.diplo.pacts.push({ id: 9002, kind: 'ally', a: al, b: h, since: g.year, until: g.year + 300, onA: g.year, onB: g.year, called: [] });
g.bargain = () => false; g.peaceChance = () => 0; // 知らせが届くまで戦争が続くように (AI どうしの講和を止める)
g.garrison[f2] = (g.garrison[f2] || 0) + 200; g.garrison[h] = (g.garrison[h] || 0) + 200; // 知らせが届く前に、どちらかが滅ばないように
g.beginWar(f2, h, h);
g.diplomacyYearly();
const dhe = g.sysDist(h, al), dhme = g.sysDist(h, g.cap), t0 = g.year;
if (dhe > 1.5) check(!g.atWar(al, f2), '開戦の知らせが届く前に、AI の同盟国が参戦した');
for (let i = 0; i < 4 * (dhe + 2) && !g.atWar(al, f2) && g.atWar(f2, h); i++) g.advance(0.25);
check(g.atWar(al, f2) && g.year >= t0 + dhe - 1e-9, `AI の同盟国が、知らせが届いたあとも参戦しない、か光より速く参戦した (${(g.year - t0).toFixed(1)} 年・${dhe.toFixed(1)} 光年)`);
let call = g.decisions.find((x) => x.kind === 'pact' && x.type === 'call' && x.state === 'open');
for (let i = 0; i < 4 * (dhme + 2) && !call; i++) { g.advance(0.25); call = g.decisions.find((x) => x.kind === 'pact' && x.type === 'call' && x.state === 'open'); }
check(call && call.enemy === f2 && call.ally === h && g.year >= t0 + dhme - 1e-9, '人間の同盟国に「参戦するか」が届かない、か光より速く届いた');
if (call) {
  const c0 = g.council;
  g.pc = 100;
  g.command('decide', { sys: call.sys, id: call.id, opt: 'refuse' });
  check(!g.diplo.pacts.some((x) => x.id === 9001) && g.pactBreaches(g.cap) === 1 && g.council <= c0 - T.PACT.breachCouncil + 1e-9, `参戦を断っても破約にならない (${g.pactBreaches(g.cap)}・議会 ${c0} → ${g.council})`);
}
const s0 = g.pactScore(al, e === al ? f : e, 'trade').s, s1 = g.pactScore(al, g.cap, 'trade').s;
check(s1 < s0 || g.atWar(al, g.cap), `破約の多い国の申し入れが受けにくくなっていない (${s1.toFixed(2)} / ${s0.toFixed(2)})`);

// 5
const q2 = g.pactBetween(f, g.cap, 'nap');
if (q2) {
  g.year = Math.max(g.year, q2.onA, q2.onB) + 0.1;
  g.pc = 100;
  g.declareWar(f);
  g.diplomacyYearly();
  check(g.pactBreaches(g.cap) >= 1 && (g.diplo.breach[g.cap] || []).includes(g.year) && !g.pactBetween(f, g.cap, 'nap'), `不可侵の相手に宣戦しても破約にならない (${JSON.stringify(g.diplo.breach)})`);
}
const o = g.pactOutlook(e, 'nap');
check(['受けそう', '五分', '断りそう'].includes(o.label) && (o.s >= 0 || o.need.gift > 0), `見込みの形が違う (${JSON.stringify(o)})`);

// 6
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && JSON.stringify(g2.diplo) === JSON.stringify(g.diplo), '協定がセーブから戻らない');
delete saved.diplo;
const g3 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g3.restore(saved) && g3.diplo.pacts.length === 0 && g3.diplo.sent.length === 0, '協定のない前の版のセーブで既定に戻らない');

console.log(fails.length ? `外交 不合格\n${fails.join('\n')}` : `外交 合格 (相手の首都まで ${d.toFixed(1)} 光年・協定 ${g.diplo.pacts.length})`);
process.exit(fails.length ? 1 : 0);
