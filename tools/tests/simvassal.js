// シミュレーション版の従属国の目標 (回 FU7・B-110。ユーザーの依頼 common-11「シミュレーションにも同じシステムを導入」):
// シミュレーション版を国家選択 6 か国の観戦で 24 銀河 × 300 年回し (12 銀河では R08 の中央値がシードの組で 96〜110 年と揺れ、帯の上端 106.2 年をまたぐ。手元で約 5 分) (tools/secession.js)、主従の結びつきの記録を、実データと同じ関数で測る。
//   R08 = 存続年数の中央値 (Kaplan–Meier。独立を出来事。tools/secession-analyze.js)。シミュレーション版は補正 C02・C03 がないので、英仏の植民地の帯 (63.8〜106.2 年) で判定する
//   R32 = 独立が戦争になる割合の型の家族ごと (data/build/analyze_vassal.py --game)。判定する
//   R30 = 存続の比の型の家族ごと。時代の効き (始まりの世紀) がまだないので判定しない (docs/game-plan.md の 6)。数だけ出す
//   R31 = 法と実態の差のハザード比。確認用 (目標の版 30 の note)。数だけ出す
// 1 行目に「従属国 合格」か「従属国 不合格」と、数の要約を出す。CI の表のメモの欄にも、合否によらず同じ要約を出す (note)
// 使い方: node tools/tests/simvassal.js <simulation.html> <書き出しのフォルダ> [銀河の数 = 24] [年数 = 300]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
const summary = (o) => o.trim().split('\n')[0].replace(/^従属国 (不)?合格: /, '');
exports.ci = [
  // シミュレーション版 (参考。落ちても CI は止めない。docs/parallel.md の 6)。組み立てに失敗して simulation.html がなければ回さない
  { args: (c) => [c.path.join(c.shots, 'simulation.html'), c.path.join(c.shots, 'simvassal'), '24', '300'], judge: J.firstLine('従属国', '従属国の目標 不合格 (シミュレーション版)'), note: summary, optional: true, needs: (c) => c.path.join(c.shots, 'simulation.html') },
];
if (require.main !== module) return;
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const [html, out, nS = '24', yS = '300'] = process.argv.slice(2);
if (!html || !out) { console.log('使い方: node tools/tests/simvassal.js <simulation.html> <書き出しのフォルダ> [銀河の数] [年数]'); process.exit(2); }
const seeds = Array.from({ length: Number(nS) }, (_, i) => i + 1).join(',');
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 20 * 60 * 1000 });
  if (r.status !== 0) { console.log(`従属国 不合格: ${path.basename(args[0])} が終了コード ${r.status} で止まった`); console.error(r.stdout, r.stderr); process.exit(1); }
  return r.stdout;
};
run('node', [path.join(ROOT, 'tools/secession.js'), path.resolve(html), path.resolve(out), yS, seeds, '6']);
const J2 = (s) => JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
const km = J2(run('node', [path.join(ROOT, 'tools/secession-analyze.js'), path.resolve(out)]));
const v = J2(run('python3', [path.join(ROOT, 'data/build/analyze_vassal.py'), '--game', path.resolve(out)]));
const T = require(path.join(ROOT, 'targets/targets.json')).realism.find((r) => r.id === 'R08').band;
const r08 = km.all.median, ok08 = r08 !== null && r08 >= T[0] && r08 <= T[1];
const ok32 = !!v.R32?.pass;
const r31 = v.R31 ? `${v.R31.hr} (95% ${v.R31.hr_ci95.join('〜')}。帯 ${v.R31.band.map((x) => x.toFixed(2)).join('〜')}。確認用)` : 'なし (結びつきが少ない)';
const line = `R08 中央値 ${r08 ?? '300 年超'} 年 (帯 ${T.join('〜')}) ${ok08 ? '合格' : '不合格'}・R32 ${v.R32?.in_band ?? 0}/${v.R32?.judged ?? 0} ${ok32 ? '合格' : '不合格'}・R30 ${v.R30?.in_band ?? 0}/${v.R30?.judged ?? 0} (判定しない)・R31 ${r31}・結びつき ${km.ties}・独立 ${km.independence} (${nS} 銀河 × ${yS} 年)`;
console.log(`従属国 ${ok08 && ok32 ? '合格' : '不合格'}: ${line}`);
console.log(JSON.stringify({ R08: km.all, byFamily: v.by_family, R30: v.R30, R31: v.R31, R32: v.R32 }, null, 1));
