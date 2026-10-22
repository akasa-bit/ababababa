// 字体の同梱を確かめる (B-088): 包装 (Electron) を、ネットに出られない状態で開き、ゲームの 4 つの字体が同梱のファイルで読めるかを見る。
// 使い方 (画面のない機械では xvfb-run の中で):
//   node tools/build.mjs && (cd desktop/electron && npm ci) && node desktop/prepare.mjs
//   xvfb-run -a node desktop/fonts-check.mjs [包装した実行ファイル]   (渡さなければ desktop/electron を electron で開く)
// 合格なら「字体 合格」を書き、終了コード 0。
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bin = process.argv[2];
const [cmd, args] = bin ? [bin, []] : [join(here, 'electron', 'node_modules', '.bin', 'electron'), [join(here, 'electron')]];
const WANT = ['Courier Prime 400', 'Courier Prime 700', 'Special Elite 400', 'Zen Antique 400', 'Zen Old Mincho 400', 'Zen Old Mincho 700'];

const out = await new Promise((resolve, reject) => {
  const p = spawn(cmd, [...args, '--no-sandbox'], { env: { ...process.env, NLU_FONTCHECK: '1' } });
  let text = '';
  p.stdout.on('data', (d) => { text += d; });
  p.stderr.on('data', () => {});
  const t = setTimeout(() => { p.kill(); reject(new Error('60 秒で答えがない')); }, 60000);
  p.on('exit', () => { clearTimeout(t); resolve(text); });
});
const line = out.split('\n').find((l) => l.startsWith('NLU_FONTCHECK '));
if (!line) { console.log('字体 不合格: 答えの行がない'); process.exit(1); }
const r = JSON.parse(line.slice('NLU_FONTCHECK '.length));
const bad = [
  ...Object.entries(r.check).filter(([, ok]) => !ok).map(([f]) => `${f} で描けない`),
  ...WANT.filter((w) => !r.loaded.includes(w)).map((w) => `${w} が読めていない`),
  ...(r.served.css < 1 ? ['Google Fonts の CSS を横取りしていない'] : []),
];
console.log(JSON.stringify(r, null, 1));
console.log(bad.length ? `字体 不合格: ${bad.join('・')}` : `字体 合格 (同梱の CSS ${r.served.css} 回・字体のファイル ${r.served.font} 個。止めたネットへの読み込み: ${r.served.blocked.join(', ') || 'なし'})`);
process.exit(bad.length ? 1 : 0);
