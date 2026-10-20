// 市場 (値段と在庫) の年次パネルを書き出す (目標 R23〜R26)。画面なしの版で銀河を回し、入植した星系ごと・年ごとに、
// 値段 (食料・金属・燃料・希少元素) と、在庫とふだんの消費 (食料・工業品) を書く。同じ台本 data/build/analyze_market.py を、
// 現実の生データ (Pink Sheet・USDA PSD・FRED) とこのパネルの両方にかける。ゲームの中身は変えない
// 使い方: node tools/market-panel.js <出力のフォルダ> [銀河の数] [年数] [国の数] [値のファイル.json]
//   → prices.csv (series, group, galaxy, year, price)、food.csv と goods.csv (series, galaxy, year, stock, use)。goods の use は月あたり
const fs = require('fs');
const path = require('path');
const H = require('./headless');

const [dir = 'market-panel', nS = '30', yS = '150', natS = '6', paramFile] = process.argv.slice(2);
const params = paramFile ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null;
const sim = H.load({ params });
const PRICED = ['food', 'metal', 'fuel', 'rare'];
fs.mkdirSync(dir, { recursive: true });
const P = ['series,group,galaxy,year,price'], FOOD = ['series,galaxy,year,stock,use'], GOODS = ['series,galaxy,year,stock,use'];
const num = (v) => (Number.isInteger(v) ? v : v.toPrecision(8));
const t0 = Date.now();
for (let i = 1; i <= Number(nS); i++) {
  const seed = String(i);
  const g = sim.newGame(seed, { nations: Number(natS) });
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    const year = Math.round(g.year);
    for (const s of g.colonizedSystems()) {
      const m = g.market[s.id];
      if (!m) continue;
      const st = g.stockOf(s.id);
      for (const r of PRICED) if (m.u[r] > 1e-6) P.push([`${seed}-${s.id}-${r}`, r, seed, year, num(m.p[r])].join(','));
      if (m.u.food > 1e-6) FOOD.push([`${seed}-${s.id}`, seed, year, num(st.food), num(m.u.food)].join(','));
      if (m.u.goods > 1e-6) GOODS.push([`${seed}-${s.id}`, seed, year, num(st.goods), num(m.u.goods / 12)].join(','));
    }
  }
  process.stderr.write(`銀河 ${i}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
for (const [name, rows] of [['prices.csv', P], ['food.csv', FOOD], ['goods.csv', GOODS]]) fs.writeFileSync(path.join(dir, name), `${rows.join('\n')}\n`);
console.log(`${dir}: 値段 ${P.length - 1} 行・食料 ${FOOD.length - 1} 行・工業品 ${GOODS.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
