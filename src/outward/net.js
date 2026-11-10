// --- ネット対戦 (WebRTC。端末どうしを直接つなぐ) ---
// つなぎ方は 2 つ: (1) 招待コード (4 文字): ホストが Firebase に部屋を作り、参加者がコードを入れるだけ (outward/cloud.js の openRoom・joinRoom。
// 2026-11-10 のユーザーの依頼 common-1・common-2 から、こちらが表。ログインは要らない)。(2) 長いコード (招待と返事) を手で渡し合う (サーバーなし。予備)
// 部屋 (ロビー。2026-11-10 のユーザーの依頼 common-3「Hoi４のマルチを参考に、招待コードが必要なのは部屋にはいるだけにして、どの国を選ぶのかは参加者が選べるようにして」):
// つながる口 (slot) は国と別。参加者は、招待コード (か長いコード) でホストにつながると部屋に入り、部屋の中で動かす国を自分で選ぶ。
// ホストが始めると、選ばれた国が人間の席になる。始まったあとに入った人・切れて戻った人は、AI が動かしている国を選ぶと、その国ですぐ入る (途中参加)。
// 部屋のやりとり (データチャネル): 参加者 → hello (名前)・pick (選んだ国)、ホスト → lobby (国の一覧と、だれが選んだか)・bye (部屋から外した)
// ロックステップ: 時間を進めるのはホストだけ。ホストは 1 コマごとに「そのコマで実行する命令と、進める年数」を全員に送り、
// どの端末も同じ順に「命令を実行 → advance(年数)」をくり返す。試合の乱数もシードから続く 1 本なので、全員が同じ結果になる。
// ずれを見つけるため、ときどき状態の要約 (ハッシュ) を添える。合わなければ、ホストの状態をまるごと受け取って合わせ直す
const NET_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
const NET_CHUNK = 60000; // データチャネルの 1 通の大きさの上限より小さく切って送る
const NET_HASH_EVERY = 120; // 何コマごとに状態の要約を添えるか
// つながらないときの手当て (回 SO5)。中継のサーバー (TURN) は置いていないので、端末どうしが直接つながれる回線でしか遊べない
const NET_HELP = () => TR`<details class="nethelp"><summary>つながらないとき</summary><ul>
  <li>同じ Wi-Fi どうし・家の回線どうしなら、たいていつながる。</li>
  <li>スマートフォンの回線 (テザリングを含む)・会社や学校のネットでは、つながらないことがある (中継のサーバーを置いていないため)。片方だけでも家の Wi-Fi にすると通ることがある。</li>
  <li>「つないでいる…」のまま 20 秒たったら、ホストが「コードを作り直す」を押して新しい招待コードを伝え、相手は「コードを入れ直す」で入り直す (長いコードの方法なら、招待と返事のコードを両方作り直す)。</li>
  <li>両方とも同じ版 (同じ URL のゲーム) を開いているかを確かめる。</li>
  <li>試合の途中で切れたら (遅れて来た人も)、同じ招待コードで部屋に入り直し、AI が動かしている国を選ぶと、その国で入れる (コードが使えなければ、ホストがメニューの「ホーム」で開くネット対戦の画面で作り直す)。</li>
  <li>どうしてもつながらなければ、その場はホットシートにする: はじめる前に、ホストがこの画面を「閉じる」。人間の国はそのまま残り、上の帯の「交代」で 1 台を順に回して遊べる。</li></ul></details>`;
