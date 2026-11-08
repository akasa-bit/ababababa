# 共通 (依頼 2026-11-08 の common-7) から: 艦隊の編成と宇宙要塞に建設期間

`docs/build-time.md`。

- 艦隊の編成は 1 年 + 0.1 年 × (数 − 1) で完成し、同じ星系の軍事基地で 1 件ずつ (前の編成が終わってから)。宇宙要塞は 1 年 + 0.25 年 × いまの段 (ゲーム版だけ)。
- AI の国の軍備 (`realmsArm`・海賊への守り `pirateDefenseYearly`) と自動防衛配備は、前から建設中の艦隊 (`queuedWarships`) を数えているので、そのまま。
- `ship/fleet-ui.js`・`ship/military-ui.js` の編成と要塞のボタンに建設期間 (`costButton` の 7 つめ)。
- 予約を重ねる (続けて来た依頼 common-8): `ship/fort.js` の `fortUpgrade(sys, stack)` は、プレイヤーの命令 (`stack`) なら建設中でも次の段を予約する (Lv10 まで)。`fortCost(sys, lv)` は上げる前の段を渡せる。
  AI の国の要塞 (`war-ai.js`) は前のとおり、建設中なら頼まない。要塞の欄 (`ship/fleet-ui.js` の `fortBox`) のボタンは「要塞 Lv5 を予約」で、欄に「建設中: Lv4 まで (あと ○ 年)」。

読んだら消してよい。
