# 外向き (SO) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `desktop/`・`store/`・`src/outward/`・画面の文字列 (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: 回 SO1・SO2 (2026-10-22) が済んだ。1 波目の外向きの回は終わり。次は翻訳の本番 (T1。W1 のあと)。
- 回 SO1 でしたこと: ストアの下書きを main `de69fc8` と突き合わせて直した (`store/page-ja.md` の 8)・撮るためのセーブとスクリーンショット 7 枚・カプセルの案 8 枚を作る台本 (`desktop/shots/shoot.mjs`。`store/images.md` の 2・5)・用語集 315 語と名前の作り方 (`docs/glossary/`。T1 が使う形)・字体を包装で同梱 (`desktop/prepare.mjs`・`electron/main.js`・`desktop/check.mjs`。`desktop/README.md` の 1-2)。
- 回 SO2 でしたこと: CI に「包装 (Windows と Linux)」(`.github/workflows/desktop.yml`) を足し、包装した実行ファイルをネットなしで開いて、ゲームが動く・セーブを読み直せる・字体が同梱で読めるかを見る (`desktop/check.mjs`。`desktop/README.md` の 1-4)・Steam Input の既定の設定 (`desktop/steam-input/`。README の 1-5)。
- 前のレーン S: Electron の包装 (#136)・ストアの下書きと画像の案と Steamworks の手順 (`store/`)。
- 決まっていること: スクリーンショットは CSS 1280×720 を 1.5 倍で (QD-18)・カプセルは星図に文字だけ (QD-19)・字体は包装の側で同梱 (QD-20)・名前は副題を英語でも付けて反応を見る (QD-14)・狙う 1 位は L1〜L3 (QD-13)。
- 返事待ち: 早期アクセス (QD-15)・値段 (QD-16)・中国語の訳し方 (QD-17。専門の訳者か販売元)・作った星系の名前の中国語 (QD-71。訳者に任せ、仮は英字)。Steam Input の設定を実機で読み込んで既定にする (QD-72。ユーザー)。ユーザーにしかできないこと (Steamworks のアカウントと書類・手数料・Firebase・Steam Deck の実機) は `docs/decisions.md` の 3。

## 済んだ回

回が済んだら (その回の最後の PR で)、ここに 1 行足す (例: `- GA1 (#180)`)。`node tools/session-check.js` が、次の回を始めてよいかをこれで決める。

- SO1 (#183)
- SO2 (#SO2PR)

## 次にやること

1. 翻訳の本番 (回 T1。ほかのレーンは止める) は 1 波目のあと。用語集 (`docs/glossary/README.md` の 2) を使う。始める前に `node docs/glossary/check.mjs` を回す。
2. ストアの画像は、手で遊んだセーブ (`--save`) で撮り直すと場面がよくなる (講和会議・「決めること」が届いた所は、いまの台本では作れていない)。試遊の回の前後に。

### 回 SO1 で分かったこと・気をつけること

- 組み立てた `index.html` は圧縮されていて、頭の `<link>` を包装の側で書き換えられない。字体は Electron で `https` を横取りして差し替えた。ゲームが字体を変えたら `desktop/prepare.mjs` の `FONTS` を合わせる。
- 撮る台本は CI に入れていない (場面の見た目を人が見るもので、合否がない)。字体の確かめは回 SO2 で CI の「包装」に入った。
- 統治の型の事例に、満洲国・チベット・外モンゴルなどが出る。簡体中国語を出す前に訳者と書き方を確かめる (`store/page-ja.md` の 6)。

### 回 SO2 で分かったこと・気をつけること

- CI の「包装」は `desktop/`・`src/index.html`・ワークフローを変えた PR と毎週月曜にだけ回る。ほかのレーンの PR は止めない。毎週の回が落ちたら、外向きの次の回で最初に直す。
- Steam Input の VDF のうち、キーとマウスの書き方 (`key_press`・`mouse_button`・`mouse_wheel`) は公式の例で確かめられなかった。Deck の実機で読み込んで書き出し直す (QD-72)。違えば `desktop/steam-input/make.mjs` の表を直す。
- 左スティックで地図を動かすには、ゲームの中に地図を動かすキーかゲームパッドの対応が要る (案 B。B-061。画面と最初の体験)。

## 知らせ

(ほかのレーンからの知らせは、ここに 1 行ずつ)

## 前のレーン S から写したもの

### 残っていること (S1 の分)

- Windows 版を Windows の上で動かして確かめる (組み立てられることまでは確かめた)。実機か、CI に Windows を足すとき (道具と検証と相談)。
- Steam Deck の実機で `desktop/bench/run.mjs` と同じ手順を回す (F08 の判定。ユーザーの手元)。
- 字体の同梱 (いまは Google Fonts をネットから読む。オフラインの Deck では別の字体になる)。包装の側で差し替えるか、ゲームの中で同梱するかを決める。
- Steamworks (`steamworks-ffi-node` か `steamworks.js`)・オーバーレイ (`--in-process-gpu`)・画面のキーボード・Steam Cloud は、Steamworks のアカウントができてから (S2 の手順の一覧のあと)。
- コントローラーの案 B (ゲームの中でゲームパッドに対応) は `src/` に触るので、画面と最初の体験の回に回す (B-061) (`desktop/controller.md` の 2)。

- 組み立てた `index.html` は回 R3 からリポジトリに入らない。包装の前に `node tools/build.mjs` で作る (`desktop/prepare.mjs` は前から、ないと止まる)。
