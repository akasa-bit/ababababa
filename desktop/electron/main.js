// Electron の包装: desktop/game/ (組み立てた index.html と assets/) を 1 枚の窓で開くだけ。
// NLU_BENCH があれば desktop/bench/probe.js を差し込み、結果の 1 行を標準出力に書いて閉じる。
// NLU_FULLSCREEN があれば全画面で開く (Steam Deck の Game Mode を想定)。
// 字体: ゲームが Google Fonts に読みに行くのを横取りし、desktop/prepare.mjs が同梱した字体 (game/fonts/) を返す (B-088・QD-20)。
// NLU_CHECK があれば、ほかのネットへの読み込みも止めて (オフラインと同じ)、ゲームが動くか・字体が読めたかを 1 行書いて閉じる (desktop/check.mjs)。
const { app, BrowserWindow, shell, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const BENCH = !!process.env.NLU_BENCH;
const CHECK = !!process.env.NLU_CHECK;
const gameDir = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..', 'game');
const probePath = app.isPackaged ? path.join(process.resourcesPath, 'probe.js') : path.join(__dirname, '..', 'bench', 'probe.js');

// Google Fonts の CSS (fonts.googleapis.com/css2) には同梱の fonts.css を、字体のファイル (fonts.gstatic.com/nlu/…) には同梱のファイルを返す。
// fonts.css の中の相対の url は fonts.gstatic.com/nlu/ に置き換える (CSS と字体を同じ所から返すと、ページが file: でも読める)。
// ほかの https はそのままネットへ (Firebase の SDK など。ネットがなければ、ゲームの側で使えないと出る)
const FONT_HOST = 'https://fonts.gstatic.com/nlu/';
const fontsDir = path.join(gameDir, 'fonts');
const served = { css: 0, font: 0, blocked: [] };
function handleHttps() {
  const fontsCss = fs.readFileSync(path.join(fontsDir, 'fonts.css'), 'utf8').replace(/url\(([\w-]+\/[\w.-]+\.woff2)\)/g, `url(${FONT_HOST}$1)`);
  const cors = { 'access-control-allow-origin': '*' };
  protocol.handle('https', (req) => {
    const u = new URL(req.url);
    if (u.host === 'fonts.googleapis.com' && u.pathname === '/css2') {
      served.css++;
      return new Response(fontsCss, { headers: { 'content-type': 'text/css', ...cors } });
    }
    if (req.url.startsWith(FONT_HOST)) {
      const rel = u.pathname.slice('/nlu/'.length);
      if (!/^[\w-]+\/[\w.-]+\.woff2$/.test(rel)) return new Response('', { status: 404 });
      served.font++;
      return new Response(fs.readFileSync(path.join(fontsDir, rel)), { headers: { 'content-type': 'font/woff2', ...cors } });
    }
    if (CHECK) { served.blocked.push(u.host); return new Response('', { status: 503 }); }
    return net.fetch(req, { bypassCustomProtocolHandlers: true });
  });
}

// 包装を確かめる: ゲームが始まって年が進むか・ページの誤りがないか・セーブの書き出しと読み込みが動くか・
// ゲームの使う 4 つの字体で、日本語と英数字が同梱の字体で描けるか
const pageErrors = [];
async function packageCheck(win) {
  const game = await win.webContents.executeJavaScript(`(async () => {
    const g0 = window.__app && __app.game;
    if (!g0) return { ok: false };
    newGame('20261020'); setSpeed(SPEEDS[SPEEDS.length - 1]);
    const y0 = __app.game.year;
    await new Promise((r) => setTimeout(r, 3000));
    setSpeed(0);
    const y1 = __app.game.year;
    // セーブの書き出しの中身を読み直して、同じ年に戻るか (ファイルの窓は開かない)
    const ok = loadSave(parseSave(saveJSON(__app.game, { speed: 0 })));
    return { ok: true, edition: EDITION, years: +(y1 - y0).toFixed(2), reload: ok && Math.abs(__app.game.year - y1) < 1e-9 };
  })()`);
  const r = await win.webContents.executeJavaScript(`(async () => {
    await document.fonts.ready;
    const fams = ['Courier Prime', 'Special Elite', 'Zen Antique', 'Zen Old Mincho'];
    const jp = '光速の壁の向こうへ広がる恒星間植民';
    await Promise.all(fams.flatMap((f) => [document.fonts.load('16px "' + f + '"', 'NoLongerUbiquitous 0123'), document.fonts.load('16px "' + f + '"', jp)]));
    await Promise.all(['700 16px "Courier Prime"', '700 16px "Zen Old Mincho"'].map((f) => document.fonts.load(f, jp + 'AZ')));
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '') + ' ' + f.weight);
    return { check: Object.fromEntries(fams.map((f) => [f, document.fonts.check('16px "' + f + '"', f.startsWith('Zen') ? jp : 'NoLongerUbiquitous')])), loaded: [...new Set(loaded)].sort() };
  })()`);
  checkDone({ platform: process.platform, game, errors: pageErrors, ...r, served });
}
// 結果の 1 行を標準出力と、NLU_CHECK_OUT のファイルに書いて閉じる (Windows の GUI のアプリは、標準出力を拾えないことがあるので)
function checkDone(res) {
  const line = `NLU_CHECK ${JSON.stringify(res)}\n`;
  process.stdout.write(line);
  if (process.env.NLU_CHECK_OUT) fs.writeFileSync(process.env.NLU_CHECK_OUT, line);
  app.quit();
}

function open() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800, // Steam Deck の画面
    fullscreen: !!process.env.NLU_FULLSCREEN,
    backgroundColor: '#0b0c0d',
    autoHideMenuBar: true,
    title: 'NoLongerUbiquitous',
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.removeMenu();
  // 外へのリンク (出典・シミュレーション版) は、いつものブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
  if (BENCH) {
    win.webContents.on('dom-ready', () => win.webContents.executeJavaScript(fs.readFileSync(probePath, 'utf8')));
    win.webContents.on('console-message', (...a) => {
      const msg = typeof a[0] === 'object' && a[0].message !== undefined ? a[0].message : a[2];
      if (typeof msg === 'string' && msg.startsWith('NLU_BENCH ')) { process.stdout.write(msg + '\n'); app.quit(); }
    });
  }
  if (CHECK) {
    win.webContents.on('console-message', (...a) => {
      const d = typeof a[0] === 'object' && a[0].message !== undefined ? a[0] : { level: a[1], message: a[2] };
      if (d.level === 'error' || d.level === 3) pageErrors.push(String(d.message).slice(0, 200));
    });
    win.webContents.on('render-process-gone', (e, d) => { pageErrors.push(`描画のプロセスが落ちた: ${d.reason}`); });
    win.webContents.on('did-finish-load', () => setTimeout(() => packageCheck(win).catch((e) => checkDone({ fatal: String(e) })), 1500));
  }
  win.loadFile(path.join(gameDir, 'index.html'));
}

app.whenReady().then(() => { handleHttps(); open(); });
app.on('window-all-closed', () => app.quit());
