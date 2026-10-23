// 楽しさの目標のうち自動対戦で測るもの (F06・F16〜F19。targets/targets.json の版 12) の合否と、自動対戦で見つかった壊れ (B-069) の測り直し
// 決めた 6 つの戦略を遅れつきのボット (tools/strategy.js の humanize) にして、同じ銀河の組で終わりの年 (500 年) まで回す。
// 「何もしない」(観戦モードも首都の自動も切る) と、遅れなしの放任も回して、お金の貯まり方を並べる。
// 使い方: node tools/fun-targets.js [--src src/index.html] [--seeds 30] [--years 500] [--nations 6] [--with 探索の結果.json,…] [--no-extra]  → Markdown を標準出力へ。結果の JSON は --out に
//   --with = 必勝法を探す AI (tools/search.js --out) の最良の戦略を、F06 の判定に足す (つり合いの本番。回 DO5・B-066)。F17〜F19 は決めた 6 つの戦略だけで見る
//   --no-extra = 何もしない・遅れなしの放任を回さない
const fs = require('fs');
const S = require('./strategy');

const a = process.argv.slice(2);
const arg = (name, d) => { const i = a.indexOf(`--${name}`); return i >= 0 ? a[i + 1] : d; };
const src = arg('src');
const seeds = Array.from({ length: Number(arg('seeds', 30)) }, (_, i) => String(i + 1));
const years = Number(arg('years', 500));
const nations = Number(arg('nations', 6));
const presets = Object.keys(S.PRESETS);
// 必勝法を探す AI の最良 (--with)。探索の銀河と判定の銀河は分けて使う (探索の銀河に合わせただけの戦略を必勝法と見誤らないため)
const found = (arg('with') ? arg('with').split(',') : []).map((f, i) => { const r = JSON.parse(fs.readFileSync(f, 'utf8')); return [`found${i + 1}`, `探索の最良${arg('with').includes(',') ? ` ${i + 1}` : ''}`, r.best.s, r]; });
const names = [...presets, ...found.map((f) => f[0])];
const LABEL = { ...Object.fromEntries(presets.map((n) => [n, S.PRESETS[n].label])), ...Object.fromEntries(found.map((f) => [f[0], f[1]])) };
const STRAT = { ...Object.fromEntries(presets.map((n) => [n, S.PRESETS[n].s])), ...Object.fromEntries(found.map((f) => [f[0], f[2]])) };
const mean = (xs) => (xs.length ? xs.reduce((k, x) => k + x, 0) / xs.length : NaN);
const q = (xs, p) => { const v = [...xs].sort((x, y) => x - y); return v.length ? v[Math.max(0, Math.ceil(p * v.length) - 1)] : NaN; };
const pc = (x) => `${Math.round(x * 100)}%`;
const ok = (b) => (b ? '合格' : '**不合格**');
const CH = { sixty: '60 星系', loyal: '独立を許さない', unify: '統一', far: '遠征 (40 光年)' };

