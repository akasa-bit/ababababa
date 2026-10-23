# 外向き (SO) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `desktop/`・`store/`・`src/outward/`・画面の文字列 (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: 回 SO3 (2026-10-23。2 波目) が済んだ。次は翻訳の本番 (T1。2 波目の全部のあと、ほかのレーンを止めて 1 本で)。
- 回 SO1 でしたこと: ストアの下書きを main `de69fc8` と突き合わせて直した (`store/page-ja.md` の 8)・撮るためのセーブとスクリーンショット 7 枚・カプセルの案 8 枚を作る台本 (`desktop/shots/shoot.mjs`。`store/images.md` の 2・5)・用語集 315 語と名前の作り方 (`docs/glossary/`。T1 が使う形)・字体を包装で同梱 (`desktop/prepare.mjs`・`electron/main.js`・`desktop/check.mjs`。`desktop/README.md` の 1-2)。
- 回 SO2 でしたこと: CI に「包装 (Windows と Linux)」(`.github/workflows/desktop.yml`) を足し、包装した実行ファイルをネットなしで開いて、ゲームが動く・セーブを読み直せる・字体が同梱で読めるかを見る (`desktop/check.mjs`。`desktop/README.md` の 1-4)・Steam Input の既定の設定 (`desktop/steam-input/`。README の 1-5)。
- 回 SO3 でしたこと: 予告編 (B-080。`desktop/trailer/trailer.mjs`。43 秒・1920×1080・30 コマ/秒・H.264 + 無音の AAC。`store/images.md` の 3)・撮るためのセーブを人の操作で遊んで作る台本 (`desktop/shots/play.mjs`) で、ストアの画像の場面 3 (決めること) と 6 (講和会議) を撮り直した (`store/images.md` の 2)。Firebase の設定 (B-089) はまだもらっていないので入れていない。
- 前のレーン S: Electron の包装 (#136)・ストアの下書きと画像の案と Steamworks の手順 (`store/`)。
- 決まっていること: スクリーンショットは CSS 1280×720 を 1.5 倍で (QD-18)・カプセルは星図に文字だけ (QD-19)・字体は包装の側で同梱 (QD-20)・名前は副題を英語でも付けて反応を見る (QD-14)・狙う 1 位は L1〜L3 (QD-13)。
- 返事待ち: 早期アクセス (QD-15)・値段 (QD-16)・中国語の訳し方 (QD-17。専門の訳者か販売元)・作った星系の名前の中国語 (QD-71。訳者に任せ、仮は英字)。Steam Input の設定を実機で読み込んで既定にする (QD-72。ユーザー)。ユーザーにしかできないこと (Steamworks のアカウントと書類・手数料・Firebase・Steam Deck の実機) は `docs/decisions.md` の 3。

## 済んだ回

回が済んだら (その回の最後の PR で)、ここに 1 行足す (例: `- GA1 (#180)`)。`node tools/session-check.js` が、次の回を始めてよいかをこれで決める。

- SO1 (#183)
- SO2 (#190)
- SO3

## 次にやること

1. 翻訳の本番 (回 T1。ほかのレーンは止める) は 1 波目のあと。用語集 (`docs/glossary/README.md` の 2) を使う。始める前に `node docs/glossary/check.mjs` を回す。
2. 予告編の音楽: 音の素材 (QD-53・QD-54) が入ったら、`trailer.mjs` の ffmpeg の無音を差し替える。
3. Firebase の設定 (QD-23) をもらったら、外向きのどの回でも `src/outward/cloud.js` に入れる (B-089)。

### 回 SO3 で分かったこと・気をつけること

- 観戦のまま進めるだけでは、地球の国が勝つ講和会議は起きない (観戦の AI は守り寄り。銀河 60 個 × 200 年で 0 回)。人の操作で遊ぶ台本 (`play.mjs`) にした。ゲームが変わると筋 (宣戦の年・相手・講和の年) も変わるが、台本は筋を見て場面と字幕を決めるので、そのまま動く。筋が講和会議まで届かなかったら (160 年)、止まって遊んだ筋を出す。
- 地球が知る戦勝点は光の遅れのぶん古いので、相手からの申し入れを地球で受けると、地球に届いている戦果 (0 のことが多い) で白紙講和になる。こちらの申し入れを相手の首都に届かせると、首都に届いている戦果で講和会議になる (`makePeace` の `from`)。遊び方を決めるときに気をつける。
- 予告編の 1 コマは 0.7 秒ほどかかる (1920×1080 の画面の写し)。答え合わせの早回しのように実時間で動くものは、台本が 1 コマずつ動かす。
- 地図の視点は、右の欄の開け閉めのあと地図の大きさが変わって寄せ直されるので、少し待ってから決める (`cam`)。

### 回 SO1 で分かったこと・気をつけること

- 組み立てた `index.html` は圧縮されていて、頭の `<link>` を包装の側で書き換えられない。字体は Electron で `https` を横取りして差し替えた。ゲームが字体を変えたら `desktop/prepare.mjs` の `FONTS` を合わせる。
- 撮る台本は CI に入れていない (場面の見た目を人が見るもので、合否がない)。字体の確かめは回 SO2 で CI の「包装」に入った。
- 統治の型の事例に、満洲国・チベット・外モンゴルなどが出る。簡体中国語を出す前に訳者と書き方を確かめる (`store/page-ja.md` の 6)。

### 回 SO2 で分かったこと・気をつけること

- CI の「包装」は `desktop/`・`src/index.html`・ワークフローを変えた PR と毎週月曜にだけ回る。ほかのレーンの PR は止めない。毎週の回が落ちたら、外向きの次の回で最初に直す。
- Steam Input の VDF のうち、キーとマウスの書き方 (`key_press`・`mouse_button`・`mouse_wheel`) は公式の例で確かめられなかった。Deck の実機で読み込んで書き出し直す (QD-72)。違えば `desktop/steam-input/make.mjs` の表を直す。
- 左スティックで地図を動かすには、ゲームの中に地図を動かすキーかゲームパッドの対応が要る (案 B。B-061。画面と最初の体験)。

## 知らせ

(2026-10-23 から、新しい知らせは `docs/notices/SO/` に 1 件 1 ファイルで来る (`docs/notices/README.md`)。下は前からの知らせ。片付けたら消す)

## 前のレーン S から写したもの

### 残っていること (S1 の分)

- Windows 版を Windows の上で動かして確かめる (組み立てられることまでは確かめた)。実機か、CI に Windows を足すとき (道具と検証と相談)。
- Steam Deck の実機で `desktop/bench/run.mjs` と同じ手順を回す (F08 の判定。ユーザーの手元)。
- 字体の同梱 (いまは Google Fonts をネットから読む。オフラインの Deck では別の字体になる)。包装の側で差し替えるか、ゲームの中で同梱するかを決める。
- Steamworks (`steamworks-ffi-node` か `steamworks.js`)・オーバーレイ (`--in-process-gpu`)・画面のキーボード・Steam Cloud は、Steamworks のアカウントができてから (S2 の手順の一覧のあと)。
- コントローラーの案 B (ゲームの中でゲームパッドに対応) は `src/` に触るので、画面と最初の体験の回に回す (B-061) (`desktop/controller.md` の 2)。

- 組み立てた `index.html` は回 R3 からリポジトリに入らない。包装の前に `node tools/build.mjs` で作る (`desktop/prepare.mjs` は前から、ないと止まる)。
