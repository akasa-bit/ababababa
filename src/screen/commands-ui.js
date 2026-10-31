// --- 命令の入口 ---
// ゲームの状態を変える操作は、すべてここを通す。ひとりで遊ぶとき・ホットシートでは、いま操作しているプレイヤーとしてすぐ実行する。
// ネット対戦ではホストへ送り、全員の端末が同じ時点で runCmd を実行する (Net.issue)
function issue(act, d) {
  if (Net.on) return Net.issue(act, d);
  const g = app.game, after = g.nextShipId - 1;
  const r = runCmd(g, g.pi, act, d);
  if (r?.ok) forecastSent(g, after); // 光速の指令になったものは、届く年と見込みを出す (B-056)
  if (r?.ok) PlayLog.firstAct(act); // 最初の判断の印 (B-060)
  return r;
}
function runCmd(g, pi, act, d) {
  return g.asPlayer(pi, () => {
    const r = g.command(act, d);
    if (r && (!r.ok || r.msg)) {
      const old = g.msgTo;
      if (g.players.length > 1) g.msgTo = pi;
      g.message(r.ok ? r.msg : JA`できない: ${r.reason}`);
      g.msgTo = old;
    }
    g.live = null; // 観戦モードの「いまの様子」を取り直す
    return r;
  });
}
// 画面だけの知らせ (セーブした・メモを記録した など)。ネット対戦では、全員で同じでなければならない記録には書かず、手元にだけ出す
function uiNote(text) {
  const g = app.game;
  if (Net.on) return Net.toast(text);
  const old = g.msgTo;
  if (g.players.length > 1) g.msgTo = g.pi;
  g.message(text);
  g.msgTo = old;
}
const panel = $('panel');
const empire = $('empire');
function onPanelClick(e) {
  const li = e.target.closest('li[data-body]');
  if (li) return app.selectBody(li.dataset.body);
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  rememberAnchor(btn);
  const { act, kind } = btn.dataset;
  PlayLog.add('act', { ...btn.dataset, ...(btn.dataset.sys === undefined && app.sel.sys !== undefined ? { at: app.sel.sys } : {}) });
  const g = app.game;
  const sys = btn.dataset.sys !== undefined ? Number(btn.dataset.sys) : app.sel.sys;
  const body = btn.dataset.body ?? app.sel.body;
  if (act === 'open') return app.setView('system');
  if (act === 'goto') { app.selectSystem(sys); return app.setView('galaxy'); }
  if (act === 'fleetsel') { app.fleetSel = new Set([sys]); app.fleetMove.clear(); app.fleetConfirm = null; app.setView('galaxy'); return renderFleetBar(); }
  if (act === 'gobody') { app.openSystem(sys); return app.selectBody(body); }
  if (act === 'etab') { app.empireTab = btn.dataset.t; app.dirty = true; return; }
  if (act === 'chartspan') { app.chartSpan = Number(btn.dataset.n); app.dirty = true; return; } // 財政のグラフの期間 (経済。回 GA9・B-059)
  if (act === 'evfilter') { app.eventFilter = btn.dataset.f; app.dirty = true; return; }
  // 知らせの帯
  if (act === 'deselect') return app.deselect();
  if (act === 'fly') { const s = g.system(sys); if (s) { app.selectSystem(sys); app.setView('galaxy'); galaxyView.centerOn(s); } return; }
  if (act === 'ack' || act === 'ackall') {
    const ids = act === 'ack' ? btn.dataset.id.split(',').map(Number) : g.knownEvents().filter((e) => evTier(e.kind) >= 3).map((e) => e.id); // ack は束ねた続報ごと
    issue('set', { key: 'acked', value: ids });
    setHtml($('rail'), railHtml(g));
    return;
  }
  if (act === 'railtoggle') { app.railHidden = !railHidden(); setHtml($('rail'), railHtml(g)); return; }
  if (act === 'evmode') { EvPrefs.mode = btn.dataset.m; saveEvPrefs(); app.dirty = true; return; }
  if (act === 'evtier') {
    // 段ごとにまとめて切り替える (全部出ていれば隠し、そうでなければ全部出す)
    const ks = Object.keys(EVENT_KIND).filter((k) => evTier(k) === Number(btn.dataset.tier));
    const on = !ks.every(evShown);
    for (const k of ks) EvPrefs.kinds[k] = on;
    saveEvPrefs();
    app.dirty = true;
    return;
  }
  if (act === 'back') return app.selectBody(null);
  // 作戦の手引き: 隠す・出す (見るだけ。帝国 → 目標からも出せる)・タブを開く
  if (act === 'guidehide' || act === 'guideshow') { app.guideHidden = act === 'guidehide'; setHtml($('rail'), railHtml(g)); app.dirty = true; return; }
  if (act === 'view') return app.setView(btn.dataset.v);
  if (act === 'surpriseack') { (app.surpriseAck ||= new Set()).add(Number(btn.dataset.id)); setHtml($('rail'), railHtml(g)); return; } // 奇襲の警告を確かめた (画面だけ)
  if (act === 'treatyopen') return openTreaty(Number(btn.dataset.id));
  // 行動はすべて command を通す。太陽系以外が対象なら光速の指令になり、届いた先の政府が実行する
  const d = { ...btn.dataset, sys, body, kind };
  if (act === 'send' || act === 'candsend') d.from = 0;
  let r;
  if (act === 'bulkfocus') {
    for (const sx of g.knownOwnSystems()) for (const c of g.knownColonies(sx.id)) issue('focus', { col: colKey(c), value: app.bulkFocus || 'balanced' });
    r = { ok: true };
  } else {
    r = issue(act, d);
  }
  if (!r) return;
  if (r.ok && (act === 'send' || act === 'candsend')) firstMoveDone();
  if (r.ok) Sound.play('send');
  app.dirty = true;
  save();
}
// スライダーを動かしているあいだは、横の値だけ書き換える (命令は離したとき = change)
function onPanelInput(e) {
  const t = e.target;
  if (t.type === 'range' && t.dataset.act === 'fiscal') { const o = t.parentElement?.querySelector('output'); if (o) o.textContent = fiscalFmt(t.dataset.fmt, t.value); }
}
function onPanelChange(e) {
  const { act, col } = e.target.dataset;
  const v = e.target.value;
  if (act) PlayLog.add('set', { act, v: e.target.type === 'checkbox' ? e.target.checked : v, ...(col ? { col } : {}), ...(e.target.dataset.sys !== undefined ? { sys: e.target.dataset.sys } : {}) });
  if (act === 'rdest') app.routeDest = Number(v);
  else if (act === 'forigin') app.fleetOrigin = Number(v);
  else if (act === 'bulkfocus') app.bulkFocus = v;
  else if (act === 'candonly') app.candOnly = e.target.checked;
  else if (act === 'ra') app.routeA = Number(v);
  else if (act === 'torigin') app.troopOrigin = v;
  else if (act === 'rb') app.routeB = Number(v);
  else if (['warpolicy', 'autohabitat', 'autoroutes', 'migration', 'autogrant', 'autobuild', 'autoawe', 'autodefense'].includes(act)) {
    const key = { warpolicy: 'warThreshold', autohabitat: 'autoHabitat', autoroutes: 'autoRoutes', migration: 'migration', autogrant: 'autoGrant', autobuild: 'autoBuild', autoawe: 'autoAwe', autodefense: 'autoDefense' }[act];
    issue('set', { key, value: act === 'warpolicy' ? Number(v) : e.target.checked });
  } else if (act === 'autodev') {
    issue('set', { key: 'auto', sys: Number(e.target.dataset.sys), value: e.target.checked });
  }
  else if (act === 'candsort') app.candSort = v;
  else if (act === 'evkind') { EvPrefs.kinds[e.target.dataset.k] = e.target.checked; saveEvPrefs(); }
  else if (act === 'regimedefault') issue('set', { key: 'regime', value: v });
  else if (act === 'histtype') { app.histType = v; } // 史料の欄で読む型 (見るだけ)
  else if (act === 'fiscalctl') { // 価格統制と交易の規制 (経済。回 KE9・B-008): 選んだ 1 つだけを変えた財政の法案を出す
    const c = app.game.fiscalDraft(), { k, r } = e.target.dataset;
    const o = { ...(c[k] || {}) };
    if (k === 'ceil') { if (Number(v)) o[r] = Number(v); else delete o[r]; } else if (e.target.checked) o[r] = true; else delete o[r];
    issue('fiscal', { [k]: o });
    save();
  }
  else if (act === 'fiscal') {
    const c = app.game.fiscalDraft(); // 審議中の法案があれば、その値から (政治。回 SE7)
    const d = { tax: c.tax, ctax: c.ctax || 0, tariff: c.tariff || 0, rate: c.rate, deficit: c.deficit || 0, ...c.budget };
    const k = e.target.dataset.k;
    d[k] = Number(v);
    issue('fiscal', d);
    save();
  }
  else if (act === 'pvdesign') { issue('pvdesign', { sys: Number(e.target.dataset.sys), value: v }); save(); }
  else if (act === 'design') { issue('design', { [e.target.dataset.k]: v }); save(); } // 入植船の設計 (船と戦争の ship/ships-ui.js。B-033)
  else if (act === 'include') { issue('include', { sys: Number(e.target.dataset.sys), key: e.target.dataset.key, value: v }); save(); } // 直轄の星系の集団の権力への近さ (政治の politics/panels.js。B-020)
  else if (act === 'bundle') {
    // 約定の 1 項目の交渉は光速の指令 (政治力を使う)
    issue('bundle', { sys: Number(e.target.dataset.sys), item: e.target.dataset.item, value: v });
    save();
  }
  else if (act === 'mandate' || act === 'governor') {
    // 委任方針・総督の方針の変更は光速の指令 (政治力を使う)
    issue(act, { sys: Number(e.target.dataset.sys), value: v });
    save();
  }
  else if (act === 'focus') {
    if (FOCUS[v]) issue('focus', { col, value: v });
  } else return;
  e.target.blur();
  app.dirty = true;
}
// 数値は刻々と変わるのでパネルを定期的に描き直す。ただし操作中 (押している・指を置いている・スクロール中・選択肢を開いている) は待つ。
// タッチでスクロールが始まるとブラウザは pointercancel を送るので、指の有無は touch イベントで、スクロール中かは scroll イベントで見る
let panelHeld = false;
let touching = false;
let lastScroll = 0;
// 開け閉めした節・説明は覚えておく (描き直しても開いたまま)
function onToggle(e) {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement)) return;
  if (d.dataset.sec) (app.secOpen ??= {})[d.dataset.sec] = d.open;
  else if (d.dataset.h) { app.helpOpen ??= new Set(); if (d.open) app.helpOpen.add(d.dataset.h); else app.helpOpen.delete(d.dataset.h); }
}
$('rail').addEventListener('click', onPanelClick);
for (const el of [panel, empire]) {
  el.addEventListener('toggle', onToggle, true);
  el.addEventListener('click', onPanelClick);
  el.addEventListener('change', onPanelChange);
  el.addEventListener('input', onPanelInput);
  el.addEventListener('pointerdown', () => { panelHeld = true; });
  el.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  // 表の横スクロール (.scroll) の scroll イベントは泡立たないので capture で拾う
  // (keepAnchor が自分で合わせたスクロールは数えない。連打のたびに書き換えが遅れないように)
  el.addEventListener('scroll', () => { if (performance.now() - anchorScrollAt > 150) lastScroll = performance.now(); }, { capture: true, passive: true });
}
window.addEventListener('pointerup', () => { panelHeld = false; });
window.addEventListener('pointercancel', () => { panelHeld = false; });
window.addEventListener('touchend', (e) => { if (!e.touches.length) touching = false; }, { passive: true });
window.addEventListener('touchcancel', (e) => { if (!e.touches.length) touching = false; }, { passive: true });
// 押したボタンを、書き換えのあとも同じ位置に残す: 上の中身が増えても、欄のスクロールを合わせて中身が上へ逃げるようにする
// (「拡張」などを同じ場所で続けて押せるように)。3 秒たつか、自分で欄をスクロールしたら忘れる
let anchor = null, anchorScrollAt = 0;
function rememberAnchor(btn) {
  const box = btn.closest('aside, #empire');
  if (!box) return;
  const sel = Object.entries(btn.dataset).map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${CSS.escape(v)}"]`).join('');
  // 同じボタンが欄に複数あるときは、押したのが何番目かも覚えておく
  const i = [...box.querySelectorAll(`button${sel}`)].indexOf(btn);
  anchor = { box, sel: `button${sel}`, i, top: btn.getBoundingClientRect().top, until: performance.now() + 3000 };
}
function keepAnchor() {
  if (!anchor || performance.now() > anchor.until) { anchor = null; return; }
  const el = anchor.box.querySelectorAll(anchor.sel)[anchor.i];
  if (!el) return;
  const d = el.getBoundingClientRect().top - anchor.top;
  if (Math.abs(d) > 0.5) { anchorScrollAt = performance.now(); anchor.box.scrollTop += d; }
}
for (const box of [document.querySelector('aside'), empire]) box.addEventListener('scroll', () => { if (performance.now() - anchorScrollAt > 150) anchor = null; }, { passive: true });
const panelBusy = () => panelHeld || touching || performance.now() - lastScroll < 800 || document.activeElement?.tagName === 'SELECT';
// 中身が変わったときだけ書き換える (同じ HTML を入れ直すとレイアウトの計算が走って重い)
function setHtml(el, html) {
  if (el.lastHtml === html) return;
  el.lastHtml = html;
  el.innerHTML = html;
}
// 描き直しても、表の横スクロール位置はそのまま残す
// (別の画面・タブに切り替えたときは引き継がない)
function setHtmlKeepScroll(el, html) {
  const key = `${app.view}|${app.empireTab}|${app.sel.sys}|${app.sel.body}`;
  if (el.dataset.key === key && el.lastHtml === html) return; // 中身が同じなら描き直さない (重いレイアウトの計算を省く)
  el.lastHtml = html;
  const xs = el.dataset.key === key ? [...el.querySelectorAll('.scroll')].map((x) => x.scrollLeft) : [];
  el.dataset.key = key;
  el.innerHTML = html;
  el.querySelectorAll('.scroll').forEach((x, i) => { if (xs[i]) x.scrollLeft = xs[i]; });
}
