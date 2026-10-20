// CI の報告: 画面なしの版で、main (比べる元) と PR の版を同じシードで回し、試合の大きな数を表 (Markdown) にする。
// 使い方: node tools/ci-report.js <比べる元の src/index.html> <PR の src/index.html> [シードの数] [年数] [国の数]  → Markdown を標準出力へ
// 遊びの釣り合いが知らないうちに大きく動いていないかを、PR ごとに見るためのもの (合否は付けない)
const H = require('./headless');

const [baseSrc, headSrc, nS = '8', yS = '150', natS = '6'] = process.argv.slice(2);
const seeds = Array.from({ length: Number(nS) }, (_, i) => String(i + 1));
const years = Number(yS), nations = Number(natS);

// 1 試合を回し、年ごとに数を集める (戦争の始まり・独立は、関数を包んで数える。試合の結果は変えない)
function play(sim, seed) {
  const g = sim.newGame(seed, { nations });
  let warsBegun = 0, independences = 0;
  const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = (...a) => { fn(...a); return orig(...a); }; };
  if (typeof g.beginWar === 'function') wrap('beginWar', () => warsBegun++);
  if (typeof g.declareIndependence === 'function') wrap('declareIndependence', () => independences++);
  const t0 = Date.now();
  sim.run(g, years);
  const s = H.summary(g);
  const credits = Object.values(g.govs).reduce((k, v) => k + (v.credits || 0), 0);
  return { ...s, warsBegun, independences, credits, ms: Date.now() - t0, hash: sim.hash(g) };
}

function stats(xs) {
  const v = [...xs].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return { mean: v.reduce((k, x) => k + x, 0) / v.length, p10: q(0.1), p90: q(0.9) };
}

const fmt = (x) => (Math.abs(x) >= 1e4 ? x.toExponential(2) : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));

const runs = {};
for (const [name, src] of [['base', baseSrc], ['head', headSrc]]) {
  const sim = H.load({ src });
  runs[name] = seeds.map((s) => play(sim, s));
}

const ROWS = [
  ['colonies', '入植地の数'], ['systems', '入植した星系'], ['realms', '国の数 (独立した国を含む)'], ['pop', '総人口'],
  ['warsBegun', '始まった戦争'], ['wars', '終わりの年に続いている戦争'], ['independences', '独立'], ['credits', '政府の資金の合計 (cr)'], ['ms', '1 試合の時間 (ミリ秒)'],
];
const out = [];
out.push(`### 自動対戦 (画面なしの版。${seeds.length} の銀河 × ${years} 年 × ${nations} か国、観戦)`);
out.push('');
out.push('| 数 | main の平均 (10%〜90%) | この PR の平均 (10%〜90%) | 差 |');
out.push('|---|---|---|---|');
for (const [k, label] of ROWS) {
  const a = stats(runs.base.map((r) => r[k])), b = stats(runs.head.map((r) => r[k]));
  const pct = a.mean ? Math.round(((b.mean - a.mean) / Math.abs(a.mean)) * 100) : null;
  const d = pct === null ? '—' : pct === 0 ? '±0%' : `${pct > 0 ? '+' : ''}${pct}%`;
  out.push(`| ${label} | ${fmt(a.mean)} (${fmt(a.p10)}〜${fmt(a.p90)}) | ${fmt(b.mean)} (${fmt(b.p10)}〜${fmt(b.p90)}) | ${d} |`);
}
const same = runs.base.filter((r, i) => r.hash === runs.head[i].hash).length;
out.push('');
out.push(`試合の筋が main と同じだった銀河: ${same} / ${seeds.length} (状態の要約が一致)`);
console.log(out.join('\n'));
