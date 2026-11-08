# 共通 (依頼 2026-11-08 の common-7) から: 費用のボタンに建設期間

`docs/build-time.md`。通しのセッションで画面のフォルダを数行直した。

- `screen/panels-system.js` の `costButton`: 7 つめの引数 `build` (建設期間の年) があれば、小さな字に「・建設 1.4 年」を足す (光速の指令になる星系のボタンにも)。
- 渡しているところ: `screen/panels-colony.js` (施設の拡張・採掘基地)・`screen/panels-body.js` (交易路の拡張)・`economy/empire-ui.js` (交易路の拡張)・`ship/fleet-ui.js` (艦隊の編成・要塞)・`ship/military-ui.js` (艦隊の編成)。ほかの呼び出しは前のまま。
- 予約を重ねる (続けて来た依頼 common-8「建設ボタンを9回タップしたらレベル10までいけるように」。`docs/build-time.md` の 3): `ship/ships-ui.js` に `buildPlan(g, type, lv, pred, act, sent)` を足した。
  施設・採掘基地 (`screen/panels-colony.js`)・交易路 (`screen/panels-body.js`・`economy/empire-ui.js`)・要塞 (`ship/fleet-ui.js`) のボタンは建設中も押せて、
  「Lv6 を予約」と予約する段の費用・建設期間を出し、欄に「建設中: Lv5 まで (あと ○ 年)」(遠い星系は、まだ届いていない指令の数も)。最大まで予約したら「最大レベルまで予約した」で止まる。
  シミュレーション版 (建設期間なし) は前のとおり「建設中 あと ○ 年」(`busyText`) で止まる。

読んだら消してよい。
