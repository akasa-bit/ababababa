// 物価の目標・量的緩和・金融抑圧・債務の再編・物価の外れの政治の損 (回 KE9・B-009・QD-27 = b) の試験。画面なしの版で回す:
//   選べない値を断る・物価の目標と量的緩和はすぐ (中央銀行の決定)、金融抑圧は法案・物価の目標を上げると物価の上がり方と見込みと長期の利回りが上がる・
//   量的緩和で中央銀行の持つ国債が目標に近づき、政府は銀行の持つ分に利札・中央銀行の持つ分に政策金利 (実質) を払う (回 KE10・B-124)・
//   長期の利回りが QE.tp × 効き (中央銀行の持つ国債 ÷ GDP。GDP の 20% を超えると対数で薄れる。回 KE10) だけ下がる・
//   金融抑圧で国の政府の利子が下げた点数ぶん減り、同じ額を国の中の預金者が受け取らない (ほかの国の預金者は同じ)・利子の受け払いの合計が 0・
//   債務の再編で銀行の持つ国債と預金が同じ額だけ減り、借りられない年数が割合に比べて伸び、続けてはできない・政治力 20・
//   忠誠度と議会に物価の項 (LOSS × INFL_LOSS × |物価 − 2%|)・再編のあと 2 年、忠誠度と議会に再編の項 (回 KE10・B-125)・保存と読み込みで残る・帰着の表の足し算が 0
// 使い方: node tools/tests/debttools.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('債務の道具 合格') ? '' : '物価の目標・量的緩和・金融抑圧・債務の再編の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const { CB, QE, RESTRUCTURE, LOSS, FISCAL_DEFAULT } = sim.tables, INFL_LOSS = 1; // 数だけの値は道具の表に出ない
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const g = sim.run(sim.newGame(seed, { nations: 6 }), 40); // 観戦で国を育ててから、人間が動かす
g.setSpectate(false);
g.pc = 100;
const save = JSON.stringify(sim.buildSave(g));
const twin = () => { const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN })); h.restore(JSON.parse(save)); h.pc = 100; return h; };
const ids = (h) => h.realmSystems(h.cap).map((x) => x.id).filter((id) => h.isColonized(id) && h.govs[id]);
// 1. 選べない値・すぐ効くものと法案になるもの
res.bad = [g.setFiscal({ pistar: 0.25 }, true), g.setFiscal({ qe: 0.7 }, true), g.setFiscal({ repress: 0.05 }, true), g.restructure(0.3)].every((r) => r.ok === false);
{
  const h = twin();
  h.setFiscal({ pistar: 0.05, qe: 0.2, repress: 0.01 });
  res.route = h.fiscal?.pistar === 0.05 && h.fiscal?.qe === 0.2 && !(h.fiscal?.repress > 0) && (h.bill('fiscal')?.target.repress === 0.01 || false) && h.billText('fiscal', h.bill('fiscal').target).includes('金融抑圧');
}
// 2. 物価の目標: 10% にして 8 年。双子 (目標 2%) と比べて、物価の上がり方・見込む目標・長期の利回りが上がる
{
  const a = twin(), b = twin();
  b.setFiscal({ pistar: 0.1 }, true);
  let pa = 0, pb = 0;
  for (let i = 0; i < 32; i++) { a.advance(0.25); b.advance(0.25); if (i >= 24) { pa += a.cb[a.cap].pi / 8; pb += b.cb[b.cap].pi / 8; } }
  res.target = pb - pa > 0.04 && b.cb[b.cap].T > 0.09 && b.longYield(b.cap) > a.longYield(a.cap) && a.cb[a.cap].T === undefined;
  res.targetNums = [+(pa * 100).toFixed(2), +(pb * 100).toFixed(2), +(b.cb[b.cap].T * 100).toFixed(2)];
}
// 3. 量的緩和と金融抑圧の利子 (同じ状態から 1 刻みの利子だけを比べる。利子の式は乱数を使わない)
const withBonds = () => {
  const h = twin();
  for (const id of ids(h)) { const gv = h.govs[id]; gv.bond = Math.max(gv.bond || 0, 0.3 * (gv.fr?.y || 0)); gv.cpn = 0.05; }
  return h;
};
const flows = (h) => {
  const o = { gov: 0, priv: 0, other: 0, all: 0 }, mine = new Set(ids(h));
  // 純資産 (手持ち − 借り)。手持ちが足りない払いは借りが増えるので、手持ちだけでは受け払いが合わない
  const snap = () => { const s = {}; for (const [k, v] of Object.entries(h.govs)) { s[`g${k}`] = v.credits || 0; s[`p${k}`] = (v.hh || 0) + (v.fm || 0) - (v.loan || 0) - (v.hloan || 0) - (v.hm || 0) - (v.bl || 0); } for (const [k, st] of Object.entries(h.natives)) s[`n${k}`] = (st.cr || 0) - (st.loan || 0); return s; };
  const s0 = snap();
  h.interestStep(0.25);
  const s1 = snap();
  for (const k of Object.keys(s1)) {
    const d = s1[k] - (s0[k] || 0), id = Number(k.slice(1).split('|')[0]);
    o.all += d;
    if (!mine.has(id)) o.other += d; else if (k[0] === 'g') o.gov += d; else o.priv += d;
  }
  return o;
};
{
  const a = withBonds(), b = withBonds(), c = withBonds();
  // 量的緩和: 中央銀行が首都の国債の 4 割を持つ
  const gb = b.govs[b.cap], q = 0.4 * gb.bond, rate = b.bondRate(b.cap), pr = b.rateAt(b.cap);
  const y0 = b.longYield(b.cap);
  gb.qb = q; gb.qbB = gb.bond;
  const x = Math.min(q / gb.fr.y, CB.dmax);
  res.qeYield = near(y0 - b.longYield(b.cap), QE.tp * QE.scale * Math.log(1 + x / QE.scale), 1e-9) && QE.scale * Math.log(1 + x / QE.scale) <= x;
  const ca = a.govs[a.cap].credits, cb0 = gb.credits;
  const fa = flows(a), fb = flows(b);
  // 首都の政府は q × (実質の利札 − 実質の政策金利) × 刻み だけ利子が減る (中央銀行の持つ分は政策金利。回 KE10。受け取る預金の利子は、払う人が減ったぶん少し減る)
  const dq = (gb.credits - cb0) - (a.govs[a.cap].credits - ca);
  const save = q * (rate - pr) * 0.25;
  res.qeInterest = (save > 0 ? dq > 0.5 * save && dq < 1.5 * save : dq < 0.5 * Math.abs(save)) && near(fa.all, 0, 1e-6) && near(fb.all, 0, 1e-6);
  res.qeIntNums = [+rate.toFixed(4), +pr.toFixed(4), +dq.toFixed(2), +save.toFixed(2), +fa.all.toFixed(6), +fb.all.toFixed(6)];
  // 金融抑圧: 2 点。行政の遅れのあとに効く (比べる双子 a2 は、まだ利子を受け払いしていないもの)
  const a2 = withBonds();
  c.setFiscal({ repress: 0.02 }, true);
  for (const h of [a2, c]) h.year += 1; // 遅れ (0.5 年) を過ぎたことにする (利子の式だけを見るので、ほかは進めない)
  const ra = flows(a2), rc = flows(c);
  const cut = ids(c).reduce((s, id) => s + Math.max(0, (c.govs[id].bond || 0) - (c.govs[id].qb || 0)) * 0.02 * 0.25, 0);
  // 国の中で、預金者 (家計・会社・先住民) が受け取らない分が政府に移る (政府は自分の預金の受け取りも減るので、cut より少し少なく得る)・ほかの国は同じ・全体は 0
  const dg = rc.gov - ra.gov, dp = rc.priv - ra.priv;
  res.repress = cut > 0 && near(rc.all, 0, 1e-6) && near(rc.other, ra.other, 1e-6) && dg > 0 && dg <= cut + 1e-6 && near(dg + dp, 0, 1e-6);
  res.repressNums = [+cut.toFixed(2), +dg.toFixed(2), +dp.toFixed(2), +(rc.other - ra.other).toFixed(4)];
}
// 4. 量的緩和の買い入れ: 1 年で目標の割合に近づく (返した分は買い入れに数えない)
{
  const h = withBonds();
  h.setFiscal({ qe: 0.5 }, true);
  for (let i = 0; i < 8; i++) h.advance(0.25);
  const gv = h.govs[h.cap];
  res.qeBuy = gv.bond > 0 ? gv.qb / gv.bond > 0.35 && gv.qb <= gv.bond + 1e-9 : true;
  res.qeNums = [+(gv.bond || 0).toFixed(0), +(gv.qb || 0).toFixed(0)];
}
// 5. 債務の再編
{
  const h = withBonds();
  const B = ids(h).reduce((s, id) => s + Math.max(0, h.govs[id].bond - (h.govs[id].qb || 0)), 0);
  const dep = () => Object.values(h.govs).reduce((s, v) => s + Math.max(0, v.credits) + Math.max(0, v.hh || 0) + Math.max(0, v.fm || 0), 0) + Object.values(h.natives).reduce((s, st) => s + Math.max(0, st.cr || 0), 0);
  const d0 = dep(), pc = h.pcCost('restructure', { hc: 0.5 });
  const r = h.command('restructure', { hc: 0.5 });
  const B1 = ids(h).reduce((s, id) => s + Math.max(0, h.govs[id].bond - (h.govs[id].qb || 0)), 0);
  const gc = h.govs[h.cap];
  res.restructure = r.ok && pc === RESTRUCTURE.pc && near(B - B1, 0.5 * B, 1e-6) && near(d0 - dep(), 0.5 * B, 1e-6) && h.dfltOut(gc) && gc.hc === 0.5 && h.restructure(0.25).ok === false;
  // 利回りの上乗せは払わなかった割合に比べる (2 年目: 割合 × spread[0] × 下がり方)。借りられない年数は CB.exclude × 割合 ÷ CB.haircut
  h.year = gc.dflt + 2;
  const sp = near(h.dfltSpread(gc), 0.5 * CB.spread[0] * Math.exp(-Math.log(CB.spread[0] / CB.spread[1]) / 3.5), 1e-9);
  h.year = gc.dflt + (CB.exclude * 0.5) / CB.haircut - 0.01;
  const still = h.dfltOut(gc);
  h.year += 0.02;
  res.exclude = sp && still && !h.dfltOut(gc);
  // 再編の政治の損 (回 KE10・B-125): 家臣の忠誠度の目標に「債務の再編」の項 (LOSS.loyalty × 損の割合)、議会の支持も同じ損で下がり、RESTRUCTURE.years 年で消える
  const v = ids(h).find((id) => h.gov(id).lord !== null && h.gov(id).lord !== undefined), L = RESTRUCTURE.loss * (0.5 / CB.haircut);
  h.year = gc.dflt + 0.5;
  const t1 = v !== undefined ? h.loyaltyTerms(v).find((x) => x.label === '債務の再編') : null, l1 = h.rsxLoss(h.cap);
  h.cb[h.cap].pi = CB.pistar; // 物価の項を消して、議会の再編の分だけを見る
  const c0 = (h.council = 50);
  h.councilYearly();
  const lossC = LOSS.council * (Object.values(h.policyLoss(h.cap)).reduce((a, x) => a + x, 0) + L * 0.75);
  const council = near(h.council, Math.max(0, Math.min(100, c0 - 0.25 * h.modsOf(h.cap).councilDrift + lossC)), 1e-6);
  h.year = gc.dflt + RESTRUCTURE.years + 0.01;
  const gone = h.rsxLoss(h.cap) === 0 && (v === undefined || !h.loyaltyTerms(v).some((x) => x.label === '債務の再編'));
  res.rsx = near(l1, L * 0.75, 1e-9) && (v === undefined || near(t1?.v, LOSS.loyalty * L * 0.75, 1e-9)) && council && gone;
  res.rsxNums = [+l1.toFixed(4), t1 ? +t1.v.toFixed(2) : null, +h.council.toFixed(2)];
}
// 6. 物価の項 (忠誠度と議会)
{
  const h = twin(), v = ids(h).find((id) => h.gov(id).lord !== null && h.gov(id).lord !== undefined);
  h.cb[h.cap].pi = 0.08;
  const t = v !== undefined ? h.loyaltyTerms(v).find((x) => x.label.startsWith('物価の上がり方')) : null;
  const c0 = h.council = 50;
  h.councilYearly();
  const lossC = LOSS.council * (Object.values(h.policyLoss(h.cap)).reduce((a, x) => a + x, 0) + INFL_LOSS * 0.06);
  res.infl = (v === undefined || near(t?.v, LOSS.loyalty * INFL_LOSS * 0.06, 1e-9)) && near(h.council, Math.max(0, Math.min(100, c0 - 0.25 * h.modsOf(h.cap).councilDrift + lossC)), 1e-6);
}
// 7. 保存と読み込み・帰着の表
{
  const h = withBonds();
  h.setFiscal({ pistar: 0.06, qe: 0.3, repress: 0.015 }, true);
  for (let i = 0; i < 4; i++) h.advance(0.25);
  const d = JSON.parse(JSON.stringify(sim.buildSave(h)));
  const h2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  h2.restore(d);
  res.saveLoad = JSON.stringify(h2.fiscal) === JSON.stringify(h.fiscal) && h2.cb[h2.cap].T === h.cb[h.cap].T && h2.govs[h2.cap].qb === h.govs[h.cap].qb;
  const rows = h.incidenceOf(h.cap, h.fiscal, FISCAL_DEFAULT);
  res.incidence = rows.every((r) => near(r.hh + r.fm + r.gov + r.row, 0, 1e-9)) && rows.some((r) => r.k === 'repress' && r.gov > 0 && near(r.row, 0, 1e-6));
}
const ok = Object.entries(res).filter(([k]) => !k.endsWith('Nums')).every(([, v]) => v === true);
console.log(`債務の道具 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
process.exitCode = ok ? 0 : 1;
