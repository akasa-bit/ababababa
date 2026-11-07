// 上の帯の資源 (依頼 2026-11-07 の GA-1): 経済の画面を開かなくても、何の資源が足りないか分かるように、資金の帯の下に資源ごとの残量と変化の割合を出す。
// 上の段 = 星系 (選んでいる自分の国の星系。選んでいなければ首都)、下の段 = 国全体。どちらも光が首都に届いた時点の記録 (known。経済の画面と同じ)。
// 資源を押すと、その資源の需要と供給の内訳を小さな欄で出す (生産と需要は年あたり。経済の画面と同じく交易路での出入りは含まないので、
// 見てきた在庫の変化との差を「交易などの出入り」として出す)。
// 変化の割合は、この画面で見てきた在庫の記録の、およそ 1 年前との比 (年あたり。交易での出入りも入る)。記録は画面だけが持つ
// (試合の状態にもセーブにも入れない)。読み込んだ直後と、半年ぶん見るまでは出さない。
// 赤くするのは、いま足りていない (入植地の生活物資が足りない) か、見てきた減り方のままだと 2 年以内に尽きるとき。
// 試合の状態は読むだけ (stockOf のように、無い物を作る関数は呼ばない。known・knownColonies・knownOwnSystems は経済の画面と同じ使い方)
const RESBAR = { hist: [], game: null, cap: null, open: null, soon: 2 }; // hist = [{ y, nat: {資源: 在庫}, sys: Map(星系 → {資源: 在庫}) }]。soon = 赤くする尽きるまでの年
const RES_SAT = ['food', 'water', 'goods']; // 入植地の満たされ方 (sat) がある資源

// 自分の国の星系 (光が届いた範囲) と、その記録
function resSystems(g) {
  return g.knownOwnSystems().map((s) => ({ id: s.id, name: s.name, k: g.known(s.id) })).filter((x) => x.k?.stock);
}
// 帯の上の段の星系: 選んでいる自分の国の星系。なければ首都
function resPick(g, sel) {
  const own = resSystems(g);
  return { own, s: own.find((x) => x.id === sel) || own.find((x) => x.id === g.cap) || own[0] || null };
}
// 星系の記録を足し合わせる (在庫・生産・需要)
function resSum(list) {
  const stock = zeroRes(), prod = zeroRes(), cons = zeroRes();
  for (const x of list) for (const r of RES) { stock[r] += x.k.stock[r] || 0; prod[r] += x.k.prod?.[r] || 0; cons[r] += x.k.cons?.[r] || 0; }
  return { stock, prod, cons };
}
// 在庫の記録を足す (画面の 0.5 秒ごとの更新から。試合の年が 1/8 年進むごと。1.5 年より古いものは捨てる。試合・首都が変わったら作り直す)
function resSample(g) {
  const H = RESBAR, last = H.hist[H.hist.length - 1];
  if (H.game !== g || H.cap !== g.cap || (last && g.year < last.y - 1e-9)) { H.game = g; H.cap = g.cap; H.hist = []; }
  else if (last && g.year - last.y < 0.125) return;
  const own = resSystems(g);
  H.hist.push({ y: g.year, nat: resSum(own).stock, sys: new Map(own.map((x) => [x.id, { ...x.k.stock }])) });
  while (H.hist.length > 2 && H.hist[1].y <= g.year - 1.5) H.hist.shift();
}
// 見てきた変化: いまの値 now と、およそ 1 年前の記録の値から、年あたりの増減 d と割合 rate (前の値が 0 なら null)。半年より新しい記録しかなければ null
function resChange(g, now, pick) {
  let best = null;
  for (const h of RESBAR.hist) {
    if (h.y > g.year - 0.5) break;
    const v = pick(h);
    if (v === undefined) continue;
    if (!best || Math.abs(h.y - (g.year - 1)) < Math.abs(best.y - (g.year - 1))) best = { y: h.y, v };
  }
  if (!best) return null;
  const d = (now - best.v) / (g.year - best.y);
  return { d, rate: Math.abs(best.v) > 1e-6 ? d / Math.abs(best.v) : null };
}
const resPct = (ch) => {
  if (!ch || ch.rate === null) return '';
  const x = ch.rate, a = Math.abs(x);
  if (a < 0.005) return '<i class="z">±0%</i>';
  return `<i class="${x < 0 ? 'dn' : 'up'}">${x < 0 ? '−' : '+'}${a >= 9.995 ? '999+' : a < 0.095 ? (a * 100).toFixed(1) : Math.round(a * 100)}%</i>`;
};
// 足りていない入植地の数 (生活物資の満たされ方が 99% 未満。水は水を使う入植地だけ。経済の画面の「生活物資」「物品」と同じ)
function resShortCols(g, ids, r) {
  if (!RES_SAT.includes(r)) return 0;
  let n = 0;
  for (const id of ids) for (const c of g.knownColonies(id)) if ((r !== 'water' || g.needsWater(c)) && (c.sat?.[r] ?? 1) < 0.99) n++;
  return n;
}
// 見てきた減り方のままで尽きるまでの年 (減っていなければ null)
const resLast = (stock, ch) => (ch && ch.d < -1e-9 ? Math.max(0, stock) / -ch.d : null);
// 赤くする: いま足りない入植地がある・2 年以内に尽きる
const resBad = (g, ids, stock, r, ch) => resShortCols(g, ids, r) > 0 || (resLast(stock, ch) ?? Infinity) < RESBAR.soon;
// 出す資源 (奴隷は、国のどこかにいるときだけ)
const resShown = (T) => RES.filter((r) => r !== 'slaves' || T.stock.slaves > 0 || T.prod.slaves > 0 || T.cons.slaves > 0);
// 上の段 (星系) と下の段 (国全体) の値
function resRows(g, own, s, r) {
  const T = resSum(own);
  const sv = { stock: s.k.stock[r] || 0, prod: s.k.prod?.[r] || 0, cons: s.k.cons?.[r] || 0, ch: resChange(g, s.k.stock[r] || 0, (h) => h.sys.get(s.id)?.[r]), ids: [s.id] };
  const nv = { stock: T.stock[r], prod: T.prod[r], cons: T.cons[r], ch: resChange(g, T.stock[r], (h) => h.nat[r]), ids: own.map((x) => x.id) };
  for (const v of [sv, nv]) v.bad = resBad(g, v.ids, v.stock, r, v.ch);
  return { sv, nv };
}

