// 予告編 (B-080。store/images.md の 3)。30〜60 秒: 光の球 → 何十年後に届く → 講和のあとも戦う艦隊 → 答え合わせ → 題字。
// 1. 撮るためのセーブを、人の操作で遊んで作る (desktop/shots/play.mjs。ストアのスクリーンショットと同じ筋)。
// 2. 場面ごとに、ゲームを 1 コマずつ進めて (g.advance) 画面を撮る。大きさは CSS 1280×720 を 1.5 倍 (= 1920×1080。QD-18 と同じ)、30 コマ/秒。
// 3. ffmpeg で H.264 + AAC (無音) の mp4 にする (Steam のトレーラーの決まり: 1920×1080 まで・16:9・30 か 60 コマ・5000 kbps 以上)。
// ゲームの中身は変えない (ページの関数を呼ぶだけ)。字幕は日本語 (いまはゲームが日本語だけ)。音楽はまだない (音の素材が入ってから)。
// 書き出したものはリポジトリに入れない (既定は desktop/trailer/out/。.gitignore 済み)。
// 使い方: node tools/build.mjs && node desktop/trailer/trailer.mjs [--seed 20261020] [--spec 80] [--out <フォルダ>]
//         [--saves <フォルダ>] (desktop/shots/shoot.mjs が書いた save-<銀河>-<名前>.json と play-<銀河>.json を使い、遊び直さない)
//         [--fps 30] [--keep] (撮ったコマの PNG を消さずに残す)
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { playInPage } from '../shots/play.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SEED = arg('seed', '20261020');
const SPEC = Number(arg('spec', 80));
const OUT = resolve(arg('out', join(here, 'out')));
const FPS = Number(arg('fps', 30));
const HTML = process.env.HTML || join(root, 'index.html');
if (!existsSync(HTML)) throw new Error('index.html がない (先に node tools/build.mjs)');

const require = createRequire(join(execSync('npm root -g').toString().trim(), 'x.js'));
const { chromium } = require('playwright');

// 1. セーブ (遊んだ筋)。--saves なら shoot.mjs の書いたものを読む
async function getPlay(b) {
  const dir = arg('saves');
  if (dir) {
    const saves = {};
    for (const k of ['offer', 'front', 'conference']) saves[k] = readFileSync(join(dir, `save-${SEED}-${k}.json`), 'utf8');
    return { saves, ...JSON.parse(readFileSync(join(dir, `play-${SEED}.json`), 'utf8')) };
  }
  const p = await openPage(b);
  const r = await p.evaluate(playInPage, { seed: SEED, spec: SPEC });
  await p.close();
  if (r.error) throw new Error(`${r.error}\n${r.log.join('\n')}`);
  console.log(`遊んだ筋 (銀河 ${SEED}・観戦 ${SPEC} 年のあと):\n  ${r.log.join('\n  ')}`);
  return r;
}

async function openPage(b) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  // 遊び方の記録の同意は「記録しない」にしておく (画面に同意の欄を出さない。shoot.mjs と同じ)
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('moribin-playlog-consent', 'no'); } catch { /* 使えない環境 */ } });
  await p.goto(`file://${HTML}?seed=${SEED}&home=0`);
  await p.waitForFunction(() => window.__app && __app.game);
  await p.evaluate(() => setSpeed(0));
  return p;
}

