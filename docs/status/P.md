# レーン P (物理) のいまの状態

- 2026-10-20 (`docs/requests/2026-10-20-P.md` の P-1・P-2): 物理をフレーバーでなく、測れる物理にして、シミュレーション版にだけ入れた (`EDITIONS.<版>.physics`)。中身は `docs/physics.md`。
  - 星間の気体と銀河宇宙線の遮蔽 (Geant4)・加速にかかる時間 (P1)・M 型星のフレアと惑星の地表の被曝 (TESS の光度曲線から自分で数えた)。
  - P2 (回折) と P3 (乗る人の限度 0.6 Sv) は今のまま。
  - ほかのレーンには「シミュレーション版は一旦無視する」と書いた (`docs/parallel.md` の 6・`docs/session-start.md` の 3)。CI の「シミュレーション版・参考」の行は落ちても CI を止めない。
- シミュレーション版 (`simulation.html`) は `node tools/build.mjs --sim` で、2026-10-20 の回に組み立て直した。
- 計算をやり直すとき:
  - Geant4: `data/build/g4_all.sh` (4 コアで 3 時間ほど)。結果は `data/derived/g4/`。
  - TESS: `data/fetch/fetch_tess.py <置き場>` (約 290 MB) → `data/build/flares_tess.py <置き場>` → `data/build/build_flares.py`。
- 2026-10-20 (P-4): P7 スウォームの太陽電池の劣化を入れた (シミュレーション版。`docs/physics.md` の 7)。
- 2026-10-20 (P-5): P9 スウォームの素子の作りを、星系ごとに選べるようにした (a・b・c と自動。シミュレーション版。`docs/physics.md` の 7)。
- 2026-10-21 (P-6、**PR #154。開いたまま、マージしていない**): 物理学者が SF の描写に付けた文句 349 件から、ゲームに当てはまる欠点を直した (`docs/sf-critiques.md`)。シミュレーション版の進路変更の慣性・途中の星系で止まる・減速のエネルギー・海賊の出どころ・難民・M 型星の惑星の大気・空の背景、両方の版の乗る人の時計・艦隊の運動エネルギー・説明。CI は回っていない (コメントなし)。
- 2026-10-21 (`docs/requests/2026-10-21-P.md` の P-1、**セッション P6**): 物理をゲーム版にも入れた (`docs/physics.md` の 11)。
  - `EDITIONS.<版>.physics` を shield・accel・flare・pv に分けた。ゲーム版は shield と accel、flare は惑星の欄の表示だけ ('show')、pv はなし。シミュレーション版は全部。
  - 切り替えは試合ごと (`Game.physics`) でセーブに入り、ないセーブ (物理を入れる前) は物理なしのまま続く。ネット対戦はホストのセーブで配られる (`tools/tests/net.js` で確かめる)。
  - 入植船の費用の内訳に「遮蔽 8%」の行。CI の物理の試験 (`physics` のゲーム版の分・ゲーム版の `energy`) は落ちたら止める行にした。
  - 遊びの数と戦争の多さは `docs/physics.md` の 11。ほかのレーンへの知らせは `docs/status/A.md`・`docs/status/C.md` に書いた (下)。

## 次にやること

1. **PR #154 を片付ける** (前の回の残り)。main (この P6 を含む) を取り込むと、物理の所 (`shieldOf` の船の時間・`accelExtra`・進路変更・`bookShip` の区間ごとの記帳) で衝突する。#154 の側を `Game.physics` (shield・accel の切り替え) に合わせ直してから CI を回し、表がすべて合格ならマージする。#154 の「決めてもらうこと」(D1・D3〜D6。`docs/sf-critiques.md` の 5) はユーザーの返事待ち。
2. P10 (ゲーム版の太陽電池の劣化) は保留のまま。レーン C の経済が落ち着き、レーン B の必勝法を探す AI (PR #117) ができてから、b か c を測って決める (`docs/physics.md` の 10)。
3. P6 のあとの戦争の多さ (R29) と交易・財政 (R19〜R28) の動きは、レーン A・C が測り直す (知らせは書いた)。

## 落とし穴

- `shieldOf`・`accelExtra` は `phys` (試合の切り替え) を最後の引数に取る。`Game` の中からは `this.physics` を渡す (渡さないと版の値 `ED.physics` になり、古いセーブで物理が効いてしまう)。
- `flare` だけは銀河を作るときに効くので版の値。セーブの `physics.flare` は読むときに使わない。
- `tools/tests/physics.js` は `EDITION=game` と `EDITION=sim` で中身が少し違う (ゲーム版の分はフレアの表示と古いセーブの確かめ、シミュレーション版の分は素子の作り)。CI はゲーム版の分で止まる。
- 試験で版の切り替えを変えるときは `H.load({ edition, params: { ED: { physics: { … } } } })`。`edition` を忘れると、シミュレーション版の試験の中でゲーム版の試合と比べてしまう。