function resBarHtml(g, sel) {
  const { own, s } = resPick(g, sel);
  if (!s) return '';
  const cell = (v) => `<span class="${v.bad ? 'bad' : ''}">${fmtAmt(v.stock)}</span>${resPct(v.ch)}`;
  const chips = resShown(resSum(own)).map((r) => {
    const { sv, nv } = resRows(g, own, s, r);
    return TR`<button class="rc${RESBAR.open === r ? ' on' : ''}" data-res="${r}" title="${RES_LABEL[r]} (押すと需要と供給)" aria-label="${RES_LABEL[r]}">${ico(r)}<span class="s">${cell(sv)}</span><span class="n">${cell(nv)}</span></button>`;
  });
  return TR`<span class="rl" title="上の段は星系 (選んでいる自分の国の星系。選んでいなければ首都)、下の段は国全体。どちらも光が首都に届いた時点の在庫。% は 1 年前からの変化"><b>${esc(s.name)}</b><small>国全体</small></span>` + chips.join('');
}

// 押した資源の需要と供給の内訳 (小さな欄)
function resPopHtml(g, sel, r) {
  const { own, s } = resPick(g, sel);
  if (!s || !RES.includes(r)) return '';
  const { sv, nv } = resRows(g, own, s, r);
  const sg = (v) => (Math.abs(v) < 0.05 ? '±0' : `${v > 0 ? '+' : '−'}${fmtAmt(Math.abs(v))}`);
  const col = (v) => {
    const last = resLast(v.stock, v.ch), nShort = resShortCols(g, v.ids, r);
    return {
      st: `<span class="${v.bad ? 'bad' : ''}">${fmtAmt(v.stock)}</span>`,
      ch: v.ch ? `${resPct(v.ch) || '<span class="muted">—</span>'} <span class="muted">${sg(v.ch.d)}</span>` : '<span class="muted">—</span>',
      pr: `+${fmtAmt(v.prod)}`, co: `−${fmtAmt(v.cons)}`, net: sg(v.prod - v.cons),
      tr: v.ch ? sg(v.ch.d - (v.prod - v.cons)) : '<span class="muted">—</span>', // 見てきた変化 − (生産 − 需要) = 交易・倉・入植船などの出入り
      last: last === null ? '—' : `<span class="${last < RESBAR.soon ? 'bad' : ''}">${TR`${last >= 100 ? '100+' : last.toFixed(1)} 年`}</span>`,
      short: RES_SAT.includes(r) ? (nShort ? `<span class="bad">${nShort}</span>` : '0') : null,
    };
  };
  const a = col(sv), b = col(nv);
  const row = (label, x, y) => `<tr><td>${label}</td><td>${x}</td><td>${y}</td></tr>`;
  // 星系ごと: 生産が需要に足りない分 (需要 − 生産) の大きい順に 6 つまで
  const per = own.filter((x) => (x.k.stock[r] || 0) + (x.k.prod?.[r] || 0) + (x.k.cons?.[r] || 0) > 0)
    .sort((p, q) => ((q.k.cons?.[r] || 0) - (q.k.prod?.[r] || 0)) - ((p.k.cons?.[r] || 0) - (p.k.prod?.[r] || 0)));
  const rows = per.slice(0, 6).map((x) => {
    const ch = resChange(g, x.k.stock[r] || 0, (h) => h.sys.get(x.id)?.[r]), bad = resBad(g, [x.id], x.k.stock[r] || 0, r, ch);
    return `<tr><td>${esc(x.name)}${x.id === g.cap ? '' : ` ${ageBadge(g, x.id)}`}</td><td class="${bad ? 'bad' : ''}">${fmtAmt(x.k.stock[r] || 0)}${resPct(ch)}</td><td>+${fmtAmt(x.k.prod?.[r] || 0)}</td><td>−${fmtAmt(x.k.cons?.[r] || 0)}</td></tr>`;
  }).join('');
  return TR`<div class="hd"><b>${ico(r)}${RES_LABEL[r]}</b><button class="x" data-act="respop-close" aria-label="閉じる">×</button></div>
    <table class="tbl"><tr><th></th><th>${esc(s.name)}</th><th>国全体</th></tr>
    ${row(TR('在庫'), a.st, b.st)}${row(TR('変化 (年あたり)'), a.ch, b.ch)}
    ${row(TR('供給 (生産)'), a.pr, b.pr)}${row(TR('需要'), a.co, b.co)}${row(TR('生産 − 需要'), a.net, b.net)}
    ${row(TR('交易などの出入り (差し引き)'), a.tr, b.tr)}${row(TR('このままで尽きるまで'), a.last, b.last)}${a.short === null ? '' : row(TR('足りない入植地'), a.short, b.short)}</table>
    ${rows ? TR`<table class="tbl"><tr><th>星系 (生産が需要に足りない順)</th><th>在庫</th><th>生産</th><th>需要</th></tr>${rows}</table>${per.length > 6 ? TR`<p class="muted">ほか ${per.length - 6} 星系</p>` : ''}` : ''}
    <p class="muted">年あたり。光が首都に届いた時点の記録。生産と需要は交易路での出入りを含まない (経済の画面と同じ)。変化と尽きるまでの年は、この画面で見てきた在庫のおよそ 1 年前との差 (交易も含む)。交易などの出入りは、その差から生産と需要を引いたもの</p>`;
}

