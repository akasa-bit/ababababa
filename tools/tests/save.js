// セーブの試験 (回 R3。docs/restart.md の 5)。画面なしの版で回す。
// 1. src を分ける前 (回 R1 の基準の main 3a5b5d9) のゲームで作ったセーブを、いまのゲームで読める。読んだものを、いまのゲームで保存して読み直しても、
//    続けて回した筋が同じ (保存で何も落ちない)。前のゲームで続けた筋とは比べない (遊びを変えた PR はかならず違う筋になるため。回 SE1)
// 2. 仕組みごとのセーブの項目 (core/base.js の saveField): 初期値 (init)・書く順 (前からの項目の後ろ、savedAt の前)・
//    項目のない前の版のセーブを読んだときの既定 (read)・同じ名前を 2 回登録すると止まる
// 使い方: node tools/tests/save.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('セーブ') }];
if (require.main !== module) return;
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('../headless');
const { assemble } = require('../src');

const BASE_REF = '3a5b5d9'; // docs/restart-baseline.md の基準の main (src を分ける前)
const fails = [];
const now = H.load({ edition: 'game' });
// セーブを読むときは、ゲームと同じくセーブに書いた銀河の版で銀河を作る (screen/playlog.js の読み込み。版 5 で星が変わった)
const blank = (sim, gen = sim.GALAXY_GEN) => new sim.Game(sim.generateGalaxy({ seed: '4', starCount: 400, meanSpacing: 4, kind: 'real', gen }));

// 1
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nlu-save-')), 'base-src.html');
fs.writeFileSync(tmp, assemble({ ref: BASE_REF }));
const old = H.load({ src: tmp, edition: 'game' });
const gOld = old.run(old.newGame('4', { nations: 6 }), 60);
const dOld = JSON.parse(JSON.stringify(old.buildSave(gOld)));
const gNew = blank(now, dOld.gen || 1);
if (!gNew.restore(dOld)) fails.push('前のゲームのセーブが読めない');
const dNew = JSON.parse(JSON.stringify(now.buildSave(gNew)));
const gAgain = blank(now, dNew.gen || 1);
if (!gAgain.restore(dNew)) fails.push('前のセーブを読んだものを、保存して読み直せない');
now.run(gNew, 40); now.run(gAgain, 40);
const [h0, h1] = [now.hash(gAgain), now.hash(gNew)];
if (h0 !== h1) fails.push(`前のセーブを読んだものと、それを保存して読み直したもので、続けた筋が違う (${h1}・読み直し ${h0})`);

// 2
const reg = H.load({ edition: 'game' });
reg.evaluate("saveField('testX', (g) => g.testX, { init: (g) => { g.testX = 1; }, read: (g, d) => { g.testX = Number.isFinite(d.testX) ? d.testX : 5; } })");
const g = reg.newGame('2', { nations: 6 });
if (g.testX !== 1) fails.push(`登録した項目の初期値 ${g.testX}`);
g.testX = 7;
const d = reg.buildSave(g);
const keys = Object.keys(d);
if (keys[keys.length - 2] !== 'testX' || keys[keys.length - 1] !== 'savedAt') fails.push(`登録した項目の並び ${keys.slice(-3).join(',')}`);
const g2 = blank(reg);
if (!g2.restore(JSON.parse(JSON.stringify(d))) || g2.testX !== 7) fails.push(`登録した項目を読めない (${g2.testX})`);
const d0 = JSON.parse(JSON.stringify(d));
delete d0.testX;
const g3 = blank(reg);
if (!g3.restore(d0) || g3.testX !== 5) fails.push(`項目のないセーブで既定に戻らない (${g3.testX})`);
let threw = false;
try { reg.evaluate("saveField('testX', (g) => 0)"); } catch { threw = true; }
if (!threw) fails.push('同じ名前の項目を 2 回登録できてしまった');
// 登録のない版は、前と同じ並び (savedAt が最後)
const k0 = Object.keys(now.buildSave(gNew));
if (k0[k0.length - 1] !== 'savedAt' || k0.includes('testX')) fails.push('登録のない版のセーブの並びが違う');

console.log(`セーブ ${fails.length ? '不合格' : '合格'} ・ 前のセーブから続けた筋 ${h1}`);
for (const f of fails) console.log(`  × ${f}`);
process.exit(fails.length ? 1 : 0);