// 字幕と幕 (ページの上に重ねる。ゲームの画面は変えない)。書体はゲームの本文と同じ Zen Old Mincho、題字は見出しと同じ Special Elite
const OVERLAY = () => {
  const st = document.createElement('style');
  st.textContent = `#tr-cap { position:fixed; left:50%; bottom:46px; transform:translateX(-50%); z-index:200; max-width:1100px; padding:10px 26px;
      background:rgba(11,12,13,.78); color:#f4f1ea; font:28px/1.5 "Zen Old Mincho", serif; letter-spacing:.06em; text-align:center; white-space:nowrap; opacity:0; }
    #tr-cap small { display:block; font-size:18px; color:#c9c4b8; letter-spacing:.04em; }
    #tr-veil { position:fixed; inset:0; z-index:199; background:#0b0c0d; opacity:0; pointer-events:none; }
    #tr-title { position:fixed; inset:0; z-index:201; display:none; flex-direction:column; align-items:center; justify-content:center; gap:28px; background:#0b0c0d; color:#f4f1ea; }
    #tr-title b { font:96px "Special Elite", monospace; letter-spacing:.04em; font-weight:400; filter:url(#worn); }
    #tr-title span { font:30px "Zen Old Mincho", serif; letter-spacing:.12em; }`;
  document.head.append(st);
  for (const id of ['tr-cap', 'tr-veil', 'tr-title']) { const d = document.createElement('div'); d.id = id; document.body.append(d); }
};
// 字幕を 1 コマぶん置く: caps = [[始め秒, 終わり秒, 文 (HTML)]]。始めと終わりの 0.4 秒で薄くなる。veil = 場面の始めと終わりの暗転
const CAPTION = ({ t, dur, caps }) => {
  const c = caps.find(([a, b]) => t >= a && t < b);
  const el = document.getElementById('tr-cap');
  if (c) { el.innerHTML = c[2]; el.style.opacity = Math.min(1, (t - c[0]) / 0.4, (c[1] - t) / 0.4).toFixed(3); } else el.style.opacity = 0;
  document.getElementById('tr-veil').style.opacity = Math.max(0, 1 - t / 0.35, 1 - (dur - t) / 0.35).toFixed(3);
};

