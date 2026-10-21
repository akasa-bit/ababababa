// 研究の年次パネルを書き出す (目標 R11)。画面なしの版で銀河を回し、国 (首都) ごと・年ごとに 1 行。
// 同じ台本 data/build/build_ideas.py (--game) を、現実の Bloom ほか 2020 の計算とこのパネルの両方にかける。ゲームの中身は変えない。
// 列: country = 銀河-首都、year、dlnA = その年の技術の伸び (分野ごとの Δln A_f を、その年の部門の付加価値で重みづけた平均)、
//     researchers = その年の研究者の数 [人] (年の終わりの値)、start = 国が試合の始めからあるか (1/0)
// 使い方: node tools/research-panel.js <出力.csv> [銀河の数] [年数] [国の数] [値のファイル.json]
const fs = require('fs');
const H = require('./headless');

const [out = 'research-panel.csv', nS = '30', yS = '150', natS = '6', paramFile] = process.argv.slice(2);
const params = paramFile && paramFile !== '-' ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null;
const sim = H.load({ params, ...(process.env.HTML ? { src: process.env.HTML } : {}) }); // HTML=… で別の版 (main など) を測れる
const { RESEARCH } = sim.tables;

function play(seed) {
  const g = sim.newGame(seed, { nations: Number(natS) });
  const rows = [];
  let prev = {}, first = null;
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    first ??= new Set(Object.keys(g.tech));
    // 国ごとの部門の付加価値 (重み)
    const va = {};
    for (const c of g.colonies) {
      const root = g.realmOf(c.sys), V = (va[root] ??= { farm: 0, mine: 0, ind: 0 });
      const sh = c.sh, w = g.wagesOf(c);
      if (!sh) continue;
      for (const f of RESEARCH.fields) V[f] += c.pop * sh[f] * w[f];
    }
    const cur = {};
    for (const [key, T] of Object.entries(g.tech)) {
      cur[key] = { ...T.A };
      const p = prev[key];
      if (!p) continue;
      const V = va[key] || { farm: 1, mine: 1, ind: 1 }, tot = V.farm + V.mine + V.ind;
      const dln = RESEARCH.fields.reduce((k, f) => k + (tot > 0 ? V[f] / tot : 1 / 3) * (Math.log(T.A[f]) - Math.log(p[f])), 0);
      rows.push([`${seed}-${key}`, seed, Math.round(g.year), dln, T.S || 0, first.has(key) ? 1 : 0]);
    }
    prev = cur;
  }
  return rows;
}

const t0 = Date.now();
const lines = ['country,galaxy,year,dlnA,researchers,start'];
for (let i = 1; i <= Number(nS); i++) {
  for (const r of play(String(i))) lines.push(r.map((v) => (typeof v === 'number' && !Number.isInteger(v) ? v.toPrecision(8) : v)).join(','));
  process.stderr.write(`銀河 ${i}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${out}: ${lines.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
