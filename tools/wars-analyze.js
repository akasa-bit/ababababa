// wars.js の結果を集計する: 戦争の終わり方の内訳・長さの分布 (平均と中央値)・終わり方ごとの長さ・戦っていた年の割合・
// 戦闘のなかった戦争の割合、プレイヤーの国の講和の方針ごとの結果
// 使い方: node wars-analyze.js <outdir> > summary.json
const fs = require('fs');
const dir = process.argv[2];
const runs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (x) => (x === null ? null : Math.round(x * 10) / 10);
const out = { runs: runs.length, errors: runs.flatMap((r) => r.errs), byPolicy: {} };
for (const pol of [...new Set(runs.map((r) => r.policy))]) {
  const rs = runs.filter((r) => r.policy === pol);
  const wars = rs.flatMap((r) => r.done).filter((w) => w.how !== 'ongoing');
  const nat = wars.filter((w) => w.nat); // 国家選択の国どうしの戦争
  const hows = ['white', 'treaty', 'capitulation', 'conquest'];
  const mix = (ws) => Object.fromEntries(hows.map((h) => [h, r1((100 * ws.filter((w) => w.how === h).length) / Math.max(1, ws.length))]));
  const durs = (ws) => ws.map((w) => w.dur);
  const yearsAt = rs.flatMap((r) => r.atWar);
  const last = rs.map((r) => r.series[r.series.length - 1]?.me).filter(Boolean);
  const meWars = wars.filter((w) => w.me);
  out.byPolicy[pol] = {
    wars: wars.length, warsPerRunCentury: r1(wars.length / rs.length / (rs[0].years / 100)),
    mix: mix(wars), mixNations: mix(nat),
    duration: { mean: r1(mean(durs(wars))), median: r1(q(durs(wars), 0.5)), p90: r1(q(durs(wars), 0.9)), meanOverMedian: r1(mean(durs(wars)) / Math.max(0.1, q(durs(wars), 0.5))) },
    medianDurationBy: Object.fromEntries(hows.map((h) => [h, r1(q(durs(wars.filter((w) => w.how === h)), 0.5))])),
    noCombatShare: r1((100 * wars.filter((w) => w.kills === 0 && w.takes === 0).length) / Math.max(1, wars.length)),
    decisiveShareShortVsLong: (() => { const m = q(durs(wars), 0.5); const dec = (ws) => r1((100 * ws.filter((w) => w.how === 'capitulation' || w.how === 'conquest' || w.how === 'treaty').length) / Math.max(1, ws.length)); return { short: dec(wars.filter((w) => w.dur <= m)), long: dec(wars.filter((w) => w.dur > m)) }; })(),
    // 勝敗のついた戦争 (全面降伏・首都の陥落) の割合を、長さの中央値より短い戦争と長い戦争で比べる (Kreutz 2010: 勝敗は短い紛争に多い)
    victoryShareShortVsLong: (() => { const m = q(durs(wars), 0.5); const v = (ws) => r1((100 * ws.filter((w) => w.how === 'capitulation' || w.how === 'conquest').length) / Math.max(1, ws.length)); return { short: v(wars.filter((w) => w.dur <= m)), long: v(wars.filter((w) => w.dur > m)) }; })(),
    shareOfYearsAtWar: r1((100 * yearsAt.reduce((a, x) => a + x.war, 0)) / Math.max(1, yearsAt.reduce((a, x) => a + x.alive, 0))),
    exhaustionAtEnd: { median: r1(q(wars.map((w) => Math.max(w.exA, w.exB)), 0.5)) },
    player: {
      survived: `${last.length}/${rs.length}`,
      systems: r1(mean(last.map((m) => m.sys))), pop: Math.round(mean(last.map((m) => m.pop)) || 0), credits: Math.round(mean(last.map((m) => m.credits)) || 0),
      meanExhaustion: r1(mean(rs.flatMap((r) => r.series.map((s) => s.me?.ex).filter((x) => x !== undefined)))),
      wars: meWars.length, mix: mix(meWars), medianDuration: r1(q(durs(meWars), 0.5)),
    },
  };
}
console.log(JSON.stringify(out, null, 1));
