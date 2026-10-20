// Electron の包装: desktop/game/ (組み立てた index.html と assets/) を 1 枚の窓で開くだけ。
// NLU_BENCH があれば desktop/bench/probe.js を差し込み、結果の 1 行を標準出力に書いて閉じる。
// NLU_FULLSCREEN があれば全画面で開く (Steam Deck の Game Mode を想定)。
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const BENCH = !!process.env.NLU_BENCH;
const gameDir = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..', 'game');
const probePath = app.isPackaged ? path.join(process.resourcesPath, 'probe.js') : path.join(__dirname, '..', 'bench', 'probe.js');

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
  win.loadFile(path.join(gameDir, 'index.html'));
}

app.whenReady().then(open);
app.on('window-all-closed', () => app.quit());
