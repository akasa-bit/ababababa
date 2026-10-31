// CI の報告 (面白さの代わりの数): main (比べる元) と PR の版で、決めた 6 つの戦略を同じ銀河で回し、面白さの代わりの数を表 (Markdown) にする。
// 必勝法を探す AI の小さな探索は、PR の版だけで回す。合否は付けない (F06 の判定はセッション 15)。数の選び方は docs/fun.md
// 使い方: node tools/fun-report.js <比べる元の src/index.html> <PR の src/index.html> [銀河の数] [年数] [国の数] [探索の予算] [探索の銀河の数]  → Markdown を標準出力へ
//   --part k/K   銀河を K 個に分けた k 番目だけを回し、結果を JSON で書く (--json のファイルか標準出力)。探索は 1 番目だけが回す (回 DO8・B-224。CI は 3 つの実行機で 24 銀河)
//   --seeds a-b  銀河の番号を a〜b にする (銀河の数の代わり。止める線の幅を main の別の銀河の組で測るとき)
//   --merge <part の JSON>...   分けて回した結果を 1 つの表にする (CI の最後のジョブ)
//   比べる元と PR が同じファイルなら、1 回だけ回して両方に使う (main どうしの測り)
// 止める線 (STOP。docs/parallel.md の 4 の 3): main より大きく悪くなった数があれば、表に出し、FUN_GATE_OUT のファイルに 1 行ずつ書く (CI はそれを見て、
// PR の本文に「面白さの数が悪くなった理由:」がなければ失敗にする)
const S = require('./strategy');
const fs = require('fs');

const names = Object.keys(S.PRESETS);
const mean = (xs) => (xs.length ? xs.reduce((k, x) => k + x, 0) / xs.length : NaN);
const variance = (xs) => { const m = mean(xs); return mean(xs.map((x) => (x - m) ** 2)); };
// 止める線: [名前, (main, この PR, 探索) → 越えたか, 線の説明]。main と同じ銀河・同じ戦略で比べる (ゲームを変えない PR は差が 0 になる)。
// 探索の上積みは PR の版だけで回していて main と比べられないので、線にしない (表には出す)。
// 線の値は 24 銀河の main を別の銀河の組 (1〜24・25〜48・49〜72) で回したときの揺れより大きくしてある (docs/fun.md の 12.1)
const STOP = [
  ['判断を求められる回数', (a, b) => b.asks < 0.75 * a.asks, 'main より 25% 以上減る'],
  ['待つだけの年の割合', (a, b) => b.quiet - a.quiet >= 0.1, 'main より 10 点以上増える'],
  ['いちばん多く勝った戦略の割合', (a, b) => b.topShare >= 0.75 && b.topShare > a.topShare, '75% 以上になり、main より増える'],
  ['10% 以上の銀河で勝った戦略の数', (a, b) => b.over10 < 2 && b.over10 < a.over10, '2 より少なくなり、main より減る'],
  ['4 つの成績すべてで他を上回った戦略がいた銀河', (a, b) => b.dominant >= 2 && b.dominant > a.dominant, '2 以上になり、main より増える'],
  ['観戦の AI と同じ値の戦略が放任と同じ筋', (a, b, sr) => !!sr && sr.baseSame < sr.seeds.length, 'すべての銀河で同じでない (tools/strategy.js を合わせ直す)'],
];
// JSON に残す 1 試合の値 (measure と表が使うものだけ)
const KEEP = ['seed', 'score', 'systems', 'pop', 'credits', 'alive', 'asksPer100', 'quietShare', 'longestQuiet', 'reversal', 'ms', 'hash'];
const slim = (r) => Object.fromEntries(KEEP.map((k) => [k, r[k]]));

// 6 つの戦略 × 銀河の結果から、数をまとめる。by = { 戦略: [銀河の順の結果] }
function measure(by, seeds) {
  const all = names.flatMap((n) => by[n]);
  // 3. 銀河ごとに点数がいちばん良かった戦略 (同点は先の戦略)
  const wins = Object.fromEntries(names.map((n) => [n, 0]));
  let dominant = 0; // 4 つの成績 (星系・人口・資金・生き残り) のすべてで、ほかの戦略をすべて上回った (生き残りは下回らない) 戦略がいた銀河
  seeds.forEach((_, j) => {
    const row = names.map((n) => by[n][j]);
    let b = 0;
    row.forEach((r, i) => { if (r.score > row[b].score) b = i; });
    wins[names[b]]++;
    if (row.some((r, i) => row.every((o, k) => k === i || (r.systems > o.systems && r.pop > o.pop && r.credits > o.credits && r.alive >= o.alive)))) dominant++;
  });
  const shares = names.map((n) => wins[n] / seeds.length);
  const top = names[shares.indexOf(Math.max(...shares))];
  // 6. 選ぶ意味の大きさ: 戦略ごとの平均点のばらつき ÷ 銀河ごとの平均点のばらつき
  const stratVar = variance(names.map((n) => mean(by[n].map((r) => r.score))));
  const galVar = variance(seeds.map((_, j) => mean(names.map((n) => by[n][j].score))));
  const rev = all.map((r) => r.reversal).filter((x) => x !== null);
  return {
    asks: mean(all.map((r) => r.asksPer100)), quiet: mean(all.map((r) => r.quietShare)), longest: Math.max(...all.map((r) => r.longestQuiet)),
    topShare: Math.max(...shares), topName: S.PRESETS[top].label, over10: shares.filter((x) => x >= 0.1).length, dominant,
    reversal: mean(rev), choice: galVar ? stratVar / galVar : NaN, wins, ms: mean(all.map((r) => r.ms)),
  };
}

