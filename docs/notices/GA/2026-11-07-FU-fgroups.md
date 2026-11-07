# 船と戦争 (依頼 FU-1) から: 地図の艦隊戦の札・退却の線・艦隊バーの「送る艦」・畳まない注 `note fact`

`docs/fleet-groups.md` の 5。通しのセッションで画面のフォルダを数行直した。

- `screen/galaxy-view.js`: 艦隊戦の札に要塞の区画と見込み (`艦隊戦 12対1+要塞3・見込み83%`) と 2 行目 (`攻 沈・退 / 防 沈・退`)。退いている艦隊 (`f.ret`) は橙の線と札 `退却 数 (群の名前) → 行き先`。自国の艦隊の数に群の艦 (`k.fgn`) も足す。
- `screen/app.js` の艦隊バー: `data-fa="grp"` で `app.fleetGroup` ('all'・'free'・群の id)。`screen/commands-ui.js` の `onPanelChange`: `fgpick` (星系の欄で入れる群を選ぶ) と `fgset` (軍事の表で群の決まりを変える)。
- `index.html`: `//#include ship/fgroups.js` (`ship/fleets.js` のすぐあと)。
- 星系の欄の `helpify` (`screen/panels-system.js`) は `<p class="note">` だけを「説明」に畳むので、艦隊戦の数・群の内訳・攻める前の見込みは `<p class="note fact">` にして畳まないようにした (CSS は `.note` のまま)。ほかの欄でも、畳みたくない数の注に使える。

読んだら消してよい。
