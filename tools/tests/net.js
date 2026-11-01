// ネット対戦: 2 つのページを WebRTC でつなぎ、命令の受け渡し・状態の要約の一致・わざと壊したときの合わせ直し。
// 回 SO5 (B-248。友達と遊ぶ準備): 短い版 (100 年) で、ホストが止めたら参加者の速さも止まる・ネット対戦でも記録の同意を聞く・
// 参加者のタブが閉じたら AI に任せ、招待を作り直すと同じ国に戻れる・2400 年の終わりまで両方の端末でずれない (書き出しの表も同じ)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{
  judge: (o) => {
    const m = o.match(/sync2 \[ \[ \d+, '(\w+)', '[\d.]+' \], \[ \d+, '(\w+)', '[\d.]+', (\d+) \] \]/);
    const ga = o.match(/^galaxy gen (\d+) gen (\d+)$/m); // 親が自動生成の星図を選び、参加者も同じ星図 (回 GA10)
    if (!(m && m[1] === m[2] && m[3] === '1' && /errs \[\] \[\]/.test(o) && /^physics true/m.test(o) && ga && ga[1] === ga[2])) return 'ネット対戦の要約か星図が合わない';
    if (!/^pause 0 0$/m.test(o)) return 'ホストが止めても参加者の速さが止まらない';
    if (!/^consent true true$/m.test(o)) return 'ネット対戦で記録の同意を聞いていない';
    if (!/^late 1 false 1$/m.test(o)) return '始めるときにつながっていない席を、AI に任せて入っていない席に残していない';
    if (!/^drop false 0 2$/m.test(o)) return '参加者が切れたのに AI に任せていない';
    const r = o.match(/^rejoin (\w+) (\w+) true$/m);
    if (!r || r[1] !== r[2]) return '招待を作り直して戻った参加者が、ホストとずれた';
    const e = o.match(/^end (\w+) (\w+) true true (\S+) (\S+)$/m);
    return e && e[1] === e[2] && e[3] === e[4] ? '' : '100 年の終わりで、ホストと参加者がずれた (要約か書き出しの表か終わりの画面)';
  },
}];
if (require.main !== module) return;
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
  await H.selectOption('#home-galaxy', 'gen'); // 自動生成の星図 (回 GA10)。参加者も親のセーブから同じ星図を作り直す
  await H.selectOption('#home-end', '100'); // 短い試遊の版 (2400 年まで。回 GA11)。最後まで通す (回 SO5)
  await H.click('[data-home="new"]'); await H.waitForTimeout(400);
  const caps = await H.evaluate(() => __app.game.nations.map((n) => n.cap));
  await H.click(`#pick [data-human="${caps[2]}"]`);
  await H.click(`#pick [data-human="${caps[3]}"]`); // 3 人目の席は、始めるときにつながっていない (遅れて来る人。回 SO5)
  await H.click('#pick [data-pick="net"]'); await H.waitForTimeout(300);
  await H.click('[data-net="offer"]');
  await H.waitForSelector('#netoffer0', { timeout: 15000 });
  const offer = await H.inputValue('#netoffer0');
  await H.screenshot({ path: 'shots/net-host.png' });
  await G.evaluate(() => { if ($('home').hidden) openHome(); app.homeTab = 'multi'; renderHome(); });
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
  console.log('late', ...(await H.evaluate(() => [Net.left.length, Net.left.map((p) => __app.game.players[p.pi].human).join(','), Net.peers.length]))); // つながっていない席は AI に任せ、入っていない席として残る
  const chart = () => { const g = __app.game.galaxy; let h = 0; for (const ch of JSON.stringify(g.systems.map((s) => [s.name, s.x, s.y, s.z, s.stars.map((t) => t.cls)]))) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `${g.kind} ${h}`; };
  console.log('galaxy', await H.evaluate(chart), await G.evaluate(chart)); // 親と参加者の星図
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
  // 参加者が、ホストの送った最後のコマ (Net.k) まで実行し終えるのを待つ (受け箱が空でも、まだ線の上にあるコマがある。CI の重いときにずれて見えた)
  const caught = async (P) => { const k = await H.evaluate(() => Net.k); await P.waitForFunction((k) => Net.k >= k && Net.inbox.length === 0, k, { timeout: 60000, polling: 200 }); };
  const sync = async () => { await H.evaluate(() => setSpeed(0)); await H.waitForTimeout(500); await caught(G); return [await H.evaluate(() => [Net.k, Net.hash(), __app.game.year.toFixed(2)]), await G.evaluate(() => [Net.k, Net.hash(), __app.game.year.toFixed(2), Net.resyncs])]; };
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
  // 物理の切り替え (遮蔽・加速の時間) は試合に入っていて、ホストと客で同じ (ずれると便の記帳と到着の年が合わない)
  const phys = [await H.evaluate(() => JSON.stringify(__app.game.physics)), await G.evaluate(() => JSON.stringify(__app.game.physics))];
  const ed = await H.evaluate(() => JSON.stringify(ED.physics));
  console.log('physics', phys[0] === phys[1] && phys[0] === ed, phys[0]);
  // ホストが止めると、参加者の速さのボタンも止まる (空のコマで知らせる)
  await H.evaluate(() => setSpeed(SPEEDS[3])); await G.waitForTimeout(800);
  await H.evaluate(() => setSpeed(0)); await G.waitForTimeout(800);
  console.log('pause', await H.evaluate(() => app.speed), await G.evaluate(() => app.speed));
  // ネット対戦でも、記録の同意を帯で聞く (友達と遊んだ記録を残せるように)
  console.log('consent', await H.evaluate(() => !!document.querySelector('#rail .consent')), await G.evaluate(() => !!document.querySelector('#rail .consent')));
  await G.click('#rail [data-consent="yes"]');
  // 参加者のタブが閉じた: ホストはつながりの failed で気づき、その国を AI に任せる
  const gpi = gi[0];
  await G.close();
  await H.waitForFunction(() => Net.left.length === 2, null, { timeout: 90000 });
  await H.waitForTimeout(500);
  console.log('drop', ...(await H.evaluate((pi) => [__app.game.players[pi].human, Net.peers.length, Net.left.length], gpi)));
  // ホストが招待を作り直し、新しく開いた参加者が同じ国に戻る
  await H.evaluate(() => Net.render());
  const li = await H.evaluate((pi) => Net.left.findIndex((p) => p.pi === pi), gpi);
  await H.click(`[data-net="reoffer"][data-i="${li}"]`); await H.waitForSelector(`#netreoffer${li}`, { timeout: 15000 });
  const offer2 = await H.inputValue(`#netreoffer${li}`);
  await H.screenshot({ path: 'shots/net-host-rejoin.png' });
  const G2 = await mk(854, 1200);
  await G2.evaluate(() => { if ($('home').hidden) openHome(); app.homeTab = 'multi'; renderHome(); });
  await G2.click('[data-home="netjoin"]');
  await G2.fill('#netinvite', offer2); await G2.click('[data-net="join"]');
  await G2.waitForSelector('#netanswer', { timeout: 15000 });
  await H.fill(`#netreans${li}`, await G2.inputValue('#netanswer')); await H.click(`[data-net="reanswer"][data-i="${li}"]`);
  await G2.waitForFunction(() => Net.on, null, { timeout: 20000 });
  await H.evaluate(() => setSpeed(SPEEDS[4])); await G2.waitForTimeout(3000);
  await H.evaluate(() => setSpeed(0)); await H.waitForTimeout(500); await caught(G2);
  console.log('rejoin', await H.evaluate(() => Net.hash()), await G2.evaluate(() => Net.hash()), await H.evaluate((pi) => __app.game.players[pi].human, gpi));
  // 2400 年の終わりまで進める: 両方の端末で終わりの画面が出て、要約と書き出しの表 (国 × 年) が同じ
  await H.evaluate(() => setSpeed(SPEEDS[6]));
  await H.waitForFunction(() => __app.game.ended, null, { timeout: 300000, polling: 1000 });
  await G2.waitForFunction(() => __app.game.ended && Net.inbox.length === 0, null, { timeout: 60000, polling: 500 });
  await caught(G2);
  // 終わりの画面は描くときに出る (後ろのページは描くのが遅れることがあるので、前に出して待つ)
  for (const P of [H, G2]) { await P.bringToFront(); await P.waitForFunction(() => !$('endbox').hidden, null, { timeout: 30000, polling: 250 }).catch(() => {}); }
  await G2.waitForTimeout(500);
  const fin = () => [Net.hash(), !$('endbox').hidden, Object.entries(__app.game.xrec?.rows || {}).map(([k, v]) => `${k}:${v.length}`).join(','), xrecCsv(__app.game, 'sna').length];
  const hf = await H.evaluate(fin), gf = await G2.evaluate(fin);
  console.log('end', hf[0], gf[0], hf[1], gf[1], `${hf[2]}/${hf[3]}`, `${gf[2]}/${gf[3]}`);
  await H.screenshot({ path: 'shots/net-host-end.png' }); await G2.screenshot({ path: 'shots/net-guest-end.png' });
  console.log('guest playlog', await G2.evaluate(() => [PlayLog.on, PlayLog.cur?.net]), 'errs2', G2.errs.slice(0, 3));
  console.log('guest', gi, 'sys', gc, '\nsync1', s1, '\nguest chk', chk, '\nhost', hostView, '\nsync2', s2, '\nerrs', H.errs.slice(0, 3), [...G.errs, ...G2.errs].slice(0, 3));
  await b.close();
})();
