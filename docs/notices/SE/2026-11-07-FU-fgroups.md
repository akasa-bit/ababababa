# 船と戦争 (依頼 FU-1・FU-2) から: 艦隊群の艦を威圧と駐留の数に入れた

`docs/fleet-groups.md`。通しのセッションで政治のフォルダを数行直した。

- `politics/loyalty-regime.js` の `earthFleetAt`: 星系に駐留する地球の艦隊に、艦隊群の艦 (`fgCount(id)`) も数える。
- `politics/panels.js` の `aweLine` (と `ship/fleet-ui.js` の同じ名前の関数): 駐留する艦隊に、知識の記録の `k.fgn` (群の艦の数) も足す。
- `politics/pc-vassal.js` の `PC_FREE_ACTS`: `fgnew`・`fgset`・`fgassign`・`fgfree` (艦隊群の指令) は政治力を使わない (艦隊の派遣と同じ)。
- `politics/politics-ui.js`: 攻囲と艦隊戦の兵站の欄 `supplyCell` は補給の充足率だけ (補給線をなくした。FU-2)。

読んだら消してよい。
