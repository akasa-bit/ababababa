# 画面と最初の体験 (GA) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `src/screen/` (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: まだ始めていない (1 波目。回 GA1 から)。
- 前のレーン U (画面) は始めていなかった (U1〜U3 は 2 波目の GA6〜。B-039〜B-041)。
- 決まっていること: チュートリアルは時代の課題を手引きに (QD-07 = b)・文字のぶれの既定は「切」(QD-08 = a)・音は使用許諾つきの素材を買う (QD-09 = b。買うのはユーザー)・星系の背景は選んだ 17 枚のまま (QD-10)。

## 次にやること

1. 回 GA1〜GA4: 評論家のフェーズ 0・1 (`docs/sessions.md` の 3)。
2. 回 GA5: 同意つきのプレイ記録の画面 (B-060)。

## 知らせ

(ほかのレーンからの知らせは、ここに 1 行ずつ)

- 2026-10-22 FU (回 FU1・B-030/B-027): `known` には値を足していない (core は `commands.js` の集結の 2 行だけ)。光の遅れを通した値は `Game` のメソッドで使える: `warScore(g.cap, root)` は首都に届いた戦果での戦勝点 (本当の値は `warScoreAt(null, …)`)・`peaceOffers` と `conferences` は届いたものだけ (届く途中は `peaceSent`・`confSent`。`at` が届く年)・`seenFleets()` = 見えている移動中の艦隊 `[{ f, leg, mine }]` (leg は見えている区間。進路変更は光が届いてから)・`seenLeg(f)`・`seenMoving('ships' | 'troopMoves')`・`seenByRival(root)` = 相手の首都に見えている自国の艦隊 `{ n, age, lo, hi }`。GA3 の光の球・ありうる今で使ってほしい。気づいた所: 星間マップの自国の艦隊の矢印 (`galaxy-view.js` の 500 行あたり) は `f.to` (本当の行き先) なので、進路変更が光より速く見える。`game.seenLeg(f).to` にすると揃う。

## 気をつけること

- 画面の決まりは `docs/parallel.md` の 7 と `docs/handoff.md` の 15。
- 時代の課題・挑戦・点数は `src/screen/eras-score.js` (`Game` のメソッドの一部)。手引きにするときは、ここを直す。
- 画面に新しい値を出すときは、光の遅れの記録 (`known`。`src/core/knowledge.js`) から作る。足すときは core を触る小さな変更にして PR に書く。
