// ネット対戦: 2 つのページを WebRTC でつなぎ、命令の受け渡し・状態の要約の一致・わざと壊したときの合わせ直し
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
const URL = `file://${HTML}?seed=11`;
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mk = async (vw, vh) => { const c = await b.newContext({ viewport: { width: vw, height: vh } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message + ' ' + (e.stack || '').split('\n')[1])); await p.addInitScript(() => { try { localStorage.clear(); } catch {} }); await p.goto(URL); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(600); return p; };
  const H = await mk(1280, 780), G = await mk(854, 1200);
  await H.evaluate(() => { if ($('home').hidden) openHome(); });
  await H.fill('#home-seed', '5'); await H.selectOption('#home-nat', '5');
  await H.click('[data-home="new"]'); await H.click('[data-home="new"]'); await H.waitForTimeout(400);
  const caps = await H.evaluate(() => __app.game.nations.map((n) => n.cap));
  await H.click(`#pick [data-human="${caps[2]}"]`);
  await H.click('#pick [data-pick="net"]'); await H.waitForTimeout(300);
  await H.click('[data-net="offer"]');
  await H.waitForSelector('#netoffer0', { timeout: 15000 });
  const offer = await H.inputValue('#netoffer0');
  await H.screenshot({ path: 'shots/net-host.png' });
  await G.evaluate(() => { if ($('home').hidden) openHome(); });
  await G.click('[data-home="netjoin"]');
  await G.fill('#netinvite', offer); await G.click('[data-net="join"]');
  await G.waitForSelector('#netanswer', { timeout: 15000 });
  const answer = await G.inputValue('#netanswer');
  await G.screenshot({ path: 'shots/net-guest.png' });
  await H.fill('#netans0', answer); await H.click('[data-net="answer"]');
  await H.waitForFunction(() => Net.peers[0].dc && Net.peers[0].dc.readyState === 'open', null, { timeout: 15000 });
  await H.waitForTimeout(300);
  await H.click('[data-net="start"]');
  await G.waitForFunction(() => Net.on, null, { timeout: 15000 });
  console.log('codes', offer.length, answer.length);
  const hook = () => { window.__st = {}; const orig = Net.hash.bind(Net); Net.hash = function () { const d = { ...buildSave(__app.game) }; for (const k of ['pi', 'savedAt', 'endShown', 'spectate', 'credits', ...PLAYER_KEYS]) delete d[k]; window.__st[this.k] = JSON.stringify(d); const ks = Object.keys(window.__st); if (ks.length > 30) delete window.__st[ks[0]]; return orig(); }; };
  await H.evaluate(hook); await G.evaluate(hook);
  await G.evaluate(() => { const sd = Net.send.bind(Net); window.__gbad = []; Net.send = function (p, o) { if (o.t === 'resync') window.__gbad.push({ k: o.k, s: window.__st[o.k] }); return sd(p, o); }; });
  const gi = await G.evaluate(() => [Net.pi, __app.game.cap, __app.game.pi, ME.realm]);
  await H.evaluate(() => setSpeed(SPEEDS[3]));
  await G.waitForTimeout(1500);
  // guest orders a fleet and toggles a setting
  const gc = await G.evaluate(() => { const g = __app.game; const t = g.nearSystems(g.cap).find(([id, d]) => id !== g.cap && d > 2)[0]; issue('fleet', { from: g.cap, sys: t, n: 1 }); issue('set', { key: 'autoDefense', value: true }); return t; });
  // guest asks for faster speed
  await G.click('[data-speed="4"]');
  await G.waitForTimeout(6000);
  const sync = async () => { await H.evaluate(() => setSpeed(0)); await H.waitForTimeout(500); await G.waitForFunction(() => Net.inbox.length === 0); return [await H.evaluate(() => [Net.k, Net.hash(), __app.game.year.toFixed(2)]), await G.evaluate(() => [Net.k, Net.hash(), __app.game.year.toFixed(2), Net.resyncs])]; };
  const s1 = await sync();
  const chk = await G.evaluate((gp) => { const g = __app.game; return [g.autoDefense, g.players[Net.pi].autoDefense, g.fleets.some((f) => (f.owner ?? 0) === g.cap) || (g.garrison[gp] || 0) > 0, g.knownLog().slice(0, 3).map((l) => l.text).join(' / ')]; }, gc);
  const hostView = await H.evaluate(() => [__app.game.pi, __app.game.players.map((p) => p.autoDefense).join(','), __app.speed]);
  const gb = await G.evaluate(() => window.__gbad);
  for (const { k, s } of gb) {
    const hs = await H.evaluate((k) => window.__st[k], k);
    if (!hs || !s) { console.log('mismatch at', k, 'no state'); continue; }
    const a = JSON.parse(hs), c = JSON.parse(s);
    const diff = Object.keys(a).filter((x) => JSON.stringify(a[x]) !== JSON.stringify(c[x]));
    console.log('mismatch at', k, diff.join(','));
    for (const x of diff.slice(0, 3)) { const A = JSON.stringify(a[x]), C = JSON.stringify(c[x]); let i = 0; while (A[i] === C[i]) i++; console.log(' ', x, A.slice(Math.max(0, i - 200), i + 100), '\n   VS', C.slice(Math.max(0, i - 200), i + 100)); }
  }
  // corrupt the guest, run until next checksum -> resync
  await G.evaluate(() => { __app.game.colonies[0].pop += 1; });
  await H.evaluate(() => setSpeed(SPEEDS[4]));
  await G.waitForTimeout(6000);
  const s2 = await sync();
  await H.screenshot({ path: 'shots/net-host-play.png' }); await G.screenshot({ path: 'shots/net-guest-play.png' });
  console.log('all resyncs', await G.evaluate(() => window.__gbad.map((x) => x.k)));
  console.log('guest', gi, 'sys', gc, '\nsync1', s1, '\nguest chk', chk, '\nhost', hostView, '\nsync2', s2, '\nerrs', H.errs.slice(0, 3), G.errs.slice(0, 3));
  await b.close();
})();
