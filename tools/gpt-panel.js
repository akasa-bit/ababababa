// 汎用技術 (GPT。目標 R77。回 KE6・B-123) の採用の表を書き出す。同じ台本 data/build/build_innovation.py (--game パネル.csv この表.csv) で測る。
// ゲームの中身は変えない。GPT・国 (首都とその従属星系) ごとに 1 行:
//   galaxy、gpt = 銀河の中の番号、arrival = 現れた年、inv = 発明した国の首都、country = 銀河-首都、
//   income = GPT が現れた年の国の 1 人あたりの実質の所得 (incomeUSD の人口の重みの平均。2011 年の国際ドル)、
//   year10 = 国の採用 (gptAdopt) が 10% に達した年 (年の終わりの値の間を直線で埋める。試合の終わりまでに達しなければ空)
// 使い方: node tools/gpt-panel.js <出力.csv> [銀河の数=30] [年数=150] [国の数=6]   (HTML=… で版を選ぶ)
const fs = require('fs');
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));
const [out = 'gpt-panel.csv', nS = '30', yS = '150', natS = '6'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const rows = ['galaxy,gpt,arrival,inv,country,income,year10'];
const t0 = Date.now();
for (let sd = 1; sd <= Number(nS); sd++) {
  const g = sim.newGame(String(sd), { nations: Number(natS) });
  const rec = {}; // `${k}|${国}` → { income, prev: [年, 採用], year10 }
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    if (!g.gpts?.length) continue;
    const L = g.laysByRealm(), inc = {};
    for (const c of g.colonies) { const r = g.realmOf(c.sys), v = (inc[r] ??= [0, 0]); v[0] += c.pop * g.incomeUSD(c); v[1] += c.pop; }
    g.gpts.forEach((gp, k) => {
      for (const r of Object.keys(L)) {
        const key = `${k}|${r}`, a = g.gptAdopt(g.year, gp, g.gptLag(r, gp, L));
        const x = (rec[key] ??= { k, r, income: inc[r] ? inc[r][0] / inc[r][1] : NaN, prev: null, year10: null });
        if (x.year10 === null && a >= 0.1) x.year10 = x.prev && x.prev[1] < 0.1 ? x.prev[0] + ((0.1 - x.prev[1]) / (a - x.prev[1])) * (g.year - x.prev[0]) : g.year;
        x.prev = [g.year, a];
      }
    });
  }
  for (const x of Object.values(rec)) {
    const gp = g.gpts[x.k];
    rows.push(`${sd},${x.k},${gp.t.toFixed(2)},${gp.inv},${sd}-${x.r},${Number.isFinite(x.income) ? x.income.toPrecision(6) : ''},${x.year10 === null ? '' : x.year10.toFixed(2)}`);
  }
  process.stderr.write(`銀河 ${sd}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`${out}: ${rows.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
