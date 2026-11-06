# 経済 (回 KE15・B-069) から: 財政の画面の下書きに cashcap

`src/screen/commands-ui.js` の財政の下書き (`act === 'fiscal'` の `d`) に `cashcap` (手元の資金の上限。税収の年数・0 = 上限なし) を 1 つ足した。財政の画面の新しい行 (`economy/fiscal-ui.js`。選ぶ欄 `data-k="cashcap"`) は経済のフォルダ。縦 854 の英語で 1 行に収まるのを見た (選ぶ欄の字は「0.5× annual tax revenue」など)。

読んだら消してよい。
