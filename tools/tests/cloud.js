// アカウントとクラウド (Firebase) の試験。本物の Firebase の代わりに、試験の側 (Node) にデータを置く偽物 (window.__FB_FAKE) を差しこむ。
// 確かめること: ゲストでログイン・名前・クラウドのセーブ (保存・一覧・ロード・削除)・国家の保管庫 (送る・足す)・
// 招待コード (4 文字) でのネット対戦 (2026-11-10 の依頼 common-1・common-2。docs/online.md):
//   ホストはログインしていなくても、ネット対戦の画面を開くだけで招待コードが出る (ゲストで自動ログイン)。コードは英字と数字の 4 文字で、
//   同じコードの部屋がもうあれば別のコードになる。参加者もログインなしで、コードと名前を入れるだけでつながる。期限の切れた部屋・ない部屋には入れない。
//   始める前に参加者が抜けた席は、同じコードのまま入り直せる。始めると部屋は消える (コードが空く)・画面 (横と縦)・
// 試合の途中で切れた参加者が、ホストの作り直した招待コードで同じ国に戻る (回 SO5)。前からログインしていた人 (メール) は、そのアカウントのまま入る。
// 偽物を差しこんでいない自動操作のページ (ほかの試験) は、本物の Firebase につながない (試験が本番にゲストのアカウントや部屋を作らない)
// 使い方: node tools/tests/cloud.js [shots のフォルダ]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: (c) => [c.shots], judge: J.byJson((j) => j.sync[0][1] === j.sync[1][1] && j.roomClosed === true && j.rejoin?.[0] === j.rejoin?.[1] && j.rejoin?.[2] === true && j.room2Closed === true
  && j.code?.every((x) => x === true) && j.auto?.every((x) => x === true) && j.badJoin?.every((x) => x === true) && j.reseat?.every((x) => x === true) && j.kept === true && j.robot?.every((x) => x === true) && !j.errs.length, 'クラウドの結果が違う') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const SHOTS = process.argv[2] || 'shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const { chromium } = require('playwright');
