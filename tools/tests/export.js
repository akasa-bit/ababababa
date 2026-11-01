// データの書き出し (tools/export.js。回 DO6・B-072) の試験。画面なしの版で 1 銀河を回し、表の形と、表どうしが食い違わないことを確かめる
// 1. 表の列がコードブック (docs/export.md) にすべて載っている (列を足してコードブックを忘れると落ちる)
// 2. 交易: 国の輸出の合計 (sna の P6) = 輸入の合計 (P7) = trade.csv の額の合計。国の中の輸送 (i = j) は入れない
// 3. GFS: 収入 = 税 + 移転 + 財産所得など、支出 = 目的別 (COFOG) + 利子 + 移転、純貸出 = 収入 − 支出。
//    GFS の純貸出 (GNLB) と帳簿の純貸出 (sna の B9_S13) の差が、支出の合計の 1% より小さい (政府の出入りの種類が GFS の分類から漏れると落ちる。回 DO7)
//    30 年目から観戦をやめて国有化 (国有の割合 30%。人間の国だけ)、70 年目に一部を民営化 (10%) して、国有企業の配当と株の売り買いも数える (回 DO8)
// 4. 貸借: 銀行の預金 (負債) = 部門の預金の合計、銀行の準備 = 預金 − 貸出 − 国債
// 5. 政策の出来事: わざと消費税を変えた年に、地球の国の ctax の行が 1 つ出る
// 6. 戦争: どの戦争も参加国が 2 つ、始まり ≤ 終わり
// 7. ゲームの中の記録 (回 GA11・B-196。core/export-rec.js の xrec): 道具と同じ銀河を 15 年回して、表の行が道具の行と同じ。セーブして読み込んでも続きが足される
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
const rows = Object.fromEntries(Object.keys(X.cols(sim)).map((k) => [k, []]));
const g = X.play(sim, seed, Number(years), 6, (t, r) => rows[t].push(r), (gg, y) => { if (y === 10) gg.setFiscal({ ctax: 0.05 }, true); if (y === 30) { gg.setSpectate(false); gg.setFiscal({ soe: 0.3 }, true); } if (y === 70) gg.setFiscal({ soe: 0.1 }, true); });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
// 表の値は 8 桁に丸めてあるので、足し引きした項の大きさに比べて 1e-6 まで許す
const near = (a, b, ...terms) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b), ...terms.map(Math.abs));
const sum = (xs) => xs.reduce((a, v) => a + v, 0);

// 1. コードブック
const book = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'export.md'), 'utf8');
const cols = X.cols(sim);
const missing = Object.entries(cols).flatMap(([t, cs]) => cs.filter((c) => !book.includes(`\`${c}\``)).map((c) => `${t}.${c}`));
check(!missing.length, `コードブックにない列: ${missing.join('・')}`);

// 2. 交易
const P6 = sum(rows.sna.map((r) => r.P6)), P7 = sum(rows.sna.map((r) => r.P7)), V = sum(rows.trade.map((r) => r.v));
check(near(P6, P7) && near(P6, V), `輸出 ${P6}・輸入 ${P7}・交易の表 ${V} が合わない`);
check(rows.trade.every((r) => r.i !== r.j), '国の中の輸送が交易の表に入っている');

// 3. GFS
for (const r of rows.gfs) {
  const ge = r.GF01 + r.GF02 + r.GF03 + r.GF04 + r.GF07 + r.GF09 + r.GF10 + r.GF0107 + r.GE_TR;
  if (!near(r.GR, r.GR11 + r.GR13 + r.GR14) || !near(r.GR11, r.GR111 + r.GR114 + r.GR115) || !near(r.GE, ge) || !near(r.GNLB, r.GR - r.GE, r.GR, r.GE)) { fails.push(`GFS の恒等式が合わない (${r.year} 年 国 ${r.country})`); break; }
}
const b9 = new Map(rows.sna.map((r) => [`${r.year}|${r.country}`, r.B9_S13]));
const gap = sum(rows.gfs.map((r) => Math.abs(r.GNLB - (b9.get(`${r.year}|${r.country}`) ?? r.GNLB)))), spent = sum(rows.gfs.map((r) => r.GE));
check(gap < 0.01 * spent, `GFS の純貸出と帳簿の純貸出の差が支出の ${((100 * gap) / spent).toFixed(1)}% (1% まで。政府の出入りの種類が GFS の分類から漏れている。tools/export.js の GOV_BUY・GOV_FN)`);

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

// 7. ゲームの中の記録
{
  const sim2 = H.load(process.env.HTML ? { src: process.env.HTML } : {});
  const C = X.cols(sim2), Y = 15, want = Object.fromEntries(Object.keys(C).map((k) => [k, []]));
  X.play(sim2, seed, Y, 6, (t, r) => want[t].push(r));
  const sim3 = H.load(process.env.HTML ? { src: process.env.HTML } : {});
  const gg = sim3.newGame(seed, { nations: 6 });
  gg.xrec = sim3.evaluate('xrecNew')();
  sim3.run(gg, 10);
  const d = JSON.parse(JSON.stringify(sim3.buildSave(gg)));
  const g2 = new sim3.Game(sim3.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim3.GALAXY_GEN }));
  g2.restore(d);
  sim3.run(g2, Y - 10);
  sim3.run(g2, 0.25); // 最後の年の切れ目は、次の 1 歩の始めに足す
  for (const t of ['sna', 'gfs', 'balance', 'rates', 'prices', 'trade', 'policy']) {
    const a = want[t].map((r) => JSON.stringify(C[t].map((c) => r[c] ?? null))), b = (g2.xrec.rows[t] || []).map((r) => JSON.stringify(r));
    check(a.length === b.length && a.every((x, i) => x === b[i]), `ゲームの中の記録の ${t} が道具と違う (道具 ${a.length} 行・ゲーム ${b.length} 行)`);
  }
  const wantWars = want.wars.length, gotWars = sim3.evaluate('xrecCsv')(g2, 'wars').trim().split('\n').length - 1;
  check(wantWars === gotWars, `ゲームの中の記録の戦争 ${gotWars} が道具 ${wantWars} と違う`);
}
console.log(`表の行: ${Object.entries(rows).map(([k, v]) => `${k} ${v.length}`).join('・')}`);
console.log(`輸出の合計 ${P6.toFixed(1)} cr・戦争 ${rows.wars.length}・政策の出来事 ${rows.policy.length}`);
console.log(fails.length ? `データの書き出し 不合格\n${fails.join('\n')}` : 'データの書き出し 合格');
process.exit(fails.length ? 1 : 0);
