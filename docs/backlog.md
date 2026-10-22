# 残りの作業の表 (棚卸し)

`docs/restart.md` の 3 (回 R2) で作った表です。散らばっていた残りの作業を、新しいレーン (`docs/restart.md` の 4 の案を、回 R2 でユーザーが選んだ案 C に直したもの) ごとに 1 つの表にまとめた。済んだもの (`docs/status/*.md` と `git log origin/main` で確かめたもの、#117 のセッション 4、#154) は入れていない。回 R1〜R4 の作業そのものは `docs/restart.md` にあるので入れていない。
「出どころ」の文書は、ことわりがなければ `docs/` の下。依存の「Q1〜Q11」は `critique/04-plan.md` の 6、「D1〜D6」は `sf-critiques.md` の 5、「C の 1〜13」は `status/C.md` の「決めてもらうこと」、「10-1」などは `proposals/` の決まった案。大きさは S = 1 回より小さい、M = 1 回、L = 2〜3 回、XL = 4 回以上。

## 経済

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-001 | 全部門の帳簿 (家計・会社・銀行・中央銀行・政府・ほかの国) を作り、全取引と貸借の表が毎年 0 になる試験にする。国の物価指数とインフレ、政策金利 → 利回りの期間構造、国債の信用の危険と不履行、利子率の手段を中央銀行へ。値段の水準に錨を付ける (船の費用と物価の連動) | `gv.hh`・`gv.fm`・`bankMove`・`interestStep`・`debtStep`・`DEBT`・`PRICE`・`MARKET`・`tools/tests/money.js` | — | L | 経済 | `sessions.md` の 21・`econ-policy.md` の 7 の 3・`econ-policy-list.md` の 4・`status/C.md` の次にやること 2 と C の 6 |
| B-002 | R22 (民間の信用) を合格にする: 会社の設備投資の借りと、家計の住宅の借りを入れる | `gv.fm`・`gv.hh`・`FACILITY`・`bankMove` | B-001 | M | 経済 | `status/C.md` のいまの数・`structure.md` の 7.1・`debt.md` (C-15 の b) |
| B-003 | R28 (財政の反応、0.082) を幅に戻す。国債の上限・手元の資金と、Bohn の式の当て方 (GDP の傾向のならし方・小さな国) を見直す | `DEBT` (`limit`・`cash`・`trend`)・`debtStep`・`funds` | B-001 と同じ回 | M | 経済 | `status/C.md` の次にやること 1・`debt.md` |
| B-004 | R11 (研究の生産性、−2.51) を幅に入れる。研究者の増え方 (研究開発費 ÷ GDP が所得で上がる形。WDI GB.XPD.RSDV.GD.ZS) | `RESEARCH`・`researchStep`・`STRUCTURE` | C の 4 (C-22 で「そのまま」。決め直し) | S | 経済 | `status/C.md` の次にやること 1 と C の 4・`structure.md` の 5 |
| B-005 | R10・R25・R26 の不合格の直し。C-22 で入れないと決めた 3 (部門の間の賃金の差)・5 (倉の上限か、測り方を合計 ÷ 合計に。閉じた #171)・7 (会社の在庫の目標) を、やるなら入れる | `STRUCTURE`・`laborStep`・`MARKET.cover`・`stockCap`・`targets/targets.json` | C の 3・5・7 の決め直し | M | 経済 | `status/C.md` の次にやること 3 と C の 3・5・7・`structure.md` の 6 |
| B-006 | 政策の反応を現実と比べる: 局所射影で現実 (Romer & Romer・Ramey・金融政策のショック) から目標を先に登録し、画面なしの版で政策を無作為に変えて同じ台本で測る。AI の中央銀行はテイラー則。値は積率法か ABC と Sobol で幅を出す | 新しい (`tools/`)・`AI_FISCAL`・`aiFiscal`・`targets/targets.json` | B-001 | L | 経済 | `sessions.md` の 22・`econ-policy.md` の 7 の 4・`econ-policy-list.md` の 4 |
| B-007 | 支出の 10 機能 (COFOG): 教育 → 研究、経済業務 → 建設、保健と社会保護は年齢 (B-010) の年金と医療と合わせる | `BUDGET`・`budgetStep`・`budgetEffect`・`BUDGET_RANGE` | B-001・B-010・C の 8 | M | 経済 | `sessions.md` の 24・`econ-policy-list.md` の 4 (24-1)・`econ-policy.md` の 9 |
| B-008 | 価格統制・配給・公的備蓄・輸出禁止・禁輸を入れる | `MARKET`・`marketStep`・`PRICE`・`tariffFor` | B-001・C の 8 | M | 経済 | `econ-policy-list.md` の 4 (24-2) と 3 の G |
| B-009 | 債務の再編・金融抑圧・量的緩和・インフレ税を入れる | `DEBT`・`debtStep`・`interestStep` | B-001・B-006・C の 8 | M | 経済 | `econ-policy-list.md` の 4 (24-3) と 3 の J |
| B-010 | 年齢つきの人口: 5 歳きざみ × 性別 (1 きざみ 18 年)、WPP の生命表と年齢別出生率、出生率が所得で下がる、年金と医療を政府の支出に、移民の年齢の構成、画面は 3 本の帯と扶養比。年齢の目標を先に固定する (`proposals/targets-draft.md`)。働き手の数を生産に効かせる | `.pop`・`POP_GROWTH`・`popOf`・`migrantsTo`・`laborStep`・`GENERATION_YEARS`・`BUDGET` | 10-1〜10-5 (決まった) | L | 経済 | `sessions.md` の 10・`game-plan.md` の段 6 と 5 (年齢と性別)・`proposals/10-age.md`・`status/Q.md`・`econ-policy.md` の 9 |
| B-011 | 会社の設備投資の上に、国有化・民営化・土地改革・資本規制を入れる (選べば) | `gv.fm`・`FACILITY`・新しい | B-002・C の 8 | L | 経済 | `econ-policy-list.md` の 4 (24-4) と 3 の H・E |
| B-012 | 通す手間: 政策ごとの帰着の表 (家計・会社・政府・ほかの国の損得)、損の大きさに比べて忠誠と議会が下がる式、政策ごとの行政の遅れ | `burdenK`・`TAX_LOYALTY`・`POLICY_YEARS`・`POLICY_COST`・`setFiscal`・`.since` | B-001・C の 10 | M | 経済 | `econ-policy-list.md` の 5・`status/C.md` の C の 10 |
| B-013 | セッション 19・20 で取れなかった政策の生データ (OECD の税率・IMF の iMaPP・Global Trade Alert・Reinhart–Rogoff の危機の表) を取り、書き写した値 (※) と照らす | `data/fetch/`・`data/raw/policy/`・`data/build/build_policy.py` | — | S | 経済 | `econ-policy-list.md` の冒頭 |
| B-014 | 物理 (P6) で交易路の輸送量が半分になった理由を確かめる (蓄えで `routeRoom` が絞られた見込み)。R01 は物理ありの版で測り直す | `routeRoom`・`TRADE`・`E_UNIT`・`shieldOf` | — | S | 経済 | `status/C.md` の気をつけること・`physics.md` の 11 |
| B-015 | 利子率の既定 (年 1%) を、Schmelzing の現代の値 (約 2%) にするか決めて直す。R01 の較正とまとめて | `FISCAL_DEFAULT`・`TRADE.rate`・`RATE_RANGE` | B-014 | S | 経済 | `status/C.md` のまだ決めていない仮の値 |
| B-016 | 交易の注文の先払いが大きい件を調べる | `TRADE`・`prepaid` | — | S | 経済 | `status/C.md` の気をつけること |
| B-017 | 小さな政府の軍の維持費: 駐留先の星系でなく、国の政府が払う形にするか | `WARSHIP_UPKEEP`・`TROOP_UPKEEP`・`funds` | 政治と相談 | S | 経済 | `status/C.md` の気をつけること |
| B-018 | 仮の値を生データで決め直す: 税の段階と予算の効き目、研究の g0、自給の値打ち、食料の弾力性の所得の傾き、人の移る速さ | `BUDGET`・`TAX_LOYALTY`・`RESEARCH.g0`・`STRUCTURE`・`laborStep` | — | M | 経済 | `status/C.md` のまだ決めていない仮の値・`fiscal.md` の 5 |
| B-019 | 飢餓と不足の知らせが 1 試合で約 110 件・80 件ある理由を調べる (経済の壊れか、表示の段の問題か)。経済が大きく変わったので、いまの main で測り直してから | `MARKET`・`marketStep`・`EVENT_TIER` | — | S | 経済 | `critique/04-plan.md` の 0-7 と 2.3 の 7 |

## 政治

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-020 | 星系の中の集団: 階層 5 × 民族 (種族と、本国生まれ / 入植地生まれ) × 価値観 2 軸。集団ごとの忠誠度の平均を忠誠度に、政治から締め出された集団の割合をハザードに (EPR)、R08 を較正し直す。不満の大きい 1〜2 集団を 1 行で出す | `loyaltyYearly`・`unrestYearly`・`HAZARD`・`hazardOf`・`races`・`regimeBox` | 11-1〜11-4 (決まった)・B-010 のあと | L | 政治 | `sessions.md` の 11・`game-plan.md` の段 7・`proposals/11-groups.md`・`status/Q.md`・`econ-policy.md` の 9 |
| B-021 | 現地のエリート (いまは 1 つの行為者) を、集団に合わせる | `elite`・`ELITE_LABEL`・`bundleStep` | B-020 | S | 政治 | `status/H.md` の残り・`vassal-game.md` の 9・`vassal-history.md` の 8 |
| B-022 | 政策を利益集団の支持で通す形 (Victoria 3 の形) | `POLICY_COST`・`councilYearly`・`politicsYearly` | B-012・B-020・C の 10 | M | 政治 | `econ-policy-list.md` の 5 と 7 の 3・`econ-policy.md` の 9 |
| B-023 | 共同統治の 2 国目の宗主どうしの外交 (分け前を断ったときの関係の悪化) | `lord2`・`H33`・`BARGAIN` | — | S | 政治 | `status/H.md` の残り・`vassal-game.md` の 9 |
| B-024 | 傀儡国が、宗主の敗戦で消える道筋を入れる | `REGIMES`・`warsYearly`・`TREATY` | — | S | 政治 | `status/H.md` の残り |
| B-025 | 史料の原文確認: 裁定者が自分の知識で決めた 3 か所と、本文に当たれなかった条約 (Aitchison・理藩院則例・実録・COFA の条番号・中世の文書) | `data/raw/vassal/`・`data/build/build_vassal_game.py` → `VASSAL_DATA` | — | S | 政治 | `status/H.md` の注意・`vassal-game.md` の 7・`vassal-cases.md` の 2 |
| B-026 | 遅れて届く外交: 同盟・不可侵・交易の協定を足し、どれも届いた所から効く。交渉の模型の「相手が受け入れる線」を「何なら受けるか」の形で見せる | `TREATY`・`BARGAIN`・`PC_DIPLOMACY`・`openTreaty`・`renderTreaty` | Q2 | L | 政治 | `critique/04-plan.md` の 2-2・2.3 の 16・3 の 5 |
| B-028 | AI の国が入植を急ぎ、銀河を取り合う。構造転換 (#152) のあとで入植が増えたので、先に測り直す | `aiOrdersYearly`・`colonize` | Q2・B-068 | M | 政治 | `critique/04-plan.md` の 2-1・2.3 の 9・2.1 の注意 |
| B-029 | 国ごとに規則が違う開始: 種族の特性を倍率から規則の違いへ。開始の人口と星系も国ごとに | `SPECIES_TRAITS`・`HUMAN_TRAITS`・`NATION_COUNTS`・`NationLib` | Q2 | M | 政治 | `critique/04-plan.md` の 2-4・2.3 の 15 |

## 船と戦争

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-033 | 船の設計と入植集団: 速さ・乗る人数・積み荷を選べる、3 つのひな形、標準 500 人 (98〜44,000)、続く確率を幅つきで、質量から決めて記帳、遮蔽は P6 の形を使う、移民の年齢の構成を選べる。R17 を先に固定する | `SETTLERS`・`SHIP_COST`・`shipCost`・`bookShip`・`shieldOf`・`withAccel` | 12-1〜12-4 (決まった)・B-010 | L | 船と戦争 | `sessions.md` の 12・`game-plan.md` の段 9 と 5 (入植船の乗員)・`proposals/12-ship.md`・`proposals/10-age.md` の 10-4・`reality-check.md` の 1 |
| B-034 | 艦隊戦: 二乗則と一乗則の間 (指数 0.5)・偶然を半分・自動で解決、勝つ見込みと損害の内訳を報告書で出す、戦死者と攻囲の住民を数える (R15)、R16 は補正として台帳に 2 行 | `BATTLE_RATE`・`battlesStep`・`fleetEff`・`fleetMul`・`siegesYearly`・`WARSCORE` | 13-1〜13-5 (決まった)・B-033 | L | 船と戦争 | `sessions.md` の 13・`game-plan.md` の段 9 と 5 (R15・R16)・`proposals/13-battle.md`・`critique/04-plan.md` の 2-7・`reality-check.md` の 4 の 5 |
| B-035 | 光速に近い艦隊を武器にする (止められない一撃で星系を焼く。悪名と報復で釣り合わせる) | `battlesStep`・`orderFleets`・新しい | D1・B-034 | M | 船と戦争 | `sf-critiques.md` の 5 の D1 |
| B-036 | ゲーム版の太陽電池の劣化: b (素子は自動) か c (星系ごとに選ぶ) を測って決め、入れる | `SWARM`・`PV_DAMAGE`・`PV_DESIGNS`・`EDITIONS` (`game.physics.pv`)・`this.physics` | P10・B-001 (経済が落ち着く) | M | 船と戦争 | `physics.md` の 10 の P10・`status/P.md` の次にやること 2・`sessions.md` の 14・`game-plan.md` の 4 の C09 |
| B-027 | 相手が見ている自分: AI の国が見積もっている地球の艦隊 (古い記録と読み違い) を見せ、見せたい艦隊を動かす読み合いを作る | `intel`・`known`・`militarySheet` | Q2 | M | 船と戦争 | `critique/04-plan.md` の 2-3 |
| B-030 | 光より速く分かる情報 (戦争の点数・講和の申し出・船の一覧・集結の命令) を、光の遅れに通す | `WARSCORE`・`known`・`shipsHtml`・`warHtml`・`orderFleets` | D3 | L | 船と戦争 | `sf-critiques.md` の 4 と 5 の D3 |
| B-031 | 戦争の多さ (R29) を今の main (C-22 と P6 のあと) で 30 以上の銀河で測り直す。R14 (確認用。条約 7 割) を直すか決める | `BARGAIN.declareChance`・`warsYearly`・`tools/wars-headless.js` | — | S | 船と戦争 | `status/A.md` の次にやること 1・`game-plan.md` の 5 (R14) |
| B-032 | 試遊で「AI が弱い・強い」と言われたら、難易度の値を見直す | `HANDICAP` | B-063 | S | 船と戦争 | `status/A.md` の次にやること 3・`game-plan.md` の 4 の C11 |

## 画面と最初の体験

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-039 | 画面の点検: 「AI っぽい」所・タブの見え方・アイコンのない項目を、撮った画面つきで一覧にし、直す所を選んでもらう (コードは変えない) | `EMPIRE_TABS`・`ICONS`・`homeHtml` | — | M | 画面と最初の体験 | `sessions.md` の U1・`status/U.md` |
| B-040 | タブの表示と「AI っぽさ」の直しを、画面 1 つずつ小さな PR で。地図の札の重なりもここで | `EMPIRE_TABS`・`empireHtml`・`GalaxyView` | B-039 | L | 画面と最初の体験 | `sessions.md` の U2・`critique/04-plan.md` の 2.3 の 8 |
| B-041 | アイコンのない項目にアイコンをつける (候補を並べて番号で選んでもらう) | `ICONS`・`iconImg`・`KIND_ICON` | B-039 | M | 画面と最初の体験 | `sessions.md` の U3 |
| B-042 | 止まった状態で始める。最初の判断 (入植船を 1 隻送る) が済むまで時間を進めない | `setSpeed`・`SPEEDS`・`newGame` | Q2 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-1・2.3 の 2・3 |
| B-043 | 時代の課題を「作戦の手引き」にして、手を 1 つずつ導く (別のチュートリアルの画面は作らない) | `CHALLENGES`・`challengesYearly`・`goalsSheet`・`erasYearly` | Q2・Q3 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-2・2.3 の 1 |
| B-044 | 候補地の並びを「おすすめ順」にし、同じ太陽系の天体は「課題に数えない」の印を付けて下げる | `candidatesHtml` | Q2 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-3・2.3 の 4 |
| B-045 | ホーム画面を「はじめる」1 つにし、生産性の倍率・銀河の番号・難易度を「詳しい設定」に畳む。表紙の絵を置く | `homeHtml`・`renderHome`・`openHome` | Q2 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-4・2.3 の 19 |
| B-046 | 節目の演出: 入植・交易路の開通・独立・講和で、地図に光の輪を広げ、短い音を鳴らす | `GalaxyView`・`news` | Q2・B-047 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-5・2.3 の 5 |
| B-047 | 音: 環境音の曲 2〜3 と効果音 10 (送信・到着・警告・決めること) | 新しい | Q6 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-6・2.3 の 18 |
| B-048 | 知らせの予算: 重大な知らせは 1 時間に決めた数まで、飢餓と不足は地図の「!」の状態にまとめ、同じ星系・同じ種類の続報を束ねる | `EVENT_TIER`・`news`・`alertHtml`・`EvPrefs`・`evShown` | B-019 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-7・2.3 の 7 |
| B-049 | 語り手の出来事の選択肢に、どちらにも代わりの損と得を付ける (明らかな最善をなくす) | `STORY`・`storyYearly` | — | S | 画面と最初の体験 | `critique/04-plan.md` の 0-9・2.3 の 13 |
| B-050 | 語り手を連作にする (3 段の続き物、続きは光の遅れで届く。種類を 7 から 20 以上へ) | `STORY`・`storyYearly` | B-049 | L | 画面と最初の体験 | `critique/04-plan.md` の 2-5・2.3 の 14 |
| B-051 | 文字の大きさ: 1280×800 で最小 12px。文字のぶれの既定を「切」に | `FX_JIT`・`updateFxBtn`・`fxReduced` | Q9 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-10・2.3 の 20・`desktop/controller.md` の 3 |
| B-052 | 光の球を見せる: 指令・知らせ・艦隊の出発の光が星図の上を球で広がり、「届くまで あと 12 年」が縁で見える | `GalaxyView`・`known` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-1・2.3 の 6 |
| B-053 | 「見えている過去」と「ありうる今」を重ねる: 艦隊を最後に見えた位置に置き、今いるかもしれない範囲を淡い雲で描く | `GalaxyView`・`fleetOf`・`intel` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-2 |
| B-054 | 時代の終わりの答え合わせ: 100 年ごとに、地球が見ていた歴史と本当の歴史を並べて早回しで見せる | `erasYearly`・`ERA_YEARS`・新しい | Q2 | L | 画面と最初の体験 | `critique/04-plan.md` の 1-3 |
| B-055 | 相対論の奇襲の警告: 0.9c の艦隊の出発が見えたら「到着まで あと 2.1 年」の秒読みを、決めることとして出す | `isSurpriseTarget` の近く・`decisionsYearly`・新しい | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-4 |
| B-056 | 送った瞬間に予想、届いたときにずれ: 指令を送るときに届く年と見込みを出し、届いたら「予想 → 実際」を 1 行で | `orderFleets`・`dispatchBox`・`news` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-5・`design-pillars.md` |
| B-057 | 委任の報告書: 委任した星系が 10 年ごとに「何をしたか・なぜ」を報告する (光の遅れで届く) | `MANDATES`・`GOVERNOR`・`govsYearly`・新しい | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-6・3 の 1 |
| B-058 | 終わり方を物語にする: 結末の型 (帝国の維持・連邦への移行・均衡・地球の衰え) と、その原因の内訳を出す。勝負が決まったことを告げる | `endYearly`・`showEnd`・`score`・`END_CHOICES` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 2-6・3 の 8 |
| B-059 | 経済のグラフ: 画面ごとに「何を判断するか」を先に決め、生産・物価・失業、金利と利回りの曲線、政府の収支と債務、部門ごとの貸借、交易の流れ、政策を変えた時点の印を、首都に届いた記録から描く | `fiscalHtml`・`treasuryHtml`・`ledgerHtml`・`councilChart`・`known` | B-001・B-006 | L | 画面と最初の体験 | `sessions.md` の 23・`econ-policy.md` の 7 の 5・`econ-policy-list.md` の 6 |
| B-060 | 同意つきのプレイ記録の画面: 同意の画面・記録の中身・消し方 (文は作る前に見せて決めてもらう) | `PlayLog`・`playLogHtml`・`exportPlayLog`・`PLAYLOG_KEY` | — | M | 画面と最初の体験 | `sessions.md` の 5・`game-plan.md` の段 11・`status/common.md` の 12 の 6・`econ-policy.md` の 7 の 7 |
| B-061 | ゲームの中でゲームパッドに対応: スティックで地図、十字キーでボタンを順に選ぶ枠、範囲選択の代わり (星系の艦隊を全部選ぶ・タッチの範囲選択)、ホバーの説明を選んだときに出す | `GalaxyView`・新しい (Gamepad API) | — | L | 画面と最初の体験 | `desktop/controller.md` の 2 の案 B・`status/S.md` |
| B-062 | 試遊の本番: 見知らぬ人の募集 (Steam Playtest)・課題なしで遊ぶ・SUS、F01〜F05・F07 を測る。結果から直す場所の順番を表にする | `PlayLog`・`tools/` | B-060・B-065・B-084・Q8 | L | 画面と最初の体験 | `sessions.md` の 16・`game-plan.md` の段 11・`critique/04-plan.md` の 4-3・`store/steamworks.md` の 2 |
| B-063 | 段ごとの 5 人の小さな試遊 (本番を待たない)。新しい仕組みは 30 分の版で「どの判断が増えたか」を先に見せる | `PlayLog` | B-060 | M | 画面と最初の体験 | `critique/04-plan.md` の 3-3・3-5 |
| B-064 | ゲーム版の星系の背景を、シミュレーション版と同じ天の川の星図にするか決めて直す | `systemBg`・`SYSTEM_BG_COUNT` | D6 | S | 画面と最初の体験 | `sf-critiques.md` の 5 の D6 |

## 道具と検証

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-065 | プレイ記録から F01〜F05 と、待つだけの時間・判断の数を人の遊びで測る道具 | `PlayLog`・`tools/fun-report.js` | B-060 | S | 道具と検証 | `sessions.md` の 5・`fun.md` の 5 (#117) |
| B-066 | つり合いの本番: 6 つ以上の戦略 × 30 以上の銀河で F06 を判定する。必勝法が見つかったら直し方を台帳に載せて選んでもらう | `tools/strategy.js`・`tools/search.js`・`tools/fun-report.js`・`EDITIONS` | B-067・B-068 | M | 道具と検証 | `sessions.md` の 15・`game-plan.md` の段 12・`fun.md` の 5 |
| B-067 | 探索で変えられる値に、入植・交易・統治体制の選び方を足す | `tools/strategy.js`・`tools/search.js` | — | M | 道具と検証 | `fun.md` の 5 (#117) |
| B-068 | 人間に近い遅れつきのボット (いまのボットは光の遅れなしで判断する) | `tools/strategy.js`・`tools/bots.js`・`earthWarYearly` | — | M | 道具と検証 | `critique/04-plan.md` の 7 の G3・6 の Q5・5 |
| B-069 | 自動対戦で見つかった壊れを直す: 挑戦「60 星系」「遠征」が届かない・拡張の一強・何もしないとお金が山になる。構造転換 (#152) のあとの版で測り直してから | `CHALLENGES`・`challengesYearly`・`colonize`・`score` | Q4・Q5・B-068 | M | 道具と検証 | `critique/04-plan.md` の 0-8・2.3 の 10〜12・2.1 の注意 |
| B-070 | 従属国の型のティアリスト: 自動対戦で「全部を直轄にするのが最善」や「維持費のかからない家臣の量産」にならず、どの型もどこかの距離で最善になるかを確かめる | `tools/vassal-export.js` (`--force`)・`REGIMES`・`tools/strategy.js` | B-067 | M | 道具と検証 | `critique/04-plan.md` の 3-6・3 の 4 |
| B-071 | 面白さの物差しを F 系の目標にする (最初の入植船まで・2 時間の継続・最初の 20 年の出来事・1 時間の重大な知らせ・戦略ごとの 1 位・挑戦の達成率・出来事の繰り返し・説明の段の数)。CI の表で大きく悪くなる PR を止める線を決める | `targets/targets.json`・`tools/check-targets.js`・`tools/fun-report.js`・`tools/ci-report.js` | Q1 | S | 道具と検証 | `critique/04-plan.md` の 5・3-2・0-7 |
| B-072 | データの書き出し: SNA・GFS/COFOG・部門の貸借・値段・交易 (BACI)・戦争 (COW) の国・星系・年の表、政策の出来事の記録、コードブック、設定 1 つで N 銀河の一括実行と分析の例、ゲームの中の「データを書き出す」ボタン (同意の仕組みを通す)。形は `tools/vassal-export.js` に合わせる | `tools/headless.js`・新しい (`tools/`)・`exportSave` | B-001・B-060 | L | 道具と検証 | `sessions.md` の 25・`econ-policy.md` の 6 と 7 の 7・`vassal-history.md` の 8・`game-plan.md` の 6 (実データと同じ形の書き出し) |

## 外向き

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-073 | 画面の文字列を 1 か所に集めて、訳せる形にする (ほかが止まっている時期に 1 本だけで) | `src/index.html` の全体・新しい (文字列の表) | Q2 | XL | 外向き | `sessions.md` の 18・`game-plan.md` の段 13・`critique/04-plan.md` の 3-4・7 の G6・`restart.md` の 4 |
| B-074 | **済み (回 SO1。`docs/glossary/`)** 固有名詞の一覧と用語集を先に作る (訳の質で叩かれないように) | 新しい (`docs/`) | — | S | 外向き | `critique/04-plan.md` の 3 の 12 |
| B-075 | 英語を入れる | 新しい (文字列の表) | B-073・B-074 | M | 外向き | `sessions.md` の 18・`critique/04-plan.md` の 4-4 |
| B-076 | 簡体中国語を入れる | 新しい (文字列の表) | B-073・B-074・Q11 | M | 外向き | `sessions.md` の 18・`critique/04-plan.md` の 4-4・6 の Q11 |
| B-077 | ストアの文を英語と中国語に | `store/` | B-075・B-076 | S | 外向き | `status/S.md`・`store/steamworks.md` の 10 |
| B-078 | **済み (回 SO1。`store/page-ja.md` の 8)** ストアの下書きを今のゲームと突き合わせる (物理はゲーム版にも入った・第三次産業と研究が入った・従属国の型が入った) | `store/page-ja.md` | — | S | 外向き | `store/README.md`・`store/page-ja.md` の 7 |
| B-079 | **済み (回 SO1。`desktop/shots/shoot.mjs`・`store/images.md` の 2・5)** スクリーンショットを撮るためのセーブと、カプセルの案を作る | `store/images.md`・`desktop/` | S の返事 (大きさ・カプセルの絵) | S | 外向き | `status/S.md`・`store/images.md` の 4 |
| B-080 | 予告編 (30〜60 秒。光の球 → 20 年後に届く → 講和のあとも戦う艦隊 → 答え合わせ) | `store/images.md`・新しい | B-052・B-054 | M | 外向き | `store/images.md` の 3・`critique/04-plan.md` の 4-1 |
| B-081 | ストアのページを公開 (近日公開) し、名前と副題の案を 2〜3 作って反応を比べる | `store/` | Steamworks のアカウント (ユーザー)・B-079・Q7・Q10 | S | 外向き | `critique/04-plan.md` の 4-1・4-8・4-9・`store/steamworks.md` の 9 |
| B-082 | 体験版 = 最初の時代 (2300〜2400 年) を作り、Next Fest に出る。配信者に鍵を配る | `END_CHOICES`・`ERA_YEARS`・`desktop/` | B-054・B-081 | M | 外向き | `critique/04-plan.md` の 4-2・4-5・4-6・`store/steamworks.md` の 3 |
| B-083 | Steamworks の SDK をつなぐ: 実績・Steam Cloud とスロットのセーブ (案 D)・オーバーレイ (`--in-process-gpu`)・画面のキーボード (案 C)・ワークショップ | `desktop/electron`・新しい | Steamworks のアカウント (ユーザー) | L | 外向き | `status/S.md`・`desktop/README.md` の 4・`desktop/controller.md` の 2・`store/steamworks.md` の 8・10・`critique/04-plan.md` の 4-7 |
| B-084 | SteamPipe でビルドを上げて審査に出し、Playtest を開く | `desktop/` | Steamworks のアカウント (ユーザー) | S | 外向き | `store/steamworks.md` の 9 の 7・8 |
| B-085 | Steam Input の既定の設定のファイル (案 A。Action Manifest の VDF) | `desktop/` | — | S | 外向き | `desktop/controller.md` の 2 の案 A・`store/steamworks.md` の 7 |
| B-086 | Windows 版を Windows の上で動かして確かめる (実機か、CI に Windows を足す) | `desktop/`・`.github/workflows/` | — | S | 外向き | `status/S.md` の残り |
| B-087 | Steam Deck の実機で確かめる: F08 の描画の速さ・Game Mode の全画面・`<select>` の出方・Gamepad API・セーブの書き出しと読み込み・小さな文字 | `desktop/bench/run.mjs` | ユーザーの実機 | S | 外向き | `status/S.md` の残り・`desktop/README.md` の 4・`desktop/controller.md` の 3 |
| B-088 | **済み (回 SO1。字体は包装で同梱。Firebase の SDK は同梱しない。`desktop/README.md` の 1-2)** 字体を同梱する (いまは Google Fonts をネットから読む)。Firebase の SDK もネットなしでどうするか決める | `src/index.html` の頭の `<link>`・`FB_SDK`・`desktop/` | — | S | 外向き | `status/S.md` の残り・`desktop/README.md` の 4 |
| B-089 | Firebase の設定を入れて公開する (アカウント・クラウドのセーブ・部屋のコード) | `FIREBASE_CONFIG`・`firestore.rules` | Firebase の設定 (ユーザー) | S | 外向き | `online.md` の 1・`status/common.md` の 4 |
| B-090 | 公開の開発日記 (`docs/` の決めたことを、遊ぶ人向けに言い直す) | 新しい | B-081 | M | 外向き | `critique/04-plan.md` の 5-3 |
| B-091 | 発売後の 30 日に何度も直し、直す順番を公開して約束する | — | 発売 | L | 外向き | `critique/04-plan.md` の 5-1・5-2 |

## 後回し: シミュレーション版 (ゲーム版の公開のあと)

`docs/game-plan.md` の 6 のとおり、ゲーム版の公開のあとにまとめて行う。M 型星のフレア (TESS) はもう入っているので外した。

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-092 | 星間の気体と塵・被曝と遮蔽の質量を、観測の 3 次元の塵の地図から (方向による違い・航路の途中の雲) | `shieldOf`・`SHIELD`・`EDITIONS` (`sim`) | 公開のあと | L | 船と戦争 | `game-plan.md` の 6 (G1)・`physics.md` の 9 |
| B-093 | 磁気帆の減速の時間を、星間の気体の抵抗から出す (帆の大きさの根拠を先に調べる) | `accelExtra`・`EDITIONS` (`sim`) | D5 | M | 船と戦争 | `sf-critiques.md` の 5 の D5 |
| B-094 | スウォームの廃熱と、赤外線での見つかりやすさ | `SWARM`・新しい | 公開のあと | M | 船と戦争 | `game-plan.md` の 4 の C10 と 6 (G5)・`physics.md` の 10 の P8 |
| B-095 | レーザーの回折 (送光口と帆の大きさ、加速の距離) | `sailEff`・`EDITIONS` (`sim`) | 公開のあと | M | 船と戦争 | `game-plan.md` の 6・`physics.md` の 10 の P2 |
| B-096 | 光速近くの交戦の物理と、CDB90 での較正 (R16) | `battlesStep`・`BATTLE_RATE` | B-034 | L | 船と戦争 | `game-plan.md` の 6・`proposals/13-battle.md` の 13-3 |
| B-097 | 銀河面の板を、シミュレーション版だけ厚くするか (±3 光年で 109 系、±4 光年で 142 系) | `THIN_SLAB` | 公開のあと | S | 船と戦争 | `game-plan.md` の 4 の C07 と 6・`status/common.md` の 4 |
| B-098 | R13 (戦争の長さの偏り) を、知らせの遅れが戦争より長い世界でどう比べるか決めて測る | `tools/wars-analyze.js`・`targets/targets.json` | 公開のあと | M | 政治 | `game-plan.md` の 5 と 6・`negotiation.md` の 4 |
| B-099 | R30 (従属関係の存続の比) を、時代の効き (始まりの世紀) を入れて測る | `REGIMES`・`tools/secession.js` | 公開のあと | M | 政治 | `game-plan.md` の 5 と 6・`vassal-decisions.md` の 1・`status/H.md` の残り |
| B-100 | 集団の分布を EPR・WVS から較正する | `HAZARD`・`loyaltyYearly` | B-020 | M | 政治 | `game-plan.md` の 6 |
| B-101 | Alesina–Spolaore・Fearon・選択権者理論を切り替えて比べる | `BARGAIN`・`HAZARD`・新しい | 公開のあと | L | 政治 | `game-plan.md` の 6 |
| B-102 | 年齢の較正を HMD・HFD・WPP で (HMD・HFD は登録が要る) | `.pop`・`data/raw/` | B-010 | M | 経済 | `game-plan.md` の 6・`status/Q.md` |
| B-103 | 産業連関表 (WIOD・EXIOBASE) の投入係数と、5 部門の貸借表の完全な形 | `STRUCTURE`・`SECTORS`・`MARKET_SECTORS` | B-001 | L | 経済 | `game-plan.md` の 6 |
| B-104 | R01 (交易と距離) の直し方 (案 A〜C) と、R02 (RICardo) の取得 | `TRADE`・`routeRoom`・`data/raw/` | B-014 | M | 経済 | `game-plan.md` の 5 と 6 (G2)・`trade.md` の 5・`reality-check.md` の 4 の 7 |
| B-105 | すべての量に単位を持たせ、次元を自動で検査する | 新しい (`tools/`) | 公開のあと | L | 道具と検証 | `game-plan.md` の 6 |
| B-106 | 時間刻みの収束試験 (R18) | `tools/tests/` | 公開のあと | S | 道具と検証 | `game-plan.md` の 6 |
| B-107 | 複数の形の目標の事前登録・ABC-SMC・エミュレータ・Sobol で、結果を分布で出す | `tools/`・`targets/` | B-006 (手法を共有) | L | 道具と検証 | `game-plan.md` の 6 |
| B-108 | 較正に使わないデータと、電信・蒸気船の自然実験で確かめる | `tools/`・`data/` | 公開のあと | L | 道具と検証 | `game-plan.md` の 6 |
| B-109 | 通信の遅れを連続に動かす事前登録の実験と報告書 | `tools/headless.js`・`EDITIONS` | B-072 | M | 道具と検証 | `game-plan.md` の 6 |
| B-110 | 台帳の補正を外したシミュレーション版を組み立て、2 つの版の違いを測り直す。ゲーム版で入れた仕組みの使い方を決める | `EDITIONS` (`sim`)・`tools/build.mjs --sim` | 公開のあと | M | 道具と検証 | `game-plan.md` の 6・`reality-check.md` |
| B-111 | ODD・TRACE の文書 | 新しい (`docs/`) | 公開のあと | M | 外向き | `game-plan.md` の 6・`status/common.md` の 12 の 4 |
| B-112 | ライセンス・`CITATION.cff`・DOI | 新しい | 公開のあと | S | 外向き | `game-plan.md` の 1 と 6 (G6) |

## 数

| レーン | 項目 | S | M | L | XL |
|---|---|---|---|---|---|
| 経済 | 19 | 7 | 8 | 4 | 0 |
| 政治 | 9 | 4 | 3 | 2 | 0 |
| 船と戦争 | 8 | 2 | 3 | 3 | 0 |
| 画面と最初の体験 | 26 | 6 | 14 | 6 | 0 |
| 道具と検証 | 8 | 2 | 5 | 1 | 0 |
| 外向き | 19 | 11 | 5 | 2 | 1 |
| 後回し: シミュレーション版 (ゲーム版の公開のあと) | 21 | 3 | 11 | 7 | 0 |
| 合わせて | 110 | 35 | 49 | 25 | 1 |

2026-10-21 の回 R2 で、ユーザーが組み方の案 C (戦争と講和を「船と物理」へ移して「船と戦争」にする) を選んだ (`docs/requests/2026-10-21-common.md` の common-2)。それに合わせて、政治から B-027・B-030・B-031・B-032 を船と戦争へ移した。B-037 (ゲーム版にも入れない) と B-038 (今のまま) は、決まって仕事がなくなったので外した (下の「閉じるもの」)。

## 重なっていたもの

- **年齢と年金・医療**: セッション 10・段 6・`proposals/10-age.md`・`econ-policy.md` の 9 (D の 10 と COFOG) を B-010 にまとめ、COFOG の残りは B-007 に分けた。
- **集団**: セッション 11・段 7・`proposals/11-groups.md`・H の「現地のエリート」・C の 10 の b (利益集団) は、集団そのもの (B-020)・エリート (B-021)・政策を通す形 (B-022) の 3 つに分けた。
- **艦隊戦**: セッション 13・段 9・`proposals/13-battle.md`・評論家の 2-7 (戦いの報告書)・リアルチェックの 4 の 5 (二乗則) を B-034 に。
- **入植船の乗員と船の遮蔽**: セッション 12・段 9・`game-plan.md` の 5 (乗員 20 万人と遮蔽の質量)・リアルチェックの 1 を B-033 に。遮蔽の質量は P6 で済んだので外した。
- **物理のセッション 14**: P6 で入れたので、残りは P10 (B-036) だけにした。#154 の D1〜D6 は、仕事になるものだけ B-030・B-035・B-037・B-038・B-064・B-093 にした (D3 の情報の遅れは政治に置いた)。
- **プレイ記録**: セッション 5・段 11・`status/common.md` の 12 の 6・`econ-policy.md` の書き出しのボタンは、同意の画面 (B-060、画面) と測る道具 (B-065、道具) に分けた (`restart.md` の 4 の分け方のとおり)。
- **試遊**: セッション 16・評論家の 4-3 (Steam Playtest)・`store/steamworks.md` の 2 を B-062 に。段ごとの小さな試遊 (3-3) と縦切りの確かめ (3-5) は B-063 に。
- **翻訳**: セッション 18・段 13・評論家の 3-4・4-4・G6・ストアの英語と中国語を、集める (B-073)・用語集 (B-074)・英語 (B-075)・中国語 (B-076)・ストアの文 (B-077) に分けた。
- **Steamworks**: S の残り・`desktop/README.md` の 4・`desktop/controller.md` の案 C・D・評論家の 4-7 を B-083 に。
- **書き出し**: セッション 25・`econ-policy.md` の 6・H4-2 の形・`game-plan.md` の 6 の「実データと同じ形の書き出し」を B-072 に。通信の遅れの実験だけ B-109 に残した。
- **飢餓の知らせ**: 評論家の 0-7 を、原因を調べる (B-019、経済) と見せ方 (B-048、画面) に分けた。
- **先住民の数**: sf の D4 と台帳の C08 (シミュレーション版で消すか) を B-038 に。
- **R01 と利子率**: `status/C.md` の 2 か所・`game-plan.md` の 5・`trade.md` を、ゲーム版で確かめる所 (B-014・B-015) と直す所 (B-104、後回し) に分けた。

## 閉じるもの

- **A (戦争)**: セッション 1〜3 と C11 は済み (`status/A.md`)。残りは、R29 の測り直しと R14 の扱い (B-031)・難易度の見直し (B-032) を船と戦争へ移した。B への知らせ (`earthWarYearly` の 25 光年) は #117 の中で直っている。2 国目の宗主どうしの外交 (B-023) も、A の持ち分だったものを政治へ。
- **Q (下準備)**: Q1・Q2 は済み (`status/Q.md`)。決まった案 (`proposals/10〜13`) と目標の幅の案 (`proposals/targets-draft.md`) は、B-010・B-020・B-033・B-034 が使う。取れなかった生データ (HMD・HFD・国連の移民の年齢・openICPSR・ILOSTAT) は B-102 に入れた。R17 の 3 本の論文の数は本文と未照合なので、B-033 で目標を固定する前に照らす。
- **表に入れなかったもの**: 評論家の 3-1 (表に出すのは判断 1〜2 個) と 3-2 (面白さの数を見てからマージ) は決まりなので、回 R4 で `docs/parallel.md` と `docs/sessions.md` に書く (止める線の道具の分だけ B-071)。返事待ち (Q1〜Q11・C の 1〜13・D1〜D6・P10・S の返事・値段) は `docs/decisions.md` に置く。
- **決まって要らなくなったもの (回 R2)**: B-037 (#154 でシミュレーション版にだけ入れた直しをゲーム版にも入れるか) は「入れない」、B-038 (先住民と異星の文明の数) は「今のまま」に決まった (`docs/decisions.md`)。
