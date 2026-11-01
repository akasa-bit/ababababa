// 統計の形の書き出し (回 DO6・B-072 の数え方。回 GA11・B-196 で、道具 tools/export.js とゲームの中の「データを書き出す」が同じものを使うようにここへ移した。docs/export.md)。
// 出入りの関数 (cash・earn・bondMove・shipCargo) を包んで 1 年ごとに足し、年の終わりに国 × 年の表 (sna・gfs・balance・rates)・星系 × 年の値段 (prices)・
// 交易 (trade)・政策の出来事 (policy) の行を emit(表, 行) に渡す。戦争 (wars・wars_part) は exportWars で、記録した戦争から行を作る。
// 包むだけで、試合の中身は変えない。st = 年をまたいで持つ状態 (戦争・前の年の政策。ゲームの中ではセーブに入る)
const EXPORT_COLS = {
  sna: ['galaxy', 'year', 'country', 'name', 'POP', 'B1GQ', 'P3_S14', 'P3_S13', 'P51G_S13', 'P51G_S11', 'P6', 'P7', 'D1', 'D2', 'D5', 'B9_S13'],
  gfs: ['galaxy', 'year', 'country', 'GR', 'GR11', 'GR111', 'GR114', 'GR115', 'GR13', 'GR14', 'GR141', 'GE', 'GF01', 'GF0107', 'GF02', 'GF03', 'GF04', 'GF07', 'GF09', 'GF10', 'GE_TR', 'GNLB'],
  balance: ['galaxy', 'year', 'country', 'S14_F2_A', 'S14_F4_L', 'S11_F2_A', 'S11_F4_L', 'S13_F2_A', 'S13_F4_L', 'S13_F3_L', 'S1N_F2_A', 'S1N_F4_L', 'S122_F2_L', 'S122_F4_A', 'S122_F3_A', 'S122_RES_A'],
  rates: ['galaxy', 'year', 'country', 'CPI', 'INFL', 'IRS', 'IRL', 'CB_RULE'],
  prices: ['galaxy', 'year', 'system', 'country', ...RES],
  trade: ['galaxy', 't', 'i', 'j', 'k', 'v', 'q'],
  wars: ['galaxy', 'WarNum', 'WarName', 'StartYear', 'EndYear', 'Initiator', 'Outcome', 'BatDeath'],
  wars_part: ['galaxy', 'WarNum', 'ccode', 'StateName', 'Side', 'StartYear', 'EndYear', 'Initiator'],
  policy: ['galaxy', 'year', 'country', 'policy', 'from', 'to'],
};
// 政府が民間から買う出入り (GDP に入る。tools/fiscal-panel.js の GOV_BUY と同じ) と、その目的 (COFOG)
const EXPORT_GOV_BUY = { public: 'GF01', upkeep: 'GF02', military: 'GF02', security: 'GF03', build: 'GF04', health: 'GF07', education: 'GF09', welfare: 'GF10' };
// 政府の支出のうち、民間から買うのでないもの (GDP に入れない。fiscal-panel.js と同じ): 年金 (家計への移転。回 KE2)・研究の予算 (首都の家計へ。回 KE6。COFOG の基礎研究 GF0105)
const EXPORT_GOV_FN = { pension: 'GF10', research: 'GF01' };
// 政府の金融の取引 (株の売り買い。純貸出に入れない。回 KE9 の国有化・民営化)
const EXPORT_FIN = new Set(['nationalize', 'privatize']);
const xr6 = (v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toPrecision(8)) : v);

