# コンテンツの足し方・直し方

出来事・種族の特性・国の名前・挑戦・国家方針・施設・資源などの「コンテンツ」を足す・直すときの決まりです。コンテンツの表は、レーンごとのフォルダ (`docs/parallel.md` の 2) に分かれて置いてあるので、まずこのページで「どこに・どんな形で・ほかに何をそろえるか」を見てください。

## 0. 一覧と点検

| 道具 | 使い方 |
|---|---|
| 一覧 | `node tools/content.js` — 種類ごとに、表の名前・置いてあるファイル・数・中身を Markdown で出す (いまのソースから作るので、いつも最新) |
| 点検 | `node tools/content.js --check` — 足りない名前・アイコン・対になる表の欠け・形の誤りを見つける。語り手の出来事は、どれも実際に起こして、どの選択肢を選んでも止まらないか (決めることの形・返事の効果・連作の続き・その後の 1 年) まで確かめる (約 20 秒。`--quick` で出来事を起こすのを省く) |
| CI | `tools/tests/content.js` が点検を回す (落ちたら止める)。`tools/tests/story.js` は語り手の連作の決まりを確かめる |

点検で落ちたら、出てきた行のとおりに足りないものを足す。直すにはユーザーが選ぶことがあるもの (アイコンなど) は、`tools/content.js` の `KNOWN` に理由を書いて「分かっている例外」にする (いまは高付加価値物品のアイコンだけ)。

## 1. 共通の決まり

- **足すと、同じシードの試合の筋が変わる**ものがある (種族の特性・国の名前・出来事など、くじで選ぶもの)。試合の筋が変わるのはかまわないが、PR の本文に書く。CI の自動対戦の表 (main との比べ) と面白さの代わりの数の止める線 (`docs/parallel.md` の 4) を見る。
- **ファイルの持ち主**: 表のあるフォルダのレーンが持つ (`docs/src-files.md` の 5)。ほかのレーンの表に足したいときは、知らせ (`docs/notices/`) で頼む。
- **アイコン**は、候補を見せてユーザーに番号で選んでもらい、出典とライセンスを README の「アイコンの出典」に足す (`docs/parallel.md` の 7)。勝手に足さない。
- **番号と名前の予約**: 目標・補正・セーブの項目・`EDITIONS.game` の値の名前は、使う前に `docs/registry.md` に書く。
- **試合の計算**は決まった計算 (`GM.pow`・`GM.exp` など。`Math.pow` は使わない)、備蓄の出入りは `mv`、お金は `earn`・`cash`、状態を変える操作は `issue` を通す (`docs/handoff.md` の 6)。`mv`・`price` の資源は名前 (`'metal'`) でも番号 (`RI.metal`) でもよい (4 を見る)。
- **版ごとに違う値**は `EDITIONS` にだけ置く。ゲーム性のための補正は `docs/game-plan.md` の補正の台帳に 1 行ずつ。
- **新しく覚えておく状態**はセーブに入れる (`saveField`。`docs/src-files.md` の 2)。試合 (Game) の物に途中で書き込む値 (覚えておく表など、セーブに入れないもの) は、`src/core/game-consts.js` の `GAME_LATE_FIELDS` に名前を足す (4 を見る)。
- **データの道具が書く表は手で直さない** (2.14)。

## 2. 種類ごとの足し方

### 2.1 語り手の出来事 (`STORY`。politics/story.js。持ち主: 政治)

何も起きない年が続くと、語り手が `STORY` からくじで 1 つ起こす (`storyYearly`。同じ種類は 25 年に 1 回、1 試合に `STORY_MAX` 回まで)。出来事は関数で書く:

| 名前 | 中身 |
|---|---|
| `pick(g)` | 起こせる星系 (なければ `null`)。頭の出来事だけが持つ。地球の国の星系は `earthSystems(g)`、くじは `pickOf(…)` (試合の乱数) |
| `start(g, sys, data)` | 知らせを出し (`g.event('story', sys, 文)`)、多くは「決めること」を出す (`ask(g, 種類, sys, 文, 選択肢, 既定, 足す値)`) |
| `resolve(g, dec, k, local)` | 返事 `k` が届いたときの効果 (`local` = 期限までに返事がなく、現地が既定で決めた) |
| `weigh(g, dec, k)` | 観戦の AI がその選択肢をどれだけ選びたいか (大きいほど選ぶ。なくてもよいが、選択肢のある出来事には付ける) |
| `next(g, dec, k, local)` | 連作の続き。`later(続きの種類, data)` を返すと、8〜15 年あとに同じ星系で続きが起きる |
| `follow: true` | 続きの段 (語り手がくじで選ばない)。`pick` は持たない |

