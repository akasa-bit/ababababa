// 自動対戦の結果を集計する: 戦略ごとの成績・シードと戦略の影響の大きさ・仕組みの発火・静かな年・独立の条件・目標の候補の達成率
const fs = require('fs');
const dir = process.argv[2];
const runs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));
const strategies = [...new Set(runs.map((r) => r.strategy))];
const seeds = [...new Set(runs.map((r) => r.seed))].sort();
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const at = (r, year) => r.series.find((s) => s.year === year) || r.series[r.series.length - 1];
const lastYear = Math.max(...runs.map((r) => r.series[r.series.length - 1].year));
const midYear = 2550;
const out = { runs: runs.length, strategies, seeds, lastYear };
// 1. 戦略ごとの成績
out.byStrategy = Object.fromEntries(strategies.map((st) => {
  const rs = runs.filter((r) => r.strategy === st);
  const f = (fn) => { const v = rs.map(fn); return { mean: mean(v), min: Math.min(...v), max: Math.max(...v) }; };
  return [st, {
    earthSystems250: f((r) => at(r, midYear).earthSystems), earthSystems500: f((r) => at(r, lastYear).earthSystems),
    systems500: f((r) => at(r, lastYear).systems), realms500: f((r) => at(r, lastYear).realms),
    indepFromEarth: f((r) => r.indep.filter((i) => i.formerEarth).length), indepAll: f((r) => r.indep.length),
    warsEarth: f((r) => r.counts.war_earth || 0), warsOther: f((r) => r.counts.war_other || 0), battles: f((r) => r.counts.startBattle || 0),
    surrenders: f((r) => r.counts.surrender || 0), peace: f((r) => r.counts.endWar || 0),
    pop500: f((r) => at(r, lastYear).earthPop), credits500: f((r) => at(r, lastYear).credits), maxDist500: f((r) => at(r, lastYear).maxDist),
  }];
}));
// 2. シードと戦略、どちらが結果を決めるか (入植星系数の分散を分ける)
const val = (r) => at(r, lastYear).earthSystems;
const grand = mean(runs.map(val));
const seedMeans = seeds.map((s) => mean(runs.filter((r) => r.seed === s).map(val)));
const stratMeans = strategies.map((s) => mean(runs.filter((r) => r.strategy === s).map(val)));
out.variance = { total: sd(runs.map(val)) ** 2, betweenSeeds: mean(seedMeans.map((m) => (m - grand) ** 2)), betweenStrategies: mean(stratMeans.map((m) => (m - grand) ** 2)) };
// 各シードで一番成績のよかった戦略
out.winsBySeed = Object.fromEntries(strategies.map((s) => [s, 0]));
for (const sd0 of seeds) { const rs = runs.filter((r) => r.seed === sd0).sort((a, b) => val(b) - val(a)); if (rs[0]) out.winsBySeed[rs[0].strategy]++; }
// 3. 仕組みの発火 (1回の対戦あたりの平均回数と、一度でも起きた対戦の割合)
const keys = [...new Set(runs.flatMap((r) => Object.keys(r.counts)))].sort();
out.firing = Object.fromEntries(keys.map((k) => [k, { perRun: mean(runs.map((r) => r.counts[k] || 0)), share: runs.filter((r) => (r.counts[k] || 0) > 0).length / runs.length }]));
out.friendStats = { friend50Max: mean(runs.map((r) => Math.max(...r.series.map((s) => s.friend50)))), blockedByFriendYears: mean(runs.map((r) => r.series.reduce((k, s) => k + s.blockedByFriend, 0) * 10)), loyaltyLowAvg: mean(runs.map((r) => mean(r.series.map((s) => s.loyaltyLow)))) };
// 4. 静かな年 (重要な出来事のない年) の割合と、いちばん長い静かな期間。前半・後半に分けて
const quiet = (r, from, to, kinds) => {
  const ys = r.yearly.filter((y) => y.y > from && y.y <= to);
  const sig = (y) => Object.entries(y.kinds).filter(([k]) => kinds.includes(k)).reduce((a, [, n]) => a + n, 0);
  let streak = 0, best = 0, q = 0;
  for (const y of ys) { if (sig(y) === 0) { q++; streak++; best = Math.max(best, streak); } else streak = 0; }
  return { share: q / Math.max(1, ys.length), longest: best };
};
const DRAMA = ['politics', 'battle', 'pirate', 'war', 'famine'];
out.pacing = Object.fromEntries([[0, 100], [100, 250], [250, 500]].map(([a, b]) => [`${a}-${b}`, { share: mean(runs.map((r) => quiet(r, a, b, DRAMA).share)), longest: mean(runs.map((r) => quiet(r, a, b, DRAMA).longest)) }]));
out.eventsPerDecade = Array.from({ length: 50 }, (_, i) => mean(runs.map((r) => r.yearly.filter((y) => y.y > i * 10 && y.y <= i * 10 + 10).reduce((k, y) => k + Object.entries(y.kinds).filter(([kk]) => DRAMA.includes(kk)).reduce((a, [, n]) => a + n, 0), 0))));
out.kindsTotal = {};
for (const r of runs) for (const y of r.yearly) for (const [k, n] of Object.entries(y.kinds)) out.kindsTotal[k] = (out.kindsTotal[k] || 0) + n / runs.length;
// 5. 独立したときの条件
const ind = runs.flatMap((r) => r.indep.map((i) => ({ ...i, strategy: r.strategy })));
out.independence = { n: ind.length, perRun: ind.length / runs.length, fromEarth: ind.filter((i) => i.formerEarth).length, war: ind.filter((i) => i.war).length,
  d0: ind.map((i) => Math.round(i.d0)), firstYear: mean(runs.map((r) => (r.indep[0] ? r.indep[0].year - 2300 : 500))),
  noIndepShare: runs.filter((r) => !r.indep.length).length / runs.length, loyalty: mean(ind.map((i) => i.loyalty)), fear: mean(ind.map((i) => i.fear)), friend: mean(ind.map((i) => i.friend)) };