function exportRecorder(g, emit, st = {}, galaxy = '') {
  st.wars ??= {}; st.warNum ??= 0; st.lastPolicy ??= {}; st.flows ??= {}; st.trade ??= {}; // flows・trade = その年の途中までの足し上げ (ゲームの中ではセーブに入る)
  const name = (r) => (g.realmName ? g.realmName(r) : String(r));
  // 帳簿 → 国と部門 (tools/tests/ledger.js と同じ)
  const natRealm = (key) => { const s = Number(key.split('|')[0]); return g.isColonized(s) ? g.realmOf(s) : null; };
  const realmOfAcct = (a) => ((a.gov ?? a.hh ?? a.pv ?? a.fm) !== undefined ? g.realmOf(a.gov ?? a.hh ?? a.pv ?? a.fm) : a.nat !== undefined ? natRealm(a.nat) : null);
  const sectorOfAcct = (a) => (a.gov !== undefined ? 'gov' : a.hh !== undefined || a.pv !== undefined ? 'hh' : a.fm !== undefined ? 'fm' : a.nat !== undefined ? 'nat' : 'way');
  // 1 年の出入り: 国 → 種類 → 部門 → 額 (受け取りが +)
  const add = (realm, kind, sector, v) => { if (realm === null || realm === undefined) return; const k = ((st.flows[realm] ??= {})[kind] ??= {}); k[sector] = (k[sector] || 0) + v; };
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
  const ship = g.shipCargo.bind(g);
  g.shipCargo = (from, legs, res, amt) => {
    const dest = legs.length ? legs[legs.length - 1].next : from;
    const i = g.realmOf(from), j = g.realmOf(dest);
    if (i !== j && amt > 0) {
      const key = `${i}|${j}|${res}`, p = g.price ? g.price(from, res) : PRICE[res];
      const t = (st.trade[key] ??= { i, j, k: res, v: 0, q: 0 });
      t.v += amt * p; t.q += amt;
    }
    return ship(from, legs, res, amt);
  };
  // 政策: 国ごとの財政と国家方針の値を年ごとに比べる
  const policyOf = (r) => {
    const f = g.fiscalFor(r, r), out = { tax: f.tax, ctax: f.ctax || 0, tariff: f.tariff || 0, cb_rule: f.cb ?? 1, rate: f.cb === 0 ? f.rate : null, deficit: f.deficit || 0, policy: g.policyAt ? g.policyAt(r) : null };
    for (const [k, v] of Object.entries(f.budget || {})) out[`budget_${k}`] = v;
    return out;
  };
  const realms = () => [...new Set(g.colonizedSystems().map((x) => g.realmOf(x.id)))].sort((a, b) => a - b);
  const yearBegin = () => { st.flows = {}; st.trade = {}; };
  const yearEnd = () => {
    const year = Math.round(g.year), flows = st.flows, trade = Object.values(st.trade);
    const live = [...new Set([...realms(), ...trade.flatMap((t) => [t.i, t.j])])].sort((a, b) => a - b); // 年の途中で交易してから消えた国 (降伏など) の行も書く (輸出と輸入の合計を合わせるため)
    // 付加価値 (fiscal-panel.js と同じ: 民間の所得) と人口
    const va = {}, pop = {};
    for (const s of g.colonizedSystems()) {
      const r = g.realmOf(s.id);
      va[r] = (va[r] || 0) + (g.incomeOf ? g.coloniesIn(s.id).reduce((k, c) => k + g.incomeOf(c), 0) : 0);
      pop[r] = (pop[r] || 0) + g.coloniesIn(s.id).reduce((k, c) => k + c.pop, 0);
    }
    // 輸出入 (国ごと)
    const P6 = {}, P7 = {};
    for (const t of trade) { P6[t.i] = (P6[t.i] || 0) + t.v; P7[t.j] = (P7[t.j] || 0) + t.v; emit('trade', { galaxy, t: year, i: t.i, j: t.j, k: t.k, v: xr6(t.v), q: xr6(t.q) }); }
    // 貸借 (年の終わり)
    const bs = {};
    const B = (r) => (bs[r] ??= { hh: [0, 0], fm: [0, 0], gov: [0, 0, 0], nat: [0, 0] });
    for (const [key, v] of Object.entries(g.govs)) {
      if (!g.isColonized(Number(key))) continue;
      const b = B(g.realmOf(Number(key)));
      b.hh[0] += v.hh || 0; b.hh[1] += v.hloan || 0; b.fm[0] += v.fm || 0; b.fm[1] += v.loan || 0;
      b.gov[0] += Math.max(0, v.credits); b.gov[1] += Math.max(0, -v.credits); b.gov[2] += v.bond || 0;
    }
    for (const [key, s] of Object.entries(g.natives)) { const r = natRealm(key); if (r !== null) { const b = B(r); b.nat[0] += s.cr || 0; b.nat[1] += s.loan || 0; } }
    for (const r of live) {
      const f = flows[r] || {}, G = (k) => f[k]?.gov || 0, S = (k, s) => f[k]?.[s] || 0;
      const buy = Object.keys(EXPORT_GOV_BUY).reduce((k, kind) => k + Math.max(0, -G(kind)), 0);
      const P51G = Math.max(0, -G('build'));
      const P3_S13 = buy - P51G;
      const B1GQ = (va[r] || 0) + buy;
      // 研究開発の税額控除 (種類 rdcredit。回 KE6) は、会社の研究開発費の割合を政府が返すもの。税の減りとして所得への税から引く (GFS 2014 の 5 章の税額控除)
      const tax = Math.max(0, G('tax')) - Math.max(0, -G('rdcredit')), ctax = Math.max(0, G('ctax')), tariff = Math.max(0, G('tariff'));
      const grants = Math.max(0, G('grant')) + Math.max(0, G('tribute'));
      const intIn = Math.max(0, G('interest')), intOut = Math.max(0, -G('interest'));
      // 国有企業の配当 (種類 dividend の政府の受け取り。回 KE9・B-011) は財産所得 (GFS 2014 の 1412)。国有化・民営化 (nationalize・privatize) は株の売り買いで、
      // 収入でも支出でもない (GFS の金融の取引) ので、下の B9 からも除く (回 DO8。経済の知らせ)
      const other = Math.max(0, G('natives')) + Math.max(0, G('dividend'));
      const GR11 = tax + ctax + tariff, GR14 = intIn + other, GR = GR11 + grants + GR14;
      const cof = { GF01: 0, GF02: 0, GF03: 0, GF04: 0, GF07: 0, GF09: 0, GF10: 0 };
      for (const [kind, code] of [...Object.entries(EXPORT_GOV_BUY), ...Object.entries(EXPORT_GOV_FN)]) cof[code] += Math.max(0, -G(kind));
      cof.GF04 += -G('granary'); // 政府の倉の正味の買い入れ (売れば負。COFOG 04.2 の市場の安定。在庫の積み増しなので GDP の政府の買い付けには足さない。回 KE12)
      const GE_TR = Math.max(0, -G('grant')) + Math.max(0, -G('tribute'));
      const GE = Object.values(cof).reduce((a, v) => a + v, 0) + intOut + GE_TR;
      const B9 = Object.entries(f).filter(([k]) => !k.startsWith('bond:') && !EXPORT_FIN.has(k)).reduce((a, [, by]) => a + (by.gov || 0), 0);
      emit('sna', { galaxy, year, country: r, name: name(r), POP: xr6(pop[r] || 0), B1GQ: xr6(B1GQ), P3_S14: xr6(-S('spend', 'hh')), P3_S13: xr6(P3_S13), P51G_S13: xr6(P51G), P51G_S11: xr6(Math.max(0, -S('invest', 'fm'))), P6: xr6(P6[r] || 0), P7: xr6(P7[r] || 0), D1: xr6(S('wages', 'hh')), D2: xr6(ctax + tariff), D5: xr6(tax), B9_S13: xr6(B9) });
      emit('gfs', { galaxy, year, country: r, GR: xr6(GR), GR11: xr6(GR11), GR111: xr6(tax), GR114: xr6(ctax), GR115: xr6(tariff), GR13: xr6(grants), GR14: xr6(GR14), GR141: xr6(intIn), GE: xr6(GE), ...Object.fromEntries(Object.entries(cof).map(([k, v]) => [k, xr6(v)])), GF0107: xr6(intOut), GE_TR: xr6(GE_TR), GNLB: xr6(GR - GE) });
      const b = B(r), dep = b.hh[0] + b.fm[0] + b.gov[0] + b.nat[0], loan = b.hh[1] + b.fm[1] + b.gov[1] + b.nat[1];
      emit('balance', { galaxy, year, country: r, S14_F2_A: xr6(b.hh[0]), S14_F4_L: xr6(b.hh[1]), S11_F2_A: xr6(b.fm[0]), S11_F4_L: xr6(b.fm[1]), S13_F2_A: xr6(b.gov[0]), S13_F4_L: xr6(b.gov[1]), S13_F3_L: xr6(b.gov[2]), S1N_F2_A: xr6(b.nat[0]), S1N_F4_L: xr6(b.nat[1]), S122_F2_L: xr6(dep), S122_F4_A: xr6(loan), S122_F3_A: xr6(b.gov[2]), S122_RES_A: xr6(dep - loan - b.gov[2]) });
      let yl = 0, bonds = 0;
      for (const s of g.realmSystems(r)) { const gv = g.govs[s.id]; if (g.longYield && gv?.bond > 0) { yl += g.longYield(s.id) * gv.bond; bonds += gv.bond; } }
      const f0 = g.fiscalFor(r, r);
      emit('rates', { galaxy, year, country: r, CPI: xr6(g.cpiOf ? g.cpiOf(r) : 1), INFL: xr6(g.inflOf ? g.inflOf(r) : 0), IRS: xr6(g.cbRateAt ? g.cbRateAt(r) : g.rateAt(r)), IRL: xr6(g.longYield ? (bonds > 0 ? yl / bonds : g.longYield(r)) : 0), CB_RULE: f0.cb ?? 1 });
      // 政策の出来事: 前の年と違う値だけ
      const now = policyOf(r), before = st.lastPolicy[r];
      if (before) for (const [k, v] of Object.entries(now)) if (JSON.stringify(before[k]) !== JSON.stringify(v)) emit('policy', { galaxy, year, country: r, policy: k, from: before[k] ?? '', to: v ?? '' });
      st.lastPolicy[r] = now;
    }
    // 値段 (星系 × 年)
    if (g.price) for (const s of g.colonizedSystems()) emit('prices', { galaxy, year, system: s.id, country: g.realmOf(s.id), ...Object.fromEntries(RES.map((res) => [res, xr6(g.price(s.id, res))])) });
    // 戦争 (同じ 2 国がまた戦えば、別の戦争として数える。終わった前の戦争は別のキーに移す)
    const W = st.wars, active = new Set(Object.keys(g.realmWars));
    for (const key of active) {
      if (W[key] && W[key].end !== null) { const old = W[key]; delete W[key]; W[`${key}#${old.num}`] = old; }
      if (!W[key]) { const [a, b] = key.split('|').map(Number); W[key] = { num: ++st.warNum, a, b, an: name(a), bn: name(b), start: Math.round(g.realmWars[key]), end: null, init: g.warBy?.[key] ?? '', dead: 0, how: '' }; }
      const w = W[key];
      if (w.end === null) w.dead = Math.max(w.dead, g.warStats?.[key]?.dead || 0);
    }
    for (const [key, w] of Object.entries(W)) {
      if (w.end !== null || active.has(key) || key.includes('#')) continue;
      w.end = year;
      w.how = g.peaces?.some((p) => p.key === key && Math.round(p.year) === year) ? 'peace' : 'other';
    }
  };
  return { yearBegin, yearEnd };
}
// 記録した戦争 (exportRecorder の st.wars) から wars・wars_part の行を作る
function exportWars(st, emit, galaxy = '') {
  for (const w of Object.values(st.wars || {}).sort((a, b) => a.num - b.num)) {
    const end = w.end ?? '';
    emit('wars', { galaxy, WarNum: w.num, WarName: `${w.an}・${w.bn}`, StartYear: w.start, EndYear: end, Initiator: w.init, Outcome: w.end === null ? 'ongoing' : w.how, BatDeath: Math.round(w.dead) });
    for (const [side, c, n] of [[1, w.a, w.an], [2, w.b, w.bn]]) emit('wars_part', { galaxy, WarNum: w.num, ccode: c, StateName: n, Side: side, StartYear: w.start, EndYear: end, Initiator: w.init === c ? 1 : 0 });
  }
}
const exportCell = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const exportCsv = (t, rows) => `${[EXPORT_COLS[t].join(','), ...rows.map((r) => EXPORT_COLS[t].map((c) => exportCell(r[c])).join(','))].join('\n')}\n`;