選択肢は `{ k, label, note, cr }` (k = 選んだときの名前・label = ボタンの名前・note = 代わりの得と損・cr = 払う資金)。**どの選択肢にも得と損を付け、明らかな最善をなくす** (B-049)。既定 (期限切れのとき) は `ask` の 6 番目の引数で、選択肢の k のどれか。

雛形 (`STORY` の中に足す):

```js
  meteor: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap)),
    start(g, sys) {
      g.event('story', sys, `${g.system(sys).name} に小惑星が近づいている`);
      ask(g, 'meteor', sys, `${g.system(sys).name} に小惑星が近づいている。`, [
        { k: 'deflect', label: '軌道をそらす', cr: 200, note: '被害なし。資金 200' },
        { k: 'evacuate', label: '住民を避難させる', note: '資金はかからないが、忠誠度 −5' }], 'evacuate');
    },
    resolve(g, dec, k) {
      if (k === 'deflect') g.spendDecision(dec, { pv: dec.sys }); else loyal(g, dec.sys, -5);
    },
    weigh: (g, dec, k) => (k === 'deflect' ? 1 + richer(g, 1000) : 1),
  },
```

足したら `node tools/content.js --check` (新しい出来事も実際に起こして確かめる) と `node tools/tests/story.js`。

### 2.2 種族の特性 (`SPECIES_TRAITS`。politics/nations.js。持ち主: 政治)

`{ label, desc, 効き目 }`。効き目は `growth` (人口の増え方)・`cap` (人口の上限)・`capBy` (地表ごとの人口の上限。地表の名前は `SURFACE_LABEL`)・`fleet`・`ind`・`mine`・`trade` (倍率) と `pc` (政治力の年あたりの加算)。

- **新しい種類の効き目**を足すときは、`traitMods` (同じファイル) が読む名前に足し、効かせる所 (`modsOf(星系).名前` を読む所) を書く。点検の `EFFECT` にも足す。
- 食い違う特性は `TRAIT_CLASH` に。人類は `HUMAN_TRAITS`。
- 異星の種族の特性は名前からくじで決まる (`speciesTraits`) ので、**足すと、同じシードの国の特性が変わる**。

### 2.3 国の名前 (politics/names.js。持ち主: 政治)

- 国号 `NATION_SUFFIX`: `{ s: 国号, ex: 例, w: 選ばれやすさ, t: [その特性を持つ種族なら 3 倍選ばれやすい特性] }`。足すと、同じシードの国の名前が変わる。
- 独立した星系の国の接尾辞 `SECEDE_SUFFIX` (文字列)。
- 自作の国の母星の好み `HOME_ENV` (地表の名前)・`HOME_DIST` と `HOME_DIST_RANGE` (同じ名前で対にする)。

### 2.4 挑戦 (`CHALLENGES`。politics/policy-consts.js。持ち主: 政治)

`{ label, desc }` を足し、果たしたかどうかを `challengesYearly` (screen/eras-score.js。持ち主: 画面) に書く (`c.id === '名前'` の行)。

### 2.5 国家方針 (`POLICIES`・`POLICY_LOYALTY`。politics/pc-vassal.js。持ち主: 政治)

`POLICIES` に `{ label, good, bad }` (名前・効果・代わりに)、`POLICY_LOYALTY` に家臣の忠誠度の目標の増減を足す (2 つの表は同じ名前で対にする)。効き目は `policyAt(星系) === '名前'` で書く (いまは settler.js・colonies-routes.js・market-economy.js・loyalty-regime.js にある)。README の国家方針の表も直す。

### 2.6 委任方針・総督の方針 (politics/pc-vassal.js。持ち主: 政治)

- 委任方針 `MANDATES` と説明 `MANDATE_NOTE` を同じ名前で足し、報告の文 `MANDATE_WHY` (screen/reports.js) にも足す。効き目は `gv.mandate === '名前'` (development.js・war-ai.js)。
- 総督の方針 `GOVERNOR` と `GOVERNOR_NOTE` を同じ名前で足し、効き目を `loyalty-regime.js` の `gv.governor` の所に書く。

### 2.7 施設 (core/facilities.js。持ち主: 共通 (世話役: 道具と検証))