// 2. 場面。setup はページの中で 1 回 (画面を選ぶ)、cam はそのあと地図の視点を決める、step は 1 コマごとに (t = 場面の始めからの秒・k = 0〜1)。
//    年は rate [年/秒] で進む
// info = 遊んだ筋 (play.mjs の返り値) から、字幕に使う年と名前
const SCENES = (info) => [
  { // 光の球: 講和の申し入れの指令が、光の速さで 34 光年先の相手の首都へ広がる
    save: 'offer', dur: 9, rate: (info.offer.arrive - info.offer.year + 0.6) / 8,
    setup: () => {
      const g = __app.game, q = g.requests.filter((x) => x.kind === 'order' && x.act === 'peace').pop();
      __app.deselect(); __app.setView('galaxy'); $('rail').hidden = true;
      const b = g.system(q.to);
      return { foe: g.realmName(g.realmOf(q.to)), to: b.name, ly: (q.arrive - q.sent).toFixed(0), arrive: Math.floor(q.arrive), sent: Math.floor(q.sent) };
    },
    // 地球と相手の首都の真ん中を見る
    cam: () => {
      const g = __app.game, q = g.requests.filter((x) => x.kind === 'order' && x.act === 'peace').pop();
      const a = g.system(q.from), b = g.system(q.to), v = galaxyView;
      v.cam.yaw = 0; v.cam.pitch = 0.35;
      v.cam.x = (a.x + b.x) / 2; v.cam.y = (a.y + b.y) / 2; v.cam.z = ((a.z || 0) + (b.z || 0)) / 2;
      v.cam.zoom = Math.min(v.w, v.h * 1.4) * 0.5 / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)));
    },
    caps: (s) => [[0.3, 4.4, '命令は、光の速さでしか届かない。'],
      [4.6, 8.8, `${s.sent}年、地球は${s.foe}に講和を申し入れた。<small>${s.ly} 光年先の ${s.to} に届くのは ${s.arrive}年</small>`]],
    step: ({ k }) => { galaxyView.rotateBy(0.0016, 0); },
  },
  { // 講和のあとも戦う艦隊: 講和のあとに起きた艦隊戦の知らせが、地球に届く
    save: 'front', dur: 9, rate: 0.8,
    setup: (front) => {
      const g = __app.game;
      __app.deselect(); __app.setView('galaxy'); $('rail').hidden = true;
      const s = g.system(front.sys);
      return { peace: Math.floor(front.peace), year: Math.floor(front.year), seen: Math.floor(front.seen), sys: s.name };
    },
    // 前線の星系に寄せて、字幕より上に置く
    cam: (front) => {
      const s = __app.game.system(front.sys), v = galaxyView;
      v.cam.yaw = 0; v.cam.pitch = 0.35; v.centerOn(s); v.cam.zoom = Math.min(v.w, v.h) / 2 / 11;
      v.pinWorld(s.x, s.y, v.w / 2, v.h * 0.4);
    },
    caps: (s) => [[0.3, 4.4, `講和は ${s.peace}年に、もう結ばれていた。<small>知らせが前線に届くまで、艦隊は戦い続ける</small>`],
      [4.6, 8.8, `${s.year}年、講和を知らない艦隊が ${s.sys} を攻めた。<small>地球がその戦いを知ったのは ${s.seen}年</small>`]],
    step: ({ k }) => { galaxyView.rotateBy(-0.0012, 0); },
  },
  { // 講和会議の知らせが、ようやく地球に届く (条件を押した順に選ぶ)
    // 字幕は地図の上で先に出し、そのあと講和会議の箱を開く (箱は画面の高さいっぱいなので、字幕と重ねない)
    save: 'conference', dur: 8, rate: 0,
    setup: () => {
      const g = __app.game, c = g.conferences.find((x) => x.bids.some((b) => b.realm === g.cap && !b.picks));
      __app.setView('galaxy'); $('rail').hidden = false; __app.selectSystem(c.loser);
      window.__trConf = c.id;
      window.__trPicks = g.aiTreatyPicks(c, c.bids.find((b) => b.realm === g.cap));
      return { year: Math.floor(g.year), late: Math.round(g.year - c.year), foe: g.realmName(c.loser) };
    },
    cam: () => { const v = galaxyView; v.fitColonies(); v.cam.zoom *= 1.3; v.centerOn(__app.game.system(__app.sel.sys)); },
    caps: (s) => [[0.3, 2.9, `${s.year}年、講和会議の知らせが地球に届いた。<small>${s.late} 年遅れで、${s.foe}から何を取るかを選ぶ</small>`]],
    step: ({ t }) => {
      if (t < 3.1) return;
      if (!__app.treaty) openTreaty(window.__trConf);
      const n = Math.max(0, Math.min(window.__trPicks.length, Math.floor((t - 3.5) / 0.4)));
      if (__app.treaty.picks.length !== n) { __app.treaty.picks = window.__trPicks.slice(0, n); renderTreaty(); }
    },
  },
  { // 答え合わせ: 時代の終わりに、地球が見ていた歴史 (届いた順) と本当の歴史 (起きた順) を並べて早回しで見せる (B-054)
    // 字幕を先に出し、そのあと答え合わせの箱を開いて早回しする (箱の見出しが「地球が見ていた歴史と、本当の歴史」)
    save: 'conference', dur: 12, rate: 0,
    setup: (front) => {
      __app.treaty = null; $('treatybox').hidden = true;
      window.__trEra = Math.floor((front.peace - START_YEAR) / ERA_YEARS); // 講和の結ばれた時代
      window.__trY0 = START_YEAR + ERA_YEARS * window.__trEra;
      return { n: window.__trEra, y0: window.__trY0 };
    },
    caps: (s) => [[0.3, 2.9, `時代の終わりに、答え合わせ。<small>${s.y0}〜${s.y0 + 100}年に、本当は何が起きていたか</small>`]],
    step: ({ t }) => {
      if (t < 3.1) return;
      if ($('endbox').hidden) { showEraReview(__app.game, window.__trEra); __app.reviewAnim = null; } // 早回しはここで 1 コマずつ動かす (撮るのは実時間より遅いので)
      const k = Math.min(1, Math.max(0, (t - 3.4) / 8));
      const items = [...document.querySelectorAll('#endbox li[data-t]')];
      const y = window.__trY0 + ERA_YEARS * k;
      const yEl = document.getElementById('rv-year');
      if (yEl) yEl.textContent = Math.floor(y);
      items.forEach((li) => li.classList.toggle('lit', Number(li.dataset.t) <= y));
      const box = $('endbox'); box.scrollTop = (box.scrollHeight - box.clientHeight) * Math.min(1, Math.max(0, (k - 0.3) / 0.6)); // 灯った行が画面に入るように、後半で下へ送る
    },
  },
  { // 題字
    save: null, dur: 5, rate: 0,
    setup: () => {
      const el = document.getElementById('tr-title');
      el.innerHTML = '<b>NoLongerUbiquitous</b><span>命令は、光の速さでしか届かない。</span>';
      el.style.display = 'flex';
      return {};
    },
    caps: () => [],
    step: ({ t }) => { document.getElementById('tr-title').style.opacity = Math.min(1, t / 0.8).toFixed(3); },
  },
];

