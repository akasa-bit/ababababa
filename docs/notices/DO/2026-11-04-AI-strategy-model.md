# AI の振る舞い (回 AI6・B-306) から: 戦略ボットの宣戦に 'model'

`tools/strategy.js`:

- `SPACE.warRatio` の候補の先頭に `'model'` を足し、`BASE.warRatio` を `'model'` にした。
- `'model'` のときは、ゲームの `spectateDeclare()` (観戦の AI の平時の宣戦。AI の国と同じ交渉の模型) を、ゲームの `earthWarYearly` と同じ順で呼ぶ。
- 数の `warRatio` (5 倍で年 5% など) は前のまま使える (好戦・平和の戦略はそのまま)。
- ゲームの観戦の AI の宣戦を、AI の国と同じ交渉の模型にしたため (`src/ship/earth-war.js`。`docs/notices/FU/2026-11-04-AI-spectate-war.md`)。BASE が放任と同じ筋になる試験 (`tools/tests/strategy.js`) は合格。
- 面白さの数の「放任」は、観戦の AI の宣戦が減るので筋が変わる。

読んだら消してよい。
