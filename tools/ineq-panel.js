// 星系ごとの所得の 5 分位の分け前のパネルを書き出す (目標 R84。回 KE11・B-127。docs/fiscal.md の 12)。
// 画面なしの版で観戦の試合を回し、5 年ごとに、入植地のある星系ごとに 1 行 (galaxy, year, sys, pop [100 万人], sigma, q1〜q5 [%])。ゲームの中身は変えない。
// 使い方: node tools/ineq-panel.js <出力.csv> [銀河の数=30] [年数=150] [国の数=6]   (HTML=… で版を選ぶ) → python3 data/build/build_ineq.py --game <出力.csv>
const fs = require('fs');
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));
const [out = 'ineq-panel.csv', nS = '30', yS = '150', natS = '6'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const lines = ['galaxy,year,sys,pop,sigma,q1,q2,q3,q4,q5'];
const t0 = Date.now();
for (let i = 1; i <= Number(nS); i++) {
  const g = sim.newGame(String(i), { nations: Number(natS) });
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    if ((y + 1) % 5) continue;
    for (const s of g.colonizedSystems()) {
      const pop = g.coloniesIn(s.id).reduce((a, c) => a + c.pop, 0);
      if (!(pop > 0)) continue;
      const Q = g.quintOf(s.id);
      lines.push([i, Math.round(g.year), s.id, +pop.toFixed(4), +g.ineqSigma(s.id).toFixed(4), ...Q.map((x) => +(100 * x).toFixed(3))].join(','));
    }
  }
  console.error(`銀河 ${i}/${nS} (${Math.round((Date.now() - t0) / 1000)} 秒)`);
}
fs.writeFileSync(out, lines.join('\n') + '\n');
console.error(`${out}: ${lines.length - 1} 行`);
