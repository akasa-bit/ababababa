// 戦略ボットの試験 (tools/strategy.js): 観戦の AI と同じ値 (BASE) が放任と同じ筋になる (状態の要約が一致)。
// 入植・交易・統治体制の値 (B-067) と、人間に近い遅れつきのボット (B-068) が、誤りなく回り、筋を変える
// 使い方: node tools/tests/strategy.js [年数] [シード(カンマ区切り)]
const S = require('../strategy');
const [years = '60', seedsS = '1,2'] = process.argv.slice(2);
const Y = Number(years), seeds = seedsS.split(',');
(async () => {
  const cases = [
    ['passive', null], ['BASE', S.BASE],
    ['human', S.humanize(null)], ['human3', S.humanize(null, { delay: 1, every: 3 })],
    ['colony', { ...S.BASE, colWait: 0, colRange: 25, colPick: 'best' }],
    ['trade', { ...S.BASE, routes: 6, routeRange: 25 }],
    ['regime', { ...S.BASE, regime: 'T14', direct: 1, mandate: 'develop', grantBelow: 50 }],
    ['humanAll', S.humanize({ ...S.EXTRA.rush.s, routes: 0, regime: 'T01', direct: 1, grantBelow: 70, warRatio: 1.5, warChance: 0.3 })],
  ];
  const fails = [];
  for (const nations of [6, 0]) {
    const jobs = cases.flatMap(([, s]) => seeds.map((seed) => ({ seed, years: Y, nations, strategy: s })));
    const rs = await S.runAll(jobs);
    const by = Object.fromEntries(cases.map(([n], i) => [n, rs.slice(i * seeds.length, (i + 1) * seeds.length)]));
    const same = (n) => by[n].every((r, i) => r.hash === by.passive[i].hash);
    if (!same('BASE')) fails.push(`${nations} か国: BASE が放任と違う筋になった`);
    for (const [n] of cases.slice(2)) if (same(n)) fails.push(`${nations} か国: ${n} が放任と同じ筋 (値が効いていない)`);
    for (const [n] of cases) console.log(nations, n.padEnd(8), by[n].map((r) => `${r.hash} 点 ${r.score.toFixed(0)} 星系 ${r.systems}`).join(' | '));
  }
  console.log(fails.length ? `戦略ボット 不合格: ${fails.join('・')}` : '戦略ボット 合格');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
