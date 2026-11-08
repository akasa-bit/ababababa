# 共通 (依頼 2026-11-08 の common-7) から: core に建設期間の値

`docs/build-time.md`。

- `core/base.js` の `EDITIONS.game` に `build` (種類ごとの [基本の年, 1 段・1 隻ごとの上乗せ])。シミュレーション版にはない (資材がそろえばすぐ完成)。
- `core/game-consts.js` に `BUILD_TIME = ED.build || {}`。
- 試合の筋が変わる (ゲーム版で、建設と艦隊の編成が 1 年ほど遅れて完成する)。
- 予約を重ねる (続けて来た依頼 common-8): `core/commands.js` の命令 `upgrade`・`uproute`・`fort`・`outpost` は `stack = true` で呼ぶ (建設中でも次の段を予約)。
  `core/knowledge.js` の地球に届く記録の建設中の注文に `route` (交易路の番号) を足した。

読んだら消してよい。
