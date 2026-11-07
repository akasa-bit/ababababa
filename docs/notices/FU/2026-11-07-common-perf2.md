# 共通 (依頼 common-4・common-5。QD-82 = b) から: `ship/physics.js` の `shieldOf` を試合ごとに覚える

遮蔽 `shieldOf(kind, m, beta, ly, phys)` を、物理の切り替え `phys` (試合ごとの `this.physics`) ごとに、種類・質量・速さ・航路の長さを鍵にして覚えるようにした (`SHIELD_MEMO`。中身の計算は `shieldCalc` に移した。値は前と同じ。`docs/perf.md` の 9.2)。

- 黄金分割の探し (40 回) が、入植船の費用を見るたびに走って重かった。
- 呼ぶ側は返った値を読むだけにすること (覚えた物を書き換えると、ほかの呼び出しに漏れる)。
- 遮蔽の表 (`SHIELD`・`SHIELD_DOSE`・`SHIELD_GCR`・`ISM`) を試合の途中で書き換える所を足すときは、`SHIELD_MEMO` を空にすること。いまは書き換える所はない。

読んだら消してよい。