(async () => {
  const t0 = Date.now();
  const extra = a.includes('--no-extra') ? [] : [['idle', '何もしない', S.EXTRA.idle.s], ['passive0', '放任 (遅れなし)', null]];
  const jobs = [...names.map((n) => S.humanize(STRAT[n])), ...extra.map((e) => e[2])].flatMap((s) => seeds.map((seed) => ({ src, seed, years, nations, strategy: s })));
  const rs = await S.runAll(jobs);
  const part = (i) => rs.slice(i * seeds.length, (i + 1) * seeds.length);
  const by = Object.fromEntries(names.map((n, i) => [n, part(i)]));
  const ex = Object.fromEntries(extra.map((e, i) => [e[0], part(names.length + i)]));
  const all = presets.flatMap((n) => by[n]);
  // F06・F17: 銀河ごとの 1 位
  // F06 は探索の最良も入れた組で、F17 は決めた 6 つだけで数える
  const tally = (ns) => {
    const w = Object.fromEntries(ns.map((n) => [n, 0]));
    const dom = Object.fromEntries(ns.map((n) => [n, 0]));
    let d = 0;
    seeds.forEach((_, j) => {
      const row = ns.map((n) => by[n][j]);
      let b = 0;
      row.forEach((r, i) => { if (r.score > row[b].score) b = i; });
      w[ns[b]]++;
      const k0 = row.findIndex((r, i) => row.every((o, k) => k === i || (r.systems > o.systems && r.pop > o.pop && r.credits > o.credits && r.alive >= o.alive)));
      if (k0 >= 0) { d++; dom[ns[k0]]++; }
    });
    return { w, d, dom };
  };
  const { w: wins, d: dominant, dom } = tally(names);
  const { w: winsP } = tally(presets);
  const over10 = names.filter((n) => wins[n] / seeds.length >= 0.1).length;
  const noWin = presets.filter((n) => !winsP[n]);
  const early = q(all.map((r) => r.early10), 0.5);
  const rate = Object.fromEntries(Object.keys(CH).map((k) => [k, mean(all.map((r) => r.challenges[k]))]));
  const story90 = q(all.map((r) => r.storyMax), 0.9);
  const out = [];
  out.push(`### 楽しさの目標 (自動対戦の分) と B-069 の測り直し (遅れつきのボット × 6 つの戦略${found.length ? ` + 探索の最良 ${found.length}` : ''} × ${seeds.length} の銀河 × ${years} 年 × ${nations ? `${nations} か国` : '地球だけ'})`);
  out.push('');
  out.push('| ID | 目標 | いまの値 | 合格の線 | 判定 |');
  out.push('|---|---|---|---|---|');
  out.push(`| F06 | 必勝法がない | 4 つの成績すべてで他を上回った戦略がいた銀河 ${dominant} / ${seeds.length}${dominant ? ` (${names.filter((n) => dom[n]).map((n) => `${LABEL[n]} ${dom[n]}`).join('・')})` : ''}・10% 以上の銀河で 1 位の戦略 ${over10} | 0 の銀河・3 つ以上 | ${ok(dominant === 0 && over10 >= 3)} |`);
  out.push(`| F16 | 最初の 20 年の重大な出来事と判断 | 10 年に ${early.toFixed(1)} 件 (中央値) | 2 件以上 | ${ok(early >= 2)} |`);
  out.push(`| F17 | どの戦略にも勝つ銀河がある | 1 位の銀河がない戦略 ${noWin.length}${noWin.length ? ` (${noWin.map((n) => LABEL[n]).join('・')})` : ''} | 0 | ${ok(!noWin.length)} |`);
  out.push(`| F18 | 挑戦の達成率 | ${Object.entries(CH).map(([k, l]) => `${l} ${pc(rate[k])}`).join('・')} | どれも 10〜60% | ${ok(Object.values(rate).every((x) => x >= 0.1 && x <= 0.6))} |`);
  out.push(`| F19 | 出来事の繰り返し | 同じ語り手の出来事が 1 試合に来た回数の最大の 90% 点 ${story90} 回 | 2 回まで | ${ok(story90 <= 2)} |`);
  out.push('');
  out.push(`戦略ごとに 1 位の銀河 (F06 の組): ${names.map((n) => `${LABEL[n]} ${wins[n]}`).join('・')}`);
  if (found.length) out.push(`\n探索の最良の値: ${found.map((f) => `${f[1]} = \`${JSON.stringify(f[2])}\` (探索の銀河 ${f[3].seeds.join(',')}・${f[3].years} 年で放任から ${f[3].gain === null ? '—' : `${(100 * f[3].gain).toFixed(1)}%`})`).join('、')}`);
  out.push('');
  out.push('#### 戦略ごとの成績');
  out.push('');
  out.push(`| 戦略 | 点数 | 星系 (終わり / 最大の 90% 点) | いちばん遠い星系 (光年、90% 点) | 独立を許した回数 | 資金 (cr) | ${Object.values(CH).join(' | ')} |`);
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  const row = (label, r) => `| ${label} | ${mean(r.map((x) => x.score)).toFixed(0)} | ${mean(r.map((x) => x.systems)).toFixed(1)} / ${q(r.map((x) => x.maxSystems), 0.9)} | ${q(r.map((x) => x.maxDist), 0.9).toFixed(1)} | ${mean(r.map((x) => x.indep)).toFixed(1)} | ${mean(r.map((x) => x.credits)).toFixed(0)} | ${Object.keys(CH).map((k) => pc(mean(r.map((x) => x.challenges[k])))).join(' | ')} |`;
  for (const n of names) out.push(row(`${LABEL[n]} (遅れつき)`, by[n]));
  for (const [k, l] of extra) out.push(row(l, ex[k]));
  out.push('');
  out.push('#### お金の推移 (自分の国の政府の資金、cr。銀河の平均)');
  out.push('');
  const ys = Object.keys(rs[0].creditsAt).map(Number);
  out.push(`| 戦略 | ${ys.map((y) => `${y} 年`).join(' | ')} |`);
  out.push(`|---|${ys.map(() => '---').join('|')}|`);
  for (const [l, r] of [...names.map((n) => [`${LABEL[n]} (遅れつき)`, by[n]]), ...extra.map(([k, l]) => [l, ex[k]])]) out.push(`| ${l} | ${ys.map((y) => mean(r.map((x) => x.creditsAt[y] ?? NaN)).toFixed(0)).join(' | ')} |`);
  out.push('');
  out.push(`(全体 ${((Date.now() - t0) / 60000).toFixed(1)} 分)`);
  console.log(out.join('\n'));
  if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify({ seeds, years, nations, wins, dominant, over10, early, rate, story90, runs: { ...by, ...ex } }));
})().catch((e) => { console.error(e); process.exit(1); });
