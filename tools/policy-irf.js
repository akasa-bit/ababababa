// 政策の反応 (回 KE7・B-006。目標 R80〜R83、docs/money.md の 6)。画面なしの版で、途中の年のセーブから同じ試合を分け (双子の試合)、片方の国だけ政策を変えて、
// 国の GDP・物価・政策金利・税収・政府の買い付けの差を年ごとに測る。変える国と年を前もって決めた組で回すので、差がそのまま政策の効き目 (現実の局所射影の目標と比べる)。
//   rate  = 中央銀行の則から外す (0 年目 +1 点・1 年目 +1.5 点・2 年目 +0.75 点、そのあとは則に戻る。R80 の Jordà, Schularick & Taylor 2020 の金利の道)。GDP・物価の差 ÷ 0 年目の政策金利の差
//   tax   = 所得への税率を上げる (ずっと。Romer & Romer 2010 の税の変更の多くは長く続く)。GDP の差 ÷ 前もっての税収の差 (上げた税率 × 0 年目の所得 ÷ GDP。Romer & Romer と同じく、
//           実際に増えた税収でなく法の上の額で割る。実際の税収は景気で減るので、分母がぶれる)
//   spend = 首都の政府が、0・1 年目の 2 年、0 年目の GDP の 1% の行政サービスを足して買う (資金が足りなければ国債で)。乗数 = 累積の GDP の差 ÷ 累積の政府の買い付けの差
//           (Ramey & Zubairy 2018)。財政の則の目標をずらす形では、国の買い付けの差が GDP の 0.2% ほどしか出ず、乗数がぶれた
// 測る星系は、政策を変えた年に国にあった星系だけ (入植と併合で国が大きくなった分を入れない)。人の国 (観戦では AI と同じ財政) は財政の置き場が違うので変えない。
// 使い方: node tools/policy-irf.js [銀河の数=12] [国の数=6] [--kind rate,tax,spend] [--at 40,70] [--h 5] [--seeds 1,2,…] [--json 結果.json]   (HTML=… で別の版。進み具合は標準エラーへ)
//         node tools/policy-irf.js --merge a.json,b.json,…   (銀河の組を分けて並べて回した結果をまとめて表にする)
const fs = require('fs');
const H = require('./headless');

const a = process.argv.slice(2);
const arg = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
const pos = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--')));
const [nS = '12', natS = '6'] = pos;
const KINDS = arg('kind', 'rate,tax,spend').split(',');
const AT = arg('at', '40,70').split(',').map(Number); // 100 年目から分けると 1 つの組に 15 分以上かかる (回 KE7 の測りは 40・70 年目)
const HZ = Number(arg('h', 5)); // R81 は 4 年目まで
const SHOCK = { rate: [0.01, 0.015, 0.0075], tax: 0.012, spend: 0.01 }; // 政策金利の則からの外れ (年ごと)・所得への税率 +1.2 点 (税収がおよそ GDP の 1%)・足す行政サービス (0 年目の GDP 比)
const GOV_BUY = new Set(['build', 'upkeep', 'welfare', 'security', 'military', 'education', 'public', 'health']); // tools/fiscal-panel.js と同じ (GDP に入る政府の買い付け)
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});

// 1 つの試合に、星系ごとの 1 年の足し上げ (所得・政府の買い付け・税収) をつける (fiscal-panel.js と同じ数え方)
function instrument(g) {
  const acc = {};
  const A = (id) => (acc[id] ??= { inc: 0, buy: 0, tax: 0 });
  const earn = g.earn.bind(g), cash = g.cash.bind(g), eco = g.economy.bind(g);
  g.earn = (kind, amount, sys = 0, other = null) => { const gv = g.gov(sys), c0 = gv.credits, r = earn(kind, amount, sys, other), d = gv.credits - c0; if ((kind === 'tax' || kind === 'ctax') && d > 0) A(sys).tax += d; return r; };
  g.cash = (kind, v, acct) => { if ((acct.hh !== undefined || acct.fm !== undefined) && GOV_BUY.has(kind) && v > 0) A(acct.hh ?? acct.fm).buy += v; return cash(kind, v, acct); };
  g.economy = (h) => { const r = eco(h); for (const c of g.colonies) A(c.sys).inc += (c.incY || 0) * h; return r; };
  return acc;
}
const clone = (seed, d) => { const g = sim.newGame(seed, { nations: Number(natS) }); if (!g.restore(JSON.parse(JSON.stringify(d)))) throw new Error('セーブを読めない'); return g; };

