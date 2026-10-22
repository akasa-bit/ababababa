// 組み立てたゲーム (リポジトリの根の index.html と assets/) を desktop/game/ に写す。
// 包装はこれを外から包むだけ。ゲームの中身は変えない (docs/parallel.md の外向きの決まり)。
// 字体 (B-088・QD-20): ゲームは Google Fonts をネットから読む。オフラインの Steam Deck でも同じ字体になるよう、
// 同じ字体を npm の @fontsource から desktop/game/fonts/ に写し、fonts.css を作る。包装 (electron/main.js) が
// Google Fonts への読み込みを横取りして、これを返す。先に desktop/electron で npm ci が要る。
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dest = join(here, 'game');
if (!existsSync(join(root, 'index.html'))) throw new Error('index.html がない (先に node tools/build.mjs)');
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(join(root, 'index.html'), join(dest, 'index.html'));
cpSync(join(root, 'assets'), join(dest, 'assets'), { recursive: true });

// ゲームが読む字体と太さ (src/index.html の頭の Google Fonts の <link> と同じにする)
const FONTS = [
  ['courier-prime', 'Courier Prime', [400, 700]],
  ['special-elite', 'Special Elite', [400]],
  ['zen-antique', 'Zen Antique', [400]],
  ['zen-old-mincho', 'Zen Old Mincho', [400, 700]],
];
const mods = join(here, 'electron', 'node_modules', '@fontsource');
if (!existsSync(mods)) throw new Error('@fontsource がない (先に cd desktop/electron && npm ci)');
const fontDir = join(dest, 'fonts');
const css = ['/* 包装で同梱した字体 (desktop/prepare.mjs が作る。@fontsource から。ライセンスは各フォルダの LICENSE) */'];
let files = 0;
for (const [pkg, family, weights] of FONTS) {
  mkdirSync(join(fontDir, pkg), { recursive: true });
  cpSync(join(mods, pkg, 'LICENSE'), join(fontDir, pkg, 'LICENSE'));
  for (const w of weights) {
    // n00.css は、その太さの全部の文字の範囲 (unicode-range) の @font-face。woff2 だけを残す (Electron の Chromium は woff2 を読む)
    const text = readFileSync(join(mods, pkg, `${w}.css`), 'utf8').replace(/src: url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\)(, url\([^)]+\) format\('woff'\))?/g, (_, f) => {
      cpSync(join(mods, pkg, 'files', f), join(fontDir, pkg, f));
      files++;
      return `src: url(${pkg}/${f}) format('woff2')`;
    });
    if (!text.includes(`font-family: '${family}'`)) throw new Error(`${pkg} の ${w}.css に ${family} がない`);
    css.push(text);
  }
}
writeFileSync(join(fontDir, 'fonts.css'), css.join('\n'));
// Steam Input の既定の設定 (B-085。desktop/steam-input/README.md)。包装のフォルダの resources/game/steam-input/ に入る
cpSync(join(here, 'steam-input'), join(dest, 'steam-input'), { recursive: true, filter: (f) => !f.endsWith('.mjs') && !f.endsWith('.md') });
console.log(`写した: ${dest} (字体 ${FONTS.length} 種類・${files} ファイル)`);