`FACILITY` (名前)・`FACILITY_MAX` (最大の段)・`LV0` (始めの段 0) に同じ名前で足し、アイコン (`ICONS`) をユーザーに選んでもらう。効き目は `c.lv.名前` を読む所に書く (生産は `yieldBy`、人口の上限は `capOf`)。建設の費用は `upgradeCost`。読み込みのとき前の版のセーブの入植地には `LV0` の値が足される (`restore`) ので、セーブはそのまま読める。

### 2.8 資源 (core/world.js ほか。持ち主: 共通・経済・船と戦争)

いちばん広く効く。`RES` (並び)・`RES_LABEL` (名前)・`PRICE` (基準の値段)・`RES_KG` (1 単位の質量。ship/physics.js)・`MARKET.cover` (在庫の厚さ。economy/market-consts.js)・アイコン (`ICONS`) をそろえる。掘る資源なら `MINED` と `OUTPOST_RES`、消費するなら economy の消費の所 (`econConsumeOne`)。物質の保存の試験 (`tools/tests/conserve.js`) の出入りの種類も見る。始める前に、経済のレーンと突き合わせる。

星系の在庫・市場の値段・生産と消費などの資源ごとの量は、`RES` の順の並び (`ResVec`。core/world.js の `namedVec`) で持つ。`RES` に名前を足せば並びも伸び、名前でも番号でも引ける (`st.metal` と `st[RI.metal]` は同じ)。セーブには前と同じ名前の物で書く。資源の名前は配列の持ち物 (`length`・`map` など) と重ねられない (`--check` が見る)。前の版のセーブに新しい資源の値がないときは、並びの中で `undefined` のまま持つ (名前の物のときと同じふるまい)。

### 2.9 収支の帳簿 (core/game-consts.js。持ち主: 共通)

政府の収支の新しい種類は `LEDGER_LABEL` に名前を足し、記帳は `earn(種類, 額, 星系, 相手の帳簿)` で (お金は湧かず消えない。`docs/money.md`)。アイコンを出すなら `LEDGER_ICON` (アイコンの名前は `ICONS` にあるもの)。エネルギーの帳簿は `E_LABEL` (ship/physics.js)。年あたりにならした表 (`gv.ledger`・`gv.eledger`) は `LEDGER_LABEL`・`E_LABEL` の順の並び (`LedgerVec`・`ELedgerVec`) なので、名前を足せば表も伸びる (足すのは末尾に。前の版のセーブの表と足す順がそろう)。この刻みの分 (`gv.led`・`gv.eled`) は名前の物のまま。

### 2.10 知らせの種類 (screen/events-ui.js。持ち主: 画面)

`g.event('種類', 星系, 文)` の新しい種類は、`EVENT_KIND` (名前) と `EVENT_TIER` (1 細事・2 普通・3 重大) に足す。点検は、ソースの中の `event('…')` の種類がどれも表にあるかを確かめる。

### 2.11 協定 (`PACT_KINDS`。politics/diplomacy-consts.js。持ち主: 政治)

`{ label, note }` を足し、効き目を politics/diplomacy.js に書く (`pactBinds(国, 国, '名前')`)。

### 2.12 難易度 (`HANDICAP`。ship/war-consts.js。持ち主: 船と戦争)

`{ label, aiIncome, aiCost, info }` (info は `full`・`fuzzy`・`hidden`)。

### 2.13 アイコン (`ICONS`。screen/icons.js。持ち主: 画面)

`名前: [viewBox, SVG の中身]` (白一色で出すので `currentColor`)。候補を見せてユーザーに選んでもらい、README の「アイコンの出典」に出典とライセンスを足す。画面では `ico('名前')`。

### 2.14 データから作る表 (手で直さない)

| 表 | 書く道具 | 説明 |
|---|---|---|
| 実在の星 `REAL_STARS` (core/galaxy.js の `STARS:BEGIN`〜`STARS:END`) | `data/build/build_stars.py` | 星を変えるときは銀河の版 `GALAXY_GEN` を上げる (`docs/handoff.md` の 6) |
| 統治体制と従属国の型 `VASSAL_DATA` (politics/pc-vassal.js の `VASSAL:BEGIN`〜`END`) | `data/build/build_vassal_game.py` | `docs/vassal-game.md` |
| 星間の気体・遮蔽・フレア (ship/physics.js の `ISM`・`SHIELD_DOSE` などの区切り) | `data/build/build_*.py` | `docs/physics.md` |

