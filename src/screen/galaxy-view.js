// マーチング・スクエアの線 (角の印 k = 左上 1・右上 2・右下 4・左下 8 が中。辺は 0 = 上・1 = 右・2 = 下・3 = 左)
const MS_SEGS = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]] };
// 向かい合う 2 つの角だけが中のとき (5・10) は、升目の真ん中が中か外かで線を分ける ([外のとき, 中のとき])
const MS_SADDLE = { 5: [[[3, 0], [1, 2]], [[3, 2], [1, 0]]], 10: [[[0, 1], [2, 3]], [[0, 3], [2, 1]]] };
class GalaxyView {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;
    this.ctx = canvas.getContext('2d');
    // 視点: 注目点 (x, y, z)・倍率・向き yaw (銀河面の中の回転)・傾き pitch (0 = 真上から、正なら斜めから)
    this.cam = { x: 0, y: 0, z: 0, zoom: 6, yaw: 0, pitch: 0 };
    this.hover = null;
    this.drag = null;
    this.bind();
  }

  fit() {
    const g = this.app.game.galaxy;
    const r = g.radius + 6;
    this.cam.zoom = clamp(Math.min(this.w, this.h) / 2 / r, 1.5, 80);
    this.cam.x = 0;
    this.cam.y = 0;
    this.cam.z = 0;
    // 3 次元の銀河は、少し斜めから見下ろして始める (平面の銀河は真上から)
    if (this.camKind !== g.kind) { this.camKind = g.kind; this.cam.yaw = 0; this.cam.pitch = g.kind === 'real' ? DEFAULT_PITCH : 0; }
  }

  // 地球の知っている入植星系がすべて収まるように寄せる (従属マップを開いたとき)
  fitColonies() {
    const game = this.app.game;
    const pts = game.knownSystems().filter((s) => s.id === game.cap || game.known(s.id)?.cols.length);
    if (pts.length < 2) return this.fit();
    const xs = pts.map((s) => s.x), ys = pts.map((s) => s.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    this.cam.x = (x0 + x1) / 2;
    this.cam.y = (y0 + y1) / 2;
    this.cam.zoom = clamp(Math.min(this.w / (x1 - x0 + 8), this.h / (y1 - y0 + 8)) * 0.85, 1.5, 80);
  }

  // 世界 [光年] → 画面。注目点からのずれを、銀河面の中で yaw だけ回し、横軸のまわりに pitch だけ傾けて、正射影で写す
  // (真上から見たとき (yaw = pitch = 0) は、以前の平面の地図と同じ写し方)
  toScreen(x, y, z = 0) {
    const c = this.cam;
    const dx = x - c.x, dy = y - c.y, dz = (z || 0) - c.z;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    const x1 = dx * cy - dy * sy, y1 = dx * sy + dy * cy;
    const y2 = y1 * Math.cos(c.pitch) - dz * Math.sin(c.pitch);
    return [x1 * c.zoom + this.w / 2, y2 * c.zoom + this.h / 2];
  }
  // 画面のずれ [px] → 注目点の高さの面の上での世界のずれ [光年]
  screenDelta(dx, dy) {
    const c = this.cam;
    const x1 = dx / c.zoom, y1 = dy / c.zoom / Math.max(0.2, Math.cos(c.pitch));
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    return [x1 * cy + y1 * sy, -x1 * sy + y1 * cy];
  }
  // 画面 → 世界 (注目点の高さの面との交点)
  toWorld(sx, sy) {
    const [dx, dy] = this.screenDelta(sx - this.w / 2, sy - this.h / 2);
    return [this.cam.x + dx, this.cam.y + dy];
  }
  // 画面の点 (sx, sy) の下に、世界の点 (wx, wy) が来るように注目点を動かす
  pinWorld(wx, wy, sx, sy) {
    const [dx, dy] = this.screenDelta(sx - this.w / 2, sy - this.h / 2);
    this.cam.x = wx - dx;
    this.cam.y = wy - dy;
  }
  // 回す: yaw は自由に、pitch は真上 (0) から 75° まで
  rotateBy(dyaw, dpitch) {
    this.cam.yaw = (this.cam.yaw + dyaw) % (Math.PI * 2);
    this.cam.pitch = clamp(this.cam.pitch + dpitch, 0, MAX_PITCH);
    this.app.dirty = true;
  }

  pick(sx, sy, radius = 12) {
    let best = null;
    let bd = radius;
    for (const s of this.app.game.galaxy.systems) {
      const [px, py] = this.toScreen(s.x, s.y, s.z);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  zoomAt(factor, sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.zoom = clamp(this.cam.zoom * factor, 1.5, 80);
    this.pinWorld(wx, wy, sx, sy);
  }

  // マウス・タッチ共通 (Pointer Events)。1本指=ドラッグ/タップ、2本指=ピンチズーム。
  bind() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const pts = new Map();
    let pinch = null;
    c.addEventListener('contextmenu', (e) => { if (this.app.view === 'galaxy') e.preventDefault(); });
    c.addEventListener('pointerdown', (e) => {
      if (this.app.view !== 'galaxy') return;
      // 右クリック = 選んだ艦隊の移動先、Shift+ドラッグ = 範囲選択 (Hearts of Iron 風)
      if (e.pointerType === 'mouse' && e.button === 2) { this.rdown = pos(e); return; }
      if (e.pointerType === 'mouse' && e.button === 0 && e.shiftKey) {
        const [x, y] = pos(e);
        this.box = { x0: x, y0: y, x1: x, y1: y };
        c.setPointerCapture(e.pointerId);
        return;
      }
      pts.set(e.pointerId, pos(e));
      c.setPointerCapture(e.pointerId);
      if (pts.size === 1) {
        const [x, y] = pos(e);
        // 回す: 「回す」ボタンがオン、マウスの中ボタン、Alt を押しながらのドラッグ
        const rot = this.app.rotateMode || (e.pointerType === 'mouse' && (e.button === 1 || e.altKey));
        this.drag = { x, y, cx: this.cam.x, cy: this.cam.y, moved: false, rot, yaw: this.cam.yaw, pitch: this.cam.pitch };
        // タッチの長押し (0.45秒動かさない) で経由地の線引きを始める
        clearTimeout(this.lp);
        if (e.pointerType !== 'mouse') this.lp = setTimeout(() => { if (this.drag && !this.drag.moved && pts.size === 1) this.startPath(x, y); }, 450);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        pinch = { d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), zoom: this.cam.zoom, world: this.toWorld(mx, my), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), yaw: this.cam.yaw };
        clearTimeout(this.lp);
        this.path = null;
        if (this.drag) this.drag.moved = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (this.app.view !== 'galaxy') return;
      const [x, y] = pos(e);
      if (this.box) { this.box.x1 = x; this.box.y1 = y; }
      // 右ドラッグ (マウス) も経由地の線引き
      if (this.rdown && !this.path && Math.hypot(x - this.rdown[0], y - this.rdown[1]) > 6) this.startPath(this.rdown[0], this.rdown[1]);
      if (this.path) { this.extendPath(x, y, e.pointerType !== 'mouse'); this.hover = null; return; }
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        // 倍率は指の間隔の比。ピンチを始めたとき指の中点の下にあった地点が、いまの中点の下に来るよう視点を動かす
        // (中身が指に貼りついたまま拡大・移動し、ずれていかない)
        this.cam.zoom = clamp(pinch.zoom * d / pinch.d, 1.5, 80);
        // 2 本指をひねると回る (3 次元の銀河のとき)
        if (this.app.game.galaxy.kind === 'real') this.cam.yaw = pinch.yaw - (Math.atan2(b[1] - a[1], b[0] - a[0]) - pinch.ang);
        this.pinWorld(pinch.world[0], pinch.world[1], mx, my);
        return;
      }
      if (this.drag) {
        const dx = x - this.drag.x;
        const dy = y - this.drag.y;
        if (Math.hypot(dx, dy) > 6) { this.drag.moved = true; clearTimeout(this.lp); }
        if (this.drag.moved && this.drag.rot) {
          this.cam.yaw = this.drag.yaw - dx * 0.008;
          this.cam.pitch = clamp(this.drag.pitch - dy * 0.008, 0, MAX_PITCH);
        } else if (this.drag.moved) {
          const [wx, wy] = this.screenDelta(dx, dy);
          this.cam.x = this.drag.cx - wx;
          this.cam.y = this.drag.cy - wy;
        }
      }
      if (e.pointerType === 'mouse') {
        this.hover = this.pick(x, y);
        this.mouse = [x, y];
        c.style.cursor = this.hover ? 'pointer' : this.drag?.moved ? 'grabbing' : 'default';
      }
    });
    const end = (e) => {
      if (this.app.view !== 'galaxy') return;
      const [x, y] = pos(e);
      clearTimeout(this.lp);
      if (this.path) {
        const ids = this.path.ids;
        this.path = null;
        this.rdown = null;
        pts.delete(e.pointerId);
        if (pts.size === 0) this.drag = null;
        if (e.type === 'pointerup' && ids.length) orderFleets(ids);
        return;
      }
      if (this.box) {
        const b = this.box;
        this.box = null;
        if (e.type === 'pointerup') this.boxSelect(b);
        return;
      }
      if (this.rdown) {
        const moved = Math.hypot(x - this.rdown[0], y - this.rdown[1]) > 6;
        this.rdown = null;
        const s = this.pick(x, y);
        if (e.type === 'pointerup' && !moved && s && hasFleetSelection()) orderFleets(s.id);
        return;
      }
      const wasPinch = pts.size > 1;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (wasPinch && pts.size === 1 && this.drag) {
        const [rx, ry] = [...pts.values()][0];
        this.drag = { x: rx, y: ry, cx: this.cam.x, cy: this.cam.y, moved: true, rot: this.app.rotateMode, yaw: this.cam.yaw, pitch: this.cam.pitch };
      }
      if (this.drag && !this.drag.moved && !wasPinch && e.type === 'pointerup') this.tap(this.pick(x, y), e, this.pickFleet(x, y));
      if (pts.size === 0) this.drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', (e) => {
      if (this.app.view !== 'galaxy') return;
      const [x, y] = pos(e);
      const s = this.pick(x, y);
      if (s) this.app.openSystem(s.id);
    });
    c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover = null; });
    c.addEventListener('wheel', (e) => {
      if (this.app.view !== 'galaxy') return;
      e.preventDefault();
      const [x, y] = pos(e);
      this.zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
    }, { passive: false });
  }

  // クリック・タップ。地球の艦隊がいる星系なら艦隊を選ぶ (Shift で追加・解除)。
  // タッチ操作では、艦隊を選んでいるときに別の星系をタップすると移動命令になる (マウスは右クリック)
  // 長押し (右ドラッグ) で経由地の線を引く。何も選んでいなければ、押した所の艦隊を選んで始める。
  // 指が触れた星系を触れた順に経由地にし、離したときに選んだ艦隊へその順で回る指令を出す
  startPath(x, y) {
    if (!hasFleetSelection()) {
      const fd = this.pickFleet(x, y);
      const s = this.pick(x, y, 18);
      if (fd) this.app.fleetMove.add(fd.id);
      else if (s && isOwnStack(this.app.game, s.id)) this.app.fleetSel.add(s.id);
      else return;
    }
    this.drag = null;
    this.path = { x, y, ids: [] };
    this.app.fleetConfirm = null;
    try { navigator.vibrate?.(15); } catch { /* 対応していない端末では無視 */ }
    renderFleetBar();
  }
  extendPath(x, y, touch) {
    const p = this.path;
    p.x = x;
    p.y = y;
    const s = this.pick(x, y, touch ? 18 : 12);
    if (!s || s.id === p.ids[p.ids.length - 1]) return;
    if (!p.ids.length && this.app.fleetSel.has(s.id)) return; // 出発地の上はまだ経由地にしない
    p.ids.push(s.id);
  }
  // 移動中の地球の艦隊 (画面上の三角) を選ぶ
  pickFleet(sx, sy) {
    let best = null;
    let bd = 9;
    for (const d of this.fleetDots || []) {
      const k = Math.hypot(d.x - sx, d.y - sy);
      if (k < bd) { bd = k; best = d; }
    }
    return best;
  }
  tap(s, e, fd = null) {
    const app = this.app;
    const sel = app.fleetSel;
    const mv = app.fleetMove;
    const touch = e.pointerType !== 'mouse';
    if (fd) {
      if (e.shiftKey || (touch && hasFleetSelection())) { if (mv.has(fd.id)) mv.delete(fd.id); else mv.add(fd.id); }
      else { sel.clear(); mv.clear(); mv.add(fd.id); }
      app.fleetConfirm = null;
      renderFleetBar();
      return;
    }
    if (!s) {
      // 何もないところ: 艦隊を選んでいればその選択を外し、なければ星系の選択を外す
      if (!e.shiftKey) { if (hasFleetSelection()) { sel.clear(); mv.clear(); } else app.deselect(); }
      app.fleetConfirm = null; renderFleetBar(); return;
    }
    if (touch && hasFleetSelection() && !sel.has(s.id)) { orderFleets(s.id); return; }
    if (isOwnStack(app.game, s.id)) {
      if (e.shiftKey) { if (sel.has(s.id)) sel.delete(s.id); else sel.add(s.id); }
      else if (touch && sel.has(s.id)) sel.delete(s.id);
      else { sel.clear(); mv.clear(); sel.add(s.id); }
    } else if (!e.shiftKey) { sel.clear(); mv.clear(); }
    app.fleetConfirm = null;
    app.selectSystem(s.id);
    renderFleetBar();
  }
  boxSelect(b) {
    const [x0, x1] = [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1)];
    const [y0, y1] = [Math.min(b.y0, b.y1), Math.max(b.y0, b.y1)];
    for (const s of this.app.game.galaxy.systems) {
      const [px, py] = this.toScreen(s.x, s.y, s.z);
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1 && isOwnStack(this.app.game, s.id)) this.app.fleetSel.add(s.id);
    }
    for (const d of this.fleetDots || []) if (d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1) this.app.fleetMove.add(d.id);
    this.app.fleetConfirm = null;
    renderFleetBar();
  }

  centerOn(sys) { this.cam.x = sys.x; this.cam.y = sys.y; this.cam.z = sys.z || 0; }

  // 視点に依存する重いレイヤー (星・国境) を、画面より一回り大きく (上下左右に余白 m) 描いて使い回す。
  // 視点が動いているあいだは前に描いたものをずらして (ズームなら拡大縮小して) 貼るだけにし、動きが止まってから描き直す。
  // 中身 (key)・画面の大きさが変わったとき、ずらすと端が足りなくなるとき、ズームが2倍以上変わったとき、
  // 回したり傾けたりしたとき (ずらすだけでは合わない) はすぐ描き直す。
  // render(lc, m) は画面の座標 (toScreen) で描く。描ける範囲は −m〜w+m
  viewLayer(name, w, h, key, render) {
    const L = ((this.layers ??= {})[name] ??= { c: document.createElement('canvas') });
    const s = this.canvas.width / Math.max(1, w); // レイヤーの解像度 (画面と同じ。貼るときに拡大縮小しないので速い)
    const m = Math.round(Math.max(w, h) * 0.12); // 余白 (広いほど描き直しが減るが、メモリを食う)
    const cam = this.cam;
    const place = () => {
      // 描いたときの注目点が、いまの画面のどこに来るか (向きは同じなので、ずらして拡大縮小するだけで重なる)
      const k = cam.zoom / L.cam.zoom;
      const [cx, cy] = this.toScreen(L.cam.x, L.cam.y, L.cam.z);
      const left = k * (-m - w / 2) + cx;
      const top = k * (-m - h / 2) + cy;
      return { k, left, top, right: left + k * (w + 2 * m), bottom: top + k * (h + 2 * m) };
    };
    let fresh = !L.cam || L.key !== key || L.w !== w || L.h !== h || L.s !== s || L.cam.yaw !== cam.yaw || L.cam.pitch !== cam.pitch;
    if (!fresh && (L.cam.x !== cam.x || L.cam.y !== cam.y || L.cam.z !== cam.z || L.cam.zoom !== cam.zoom)) {
      const p = place();
      const settled = performance.now() - (this.camMovedAt || 0) > 180;
      if (settled || p.left > 0 || p.top > 0 || p.right < w || p.bottom < h || p.k < 0.5 || p.k > 2) fresh = true;
    }
    if (fresh) {
      const cw = Math.ceil((w + 2 * m) * s), ch = Math.ceil((h + 2 * m) * s);
      if (L.c.width !== cw || L.c.height !== ch) { L.c.width = cw; L.c.height = ch; }
      const lc = L.c.getContext('2d');
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, cw, ch);
      lc.setTransform(s, 0, 0, s, m * s, m * s);
      render(lc, m, s);
      Object.assign(L, { key, w, h, s, cam: { ...cam } });
    }
    // 見えている部分だけを切り出して貼る (余白まで貼ると重い)。ずらすだけのときは画面の画素にそろえて 1:1 で写す
    // (半端な位置に貼ると、毎フレーム補間が入って重い)
    const p = place();
    const dpr = this.canvas.width / Math.max(1, w);
    const ctx = this.ctx;
    if (p.k === 1 && L.s === dpr) {
      const ox = Math.round(-p.left * dpr), oy = Math.round(-p.top * dpr);
      const cw = Math.min(this.canvas.width, L.c.width - ox), chh = Math.min(this.canvas.height, L.c.height - oy);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (cw > 0 && chh > 0) ctx.drawImage(L.c, ox, oy, cw, chh, 0, 0, cw, chh);
      ctx.restore();
    } else {
      const f = L.s / p.k; // 画面1px あたりのレイヤーの画素
      const sx = Math.max(0, -p.left * f), sy = Math.max(0, -p.top * f);
      const sw = Math.min(L.c.width - sx, w * f), sh = Math.min(L.c.height - sy, h * f);
      if (sw > 0 && sh > 0) ctx.drawImage(L.c, sx, sy, sw, sh, p.left + sx / f, p.top + sy / f, sw / f, sh / f);
    }
  }

  draw(w, h) {
    this.w = w;
    this.h = h;
    const { ctx } = this;
    const camKey = `${this.cam.x},${this.cam.y},${this.cam.z},${this.cam.zoom},${this.cam.yaw},${this.cam.pitch}`;
    if (camKey !== this.lastCamKey) { this.lastCamKey = camKey; this.camMovedAt = performance.now(); }
    const game = this.app.game;
    const sel = game.system(this.app.sel.sys ?? game.cap);
    const z = this.cam.zoom;

    // 選択中の星からの距離リング (選んだ星の高さの、銀河面に平行な面の上の円。傾けると楕円に見える)
    const [cx, cy] = this.toScreen(sel.x, sel.y, sel.z);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(120,160,230,0.55)';
    ctx.strokeStyle = 'rgba(90,130,210,0.25)';
    const flat = this.cam.pitch < 0.01;
    for (const d of [4, 8, 16, 32, 64]) {
      if (d * z < 20) continue;
      ctx.beginPath();
      if (flat) ctx.arc(cx, cy, d * z, 0, Math.PI * 2);
      else for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; const [px, py] = this.toScreen(sel.x + d * Math.cos(a), sel.y + d * Math.sin(a), sel.z); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
      const [lx, ly] = flat ? [cx + 4, cy - d * z - 3] : this.toScreen(sel.x, sel.y - d, sel.z);
      ctx.fillText(`${d} ly`, lx + (flat ? 0 : 4), ly - (flat ? 0 : 3));
    }
    ctx.setLineDash([]);
    // 高さの手がかり: 傾けているときは、各星から銀河面 (z = 0) へ縦の線を引く (EVE Online の星図と同じ)
    if (!flat && this.app.game.galaxy.kind === 'real') {
      ctx.strokeStyle = 'rgba(120,150,210,0.16)';
      ctx.beginPath();
      for (const sx of this.app.game.galaxy.systems) {
        if (Math.abs(sx.z || 0) < 0.3) continue;
        const [ax, ay] = this.toScreen(sx.x, sx.y, sx.z);
        const [bx, by] = this.toScreen(sx.x, sx.y, 0);
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      }
      ctx.stroke();
      // 銀河面の目盛り: 太陽から 10 光年ごとの円
      ctx.strokeStyle = 'rgba(120,150,210,0.10)';
      for (let d = 10; d <= this.app.game.galaxy.radius + 5; d += 10) {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; const [px, py] = this.toScreen(d * Math.cos(a), d * Math.sin(a), 0); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
    }

    // 地図はすべて「いま地球に届いている光」で描く: 動くものは見かけの位置、星系の様子は光が届いた時点のもの
    const seenAt = (posAt, t0, t1) => game.apparent(posAt, t0, t1);
    const known = new Map();
    const K = (id) => { if (!known.has(id)) known.set(id, id === game.cap ? game.snapshot(id) : game.known(id)); return known.get(id); };

    // 国の領土 (ステラリスの銀河の地図にならう): TERRITORY_LY 光年以内でいちばん近い入植星系の国の領土にする。
    // 升目の角ごとに「いちばん近い国 a (距離 d1)」と「ほかの国でいちばん近い b (距離 d2)」を求め、国 r の場
    // g_r = min(R − d_r, d_ほか − d_r) (正なら r の領土) を作る。中は升目の絵を淡く塗り、縁は g_r の等高線を
    // 升目の辺の上で補間して線で引く (マーチング・スクエア。升目の階段が出ない)。隣の国どうしの縁は、
    // それぞれ自分の側に少し入れて引くので、2 つの色が並ぶ。
    // 描いた絵は 1 枚のレイヤーに貯めておき、視点が止まったときと国ごとの星系が変わったときだけ描き直す (重いので)
    const members = [];
    for (const sx of game.knownSystems()) {
      const k = K(sx.id);
      if (k?.cols.length) members.push(`${k.realm ?? 0}:${sx.id}`);
    }
    if (members.length) {
      this.viewLayer('border', w, h, OWN.hex + members.join(','), (lc, m) => {
        const owners = [];
        for (const sx of game.knownSystems()) {
          const k = K(sx.id);
          if (!k?.cols.length) continue;
          const [x, y] = this.toScreen(sx.x, sx.y, sx.z);
          owners.push({ x, y, realm: k.realm ?? 0 });
        }
        const R = TERRITORY_LY * this.cam.zoom;
        const C = clamp(Math.round(R / 12), 2, 4); // 升目の大きさ [px]
        const x0 = -m, y0 = -m, gw = Math.ceil((w + 2 * m) / C), gh = Math.ceil((h + 2 * m) / C);
        // 入植星系を、大きさ R の箱に分けておく (角ごとに近くの箱だけ調べる)
        const bins = new Map();
        const bk = (bx, by) => bx * 100003 + by;
        for (const o of owners) { const key = bk(Math.floor(o.x / R), Math.floor(o.y / R)); if (!bins.has(key)) bins.set(key, []); bins.get(key).push(o); }
        const realms = [...new Set(owners.map((o) => o.realm))];
        const ri = new Map(realms.map((r, n) => [r, n + 1]));
        // 升目の角 (gw+1)×(gh+1) ごとの a・d1・b・d2
        const cw1 = gw + 1, N = cw1 * (gh + 1);
        const A = new Uint8Array(N), B = new Uint8Array(N), D1 = new Float32Array(N).fill(Infinity), D2 = new Float32Array(N).fill(Infinity);
        for (let cy = 0; cy <= gh; cy++) {
          const py = y0 + cy * C, by = Math.floor(py / R);
          for (let cx = 0; cx <= gw; cx++) {
            const px = x0 + cx * C, bx = Math.floor(px / R), i = cy * cw1 + cx;
            let d1 = Infinity, a = 0, d2 = Infinity, b = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const list = bins.get(bk(bx + dx, by + dy));
              if (!list) continue;
              for (const o of list) {
                const d = Math.hypot(o.x - px, o.y - py), v = ri.get(o.realm);
                if (d < d1) { if (v !== a) { d2 = d1; b = a; } d1 = d; a = v; } else if (v !== a && d < d2) { d2 = d; b = v; }
              }
            }
            A[i] = a; D1[i] = d1; B[i] = b; D2[i] = d2;
          }
        }
        // 国 v の場の値 (角 i)。a でも b でもない国は十分に外
        const field = (v, i) => (A[i] === v ? Math.min(R - D1[i], D2[i] - D1[i]) : B[i] === v ? Math.min(R - D2[i], D1[i] - D2[i]) : -R);
        // 中: 升目の中心がどの国か (中心の値は 4 つの角の平均で見る) を淡く塗る
        const rgb = realms.map((r) => { const c = realmColor(r); return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; });
        const img = new ImageData(gw, gh);
        for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
          const i = gy * cw1 + gx, js = [i, i + 1, i + cw1, i + cw1 + 1];
          let v = 0, best = 0;
          for (const j of js) for (const c of [A[j], B[j]]) {
            if (!c) continue;
            const g = (field(c, i) + field(c, i + 1) + field(c, i + cw1) + field(c, i + cw1 + 1)) / 4;
            if (g > best) { best = g; v = c; }
          }
          if (!v) continue;
          const [r, g2, b2] = rgb[v - 1];
          const o = (gy * gw + gx) * 4;
          img.data[o] = r; img.data[o + 1] = g2; img.data[o + 2] = b2;
          img.data[o + 3] = realms[v - 1] === game.cap ? 52 : 40;
        }
        this.off ??= document.createElement('canvas');
        this.off.width = gw; this.off.height = gh;
        this.off.getContext('2d').putImageData(img, 0, 0);
        lc.imageSmoothingEnabled = true;
        lc.filter = `blur(${(C * 0.5).toFixed(1)}px)`; // 升目の角を丸める
        lc.drawImage(this.off, x0, y0, gw * C, gh * C);
        lc.filter = 'none';
        // 作業用のキャンバスは描き終えたら小さくしてメモリを返す (タブレットでは大きなキャンバスが重なると表示が乱れる)
        this.off.width = this.off.height = 1;
        // 縁: 国ごとに g_r = t の等高線を引く (t は線の幅の半分。自分の領土の側に線が入る)
        const paths = realms.map(() => new Path2D());
        const lw = (v) => (realms[v - 1] === game.cap ? 2.4 : 1.8);
        const cross = (ga, gb, t) => (t - ga) / (gb - ga);
        for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
          const i = gy * cw1 + gx, js = [i, i + 1, i + cw1 + 1, i + cw1]; // 左上・右上・右下・左下
          const seen = new Set();
          for (const j of js) { if (A[j]) seen.add(A[j]); if (B[j]) seen.add(B[j]); }
          for (const v of seen) {
            const t = lw(v) / 2;
            const g = js.map((j) => field(v, j) - t);
            const k = (g[0] > 0 ? 1 : 0) | (g[1] > 0 ? 2 : 0) | (g[2] > 0 ? 4 : 0) | (g[3] > 0 ? 8 : 0);
            if (k === 0 || k === 15) continue;
            const px = x0 + gx * C, py = y0 + gy * C;
            // 辺の上の交点: 0 = 上・1 = 右・2 = 下・3 = 左
            const pt = (e) => {
              if (e === 0) return [px + C * cross(g[0], g[1], 0), py];
              if (e === 1) return [px + C, py + C * cross(g[1], g[2], 0)];
              if (e === 2) return [px + C * cross(g[3], g[2], 0), py + C];
              return [px, py + C * cross(g[0], g[3], 0)];
            };
            const segs = MS_SEGS[k] ?? (g[0] + g[1] + g[2] + g[3] > 0 ? MS_SADDLE[k][1] : MS_SADDLE[k][0]);
            const path = paths[v - 1];
            for (const [e1, e2] of segs) { const [ax, ay] = pt(e1), [bx2, by2] = pt(e2); path.moveTo(ax, ay); path.lineTo(bx2, by2); }
          }
        }
        lc.lineCap = 'round'; lc.lineJoin = 'round';
        realms.forEach((r, n) => {
          const [cr, cg, cb] = rgb[n];
          lc.strokeStyle = `rgba(${cr},${cg},${cb},${r === game.cap ? 0.92 : 0.78})`;
          lc.lineWidth = lw(n + 1);
          lc.stroke(paths[n]);
        });
      });
    }

    // 交易路と輸送中の貨物
    ctx.lineWidth = 1.5;
    for (const r of game.routes) {
      if (!game.routeKnown(r)) continue;
      const [ax, ay] = this.toScreen(game.system(r.a).x, game.system(r.a).y, game.system(r.a).z);
      const [bx, by] = this.toScreen(game.system(r.b).x, game.system(r.b).y, game.system(r.b).z);
      ctx.strokeStyle = 'rgba(111,220,150,0.35)';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6fdc96';
    for (const p of [...game.cargo, ...game.ghosts.cargo]) {
      const pos = game.apparentPath(p.path, p.times, p.times[0], p.arrive);
      if (!pos) continue;
      const [px, py] = this.toScreen(pos.x, pos.y, pos.z);
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }

    // 艦隊 (地球の艦隊は選べるように画面上の位置を覚える)
    this.fleetDots = [];
    for (const f of [...game.fleets, ...game.ghosts.fleets]) {
      const p = seenAt((t) => game.fleetPosition(f, t), f.start ?? f.depart, f.arrive);
      if (!p) continue;
      const [px, py] = this.toScreen(p.x, p.y, p.z);
      const fcolor = FLEET_COLOR[realmFleetKind(game, f.owner ?? 0)];
      // 「ありうる今」(B-053): よその国の艦隊は、見えているのは光が出たときの姿。いまはそこから (いちばん速い船の速さ × 光が来るのにかかった年) の内のどこかにいる
      if ((f.owner ?? 0) !== game.cap) this.drawMaybeNow(p, px, py, distance(p, game.system(game.cap)), fcolor);
      if ((f.owner ?? 0) === game.cap) {
        this.fleetDots.push({ id: f.id, x: px, y: py });
        if (this.app.fleetMove.has(f.id)) {
          ctx.strokeStyle = OWN.hex;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
      ctx.fillStyle = fcolor;
      ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 4, py + 3); ctx.lineTo(px - 4, py + 3); ctx.fill();
      // 地球の艦隊は行き先への矢印も描く。行き先は見えている区間のもの (進路を変えた知らせが届くまでは前の行き先。FU1 の seenLeg)
      const legTo = (f.owner ?? 0) === game.cap ? game.seenLeg(f).to : undefined;
      if (legTo !== undefined && legTo !== null) {
        const d = game.system(legTo);
        const [tx, ty] = this.toScreen(d.x, d.y, d.z);
        const ang = Math.atan2(ty - py, tx - px);
        ctx.strokeStyle = f.surprise ? 'rgba(255,90,90,0.6)' : 'rgba(90,169,255,0.5)';
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(tx - 9 * Math.cos(ang - 0.4), ty - 9 * Math.sin(ang - 0.4)); ctx.lineTo(tx, ty); ctx.lineTo(tx - 9 * Math.cos(ang + 0.4), ty - 9 * Math.sin(ang + 0.4)); ctx.stroke();
        // その先の経由地
        if (f.route?.length) {
          ctx.strokeStyle = `rgba(${OWN.rgb},0.45)`;
          ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(tx, ty);
          for (const id of f.route) { const [rx, ry] = this.toScreen(game.system(id).x, game.system(id).y, game.system(id).z); ctx.lineTo(rx, ry); }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 送信中の艦隊への指令 (地球が出した指令なので、出したときから分かっている)
    ctx.font = '12px sans-serif';
    for (const q of game.requests) {
      if (q.kind !== 'order' || (q.act !== 'fleet' && q.act !== 'redirect')) continue;
      const tgt = game.system(Number(q.d.sys));
      const o = q.act === 'fleet' ? game.system(Number(q.d.from)) : { x: q.d.x, y: q.d.y };
      const [ox, oy] = this.toScreen(o.x, o.y, o.z);
      const [tx, ty] = this.toScreen(tgt.x, tgt.y, tgt.z);
      ctx.strokeStyle = 'rgba(170,220,255,0.75)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(ty - oy, tx - ox);
      ctx.beginPath(); ctx.moveTo(tx - 8 * Math.cos(ang - 0.4), ty - 8 * Math.sin(ang - 0.4)); ctx.lineTo(tx, ty); ctx.lineTo(tx - 8 * Math.cos(ang + 0.4), ty - 8 * Math.sin(ang + 0.4)); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.stroke();
      if (q.d.route?.length) {
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(tx, ty);
        for (const id of q.d.route) { const [rx, ry] = this.toScreen(game.system(id).x, game.system(id).y, game.system(id).z); ctx.lineTo(rx, ry); }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    this.drawLightSpheres(game);

    // 建設資材の輸送船
    ctx.fillStyle = '#ffd24d';
    for (const j of [...game.projects, { legs: game.ghosts.legs }]) {
      const legs = j.legs || j.from.map((from) => ({ path: [from, j.sys], times: [j.start, j.start + game.shipYears(from, j.sys)] }));
      for (const l of legs) {
        const pos = game.apparentPath(l.path, l.times, l.times[0], l.times[l.times.length - 1]);
        if (!pos) continue;
        const [px, py] = this.toScreen(pos.x, pos.y, pos.z);
        ctx.beginPath(); ctx.moveTo(px, py - 3); ctx.lineTo(px + 3, py); ctx.lineTo(px, py + 3); ctx.lineTo(px - 3, py); ctx.fill();
      }
    }

    // 光速の通信 (物資移送要求・指令・朝貢・送金)。表示は設定で切り替える:
    // off = 描かない / dots = 見かけの位置に光の点と点線
    const SIGNAL = { build: '255,210,77', trade: '201,162,255', order: '170,220,255', tribute: '160,230,120', grant: '255,215,120' };
    const sigMode = this.app.signalMode;
    for (const q of sigMode === 'dots' ? [...game.requests, ...game.ghosts.requests] : []) {
      const a = game.system(q.from);
      const b = game.system(q.to);
      const color = SIGNAL[q.kind] || SIGNAL.trade;
      const at = (t) => { const f = clamp((t - q.sent) / Math.max(1e-6, q.arrive - q.sent), 0, 1); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * f }; };
      const pos = seenAt(at, q.sent, q.arrive);
      const [ax, ay] = this.toScreen(a.x, a.y, a.z);
      const [bx, by] = this.toScreen(b.x, b.y, b.z);
      if (pos) {
        const [px, py] = this.toScreen(pos.x, pos.y, pos.z);
        ctx.strokeStyle = `rgba(${color},0.35)`;
        ctx.setLineDash([1, 4]);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(px, py); ctx.stroke();
        ctx.setLineDash([]);
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 6);
        glow.addColorStop(0, `rgba(${color},1)`);
        glow.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      } else if (q.kind === 'trade' && q.until === undefined && q.arrive <= game.year && game.departSeen(q.to, q.arrive)) {
        ctx.strokeStyle = `rgba(${color},0.6)`;
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // 移動中の歩兵 (交易路をたどる)
    ctx.fillStyle = '#ff9f8f';
    for (const m of [...game.troopMoves, ...game.ghosts.troopMoves]) {
      const pos = game.apparentPath(m.path, m.times, m.times[0], m.arrive);
      if (!pos) continue;
      const [px, py] = this.toScreen(pos.x, pos.y, pos.z);
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    }

    // 移民船
    ctx.fillStyle = '#8fd3ff';
    for (const m of [...game.migrants, ...game.ghosts.migrants]) {
      if (m.fromSys === m.toSys) continue;
      const pos = m.path ? game.apparentPath(m.path, m.times, m.depart, m.arrive)
        : seenAt((t) => game.shipPosition({ from: m.fromSys, to: m.toSys, depart: m.depart, arrive: m.arrive }, t), m.depart, m.arrive);
      if (!pos) continue;
      const [px, py] = this.toScreen(pos.x, pos.y, pos.z);
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }

    // 入植船
    for (const s of [...game.ships, ...game.ghosts.ships]) {
      const path = s.path || [s.from, s.to];
      const times = s.times || [s.depart, s.arrive];
      const p = game.apparentPath(path, times, times[0], s.arrive);
      if (!p) continue;
      const [px, py] = this.toScreen(p.x, p.y, p.z);
      ctx.strokeStyle = 'rgba(255,170,60,0.45)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      path.forEach((id, i) => { const [x, y] = this.toScreen(game.system(id).x, game.system(id).y, game.system(id).z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // 星
    const scale = clamp(z / 6, 0.8, 2.5);
    const starR = (s) => (1.5 + 1.1 * Math.log10(1 + s.stars[0].lum * 20)) * scale;
    // 星そのもの (光の輪・本体・伴星) は動かないので 1 枚のレイヤーに貯め、視点が止まったときだけ描き直す (動かしているあいだは貼り直すだけ)
    this.viewLayer('stars', w, h, '', (lc, m) => {
      const sc = clamp(this.cam.zoom / 6, 0.8, 2.5);
      for (const s of game.galaxy.systems) {
        const [x, y] = this.toScreen(s.x, s.y, s.z);
        if (x < -m - 20 || y < -m - 20 || x > this.w + m + 20 || y > this.h + m + 20) continue;
        const star = s.stars[0];
        const r = (1.5 + 1.1 * Math.log10(1 + star.lum * 20)) * sc;
        const glow = lc.createRadialGradient(x, y, 0, x, y, r * 3);
        glow.addColorStop(0, star.color);
        glow.addColorStop(0.35, star.color);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        lc.globalAlpha = 0.9;
        lc.fillStyle = glow;
        lc.beginPath(); lc.arc(x, y, r * 3, 0, Math.PI * 2); lc.fill();
        lc.globalAlpha = 1;
        lc.fillStyle = star.color;
        lc.beginPath(); lc.arc(x, y, r, 0, Math.PI * 2); lc.fill();
        if (s.stars.length > 1) {
          lc.fillStyle = s.stars[1].color;
          lc.beginPath(); lc.arc(x + r * 1.1, y - r * 0.9, r * 0.5, 0, Math.PI * 2); lc.fill();
        }
      }
    });
    // 星ごとの表示 (所属の輪・駐留艦隊・戦争・名前など)
    for (const s of game.galaxy.systems) {
      const [x, y] = this.toScreen(s.x, s.y, s.z);
      if (x < -20 || y < -20 || x > this.w + 20 || y > this.h + 20) continue;
      const r = starR(s);
      const k = K(s.id);
      // 情報の古さ: 光が届いてからの年数が長い星系ほど薄く描く (80年で最も薄い 45%)
      const age = s.id === game.cap || game.spectate || !k ? 0 : game.year - k.year;
      ctx.globalAlpha = clamp(1 - age / 80 * 0.55, 0.45, 1);
      if (k && k.cols.length) {
        ctx.strokeStyle = realmColor(s.id === game.cap ? game.realmOf(s.id) : k.realm ?? game.cap);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
      }
      const ships = k ? k.garrison || 0 : 0;
      if (ships) {
        // 駐留艦隊を持ち主の色で: 地球の国の星系は、命令で駐留している分・威圧の分 (と太陽系・無人の星系) が自艦隊、残りは従属艦隊
        const colonized = k.cols && k.cols.length;
        const realm = colonized ? k.realm ?? game.cap : game.cap;
        const parts = [];
        if (realm !== game.cap) parts.push([realmFleetKind(game, realm), ships]);
        else {
          const own = s.id === game.cap || !colonized ? ships : Math.min(ships, (k.held || 0) + (k.awe || 0));
          if (ships - own > 0) parts.push(['vassal', ships - own]);
          if (own > 0) parts.push(['own', own]);
        }
        ctx.font = '12px sans-serif';
        let lx = x - r - 8;
        for (const [kind, n] of parts) {
          const t = `▲${kind === 'own' || kind === 'vassal' ? n : shipsSeen(game, s.id, n)}`;
          lx -= ctx.measureText(t).width;
          ctx.fillStyle = FLEET_COLOR[kind];
          ctx.fillText(t, lx, y + 4);
          lx -= 3;
        }
      }
      if (k && k.siege) {
        const rr = r + 15;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,170,60,0.3)';
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffaa3c';
        ctx.beginPath(); ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.max(0.05, k.siege.progress) * Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffaa3c';
        ctx.fillText(`攻囲 ${Math.round(k.siege.progress * 100)}%`, x + rr + 4, y + rr);
      }
      if (k && k.battle) {
        // 艦隊戦: 点滅する赤い輪と、両軍の残りの比 (左が攻撃側の国の色、右が防衛側)
        const bt = k.battle;
        const rr = r + 15;
        ctx.lineWidth = 2;
        this.animating = true; // 点滅しているので、次のフレームも描き直す
        ctx.strokeStyle = `rgba(255,90,90,${0.45 + 0.35 * Math.sin(performance.now() / 180)})`;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        const w = 44, frac = bt.a / Math.max(1e-6, bt.a + bt.d);
        ctx.fillStyle = realmColor(bt.realm);
        ctx.fillRect(x + rr + 4, y + rr + 4, w * frac, 4);
        ctx.fillStyle = realmColor(k.realm);
        ctx.fillRect(x + rr + 4 + w * frac, y + rr + 4, w * (1 - frac), 4);
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText(`艦隊戦 ${Math.ceil(bt.a)}対${Math.ceil(bt.d)}`, x + rr + 4, y + rr);
      }
      if (k && k.cols.length && k.realm !== null && k.realm !== undefined && this.app.game.knownEnemiesOf(k.realm).length && (k.realm !== game.cap || s.id === game.cap)) {
        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('交戦中', x - r - 34, y - r - 4);
      }
      const wars = k ? k.wars : [];
      if (wars.length) {
        // 征服戦争: 星のまわりの赤い輪が進捗、横に ⚔ と進捗率 (複数の戦争なら最も進んだもの)
        const prog = Math.max(...wars.map((w) => w.progress));
        const rr = r + 11;
        this.animating = true;
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,90,90,0.25)';
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,90,90,${pulse})`;
        ctx.beginPath(); ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.max(0.05, prog) * Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.font = 'bold 12px sans-serif';
        const label = `⚔ ${Math.round(prog * 100)}%${wars.length > 1 ? ` ×${wars.length}` : ''}`;
        ctx.fillStyle = 'rgba(10,14,24,0.85)';
        ctx.fillRect(x + rr + 2, y - rr - 6, ctx.measureText(label).width + 8, 15);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText(label, x + rr + 6, y - rr + 5);
      }
      if (k && k.cols.length) {
        // 資源不足の印 (状態): 飢餓・水不足は赤、工業品・原料の不足は橙の「!」を星の右上に
        let worst = 0;
        for (const c of k.cols) { const a = c.alerts || {}; if (a.food || a.water) worst = 2; else if ((a.goods || a.industry) && worst < 1) worst = 1; }
        if (worst) {
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = worst === 2 ? '#ff6b6b' : '#ffb347';
          ctx.fillText('!', x + r + 3, y - r - 1);
        }
        // 不満の段階 (地球の国の星系): 不満・要求・最後通牒
        const st = k.unrest?.stage || 0;
        if (st && (k.realm ?? game.cap) === game.cap) {
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = st >= 3 ? '#ff6b6b' : st === 2 ? '#ff9f43' : '#f5d142';
          ctx.fillText(UNREST_LABEL[st], x + r + 9, y - r - 1);
        }
      }
      if (game.isSurveyed(s.id) && s.bodies.some((b) => b.natives)) {
        ctx.fillStyle = '#c9a2ff';
        ctx.beginPath(); ctx.arc(x, y + r + 6, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      const labeled = z >= 10 || (k && k.cols.length) || s.id === this.app.sel.sys || s === this.hover;
      if (labeled) {
        ctx.fillStyle = s === this.hover ? '#fff' : 'rgba(200,215,240,0.8)';
        ctx.font = '12px sans-serif';
        ctx.fillText(s.name, x + r + 7, y + 4);
      }
      ctx.globalAlpha = 1;
      if (s.id === this.app.sel.sys) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - r - 8, y - r - 8, (r + 8) * 2, (r + 8) * 2);
      }
    }
    ctx.globalAlpha = 1;

    // 艦隊の選択と移動先のプレビュー (Hearts of Iron 風)
    const fsel = this.app.fleetSel;
    for (const id of fsel) {
      const s = game.system(id);
      const [x, y] = this.toScreen(s.x, s.y, s.z);
      ctx.strokeStyle = OWN.hex;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
    }
    const confirmRoute = this.app.fleetConfirm;
    const target = this.hover && hasFleetSelection() && !fsel.has(this.hover.id) ? this.hover : (confirmRoute?.length === 1 ? game.system(confirmRoute[0]) : null);
    if (target) {
      const [tx, ty] = this.toScreen(target.x, target.y, target.z);
      const surprise = isSurpriseTarget(game, target.id);
      let eta = 0;
      ctx.strokeStyle = surprise ? 'rgba(255,90,90,0.9)' : `rgba(${OWN.rgb},0.85)`;
      ctx.setLineDash([6, 4]);
      for (const id of fsel) {
        if (id === target.id) continue;
        const s = game.system(id);
        const [x, y] = this.toScreen(s.x, s.y, s.z);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
        eta = Math.max(eta, game.lightDelay(id) + game.fleetYears(id, target.id));
      }
      for (const d of this.fleetDots || []) {
        if (!this.app.fleetMove.has(d.id)) continue;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(tx, ty); ctx.stroke();
        const f = game.fleets.find((x) => x.id === d.id);
        const p = f ? game.fleetPosition(f) : null;
        if (p) eta = Math.max(eta, distance(p, game.system(game.cap)) + distance(target, p) / OFFROUTE_SPEED);
      }
      ctx.setLineDash([]);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = surprise ? '#ff8a80' : OWN.hex;
      ctx.fillText(`${surprise ? '奇襲攻撃 ' : '移動 '}到着まで ${eta.toFixed(1)} 年`, tx + 12, ty - 12);
    }
    // 従属マップ: ほかの描画を暗くして、家臣 → 主人 を矢印で結ぶ
    if (this.app.mapMode === 'vassal') this.drawVassals(K);
    // 経由地の線: 長押し中の線引き (指まで矢印) と、確認待ちの経由地
    const drawRoute = (pts, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.lineWidth = 1;
      if (pts.length < 2) return;
      const [x0, y0] = pts[pts.length - 2];
      const [x1, y1] = pts[pts.length - 1];
      const ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1 - 11 * Math.cos(ang - 0.4), y1 - 11 * Math.sin(ang - 0.4)); ctx.lineTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(ang + 0.4), y1 - 11 * Math.sin(ang + 0.4)); ctx.stroke();
    };
    const plan = this.path ? this.path.ids : confirmRoute?.length > 1 ? confirmRoute : null;
    if (plan) {
      const wps = plan.map((id) => this.toScreen(game.system(id).x, game.system(id).y, game.system(id).z));
      const tail = this.path ? [[this.path.x, this.path.y]] : [];
      const danger = plan.some((id) => isSurpriseTarget(game, id));
      const color = danger ? 'rgba(255,110,100,0.95)' : `rgba(${OWN.rgb},0.95)`;
      const sources = [...fsel].map((id) => this.toScreen(game.system(id).x, game.system(id).y, game.system(id).z))
        .concat((this.fleetDots || []).filter((d) => this.app.fleetMove.has(d.id)).map((d) => [d.x, d.y]));
      for (const src of sources) drawRoute([src, ...wps, ...tail], color);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = danger ? '#ff8a80' : OWN.hex;
      wps.forEach(([x, y], i) => ctx.fillText(String(i + 1), x + 9, y - 9));
    }
    if (this.box) {
      const b = this.box;
      ctx.strokeStyle = `rgba(${OWN.rgb},0.9)`;
      ctx.fillStyle = `rgba(${OWN.rgb},0.08)`;
      ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }

    this.drawRings(game);

    // ホバー中の星: 選択星からの距離と、通信 (光速) と船 (0.95c / 交易路の外 0.9c) の所要年数
    if (this.hover && this.hover.id !== sel.id) {
      const d = distance(sel, this.hover);
      const t = game.travelYears(sel.id, this.hover.id);
      const [hx, hy] = this.toScreen(this.hover.x, this.hover.y, this.hover.z);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
      const st = this.hover.stars[0];
      const lines = [this.hover.name, `${st.label}${this.hover.stars.length > 1 ? ` 他${this.hover.stars.length - 1}星` : ''}`,
        `距離 ${d.toFixed(1)} ly (通信 ${t.toFixed(1)} 年・船 ${(game.shipYears(sel.id, this.hover.id) + accelExtra(d, SHIP_SPEED, ACCEL.crew, game.physics)).toFixed(1)}〜${(game.shipYears(sel.id, this.hover.id, false) + accelExtra(d, OFFROUTE_SPEED, ACCEL.crew, game.physics)).toFixed(1)} 年)`,
        `乗っている人の時計では ${shipTime(d, SHIP_SPEED, game.physics).toFixed(1)}〜${shipTime(d, OFFROUTE_SPEED, game.physics).toFixed(1)} 年 (相対論の時間の遅れ)`];
      if (this.app.mapMode === 'vassal') lines.push(...vassalHoverLines(game, this.hover.id));
      const [mx, my] = this.mouse || [hx, hy];
      ctx.font = '12px sans-serif';
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
      const bx = Math.min(mx + 14, this.w - bw - 4);
      const by = Math.min(my + 14, this.h - 60);
      ctx.fillStyle = 'rgba(10,14,24,0.9)';
      const bh = 7 + lines.length * 15;
      const byy = Math.min(by, this.h - bh - 4);
      ctx.fillRect(bx, byy, bw, bh);
      ctx.strokeStyle = '#345';
      ctx.strokeRect(bx, byy, bw, bh);
      ctx.fillStyle = '#dfe8f7';
      lines.forEach((l, i) => ctx.fillText(l, bx + 7, byy + 16 + i * 15));
    }
  }

  // 光の球 (B-052): 自国が出した指令と返事の光は、出した星系から光の速さで球になって広がる (正射影なので球の輪郭は円)。
  // 縁の、行き先の向きの所に「届くまで あと n 年」。光が行き先を越えたら消える
  drawLightSpheres(game) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const list = [];
    for (const q of game.requests) {
      if (q.kind !== 'order' || (q.by ?? 0) !== game.cap || q.arrive <= game.year) continue;
      list.push({ from: q.from, to: q.to, sent: q.sent, arrive: q.arrive, label: `指令「${q.label}」→ ${game.system(q.to).name}`, pred: forecastOf(q.id) });
    }
    for (const d of game.decisions) {
      if (d.state !== 'sent' || d.sentAt === undefined || d.sys === game.cap) continue;
      const arrive = d.sentAt + game.lightDelay(d.sys);
      if (arrive > game.year) list.push({ from: game.cap, to: d.sys, sent: d.sentAt, arrive, label: `返事 → ${game.system(d.sys).name}` });
    }
    if (!list.length) return;
    ctx.save();
    ctx.font = '12px sans-serif';
    // 自分で出した指令 (予想のあるもの) の文字を先に、あとは早く届く順。文字が重なるものは書かない (球は描く)
    list.sort((a, b) => !!b.pred - !!a.pred || a.arrive - b.arrive);
    const boxes = [];
    list.forEach((o, i) => {
      const a = game.system(o.from), b = game.system(o.to);
      const r = Math.max(0, game.year - o.sent); // 光年 (光は 1 年に 1 光年)
      const [ax, ay] = this.toScreen(a.x, a.y, a.z);
      const glow = ctx.createRadialGradient(ax, ay, Math.max(0, r * z - 14), ax, ay, r * z);
      glow.addColorStop(0, 'rgba(170,220,255,0)');
      glow.addColorStop(1, 'rgba(170,220,255,0.10)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(ax, ay, r * z, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(170,220,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ax, ay, r * z, 0, Math.PI * 2); ctx.stroke();
      const k = clamp(r / Math.max(1e-6, distance(a, b)), 0, 1);
      const [ex, ey] = this.toScreen(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, (a.z || 0) + ((b.z || 0) - (a.z || 0)) * k);
      ctx.fillStyle = '#aadcff';
      ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill();
      if (i >= 4) return; // 文字は 4 つまで
      const text = `${o.label} 届くまで あと ${Math.max(0, o.arrive - game.year).toFixed(1)} 年${o.pred?.short ? `・${o.pred.short}` : ''}`;
      const box = { x: ex + 6, y: ey - 18, w: ctx.measureText(text).width, h: 16 };
      if (boxes.some((q) => box.x < q.x + q.w && q.x < box.x + box.w && box.y < q.y + q.h && q.y < box.y + box.h)) return;
      boxes.push(box);
      ctx.fillText(text, ex + 6, ey - 6);
    });
    ctx.restore();
  }
  // 「ありうる今」の雲: (px, py) は最後に見えた位置、age は光が来るのにかかった年。半径 = いちばん速い船の速さ × age
  drawMaybeNow(p, px, py, age, color) {
    if (age < 0.5) return;
    const { ctx } = this;
    const R = Math.max(SHIP_SPEED, OFFROUTE_SPEED) * age * this.cam.zoom;
    if (R < 6) return;
    ctx.save();
    const g = ctx.createRadialGradient(px, py, 0, px, py, R);
    g.addColorStop(0, `${color}33`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `${color}40`;
    ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // 節目の光の輪 (B-046): 入植・交易路の開通・独立・講和の知らせが届いた星系から、輪が広がって消える (2.4 秒)。
  // 自国の節目は太く大きく (音も鳴らす)、よその国の節目は細く小さく。ゲームを開いたときやロードしたときに届いていたものは出さない
  drawRings(game) {
    const now = performance.now();
    const fresh = milestonesNew(game, now);
    for (const m of fresh) if (m.own && !m.quiet) Sound.play(m.kind);
    const rings = (this.rings || []).concat(fresh.filter((m) => RING_COLOR[m.kind])).filter((r) => now - r.t < RING_MS);
    this.rings = rings;
    if (!rings.length) return;
    const { ctx } = this;
    ctx.save();
    for (const r of rings) {
      const s = game.system(r.sys);
      if (!s) continue;
      const [x, y] = this.toScreen(s.x, s.y, s.z);
      const k = (now - r.t) / RING_MS; // 0 → 1
      const ease = 1 - (1 - k) * (1 - k);
      ctx.strokeStyle = RING_COLOR[r.kind];
      for (const lag of r.own ? [0, 0.18] : [0]) { // 自国の節目は 2 重の輪
        const kk = Math.max(0, ease - lag);
        if (kk <= 0) continue;
        ctx.globalAlpha = (1 - k) * (r.own ? 0.9 : 0.45);
        ctx.lineWidth = r.own ? 2.5 : 1;
        ctx.beginPath(); ctx.arc(x, y, 6 + kk * (r.own ? 110 : 36), 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
    this.animating = true; // 輪が広がっているあいだは毎コマ描く
  }

  // 従属マップ: 地球に届いている情報で、入植星系を点で描き、家臣から主人へ矢印を引く。
  // 色は国ごとの色から始まり、従属の深さ (首都=0、直属=1、その家臣=2…) ごとに色相がずれていくグラデーション。
  // 矢印も家臣の色から主人の色へのグラデーション。国の首都 (主人のいない星系) は太い輪。
  // 忠誠度20未満で友好度も50未満 (独立のおそれ) の家臣は、破線の矢印と赤い輪
  drawVassals(K) {
    const { ctx } = this;
    const game = this.app.game;
    ctx.fillStyle = 'rgba(6,9,16,0.9)';
    ctx.fillRect(0, 0, this.w, this.h);
    const nodes = [];
    for (const sx of game.knownSystems()) {
      const k = K(sx.id);
      if (!k || !k.cols.length) continue;
      nodes.push({ s: sx, k, realm: k.realm ?? game.cap, lord: sx.id === game.cap ? (game.gov(sx.id).lord ?? null) : k.lord ?? null, p: this.toScreen(sx.x, sx.y, sx.z) });
    }
    // 従属の深さ: 主人をたどって首都 (主人なし) に着くまでの段数
    const byId = new Map(nodes.map((n) => [n.s.id, n]));
    const depthOf = (n) => {
      let d = 0;
      for (let x = n; x && x.lord !== null && d < 20; x = byId.get(x.lord)) d++;
      return d;
    };
    for (const n of nodes) { n.depth = depthOf(n); n.color = vassalDepthColor(n.realm, n.depth); }
    const R = 6;
    for (const n of nodes) {
      if (n.lord === null) continue;
      const ls = game.system(n.lord);
      const [x0, y0] = n.p;
      const [x1, y1] = this.toScreen(ls.x, ls.y, ls.z);
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 2 * R + 6) continue;
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      const ax = x0 + ux * (R + 2), ay = y0 + uy * (R + 2);
      const bx = x1 - ux * (R + 5), by = y1 - uy * (R + 5);
      const risk = (n.k.unrest?.stage || 0) >= 1; // 不満・要求・最後通牒の家臣
      const lordColor = byId.get(n.lord)?.color ?? vassalDepthColor(n.realm, Math.max(0, n.depth - 1));
      const grad = ctx.createLinearGradient(ax, ay, bx, by);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, lordColor);
      ctx.strokeStyle = grad;
      ctx.fillStyle = lordColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(risk ? [6, 4] : []);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - ux * 6, by - uy * 6); ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(uy, ux);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 11 * Math.cos(ang - 0.42), by - 11 * Math.sin(ang - 0.42));
      ctx.lineTo(bx - 11 * Math.cos(ang + 0.42), by - 11 * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    for (const n of nodes) {
      const [x, y] = n.p;
      const color = n.color;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, n.lord === null ? R : R - 1, 0, Math.PI * 2); ctx.fill();
      if (n.lord !== null && (n.k.unrest?.stage || 0) >= 1) {
        ctx.strokeStyle = '#ff5a5a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, R + 2, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (n.lord === null) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, R + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }
      ctx.fillStyle = n.lord === null ? '#ffffff' : '#c8d4e8';
      ctx.font = n.lord === null ? 'bold 12px sans-serif' : '11px sans-serif';
      ctx.fillText(n.s.name, x + R + 5, y - R - 2);
    }
    // 説明
    const narrow = this.w < 560;
    const lines = narrow ? ['従属マップ', '矢印: 家臣 → 主人', '太い輪: 首都・破線と赤い輪: 独立のおそれ']
      : [`従属マップ (${ME.home}に届いている情報)`, '矢印: 家臣 → 主人 ・ 色: 国ごとの色から従属の深さでずれる', '太い輪: 国の首都 ・ 破線と赤い輪: 不満を抱える家臣 (不満・要求・最後通牒)'];
    ctx.font = '12px sans-serif';
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width), 250) + 16;
    const bh = 17 + lines.length * 16 + 18;
    const bx = narrow ? this.w - bw - 8 : 8, by = 8;
    ctx.fillStyle = 'rgba(10,14,24,0.9)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#345';
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#dfe8f7';
    lines.forEach((l, i) => ctx.fillText(l, bx + 8, by + 17 + i * 16));
    // 深さのグラデーションの見本 (地球の国の色で): 首都 → 直属 → 2次 → 3次 → 4次以下
    const sy = by + 17 + lines.length * 16 + 2;
    const labels = ['首都', '直属', '2次', '3次', '4次〜'];
    let sx = bx + 8;
    for (let d = 0; d < labels.length; d++) {
      ctx.fillStyle = vassalDepthColor(0, d);
      ctx.beginPath(); ctx.arc(sx + 5, sy - 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8d4e8';
      ctx.fillText(labels[d], sx + 13, sy);
      sx += 13 + ctx.measureText(labels[d]).width + 10;
    }
  }
}

// 従属マップの色: 国の色 (首都) から、従属の深さ1段ごとに色相を38度ずらす (4段まで)
function vassalDepthColor(realm, depth) {
  const hex = realmColor(realm);
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  const hue = (h + 38 * Math.min(depth, 4) + 360) % 360;
  return `hsl(${hue.toFixed(0)}, ${depth ? 85 : 75}%, ${depth ? 64 : 60}%)`;
}

// 従属マップのホバー: 主人・家臣の数・忠誠度など (地球に届いている情報)
function vassalHoverLines(g, id) {
  const k = id === g.cap ? g.snapshot(id) : g.known(id);
  if (!k || !k.cols.length) return [];
  const realm = k.realm ?? 0;
  const lord = id === g.cap ? (g.gov(id).lord ?? null) : k.lord ?? null;
  const vassals = g.knownSystems().filter((x) => x.id !== id && x.id !== g.cap && g.known(x.id)?.cols.length && g.known(x.id).lord === id).length;
  const out = [`${realm === g.cap ? `${ME.realm}` : `${g.realmName(realm)}`}${lord === null ? ' の首都' : ''}・家臣 ${vassals}`];
  let depth = 0;
  for (let l = lord; l !== null && l !== undefined && depth < 20; l = l === g.cap ? null : g.known(l)?.lord ?? null) depth++;
  if (lord !== null) out.push(`主人: ${g.system(lord).name} (${depth === 1 ? '直属' : `${depth}次の家臣`}) ・ 忠誠度 ${Math.round(k.loyalty ?? LOYALTY_START)}・恐怖度 ${Math.round(k.fear || 0)}・友好度 ${Math.round(k.friend || 0)}`);
  return out;
}

// 星系マップ: 恒星・伴星・惑星・小惑星帯を軌道上に表示。軌道半径は対数スケール。




const A0 = 0.05; // 対数スケールの基準[AU]

