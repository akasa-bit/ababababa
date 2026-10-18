// 離反の自動対戦 (tools/secession.js) の結果を集計する: 主従の結びつきの存続年数の中央値 (Kaplan–Meier。独立を出来事、ほかの終わり方は打ち切り)、
// 統治体制ごとの独立の起きやすさ。歴史の植民地 (data/derived/history.json の中央値) と比べる
// 使い方: node tools/secession-analyze.js <outdir>
const fs = require('fs');
const dir = process.argv[2];
const T = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) T.push(...JSON.parse(fs.readFileSync(`${dir}/${f}`)).ties);
function km(ts) {
  const ev = ts.map((t) => ({ d: t.dur, e: t.how === 'independence' })).sort((a, b) => a.d - b.d);
  let S = 1, n = ev.length, median = null;
  for (const x of ev) { if (x.e) { S *= 1 - 1 / n; if (S <= 0.5 && median === null) median = x.d; } n--; }
  return { n: ts.length, survival_end: +S.toFixed(3), median: median === null ? null : +median.toFixed(1) };
}
const rate = (ts) => { const y = ts.reduce((k, t) => k + t.dur, 0); return y ? +(100 * ts.filter((t) => t.how === 'independence').length / y).toFixed(3) : 0; };
const out = { ties: T.length, independence: T.filter((t) => t.how === 'independence').length, all: { ...km(T), per100: rate(T) }, byRegime: {} };
for (const r of [...new Set(T.map((t) => t.regime))]) { const ts = T.filter((t) => t.regime === r); out.byRegime[r] = { ...km(ts), per100: rate(ts) }; }
for (const [k, f] of [['near<20ly', (t) => t.dCap < 20], ['far>=20ly', (t) => t.dCap >= 20]]) out[k] = { ...km(T.filter(f)), per100: rate(T.filter(f)) };
console.log(JSON.stringify(out, null, 1));
