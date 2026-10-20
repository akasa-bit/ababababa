// 財政と金融の年次パネルを、Jordà–Schularick–Taylor (JST) と同じ列で書き出す (目標 R19〜R22)。
// 画面なしの版で銀河を回し、国 (首都とその従属星系の政府をまとめた一般政府) ごと・年ごとに 1 行。
// 同じ分析の台本 data/build/analyze_fiscal.py を、現実の JST とこのパネルの両方にかける。
// ゲームの中身は変えない (出入りの関数を道具の側で包んで数えるだけ)。定義は docs/fiscal.md の 3。
//   gdp         = 資源の付加価値 (採掘・収穫と工業の産出 − 工業の投入。基準価格) + 政府が民間から買った分 (建設・維持費・予算。費用で測る)
//   revenue     = 税 + 先住民からの収入 + 預金の利子
//   expenditure = revenue − 政府の純貸出 (国の政府の資金の増加。国の中の朝貢・資金援助・交易は差し引きで消える)
//   debtgdp     = 政府の総債務 (資金がマイナスの政府のマイナス分の合計) ÷ gdp
//   tloans      = 国の星系の民間と先住民の、銀行からの借り
// 使い方: node tools/fiscal-panel.js <出力.csv> [銀河の数] [年数] [国の数] [値のファイル.json]
const fs = require('fs');
const path = require('path');
const H = require('./headless');

const [out = 'fiscal-panel.csv', nS = '30', yS = '150', natS = '6', paramFile] = process.argv.slice(2);
const params = paramFile ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null;
const GOV_BUY = new Set(['build', 'upkeep', 'welfare', 'security', 'military']);
const REVENUE = new Set(['tax', 'natives', 'interest']);
const VALUE = new Set(['extract', 'make', 'use', 'burn']);
const sim = H.load({ params }); // 1 回だけ読み込む (回している途中で src が書き換わっても、同じ版で回す)
const { PRICE } = sim.tables;

function play(seed) {
  const g = sim.newGame(seed, { nations: Number(natS) });
  const acc = {}; // 星系ごとの 1 年の足し上げ { va, buy, rev, flow }
  const A = (id) => (acc[id] ??= { va: 0, buy: 0, rev: 0, flow: 0 });
  const mv = g.mv.bind(g), earn = g.earn.bind(g), cash = g.cash.bind(g);
  g.mv = (sys, res, amt, kind) => { if (VALUE.has(kind)) A(sys).va += amt * PRICE[res]; return mv(sys, res, amt, kind); };
  g.earn = (kind, amount, sys = 0, other = null) => {
    const gv = g.gov(sys), c0 = gv.credits;
    const r = earn(kind, amount, sys, other);
    const d = gv.credits - c0;
    A(sys).flow += d;
    if (REVENUE.has(kind) && d > 0) A(sys).rev += d;
    return r;
  };
  g.cash = (kind, v, acct) => {
    if (acct.gov !== undefined) A(acct.gov).flow += v;
    else if (acct.pv !== undefined && GOV_BUY.has(kind) && v > 0) A(acct.pv).buy += v;
    return cash(kind, v, acct);
  };
  const rows = [];
  for (let y = 0; y < Number(yS); y++) {
    for (const k of Object.keys(acc)) delete acc[k];
    sim.run(g, 1);
    const realms = {};
    for (const key of Object.keys(g.govs)) {
      const id = Number(key);
      if (!g.isColonized(id)) continue;
      const R = (realms[g.realmOf(id)] ??= { gdp: 0, revenue: 0, flow: 0, debt: 0, tloans: 0 });
      const a = acc[id] || { va: 0, buy: 0, rev: 0, flow: 0 }, gv = g.govs[key];
      R.gdp += a.va + a.buy;
      R.revenue += a.rev;
      R.flow += a.flow;
      R.debt += Math.max(0, -gv.credits);
      R.tloans += gv.loan || 0;
    }
    for (const [key, st] of Object.entries(g.natives)) {
      const id = Number(key.split('|')[0]);
      if (g.isColonized(id) && realms[g.realmOf(id)]) realms[g.realmOf(id)].tloans += st.loan || 0;
    }
    for (const [realm, R] of Object.entries(realms)) {
      if (!(R.gdp > 0)) continue;
      rows.push([Math.round(g.year), `${seed}-${realm}`, seed, R.gdp, R.revenue, R.revenue - R.flow, R.debt / R.gdp, R.tloans]);
    }
  }
  return rows;
}

const t0 = Date.now();
const lines = ['year,country,galaxy,gdp,revenue,expenditure,debtgdp,tloans'];
for (let i = 1; i <= Number(nS); i++) {
  for (const r of play(String(i))) lines.push(r.map((v) => (typeof v === 'number' && !Number.isInteger(v) ? v.toPrecision(8) : v)).join(','));
  process.stderr.write(`銀河 ${i}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${out}: ${lines.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
