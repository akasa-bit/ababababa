// 製造業の中の高付加価値の割合と所得 (目標 R61。回 KE5) のパネルを書き出す。同じ分位の台本 data/build/build_tech.py にかける。ゲームの中身は変えない。
//   入植地 (人口 100 万人以上)・年ごとに 1 行: hitech = 工業品の付加価値 (低付加価値物品と高付加価値物品。市場の値段) のうち高付加価値物品の割合、
//   income = 1 人あたりの実質の所得 (incomeUSD。2011 年の国際ドル。台本が 2021 年のドルに ×1.21)。工業品の付加価値が 0 の入植地・年は書かない
// 使い方: node tools/tech-panel.js <出力.csv> [銀河の数=30] [年数=150] [国の数=6]   (HTML=… で版を選ぶ) → python3 data/build/build_tech.py <出力.csv>
const fs = require('fs');
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));
const [out = 'tech-panel.csv', nS = '30', yS = '150', natS = '6'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const rows = ['colony,galaxy,year,income,hitech'];
const t0 = Date.now();
for (let sd = 1; sd <= Number(nS); sd++) {
  const g = sim.newGame(String(sd), { nations: Number(natS) });
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    for (const c of g.colonies) {
      if (c.pop < 1 || !c.sh) continue;
      const w = g.wagesOf(c), lo = c.sh.ind * w.ind, hi = (c.sh.hi || 0) * (w.hi || 0);
      if (!(lo + hi > 0)) continue;
      rows.push(`${sd}-${c.sys}-${c.body}-${c.kind},${sd},${Math.round(g.year)},${g.incomeUSD(c).toPrecision(6)},${(hi / (lo + hi)).toPrecision(6)}`);
    }
  }
  process.stderr.write(`銀河 ${sd}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`${out}: ${rows.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
