// 楽しさの目標のうち自動対戦で測るもの (F06・F16〜F19。targets/targets.json の版 12) の合否と、自動対戦で見つかった壊れ (B-069) の測り直し
// 決めた 6 つの戦略を遅れつきのボット (tools/strategy.js の humanize) にして、同じ銀河の組で終わりの年 (500 年) まで回す。
// 「何もしない」(観戦モードも首都の自動も切る) と、遅れなしの放任も回して、お金の貯まり方を並べる。
// 使い方: node tools/fun-targets.js [--src src/index.html] [--seeds 30] [--years 500] [--nations 6]  → Markdown を標準出力へ。結果の JSON は --out に
const fs = require('fs');
const S = require('./strategy');

const a = process.argv.slice(2);
const arg = (name, d) => { const i = a.indexOf(`--${name}`); return i >= 0 ? a[i + 1] : d; };
const src = arg('src');
const seeds = Array.from({ length: Number(arg('seeds', 30)) }, (_, i) => String(i + 1));
const years = Number(arg('years', 500));
const nations = Number(arg('nations', 6));
const names = Object.keys(S.PRESETS);
const mean = (xs) => (xs.length ? xs.reduce((k, x) => k + x, 0) / xs.length : NaN);
const q = (xs, p) => { const v = [...xs].sort((x, y) => x - y); return v.length ? v[Math.max(0, Math.ceil(p * v.length) - 1)] : NaN; };
const pc = (x) => `${Math.round(x * 100)}%`;
const ok = (b) => (b ? '合格' : '**不合格**');
const CH = { sixty: '60 星系', loyal: '独立を許さない', unify: '統一', far: '遠征 (40 光年)' };

(async () => {
  const t0 = Date.now();
  const extra = [['idle', '何もしない', S.EXTRA.idle.s], ['passive0', '放任 (遅れなし)', null]];
  const jobs = [...names.map((n) => S.humanize(S.PRESETS[n].s)), ...extra.map((e) => e[2])].flatMap((s) => seeds.map((seed) => ({ src, seed, years, nations, strategy: s })));
  const rs = await S.runAll(jobs);
  const part = (i) => rs.slice(i * seeds.length, (i + 1) * seeds.length);
  const by = Object.fromEntries(names.map((n, i) => [n, part(i)]));
  const ex = Object.fromEntries(extra.map((e, i) => [e[0], part(names.length + i)]));
  const all = names.flatMap((n) => by[n]);
  // F06・F17: 銀河ごとの 1 位
  const wins = Object.fromEntries(names.map((n) => [n, 0]));
  let dominant = 0;
  seeds.forEach((_, j) => {
    const row = names.map((n) => by[n][j]);
    let b = 0;
    row.forEach((r, i) => { if (r.score > row[b].score) b = i; });
    wins[names[b]]++;
    if (row.some((r, i) => row.every((o, k) => k === i || (r.systems > o.systems && r.pop > o.pop && r.credits > o.credits && r.alive >= o.alive)))) dominant++;
  });
  const over10 = names.filter((n) => wins[n] / seeds.length >= 0.1).length;
  const noWin = names.filter((n) => !wins[n]);
  const early = q(all.map((r) => r.early10), 0.5);
  const rate = Object.fromEntries(Object.keys(CH).map((k) => [k, mean(all.map((r) => r.challenges[k]))]));
  const story90 = q(all.map((r) => r.storyMax), 0.9);
  const out = [];
  out.push(`### 楽しさの目標 (自動対戦の分) と B-069 の測り直し (遅れつきのボット × 6 つの戦略 × ${seeds.length} の銀河 × ${years} 年 × ${nations ? `${nations} か国` : '地球だけ'})`);
  out.push('');
  out.push('| ID | 目標 | いまの値 | 合格の線 | 判定 |');
  out.push('|---|---|---|---|---|');
  out.push(`| F06 | 必勝法がない | 4 つの成績すべてで他を上回った戦略がいた銀河 ${dominant} / ${seeds.length}・10% 以上の銀河で 1 位の戦略 ${over10} | 0 の銀河・3 つ以上 | ${ok(dominant === 0 && over10 >= 3)} |`);
  out.push(`| F16 | 最初の 20 年の重大な出来事と判断 | 10 年に ${early.toFixed(1)} 件 (中央値) | 2 件以上 | ${ok(early >= 2)} |`);
  out.push(`| F17 | どの戦略にも勝つ銀河がある | 1 位の銀河がない戦略 ${noWin.length}${noWin.length ? ` (${noWin.map((n) => S.PRESETS[n].label).join('・')})` : ''} | 0 | ${ok(!noWin.length)} |`);
  out.push(`| F18 | 挑戦の達成率 | ${Object.entries(CH).map(([k, l]) => `${l} ${pc(rate[k])}`).join('・')} | どれも 10〜60% | ${ok(Object.values(rate).every((x) => x >= 0.1 && x <= 0.6))} |`);
  out.push(`| F19 | 出来事の繰り返し | 同じ語り手の出来事が 1 試合に来た回数の最大の 90% 点 ${story90} 回 | 2 回まで | ${ok(story90 <= 2)} |`);
  out.push('');
  out.push(`戦略ごとに 1 位の銀河: ${names.map((n) => `${S.PRESETS[n].label} ${wins[n]}`).join('・')}`);
  out.push('');
  out.push('#### 戦略ごとの成績');
  out.push('');
  out.push(`| 戦略 | 点数 | 星系 (終わり / 最大の 90% 点) | いちばん遠い星系 (光年、90% 点) | 独立を許した回数 | 資金 (cr) | ${Object.values(CH).join(' | ')} |`);
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  const row = (label, r) => `| ${label} | ${mean(r.map((x) => x.score)).toFixed(0)} | ${mean(r.map((x) => x.systems)).toFixed(1)} / ${q(r.map((x) => x.maxSystems), 0.9)} | ${q(r.map((x) => x.maxDist), 0.9).toFixed(1)} | ${mean(r.map((x) => x.indep)).toFixed(1)} | ${mean(r.map((x) => x.credits)).toFixed(0)} | ${Object.keys(CH).map((k) => pc(mean(r.map((x) => x.challenges[k])))).join(' | ')} |`;
  for (const n of names) out.push(row(`${S.PRESETS[n].label} (遅れつき)`, by[n]));
  for (const [k, l] of extra) out.push(row(l, ex[k]));
  out.push('');
  out.push('#### お金の推移 (自分の国の政府の資金、cr。銀河の平均)');
  out.push('');
  const ys = Object.keys(rs[0].creditsAt).map(Number);
  out.push(`| 戦略 | ${ys.map((y) => `${y} 年`).join(' | ')} |`);
  out.push(`|---|${ys.map(() => '---').join('|')}|`);
  for (const [l, r] of [...names.map((n) => [`${S.PRESETS[n].label} (遅れつき)`, by[n]]), ...extra.map(([k, l]) => [l, ex[k]])]) out.push(`| ${l} | ${ys.map((y) => mean(r.map((x) => x.creditsAt[y] ?? NaN)).toFixed(0)).join(' | ')} |`);
  out.push('');
  out.push(`(全体 ${((Date.now() - t0) / 60000).toFixed(1)} 分)`);
  console.log(out.join('\n'));
  if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify({ seeds, years, nations, wins, dominant, over10, early, rate, story90, runs: { ...by, ...ex } }));
})().catch((e) => { console.error(e); process.exit(1); });