// 1 つの実行機の分を回す → { seeds, years, nations, base, head, search, min }
async function runPart({ baseSrc, headSrc, seeds, years, nations, budget, searchSeeds }) {
  const t0 = Date.now();
  const jobs = (src) => names.flatMap((n) => seeds.map((seed) => ({ src, seed, years, nations, strategy: S.PRESETS[n].s })));
  const split = (rs) => Object.fromEntries(names.map((n, i) => [n, rs.slice(i * seeds.length, (i + 1) * seeds.length).map(slim)]));
  const same = baseSrc === headSrc;
  const [rb, rh] = same ? await S.runAll(jobs(baseSrc)).then((r) => [r, r]) : await Promise.all([S.runAll(jobs(baseSrc)), S.runAll(jobs(headSrc))]);
  let sr = null;
  if (searchSeeds.length) {
    const { search } = require('./search');
    sr = await search({ src: headSrc, seeds: searchSeeds, years, nations, budget });
    delete sr.top;
  }
  return { seeds, years, nations, base: split(rb), head: split(rh), search: sr, min: (Date.now() - t0) / 60000 };
}

// 分けた結果をつなぐ (銀河の番号の順)
function joinParts(parts) {
  const seeds = parts.flatMap((p) => p.seeds);
  const order = seeds.map((s, i) => [s, i]).sort((x, y) => Number(x[0]) - Number(y[0]) || x[1] - y[1]).map(([, i]) => i);
  const cat = (k) => Object.fromEntries(names.map((n) => { const xs = parts.flatMap((p) => p[k][n]); return [n, order.map((i) => xs[i])]; }));
  return {
    seeds: order.map((i) => seeds[i]), years: parts[0].years, nations: parts[0].nations, base: cat('base'), head: cat('head'),
    search: parts.map((p) => p.search).find(Boolean) || null, min: Math.max(...parts.map((p) => p.min)), parts: parts.length,
  };
}

