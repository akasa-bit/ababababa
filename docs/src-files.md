# src のファイルの地図

ゲームの元のファイル `src/index.html` (約 1 万 2 千行) を、回 R3 (`docs/restart.md` の 5) で、新しいレーンの「触るコードの場所」ごとの 74 のファイルに分けた。**中身は 1 行も変えていない**: 分けたファイルを `src/index.html` の `//#include` の順につなぐと、分ける前のファイルと 1 バイトずつ同じになる (`node tools/src.js`)。どのレーンがどこを持つかの決まりは `docs/parallel.md`。

## 1. 仕組み

- `src/index.html` は骨組みだけ (86 行)。`//#include <パス>` だけの行を、そのファイルの中身に置き換えて 1 枚にする (`tools/src.js`。1 段だけ。中のファイルに `//#include` は書けない)。
- 1 枚にしたものを使うのは、組み立て (`node tools/build.mjs`)・画面なしの版 (`tools/headless.js`)・CI の main との比べ (`node tools/src.js --ref origin/main`)。ふだんは意識しなくてよい。
- `Game` のメソッドは、class の本体の途中で切ってあるので、`src/economy/fiscal.js` のようなファイルは、それだけでは JavaScript として読めない (つないだときだけ読める)。メソッドを足すときは、自分のファイルの中の、メソッドの区切りに足す。
- **新しいファイル**は、自分のレーンのフォルダの中だけに作り、`src/index.html` の `//#include` の行を、そのフォルダの行のまとまりの中の正しい位置に足す (class の本体の中のメソッドなら、class のファイルの間)。`node tools/src.js --check` (CI の `src` の行) が、組み込み忘れと 2 回の組み込みを見つける。
- **ファイルの間でメソッドを動かす**ときは、中身を変えずに切り取って貼るだけにし、1 本の PR にする (ほかの変更と混ぜない)。
- データの道具が書き換える区切り (`/* XXX:BEGIN … XXX:END */`) は、分けたあとのファイルにある: STARS は `core/galaxy.js`、ISM・PV_DAMAGE・FLARES・SHIELD は `ship/physics.js`、VASSAL は `politics/pc-vassal.js` (`data/build/build_*.py` は、そのファイルを書き換える)。

## 2. セーブの項目 (saveField)

セーブの行 (`buildSave`) は、いちばん衝突した所だった (`docs/conflicts.md`)。回 R3 で、仕組みごとに項目を登録する形にした。

- 新しい項目は、その仕組みのファイル (トップレベルの所) で `saveField(名前, (game) => 値, { init, read })` を呼んで足す。`init(game)` は試合を作った終わり、`read(game, d)` は読み込み (`restore`) の終わりに呼ばれる。前の版のセーブ (項目がない) を読んだときの既定は `read` の中で決める。
- それまでの項目は `core/save.js` の `SAVE_LEGACY` に、前と同じ順で並べてある。並びの順がセーブの JSON と状態の要約 (`hash`) の並びなので、**この一覧は足さない・並べ替えない・消さない**。
- 項目の名前は、使う前に `docs/registry.md` の 4 に書く。
- 試験: `tools/tests/save.js` (分ける前のゲームのセーブを読んで同じ筋で続くこと・登録した項目の初期値と既定)。

## 3. 組み立てた index.html はリポジトリに入れない (回 R3 で決めた)

- **決めたこと**: ゲーム版の `index.html` は、リポジトリに入れず (`.gitignore`)、公開 (`.github/workflows/pages.yml`) のときに `node tools/build.mjs` で組み立てる。
- **理由**: 衝突した 20 回の取り込みのうち 16 回に組み立てた `index.html` があり、7 回はそれだけがぶつかった (`docs/conflicts.md` の 2)。直し方はいつも「組み立て直す」だけで、考える所がない。公開は GitHub Actions でしているので、公開の手順に組み立てを 1 段足せばよい (Node と `tools/` の `npm ci`、圧縮の python3 は GitHub の機械に入っている)。
- 変わること: `src/` を直したあとに組み立てた `index.html` をコミットしなくてよい (しても `.gitignore` で入らない)。手元で試験や画面を見るときは、前と同じく `node tools/build.mjs` で作る (`node tools/ci-tests.js` は最初に組み立てる)。`desktop/` の包装も、先に組み立てる (前と同じ)。
- シミュレーション版の `simulation.html` は凍結中なので、いまのままリポジトリに入れておく (組み立て直すのはレーン「船と戦争」が `--sim` を付けたときだけ)。

