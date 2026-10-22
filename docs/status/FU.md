# 船と戦争 (FU) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `src/ship/` (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: 回 FU2 の途中。艦隊戦 (B-034) を入れた。残りは光速に近い艦隊の武器 (B-035。QD-04 = b) と、R29・R14 の測り直し。
- 回 FU2 の測り直し (B-031。32 の銀河 × 300 年 × 6 か国): FU1 の前の main で R29 2.98・条約 67%、FU1 のあとの main で R29 3.05 (上端を 0.01 超え)・条約 70%、艦隊戦を入れて R29 2.96・条約 72%・白紙 12%・滅亡 16%。R15 (戦死者の裾) は α 1.36 (xmin 8.8 万人・裾の 395 の戦争。p 値は出していない)。R13 は 1.11。
- 艦隊戦 (B-034。ユーザーの答え「HOI4 の海戦を参考に」。`BATTLE`・`battleRound`・`battlesStep`):
  - 1 艦隊 = 耐久と組織力を持つ 1 つの艦。1 年に 24 回撃ち合い、当たると耐久と組織力が減る。組織力が尽きた艦は 2 回撃たれながら退き、近くの自国の星系へ戻る (守る側に退く先がなければ最後まで戦う)。大きすぎる艦隊は位置取りが悪い (pos)。戦機 (luck) と士気 (morale) を戦いごとに引く。
  - 補正 2 つ (台帳の C27・C28): ゲーム版は pos 0.3・luck 1 で、2 倍の兵力で 77% 勝ち・損害の指数 0.48 (決まった案は 75%・0.5)。pos 1.6・luck 1.6 (シミュレーション版の値) にすると傾き 0.68・指数 −0.32 で R16 に合格する。`node tools/battles-headless.js [src] [戦いの数] [版]`、値は `EDITION_BATTLE='{"pos":…}'` で上書き。
  - 負けた側が沈む割合の中央値は 50%、勝った側は 0〜2% (退いた艦は沈まない)。戦いの長さの中央値は 0.5 年。
  - 戦死者: 沈んだ艦 × 10 万人 (仮。B-033 で差し替え) と、攻囲された星系の住民の年 1% (人口も減る)。`warStats[key].dead`。
  - 始まるときに攻撃側の勝つ見込み (同じ形の戦いを別の乱数で 64 回解いた割合。試合の筋は変えない)。終わったら報告 (`battleReports`、20 件。セーブの項目) を軍事の表に、終わりの知らせが首都に届いてから出す。
  - 試合の中の艦隊戦は少ない (AI の国は守りの薄い星系を攻める。前の main でも 4 銀河 × 150 年で入植星系の艦隊戦は 0)。法則は作った戦いで測る。
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

1. 回 FU2 の残り: 光速に近い艦隊の武器 (B-035。QD-04 = b。悪名と報復)、そのあと R29 を合わせ直し (較正)、R14 を測り直して、外れていれば構造で直す案を出す (確認用)。
2. 2 波目: 船の設計と入植集団 (B-033。経済の年齢のあと)。
3. 保留: P10 (太陽電池の劣化。B-036)。

## 知らせ

(ほかのレーンからの知らせは、ここに 1 行ずつ)

- 2026-10-22 政治 (回 SE2・B-026) から: **2 行の呼び出しのお願い** (ユーザーの決定 QD-38 = a)。遅れて届く外交の協定ができた (`src/politics/diplomacy.js`)。(1) `war-ai.js` の宣戦の相手選び (BARGAIN の `for (const r of roots)` の中と、前の確率表の `prey` の filter) に `if (this.pactBars(root, r)) continue;` (不可侵と同盟の相手には宣戦しない。縛られるのは協定の知らせが届いてから)。(2) `reservation` の相手の艦隊 `theirs` に `+ this.pactAllyShips(r, e)` (相手の同盟国の艦隊を、首都に届いている記録で足す。抑止)。入るまでは、AI が協定の相手に宣戦すると破約 (信頼が下がる) になるだけ。AI どうしも協定を結ぶ (QD-37 = b) ので、防衛同盟の参戦 (政治の側から `beginWar`) で戦争の多さ R29 が動く。測った値は `docs/status/SE.md`。

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
