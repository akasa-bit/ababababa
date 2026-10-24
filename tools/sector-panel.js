// 産業構造と所得の年次パネルを書き出す (目標 R10)。画面なしの版で銀河を回し、入植した星系ごと・年ごとに 1 行。
// 同じ台本 data/build/build_sectors.py (--game) を、現実の GGDC × Maddison とこのパネルの両方にかける。ゲームの中身は変えない。
// 列 (targets.json の R10 の sim のとおり):
//   iso3   = 銀河-星系 (実データの国にあたる)
//   gdppc  = 1 人あたりの実質の所得 [2011 年の国際ドル]。入植地ごとの incomeUSD (ゲームの中の構造転換の曲線に使うものと同じ定義: 所得 (付加価値。自給を含む) を
//            地元の消費者物価で割り、食料の基準の値段を 2011 年の世界の穀物の値段 (STRUCTURE.usdPerT = sectors.json の anchor) に合わせて読み替える) を人口で重みづけ
//   agr    = 農業 (farm) の就業の割合、ind = 鉱業 + 工業 (mine + ind)、srv = サービス (serv。研究者を含む)。人口で重みづけた星系の値
//   pop    = 星系の人口 [100 万人]。比べるのは 100 万人以上の星系・年だけ (台本の側で選ぶ)
// 使い方: node tools/sector-panel.js <出力.csv> [銀河の数] [年数] [国の数] [値のファイル.json] [開始時の生産性]
const fs = require('fs');
const path = require('path');
const H = require('./headless');

const [out = 'sector-panel.csv', nS = '30', yS = '150', natS = '6', paramFile, prodS = '1'] = process.argv.slice(2);
const params = paramFile && paramFile !== '-' ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null;
const sim = H.load({ params, ...(process.env.HTML ? { src: process.env.HTML } : {}) }); // HTML=… で別の版 (main など) を測れる
const { STRUCTURE } = sim.tables;
const anchor = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'derived', 'sectors.json'), 'utf8')).anchor.usd_per_t;
if (Math.abs(anchor - STRUCTURE.usdPerT) > 0.05) throw new Error(`物差しが合わない: sectors.json ${anchor} / src ${STRUCTURE.usdPerT}`);

function play(seed) {
  const g = sim.newGame(seed, { nations: Number(natS) });
  g.productivity = Number(prodS);
  const rows = [];
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    for (const s of g.colonizedSystems()) {
      let pop = 0, usdPop = 0;
      const sh = { farm: 0, mine: 0, ind: 0, hi: 0, serv: 0, home: 0 }; // hi = 高付加価値の工業 (回 KE5。工業に数える)
      for (const c of g.coloniesIn(s.id)) {
        if (!c.sh) continue;
        usdPop += g.incomeUSD(c) * c.pop; // 入植地ごとの 1 人あたりの実質の所得 (ゲームの中と同じ定義) を人口で重みづける
        pop += c.pop;
        for (const x of Object.keys(sh)) sh[x] += c.pop * (c.sh[x] || 0);
      }
      if (!(pop > 0) || !(usdPop > 0)) continue;
      const usd = usdPop / pop;
      rows.push([`${seed}-${s.id}`, seed, Math.round(g.year), usd, pop, (sh.farm + sh.home) / pop, (sh.mine + sh.ind + sh.hi) / pop, sh.serv / pop]); // 農業 = 市場の農業 + 自給 (ILO の数え方)
    }
  }
  return rows;
}

const t0 = Date.now();
const lines = ['iso3,galaxy,year,gdppc,pop,agr,ind,srv'];
for (let i = 1; i <= Number(nS); i++) {
  for (const r of play(String(i))) lines.push(r.map((v) => (typeof v === 'number' && !Number.isInteger(v) ? v.toPrecision(7) : v)).join(','));
  process.stderr.write(`銀河 ${i}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${out}: ${lines.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国、開始時の生産性 ×${prodS})`);
