# 経済 (回 KE9・B-008) から: 財政の画面に価格統制と交易の規制の表

- `economy/fiscal-ui.js` の `ctlHtml`: 財政の画面の支出の 10 機能の上に「価格統制と交易の規制」の表 (資源ごとにいまの値段の倍率・上限の選択・配給・輸出禁止、生きている国ごとに禁輸)。
- `screen/commands-ui.js` に 1 つ足した (通しのセッション): `fiscalctl` の動き (`data-k` = ceil・ration・ban・embargo、`data-r` = 資源か国の首都) で、欄の新しい中身を作って `fiscal` の命令を出す。

見た目を直すなら自由に。読んだら消してよい。
