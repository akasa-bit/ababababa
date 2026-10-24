// お金の保存の試験 (段 4)。conserve.js と同じく、1 年ごとに次を確かめる。
//   - 全体: (お金の総額の増加) ÷ 取扱量 (出入りの絶対値の合計) が 1e-9 以下。総額 = 政府の資金 + 星系の家計 + 星系の会社 + 先住民 + 運ぶ途中 − 銀行の貸出
//     (政府は国債の分を銀行から借りる。政府の額は 資金 − 国債)
//     (家計・会社・先住民は払えない分を銀行から借りる。銀行は貸すと同時に預金を作るので、お金の量は貸出の分だけ増え、純額は変わらない)
//     (会社は売上をすべて賃金と配当として家計に渡すので、手持ちは 0。借りは輸入の先払いの分だけ。段 5 の 3)
//     (運ぶ途中 = 物資移送要求の先払い・朝貢と資金援助・返事に添えた額・入植船と準備中の入植船の開拓資金)
//   - 帳簿ごと: 政府・家計・会社・先住民・運ぶ途中のそれぞれで、記帳した出入りの合計 = 額の増加 (記帳しないで書き換える所がない)
//   - 種類ごと: 出入りの種類ごとに、すべての帳簿の合計が 0 (どこかから出た分は、どこかへ入る)。交易は輸入 (import) と輸出 (trade) を合わせて見る
//   - 出入りの種類が決まったものだけであること
// 使い方: node tools/tests/money.js [シード] [年数] [国の数]   (画面なしの版で回す。HTML=… で版を選ぶ)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [
  { args: ['5', '150'], judge: (o) => (o.trim().split('\n')[0].includes('お金の保存 合格') && o.includes('決まっていない出入り: なし') ? '' : 'お金の保存 不合格') },
  { args: ['7', '150', '6'], judge: (o) => (o.trim().split('\n')[0].includes('お金の保存 合格') && o.includes('決まっていない出入り: なし') ? '' : 'お金の保存 不合格 (6 か国)') },
];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '5', years = '150', nations = '0'] = process.argv.slice(2);
const KINDS = ['tax', 'natives', 'upkeep', 'build', 'trade', 'import', 'tribute', 'grant', 'treaty', 'interest', 'welfare', 'security', 'military', 'education', 'public', 'wages', 'spend', 'ctax', 'tariff', 'default', 'pension', 'health', 'housing', 'dividend', 'freight'];
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const g = sim.newGame(seed, { nations: Number(nations) });
const holdings = () => {
  const h = { gov: 0, hh: 0, fm: 0, nat: 0, way: 0 };
  let loan = 0;
  for (const v of Object.values(g.govs)) {
    h.gov += (v.credits || 0) - (v.bond || 0); loan += v.bond || 0; if (v.bond < 0) h.bad = true;
    h.hh += (v.hh || 0) - (v.hloan || 0) - (v.hm || 0); loan += (v.hloan || 0) + (v.hm || 0); if (v.hh < 0 || v.hloan < 0 || v.hm < 0) h.bad = true;
    h.fm += (v.fm || 0) - (v.loan || 0) - (v.bl || 0); loan += (v.loan || 0) + (v.bl || 0); if (v.fm < 0 || v.loan < 0 || v.bl < 0) h.bad = true;
    if (v.pv !== undefined) h.bad = true; // 前の版の帳簿が残っていない
  }
  for (const st of Object.values(g.natives)) { h.nat += (st.cr || 0) - (st.loan || 0); loan += st.loan || 0; if (st.cr < 0 || st.loan < 0) h.bad = true; }
  h.loan = loan;
  for (const q of g.requests) h.way += (q.kind === 'trade' ? q.pre : q.kind === 'tribute' || q.kind === 'grant' ? q.amt : 0) || 0;
  for (const d of g.decisions) h.way += d.cr || 0;
  for (const s of g.ships) h.way += s.seed || 0;
  for (const j of g.projects) h.way += j.seed || 0;
  for (const r of g.refunds || []) h.way += r.v || 0; // 光速で届く途中の返金 (回 KE3)
  return h;
};
let worst = 0, worstAt = '', worstAcct = 0, worstAcctAt = '', worstKind = 0, worstKindAt = '', bad = new Set(), through = 0;
const totals = {};
for (let y = 0; y < Number(years); y++) {
  const h0 = holdings();
  sim.evaluate('MONEY_AUDIT = {}');
  for (let i = 0; i < 4; i++) g.advance(0.25);
  const h1 = holdings(), A = sim.evaluate('MONEY_AUDIT');
  sim.evaluate('MONEY_AUDIT = null');
  let abs = 0;
  const byAcct = { gov: 0, hh: 0, fm: 0, nat: 0, way: 0 };
  for (const [k, f] of Object.entries(A)) {
    if (!KINDS.includes(k)) bad.add(k);
    for (const [t, v] of Object.entries(f)) { abs += Math.abs(v); byAcct[t] += v; totals[k] = (totals[k] || 0) + Math.abs(v) / 2; }
  }
  through += abs;
  const at = `${g.year.toFixed(0)} 年`;
  const sum = (h) => h.gov + h.hh + h.fm + h.nat + h.way;
  if (h1.bad) bad.add('手持ちか借りがマイナス');
  const q = abs ? Math.abs(sum(h1) - sum(h0)) / abs : Math.abs(sum(h1) - sum(h0));
  if (q > worst) { worst = q; worstAt = at; }
  for (const t of Object.keys(byAcct)) {
    const e = abs ? Math.abs(h1[t] - h0[t] - byAcct[t]) / abs : Math.abs(h1[t] - h0[t]);
    if (e > worstAcct) { worstAcct = e; worstAcctAt = `${at} ${t}`; }
  }
  const fam = {};
  for (const [k, f] of Object.entries(A)) { const n = k === 'import' ? 'trade' : k; fam[n] = (fam[n] || 0) + Object.values(f).reduce((a, v) => a + v, 0); }
  for (const [k, v] of Object.entries(fam)) { const e = abs ? Math.abs(v) / abs : Math.abs(v); if (e > worstKind) { worstKind = e; worstKindAt = `${at} ${k}`; } }
}
const e = (v) => Number(v).toExponential(2);
const h = holdings();
const ok = !bad.size && worst <= 1e-9 && worstAcct <= 1e-9 && worstKind <= 1e-9 && !bad.size;
console.log(`${years} 年・入植地 ${g.colonies.length} ・ お金の保存 ${ok ? '合格' : '不合格'}`);
console.log(`  総額の誤差 ÷ 取扱量の最大 ${e(worst)} (${worstAt})`);
console.log(`  帳簿ごとの誤差 ${e(worstAcct)} (${worstAcctAt}) ・ 種類ごとの誤差 ${e(worstKind)} (${worstKindAt})`);
console.log(`  決まっていない出入り: ${bad.size ? [...bad].join(', ') : 'なし'}`);
console.log(`  終わりの額 [cr]: 政府 ${Math.round(h.gov)} / 家計 (預金 − 借り) ${Math.round(h.hh)} / 会社 (手持ち − 借り) ${Math.round(h.fm)} / 先住民 ${Math.round(h.nat)} / 運ぶ途中 ${Math.round(h.way)} / 銀行の貸出 ${Math.round(h.loan)}`);
console.log('  種類ごとの取扱量 [cr]:', Object.entries(totals).map(([k, v]) => `${k} ${Math.round(v)}`).join(' / '));
