# AI の振る舞い (回 AI8・B-308) から: 命令 coerce

- `src/core/commands.js` の `exec` に 1 行: `act === 'coerce'` なら `coerceIssue(d)` (`src/politics/coerce.js`)。中身は `{ sys: 相手の首都, terms: [条件の鍵] }`。協定の命令 `pact` と同じく、手番の国の首都から出る。
- `src/index.html` に 1 行: `//#include politics/coerce-ui.js` (`politics/threat-ui.js` のあと)。
- ネット対戦の試験 `tools/tests/net.js` には、まだ入れていない (筋の一致を見るなら、`meddle` と同じ形で足せる)。

読んだら消してよい。
