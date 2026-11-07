// 刻みを変えると試合の数がどれだけ変わるか (QD-118 の調べ。docs/perf.md の 8)。
// ブラウザは画面の 1 コマごとに「コマの時間 × 速さ」だけ進めるので、刻み (1 歩の年) が速さとコマの速さで変わる (1 年/秒・60 コマ/秒なら 1/60 年)。
// 画面なしの道具と CI は 0.25 年ずつ。同じ銀河を刻みを変えて回し、CI の自動対戦と同じ数 (tools/ci-report.js) を比べる。
// 0.25 年の行は CI の自動対戦と同じ試合 (状態の要約も同じ)。
// 使い方: node tools/step-cmp.js [--seeds 24] [--years 150] [--nations 6] [--steps 0.25,1/15,1/60,1/240]
//   --part k/K --json p.json = 銀河を K 個に分けた k 番目だけを回し、JSON に書く (.github/workflows/measure.yml 用)
//   --merge 'out/*.json'       = 分けて回した結果を集めて表 (Markdown) にする
// 出力: 1 試合 1 行の JSON (--json がなければ標準出力)。--merge では表
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const a = process.argv.slice(2);
const arg = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
const num = (s) => (s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s));
const KEYS = [['colonies', '入植地の数'], ['systems', '入植した星系'], ['realms', '国の数 (独立した国を含む)'], ['pop', '総人口'], ['warsBegun', '始まった戦争'], ['wars', '終わりの年に続いている戦争'], ['independences', '独立'], ['credits', '政府の資金の合計 (cr)'], ['yearly', '年に 1 度の処理の回数'], ['ms', '1 試合の時間 (ミリ秒)']];

// 1 試合 (数え方は tools/ci-report.js と同じ。年に 1 度の処理の回数も数える)。
// 0.25 年は CI と同じく 0.25 年ずつ。それより細かい刻みは、ブラウザのコマの時間の揺れをまねて、1 回ごとに h の 0.5〜1.5 倍
// (銀河ごとに決まった乱数。試合の乱数は使わない)。揺れがないと、たとえば 1/15 年を 15 回足しても浮動小数で 1 にわずかに届かず、
// 年に 1 度の処理がいつも 16 回目になる (ブラウザでは揺れるので、平均して刻みの半分だけ遅れる)
function play(sim, seed, years, nations, hS) {
  const h = num(hS);
  const g = sim.newGame(seed, { nations });
  let warsBegun = 0, independences = 0, yearly = 0;
  const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = (...x) => { fn(...x); return orig(...x); }; };
  wrap('beginWar', () => warsBegun++);
  wrap('declareIndependence', () => independences++);
  wrap('recordSnapshots', () => yearly++);
  const t0 = Date.now();
  let n = 0;
  if (h >= 0.25) for (; n < Math.round(years / 0.25); n++) g.advance(0.25);
  else {
    let s = (Number(seed) * 2654435761) >>> 0;
    const u = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let left = years; left > 1e-9; n++) { const d = Math.min(left, h * (0.5 + u())); g.advance(d); left -= d; }
  }
  const s = H.summary(g);
  const credits = Object.values(g.govs).reduce((k, v) => k + (v.credits || 0), 0);
  return { seed, h: hS, steps: n, ...s, warsBegun, independences, credits, yearly, ms: Date.now() - t0, hash: sim.hash(g) };
}

function merge(glob) {
  const dir = path.dirname(glob), re = new RegExp(`^${path.basename(glob).replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
  const runs = fs.readdirSync(dir).filter((f) => re.test(f)).flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  const steps = [...new Set(runs.map((r) => r.h))].sort((x, y) => num(y) - num(x));
  const base = steps[0];
  const by = (h) => new Map(runs.filter((r) => r.h === h).map((r) => [r.seed, r]));
  const B = by(base);
  const mean = (xs) => xs.reduce((k, x) => k + x, 0) / xs.length;
  const q = (xs, p) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const f = (x) => (Math.abs(x) >= 1e4 ? x.toExponential(2) : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));
  const out = [`## 刻みで試合の数がどれだけ変わるか (${B.size} の銀河。比べる元は ${base} 年の刻み)`, ''];
  out.push(`| 数 | ${steps.map((h) => `${h} 年の平均 (10%〜90%)`).join(' | ')} |`, `|---|${steps.map(() => '---').join('|')}|`);
  for (const [k, label] of KEYS) {
    out.push(`| ${label} | ${steps.map((h) => { const xs = [...by(h).values()].map((r) => r[k]); return xs.length ? `${f(mean(xs))} (${f(q(xs, 0.1))}〜${f(q(xs, 0.9))})` : '—'; }).join(' | ')} |`);
  }
  out.push('', `### 同じ銀河どうしの差 (${base} 年の刻みとの差の平均 ± 標準誤差)`, '');
  out.push(`| 数 | ${steps.slice(1).map((h) => `${h} 年`).join(' | ')} |`, `|---|${steps.slice(1).map(() => '---').join('|')}|`);
  for (const [k, label] of KEYS) {
    if (k === 'ms') continue;
    out.push(`| ${label} | ${steps.slice(1).map((h) => {
      const d = [...by(h).values()].filter((r) => B.has(r.seed)).map((r) => r[k] - B.get(r.seed)[k]);
      if (d.length < 2) return '—';
      const m = mean(d), se = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (d.length - 1) / d.length);
      return `${m >= 0 ? '+' : ''}${f(m)} ± ${f(se)}`;
    }).join(' | ')} |`);
  }
  console.log(out.join('\n'));
}

if (arg('merge')) merge(arg('merge'));
else {
  const allSeeds = Array.from({ length: Number(arg('seeds', '24')) }, (_, i) => String(i + 1));
  const part = arg('part');
  const seeds = (() => { if (!part) return allSeeds; const [k, K] = part.split('/').map(Number); return allSeeds.filter((_, i) => i % K === k - 1); })();
  const years = Number(arg('years', '150')), nations = Number(arg('nations', '6'));
  const steps = arg('steps', '0.25,1/15,1/60,1/240').split(',');
  const sim = H.load({});
  const file = arg('json');
  if (file) fs.writeFileSync(file, '');
  for (const seed of seeds) for (const h of steps) {
    const line = JSON.stringify(play(sim, seed, years, nations, h));
    if (file) fs.appendFileSync(file, line + '\n');
    else console.log(line);
  }
}
