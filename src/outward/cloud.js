// --- アカウントとクラウド (Firebase。docs/online.md) ---
// Firebase のプロジェクトの設定 (Firebase のコンソールの「ウェブアプリ」の firebaseConfig)。null なら、アカウントの機能は出さない。
// ホーム画面の「アカウント」タブから、端末ごとに設定を貼って試すこともできる (ブラウザに覚える)
const FIREBASE_CONFIG = null;
const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CLOUD_PART = 700000; // クラウドのセーブを分けて置く 1 つの大きさ [文字] (Firestore の文書は 1 MiB まで)
const ROOM_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 部屋のコードに使う字 (見間違えやすい I・L・O・0・1 を除く)
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
  available() { return !!(window.__FB_FAKE || this.config()); },
  async init() {
    if (this.api) return true;
    if (!this.available()) return false;
    try { this.api = window.__FB_FAKE || (await firebaseApi(this.config())); } catch (e) { this.status = `Firebase につなげなかった (${e.message || e})`; this.refresh(); return false; }
    this.api.onAuth((u) => {
      this.user = u;
      this.saves = null;
      if (u) this.api.get(`users/${u.uid}`).then((d) => { if (d?.name && !u.name) u.name = d.name; this.refresh(); }).catch(() => {});
      this.refresh();
    });
    return true;
  },
  refresh() {
    if (app.homeOpen && app.homeTab === 'account') renderHome();
    if (!$('netbox').hidden && !Net.on) Net.render();
  },
  // 時間のかかる操作: 結果を status に書いて画面を描き直す
  async run(fn, done) {
    this.status = '…';
    this.refresh();
    try { await fn(); this.status = done || ''; } catch (e) { this.status = `できなかった: ${e.message || e}`; }
    this.refresh();
  },
  name() { return this.user?.name || (this.user?.guest ? 'ゲスト' : this.user?.email) || '名前なし'; },
  setName(n) { return this.run(async () => { await this.api.setName(n); await this.api.set(`users/${this.user.uid}`, { name: n }, true); this.user.name = n; }, '名前を変えた'); },
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
    }, 'クラウドに保存した');
  },
  loadGame(id) {
    return this.run(async () => {
      const m = this.saves?.find((x) => x.id === id) || (await this.api.get(`${this.savesPath()}/${id}`));
      if (!m) throw new Error('セーブがない');
      if ((m.ed || 'game') !== EDITION) throw new Error(`${EDITION_LABEL[m.ed || 'game']}のセーブ`);
      let code = '';
      for (let i = 0; i < m.parts; i++) code += (await this.api.get(`${this.savesPath()}/${id}/parts/${i}`))?.s || '';
      const d = await Net.unpack(code);
      if (!loadSave(d)) throw new Error('読めないセーブ');
      save();
      app.game.message('クラウドのセーブをロードした (一時停止中)。');
      closeHome();
      setSpeed(0);
    }, 'ロードした');
  },
  deleteSave(id) {
    return this.run(async () => {
      const m = this.saves?.find((x) => x.id === id);
      for (let i = 0; i < (m?.parts || 0); i++) await this.api.del(`${this.savesPath()}/${id}/parts/${i}`);
      await this.api.del(`${this.savesPath()}/${id}`);
      await this.listSaves();
    }, '消した');
  },
  // --- 国家の保管庫 (国家づくりで作った国) をアカウントに置く ---
  pushNations() { return this.run(() => this.api.set(`users/${this.user.uid}/data/nations`, { list: JSON.parse(JSON.stringify(NationLib.list)), savedAt: Date.now() }), `国 ${NationLib.list.length} つをクラウドに送った`); },
  pullNations() {
    return this.run(async () => {
      const d = await this.api.get(`users/${this.user.uid}/data/nations`);
      const before = NationLib.list.length;
      const have = new Set(NationLib.list.map((n) => n.id));
      NationLib.parse(JSON.stringify([...NationLib.list, ...(d?.list || []).filter((n) => !have.has(n.id))]));
      NationLib.save();
      this.status = `クラウドから国 ${NationLib.list.length - before} つを足した`;
    });
  },
  // --- 部屋 (ネット対戦のつなぎ方): ホストが部屋を作り、席ごとの招待 (offer) を Firestore に置く。
  //     参加者は部屋のコードで席を取り、返事 (answer) を置く。ホストは返事を見てつなぐ (手でコードを渡し合わなくてよい) ---
  async openRoom() {
    const g = app.game;
    let code = '';
    for (let i = 0; i < 6; i++) code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]; // 画面のための乱数 (試合の乱数は使わない)
    const room = { code, unsub: [] };
    Net.room = room;
    await this.api.set(`rooms/${code}`, { host: this.user.uid, hostName: this.name(), ed: EDITION, open: true, created: Date.now(), seats: Net.peers.map((p) => ({ pi: p.pi, realm: g.realmName(p.cap) })) });
    for (const peer of Net.peers) {
      await Net.makeOffer(peer);
      await this.api.set(`rooms/${code}/seats/${peer.pi}`, { offer: peer.offer, realm: g.realmName(peer.cap) });
      room.unsub.push(this.api.watch(`rooms/${code}/seats/${peer.pi}`, (d) => {
        if (d?.name) peer.guest = d.name;
        if (d?.answer && peer.answered !== d.answer) { peer.answered = d.answer; Net.takeAnswer(peer, d.answer); } else Net.render();
      }));
    }
    Net.render();
  },
  closeRoom() {
    const room = Net.room;
    if (!room) return;
    for (const u of room.unsub) u?.();
    room.unsub = [];
    if (Net.role === 'host') this.api.set(`rooms/${room.code}`, { open: false }, true).catch(() => {});
  },
  // 参加: 部屋のコードで、あいている席を取る (先に取られていたら次の席)。招待を受けて返事を置く
  async joinRoom(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = await this.api.get(`rooms/${code}`);
    if (!room || !room.open) throw new Error('その部屋はない (コードを確かめて)');
    if ((room.ed || 'game') !== EDITION) throw new Error(`${EDITION_LABEL[room.ed || 'game']}の部屋。同じ版どうしでしかつなげない`);
    for (const st of room.seats || []) {
      const path = `rooms/${code}/seats/${st.pi}`;
      const cur = await this.api.get(path);
      if (!cur?.offer || (cur.uid && cur.uid !== this.user.uid)) continue;
      await this.api.set(path, { uid: this.user.uid, name: this.name() }, true);
      if ((await this.api.get(path))?.uid !== this.user.uid) continue;
      Net.room = { code, unsub: [] };
      await Net.join(cur.offer);
      const ans = Net.peers[0]?.answer;
      if (!ans) throw new Error(Net.status || '返事を作れなかった');
      await this.api.set(path, { answer: ans }, true);
      Net.status = `部屋 ${code} の席 (${st.realm}) についた。ホストが始めるのを待つ`;
      return;
    }
    throw new Error('あいている席がない');
  },
};
function accountAction(act, id) {
  const C = Cloud;
  const val = (k) => ($(k)?.value || '').trim();
  if (act === 'acctcfg') {
    let cfg;
    try { cfg = JSON.parse(val('acct-cfg').replace(/^[^{]*/, '').replace(/[^}]*$/, '').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"')); } catch { cfg = null; }
    if (!cfg?.apiKey || !cfg?.projectId) { C.status = '設定が読めなかった (apiKey と projectId を含む JSON を貼る)'; return renderHome(); }
    try { localStorage.setItem(C.configKey, JSON.stringify(cfg)); } catch { /* 保存できない環境 */ }
    C.status = '設定を覚えた。読み込み直すと使われる';
    location.reload();
    return;
  }
  if (act === 'acctcfgdel') { try { localStorage.removeItem(C.configKey); } catch { /* 保存できない環境 */ } location.reload(); return; }
  if (act === 'acctgoogle') return C.run(() => C.api.google(), 'ログインした');
  if (act === 'acctguest') return C.run(() => C.api.guest(), 'ゲストとしてはじめた');
  if (act === 'acctlogin' || act === 'acctsignup') { const e = val('acct-email'), pw = $('acct-pw')?.value || ''; return C.run(() => C.api.email(e, pw, act === 'acctsignup'), act === 'acctsignup' ? 'アカウントを作った' : 'ログインした'); } // 描き直す前に読む
  if (act === 'acctout') return C.run(() => C.api.signOut(), 'ログアウトした');
  if (act === 'acctname') return C.setName(val('acct-name').slice(0, 20));
  if (act === 'acctsave') return C.saveGame();
  if (act === 'acctload') return C.loadGame(id);
  if (act === 'acctdel') { if (app.homeArmed !== `cdel${id}`) { app.homeArmed = `cdel${id}`; return renderHome(); } app.homeArmed = null; return C.deleteSave(id); } // 2 回押すと消す
  if (act === 'acctnatpush') return C.pushNations();
  if (act === 'acctnatpull') return C.pullNations();
}
setTimeout(() => { if (Cloud.available()) Cloud.init(); }, 0); // 前にログインしていれば、その状態に戻す
