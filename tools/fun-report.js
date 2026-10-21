// CI の報告 (面白さの代わりの数): main (比べる元) と PR の版で、決めた 6 つの戦略を同じ銀河で回し、面白さの代わりの数を表 (Markdown) にする。
// 必勝法を探す AI の小さな探索は、PR の版だけで回す。合否は付けない (F06 の判定はセッション 15)。数の選び方は docs/fun.md
// 使い方: node tools/fun-report.js <比べる元の src/index.html> <PR の src/index.html> [銀河の数] [年数] [国の数] [探索の予算] [探索の銀河の数]  → Markdown を標準出力へ
const S = require('./strategy');
const { search } = require('./search');

const [baseSrc, headSrc, nS = '8', yS = '150', natS = '6', budS = '12', snS = '4'] = process.argv.slice(2);
const seeds = Array.from({ length: Number(nS) }, (_, i) => String(i + 1));
const years = Number(yS), nations = Number(natS);
const names = Object.keys(S.PRESETS);
const mean = (xs) => (xs.length ? xs.reduce((k, x) => k + x, 0) / xs.length : NaN);
const variance = (xs) => { const m = mean(xs); return mean(xs.map((x) => (x - m) ** 2)); };

// 6 つの戦略 × 銀河の結果から、数をまとめる
function measure(rs) {
  const by = Object.fromEntries(names.map((n, i) => [n, rs.slice(i * seeds.length, (i + 1) * seeds.length)]));
  const all = rs;
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

(async () => {
  const jobs = (src) => names.flatMap((n) => seeds.map((seed) => ({ src, seed, years, nations, strategy: S.PRESETS[n].s })));
  const t0 = Date.now();
  const [rb, rh] = await Promise.all([S.runAll(jobs(baseSrc)), S.runAll(jobs(headSrc))]);
  const a = measure(rb), b = measure(rh);
  const sr = await search({ src: headSrc, seeds: Array.from({ length: Number(snS) }, (_, i) => String(i + 1)), years, nations, budget: Number(budS) });

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
  out.push('');
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
  out.push(`(1 試合の平均 ${(b.ms / 1000).toFixed(1)} 秒・全体 ${((Date.now() - t0) / 60000).toFixed(1)} 分)`);
  console.log(out.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
