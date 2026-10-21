// --- プレイ記録: 自分がどう遊んだかを、感想ではなく行動として残す (このブラウザの中だけに保存し、外には送らない) ---
// 操作・速さの切り替え・見ていた画面・操作のない時間・メモを記録する。メモにはその時点のゲームの状態も残す
const MEMO_TAGS = { bored: '退屈', confused: '分からない', torn: '迷う', fun: '面白い' };
const PLAYLOG_KEY = `${STORE}-playlog`;
const PlayLog = {
  on: true,
  sessions: [], // 過去のセッション (新しいものが後ろ)
  cur: null,
  t0: performance.now(),
  lastInput: performance.now(),
  start() {
    this.t0 = performance.now();
    this.cur = { id: Date.now(), startedAt: Date.now(), seed: String(app.game.galaxy.seed), y0: app.game.year, y1: app.game.year, entries: [], visibleMs: 0, runningMs: 0, pausedMs: 0, idleMs: 0, views: {} };
  },
  add(k, data = {}) {
    if (!this.on || !this.cur || this.cur.entries.length >= 5000) return;
    this.cur.entries.push({ t: Math.round((performance.now() - this.t0) / 100) / 10, y: Math.round(app.game.year * 100) / 100, k, ...data });
  },
  // 毎フレーム: 見ていた時間・進めていた時間・止めていた時間・画面ごとの時間・操作のない時間 (30秒以上) を足す
  tick(ms) {
    if (!this.on || !this.cur || document.hidden) return;
    const c = this.cur;
    c.visibleMs += ms;
    if (app.speed && !app.homeOpen) c.runningMs += ms; else c.pausedMs += ms;
    const v = app.homeOpen ? 'home' : app.view === 'empire' ? `empire/${app.empireTab || 'overview'}` : app.view;
    c.views[v] = (c.views[v] || 0) + ms;
    if (performance.now() - this.lastInput > 30000) c.idleMs += ms;
    c.y1 = app.game.year;
  },
  input() {
    const gap = performance.now() - this.lastInput;
    if (gap > 30000) this.add('idle', { s: Math.round(gap / 1000) });
    this.lastInput = performance.now();
  },
  // セッションの要約: 実時間・進めた年数・止めていた割合・1分あたりの操作・操作のない時間・メモ
  summary(c) {
    const acts = c.entries.filter((e) => ['act', 'set', 'fleet', 'fleetclear'].includes(e.k)).length;
    const min = c.visibleMs / 60000;
    const memos = c.entries.filter((e) => e.k === 'memo');
    const tags = {};
    for (const m of memos) if (m.tag) tags[m.tag] = (tags[m.tag] || 0) + 1;
    return { startedAt: c.startedAt, minutes: min, years: c.y1 - c.y0, pausedShare: c.visibleMs ? c.pausedMs / c.visibleMs : 0, actsPerMin: min ? acts / min : 0, acts, idleMin: c.idleMs / 60000, memos: memos.length, tags,
      topViews: Object.entries(c.views).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, ms]) => [v, c.visibleMs ? ms / c.visibleMs : 0]) };
  },
  all() { return this.cur ? [...this.sessions, this.cur] : [...this.sessions]; },
  persist() {
    if (!Store.ready) return;
    const sessions = this.all().filter((c) => c.visibleMs > 5000 || c.entries.length).slice(-30);
    Store.put(PLAYLOG_KEY, JSON.stringify({ on: this.on, sessions }));
  },
  async init() {
    try {
      const d = JSON.parse((await Store.get(PLAYLOG_KEY)) || 'null');
      if (d && Array.isArray(d.sessions)) { this.sessions = d.sessions.filter((c) => c && Array.isArray(c.entries)); this.on = d.on !== false; }
    } catch { /* 壊れた記録は捨てる */ }
  },
  memos() { return this.all().flatMap((c) => c.entries.filter((e) => e.k === 'memo').map((e) => ({ ...e, session: c.id }))); },
};
// メモ: 開いた時点のゲームの状態を取っておき、記録するときにメモと一緒に保存する (残すのは新しい30件まで)
let memoSnap = null;
let memoSpeed = 0;
function openMemo() {
  memoSnap = { text: saveJSON(app.game, { speed: app.speed }), year: app.game.year, view: app.view };
  memoSpeed = app.speed;
  app.speed = 0;
  updateSpeedButtons();
  document.querySelectorAll('#memobox [data-tag]').forEach((b) => b.classList.remove('on'));
  $('memotext').value = '';
  $('memobox').hidden = false;
}
function closeMemo() {
  $('memobox').hidden = true;
  memoSnap = null;
  app.speed = memoSpeed;
  updateSpeedButtons();
}
async function saveMemo() {
  const tag = document.querySelector('#memobox [data-tag].on')?.dataset.tag || null;
  const text = $('memotext').value.trim();
  const snap = memoSnap;
  closeMemo();
  if (!tag && !text) return;
  const key = `${STORE}-memo-${Date.now()}`;
  const ok = snap ? await Store.put(key, snap.text) : false;
  PlayLog.add('memo', { tag, text, snap: ok ? key : null, at: snap ? Math.round(snap.year * 100) / 100 : undefined, view: snap?.view });
  // 古いメモの状態は消す (容量のため。メモの文は残る)
  const keys = PlayLog.memos().map((m) => m.snap).filter(Boolean);
  for (const k of keys.slice(0, Math.max(0, keys.length - 30))) {
    Store.del(k);
    for (const c of PlayLog.all()) for (const e of c.entries) if (e.snap === k) e.snap = null;
  }
  PlayLog.persist();
  uiNote(`メモを記録した${tag ? ` (${MEMO_TAGS[tag]})` : ''}`);
}
function exportPlayLog() {
  const sessions = PlayLog.all().map((c) => ({ ...c, summary: PlayLog.summary(c) }));
  const blob = new Blob([JSON.stringify({ app: 'nolongerubiquitous', edition: EDITION, kind: 'playlog', exportedAt: Date.now(), sessions }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nolongerubiquitous${EDITION === 'sim' ? '-sim' : ''}-playlog-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// ホーム画面の「プレイ記録」
function playLogHtml() {
  const fmtMin = (m) => (m >= 60 ? `${(m / 60).toFixed(1)} 時間` : `${m.toFixed(0)} 分`);
  const VIEW_LABEL = { galaxy: '星間マップ', system: '星系マップ', events: 'イベント', cands: '候補地', home: 'ホーム', 'empire/overview': '帝国・概要', 'empire/routes': '帝国・交易路', 'empire/migration': '帝国・移民', 'empire/military': '帝国・軍事', 'empire/politics': '帝国・政治' };
  const rows = PlayLog.all().slice(-8).reverse().map((c) => {
    const m = PlayLog.summary(c);
    return `<tr><td>${esc(new Date(m.startedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td><td>${fmtMin(m.minutes)}</td><td>${m.years.toFixed(0)} 年</td>
      <td>${Math.round(m.pausedShare * 100)}%</td><td>${m.actsPerMin.toFixed(1)}</td><td>${fmtMin(m.idleMin)}</td>
      <td>${m.topViews.map(([v, f]) => `${esc(VIEW_LABEL[v] || v)} ${Math.round(f * 100)}%`).join('・')}</td><td>${m.memos}${Object.keys(m.tags).length ? ` (${Object.entries(m.tags).map(([t, n]) => `${MEMO_TAGS[t]}${n}`).join('・')})` : ''}</td></tr>`;
  }).join('');
  const memos = PlayLog.memos().slice(-10).reverse().map((e) => `<div class="row"><div class="info">${e.tag ? `<b>${MEMO_TAGS[e.tag]}</b> ` : ''}${esc(e.text || '')}<br><span class="muted">西暦 ${Math.floor(e.at ?? e.y)}年</span></div>
    ${e.snap ? `<button data-home="memoload" data-k="${esc(e.snap)}">この時点をロード</button>` : '<span class="muted">状態は残っていない</span>'}</div>`).join('');
  return `<section><h3>プレイ記録</h3>
    <p class="muted">自分がどう遊んだかを記録する (このブラウザの中だけ)。ヘッダーの「メモ」で、退屈・分からない・迷う・面白いと感じた瞬間を、その時点の状態と一緒に残せる。</p>
    <div class="row"><button data-home="logtoggle">${PlayLog.on ? '記録: オン' : '記録: オフ'}</button><button data-home="logexport">記録を書き出す</button><button class="ghost" data-home="logclear">${app.homeArmed === 'logclear' ? '本当に消す?' : '記録を消す'}</button></div>
    ${rows ? `<div class="scroll"><table class="log"><tr><th>開始</th><th>遊んだ時間</th><th>進めた</th><th>止めていた</th><th>操作/分</th><th>操作なし</th><th>よく見た画面</th><th>メモ</th></tr>${rows}</table></div>` : ''}
    ${memos ? `<h4 style="margin:8px 0 2px">最近のメモ</h4>${memos}` : ''}
  </section>`;
}
// セーブデータを読み込んで現在のゲームに反映する。失敗時は現在の状態を保つ。
function loadSave(d) {
  const prev = app.game;
  newGame(d.seed, d.galaxy === 'real' ? 'real' : 'flat', d.gen || 1);
  if (app.game.restore(d)) {
    app.speed = SPEEDS.includes(d.speed) ? d.speed : 1;
    updateSpeedButtons();
    return true;
  }
  app.game = prev;
  return false;
}

function save() {
  if (!Store.ready) return;
  const ok = writeSave(app.game, { speed: app.speed });
  $('savestat').textContent = ok ? `自動セーブ済み ${app.game.year.toFixed(1)}年` : 'セーブできなかった (保存容量が足りないか、この環境では保存できない)';
}

$('savenow').onclick = () => { save(); PlayLog.add('ui', { act: 'savenow' }); uiNote('セーブした。'); };
function exportSave() {
  const blob = new Blob([saveJSON(app.game, { speed: app.speed })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nolongerubiquitous${EDITION === 'sim' ? '-sim' : ''}-${app.game.year.toFixed(0)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('importfile').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const d = parseSave(await f.text());
  if (d && loadSave(d)) { save(); app.game.message('セーブデータを読み込んだ。'); closeHome(d.speed); }
  else { app.homeNote = 'セーブデータを読み込めなかった。'; renderHome(); }
};

