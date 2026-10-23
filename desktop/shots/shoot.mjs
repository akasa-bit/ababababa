// ストアのスクリーンショットとカプセルの案を撮る (B-079。store/images.md の 2・4)。
// 1. 撮るためのセーブを作る: 銀河の番号を決めて 6 か国で始め、観戦で少し進めたあと、人の操作 (画面の指令と同じ issue) で遊ぶ (回 SO3。play.mjs)。
//    「決めること」が届いた所と、地球の国が勝った講和会議の知らせが届いた所のセーブができる。
//    ゲームの中の式と乱数だけで進むので、同じ版のゲームなら、何度作っても同じセーブになる (tools/tests/headless.js が確かめている)。
// 2. そのセーブを新しいページで読み込み、場面ごとに撮る。大きさは CSS 1280×720 を 1.5 倍 (= 1920×1080。QD-18 の案 1)。
// 3. カプセル: 星図だけを残して、ゲームの名前の文字を載せる (QD-19 の案 1)。大きさは store/images.md の 1。
// ゲームの中身は変えない (ページの関数を呼ぶだけ)。書き出したものはリポジトリに入れない (既定は desktop/shots/out/。.gitignore 済み)。
// 使い方: node tools/build.mjs && node desktop/shots/shoot.mjs [--seed 20261020] [--spec 80] [--out <フォルダ>] [--only shots|capsules]
//         [--save <セーブ.json>] (作らずに、そのセーブを読んで撮る。手で遊んだセーブ。場面 3・6 は、そのセーブに決めることと講和会議があれば使う)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { playInPage } from './play.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SEED = arg('seed', '20261020');
const SPEC = Number(arg('spec', 80));
const OUT = resolve(arg('out', join(here, 'out')));
const ONLY = arg('only', '');
const HTML = process.env.HTML || join(root, 'index.html');
if (!existsSync(HTML)) throw new Error('index.html がない (先に node tools/build.mjs)');

// Playwright は CI と同じく全体に入れたものを使う (desktop/bench/run.mjs と同じ)
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'x.js'));
const { chromium } = require('playwright');
const launch = () => chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });

// ページを開いて、ホーム画面を出さずに止めておく
async function openPage(b, viewport, scale) {
  const p = await b.newPage({ viewport, deviceScaleFactor: scale });
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  // 遊び方の記録の同意 (B-060) は「記録しない」にしておく (撮る画面に同意の欄を出さない。記録もしない)
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('moribin-playlog-consent', 'no'); } catch { /* 使えない環境 */ } });
  await p.goto(`file://${HTML}?seed=${SEED}&home=0`);
  await p.waitForFunction(() => window.__app && __app.game);
  await p.evaluate(() => setSpeed(0));
  return p;
}
// セーブを読み込む (ホーム画面の「ファイルから読み込み」と同じ loadSave)
const load = (p, text) => p.evaluate((t) => { const ok = loadSave(parseSave(t)); setSpeed(0); __app.dirty = true; return ok; }, text);
const settle = (p) => p.waitForTimeout(600);

// 1. 撮るためのセーブ (play.mjs で遊んで作る)。saves = { decision, reply, offer, front, conference } (JSON の文字列)
async function makeSaves(b) {
  const p = await openPage(b, { width: 1280, height: 720 }, 1);
  const r = await p.evaluate(playInPage, { seed: SEED, spec: SPEC });
  await p.close();
  if (r.error) throw new Error(`${r.error}\n${r.log.join('\n')}`);
  console.log(`遊んだ筋 (銀河 ${SEED}・観戦 ${SPEC} 年のあと):\n  ${r.log.join('\n  ')}`);
  for (const [k, text] of Object.entries(r.saves)) {
    const file = join(OUT, `save-${SEED}-${k}.json`);
    writeFileSync(file, text);
    console.log(`セーブ ${k}: ${file} (${(text.length / 1e6).toFixed(1)} MB)`);
  }
  // 遊んだ筋の年と場所 (予告編の字幕に使う。desktop/trailer/trailer.mjs --saves)
  writeFileSync(join(OUT, `play-${SEED}.json`), JSON.stringify({ offer: r.offer, front: r.front, log: r.log }, null, 1));
  return r;
}

