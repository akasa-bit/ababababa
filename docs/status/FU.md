# 船と戦争 (FU) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `src/ship/` (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: 回 FU1 を済ませた (B-030・B-027)。次は回 FU2。
- 回 FU1 で入れたもの (光より速く分かる情報をなくす。QD-02 = b):
  - **戦勝点**: 戦果を [年, 星系, 国, 種類, 数] の知らせ (`warStats[key].ev`) にも残し、`warScore(a, b)` は a の首都に光が届いた戦果で数える (`warSeen`・`warScoreAt`。viewer = null なら本当の戦果)。観戦モードの地球だけは本当の戦果。AI の国の受け入れる線 (`reservation`) と、戦いながら見積もりを直す所も、首都に届いた戦果で。講和会議の持ち点は、講和の結ばれた星系に届いた戦果。
  - **講和の申し入れ**: AI の国から人間の国へは、送った首都から光速で届いてから `peaceOffers` に入る (届く途中は `peaceSent`。セーブの項目)。届く途中の前の申し入れは消さない (消すと、5 年ごとの申し入れが遠い国からは永遠に届かなかった)。届いたら同じ戦争の前のものと置き換わる。
  - **講和会議**: 人間の国が条件を選ぶ会議は、知らせが首都に届いてから `conferences` に入る (届く途中は `confSent`)。期限はそこから 3 年。
  - **船の一覧** (`shipsHtml`・軍事の表): 出発の光が届いてから、到着の光が届くまで (幽霊を含む。`seenFleets`・`seenMoving`)。進路変更は変えた所からの光が届いてから (`seenLeg`)。他国の艦隊は行き先を出さない。「向かっている」は自国の艦隊だけ。
  - **集結の命令** (艦隊・歩兵): 首都に届いている記録の駐留から出す (`rallySources`・`troopRallySources`。core の `commands.js` の 2 行から呼ぶ)。
  - **相手が見ている自分** (B-027): 軍事の表に、近い 8 か国の首都に見えている自国の艦隊の数 (`seenShips`) と、何年前の様子か、読み違いの 1σ の幅 (`seenByRival`)。
  - 試験 `tools/tests/lightwar.js` (CI で止める)。`tools/strategy.js` は、知らせが届いて開いた講和会議も「判断を求められた回数」に数えるようにした。観戦の AI (`earthWarYearly`) 自体は変えていない。
- 残り (光より速いままのもの): 戦争疲弊 (国じゅうで一瞬に増え、政治の表 `politics/politics-ui.js` に相手の疲弊がそのまま出る)・講和会議の条件 (`treatyTerms`) は負けた国のいまの資金と星系・AI の国どうしの講和の交渉は両方の首都の線を一瞬で比べる・星間マップの自国の艦隊の矢印は本当の行き先 (`screen/galaxy-view.js`。GA に知らせた)・`docs/research/game-physics-audit.md` の 2.8 の e・g・h・i・j・k・l・m。
- 前のレーン P (物理) と A (戦争) の仕事を持つ。P6 (ゲーム版にも遮蔽と加速の時間) と #173 (物理学者の SF への指摘。シミュレーション版だけの直しは `SIM_ONLY`) が入っている。
- いまの数 (回 R1、12 銀河 × 300 年): R29 2.72 (合格)・R13 1.09 (判定しない)・R14 条約 70% (不合格) (`docs/restart-baseline.md` の 3)。
- 返事待ち: QD-04 (光速に近い艦隊を武器にするか。FU2 の最初に)、QD-06 (ゲーム版の太陽電池の劣化。保留)。

## 済んだ回

回が済んだら (その回の最後の PR で)、ここに 1 行足す (例: `- GA1 (#180)`)。`node tools/session-check.js` が、次の回を始めてよいかをこれで決める。

- FU1 (#182)

## 次にやること

1. 回 FU2: 戦争の多さと終わり方の測り直し (B-031)・艦隊戦 (B-034)。
2. 2 波目: 船の設計と入植集団 (B-033。経済の年齢のあと)。
3. 保留: P10 (太陽電池の劣化。B-036)。

## 知らせ

(ほかのレーンからの知らせは、ここに 1 行ずつ)

- 2026-10-22 政治 (回 SE1) から: **1 行の呼び出しのお願い**。`src/ship/war-peace.js` の `startConference` の頭 (`for (const w of winners) this.endWar(...)` の次) に、`const top = winners.reduce((a, b) => (b.pts > a.pts ? b : a)); this.realmDefeated(loser, top.realm);` を足してほしい。講和会議で負けた国の傀儡国 (T10) が、勝った国 (持ち点がいちばん多い国) の家臣に移る (B-024。`src/politics/loyalty-regime.js` の `realmDefeated`)。降伏 (`surrender`) は政治の側が年ごとに見つけるので、呼び出しは要らない。いまは AI の国が傀儡国の型を選ばないので、自動対戦の数はほとんど動かない (プレイヤーが選んだ傀儡国だけに効く)。
- 2026-10-22 政治 (回 SE1) から: 共同統治 (T08) の 2 国目の宗主は、分け前を断たれて 10 年たち、艦隊が主な宗主の国以上なら、政治の側から `beginWar(2 国目, 主な宗主, 家臣の星系)` で開戦する (B-023。`jointYearly`。独立戦争と同じ呼び方)。宣戦の判断の AI (`realmsYearly`) は変えていない。戦争の多さを測り直すとき (B-031) に、この開戦も数に入る。
- DO (回 DO1): 遅れつきのボット (`tools/strategy.js` の `humanize`) は、判断のあいだ観戦モードを切るので、#182 の光の遅れの戦勝点・講和の申し入れをそのまま読む。`earthWarYearly` を変えたら `strategy.js` も合わせる (CI の `strategy` で分かる)

## 前のレーン A から写したもの

### 測り方

```sh
node tools/src.js --ref origin/main --out base-src.html   # src は分けてあるので、組み立ててから (回 R3)
node tools/wars-headless.js src/index.html base-src.html 32 300 6
```

32 の銀河で 5 分ほど。値を振るときは、`tools/headless.js` の `load({ params: { BARGAIN: { declareChance: 0.08 } } })` で表を上書きできる。


### 落とし穴

- 戦果を数えるときは `warLoss(by, lost, n, sys)`・`warTake(by, lost, sys)` に星系を渡す (渡さないと知らせが残らず、どこからもすぐ見える)。戦勝点は「誰の首都から見たか」で違うので、`warScore(a, b)` は a の首都から。本当の値は `warScoreAt(null, a, b)`。
- 人間の国への講和の申し入れは `postPeaceOffer` で送る (`peaceOffers` に直接入れない)。
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
