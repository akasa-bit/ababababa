// 試合の処理の速さを、いまの src と git の参照 (既定は origin/main) で比べる。同じシード・同じ手順で回し、時間と、節目ごとの状態の要約 (hash) が
// 1 ビットも同じかを並べる。処理を速くする変更は、試合の筋を変えずに (hash が同じまま) 速くなったかをこれで確かめる (docs/content.md の 4)
// 使い方: node tools/bench.js [--ref <git の参照>] [--seeds 1,2,3] [--years 300] [--nations 6] [--reps 2] [--canon]
//   時間は reps 回のうち速いほう (Node の JIT の揺れが 1 割ほどあるので)。画面なしの版 (tools/headless.js) で回す
//   --canon: セーブの物の鍵を並べ替えてから要約を作る (セーブの JSON の鍵の並びを変える変更のとき。中身が同じなら「同じ」)。
//            2026-10-26 の政府の形の変更 (GOV_FIELDS) より前の版と比べるときは、これを付ける
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./headless');
const { assemble } = require('./src');

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const ref = arg('--ref', 'origin/main'), seeds = arg('--seeds', '1,2,3').split(','), years = Number(arg('--years', 300));
const nations = Number(arg('--nations', 6)), reps = Number(arg('--reps', 2)), every = Math.max(1, Math.round(years / 4));
const CANON = process.argv.includes('--canon');
// 鍵を並べ替えた JSON の要約 (FNV-1a。Net.hash と同じ作り方)
const canonHash = (sim, g) => {
  const d = { ...sim.buildSave(g) };
  delete d.savedAt;
  const t = JSON.stringify(d, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
};
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nlu-bench-')), 'ref-src.html');
fs.writeFileSync(tmp, assemble({ ref }));
const sims = { [ref]: H.load({ src: tmp, edition: 'game' }), いま: H.load({ edition: 'game' }) };

// 1 つの試合を回して、時間 [ms] と節目ごとの hash
function run(sim, seed) {
  const g = sim.newGame(seed, { nations });
  const hashes = [];
  let ms = 0;
  for (let y = 0; y < years; y += every) {
    const n = Math.min(every, years - y), t0 = performance.now();
    sim.run(g, n);
    ms += performance.now() - t0;
    hashes.push(CANON ? canonHash(sim, g) : sim.hash(g));
  }
  return { ms, hashes };
}
const tot = { [ref]: 0, いま: 0 };
let same = true;
console.log(`| シード | ${ref} [ms] | いま [ms] | 速さの比 | 試合の筋 (節目ごとの hash) |`);
console.log('|---|---|---|---|---|');
for (const seed of seeds) {
  const r = {};
  for (const k of Object.keys(sims)) {
    let best = null;
    for (let i = 0; i < reps; i++) { const x = run(sims[k], seed); if (!best || x.ms < best.ms) best = x; }
    r[k] = best; tot[k] += best.ms;
  }
  const eq = JSON.stringify(r[ref].hashes) === JSON.stringify(r.いま.hashes);
  if (!eq) same = false;
  console.log(`| ${seed} | ${Math.round(r[ref].ms)} | ${Math.round(r.いま.ms)} | ×${(r[ref].ms / r.いま.ms).toFixed(2)} | ${eq ? '同じ' : `**違う** (${r[ref].hashes.join(',')} → ${r.いま.hashes.join(',')})`} |`);
}
console.log(`| 合計 | ${Math.round(tot[ref])} | ${Math.round(tot.いま)} | ×${(tot[ref] / tot.いま).toFixed(2)} | ${same ? '同じ' : '**違う**'} |`);
console.log(`\n${nations} か国・${years} 年・シード ${seeds.join(',')}。時間は ${reps} 回のうち速いほう${CANON ? '。hash は鍵を並べ替えた中身で比べた (--canon)' : ''}`);
