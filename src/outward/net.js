// --- ネット対戦 (WebRTC。サーバーを置かず、招待コードと返事コードを手で渡し合ってつなぐ) ---
// ロックステップ: 時間を進めるのはホストだけ。ホストは 1 コマごとに「そのコマで実行する命令と、進める年数」を全員に送り、
// どの端末も同じ順に「命令を実行 → advance(年数)」をくり返す。試合の乱数もシードから続く 1 本なので、全員が同じ結果になる。
// ずれを見つけるため、ときどき状態の要約 (ハッシュ) を添える。合わなければ、ホストの状態をまるごと受け取って合わせ直す
const NET_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
const NET_CHUNK = 60000; // データチャネルの 1 通の大きさの上限より小さく切って送る
const NET_HASH_EVERY = 120; // 何コマごとに状態の要約を添えるか
const Net = {
  on: false, role: null, pi: 0, k: 0,
  peers: [], // ホスト: 参加者ごとの { pi, pc, dc, state, offer }。参加者: ホストへの 1 本
  queue: [], inbox: [], parts: {}, resyncs: 0, status: '',
  async pack(o) {
    const t = JSON.stringify(o);
    if (typeof CompressionStream === 'undefined') return `J${btoa(unescape(encodeURIComponent(t)))}`;
    const buf = await new Response(new Blob([t]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    let bin = '';
    for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
    return `Z${btoa(bin)}`;
  },
  async unpack(code) {
    const c = code.replace(/\s+/g, '');
    if (c[0] === 'J') return JSON.parse(decodeURIComponent(escape(atob(c.slice(1)))));
    const bytes = Uint8Array.from(atob(c.slice(1)), (ch) => ch.charCodeAt(0));
    return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());
  },
  // 候補 (ICE) が出そろうまで待つ (STUN に届かない環境でも先へ進めるように、最長 4 秒)
  iceDone(pc) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, 4000);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  },
  send(peer, o) {
    if (!peer.dc || peer.dc.readyState !== 'open') return;
    const t = JSON.stringify(o);
    if (t.length <= NET_CHUNK) return peer.dc.send(t);
    const id = Math.random().toString(36).slice(2);
    const n = Math.ceil(t.length / NET_CHUNK);
    for (let i = 0; i < n; i++) peer.dc.send(JSON.stringify({ t: 'part', id, i, n, s: t.slice(i * NET_CHUNK, (i + 1) * NET_CHUNK) }));
  },
  wire(peer, dc) {
    peer.dc = dc;
    dc.onopen = () => { peer.state = 'つながった'; this.render(); };
    dc.onclose = () => this.lost(peer);
    dc.onmessage = (e) => {
      let m = JSON.parse(e.data);
      if (m.t === 'part') {
        const p = (this.parts[m.id] ??= []);
        p[m.i] = m.s;
        if (p.filter((x) => x !== undefined).length < m.n) return;
        delete this.parts[m.id];
        m = JSON.parse(p.join(''));
      }
      this.receive(peer, m);
    };
  },
  // --- ホスト ---
  openHost() {
    const g = app.game;
    this.role = 'host';
    this.pi = g.pi;
    this.peers = g.players.map((p, i) => ({ pi: i, cap: p.cap })).filter((p, i) => g.players[i].human && i !== this.pi).map((p) => ({ ...p, state: 'まだ' }));
    this.render();
  },
  async makeOffer(peer) {
    peer.pc?.close();
    const pc = new RTCPeerConnection({ iceServers: NET_ICE });
    peer.pc = pc;
    this.wire(peer, pc.createDataChannel(STORE, { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await this.iceDone(pc);
    peer.offer = await this.pack({ t: 'o', ed: EDITION, sdp: pc.localDescription.sdp, pi: peer.pi, cap: peer.cap });
    peer.state = '招待コードを渡して、返事を待っている';
    this.render();
  },
  async takeAnswer(peer, code) {
    try {
      const d = await this.unpack(code);
      if (d.t !== 'a') throw new Error();
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
      peer.state = 'つないでいる…';
    } catch { peer.state = '返事コードが読めなかった'; }
    this.render();
  },
  start() {
    const g = app.game;
    // つながらなかった国は AI に任せる
    for (const p of this.peers) if (p.dc?.readyState !== 'open') g.players[p.pi].human = false;
    this.peers = this.peers.filter((p) => p.dc?.readyState === 'open');
    this.on = true;
    this.k = 0;
    if (this.room) Cloud.closeRoom();
    for (const p of this.peers) this.sendState(p);
    $('netbox').hidden = true;
    uiNote(`ネット対戦を始めた (${this.peers.length + 1} 人)。速さはホストが決める`);
    setSpeed(SPEEDS[1]);
    app.dirty = true;
  },
  sendState(peer) { this.send(peer, { t: 'init', pi: peer.pi, k: this.k, save: buildSave(app.game) }); },
  // --- 参加者 ---
  async join(code) {
    let d;
    try { d = await this.unpack(code); if (d.t !== 'o') throw new Error(); } catch { this.status = '招待コードが読めなかった'; return this.render(); }
    if ((d.ed || 'game') !== EDITION) { this.status = `招待コードは${EDITION_LABEL[d.ed || 'game']}のもの。同じ版どうしでしかつなげない`; return this.render(); }
    this.role = 'guest';
    this.pi = d.pi;
    const peer = { pi: 0, state: 'つないでいる…' };
    this.peers = [peer];
    const pc = new RTCPeerConnection({ iceServers: NET_ICE });
    peer.pc = pc;
    pc.ondatachannel = (e) => this.wire(peer, e.channel);
    await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await this.iceDone(pc);
    peer.answer = await this.pack({ t: 'a', sdp: pc.localDescription.sdp });
    this.status = '返事コードをホストに渡してください。つながったら、ホストが始めるのを待つ';
    this.render();
  },
  // --- 通信 ---
  receive(peer, m) {
    if (this.role === 'host') {
      if (m.t === 'c') this.queue.push({ p: peer.pi, a: m.a, d: m.d });
      else if (m.t === 'resync') { this.resyncs++; this.sendState(peer); }
      else if (m.t === 'speed') { setSpeed(SPEEDS.includes(m.v) ? m.v : 0); uiNote(`${app.game.realmName(app.game.players[peer.pi].cap)}が速さを変えた`); }
      return;
    }
    if (m.t === 'init') return this.applyState(m);
    if (m.t === 'f') this.inbox.push(m);
  },
  applyState(m) {
    loadSave(m.save);
    const g = app.game;
    g.pi = this.pi = m.pi;
    this.k = m.k;
    this.inbox = this.inbox.filter((f) => f.k > m.k);
    if (!this.on) {
      this.on = true;
      closeHome(0);
      $('netbox').hidden = true;
      app.selectSystem(g.cap);
      galaxyView.centerOn(g.system(g.cap));
      this.toast(`${ME.realm}としてネット対戦に参加した。速さはホストが決める`);
    }
    app.dirty = true;
  },
  issue(act, d) {
    const c = JSON.parse(JSON.stringify({ a: act, d: d || {} }));
    if (this.role === 'host') this.queue.push({ p: this.pi, ...c });
    else this.send(this.peers[0], { t: 'c', ...c });
    return { ok: true, queued: true };
  },
  // 状態の要約: プレイヤーごとに違う値 (いま操作しているプレイヤーと、その国の資金・政治力などの写し) と、端末ごとの値を除いたセーブの FNV-1a
  hash() {
    const d = { ...buildSave(app.game) };
    for (const k of ['pi', 'savedAt', 'endShown', 'spectate', 'credits', ...PLAYER_KEYS]) delete d[k];
    const t = JSON.stringify(d);
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  },
  apply(f) {
    const g = app.game;
    for (const c of f.c) runCmd(g, c.p, c.a, c.d);
    // 時間は、どの端末でも 1 人目のプレイヤーの立場で進める (記録に残る「見えた年」などを端末ごとに変えないため)
    if (f.y) g.asPlayer(0, () => g.advance(f.y));
    this.k = f.k;
  },
  // 毎画面の更新ごとに呼ぶ。ホストはコマを作って送り、参加者は届いたコマを順に実行する
  frame(dt) {
    if (this.role === 'host') {
      const y = app.speed ? dt * app.speed : 0;
      if (!y && !this.queue.length) return false;
      const f = { t: 'f', k: this.k + 1, c: this.queue.splice(0), y, s: app.speed };
      this.apply(f);
      if (f.k % NET_HASH_EVERY === 0) f.h = this.hash();
      for (const p of this.peers) this.send(p, f);
      return true;
    }
    const t0 = performance.now();
    let n = 0;
    while (this.inbox.length && performance.now() - t0 < 40) {
      const f = this.inbox.shift();
      this.apply(f);
      n++;
      if (f.s !== undefined && f.s !== app.speed) { app.speed = f.s; updateSpeedButtons(); }
      if (f.h && f.h !== this.hash()) {
        // ずれた: 届いているコマは捨て、ホストの状態をもらい直す
        this.inbox = [];
        this.resyncs++;
        this.send(this.peers[0], { t: 'resync', k: f.k });
        this.toast('ホストとずれたので、状態を合わせ直している');
        break;
      }
    }
    return n > 0;
  },
  lost(peer) {
    if (this.role === 'host') {
      if (!this.on) { peer.state = '切れた'; return this.render(); }
      this.peers = this.peers.filter((p) => p !== peer);
      this.queue.push({ p: peer.pi, a: 'drop', d: {} });
      uiNote(`${app.game.realmName(peer.cap)}との接続が切れた。この国は AI が動かす`);
      return;
    }
    if (!this.on) { this.status = '接続が切れた'; return this.render(); }
    this.on = false;
    const g = app.game;
    g.players.forEach((p, i) => { if (i !== this.pi) p.human = false; });
    setSpeed(0);
    uiNote('ホストとの接続が切れた。ここからはひとりで続けられる (ほかの国は AI)');
  },
  toast(text) {
    let el = $('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { el.hidden = true; }, 4000);
  },
  // --- 画面 ---
  render() {
    const box = $('netbox');
    box.hidden = false;
    const g = app.game;
    const copyBtn = (id) => `<button data-net="copy" data-id="${id}">コピー</button>`;
    if (this.on) {
      box.innerHTML = `<div class="card"><h2>ネット対戦</h2><p>${esc(ME.realm)}として${this.role === 'host' ? 'ホストをしている' : '参加している'} (${this.role === 'host' ? this.peers.length + 1 : '?'} 人)。コマ ${this.k}・合わせ直し ${this.resyncs} 回</p>
        <p class="note">${this.role === 'host' ? '速さはホストが決める。' : '速さのボタンを押すと、ホストに頼む。'}ネット対戦のあいだは、ホーム画面の新しいゲーム・ロードは使えない。</p><button data-net="close">閉じる</button></div>`;
      return;
    }
    // アカウント (Firebase) があれば、部屋のコードだけでつなげる
    const cloudNote = Cloud.status ? `<p class="muted">${esc(Cloud.status)}</p>` : '';
    const roomHost = !Cloud.available() ? '' : !Cloud.user ? '<p class="note">アカウントにログインすると (ホーム画面 → アカウント)、部屋のコードを伝えるだけでつなげる。</p>'
      : this.room ? `<section><h3>部屋のコード <b class="roomcode">${esc(this.room.code)}</b></h3><p class="note">このコードを相手に伝える。相手が「部屋に入る」でコードを入れると、自動でつながる。</p>${cloudNote}</section>`
      : `<section><div class="row"><button class="big" data-net="room">部屋を作る (コードだけでつなぐ)</button></div><p class="note">${esc(Cloud.name())}としてログインしている。下の招待コードを手で渡す方法も使える。</p>${cloudNote}</section>`;
    const roomGuest = !Cloud.available() ? '' : !Cloud.user ? '<p class="note">アカウントにログインすると (ホーム画面 → アカウント)、部屋のコードだけで参加できる。</p>'
      : `<section><h3>部屋に入る</h3><div class="row"><input id="netroom" maxlength="8" autocapitalize="characters" placeholder="部屋のコード (6 文字)"><button data-net="roomjoin">部屋に入る</button></div>${cloudNote}<p class="note">ホストから部屋のコードをもらっていなければ、下の招待コードを貼る方法も使える。</p></section>`;
    if (this.role === 'host') {
      const ready = this.peers.filter((p) => p.dc?.readyState === 'open').length;
      box.innerHTML = `<div class="card"><h2>ネット対戦 (ホスト)</h2>${roomHost}
        ${this.room ? '' : `<p class="note">相手ごとに「招待コードを作る」→ コードを相手に渡す (メッセージアプリなどで) → 相手が作った返事コードを下に貼って「つなぐ」。全員つながったら「はじめる」。あなたは <b>${esc(g.realmName(g.cap))}</b>。</p>`}
        ${this.peers.map((p, i) => `<section><h3>${esc(g.realmName(p.cap))}${p.guest ? ` — ${esc(p.guest)}` : ''} <span class="muted">${esc(p.state)}</span></h3>
          ${p.dc?.readyState === 'open' || this.room ? '' : `<div class="row"><button data-net="offer" data-i="${i}">招待コードを作る</button>${p.offer ? copyBtn(`netoffer${i}`) : ''}</div>
          ${p.offer ? `<textarea id="netoffer${i}" readonly rows="3">${esc(p.offer)}</textarea>
          <textarea id="netans${i}" rows="3" placeholder="相手の返事コードを貼る"></textarea><button data-net="answer" data-i="${i}">つなぐ</button>` : ''}`}</section>`).join('')}
        <div class="row"><button class="big" data-net="start">はじめる (${ready + 1} 人${ready < this.peers.length ? '・つながっていない国は AI' : ''})</button><button data-net="close" class="ghost">閉じる</button></div></div>`;
      return;
    }
    const peer = this.peers[0];
    if (this.room && this.role === 'guest') { // 部屋のコードで入った: 手で渡すコードは要らない
      box.innerHTML = `<div class="card"><h2>ネット対戦に参加</h2><p>${esc(this.status)}${peer ? ` <span class="muted">(${esc(peer.state)})</span>` : ''}</p>${cloudNote}<div class="row"><button data-net="close" class="ghost">閉じる</button></div></div>`;
      return;
    }
    box.innerHTML = `<div class="card"><h2>ネット対戦に参加</h2>${roomGuest}
      <p class="note">ホストからもらった招待コードを貼って「返事コードを作る」。できた返事コードをホストに渡す。</p>
      <textarea id="netinvite" rows="3" placeholder="招待コードを貼る"></textarea><div class="row"><button data-net="join">返事コードを作る</button><button data-net="close" class="ghost">閉じる</button></div>
      ${peer?.answer ? `<h3>返事コード ${copyBtn('netanswer')}</h3><textarea id="netanswer" readonly rows="3">${esc(peer.answer)}</textarea>` : ''}
      <p class="muted">${esc(this.status)}${peer ? ` (${esc(peer.state)})` : ''}</p></div>`;
  },
};
$('netbox').onclick = async (e) => {
  const b = e.target.closest('button[data-net]');
  if (!b) return;
  const act = b.dataset.net;
  const i = Number(b.dataset.i);
  if (act === 'copy') { const t = $(b.dataset.id); t.select(); try { await navigator.clipboard.writeText(t.value); } catch { document.execCommand?.('copy'); } b.textContent = 'コピーした'; return; }
  if (act === 'close') { $('netbox').hidden = true; return; }
  if (act === 'room') { b.disabled = true; return Cloud.run(() => Cloud.openRoom(), ''); }
  if (act === 'roomjoin') { const code = $('netroom').value; b.disabled = true; return Cloud.run(() => Cloud.joinRoom(code), ''); } // 描き直す前に読む
  if (act === 'offer') { b.disabled = true; b.textContent = '作っている…'; return Net.makeOffer(Net.peers[i]); }
  if (act === 'answer') return Net.takeAnswer(Net.peers[i], $(`netans${i}`).value);
  if (act === 'start') return Net.start();
  if (act === 'join') { b.disabled = true; b.textContent = '作っている…'; return Net.join($('netinvite').value); }
};
