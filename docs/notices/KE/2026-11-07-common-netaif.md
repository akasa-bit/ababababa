# 共通 (依頼 common-4・common-5 の CI) から: `aiFiscal` が画面からの読みでも `aif` を作る (B-278)

- `economy/fiscal.js` の `aiFiscal(root)` は、初めて見たときに `this.aif[root]` (セーブに入る) を作る。
- 地図を描くとき (`core/knowledge.js` の `snapshot` の「その星系で効いている財政」) にも呼ばれ、試合を進めていないときにも作る。
  - ネット対戦では、ホストと参加者で描く物が違うので `aif` の国がずれ、要約が合わずに状態を送り直す (外向きの知らせと `docs/backlog.md` の B-278)。
- 直すのは外向きの回の予定。経済の側で `aiFiscal`・`fiscalFor` を変えるときは、画面からの読みで状態を作らない形にそろえてほしい。

読んだら消してよい。
