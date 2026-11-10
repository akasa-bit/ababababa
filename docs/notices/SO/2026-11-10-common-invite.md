# 共通 (依頼 2026-11-10 の common-1・common-2) から: 招待コード 4 文字・ログインなしでつなぐ

`docs/online.md` の 3。通しのセッションで外向きのフォルダを直した。

- `outward/cloud.js`: 部屋のコードを「招待コード」と呼び、4 文字にした (`ROOM_LEN`・`ROOM_LETTERS`・`ROOM_DIGITS`・`roomCode`。英字と数字を必ず混ぜる)。
  `ensureUser` (ログインしていなければゲストで入る。前のログインが戻るのを `authReady` で待つ)・`freeCode` (同じコードがあれば引き直す)・`ROOM_TTL` (1 日で期限切れ)・
  `dropRoom`/`dropStale` (始める前に閉じたら・作り直したら部屋と席を消す。閉じ損ねた自分の部屋は次に作るときに消す。始めたあとも部屋を開けておくのは common-3 から。`2026-11-10-common-lobby.md`)・`reseat` (つながらなかった席に、同じコードのまま新しい招待を置き直す。席を出していなかった国なら席を足す)・`watchSeat`。
  `openRoom(seats)` は、席の招待を同時に作り、そろってから部屋を返す (`Net.room` に置くのは `Net.autoRoom`)。`init` は同時に呼ばれても 1 回だけ。
- `CLOUD_ROBOT`: 自動操作のブラウザ (`navigator.webdriver`) では、偽物 (`window.__FB_FAKE`) を差しこんだときだけオンラインの機能を出す (試験が本番にゲストのアカウントや部屋を作らないように)。
  **ネット対戦の画面を開く試験を足すときは、偽物を差しこむか、長いコードの方法の画面になることを前提にする。**
- `outward/net.js`: `openHost` が招待コードの部屋を自動で作る (`autoRoom`・`leaveRoom`・`roomBusy`・`roomErr`)。参加は `joinCode` (コードと名前)・`leaveJoin` (入れ直す)・`openJoin` (画面を開く)。
  長いコードの方法は `manual` (ホストは `toManual` で切りかえ、参加する人はたたんだ欄 `#netmanual`)。あとから届く知らせは `redraw` (閉じた画面を開かない)。
  始める前に落ちた相手は、データチャネルが open のまま残っても `lost` で片づける (前は「つながった」のまま残った)。前のつながりの close は数えない。
- `outward/lang-en.js`: 33 の鍵 (招待コードの画面・マルチプレイと友達と遊ぶの頁・アカウントの頁)。「コードを作り直す」= New code・「コードを入れ直す」= Re-enter code・「参加する」= Join。校正のときに見てほしい。
- ストアの文 (`store/`) に部屋のコードの説明があれば、「4 文字の招待コード・ログインなし」に直せる (いまの `store/page-ja.md`・`page-en.md` には部屋のコードの文はなかった)。
- 本物の Firebase でのゲストの自動ログインと部屋の読み書きは、作業場所からは確かめていない (本番にデータを作らない決まり)。公開した版で 2 台つないで確かめる (`docs/playtest-friends.md` の 1 の表の 3)。

読んだら消してよい。
