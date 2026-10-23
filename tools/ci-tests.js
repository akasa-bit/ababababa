// CI の試験の一式: 組み立て → tools/tests の試験 (ファイルを自動で拾う) を順に回し、出力から合否を決めて表 (Markdown) を標準出力へ書く。1 つでも落ちたら終了コード 1。
// 合否の見方は docs/handoff.md の 14 (試験の「合格」の見え方) と同じ。どの試験も、ページの誤りがあれば落とす
// 使い方: node tools/ci-tests.js [試験の名前 …]   (名前を渡すと、その試験だけ)
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nlu-shots-'));

// 試験の一覧は tools/tests の *.js を自動で拾う (回 DO4・B-221)。各ファイルが先頭で exports.ci に回し方と合否を書く:
//   exports.ci = [{ args, judge, env, optional, needs }];   (書き方は docs/parallel.md の 7 の道具と検証)
//   args = 引数の配列か (c) => 配列、judge = (出力, 終了コード) → 理由の文字列 (合格なら空)、env = 足す環境変数 (か (c) => …)、
//   optional = シミュレーション版の試験 (表に「参考」と出し、落ちても CI は止めない。docs/parallel.md の 6)、needs = (c) → このファイルがなければ回さない
//   c = { root, shots, path }。exports.ci がないファイルは、引数なしで回して終了コード 0 なら合格
const CTX = { root: ROOT, shots: SHOTS, path };
const TESTDIR = path.join(ROOT, 'tools/tests');
const TESTS = [];
for (const f of fs.readdirSync(TESTDIR).filter((f) => f.endsWith('.js')).sort()) {
  const name = f.slice(0, -3);
  let ci;
  // exports.ci を書いていないファイルは読まない (読むと試験の本体がこのプロセスで動いてしまう)
  try { ci = /^exports\.ci\s*=/m.test(fs.readFileSync(path.join(TESTDIR, f), 'utf8')) ? require(path.join(TESTDIR, f)).ci : undefined; }
  catch (e) { TESTS.push([name, [], () => `試験のファイルを読めない: ${String(e.message).split('\n')[0]}`, { broken: true }]); continue; }
  if (ci === false) continue; // CI では回さない
  const exit0 = (o, code) => (code === 0 ? '' : `終了コード ${code}`);
  for (const t of ci || [{}]) {
    const val = (v) => (typeof v === 'function' ? v(CTX) : v);
    TESTS.push([name, val(t.args) || [], t.judge || exit0, { env: val(t.env), optional: t.optional, needs: val(t.needs) }]);
  }
}

const only = process.argv.slice(2);
const rows = [];
let failed = 0;
const t00 = Date.now();
// 0. 組み立て (公開用の index.html を元のファイルから作り直す。試験は作り直したものを開く)
try { execFileSync('node', [path.join(ROOT, 'tools/build.mjs')], { stdio: 'pipe' }); rows.push(['build', '合格', '']); }
catch (e) { rows.push(['build', '**不合格**', String(e.stderr || e).slice(0, 200)]); failed++; }
// シミュレーション版は、試験の作業場所にだけ作る (リポジトリの simulation.html は変えない。落ちても CI は止めない)
try { execFileSync('node', [path.join(ROOT, 'tools/build.mjs'), '--sim-to', path.join(SHOTS, 'simulation.html')], { stdio: 'pipe' }); }
catch (e) { rows.push(['build (シミュレーション版・参考)', '不合格 (参考。無視してよい)', String(e.stderr || e).slice(0, 200)]); }
// 0'. src/ の下のファイルが、どれも 1 回ずつ組み込まれている (tools/src.js。足したファイルの //#include の忘れ)
{
  const r = spawnSync('node', [path.join(ROOT, 'tools/src.js'), '--check'], { encoding: 'utf8' });
  rows.push(['src', r.status === 0 ? '合格' : '**不合格**', r.status === 0 ? '' : (r.stdout + r.stderr).trim().slice(0, 200)]);
  if (r.status !== 0) failed++;
}
// 0'''. 回の順番の表 (tools/sessions.json) と docs/sessions.md の回が合っている (tools/session-check.js)
{
  const r = spawnSync('node', [path.join(ROOT, 'tools/session-check.js'), '--check'], { encoding: 'utf8' });
  rows.push(['sessions', r.status === 0 ? '合格' : '**不合格**', r.status === 0 ? '' : (r.stdout + r.stderr).trim().slice(0, 200)]);
  if (r.status !== 0) failed++;
}
// 0''. 合わせる目標のファイルが固定したときから変わっていない
{
  const r = spawnSync('node', [path.join(ROOT, 'tools/check-targets.js')], { encoding: 'utf8' });
  rows.push(['targets', r.status === 0 ? '合格' : '**不合格**', r.status === 0 ? '' : (r.stdout + r.stderr).trim().slice(0, 200)]);
  if (r.status !== 0) failed++;
}
for (const [name, args, judge, opt = {}] of TESTS) {
  if (only.length && !only.includes(name)) continue;
  if (opt.needs && !fs.existsSync(opt.needs)) continue;
  const t0 = Date.now();
  const r = opt.broken ? { stdout: '', status: 1 } : spawnSync('node', [path.join(ROOT, 'tools/tests', `${name}.js`), ...args], { encoding: 'utf8', cwd: SHOTS, timeout: 20 * 60 * 1000, maxBuffer: 64 << 20, env: { ...process.env, ...(opt.env || {}) } });
  const out = `${r.stdout || ''}`;
  const why = r.error ? String(r.error.message) : judge(out, r.status);
  if (why) { if (!opt.optional) failed++; process.stderr.write(`--- ${name}\n${out}\n${r.stderr || ''}\n`); }
  const label = opt.optional ? `${name} (シミュレーション版・参考)` : name;
  rows.push([label, why ? (opt.optional ? '不合格 (参考。無視してよい)' : '**不合格**') : '合格', `${why ? `${why}。` : ''}${((Date.now() - t0) / 1000).toFixed(0)} 秒`]);
}
console.log(`### 試験 (${failed ? `${failed} 件が不合格` : 'すべて合格'}。${((Date.now() - t00) / 60000).toFixed(1)} 分)`);
console.log('');
console.log('| 試験 | 結果 | メモ |');
console.log('|---|---|---|');
for (const [n, r, m] of rows) console.log(`| ${n} | ${r} | ${m.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
process.exit(failed ? 1 : 0);
