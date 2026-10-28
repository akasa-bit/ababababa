// データの書き出し (回 DO6・B-072。docs/export.md)。画面なしの版で銀河を回し、現実の統計と同じ形の表を CSV で書き出す。
// ゲームの中身は変えない (出入りの関数を道具の側で包んで数えるだけ。tools/fiscal-panel.js・tools/tests/ledger.js と同じやり方)。
// 表 (列の名前は SNA 2008・GFS 2014・COFOG・BACI・COW の符号。意味と単位は docs/export.md のコードブック):
//   sna.csv      国 × 年: 人口・GDP と内訳 (家計の消費・政府の買い付け・政府の建設・輸出入)・賃金・税・政府の純貸出
//   gfs.csv      国 × 年: 一般政府の収入 (税の種類・移転・財産所得) と、目的別の支出 (COFOG)
//   balance.csv  国 × 年 (年の終わり): 部門 (家計・会社・政府・先住民・銀行) の預金・貸出・国債
//   rates.csv    国 × 年: 物価の指数・物価の上がり方・政策金利・長期の国債の利回り
//   prices.csv   星系 × 年: 資源ごとの市場の値段
//   trade.csv    年 × 輸出国 × 輸入国 × 品目 (BACI の形): 額と量。国の中の輸送は入れない
//   wars.csv     戦争 1 つ = 1 行 (COW の国家間戦争の形。2 国の組で 1 つの戦争と数える)
//   wars_part.csv 戦争 × 参加国 (COW の参加国の表の形)
//   policy.csv   政策の出来事 (Romer & Romer の形): 年・国・政策・前の値・後の値
//   meta.json    設定・ゲームの版・シード・行の数
// 使い方: node tools/export.js <設定.json>
//         node tools/export.js --out <フォルダ> [--seeds 30 | --seeds 1,2,3] [--years 150] [--nations 6] [--params 値.json]
//   設定のファイル = { "out": "export-out", "seeds": 30, "years": 150, "nations": 6, "params": null }。HTML=… で別の版を回せる
const fs = require('fs');
const path = require('path');
const H = require('./headless');

// 設定: ファイル 1 つか、引数
function config(argv) {
  if (argv[0] && !argv[0].startsWith('--')) return { ...JSON.parse(fs.readFileSync(argv[0], 'utf8')), file: argv[0] };
  const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  return { out: arg('out', 'export-out'), seeds: arg('seeds', '3'), years: Number(arg('years', 150)), nations: Number(arg('nations', 6)), params: arg('params', null) };
}
const seedList = (s) => (Array.isArray(s) ? s.map(String) : String(s).includes(',') ? String(s).split(',') : Array.from({ length: Number(s) }, (_, i) => String(i + 1)));

// 列 (CSV の見出しの順)
const COLS = {
  sna: ['galaxy', 'year', 'country', 'name', 'POP', 'B1GQ', 'P3_S14', 'P3_S13', 'P51G_S13', 'P6', 'P7', 'D1', 'D2', 'D5', 'B9_S13'],
  gfs: ['galaxy', 'year', 'country', 'GR', 'GR11', 'GR111', 'GR114', 'GR115', 'GR13', 'GR14', 'GR141', 'GE', 'GF01', 'GF0107', 'GF02', 'GF03', 'GF04', 'GF09', 'GF10', 'GE_TR', 'GNLB'],
  balance: ['galaxy', 'year', 'country', 'S14_F2_A', 'S14_F4_L', 'S11_F2_A', 'S11_F4_L', 'S13_F2_A', 'S13_F4_L', 'S13_F3_L', 'S1N_F2_A', 'S1N_F4_L', 'S122_F2_L', 'S122_F4_A', 'S122_F3_A', 'S122_RES_A'],
  rates: ['galaxy', 'year', 'country', 'CPI', 'INFL', 'IRS', 'IRL', 'CB_RULE'],
  prices: null, // 資源の名前が列になるので、あとで決める
  trade: ['galaxy', 't', 'i', 'j', 'k', 'v', 'q'],
  wars: ['galaxy', 'WarNum', 'WarName', 'StartYear', 'EndYear', 'Initiator', 'Outcome', 'BatDeath'],
  wars_part: ['galaxy', 'WarNum', 'ccode', 'StateName', 'Side', 'StartYear', 'EndYear', 'Initiator'],
  policy: ['galaxy', 'year', 'country', 'policy', 'from', 'to'],
};
const GOV_BUY = { public: 'GF01', upkeep: 'GF02', military: 'GF02', security: 'GF03', build: 'GF04', education: 'GF09', welfare: 'GF10' };

