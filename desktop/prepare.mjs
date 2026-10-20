// 組み立てたゲーム (リポジトリの根の index.html と assets/) を desktop/game/ に写す。
// 包装はこれを外から包むだけ。ゲームの中身は変えない (docs/parallel.md のレーン S の決まり)。
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
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
console.log(`写した: ${dest}`);
