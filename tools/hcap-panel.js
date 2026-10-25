// 学歴 (就学年数)・学力と所得 (目標 R62・R63・R64。回 KE5・B-117) のパネルを書き出す。同じ台本 data/build/build_hcap.py にかける。ゲームの中身は変えない。
//   入植地 (人口 100 万人以上)・年ごとに 1 行: income = 1 人あたりの実質の所得 (incomeUSD。2011 年の国際ドル。台本が 2021 年のドルに ×1.21) の、その年の刻みの平均
//   (現実の所得は年の値。値段は刻みごとに振れ、1 刻みだけ大きく下がる年がある)、
//   school = 大人 (25 歳〜) の平均の就学年数 (schoolOf)、t = 試合の始めからの現実の年数にあたる値 (ゲームの年数 × 28 ÷ 1 世代の年数。R63 の伸びの速さはこれで測る)、
//   learn = その年に学校を出た世代の学力 (eduStep と同じ learnCurve。R64)
// 使い方: node tools/hcap-panel.js <出力.csv> [銀河の数=30] [年数=150] [国の数=6] [値のファイル.json]   (HTML=… で版を選ぶ) → python3 data/build/build_hcap.py <出力.csv>
const fs = require('fs');
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));
const [out = 'hcap-panel.csv', nS = '30', yS = '150', natS = '6', paramFile] = process.argv.slice(2);
const params = paramFile && paramFile !== '-' ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null;
const sim = H.load({ params, ...(process.env.HTML ? { src: process.env.HTML } : {}) });
const rows = ['colony,galaxy,year,t,income,school,learn'];
const t0 = Date.now();
for (let sd = 1; sd <= Number(nS); sd++) {
  const g = sim.newGame(String(sd), { nations: Number(natS) });
  const y0 = g.year, G = sim.evaluate('ED.generation') / 28;
  for (let y = 0; y < Number(yS); y++) {
    const inc = {}, key = (c) => `${c.sys}-${c.body}-${c.kind}`;
    for (let k = 0; k < 4; k++) {
      sim.run(g, 0.25);
      for (const c of g.colonies) { const v = (inc[key(c)] ??= [0, 0]); v[0] += g.incomeUSD(c); v[1]++; }
    }
    for (const c of g.colonies) {
      if (c.pop < 1) continue;
      const v = inc[key(c)];
      rows.push(`${sd}-${key(c)},${sd},${Math.round(g.year)},${((g.year - y0) / G).toFixed(4)},${(v[0] / v[1]).toPrecision(6)},${g.schoolOf(c).toPrecision(5)},${g.eduY ? g.learnCurve(g.eduY(c), g.eduSpendPct(c)).toFixed(1) : ''}`); // 学力のない前の版は空
    }
  }
  process.stderr.write(`銀河 ${sd}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`${out}: ${rows.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
