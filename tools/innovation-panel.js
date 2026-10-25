// 技術革新 (目標 R66・R67〜。回 KE6) の国・年のパネルを書き出す。同じ台本 data/build/build_innovation.py (--game) を、実データとこのパネルの両方にかける。
// ゲームの中身は変えない。国 (首都とその従属星系) ごと・年ごとに 1 行:
//   pop = 人口 [100 万人] (年の終わり)、income = 1 人あたりの実質の所得 (incomeUSD。2011 年の国際ドル) の人口の重みの平均の、その年の刻みの平均、
//   researchers = 研究者の数 [人/100 万人] (researchersOf の人口の重みの平均。年の終わり。研究者の曲線のない前の版は researchers(所得))、
//   learn = 大人 (25〜64 歳) の平均の学力 (試験の点数の物差し。目標 R67 の書き方のまま。学力のない前の版は空)、
//   lnA = 技術の水準 (分野ごとの ln A_f を、国の部門の付加価値で重みづけた平均。R11 のパネルと同じ重み)、
//   rel = 銀河でいちばん大きい国 (人口 × 所得) との技術の差 (同じ重みでの ln A_f − ln A_f の基準の国。現実の米国 = 1 にあたる)、
//   hk = 学歴の倍率 (c.hk の人口の重みの平均。ない前の版は 1)、lays = その年に学校を出る世代の、学力で調整した就学年数 (schoolCurve × learnCurve ÷ 625。
//   データの LAYS は、いまの子どもが受ける就学年数 × 試験の点数 ÷ 625)、
//   rd = 研究開発費 ÷ GDP [%]、gshare = そのうち政府が出した割合 [%]、tax = 研究開発の税額控除 ÷ GDP [%] (国の技術の rd。年の終わり。研究開発の費用のない前の版は空。回 KE6)
// 使い方: node tools/innovation-panel.js <出力.csv> [銀河の数=30] [年数=150] [国の数=6]   (HTML=… で版を選ぶ) → python3 data/build/build_innovation.py --game <出力.csv>
const fs = require('fs');
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));
const [out = 'innovation-panel.csv', nS = '30', yS = '150', natS = '6'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const { RESEARCH } = sim.tables;
const [SB, WK] = sim.evaluate('typeof SCHOOL !== "undefined" ? [SCHOOL.bin, DEMO.work[1]] : [5, 12]'); // 25〜29 歳の区分と 60〜64 歳の区分
const rows = ['country,galaxy,year,pop,income,researchers,learn,lnA,rel,hk,lays,rd,gshare,tax'];
const t0 = Date.now();
for (let sd = 1; sd <= Number(nS); sd++) {
  const g = sim.newGame(String(sd), { nations: Number(natS) });
  for (let y = 0; y < Number(yS); y++) {
    const inc = {};
    for (let k = 0; k < 4; k++) {
      sim.run(g, 0.25);
      for (const c of g.colonies) { const r = g.realmOf(c.sys), v = (inc[r] ??= [0, 0]); v[0] += c.pop * g.incomeUSD(c); v[1] += c.pop; }
    }
    const R = {};
    for (const c of g.colonies) {
      const r = g.realmOf(c.sys), x = (R[r] ??= { p: 0, res: 0, q: 0, qp: 0, l: 0, hk: 0, va: Object.fromEntries(RESEARCH.fields.map((f) => [f, 0])) });
      x.p += c.pop;
      x.res += c.pop * (g.researchersOf ? g.researchersOf(c) : g.researchers(c.inc ?? 2000));
      x.hk += c.pop * (c.hk ?? 1);
      if (g.eduY && g.learnOf) {
        const y = g.eduY(c), pct = g.eduSpendPct(c);
        x.q += c.pop * g.schoolMean(c, (s, q) => q, SB, WK); x.l += (c.pop * g.schoolCurve(y, pct) * g.learnCurve(y, pct)) / 625; x.qp += c.pop;
      }
      const sh = c.sh, w = g.wagesOf(c);
      if (sh) for (const f of RESEARCH.fields) x.va[f] += c.pop * (sh[f] || 0) * (w[f] || 0);
    }
    // 基準の国: 銀河でいちばん大きい国 (人口 × 所得)
    let ref = null, big = 0;
    for (const [r, x] of Object.entries(R)) if (inc[r] && g.tech[r] && inc[r][0] > big) { big = inc[r][0]; ref = r; }
    const lnA = (r, ar) => {
      const A = g.tech[r]?.A, B = ar && g.tech[ar]?.A, V = R[r].va, F = RESEARCH.fields.filter((f) => A?.[f] > 0 && (!ar || B?.[f] > 0)), tot = F.reduce((k, f) => k + V[f], 0);
      return F.length ? F.reduce((k, f) => k + (tot > 0 ? V[f] / tot : 1 / F.length) * (Math.log(A[f]) - (ar ? Math.log(B[f]) : 0)), 0) : NaN;
    };
    for (const [r, x] of Object.entries(R)) {
      if (!(x.p > 0) || !inc[r]) continue;
      const a = g.tech[r] ? lnA(r) : NaN, rel = g.tech[r] && ref ? lnA(r, ref) : NaN, rd = g.tech[r]?.rd;
      rows.push(`${sd}-${r},${sd},${Math.round(g.year)},${x.p.toPrecision(6)},${(inc[r][0] / inc[r][1]).toPrecision(6)},${(x.res / x.p).toPrecision(6)},${x.qp > 0 ? (x.q / x.qp).toFixed(1) : ''},`
        + `${Number.isFinite(a) ? a.toPrecision(6) : ''},${Number.isFinite(rel) ? rel.toPrecision(6) : ''},${(x.hk / x.p).toPrecision(6)},${x.qp > 0 ? (x.l / x.qp).toPrecision(5) : ''},`
        + (rd && rd.y > 0 ? `${((100 * rd.spend) / rd.y).toPrecision(5)},${rd.spend > 0 ? ((100 * rd.pub) / rd.spend).toPrecision(5) : ''},${((100 * rd.credit) / rd.y).toPrecision(5)}` : ',,'));
    }
  }
  process.stderr.write(`銀河 ${sd}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`${out}: ${rows.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
