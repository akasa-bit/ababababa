// データの書き出し (tools/export.js。回 DO6・B-072) の試験。画面なしの版で 1 銀河を回し、表の形と、表どうしが食い違わないことを確かめる
// 1. 表の列がコードブック (docs/export.md) にすべて載っている (列を足してコードブックを忘れると落ちる)
// 2. 交易: 国の輸出の合計 (sna の P6) = 輸入の合計 (P7) = trade.csv の額の合計。国の中の輸送 (i = j) は入れない
// 3. GFS: 収入 = 税 + 移転 + 財産所得など、支出 = 目的別 (COFOG) + 利子 + 移転、純貸出 = 収入 − 支出
// 4. 貸借: 銀行の預金 (負債) = 部門の預金の合計、銀行の準備 = 預金 − 貸出 − 国債
// 5. 政策の出来事: わざと消費税を変えた年に、地球の国の ctax の行が 1 つ出る
// 6. 戦争: どの戦争も参加国が 2 つ、始まり ≤ 終わり
// 使い方: node tools/tests/export.js [シード] [年数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('データの書き出し') }];
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const H = require('../headless');
const X = require('../export');

const [seed = '2', years = '120'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const rows = Object.fromEntries(Object.keys(X.COLS).map((k) => [k, []]));
const g = X.play(sim, seed, Number(years), 6, (t, r) => rows[t].push(r), (gg, y) => { if (y === 10) gg.setFiscal({ ctax: 0.05 }); });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
// 表の値は 8 桁に丸めてあるので、足し引きした項の大きさに比べて 1e-6 まで許す
const near = (a, b, ...terms) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b), ...terms.map(Math.abs));
const sum = (xs) => xs.reduce((a, v) => a + v, 0);

// 1. コードブック
const book = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'export.md'), 'utf8');
const cols = { ...X.COLS, prices: ['galaxy', 'year', 'system', 'country', ...sim.tables.RES] };
const missing = Object.entries(cols).flatMap(([t, cs]) => cs.filter((c) => !book.includes(`\`${c}\``)).map((c) => `${t}.${c}`));
check(!missing.length, `コードブックにない列: ${missing.join('・')}`);

// 2. 交易
const P6 = sum(rows.sna.map((r) => r.P6)), P7 = sum(rows.sna.map((r) => r.P7)), V = sum(rows.trade.map((r) => r.v));
check(near(P6, P7) && near(P6, V), `輸出 ${P6}・輸入 ${P7}・交易の表 ${V} が合わない`);
check(rows.trade.every((r) => r.i !== r.j), '国の中の輸送が交易の表に入っている');

// 3. GFS
for (const r of rows.gfs) {
  const ge = r.GF01 + r.GF02 + r.GF03 + r.GF04 + r.GF09 + r.GF10 + r.GF0107 + r.GE_TR;
  if (!near(r.GR, r.GR11 + r.GR13 + r.GR14) || !near(r.GR11, r.GR111 + r.GR114 + r.GR115) || !near(r.GE, ge) || !near(r.GNLB, r.GR - r.GE, r.GR, r.GE)) { fails.push(`GFS の恒等式が合わない (${r.year} 年 国 ${r.country})`); break; }
}

// 4. 貸借
for (const r of rows.balance) {
  const dep = r.S14_F2_A + r.S11_F2_A + r.S13_F2_A + r.S1N_F2_A, loan = r.S14_F4_L + r.S11_F4_L + r.S13_F4_L + r.S1N_F4_L;
  if (!near(r.S122_F2_L, dep) || !near(r.S122_F4_A, loan) || !near(r.S122_RES_A, dep - loan - r.S122_F3_A, dep, loan, r.S122_F3_A)) { fails.push(`貸借の表が合わない (${r.year} 年 国 ${r.country})`); break; }
}

// 5. 政策の出来事
const ev = rows.policy.filter((r) => r.country === g.cap && r.policy === 'ctax');
check(ev.length === 1 && ev[0].to === 0.05 && ev[0].from === 0, `わざと変えた消費税の出来事が 1 つでない (${JSON.stringify(ev)})`);

// 6. 戦争
for (const w of rows.wars) {
  const ps = rows.wars_part.filter((p) => p.WarNum === w.WarNum);
  if (ps.length !== 2 || (w.EndYear !== '' && w.EndYear < w.StartYear)) { fails.push(`戦争 ${w.WarNum} の形が違う`); break; }
}

console.log(`表の行: ${Object.entries(rows).map(([k, v]) => `${k} ${v.length}`).join('・')}`);
console.log(`輸出の合計 ${P6.toFixed(1)} cr・戦争 ${rows.wars.length}・政策の出来事 ${rows.policy.length}`);
console.log(fails.length ? `データの書き出し 不合格\n${fails.join('\n')}` : 'データの書き出し 合格');
process.exit(fails.length ? 1 : 0);
