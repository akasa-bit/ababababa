# 共通 (依頼 2026-11-10 の common-3) から: ネット対戦の部屋を HoI4 の形に (国は部屋の中で選ぶ)

`docs/online.md` の 4。通しのセッションで `outward/net.js` をほぼ書き直し、`outward/cloud.js` の席を「つながる口」に直した。

- `outward/net.js`: つながる口 `Net.slots` (国の数 − 1。`{ id, pc, dc, state, offer, name, joined, pick, pi, cap }`) を国と切り離した。`Net.peers` は、試合に入っている口 (コマを送る相手) だけ。
  前の `Net.left` (入っていない人間の席)・`rejoin(peer)`・画面の `reoffer`/`reanswer` はなくなった。
- 部屋のやりとり (データチャネル): 参加者 → `hello` (名前)・`pick` (国)、ホスト → `lobby` (国の一覧 `nationList()` と、だれが選んだか)・`bye` (外した)。
  `takePick` (国を決めるのはホスト)・`hotJoin` (試合の途中は、選んだ国ですぐ入る。命令 `rejoin`)・`kick`・`lobbyChanged` (部屋にいる人みなに送り直す)。
- `start`: 国家選択から開いた部屋 (`fresh`) は、選ばれた国で `g.setPlayers` をやり直す (「歩みはじめた」の知らせもここ)。続きの試合は、席の `human` を付け替えるだけ。
- 招待の中身は `{ t: 'o', ed, sdp, slot }` (前は `pi`・`cap` が入っていた)。参加者の `pi` は、試合の状態 (`init`) が届いたときに決まる。
- 部屋は始めたあとも開いている (`start` で `leaveRoom` しない)。切れた人の口には `reseat` で新しい招待が置き直されるので、同じ招待コードで戻れる。
- `outward/cloud.js`: 席の文書は `seats/{口の番号}` で、中身は `offer`・取った人の `uid`・`name`・`answer` (国の名前 `realm` は入れない)。部屋の文書の `seats` は `[{ pi: 口の番号 }]`。`firestore.rules` はそのまま。
- `outward/lang-en.js`: 38 の鍵 (部屋の画面・国家選択・マルチプレイと友達と遊ぶの頁)。「この国にする」= Choose this nation・「この国で入る」= Join as this nation・「外す」= Remove・「部屋を出る」= Leave room。校正のときに見てほしい。
- 試験 `tools/tests/net.js`・`tools/tests/cloud.js` を部屋の流れに直した (国を選ぶ・選び直す・選ばれた国だけが人間の席・同じコードで戻る・AI の国に途中参加)。

読んだら消してよい。
