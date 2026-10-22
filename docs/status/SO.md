# 外向き (SO) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `desktop/`・`store/`・`src/outward/`・画面の文字列 (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: まだ始めていない (1 波目。回 SO1 から)。
- 前のレーン S: Electron の包装 (#136)・ストアの下書きと画像の案と Steamworks の手順 (`store/`)。
- 決まっていること: スクリーンショットは CSS 1280×720 を 1.5 倍で (QD-18)・カプセルは星図に文字だけ (QD-19)・字体は包装の側で同梱 (QD-20)・名前は副題を英語でも付けて反応を見る (QD-14)・狙う 1 位は L1〜L3 (QD-13)。
- 返事待ち: 早期アクセス (QD-15)・値段 (QD-16)・中国語の訳し方 (QD-17。専門の訳者か販売元)。ユーザーにしかできないこと (Steamworks のアカウントと書類・手数料・Firebase・Steam Deck の実機) は `docs/decisions.md` の 3。

## 済んだ回

回が済んだら (その回の最後の PR で)、ここに 1 行足す (例: `- GA1 (#180)`)。`node tools/session-check.js` が、次の回を始めてよいかをこれで決める。

## 次にやること

1. 回 SO1: ストアの下書きの突き合わせ・スクリーンショットのセーブとカプセル・用語集・字体の同梱 (B-078・B-079・B-074・B-088)。
2. 回 SO2: Windows を CI で・Steam Input (B-086・B-085)。
3. 翻訳の本番 (回 T1。ほかのレーンは止める) は 1 波目のあと。

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