// onYear(g, y) = 年の始めに呼ぶ (試験でわざと政策を変えるため)
function play(sim, seed, years, nations, emit, onYear = null) {
  const g = sim.newGame(seed, { nations });
  const { RES, PRICE } = sim.tables;
  const name = (r) => (g.realmName ? g.realmName(r) : String(r));
  // 帳簿 → 国と部門 (tools/tests/ledger.js と同じ)
  const natRealm = (key) => { const s = Number(key.split('|')[0]); return g.isColonized(s) ? g.realmOf(s) : null; };
  const realmOfAcct = (a) => ((a.gov ?? a.hh ?? a.pv ?? a.fm) !== undefined ? g.realmOf(a.gov ?? a.hh ?? a.pv ?? a.fm) : a.nat !== undefined ? natRealm(a.nat) : null);
  const sectorOfAcct = (a) => (a.gov !== undefined ? 'gov' : a.hh !== undefined || a.pv !== undefined ? 'hh' : a.fm !== undefined ? 'fm' : a.nat !== undefined ? 'nat' : 'way');
  // 1 年の出入り: 国 → 種類 → 部門 → 額 (受け取りが +)
  let flows = {};
  const add = (realm, kind, sector, v) => { if (realm === null || realm === undefined) return; const k = ((flows[realm] ??= {})[kind] ??= {}); k[sector] = (k[sector] || 0) + v; };
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
  if (bondMove) g.bondMove = (kind, v, id) => { add(g.realmOf(id), `bond:${kind}`, 'gov', -v); return bondMove(kind, v, id); };
  // 交易: 星系から星系へ送った荷 (国の境を越えたものだけ)。額は送った星系の市場の値段 (本船渡し)
  let trade = new Map();
  const ship = g.shipCargo.bind(g);
  g.shipCargo = (from, legs, res, amt) => {
    const dest = legs.length ? legs[legs.length - 1].next : from;
    const i = g.realmOf(from), j = g.realmOf(dest);
    if (i !== j && amt > 0) {
      const key = `${i}|${j}|${res}`, p = g.price ? g.price(from, res) : PRICE[res];
      const t = trade.get(key) || { i, j, k: res, v: 0, q: 0 };
      t.v += amt * p; t.q += amt;
      trade.set(key, t);
    }
    return ship(from, legs, res, amt);
  };
  // 戦争: realmWars の組を年ごとに見て、始まりと終わりを記録する
  const wars = new Map(); // key → { num, a, b, start, end, init, dead, how }
  let warNum = 0;
  // 政策: 国ごとの財政と国家方針の値を年ごとに比べる
  const lastPolicy = {};
  const policyOf = (r) => {
    const f = g.fiscalFor(r, r), out = { tax: f.tax, ctax: f.ctax || 0, tariff: f.tariff || 0, cb_rule: f.cb ?? 1, rate: f.cb === 0 ? f.rate : null, deficit: f.deficit || 0, policy: g.policyAt ? g.policyAt(r) : null };
    for (const [k, v] of Object.entries(f.budget || {})) out[`budget_${k}`] = v;
    return out;
  };
  const realms = () => [...new Set(g.colonizedSystems().map((x) => g.realmOf(x.id)))].sort((a, b) => a - b);
  const r6 = (v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toPrecision(8)) : v);
  for (let y = 0; y < years; y++) {
    flows = {}; trade = new Map();
    if (onYear) onYear(g, y);
    sim.run(g, 1);
    const year = Math.round(g.year);
    const live = [...new Set([...realms(), ...[...trade.values()].flatMap((t) => [t.i, t.j])])].sort((a, b) => a - b); // 年の途中で交易してから消えた国 (降伏など) の行も書く (輸出と輸入の合計を合わせる)
    // 付加価値 (fiscal-panel.js と同じ: 民間の所得) と人口
    const va = {}, pop = {};
    for (const s of g.colonizedSystems()) {
      const r = g.realmOf(s.id);
      va[r] = (va[r] || 0) + (g.incomeOf ? g.coloniesIn(s.id).reduce((k, c) => k + g.incomeOf(c), 0) : 0);
      pop[r] = (pop[r] || 0) + g.coloniesIn(s.id).reduce((k, c) => k + c.pop, 0);
    }
    // 輸出入 (国ごと)
    const P6 = {}, P7 = {};
    for (const t of trade.values()) { P6[t.i] = (P6[t.i] || 0) + t.v; P7[t.j] = (P7[t.j] || 0) + t.v; emit('trade', { galaxy: seed, t: year, i: t.i, j: t.j, k: t.k, v: r6(t.v), q: r6(t.q) }); }
    // 貸借 (年の終わり)
    const bs = {};
    const B = (r) => (bs[r] ??= { hh: [0, 0], fm: [0, 0], gov: [0, 0, 0], nat: [0, 0] });
    for (const [key, v] of Object.entries(g.govs)) {
      if (!g.isColonized(Number(key))) continue;
      const b = B(g.realmOf(Number(key)));
      b.hh[0] += v.hh || 0; b.hh[1] += v.hloan || 0; b.fm[0] += v.fm || 0; b.fm[1] += v.loan || 0;
      b.gov[0] += Math.max(0, v.credits); b.gov[1] += Math.max(0, -v.credits); b.gov[2] += v.bond || 0;
    }
    for (const [key, st] of Object.entries(g.natives)) { const r = natRealm(key); if (r !== null) { const b = B(r); b.nat[0] += st.cr || 0; b.nat[1] += st.loan || 0; } }
    for (const r of live) {
      const f = flows[r] || {}, G = (k) => f[k]?.gov || 0, S = (k, s) => f[k]?.[s] || 0;
      const buy = Object.keys(GOV_BUY).reduce((k, kind) => k + Math.max(0, -G(kind)), 0);
      const P51G = Math.max(0, -G('build'));
      const P3_S13 = buy - P51G;
      const B1GQ = (va[r] || 0) + buy;
      const tax = Math.max(0, G('tax')), ctax = Math.max(0, G('ctax')), tariff = Math.max(0, G('tariff'));
      const grants = Math.max(0, G('grant')) + Math.max(0, G('tribute'));
      const intIn = Math.max(0, G('interest')), intOut = Math.max(0, -G('interest'));
      const other = Math.max(0, G('natives'));
      const GR11 = tax + ctax + tariff, GR14 = intIn + other, GR = GR11 + grants + GR14;
      const cof = { GF01: 0, GF02: 0, GF03: 0, GF04: 0, GF09: 0, GF10: 0 };
      for (const [kind, code] of Object.entries(GOV_BUY)) cof[code] += Math.max(0, -G(kind));
      const GE_TR = Math.max(0, -G('grant')) + Math.max(0, -G('tribute'));
      const GE = Object.values(cof).reduce((a, v) => a + v, 0) + intOut + GE_TR;
      const B9 = Object.entries(f).filter(([k]) => !k.startsWith('bond:')).reduce((a, [, by]) => a + (by.gov || 0), 0);
      emit('sna', { galaxy: seed, year, country: r, name: name(r), POP: r6(pop[r] || 0), B1GQ: r6(B1GQ), P3_S14: r6(-S('spend', 'hh')), P3_S13: r6(P3_S13), P51G_S13: r6(P51G), P6: r6(P6[r] || 0), P7: r6(P7[r] || 0), D1: r6(S('wages', 'hh')), D2: r6(ctax + tariff), D5: r6(tax), B9_S13: r6(B9) });
      emit('gfs', { galaxy: seed, year, country: r, GR: r6(GR), GR11: r6(GR11), GR111: r6(tax), GR114: r6(ctax), GR115: r6(tariff), GR13: r6(grants), GR14: r6(GR14), GR141: r6(intIn), GE: r6(GE), ...Object.fromEntries(Object.entries(cof).map(([k, v]) => [k, r6(v)])), GF0107: r6(intOut), GE_TR: r6(GE_TR), GNLB: r6(GR - GE) });
      const b = B(r), dep = b.hh[0] + b.fm[0] + b.gov[0] + b.nat[0], loan = b.hh[1] + b.fm[1] + b.gov[1] + b.nat[1];
      emit('balance', { galaxy: seed, year, country: r, S14_F2_A: r6(b.hh[0]), S14_F4_L: r6(b.hh[1]), S11_F2_A: r6(b.fm[0]), S11_F4_L: r6(b.fm[1]), S13_F2_A: r6(b.gov[0]), S13_F4_L: r6(b.gov[1]), S13_F3_L: r6(b.gov[2]), S1N_F2_A: r6(b.nat[0]), S1N_F4_L: r6(b.nat[1]), S122_F2_L: r6(dep), S122_F4_A: r6(loan), S122_F3_A: r6(b.gov[2]), S122_RES_A: r6(dep - loan - b.gov[2]) });
      let yl = 0, bonds = 0;
      for (const s of g.realmSystems(r)) { const gv = g.govs[s.id]; if (g.longYield && gv?.bond > 0) { yl += g.longYield(s.id) * gv.bond; bonds += gv.bond; } }
      const f0 = g.fiscalFor(r, r);
      emit('rates', { galaxy: seed, year, country: r, CPI: r6(g.cpiOf ? g.cpiOf(r) : 1), INFL: r6(g.inflOf ? g.inflOf(r) : 0), IRS: r6(g.cbRateAt ? g.cbRateAt(r) : g.rateAt(r)), IRL: r6(g.longYield ? (bonds > 0 ? yl / bonds : g.longYield(r)) : 0), CB_RULE: f0.cb ?? 1 });
      // 政策の出来事: 前の年と違う値だけ
      const now = policyOf(r), before = lastPolicy[r];
      if (before) for (const [k, v] of Object.entries(now)) if (JSON.stringify(before[k]) !== JSON.stringify(v)) emit('policy', { galaxy: seed, year, country: r, policy: k, from: before[k] ?? '', to: v ?? '' });
      lastPolicy[r] = now;
    }
    // 値段 (星系 × 年)
    if (g.price) for (const s of g.colonizedSystems()) emit('prices', { galaxy: seed, year, system: s.id, country: g.realmOf(s.id), ...Object.fromEntries(RES.map((res) => [res, r6(g.price(s.id, res))])) });
    // 戦争
    const active = new Set(Object.keys(g.realmWars));
    for (const key of active) {
      // 同じ 2 国がまた戦えば、別の戦争として数える (終わった前の戦争は別のキーに移す)
      if (wars.has(key) && wars.get(key).end !== null) { const old = wars.get(key); wars.delete(key); wars.set(`${key}#${old.num}`, old); }
      if (!wars.has(key)) { const [a, b] = key.split('|').map(Number); wars.set(key, { num: ++warNum, a, b, start: Math.round(g.realmWars[key]), end: null, init: g.warBy?.[key] ?? '', dead: 0, how: '' }); }
      const w = wars.get(key);
      if (w.end === null) w.dead = Math.max(w.dead, g.warStats?.[key]?.dead || 0);
    }
    for (const [key, w] of wars) {
      if (w.end !== null || active.has(key) || key.includes('#')) continue;
      w.end = year;
      w.how = g.peaces?.some((p) => p.key === key && Math.round(p.year) === year) ? 'peace' : 'other';
    }
  }
  for (const w of wars.values()) {
    const end = w.end ?? '';
    emit('wars', { galaxy: seed, WarNum: w.num, WarName: `${name(w.a)}・${name(w.b)}`, StartYear: w.start, EndYear: end, Initiator: w.init, Outcome: w.end === null ? 'ongoing' : w.how, BatDeath: Math.round(w.dead) });
    for (const [side, c] of [[1, w.a], [2, w.b]]) emit('wars_part', { galaxy: seed, WarNum: w.num, ccode: c, StateName: name(c), Side: side, StartYear: w.start, EndYear: end, Initiator: w.init === c ? 1 : 0 });
  }
  return g;
}

