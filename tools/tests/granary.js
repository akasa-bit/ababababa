// 政府の倉 (公的備蓄・価格の下限) と闇市 (回 KE12・B-128。docs/fiscal.md の 13) の試験。画面なしの版で回す:
//   選べない値を断る・法案になる・公的備蓄で星系の政府の倉に物がたまり、目標 (ふだんの消費 × 月数 ÷ 12) を超えない・
//   物の保存: 星系の市場の在庫 + 倉の増えは、倉との出し入れ (store・release) を除いた記帳した出入りと合う・お金の出入り (種類 granary) は合計 0・
//   価格の下限: 下限より安い資源を政府が買い、刻みのあとの値段が下限より下がらない・値段が上がると倉から売る・保存と読み込みで倉が残る
// 使い方: node tools/tests/granary.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('政府の倉 合格') ? '' : '政府の倉と闇市の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const { RESERVE_RES, MARKET } = sim.tables;
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const g = sim.run(sim.newGame(seed, { nations: 6 }), 40);
g.setSpectate(false);
g.pc = 100;
const save = JSON.stringify(sim.buildSave(g));
const twin = () => { const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN })); h.restore(JSON.parse(save)); h.pc = 100; return h; };
// 1. 選べない値・法案
{
  const h = twin();
  res.bad = h.setFiscal({ reserve: { food: 5 } }, true).ok === false && h.setFiscal({ reserve: { goods: 3 } }, true).ok === false && h.setFiscal({ floor: { food: 1.3 } }, true).ok === false;
  h.setFiscal({ reserve: { food: 6 } });
  res.bill = !!h.bill('fiscal') && h.bill('fiscal').target.reserve?.food === 6 && !(h.fiscal?.reserve?.food) && h.billText('fiscal', h.bill('fiscal').target).includes('公的備蓄');
}
// 2. 公的備蓄: 10 年。物とお金の出入りを数える
{
  const h = twin(), cap = h.cap;
  h.setFiscal({ reserve: Object.fromEntries(RESERVE_RES.map((r) => [r, 12])) }, true);
  const flows = {}, mv = h.mv.bind(h), cash = h.cash.bind(h);
  let money = 0, moneyAbs = 0;
  h.mv = (s, r, v, k) => { if (k !== 'store' && k !== 'release') { const f = (flows[s] ??= {}); f[r] = (f[r] || 0) + v; } return mv(s, r, v, k); };
  h.cash = (k, v, a) => { if (k === 'granary') { money += v; moneyAbs += Math.abs(v); } return cash(k, v, a); };
  const tot = () => { const o = {}; for (const [s, st] of Object.entries(h.stock)) for (const r of RESERVE_RES) o[`${s}|${r}`] = (st[r] || 0) + (h.gran[s]?.[r] || 0); return o; };
  const t0 = tot();
  let over = false;
  const umax = {};
  for (let i = 0; i < 40; i++) {
    h.advance(0.25);
    for (const [s, G] of Object.entries(h.gran)) for (const [r, x] of Object.entries(G)) { const k = `${s}|${r}`; umax[k] = Math.max(umax[k] || 0, h.market[s]?.u[r] || 0); if (x > (12 / 12) * umax[k] * 1.0001 + 1e-9) over = true; } // 目標はふだんの消費 (揺れる) × 12 か月 ÷ 12。消費が下がっても倉は売らないので、いちばん大きかった消費と比べる
  }
  const t1 = tot();
  let worst = 0;
  for (const k of new Set([...Object.keys(t0), ...Object.keys(t1)])) { const [s, r] = k.split('|'); const d = (t1[k] || 0) - (t0[k] || 0), f = flows[s]?.[r] || 0; worst = Math.max(worst, Math.abs(d - f) / Math.max(1, Math.abs(f))); }
  const held = Object.values(h.gran).reduce((a, G) => a + Object.values(G).reduce((b, x) => b + x, 0), 0);
  res.reserve = held > 0 && !over;
  res.mass = worst < 1e-9;
  res.money = Math.abs(money) <= 1e-9 * Math.max(1, moneyAbs) && moneyAbs > 0;
  res.reserveNums = [+held.toFixed(1), +worst.toExponential(2), +moneyAbs.toFixed(1)];
  // 保存と読み込み
  const d = JSON.parse(JSON.stringify(sim.buildSave(h)));
  const h2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  h2.restore(d);
  res.saveLoad = JSON.stringify(h2.gran) === JSON.stringify(h.gran) && h2.fiscal.reserve?.food === 12;
  // 値段がふだんより高くなったら倉から売る (首都の倉の物の 1 つで、市場の在庫を減らして値段を上げる)
  const r = Object.keys(h.gran[cap] || {})[0];
  if (r) {
    const st = h.stockOf(cap), m = h.market[cap], g0 = h.gran[cap][r];
    st[r] = 0; m.p[r] = 2 * m.L[r];
    h.granaryStep(1);
    res.release = (h.gran[cap]?.[r] || 0) < g0 && st[r] > 0;
  } else res.release = false;
}
// 3. 価格の下限: 首都の食料に下限 ×1 を置き、市場の在庫を目標の厚さの 10 倍にして値段を下げる。倉の動きのあと、値段は下限に戻る
{
  const h = twin(), cap = h.cap, m = h.market[cap], st = h.stockOf(cap), u = m.u.food, need = u * MARKET.cover.food;
  const base = h.priceAt('food', need, u); // 基準の値段 (在庫が目標の厚さのときの値段)
  h.setFiscal({ floor: { food: 1 } }, true);
  st.food = 10 * need;
  h.marketStep(1e-12);
  const low = h.price(cap, 'food') / base;
  h.granaryStep(0.25);
  h.marketStep(1e-12);
  const after = h.price(cap, 'food') / base;
  res.floor = low < 1 && after >= 1 - 1e-6 && after <= 1 + 1e-6 && (h.gran[cap]?.food || 0) > 0; // 下限にちょうど戻る (買いすぎない)
  res.floorNums = [+low.toFixed(3), +after.toFixed(3), +(h.gran[cap]?.food || 0).toFixed(1)];
}
const ok = Object.entries(res).filter(([k]) => !k.endsWith('Nums')).every(([, v]) => v === true);
console.log(`政府の倉 ${ok ? '合格' : '不合格'} ${JSON.stringify(res)}`);
process.exitCode = ok ? 0 : 1;
