// 回を始める前の確かめ (docs/session-start.md の 3)。その回の前に済んでいる必要がある回 (tools/sessions.json) が、
// main で済んでいるかを見る。済んだかは、main の docs/status/<レーン>.md の「## 済んだ回」の行 (「- GA1 (#180)」の形) で決まる。
// 始めてはいけないときは、理由を出して終了コード 1 で止まる。そのときセッションは、表示をそのままユーザーに伝えて、何もせずに止まる
// 使い方: node tools/session-check.js <回>      (例: node tools/session-check.js GA3。SESSION_CHECK_LOCAL=1 を付けると main でなく手元のファイルで見る)
//         node tools/session-check.js --next   いま始められる回の一覧
//         node tools/session-check.js --check  tools/sessions.json と docs/sessions.md の回が合っているか (CI の試験)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/sessions.json'), 'utf8'));
const ALL = Object.keys(DATA.sessions);
const laneOf = (id) => id.replace(/\d+$/, '');
const label = (id) => `${id} (${DATA.lanes[laneOf(id)] || laneOf(id)})`;

// main の文書を読む (先に origin/main を取ってくる。取れなければ手元のファイルを読む)
let fromMain = !process.env.SESSION_CHECK_LOCAL; // SESSION_CHECK_LOCAL=1 で手元のファイルを読む (試すとき)
if (fromMain) { try { execFileSync('git', ['fetch', '-q', 'origin', 'main'], { cwd: ROOT, stdio: 'ignore', timeout: 60000 }); } catch { fromMain = false; } }
const readDoc = (p) => {
  if (fromMain) { try { return execFileSync('git', ['show', `origin/main:${p}`], { cwd: ROOT, encoding: 'utf8' }); } catch { /* 手元へ */ } }
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; }
};

// 済んだ回: レーンの状態のファイルの「## 済んだ回」の節の「- <回>」の行
const doneCache = {};
function doneIn(file) {
  if (doneCache[file]) return doneCache[file];
  const text = readDoc(`docs/status/${file}.md`);
  const m = text.match(/^## 済んだ回\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  const out = {};
  for (const l of (m ? m[1] : '').split('\n')) { const x = l.match(/^- ([A-Z]+\d+)\b(.*)$/); if (x) out[x[1]] = x[2].trim(); }
  return (doneCache[file] = out);
}
const isDone = (id) => id in doneIn(DATA.status[laneOf(id)]);
const sessionsMd = readDoc('docs/sessions.md');
const hasPrompt = (id) => new RegExp(`^### 回 ${id}\\b`, 'm').test(sessionsMd);

function canStart(id) {
  const missing = DATA.sessions[id].filter((p) => !isDone(p));
  return { done: isDone(id), missing, prompt: hasPrompt(id) };
}
const startable = () => ALL.filter((id) => { const s = canStart(id); return !s.done && !s.missing.length; });

const arg = process.argv[2];
if (arg === '--check') {
  const errs = [];
  for (const id of ALL) {
    for (const p of DATA.sessions[id]) if (!(p in DATA.sessions)) errs.push(`${id} の前の回 ${p} が tools/sessions.json にない`);
    if (!(laneOf(id) in DATA.status)) errs.push(`${id} のレーン ${laneOf(id)} の状態のファイルが決まっていない`);
  }
  const local = fs.readFileSync(path.join(ROOT, 'docs/sessions.md'), 'utf8');
  for (const [, id] of local.matchAll(/^### 回 ([A-Z]+\d+)\b/gm)) if (!(id in DATA.sessions)) errs.push(`docs/sessions.md の回 ${id} が tools/sessions.json にない`);
  console.log(errs.length ? errs.join('\n') : `回の順番の表は合っている (${ALL.length} 回)`);
  process.exit(errs.length ? 1 : 0);
}
if (!fromMain && !process.env.SESSION_CHECK_LOCAL) console.log('(注意: origin/main を取れなかったので、手元のファイルで確かめた)');
if (!arg || arg === '--next') {
  const ok = startable();
  console.log(ok.length ? `いま始められる回: ${ok.map((id) => `${label(id)}${hasPrompt(id) ? '' : ' ※最初の文はまだない'}`).join('、')}` : 'いま始められる回はない');
  process.exit(0);
}
const id = arg.toUpperCase();
if (!(id in DATA.sessions)) {
  console.log(`回 ${arg} は tools/sessions.json にない。回の名前は ${ALL.join('・')}`);
  process.exit(1);
}
const s = canStart(id);
const others = () => { const ok = startable(); return ok.length ? `いま始められる回: ${ok.map(label).join('、')}` : 'いま始められる回はない'; };
if (s.done) {
  console.log(`止まる: 回 ${label(id)} はもう済んでいます${doneIn(DATA.status[laneOf(id)])[id] ? ` ${doneIn(DATA.status[laneOf(id)])[id]}` : ''}。\n${others()}`);
  process.exit(1);
}
if (s.missing.length) {
  console.log(`止まる: 回 ${label(id)} を始めるには、${s.missing.map(label).join('・')} が済んでいる必要がありますが、まだ済んでいません。\n${others()}`);
  process.exit(1);
}
if (!s.prompt) {
  console.log(`止まる: 回 ${label(id)} の前の回は済んでいますが、docs/sessions.md にこの回の最初の文がまだありません (2 波目の回は、回 W1 の見直しで書く)。\n${others()}`);
  process.exit(1);
}
console.log(`始めてよい: 回 ${label(id)}${DATA.sessions[id].length ? ` (前の回 ${DATA.sessions[id].join('・')} は済んでいる)` : ''}`);