## 4. 確かめたこと (回 R3)

- `node tools/src.js` で組み立てたものが、分ける前の `src/index.html` (`3a5b5d9`) と 1 バイトずつ同じ (セーブの行を分ける前)。組み立てた `index.html` も同じだった。
- セーブの行を分けたあと: `docs/restart-baseline.md` の 1 の 8 つの状態の要約 (`hash`) がすべて一致。3 つの銀河 × 観戦と 6 か国 × 4 つの時点で、前と後のセーブの要約が 24 点すべて一致。
- `node tools/ci-tests.js`: すべて合格 (`det`・`headless`・画面の試験・新しい `src`・`save` を含む)。

## 5. ファイルの一覧

持ち主は、フォルダで決まる (`core` = 共通、`economy` = 経済、`politics` = 政治、`ship` = 船と戦争、`screen` = 画面と最初の体験、`outward` = 外向き)。`Game:` は `Game` の class のメソッドの一部。行の数は回 R3 のとき。

| ファイル | 持ち主 | 行 | 中身 |
|---|---|---|---|
| `screen/page.html` | 画面と最初の体験 | 532 | CSS (配色・額縁・書体) と、画面の骨組みの HTML |
| `core/base.js` | 共通 (世話役: 道具と検証) | 167 | 版 (EDITION・EDITIONS)・決まった計算 (DMath)・乱数 (Rng)・セーブの項目の登録 (saveField) |
| `core/galaxy.js` | 共通 (世話役: 道具と検証) | 478 | 恒星・惑星・実在の星の表 (STARS の区切り)・銀河の作り方 |
| `core/world.js` | 共通 (世話役: 道具と検証) | 123 | 資源・値段 (PRICE)・先住民の作り方・船の速さ・お金の動き (bankMove)・忠誠の式 (loyaltyTermsOf) |
| `ship/physics.js` | 船と戦争 | 239 | エネルギーと推進・星間の気体と遮蔽 (ISM・SHIELD・PV_DAMAGE・FLARES の区切り)・加速の時間・交易の費用の定数 |
| `core/labels.js` | 共通 (世話役: 道具と検証) | 7 | 種類の名前・FOCUS |
| `screen/icons.js` | 画面と最初の体験 | 79 | アイコン (ICONS) |
| `core/facilities.js` | 共通 (世話役: 道具と検証) | 18 | 施設・奴隷・歩兵の定数 |
| `politics/nations.js` | 政治 | 56 | 国と種族 (特性・生産性) |
| `ship/war-consts.js` | 船と戦争 | 30 | 難易度・戦争疲弊・戦勝点・条約・交渉 (BARGAIN)・講和 (PEACE) |
| `ship/colonists.js` | 船と戦争 | 133 | 入植集団が続くかのモンテカルロ (HERITAGE・COLONY_RISK・COLONY_FAIL)・入植船の設計の値とひな形 (SHIP_DESIGN・SHIP_TEMPLATES)・セーブの項目 designs。回 FU3 で足した (`docs/colony.md`) |
| `politics/names.js` | 政治 | 27 | 国の名前・母星の選び方・国の数 |
| `core/game-consts.js` | 共通 (世話役: 道具と検証) | 40 | 船と施設の費用・入植・海賊の始まり・帳簿の名前・忠誠と友好の定数・色・指令の名前 |
| `economy/market-consts.js` | 経済 | 72 | 市場 (MARKET)・産業構造 (STRUCTURE)・研究 (RESEARCH)・部門 |
| `core/snap.js` | 共通 (世話役: 道具と検証) | 12 | 星系の記録の JSON |
| `politics/pc-vassal.js` | 政治 | 104 | 政治力・直轄・委任・総督・従属国の型 (VASSAL の区切り)・統治体制 (REGIMES)・離反の式 (HAZARD)・国家方針 |
| `economy/fiscal-consts.js` | 経済 | 75 | 税・政策金利・予算・関税・AI の財政・国債 (DEBT)・中央銀行と物価と利回り (CB。セーブの項目 cb) |
| `politics/policy-consts.js` | 政治 | 29 | 国家方針の費用・不満と要求・放置・議会・時代・終わりの年・挑戦 |
| `politics/story.js` | 政治 | 115 | 語り手の出来事 (STORY) |
| `politics/diplomacy-consts.js` | 政治 | 25 | 遅れて届く外交の協定 (PACT・PACT_KINDS・セーブの項目 diplo。回 SE2) |
| `core/game-base.js` | 共通 (世話役: 道具と検証) | 333 | Game: 作り方 (constructor)・国の割り当て・星系と入植地の引き方・家臣の連なり |
| `ship/war-peace.js` | 船と戦争 | 236 | Game: 戦争の状態・戦争疲弊・戦勝点・講和・講和会議 |
| `politics/loyalty-regime.js` | 政治 | 468 | Game: 忠誠・統治体制・主権の束・共同統治・任免・不満と要求・独立・直轄・政治力 |
| `economy/fiscal.js` | 経済 | 169 | Game: 予算・国債・利子・財政の値 |
| `economy/demography-consts.js` | 経済 | 48 | 年齢つきの人口の率と値 (DEMO。回 KE2) |
| `economy/demography.js` | 経済 | 83 | Game: 年齢つきの人口 (コーホート・率の補間・年金と医療。回 KE2) |
| `economy/central-bank.js` | 経済 | 102 | Game: 中央銀行 (政策金利)・国の物価・長期の利回り・国債の利札と不履行 (回 KE1) |
| `politics/policy-decisions.js` | 政治 | 125 | Game: 国家方針・直轄・決めること・語り手・議会 |
| `screen/eras-score.js` | 画面と最初の体験 | 109 | Game: 時代の課題・挑戦・点数・終わり (手引きにする所。QD-07) |
| `politics/earth-politics.js` | 政治 | 32 | Game: 主人の関与・地球の政治の自動 |
| `ship/war-ai.js` | 船と戦争 | 385 | Game: 宣戦・講和の申し入れ・艦隊の到着・艦隊戦・包囲・海賊の防衛・AI の軍備と交渉・AI の国の年ごとの判断 |
| `ship/strike.js` | 船と戦争 | 95 | Game: 光速に近い艦隊の一撃 (突入・焼く・知らせと報復・AI の一撃)。回 FU2 で足した |
| `ship/fort.js` | 船と戦争 | 35 | Game: 宇宙要塞 (星系ごとの段・自動の Lv1・手動の強化・地球に届いている段)。2026-10-22 の依頼で足した |
| `economy/colonize.js` | 経済 | 271 | Game: 調査と先住民・入植の向き不向き・資材の手配・建設の注文 |
| `ship/settler.js` | 船と戦争 | 100 | Game: 入植船の設計 (designOf・setDesign)・費用と便・入植の打ち上げ・入植団が降りる (settlersLand) |
| `economy/colonies-routes.js` | 経済 | 90 | Game: 入植地を足す・施設の強化・交易路 |
| `economy/trade.js` | 経済 | 191 | Game: 交易網の自動輸送・荷 |
| `ship/fleets.js` | 船と戦争 | 141 | Game: 造船・艦隊の補給・艦隊を出す・進路変更 |
| `economy/development.js` | 経済 | 206 | Game: 前哨・自動の開発・政府の年ごとの処理・入植の目標・奴隷・ステーション |
| `politics/grants.js` | 政治 | 50 | Game: 資金援助・朝貢 |
| `politics/diplomacy.js` | 政治 | 200 | Game: 遅れて届く外交 (協定の申し入れ・受けるか・破約・同盟の参戦。回 SE2) |
| `ship/defense.js` | 船と戦争 | 94 | Game: 海賊・防衛・威圧の艦隊 |
| `economy/migration.js` | 経済 | 71 | Game: 居住区・恒星間移民・集結・方針の一括 |
| `ship/war-troops.js` | 船と戦争 | 350 | Game: 海賊の襲撃・贈り物・統合・征服・奴隷化・解放・先住民との戦争・歩兵 |
| `core/game-loop.js` | 共通 (世話役: 道具と検証) | 233 | Game: 種族・乱数・1 刻み (advance)・幽霊 (光の遅れの古い姿)・船の到着 |
| `economy/earn.js` | 経済 | 49 | Game: 収支の記帳・現金・解放 |
| `ship/energy.js` | 船と戦争 | 112 | Game: スウォーム・素子の作り・発電・エネルギーの記帳 (bookE・bookShip・bookPath) |
| `economy/market-economy.js` | 経済 | 378 | Game: 市場・値段・賃金・研究・労働・経済の 1 刻み (economy) |
| `core/restore.js` | 共通 (世話役: 道具と検証) | 168 | Game: セーブの復元 (restore) |
| `core/knowledge.js` | 共通 (世話役: 道具と検証) | 275 | Game: 光の遅れと記録 (known・snapshot)・AI の知っていること |
| `ship/earth-war.js` | 船と戦争 | 34 | Game: 観戦の地球政府の戦争の判断 (earthWarYearly。tools/strategy.js が写している) |
| `core/commands.js` | 共通 (世話役: 道具と検証) | 277 | Game: 指令 (command・commandRaw・exec)・届く範囲・道のり・船の位置 |
| `screen/labels.js` | 画面と最初の体験 | 61 | 天体の名前と色・星のアイコン |
| `screen/galaxy-view.js` | 画面と最初の体験 | 1025 | 星間マップ (GalaxyView) |
| `screen/system-view.js` | 画面と最初の体験 | 272 | 星系マップ (SystemView) |
| `screen/panels-system.js` | 画面と最初の体験 | 230 | 星系の画面の部品 (星の行・数の書式・研究・費用のボタン・左の帯) |
| `politics/panels.js` | 政治 | 167 | 独立の見通し・忠誠・統治・歴史・統治体制・政府の欄 |
| `screen/panels-body.js` | 画面と最初の体験 | 90 | 自動の切り替え・天体の一覧・備蓄・交易路の欄 |
| `ship/fleet-ui.js` | 船と戦争 | 158 | 星間マップでの艦隊の操作・軍事の欄・補給 |
| `screen/panels-colony.js` | 画面と最初の体験 | 194 | 先住民・天体・前哨・入植地・歩兵・先住民の欄 |
| `ship/ships-ui.js` | 船と戦争 | 60 | 派遣の欄・船の一覧 |
| `economy/empire-ui.js` | 経済 | 50 | 帝国の画面・交易路の表 |
| `politics/politics-ui.js` | 政治 | 86 | 要求の表・政治の表 |
| `economy/migration-ui.js` | 経済 | 44 | 移民の表 |
| `screen/overview.js` | 画面と最初の体験 | 69 | 帝国の概観・種族 |
| `ship/military-ui.js` | 船と戦争 | 71 | 戦争方針・軍事の表 |
| `screen/events-ui.js` | 画面と最初の体験 | 130 | 出来事の一覧・決めることの欄 |
| `economy/fiscal-ui.js` | 経済 | 53 | 議会のグラフ・財政の画面 |
| `screen/goals-ui.js` | 画面と最初の体験 | 66 | 目標の画面 (国家方針・政治力・議会・時代の課題) |
| `screen/candidates.js` | 画面と最初の体験 | 127 | 候補地の画面 |
| `screen/app.js` | 画面と最初の体験 | 128 | 画面の状態 (app)・UI のイベント |
| `core/save.js` | 共通 (世話役: 道具と検証) | 213 | セーブ (Store・buildSave・SAVE_LEGACY・書き出し) |
| `screen/playlog.js` | 画面と最初の体験 | 159 | プレイ記録 (同意の画面はここに) |
| `screen/nationlib.js` | 画面と最初の体験 | 88 | 自作の国 |
| `screen/home.js` | 画面と最初の体験 | 85 | ホーム画面 |
| `screen/nation-pick.js` | 画面と最初の体験 | 199 | 国家選択・国のアレンジ |
| `screen/hotseat.js` | 画面と最初の体験 | 273 | ホットシート |
| `outward/cloud.js` | 外向き | 180 | アカウントとクラウド (Firebase) |
| `outward/net.js` | 外向き | 275 | ネット対戦 (WebRTC) |
| `ship/treaty-ui.js` | 船と戦争 | 32 | 講和会議で条件を選ぶ画面 |
| `screen/commands-ui.js` | 画面と最初の体験 | 200 | 命令の入口 (ボタンから指令へ) |
| `core/main-loop.js` | 共通 (世話役: 道具と検証) | 129 | メインループ |

- ほかのレーンの画面の部品 (`politics/panels.js`・`economy/fiscal-ui.js`・`ship/military-ui.js` など) は、その仕組みのレーンが持つ。画面と最初の体験のレーンは、見た目の決まり (`screen/page.html` の CSS) とタブ・地図・手引きを持ち、ほかのレーンの部品の見た目を変えたいときは、そのレーンと突き合わせる (`docs/parallel.md`)。
- `core/base.js` の `EDITIONS` のうち、`physics` の切り替えと `EDITIONS.sim` は「船と戦争」が持つ (シミュレーション版を一旦無視する決まりは続く)。補正の値 (`EDITIONS.game` の値) を足すときは、`docs/registry.md` の 4 に名前を書く。
