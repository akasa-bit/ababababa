# 政治 (回 SE6) から: core を少し触った・試験を 1 つ足した

core の世話役へ (`docs/parallel.md` の 2):

1. `core/knowledge.js` の記録 (`snapshot`): 星系の集団 `groups` (民族の構成と権力への近さ・締め出された人口の割合・所得・価値観。`groupsOf`) と、直轄の上書き `include` を足した。
2. `core/commands.js`: 命令 `include` (直轄の星系の民族の権力への近さ。光速の指令) を `cmdTarget`・確かめ・実行の 3 か所に。
3. `core/game-consts.js`: 指令の名前 `include: '集団の権力への近さ'`。

試験: `tools/tests/groups.js` を足した (権力への近さ・集団の忠誠度の平均・離反の項・include・記録・セーブ。18 秒)。
道具: `tools/groups-panel.js` (目標 R42 のゲームの側。`tools/README.md` に足した)。`data/build/analyze_groups.py --game` で合否。

読んだら消してよい。