function report({ seeds, years, nations, base, head, search: sr, min, parts }) {
  const a = measure(base, seeds), b = measure(head, seeds);
  const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—');
  const pc = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  const diff = (x, y, f) => (Number.isFinite(x) && Number.isFinite(y) ? (Math.abs(y - x) < 1e-9 ? '±0' : `${y > x ? '+' : '−'}${f(Math.abs(y - x))}`) : '—');
  const ROWS = [
    ['1. 判断を求められる回数 (100 年あたり)', 'asks', f1],
    ['2. 待つだけの年の割合', 'quiet', pc],
    ['2. 待つだけの年が続いた最長 (年)', 'longest', (x) => String(x)],
    ['3. いちばん多く勝った戦略の割合', 'topShare', pc, (m) => ` (${m.topName})`],
    ['3. 10% 以上の銀河で勝った戦略の数', 'over10', (x) => String(x)],
    ['3. 4 つの成績すべてで他を上回った戦略がいた銀河', 'dominant', (x) => `${x} / ${seeds.length}`],
    ['5. 逆転した銀河の割合 (50 年目と終わりで 1 位の国が違う)', 'reversal', pc],
    ['6. 選ぶ意味の大きさ (戦略の差 ÷ 銀河の差)', 'choice', f2],
  ];
  const out = [];
  out.push(`### 面白さの代わりの数 (画面なしの版。6 つの戦略 × ${seeds.length} の銀河 × ${years} 年 × ${nations} か国。合否は付けない)`);
  out.push('');
  out.push('| 数 | main | この PR | 差 |');
  out.push('|---|---|---|---|');
  for (const [label, k, f, extra] of ROWS) {
    const d = k === 'longest' || k === 'over10' || k === 'dominant' ? diff(a[k], b[k], (x) => String(x)) : k === 'quiet' || k === 'topShare' || k === 'reversal' ? diff(a[k] * 100, b[k] * 100, (x) => `${Math.round(x)} 点`) : diff(a[k], b[k], f);
    out.push(`| ${label} | ${f(a[k])}${extra ? extra(a) : ''} | ${f(b[k])}${extra ? extra(b) : ''} | ${d} |`);
  }
  out.push('');
  out.push(`戦略ごとに勝った銀河の数 (この PR): ${names.map((n) => `${S.PRESETS[n].label} ${b.wins[n]}`).join('・')}`);
  const sameHash = seeds.filter((_, j) => names.every((n) => base[n][j].hash === head[n][j].hash)).length;
  out.push('');
  out.push(`6 つの戦略のすべてで試合の筋が main と同じだった銀河: ${sameHash} / ${seeds.length}`);
  out.push('');
  if (sr) {
    out.push(`#### 4. 必勝法を探す AI (この PR の版。候補 ${sr.tried} 個 × ${sr.seeds.length} の銀河 × ${years} 年)`);
    out.push('');
    out.push('| | 点数 | 星系 | 人口 (百万人) | 資金 (cr) | 生き残り |');
    out.push('|---|---|---|---|---|---|');
    for (const [label, e] of [['放任 (いまの観戦の AI)', sr.passive], ['見つかった最良の戦略', sr.best]]) out.push(`| ${label} | ${f1(e.score)} | ${f1(e.systems)} | ${e.pop.toFixed(0)} | ${e.credits.toFixed(0)} | ${pc(e.alive)} |`);
    out.push('');
    out.push(`- 放任からの上積み: **${sr.gain === null ? '—' : `${sr.gain >= 0 ? '+' : '−'}${Math.abs(Math.round(sr.gain * 1000) / 10)}%`}** (放任を上回った銀河 ${sr.wins} / ${sr.seeds.length}。4 つの成績のすべてで放任を下回らない: ${sr.dominates ? 'はい' : 'いいえ'})`);
    out.push(`- 最良の戦略の値: \`${JSON.stringify(sr.best.s)}\``);
    out.push(`- 観戦の AI と同じ値の戦略が放任と同じ筋になった銀河: ${sr.baseSame} / ${sr.seeds.length}${sr.baseSame < sr.seeds.length ? ' (**観戦の AI が変わった。tools/strategy.js の earthWarYearly を合わせ直す**)' : ''}`);
    out.push('');
  }
  const crossed = STOP.filter(([, f]) => f(a, b, sr));
  out.push(`#### 止める線 (docs/parallel.md の 4 の 3): ${crossed.length ? `**${crossed.length} 件を越えた**` : '越えていない'}`);
  out.push('');
  out.push('| 数 | 止める線 | 結果 |');
  out.push('|---|---|---|');
  for (const [label, f, line] of STOP) out.push(`| ${label} | ${line} | ${f(a, b, sr) ? '**越えた**' : '—'} |`);
  if (crossed.length) { out.push(''); out.push('越えたときは、PR の本文に「面白さの数が悪くなった理由:」の行を書き、CI のジョブを回し直すか次にプッシュする (本文はそのときに読み直す)。'); }
  if (process.env.FUN_GATE_OUT) fs.writeFileSync(process.env.FUN_GATE_OUT, crossed.map(([label, , line]) => `${label}: ${line}`).join('\n'));
  out.push('');
  out.push(`(1 試合の平均 ${(b.ms / 1000).toFixed(1)} 秒・${parts > 1 ? `${parts} つの実行機のうち長いもので` : '全体'} ${min.toFixed(1)} 分)`);
  return { text: out.join('\n'), main: a, head: b };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
    if (args[0] === '--merge') {
      const parts = args.slice(1).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
      if (!parts.length) throw new Error('--merge に part の JSON がない');
      console.log(report(joinParts(parts)).text);
      return;
    }
    const partS = opt('--part'), jsonOut = opt('--json'), seedsS = opt('--seeds');
    const [baseSrc, headSrc, nS = '8', yS = '150', natS = '6', budS = '12', snS = '4'] = args;
    let seeds = Array.from({ length: Number(nS) }, (_, i) => String(i + 1));
    if (seedsS) { const [lo, hi] = seedsS.split('-').map(Number); seeds = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)); }
    let searchSeeds = Array.from({ length: Number(snS) }, (_, i) => String(i + 1));
    if (partS) {
      const [k, K] = partS.split('/').map(Number);
      const per = Math.ceil(seeds.length / K);
      seeds = seeds.slice((k - 1) * per, k * per);
      if (k !== 1) searchSeeds = [];
    }
    const res = await runPart({ baseSrc, headSrc, seeds, years: Number(yS), nations: Number(natS), budget: Number(budS), searchSeeds });
    if (partS || jsonOut) {
      const text = JSON.stringify(res);
      if (jsonOut) fs.writeFileSync(jsonOut, text); else console.log(text);
      return;
    }
    console.log(report({ ...res, parts: 1 }).text);
  })().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { measure, joinParts, report, STOP };
