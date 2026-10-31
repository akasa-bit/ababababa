// --- メインループ ---
let last = performance.now();
// 背景の層: 画面に合わせて画像を切り替え、星間マップでは視点の 4% だけ動かす (ズームでもわずかに大きく)。
// 3 次元の地図では、回すと背景も同じ角度だけ回り、傾けると上下にずれる (遠くの空として地図についてくる)
const sky = $('sky');
let lastSkyKey = '';
// 星系マップの背景: 太陽系は北アメリカ星雲、ほかの星系は assets/systems/ の 17 枚から星系ごとに決まった1枚 (使い回し)
const SYSTEM_BG_COUNT = 17;
// シミュレーション版 (物理) は、どの星系も天の川の星図 (地球から見た空)。50 光年ほどの近さでは、どの星から見ても空は地球とほとんど同じで、
// 色の付いた星雲 (多くは赤外線の疑似色や、大マゼラン雲・アンドロメダ銀河のような銀河の外のもの) が空いっぱいに見えることはない (Siegel・半田利弘の指摘)
const systemBg = (id) => (SIM_ONLY ? 'assets/space-galaxy.jpg' : id === 0 ? 'assets/space-system.jpg' : `assets/systems/${String(1 + (hashSeed(`bg${id}`) % SYSTEM_BG_COUNT)).padStart(2, '0')}.jpg`);
function updateSky() {
  const v = app.view === 'system' ? 'system' : 'galaxy';
  const c = galaxyView.cam;
  const key = v === 'galaxy' ? `g|${c.x}|${c.y}|${c.zoom}|${c.yaw}|${c.pitch}` : `s|${app.sel.sys}`;
  if (key === lastSkyKey) return;
  lastSkyKey = key;
  sky.dataset.view = v;
  if (v === 'system' && app.sel.sys != null) sky.lastElementChild.style.backgroundImage = `linear-gradient(rgba(11,12,13,.5), rgba(11,12,13,.5)), url("${systemBg(app.sel.sys)}")`;
  if (v === 'galaxy') {
    const k = 0.04, sc = Math.min(1.1, Math.max(1, 1 + Math.log(c.zoom / 6) * 0.03));
    // 端が見えないよう、ずらす量は背景の余白 (12%) の 8 割まで
    const mx = sky.clientWidth * 0.1, my = sky.clientHeight * 0.1;
    const tx = Math.max(-mx, Math.min(mx, -c.x * c.zoom * k)), ty = Math.max(-my, Math.min(my, -c.y * c.zoom * k));
    const tilt = (c.pitch || 0) * sky.clientHeight * 0.08; // 傾けた分だけ空を上へずらす (余白の中)
    sky.firstElementChild.style.transform = `translate(${tx.toFixed(1)}px, ${(ty - tilt).toFixed(1)}px) rotate(${(c.yaw || 0).toFixed(4)}rad) scale(${sc.toFixed(3)})`;
  }
}
let lastNosel = false, lastMapKey = '', lastMapGame = null, lastDrawYear = NaN, lastDateText = '', mapActiveUntil = 0, lastTickYear = NaN, lastFullTick = 0;
// 知らせの帯に、届いたばかりで薄れていく知らせがあるか (10 秒で消える)
const railFading = (now) => now - (app.railNewest ?? -Infinity) < 11000;
// 操作のあとしばらくは、地図を毎フレーム描き直す (なぞり・ホバー・ズーム・長押しの線など)
for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'touchstart', 'touchmove', 'touchend']) window.addEventListener(ev, () => { mapActiveUntil = performance.now() + 600; }, { passive: true, capture: true });
window.addEventListener('resize', () => { mapActiveUntil = performance.now() + 600; });
let acc = 0;
function frame(now) {
  PlayLog.tick(Math.min(1000, now - last));
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const game = app.game;
  const nosel = app.sel.sys === null;
  if (nosel !== lastNosel) { lastNosel = nosel; document.body.classList.toggle('nosel', nosel); app.dirty = true; } // 欄の幅が変わると ResizeObserver が地図を合わせる
  if (Net.on) { if (Net.frame(dt)) app.dirty = true; }
  else if (app.speed && game.advance(dt * app.speed)) app.dirty = true;
  if (app.turnEvery && isHotseat() && $('curtain').hidden && game.year >= (app.turnStart ?? game.year) + app.turnEvery) nextTurn(true);
  if (app.skip) checkSkip();
  // 地図は、変わりうるときだけ描き直す: 動くものが見える距離だけ動いた・画面や表示が変わった・操作の直後 (0.6 秒)・視点が動いた直後 (止まってからの描き直しのため)・点滅しているもの・
  // 右の欄を描き直すとき (選択などの変更。0.5 秒ごとの更新も含む)。何も起きていなければ前の絵をそのまま残す
  const cam = galaxyView.cam;
  // 星図では、年が進んでも動くものが 0.25 ピクセル動くまでは描き直さない。いちばん速く見えるのは地球へ近づく船で、
  // 見かけの速さは光速の 20 倍 (0.95c で近づくとき 1/(1−0.95)) まで。星系図は惑星が回るので毎フレーム描く
  const yearMoved = app.view === 'galaxy' ? Math.abs(game.year - lastDrawYear) * 20 * cam.zoom >= 0.25 : game.year !== lastDrawYear;
  const mapKey = `${app.view}|${w}|${h}|${cam.x}|${cam.y}|${cam.z}|${cam.zoom}|${cam.yaw}|${cam.pitch}|${app.sel.sys}|${app.sel.body}|${app.fleetSel.size}|${app.fleetMove.size}|${app.signalMode}|${systemView.cam.x}|${systemView.cam.y}|${systemView.cam.zoom}`;
  if (app.dirty || yearMoved || mapKey !== lastMapKey || game !== lastMapGame || now < mapActiveUntil || now - (galaxyView.camMovedAt || 0) < 400 || galaxyView.animating || systemView.animating) {
    lastMapKey = mapKey; lastMapGame = game; lastDrawYear = game.year; galaxyView.animating = systemView.animating = false;
    const ctx = galaxyView.ctx;
    ctx.clearRect(0, 0, w, h); // 透明にして、後ろの宇宙の背景を見せる
    updateSky();
    if (app.view === 'galaxy') { galaxyView.draw(w, h); if (app.picking) drawPick(galaxyView); }
    else if (app.view === 'system') systemView.draw(w, h);
  }

  const dateText = TR`西暦 ${Math.floor(game.year)}年 ${Math.floor((game.year % 1) * 12) + 1}月`;
  if (dateText !== lastDateText) { lastDateText = dateText; $('date').textContent = dateText; }
  acc += dt;
  // 0.5 秒ごとの更新 (右の欄・ログ・知らせの帯・収支)。年が進んでいない・操作もない・薄れていく知らせもないときは省く
  // (5 秒に 1 回はかならず更新する)
  if (acc > 0.5 && (game.year !== lastTickYear || now < mapActiveUntil + 1000 || now - lastFullTick > 5000 || railFading(now))) {
    acc = 0; lastTickYear = game.year; lastFullTick = now;
    updateTurnBtn();
    setHtml($('ships'), shipsHtml(game));
    setHtml($('log'), logHtml(game));
    if (!SHEETS[app.view]) setHtml($('rail'), railHtml(game));
    setHtml($('treasury'), treasuryHtml(game));
    setHtml($('ledger'), ledgerHtml(game));
    setHtml($('sec-ledger').firstElementChild, TR`${ico('credits')}${ME.gov}の収支`);
    if (hasFleetSelection()) renderFleetBar();
    $('skipbtn').classList.toggle('on', !!app.skip);
    if (game.ended && !game.endShown) { game.endShown = true; setSpeed(0); showEnd(); }
    if (app.view === 'events') app.seenTime = game.year;
    const unseen = game.knownEvents().filter((e) => !e.good && evShown(e.kind) && (e.seen ?? e.year) > (app.seenTime ?? -Infinity)).length;
    // 決めることがあれば、イベントのタブに印 (⚑) をつける
    const dec = game.visibleDecisions().length;
    const evLabel = TR`${ico('events')}イベント${unseen ? ` (${unseen})` : ''}${dec ? ` ⚑${dec}` : ''}`;
    if (lastEvLabel !== evLabel) { lastEvLabel = evLabel; $('tab-events').innerHTML = evLabel; }
    $('tab-events').classList.toggle('hot', dec > 0);
    app.dirty = true;
  }
  if (app.dirty && !panelBusy()) {
    app.dirty = false;
    setHtmlKeepScroll(panel, helpify(app.view === 'system' && app.sel.body ? bodyPanel(app) : systemPanel(app)));
    if (SHEETS[app.view]) setHtmlKeepScroll(empire, helpify(SHEETS[app.view](app)));
    keepAnchor();
  }
  requestAnimationFrame(frame);
}

