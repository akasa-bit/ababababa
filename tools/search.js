// 必勝法を探す AI: 戦略の値 (tools/strategy.js の SPACE) を変えて、プレイヤーの国の点数 (score) を上げる戦略を探す (段 12 の最小版)
// 探し方: 無作為に候補を出し (予算の半分)、いちばん良いものから 1 つずつ値を変えて山登りする (残りの半分)。同じ銀河の組で比べる。
// 「放任」(いまの観戦の AI) に比べて点数がどれだけ上がったかを出す。大きいほど、必勝法の気配がある (F06 の判定はセッション 15)。
// 使い方 (コマンド): node tools/search.js [--src src/index.html] [--seeds 1,2,3,4] [--years 150] [--nations 6] [--budget 40] [--rng 1] [--delay] [--every 1] [--out 結果.json]
//   --delay = 人間に近い遅れつきのボットで回す (tools/strategy.js の humanize。放任も遅れつき)
//   → 進み具合を標準エラーへ、結果 (最良の戦略・放任との差・4 つの成績) を JSON で標準出力へ
// 使い方 (ほかの道具から): const r = await require('./search').search({ src, seeds, years, nations, budget });
const fs = require('fs');
const S = require('./strategy');

// 決まった乱数 (探索の候補の選び方。試合の乱数とは別)
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rnd, xs) => xs[Math.floor(rnd() * xs.length)];
const key = (s) => JSON.stringify(s);
const mean = (xs) => xs.reduce((k, x) => k + x, 0) / xs.length;

// 戦略を銀河の組で回して、成績をまとめる
// human を渡すと、どの戦略も (放任 = null も) 遅れつきのボットにする
async function evaluate(list, { src, seeds, years, nations, human = null }) {
  const jobs = list.flatMap((s) => seeds.map((seed) => ({ src, seed, years, nations, strategy: human ? S.humanize(s, human) : s })));
  const rs = await S.runAll(jobs);
  return list.map((s, i) => {
    const r = rs.slice(i * seeds.length, (i + 1) * seeds.length);
    return { s, score: mean(r.map((x) => x.score)), systems: mean(r.map((x) => x.systems)), pop: mean(r.map((x) => x.pop)), credits: mean(r.map((x) => x.credits)), alive: mean(r.map((x) => x.alive)), runs: r };
  });
}

async function search({ src, seeds = ['1', '2', '3', '4'], years = 150, nations = 6, budget = 40, rng = 1, human = null, log = () => {} } = {}) {
  const opt = { src, seeds: seeds.map(String), years, nations, human };
  const rnd = mulberry(rng);
  const seen = new Map();
  const tried = [];
  const run = async (list) => {
    const fresh = list.filter((s) => !seen.has(key(s)));
    for (const e of await evaluate(fresh, opt)) { seen.set(key(e.s), e); tried.push(e); }
    return list.map((s) => seen.get(key(s)));
  };
  const [passive] = await evaluate([null], opt);
  log(`放任: ${passive.score.toFixed(1)}`);
  // 1. 無作為の候補 (観戦の AI と同じ値も入れる)
  const nRandom = Math.max(1, Math.floor(budget / 2));
  const first = [S.BASE];
  while (first.length < nRandom) first.push(Object.fromEntries(Object.entries(S.SPACE).map(([k, xs]) => [k, pick(rnd, xs)])));
  await run(first);
  let best = tried.reduce((a, b) => (b.score > a.score ? b : a));
  log(`無作為 ${first.length} 個: 最良 ${best.score.toFixed(1)}`);
  // 2. 山登り: 1 つの値を隣の候補か無作為の候補に変え、良くなれば進む
  let left = budget - first.length;
  while (left > 0) {
    const ks = Object.keys(S.SPACE);
    const batch = [];
    for (let i = 0; i < Math.min(left, 4); i++) {
      const k = pick(rnd, ks), xs = S.SPACE[k], j = xs.indexOf(best.s[k]);
      const v = rnd() < 0.5 && j >= 0 ? xs[Math.max(0, Math.min(xs.length - 1, j + (rnd() < 0.5 ? -1 : 1)))] : pick(rnd, xs);
      const s = { ...best.s, [k]: v };
      if (!seen.has(key(s)) && !batch.some((b) => key(b) === key(s))) batch.push(s);
    }
    left -= Math.max(1, batch.length);
    if (!batch.length) continue;
    for (const e of await run(batch)) if (e.score > best.score) best = e;
    log(`山登り: 最良 ${best.score.toFixed(1)} (残り ${Math.max(0, left)})`);
  }
  const gain = passive.score ? (best.score - passive.score) / Math.abs(passive.score) : null;
  const strip = ({ runs, ...e }) => e;
  return {
    seeds: opt.seeds, years, nations, budget, tried: tried.length,
    passive: strip(passive), best: strip(best), gain,
    // 最良の戦略が、銀河ごとに放任を上回ったか
    wins: best.runs.filter((r, i) => r.score > passive.runs[i].score).length,
    // 最良の戦略が、4 つの成績 (星系・人口・資金・生き残り) のすべてで放任を下回らなかったか
    dominates: best.systems >= passive.systems && best.pop >= passive.pop && best.credits >= passive.credits && best.alive >= passive.alive,
    // 観戦の AI と同じ値の戦略が、放任と同じ筋になった銀河の数 (違えば、観戦の AI が変わったので strategy.js の earthWarYearly を合わせ直す)
    baseSame: seen.get(key(S.BASE)).runs.filter((r, i) => r.hash === passive.runs[i].hash).length,
    top: [...tried].sort((a, b) => b.score - a.score).slice(0, 5).map(strip),
  };
}

module.exports = { search, evaluate };

if (require.main === module) {
  const a = process.argv.slice(2);
  const arg = (name, d) => { const i = a.indexOf(`--${name}`); return i >= 0 ? a[i + 1] : d; };
  search({
    src: arg('src'), seeds: arg('seeds', '1,2,3,4').split(','), years: Number(arg('years', 150)), nations: Number(arg('nations', 6)),
    budget: Number(arg('budget', 40)), rng: Number(arg('rng', 1)), human: a.includes('--delay') ? { ...S.HUMAN, every: Number(arg('every', 1)) } : null, log: (m) => process.stderr.write(`${m}\n`),
  }).then((r) => {
    const t = JSON.stringify(r, null, 1);
    if (arg('out')) fs.writeFileSync(arg('out'), t);
    console.log(t);
  }).catch((e) => { console.error(e); process.exit(1); });
}
