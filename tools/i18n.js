// 画面の文字列を集めて、言語ごとの表 (src/outward/lang-en.js) とそろえる道具 (回 T1・B-073。決まりは docs/i18n.md)。
// 正本はコードの中の日本語の文。src/index.html を tools/src.js で 1 枚にして acorn で読み、日本語を含む文字列と
// テンプレート (`…${x}…` は「…{0}…」の鍵にする) を、ファイルごとに集める。画面の骨組み (screen/page.html) の文字と属性も集める。
// 使い方:
//   node tools/i18n.js            表と突き合わせる (CI の試験。訳のない鍵・表にない鍵・{0} と HTML の札の食い違いを出す)
//   node tools/i18n.js --sync     表の鍵をコードにそろえる (足りない鍵を null で足し、コードから消えた鍵を消す。訳は残す)
//   node tools/i18n.js --todo [n] 訳のない鍵を、ファイルと行と式つきで JSON に出す (訳すときの下書き。n 件まで)
//   node tools/i18n.js --stats    ファイルごとの鍵の数と、訳の済んだ割合
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const INCLUDE = /^\/\/#include (\S+)\n?$/;
const JP = /[぀-ヿ㐀-鿿！-～]/;
const LANG_FILES = { en: path.join(SRC, 'outward/lang-en.js') };
const RULES = '名前の作り方と文の型 (コードにない鍵。--sync は消さない)';

// src/index.html の組み込みを、ファイルごとの位置つきでつなぐ (tools/src.js の assemble と同じ中身)
function assembleWithMap() {
  const top = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const segs = [];
  let text = '';
  for (const l of top.split(/(?<=\n)/)) {
    const m = l.match(INCLUDE);
    const body = m ? fs.readFileSync(path.join(SRC, m[1]), 'utf8') : l;
    segs.push({ file: m ? m[1] : 'index.html', start: text.length, body });
    text += body;
  }
  return { text, segs };
}
function where(segs, text, pos) {
  let s = segs[0];
  for (const x of segs) if (x.start <= pos) s = x; else break;
  const line = text.slice(s.start, pos).split('\n').length;
  return { file: s.file, line };
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

// 鍵を集める。返すのは [{ key, file, line, hint }] (同じ鍵は最初の所だけ)
function collect() {
  const { text, segs } = assembleWithMap();
  const out = new Map();
  const SKIP = new Set(['outward/i18n.js', ...Object.values(LANG_FILES).map((f) => path.relative(SRC, f).split(path.sep).join('/'))]); // 翻訳の仕組みと表そのものは集めない
  const add = (key, pos, hint = '') => {
    if (!JP.test(key) || out.has(key)) return;
    const w = where(segs, text, pos);
    if (!SKIP.has(w.file)) out.set(key, { key, ...w, hint });
  };
  // 画面の骨組み (<script> の外): 文字の部品と属性
  const htmlEnd = text.indexOf('<script>');
  const html = text.slice(0, htmlEnd).replace(/<style[^>]*>[\s\S]*?<\/style>/g, (m) => ' '.repeat(m.length)).replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
  for (const m of html.matchAll(/>([^<]+)</g)) { const t = decode(m[1]).trim(); if (t) add(t, m.index + 1, 'HTML の文字'); }
  for (const m of html.matchAll(/\s(?:title|placeholder|aria-label|alt|value)="([^"]*)"/g)) add(decode(m[1]), m.index, 'HTML の属性');
  // <script> の中
  const js0 = htmlEnd + '<script>'.length, js = text.slice(js0, text.lastIndexOf('</script>'));
  const ast = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'script' });
  walk.full(ast, (n) => {
    if (n.type === 'Literal' && typeof n.value === 'string') add(n.value, js0 + n.start);
    else if (n.type === 'TemplateLiteral') {
      const q = n.quasis.map((x) => x.value.cooked);
      let key = q[0];
      for (let i = 1; i < q.length; i++) key += `{${i - 1}}${q[i]}`;
      const hint = n.expressions.map((e, i) => `{${i}} = ${js.slice(e.start, e.end)}`).join('  ');
      add(key, js0 + n.start, hint);
    }
  });
  return [...out.values()];
}

// 表のファイル: 1 行に 1 つ「"鍵": "訳",」。「// == 名前」の行が区切り (ファイルの名前か RULES)
function readTable(file) {
  const entries = new Map(); // key → { value, section }
  if (!fs.existsSync(file)) return entries;
  let section = '';
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    const sec = l.match(/^\/\/ == (.+)$/);
    if (sec) { section = sec[1]; continue; }
    if (!l.startsWith('"')) continue;
    const o = JSON.parse(`{${l.replace(/,\s*$/, '')}}`);
    for (const [k, v] of Object.entries(o)) {
      if (entries.has(k)) throw new Error(`${path.relative(ROOT, file)}: 鍵が 2 回ある: ${k}`);
      entries.set(k, { value: v, section });
    }
  }
  return entries;
}
const HEAD = (lang) => `// ${lang === 'en' ? '英語' : lang} の表 (回 T1・B-075。決まりは docs/i18n.md)。鍵はコードの中の日本語の文 (テンプレートの \${…} は {0}・{1}…)。
// 鍵をそろえるのは node tools/i18n.js --sync (足りない鍵を null で足し、コードから消えた鍵を消す)。訳を書くのは人。null = まだ訳していない (日本語のまま出る)。
// 1 行に 1 つ。「// == ファイル」の区切りは、その鍵が最初に出てくるファイル。最後の区切り (${RULES}) の鍵は、名前と記録の文を訳すための型で、--sync は消さない。
// 用語は docs/glossary/terms.json の訳にそろえる。文の調子は古い報告書 (簡潔に)。単位 (ly・cr・J・QJ・AU) は訳さない。
const I18N_EN = {
`;
function writeTable(file, lang, keys, old) {
  const lines = [HEAD(lang)];
  let sec = null;
  for (const k of keys) {
    if (k.file !== sec) { sec = k.file; lines.push(`// == ${sec}\n`); }
    lines.push(`${JSON.stringify(k.key)}: ${JSON.stringify(old.get(k.key)?.value ?? null)},\n`);
  }
  lines.push(`// == ${RULES}\n`);
  for (const [k, e] of old) if (e.section === RULES) lines.push(`${JSON.stringify(k)}: ${JSON.stringify(e.value)},\n`);
  lines.push('};\n');
  fs.writeFileSync(file, lines.join(''));
}

