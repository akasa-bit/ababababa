// 財政と金融の年次パネルを、Jordà–Schularick–Taylor (JST) と同じ列で書き出す (目標 R19〜R22・R27・R28)。
// 画面なしの版で銀河を回し、国 (首都とその従属星系の政府をまとめた一般政府) ごと・年ごとに 1 行。
// 同じ分析の台本 data/build/analyze_fiscal.py を、現実の JST とこのパネルの両方にかける。
// ゲームの中身は変えない (出入りの関数を道具の側で包んで数えるだけ)。定義は docs/fiscal.md の 3。
//   gdp         = 民間の付加価値 + 政府が民間から買った分 (建設・維持費・予算。費用で測る)。民間の付加価値は、市場のある版は税の土台と同じ所得
//                 (物の産出 × 市場の値段 − 工業の投入 + サービス。incomeOf)、ない版は採掘・収穫と工業の産出 − 工業の投入 (基準価格)
//   revenue     = 税 (所得への税・消費税・関税) + 先住民からの収入 + 預金の利子
//   expenditure = revenue − 政府の純貸出 (国の政府の資金の増加。国の中の朝貢・資金援助・交易は差し引きで消える)
//   debtgdp     = 政府の総債務 (国債の残高の合計。資金がマイナスの政府があれば、そのマイナス分も) ÷ gdp
//   tloans      = 国の星系の会社 (在庫の分) と家計と先住民の、銀行からの借り
//   ltrate      = 国の長期の国債の利回り [%/年] (政府ごとの longYield を国債の額で重みをつけた平均。国債がなければ首都の値)。中央銀行のない前の版は国の利子率
//   stir        = 国の政策金利 [%/年] (首都の中央銀行。回 KE1)。前の版は ltrate と同じ
//   cpi         = 国の物価の指数 (cpiOf。前の版は 1)
//   rgdpbarro   = gdp (帳簿は基準の値段 (実質) なので、実質の GDP)
//   名目と実質: ゲームの帳簿は実質なので、利子の受け払いは実質の利子率 (名目 − 物価の上がり方) で行われる。JST と同じ名目の収支にするため、
//                expenditure に 物価の上がり方 × 国債、revenue に 物価の上がり方 × 政府の預金 を足す (名目の利子のうち、物価の目減りを埋める分)
//   war         = その年の終わりに、国がどこかと戦争をしていれば 1
//   pop         = 国の人口 [100 万人] (JST にはない列。小さな国を除いて見るときに使う。analyze_fiscal.py は使わない)
// 使い方: node tools/fiscal-panel.js <出力.csv> [銀河の数] [年数] [国の数] [値のファイル.json]
const fs = require('fs');
const path = require('path');
const H = require('./headless');

const [out = 'fiscal-panel.csv', nS = '30', yS = '150', natS = '6', paramFile] = process.argv.slice(2);
const params = paramFile ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null;
const GOV_BUY = new Set(['build', 'upkeep', 'welfare', 'security', 'military', 'public', 'health']); // 医療 (回 KE2) は政府が会社から買うので GDP に入る。年金は移転なので入れない
const REVENUE = new Set(['tax', 'ctax', 'tariff', 'natives', 'interest']);
const VALUE = new Set(['extract', 'make', 'use', 'burn']);
const sim = H.load({ params, ...(process.env.HTML ? { src: process.env.HTML } : {}) }); // HTML=… で別の版 (main など) を測れる // 1 回だけ読み込む (回している途中で src が書き換わっても、同じ版で回す)
const { PRICE } = sim.tables;

function play(seed) {
  const g = sim.newGame(seed, { nations: Number(natS) });
  const acc = {}; // 星系ごとの 1 年の足し上げ { va, buy, rev, flow }
  const A = (id) => (acc[id] ??= { va: 0, buy: 0, rev: 0, flow: 0 });
  const mv = g.mv.bind(g), earn = g.earn.bind(g), cash = g.cash.bind(g);
  g.mv = (sys, res, amt, kind) => { if (VALUE.has(kind)) A(sys).va += amt * (g.price ? g.price(sys, res) : PRICE[res]); return mv(sys, res, amt, kind); }; // その星系の市場の値段 (段 5)
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
    else if ((acct.hh !== undefined || acct.fm !== undefined || acct.pv !== undefined) && GOV_BUY.has(kind) && v > 0) A(acct.hh ?? acct.fm ?? acct.pv).buy += v;
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
      const R = (realms[g.realmOf(id)] ??= { gdp: 0, revenue: 0, flow: 0, debt: 0, tloans: 0, pop: 0, yl: 0, bonds: 0, infl: 0 });
      const a = acc[id] || { va: 0, buy: 0, rev: 0, flow: 0 }, gv = g.govs[key];
      // 民間の付加価値: 市場のある版は、税の土台と同じ所得 (サービスを含む。incomeOf) を年の終わりの値で。ない版は、産出 × 値段の足し上げ
      const va = g.incomeOf ? g.coloniesIn(id).reduce((k, c) => k + g.incomeOf(c), 0) : a.va;
      R.gdp += va + a.buy;
      R.revenue += a.rev;
      R.flow += a.flow;
      R.debt += (gv.bond || 0) + Math.max(0, -gv.credits);
      if (g.longYield && gv.bond > 0) { R.yl += g.longYield(id) * gv.bond; R.bonds += gv.bond; }
      if (g.inflOf) R.infl += g.inflOf(id) * ((gv.bond || 0) - Math.max(0, gv.credits)); // 名目の利子のうち物価の目減りを埋める分 (払う − 受け取る)
      R.tloans += (gv.loan || 0) + (gv.hloan || 0);
      R.pop += g.coloniesIn(id).reduce((k, c) => k + c.pop, 0);
    }
    for (const [key, st] of Object.entries(g.natives)) {
      const id = Number(key.split('|')[0]);
      if (g.isColonized(id) && realms[g.realmOf(id)]) realms[g.realmOf(id)].tloans += st.loan || 0;
    }
    const war = new Set(Object.keys(g.realmWars).flatMap((k) => k.split('|').map(Number)));
    for (const [realm, R] of Object.entries(realms)) {
      if (!(R.gdp > 0)) continue;
      const r = Number(realm), stir = g.cbRateAt ? g.cbRateAt(r) : g.rateAt(r), lt = g.longYield ? (R.bonds > 0 ? R.yl / R.bonds : g.longYield(r)) : stir;
      const rev = R.revenue + Math.max(0, -R.infl), exp = R.revenue - R.flow + Math.max(0, R.infl);
      rows.push([Math.round(g.year), `${seed}-${realm}`, seed, R.gdp, rev, exp, R.debt / R.gdp, R.tloans, 100 * lt, R.gdp, war.has(r) ? 1 : 0, R.pop, 100 * stir, g.cpiOf ? g.cpiOf(r) : 1]);
    }
  }
  return rows;
}

const t0 = Date.now();
const lines = ['year,country,galaxy,gdp,revenue,expenditure,debtgdp,tloans,ltrate,rgdpbarro,war,pop,stir,cpi'];
for (let i = 1; i <= Number(nS); i++) {
  for (const r of play(String(i))) lines.push(r.map((v) => (typeof v === 'number' && !Number.isInteger(v) ? v.toPrecision(8) : v)).join(','));
  process.stderr.write(`銀河 ${i}/${nS} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
}
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${out}: ${lines.length - 1} 行 (${nS} 銀河 × ${yS} 年 × ${natS} か国)`);
