// 重大な知らせの窓と、地図を回す向き (2026-11-01 のユーザーの依頼。docs/requests/2026-11-01-GA.md の GA-1・GA-2) の試験。公開用の index.html をブラウザで開いて確かめる:
//   1. 新しく届いた重大な知らせが、画面の真ん中の窓に出て、時間が止まる。「確かめた」で閉じると確かめたことになり、もとの速さに戻る
//   2. 「あとで」で閉じると、確かめたことにはならず、知らせの帯に残る
//   3. イベントのタブで窓を切ると、出ない
//   4. 「回す」を押して 1 本指で動かすと、指の下の星が指について動く (画面の上半分でも下半分でも)。2 本指でひねると、指と同じ向きに回る
//   5. 横 1280×780 と縦 854×1200 で、ページが横にはみ出さない
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: (c) => [c.shots], judge: J.byJson((j) => ['land', 'port'].every((t) => j[t]?.shown && j[t].paused && j[t].acked && j[t].resumed && j[t].later && j[t].off && j[t].rotTop > 0 && j[t].rotBottom > 0 && j[t].twist > 0 && j[t].wide && !j[t].errs.length), '重大な知らせの窓か地図を回す向きの結果が違う') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const SHOTS = process.argv[2] || 'shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const out = {};
  for (const [tag, vp] of [['land', { width: 1280, height: 780 }], ['port', { width: 854, height: 1200 }]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const until = (fn, arg) => p.waitForFunction(fn, arg, { timeout: 8000 }).catch(() => {});
    await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('moribin-playlog-consent', 'no'); } catch {} });
    await p.goto(`file://${HTML}?seed=11&home=0`); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(600);
    await p.evaluate(() => { newGame('11'); __app.speed = 0; const g = __app.game; g.setSpectate(true); for (let i = 0; i < 80; i++) g.advance(0.25); g.setSpectate(false); $('endbox').hidden = true; app.setView('galaxy'); app.dirty = true; });
    await p.waitForTimeout(1300); // 帯が 1 度描かれて、いま出ている知らせを「見た」ことにする
    const r = { errs };
    // 1. 重大な知らせを 1 つ起こす (首都の政治。光の遅れなしで届く)
    // いちばん遅い速さ (1 か月/秒。SPEEDS[1]) で動かしておく。ほかの知らせが同じころに届けば「あとで」で送り、試験の知らせだけを押す
    // 知らせの予算 (40 年に 12 件) を空けるため、いま出ている知らせはすべて確かめておく
    const inject = (t) => p.evaluate((t) => { const g = __app.game; issue('set', { key: 'acked', value: g.knownEvents().map((e) => e.id) }); setSpeed(SPEEDS[1]); g.advance(0.02); g.event('politics', g.cap, t); return g.events[0].id; }, t); // 開いた年に届いた知らせは窓にしないので、少し進めてから
    const handle = async (mark, sel, shot) => {
      let seen = false;
      for (let i = 0; i < 8; i++) {
        await until(() => !$('newsbox').hidden);
        if (await p.evaluate(() => $('newsbox').hidden)) break;
        const mine = await p.evaluate((m) => $('newsbox').textContent.includes(m), mark);
        if (mine) { seen = true; r.paused = r.paused ?? (await p.evaluate(() => __app.speed === 0)); if (shot) { await p.screenshot({ path: `${SHOTS}/newspop-${tag}.png` }); r.wide = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth); } }
        await p.click(mine ? sel : '#newsbox [data-np="later"]');
        await p.waitForTimeout(150);
        if (mine) break;
      }
      await until(() => $('newsbox').hidden);
      return seen;
    };
    const id1 = await inject('試験: 首都で重大な知らせ (1)');
    r.shown = await handle('試験: 首都で重大な知らせ (1)', '#newsbox button.big', true);
    r.acked = await p.evaluate((id) => (__app.game.acked || []).includes(id), id1);
    r.resumed = await p.evaluate(() => __app.speed === SPEEDS[1]);
    // 2. あとで
    const id2 = await inject('試験: 首都で重大な知らせ (2)');
    await handle('試験: 首都で重大な知らせ (2)', '#newsbox [data-np="later"]');
    await p.evaluate(() => setSpeed(0));
    await p.waitForTimeout(700);
    r.later = await p.evaluate((id) => !(__app.game.acked || []).includes(id) && $('newsbox').hidden && $('rail').textContent.includes('試験: 首都で重大な知らせ (2)'), id2);
    // 3. 窓を切る
    await p.evaluate(() => { EvPrefs.popup = false; });
    await inject('試験: 首都で重大な知らせ (3)');
    await p.waitForTimeout(1300);
    r.off = await p.evaluate(() => $('newsbox').hidden);
    await p.evaluate(() => { EvPrefs.popup = true; setSpeed(0); app.setView('galaxy'); app.dirty = true; });
    // 4. 回す向き: 指の下の世界の点が、指を動かした向きに動くか (画面の x のずれ。正なら同じ向き)
    const cdp = await ctx.newCDPSession(p);
    const box = await p.evaluate(() => { const c = galaxyView.ctx.canvas; const rc = c.getBoundingClientRect(); return { x: rc.left, y: rc.top, w: rc.width, h: rc.height }; });
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    const drag1 = async (sx, sy) => {
      await p.evaluate(() => { app.rotateMode = true; galaxyView.cam.yaw = 0; galaxyView.cam.pitch = 0.6; });
      const w0 = await p.evaluate(([x, y]) => galaxyView.toWorld(x, y), [sx - box.x, sy - box.y]);
      await touch('touchStart', [[sx, sy]]);
      for (let i = 1; i <= 6; i++) await touch('touchMove', [[sx + i * 12, sy]]);
      await touch('touchEnd', []);
      const s1 = await p.evaluate(([wx, wy]) => galaxyView.toScreen(wx, wy, galaxyView.cam.z), w0);
      await p.evaluate(() => { app.rotateMode = false; });
      return s1[0] - (sx - box.x);
    };
    r.rotTop = await drag1(box.x + box.w / 2 - 40, box.y + box.h * 0.3);
    r.rotBottom = await drag1(box.x + box.w / 2 - 40, box.y + box.h * 0.7);
    // 2 本指を時計回りに 20° ひねる: 右の指の下の点が下へ (時計回り) 動くか
    await p.evaluate(() => { galaxyView.cam.yaw = 0; galaxyView.cam.pitch = 0.6; });
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = 100;
    const wR = await p.evaluate(([x, y]) => galaxyView.toWorld(x, y), [cx + R - box.x, cy - box.y]);
    await touch('touchStart', [[cx - R, cy], [cx + R, cy]]);
    for (let i = 1; i <= 5; i++) { const a = (i * 4 * Math.PI) / 180; await touch('touchMove', [[cx - R * Math.cos(a), cy - R * Math.sin(a)], [cx + R * Math.cos(a), cy + R * Math.sin(a)]]); }
    await touch('touchEnd', []);
    const sR = await p.evaluate(([wx, wy]) => galaxyView.toScreen(wx, wy, galaxyView.cam.z), wR);
    r.twist = sR[1] - (cy - box.y);
    r.is3D = await p.evaluate(() => is3D(__app.game.galaxy));
    r.wide = r.wide && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    out[tag] = r;
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
