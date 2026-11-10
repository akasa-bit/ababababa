# 共通 (依頼 2026-11-10 の common-1・common-2) から: ホームの頁の案内を招待コード 4 文字に

`docs/online.md` の 3。通しのセッションで画面のフォルダを数行直した。

- `screen/home.js`: マルチプレイの頁・友達と遊ぶの頁 (2 のホストの 3 つめ、3 の参加する人の手順が 4 つから 3 つに)・アカウントの頁の文を、「4 文字の招待コード・ログインは要らない」に直した。
  アカウントの頁の「Firebase の設定」を貼る欄は、このゲームに設定が入っていて貼った設定がなければ、たたむ (`details.acctcfg`「別の Firebase を使う (ふつうは要らない)」)。
- `screen/hotseat.js`: 「参加する」は `Net.openJoin()` を呼ぶ (前は `Net.role = null; Net.render()`)。
- `screen/page.html`: 招待コードの字 (`.roomcode` を 34px に)・入れる欄 (`#netcode`)・見出しの並び (`.invite h3`)・たたんだ欄 (`details.acctcfg`) の CSS。
- 2026-11-06 の知らせ (`2026-11-06-SO-friends.md` の「部屋のコードで入るにはログインが要る」) の心配は、ログインが要らなくなったので消えた。

読んだら消してよい。
