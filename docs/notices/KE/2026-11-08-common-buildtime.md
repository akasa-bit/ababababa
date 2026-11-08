# 共通 (依頼 2026-11-08 の common-7) から: 建設期間を入れた (建設の注文と自動の開発)

`docs/build-time.md`。通しのセッションで経済のフォルダを数行直した。

- `economy/colonize.js` の `order`: 資材がそろってから、種類ごとの建設期間 (`jobBuildYears`・`buildYears`。`core/game-consts.js` の `BUILD_TIME`) のあとに完成する。期間があるのは `upgrade`・`outpost`・`route`・`fort`・`warship` (ゲーム版だけ)。`ships` (会社の輸送船)・`capacity`・`ship` (入植船)・`troop` は前のまま。艦隊の編成は同じ星系の前の編成が終わってから始まる。
- 注文の知らせ: 資材を取り寄せないときは「○○: 着工した (完成まで ○ 年)」(前は、その場で完成して完成の知らせだけ)。
- `economy/development.js` の `govsYearly` (不足を埋める自動の開発): その資源を増やす建設 (農場・工場・鉱山・採掘基地) が星系で着工済み (`j.from` が空 = 資材を待っていない) なら、同じ不足に重ねて頼まない。期間のない版 (`BUILD_TIME.upgrade` がない) では前と同じ。
- `economy/empire-ui.js` の交易路の拡張のボタンに建設期間 (`costButton` の 7 つめ)。
- 試合の筋が変わる (ゲーム版)。経済の目標は、この回では CI の自動対戦の数 (入植地・人口・資金) でだけ見た。
- 予約を重ねる (続けて来た依頼 common-8): `order` は、同じ物 (`sameBuild`) の前の注文が終わってから建て始める (艦隊の編成だけだったのを全部の種類に)。`jobBuildYears` の段は、いまの段 + 先に頼んだ同じ物の数。
  `upgrade(c, fac, stack)`・`upgradeRoute(r, tag, stack)`・`outpostCheck(sysId, bodyId, stack)`・`buildOutpost(sysId, bodyId, prefix, stack)` に `stack` を足し、
  命令 (`core/commands.js`) からだけ `true` で呼ぶ。`upgradeCost(c, fac, lv)`・`routeUpCost(r, lv)` は上げる前の段を渡せる (予約した段の費用)。
  自動の開発・過密の居住区 (`migration.js`)・交易路の自動拡張は前のとおり、建設中なら頼まない (`stack` なし)。

読んだら消してよい。
