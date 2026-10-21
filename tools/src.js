// ゲームの元のファイルを組み立てる。src/index.html の「//#include <パス>」だけの行を、そのファイル (src/ からの相対パス) の中身に置き換える。
// 中身は足しも削りもしないので、組み立てたものは、ファイルを分ける前 (回 R3。docs/restart.md の 5) の src/index.html と 1 バイトずつ同じになる。
// どのファイルをどのレーンが持つかは docs/parallel.md の地図。組み立て (tools/build.mjs)・画面なしの版 (tools/headless.js)・CI は、これを通して読む
// 使い方: node tools/src.js [--ref <git の参照>] [--out <ファイル>]   |   node tools/src.js --check
//   --ref: そのコミットの src を組み立てる (分ける前のコミットでもよい。CI で main と比べるとき)。--out を省くと標準出力へ
//   --check: src/ の下のファイルが、どれもちょうど 1 回ずつ組み込まれているか (足したファイルの //#include を忘れていないか) を確かめる (CI の試験)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INCLUDE = /^\/\/#include (\S+)\n?$/;

// file = 組み立てる元のファイル (ふつうは src/index.html)。ref を渡すと、ファイルはそのコミットから読む (file は ROOT からの相対パス)
function assemble({ file = path.join(ROOT, 'src/index.html'), ref = null } = {}) {
  const rel = path.relative(ROOT, path.resolve(file)).split(path.sep).join('/');
  const read = ref
    ? (p) => execFileSync('git', ['show', `${ref}:${p}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
    : (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const top = ref ? read(rel) : fs.readFileSync(file, 'utf8');
  const dir = path.posix.dirname(rel);
  const lines = top.split(/(?<=\n)/);
  if (!lines.some((l) => INCLUDE.test(l))) return top;
  return lines.map((l) => {
    const m = l.match(INCLUDE);
    if (!m) return l;
    const t = read(path.posix.join(dir, m[1]));
    if (t.split(/(?<=\n)/).some((x) => INCLUDE.test(x))) throw new Error(`${m[1]} の中に //#include がある (1 段だけにする)`);
    return t;
  }).join('');
}

// src/ の下のファイル (index.html のほか) と、index.html の //#include を突き合わせる。食い違いの一覧を返す (空なら合格)
function check() {
  const dir = path.join(ROOT, 'src');
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(dir, p).split(path.sep).join('/')); } };
  walk(dir);
  const inc = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').split(/(?<=\n)/).map((l) => l.match(INCLUDE)?.[1]).filter(Boolean);
  const errs = [];
  for (const f of files) if (f !== 'index.html' && !inc.includes(f)) errs.push(`${f} が index.html に組み込まれていない`);
  for (const f of inc) {
    if (!files.includes(f)) errs.push(`${f} がない`);
    if (inc.indexOf(f) !== inc.lastIndexOf(f)) errs.push(`${f} を 2 回組み込んでいる`);
  }
  return [...new Set(errs)];
}

module.exports = { assemble, check };

if (require.main === module) {
  const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
  if (process.argv.includes('--check')) {
    const errs = check();
    console.log(errs.length ? errs.join('\n') : 'src のファイルはすべて 1 回ずつ組み込まれている');
    process.exit(errs.length ? 1 : 0);
  }
  const text = assemble({ ref: arg('--ref') });
  if (arg('--out')) fs.writeFileSync(arg('--out'), text);
  else process.stdout.write(text);
}