const Net = {
  on: false, role: null, pi: 0, k: 0,
  // ホスト: slots = つながる口 { id, pc, dc, state, offer, name, joined, pick, pi, cap }。joined = 相手が部屋に入っている。
  //   pick = 部屋の中で選んだ国の首都 (始める前)。pi・cap = 試合で動かしている席と国 (始めたあと)。peers = 試合に入っている口 (コマを送る相手)。
  // 参加者: peers = ホストへの 1 本。lobby = ホストから届いた部屋の様子 (国の一覧と、だれが選んだか)
  slots: [], peers: [], lobby: null,
  fresh: false, // ホスト: 国家選択から開いた、まだ始めていない試合の部屋。始めるときに、選ばれた国を人間の席にして席を作り直す
  queue: [], inbox: [], parts: {}, resyncs: 0, status: '',
  // 招待コードの部屋 (outward/cloud.js): room = { code, … }・roomBusy = 作っている途中・roomErr = 作れなかった理由・roomSeq = 作り直し・やめたの印。
  // manual = 長いコードを手で渡す方法を出す (オンラインの部屋が使えないとき・自分で切りかえたとき)。codeIn・nameIn = 参加の欄に入れた字 (描き直しても消さない)
  room: null, roomBusy: false, roomErr: '', roomSeq: 0, manual: false, codeIn: '', nameIn: '', joining: false, joinErr: '',
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
    dc.onopen = () => {
      peer.state = TR('つながった');
      if (this.role === 'host') { peer.joined = true; return this.lobbyChanged(); } // 部屋に入った: 国の一覧を送る
      this.send(peer, { t: 'hello', name: this.myName() });
      this.render();
    };
    dc.onclose = () => { if (peer.dc === dc) this.lost(peer); }; // 招待を作り直したあとに届く、前のつながりの close は数えない
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
  // つながらなかった (STUN だけでは届かない回線どうし。中継のサーバーは置いていない) ことを画面に出す。
  // つながっていた相手のタブが閉じた・回線が落ちたことも、ここで知る (データチャネルの close は届かないことがあり、open のまま残ることもある)
  watch(peer, pc) {
    pc.addEventListener('connectionstatechange', () => {
      const st = pc.connectionState;
      if (pc !== peer.pc || (st !== 'failed' && st !== 'closed')) return;
      if (this.role === 'host' ? peer.joined : this.on || peer.dc?.readyState === 'open') return this.lost(peer);
      peer.state = TR('つながらなかった (下の「つながらないとき」を見る)');
      peer.failed = true;
      this.reseat(peer);
      if (this.role === 'host') this.redraw(); else if (!this.on) this.render();
    });
  },
  // --- ホスト ---
  // 部屋を開く。fresh = 国家選択から開いた、まだ始めていない試合。つながる口は、国の数 − 1 (自分のほかの国を、みな人が動かせる数)。
  // オンラインの部屋が使えれば、すぐに招待コード (4 文字) を作る (ボタンもログインも要らない。依頼 common-1)
  openHost(fresh = false) {
    const g = app.game;
    this.leaveRoom();
    this.closeSlots();
    this.role = 'host';
    this.pi = g.pi;
    this.fresh = fresh;
    this.slots = Array.from({ length: Math.max(1, (g.nations?.length || 2) - 1) }, (_, id) => ({ id, state: TR('まだ'), name: '', joined: false, pick: null, pi: null, cap: null }));
    this.peers = [];
    this.manual = !Cloud.available();
    this.render();
    if (!this.manual) this.autoRoom();
  },
  // つながる口をみな閉じる (前のつながりの close・failed は数えない)
  closeSlots() {
    for (const s of this.slots) { const pc = s.pc; s.pc = s.dc = null; pc?.close(); }
    this.slots = [];
  },
  // 始める前にホストが部屋をやめる (画面を閉じた): 部屋を消し、入っていた人とのつながりも切る
  closeHost() { this.leaveRoom(); this.closeSlots(); this.peers = []; this.role = null; },
  // いまの招待コードの部屋をやめる (作っている途中のものも)
  leaveRoom() {
    this.roomSeq++;
    this.roomBusy = false; this.roomErr = '';
    if (this.room) { Cloud.closeRoom(this.room); this.room = null; }
  },
  // 招待コードの部屋を作る (作り直す)。席を出すのは、まだだれも入っていない口だけ (入っている人はそのまま)
  async autoRoom() {
    this.leaveRoom();
    const seq = this.roomSeq;
    const seats = this.slots.filter((s) => !s.joined);
    if (!seats.length) return this.redraw();
    this.roomBusy = true;
    this.redraw();
    let room = null, err = '';
    try { room = await Cloud.openRoom(seats); } catch (e) { err = Cloud.errText(e); }
    if (seq !== this.roomSeq) { if (room) Cloud.closeRoom(room); return; } // 作っているあいだに、画面を閉じた・作り直した
    this.roomBusy = false; this.roomErr = err; this.room = room;
    this.redraw();
  },
  // 長いコードを手で渡す方法に切りかえる: 招待コードの部屋をやめ、まだだれも入っていない口の招待は作り直してもらう
  toManual() {
    this.leaveRoom();
    this.manual = true;
    for (const s of this.slots) if (!s.joined) { const pc = s.pc; s.pc = s.dc = s.offer = null; pc?.close(); s.state = TR('まだ'); s.name = ''; }
    this.render();
  },
  // ネット対戦の画面が出ているときだけ描き直す (あとから届く知らせで、閉じた画面を勝手に開かない)
  redraw() { if (!$('netbox').hidden) this.render(); },
  // 招待コードの部屋で、つながらなかった・切れた口に、新しい招待を置き直す (招待コードはそのまま。相手は同じコードで入り直せる)。
  // 部屋がもうないとき (全員が入ったあとに作り直して、出す口がなかった) は、新しい招待コードの部屋を作る。手渡しの方法では、ホストが招待コードを作り直す
  reseat(slot) {
    if (this.role !== 'host') return;
    const room = this.room;
    if (!room?.host) { if (!this.manual && !this.roomBusy && Cloud.available()) this.autoRoom(); return; }
    if (slot.reseating) return;
    slot.reseating = true;
    Cloud.reseat(room, slot).catch(() => {}).finally(() => { slot.reseating = false; this.redraw(); });
  },
  async makeOffer(peer) {
    peer.pc?.close();
    const pc = new RTCPeerConnection({ iceServers: NET_ICE });
    peer.pc = pc;
    peer.failed = false;
    this.watch(peer, pc);
    this.wire(peer, pc.createDataChannel(STORE, { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await this.iceDone(pc);
    if (peer.pc !== pc) return; // 待つあいだに、この口の招待を作り直した (新しいほうを使う)
    peer.offer = await this.pack({ t: 'o', ed: EDITION, sdp: pc.localDescription.sdp, slot: peer.id });
    peer.state = TR('招待コードを渡して、返事を待っている');
    this.redraw();
  },
  async takeAnswer(peer, code) {
    try {
      const d = await this.unpack(code);
      if (d.t !== 'a') throw new Error();
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
      peer.state = TR('つないでいる…');
    } catch { peer.state = TR('返事コードが読めなかった'); this.reseat(peer); }
    this.redraw();
  },
  // 相手に見せる自分の名前 (参加の欄に入れた名前か、アカウントの名前)
  myName() { return String(this.nameIn || Cloud.user?.name || '').trim().slice(0, 20); },
  // 部屋の国の一覧 (ホストの画面に出す・参加者に送る)。st: host = ホストの国、taken = 参加者が選んだ・動かしている、
  // free = 選べる (AI が動かす)、gone = もう国ではない (滅んだ・従属した)。slot = 選んだ参加者の口
  nationList() {
    const g = app.game, hostCap = g.players[this.pi]?.cap;
    return (g.nations || []).map((n) => {
      const s = this.slots.find((x) => x.joined && (x.pi != null ? x.cap === n.cap : x.pick === n.cap));
      const st = n.cap === hostCap ? 'host' : s ? 'taken' : !g.realmAlive(n.cap) ? 'gone' : 'free';
      // 選ぶ手がかり: 首都のある星系・いまの人口と星系の数・難しさの目安 (国家選択のカードと同じ。screen/nation-pick.js の nationRating)
      return { cap: n.cap, name: n.name, sp: n.species, tr: n.traits || [], st, who: st === 'host' ? this.myName() : s?.name || '', slot: s ? s.id : null,
        home: g.system(n.cap).name, pop: g.colonies.reduce((k, c) => (g.realmOf(c.sys) === n.cap ? k + c.pop : k), 0), sys: g.realmSystems(n.cap).length, stars: nationRating(g, n).stars };
    });
  },
  lobbyMsg(slot, note = '') { return { t: 'lobby', on: this.on, you: slot.id, year: app.game.year, nations: this.nationList(), note }; },
  // 部屋の様子が変わった (だれかが入った・国を選んだ・抜けた・試合が始まった): 試合に入っていない参加者みなに送り、画面を描き直す
  lobbyChanged() {
    for (const s of this.slots) if (s.joined && s.pi == null) this.send(s, this.lobbyMsg(s));
    this.redraw();
  },
  // 参加者が国を選んだ (cap が null なら、選ぶのをやめた)。ほかの人が選んだ国・ホストの国・もう国ではない国は選べない。
  // 始める前は選んだ印を付けるだけ (変えられる)。試合の途中は、その国ですぐ入る
  takePick(slot, cap) {
    if (!slot.joined || slot.pi != null) return;
    if (cap === null || cap === undefined) { slot.pick = null; return this.lobbyChanged(); }
    const n = this.nationList().find((x) => x.cap === Number(cap));
    if (!n || !(n.st === 'free' || (n.st === 'taken' && n.slot === slot.id))) return this.send(slot, this.lobbyMsg(slot, 'taken'));
    if (this.on) return this.hotJoin(slot, n.cap);
    slot.pick = n.cap;
    this.lobbyChanged();
  },
  // 途中参加 (始まったあとに入った人・切れて戻った人): いまの状態を送り、次のコマでその国を人の手に渡す (命令 rejoin)
  hotJoin(slot, cap) {
    const g = app.game;
    slot.pi = g.playerOf(cap); slot.cap = cap; slot.pick = null;
    this.peers.push(slot);
    this.queue.push({ p: slot.pi, a: 'rejoin', d: {} });
    this.sendState(slot);
    uiNote(TR`${g.realmName(cap)}がネット対戦に入った`);
    this.lobbyChanged();
  },
  // 部屋から外す (知らない人が入ったとき・席をあけたいとき)。試合に入っていた国は AI に任せる
  kick(slot) {
    if (!slot?.joined) return;
    this.send(slot, { t: 'bye' });
    this.lost(slot);
  },
  start() {
    const g = app.game;
    const ready = this.slots.filter((s) => s.joined && s.pick != null);
    const hostCap = g.players[this.pi].cap;
    if (this.fresh) {
      // まだ始めていない試合: 選ばれた国 (とホストの国) を人間の席にして、席を作り直す (どの人も同じ初期値で始まる。ほかの国は AI の席)
      const caps = g.nations.map((n) => n.cap).filter((c) => c === hostCap || ready.some((s) => s.pick === c));
      g.setPlayers(caps);
      g.pi = caps.indexOf(hostCap);
      PlayLog.add('home', { act: 'nation', caps });
      for (let i = 0; i < caps.length; i++) if (caps[i] !== 0) g.asPlayer(i, () => { if (caps.length > 1) g.msgTo = i; g.message(JA`${g.nationOf(caps[i]).name}として歩みはじめた。首都は ${g.system(caps[i]).name}。`); g.msgTo = undefined; });
    } else {
      // 続きの試合 (セーブを読んだ・ひとりで遊んでいた試合を開いた): 席はそのまま。選ばれた国は人の手に、選ばれなかった人間の席 (ホストのほか) は AI に任せる
      g.players.forEach((p, i) => { if (i !== g.pi) p.human = ready.some((s) => s.pick === p.cap); });
    }
    this.fresh = false;
    this.pi = g.pi;
    for (const s of ready) { s.pi = g.playerOf(s.pick); s.cap = s.pick; s.pick = null; }
    this.peers = ready;
    this.on = true;
    this.k = 0;
    for (const p of this.peers) this.sendState(p);
    $('netbox').hidden = true;
    uiNote(TR`ネット対戦を始めた (${this.peers.length + 1} 人)。速さはホストが決める`);
    setSpeed(SPEEDS[1]);
    app.dirty = true;
    this.lobbyChanged(); // 国を選んでいない参加者に、始まったことを知らせる (AI の国を選べば、その国で入れる)
  },
  sendState(peer) { this.send(peer, { t: 'init', pi: peer.pi, k: this.k, save: buildSave(app.game) }); },
  // --- 参加者 ---
  async join(code) {
    let d;
    try { d = await this.unpack(code); if (d.t !== 'o') throw new Error(); } catch { this.status = TR('招待コードが読めなかった'); return this.render(); }
    if ((d.ed || 'game') !== EDITION) { this.status = TR`招待コードは${EDITION_LABEL[d.ed || 'game']}のもの。同じ版どうしでしかつなげない`; return this.render(); }
    if (this.role === 'guest' && this.peers[0]) { this.peers[0].gone = true; this.peers[0].pc?.close(); } // 入り直すときは、前のつながりを閉じる
    this.role = 'guest';
    this.lobby = null;
    const peer = { state: TR('つないでいる…') };
    this.peers = [peer];
    const pc = new RTCPeerConnection({ iceServers: NET_ICE });
    peer.pc = pc;
    pc.ondatachannel = (e) => this.wire(peer, e.channel);
    this.watch(peer, pc);
    await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await this.iceDone(pc);
    peer.answer = await this.pack({ t: 'a', sdp: pc.localDescription.sdp });
    this.status = TR('返事コードをホストに渡してください。つながったら、部屋で国を選ぶ');
    this.render();
  },
  // 招待コード (4 文字) で部屋に入る。ログインしていなければ、ゲストとして自動で入る (outward/cloud.js の joinRoom)
  async joinCode(code, name) {
    this.codeIn = code; this.nameIn = name;
    this.joining = true; this.joinErr = '';
    this.render();
    try { await Cloud.joinRoom(code, name.trim().slice(0, 20)); } catch (e) { this.joinErr = Cloud.errText(e); }
    this.joining = false;
    this.redraw();
  },
  // 部屋を出る・招待コードを入れ直す: 参加の欄に戻す
  leaveJoin() {
    const peer = this.peers[0];
    if (peer) { peer.gone = true; peer.pc?.close(); }
    this.peers = []; this.role = null; this.room = null; this.lobby = null; this.status = ''; this.joinErr = '';
    this.render();
  },
  // 参加の画面を開く (ホーム → マルチプレイ →「参加する」)。ホストの画面で開いていた部屋はやめる
  openJoin() {
    if (this.role === 'guest' && !this.on && this.peers[0] && !this.peers[0].gone) return this.render(); // もう部屋にいる・つないでいる途中: その画面に戻る
    if (this.role === 'host') this.closeHost();
    this.role = null; this.manual = false; this.joinErr = '';
    this.render();
  },
  // 部屋で国を選ぶ (cap が null なら、選ぶのをやめる)。決めるのはホスト (lobby の知らせが返る)
  sendPick(cap) { this.send(this.peers[0], { t: 'pick', cap }); },
  // --- 通信 ---
  receive(peer, m) {
    if (this.role === 'host') {
      if (m.t === 'hello') { peer.name = String(m.name || '').slice(0, 20) || peer.name; return this.lobbyChanged(); }
      if (m.t === 'pick') return this.takePick(peer, m.cap);
      if (peer.pi == null) return; // 試合に入っていない人 (部屋で国を選んでいる人) の命令は受けない
      if (m.t === 'c') this.queue.push({ p: peer.pi, a: m.a, d: m.d });
      else if (m.t === 'resync') { this.resyncs++; this.sendState(peer); }
      else if (m.t === 'speed') { setSpeed(SPEEDS.includes(m.v) ? m.v : 0); uiNote(TR`${app.game.realmName(app.game.players[peer.pi].cap)}が速さを変えた`); }
      return;
    }
    if (m.t === 'lobby') { if (!this.on) { this.lobby = m; this.redraw(); } return; }
    if (m.t === 'bye') return this.lost(peer, TR('ホストが部屋から外した'));
    if (m.t === 'init') return this.applyState(m);
    if (m.t === 'f') this.inbox.push(m);
  },
  applyState(m) {
    loadSave(m.save);
    const g = app.game;
    g.pi = this.pi = m.pi;
    this.k = m.k;
    this.inbox = this.inbox.filter((f) => f.k > m.k);
    this.lobby = null;
    if (!this.on) {
      this.on = true;
      closeHome(0);
      $('netbox').hidden = true;
      app.selectSystem(g.cap);
      galaxyView.centerOn(g.system(g.cap));
      this.toast(TR`${ME.realm}としてネット対戦に参加した。速さはホストが決める`);
      // プレイ記録のこの回は、参加した試合のものにする (ページを開いたときの試合でなく)
      if (PlayLog.cur) { PlayLog.cur.seed = String(g.galaxy.seed); PlayLog.cur.y0 = g.year; PlayLog.cur.net = 'guest'; }
      PlayLog.add('ui', { act: 'net', role: 'guest' });
    }
    app.dirty = true;
  },
  issue(act, d) {
    const c = JSON.parse(JSON.stringify({ a: act, d: d || {} }));
    if (this.role === 'host') this.queue.push({ p: this.pi, ...c });
    else this.send(this.peers[0], { t: 'c', ...c });
    return { ok: true, queued: true };
  },
  // 状態の要約: プレイヤーごとに違う値 (いま操作しているプレイヤーと、その国の資金・政治力などの写し) と、端末ごとの値を除いたセーブの FNV-1a。
  // aif (AI の国の財政の覚え書き) も除く: 国ごとに決まった式の値を、初めて見たときに覚えるだけで、ある・ないで試合は変わらない。地図を描くとき
  // (snapshot の財政) にも作られるので、ホストと参加者で描く物が違うとずれて見え、状態を送り直していた (B-278。依頼 common-4・common-5 の CI で見つけた)
  hash() {
    const d = { ...buildSave(app.game) };
    for (const k of ['pi', 'savedAt', 'endShown', 'spectate', 'credits', 'aif', ...PLAYER_KEYS]) delete d[k];
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
      // 時間は 0.25 年 (STEP) の倍数だけコマに入れる (経済は 0.25 年ごと。どの端末も同じ歩で進む。QD-81 = a)。
      // 残りはためておき、ホストの地図の表示の年に使う (game.viewYear)
      const g = app.game, want = (g.stepAcc || 0) + (app.speed ? dt * app.speed : 0);
      const y = Math.floor((want + 1e-9) / STEP) * STEP;
      g.stepAcc = Math.min(STEP_BACKLOG, Math.max(0, want - y));
      // 止めた・速さを変えたことも、空のコマで知らせる (参加者の速さのボタンがホストと同じになるように)
      if (!y && !this.queue.length && app.speed === this.sentSpeed) return false;
      this.sentSpeed = app.speed;
      const f = { t: 'f', k: this.k + 1, c: this.queue.splice(0), y, s: app.speed };
      this.apply(f);
      if (f.k % NET_HASH_EVERY === 0) f.h = this.hash();
      for (const p of this.peers) this.send(p, f);
      return true;
    }
    const t0 = performance.now();
    let n = 0;
    // 参加者は、届いたコマのあいだも地図を滑らかに動かす: 表示の年だけを、ホストの速さで 1 歩ぶん (STEP) まで先へ進める (試合は進めない)
    const g = app.game;
    g.stepAcc = Math.min(STEP, (g.stepAcc || 0) + (app.speed ? dt * app.speed : 0));
    while (this.inbox.length && performance.now() - t0 < 40) {
      const f = this.inbox.shift();
      this.apply(f);
      if (f.y) app.game.stepAcc = 0;
      n++;
      if (f.s !== undefined && f.s !== app.speed) { app.speed = f.s; updateSpeedButtons(); }
      if (f.h && f.h !== this.hash()) {
        // ずれた: 届いているコマは捨て、ホストの状態をもらい直す
        this.inbox = [];
        this.resyncs++;
        this.send(this.peers[0], { t: 'resync', k: f.k });
        this.toast(TR('ホストとずれたので、状態を合わせ直している'));
        break;
      }
    }
    return n > 0;
  },
  // つながっていた相手が落ちた。why = 参加者の画面に出す理由 (なければ「接続が切れた」)
  lost(peer, why) {
    if (this.role === 'host') {
      const g = app.game, was = peer.pi, cap = peer.cap, pc = peer.pc;
      peer.pc = peer.dc = peer.offer = null; pc?.close(); // つながりを片づける (あとから届く、このつながりの close・failed は数えない)
      peer.joined = false; peer.pick = null; peer.pi = null; peer.cap = null; peer.name = '';
      peer.state = TR('切れた');
      if (was !== null && was !== undefined) { // 試合に入っていた国は、AI に任せる
        this.peers = this.peers.filter((p) => p !== peer);
        this.queue.push({ p: was, a: 'drop', d: {} });
        uiNote(TR`${g.realmName(cap)}との接続が切れた。この国は AI が動かす (招待コードで部屋に入り直して、同じ国を選ぶと戻れる)`);
      }
      this.reseat(peer); // 招待コードの部屋なら、同じコードのまま、この口に新しい招待を置き直す
      return this.lobbyChanged();
    }
    if (peer.gone) return; // データチャネルの close と、つながりの failed の両方から呼ばれる
    peer.gone = true;
    if (!this.on) { // 部屋にいるあいだに切れた: 参加の欄に戻して、理由を出す
      peer.pc?.close();
      this.peers = []; this.role = null; this.room = null; this.lobby = null;
      this.status = this.joinErr = why || TR('接続が切れた');
      return this.render();
    }
    this.on = false;
    const g = app.game;
    g.players.forEach((p, i) => { if (i !== this.pi) p.human = false; });
    setSpeed(0);
    uiNote(TR('ホストとの接続が切れた。ここからはひとりで続けられる (ほかの国は AI)。ホーム → マルチプレイ →「参加する」で招待コードを入れ直し、同じ国を選ぶと戻れる'));
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
  // 招待コードの欄 (ホスト)。mid = 試合の途中 (自動では作らない)
  roomHtml(mid) {
    if (!Cloud.available()) return '';
    const hand = mid ? '' : TR('<button class="ghost" data-net="manual">長いコードを手で渡してつなぐ</button>');
    if (this.room) {
      return TR`<section class="invite"><h3>招待コード <b class="roomcode">${esc(this.room.code)}</b> <button data-net="copycode">コピー</button></h3>
        <p class="note">この 4 文字を相手に伝える。相手は、ホーム → マルチプレイ →「参加する」でコードを入れると部屋に入り、動かす国を自分で選ぶ (ログインは要らない)。</p>
        <div class="row"><button class="ghost" data-net="room">コードを作り直す</button>${hand}</div></section>`;
    }
    if (this.roomBusy) return TR('<section class="invite"><p>招待コードを作っている…</p></section>');
    if (this.roomErr) return TR`<section class="invite"><p class="bad">招待コードを作れなかった: ${esc(this.roomErr)}</p><div class="row"><button data-net="room">もう一度ためす</button>${hand}</div></section>`;
    if (mid || this.manual || this.slots.some((s) => !s.joined)) return TR`<section class="invite"><div class="row"><button ${mid ? '' : 'class="big"'} data-net="room">招待コード (4 文字) を作る</button></div></section>`;
    return '';
  },
  // 長いコードを手で渡す欄 (ホスト): まだだれも入っていない口のうち、招待を作ったものと、次の 1 つ
  slotRows() {
    const copyBtn = (id) => TR`<button data-net="copy" data-id="${id}">コピー</button>`;
    const open = this.slots.filter((s) => !s.joined), next = open.find((s) => !s.offer);
    return open.filter((s) => s.offer || s === next).map((s) => TR`<section><h3>招待 ${s.id + 1} <span class="muted">${esc(s.state)}</span></h3>
      <div class="row"><button data-net="offer" data-i="${s.id}">招待コードを作る</button>${s.offer ? copyBtn(`netoffer${s.id}`) : ''}</div>
      ${s.offer ? TR`<textarea id="netoffer${s.id}" readonly rows="3">${esc(s.offer)}</textarea>
      <textarea id="netans${s.id}" rows="3" placeholder="相手の返事コードを貼る"></textarea><button data-net="answer" data-i="${s.id}">つなぐ</button>` : ''}</section>`).join('');
  },
  // 部屋にいる人 (ホスト): 名前と、選んだ国 (試合の途中は、動かしている国)。「外す」で部屋から外せる。list = nationList()
  membersHtml(list) {
    const rows = this.slots.filter((s) => s.joined).map((s) => {
      const n = list.find((x) => x.slot === s.id);
      return TR`<div class="row"><div class="info"><b>${esc(s.name || TR('ゲスト'))}</b> — ${n ? esc(n.name) : TR('国を選んでいる…')}</div><button class="ghost" data-net="kick" data-i="${s.id}">外す</button></div>`;
    });
    // 招待コードで入ってきて、つないでいる途中の人
    const coming = this.slots.filter((s) => !s.joined && s.name).map((s) => `<p class="muted">${esc(s.name)}: ${esc(s.state)}</p>`);
    return rows.join('') + coming.join('') || TR('<p class="muted">まだだれも入っていない</p>');
  },
  render() {
    const box = $('netbox');
    // 参加の欄に入れかけた字は、描き直しても消さない (ログインの知らせなどで描き直される)
    if ($('netcode')) this.codeIn = $('netcode').value;
    if ($('netname')) this.nameIn = $('netname').value;
    box.hidden = false;
    const g = app.game;
    const copyBtn = (id) => TR`<button data-net="copy" data-id="${id}">コピー</button>`;
    if (this.on) {
      // あとから入る人・戻る人 (ホストだけ): 招待コードで部屋に入り、AI が動かしている国を選ぶと、その国で入る
      const late = this.role !== 'host' ? ''
        : TR`<h3>部屋にいる人</h3>${this.membersHtml(this.nationList())}
        <h3>あとから入る人・戻る人</h3><p class="note">招待コードで部屋に入り、AI が動かしている国を選ぶと、その国で入れる (遅れて来た人も、切れた人も同じ。相手はホーム → マルチプレイ →「参加する」)。</p>
        ${this.roomHtml(true)}${this.room || this.roomBusy ? '' : this.slotRows()}`;
      box.innerHTML = TR`<div class="card"><h2>ネット対戦</h2><p>${esc(ME.realm)}として${this.role === 'host' ? TR('ホストをしている') : TR('参加している')} (${this.role === 'host' ? this.peers.length + 1 : '?'} 人)。コマ ${this.k}・合わせ直し ${this.resyncs} 回</p>
        <p class="note">${this.role === 'host' ? TR('速さはホストが決める。') : TR('速さのボタンを押すと、ホストに頼む。')}ネット対戦のあいだは、ホーム画面の新しいゲーム・ロードは使えない。</p>${late}<div class="row"><button data-net="close">閉じる</button></div></div>`;
      return;
    }
    if (this.role === 'host') {
      const list = this.nationList();
      const inRoom = this.slots.filter((s) => s.joined), ready = inRoom.filter((s) => s.pick !== null).length;
      const hand = this.manual || !Cloud.available(); // 長いコードを手で渡す方法を出す
      const who = (n) => (n.st === 'host' ? TR('あなた') : n.st === 'taken' ? esc(n.who || TR('ゲスト')) : n.st === 'gone' ? TR('もう国ではない') : TR('AI (だれも選んでいない)'));
      box.innerHTML = TR`<div class="card"><h2>ネット対戦 (ホスト)</h2>${this.roomHtml(false)}
        ${hand ? TR`<p class="note">相手ごとに「招待コードを作る」→ コードを相手に渡す (メッセージアプリなどで) → 相手が作った返事コードを下に貼って「つなぐ」。つながった人は部屋に入り、動かす国を自分で選ぶ。あなたは <b>${esc(g.realmName(g.cap))}</b>。</p>${this.slotRows()}` : TR`<p class="note">あなたは <b>${esc(g.realmName(g.cap))}</b>。部屋に入った人は、動かす国を自分で選ぶ。みなが選んだら「はじめる」。</p>`}
        <h3>部屋にいる人</h3>${this.membersHtml(list)}
        <h3>国</h3><ul class="lobbynat">${list.map((n) => `<li class="${n.st}"><b>${esc(n.name)}</b> <span class="muted">${esc(n.sp)}</span> — ${who(n)}</li>`).join('')}</ul>
        <div class="row"><button class="big" data-net="start">はじめる (${ready + 1} 人${ready < inRoom.length ? TR('・国を選んでいない人は、あとから入れる') : ''})</button><button data-net="close" class="ghost">閉じる</button></div>
        <p class="note">選ばれなかった国は AI が動かす。始めたあとも、同じ招待コードで部屋に入って AI の国を選べば、その国で入れる。</p>${NET_HELP()}</div>`;
      return;
    }
    const peer = this.peers[0];
    if (this.role === 'guest' && this.lobby) { // 部屋に入った: 動かす国を選ぶ
      const L = this.lobby, mine = L.nations.find((n) => n.slot === L.you);
      const row = (n) => {
        const me = n.slot === L.you;
        const lab = me ? TR('あなた') : n.st === 'host' ? TR`ホスト${n.who ? ` (${esc(n.who)})` : ''}` : n.st === 'taken' ? esc(n.who || TR('ゲスト')) : n.st === 'gone' ? TR('もう国ではない') : TR('AI (選べる)');
        const btn = me ? TR('<button class="ghost" data-net="pick" data-cap="">やめる</button>') : n.st === 'free' ? `<button data-net="pick" data-cap="${n.cap}">${L.on ? TR('この国で入る') : TR('この国にする')}</button>` : '';
        // 選ぶ手がかり (数字はホストが送ってくる): 首都・人口・星系の数・難しさの目安。特性は、名前と効き目を 1 つ 1 行で。もう国ではない国には出さない
        const facts = n.stars && n.st !== 'gone' ? `<div class="facts">${TR`首都 ${esc(n.home)}・人口 ${fmtPop(n.pop)}・星系 ${n.sys}・難しさの目安 ${'★'.repeat(n.stars) + '☆'.repeat(3 - n.stars)}`}</div>` : '';
        const what = n.st === 'gone' ? '' : (n.tr || []).map((t) => SPECIES_TRAITS[t]).filter(Boolean).map((t) => `<div class="facts"><b>${TX(t.label)}</b>: ${TX(t.desc)}</div>`).join('');
        return `<div class="lrow ${me ? 'on' : n.st}"><div class="info"><b>${esc(n.name)}</b> <span class="muted">${esc(n.sp)}</span> <span class="who">${lab}</span>${facts}${what}</div>${btn}</div>`;
      };
      box.innerHTML = TR`<div class="card"><h2>ネット対戦の部屋</h2>
        <p>${L.on ? TR`試合は始まっている (西暦 ${Math.floor(L.year)} 年)。AI が動かしている国を選ぶと、その国で入る。` : mine ? TR`<b>${esc(mine.name)}</b>を選んだ。ホストが始めるのを待つ (ほかの国に変えてもよい)。` : TR('動かす国を選ぶ。選んだら、ホストが始めるのを待つ。')}</p>
        ${L.note === 'taken' ? TR('<p class="bad">その国は選べない (ほかの人が先に選んだ)。ほかの国を選ぶ。</p>') : ''}
        <div class="lobby">${L.nations.map(row).join('')}</div>
        <div class="row"><button data-net="leavejoin" class="ghost">部屋を出る</button><button data-net="close" class="ghost">閉じる</button></div>${NET_HELP()}</div>`;
      return;
    }
    if (this.room && this.role === 'guest') { // 招待コードを入れた: つながるのを待っている
      box.innerHTML = TR`<div class="card"><h2>ネット対戦に参加</h2><p>${esc(this.status)}${peer ? ` <span class="muted">(${esc(peer.state)})</span>` : ''}</p>
        <div class="row"><button data-net="leavejoin" class="ghost">コードを入れ直す</button><button data-net="close" class="ghost">閉じる</button></div>${NET_HELP()}</div>`;
      return;
    }
    // 参加: 招待コード (4 文字) を入れるだけ。長いコードを貼る方法は、たたんでおく (オンラインの部屋が使えない版では、そのまま出す)
    const codeBox = !Cloud.available() ? ''
      : TR`<section class="invite"><div class="row"><input id="netcode" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="招待コード (4 文字)" value="${esc(this.codeIn)}"><input id="netname" maxlength="20" placeholder="名前 (なくてもよい)" value="${esc(this.nameIn || Cloud.user?.name || '')}"><button class="big" data-net="roomjoin" ${this.joining ? 'disabled' : ''}>${this.joining ? TR('つないでいる…') : TR('参加する')}</button></div>
        <p class="note">ホストからもらった 4 文字の招待コードを入れると、部屋に入る。動かす国は、部屋の中で選ぶ。ログインは要らない。名前は、ほかの人の画面に出る。</p>${this.joinErr ? `<p class="bad">${esc(this.joinErr)}</p>` : ''}</section>`;
    const hand = TR`<p class="note">ホストからもらった招待コードを貼って「返事コードを作る」。できた返事コードをホストに渡す。つながったら、部屋で国を選ぶ。</p>
      <textarea id="netinvite" rows="3" placeholder="招待コードを貼る"></textarea><div class="row"><button data-net="join">返事コードを作る</button>${codeBox ? '' : TR('<button data-net="close" class="ghost">閉じる</button>')}</div>
      ${peer?.answer ? TR`<h3>返事コード ${copyBtn('netanswer')}</h3><textarea id="netanswer" readonly rows="3">${esc(peer.answer)}</textarea>` : ''}
      <p class="muted">${esc(this.status)}${peer ? ` (${esc(peer.state)})` : ''}</p>`;
    box.innerHTML = TR`<div class="card"><h2>ネット対戦に参加</h2>${codeBox}
      ${codeBox ? TR`<details class="nethelp" id="netmanual" ${this.manual ? 'open' : ''}><summary>長いコードを手で渡してつなぐ (ホストが長い招待コードを送ってきたとき)</summary>${hand}</details>
      <div class="row"><button data-net="close" class="ghost">閉じる</button></div>` : hand}${NET_HELP()}</div>`;
  },
};
$('netbox').onclick = async (e) => {
  const b = e.target.closest('button[data-net]');
  if (!b) return;
  const act = b.dataset.net;
  const i = Number(b.dataset.i);
  if (act === 'copy') { const t = $(b.dataset.id); t.select(); try { await navigator.clipboard.writeText(t.value); } catch { document.execCommand?.('copy'); } b.textContent = TR('コピーした'); return; }
  if (act === 'close') { if (!Net.on && Net.role === 'host') Net.closeHost(); $('netbox').hidden = true; return; } // 始める前にホストが閉じたら、部屋もやめる
  if (act === 'room') { Net.manual = false; return Net.autoRoom(); } // 招待コードを作る・作り直す (入っている人はそのまま)
  if (act === 'manual') return Net.toManual(); // 長いコードを手で渡す方法に切りかえる
  if (act === 'copycode') { try { await navigator.clipboard.writeText(Net.room.code); } catch { /* 写せない環境では、見て伝える */ } b.textContent = TR('コピーした'); return; }
  if (act === 'roomjoin') return Net.joinCode($('netcode').value, $('netname')?.value || '');
  if (act === 'leavejoin') return Net.leaveJoin();
  if (act === 'pick') return Net.sendPick(b.dataset.cap === '' ? null : Number(b.dataset.cap)); // 部屋で国を選ぶ・やめる
  if (act === 'kick') return Net.kick(Net.slots[i]);
  if (act === 'offer') { b.disabled = true; b.textContent = TR('作っている…'); return Net.makeOffer(Net.slots[i]); }
  if (act === 'answer') return Net.takeAnswer(Net.slots[i], $(`netans${i}`).value);
  if (act === 'start') return Net.start();
  if (act === 'join') { b.disabled = true; b.textContent = TR('作っている…'); return Net.join($('netinvite').value); }
};
// 招待コードの欄で Enter を押したら参加する。長いコードの欄の開け閉めは覚えておく (描き直しても閉じない)
$('netbox').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.id === 'netcode' || e.target.id === 'netname') && !Net.joining) Net.joinCode($('netcode').value, $('netname')?.value || ''); });
$('netbox').addEventListener('toggle', (e) => { if (e.target.id === 'netmanual') Net.manual = e.target.open; }, true);
