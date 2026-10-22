# 包装 (Steam 用のデスクトップ版)

組み立てたゲーム (リポジトリの根の `index.html` と `assets/`) を、外から包んでデスクトップのアプリにする所です (レーン S。決まりは `docs/parallel.md`)。ゲームの中身・`tools/build.mjs`・CI は変えません。

**包装は Electron に決めた** (2026-10-20 のユーザーの決定。`docs/requests/2026-10-20-S.md` の S-3)。Tauri の試作は消した (比べた結果は下の 3 に残す。コードは #136 の履歴にある)。

## 1. 組み立てと起動

```sh
node tools/build.mjs                           # 組み立てた index.html を作る (回 R3 からリポジトリに入らない)
(cd desktop/electron && npm ci)                # Electron と、同梱する字体 (@fontsource)
node desktop/prepare.mjs                       # index.html・assets/・字体を desktop/game/ に写す
cd desktop/electron
npm run package:win     # → desktop/electron/out/NoLongerUbiquitous-win32-x64/ (Windows。Linux の上でも組み立てられる)
npm run package:linux   # → desktop/electron/out/NoLongerUbiquitous-linux-x64/ (Linux・Steam Deck)
```

- Steam の起動の設定 (Steamworks のアプリの管理の「起動オプション」。画面の名前は S2 で公式の文書と照らす):

  | OS | 実行ファイル | 引数 |
  |---|---|---|
  | Windows | `NoLongerUbiquitous.exe` | なし |
  | Linux (Steam Deck) | `NoLongerUbiquitous` | `--no-sandbox` |

  Linux で `--no-sandbox` を付けるのは、Steam から起動すると Chromium の sandbox の準備 (ユーザーの名前空間) が失敗して画面が出ないことがあるため (Choice of Games は Steam の全作品でこうしている。下の 3-2)。sandbox の準備は `main.js` が動く前に始まるので、`main.js` の中からは切れない (試した)。開くのは手元の `desktop/game/` だけで、外のページへは移らない (外へのリンクはいつものブラウザで開く) ので、切っても読み込むものは変わらない。
- 環境変数 `NLU_FULLSCREEN=1` で全画面 (Steam Deck の Game Mode を想定)。
- Windows 版は、組み立てられることまでは確かめた。Windows の上で動かして確かめるのは、まだ (実機か CI の Windows が要る)。

## 1-2. 字体の同梱 (B-088・QD-20。回 SO1)

ゲームは字体を Google Fonts からネットで読む (`src/index.html` の頭の `<link>`)。オフラインの Steam Deck では別の字体になるので、**包装の側で同じ字体を同梱し、読み込みを差し替える** (ゲームの中身は変えない)。

- `desktop/prepare.mjs` が、npm の `@fontsource` (Google Fonts と同じ字体を、同じ文字の範囲ごとに分けたもの。版は `electron/package.json` で固定) から、ゲームの使う 4 つの字体と太さ (Courier Prime 400・700、Special Elite 400、Zen Antique 400、Zen Old Mincho 400・700) の woff2 を `desktop/game/fonts/` に写し、`fonts.css` を作る。約 9 MB・372 ファイル。ライセンス (Courier Prime・Zen Antique・Zen Old Mincho は SIL OFL 1.1、Special Elite は Apache 2.0) の文を各フォルダの `LICENSE` に写す。
- 組み立てた `index.html` は圧縮してあり、中の `<link>` を書き換えられない。そこで `electron/main.js` が `https` の読み込みを横取りし、`fonts.googleapis.com/css2` には同梱の `fonts.css` を、字体のファイルには同梱のファイルを返す。ほかの `https` はそのままネットへ出す。
- 確かめ方: `xvfb-run -a node desktop/fonts-check.mjs [包装した実行ファイル]`。ネットへの読み込みを全部止めた状態で開き、4 つの字体で日本語と英数字が描けること、6 つの字体と太さが読めたこと、Google Fonts の CSS を横取りしたことを見る。2026-10-22 に、`electron .` と包装した Linux 版の両方で合格 (CSS 1 回・字体のファイル 82 個。ほかのネットへの読み込みなし)。包装の大きさは 292 → 302 MB。
- 字体の版を上げるとき: `electron/package.json` の `@fontsource/*` を同じ版の組で上げ、`fonts-check.mjs` を回す。ゲームが字体や太さを変えたら (`src/index.html` の `<link>`)、`prepare.mjs` の `FONTS` も合わせる。
- **Firebase の SDK** (アカウント機能。`src/outward/cloud.js` の `FB_SDK`) は同梱しない。クラウドのセーブと部屋のコードはネットがないと使えないので、オフラインで SDK だけあっても意味がない。いまは設定がなく隠れている (QD-23)。設定を入れたあとは、起動のときに SDK を読みにいく (`Cloud.init`)。ネットがなければアカウントの画面に「Firebase につなげなかった」と出るだけで、ゲームのほかの所は動く (読めなかったときは、そこで止まる作り)。

## 1-3. ストアの画像を撮る (B-079。回 SO1)

`node desktop/shots/shoot.mjs`。撮るためのセーブを作り、スクリーンショット (1920×1080) とカプセルの案を `desktop/shots/out/` に書く。中身と決まりは `store/images.md` の 2・5。

## 2. 測り方

`desktop/bench/probe.js` を、環境変数 `NLU_BENCH=1` のときだけ包装がページに差し込む (ゲームには入らない)。同じ銀河の番号 (20261020) で新しいゲームを始め、次を測る:

1. 起動: 起動の命令から、ホーム画面が出て 2 コマ描くまで
2. 止めた地図・地図を回し続ける (毎コマ Z キー)・年 1 年・最高速 (年 64 年) のそれぞれ 3〜10 秒の、毎秒のコマ数とコマの間隔
3. 最高速で 1 秒に進んだ年 (画面の日付から)
4. メモリ (子のプロセスも含めた PSS の最大)

```sh
xvfb-run -a -s "-screen 0 1280x800x24" node desktop/bench/run.mjs 3   # Electron と、比べの元の Chromium
```

結果の JSON は `desktop/bench/results/`。

## 3. 比べた結果 (2026-10-20。これで Electron に決めた)

### 3-1. 測った数 (3 回の中央値)

測った機械: クラウドの Linux x64 (4 コア)、Xvfb の 1280×800 の画面、**GPU なし** (どれも描画はソフトウェア)。Electron 44.8.0 (Chromium 152)、Tauri 2 (WebKitGTK 2.52.6)、比べの元は Playwright の Chromium。**実機 (Steam Deck・Windows) の数ではない**ので、F08 の判定には使わない。差の向きを見るためのもの。

| | Chromium (比べの元) | Electron | Tauri |
|---|---|---|---|
| 起動 (命令からホーム画面が出るまで) [ms] | 1313 | **984** | 1692 |
| ページの中の準備 (読み込みの始めから) [ms] | 787 | 754 | 838 |
| 止めた地図 [コマ/秒] | 60 | 59.7 | 60.7 |
| 地図を回し続ける [コマ/秒] | 16.2 | 12.8 | 8.8 |
| 年 1 年 [コマ/秒] | 59.3 | **59.7** | 22.2 |
| 最高速 (年 64 年) [コマ/秒] | 58.3 | **58.2** | 18.4 |
| 最高速の 95% のコマの間隔 [ms] | 16.8 | **16.8** | 167 |
| 最高速で 1 秒に進んだ年 | 49.6 | 50.5 | 50.0 |
| メモリの最大 (PSS) [MB] | — | **512** | 672 |
| 大きさ (展開) [MB] | — | 292 | **12** (WebKitGTK は別。Deck では同梱が要る → 70 MB 以上) |
| 大きさ (圧縮) [MB] | — | 126 | **10** (.deb 10) |

- **ゲームが進んでいるときの滑らかさ**が一番の差。Tauri (WebKitGTK) は年 1 年でも毎秒 22 コマ、最高速では 95% のコマの間隔が 167 ms (目に見えて引っかかる)。Electron は Chromium とほぼ同じ。
- 地図を回し続けるのは、どれも GPU なしでは遅い (8.8〜16 コマ)。実機で測り直す。
- 最高速で 1 秒に進む年は、どれも約 50 年で、F08 の 64 年に届いていない (包装の差ではなく、ゲームの計算の重さ。実機で測り直す)。
- 描画の見た目の差: 一覧 (`<select>`)・チェックボックス・スクロールバーの形が違う (Tauri は GTK の部品)。文字・色・地図は同じ。

### 3-2. 測れないもの (調べた。2026-10-20 に確かめた)

| | Electron | Tauri |
|---|---|---|
| Steam Deck (Linux のまま) | Steam Linux Runtime (sniper) に要るもの (GTK3・NSS・gbm・ALSA) がそろっている。Chromium の sandbox で画面が出ないことがあり、`--no-sandbox` で出す例が多い (Choice of Games が全作品で: https://forum.choiceofgames.com/t/linux-issues-on-steam/107741) | WebKitGTK 4.1 は Steam Linux Runtime にも SteamOS にも入っていない (https://repo.steampowered.com/steamrt3/images/latest-public-stable/)。AppImage で同梱すると 70 MB 以上で、glibc の食い違いや画面が出ない問題の報告がある (https://v2.tauri.app/distribute/appimage/ 、https://v2.tauri.app/develop/debug/linux-graphics/) |
| Steam Deck (Windows 版を Proton で) | 動く例がある (Cookie Clicker は Electron の Windows 版だけで「Playable」) | WebView2 が Wine の上で黒い画面になる不具合があり、回避は手作業 (WineHQ の 58921) |
| Steamworks の SDK | `steamworks.js` (更新が 2024-08 で止まりぎみ) か `steamworks-ffi-node` (2026-09 も更新) | `steamworks` (Rust。成熟)。Tauri 用の部品は新しく、使われていない |
| Steam のオーバーレイ (Shift+Tab) | `--in-process-gpu` で出る例が多い。Linux では出ない報告もある | WebView2 は別のプロセスで描くので、そのままでは出ない。Windows だけの回避の部品がある |
| Steam で売られている例 | Cookie Clicker など多い | ほとんどない (2026-10 の時点で、知られた商用のものは見つからない) |
| Windows の大きさ | 約 100〜130 MB (圧縮) | 約 3〜10 MB (WebView2 は Windows に入っている) |

### 3-3. おすすめ

**Electron**。理由: ゲームが進んでいるときの滑らかさ (最高速で毎秒 58 コマ対 18 コマ)、Steam Deck で動かす道がはっきりしている (Linux のままでも Proton でも)、オーバーレイと Steamworks の例が多い。引き換えは大きさ (圧縮で約 126 MB 対 10 MB)。メモリは、この測り方では Electron の方が少なかった (512 MB 対 672 MB)。大きさは、このゲームでは遊ぶ人にとってほぼ問題にならない (Steam の普通のゲームより小さい)。

## 4. まだ確かめていないこと (実機が要る)

- Steam Deck の上での描画の速さ (F08)・Game Mode での全画面・一覧 (`<select>`) の出方。
- Steam のオーバーレイと Steamworks (選んだ方だけ、S2 のあとでつなぐ)。
- 文字: 包装の側で同梱した (上の 1-2)。Deck の実機で、オフラインのまま同じ字体になるかを見る。
- セーブの書き出し (`<a download>`) と読み込み (ファイルの窓) が、包装の中で動くか。

コントローラーで足りない操作は `desktop/controller.md`。