### 2.15 値 (つり合いの数) を変える

- 値は名前が大文字の表 (`MARKET`・`STRUCTURE`・`DEMO`・`TRADE`・`WARSCORE` など。一覧は `node tools/content.js` ではなく `docs/src-files.md` の 5 と、各ファイルの頭の説明)。
- 版で違えるときは `EDITIONS`、ゲーム性の補正は補正の台帳 (`docs/game-plan.md` の 4) に。
- 試すときは、ソースを直す前に画面なしの版の値のファイルで: `node tools/headless.js 1 200 6 値.json` (`{ "表の名前": { "項目": 値 } }` を重ねて書く。`tools/headless.js` の頭の説明)。合わせる目標 (`targets/targets.json`) を外れていないかは CI の表で見る。

## 3. 足したあとに回すもの

1. `node tools/content.js --check` (点検)
2. 関係する試験 (`node tools/ci-tests.js 名前`。全部は `node tools/ci-tests.js`)
3. PR を出すと CI が自動対戦 (main との比べ) と面白さの代わりの数を回す (`docs/parallel.md` の 4)

## 4. 処理を速く保つ決まり

2026-10-26 に、試合を進める処理を、試合の筋を 1 ビットも変えずに速くした (数は `docs/perf.md`)。そのときに分かった、遅くしないための決まり:

- **試合 (Game) の物に、途中で新しい値を書き込まない。** 書き込むなら `GAME_LATE_FIELDS` (core/game-consts.js) に名前を足す (constructor の始めに undefined で置かれる)。途中で物の形が変わると、`this.…` の読み出しとメソッドの呼び出しが遅い道 (megamorphic) に落ちて戻らず、全体が 2 割ほど遅くなった。`tools/tests/shape.js` が足し忘れを見つける。
- **試合の物の値を `delete` しない** (`undefined` を入れる)。消すと物が遅い辞書の形になる。
- **星系の政府は `newGov`、入植地は `newCol` で作る** (core/game-consts.js)。どれも `GOV_FIELDS`・`COL_FIELDS` の並びの同じ形の物になる。政府・入植地に新しい値を足したら、その一覧に名前を足す (`tools/tests/shape.js` が足し忘れを見つける)。値を消すときは `delete` せずに `undefined` を入れる。形がばらばらだと (政府は 5 つの試合で 885 通り、入植地は 12 通り)、`gv.credits`・`c.pop` などの読み出しが遅い道に落ちていた。
- **資源を回す重い所は番号で回す** (`for (let i = 0; i < NRES; i++) st[i]`。掘る資源は `MINED_I`)。資源の名前を変えながら同じ所で引く (`st[r]`) と遅い道になる (名前で引いても答えは同じ)。番号で回すときの資源ごとの表は番号の版 (`PRICE_I`・`COVER_I`・`ELASTIC_I`・`RES_KG_I`・`basePriceI`) を使い、新しく資源ごとの表を番号で使うなら同じように作る (元の表から作るので、値は元の表を直す)。決まった資源は `RI.metal` (= `RES_INDEX.metal`) で。
- **セーブの JSON の鍵の並びだけが変わる変更は、試合の筋を変えない** (政府・入植地の形をそろえたとき・収支の表を並びにしたときに並びが変わった)。前の版と比べるときは `node tools/bench.js --canon` (鍵を並べ替えてから要約を作る)。ただし同じ版の中では、同じ状態からはいつも同じ並びの JSON になるようにする (ネット対戦の状態の要約が合うように。読み込んだ試合で並びが変わらないこと)。
- **毎刻み (0.25 年) の処理で、同じ値を何度も計算しない。** 国 (`realmOf`) や技術・種族の倍率は、続けて使うなら 1 回だけ引く (例: `yieldCtx`)。年の順に並んだ記録から「t 以前でいちばん新しいもの」を探すときは二分探索に (例: `econSeen`)。
- **毎刻みの一覧の掃除は `keepWhere(一覧, 残す条件)`** (core/base.js)。消えるものがなければ配列を作り直さない。
- **純粋な重い計算の答えを覚えておく**ときは、引数をすべて鍵に入れ、写しを返す (例: `shieldOf`)。セーブに入る物には覚えた値を置かない (セーブの中身が変わる)。
- 速くする変更は、`node tools/bench.js` で main と比べ、**節目ごとの状態の要約 (hash) が「同じ」のまま**速くなったかを確かめる。