// 訳の形の確かめ: {0} の組と、HTML の札 (<b> など) の並びが鍵と同じか
const holes = (s) => [...s.matchAll(/\{(\d+)(?::(?:month))?\}/g)].map((m) => m[1]).sort().join(','); // 訳では {1:month} (月の名前) も書ける
const tags = (s) => [...s.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g)].map((m) => (m[0][1] === '/' ? '/' : '') + m[1].toLowerCase()).join(' ');
function problems(key, v) {
  const p = [];
  if (typeof v !== 'string') return p;
  if (holes(key) !== holes(v)) p.push(`{n} が違う (鍵 ${holes(key) || 'なし'}・訳 ${holes(v) || 'なし'})`);
  if (tags(key) !== tags(v)) p.push(`HTML の札が違う (鍵「${tags(key)}」・訳「${tags(v)}」)`);
  if (JP.test(v.replace(/[・—…→←↑↓×÷±≈≤≥「」]/g, ''))) p.push('訳に日本語が残っている');
  return p;
}

function check(lang = 'en') {
  const keys = collect(), tbl = readTable(LANG_FILES[lang]);
  const want = new Set(keys.map((k) => k.key));
  const missing = keys.filter((k) => !tbl.has(k.key));
  const untranslated = keys.filter((k) => tbl.has(k.key) && typeof tbl.get(k.key).value !== 'string');
  const stale = [...tbl].filter(([k, e]) => !want.has(k) && e.section !== RULES).map(([k]) => k);
  const bad = [...tbl].flatMap(([k, e]) => problems(k, e.value).concat(e.section !== RULES && typeof e.value === 'string' && e.value.includes('{stem}') ? ['{stem} は名前の作り方の区切りの鍵だけに使う'] : []).map((p) => `${k} → ${p}`));
  return { keys, missing, untranslated, stale, bad };
}

module.exports = { collect, readTable, check };

if (require.main === module) {
  const a = process.argv.slice(2);
  const lang = 'en';
  if (a.includes('--sync')) {
    const keys = collect(), old = readTable(LANG_FILES[lang]);
    writeTable(LANG_FILES[lang], lang, keys, old);
    const r = check(lang);
    console.log(`表をそろえた: 鍵 ${r.keys.length}・訳のない鍵 ${r.untranslated.length}`);
  } else if (a.includes('--todo')) {
    const n = +a[a.indexOf('--todo') + 1] || Infinity;
    const r = check(lang);
    console.log(JSON.stringify(r.untranslated.slice(0, n).map(({ key, file, line, hint }) => ({ key, file, line, ...(hint ? { hint } : {}) })), null, 1));
  } else if (a.includes('--stats')) {
    const r = check(lang), tbl = readTable(LANG_FILES[lang]), by = new Map();
    for (const k of r.keys) { const s = by.get(k.file) || { n: 0, done: 0 }; s.n++; if (typeof tbl.get(k.key)?.value === 'string') s.done++; by.set(k.file, s); }
    for (const [f, s] of [...by].sort((x, y) => y[1].n - x[1].n)) console.log(`${String(s.n).padStart(5)} ${String(Math.round((100 * s.done) / s.n)).padStart(3)}% ${f}`);
    console.log(`合計 ${r.keys.length}・訳のない鍵 ${r.untranslated.length}`);
  } else {
    const r = check(lang);
    const show = (t, xs) => xs.length && console.log(`${t} (${xs.length}):\n${xs.slice(0, 30).map((x) => `  ${x}`).join('\n')}${xs.length > 30 ? '\n  …' : ''}`);
    show('表にない鍵 (node tools/i18n.js --sync で足して訳す)', r.missing.map((k) => `${k.file}:${k.line} ${k.key}`));
    show('訳のない鍵 (null)', r.untranslated.map((k) => `${k.file}:${k.line} ${k.key}`));
    show('コードにない鍵 (--sync で消える)', r.stale);
    show('訳の形の食い違い', r.bad);
    const ok = !r.missing.length && !r.untranslated.length && !r.stale.length && !r.bad.length;
    console.log(`鍵 ${r.keys.length}・訳のない鍵 ${r.missing.length + r.untranslated.length}・形の食い違い ${r.bad.length}`);
    console.log(ok ? '翻訳の表 合格' : '翻訳の表 不合格');
    process.exit(ok ? 0 : 1);
  }
}
