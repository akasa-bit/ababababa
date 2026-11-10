// --- アカウントとクラウド (Firebase。docs/online.md) ---
// Firebase のプロジェクトの設定 (Firebase のコンソールの「ウェブアプリ」の firebaseConfig)。null なら、アカウントの機能は出さない。
// ホーム画面の「アカウント」タブから、端末ごとに設定を貼って試すこともできる (ブラウザに覚える)
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDRHWVbw1hQLzCTEASRnbekq7hHNmvAN_E',
  authDomain: 'nolongerubiquitous.firebaseapp.com',
  projectId: 'nolongerubiquitous',
  storageBucket: 'nolongerubiquitous.firebasestorage.app',
  messagingSenderId: '848142753399',
  appId: '1:848142753399:web:1178da094fa97ec8b5f072',
};
const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CLOUD_PART = 700000; // クラウドのセーブを分けて置く 1 つの大きさ [文字] (Firestore の文書は 1 MiB まで)
// 招待コード (部屋の名前。2026-11-10 のユーザーの依頼 common-2「送る招待コードを4桁のアルファベットと数字にしろ」。前は 6 文字の「部屋のコード」):
// 4 文字で、英字 (大文字) と数字を必ず 1 つずつ入れる。見間違えやすい I・L・O・0・1 と、たまたま言葉になるのを避けて母音 A・E・U を除く。
// 英字 20・数字 8 の 28 字から 28^4 − 20^4 − 8^4 = 450,560 通り
const ROOM_LEN = 4, ROOM_LETTERS = 'BCDFGHJKMNPQRSTVWXYZ', ROOM_DIGITS = '23456789';
const ROOM_TTL = 24 * 3600e3; // 招待コードの期限 [ミリ秒]: 作ってから 1 日たった部屋には入れない (閉じ損ねた部屋に、あとから間違って入らないように)
const ROOM_KEY = `${STORE}-room`; // この端末で最後に作った部屋 (タブを閉じて閉じ損ねていたら、次に作るときに消す)
// 自動操作のブラウザ (Playwright などの試験。navigator.webdriver) では、本物の Firebase を使わない: ネット対戦の画面を開くと招待コードの部屋を自動で作り、
// ゲストで自動ログインするので (common-1)、試験が画面を開くだけで本番にゲストのアカウントと部屋ができてしまう。試験は偽物 (window.__FB_FAKE) を差しこむ
const CLOUD_ROBOT = typeof navigator === 'object' && !!navigator.webdriver;
// Firebase の窓口: 公式の JS (モジュール) をこの形に包む。試験では window.__FB_FAKE (同じ形の偽物) を使う
async function firebaseApi(cfg) {
  const [A, U, F] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => import(FB_SDK + f)));
  const fa = A.initializeApp(cfg);
  const auth = U.getAuth(fa), db = F.getFirestore(fa);
  const ref = (p) => F.doc(db, p);
  return {
    onAuth: (cb) => U.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', guest: u.isAnonymous } : null)),
    google: () => U.signInWithPopup(auth, new U.GoogleAuthProvider()),
    email: (e, pw, create) => (create ? U.createUserWithEmailAndPassword : U.signInWithEmailAndPassword)(auth, e, pw),
    guest: () => U.signInAnonymously(auth),
    signOut: () => U.signOut(auth),
    setName: (n) => U.updateProfile(auth.currentUser, { displayName: n }),
    get: async (p) => { const x = await F.getDoc(ref(p)); return x.exists() ? x.data() : null; },
    set: (p, d, merge = false) => F.setDoc(ref(p), d, { merge }),
    del: (p) => F.deleteDoc(ref(p)),
    list: async (p) => (await F.getDocs(F.collection(db, p))).docs.map((x) => ({ id: x.id, data: x.data() })),
    watch: (p, cb) => F.onSnapshot(ref(p), (x) => cb(x.exists() ? x.data() : null)),
  };
}
const Cloud = {
  api: null, user: null, status: '', saves: null,
  configKey: `${STORE}-firebase`,
  config() { try { const t = localStorage.getItem(this.configKey); if (t) return JSON.parse(t); } catch { /* 保存できない環境 */ } return FIREBASE_CONFIG; },
  available() { return !!(window.__FB_FAKE || (!CLOUD_ROBOT && this.config())); },
  // Firebase の JS を読んでつなぐ。同時に 2 回呼ばれても 1 回だけ (ページを開いたときと、すぐ押された「参加する」が重なる)。失敗したら、次に呼ばれたときにやり直す
  init() {
    if (this.api) return Promise.resolve(true);
    if (!this.available()) return Promise.resolve(false);
    return (this.initing ??= (async () => {
      let api;
      try { api = window.__FB_FAKE || (await firebaseApi(this.config())); } catch (e) { this.initing = null; this.status = TR`Firebase につなげなかった (${e.message || e})`; this.refresh(); return false; }
      // authReady: 前のログインが戻ったか・ログインしていないかが分かったとき (最初の知らせ)
      this.authReady = new Promise((res) => {
        api.onAuth((u) => {
          this.user = u;
          this.saves = null;
          if (u) api.get(`users/${u.uid}`).then((d) => { if (d?.name && !u.name) u.name = d.name; this.refresh(); }).catch(() => {});
          res();
          this.refresh();
        });
      });
      this.api = api;
      return true;
    })());
  },
  // つなぐときの失敗を、直し方の分かる文にする (招待コードを作る・入れるときに画面に出す)
  errText(e) {
    const t = `${e?.code || ''} ${e?.message || e}`;
    if (/operation-not-allowed|admin-restricted/.test(t)) return TR('ゲストのログインが止められている (Firebase のコンソール → Authentication →「匿名」をオンにする)');
    if (/permission-denied|insufficient permissions/i.test(t)) return TR('Firestore の決まりで断られた (Firebase のコンソール → Firestore →「ルール」に、リポジトリの firestore.rules を公開する)');
    if (/unavailable|offline|network|failed to fetch/i.test(t)) return TR('ネットにつながらない (回線を確かめて、もう一度ためす)');
    return e?.message || String(e);
  },
  // ログインしていなければ、ゲストとして入る (2026-11-10 のユーザーの依頼 common-1「Firebaseの接続もっと簡単にして」: 招待コードを作る・入れる前に、
  // アカウントのタブでログインしなくてよい)。前のログイン (Google など) が戻るのを待ってから決める (待たずにゲストで入ると、前のアカウントから切り替わる)
  async ensureUser() {
    if (!(await this.init())) throw new Error(this.status || TR('オンラインの部屋は、いま使えない'));
    await Promise.race([this.authReady, new Promise((r) => setTimeout(r, 8000))]);
    if (this.user) return;
    try { await this.api.guest(); } catch (e) { throw new Error(this.errText(e)); }
    for (let i = 0; i < 100 && !this.user; i++) await new Promise((r) => setTimeout(r, 50)); // ログインの知らせ (onAuth) が届くまで
    if (!this.user) throw new Error(TR('ゲストでログインできなかった'));
  },
  refresh() {
    if (app.homeOpen && app.homeTab === 'account') renderHome();
    if (!$('netbox').hidden && !Net.on) Net.render();
  },
  // 時間のかかる操作: 結果を status に書いて画面を描き直す
  async run(fn, done) {
    this.status = '…';
    this.refresh();
    try { await fn(); this.status = done || ''; } catch (e) { this.status = TR`できなかった: ${e.message || e}`; }
    this.refresh();
  },
  name() { return this.user?.name || (this.user?.guest ? TR('ゲスト') : this.user?.email) || TR('名前なし'); },
  setName(n) { return this.run(async () => { await this.api.setName(n); await this.api.set(`users/${this.user.uid}`, { name: n }, true); this.user.name = n; }, TR('名前を変えた')); },
  // --- クラウドのセーブ: 1 つのセーブを詰めて (Net.pack)、CLOUD_PART 字ずつの文書に分けて置く ---
  savesPath() { return `users/${this.user.uid}/saves`; },
  async listSaves() { this.saves = (await this.api.list(this.savesPath())).map((x) => ({ id: x.id, ...x.data })).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)); },
  saveGame() {
    return this.run(async () => {
      const d = buildSave(app.game, { speed: app.speed });
      const code = await Net.pack(d);
      const id = `s${Date.now().toString(36)}`;
      const n = Math.ceil(code.length / CLOUD_PART);
      for (let i = 0; i < n; i++) await this.api.set(`${this.savesPath()}/${id}/parts/${i}`, { s: code.slice(i * CLOUD_PART, (i + 1) * CLOUD_PART) });
      await this.api.set(`${this.savesPath()}/${id}`, JSON.parse(JSON.stringify({ ...saveMeta(d), ed: EDITION, parts: n, size: code.length, savedAt: Date.now() })));
      await this.listSaves();
    }, TR('クラウドに保存した'));
  },
  loadGame(id) {
    return this.run(async () => {
      const m = this.saves?.find((x) => x.id === id) || (await this.api.get(`${this.savesPath()}/${id}`));
      if (!m) throw new Error(TR('セーブがない'));
      if ((m.ed || 'game') !== EDITION) throw new Error(TR`${EDITION_LABEL[m.ed || 'game']}のセーブ`);
      let code = '';
      for (let i = 0; i < m.parts; i++) code += (await this.api.get(`${this.savesPath()}/${id}/parts/${i}`))?.s || '';
      const d = await Net.unpack(code);
      if (!loadSave(d)) throw new Error(TR('読めないセーブ'));
      save();
      app.game.message('クラウドのセーブをロードした (一時停止中)。');
      closeHome();
      setSpeed(0);
    }, TR('ロードした'));
  },
  deleteSave(id) {
    return this.run(async () => {
      const m = this.saves?.find((x) => x.id === id);
      for (let i = 0; i < (m?.parts || 0); i++) await this.api.del(`${this.savesPath()}/${id}/parts/${i}`);
      await this.api.del(`${this.savesPath()}/${id}`);
      await this.listSaves();
    }, TR('消した'));
  },
  // --- 国家の保管庫 (国家づくりで作った国) をアカウントに置く ---
  pushNations() { return this.run(() => this.api.set(`users/${this.user.uid}/data/nations`, { list: JSON.parse(JSON.stringify(NationLib.list)), savedAt: Date.now() }), TR`国 ${NationLib.list.length} つをクラウドに送った`); },
  pullNations() {
    return this.run(async () => {
      const d = await this.api.get(`users/${this.user.uid}/data/nations`);
      const before = NationLib.list.length;
      const have = new Set(NationLib.list.map((n) => n.id));
      NationLib.parse(JSON.stringify([...NationLib.list, ...(d?.list || []).filter((n) => !have.has(n.id))]));
      NationLib.save();
      this.status = TR`クラウドから国 ${NationLib.list.length - before} つを足した`;
    });
  },
  // --- 部屋 (ネット対戦のつなぎ方): ホストが部屋を作り、席ごとの招待 (WebRTC の offer) を Firestore に置く。部屋の名前が招待コード (4 文字)。
  //     参加者は招待コードで席を取り、返事 (answer) を置く。ホストは返事を見てつなぐ (長いコードを手で渡し合わなくてよい)。
  //     どちらも、ログインしていなければゲストとして自動で入る (ensureUser)。
  //     席 = つながる口 (Net.slots の id)。国とは別で、どの国を動かすかは、つながったあとに部屋の中で選ぶ (依頼 common-3。outward/net.js) ---
  // 招待コードを 1 つ作る。画面のための乱数 (試合の乱数は使わない)
  roomCode() {
    const all = ROOM_LETTERS + ROOM_DIGITS;
    for (;;) {
      let c = '';
      for (let i = 0; i < ROOM_LEN; i++) c += all[Math.floor(Math.random() * all.length)];
      if (/[A-Z]/.test(c) && /[0-9]/.test(c)) return c; // 英字と数字を必ず混ぜる
    }
  },
  // 空いている招待コードを探す: 同じコードの部屋がもうあれば別のコードにする (ほかの人の部屋は、Firestore の決まりで書きかえられない)
  async freeCode() {
    for (let i = 0; i < 12; i++) {
      const code = this.roomCode();
      const cur = await this.api.get(`rooms/${code}`);
      if (!cur || cur.host === this.user.uid) return code;
    }
    throw new Error(TR('空いている招待コードが見つからなかった (もう一度ためす)'));
  },
  // seats: 席を出す口 (まだだれも入っていない口)。席の招待がみなそろってから部屋を返す
  // (そろう前に招待コードを見せると、先に入れた人が「あいている席がない」になる)。作った部屋を Net.room に置くのは呼んだ側 (Net.autoRoom)
  async openRoom(seats) {
    await this.ensureUser();
    await this.dropStale();
    await Promise.all(seats.map((p) => Net.makeOffer(p)));
    if (seats.some((p) => !p.offer)) throw new Error(TR('席の招待を作れなかった (もう一度ためす)'));
    let code = '';
    for (let i = 0; ; i++) {
      code = await this.freeCode();
      try { await this.api.set(`rooms/${code}`, { host: this.user.uid, hostName: this.name(), ed: EDITION, open: true, created: Date.now(), seats: seats.map((p) => ({ pi: p.id })) }); break; } catch (e) { if (i >= 2) throw e; } // 探してから書くまでに同じコードを取られた (とても稀): 引き直す
    }
    const room = { code, host: true, seats: seats.map((p) => p.id), unsub: [] };
    try { localStorage.setItem(ROOM_KEY, code); } catch { /* 保存できない環境 */ }
    for (const peer of seats) {
      await this.api.set(`rooms/${code}/seats/${peer.id}`, { offer: peer.offer });
      peer.name = ''; peer.answered = null; peer.state = TR('参加を待っている');
      room.unsub.push(this.watchSeat(room, peer));
    }
    return room;
  },
  // 席を見張る: 取った人の名前を出し (つながるまでのあいだ)、返事 (answer) が置かれたらつなぐ
  watchSeat(room, peer) {
    return this.api.watch(`rooms/${room.code}/seats/${peer.id}`, (d) => {
      if (d?.name && !peer.joined) peer.name = d.name;
      if (d?.answer && peer.answered !== d.answer) { peer.answered = d.answer; Net.takeAnswer(peer, d.answer); } else Net.redraw();
    });
  },
  // つながらなかった・切れた口の席に、新しい招待を置き直す (Net.reseat から。招待コードはそのまま。席を取った人と返事は消える)
  // コードを作り直したときに人が入っていて席を出していなかった口は、いまの部屋に席を足す
  async reseat(room, peer) {
    await Net.makeOffer(peer);
    if (Net.room !== room || !peer.offer) return; // 作り直しているあいだに、部屋を閉じた
    await this.api.set(`rooms/${room.code}/seats/${peer.id}`, { offer: peer.offer });
    if (!room.seats.includes(peer.id)) {
      room.seats.push(peer.id);
      await this.api.set(`rooms/${room.code}`, { seats: room.seats.map((id) => ({ pi: id })) }, true);
      room.unsub.push(this.watchSeat(room, peer));
    }
    peer.name = ''; peer.answered = null; peer.state = TR('参加を待っている');
  },
  // 部屋を閉じる: 見張りを止め、ホストなら部屋を消す (招待コードが空く)
  closeRoom(room = Net.room) {
    if (!room) return;
    for (const u of room.unsub) u?.();
    room.unsub = [];
    if (room.host) this.dropRoom(room.code, room.seats);
  },
  // 部屋を消す: まず閉じた印 (open: false。途中で止まっても入れない)、次に席、最後に部屋 (席を消せるのは部屋があるあいだのホストだけ)
  async dropRoom(code, seats) {
    try {
      await this.api.set(`rooms/${code}`, { open: false }, true);
      for (const pi of seats || []) await this.api.del(`rooms/${code}/seats/${pi}`);
      await this.api.del(`rooms/${code}`);
      if (localStorage.getItem(ROOM_KEY) === code) localStorage.removeItem(ROOM_KEY);
    } catch { /* つながらないときは残る (期限 ROOM_TTL で入れなくなる。次に部屋を作るときに dropStale でもう一度消す) */ }
  },
  // 前にこの端末で作って閉じ損ねた自分の部屋 (始める前にタブを閉じたなど) を消す
  async dropStale() {
    try {
      const code = localStorage.getItem(ROOM_KEY) || '';
      if (!code || code === Net.room?.code) return;
      const old = await this.api.get(`rooms/${code}`);
      if (old && old.host === this.user.uid) await this.dropRoom(code, (old.seats || []).map((x) => x.pi));
      else localStorage.removeItem(ROOM_KEY);
    } catch { /* 消せなくても先へ進む */ }
  },
  // 参加: 招待コードで、あいている席 (つながる口) を取る (先に取られていたら次の席)。招待を受けて返事を置く。つながると部屋に入り、国は部屋の中で選ぶ。
  // name = ほかの人の画面に出す名前 (入れたときだけ変える)
  async joinRoom(raw, name = '') {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== ROOM_LEN) throw new Error(TR`招待コードは ${ROOM_LEN} 文字 (英字と数字)`);
    await this.ensureUser();
    if (name && name !== this.user.name) {
      try { await this.api.setName(name); await this.api.set(`users/${this.user.uid}`, { name }, true); this.user.name = name; } catch { /* 名前を変えられなくても参加はできる */ }
    }
    const room = await this.api.get(`rooms/${code}`);
    if (!room || !room.open || Date.now() - (room.created || 0) > ROOM_TTL) throw new Error(TR('その招待コードの部屋はない (コードを確かめる。ホストが試合を始めたあと・コードを作り直したあとは、前のコードは使えない)'));
    if ((room.ed || 'game') !== EDITION) throw new Error(TR`${EDITION_LABEL[room.ed || 'game']}の部屋。同じ版どうしでしかつなげない`);
    for (const st of room.seats || []) {
      const path = `rooms/${code}/seats/${st.pi}`;
      const cur = await this.api.get(path);
      if (!cur?.offer || cur.answer || (cur.uid && cur.uid !== this.user.uid)) continue; // 返事の済んだ招待は使えない (ホストが席に新しい招待を置き直すまで)
      await this.api.set(path, { uid: this.user.uid, name: this.name() }, true);
      if ((await this.api.get(path))?.uid !== this.user.uid) continue;
      Net.room = { code, unsub: [] };
      try {
        await Net.join(cur.offer);
        const ans = Net.peers[0]?.answer;
        if (!ans) throw new Error(Net.status || TR('返事を作れなかった'));
        await this.api.set(path, { answer: ans }, true);
      } catch (e) { Net.room = null; throw e; }
      Net.status = TR`招待コード ${code} の部屋に入るところ。つながると、国を選べる`;
      return;
    }
    throw new Error(TR('部屋に入る口があいていない (少し待って入り直すか、ホストに招待コードを作り直してもらう)'));
  },
};
function accountAction(act, id) {
  const C = Cloud;
  const val = (k) => ($(k)?.value || '').trim();
  if (act === 'acctcfg') {
    let cfg;
    try { cfg = JSON.parse(val('acct-cfg').replace(/^[^{]*/, '').replace(/[^}]*$/, '').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"')); } catch { cfg = null; }
    if (!cfg?.apiKey || !cfg?.projectId) { C.status = TR('設定が読めなかった (apiKey と projectId を含む JSON を貼る)'); return renderHome(); }
    try { localStorage.setItem(C.configKey, JSON.stringify(cfg)); } catch { /* 保存できない環境 */ }
    C.status = TR('設定を覚えた。読み込み直すと使われる');
    location.reload();
    return;
  }
  if (act === 'acctcfgdel') { try { localStorage.removeItem(C.configKey); } catch { /* 保存できない環境 */ } location.reload(); return; }
  if (act === 'acctgoogle') return C.run(() => C.api.google(), TR('ログインした'));
  if (act === 'acctguest') return C.run(() => C.api.guest(), TR('ゲストとしてはじめた'));
  if (act === 'acctlogin' || act === 'acctsignup') { const e = val('acct-email'), pw = $('acct-pw')?.value || ''; return C.run(() => C.api.email(e, pw, act === 'acctsignup'), act === 'acctsignup' ? TR('アカウントを作った') : TR('ログインした')); } // 描き直す前に読む
  if (act === 'acctout') return C.run(() => C.api.signOut(), TR('ログアウトした'));
  if (act === 'acctname') return C.setName(val('acct-name').slice(0, 20));
  if (act === 'acctsave') return C.saveGame();
  if (act === 'acctload') return C.loadGame(id);
  if (act === 'acctdel') { if (app.homeArmed !== `cdel${id}`) { app.homeArmed = `cdel${id}`; return renderHome(); } app.homeArmed = null; return C.deleteSave(id); } // 2 回押すと消す
  if (act === 'acctnatpush') return C.pushNations();
  if (act === 'acctnatpull') return C.pullNations();
}
setTimeout(() => { if (Cloud.available()) Cloud.init(); }, 0); // 前にログインしていれば、その状態に戻す