// 小さな欄を出す・しまう・中身を新しくする (帯の資源の下に置く)
function resPopShow() {
  const pop = $('respop');
  const btn = RESBAR.open && $('resbar').querySelector(`[data-res="${RESBAR.open}"]`);
  if (!btn) { RESBAR.open = null; pop.hidden = true; return; }
  setHtml(pop, helpify(resPopHtml(app.game, app.sel.sys, RESBAR.open)));
  pop.hidden = false;
  const b = btn.getBoundingClientRect(), w = pop.offsetWidth;
  pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, b.left))}px`;
  pop.style.top = `${b.bottom + 4}px`;
}
function resBarRefresh() {
  const g = app.game;
  if (!g) return;
  resSample(g);
  setHtml($('resbar'), resBarHtml(g, app.sel.sys));
  for (const b of $('resbar').querySelectorAll('[data-res]')) b.classList.toggle('on', b.dataset.res === RESBAR.open);
  resPopShow(); // 開いていれば中身と場所を新しく、閉じていればしまう
}
$('resbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-res]');
  if (!b) return;
  RESBAR.open = RESBAR.open === b.dataset.res ? null : b.dataset.res;
  for (const x of $('resbar').querySelectorAll('[data-res]')) x.classList.toggle('on', x.dataset.res === RESBAR.open);
  resPopShow();
});
$('respop').addEventListener('click', (e) => { if (e.target.closest('[data-act="respop-close"]')) { RESBAR.open = null; resBarRefresh(); } });
// 欄の外を押す・Esc で閉じる
window.addEventListener('pointerdown', (e) => { if (RESBAR.open && !e.target.closest('#respop, #resbar')) { RESBAR.open = null; resBarRefresh(); } });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && RESBAR.open) { RESBAR.open = null; resBarRefresh(); } });
window.addEventListener('resize', () => { if (RESBAR.open) resPopShow(); });