$('brand').innerHTML = brandHtml();
document.title = EDITION === 'sim' ? `${GAME_NAME} ${EDITION_LABEL.sim}` : GAME_NAME;
resize();
// 起動: 古い版の localStorage のセーブがあればすぐ読む。なければ仮のゲームで始め、IndexedDB のセーブが読めたら差し替える
const legacy = readLegacySave();
const wanted = params.get('seed');
const seedOk = (d) => d && (wanted === null || wanted === String(d.seed));
if (seedOk(legacy) && loadSave(legacy)) app.game.message('セーブデータをロードした。');
else newGame(wanted || String(Math.floor(Math.random() * 1e6))); // 壊れたデータは破棄
updateSpeedButtons();
updateSpectateBtn();
// 起動時はホーム画面から (?home=0 なら出さない)
if (params.get('home') !== '0') openHome();
requestAnimationFrame(frame);
window.__app = app; // デバッグ用
PlayLog.start();
app.storeReady = Store.init().then(async () => {
  await PlayLog.init();
  if (!seedOk(legacy)) {
    const t = await Store.get(SAVE_KEY);
    const d = t ? parseSave(t) : null;
    if (seedOk(d) && loadSave(d)) {
      app.game.message('セーブデータをロードした。');
      updateSpectateBtn();
      if (app.homeOpen) { app.homeSpeed = app.speed; app.speed = 0; updateSpeedButtons(); }
    }
  }
  save();
  if (app.homeOpen) renderHome();
  app.dirty = true;
});