// --- ゲームの中の記録 (回 GA11・B-196): 試合の始めから同じ足し上げを持ち、セーブに入れる ---
// 画面の版で試合を作るとき (screen/app.js の newGame) に g.xrec = xrecNew() を置く。画面なしの版 (道具・試験) は置かないので記録しない。
// 行は列の順の配列で持つ (セーブを小さくするため)。年の切れ目は advance の 1 歩ごとに xrecTick で見る
const xrecNew = () => ({ rows: {}, st: {} });
function xrecTick(g) {
  const X = g.xrec;
  if (!g.xrecHook) g.xrecHook = exportRecorder(g, (t, row) => (X.rows[t] ??= []).push(EXPORT_COLS[t].map((c) => row[c] ?? null)), X.st, String(g.galaxy?.seed ?? ''));
  const y = Math.floor(g.year + 1e-9);
  if (X.y === undefined) X.y = y;
  if (y > X.y) { g.xrecHook.yearEnd(); g.xrecHook.yearBegin(); X.y = y; }
}
// 表ごとの CSV (戦争は記録した戦争から、いま続いているものも)
function xrecCsv(g, t) {
  const X = g.xrec;
  if (!X) return null;
  if (t === 'wars' || t === 'wars_part') { const rows = []; exportWars(X.st, (k, r) => { if (k === t) rows.push(r); }, String(g.galaxy?.seed ?? '')); return exportCsv(t, rows); }
  return exportCsv(t, (X.rows[t] || []).map((a) => Object.fromEntries(EXPORT_COLS[t].map((c, i) => [c, a[i]]))));
}
saveField('xrec', (g) => g.xrec, { read: (g, d) => { if (d.xrec) g.xrec = d.xrec; delete g.xrecHook; } }); // 前の版のセーブは、読み込んだ年から記録する (画面の版で xrecNew を置いたとき)
