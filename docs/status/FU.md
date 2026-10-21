# 船と戦争 (FU) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `src/ship/` (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: まだ始めていない (1 波目。回 FU1 から)。
- 前のレーン P (物理) と A (戦争) の仕事を持つ。P6 (ゲーム版にも遮蔽と加速の時間) と #173 (物理学者の SF への指摘。シミュレーション版だけの直しは `SIM_ONLY`) が入っている。
- いまの数 (回 R1、12 銀河 × 300 年): R29 2.72 (合格)・R13 1.09 (判定しない)・R14 条約 70% (不合格) (`docs/restart-baseline.md` の 3)。
- 返事待ち: QD-04 (光速に近い艦隊を武器にするか。FU2 の最初に)、QD-06 (ゲーム版の太陽電池の劣化。保留)。

## 次にやること

1. 回 FU1: 光より速く分かる情報を光の遅れに通す (B-030。QD-02 = b)・相手が見ている自分 (B-027)。
2. 回 FU2: 戦争の多さと終わり方の測り直し (B-031)・艦隊戦 (B-034)。
3. 2 波目: 船の設計と入植集団 (B-033。経済の年齢のあと)。
4. 保留: P10 (太陽電池の劣化。B-036)。

## 知らせ

(ほかのレーンからの知らせは、ここに 1 行ずつ)

## 前のレーン A から写したもの

### 測り方

```sh
node tools/src.js --ref origin/main --out base-src.html   # src は分けてあるので、組み立ててから (回 R3)
node tools/wars-headless.js src/index.html base-src.html 32 300 6
```

32 の銀河で 5 分ほど。値を振るときは、`tools/headless.js` の `load({ params: { BARGAIN: { declareChance: 0.08 } } })` で表を上書きできる。


### 落とし穴

- **main がとても速く動く** (レーン B・C・P・Q・S・U が並行)。マージの直前に `git fetch origin main && git merge-base --is-ancestor origin/main HEAD` で確かめ、動いていたら取りこんで CI を回し直す。セッション 3 では #121 を 4 回取りこみ直した。
- ぶつかる場所はいつもセーブの行 (`buildSave`) と `index.html`。`index.html` は回 R3 からコミットしない。
- 目標の番号と版は、ほかのレーンも使う。出す直前に `targets/targets.json` の版と最後の番号を見る。
- 重い測定を裏で回しながら `node tools/ci-tests.js` を回すと、`rotate` が時間切れで落ちることがある (単独で回すと合格)。
- 物理の所 (`shieldOf`・`withAccel` など) と `EDITIONS.sim` は、このレーンが持つ。`simulation.html` は作り直さない (`docs/parallel.md` の 6)。


## 前のレーン P から写したもの

### 落とし穴

- `shieldOf`・`accelExtra` は `phys` (試合の切り替え) を最後の引数に取る。`Game` の中からは `this.physics` を渡す (渡さないと版の値 `ED.physics` になり、古いセーブで物理が効いてしまう)。
- `flare` だけは銀河を作るときに効くので版の値。セーブの `physics.flare` は読むときに使わない。
- `tools/tests/physics.js` は `EDITION=game` と `EDITION=sim` で中身が少し違う (ゲーム版の分はフレアの表示と古いセーブの確かめ、シミュレーション版の分は素子の作り)。CI はゲーム版の分で止まる。
- 試験で版の切り替えを変えるときは `H.load({ edition, params: { ED: { physics: { … } } } })`。`edition` を忘れると、シミュレーション版の試験の中でゲーム版の試合と比べてしまう。
- シミュレーション版だけの物理 (#173) は `SIM_ONLY` (`EDITION === 'sim'`) で分けた。`ED.physics` はゲーム版にもあるので、版で分けるときに `ED.physics` を見ない。