// 6. 目標の候補の達成率 (どの戦略でも同じ判定)
const goals = {
  'G1 300年後に地球の国が50星系以上': (r) => at(r, 2600).earthSystems >= 50,
  'G2 500年で独立を一度も許さない': (r) => !r.indep.some((i) => i.formerEarth),
  'G3 500年後に独立国が残っていない (統一)': (r) => at(r, lastYear).realms === 1,
  'G4 500年後に太陽系から40光年より遠くに地球の国の星系がある': (r) => at(r, lastYear).maxDist > 40,
  'G5 500年後に地球の国が60星系以上': (r) => at(r, lastYear).earthSystems >= 60,
};
out.goals = Object.fromEntries(Object.entries(goals).map(([name, fn]) => [name, { all: runs.filter(fn).length / runs.length, ...Object.fromEntries(strategies.map((s) => [s, runs.filter((r) => r.strategy === s).filter(fn).length / Math.max(1, runs.filter((r) => r.strategy === s).length)])) }]));
// 7. 推移 (戦略ごとの平均)
out.series = Object.fromEntries(strategies.map((st) => { const rs = runs.filter((r) => r.strategy === st); return [st, rs[0].series.map((s, i) => ({ year: s.year, earthSystems: mean(rs.map((r) => r.series[i]?.earthSystems ?? 0)), realms: mean(rs.map((r) => r.series[i]?.realms ?? 0)), loyaltyAvg: mean(rs.map((r) => r.series[i]?.loyaltyAvg ?? 0)), awe: mean(rs.map((r) => r.series[i]?.awe ?? 0)), ships: mean(rs.map((r) => r.series[i]?.ships ?? 0)) }))]; }));
out.errors = runs.reduce((k, r) => k + (r.errors?.length || 0), 0);
console.log(JSON.stringify(out, null, 1));
