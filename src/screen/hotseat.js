// --- ホットシート (1 台を交代で使う) ---
// 交代のときは時間を止め、画面を幕で隠してから次のプレイヤーの視点に切り替える。自動で交代する間隔 (ゲームの年) も選べる
function isHotseat() { return app.game.humans().length > 1 && !(Net.on); }
function updateTurnBtn() {
  const on = isHotseat();
  $('turnbtn').hidden = !on;
  if (on) setHtml($('turnbtn'), TR`交代<small>${esc(ME.realm)}</small>`);
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
  $('curtain').innerHTML = TR`<div class="card"><h2>${esc(ME.realm)}の番</h2>
    <p>${auto ? TR`${app.turnEvery} 年たったので交代。` : ''}ほかの人は画面から目を離してください。</p>
    <p class="muted">西暦 ${Math.floor(g.year)}年・${esc(ME.species)}・首都 ${esc(g.system(g.cap).name)}</p>
    <label>自動で交代 <select id="turnevery">${[0, 1, 5, 10, 25].map((y) => `<option value="${y}" ${y === (app.turnEvery || 0) ? 'selected' : ''}>${y ? TR`${y} 年ごと` : TR('しない (「交代」ボタンで)')}</option>`).join('')}</select></label>
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
$('homebtn').onclick = () => { setMenu(false); if (Net.on) return Net.render(); app.homeTab = 'menu'; openHome(); }; // メニューを閉じてから (開いたままだと出典の文がホーム画面のボタンに重なる)
// シングルプレイの設定の欄を読む (描き直す前に読んでおく)
function readHomeForm() {
  if (!$('home-seed')) return;
  app.homeSeed = $('home-seed').value.trim();
  app.homeSpectate = !!$('home-spectate')?.checked;
  if ($('home-galaxy')) app.homeGalaxy = $('home-galaxy').value; // 星間マップの作り方 (回 GA10)
  app.homeEnd = Number($('home-end').value);
  app.homeProd = $('home-prod').value; app.homeProdK = Number($('home-prodk').value);
  app.homeNat = Number($('home-nat').value); app.homeHc = $('home-hc').value; if ($('home-pv')) app.homePv = $('home-pv').value;
  app.homeLib = [...document.querySelectorAll('#home .home-lib')].filter((x) => x.checked).map((x) => x.value);
  app.homeCh = [...document.querySelectorAll('#home .home-ch')].filter((x) => x.checked).map((x) => x.value);
}
$('home').onclick = (e) => {
  const b = e.target.closest('button[data-home]');
  if (!b) return;
  const act = b.dataset.home;
  const i = Number(b.dataset.i);
  readHomeForm();
  app.homeNote = '';
  // 取り返しのつかない操作は2回押して確定する (confirm() は使えない環境がある)
  const confirm2 = (k) => { if (app.homeArmed === k) { app.homeArmed = null; return true; } app.homeArmed = k; renderHome(); return false; };
  PlayLog.add('home', { act });
  // 記録の切り替え: はじめるときは同意したことにする。止めるときは、これまでの記録を消すかを聞く (QD-57)
  if (act === 'logtoggle') { if (PlayLog.on) { app.homeArmed = 'logstop'; return renderHome(); } PlayLog.setConsent('yes'); return renderHome(); }
  if (act === 'logstoperase' || act === 'logstopkeep') { PlayLog.setConsent('no', act === 'logstoperase'); app.homeArmed = null; return renderHome(); }
  if (act === 'logcancel') { app.homeArmed = null; return renderHome(); }
  if (act === 'logexport') return exportPlayLog();
  if (act === 'logclear') {
    if (!confirm2('logclear')) return;
    PlayLog.eraseAll();
    PlayLog.persist();
    return renderHome();
  }
  if (act === 'memoload') {
    app.homeNote = TR('ロード中…');
    Store.get(b.dataset.k).then((t) => {
      const d = t ? parseSave(t) : null;
      if (d && loadSave(d)) { save(); app.game.message('メモの時点をロードした (一時停止中)。'); closeHome(); return setSpeed(0); }
      app.homeNote = TR('ロードできなかった');
      if (app.homeOpen) renderHome();
    });
    return;
  }
  if (act === 'resume') return closeHome();
  if (act === 'lang') { save(); return setLang(b.dataset.l); } // 表示の言語 (読み込み直す。回 T1)
  if (act === 'tab') { readNatForm(); app.homeTab = b.dataset.t; if (b.dataset.from) app.homeFrom = b.dataset.from; Cloud.status = ''; app.homeArmed = null; renderHome(); $('home').scrollTop = 0; return; }
  if (act.startsWith('acct')) return accountAction(act, b.dataset.id);
  if (act.startsWith('nat')) return natAction(act, b.dataset.id);
  if (act === 'nethost') { closeHome(0); setSpeed(0); return Net.openHost(); }
  if (act === 'netjoin') { closeHome(0); setSpeed(0); Net.role = null; return Net.render(); }
  // シングルプレイの設定を決めたら地図を作る。いまのゲームが進んでいるときだけ 2 回押して確定する (B-194)
  if (act === 'new') {
    if (homeGoing() && !confirm2('new')) return;
    newGame(app.homeSeed || String(Math.floor(Math.random() * 1e6)), app.homeGalaxy === 'gen' ? 'gen' : 'real'); // 星間マップの作り方 (回 GA10・B-195)
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
    closeHome(1);
    pauseForFirstMove();
    showConsent(); // はじめて遊ぶ人に、1 回だけ同意の画面 (B-060)
    return;
  }
  const k = SLOT_KEYS[i];
  if (act === 'slotsave') {
    if (Store.meta[k] && !confirm2(`save${i}`)) return;
    const text = saveJSON(app.game, { speed: app.homeSpeed });
    const meta = saveMeta(buildSave(app.game));
    app.homeNote = TR('セーブ中…');
    Store.put(k, text).then((ok) => {
      if (ok) { Store.meta[k] = meta; app.homeNote = TR`スロット ${i + 1} にセーブした`; } else app.homeNote = TR('セーブできなかった (保存容量が足りないか、この環境では保存できない)');
      if (app.homeOpen) renderHome();
    });
  } else if (act === 'slotload') {
    app.homeNote = TR('ロード中…');
    Store.get(k).then((t) => {
      const d = t ? parseSave(t) : null;
      if (d && loadSave(d)) { save(); app.game.message(JA`スロット ${i + 1} をロードした。`); return closeHome(d.speed); }
      app.homeNote = TR('ロードできなかった');
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
// ホーム画面の「説明」を開いたか閉じたかを覚えておく (ホーム画面は描き直すたびに作り直すので)
$('home').addEventListener('toggle', onToggle, true);
// 設定の選び方で、倍率の欄と「はじめる」の文字 (国家選択へ進むか) が変わる。描き直さずにその場で変える (選んでいる欄が消えないように)
$('home').addEventListener('change', (e) => {
  if (!['home-nat', 'home-prod'].includes(e.target.id) && !e.target.classList.contains('home-lib')) return;
  readHomeForm();
  $('home-prodk').disabled = app.homeProd !== 'custom';
  const go = document.querySelector('#home [data-home="new"]');
  if (go && app.homeArmed !== 'new') go.textContent = singleGoLabel();
});
// 通信の表示 (表示しない / 光の点)。見る人ごとの好みなのでブラウザに覚えておく
const SIGNAL_MODES = { off: '表示しない', dots: '光の点' };
try { const m = localStorage.getItem(`${STORE}-signals`); if (SIGNAL_MODES[m]) app.signalMode = m; } catch { /* 保存できない環境では既定値 */ }
app.signalMode ??= 'off';
function updateSigBtn() { $('sigbtn').textContent = TR`通信: ${SIGNAL_MODES[app.signalMode]}`; $('sigbtn').classList.toggle('on', app.signalMode !== 'off'); }
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
// 画面の動き (信号の模様と文字のぶれ)。見る人ごとの好みなのでブラウザに覚えておく。
// 既定は「切」(QD-08 = a。読みやすさと Steam Deck の文字の基準のため)。前に「入」を選んだ人は「入」のまま
try { app.fx = localStorage.getItem(`${STORE}-fx`) === 'on'; } catch { app.fx = false; }
function updateFxBtn() { document.body.classList.toggle('fx', app.fx); $('fxbtn').textContent = TR`画面の動き: ${app.fx ? TR('入') : TR('切')}`; $('fxbtn').classList.toggle('on', app.fx); }
$('fxbtn').onclick = () => {
  app.fx = !app.fx;
  PlayLog.add('ui', { act: 'fx', v: app.fx });
  try { localStorage.setItem(`${STORE}-fx`, app.fx ? 'on' : 'off'); } catch { /* 保存できない環境では無視 */ }
  updateFxBtn();
};
// 表示の言語 (回 T1・docs/i18n.md)。切り替えると、いまの試合をセーブして読み込み直す
$('langbtn').textContent = Object.entries(LANGS).filter(([k]) => k !== LANG).map(([, l]) => `🌐 ${l}`).join(' / ');
$('langbtn').title = TR('表示の言語 (切り替えると、セーブして読み込み直す)');
$('langbtn').onclick = () => { save(); setLang(LANG === 'ja' ? 'en' : 'ja'); };
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
updateFxBtn();
function updateSpectateBtn() { $('spectatebtn').classList.toggle('on', !!app.game.spectate); }
$('spectatebtn').onclick = () => {
  if (app.game.humans().length > 1) return uiNote(TR('人間が複数いる試合では観戦モードは使えない')); app.game.setSpectate(!app.game.spectate); PlayLog.add('ui', { act: 'spectate', v: app.game.spectate }); updateSpectateBtn(); app.dirty = true; };
setInterval(save, 5000);
setInterval(() => PlayLog.persist(), 30000);
window.addEventListener('pagehide', () => { save(); PlayLog.persist(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); PlayLog.persist(); } });
// プレイ記録: 操作の有無 (操作のない時間を測る)
for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, () => PlayLog.input(), { passive: true, capture: true });
// メモ
$('memobtn').innerHTML = TR`${ico('memo')}メモ`;
// HTML に直接書いてある見出しとタブにもアイコンを付ける
for (const [id, k, t] of [['tab-galaxy', 'galaxy', '星間'], ['tab-system', 'system', '星系'], ['tab-empire', 'empire', '帝国'], ['tab-cands', 'cands', '候補地']]) $(id).innerHTML = `${ico(k)}${t}`;
for (const [id, k, t] of [['sec-ledger', 'credits', TR`${ME.gov}の収支`], ['sec-ships', 'ships', '航行中の船'], ['sec-log', 'log', 'ログ']]) $(id).querySelector('summary').innerHTML = `${ico(k)}${t}`;
// 回 GA8 (QD-61): 記号だけだったボタンと地図の操作にもアイコン (記号は画面読み上げの名前 aria-label に残す)
$('speed').querySelector('[data-speed="0"]').innerHTML = ico('pause');
$('skipbtn').innerHTML = ico('skip');
$('menubtn').innerHTML = ico('menu');
$('zoom-in').innerHTML = ico('zoomin');
$('zoom-out').innerHTML = ico('zoomout');
for (const [id, k, t] of [['zoom-fit', 'fit', '全体'], ['rotbtn', 'rotate', '回す'], ['vassalbtn', 'vassal', '従属']]) $(id).innerHTML = `${ico(k)}<small>${t}</small>`;
$('legend').querySelector('summary').innerHTML = TR`${ico('legend')}凡例`;
$('memobtn').onclick = () => ($('memobox').hidden ? openMemo() : closeMemo());
$('memoclose').onclick = closeMemo;
$('memosave').onclick = saveMemo;
document.querySelectorAll('#memobox [data-tag]').forEach((b) => { b.onclick = () => { const on = !b.classList.contains('on'); document.querySelectorAll('#memobox [data-tag]').forEach((x) => x.classList.remove('on')); b.classList.toggle('on', on); }; });
const setSpeed = (v, keepSkip = false) => {
  if (Net.on && Net.role === 'guest') { if (v !== app.speed) Net.send(Net.peers[0], { t: 'speed', v }); return; } // 速さはホストが決める
  if (v) app.awaitFirst = false; // 自分で時間を動かしたら、最初の入植船を待たない
  if (app.speed) app.lastSpeed = app.speed;
  if (v !== app.speed) PlayLog.add('speed', { v });
  if (!keepSkip) app.skip = null;
  app.speed = v;
  updateSpeedButtons();
};
// 新しいゲームは止まった状態で始め、最初の判断 (入植船を 1 隻送る) が済んだら時間を動かす (B-042)。
// 観戦とネット対戦では待たない。速さのボタンで自分で動かしてもよい
function pauseForFirstMove() {
  const g = app.game;
  if (g.spectate || Net.on) return;
  // 始めた瞬間 (1 月 1 日) はスウォームの蓄えが 0 J で、恒星間の入植船が「エネルギー不足」で送れない。
  // 手引きの行き先に送れるようになるまで、1 日ずつ進めてから止める (長くて 30 日。ふつうは 1 日)
  const p = g.guidePick();
  for (let i = 0; i < 30 && p && g.procure(g.shipCost(p.kind, g.cap, p.sys), g.cap).why; i++) g.advance(1 / 365);
  app.awaitFirst = true;
  setSpeed(0);
  firstMoveNote(TR('時間は止まっている。最初の入植船を送ると動きはじめる (候補地のタブから送れる)'));
}
function firstMoveDone() {
  if (!app.awaitFirst) return;
  setSpeed(1);
  firstMoveNote(TR('入植船を送った。時間が動きはじめた (速さは上のボタンで変えられる。スペースで止まる)'));
}
// ログに残し、画面の下にも 4 秒出す
function firstMoveNote(text) { uiNote(text); Net.toast(text); }
// 次の知らせまで進む: いちばん速く進め、重大・普通の出来事 (表示している種類) か決めることが新しく見えたら止める (最長100年)
function newsMark(g) {
  let ev = 0;
  const foes = evFoes(g); // よその国どうしの出来事と、飢餓・不足の状態では止めない (知らせの予算。B-048)
  for (const e of g.knownEvents()) if (e.id > ev && evShown(e.kind) && evTier(e.kind) >= 2 && !STATE_KINDS.has(e.kind) && evConcerns(g, e, foes)) ev = e.id;
  return { ev, dec: [...g.visibleDecisions().map((d) => d.id), ...surpriseWarnings(g).map((w) => `f${w.f.id}`)].join(',') }; // 奇襲の警告も決めることとして止める
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
  Sound.play('stop');
  uiNote(news ? TR`知らせが届いたので止めた (${(g.year - from).toFixed(1)} 年進めた)` : TR('100年進めたので止めた'));
  app.dirty = true;
}
$('skipbtn').onclick = () => (app.skip ? setSpeed(0) : startSkip());
// メニュー (ホーム・セーブ・通信の表示・観戦)
function setMenu(open) { $('menu').hidden = !open; $('menubtn').setAttribute('aria-expanded', String(open)); $('menubtn').classList.toggle('on', open); }
$('menubtn').onclick = (e) => { e.stopPropagation(); setMenu($('menu').hidden); };
$('menu').addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(() => setMenu(false), 0); });
window.addEventListener('pointerdown', (e) => { if (!$('menu').hidden && !e.target.closest('#menu, #menubtn')) setMenu(false); });
// 結末の型の名前と一言 (B-058。評論家の 2-6)
const ENDINGS = {
  empire: { label: '帝国の維持', line: 'あなたの国は、光の遅れを越えて、ほかのどの国よりずっと大きいまま、この時代を終えた' },
  federation: { label: '連邦への移行', line: 'あなたの国は遠い星系を縛るのをやめ、自治を認めた星系のゆるい連なりとして残った' },
  balance: { label: '多くの国の均衡', line: 'どの国も銀河を一つにはできず、いくつもの国が光の遅れをはさんで並び立った' },
  decline: { label: '地球の衰え', line: 'あなたの国は小さくなり、銀河の歴史の中心は、かつての家臣やほかの国へ移った' },
};
// 終わりの年: 点数を見せる (続けて遊べる)
function showEnd() {
  const g = app.game;
  const sc = g.finalScore || g.score();
  const ch = g.challenges.map((c) => `<li>${ico(`ch-${c.id}`)}${CHALLENGES[c.id].label}: ${c.status === 'done' ? TR('<span class="hz">果たした</span>') : TR('<span class="bad">果たせなかった</span>')}</li>`).join('');
  const en = g.ending(); // 結末の型と原因の内訳 (B-058)。終わったので、光の遅れのない本当の銀河で決める
  $('endbox').innerHTML = TR`<div class="card"><h2>${Math.round(g.endYear)}年 — このゲームの終わり</h2>
    <p class="ending"><span class="muted">結末</span><b>${esc(en.label)}</b></p>
    <p>${esc(en.line)}。</p>
    <table class="tbl">${en.causes.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <p class="muted">${Math.round(g.endYear - START_YEAR)}年の歩みの点数</p>
    <table class="tbl">${sc.parts.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'bad' : ''}">${v}</td></tr>`).join('')}<tr class="total"><td><b>合計</b></td><td><b>${sc.total}</b></td></tr></table>
    ${ch ? TR`<h3>挑戦</h3><ul>${ch}</ul>` : ''}
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
  if (app.regimePick) { if (e.key === 'Escape') { $('regimebox').hidden = true; app.regimePick = null; } return; } // 型を選ぶ窓 (回 GA11)
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.key === ' ') { setSpeed(app.speed ? 0 : app.lastSpeed || 1); e.preventDefault(); }
  else if (e.key >= '1' && e.key <= String(SPEEDS.length)) setSpeed(SPEEDS[Number(e.key) - 1]);
  else if (app.view === 'galaxy' && is3D(app.game.galaxy) && e.key.length === 1 && 'zxrf'.includes(e.key)) galaxyView.rotateBy(e.key === 'z' ? -0.15 : e.key === 'x' ? 0.15 : 0, e.key === 'r' ? 0.1 : e.key === 'f' ? -0.1 : 0); // 地図を回す (Z/X)・傾ける (R/F)
  else if (e.key === 'g') app.setView('galaxy');
  else if (e.key === 's') app.setView('system');
  else if (e.key === 'e') app.setView('empire');
  else if ((e.key === 'Delete' || e.key === 'Backspace') && hasFleetSelection()) { clearFleetSelOrders(); e.preventDefault(); }
  else if (e.key === 'Escape' && app.view === 'galaxy' && !hasFleetSelection() && app.sel.sys !== null) app.deselect();
  else if (e.key === 'Escape') { app.fleetSel.clear(); app.fleetMove.clear(); app.fleetConfirm = null; app.setView('galaxy'); renderFleetBar(); }
});

