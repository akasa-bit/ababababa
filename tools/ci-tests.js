// CI の試験の一式: 組み立て → tools/tests の試験を順に回し、出力から合否を決めて表 (Markdown) を標準出力へ書く。1 つでも落ちたら終了コード 1。
// 合否の見方は docs/handoff.md の 14 (試験の「合格」の見え方) と同じ。どの試験も、ページの誤りがあれば落とす
// 使い方: node tools/ci-tests.js [試験の名前 …]   (名前を渡すと、その試験だけ)
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nlu-shots-'));

const last = (out) => out.trim().split('\n').pop().trim();
const noPageErrors = (out) => /\[\]$/.test(last(out)) || /"errs": \[\]/.test(out);
// [名前, 引数, 合格の決まり (出力 → 理由の文字列。合格なら空)]
const TESTS = [
  ['det', ['3', '120'], (o) => ((o.match(/一致/g) || []).length >= 3 && o.includes('保存→読込→保存: true') && noPageErrors(o) ? '' : '再現性が一致しない')],
  ['hot', [], (o) => (o.includes('他国の艦隊には命令できない') && /\[ true, [^\]]*\] \[ true, [^\]]*\] \[\]$/.test(last(o)) ? '' : 'ホットシートの結果が違う')],
  ['treaty', [], (o) => (noPageErrors(o) ? '' : 'ページの誤り')],
  ['edit', [], (o) => (!/^(land|port) \d+ false/m.test(o) && noPageErrors(o) ? '' : '国家の編集が違う')],
  ['lib', [], (o) => (noPageErrors(o) ? '' : 'ページの誤り')],
  ['home', [], (o) => (/^\[ true, true,/m.test(o) && noPageErrors(o) ? '' : 'ホーム画面が違う')],
  ['real', [], (o) => (/^(land|port) \[ 'real', \d+/m.test(o) && noPageErrors(o) ? '' : '実在の銀河が開かない')],
  ['net', [], (o) => {
    const m = o.match(/sync2 \[ \[ \d+, '(\w+)', '[\d.]+' \], \[ \d+, '(\w+)', '[\d.]+', (\d+) \] \]/);
    return m && m[1] === m[2] && m[3] === '1' && /errs \[\] \[\]/.test(o) ? '' : 'ネット対戦の要約が合わない';
  }],
  ['cloud', [SHOTS], (o) => {
    try { const j = JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1)); return j.sync[0][1] === j.sync[1][1] && j.roomClosed === true && !j.errs.length ? '' : 'クラウドの結果が違う'; } catch { return '出力を読めない'; }
  }],
  ['pick', [SHOTS], (o) => (noPageErrors(o) ? '' : 'ページの誤り')],
  ['regime', [SHOTS], (o) => {
    try {
      const j = JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1));
      return Object.values(j).every((v) => v.regimes.join() === 'federal,dominion,encomienda' && v.revoke[0] === true && v.saveLoad === true && !v.errs.length) ? '' : '統治体制の結果が違う';
    } catch { return '出力を読めない'; }
  }],
  ['editions', [SHOTS], (o) => (noPageErrors(o) ? '' : 'ページの誤り')],
  ['energy', ['5', '150'], (o) => (o.trim().split('\n')[0].includes('R07 合格') ? '' : 'R07 不合格')],
  ['conserve', ['5', '150'], (o) => (o.trim().split('\n')[0].includes('R03 合格') && o.includes('決まっていない出入り: なし') ? '' : 'R03 不合格')],
  ['physics', ['5', '150'], (o, code) => (code === 0 && o.trim().split('\n')[0].includes('物理 合格') ? '' : '物理 不合格')],
  ['money', ['5', '150'], (o) => (o.trim().split('\n')[0].includes('お金の保存 合格') && o.includes('決まっていない出入り: なし') ? '' : 'お金の保存 不合格')],
  ['money', ['7', '150', '6'], (o) => (o.trim().split('\n')[0].includes('お金の保存 合格') && o.includes('決まっていない出入り: なし') ? '' : 'お金の保存 不合格 (6 か国)')],
  ['fiscal', [SHOTS], (o) => {
    try {
      const j = JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1));
      const good = (v) => v.ok && !v.bad[0] && !v.bad[1] && v.pc === 5 && v.now.join() === '1.8,1,0.01' && v.budgetOnly.join() === 'true,0' && v.later.join() === '1.8,0.05'
        && v.loyalty.join() === 'false,true,true' && v.hazard && v.fleet[1] > v.fleet[0] && Object.values(v.ledger).every(Boolean) && v.saveLoad && v.ui === 'low' && v.wide[0] === v.wide[1] && !v.errs.length;
      return Object.values(j).every(good) ? '' : '財政の結果が違う';
    } catch { return '出力を読めない'; }
  }],
  ['rotate', [SHOTS, path.join(ROOT, 'index.html')], (o) => ((o.match(/rotated == fresh redraw: true \[\]/g) || []).length === 2 ? '' : '回したあとの絵が描き直しと違う')],
  ['headless', ['100', '1,4,9'], (o, code) => (code === 0 && o.includes('画面なしの版: 一致') ? '' : '画面なしの版がブラウザと違う')],
];

const only = process.argv.slice(2);
const rows = [];
let failed = 0;
const t00 = Date.now();
// 0. 組み立て (公開用の index.html を元のファイルから作り直す。試験は作り直したものを開く)
try { execFileSync('node', [path.join(ROOT, 'tools/build.mjs')], { stdio: 'pipe' }); rows.push(['build', '合格', '']); }
catch (e) { rows.push(['build', '**不合格**', String(e.stderr || e).slice(0, 200)]); failed++; }
// 0'. 合わせる目標のファイルが固定したときから変わっていない
{
  const r = spawnSync('node', [path.join(ROOT, 'tools/check-targets.js')], { encoding: 'utf8' });
  rows.push(['targets', r.status === 0 ? '合格' : '**不合格**', r.status === 0 ? '' : (r.stdout + r.stderr).trim().slice(0, 200)]);
  if (r.status !== 0) failed++;
}
for (const [name, args, judge] of TESTS) {
  if (only.length && !only.includes(name)) continue;
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(ROOT, 'tools/tests', `${name}.js`), ...args], { encoding: 'utf8', cwd: SHOTS, timeout: 20 * 60 * 1000, maxBuffer: 64 << 20 });
  const out = `${r.stdout || ''}`;
  const why = r.error ? String(r.error.message) : judge(out, r.status);
  if (why) { failed++; process.stderr.write(`--- ${name}\n${out}\n${r.stderr || ''}\n`); }
  rows.push([name, why ? '**不合格**' : '合格', `${why ? `${why}。` : ''}${((Date.now() - t0) / 1000).toFixed(0)} 秒`]);
}
console.log(`### 試験 (${failed ? `${failed} 件が不合格` : 'すべて合格'}。${((Date.now() - t00) / 60000).toFixed(1)} 分)`);
console.log('');
console.log('| 試験 | 結果 | メモ |');
console.log('|---|---|---|');
for (const [n, r, m] of rows) console.log(`| ${n} | ${r} | ${m.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
process.exit(failed ? 1 : 0);
