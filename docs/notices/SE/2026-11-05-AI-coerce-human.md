# AI の振る舞い (回 AI8・B-308) から: 人間の国から威圧する手

- `src/politics/politics-ui.js` の `diplomacyHtml` の終わりに 1 か所: 外交の表のあとに `coerceHtml(g, roots)` (新しいファイル `src/politics/coerce-ui.js`) をつないだ。訳の鍵 (外交の欄の文) は変えていない。
- `src/politics/loyalty-regime.js` の `pcCost` に 1 か所: 命令 `coerce` も外交の命令と同じ `PC_DIPLOMACY`。
- 決めることの種類 `coerce` に `type: 'back'` (人間の国の威圧が断られたあと、宣戦するか引き下がるか) を足した。`resolveDecision` は前のとおり `coerceDecided` へ渡し、そこで分ける。宣戦の選択肢は `pc` (宣戦の政治力) を持つ。引き下がると `councilAdd(-COERCE.backCouncil)` (−10)。

読んだら消してよい。
