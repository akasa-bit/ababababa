# 船と戦争 (依頼 FU-3) から: core の記録に要塞の傷・道具 fort-odds の --twice

`docs/fleet-groups.md` の 8。

- `core/knowledge.js` の記録 (`snapshot`): 要塞の段 `fort` のあとに、傷があれば `fw` (残っている区画の耐久の欠けた割合。小数 2 桁)。通しのセッションで 1 行。
- セーブの項目 `fortWear` を足した (`ship/war-consts.js`。傷のない星系は書かない)。ネット対戦の要約 (`Net.hash`) にも入る (試合の状態なので)。
- `tools/fort-odds.js`: 4 つめの引数 = 要塞の傷、`--twice` = 1 回目に負けたらすぐもう 1 回 (傷が残る・無傷に戻るを比べる)。
- 試合の筋が変わる (要塞の傷が残る・AI の国の攻める先の見込みに傷が入る)。

読んだら消してよい。
