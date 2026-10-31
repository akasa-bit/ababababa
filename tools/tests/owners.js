// 国有化・民営化・資本規制 (回 KE9・B-011) の試験。画面なしの版で回す:
//   選べない値を断る・どちらも法案になる・国有化で国有の割合が目標になり、補償 (割合の差 × 会社の資本) を国債で払い、地元の家計と遠くの持ち主が持ち分に比べて受け取る・
//   国の純資産の合計 (政府・民間・先住民・運ぶ途中) は変わらない・国有の分の配当は政府に入る・国有の割合だけ工業と採掘の生産性が下がる・
//   民営化で家計が買い、政府の資金が増える・資本規制でほかの国の持ち分の目標が下がり、国の外への投資も減る・保存と読み込み
// 使い方: node tools/tests/owners.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('国有化と資本規制 合格') ? '' : '国有化・民営化・資本規制の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const { SOE } = sim.tables;
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const g = sim.run(sim.newGame(seed, { nations: 6 }), 40);
g.setSpectate(false);
g.pc = 100;
const save = JSON.stringify(sim.buildSave(g));
const twin = () => { const h = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN })); h.restore(JSON.parse(save)); h.pc = 100; return h; };
const ids = (h) => h.realmSystems(h.cap).map((x) => x.id).filter((id) => h.isColonized(id) && h.govs[id]);
// 国のすべての純資産 (政府の資金 − 国債・家計と会社の手持ち − 借り・先住民・運ぶ途中の返金と配当)
const worth = (h) => {
  let w = 0;
  for (const v of Object.values(h.govs)) w += (v.credits || 0) - (v.bond || 0) + (v.hh || 0) + (v.fm || 0) - (v.loan || 0) - (v.hloan || 0) - (v.hm || 0) - (v.bl || 0);
  for (const st of Object.values(h.natives)) w += (st.cr || 0) - (st.loan || 0);
  for (const r of h.refunds || []) w += r.v || 0;
  return w;
};
// 1. 選べない値・法案
res.bad = g.setFiscal({ soe: 0.85 }, true).ok === false && g.setFiscal({ capctl: 0.3 }, true).ok === false;
{
  const h = twin();
  h.setFiscal({ soe: 0.5, capctl: 0.5 });
  const b = h.bill('fiscal');
  res.bill = !!b && b.target.soe === 0.5 && b.target.capctl === 0.5 && !(h.fiscal?.soe > 0) && h.billText('fiscal', b.target).includes('国有');
}
// 2. 国有化
{
  const h = twin();
  const id = h.cap, gv = h.govs[id], K = gv.K || 0;
  const own0 = { ...(gv.own || {}) }, foreign0 = Object.values(own0).reduce((a, s) => a + s, 0);
  const w0 = worth(h), b0 = ids(h).reduce((a, x) => a + (h.govs[x].bond || 0), 0), hh0 = gv.hh;
  const y0 = h.yieldOf(h.coloniesIn(id)[0], 'ind');
  h.setFiscal({ soe: 0.4 }, true);
  h.year += 1; // 行政の遅れ (0.47 年) を過ぎたことにする (遠い星系は光の遅れでまだ)
  const on = ids(h).filter((x) => h.fiscalFor(h.cap, x).soe === 0.4), C = on.reduce((a, x) => a + 0.4 * (h.govs[x].K || 0), 0); // 補償 = 割合の差 × 会社の資本
  h.soeStep();
  const b1 = ids(h).reduce((a, x) => a + (h.govs[x].bond || 0), 0);
  res.nationalize = near(gv.soe, 0.4) && b1 > b0 && near(b1 - b0, C, 1e-6) && near(worth(h), w0, 1e-6) && gv.hh > hh0
    && Object.entries(own0).every(([o, s]) => near(gv.own?.[o] || 0, s * 0.6, 1e-9)) && near(1 - (gv.soe || 0) - Object.values(gv.own || {}).reduce((a, s) => a + s, 0), (1 - foreign0) * 0.6, 1e-9);
  res.nums = [+K.toFixed(0), +(b1 - b0).toFixed(0), +foreign0.toFixed(3)];
  res.productivity = near(h.yieldOf(h.coloniesIn(id)[0], 'ind'), y0 * (1 - SOE.eff * 0.4), 1e-9);
  // 配当: 国有の分の配当が首都の政府に入る (この銀河の首都の会社は借りが大きく配当を出していないので、手持ちを持たせて 1 刻み進め、分け方だけを見る)
  gv.loan = 0; gv.fm = 1e6;
  const d0 = gv.led?.dividend || 0;
  h.advance(0.25);
  res.dividend = (gv.led?.dividend || 0) - d0 > 0 || (h.govs[id].ledger?.dividend || 0) > 0;
  // 民営化: 0.4 → 0.1。家計が 0.3 × 資本を払い、政府の資金が同じだけ増える
  const c0 = gv.credits, w1 = worth(h);
  h.setFiscal({ soe: 0.1 }, true);
  h.year += 1;
  const K2 = gv.K || 0;
  h.soeStep();
  res.privatize = near(gv.soe, 0.1) && near(gv.credits - c0, 0.3 * K2, 1e-6) && near(worth(h), w1, 1e-6);
  // 保存と読み込み
  const d = JSON.parse(JSON.stringify(sim.buildSave(h)));
  const h2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  h2.restore(d);
  res.saveLoad = h2.govs[id].soe === gv.soe && h2.fiscal.soe === 0.1;
}
// 3. 資本規制: 10 年で、国の星系のほかの国の持ち分が双子より下がる (目標 × (1 − 規制))
{
  const a = twin(), b = twin();
  b.setFiscal({ capctl: 1 }, true);
  for (let i = 0; i < 40; i++) { a.advance(0.25); b.advance(0.25); }
  const fsh = (h) => ids(h).reduce((s, x) => s + Object.values(h.govs[x].own || {}).reduce((t, v) => t + v, 0), 0) / ids(h).length;
  // 国の外への持ち分 (ほかの国の星系のうち、この国が持つ分)
  const out = (h) => Object.entries(h.govs).filter(([k]) => h.isColonized(Number(k)) && h.realmOf(Number(k)) !== h.cap).reduce((s, [, v]) => s + Object.entries(v.own || {}).filter(([o]) => h.realmOf(Number(o)) === h.cap).reduce((t, [, x]) => t + x, 0), 0);
  res.capctl = fsh(b) < fsh(a) && out(b) < out(a);
  res.capNums = [+fsh(a).toFixed(4), +fsh(b).toFixed(4), +out(a).toFixed(4), +out(b).toFixed(4)];
}
const ok = Object.entries(res).filter(([k]) => !k.endsWith('Nums') && k !== 'nums').every(([, v]) => v === true);
console.log(`国有化と資本規制 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
process.exitCode = ok ? 0 : 1;