function main() {
  const cfg = config(process.argv.slice(2));
  const seeds = seedList(cfg.seeds ?? 3), years = Number(cfg.years ?? 150), nations = Number(cfg.nations ?? 6);
  const params = typeof cfg.params === 'string' ? JSON.parse(fs.readFileSync(cfg.params, 'utf8')) : cfg.params || null;
  const sim = H.load({ params, ...(process.env.HTML ? { src: process.env.HTML } : {}) });
  COLS.prices = ['galaxy', 'year', 'system', 'country', ...sim.tables.RES];
  const out = cfg.out || 'export-out';
  fs.mkdirSync(out, { recursive: true });
  const rows = Object.fromEntries(Object.keys(COLS).map((k) => [k, []]));
  const emit = (t, row) => rows[t].push(row);
  const t0 = Date.now();
  for (const seed of seeds) { play(sim, seed, years, nations, emit); process.stderr.write(`銀河 ${seed} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`); }
  const csvCell = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const [t, cols] of Object.entries(COLS)) fs.writeFileSync(path.join(out, `${t}.csv`), `${[cols.join(','), ...rows[t].map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')}\n`);
  const meta = { app: 'nolongerubiquitous', edition: sim.EDITION?.id ?? sim.EDITION ?? null, seeds, years, nations, params: cfg.params ?? null, config: cfg.file ?? null, rows: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])), codebook: 'docs/export.md', exportedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify({ out, ...meta.rows }));
  return { out, rows, meta };
}

module.exports = { play, COLS };
if (require.main === module) main();
