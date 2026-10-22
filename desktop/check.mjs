// 包装を確かめる (B-086・B-088): 包装 (Electron) を、ネットに出られない状態で開き、次を見る。
//   1. ゲームが始まり、最高速で年が進む・ページの誤りがない・セーブの書き出しの中身を読み直して同じ年に戻る
//   2. ゲームの 4 つの字体が、同梱のファイルで読める (Google Fonts の読み込みを包装が横取りしている)
// 使い方 (画面のない Linux では xvfb-run の中で。Windows はそのまま):
//   node tools/build.mjs && (cd desktop/electron && npm ci) && node desktop/prepare.mjs
//   node desktop/check.mjs [包装した実行ファイル]   (渡さなければ desktop/electron を electron で開く)
// 合格なら「包装 合格」を書き、終了コード 0。CI の desktop (.github/workflows/desktop.yml) が Linux と Windows で回す
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bin = process.argv[2];
const win = process.platform === 'win32';
const [cmd, args] = bin ? [bin, []] : [join(here, 'electron', 'node_modules', '.bin', win ? 'electron.cmd' : 'electron'), [join(here, 'electron')]];
const OUTFILE = join(tmpdir(), `nlu-check-${process.pid}.txt`);
const WANT = ['Courier Prime 400', 'Courier Prime 700', 'Special Elite 400', 'Zen Antique 400', 'Zen Old Mincho 400', 'Zen Old Mincho 700'];

const out = await new Promise((resolve, reject) => {
  const p = spawn(cmd, [...args, ...(win ? [] : ['--no-sandbox'])], { env: { ...process.env, NLU_CHECK: '1', NLU_CHECK_OUT: OUTFILE }, shell: win && !bin });
  let text = '';
  p.stdout.on('data', (d) => { text += d; });
  p.stderr.on('data', () => {});
  const t = setTimeout(() => { p.kill(); reject(new Error('90 秒で答えがない')); }, 90000);
  p.on('exit', () => { clearTimeout(t); resolve(text); });
});
let fileText = '';
try { fileText = readFileSync(OUTFILE, 'utf8'); rmSync(OUTFILE); } catch { /* 書かれていない */ }
const line = `${out}\n${fileText}`.split(/\r?\n/).find((l) => l.startsWith('NLU_CHECK '));
if (!line) { console.log('包装 不合格: 答えの行がない'); process.exit(1); }
const r = JSON.parse(line.slice('NLU_CHECK '.length));
const bad = r.fatal ? [`確かめの途中で止まった: ${r.fatal}`] : [
  ...(!r.game?.ok ? ['ゲームが始まらない'] : []),
  ...(r.game?.ok && !(r.game.years > 1) ? [`最高速で 3 秒に ${r.game.years} 年しか進まない`] : []),
  ...(r.game?.ok && !r.game.reload ? ['セーブを読み直すと同じ年に戻らない'] : []),
  ...r.errors.map((e) => `ページの誤り: ${e}`),
  ...Object.entries(r.check).filter(([, ok]) => !ok).map(([f]) => `${f} で描けない`),
  ...WANT.filter((w) => !r.loaded.includes(w)).map((w) => `${w} が読めていない`),
  ...(r.served.css < 1 ? ['Google Fonts の CSS を横取りしていない'] : []),
];
console.log(JSON.stringify(r, null, 1));
console.log(bad.length ? `包装 不合格: ${bad.join('・')}`
  : `包装 合格 (${r.platform}。3 秒で ${r.game.years} 年進んだ・セーブを読み直せた・同梱の CSS ${r.served.css} 回・字体のファイル ${r.served.font} 個。止めたネットへの読み込み: ${r.served.blocked.join(', ') || 'なし'})`);
process.exit(bad.length ? 1 : 0);
