// 公開用の HTML を作る: src/index.html を最小化し、LZMA で圧縮して、自分で展開する 1 枚の HTML にする。
// 版ごとに作る: index.html (ゲーム版) と simulation.html (シミュレーション版)。違いは src の EDITION の値だけ
// ふだんはゲーム版だけを作る。シミュレーション版はレーン P (物理) が --sim を付けたときだけ作る。ほかのレーンはシミュレーション版を無視する (docs/parallel.md の 6)
// 使い方: (cd tools && npm ci) のあと node tools/build.mjs   (シミュレーション版も: node tools/build.mjs --sim)
//   --sim-to <ファイル>: シミュレーション版だけを、そのファイルに作る (CI の試験用。リポジトリの simulation.html は変えない)
// 圧縮は python3 の lzma を使う。できあがりは展開して元の最小化 HTML と 1 バイトずつ照らし合わせてから書き出す
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as esbuild from 'esbuild';
import { minify } from 'terser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const unlzma = require('./unlzma.js');
const source = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const EDITION_LINE = "const EDITION = 'game'; /* EDITION */";
if (!source.includes(EDITION_LINE)) throw new Error('src/index.html に EDITION の行がない');
const ALL_EDITIONS = [['game', 'index.html', 'NoLongerUbiquitous'], ['sim', 'simulation.html', 'NoLongerUbiquitous シミュレーション版']];
const simTo = process.argv.includes('--sim-to') ? path.resolve(process.argv[process.argv.indexOf('--sim-to') + 1]) : null;
const EDITIONS = simTo ? ALL_EDITIONS.filter(([e]) => e === 'sim') : ALL_EDITIONS.filter(([e]) => e === 'game' || process.argv.includes('--sim')); // シミュレーション版は --sim のときだけ
// LZMA の圧縮 (文脈のビット数を変えて、いちばん小さいものを使う)
const py = `import lzma,sys,json
b=sys.stdin.buffer.read();best=None
for lc in range(5):
  f=[{'id':lzma.FILTER_LZMA1,'preset':9|lzma.PRESET_EXTREME,'dict_size':1<<20,'lc':lc,'lp':0,'pb':0,'nice_len':273,'mf':lzma.MF_BT4}]
  c=lzma.compress(b,format=lzma.FORMAT_RAW,filters=f)
  if best is None or len(c)<len(best[1]): best=(lc,c)
sys.stdout.buffer.write(bytes([best[0]])+best[1])`;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

for (const [edition, file, title] of EDITIONS) {
  const src = source.replace(EDITION_LINE, `const EDITION = '${edition}';`).replace('<title>NoLongerUbiquitous</title>', `<title>${title}</title>`);

  // 1. 最小化: CSS は esbuild、JS は terser (プロパティ名は変えない。セーブの形が変わらないように)、HTML はタグの間の空白を詰める
  let html = src;
  for (const m of [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]) {
    const r = await esbuild.transform(m[2], { loader: 'css', minify: true });
    html = html.replace(m[0], () => `<style${m[1]}>${r.code.trim()}</style>`);
  }
  const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const t = await minify(js, { ecma: 2022, compress: { passes: 3 }, mangle: true, format: { comments: false } });
  const squeeze = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s*\n\s*</g, '><').replace(/\n\s+/g, ' ');
  const [head, tail] = html.split(js);
  const page = Buffer.from(squeeze(head) + t.code + squeeze(tail), 'utf8');

  // 2. LZMA で圧縮
  const res = execFileSync('python3', ['-I', '-c', py], { input: page, maxBuffer: 64 << 20 });
  const lc = res[0], packed = res.subarray(1);

  // 3. 7 ビットずつ文字にする。テンプレート文字列と <script> の中で困る 6 文字 (NUL・CR・$・<・\・`) は、
  //    次の 7 ビットと組にして 2 バイトの文字 (U+0100〜U+03FF) で表す。増えるのは 8/7 倍だけ
  const ILL = [0, 13, 36, 60, 92, 96];
  const chunks = [];
  for (let acc = 0, bits = 0, i = 0; i < packed.length || bits > 0;) {
    if (bits < 7 && i < packed.length) { acc = (acc << 8) | packed[i++]; bits += 8; continue; }
    const take = Math.min(7, bits);
    chunks.push(((acc >> (bits - take)) << (7 - take)) & 127);
    bits -= take; acc &= (1 << bits) - 1;
  }
  let text = '';
  for (let i = 0; i < chunks.length; i++) {
    const k = ILL.indexOf(chunks[i]);
    if (k < 0) text += String.fromCharCode(chunks[i]);
    else text += String.fromCharCode(256 + (k << 7) + (chunks[++i] ?? 0));
  }

  // 4. 展開して元と照らし合わせる (書き出す前に)
  const dec7 = (s, n) => {
    const o = new Uint8Array(n); let acc = 0, bits = 0, j = 0;
    const put = (v) => { acc = (acc << 7) | v; bits += 7; if (bits >= 8) { bits -= 8; if (j < n) o[j++] = acc >> bits; acc &= (1 << bits) - 1; } };
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c < 128) put(c); else { put(ILL[(c - 256) >> 7]); put((c - 256) & 127); } }
    return o;
  };
  const back = unlzma(dec7(text, packed.length), page.length, lc, 0, 0);
  if (Buffer.compare(Buffer.from(back), page) !== 0) throw new Error('展開したものが元と一致しない');

  // 5. 自分で展開する HTML。標準モードにするため doctype から始め、展開した HTML をその場で書き込む
  const loaderSrc = `${fs.readFileSync(path.join(root, 'tools/unlzma.js'), 'utf8').replace(/if \(typeof module[^\n]*\n/, '')}
  const ILL=[0,13,36,60,92,96];${dec7.toString().replace(/^/, 'const dec7=')};
  document.write(new TextDecoder().decode(unlzma(dec7(D,${packed.length}),${page.length},${lc},0,0)));`;
  const loader = (await minify(loaderSrc, { ecma: 2022, compress: { passes: 2 }, mangle: { toplevel: true }, format: { comments: false } })).code;
  // 展開器の名前はゲーム本体の名前とぶつからないよう、関数の中に閉じ込める
  const out = `<!doctype html><meta charset="utf-8"><title>${title}</title><script>(()=>{const D=\`${text}\`;${loader}})()</script>`;
  fs.writeFileSync(simTo || path.join(root, file), out);
  console.log(`${edition}: src ${kb(Buffer.byteLength(src))} → 最小化 ${kb(page.length)} → LZMA ${kb(packed.length)} (lc=${lc}) → ${file} ${kb(Buffer.byteLength(out))}`);
}