const nextFrame = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

mkdirSync(OUT, { recursive: true });
const FRAMES = join(OUT, 'frames');
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES);
const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
let frame = 0;
try {
  const play = await getPlay(b);
  const { front } = play;
  const info = { offer: play.offer, front };
  const p = await openPage(b);
  await p.evaluate(OVERLAY);
  await p.evaluate(() => document.fonts.ready);
  let loaded = null;
  const t0 = Date.now();
  for (const [i, sc] of SCENES(info).entries()) {
    if (sc.save && loaded !== sc.save) {
      const ok = await p.evaluate((t) => { const r = loadSave(parseSave(t)); setSpeed(0); __app.dirty = true; return r; }, play.saves[sc.save]);
      if (!ok) throw new Error(`セーブ ${sc.save} を読み込めない`);
      loaded = sc.save;
    }
    await p.evaluate(() => { document.getElementById('tr-title').style.display = 'none'; $('endbox').hidden = true; });
    const s = await p.evaluate(`(${sc.setup})(${JSON.stringify(front)})`);
    const caps = sc.caps(s);
    await p.waitForTimeout(600); // 欄の開け閉めで地図の大きさが変わり、地図が寄せ直されるのを待ってから視点を決める
    if (sc.cam) { await p.evaluate(`(${sc.cam})(${JSON.stringify(front)})`); await p.waitForTimeout(200); }
    const n = Math.round(sc.dur * FPS);
    for (let f = 0; f < n; f++) {
      const t = f / FPS;
      await p.evaluate(({ dy, t, dur, caps, step, caption }) => {
        const g = __app.game;
        for (let left = dy; left > 1e-9; left -= 0.25) g.advance(Math.min(0.25, left));
        __app.dirty = true;
        (0, eval)(`(${step})`)({ t, k: t / dur });
        (0, eval)(`(${caption})`)({ t, dur, caps });
      }, { dy: sc.rate / FPS, t, dur: sc.dur, caps, step: String(sc.step), caption: String(CAPTION) });
      await nextFrame(p);
      await p.screenshot({ path: join(FRAMES, `${String(frame++).padStart(5, '0')}.png`) });
    }
    console.log(`場面 ${i + 1}: ${n} コマ (${sc.dur} 秒) ${JSON.stringify(s)}`);
  }
  if (p.errs.length) throw new Error(`ページの誤り: ${p.errs.join(' / ')}`);
  console.log(`撮った: ${frame} コマ (${((Date.now() - t0) / 1000).toFixed(0)} 秒かかった)`);
} finally {
  await b.close();
}

// 3. mp4 (H.264 の High・yuv420p・12 Mbps。音は AAC の無音。Steam の決まりは store/images.md の 1)
const file = join(OUT, `trailer-${SEED}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(FRAMES, '%05d.png'),
  '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '12M', '-maxrate', '16M', '-bufsize', '24M', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', file], { stdio: 'inherit' });
if (!process.argv.includes('--keep')) rmSync(FRAMES, { recursive: true, force: true });
console.log(`予告編: ${file} (${(frame / FPS).toFixed(1)} 秒・1920×1080・${FPS} コマ/秒)`);
