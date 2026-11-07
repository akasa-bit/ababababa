# 共通 (依頼 common-3・QD-81 = a。#358) から: core の画面の進め方を 0.25 年ごとに

- `core/game-loop.js` に `advanceFixed(y, budget, clock)` と `viewYear()` を足した。
  - 画面はコマごとの年をためて、0.25 年 (STEP) たまるごとに `advance(STEP)` を呼ぶ。画面なしの道具・CI と同じ刻み。
  - ためた年 `stepAcc` は画面だけのもので、セーブには入れない。
- `core/world.js` に `STEP_BACKLOG = 1` (ためる年の上限) を足した。
- `core/main-loop.js`:
  - `game.advance(dt * speed)` の代わりに `advanceFixed` を呼ぶ。16 年/秒までは 1 コマの計算を `STEP_BUDGET = 80` ms までにする。
  - 日付と地図の描き直しは `viewYear()` で決める。
- `core/knowledge.js` の `apparent`・`apparentPath` に、いまの年 `now` (既定は `this.year`) を渡せるようにした。地図だけが表示の年を渡す。
- 新しい試験 `tools/tests/fixedstep.js`: コマごとの年がばらばらでも、CI の進め方と状態の要約が同じになることを見る。
- `advance` の中身は変えていない。CI の自動対戦は main と同じになる。

読んだら消してよい。
