// コンテンツの点検 (tools/content.js --check): 資源・施設・種族の特性・挑戦・国家方針・委任方針・総督の方針・帳簿・知らせの種類・協定・難易度・国の名前の
// 表がそろっているか (名前・アイコン・対になる表)、語り手の出来事はどれも実際に起こして、どの選択肢を選んでも壊れないか。決まりは docs/content.md
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('コンテンツの点検') }];
if (require.main !== module) return;
const { spawnSync } = require('child_process');
const r = spawnSync('node', [require('path').join(__dirname, '../content.js'), '--check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
process.stdout.write(r.stdout);
process.exit(r.status ?? 1);
