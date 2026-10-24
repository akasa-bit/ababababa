// 国の中の地域の収束 (目標 R38) と労働分配率 (R39) のパネルを、実データ (DOSE v2・Penn World Table) と同じ列で書き出す (回 KE5)。
// 同じ計算の台本 data/build/build_regions.py を、実データとこのパネルの両方にかける。ゲームの中身は変えない。
//   地域のパネル (R38): 10 年ごと (試合の始めから) に、国 (首都とその従属星系) の中の星系ごとに 1 行。星系 = 人口 50 万人以上の入植地をまとめたもの、
//     grp_pc = 1 人あたりの実質の所得 (incomeUSD。2011 年のドル) の人口の重みの平均。GID_0 = 銀河-国、GID_1 = 銀河-星系、StructChange = 0
//     (国が変わった星系は GID_0 が変わるので、10 年の両端で同じ国の組だけが比べられる)
//   労働分配率のパネル (R39): 年ごとに、国ごとに 1 行。labsh = 労働の所得 ÷ 国の中の総生産。労働の所得 = 賃金 (市場の付加価値の 1 − CAPITAL.alpha。
//     economy の 7 と同じ式) + 自給の分の値打ち (PWT と同じく、自営の所得は労働に入れる)、総生産 = 市場の付加価値 (incomeOf) + 自給の分。年の終わりの値
// 使い方: node tools/region-panel.js <地域.csv> <労働分配率.csv> [銀河の数=30] [年数=150] [国の数=6]   (HTML=… で版を選ぶ)
//   → python3 data/build/build_regions.py <地域.csv> <労働分配率.csv>
const fs = require('fs');
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));
const [outR = 'region-panel.csv', outL = 'labsh-panel.csv', nS = '30', yS = '150', natS = '6'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const alpha = sim.tables.CAPITAL?.alpha ?? 0; // 民間の資本のない前の版は、市場の付加価値をすべて賃金として払っていた
const R = ['GID_0,GID_1,year,pop,grp_pc,StructChange'], L = ['countrycode,year,labsh'];
const t0 = Date.now();
for (let sd = 1; sd <= Number(nS); sd++) {
  const g = sim.newGame(String(sd), { nations: Number(natS) });
  for (let y = 0; y <= Number(yS); y++) {
    if (y) sim.run(g, 1);
    const year = Math.round(g.year);
    const lab = {};
    for (const c of g.colonies) {
      const va = g.incomeOf(c), home = g.incomeAll(c) - va, X = (lab[g.realmOf(c.sys)] ??= [0, 0]);
      X[0] += (1 - alpha) * va + home; X[1] += va + home;
    }
    for (const [realm, [w, y2]] of Object.entries(lab)) if (y2 > 0) L.push(`${sd}-${realm},${year},${(w / y2).toPrecision(6)}`);
    if (y % 10) continue;
    const by = {};
    for (const c of g.colonies) {
      if (c.pop < 0.5) continue;
      const b = (by[c.sys] ??= { p: 0, yp: 0 });
      b.p += c.pop; b.yp += c.pop * g.incomeUSD(c);
    }
    for (const [s, b] of Object.entries(by)) R.push(`${sd}-${g.realmOf(Number(s))},${sd}-${s},${year},${b.p.toPrecision(6)},${(b.yp / b.p).toPrecision(6)},0`);
  }
  process.stderr.write(`銀河 ${sd}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(outR, `${R.join('\n')}\n`);
fs.writeFileSync(outL, `${L.join('\n')}\n`);
console.log(`${outR}: ${R.length - 1} 行・${outL}: ${L.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
