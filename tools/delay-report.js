// 拡張の一強を、人間に近い遅れつきのボットで測り直す表 (B-068・QD-12 = c)。docs/fun.md の 6
// 決めた 6 つの戦略と「入植の間隔なし」(tools/strategy.js の EXTRA) を、光の遅れなし (いまの観戦の AI と同じ見え方) と遅れつきの 2 通りで、
// 同じ銀河の組で回し、銀河ごとに点数が 1 位の戦略を数える。試合の形 (国家選択のある試合・地球だけの試合) ごとに並べる。
// --budget を渡すと、必勝法を探す AI (入植・交易・統治体制の値を含む) も遅れつきのボットで回す。
// 使い方: node tools/delay-report.js [--src src/index.html] [--seeds 16] [--years 150] [--forms 6,0] [--every 1] [--budget 0] [--search-seeds 4]  → Markdown を標準出力へ
const S = require('./strategy');
const { search } = require('./search');

const a = process.argv.slice(2);
const arg = (name, d) => { const i = a.indexOf(`--${name}`); return i >= 0 ? a[i + 1] : d; };
const src = arg('src');
const seeds = Array.from({ length: Number(arg('seeds', 16)) }, (_, i) => String(i + 1));
const years = Number(arg('years', 150));
const forms = arg('forms', '6,0').split(',').map(Number);
const human = { ...S.HUMAN, every: Number(arg('every', S.HUMAN.every)) };
const budget = Number(arg('budget', 0));
const searchSeeds = Array.from({ length: Number(arg('search-seeds', 4)) }, (_, i) => String(i + 1));

const STRATS = { ...S.PRESETS, ...S.EXTRA };
const names = Object.keys(STRATS);
const EXPAND = new Set(['expand', 'rush']); // 拡張に寄せた戦略
const MODES = [['遅れなし', (s) => s], ['遅れつき', (s) => S.humanize(s, human)]];
const mean = (xs) => (xs.length ? xs.reduce((k, x) => k + x, 0) / xs.length : NaN);
const formName = (n) => (n ? `国家選択 ${n} か国` : '地球だけ');

(async () => {
  const t0 = Date.now();
  const out = [];
  const verdict = [];
  out.push(`### 拡張の一強を、遅れつきのボットで測り直す (${seeds.length} の銀河 × ${years} 年。遅れつき = 光が首都に届いた知らせだけで判断・${human.every} 年に 1 回)`);
  for (const nations of forms) {
    const res = {};
    for (const [mode, f] of MODES) {
      const jobs = names.flatMap((n) => seeds.map((seed) => ({ src, seed, years, nations, strategy: f(STRATS[n].s) })));
      const rs = await S.runAll(jobs);
      const by = Object.fromEntries(names.map((n, i) => [n, rs.slice(i * seeds.length, (i + 1) * seeds.length)]));
      const wins = Object.fromEntries(names.map((n) => [n, 0]));
      seeds.forEach((_, j) => { let b = names[0]; for (const n of names) if (by[n][j].score > by[b][j].score) b = n; wins[b]++; });
      res[mode] = { by, wins };
    }
    out.push('');
    out.push(`#### ${formName(nations)}`);
    out.push('');
    out.push('| 戦略 | 1 位の銀河 (遅れなし) | 1 位の銀河 (遅れつき) | 平均点 (遅れなし → 遅れつき) | 星系 (遅れなし → 遅れつき) | 判断の回数 / 100 年 (遅れつき) |');
    out.push('|---|---|---|---|---|---|');
    for (const n of names) {
      const [x, y] = MODES.map(([m]) => res[m].by[n]);
      out.push(`| ${STRATS[n].label} | ${res['遅れなし'].wins[n]} | ${res['遅れつき'].wins[n]} | ${mean(x.map((r) => r.score)).toFixed(1)} → ${mean(y.map((r) => r.score)).toFixed(1)} | ${mean(x.map((r) => r.systems)).toFixed(1)} → ${mean(y.map((r) => r.systems)).toFixed(1)} | ${mean(y.map((r) => r.asksPer100)).toFixed(1)} |`);
    }
    for (const [mode] of MODES) {
      const w = res[mode].wins;
      const top = names.reduce((p, n) => (w[n] > w[p] ? n : p));
      const ex = [...EXPAND].reduce((k, n) => k + w[n], 0);
      verdict.push({ form: formName(nations), mode, top: STRATS[top].label, share: w[top] / seeds.length, ex: ex / seeds.length, over10: names.filter((n) => w[n] / seeds.length >= 0.1).length });
    }
  }
  out.push('');
  out.push('#### 拡張の一強が出るか');
  out.push('');
  out.push('| 試合の形 | ボット | いちばん多く 1 位の戦略 | その割合 | 拡張に寄せた戦略 (拡張・入植の間隔なし) の 1 位の割合 | 10% 以上の銀河で 1 位の戦略の数 | 拡張の一強 |');
  out.push('|---|---|---|---|---|---|---|');
  const pc = (x) => `${Math.round(x * 100)}%`;
  for (const v of verdict) out.push(`| ${v.form} | ${v.mode} | ${v.top} | ${pc(v.share)} | ${pc(v.ex)} | ${v.over10} | ${v.ex >= 0.5 ? '**出る**' : '出ない'} |`);
  out.push('');
  out.push('拡張の一強 = 拡張に寄せた 2 つの戦略が、合わせて半分以上の銀河で 1 位。');
  if (budget) {
    for (const nations of forms) {
      const sr = await search({ src, seeds: searchSeeds, years, nations, budget, human });
      out.push('');
      out.push(`#### 必勝法を探す AI (遅れつき・${formName(nations)}・候補 ${sr.tried} 個 × ${sr.seeds.length} の銀河)`);
      out.push('');
      out.push(`- 遅れつきの放任 ${sr.passive.score.toFixed(1)} → 最良 ${sr.best.score.toFixed(1)} (${sr.gain === null ? '—' : `${sr.gain >= 0 ? '+' : '−'}${Math.abs(Math.round(sr.gain * 1000) / 10)}%`}。放任を上回った銀河 ${sr.wins} / ${sr.seeds.length}。星系 ${sr.passive.systems.toFixed(1)} → ${sr.best.systems.toFixed(1)})`);
      out.push(`- 最良の戦略の値: \`${JSON.stringify(Object.fromEntries(Object.entries(sr.best.s).filter(([k, v]) => S.BASE[k] !== v && k in S.SPACE)))}\` (観戦の AI と違う値だけ)`);
      out.push(`- 上位 5 つ: ${sr.top.map((e) => `${e.score.toFixed(1)} \`${JSON.stringify(Object.fromEntries(Object.entries(e.s).filter(([k, v]) => S.BASE[k] !== v && k in S.SPACE)))}\``).join('・')}`);
    }
  }
  out.push('');
  out.push(`(全体 ${((Date.now() - t0) / 60000).toFixed(1)} 分)`);
  console.log(out.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
