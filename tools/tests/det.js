// 再現性の試験: (1) 別々のページで同じシード → 同じ結果 (Math.random はページごとにわざと変える)
// (2) 保存→読み込み→保存が一致 (3) 読み込んだゲームが、元のゲームと同じ結果に進み続ける
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: ['3', '120'], judge: (o) => ((o.match(/一致/g) || []).length >= 3 && o.includes('保存→読込→保存: true') && J.noPageErrors(o) ? '' : '再現性が一致しない') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
const crypto = require('crypto');
const H = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const [seed = '3', years = '200'] = process.argv.slice(2);
const file = HTML;
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const run = async (mrSeed) => {
    const p = await b.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((a0) => { let a = a0; Math.random = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; }, mrSeed);
    await p.goto(`file://${file}?seed=${seed}&home=0`);
    await p.waitForFunction(() => window.__app && __app.game);
    const r = await p.evaluate(([Y, NAT]) => {
      __app.speed = 0;
      const strip = (g) => { const s = buildSave(g); delete s.savedAt; return JSON.stringify(s); };
      const g = __app.game;
      if (NAT) { g.foundNations(6, 'hard'); g.setPlayerNation(g.nations[3].cap); }
      g.setSpectate(true);
      for (let i = 0; i < Y * 4; i++) g.advance(0.25);
      const s1 = strip(g);
      // 読み込み: 別のゲームとして作り直す
      const d = JSON.parse(s1);
      const g2 = new Game(generateGalaxy({ seed: d.seed, starCount: 400, meanSpacing: 4, kind: d.galaxy === 'real' ? 'real' : 'flat', gen: d.gen || 1 }));
      const ok = g2.restore(d);
      const s2 = strip(g2);
      // どちらも 50 年進める
      SIM = g; for (let i = 0; i < 200; i++) g.advance(0.25);
      SIM = g2; for (let i = 0; i < 200; i++) g2.advance(0.25);
      return { s1, s2, ok, a: strip(g), b: strip(g2) };
    }, [Number(years), !!process.env.NAT]);
    await p.close();
    return { ...r, errs };
  };
  const A = await run(1), B = await run(987654);
  console.log('同じシード・別ページ:', H(A.s1), H(B.s1), A.s1 === B.s1 ? '一致' : '不一致');
  console.log('保存→読込→保存:', A.ok, H(A.s1), H(A.s2), A.s1 === A.s2 ? '一致' : '不一致');
  console.log('読込後 +50年:', H(A.a), H(A.b), A.a === A.b ? '一致' : '不一致', A.errs.concat(B.errs).slice(0, 3));
  if (A.s1 !== A.s2) { // 最初に違う所
    const x = JSON.parse(A.s1), y = JSON.parse(A.s2);
    for (const k of Object.keys(x)) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) { console.log('  違うキー', k); if (k === 'snaps') { const a = x[k], c = y[k]; const ks = Object.keys(a); console.log('   n', ks.length, Object.keys(c).length); for (const id of ks) if (JSON.stringify(a[id]) !== JSON.stringify(c[id])) { console.log('   id', id, JSON.stringify(a[id]).slice(0, 300), '\n   vs', JSON.stringify(c[id]).slice(0, 300)); break; } } }
  }
  if (A.a !== A.b) { const x = JSON.parse(A.a), y = JSON.parse(A.b); for (const k of Object.keys(x)) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) console.log('  +50年で違うキー', k); }
  await b.close();
})();
