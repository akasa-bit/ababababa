// アカウントとクラウド (Firebase) の試験。本物の Firebase の代わりに、試験の側 (Node) にデータを置く偽物 (window.__FB_FAKE) を差しこむ。
// 確かめること: ゲストでログイン・名前・クラウドのセーブ (保存・一覧・ロード・削除)・国家の保管庫 (送る・足す)・
// 部屋のコードでのネット対戦 (ホストが部屋を作り、参加者がコードを入れるだけでつながる)・画面 (横と縦)
// 使い方: node tools/tests/cloud.js [shots のフォルダ]
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
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.addInitScript(fake);
    await p.goto(URL); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(500);
    return p;
  };
  const out = {};
  const H = await mk(1280, 780), G = await mk(854, 1200);
  // --- アカウントのタブ: ログイン前 → ゲストでログイン → 名前 ---
  await H.evaluate(() => { if ($('home').hidden) openHome(); });
  await H.click('[data-home="tab"][data-t="account"]'); await H.waitForTimeout(300);
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
  // --- 部屋のコードでネット対戦: ホストは国家選択で人間を 2 人にして「ネット対戦」→「部屋を作る」 ---
  await H.evaluate(() => { openHome(); app.homeTab = 'game'; renderHome(); });
  await H.fill('#home-seed', '5'); await H.selectOption('#home-nat', '5');
  await H.click('[data-home="new"]'); await H.click('[data-home="new"]'); await H.waitForTimeout(400);
  const caps = await H.evaluate(() => __app.game.nations.map((n) => n.cap));
  await H.click(`#pick [data-human="${caps[2]}"]`);
  await H.click('#pick [data-pick="net"]'); await H.waitForTimeout(300);
  await H.click('[data-net="room"]');
  await H.waitForFunction(() => Net.room && Net.peers[0].offer, null, { timeout: 15000 });
  const code = await H.evaluate(() => Net.room.code);
  await H.waitForTimeout(300);
  await H.screenshot({ path: `${SHOTS}/cloud-room-host.png` });
  // 参加者: ログインして、ネット対戦 → 部屋のコードを入れる
  await G.evaluate(() => { if ($('home').hidden) openHome(); app.homeTab = 'account'; renderHome(); });
  await G.click('[data-home="acctguest"]'); await G.waitForFunction(() => Cloud.user);
  await G.fill('#acct-name', '参加さん'); await G.click('[data-home="acctname"]'); await G.waitForTimeout(300);
  await G.evaluate(() => { app.homeTab = 'game'; renderHome(); });
  await G.click('[data-home="netjoin"]');
  await G.fill('#netroom', code.toLowerCase()); await G.click('[data-net="roomjoin"]');
  await H.waitForFunction(() => Net.peers[0].dc && Net.peers[0].dc.readyState === 'open', null, { timeout: 20000 });
  await G.screenshot({ path: `${SHOTS}/cloud-room-guest.png` });
  await H.waitForTimeout(300);
  out.hostSees = await H.evaluate(() => Net.peers[0].guest);
  await H.screenshot({ path: `${SHOTS}/cloud-room-ready.png` });
  await H.click('[data-net="start"]');
  await G.waitForFunction(() => Net.on, null, { timeout: 15000 });
  await H.evaluate(() => setSpeed(SPEEDS[3])); await G.waitForTimeout(2500);
  await H.evaluate(() => setSpeed(0)); await H.waitForTimeout(500); await G.waitForFunction(() => Net.inbox.length === 0);
  out.sync = [await H.evaluate(() => [Net.k, Net.hash()]), await G.evaluate(() => [Net.k, Net.hash(), ME.realm])];
  out.roomClosed = JSON.parse(DB.get(`rooms/${code}`)).open === false;
  out.wide = [await H.evaluate(() => document.documentElement.scrollWidth <= innerWidth), await G.evaluate(() => document.documentElement.scrollWidth <= innerWidth)];
  out.errs = [...H.errs, ...G.errs].slice(0, 5);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