// 1 年ぶん進め、国 (星系の組 S と首都 root) の数を返す
function year(g, acc, S, root, tick = null) {
  for (const k of Object.keys(acc)) delete acc[k];
  let i = 0;
  for (let t = 0; t < 4; t++) { if (tick) tick(g); g.advance(0.25); i += (g.cbRateAt ? g.cbRateAt(root) : 0) / 4; }
  let gdp = 0, buy = 0, tax = 0, inc = 0;
  for (const id of S) { const x = acc[id]; if (x) { gdp += x.inc + x.buy; buy += x.buy; tax += x.tax; inc += x.inc; } }
  return { gdp, buy, tax, inc, cpi: g.cpiOf ? g.cpiOf(root) : 1, i };
}

function shock(g, kind, root) {
  if (kind === 'tax') { const f = g.aiFiscal(root); g.aif[root] = { ...f, tax: f.tax + SHOCK.tax }; }
}

const results = []; // { seed, at, root, kind, d: [{ dy, dp, di, dt, dg, y0 }] }
const t0 = Date.now();
const SEEDS = arg('seeds') ? arg('seeds').split(',') : Array.from({ length: Number(nS) }, (_, i) => String(i + 1));
if (arg('merge')) for (const f of arg('merge').split(',')) results.push(...JSON.parse(fs.readFileSync(f, 'utf8')).results);
for (const seed of arg('merge') ? [] : SEEDS) {
  const base = sim.newGame(seed, { nations: Number(natS) });
  let y = 0;
  for (const at of AT) {
    sim.run(base, at - y); y = at;
    const d = sim.buildSave(base);
    const roots = [...new Set(base.colonizedSystems().map((x) => base.realmOf(x.id)))].filter((r) => !base.isHuman(r) && base.govs[r]?.fr?.y > 0);
    if (!roots.length) continue;
    // 0 = 比べる元、1 = 何も変えない双子 (元と差が 0 になることを確かめる。ずれたら、セーブで落ちる値があって実験が成り立たない)
    const runs = [{ kind: null }, { kind: null }].concat(roots.flatMap((root) => KINDS.map((kind) => ({ kind, root }))));
    const games = runs.map(() => clone(seed, d));
    const accs = games.map(instrument);
    const sets = Object.fromEntries(roots.map((r) => [r, base.realmSystems(r).map((x) => x.id)]));
    runs.forEach((r, k) => { if (r.kind) shock(games[k], r.kind, r.root); if (r.kind === 'spend') r.x = SHOCK.spend * base.realmSystems(r.root).reduce((t, x) => t + (base.govs[x.id]?.fr?.y || 0), 0); });
    const series = runs.map(() => []);
    for (let hz = 0; hz < HZ; hz++) {
      games.forEach((g, k) => {
        if (runs[k].kind === 'rate') { const e = SHOCK.rate[hz], s = g.cbOf(runs[k].root); if (e) s.e = e; else delete s.e; } // 外すのは 3 年だけ
        const run = runs[k], extra = run.kind === 'spend' && hz < 2 ? run.x : 0; // 足す行政サービス [cr/年]
        series[k].push(Object.fromEntries(roots.map((r) => [r, year(g, accs[k], sets[r], r, extra && r === run.root ? (gg) => gg.earn('public', -extra * 0.25, r, { hh: r }) : null)])));
      });
    }
    for (const r of roots) for (let hz = 0; hz < HZ; hz++) if (series[1][hz][r].gdp !== series[0][hz][r].gdp || series[1][hz][r].cpi !== series[0][hz][r].cpi) { process.stderr.write(`何も変えない双子がずれた (銀河 ${seed} の ${at} 年・国 ${r}・${hz} 年目)\n`); process.exitCode = 1; }
    runs.forEach((r, k) => {
      if (!r.kind) return;
      const c = series[0], t = series[k];
      const y0 = c[0][r.root].gdp;
      if (!(y0 > 0)) return;
      results.push({
        seed, at, root: r.root, kind: r.kind, y0, ex: 100 * SHOCK.tax * c[0][r.root].inc / y0, // 税の前もっての額 (GDP 比 %)
        d: t.map((x, hz) => {
          const X = x[r.root], C = c[hz][r.root];
          return { dy: 100 * Math.log(X.gdp / C.gdp), dp: 100 * Math.log(X.cpi / C.cpi), di: 100 * (X.i - C.i), dt: (X.tax - C.tax) / C.gdp, dg: X.buy - C.buy, dY: X.gdp - C.gdp };
        }),
      });
    });
    process.stderr.write(`銀河 ${seed} の ${at} 年: 国 ${roots.length} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
    if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify({ partial: true, results })); // 途中で止めても、済んだ実験は残る
  }
}

// まとめ: 種類ごとに、年ごとの中央値 (目標の判定に使う。試合が分かれたあとの戦争や独立のぶれに引きずられないように) と、平均 ± 標準誤差
const mean = (xs) => xs.reduce((k, x) => k + x, 0) / xs.length;
const median = (xs) => { const v = [...xs].sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : NaN; };
const se = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((k, x) => k + (x - m) ** 2, 0) / Math.max(1, xs.length - 1) / xs.length); };
const fin = (xs) => xs.filter(Number.isFinite);
const out = { seeds: arg('merge') ? [...new Set(results.map((r) => r.seed))].length : SEEDS.length, nations: Number(natS), at: AT, h: HZ, shock: SHOCK, kinds: {} };
const lines = [];
for (const kind of KINDS) {
  const rs = results.filter((r) => r.kind === kind);
  if (!rs.length) continue;
  const o = (out.kinds[kind] = { n: rs.length, years: [] });
  lines.push(`### ${kind} (実験 ${rs.length})`, '', kind === 'spend' ? '| 年 | GDP の差 (%) | 累積の乗数 | 政府の買い付けの差 (GDP 比 %) |' : '| 年 | GDP の差 (%) | 物価の差 (%) | 政策金利の差 (点) | 税収の差 (GDP 比 %) |', kind === 'spend' ? '|---|---|---|---|' : '|---|---|---|---|---|');
  for (let hz = 0; hz < HZ; hz++) {
    // 規格化: rate は外した年の政策金利の差 (点)、tax は前もっての税収の差 (GDP 比 %) で割る。spend は乗数 (累積の GDP の差 ÷ 累積の買い付けの差)
    const norm = (r) => (kind === 'rate' ? r.d[0].di : kind === 'tax' ? r.ex ?? 100 * r.d[0].dt : 1); // 前の版の結果 (ex がない) は実際の税収の差で
    const ok = rs.filter((r) => Math.abs(norm(r)) > 1e-6);
    const dy = fin(ok.map((r) => r.d[hz].dy / norm(r))), dp = fin(ok.map((r) => r.d[hz].dp / norm(r)));
    const mult = fin(rs.map((r) => { const Y = r.d.slice(0, hz + 1).reduce((k, x) => k + x.dY, 0), G = r.d.slice(0, hz + 1).reduce((k, x) => k + x.dg, 0); return Math.abs(G) > 1e-9 ? Y / G : NaN; }));
    const di = fin(rs.map((r) => r.d[hz].di)), dt = fin(rs.map((r) => 100 * r.d[hz].dt)), dg = fin(rs.map((r) => (100 * r.d[hz].dg) / r.y0));
    const yr = { hz, dy: [median(dy), mean(dy), se(dy)], dp: [median(dp), mean(dp), se(dp)], di: median(di), dt: median(dt), mult: mult.length ? [median(mult), mean(mult), se(mult)] : null, dg: median(dg), n: ok.length };
    o.years.push(yr);
    const f = (v) => `**${v[0].toFixed(2)}** (平均 ${v[1].toFixed(2)} ± ${v[2].toFixed(2)})`;
    lines.push(kind === 'spend' ? `| ${hz} | ${f(yr.dy)} | ${yr.mult ? f(yr.mult) : '—'} | ${yr.dg.toFixed(2)} |` : `| ${hz} | ${f(yr.dy)} | ${f(yr.dp)} | ${yr.di.toFixed(2)} | ${yr.dt.toFixed(2)} |`);
  }
  lines.push('');
}
lines.push(`(${((Date.now() - t0) / 60000).toFixed(1)} 分。太字は実験ごとの値の中央値。rate・tax の GDP と物価は、0 年目の政策金利の差 1 点・前もっての税収の差 GDP の 1% あたり。政策金利・税収・買い付けの差は中央値)`);
console.log(lines.join('\n'));
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify({ ...out, results }, null, 1));
