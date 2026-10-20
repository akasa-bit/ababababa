# Steamworks に出すまでの手順と待ち時間

確かめた日: **2026-10-20** (Steamworks の公式の文書 partner.steamgames.com を読んだ。出典は各行)。決まりは変わるので、手続きの前にもう一度見る。公式の文書に書いていなかったことは「(未確認)」と書いた。

**ユーザーにしかできないこと** (アカウント・支払い・本人確認・税・銀行) は、Claude は代わりにしない (`docs/parallel.md` のレーン S の決まり)。

## 1. 全体の流れと待ち時間

| # | 段 | だれが | 待ち時間 | 出典 |
|---|---|---|---|---|
| 1 | Steamworks のアカウントを作る (Steam のアカウントで登録) | **ユーザー** | — | https://partner.steamgames.com/steamdirect |
| 2 | 本人確認・銀行口座・税の書類 (日本に住む人も米国の税の書類の手続きがある。書類の名前は手続きの画面で確かめる。未確認) | **ユーザー** | **15〜30 日**。税の情報の確かめは最大 30 日で、その間は変えられない。口座の名前は法的な名前と同じにする | 同上、https://partner.steamgames.com/doc/gettingstarted/onboarding |
| 3 | Steam Direct の手数料を払う | **ユーザー** | 1 製品 **100 米ドル** (返らない。Steam のウォレットでは払えない)。調整後の売り上げが 1,000 米ドルに届くと、あとの支払いで戻る | https://partner.steamgames.com/steamdirect |
| 4 | 手数料を払ってから出せるようになるまで | — | **30 日** (公式の文書の中で 30 日と 21 日の 2 つの書き方がある。最初の何作かが対象。安全な側の 30 日で見込む) | steamdirect と onboarding |
| 5 | ストアのページを作る (文・画像・タグ・中身の質問票) | Claude が下書き (`store/page-ja.md`・`store/images.md`)、**ユーザーが入力して出す** | — | |
| 6 | ストアのページの審査 | Valve | 通常 **3〜5 営業日** (onboarding には「1〜5 日」とある)。出したい日の **7 営業日前までに** 出す | https://partner.steamgames.com/doc/store/review_process 、https://partner.steamgames.com/doc/store/coming_soon |
| 7 | 「近日公開」のページを公開する | **ユーザー** (緑の「Post as Coming Soon」のボタン) | 発売の **2 週間以上前** から公開しておく決まり。ウィッシュリストを集める期間なので、実際はもっと長く (数か月) 置くのがふつう | 同上、https://partner.steamgames.com/doc/store/releasing |
| 8 | ゲームの本体 (ビルド) を上げる | Claude が組み立て (`desktop/README.md`)、**ユーザーが上げる** (SteamPipe) | — | |
| 9 | ビルドの審査 | Valve | 通常 **3〜5 営業日** (7 日を見込むよう書いてある)。ストアのページを先に審査に出していないと、ビルドは出せない。一度通れば、あとの更新に審査はない | https://partner.steamgames.com/doc/store/review_process |
| 10 | 発売 | **ユーザー** (緑の「Release App」→「Publish Now」→「Release Now」)。審査が通っても、自動では発売されない | — | https://partner.steamgames.com/doc/store/releasing |

**いちばん早い場合の目安**: 1〜3 (書類) に約 1 か月 → 手数料から 30 日 (書類と重ねられる) → ページとビルドの審査に約 2 週間 → 近日公開を 2 週間以上。**合わせて約 2 か月**。ウィッシュリストを集めるなら、近日公開をもっと長く取る。

## 2. Steam Playtest (見知らぬ人に遊んでもらう。目標 F01〜F05・F07)

出典: https://partner.steamgames.com/doc/features/playtest

