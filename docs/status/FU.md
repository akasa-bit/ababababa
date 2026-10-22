# 船と戦争 (FU) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `src/ship/` (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: 回 FU2 を済ませた (B-031・B-034 #196・B-035)。R14 を構造で直す案 (下) をユーザーに見せて、選んでもらう。
- 回 FU2 の測り直し (B-031。32 の銀河 × 300 年 × 6 か国): FU1 の前の main で R29 2.98・条約 67%、FU1 のあとの main で R29 3.05 (上端を 0.01 超え)・条約 70%、艦隊戦を入れて R29 2.96・条約 72%・白紙 12%・滅亡 16%。R15 (戦死者の裾) は α 1.36 (xmin 8.8 万人・裾の 395 の戦争。p 値は出していない)。R13 は 1.11。
- 艦隊戦 (B-034。ユーザーの答え「HOI4 の海戦を参考に」。`BATTLE`・`battleRound`・`battlesStep`):
  - 1 艦隊 = 耐久と組織力を持つ 1 つの艦。1 年に 24 回撃ち合い、当たると耐久と組織力が減る。組織力が尽きた艦は 2 回撃たれながら退き、近くの自国の星系へ戻る (守る側に退く先がなければ最後まで戦う)。大きすぎる艦隊は位置取りが悪い (pos)。戦機 (luck) と士気 (morale) を戦いごとに引く。
  - 補正 2 つ (台帳の C27・C28): ゲーム版は pos 0.3・luck 1 で、2 倍の兵力で 77% 勝ち・損害の指数 0.48 (決まった案は 75%・0.5)。pos 1.6・luck 1.6 (シミュレーション版の値) にすると傾き 0.68・指数 −0.32 で R16 に合格する。`node tools/battles-headless.js [src] [戦いの数] [版]`、値は `EDITION_BATTLE='{"pos":…}'` で上書き。
  - 負けた側が沈む割合の中央値は 50%、勝った側は 0〜2% (退いた艦は沈まない)。戦いの長さの中央値は 0.5 年。
  - 戦死者: 沈んだ艦 × 10 万人 (仮。B-033 で差し替え) と、攻囲された星系の住民の年 1% (人口も減る)。`warStats[key].dead`。
  - 始まるときに攻撃側の勝つ見込み (同じ形の戦いを別の乱数で 64 回解いた割合。試合の筋は変えない)。終わったら報告 (`battleReports`、20 件。セーブの項目) を軍事の表に、終わりの知らせが首都に届いてから出す。
  - 試合の中の艦隊戦は少ない (AI の国は守りの薄い星系を攻める。前の main でも 4 銀河 × 150 年で入植星系の艦隊戦は 0)。法則は作った戦いで測る。
- 光速に近い艦隊の一撃 (B-035。QD-04 = b。`STRIKE`・`src/ship/strike.js`):
  - 命令 `strike` (core の `commands.js` に 3 行、`game-consts.js` の指令の名前に 1 つ)。星系の欄の軍事の「光速の一撃 (取り消せない)」を開いて押す。減速しないので、ふつうの派遣より少し早く着く。
  - 1 艦隊で 1 つの天体の入植地を焼く (人口の 0.1% だけが残り、施設・歩兵・採掘基地はなくなる。全部の天体を焼けば備蓄と駐留艦隊も)。艦隊は残らない。戦争が始まる。死者は戦争の戦死者に入る。
  - 釣り合い: 知らせが光速で届いた国が宣戦する (撃たれた国はかならず、40 光年以内の国は 60%)。撃った国の家臣は、知らせが届くと忠誠が 20 下がる。人間の国は悪名 +50。記録 `strikes` (セーブの項目、200 年)。
  - AI の国は、戦争で大きく負けていて (首都に届いた戦勝点 −20 以下)、首都に 2 艦隊以上あれば、年 50% で相手の首都へ 1 艦隊を撃つ。人間の国の星系は、ほかの攻め方と同じく狙わない。12 の銀河 × 300 年で 31 回。
  - 観戦の AI (`earthWarYearly`) は使わない (`tools/strategy.js` は変えていない)。
- R29 の合わせ直し: `BARGAIN.declareChance` 0.08 → 0.05 (R29 3.07 → 2.50。政治の協定 (SE2) を入れたあと。`docs/negotiation.md` の 4.2)。
- 政治から頼まれた呼び出しを入れた: 講和会議で負けた国の傀儡国 (`realmDefeated`。SE1)、宣戦の相手から協定の相手を外す (`pactBars`)・受け入れる線の相手の艦隊に同盟国の艦隊を足す (`pactAllyShips`) (SE2)。

### R14 (終わり方) の直し (回 FU2 の続き。ユーザーの決定 e)

- 立ち消え (`WAREND.lapse` 10 年)・白紙講和の線 (`TREATY.white` 5 → 20)・大きく勝っている国は降伏まで戦う (`WAREND.decisiveP` 0.98・`yieldAt` −40。人間の国には「降伏を求める」申し入れ)。
- 32 の銀河 × 300 年で、白紙 29%・条約 27%・勝利 43% (R14 合格)・R29 2.56・R15 α 1.33 (`docs/negotiation.md` の 4.3)。
- **値の 2 つ (decisiveP・yieldAt) は R14 を見て選んだ**。R14 は確認用だったので、較正に移すか、確認用のままにして別の確認を足すかは、目標を変える PR (道具と検証) で決めてもらう。
- 画面の文: 人間の国への降伏の求めは、知らせの帯 (`screen/panels-system.js`) と政治の表 (`politics/politics-ui.js`) では「講和に応じる」のボタンのまま出る (応じると降伏する)。GA と SE に知らせた。
- 試験 `tools/tests/warend.js` (CI で止める)。

## 済んだ回

回が済んだら (その回の最後の PR で)、ここに 1 行足す (例: `- GA1 (#180)`)。`node tools/session-check.js` が、次の回を始めてよいかをこれで決める。

- FU1 (#182)
- FU2 (#196・#197)

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
