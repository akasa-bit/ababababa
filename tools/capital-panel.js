// 投資と資本の国・年のパネル (目標 R78・R79。回 KE6・B-119)。同じ台本 data/build/build_capital.py --game で測る。
// ゲームの中身は変えない (出入りの関数を道具の側で包んで数えるだけ)。国 (首都とその従属星系) ごと・年ごとに 1 行:
//   pop    = 国の人口 [100 万人]
//   income = 国の 1 人あたりの実質の所得 [2011 年の国際ドル] (incomeUSD の、人口の重みの、その年の刻みの平均。R65 と同じ)
//   gdp    = 民間の付加価値 (その年の刻みごとの所得 c.incY × 刻みの年数の合計) + 政府が民間から買った分 (tools/fiscal-panel.js と同じ定義。建設はここに入る)
//   inv    = 投資 ÷ gdp [%]。投資 = その年に家計と会社が受け取った建設の代金 (お金の種類 build: 政府の建設の賃金と資材・民間の採掘の能力。入植船が運んで着いた
//            開拓資金は除く) + 会社の資本の投資 (お金の種類 invest。利潤の使い道なので gdp には足さない)
//   ky     = 国の会社の資本の合計 (年の終わりの gv.K) ÷ gdp
// 使い方: node tools/capital-panel.js <出力.csv> [銀河の数=30] [年数=150] [国の数=6]   (HTML=… で版を選ぶ)
const fs = require('fs');
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));

const [out = 'capital-panel.csv', nS = '30', yS = '150', natS = '6'] = process.argv.slice(2);
const GOV_BUY = new Set(['build', 'upkeep', 'welfare', 'security', 'military', 'education', 'public', 'health']); // tools/fiscal-panel.js と同じ
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});

function play(seed) {
  const g = sim.newGame(seed, { nations: Number(natS) });
  const acc = {};
  const A = (id) => (acc[id] ??= { inc: 0, buy: 0, inv: 0, yr: 0, pp: 0 });
  const cash = g.cash.bind(g);
  let seedMove = false; // 入植船の開拓資金 (運ぶ途中から着いた星系の家計へ) は投資に数えない
  g.cash = (kind, v, acct) => {
    if (kind === 'build' && acct.way !== undefined && v < 0) seedMove = true;
    else if (acct.hh !== undefined || acct.fm !== undefined) {
      const id = acct.hh ?? acct.fm;
      if (GOV_BUY.has(kind) && v > 0) A(id).buy += v;
      if (kind === 'build' && v > 0) { if (seedMove) seedMove = false; else A(id).inv += v; }
      if (kind === 'invest' && v > 0 && acct.hh !== undefined) A(id).inv += v;
    }
    return cash(kind, v, acct);
  };
  const eco = g.economy.bind(g);
  g.economy = (h) => {
    const r = eco(h);
    for (const c of g.colonies) { const a = A(c.sys); a.inc += (c.incY || 0) * h; if (c.pop > 0) { a.yr += c.pop * g.incomeUSD(c); a.pp += c.pop; } }
    return r;
  };
  const rows = [];
  for (let y = 0; y < Number(yS); y++) {
    for (const k of Object.keys(acc)) delete acc[k];
    sim.run(g, 1);
    const R = {};
    for (const key of Object.keys(g.govs)) {
      const id = Number(key);
      if (!g.isColonized(id)) continue;
      const o = (R[g.realmOf(id)] ??= { gdp: 0, inv: 0, K: 0, pop: 0, yr: 0, pp: 0 }), a = acc[id] || { inc: 0, buy: 0, inv: 0, yr: 0, pp: 0 };
      o.gdp += a.inc + a.buy; o.inv += a.inv; o.K += g.govs[key].K || 0; o.yr += a.yr; o.pp += a.pp;
      o.pop += g.coloniesIn(id).reduce((k, c) => k + c.pop, 0);
    }
    for (const [realm, o] of Object.entries(R)) {
      if (!(o.gdp > 0)) continue;
      rows.push([Math.round(g.year), `${seed}-${realm}`, seed, o.pop, o.pp > 0 ? o.yr / o.pp : 0, o.gdp, (100 * o.inv) / o.gdp, o.K / o.gdp]);
    }
  }
  return rows;
}

const t0 = Date.now();
const lines = ['year,country,galaxy,pop,income,gdp,inv,ky'];
for (let i = 1; i <= Number(nS); i++) {
  for (const r of play(String(i))) lines.push(r.map((v) => (typeof v === 'number' && !Number.isInteger(v) ? v.toPrecision(6) : v)).join(','));
  process.stderr.write(`銀河 ${i}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${out}: ${lines.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
