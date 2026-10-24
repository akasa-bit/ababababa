// AI の国が銀河を取りに来る (回 SE5・B-028) の試験。画面なしの版で回す
// 1. 入植の補正 (EDITIONS.game.aiRush): AI の国の首都と首都でない星系にだけ効き、人間の国 (地球) には効かない
// 2. 独立した国には、抜けられた国の権利の主張 (gv.claim) が付き、AI の国はその国への開戦の見込みに点を足す。セーブで残る
// 使い方: node tools/tests/rivals.js
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const { CLAIM } = sim.tables;
const rush = sim.tables.ED.aiRush;

const g = sim.newGame('3', { nations: 6 });
sim.run(g, 120);
const ai = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.realmOf(c) === c);
check(ai.length > 0, 'AI の国が残っていない');
// 1
const cap = ai[0];
check(g.aiRushOf(cap)?.fly === rush.fly && g.aiRushOf(cap)?.wait === rush.capWait, `AI の国の首都に入植の補正が効かない (${JSON.stringify(g.aiRushOf(cap))})`);
const sub = ai.flatMap((c) => g.realmSystems(c).map((x) => x.id)).find((id) => !ai.includes(id));
if (sub !== undefined) check(g.aiRushOf(sub)?.pop === rush.pop && g.aiRushOf(sub)?.fly === 1, 'AI の国の首都でない星系に入植の補正が効かない');
check(g.aiRushOf(g.cap) === null && g.realmSystems(g.cap).every((x) => g.aiRushOf(x.id) === null), '地球の国に入植の補正が効いた');
// 2
const v = sub ?? ai.flatMap((c) => g.realmSystems(c).map((x) => x.id)).find((id) => id !== cap);
if (v === undefined) fails.push('AI の国の家臣が見つからない');
else {
  const from = g.realmOf(v);
  g.declareIndependence(v);
  check(g.govs[v].claim?.realm === from && g.realmOf(v) === v, `独立した国に権利の主張が付かない (${JSON.stringify(g.govs[v].claim)})`);
  check(g.claimBonus(from, v) === CLAIM.bonus && g.claimChance(from) === CLAIM.chance, '抜けられた国の開戦の見込みに点が足されない');
  check(g.claimBonus(ai.find((c) => c !== from) ?? g.cap, v) === 0, 'ほかの国にも権利の主張が効いた');
  g.year += CLAIM.years + 1;
  check(g.claimBonus(from, v) === 0, `${CLAIM.years} 年を過ぎても権利の主張が残る`);
  g.year -= CLAIM.years + 1;
  const g2 = new sim.Game(sim.generateGalaxy({ seed: '3', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  check(g2.restore(JSON.parse(JSON.stringify(sim.buildSave(g)))) && g2.govs[v].claim?.realm === from, '権利の主張がセーブから戻らない');
}

console.log(fails.length ? `取り合い 不合格\n${fails.join('\n')}` : `取り合い 合格 (AI の国 ${ai.length})`);
process.exit(fails.length ? 1 : 0);
