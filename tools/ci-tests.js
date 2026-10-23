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
// [名前, 引数, 合格の決まり (出力 → 理由の文字列。合格なら空), { env, optional }]
// optional = シミュレーション版の試験 (表に「参考」と出し、落ちても CI は止めない。ほかのレーンはシミュレーション版を無視してよい: docs/parallel.md の 6)
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
    return m && m[1] === m[2] && m[3] === '1' && /errs \[\] \[\]/.test(o) && /^physics true/m.test(o) ? '' : 'ネット対戦の要約が合わない';
  }],
  ['cloud', [SHOTS], (o) => {
    try { const j = JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1)); return j.sync[0][1] === j.sync[1][1] && j.roomClosed === true && !j.errs.length ? '' : 'クラウドの結果が違う'; } catch { return '出力を読めない'; }
  }],
  ['pick', [SHOTS], (o) => (noPageErrors(o) ? '' : 'ページの誤り')],
  ['regime', [SHOTS], (o) => {
    try {
      const j = JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1));
      return Object.values(j).every((v) => v.regimes.join() === 'T14,T01,encomienda' && v.dominionLog === true && v.alias?.[1] === 'T13' && v.bundleCmd === true && v.bundle?.law === 'S' && v.elite === 'resist' && v.factV >= 6 && v.depose?.join() === 'true,true,coop' && v.arrears > 0 && v.union?.join() === 'true,true' && v.hist?.join() === 'true,true,true' && v.revoke[0] === true && v.saveLoad === true && !v.errs.length) ? '' : '統治体制の結果が違う';
    } catch { return '出力を読めない'; }
  }],
  ['editions', [SHOTS], (o) => (noPageErrors(o) ? '' : 'ページの誤り')],
  ['energy', ['5', '150'], (o) => (o.trim().split('\n')[0].includes('R07 合格') ? '' : 'R07 不合格')],
  ['conserve', ['5', '150'], (o) => (o.trim().split('\n')[0].includes('R03 合格') && o.includes('決まっていない出入り: なし') ? '' : 'R03 不合格')],
  // 物理: ゲーム版の分 (遮蔽・加速の時間・フレアの表示。2026-10-21 の P6) は落ちたら止める。シミュレーション版の分 (太陽電池の劣化も) は参考
  ['physics', ['5', '150'], (o, code) => (code === 0 && o.trim().split('\n')[0].includes('物理 合格') ? '' : '物理 不合格 (ゲーム版)'), { env: { EDITION: 'game' } }],
  ['physics', ['5', '150'], (o, code) => (code === 0 && o.trim().split('\n')[0].includes('物理 合格') ? '' : '物理 不合格 (シミュレーション版)'), { optional: true, env: { EDITION: 'sim' } }],
  ['energy', ['5', '150'], (o) => (o.trim().split('\n')[0].includes('R07 合格') ? '' : 'R07 不合格 (シミュレーション版)'), { optional: true, env: { HTML: path.join(SHOTS, 'simulation.html') } }],
  ['money', ['5', '150'], (o) => (o.trim().split('\n')[0].includes('お金の保存 合格') && o.includes('決まっていない出入り: なし') ? '' : 'お金の保存 不合格')],
  ['money', ['7', '150', '6'], (o) => (o.trim().split('\n')[0].includes('お金の保存 合格') && o.includes('決まっていない出入り: なし') ? '' : 'お金の保存 不合格 (6 か国)')],
  ['fiscal', [SHOTS], (o) => {
    try {
      const j = JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1));
      const good = (v) => v.ok && v.bad.every((b) => b === false) && v.pc === 5 && v.now.join() === '1.8,1,0.01' && v.budgetOnly.join() === 'true,0' && v.later.join() === '1.8,0.05'
        && v.loyalty.join() === 'false,true,true' && v.fine.join() === 'true,0.2,-0.0075,0.075' && v.bad2.every((b) => b === false) && v.ok2 && v.ctax.join() === '0.1,0.05,true,1.935,true' && v.hazard && v.fleet[1] > v.fleet[0] && Object.values(v.ledger).every(Boolean) && v.saveLoad && Math.abs(v.ui - 0.095) < 1e-9 && v.wide[0] === v.wide[1] && !v.errs.length;
      return Object.values(j).every(good) ? '' : '財政の結果が違う';
    } catch { return '出力を読めない'; }
  }],
  ['market', ['3', '80'], (o) => (o.includes('市場 合格') ? '' : '市場の結果が違う')],
  ['debt', ['3', '100'], (o) => (o.includes('国債 合格') ? '' : '国債の結果が違う')],
  ['rotate', [SHOTS, path.join(ROOT, 'index.html')], (o) => ((o.match(/rotated == fresh redraw: true \[\]/g) || []).length === 2 ? '' : '回したあとの絵が描き直しと違う')],
  // セーブ: 分ける前のゲームのセーブを読んで同じ筋で続く・仕組みごとのセーブの項目 (saveField) の初期値と既定 (回 R3)
  ['save', [], (o, code) => (code === 0 && o.includes('セーブ 合格') ? '' : 'セーブ 不合格')],
  // 戦略ボット: 観戦の AI と同じ値が放任と同じ筋・入植と交易と統治体制の値・遅れつきのボット (回 DO1。B-067・B-068)
  ['strategy', ['60', '1,2'], (o, code) => (code === 0 && o.includes('戦略ボット 合格') ? '' : '戦略ボット 不合格')],
  // 光より速く分かる情報をなくす (B-030) と、相手が見ている自分 (B-027)。落ちたら止める
  // 艦隊戦 (B-034。HOI4 の海戦を元にした形)。落ちたら止める
  ['battle', [], (o, code) => (code === 0 && o.includes('艦隊戦 合格') ? '' : '艦隊戦 不合格')],
  // 光速に近い艦隊の一撃 (B-035)。落ちたら止める
  ['strike', [], (o, code) => (code === 0 && o.includes('光速の一撃 合格') ? '' : '光速の一撃 不合格')],
  // 戦争の終わり方 (立ち消え・白紙講和の線・降伏。回 FU2 の R14 の直し e)。落ちたら止める
  ['warend', [], (o, code) => (code === 0 && o.includes('戦争の終わり方 合格') ? '' : '戦争の終わり方 不合格')],
  // 宇宙要塞 (2026-10-22 のユーザーの依頼)。落ちたら止める
  ['fort', [], (o, code) => (code === 0 && o.includes('宇宙要塞 合格') ? '' : '宇宙要塞 不合格')],
  ['lightwar', [], (o, code) => (code === 0 && o.includes('光の遅れ 合格') ? '' : '光の遅れ 不合格')],
  // 遅れて届く外交 (回 SE2・B-026)。落ちたら止める
  ['pacts', [], (o, code) => (code === 0 && o.includes('外交 合格') ? '' : '外交 不合格')],
  // 語り手の連作 (回 SE3・B-050)。落ちたら止める
  ['story', [], (o, code) => (code === 0 && o.includes('語り手 合格') ? '' : '語り手 不合格')],
  ['headless', ['100', '1,4,9'], (o, code) => (code === 0 && o.includes('画面なしの版: 一致') ? '' : '画面なしの版がブラウザと違う')],
];

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
  if (opt.env?.HTML && !fs.existsSync(opt.env.HTML)) continue;
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(ROOT, 'tools/tests', `${name}.js`), ...args], { encoding: 'utf8', cwd: SHOTS, timeout: 20 * 60 * 1000, maxBuffer: 64 << 20, env: { ...process.env, ...(opt.env || {}) } });
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
