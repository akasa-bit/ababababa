class SystemView {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;
    this.ctx = canvas.getContext('2d');
    this.hit = [];
    this.hover = null;
    // 視点: 倍率と、画面の中心からのずれ [px]。別の星系を開くと全体表示に戻る
    this.cam = { zoom: 1, x: 0, y: 0 };
    this.camSys = null;
    this.w = this.h = 1;
    this.bind();
  }

  // 画面上の点 (sx, sy) の下にあるものを動かさずに拡大・縮小する
  zoomAt(factor, sx, sy) {
    const c = this.cam, cx = this.w / 2 + c.x, cy = this.h / 2 + c.y;
    const z = clamp(c.zoom * factor, 0.6, 40);
    c.x = sx - this.w / 2 - ((sx - cx) * z) / c.zoom;
    c.y = sy - this.h / 2 - ((sy - cy) * z) / c.zoom;
    c.zoom = z;
  }
  fit() { this.cam = { zoom: 1, x: 0, y: 0 }; }

  // マウス・タッチ共通: 1本指 (左ボタン) でドラッグ移動、2本指でピンチ、ホイールで拡大・縮小、タップで天体を選ぶ
  bind() {
    const c = this.canvas, app = this.app;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const pts = new Map();
    let pinch = null, drag = null;
    c.addEventListener('pointerdown', (e) => {
      if (app.view !== 'system' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pts.set(e.pointerId, pos(e));
      try { c.setPointerCapture(e.pointerId); } catch { /* 合成されたイベントなど */ }
      if (pts.size === 1) {
        const [x, y] = pos(e);
        drag = { x, y, cx: this.cam.x, cy: this.cam.y, moved: false };
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), zoom: this.cam.zoom, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, x: this.cam.x, y: this.cam.y };
        if (drag) drag.moved = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (app.view !== 'system') return;
      const [x, y] = pos(e);
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
      if (pinch && pts.size === 2) {
        // ピンチを始めたとき指の中点の下にあった地点が、いまの中点の下に来るようにする (指に貼りついて動く)
        const [a, b] = [...pts.values()];
        const z = clamp((pinch.zoom * Math.hypot(a[0] - b[0], a[1] - b[1])) / pinch.d, 0.6, 40);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, k = z / pinch.zoom;
        this.cam.x = mx - this.w / 2 - (pinch.mx - this.w / 2 - pinch.x) * k;
        this.cam.y = my - this.h / 2 - (pinch.my - this.h / 2 - pinch.y) * k;
        this.cam.zoom = z;
        return;
      }
      if (drag && pts.has(e.pointerId)) {
        const dx = x - drag.x, dy = y - drag.y;
        if (Math.hypot(dx, dy) > 6) drag.moved = true;
        if (drag.moved) { this.cam.x = drag.cx + dx; this.cam.y = drag.cy + dy; }
      }
      if (e.pointerType === 'mouse') {
        this.hover = this.pick(x, y);
        c.style.cursor = this.hover ? 'pointer' : drag?.moved ? 'grabbing' : 'default';
      }
    });
    const end = (e) => {
      if (app.view !== 'system' || !pts.has(e.pointerId)) return;
      const [x, y] = pos(e);
      const wasPinch = pts.size > 1;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      // ピンチから1本指に戻ったら、残った指でそのままドラッグを続ける
      if (wasPinch && pts.size === 1) { const [rx, ry] = [...pts.values()][0]; drag = { x: rx, y: ry, cx: this.cam.x, cy: this.cam.y, moved: true }; }
      if (drag && !drag.moved && !wasPinch && e.type === 'pointerup') { const b = this.pick(x, y); app.selectBody(b ? b.id : null); }
      if (pts.size === 0) drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      if (app.view !== 'system') return;
      e.preventDefault();
      const [x, y] = pos(e);
      this.zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
    }, { passive: false });
  }

  pick(x, y) {
    let best = null;
    let bd = Infinity;
    for (const h of this.hit) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < Math.max(h.r + 5, 10) && d < bd) { bd = d; best = h.body; }
    }
    return best;
  }

  draw(w, h) {
    const { ctx } = this;
    const game = this.app.game;
    const sys = game.system(this.app.sel.sys);
    if (this.camSys !== sys.id) { this.camSys = sys.id; this.fit(); }
    this.w = w; this.h = h;
    const z = this.cam.zoom;
    const cx = w / 2 + this.cam.x;
    const cy = h / 2 + this.cam.y;
    const outer = Math.max(...sys.bodies.map((b) => b.a), ...sys.stars.map((s) => s.sep), 1);
    const aMax = outer * 1.15;
    // 軌道半径は対数スケール。倍率をかけるのは位置だけで、天体の印や文字の大きさは変えない
    const rBase = Math.min(w, h) * 0.46;
    const rMax = rBase * z;
    const R = (a) => (a <= 0 ? 0 : z * (22 + ((rBase - 22) * Math.log(1 + a / A0)) / Math.log(1 + aMax / A0)));
    const primary = sys.stars[0];
    this.hit = [];

    // ハビタブルゾーンと雪線
    const hz = habitableZone(primary);
    if (!primary.wd && R(hz.inner) < rMax) {
      ctx.fillStyle = 'rgba(70,200,110,0.10)';
      ctx.beginPath();
      ctx.arc(cx, cy, R(hz.outer), 0, Math.PI * 2);
      ctx.arc(cx, cy, R(hz.inner), 0, Math.PI * 2, true);
      ctx.fill();
      ctx.fillStyle = 'rgba(110,220,150,0.7)';
      ctx.font = '10px sans-serif';
      ctx.fillText('ハビタブルゾーン', cx + R(hz.outer) * 0.7 + 4, cy - R(hz.outer) * 0.7);
    }
    const fl = frostLine(primary);
    if (R(fl) < rMax) {
      ctx.strokeStyle = 'rgba(140,200,255,0.35)';
      ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, R(fl), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(140,200,255,0.55)';
      ctx.font = '10px sans-serif';
      ctx.fillText('雪線', cx - R(fl) * 0.7 - 24, cy - R(fl) * 0.7);
    }

    // 軌道リング
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(150,170,210,0.2)';
    for (const b of [...sys.bodies, ...sys.stars.slice(1).map((s) => ({ a: s.sep }))]) {
      ctx.beginPath(); ctx.arc(cx, cy, R(b.a), 0, Math.PI * 2); ctx.stroke();
    }

    // 恒星
    const drawStar = (star, x, y, big) => {
      const r = big ? clamp(7 + 5 * Math.log10(1 + star.radius * 3), 6, 22) : clamp(4 + 4 * Math.log10(1 + star.radius * 3), 4, 14);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
      g.addColorStop(0, star.color);
      g.addColorStop(0.3, star.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = star.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      this.hit.push({ x, y, r, body: star });
      ctx.fillStyle = 'rgba(210,225,250,0.85)';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${star.name} (${star.label})`, x + r + 6, y - r - 2);
      this.mark(star, x, y, r);
    };
    drawStar(primary, cx, cy, true);
    for (const s of sys.stars.slice(1)) {
      const ang = s.phase + (2 * Math.PI * game.year) / (Math.sqrt(s.sep ** 3 / (primary.mass + s.mass)) || 1);
      drawStar(s, cx + R(s.sep) * Math.cos(ang), cy + R(s.sep) * Math.sin(ang), false);
    }

    // 惑星・小惑星帯
    for (const b of sys.bodies) {
      const ang = b.phase + (2 * Math.PI * game.year) / b.period;
      const rr = R(b.a);
      const x = cx + rr * Math.cos(ang);
      const y = cy + rr * Math.sin(ang);
      let r;
      if (b.type === 'belt') {
        r = 7;
        ctx.strokeStyle = 'rgba(160,150,140,0.55)';
        ctx.lineWidth = 4;
        ctx.setLineDash([1, 5]);
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        const bx = cx + rr * Math.cos(b.phase);
        const by = cy + rr * Math.sin(b.phase);
        this.hit.push({ x: bx, y: by, r, body: b });
        this.label(b, bx, by, 4);
        this.mark(b, bx, by, 5);
        continue;
      }
      r = 3 + 5 * Math.log10(1 + b.radius);
      ctx.fillStyle = bodyColor(b);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (b.type === 'gas-giant' || b.type === 'ice-giant') {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.3); ctx.lineTo(x + r, y - r * 0.3); ctx.moveTo(x - r, y + r * 0.35); ctx.lineTo(x + r, y + r * 0.35); ctx.stroke();
      }
      this.hit.push({ x, y, r, body: b });
      this.label(b, x, y, r);
      this.mark(b, x, y, r);
    }
  }

  label(b, x, y, r) {
    const { ctx } = this;
    ctx.fillStyle = b === this.hover || b.id === this.app.sel.body ? '#fff' : 'rgba(190,205,230,0.7)';
    ctx.font = '11px sans-serif';
    ctx.fillText(b.name.replace(/^.* (?=[a-z]$)/, ''), x + r + 4, y + 4);
  }

  // 入植地・選択状態の表示
  mark(b, x, y, r) {
    const { ctx } = this;
    const game = this.app.game;
    const sys = this.app.sel.sys;
    if (b.id === this.app.sel.body) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    if (b.natives && game.isSurveyed(sys)) {
      ctx.strokeStyle = '#c9a2ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
    }
    const war = game.knownWars(sys).find((w) => w.body === b.id);
    if (war) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,90,90,0.25)';
      ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.max(0.05, war.progress) * Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 11px sans-serif';
      const wi = iconImg('war', '#ff6b6b');
      if (wi) ctx.drawImage(wi, x + r + 9, y - r - 15, 12, 12);
      ctx.fillText(`${wi ? '' : '⚔ '}${Math.round(war.progress * 100)}%`, x + r + (wi ? 23 : 10), y - r - 4);
    }
    if (game.knownOutposts(sys).some((o) => o.body === b.id)) {
      const oi = iconImg('outpost', '#ffb347');
      if (oi) ctx.drawImage(oi, x - r - 15, y - r - 11, 12, 12);
      else { ctx.fillStyle = '#ffb347'; ctx.font = '10px sans-serif'; ctx.fillText('⛏', x - r - 12, y - r); }
    }
    if (game.knownColonyAt(sys, b.id, 'planet')) {
      const ci = iconImg('planetcol', OWN.hex);
      if (ci) ctx.drawImage(ci, x - 6, y - r - 15, 12, 12);
      else { ctx.fillStyle = OWN.hex; ctx.beginPath(); ctx.moveTo(x, y - r - 9); ctx.lineTo(x + 4, y - r - 3); ctx.lineTo(x - 4, y - r - 3); ctx.fill(); }
    }
    if (game.knownColonyAt(sys, b.id, 'station')) {
      const si = iconImg('station', '#ffd24d');
      if (si) ctx.drawImage(si, b.cls ? x - r - 13 : x + r + 1, y - r - 12, 12, 12); // 恒星は名前が右上にあるので左上に
      else { ctx.fillStyle = '#ffd24d'; ctx.fillRect(x + r + 2, y - r - 6, 5, 5); }
    }
    if (game.ships.some((x) => x.to === sys && x.body === b.id && game.departSeen(x.from, x.depart))) {
      ctx.strokeStyle = '#ffb347';
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// 右サイドパネル(星/天体の詳細と入植船の発進)のHTML生成。




const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

