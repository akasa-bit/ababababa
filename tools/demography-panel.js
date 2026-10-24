// 年齢つきの人口のパネルを書き出す (目標 R36・R37。回 KE2)。画面なしの版で銀河を回し、入植地 (人口 100 万人以上)・年ごとに 1 行。
// 同じ統計の台本 data/build/build_demography.py (引数にこのパネル) で、WDI と同じ分位の境目・同じ傾きの式で計算する。
//   gdppc = 入植地の 1 人あたりの実質の所得 (c.inc、2011 年のドル) × DEMO.usd2021 (2021 年のドル。WDI の NY.GDP.PCAP.PP.KD と同じ物差し)
//   young・work・old = 0〜14・15〜64・65 歳以上の割合 (ゲームの年数は 1 世代の比で延ばしてある)、tfr = その年に当てた年齢別出生率の合計
// 使い方: node tools/demography-panel.js <出力.csv> [銀河の数] [年数] [国の数]
const fs = require('fs');
const H = require('./headless');

const [out = 'demography-panel.csv', nS = '30', yS = '150', natS = '6'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const lines = ['galaxy,year,iso3,gdppc,young,work,old,tfr,pop'];
const t0 = Date.now();
for (let i = 1; i <= Number(nS); i++) {
  const g = sim.newGame(String(i), { nations: Number(natS) });
  const usd = sim.evaluate('DEMO.usd2021');
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    for (const c of g.colonies) {
      if (!(c.pop >= 1) || !c.age || !(c.inc > 0) || !(c.tfr > 0)) continue;
      const s = g.ageShares(c);
      lines.push([i, Math.round(g.year), `${i}-${c.sys}-${c.body}-${c.kind}`, (c.inc * usd).toPrecision(6), s.young.toPrecision(5), s.work.toPrecision(5), s.old.toPrecision(5), c.tfr.toPrecision(5), c.pop.toPrecision(5)].join(','));
    }
  }
  process.stderr.write(`銀河 ${i}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${out}: ${lines.length - 1} 行`);
