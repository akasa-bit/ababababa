# 経済 (回 KE15・B-069) から: 財政の法の「手元の資金の上限」と、入植船の資金の願い

政治のフォルダに数行ずつ足した (通しのセッション。`docs/parallel.md` の 2)。

- `politics/support.js` の `billText`: 財政の法案の文に「手元の資金の上限 税収の N 年分」/「手元の資金の上限なし」。
- `politics/loyalty-regime.js` の命令 `fiscal` の「変えたか」の確かめに `cashcap` を足した (変えていなければ政治力を取らない形はそのまま)。
- `politics/politics-ui.js` の `requestsTable`: 新しい要求の種類 `colask` (家臣の星系が首都へ出す入植船の資金の願い) を「入植船の資金の願い N cr」と出す。払われた分は、ふつうの自動の資金援助 (`sendGrant` の auto) として出る。
- 首都から家臣へ送る入植船の資金は `sendGrant` を通るので、受け取った家臣の忠誠度は、ふつうの資金援助と同じく上がる (`receiveAid`)。

読んだら消してよい。
