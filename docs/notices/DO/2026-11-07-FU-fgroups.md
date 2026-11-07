# 船と戦争 (依頼 FU-1・FU-2) から: core の数行・新しい試験と道具・試合の筋が変わる

`docs/fleet-groups.md`。通しのセッションで core を数行直した。

- `core/game-consts.js`: 補給線の定数 `SUPPLY_NEAR`・`SUPPLY_FAR` を消した (FU-2)。指令の名前 `CMD_LABEL` に `fgassign`・`fgfree`。
- `core/game-loop.js`: 年の処理のあとに 1 行 `if (this.fgroups.length || Object.keys(this.gship).length) this.fgStep();` (群がなければ呼ばない)。
- `core/knowledge.js`: 星系の記録に `fg`・`fgn` (群ごとの艦の数。群のある星系だけ) と、艦隊戦の様子 `battle: this.battleSnap(id)` (前の 7 つの値に、要塞・見込み・沈没・退却・退いている艦・退く先・群を足した)。攻囲の `eff` は補給の充足率だけ (`line` を消した)。
- `core/commands.js`: 指令 `fgnew`・`fgset` (首都で決める)・`fgassign`・`fgfree` (艦隊のいる星系への光速の指令)。艦隊の派遣 `fleet` が `d.g` (群の id か 'all') を取る。
- 試験 `tools/tests/fgroup.js` (CI の「試験」の 1 行。`J.passes('艦隊群')`)。道具 `tools/fort-odds.js` (要塞のある星系を攻めたときの勝ち・損害の表。`EDITION_FORT`・`EDITION_BATTLE` で値を上書き)。
- **試合の筋が変わる** (群を使わない試合も): 補給線をなくした・自動の艦隊は他国の星系に攻め込まず自国の星系へ回る・退いた艦の艦隊に印 `ret`。CI の「自動対戦 main 比較」は main と違う結果になる。
- `tools/README.md` の「上の節に書いていない道具」に `fort-odds.js` を足した。

読んだら消してよい。
