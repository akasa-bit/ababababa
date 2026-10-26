// 試合の物の形の試験: 試合 (Game) の物に、作ったあと (刻みの途中・読み込み) に初めて書き込む値がないこと。
// 途中で値が増えると物の形が変わり、this.… の読み出しやメソッドの呼び出しが遅い道 (megamorphic) に落ちて戻らない (試合を回す時間が 2 割ほど延びた)。
// 落ちたら、出てきた名前を src/core/game-consts.js の GAME_LATE_FIELDS に足す (値は undefined で置かれるので、試合の筋は変わらない)
// 使い方: node tools/tests/shape.js [年数=60]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('物の形') }];
if (require.main !== module) return;
const H = require('../headless');

const years = Number(process.argv[2] || 60);
const late = new Map(); // 名前 → 見つけた筋
for (const edition of ['game', 'sim']) {
  const sim = H.load({ edition });
  const fresh = (seed) => new sim.Game(sim.generateGalaxy({ seed, starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
  const base = new Set(Object.keys(fresh('1')));
  const note = (g, tag) => { for (const k of Object.keys(g)) if (!base.has(k) && !late.has(k)) late.set(k, `${edition}・${tag}`); };
  for (const [seed, nations, spectate] of [['1', 6, true], ['2', 0, true], ['3', 0, false], ['4', 8, false]]) {
    if (edition === 'sim' && seed !== '1') continue; // シミュレーション版は 1 つだけ (凍結中)
    const g = sim.run(sim.newGame(seed, { nations, spectate }), years);
    note(g, `シード ${seed}・${nations} か国`);
    // 読み込んだ試合も、読み込みと続きで値が増えない
    const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
    const g2 = fresh(String(d.seed));
    g2.restore(d);
    note(g2, `シード ${seed} の読み込み`);
    note(sim.run(g2, 10), `シード ${seed} の読み込みの続き`);
  }
}
console.log(`物の形 ${late.size ? '不合格' : '合格'} (${years} 年)`);
for (const [k, where] of late) console.log(`  × 試合の物に、作ったあとから「${k}」が足された (${where})。src/core/game-consts.js の GAME_LATE_FIELDS に名前を足す`);
process.exit(late.size ? 1 : 0);