// 2. 場面 (store/images.md の 2 の表の番号)。prep はページの中で動き、撮る前の画面を作る。
// 地図の寄せ方は after で (右の欄が変わると地図の大きさが変わり、まだ地図を触っていないゲームは全体表示に戻すため)
const SCENES = [
  { n: 1, name: 'galaxy-3d', what: '3 次元の星図を斜めから (国境の色・航路・交戦中の印)', prep: () => {
    __app.deselect(); __app.setView('galaxy'); $('rail').hidden = true;
  }, after: () => { galaxyView.fitColonies(); galaxyView.cam.zoom *= 1.8; galaxyView.rotateBy(-0.45, 0.9); } },
  { n: 2, name: 'regime', what: '遠い家臣の「忠誠と統治」(従属国の型・主権の束・離反の見通し)', prep: () => {
    const g = __app.game;
    const vs = g.knownOwnSystems().filter((s) => s.id !== g.cap && g.govs[s.id]?.lord === g.cap).sort((a, b) => g.lightDelay(b.id) - g.lightDelay(a.id));
    const s = vs[0] || g.knownOwnSystems().find((x) => x.id !== g.cap);
    __app.secOpen = { loyal: true };
    __app.setView('galaxy'); $('rail').hidden = true; __app.selectSystem(s.id);
    return s.name;
  }, after: () => {
    document.querySelector('[data-sec="loyal"]')?.scrollIntoView({ block: 'start' });
    galaxyView.fitColonies(); galaxyView.cam.zoom *= 1.5; galaxyView.centerOn(__app.game.system(__app.sel.sys));
  } },
  { n: 3, name: 'decision', save: 'decision', what: '「決めること」が地図の左上の知らせの帯に届いた所', prep: () => {
    const g = __app.game;
    const d = g.visibleDecisions().sort((a, b) => g.lightDelay(b.sys) - g.lightDelay(a.sys))[0];
    __app.secOpen = {}; __app.setView('galaxy'); __app.selectSystem(d ? d.sys : g.cap);
    return d && `${g.system(d.sys).name}・${g.lightDelay(d.sys).toFixed(1)} 光年`;
  }, after: () => { $('panel').scrollIntoView({ block: 'start' }); galaxyView.fitColonies(); galaxyView.cam.zoom *= 1.3; galaxyView.centerOn(__app.game.system(__app.sel.sys)); } },
  { n: 4, name: 'routes', what: '帝国 → 交易路 (交易路の網と運ぶ量)', prep: () => { __app.empireTab = 'routes'; __app.setView('empire'); } },
  { n: 5, name: 'politics', what: '帝国 → 政治 (独立と戦争の原因と見通し)', prep: () => { __app.empireTab = 'politics'; __app.setView('empire'); } },
  { n: 6, name: 'treaty', what: '講和会議で条件を選ぶ所 (セーブに講和会議がなければ 帝国 → 軍事)', prep: () => {
    const g = __app.game;
    const c = g.conferences.find((x) => x.bids.some((b) => b.realm === g.cap && !b.picks));
    if (!c) { __app.empireTab = 'military'; __app.setView('empire'); return '講和会議がないので 帝国 → 軍事'; }
    __app.setView('galaxy'); $('rail').hidden = true; __app.selectSystem(c.loser); openTreaty(c.id);
    const bid = c.bids.find((b) => b.realm === g.cap);
    __app.treaty.picks = g.aiTreatyPicks(c, bid); renderTreaty(); // 押した順の番号が見えるように、おまかせの選び方で選んでおく (送らない)
    return `${g.realmName(c.loser)}・持ち点 ${bid.pts}・会議は ${Math.floor(c.year)}年に開き、${Math.floor(g.year)}年に届いた`;
  }, after: () => { galaxyView.fitColonies(); galaxyView.cam.zoom *= 1.5; galaxyView.centerOn(__app.game.system(__app.sel.sys)); } },
  { n: 7, name: 'system', what: '星系マップ (天体と背景の天体写真)', prep: () => {
    const g = __app.game;
    const s = g.knownOwnSystems().filter((x) => x.id !== g.cap).sort((a, b) => b.bodies.length - a.bodies.length)[0];
    __app.secOpen = {}; __app.openSystem(s.id);
    return s.name;
  } },
];

async function shots(b, saves) {
  const p = await openPage(b, { width: 1280, height: 720 }, 1.5);
  const done = [];
  let loaded = null;
  for (const s of SCENES) {
    const k = saves[s.save] ? s.save : 'conference'; // 場面ごとのセーブ (なければ講和会議の知らせが届いた所)
    if (loaded !== k) { if (!(await load(p, saves[k]))) throw new Error(`セーブ ${k} を読み込めない`); loaded = k; await settle(p); }
    const note = await p.evaluate(`(${s.prep})()`);
    await settle(p);
    if (s.after) { await p.evaluate(`(${s.after})()`); await settle(p); }
    const file = join(OUT, `shot-${s.n}-${s.name}.png`);
    await p.screenshot({ path: file });
    done.push(`${file}  ${s.what}${note ? ` (${note})` : ''}`);
  }
  if (p.errs.length) throw new Error(`ページの誤り: ${p.errs.join(' / ')}`);
  await p.close();
  console.log(`スクリーンショット (1920×1080):\n  ${done.join('\n  ')}`);
}

// 3. カプセル (store/images.md の 1)。[名前, CSS の幅, 高さ, 倍率, 文字の置き方]。倍率 × CSS = 出す画素
// title: 'center' = 上寄りの真ん中・'left-bottom' = 左下・'fill' = ほぼ埋める (星図は消して天の川を暗く)・'none' = 文字なし (ライブラリのヒーロー)
//        'sky' = 天の川だけを暗く (ページの背景)・'logo' = 文字だけ (透過)
const CAPSULES = [
  ['header', 920, 430, 1, 'center'],
  ['small', 462, 174, 1, 'fill'],
  ['main', 1232, 706, 1, 'left-bottom'],
  ['vertical', 748, 896, 1, 'center'],
  ['library-capsule', 600, 900, 1, 'center'],
  ['library-hero', 1920, 620, 2, 'none'],
  ['library-logo', 1280, 360, 1, 'logo'],
  ['page-background', 1438, 810, 1, 'sky'],
];
const NAME = 'NoLongerUbiquitous';

