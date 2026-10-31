// 全部門の帳簿の試験 (回 KE1・B-001。docs/money.md の 5)。money.js が帳簿の種類 (政府・家計・会社・先住民・運ぶ途中) ごとに見るのに対して、
// ここでは国ごとに部門を分け、ストックフロー一貫の 2 つの表が毎刻み閉じることを確かめる (Godley & Lavoie 2007 の第 2 章の形)。
//   貸借の表 (行 = 預金・貸出・国債・準備、列 = 国ごとの家計・会社・政府・先住民 と 銀行・中央銀行・運ぶ途中):
//     どの行も合計が 0。銀行の純資産は 0。中央銀行の負債 (準備 = 試合の始めからあるお金) は、中央銀行の操作がないので変わらない
//   取引の表 (行 = 出入りの種類、列 = 国ごとの部門 と ほかの国):
//     どの行も合計が 0 (ほかの国の列 = その国の外へ出た分)。国ごとに、部門の純資産の増加 = 記帳した出入りの合計
//     (記帳しないで国の帳簿を書き換える所がない)。国の境目が変わった刻み (独立・征服) は比べない
// 使い方: node tools/tests/ledger.js [シード] [年数] [国の数]   (画面なしの版で回す。HTML=… で版を選ぶ)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
// 全部門の帳簿 (回 KE1・B-001): 国ごとの貸借の表と取引の表が毎刻み閉じる
exports.ci = [{ args: ['7', '150', '6'], judge: J.firstLine('全部門の帳簿', '全部門の帳簿 不合格') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '7', years = '150', nations = '6'] = process.argv.slice(2);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const g = sim.newGame(seed, { nations: Number(nations) });
const SECTORS = ['hh', 'fm', 'gov', 'nat'];
const NAME = { hh: '家計', fm: '会社', gov: '政府', nat: '先住民', bank: '銀行', cb: '中央銀行', way: '運ぶ途中', row: 'ほかの国' };
// 帳簿 → 国 (国の外の先住民と運ぶ途中は 'out')
const natRealm = (key) => { const s = Number(key.split('|')[0]); return g.isColonized(s) ? g.realmOf(s) : 'out'; };
const realmOfAcct = (a) => (a.gov ?? a.hh ?? a.pv ?? a.fm) !== undefined ? g.realmOf(a.gov ?? a.hh ?? a.pv ?? a.fm) : a.nat !== undefined ? natRealm(a.nat) : 'out';
const sectorOfAcct = (a) => (a.gov !== undefined ? 'gov' : a.hh !== undefined || a.pv !== undefined ? 'hh' : a.fm !== undefined ? 'fm' : a.nat !== undefined ? 'nat' : 'way');
// 出入りを国 × 種類 × 部門で足し上げる (ゲームの関数を包むだけ。中身は変えない)
let flows = {}, abs = 0;
const add = (realm, kind, sector, v) => { const r = (flows[realm] ??= {}), k = (r[kind] ??= {}); k[sector] = (k[sector] || 0) + v; abs += Math.abs(v); };
const cash = g.cash.bind(g), earn = g.earn.bind(g), bondMove = g.bondMove ? g.bondMove.bind(g) : null;
let inEarn = null;
g.cash = (kind, v, acct) => { if (!(inEarn && acct.gov === inEarn.sys)) add(realmOfAcct(acct), kind, sectorOfAcct(acct), v); return cash(kind, v, acct); };
g.earn = (kind, amount, sys = 0, other = null) => {
  const gv = g.gov(sys), c0 = gv.credits, outer = inEarn;
  inEarn = { sys };
  const r = earn(kind, amount, sys, other);
  inEarn = outer;
  add(g.realmOf(sys), kind, 'gov', gv.credits - c0);
  return r;
};
if (bondMove) g.bondMove = (kind, v, id) => { add(g.realmOf(id), kind, 'gov', -v); return bondMove(kind, v, id); };
// 国ごとの部門の純資産と、貸借の表の行
function sheet() {
  const S = {}, map = {};
  const R = (realm) => (S[realm] ??= { hh: { dep: 0, loan: 0 }, fm: { dep: 0, loan: 0 }, gov: { dep: 0, loan: 0, bond: 0 }, nat: { dep: 0, loan: 0 } });
  for (const [key, v] of Object.entries(g.govs)) {
    const id = Number(key), r = R(g.realmOf(id));
    map[key] = g.realmOf(id);
    r.hh.dep += v.hh || 0; r.hh.loan += (v.hloan || 0) + (v.hm || 0); // hm・bl = 民間の信用 (回 KE3)
    r.fm.dep += v.fm || 0; r.fm.loan += (v.loan || 0) + (v.bl || 0);
    r.gov.dep += Math.max(0, v.credits); r.gov.loan += Math.max(0, -v.credits); r.gov.bond += v.bond || 0;
  }
  for (const [key, st] of Object.entries(g.natives)) { const r = R(natRealm(key)); r.nat.dep += st.cr || 0; r.nat.loan += st.loan || 0; map[key] = natRealm(key); }
  let way = 0;
  for (const q of g.requests) way += (q.kind === 'trade' ? q.pre : q.kind === 'tribute' || q.kind === 'grant' ? q.amt : 0) || 0;
  for (const p of g.players) for (const d of p.decisions || []) way += d.cr || 0; // どの席の決めることも (AI の国の席も。回 SE5)
  for (const s of g.ships) way += s.seed || 0;
  for (const j of g.projects) way += j.seed || 0;
  for (const r of g.refunds || []) way += r.v || 0; // 光速で届く途中の返金 (回 KE3)
  const net = {};
  for (const [realm, r] of Object.entries(S)) net[realm] = Object.fromEntries(SECTORS.map((k) => [k, r[k].dep - r[k].loan - (r[k].bond || 0)]));
  return { S, net, way, map: JSON.stringify(map) };
}
let worstRealm = 0, worstRealmAt = '', worstRow = 0, worstRowAt = '', reserve0 = null, worstReserve = 0, skipped = 0, steps = 0, bad = [];
let last = null;
const yearsN = Number(years);
for (let y = 0; y < yearsN; y++) {
  for (let i = 0; i < 4; i++) {
    const a = sheet();
    flows = {}; abs = 0;
    g.advance(0.25);
    const b = sheet();
    steps++;
    // 貸借の表: 預金・貸出・国債の行は、部門の合計と銀行が同じ額 (反対の符号) を持つので 0。準備 = 預金 − 貸出 − 国債 (銀行が中央銀行に持つ分) は変わらない
    let dep = b.way, loan = 0, bond = 0;
    for (const r of Object.values(b.S)) for (const k of SECTORS) { dep += r[k].dep; loan += r[k].loan; bond += r[k].bond || 0; }
    const reserve = dep - loan - bond;
    reserve0 ??= reserve;
    const scale = Math.max(1, dep);
    worstReserve = Math.max(worstReserve, Math.abs(reserve - reserve0) / scale);
    if (Object.values(b.S).some((r) => SECTORS.some((k) => r[k].dep < -1e-9 || r[k].loan < -1e-9 || (r[k].bond || 0) < -1e-9))) bad.push(`${g.year.toFixed(2)} 年: 預金・貸出・国債がマイナス`);
    if (!abs) continue;
    // 取引の表: 種類ごとに、国の部門・ほかの国・運ぶ途中の合計が 0 (ほかの国の列は、その国の外へ出た分)
    const rows = {};
    for (const [realm, f] of Object.entries(flows)) for (const [kind, by] of Object.entries(f)) rows[kind] = (rows[kind] || 0) + Object.values(by).reduce((s, v) => s + v, 0);
    for (const [kind, v] of Object.entries(rows)) { const e = Math.abs(kind === 'import' ? v + (rows.trade || 0) : kind === 'trade' ? v + (rows.import || 0) : v) / abs; if (e > worstRow) { worstRow = e; worstRowAt = `${g.year.toFixed(2)} 年 ${kind}`; } }
    if (a.map !== b.map) { skipped++; continue; } // 国の境目が変わった
    // 国ごとに: 部門の純資産の増加 = 記帳した出入り
    for (const realm of new Set([...Object.keys(a.net), ...Object.keys(b.net)])) {
      const f = flows[realm] || {};
      for (const k of SECTORS) {
        const d = (b.net[realm]?.[k] || 0) - (a.net[realm]?.[k] || 0);
        const rec = Object.values(f).reduce((s, by) => s + (by[k] || 0), 0);
        const e = Math.abs(d - rec) / abs;
        if (e > worstRealm) { worstRealm = e; worstRealmAt = `${g.year.toFixed(2)} 年 国 ${realm} の${NAME[k]}`; }
      }
    }
    if (y === yearsN - 1) last = { flows, b, reserve };
  }
}
const ok = worstRealm <= 1e-9 && worstRow <= 1e-9 && worstReserve <= 1e-9 && !bad.length;
const e = (v) => Number(v).toExponential(2);
console.log(`${years} 年・${steps} 刻み・全部門の帳簿 ${ok ? '合格' : '不合格'}`);
console.log(`  国ごとの部門の (純資産の増加 − 記帳した出入り) ÷ 取扱量の最大 ${e(worstRealm)} (${worstRealmAt || '—'})。国の境目が変わって比べなかった刻み ${skipped}`);
console.log(`  取引の表の行の合計 ÷ 取扱量の最大 ${e(worstRow)} (${worstRowAt || '—'})`);
console.log(`  中央銀行の準備 (試合の始めからあるお金) の変化 ÷ 預金の最大 ${e(worstReserve)}`);
console.log(`  マイナスの残高: ${bad.length ? bad.slice(0, 3).join('・') : 'なし'}`);
// 終わりの年の、首都 0 の国の 2 つの表 (docs/money.md の 5 の例)
if (last) {
  const r = last.b.S[0];
  const f = (v) => (Math.abs(v) < 0.5 ? '0' : Math.round(v).toString());
  if (r) {
    const bank = SECTORS.reduce((s, k) => s + r[k].dep - r[k].loan, 0) - r.gov.bond;
    console.log('  貸借の表 (国 0、終わりの刻み) [cr]: 行 = 預金 / 貸出 / 国債、列 = 家計・会社・政府・先住民・銀行');
    console.log(`    預金 ${SECTORS.map((k) => f(r[k].dep)).join(' / ')} / ${f(-SECTORS.reduce((s, k) => s + r[k].dep, 0))}`);
    console.log(`    貸出 ${SECTORS.map((k) => f(-r[k].loan)).join(' / ')} / ${f(SECTORS.reduce((s, k) => s + r[k].loan, 0))}`);
    console.log(`    国債 0 / 0 / ${f(-r.gov.bond)} / 0 / ${f(r.gov.bond)}  (銀行の、中央銀行への準備 (国の分) ${f(bank)})`);
  }
  const fl = last.flows[0] || {};
  console.log('  取引の表 (国 0、終わりの刻み) [cr]: 種類 = 家計・会社・政府・先住民・ほかの国');
  for (const [kind, by] of Object.entries(fl)) {
    const own = SECTORS.reduce((s, k) => s + (by[k] || 0), 0);
    console.log(`    ${kind} ${SECTORS.map((k) => f(by[k] || 0)).join(' / ')} / ${f(-own)}`);
  }
}
