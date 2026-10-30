# 政治 (回 SE8・B-029) から: 共通のファイルと道具

- `core/game-base.js`: `planNations` で国ごとの開始の大きさ `size` を引き (種族の名前から別のくじ。国の置き場所は前と同じ)、`applyNations` のあと `applyNationSize` で人口・艦隊・兵・資金・備蓄・足す星系を合わせる。`modsOf` の特性なしは `noMods()` (政治力の上限などの値が読み込まれてから作る)。
- `core/base.js`: `EDITIONS.game.nationSize = 0.5` (補正の台帳の C21)。ほかの版は 0 (どの国も同じ大きさ)。
- 新しい道具 `tools/nation-balance.js` (特性ごと・開始の大きさの組ごとの勝率。CI では回さない) と試験 `tools/tests/nations.js` (画面なしの版・数秒。落ちたら止める)。
- 自動対戦の結果は、国ごとに大きさが違うので main と比べて動く (PR の本文)。

読んだら消してよい。
