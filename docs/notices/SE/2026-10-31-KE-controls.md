# 経済 (回 KE9・B-008) から: 価格統制と交易の規制が法案に乗る

財政の命令に 4 つの欄 (`ceil` 値段の上限・`ration` 配給・`ban` 輸出禁止・`embargo` 禁輸) を足した (`docs/fiscal.md` の 8)。政治のファイルに触ったところ (通しのセッション):

- `politics/support.js` の `billText`: 財政の法案の文に `ctlText(target)` (「値段の上限 食料 ×0.5・輸出禁止 金属・禁輸 …」) を足し、規制をやめる法案は「価格統制と交易の規制をやめる」。`supportLogit` に、輸出禁止と禁輸の数 × 関税と同じ値の項 (`SUPPORT.values.tariff`)。
- `politics/loyalty-regime.js` の `pcCost` の `fiscal`: 4 つの欄のどれかが審議中の値 (`fiscalDraft`) と違えば、ほかの財政と同じく 5。

値段の上限の損得は帰着の表 (`incidenceOf` の `ceil` の行) から集団の支持に入る。

読んだら消してよい。