const URL = `file://${HTML}?seed=11`;
const DB = new Map(); // 偽の Firestore: 文書の道筋 → 中身 (JSON)
const store = (op, path, data, merge) => {
  if (op === 'get') return DB.has(path) ? JSON.parse(DB.get(path)) : null;
  if (op === 'set') { const old = merge && DB.has(path) ? JSON.parse(DB.get(path)) : {}; DB.set(path, JSON.stringify(merge ? { ...old, ...data } : data)); return null; }
  if (op === 'del') { DB.delete(path); return null; }
  if (op === 'list') { const pre = `${path}/`; return [...DB.keys()].filter((k) => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map((k) => ({ id: k.slice(pre.length), data: JSON.parse(DB.get(k)) })); }
  return null;
};
// ページに入れる偽物 (Firebase の窓口と同じ形)。watch は 0.2 秒ごとに読み直す
const fake = () => {
  const call = (...a) => window.__fbStore(...a);
  let user = null; const subs = [];
  const tell = () => subs.forEach((cb) => cb(user));
  window.__FB_FAKE = {
    onAuth: (cb) => { subs.push(cb); setTimeout(() => cb(user), 0); },
    google: async () => { throw new Error('偽物では Google は使えない'); },
    email: async (e, pw, create) => { if (!e || (pw || '').length < 6) throw new Error('メールかパスワードが違う'); user = { uid: `e-${e}`, name: '', email: e, guest: false }; tell(); },
    guest: async () => { user = { uid: `g${Math.random().toString(36).slice(2, 8)}`, name: '', email: '', guest: true }; tell(); },
    signOut: async () => { user = null; tell(); },
    setName: async (n) => { user.name = n; },
    get: (p) => call('get', p), set: (p, d, m) => call('set', p, d, !!m), del: (p) => call('del', p), list: (p) => call('list', p),
    watch: (p, cb) => { let last = ''; const t = setInterval(async () => { const d = await call('get', p); const s = JSON.stringify(d); if (s !== last) { last = s; cb(d); } }, 200); return () => clearInterval(t); },
  };
};
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mk = async (vw, vh) => {
    const c = await b.newContext({ viewport: { width: vw, height: vh } });
    await c.exposeFunction('__fbStore', store);
    const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('moribin-evprefs', JSON.stringify({ popup: false })); } catch {} }); // 重大な知らせの窓は切る (窓は newspop で見る)
    await p.addInitScript(fake);
    await p.goto(URL); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(500);
    return p;
  };
  const out = {};
  const H = await mk(1280, 780), G = await mk(854, 1200);
  // --- アカウントのタブ: ログイン前 → ゲストでログイン → 名前 ---
  await H.evaluate(() => { if ($('home').hidden) openHome(); });
  await H.evaluate(() => { app.homeTab = 'account'; renderHome(); }); await H.waitForTimeout(300);
  await H.screenshot({ path: `${SHOTS}/cloud-login-land.png` });
  await H.click('[data-home="acctguest"]'); await H.waitForFunction(() => Cloud.user);
  await H.fill('#acct-name', 'ホストさん'); await H.click('[data-home="acctname"]'); await H.waitForTimeout(300);
  out.name = await H.evaluate(() => [Cloud.name(), Cloud.user.guest]);
  // --- クラウドのセーブ: 少し進めて保存 → 一覧 → 別の端末 (同じアカウント) で読めることは、同じページで読み直して確かめる ---
  const before = await H.evaluate(() => { const g = __app.game; for (let i = 0; i < 40; i++) g.advance(0.25); return [g.year.toFixed(2), JSON.stringify(buildSave(g).colonies).length]; });
  await H.click('[data-home="acctsave"]'); await H.waitForFunction(() => Cloud.saves?.length === 1, null, { timeout: 10000 });
  await H.evaluate(() => { for (let i = 0; i < 40; i++) __app.game.advance(0.25); });
  const id = await H.evaluate(() => Cloud.saves[0].id);
  await H.click(`[data-home="acctload"][data-id="${id}"]`); await H.waitForTimeout(800);
  out.saveLoad = [before[0], await H.evaluate(() => __app.game.year.toFixed(2)), DB.size !== undefined];
  out.parts = [...DB.keys()].filter((k) => k.includes('/parts/')).length;
  // --- 国家の保管庫: 送る → 端末の保管庫を空にして → 足す ---
  await H.evaluate(() => { NationLib.list = [{ id: 'n1', name: 'ミナーラ独立国', species: 'ミナーラ人', traits: ['traders'], env: 'ocean', dist: 'far' }]; NationLib.save(); openHome(); app.homeTab = 'account'; renderHome(); });
  await H.click('[data-home="acctnatpush"]'); await H.waitForTimeout(500);
  await H.evaluate(() => { NationLib.list = []; NationLib.save(); renderHome(); });
  await H.click('[data-home="acctnatpull"]'); await H.waitForTimeout(500);
  out.nations = await H.evaluate(() => NationLib.list.map((n) => n.name));
  await H.screenshot({ path: `${SHOTS}/cloud-account-land.png` });
  // --- 削除 (2 回押す) ---
  await H.click(`[data-home="acctdel"][data-id="${id}"]`); await H.click(`[data-home="acctdel"][data-id="${id}"]`); await H.waitForTimeout(500);
  out.deleted = [await H.evaluate(() => Cloud.saves.length), [...DB.keys()].filter((k) => k.includes('/saves/')).length];
  // --- 招待コードでネット対戦: ホストはログアウトしてから (ログインなしで始める人)、国家選択で人間を 2 人にして「ネット対戦」→ 招待コードが自動で出る ---
  await H.evaluate(() => Cloud.api.signOut()); await H.waitForFunction(() => !Cloud.user);
  await H.evaluate(() => { openHome(); app.homeTab = 'game'; renderHome(); });
  await H.fill('#home-seed', '5'); await H.selectOption('#home-nat', '5');
  await H.click('[data-home="new"]'); await H.click('[data-home="new"]'); await H.waitForTimeout(400);
  const caps = await H.evaluate(() => __app.game.nations.map((n) => n.cap));
  await H.click(`#pick [data-human="${caps[2]}"]`);
  // 最初に引くコードは、ほかの人の部屋がもう使っている (K7P2) → 別のコードになる。その部屋は書きかえない
  DB.set('rooms/K7P2', JSON.stringify({ host: 'someone-else', open: true, created: Date.now(), seats: [] }));
  await H.evaluate(() => { const real = Cloud.roomCode.bind(Cloud); let n = 0; Cloud.roomCode = () => (n++ ? real() : 'K7P2'); });
  await H.click('#pick [data-pick="net"]');
  await H.waitForFunction(() => Net.room && Net.peers[0].offer, null, { timeout: 15000 });
  const code = await H.evaluate(() => Net.room.code);
  const picked = await H.evaluate(() => Array.from({ length: 300 }, () => Cloud.roomCode()));
  // code: [4 文字で英字と数字が混ざる, 使われていたコードは避けた, ほかの人の部屋はそのまま, 作るコードはどれも 4 文字・見間違える字と母音なし・英字と数字の両方]
  out.code = [/^[BCDFGHJKMNPQRSTVWXYZ2-9]{4}$/.test(code) && /[A-Z]/.test(code) && /[2-9]/.test(code), code !== 'K7P2', JSON.parse(DB.get('rooms/K7P2')).host === 'someone-else',
    picked.every((c) => /^[BCDFGHJKMNPQRSTVWXYZ2-9]{4}$/.test(c) && /[A-Z]/.test(c) && /[2-9]/.test(c))];
  out.roomCode = code;
  // auto: [ホストはゲストで自動ログインした, 画面に招待コードが出ている, 長いコードの欄は出ていない]
  out.auto = [await H.evaluate(() => Cloud.user?.guest === true), await H.evaluate((c) => document.querySelector('#netbox .roomcode')?.textContent === c, code), await H.evaluate(() => !document.querySelector('#netbox [data-net="offer"]'))];
  await H.waitForTimeout(300);
  await H.screenshot({ path: `${SHOTS}/cloud-room-host.png` });
  // 参加者: ログインしないで、ホーム → マルチプレイ → 参加する → 招待コードと名前を入れる
  await G.evaluate(() => { if ($('home').hidden) openHome(); app.homeTab = 'multi'; renderHome(); });
  await G.click('[data-home="netjoin"]');
  await G.screenshot({ path: `${SHOTS}/cloud-room-join.png` });
  // ない部屋・期限の切れた部屋・字数の違うコードには入れない
  DB.set('rooms/Z9Z9', JSON.stringify({ host: 'old-host', open: true, ed: 'game', created: Date.now() - 25 * 3600e3, seats: [{ pi: 1, realm: '古い国' }] }));
  DB.set('rooms/Z9Z9/seats/1', JSON.stringify({ offer: 'x', realm: '古い国' }));
  const tryJoin = async (c) => { await G.fill('#netcode', c); await G.click('[data-net="roomjoin"]'); await G.waitForFunction(() => !Net.joining && (Net.joinErr || Net.room), null, { timeout: 15000 }); return G.evaluate(() => [!!Net.joinErr, !Net.room, document.querySelector('#netbox .bad')?.textContent || '']); };
  const bad = [await tryJoin('Q2Q2'), await tryJoin('Z9Z9'), await tryJoin('AB')];
  out.badJoin = bad.map((x) => x[0] && x[1] && x[2].length > 0);
  out.badText = bad.map((x) => x[2]);
  await G.fill('#netcode', ` ${code.toLowerCase()} `); await G.fill('#netname', '参加さん'); await G.press('#netcode', 'Enter'); // 小文字と空白まじり・Enter でも入れる
  await H.waitForFunction(() => Net.peers[0].dc && Net.peers[0].dc.readyState === 'open', null, { timeout: 20000 });
  await G.screenshot({ path: `${SHOTS}/cloud-room-guest.png` });
  await H.waitForTimeout(300);
  out.hostSees = await H.evaluate(() => Net.peers[0].guest);
  out.auto.push(await G.evaluate(() => Cloud.user?.guest === true), out.hostSees === '参加さん'); // 参加者もゲストで自動ログイン・名前がホストに出る
  await H.screenshot({ path: `${SHOTS}/cloud-room-ready.png` });
  // 始める前に参加者が抜けた (タブを閉じた) → ホストは同じ招待コードのまま、席に新しい招待を置き直す → 別の端末が同じコードで入れる
  await G.close();
  await H.waitForFunction(() => Net.peers[0].dc?.readyState !== 'open' && !Net.peers[0].reseating && !!Net.peers[0].offer && Net.peers[0].guest === '', null, { timeout: 90000 });
  const seatAfter = JSON.parse(DB.get(`rooms/${code}/seats/${await H.evaluate(() => Net.peers[0].pi)}`));
  const G1 = await mk(854, 1200);
  await G1.evaluate(() => { if ($('home').hidden) openHome(); app.homeTab = 'multi'; renderHome(); });
  await G1.click('[data-home="netjoin"]');
  await G1.fill('#netcode', code); await G1.fill('#netname', '入り直しさん'); await G1.click('[data-net="roomjoin"]');
  await H.waitForFunction(() => Net.peers[0].dc && Net.peers[0].dc.readyState === 'open', null, { timeout: 20000 });
  await H.waitForTimeout(300);
  // reseat: [同じコードのまま, 置き直した席には前の人と返事が残っていない, 入り直した人の名前が出る]
  out.reseat = [await H.evaluate((c) => Net.room?.code === c, code), !seatAfter.uid && !seatAfter.answer && !!seatAfter.offer, await H.evaluate(() => Net.peers[0].guest) === '入り直しさん'];
  await H.click('[data-net="start"]');
  await G1.waitForFunction(() => Net.on, null, { timeout: 15000 });
  await H.evaluate(() => setSpeed(SPEEDS[3])); await G1.waitForTimeout(2500);
  await H.evaluate(() => setSpeed(0)); await H.waitForTimeout(500); await G1.waitForFunction(() => Net.inbox.length === 0);
  out.sync = [await H.evaluate(() => [Net.k, Net.hash()]), await G1.evaluate(() => [Net.k, Net.hash(), ME.realm])];
  await H.waitForTimeout(500);
  out.roomClosed = !DB.has(`rooms/${code}`) && ![...DB.keys()].some((k) => k.startsWith(`rooms/${code}/`)); // 始めたら部屋は消える (招待コードが空く)
  out.wide = [await H.evaluate(() => document.documentElement.scrollWidth <= innerWidth), await G1.evaluate(() => document.documentElement.scrollWidth <= innerWidth)];
  // --- 試合の途中で参加者のタブが閉じた → ホストが招待コードを作り直す → 新しく開いた参加者がそのコードで同じ国に戻る (回 SO5) ---
  const gpi = await G1.evaluate(() => Net.pi);
  await G1.close();
  await H.waitForFunction(() => Net.left.length === 1, null, { timeout: 90000 });
  await H.evaluate(() => Net.render());
  await H.click('[data-net="room"]');
  await H.waitForFunction(() => Net.room && Net.left[0]?.offer, null, { timeout: 15000 });
  const code2 = await H.evaluate(() => Net.room.code);
  await H.screenshot({ path: `${SHOTS}/cloud-room-rejoin.png` });
  // 戻る人は、前からメールでログインしていた: ゲストに切りかわらず、そのアカウントのまま入る
  const G2 = await mk(854, 1200);
  await G2.evaluate(() => { if ($('home').hidden) openHome(); app.homeTab = 'account'; renderHome(); });
  await G2.fill('#acct-email', 'friend@example.com'); await G2.fill('#acct-pw', 'secret1'); await G2.click('[data-home="acctsignup"]'); await G2.waitForFunction(() => Cloud.user);
  await G2.evaluate(() => { app.homeTab = 'multi'; renderHome(); });
  await G2.click('[data-home="netjoin"]');
  await G2.fill('#netcode', code2); await G2.click('[data-net="roomjoin"]');
  await G2.waitForFunction(() => Net.on, null, { timeout: 20000 });
  out.kept = await G2.evaluate(() => Cloud.user?.guest === false && Cloud.user.email === 'friend@example.com');
  await H.evaluate(() => setSpeed(SPEEDS[3])); await G2.waitForTimeout(2000);
  await H.evaluate(() => setSpeed(0)); await H.waitForTimeout(500); await G2.waitForFunction(() => Net.inbox.length === 0);
  out.rejoin = [await H.evaluate(() => Net.hash()), await G2.evaluate(() => Net.hash()), await H.evaluate((pi) => __app.game.players[pi].human, gpi), await G2.evaluate(() => ME.realm)];
  await H.waitForTimeout(500);
  out.room2Closed = !DB.has(`rooms/${code2}`);
  out.rooms = [...DB.keys()].filter((k) => k.startsWith('rooms/')); // 残っているのは、試験が先に置いたほかの人の部屋だけ
  // --- 偽物を差しこんでいない自動操作のページ (ほかの試験と同じ開き方) は、本物の Firebase につながない: JS も読まず、ネット対戦の画面は長いコードの方法だけ ---
  const R = await (await b.newContext()).newPage(); const fb = [];
  R.on('request', (r) => { if (/firebase|identitytoolkit|firestore\.googleapis/.test(r.url())) fb.push(r.url()); });
  await R.goto(URL); await R.waitForFunction(() => window.__app && __app.game); await R.waitForTimeout(800);
  await R.evaluate(() => { closeHome(0); Net.openJoin(); });
  out.robot = [await R.evaluate(() => navigator.webdriver === true && !Cloud.available() && !Cloud.api), fb.length === 0, await R.evaluate(() => !document.querySelector('#netcode') && !!document.querySelector('#netinvite'))];
  out.errs = [...H.errs, ...G.errs, ...G1.errs, ...G2.errs].slice(0, 5);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
