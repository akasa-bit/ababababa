const app = {
  game: null,
  view: 'galaxy',
  sel: { sys: 0, body: null },
  speed: 1,
  routeDest: undefined,
  fleetOrigin: undefined,
  fleetSel: new Set(), // 星間マップで選んだ地球の艦隊 (駐留している星系の id)
  fleetMove: new Set(), // 星間マップで選んだ移動中の地球の艦隊 (艦隊の id)
  fleetFocus: null, // 星間マップで押したよその国の艦隊 (艦隊の id)。その艦隊の「ありうる今」の雲を出す
  fleetAmount: 'all', // 送る数: all / half / one
  fleetConfirm: null, // 奇襲攻撃の確認待ちの行き先
  dirty: true,
  selectSystem(id) {
    if (this.picking?.homeFor !== undefined) { this.picking.homeSys = id; renderPick(); }
    else if (this.picking && this.game.nationOf(id)) { pickFocus(id); renderPick(); }
    this.sel = { sys: id, body: null };
    this.lastSys = id;
    this.routeDest = this.fleetOrigin = undefined;
    this.dirty = true;
  },
  openSystem(id) { this.selectSystem(id); this.setView('system'); },
  // 星系の選択を外す (右の欄は「何も選んでいない」になる。星系マップを開いていれば星間マップへ戻る)
  deselect() {
    this.sel = { sys: null, body: null };
    this.routeDest = this.fleetOrigin = undefined;
    if (this.view === 'system') this.setView('galaxy');
    this.dirty = true;
  },
  selectBody(id) { this.sel.body = id; this.dirty = true; },
  setView(v) {
    if (v === 'system' && this.sel.sys === null) this.selectSystem(this.lastSys ?? 0);
    if (v !== this.view && typeof PlayLog !== 'undefined') PlayLog.add('view', { v });
    this.view = v;
    for (const t of ['galaxy', 'system', 'empire', 'events', 'cands']) $(`tab-${t}`).classList.toggle('on', v === t);
    $('empire').hidden = !SHEETS[v];
    document.body.classList.toggle('sheet-view', !!SHEETS[v]);
    if (v === 'events') this.seenTime = this.game.year;
    canvas.style.cursor = 'default';
    $('zoom').hidden = v !== 'galaxy' && v !== 'system';
    if (typeof updateMapButtons === 'function') updateMapButtons();
    $('vassalbtn').hidden = v !== 'galaxy';
    if (typeof renderFleetBar === 'function') renderFleetBar();
    $('legend').hidden = v !== 'galaxy';
    $('rail').hidden = !!SHEETS[v];
    this.dirty = true;
  },
};

// kind: 'real' = 実在の星の 3 次元の銀河 (新しいゲームの既定)、'gen' = 自動生成の 3 次元の銀河 (設定で選ぶ。回 GA10)、'flat' = 以前の平面の銀河 (古いセーブ)
function newGame(seed, kind = 'real', gen = GALAXY_GEN) {
  const galaxy = generateGalaxy({ seed, starCount: 400, meanSpacing: 4, kind, gen });
  app.game = new Game(galaxy);
  app.game.xrec = xrecNew(); // データの書き出しの記録 (回 GA11・B-196。セーブを読むときは restore がセーブの記録に置き換える)
  app.sel = { sys: 0, body: null };
  try { const q = new URLSearchParams(location.search); q.set('seed', seed); history.replaceState(null, '', `?${q}`); } catch { /* 埋め込み環境では無視 */ }
  galaxyView.fit();
  if (typeof updateMapButtons === 'function') updateMapButtons();
  app.dirty = true;
}

const galaxyView = new GalaxyView(canvas, app);
const systemView = new SystemView(canvas, app);

let w = 0, h = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  w = r.width; h = r.height;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  galaxyView.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  galaxyView.w = w;
  galaxyView.h = h;
}
window.addEventListener('resize', () => { resize(); galaxyView.fit(); });
// サイドパネルの中身でキャンバスの表示サイズが変わる(狭い画面の縦並び時)ので、
// 描画バッファを表示サイズに追従させる。ずれると図が縦に潰れて斜めから見たようになる。
// まだ地図を触っていなければ、全体表示も新しいサイズに合わせ直す。
let touched = false;
canvas.addEventListener('pointerdown', () => { touched = true; });
canvas.addEventListener('wheel', () => { touched = true; }, { passive: true });
new ResizeObserver(() => { resize(); if (!touched) galaxyView.fit(); }).observe(canvas);

// --- UI イベント ---
$('tab-galaxy').onclick = () => app.setView('galaxy');
$('tab-system').onclick = () => app.setView('system');
$('tab-empire').onclick = () => app.setView('empire');
$('tab-events').onclick = () => app.setView('events');
let lastEvLabel = '';
$('tab-cands').onclick = () => app.setView('cands');
$('fleetbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-fa]');
  if (!b) return;
  if (b.dataset.fa === 'amount') app.fleetAmount = b.dataset.v;
  else if (b.dataset.fa === 'clear') { app.fleetSel.clear(); app.fleetMove.clear(); }
  else if (b.dataset.fa === 'cancel') app.fleetConfirm = null;
  else if (b.dataset.fa === 'go' && app.fleetConfirm) return orderFleets(app.fleetConfirm);
  else if (b.dataset.fa === 'orders') return clearFleetSelOrders();
  renderFleetBar();
});
// ＋・－・全体は、開いている地図 (星間マップか星系マップ) に効く
const mapView = () => (app.view === 'system' ? systemView : galaxyView);
$('zoom-in').onclick = () => mapView().zoomAt(1.5, w / 2, h / 2);
$('zoom-out').onclick = () => mapView().zoomAt(1 / 1.5, w / 2, h / 2);
$('zoom-fit').onclick = () => mapView().fit();
// 3 次元の地図の回転: 「回す」をオンにするとドラッグで回る。「真上」で真上からの見方と斜めからの見方を切り替える
function updateMapButtons() {
  const real = is3D(app.game?.galaxy);
  $('rotbtn').hidden = $('topbtn').hidden = !real || app.view !== 'galaxy';
  $('rotbtn').classList.toggle('on', !!app.rotateMode);
  setHtml($('topbtn'), galaxyView.cam.pitch < 0.01 ? TR('斜め') : TR('真上'));
}
$('rotbtn').onclick = () => { app.rotateMode = !app.rotateMode; updateMapButtons(); };
$('topbtn').onclick = () => {
  const c = galaxyView.cam;
  if (c.pitch < 0.01) c.pitch = DEFAULT_PITCH; else { c.pitch = 0; c.yaw = 0; }
  updateMapButtons();
  app.dirty = true;
};
// 従属マップの切り替え (家臣 → 主人の矢印)
function updateVassalBtn() { $('vassalbtn').classList.toggle('on', app.mapMode === 'vassal'); }
$('vassalbtn').onclick = () => {
  app.mapMode = app.mapMode === 'vassal' ? 'normal' : 'vassal';
  PlayLog.add('ui', { act: 'mapmode', v: app.mapMode });
  if (app.view !== 'galaxy') app.setView('galaxy');
  if (app.mapMode === 'vassal') galaxyView.fitColonies();
  updateVassalBtn();
  app.dirty = true;
};
