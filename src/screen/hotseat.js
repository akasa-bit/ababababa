// --- ホットシート (1 台を交代で使う) ---
// 交代のときは時間を止め、画面を幕で隠してから次のプレイヤーの視点に切り替える。自動で交代する間隔 (ゲームの年) も選べる
function isHotseat() { return app.game.humans().length > 1 && !(Net.on); }
function updateTurnBtn() {
  const on = isHotseat();
  $('turnbtn').hidden = !on;
  if (on) setHtml($('turnbtn'), `交代<small>${esc(ME.realm)}</small>`);
}
function nextTurn(auto) {
  const g = app.game;
  const hs = g.players.map((p, i) => (p.human ? i : -1)).filter((i) => i >= 0);
  showCurtain(hs[(hs.indexOf(g.pi) + 1) % hs.length], auto);
}
function showCurtain(pi, auto) {
  const g = app.game;
  setSpeed(0);
  g.pi = pi;
  app.fleetSel.clear(); app.fleetMove.clear(); app.fleetConfirm = null; renderFleetBar();
  app.setView('galaxy');
  app.selectSystem(g.cap);
  galaxyView.centerOn(g.system(g.cap));
  app.turnStart = g.year;
  lastTickYear = NaN;
  PlayLog.add('ui', { act: 'turn', pi });
  $('curtain').innerHTML = `<div class="card"><h2>${esc(ME.realm)}の番</h2>
    <p>${auto ? `${app.turnEvery} 年たったので交代。` : ''}ほかの人は画面から目を離してください。</p>
    <p class="muted">西暦 ${Math.floor(g.year)}年・${esc(ME.species)}・首都 ${esc(g.system(g.cap).name)}</p>
    <label>自動で交代 <select id="turnevery">${[0, 1, 5, 10, 25].map((y) => `<option value="${y}" ${y === (app.turnEvery || 0) ? 'selected' : ''}>${y ? `${y} 年ごと` : 'しない (「交代」ボタンで)'}</option>`).join('')}</select></label>
    <button class="big" id="turngo">はじめる</button></div>`;
  $('curtain').hidden = false;
  $('turngo').onclick = () => {
    app.turnEvery = Number($('turnevery').value);
    app.turnStart = g.year;
    $('curtain').hidden = true;
    updateTurnBtn();
    app.dirty = true;
  };
}
$('turnbtn').onclick = () => nextTurn(false);
function closeHome(speed) {
  $('home').hidden = true;
  app.homeOpen = false;
  app.started = true;
  app.speed = SPEEDS.includes(speed) && speed ? speed : app.homeSpeed || 1;
  updateSpeedButtons();
  updateSpectateBtn();
  updateTurnBtn();
  app.dirty = true;
}
$('homebtn').onclick = () => { setMenu(false); if (Net.on) return Net.render(); openHome(); }; // メニューを閉じてから (開いたままだと出典の文がホーム画面のボタンに重なる)
$('home').onclick = (e) => {
  const b = e.target.closest('button[data-home]');
  if (!b) return;
  const act = b.dataset.home;
  const i = Number(b.dataset.i);
  app.homeSeed = $('home-seed')?.value.trim() || '';
  app.homeSpectate = !!$('home-spectate')?.checked;
  if ($('home-end')) app.homeEnd = Number($('home-end').value);
  if ($('home-prod')) { app.homeProd = $('home-prod').value; app.homeProdK = Number($('home-prodk').value); }
  if ($('home-nat')) { app.homeNat = Number($('home-nat').value); app.homeHc = $('home-hc').value; if ($('home-pv')) app.homePv = $('home-pv').value; app.homeLib = [...document.querySelectorAll('#home .home-lib')].filter((x) => x.checked).map((x) => x.value); }
  if ($('home-end')) app.homeCh = [...document.querySelectorAll('#home .home-ch')].filter((x) => x.checked).map((x) => x.value);
  app.homeNote = '';
  // 取り返しのつかない操作は2回押して確定する (confirm() は使えない環境がある)
  const confirm2 = (k) => { if (app.homeArmed === k) { app.homeArmed = null; return true; } app.homeArmed = k; renderHome(); return false; };
  PlayLog.add('home', { act });
  if (act === 'logtoggle') { PlayLog.on = !PlayLog.on; PlayLog.persist(); return renderHome(); }
  if (act === 'logexport') return exportPlayLog();
  if (act === 'logclear') {
    if (!confirm2('logclear')) return;
    for (const m of PlayLog.memos()) if (m.snap) Store.del(m.snap);
    PlayLog.sessions = [];
    PlayLog.start();
    PlayLog.persist();
    return renderHome();
  }
  if (act === 'memoload') {
    app.homeNote = 'ロード中…';
    Store.get(b.dataset.k).then((t) => {
      const d = t ? parseSave(t) : null;
      if (d && loadSave(d)) { save(); app.game.message('メモの時点をロードした (一時停止中)。'); closeHome(); return setSpeed(0); }
      app.homeNote = 'ロードできなかった';
      if (app.homeOpen) renderHome();
    });
    return;
  }
  if (act === 'resume') return closeHome();
  if (act === 'tab') { readNatForm(); app.homeTab = b.dataset.t; Cloud.status = ''; return renderHome(); }
  if (act.startsWith('acct')) return accountAction(act, b.dataset.id);
  if (act.startsWith('nat')) return natAction(act, b.dataset.id);
  if (act === 'nethost') { closeHome(0); setSpeed(0); return Net.openHost(); }
  if (act === 'netjoin') { closeHome(0); setSpeed(0); Net.role = null; return Net.render(); }
  // 「はじめる」は、いまのゲームが進んでいるときだけ 2 回押して確定する (開いたばかりなら 1 回で始まる)。「この設定ではじめる」はいつも 2 回
  if (act === 'new' || act === 'start') {
    if (act === 'new' ? !confirm2('new') : homeGoing() && !confirm2('start')) return;
    newGame(app.homeSeed || String(Math.floor(Math.random() * 1e6)));
    if (app.homeSpectate) app.game.setSpectate(true);
    app.game.endYear = app.homeEnd === 0 ? null : START_YEAR + (app.homeEnd ?? 500);
    app.game.challenges = (app.homeCh || []).filter((k) => CHALLENGES[k]).map((id) => ({ id, status: 'active' }));
    app.game.handicap = HANDICAP[app.homeHc] ? app.homeHc : 'normal';
    app.game.productivity = productivityOf(app.homeProd, app.homeProdK);
    if (ED.physics.pv) app.game.pvPolicy = PV_DESIGNS[app.homePv] ? app.homePv : null;
    const customs = (app.homeLib || []).map((id) => NationLib.get(id)).filter(Boolean);
    if ((app.homeNat ?? 1) > 1 || customs.length) {
      app.game.foundNations(Math.max(app.homeNat ?? 1, customs.length + 1), app.homeHc, customs);
      // 自作の国を出したら、最初の自作の国を人間の国にしておく (国家選択の画面で変えられる)
      const first = customs.length ? app.game.nations.find((n) => n.species === customs[0].species) : null;
      return openPick(first ? first.cap : 0);
    }
    save();
    return closeHome(1);
  }
  const k = SLOT_KEYS[i];
  if (act === 'slotsave') {
    if (Store.meta[k] && !confirm2(`save${i}`)) return;
    const text = saveJSON(app.game, { speed: app.homeSpeed });
    const meta = saveMeta(buildSave(app.game));
    app.homeNote = 'セーブ中…';
    Store.put(k, text).then((ok) => {
      if (ok) { Store.meta[k] = meta; app.homeNote = `スロット ${i + 1} にセーブした`; } else app.homeNote = 'セーブできなかった (保存容量が足りないか、この環境では保存できない)';
      if (app.homeOpen) renderHome();
    });
  } else if (act === 'slotload') {
    app.homeNote = 'ロード中…';
    Store.get(k).then((t) => {
      const d = t ? parseSave(t) : null;
      if (d && loadSave(d)) { save(); app.game.message(`スロット ${i + 1} をロードした。`); return closeHome(d.speed); }
      app.homeNote = 'ロードできなかった';
      if (app.homeOpen) renderHome();
    });
  } else if (act === 'slotdel') {
    if (!confirm2(`del${i}`)) return;
    Store.del(k).then(() => { Store.meta[k] = null; if (app.homeOpen) renderHome(); });
  } else if (act === 'export') exportSave();
  else if (act === 'import') return $('importfile').click();
  app.homeArmed = null;
  renderHome();
};
// 畳んだ欄 (詳しい設定・セーブ) を開いたか閉じたかを覚えておく (ホーム画面は描き直すたびに作り直すので)
$('home').addEventListener('toggle', (e) => {
  const k = e.target.dataset?.homeMore;
  if (k === 'settings') app.homeMore = e.target.open;
  else if (k === 'saves') app.homeSaves = e.target.open;
}, true);
// 通信の表示 (表示しない / 光の点)。見る人ごとの好みなのでブラウザに覚えておく
const SIGNAL_MODES = { off: '表示しない', dots: '光の点' };
try { const m = localStorage.getItem(`${STORE}-signals`); if (SIGNAL_MODES[m]) app.signalMode = m; } catch { /* 保存できない環境では既定値 */ }
app.signalMode ??= 'off';
function updateSigBtn() { $('sigbtn').textContent = `通信: ${SIGNAL_MODES[app.signalMode]}`; $('sigbtn').classList.toggle('on', app.signalMode !== 'off'); }
$('sigbtn').onclick = () => {
  const keys = Object.keys(SIGNAL_MODES);
  app.signalMode = keys[(keys.indexOf(app.signalMode) + 1) % keys.length];
  PlayLog.add('ui', { act: 'signals', v: app.signalMode });
  try { localStorage.setItem(`${STORE}-signals`, app.signalMode); } catch { /* 保存できない環境では無視 */ }
  updateSigBtn();
};
updateSigBtn();
// 地図の背景と地球の国の色は、CSS の色 (--map-bg・--own) から読む
{
  const cs = getComputedStyle(document.documentElement);
  app.mapBg = cs.getPropertyValue('--map-bg').trim() || '#05070d';
  const own = cs.getPropertyValue('--own').trim();
  if (/^#[0-9a-f]{6}$/i.test(own)) { OWN.hex = own; OWN.rgb = [1, 3, 5].map((i) => parseInt(own.slice(i, i + 2), 16)).join(','); }
}
// 画面の動き (信号の模様と文字のぶれ)。見る人ごとの好みなのでブラウザに覚えておく
try { app.fx = localStorage.getItem(`${STORE}-fx`) !== 'off'; } catch { app.fx = true; }
function updateFxBtn() { document.body.classList.toggle('fx', app.fx); $('fxbtn').textContent = `画面の動き: ${app.fx ? '入' : '切'}`; $('fxbtn').classList.toggle('on', app.fx); }
$('fxbtn').onclick = () => {
  app.fx = !app.fx;
  PlayLog.add('ui', { act: 'fx', v: app.fx });
  try { localStorage.setItem(`${STORE}-fx`, app.fx ? 'on' : 'off'); } catch { /* 保存できない環境では無視 */ }
  updateFxBtn();
// 文字のぶれ: 0.26秒ごとに、見えている文字のどれか1つ (ときどき2〜3つ) を短くぶらす
const FX_JIT = 'button, th, .stats b, .kpi b, #treasury .v, #date, #rail .t, .syshead h2';
const fxReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
// ゲームの乱数 (Math.random) を使わない: 見た目のために試合の流れを変えないように
let fxSeed = 7;
const fxRand = () => (fxSeed = (fxSeed * 16807) % 2147483647) / 2147483647;
setInterval(() => {
  if (!app.fx || document.hidden || fxReduced?.matches) return;
  const els = document.querySelectorAll(FX_JIT);
  if (!els.length) return;
  const r = fxRand();
  for (let n = r < 0.1 ? 3 : r < 0.4 ? 2 : 1; n > 0; n--) {
    const el = els[Math.floor(fxRand() * els.length)];
    if (!el.checkVisibility?.() || el.classList.contains('jit')) continue;
    el.classList.add('jit');
    setTimeout(() => el.classList.remove('jit'), 620);
  }
}, 260);
};
updateFxBtn();
function updateSpectateBtn() { $('spectatebtn').classList.toggle('on', !!app.game.spectate); }
$('spectatebtn').onclick = () => {
  if (app.game.humans().length > 1) return uiNote('人間が複数いる試合では観戦モードは使えない'); app.game.setSpectate(!app.game.spectate); PlayLog.add('ui', { act: 'spectate', v: app.game.spectate }); updateSpectateBtn(); app.dirty = true; };
setInterval(save, 5000);
setInterval(() => PlayLog.persist(), 30000);
window.addEventListener('pagehide', () => { save(); PlayLog.persist(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); PlayLog.persist(); } });
// プレイ記録: 操作の有無 (操作のない時間を測る)
for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, () => PlayLog.input(), { passive: true, capture: true });
// メモ
$('memobtn').innerHTML = `${ico('memo')}メモ`;
// HTML に直接書いてある見出しとタブにもアイコンを付ける
for (const [id, k, t] of [['tab-galaxy', 'galaxy', '星間'], ['tab-system', 'system', '星系'], ['tab-empire', 'empire', '帝国'], ['tab-cands', 'cands', '候補地']]) $(id).innerHTML = `${ico(k)}${t}`;
for (const [id, k, t] of [['sec-ledger', 'credits', `${ME.gov}の収支`], ['sec-ships', 'ships', '航行中の船'], ['sec-log', 'log', 'ログ']]) $(id).querySelector('summary').innerHTML = `${ico(k)}${t}`;
$('memobtn').onclick = () => ($('memobox').hidden ? openMemo() : closeMemo());
$('memoclose').onclick = closeMemo;
$('memosave').onclick = saveMemo;
document.querySelectorAll('#memobox [data-tag]').forEach((b) => { b.onclick = () => { const on = !b.classList.contains('on'); document.querySelectorAll('#memobox [data-tag]').forEach((x) => x.classList.remove('on')); b.classList.toggle('on', on); }; });
const setSpeed = (v, keepSkip = false) => {
  if (Net.on && Net.role === 'guest') { if (v !== app.speed) Net.send(Net.peers[0], { t: 'speed', v }); return; } // 速さはホストが決める
  if (app.speed) app.lastSpeed = app.speed;
  if (v !== app.speed) PlayLog.add('speed', { v });
  if (!keepSkip) app.skip = null;
  app.speed = v;
  updateSpeedButtons();
};
// 次の知らせまで進む: いちばん速く進め、重大・普通の出来事 (表示している種類) か決めることが新しく見えたら止める (最長100年)
function newsMark(g) {
  let ev = 0;
  for (const e of g.knownEvents()) if (evShown(e.kind) && evTier(e.kind) >= 2 && e.id > ev) ev = e.id;
  return { ev, dec: g.visibleDecisions().map((d) => d.id).join(',') };
}
function startSkip() {
  app.skip = { from: app.game.year, ...newsMark(app.game) };
  PlayLog.add('ui', { act: 'skip' });
  setSpeed(SPEEDS[SPEEDS.length - 1], true);
}
function checkSkip() {
  if (!app.skip) return;
  const g = app.game;
  const m = newsMark(g);
  const news = m.ev > app.skip.ev || (m.dec && m.dec !== app.skip.dec && m.dec.split(',').some((id) => !app.skip.dec.split(',').includes(id)));
  if (!news && g.year - app.skip.from < 100) return;
  const from = app.skip.from;
  setSpeed(0);
  uiNote(news ? `知らせが届いたので止めた (${(g.year - from).toFixed(1)} 年進めた)` : '100年進めたので止めた');
  app.dirty = true;
}
$('skipbtn').onclick = () => (app.skip ? setSpeed(0) : startSkip());
// メニュー (ホーム・セーブ・通信の表示・観戦)
function setMenu(open) { $('menu').hidden = !open; $('menubtn').setAttribute('aria-expanded', String(open)); $('menubtn').classList.toggle('on', open); }
$('menubtn').onclick = (e) => { e.stopPropagation(); setMenu($('menu').hidden); };
$('menu').addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(() => setMenu(false), 0); });
window.addEventListener('pointerdown', (e) => { if (!$('menu').hidden && !e.target.closest('#menu, #menubtn')) setMenu(false); });
// 終わりの年: 点数を見せる (続けて遊べる)
function showEnd() {
  const g = app.game;
  const sc = g.finalScore || g.score();
  const ch = g.challenges.map((c) => `<li>${CHALLENGES[c.id].label}: ${c.status === 'done' ? '<span class="hz">果たした</span>' : '<span class="bad">果たせなかった</span>'}</li>`).join('');
  $('endbox').innerHTML = `<div class="card"><h2>${Math.round(g.endYear)}年 — このゲームの終わり</h2>
    <p class="muted">${Math.round(g.endYear - START_YEAR)}年の歩みの点数</p>
    <table class="tbl">${sc.parts.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'bad' : ''}">${v}</td></tr>`).join('')}<tr class="total"><td><b>合計</b></td><td><b>${sc.total}</b></td></tr></table>
    ${ch ? `<h3>挑戦</h3><ul>${ch}</ul>` : ''}
    <p class="note">このまま続けて遊べる (点数はこの時点で確定)。</p>
    <div class="btns"><button id="endgo">続けて遊ぶ</button><button id="endhome" class="ghost">ホームへ</button></div></div>`;
  $('endbox').hidden = false;
  $('endgo').onclick = () => { $('endbox').hidden = true; };
  $('endhome').onclick = () => { $('endbox').hidden = true; openHome(); };
}
document.querySelectorAll('[data-speed]').forEach((b) => {
  b.onclick = () => setSpeed(SPEEDS[Number(b.dataset.speed)]);
});
function updateSpeedButtons() {
  document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', SPEEDS[Number(b.dataset.speed)] === app.speed));
}
window.addEventListener('keydown', (e) => {
  if (app.homeOpen) { if (e.key === 'Escape') closeHome(); return; }
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.key === ' ') { setSpeed(app.speed ? 0 : app.lastSpeed || 1); e.preventDefault(); }
  else if (e.key >= '1' && e.key <= String(SPEEDS.length)) setSpeed(SPEEDS[Number(e.key) - 1]);
  else if (app.view === 'galaxy' && app.game.galaxy.kind === 'real' && e.key.length === 1 && 'zxrf'.includes(e.key)) galaxyView.rotateBy(e.key === 'z' ? -0.15 : e.key === 'x' ? 0.15 : 0, e.key === 'r' ? 0.1 : e.key === 'f' ? -0.1 : 0); // 地図を回す (Z/X)・傾ける (R/F)
  else if (e.key === 'g') app.setView('galaxy');
  else if (e.key === 's') app.setView('system');
  else if (e.key === 'e') app.setView('empire');
  else if ((e.key === 'Delete' || e.key === 'Backspace') && hasFleetSelection()) { clearFleetSelOrders(); e.preventDefault(); }
  else if (e.key === 'Escape' && app.view === 'galaxy' && !hasFleetSelection() && app.sel.sys !== null) app.deselect();
  else if (e.key === 'Escape') { app.fleetSel.clear(); app.fleetMove.clear(); app.fleetConfirm = null; app.setView('galaxy'); renderFleetBar(); }
});

