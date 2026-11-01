// --- プレイ記録: 自分がどう遊んだかを、感想ではなく行動として残す (このブラウザの中だけに保存し、外には送らない) ---
// 操作・速さの切り替え・見ていた画面・操作のない時間・メモを記録する。メモにはその時点のゲームの状態も残す。
// 同意 (B-060。QD-55〜QD-58 = おすすめ): 記録は「切」で始め、はじめて遊ぶときに 1 回だけ同意の画面で選んでもらう。
// 記録はこの端末の中だけに置き、開発者に届くのは本人が「記録を書き出す」で作ったファイルを送ったときだけ
const MEMO_TAGS = { bored: '退屈', confused: '分からない', torn: '迷う', fun: '面白い' };
const PLAYLOG_KEY = `${STORE}-playlog`;
const CONSENT_KEY = `${STORE}-playlog-consent`; // 'yes' = 記録してよい、'no' = 記録しない、なし = まだ聞いていない
const CONSENT_TEXT = {
  title: '遊び方の記録にご協力ください',
  lead: 'このゲームをよくするため、あなたがどう遊んだかを記録させてください。',
  items: [
    '記録するもの: 押したボタンの種類と時刻、ゲームの中の年、見ていた画面とその時間、ゲームの速さ、操作のなかった時間、あなたが書いたメモ (書いたときのゲームの状態を含む)、画面の大きさ。',
    '記録しないもの: 名前・メールアドレス・アカウント・IP アドレス・住んでいる場所・ほかのアプリの様子。',
    '記録はこの端末のブラウザの中だけに置かれます。開発者に届くのは、あなたがホーム画面の「記録を書き出す」で作ったファイルを、自分で送ったときだけです。',
    'いつでもホーム画面の「プレイ記録」から止められ、消せます。記録してもしなくても、遊び方は何も変わりません。',
  ],
};
const readConsent = () => { try { return localStorage.getItem(CONSENT_KEY); } catch { return null; } };
// F04 (最初の意味のある判断までの時間) のための印: 1 回の遊びの中で、それぞれ最初の 1 回だけ記録する
const FIRST_ACTS = { send: 'colony', candsend: 'colony', route: 'route', route2: 'route', rule: 'regime' };
const PlayLog = {
  consent: readConsent(),
  on: readConsent() === 'yes',
  sessions: [], // 過去のセッション (新しいものが後ろ)
  cur: null,
  t0: performance.now(),
  lastInput: performance.now(),
  start() {
    this.t0 = performance.now();
    this.cur = { id: Date.now(), startedAt: Date.now(), seed: String(app.game.galaxy.seed), y0: app.game.year, y1: app.game.year, entries: [], visibleMs: 0, runningMs: 0, pausedMs: 0, idleMs: 0, views: {},
      vw: window.innerWidth, vh: window.innerHeight, ed: EDITION, firsts: {} }; // 画面の大きさ (CSS) と版 (QD-57)
  },
  // 最初の判断の印 (QD-57): その回で初めての入植船・交易路・統治体制の判断の時刻 (開いてからの秒)
  firstAct(act) {
    const what = FIRST_ACTS[act];
    if (!what || !this.on || !this.cur || this.cur.firsts?.[what] !== undefined) return;
    (this.cur.firsts ||= {})[what] = Math.round((performance.now() - this.t0) / 100) / 10;
    this.add('first', { what });
  },
  // 同意の答え (v = 'yes' | 'no')。erase なら、それまでの記録とメモの状態もすべて消す
  setConsent(v, erase = false) {
    this.consent = v;
    try { localStorage.setItem(CONSENT_KEY, v); } catch { /* 保存できない環境では、この回だけ */ }
    this.on = v === 'yes';
    if (erase) this.eraseAll();
    if (this.on && !this.cur) this.start();
    this.persist();
  },
  eraseAll() {
    for (const m of this.memos()) if (m.snap) Store.del(m.snap);
    this.sessions = [];
    this.start();
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
    // 判断の内訳 (回 GA11・B-063 の準備: 試遊の短い版で「どの判断が増えたか」を見る): ゲームの指令 (CMD_LABEL にある操作) を種類ごとに数える
    const kinds = {};
    for (const e of c.entries) if (e.k === 'act' && CMD_LABEL[e.act]) kinds[e.act] = (kinds[e.act] || 0) + 1;
    return { kinds: Object.entries(kinds).sort((a, b) => b[1] - a[1]), startedAt: c.startedAt, minutes: min, years: c.y1 - c.y0, pausedShare: c.visibleMs ? c.pausedMs / c.visibleMs : 0, actsPerMin: min ? acts / min : 0, acts, idleMin: c.idleMs / 60000, memos: memos.length, tags,
      topViews: Object.entries(c.views).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, ms]) => [v, c.visibleMs ? ms / c.visibleMs : 0]) };
  },
  all() { return this.cur ? [...this.sessions, this.cur] : [...this.sessions]; },
  persist() {
    if (!Store.ready || (!this.on && !this.sessions.length && this.consent !== 'yes')) return; // 同意の前は、何も保存しない
    const sessions = this.all().filter((c) => c.visibleMs > 5000 || c.entries.length).slice(-30);
    Store.put(PLAYLOG_KEY, JSON.stringify({ on: this.on, sessions }));
  },
  async init() {
    try {
      const d = JSON.parse((await Store.get(PLAYLOG_KEY)) || 'null');
      if (d && Array.isArray(d.sessions)) { this.sessions = d.sessions.filter((c) => c && Array.isArray(c.entries)); this.on = this.consent === 'yes' && d.on !== false; } // 同意のない記録はとらない
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
  uiNote(TR`メモを記録した${tag ? ` (${MEMO_TAGS[tag]})` : ''}`);
}
// 試遊の感想 (回 GA12・B-063): ホームの「友達と遊ぶ」で書いた答え。この端末にだけ置き (新しい 20 件まで)、「記録を書き出す」のファイルに入れる。
// 選ぶ問いの答えは鍵で残す (表示の言語によらない)。tools/playlog-report.js が数える
const SURVEY_KEY = `${STORE}-survey`;
const SURVEY_Q = {
  again: { 5: '5 (とても遊びたい)', 4: '4', 3: '3', 2: '2', 1: '1 (もういい)' },
  len: { short: '短い', ok: 'ちょうどよい', long: '長い' },
  net: { quick: 'すぐつながった', retry: '何度かやり直した', fail: 'つながらなかった', none: 'ネット対戦はしていない' },
};
const Survey = {
  list() { try { const l = JSON.parse(localStorage.getItem(SURVEY_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } },
  add(a) {
    const l = [...this.list(), a].slice(-20);
    try { localStorage.setItem(SURVEY_KEY, JSON.stringify(l)); return true; } catch { return false; }
  },
};
function exportPlayLog() {
  const sessions = PlayLog.all().map((c) => ({ ...c, summary: PlayLog.summary(c) }));
  const blob = new Blob([JSON.stringify({ app: 'nolongerubiquitous', edition: EDITION, kind: 'playlog', exportedAt: Date.now(), sessions, survey: Survey.list() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nolongerubiquitous${EDITION === 'sim' ? '-sim' : ''}-playlog-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// ホーム画面の「プレイ記録」
function playLogHtml() {
  const fmtMin = (m) => (m >= 60 ? TR`${(m / 60).toFixed(1)} 時間` : TR`${m.toFixed(0)} 分`);
  const VIEW_LABEL = { galaxy: TR('星間マップ'), system: TR('星系マップ'), events: TR('イベント'), cands: TR('候補地'), home: TR('ホーム'), 'empire/overview': TR('帝国・概要'), 'empire/routes': TR('帝国・交易路'), 'empire/migration': TR('帝国・移民'), 'empire/military': TR('帝国・軍事'), 'empire/politics': TR('帝国・政治') };
  const rows = PlayLog.all().slice(-8).reverse().map((c) => {
    const m = PlayLog.summary(c);
    return TR`<tr><td>${esc(new Date(m.startedAt).toLocaleString(LOCALE, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td><td>${fmtMin(m.minutes)}</td><td>${m.years.toFixed(0)} 年</td>
      <td>${Math.round(m.pausedShare * 100)}%</td><td>${m.actsPerMin.toFixed(1)}</td><td>${fmtMin(m.idleMin)}</td>
      <td>${m.topViews.map(([v, f]) => `${esc(VIEW_LABEL[v] || v)} ${Math.round(f * 100)}%`).join(TR('・'))}</td><td>${m.kinds.slice(0, 4).map(([a, n]) => `${esc(TX(CMD_LABEL[a]))} ${n}`).join(TR('・')) || '—'}</td><td>${m.memos}${Object.keys(m.tags).length ? ` (${Object.entries(m.tags).map(([t, n]) => `${MEMO_TAGS[t]}${n}`).join(TR('・'))})` : ''}</td></tr>`;
  }).join('');
  const memos = PlayLog.memos().slice(-10).reverse().map((e) => TR`<div class="row"><div class="info">${e.tag ? `<b>${MEMO_TAGS[e.tag]}</b> ` : ''}${esc(e.text || '')}<br><span class="muted">西暦 ${Math.floor(e.at ?? e.y)}年</span></div>
    ${e.snap ? TR`<button data-home="memoload" data-k="${esc(e.snap)}">この時点をロード</button>` : TR('<span class="muted">状態は残っていない</span>')}</div>`).join('');
  const ask = app.homeArmed === 'logstop'; // 記録を止めるとき: すべて消すかを聞く
  return TR`<section><h3>プレイ記録</h3>
    <p class="muted">自分がどう遊んだかを記録する (このブラウザの中だけ。開発者に届くのは「記録を書き出す」で作ったファイルを自分で送ったときだけ)。${PlayLog.consent === 'yes' ? TR('記録してよいと答えている。') : PlayLog.consent === 'no' ? TR('記録しないと答えている。') : TR('まだ答えていない。')}ヘッダーの「メモ」で、退屈・分からない・迷う・面白いと感じた瞬間を、その時点の状態と一緒に残せる。</p>
    <div class="row">${ask ? TR('<span>記録を止める。これまでの記録は:</span><button data-home="logstoperase">すべて消す</button><button data-home="logstopkeep">残す</button><button class="ghost" data-home="logcancel">やめる</button>')
      : TR`<button data-home="logtoggle">${PlayLog.on ? TR('記録を止める') : TR('記録をはじめる')}</button><button data-home="logexport">記録を書き出す</button><button class="ghost" data-home="logclear">${app.homeArmed === 'logclear' ? TR('本当に消す?') : TR('記録をすべて消す')}</button>`}</div>
    <details class="help"><summary>同意の文</summary><p><b>${esc(CONSENT_TEXT.title)}</b><br>${esc(CONSENT_TEXT.lead)}</p><ul>${CONSENT_TEXT.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
    ${rows ? TR`<div class="scroll"><table class="log"><tr><th>開始</th><th>遊んだ時間</th><th>進めた</th><th>止めていた</th><th>操作/分</th><th>操作なし</th><th>よく見た画面</th><th>多かった判断</th><th>メモ</th></tr>${rows}</table></div>` : ''}
    ${memos ? TR`<h4 style="margin:8px 0 2px">最近のメモ</h4>${memos}` : ''}
  </section>`;
}
// セーブデータを読み込んで現在のゲームに反映する。失敗時は現在の状態を保つ。
function loadSave(d) {
  const prev = app.game;
  newGame(d.seed, galaxyKindOf(d.galaxy), d.gen || 1); // 銀河の作り方はセーブのまま (自動生成の銀河も、ネット対戦の参加者も同じ銀河を作り直す。回 GA10)
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
  $('savestat').textContent = ok ? TR`自動セーブ済み ${app.game.year.toFixed(1)}年` : TR('セーブできなかった (保存容量が足りないか、この環境では保存できない)');
}

$('savenow').onclick = () => { save(); PlayLog.add('ui', { act: 'savenow' }); uiNote(TR('セーブした。')); };
// --- データを書き出す (回 GA11・B-196。B-072 の残り。docs/export.md) ---
// この試合の統計の表 (core/export-rec.js が試合の始めから足し上げたもの。道具 tools/export.js と同じ列と数え方) を CSV で保存する。
// 遊び方の記録と同じく、何が入るかを見せて、保存するかを本人が選ぶ (QD-55 = a の同意の仕組み。外へは送らない)
const XPORT_TABLES = { sna: '国 × 年: 人口・GDP と内訳 (SNA)', gfs: '国 × 年: 政府の収入と目的別の支出 (GFS・COFOG)', balance: '国 × 年: 部門の預金・貸出・国債', rates: '国 × 年: 物価・金利', prices: '星系 × 年: 資源の値段', trade: '年 × 輸出国 × 輸入国 × 品目 (BACI の形)', wars: '戦争 (COW の形)', wars_part: '戦争 × 参加国', policy: '政策の出来事' };
function downloadText(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const xportName = (t) => `nolongerubiquitous${EDITION === 'sim' ? '-sim' : ''}-${app.game.galaxy?.seed ?? ''}-${Math.floor(app.game.year)}-${t}`;
function xportMeta(g) {
  const X = g.xrec, years = (X?.rows?.sna || []).map((r) => r[1]);
  return { app: 'nolongerubiquitous', edition: EDITION, galaxy: g.galaxy?.seed ?? null, from: years.length ? Math.min(...years) : null, to: years.length ? Math.max(...years) : null, exportedAt: new Date().toISOString(), codebook: 'docs/export.md', rows: Object.fromEntries(Object.keys(XPORT_TABLES).map((t) => [t, t === 'wars' || t === 'wars_part' ? Object.keys(X?.st?.wars || {}).length * (t === 'wars' ? 1 : 2) : (X?.rows?.[t] || []).length])) };
}
function renderXport() {
  const g = app.game, X = g.xrec, m = xportMeta(g);
  const box = $('xportbox');
  setHtml(box, X ? TR`<div class="card"><h2>データを書き出す</h2>
    <p>この試合の統計の表を、CSV のファイルでこの端末に保存する。列の名前は現実の統計の符号 (SNA 2008・GFS 2014・COFOG・BACI・COW) で、意味と単位はコードブック (docs/export.md) にある。</p>
    <p class="muted">記録している年: ${m.from ?? '—'}〜${m.to ?? '—'} 年 (国 × 年の行 ${m.rows.sna})。前の版のセーブは、読み込んだ年から記録している。ファイルは外へは送らない。誰かに渡すかは、あなたが決める。</p>
    <div class="tbls">${Object.entries(XPORT_TABLES).map(([t, l]) => `<button data-xp="${t}">${t}.csv<small>${TX(l)} (${m.rows[t]} 行)</small></button>`).join('')}</div>
    <div class="row"><button class="big" data-xp="all">すべて書き出す (表 9 つと meta.json)</button><button data-xp="close" class="ghost">やめる</button></div></div>`
    : TR`<div class="card"><h2>データを書き出す</h2><p>この試合には統計の記録がない。</p><div class="row"><button data-xp="close" class="ghost">閉じる</button></div></div>`);
  box.hidden = false;
}
$('xportbtn').onclick = () => { setMenu(false); PlayLog.add('ui', { act: 'xport' }); renderXport(); };
$('xportbox').onclick = (e) => {
  const b = e.target.closest('button[data-xp]');
  if (!b && e.target !== $('xportbox')) return;
  const k = b?.dataset.xp ?? 'close';
  if (k === 'close') { $('xportbox').hidden = true; return; }
  const g = app.game;
  const one = (t) => downloadText(`${xportName(t)}.csv`, xrecCsv(g, t));
  PlayLog.add('ui', { act: 'xport', table: k });
  if (k === 'all') {
    Object.keys(XPORT_TABLES).forEach((t, i) => setTimeout(() => one(t), 250 * i)); // 続けて保存すると止める端末があるので少しずつ
    setTimeout(() => downloadText(`${xportName('meta')}.json`, JSON.stringify(xportMeta(g), null, 1), 'application/json'), 250 * Object.keys(XPORT_TABLES).length);
    uiNote(TR('データを書き出した (表 9 つと meta.json)'));
    $('xportbox').hidden = true;
  } else one(k);
};
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
  else { app.homeNote = TR('セーブデータを読み込めなかった。'); renderHome(); }
};

// 同意の画面 (B-060・QD-58): 「はじめる」から始めたときは画面の真ん中に出す。答えるまで記録はしない
function consentCardHtml(cls = '') {
  return TR`<div class="card consent ${cls}"><h2>${esc(CONSENT_TEXT.title)}</h2><p>${esc(CONSENT_TEXT.lead)}</p>
    <ul>${CONSENT_TEXT.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="btns"><button data-consent="yes">記録してよい</button><button class="ghost" data-consent="no">記録しない</button></div></div>`;
}
function showConsent() {
  if (PlayLog.consent || Net.on) return;
  $('endbox').innerHTML = consentCardHtml();
  $('endbox').hidden = false;
}
// 帯の一番上 (まだ答えていないとき。国家選択などほかの始め方の人にも出す)
function consentRailHtml() { // ネット対戦でも聞く (友達と遊んだ記録を残せるように。回 SO5)。帯は端末ごとの画面なので、試合の状態は変わらない
  if (PlayLog.consent || app.homeOpen) return '';
  return TR`<div class="dec consent"><div class="m">${esc(CONSENT_TEXT.title)}</div><div class="t">${esc(CONSENT_TEXT.lead)} 記録はこの端末の中だけ。いつでも止めて消せる。</div>
    <div class="opts"><button data-consent="yes">記録してよい</button><button class="ghost" data-consent="no">記録しない</button><button class="ghost" data-consent="more">くわしく</button></div></div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('button[data-consent]');
  if (!b) return;
  if (b.dataset.consent === 'more') { $('endbox').innerHTML = consentCardHtml(); $('endbox').hidden = false; return; }
  PlayLog.setConsent(b.dataset.consent);
  if (b.closest('#endbox')) $('endbox').hidden = true;
  setHtml($('rail'), railHtml(app.game));
  uiNote(b.dataset.consent === 'yes' ? TR('遊び方の記録をはじめた (ホーム画面の「プレイ記録」から止められる)') : TR('遊び方は記録しない (ホーム画面の「プレイ記録」から変えられる)'));
});