- 本体の App ID に結びついた、別の App ID (子のアプリ) として作る。Playtest だけのストアのページはない。参加の登録は本体のストアのページに出る (本体の「Special Settings」で有効にする)。
- 審査は要る: ビルドの審査と、軽いストアの審査 (カプセルの画像とアイコンだけ)。
- キーで配るなら、本体のストアのページを公開する前でもできる。
- 参加のしかた: Limited (登録した人から選んで招く。国も選べる) か Open (登録すればすぐ参加)。
- 無料だけ。本体のウィッシュリスト・レビューには響かない。
- **このゲームでの使い方の案**: 本体のストアのページを作る → Playtest を Limited で開く → 同意つきのプレイ記録 (レーン B のセッション 5) で F01〜F05 を測る。

## 3. Steam Next Fest (体験版の祭り)

出典: https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest

- 1 作につき 1 回だけ。本体のストアのページが公開されていて、誰でも遊べる体験版が要る。祭りが終わるまで未発売であること。
- 体験版のビルドの審査は、祭りの **5 週間前まで** (報道向けの先行公開にも出すとき) か **3 週間前まで**。
- 次の回: 2026 年 10 月 (もう間に合わない)・**2027 年 2 月**・2027 年 6 月。登録の締め切りの日は、その回のページで告知される (未確認)。
- 案: 2027 年 6 月の回を目指すと、ストアのページ・体験版・英語 (セッション 18) をそろえる時間がある。

## 4. ストアのページの決まり (書くときに守ること)

出典: https://partner.steamgames.com/doc/store/page/description 、https://partner.steamgames.com/doc/gettingstarted/contentsurvey 、https://partner.steamgames.com/doc/store/tags 、https://partner.steamgames.com/doc/store/localization/languages

- **短い説明**: 「数百字」。正確な上限は公式の文書に書いていない (エディタの数え方で 300 字という話があるが、未確認)。文字だけ。「発売中」など時期で変わる文は使わない。`store/page-ja.md` の案は約 130 字。
- **長い説明**: 画像は 1 枚 5 MB 未満・全部で 15 MB 未満。外へのリンクは禁止 (QR コードや「〜ドットコム」も)。Steam の画面に見える絵 (にせのボタン) も禁止。
- **中身の質問票** (審査の前に 3 つとも答える): ① ふつうの中身 (国・地域ごとの年齢の区分になる)、② 成人向けの中身 (暴力など。ビルドに入っていれば、遊べなくても書く)、③ 生成 AI。通ったあとは、一部は Steam に頼まないと変えられない。
  - ② には、奴隷と強制労働 (文字だけ) を正直に書く (`store/page-ja.md` の 6)。
  - ③ **生成 AI**: 開発を速くするためだけの道具は対象外。対象は、ゲームに入っていて遊ぶ人が目にするもの (絵・音・物語・翻訳など)。このゲームの画面の文と説明は AI の道具を使って書いたので、「開発のあいだに作ったもの (Pre-Generated)」として書く。ゲームを遊んでいるあいだに AI が作るもの (Live-Generated) はない。
- **タグ**: 発売の前に **5 個以上**。表示とおすすめに使われるのは上の 20 個 (一部の絞り込みは 15 個)。開発者が選び、遊んだ人も足せる。
- **言語**: 言語ごとに「画面」「音声」「字幕」の 3 つ。日本語は Steam が全部の画面を用意している言語なので、日本語の欄にストアの文を入れればよいと読める。英語の欄を空にしてよいかは書いていない (未確認。セッション 18 で英語を入れるまでに確かめる)。日本語だけで出すことを禁じる文はない。

## 5. 値段と割引

出典: https://partner.steamgames.com/doc/store/pricing 、https://partner.steamgames.com/doc/marketing/discounts

- 37 の通貨。米ドルを基準に、各通貨のおすすめの値段を出す道具がある。**円の値段を入れ忘れると、日本で買えない**。
- 発売から 30 日は値段を変えない。
- 発売の割引: 10〜40%、7〜14 日。発売の前に決めておく。そのほかの割引は発売から 30 日あと、割引と割引の間は 30 日あける (季節のセールは除く)。
- 値段はユーザーが決める (このゲームでは、まだ決めていない)。

## 6. Steam Deck の確かめ (Verified)

出典: https://partner.steamgames.com/doc/steamdeck/compat 、https://partner.steamgames.com/doc/steamdeck/faq 、https://partner.steamgames.com/doc/steamdeck/recommendations

