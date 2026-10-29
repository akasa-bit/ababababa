// 政策の反応の道具 (tools/policy-irf.js。回 KE7・B-006) の試験。1 銀河で双子の試合を回し、何も変えない双子が比べる元と同じ筋になる (セーブで落ちる値がない) こと、
// 3 つの政策のどれも表が出ることを確かめる
// 使い方: node tools/tests/policy-irf.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('政策の反応') }];
if (require.main !== module) return;
const path = require('path');
const { spawnSync } = require('child_process');
const r = spawnSync('node', [path.join(__dirname, '..', 'policy-irf.js'), '1', '6', '--at', '30', '--h', '2'], { encoding: 'utf8', env: process.env });
const fails = [];
if (r.status !== 0) fails.push(`道具が失敗した (終了コード ${r.status}): ${(r.stderr || '').split('\n').filter((l) => /ずれた|Error/.test(l)).slice(0, 3).join(' / ')}`);
for (const k of ['rate', 'tax', 'spend']) if (!new RegExp(`### ${k} \\(実験 [1-9]`).test(r.stdout)) fails.push(`${k} の表がない`);
console.log(fails.length ? `政策の反応 不合格: ${fails.join('・')}` : '政策の反応 合格');
process.exit(fails.length ? 1 : 0);
