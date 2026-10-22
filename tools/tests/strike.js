// 光速に近い艦隊の一撃 (B-035。QD-04 = b) の試験。画面なしの版で回す
// 1. 命令 strike: 自国の艦隊だけ・他国の入植星系だけ。艦隊は減速しないので、ふつうの派遣より早く着く
// 2. 着くと: 戦争が始まり、1 艦隊で 1 つの天体を焼く (人口は STRIKE.survive だけ残り、施設は 0)。死者が戦争に入り、記録 (strikes) が残る。人間の国なら悪名が増える
// 3. 知らせ: 撃たれた国はかならず宣戦し (すでに戦争なら何もしない)、撃った国の家臣の忠誠は下がる。知らせは光速で届く
// 4. セーブに入って戻る
// 使い方: node tools/tests/strike.js
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const S = sim.tables.STRIKE;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const g = sim.newGame('7', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 40);
const caps = g.nations.map((n) => n.cap).filter((c) => c !== g.cap);
const e = caps.sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b))[0];

// 1
g.garrison[g.cap] = (g.garrison[g.cap] || 0) + 5;
check(!g.command('strike', { from: g.cap, sys: g.cap, n: 1 }).ok, '自国の星系へ突入できてしまう');
const n0 = g.garrison[g.cap];
check(g.command('strike', { from: g.cap, sys: e, n: 2 }).ok, '突入の命令が通らない');
const f = g.fleets[g.fleets.length - 1];
check(f.strike && f.n === 2 && g.garrison[g.cap] === n0 - 2, '突入の艦隊が出ない');
check(f.arrive - f.depart < g.fleetYears(g.cap, e), '減速しない艦隊が、ふつうの派遣より遅い');

// 2
const bodies = new Set(g.coloniesIn(e).map((c) => c.body)).size;
const pop0 = g.coloniesIn(e).reduce((k, c) => k + c.pop, 0);
const vassal = g.realmSystems(g.cap).map((x) => x.id).find((id) => id !== g.cap);
const loyal0 = vassal !== undefined ? g.gov(vassal).loyalty ?? 70 : null;
g.fleets = g.fleets.filter((x) => x !== f);
g.strikeArrives(f);
const burned = g.coloniesIn(e).filter((c) => c.pop <= S.survive * pop0 + 1e-9 && Object.values(c.lv).every((v) => !v));
check(g.atWar(g.cap, e), '突入で戦争が始まらない');
check(new Set(burned.map((c) => c.body)).size === Math.min(2, bodies), `焼けた天体の数が違う (${new Set(burned.map((c) => c.body)).size} / ${Math.min(2, bodies)})`);
const st = g.warStats[g.warKey(g.cap, e)];
check(st && st.dead > 0 && g.strikes.length === 1 && g.strikes[0].dead === st.dead, '死者と記録が残らない');
check(g.infamy >= S.infamy, '人間の国の悪名が増えない');

// 3
const s = g.strikes[0];
g.endWar(g.cap, e, e); // 撃たれた国が宣戦するのを見るため、いったん戦争を終える
g.strikesYearly();
check(!s.told.includes(e) || g.sysDist(s.sys, e) === 0, '知らせが光より速く届いた');
const far = Math.max(...g.realmSystems(g.cap).map((x) => g.sysDist(x.id, s.sys)), ...caps.map((c) => g.sysDist(c, s.sys)));
g.year += far + 1;
g.strikesYearly();
check(g.atWar(g.cap, e) || !g.isColonized(e) || g.realmOf(e) !== e, '撃たれた国が宣戦しない');
if (vassal !== undefined) check((g.gov(vassal).loyalty ?? 70) <= loyal0 - S.loyalty + 1e-9 || loyal0 < S.loyalty, '撃った国の家臣の忠誠が下がらない');
check(caps.every((c) => s.told.includes(c)), '知らせがすべての国に届かない');

// 4
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && g2.strikes.length === 1 && g2.strikes[0].told.length === s.told.length, '一撃の記録がセーブから戻らない');

console.log(fails.length ? `光速の一撃 不合格\n${fails.join('\n')}` : `光速の一撃 合格 (焼けた天体 ${new Set(burned.map((c) => c.body)).size}・死者 ${Math.round(s.dead / 1e6)} 百万人)`);
process.exit(fails.length ? 1 : 0);