async function capsules(b, save) {
  const done = [];
  for (const [name, w, h, scale, title] of CAPSULES) {
    const p = await openPage(b, { width: w, height: h }, scale);
    if (!(await load(p, save))) throw new Error('セーブを読み込めない');
    await p.evaluate(({ title, name, logo }) => {
      __app.deselect(); __app.setView('galaxy');
      // カプセルに入れてよい文字は、ゲームの名前と公式の副題だけ (store/images.md の 1)。星図の文字 (星の名前・光年・攻囲) は描かない
      CanvasRenderingContext2D.prototype.fillText = CanvasRenderingContext2D.prototype.strokeText = () => {};
      // 星図 (#stage の canvas と背景) だけを画面いっぱいに残す
      const st = document.createElement('style');
      st.textContent = `header, aside, #rail, #zoom, #legend, #fleetbar, #empire, #home, #pick { display:none !important; }
        main { display:block !important; height:100vh !important; } #stage { position:fixed !important; inset:0 !important; }
        ${title === 'fill' || title === 'sky' ? '#map { visibility:hidden !important; } #sky { filter:brightness(.55); }' : ''}
        ${logo ? 'html, body, #stage, #sky, #map { background:transparent !important; } #sky, #map { visibility:hidden !important; }' : ''}
        #cap-title { position:fixed; z-index:99; color:#f4f1ea; font-family:"Special Elite", "Courier Prime", monospace; letter-spacing:.04em;
          text-shadow:0 0 18px rgba(0,0,0,.9), 0 0 4px rgba(0,0,0,.9); white-space:nowrap; filter:url(#worn); }`;
      document.head.append(st);
      window.dispatchEvent(new Event('resize'));
    }, { title, name: NAME, logo: title === 'logo' });
    await settle(p);
    await p.evaluate(async ({ title, name }) => {
      // 入植した星系の塊に寄せ、斜めから見下ろす。名前を載せるカプセルは、塊を名前の下へずらす
      galaxyView.fitColonies();
      galaxyView.cam.zoom *= 2.1;
      galaxyView.rotateBy(-0.45, 0.9);
      const { x: cx, y: cy } = galaxyView.cam;
      const low = { center: 0.66, 'left-bottom': 0.42 }[title];
      if (low) galaxyView.pinWorld(cx, cy, title === 'left-bottom' ? innerWidth * 0.62 : innerWidth / 2, innerHeight * low);
      if (title === 'none' || title === 'sky') return;
      const t = document.createElement('div');
      t.id = 'cap-title';
      t.textContent = name;
      // 置き方ごとの、名前の幅 (画面の幅の割合 k)・高さの上限 (画面の高さの割合)・位置
      const W = innerWidth, H = innerHeight;
      const tall = H > W; // 縦長は名前を 2 行に (No Longer / Ubiquitous)
      const place = {
        center: { k: 0.8, hmax: tall ? 0.3 : 0.25, css: `left:50%; top:${tall ? 20 : 24}%; transform:translate(-50%,-50%);` },
        fill: { k: 0.92, hmax: 0.8, css: 'left:50%; top:50%; transform:translate(-50%,-50%);' },
        'left-bottom': { k: 0.6, hmax: 0.2, css: `left:${W * 0.05}px; bottom:${H * 0.08}px;` },
        logo: { k: 0.92, hmax: 0.8, css: 'left:50%; top:50%; transform:translate(-50%,-50%); text-shadow:none;' },
      }[title];
      if (tall) t.innerHTML = 'NoLonger<br>Ubiquitous';
      t.style.cssText = `font-size:100px; line-height:1.05; text-align:center; ${place.css}`;
      document.body.append(t);
      await document.fonts.load('100px "Special Elite"'); await document.fonts.ready;
      // 100px で測って、幅と高さの両方に収まる大きさにする (字体で 1 字の幅が違うので、測る)
      const r = t.getBoundingClientRect();
      t.style.fontSize = `${100 * Math.min((W * place.k) / r.width, (H * place.hmax) / r.height)}px`;
    }, { title, name: NAME });
    await settle(p);
    const file = join(OUT, `capsule-${name}-${w * scale}x${h * scale}.png`);
    await p.screenshot({ path: file, omitBackground: title === 'logo' });
    if (p.errs.length) throw new Error(`ページの誤り: ${p.errs.join(' / ')}`);
    done.push(file);
    await p.close();
  }
  console.log(`カプセルの案:\n  ${done.join('\n  ')}`);
}

mkdirSync(OUT, { recursive: true });
const b = await launch();
try {
  const saves = arg('save') ? { conference: readFileSync(arg('save'), 'utf8') } : (await makeSaves(b)).saves;
  if (ONLY !== 'capsules') await shots(b, saves);
  if (ONLY !== 'shots') await capsules(b, saves.conference);
} finally {
  await b.close();
}