- 申し込み: App Landing Page の「Technical Tools」→「Steam Hardware Compatibility Review」。ビルドの審査を通っていれば、発売の前でも申し込める。結果は 1 週間くらいが目安 (公開の前に 1 週間の確認期間がある)。まだ全員に開いていない。
- Verified の主な条件と、このゲームの今:

| 条件 | 今 |
|---|---|
| 既定の操作の設定だけで全部遊べる | ✗ まだ。Steam Input の既定の設定を作る (`desktop/controller.md` の案 A)。範囲選択 (Shift+ドラッグ) とホバーの説明は、案 B が要る |
| 画面のボタンの表示が、使っている入力と合う | ✗ キーとマウスの説明しかない (案 B) |
| 文字の入力に画面のキーボード | ✗ (案 C: Steamworks の画面のキーボードを呼ぶ) |
| 既定の設定で 800p・毎秒 30 コマ | 実機で測る (`desktop/bench/run.mjs`。目標 F08 は毎秒 60 コマ) |
| ランチャーを挟まない | ○ (Electron の包装はゲームをそのまま開く) |
| 文字: 1280×800 で一番小さい文字が 9 px 以上 (おすすめ 12 px) | △ 一番小さいのは、地図の上の文字の 10 px と、一覧の札の 11 px。条件は満たすが、おすすめには届かない。12 px に上げるかは、ゲームの中を直す回で決める |
| 1280×800 か 1280×720 で動く | ○ (包装の窓は 1280×800) |

- 2026 年からは Steam Machine の確かめも一緒に行われる (1080p・毎秒 30 コマ)。Deck で Verified なら、Steam Machine でも Verified になる。

## 7. Steam Input (ゲームがゲームパッドに対応していないとき)

出典: https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs 、https://partner.steamgames.com/doc/features/steam_controller/workshop_uploaded_configs

- アプリの管理の「Application」→「Steam Input」→「Steam Input Template」で、キーボードとマウスの決まった型から選べる。
- 自分で作った公式の設定は、「Custom Configuration (Bundled with Game)」として、設定のファイル (Action Manifest の VDF) をゲームに入れて配るのが、いまのおすすめ。
- 割り当ての案は `desktop/controller.md` の 2 の案 A。

## 8. Electron とオーバーレイ

出典: https://partner.steamgames.com/doc/features/overlay

- 公式の文書: ウェブブラウザは Steam のオーバーレイの描き方に対応していない。回避は、Chromium を画面の外で描いてゲームの窓に載せる形 (CEF が多い) で、「簡単ではない」。Electron について書いた公式のページはない。
- 案: 最初はオーバーレイなしで出す (Verified の条件ではない)。Electron の `--in-process-gpu` で出る例が多いので、Steamworks をつなぐときに試す (`desktop/README.md` の 3-2)。

## 9. ユーザーがすることの一覧 (順番)

1. Steamworks のアカウントを作り、本人確認・銀行・税の書類を出す (約 1 か月)
2. Steam Direct の手数料 100 米ドルを払う (ここから 30 日)
3. 値段を決める
4. ストアのページに、`store/page-ja.md` の文と、`store/images.md` の画像を入れる (画像を作る作業は Claude が手伝える)
5. 中身の質問票に答える (奴隷と強制労働・生成 AI は `store/page-ja.md` の 6 と上の 4)
6. ストアのページを審査に出し、通ったら「近日公開」にする
7. Claude が組み立てたビルドを SteamPipe で上げ、審査に出す
8. Playtest を開く (見知らぬ人の試遊)
9. 発売のボタンを押す

## 10. Claude がすること

- ストアの文と画像の案 (この `store/`)。英語と中国語はセッション 18 のあと。
- 包装と組み立て (`desktop/`)。Windows の上で動くかの確かめ。
- Steamworks の SDK をつなぐ (実績・クラウドのセーブ・画面のキーボード)。アカウントができてから。
- Steam Input の設定のファイルの案 (`desktop/controller.md`)。
