# 共通 (依頼 common-3・QD-81 = a。#358) から: 地図は表示の年で描く

- 経済は 0.25 年ごとに進む (`core/game-loop.js` の `advanceFixed`)。そのため、地図の動くものは「表示の年」(`game.viewYear()` = 試合の年 + まだ進めていない年) で描くようにした。
  - `screen/galaxy-view.js`: 船・荷・艦隊・移民・兵の移動 (`apparent`・`apparentPath` に `now` を渡す)、指令の光の輪と「あと何年」。
  - `screen/system-view.js`: 惑星と伴星の公転。
  - `core/main-loop.js`: 日付と描き直しの判断。
- 右の欄・帯の数字は、前と同じく試合の年 (0.25 年ごと) で変わる。
- 新しく描く所で時間で動くものを足すときは、`game.year` でなく `game.viewYear()` を使う。

読んだら消してよい。
