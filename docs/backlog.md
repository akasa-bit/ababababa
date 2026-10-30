# 残りの作業の表 (棚卸し)

`docs/restart.md` の 3 (回 R2) で作った表です。散らばっていた残りの作業を、新しいレーン (`docs/restart.md` の 4 の案を、回 R2 でユーザーが選んだ案 C に直したもの) ごとに 1 つの表にまとめた。済んだもの (`docs/status/*.md` と `git log origin/main` で確かめたもの、#117 のセッション 4、#154) は入れていない。回 R1〜R4 の作業そのものは `docs/restart.md` にあるので入れていない。
「出どころ」の文書は、ことわりがなければ `docs/` の下。依存の「Q1〜Q11」は `critique/04-plan.md` の 6、「D1〜D6」は `sf-critiques.md` の 5、「C の 1〜13」は `status/C.md` の「決めてもらうこと」、「10-1」などは `proposals/` の決まった案。大きさは S = 1 回より小さい、M = 1 回、L = 2〜3 回、XL = 4 回以上。

## 経済

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-001 | **済み (#218。回 KE1)** 全部門の帳簿 (家計・会社・銀行・中央銀行・政府・ほかの国) を作り、全取引と貸借の表が毎年 0 になる試験にする。国の物価指数とインフレ、政策金利 → 利回りの期間構造、国債の信用の危険と不履行、利子率の手段を中央銀行へ。値段の水準に錨を付ける (船の費用と物価の連動) | `gv.hh`・`gv.fm`・`bankMove`・`interestStep`・`debtStep`・`DEBT`・`PRICE`・`MARKET`・`tools/tests/money.js` | — | L | 経済 | `sessions.md` の 21・`econ-policy.md` の 7 の 3・`econ-policy-list.md` の 4・`status/C.md` の次にやること 2 と C の 6 |
| B-002 | **済み (#232。回 KE3。R22 0.347)** R22 (民間の信用) を合格にする: 会社の設備投資の借りと、家計の住宅の借りを入れる | `gv.fm`・`gv.hh`・`FACILITY`・`bankMove` | B-001 | M | 経済 | `status/C.md` のいまの数・`structure.md` の 7.1・`debt.md` (C-15 の b) |
| B-003 | **済み (#218。回 KE1。R28 0.045)** R28 (財政の反応、0.082) を幅に戻す。国債の上限・手元の資金と、Bohn の式の当て方 (GDP の傾向のならし方・小さな国) を見直す | `DEBT` (`limit`・`cash`・`trend`)・`debtStep`・`funds` | B-001 と同じ回 | M | 経済 | `status/C.md` の次にやること 1・`debt.md` |
| B-004 | R11 (研究の生産性、−2.51) を幅に入れる (回 KE6 の研究者の曲線 (B-120) で、前線の国の値が −2.04% と幅の外になった。研究開発の政策 (B-122) を入れても、既定の財政では −2.04% のまま。GPT (B-123) で −2.13%。時とともに研究者の割合が上がる分が入っていない)。研究者の増え方 (研究開発費 ÷ GDP が所得で上がる形。WDI GB.XPD.RSDV.GD.ZS) | `RESEARCH`・`researchStep`・`STRUCTURE` | C の 4 (C-22 で「そのまま」。決め直し) | S | 経済 | `status/C.md` の次にやること 1 と C の 4・`structure.md` の 5 |
| B-005 | R10・R25・R26 の不合格の直し。C-22 で入れないと決めた 3 (部門の間の賃金の差)・5 (倉の上限か、測り方を合計 ÷ 合計に。閉じた #171)・7 (会社の在庫の目標) を、やるなら入れる | `STRUCTURE`・`laborStep`・`MARKET.cover`・`stockCap`・`targets/targets.json` | C の 3・5・7 の決め直し | M | 経済 | `status/C.md` の次にやること 3 と C の 3・5・7・`structure.md` の 6 |
| B-006 | **済み (回 KE7。`docs/money.md` の 6・7)。測ると金利は物価にだけ効き、生産には効かなかった。QD-97 = b の需要のずれの式を入れて R80・R81・R82 合格、R83 (乗数 1.00) は不合格のまま。** 政策の反応を現実と比べる: 局所射影で現実 (Romer & Romer・Ramey・金融政策のショック) から目標を先に登録し、画面なしの版で政策を無作為に変えて同じ台本で測る。AI の中央銀行はテイラー則。値は積率法か ABC と Sobol で幅を出す | 新しい (`tools/`)・`AI_FISCAL`・`aiFiscal`・`targets/targets.json` | B-001 | L | 経済 | `sessions.md` の 22・`econ-policy.md` の 7 の 4・`econ-policy-list.md` の 4 |
| B-007 | **済み (回 KE8。`docs/fiscal.md` の 6)。政府の支出を 10 機能に当てて財政の画面に出した。新しい予算の項目は足していない。** 支出の 10 機能 (COFOG): 教育 → 研究、経済業務 → 建設、保健と社会保護は年齢 (B-010) の年金と医療と合わせる | `BUDGET`・`budgetStep`・`budgetEffect`・`BUDGET_RANGE` | B-001・B-010・C の 8 | M | 経済 | `sessions.md` の 24・`econ-policy-list.md` の 4 (24-1)・`econ-policy.md` の 9 |
| B-008 | 価格統制・配給・公的備蓄・輸出禁止・禁輸を入れる | `MARKET`・`marketStep`・`PRICE`・`tariffFor` | B-001・C の 8 | M | 経済 | `econ-policy-list.md` の 4 (24-2) と 3 の G |
| B-009 | 債務の再編・金融抑圧・量的緩和・インフレ税を入れる | `DEBT`・`debtStep`・`interestStep` | B-001・B-006・C の 8 | M | 経済 | `econ-policy-list.md` の 4 (24-3) と 3 の J |
| B-010 | **済み (#229。回 KE2。R37 合格・R36 不合格)** 年齢つきの人口: 5 歳きざみ × 性別 (1 きざみ 18 年)、WPP の生命表と年齢別出生率、出生率が所得で下がる、年金と医療を政府の支出に、移民の年齢の構成、画面は 3 本の帯と扶養比。年齢の目標を先に固定する (`proposals/targets-draft.md`)。働き手の数を生産に効かせる | `.pop`・`POP_GROWTH`・`popOf`・`migrantsTo`・`laborStep`・`GENERATION_YEARS`・`BUDGET` | 10-1〜10-5 (決まった) | L | 経済 | `sessions.md` の 10・`game-plan.md` の段 6 と 5 (年齢と性別)・`proposals/10-age.md`・`status/Q.md`・`econ-policy.md` の 9 |
| B-011 | 会社の設備投資の上に、国有化・民営化・土地改革・資本規制を入れる (選べば) | `gv.fm`・`FACILITY`・新しい | B-002・C の 8 | L | 経済 | `econ-policy-list.md` の 4 (24-4) と 3 の H・E |
| B-012 | **済み (回 KE8。`docs/fiscal.md` の 7)** 通す手間: 政策ごとの帰着の表 (家計・会社・政府・ほかの国の損得)、損の大きさに比べて忠誠と議会が下がる式、政策ごとの行政の遅れ | `burdenK`・`TAX_LOYALTY`・`POLICY_YEARS`・`POLICY_COST`・`setFiscal`・`.since` | B-001・C の 10 | M | 経済 | `econ-policy-list.md` の 5・`status/C.md` の C の 10 |
| B-013 | セッション 19・20 で取れなかった政策の生データ (OECD の税率・IMF の iMaPP・Global Trade Alert・Reinhart–Rogoff の危機の表) を取り、書き写した値 (※) と照らす | `data/fetch/`・`data/raw/policy/`・`data/build/build_policy.py` | — | S | 経済 | `econ-policy-list.md` の冒頭 |
| B-014 | **済み (#235。回 KE4。R01 −1.006 で合格)** 物理 (P6) で交易路の輸送量が半分になった理由を確かめる (蓄えで `routeRoom` が絞られた見込み)。R01 は物理ありの版で測り直す | `routeRoom`・`TRADE`・`E_UNIT`・`shieldOf` | — | S | 経済 | `status/C.md` の気をつけること・`physics.md` の 11 |
| B-015 | **済み (#236。回 KE4。1% のまま、QD-32)** 利子率の既定 (年 1%) を、Schmelzing の現代の値 (約 2%) にするか決めて直す。R01 の較正とまとめて | `FISCAL_DEFAULT`・`TRADE.rate`・`RATE_RANGE` | B-014 | S | 経済 | `status/C.md` のまだ決めていない仮の値 |
| B-016 | **済み (#234。回 KE4)** 交易の注文の先払いが大きい件を調べる | `TRADE`・`prepaid` | — | S | 経済 | `status/C.md` の気をつけること |
| B-017 | **済み (回 KE7)。駐留する艦隊と兵は約定の束の「軍事」の法で分け、動いている艦隊は持ち主の国の首都が払う (`docs/money.md` の 5.6)。** 調べた (#237。回 KE4)。QD-31 = c に決まった (2026-10-28)。小さな政府の軍の維持費: 従属の型で払い手を分ける (約定の束の「軍事」の法が宗なら主人、分なら半分ずつ、従なら自分。`notices/KE/2026-10-28-SE-upkeep.md`)。経済の次の回で入れる | `WARSHIP_UPKEEP`・`TROOP_UPKEEP`・`funds`・`bundleOf` | — | S | 経済 | `status/C.md` の気をつけること |
| B-018 | 仮の値を生データで決め直す: 税の段階と予算の効き目、研究の g0、自給の値打ち、食料の弾力性の所得の傾き、人の移る速さ | `BUDGET`・`TAX_LOYALTY`・`RESEARCH.g0`・`STRUCTURE`・`laborStep` | — | M | 経済 | `status/C.md` のまだ決めていない仮の値・`fiscal.md` の 5 |
| B-019 | **済み (#233。回 KE4)** 飢餓と不足の知らせが 1 試合で約 110 件・80 件ある理由を調べる (経済の壊れか、表示の段の問題か)。経済が大きく変わったので、いまの main で測り直してから | `MARKET`・`marketStep`・`EVENT_TIER` | — | S | 経済 | `critique/04-plan.md` の 0-7 と 2.3 の 7 |
| B-113 | **済み (#238)** 開拓星系に工業の原料が届くようにする (A): 足りなかった原料と、地元で作れば儲かる工業品の原料を交易の需要に | `market-economy.js` の 2・`trade.js` の `use` | — | S | 経済 | `regions.md` の 2 |
| B-114 | **済み (#239〜#252。回 KE5。R38・R39 合格。賃金の粘りは `docs/wip/KE-wage.patch` に残し、民間の投資のひろげ方は B-119)** 賃金と民間の資本 (B): 資本と労働分配率・賃金率と粘り・投資の行き先と原料の手配・GNI。目標 R38 (国の中の地域の収束)・R39 (労働分配率) を先に固定。R01 の見直し | `market-economy.js`・`trade.js`・`fiscal.js`・新しいファイル | B-113 | L | 経済 | `regions.md` の 3 |
| B-115 | **済み (#243・#244。回 KE5。R61 は不合格)** 工業品を低付加価値物品と高付加価値物品に分ける (ユーザーの依頼 2026-10-24)。高付加価値物品は低付加価値物品と希少元素から、高付加価値の工業の部門 (hi) で作り、需要は所得で分ける (WDI の中・高技術の割合)。目標 R61・R01 の品ごと (目標の版 17) | `RES`・`market-economy.js`・`market-consts.js` の `HITECH`・`STRUCTURE.hitech` | — | M | 経済 | `structure.md` の 9 |
| B-116 | **済み (#245。回 KE5)** 輸送船の生産を経済に入れる (ユーザーの依頼 2026-10-24): 貨物船を高付加価値物品と金属から造り、年数で古くなる。交易路で送れる量 = 走る船の数 × 1 隻の量。運送業の会社が船を持って運賃を受け取る | `SHIPPING`・`routeCap`・`buyShips`・`shipyard`・`trade.js` | B-115 | L | 経済 | `trade.md` の 9 |
| B-117 | **済み (#246〜#248・#251。回 KE5。R64 合格、R62・R63 不合格)** 学歴と生産性 (人的資本) を経済に入れる (ユーザーの依頼 2026-10-24。`docs/requests/2026-10-24-KE.md` の KE-6・KE-7): 入植地ごとの平均の就学年数が働く人の生産性を上げる (PWT の hc の形)。就学年数は所得と教育の支出で決まり、世代が入れ替わる速さで動き、移民が運ぶ。先に目標を固定する (Barro–Lee の就学年数・PWT の hc と所得) | `SCHOOL`・`eduStep`・`schoolK`・`yieldOf`・`BUDGET.education` | B-116 | L | 経済 | `hcap.md` |
| B-118 | **済み (回 KE6。中立の金利を 1 人あたりの潜在の伸びで動かす。景気のずれは速さの則のまま。R34 は 0.0149 で不合格 (始めの 25 年を除けば幅の中)。`docs/money.md` の 5.3.1)** 中央銀行の中立の金利を潜在の伸びで動かす (Laubach & Williams 2003)。景気のずれを伸びの速さの差でなく潜在の産出からのずれで測る。R33・R34 を幅に戻す (回 KE5 で学歴・投資のあと外れた。ユーザーの決定 2026-10-24「残りに書いて後で」) | `CB`・`speedGap`・`cbStep`・`longYield` | — | M | 経済 | `status/KE.md`・`hcap.md` の 3・`regions.md` の 5.2 |
| B-119 | **済み (#266・#268。回 KE6。星系の会社の資本と投資を数える。R79 合格、R78 は 2/5 で不合格。資本を産出に効かせる 2 段目は、2 つの形を試してやめた (ユーザーの決定 2026-10-27「1 段目で止める」。試作は `docs/wip/KE-capital-output.patch`)。`regions.md` の 7)** 民間の投資を採掘のほかにも (工場・建物・機械) ひろげ、その資本の持ち主 (`gv.own`) と一緒に GNI に。投資 ÷ GDP を現実 (約 22%) に近づける。R01・R10・R61 の見直し | `INVEST`・`capacityYearly`・`OWNER`・`FACILITY`・`KSTOCK`・`capitalStep` | B-114 | L | 経済 | `regions.md` の 5.3・6.3・7 |
| B-120 | **済み (回 KE6。R66・R67 合格、R11 は −2.04% で不合格。`docs/innovation.md` の 1)** 技術革新 ①: 研究者の数を所得だけでなく学力で決める (ln f = c0 + b1 ln y + b2 HLO/100。WDI と HCI の当てはめ)。ユーザーの依頼 2026-10-25 (`docs/requests/2026-10-25-KE.md` の KE-1・KE-2)。目標を先に固定する (研究者の所得五分位・学力との偏相関) | `STRUCTURE.research`・`researchers`・`researchStep` | — | M | 経済 | `research/innovation.md` |
| B-121 | **済み (回 KE6。150 年ではほとんど効かず、450 年で遅れた国を引き上げる。R69 合格、R68・R70・R71 は不合格。`docs/innovation.md` の 2)** 技術革新 ②: 国の間の技術の伝播。光速で遅れて見える最前線へ、人的資本 (LAYS) で決まる上限まで、年 κ の速さで追いつく項を足す。目標を先に固定する (技術水準の前線比・規模効果のなさ・TFP の収束・LAYS と伸び・発展会計) | `researchStep`・`tech`・新しい履歴 | B-120 | L | 経済 | `research/innovation.md` |
| B-122 | **済み (回 KE6。`docs/innovation.md` の 3)** 技術革新 ③: 研究開発の政策。研究者を有給にし、予算に公的研究費、財政に税額控除を足す (長期の弾力性 1・公から民への呼び水 0.5・公的研究の遅れ 8〜15 年)。目標を先に固定する (研究開発費 ÷ GDP の所得五分位) | `BUDGET`・`FISCAL`・`researchStep`・貨幣の試験 | B-121 | L | 経済 | `research/innovation.md` |
| B-123 | **済み (回 KE6。`docs/innovation.md` の 4)** 技術革新 ④: 汎用技術 (GPT)。平均 60 年に一度のポアソンの到来、国ごとの S カーブの採用 (遅れは LAYS の梯子)、効果の遅れ、A に畳み込む。周期 (コンドラチェフ) は入れない。目標を先に固定する (前線の 10 年の伸びのばらつき・採用の速さと所得の梯子) | `researchStep`・新しい GPT の状態 | B-121 | L | 経済 | `research/innovation.md` |

## 政治

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-020 | 星系の中の集団: 階層 5 × 民族 (種族と、本国生まれ / 入植地生まれ) × 価値観 2 軸。集団ごとの忠誠度の平均を忠誠度に、政治から締め出された集団の割合をハザードに (EPR)、R08 を較正し直す。不満の大きい 1〜2 集団を 1 行で出す | `loyaltyYearly`・`unrestYearly`・`HAZARD`・`hazardOf`・`races`・`regimeBox` | 11-1〜11-4 (決まった)・B-010 のあと | L | 政治 | `sessions.md` の 11・`game-plan.md` の段 7・`proposals/11-groups.md`・`status/Q.md`・`econ-policy.md` の 9。**済み (回 SE6。#279。`docs/groups.md`)** |
| B-021 | 現地のエリート (いまは 1 つの行為者) を、集団に合わせる | `elite`・`ELITE_LABEL`・`bundleStep` | B-020 | S | 政治 | `status/H.md` の残り・`vassal-game.md` の 9・`vassal-history.md` の 8。**済み (回 SE6。#279。現地のエリート = ここ生まれのいちばん上の分位の集団)** |
| B-022 | **済み (回 SE7。`docs/support.md`。QD-106〜QD-109 = b)** 政策を利益集団の支持で通す形 (Victoria 3 の形) | `POLICY_COST`・`councilYearly`・`politicsYearly` | B-012・B-020・C の 10 | M | 政治 | `econ-policy-list.md` の 5 と 7 の 3・`econ-policy.md` の 9 |
| B-023 | 共同統治の 2 国目の宗主どうしの外交 (分け前を断ったときの関係の悪化) | `lord2`・`H33`・`BARGAIN` | — | S | 政治 | `status/H.md` の残り・`vassal-game.md` の 9。**済み (#185)** |
| B-024 | 傀儡国が、宗主の敗戦で消える道筋を入れる | `REGIMES`・`warsYearly`・`TREATY` | — | S | 政治 | `status/H.md` の残り。**済み (#185)** |
| B-025 | 史料の原文確認: 裁定者が自分の知識で決めた 3 か所と、本文に当たれなかった条約 (Aitchison・理藩院則例・実録・COFA の条番号・中世の文書) | `data/raw/vassal/`・`data/build/build_vassal_game.py` → `VASSAL_DATA` | — | S | 政治 | `status/H.md` の注意・`vassal-game.md` の 7・`vassal-cases.md` の 2 |
| B-026 | 遅れて届く外交: 同盟・不可侵・交易の協定を足し、どれも届いた所から効く。交渉の模型の「相手が受け入れる線」を「何なら受けるか」の形で見せる | `TREATY`・`BARGAIN`・`PC_DIPLOMACY`・`openTreaty`・`renderTreaty` | Q2 | L | 政治 | `critique/04-plan.md` の 2-2・2.3 の 16・3 の 5。**済み (回 SE2)** |
| B-140 | 語り手の選択肢の片寄り: 信仰を認めた続き (断る 100%・巡礼船 0%)・鉱脈の 3 段目 (自治を認める 91%)・総督の汚職の 3 段目 (押し切る 93%)・使節の続き (交易 100%、件数 4)。観戦の AI の重み (`weigh`) か、得と損の釣り合いかを、試遊のプレイ記録 (DO3 の道具) で人の選び方を見てから直す | `politics/story.js` の `STORY` | 試遊 (F20・F21) | S | 政治 | `docs/status/SE.md` の「回 SE4 の測り直し」 |
| B-141 | 「内政」の一強: 放っておかれても忠誠度が下がらなくなった (#228) あと、遠い星系に関与しない内政の戦略が勝つ割合が上がった (24 銀河 × 150 年で 50% → 63%)。内政にも代わりの損を付けるか、ほかの戦略に得を足す | `politics/`・`tools/strategy.js` の測り方 | — | M | 政治 | #228 の面白さの数 |
| B-142 | **済み (QD-41 c の PR。`docs/demands.md`)** AI の国の要求への新しい判断 (QD-41 = c。2026-10-28): 家臣の大きさ・遠さと離反の見込みで、のむか拒むかを決める (いまは観戦の地球と同じく、首都の艦隊が反乱の 2 倍 + 1 以上なら半々で拒んで威圧し、ほかはのむ) | `earthPoliticsYearly`・`knownRebelFleet`・`secessionTermsOf` | — | M | 政治 | `decisions.md` の QD-41・`status/SE.md` の回 SE5 |
| B-028 | AI の国が入植を急ぎ、銀河を取り合う。構造転換 (#152) のあとで入植が増えたので、先に測り直す | `aiOrdersYearly`・`colonize` | Q2・B-068 | M | 政治 | `critique/04-plan.md` の 2-1・2.3 の 9・2.1 の注意。**済み (#274・#275。回 SE5。R40 73.4%・R41 9。AI の国にも席を持たせた)** |
| B-029 | 国ごとに規則が違う開始: 種族の特性を倍率から規則の違いへ。開始の人口と星系も国ごとに | `SPECIES_TRAITS`・`HUMAN_TRAITS`・`NATION_COUNTS`・`NationLib` | Q2 | M | 政治 | `critique/04-plan.md` の 2-4・2.3 の 15 |

## 船と戦争

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-033 | 船の設計と入植集団: 速さ・乗る人数・積み荷を選べる、3 つのひな形、標準 500 人 (98〜44,000)、続く確率を幅つきで、質量から決めて記帳、遮蔽は P6 の形を使う、移民の年齢の構成を選べる。R17 を先に固定する | `SETTLERS`・`SHIP_COST`・`shipCost`・`bookShip`・`shieldOf`・`withAccel` | 12-1〜12-4 (決まった)・B-010 | L | 船と戦争 | `sessions.md` の 12・`game-plan.md` の段 9 と 5 (入植船の乗員)・`proposals/12-ship.md`・`proposals/10-age.md` の 10-4・`reality-check.md` の 1。**済み (回 FU3。#278。`docs/colony.md`)** |
| B-034 | 艦隊戦: 二乗則と一乗則の間 (指数 0.5)・偶然を半分・自動で解決、勝つ見込みと損害の内訳を報告書で出す、戦死者と攻囲の住民を数える (R15)、R16 は補正として台帳に 2 行 | `BATTLE_RATE`・`battlesStep`・`fleetEff`・`fleetMul`・`siegesYearly`・`WARSCORE` | 13-1〜13-5 (決まった)・B-033 | L | 船と戦争 | `sessions.md` の 13・`game-plan.md` の段 9 と 5 (R15・R16)・`proposals/13-battle.md`・`critique/04-plan.md` の 2-7・`reality-check.md` の 4 の 5。**済み (回 FU2)**: HOI4 の海戦を元にした撃ち合い。乗員は仮の 10 万人 (B-033 で差し替え) |
| B-035 | 光速に近い艦隊を武器にする (止められない一撃で星系を焼く。悪名と報復で釣り合わせる) | `battlesStep`・`orderFleets`・新しい | D1・B-034 | M | 船と戦争 | `sf-critiques.md` の 5 の D1。**済み (回 FU2)**: `STRIKE`・`src/ship/strike.js` |
| B-036 | ゲーム版の太陽電池の劣化: b (素子は自動) か c (星系ごとに選ぶ) を測って決め、入れる | `SWARM`・`PV_DAMAGE`・`PV_DESIGNS`・`EDITIONS` (`game.physics.pv`)・`this.physics` | P10・B-001 (経済が落ち着く) | M | 船と戦争 | `physics.md` の 10 の P10・`status/P.md` の次にやること 2・`sessions.md` の 14・`game-plan.md` の 4 の C09 |
| B-027 | 相手が見ている自分: AI の国が見積もっている地球の艦隊 (古い記録と読み違い) を見せ、見せたい艦隊を動かす読み合いを作る | `intel`・`known`・`militarySheet` | Q2 | M | 船と戦争 | `critique/04-plan.md` の 2-3。**済み (回 FU1)**: 軍事の表に「相手が見ている自国の艦隊」(`seenByRival`) |
| B-030 | 光より速く分かる情報 (戦争の点数・講和の申し出・船の一覧・集結の命令) を、光の遅れに通す | `WARSCORE`・`known`・`shipsHtml`・`warHtml`・`orderFleets` | D3 | L | 船と戦争 | `sf-critiques.md` の 4 と 5 の D3。**済み (回 FU1)**: 戦勝点・講和の申し入れ・講和会議・船の一覧・集結。残りは `status/FU.md` |
| B-031 | 戦争の多さ (R29) を今の main (C-22 と P6 のあと) で 30 以上の銀河で測り直す。R14 (確認用。条約 7 割) を直すか決める | `BARGAIN.declareChance`・`warsYearly`・`tools/wars-headless.js` | — | S | 船と戦争 | `status/A.md` の次にやること 1・`game-plan.md` の 5 (R14) |
| B-167 | 光の遅れの残り: 戦争疲弊は損失の知らせが首都に届いてから増える・講和会議の条件は会議を開いた星系に届いた記録で・AI どうしの講和の交渉は申し入れと答えが光速で行き来してから | `exhaust`・`treatyTerms`・`bargain`・`realmsYearly` | B-030 | M | 船と戦争 | 回 FU2 の残り (`status/FU.md`)・`research/game-physics-audit.md` の 2.8 の c・f。**済み (回 FU4)** |
| B-169 | 光より速い残り (船): 防衛の穴を数えるときに敵の艦隊も「向かっている」に入る (2.8 g)・宇宙の途中や入植していない星系から出る艦隊を首都のレーザーが一瞬で押す (2.8 m) | `incoming`・`pushFleet`・`bookShip` | B-167 | S | 船と戦争 | `research/game-physics-audit.md` の 2.8 の g・m。**済み (回 FU3。#278。どちらも直した: 敵の艦隊は防衛の穴に入らない・入植していない所から出る艦隊はいちばん近い自国の星系のレーザーの光が届いてから出る)** |
| B-173 | 交易路の受け手の減速のエネルギー: 受け手 (to) のいまの蓄えを見て出発の時点で払わせている (`routeRoom`・`routeMode`)。受け手の蓄えは光の遅れのぶん古い値で見て、減速の分は着いたときに受け手が払う (足りなければ交易路の外の遅い航行) | `routeRoom`・`routeMode`・`bookShip`・`econSeen` | — | M | 船と戦争 | 経済からの知らせ (回 KE3。`notices/FU/2026-10-24-KE-energy-ftl.md`。回 FU3 でここに移した)・監査の 2.8 の e |
| B-174 | **済み (FU-2。R15 1.35 で幅の中に戻った。QD-47 = a)** R15 (戦争の規模の分布。確認用) の外れ: 回 FU3 のあと、AI の国の光速の一撃がどれも相手の首都 (約 100 億人) に当たり、戦死者の裾のべき指数が 1.35 → 1.24 (32 銀河 × 300 年。幅 1.25〜1.85 をわずかに下回る。12 銀河では首都への一撃の塊を裾と見て 3.95)。一撃の使い方 (QD-47) が決まったら測り直す。確認用なので、合わせるための調整はしない | `aiStrike`・`STRIKE` | QD-47 | S | 船と戦争 | `status/FU.md` の回 FU3 |
| B-175 | 小さな国と家臣の政府が、税収の何十倍もの艦隊と兵を駐留させ、維持費の赤字を国債で埋めて 6 年ごとに不履行を繰り返す (回 KE7 で、不履行のあとの借りられない年 (QD-26) と維持費の払い手 (B-017) を入れたあとも、8 銀河 × 150 年で 2,546 回。艦隊 1 つの維持費 年 5 cr・兵 1 つ 年 2 cr に対して、GDP 年 0.01〜0.3 cr の星系に艦隊 2〜8 か兵 1。生まれたての入植地 (20 万人) の所得が小さいため)。AI の防衛の配備 (`garrison`)・兵の置き方が払える額を見ていない。「不履行のあとで借りられない政府は駐留の艦隊を年に 1 つ解く」は試して、2,546 → 2,391 回と効きが小さいのでやめた (残りは兵の維持費の半分を払う家臣) | `ship/` の防衛の配備・`WARSHIP_UPKEEP`・`funds` | B-017 | M | 船と戦争 | `money.md` の 5.6 (回 KE7) |
| B-170 | **済み (#232。回 KE3。減速のエネルギーの分は船と戦争に頼んだ)** 光より速い残り (経済): 交易と資材の手配・移民が相手のいまの在庫や空きを見る、受け手が出発の時点で減速のエネルギーを払う (2.8 e)・取り消した要求の返金がすぐ (2.8 h)・先住民が接触の前から分かる (2.8 k) | `spareOf`・`procureFrom`・`migrate`・`isSurveyed` | — | M | 経済 | `research/game-physics-audit.md` の 2.8 の e・h・k |
| B-171 | 光より速い残り (政治と画面): 視察団・医療団が光速で届く (2.8 j。人は光より遅い)・星系の画面の惑星の位置がいまの位相 (2.8 l)・政治の表の相手の戦争疲弊がいまの値 | `inspect`・`SystemView`・`politics-ui.js` | — | S | 政治・画面と最初の体験 | `research/game-physics-audit.md` の 2.8 の j・l・回 FU4。**政治の分は済み (#226)。星系の画面の位相は GA へ** |
| B-172 | R14 (戦争の終わり方。確認用) の測り直し: 回 SE5 で AI の国にも席を持たせて国が大きくなり、降伏が減って、いちばん多い終わり方が条約 (36%) になった (現実は勝利 39%。差はどれも 15 点以内)。確認用のまま見るか、構造で直すか | `WAREND`・`TREATY`・`aiTreatyPicks` | — | S | 船と戦争 | `status/SE.md` の回 SE5・`negotiation.md` の 4.5 |
| B-168 | 試合の中で艦隊戦が起きるようにする: 守りのある星系も勝つ見込みが十分なら攻める・攻められた国が艦隊を差し向ける・艦隊をまとめてから攻める。試合の中の艦隊戦で R16 を測る | `realmsYearly`・`aiOrder`・`battleOdds`・`tools/wars-headless.js` | B-034 | M | 船と戦争 | 回 FU2 の残り (`status/FU.md`。4 銀河 × 150 年で入植星系の艦隊戦が 0)。**済み (回 FU5)** |
| B-032 | 試遊で「AI が弱い・強い」と言われたら、難易度の値を見直す | `HANDICAP` | B-063 | S | 船と戦争 | `status/A.md` の次にやること 3・`game-plan.md` の 4 の C11 |

## 画面と最初の体験

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-039 | **済み (#215)** 画面の点検: 「AI っぽい」所・タブの見え方・アイコンのない項目を、撮った画面つきで一覧にし、直す所を選んでもらう (コードは変えない) | `EMPIRE_TABS`・`ICONS`・`homeHtml` | — | M | 画面と最初の体験 | `sessions.md` の U1・`status/U.md` |
| B-040 | **済み (#223)** タブの表示と「AI っぽさ」の直しを、画面 1 つずつ小さな PR で。地図の札の重なりもここで | `EMPIRE_TABS`・`empireHtml`・`GalaxyView` | B-039 | L | 画面と最初の体験 | `sessions.md` の U2・`critique/04-plan.md` の 2.3 の 8 |
| B-041 | **済み (#270〜#273。回 GA8。QD-61・QD-89・QD-90)** アイコンのない項目にアイコンをつける (候補を並べて番号で選んでもらう) | `ICONS`・`iconImg`・`KIND_ICON` | B-039 | M | 画面と最初の体験 | `sessions.md` の U3 |
| B-042 | **済み (#184)** 止まった状態で始める。最初の判断 (入植船を 1 隻送る) が済むまで時間を進めない | `setSpeed`・`SPEEDS`・`newGame` | Q2 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-1・2.3 の 2・3 |
| B-043 | **済み (#188)** 時代の課題を「作戦の手引き」にして、手を 1 つずつ導く (別のチュートリアルの画面は作らない) | `CHALLENGES`・`challengesYearly`・`goalsSheet`・`erasYearly` | Q2・Q3 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-2・2.3 の 1 |
| B-044 | **済み (#186)** 候補地の並びを「おすすめ順」にし、同じ太陽系の天体は「課題に数えない」の印を付けて下げる | `candidatesHtml` | Q2 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-3・2.3 の 4 |
| B-045 | **済み (#181)** ホーム画面を「はじめる」1 つにし、生産性の倍率・銀河の番号・難易度を「詳しい設定」に畳む。表紙の絵を置く | `homeHtml`・`renderHome`・`openHome` | Q2 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-4・2.3 の 19 |
| B-046 | **済み (#192)** 節目の演出: 入植・交易路の開通・独立・講和で、地図に光の輪を広げ、短い音を鳴らす | `GalaxyView`・`news` | Q2・B-047 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-5・2.3 の 5 |
| B-047 | **鳴らす所は済み (#192)。素材は QD-53・QD-54 (買うのはユーザー)** 音: 環境音の曲 2〜3 と効果音 10 (送信・到着・警告・決めること) | 新しい | Q6 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-6・2.3 の 18 |
| B-048 | **済み (#191)** 知らせの予算: 重大な知らせは 1 時間に決めた数まで、飢餓と不足は地図の「!」の状態にまとめ、同じ星系・同じ種類の続報を束ねる | `EVENT_TIER`・`news`・`alertHtml`・`EvPrefs`・`evShown` | B-019 | M | 画面と最初の体験 | `critique/04-plan.md` の 0-7・2.3 の 7 |
| B-049 | 語り手の出来事の選択肢に、どちらにも代わりの損と得を付ける (明らかな最善をなくす) | `STORY`・`storyYearly` | — | S | 画面と最初の体験 | `critique/04-plan.md` の 0-9・2.3 の 13。**済み (#185)** |
| B-050 | 語り手を連作にする (3 段の続き物、続きは光の遅れで届く。種類を 7 から 20 以上へ) | `STORY`・`storyYearly` | B-049 | L | 画面と最初の体験 | `critique/04-plan.md` の 2-5・2.3 の 14。**済み (回 SE3)** |
| B-051 | **済み (#180)** 文字の大きさ: 1280×800 で最小 12px。文字のぶれの既定を「切」に | `FX_JIT`・`updateFxBtn`・`fxReduced` | Q9 | S | 画面と最初の体験 | `critique/04-plan.md` の 0-10・2.3 の 20・`desktop/controller.md` の 3 |
| B-052 | **済み (#198)** 光の球を見せる: 指令・知らせ・艦隊の出発の光が星図の上を球で広がり、「届くまで あと 12 年」が縁で見える | `GalaxyView`・`known` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-1・2.3 の 6 |
| B-053 | **済み (#198)** 「見えている過去」と「ありうる今」を重ねる: 艦隊を最後に見えた位置に置き、今いるかもしれない範囲を淡い雲で描く | `GalaxyView`・`fleetOf`・`intel` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-2 |
| B-054 | **済み (#202)** 時代の終わりの答え合わせ: 100 年ごとに、地球が見ていた歴史と本当の歴史を並べて早回しで見せる | `erasYearly`・`ERA_YEARS`・新しい | Q2 | L | 画面と最初の体験 | `critique/04-plan.md` の 1-3 |
| B-055 | **済み (#199)** 相対論の奇襲の警告: 0.9c の艦隊の出発が見えたら「到着まで あと 2.1 年」の秒読みを、決めることとして出す | `isSurpriseTarget` の近く・`decisionsYearly`・新しい | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-4 |
| B-056 | **済み (#198)** 送った瞬間に予想、届いたときにずれ: 指令を送るときに届く年と見込みを出し、届いたら「予想 → 実際」を 1 行で | `orderFleets`・`dispatchBox`・`news` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-5・`design-pillars.md` |
| B-057 | **済み (#200)** 委任の報告書: 委任した星系が 10 年ごとに「何をしたか・なぜ」を報告する (光の遅れで届く) | `MANDATES`・`GOVERNOR`・`govsYearly`・新しい | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 1-6・3 の 1 |
| B-058 | **済み (#201)** 終わり方を物語にする: 結末の型 (帝国の維持・連邦への移行・均衡・地球の衰え) と、その原因の内訳を出す。勝負が決まったことを告げる | `endYearly`・`showEnd`・`score`・`END_CHOICES` | Q2 | M | 画面と最初の体験 | `critique/04-plan.md` の 2-6・3 の 8 |
| B-059 | 経済のグラフ: 画面ごとに「何を判断するか」を先に決め、生産・物価・失業、金利と利回りの曲線、政府の収支と債務、部門ごとの貸借、交易の流れ、政策を変えた時点の印を、首都に届いた記録から描く | `fiscalHtml`・`treasuryHtml`・`ledgerHtml`・`councilChart`・`known` | B-001・B-006 | L | 画面と最初の体験 | `sessions.md` の 23・`econ-policy.md` の 7 の 5・`econ-policy-list.md` の 6 |
| B-060 | **済み (#206)** 同意つきのプレイ記録の画面: 同意の画面・記録の中身・消し方 (文は作る前に見せて決めてもらう) | `PlayLog`・`playLogHtml`・`exportPlayLog`・`PLAYLOG_KEY` | — | M | 画面と最初の体験 | `sessions.md` の 5・`game-plan.md` の段 11・`status/common.md` の 12 の 6・`econ-policy.md` の 7 の 7 |
| B-061 | ゲームの中でゲームパッドに対応: スティックで地図、十字キーでボタンを順に選ぶ枠、範囲選択の代わり (星系の艦隊を全部選ぶ・タッチの範囲選択)、ホバーの説明を選んだときに出す | `GalaxyView`・新しい (Gamepad API) | — | L | 画面と最初の体験 | `desktop/controller.md` の 2 の案 B・`status/S.md` |
| B-062 | 試遊の本番: 見知らぬ人の募集 (Steam Playtest)・課題なしで遊ぶ・SUS、F01〜F05・F07 を測る。結果から直す場所の順番を表にする | `PlayLog`・`tools/` | B-060・B-065・B-084・Q8 | L | 画面と最初の体験 | `sessions.md` の 16・`game-plan.md` の段 11・`critique/04-plan.md` の 4-3・`store/steamworks.md` の 2 |
| B-063 | 段ごとの 5 人の小さな試遊 (本番を待たない)。新しい仕組みは 30 分の版で「どの判断が増えたか」を先に見せる | `PlayLog` | B-060 | M | 画面と最初の体験 | `critique/04-plan.md` の 3-3・3-5 |
| B-064 | ゲーム版の星系の背景を、シミュレーション版と同じ天の川の星図にするか決めて直す | `systemBg`・`SYSTEM_BG_COUNT` | D6 | S | 画面と最初の体験 | `sf-critiques.md` の 5 の D6 |
| B-194 | **済み (#215)** ホーム画面を作り直す: 最初の画面は全画面で「シングルプレイ」「ロード」「マルチプレイ」「国家制作」「著作権関連」だけ。「シングルプレイ」で全画面の設定 (生産性の倍率・国家選択など) を出し、それを決めて初めて地図を作る (いまの「はじめる → 地図の上で国家選択」をやめる) | `homeHtml`・`nation-pick.js`・`app.js` | — | L | 画面と最初の体験 | `requests/2026-10-23-GA.md` の GA-3。B-045 (#181) の形を変える |
| B-195 | 星間マップを「実在の星 / 自動生成」から選べるようにする (既定は実在の星。自動生成は測った星の密度と惑星の頻度で作る。R04 は実在の星のときだけ判定) | `src/core/galaxy.js` (`GALAXY_GEN`)・設定の画面 | B-194 | L | 画面と最初の体験 (core も。回 W2 で決めた。3 波目の回 GA10) | `requests/2026-10-23-GA.md` の GA-3 |

## 道具と検証

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-065 | **済み (#210)**。プレイ記録から F01〜F05 と、待つだけの時間・判断の数を人の遊びで測る道具 | `PlayLog`・`tools/fun-report.js` | B-060 | S | 道具と検証 | `sessions.md` の 5・`fun.md` の 5 (#117) |
| B-066 | **済み (回 DO5)。必勝法は見つからなかった。F06 は 1 / 30 の銀河で不合格 (`fun.md` の 10)**。つり合いの本番: 6 つ以上の戦略 × 30 以上の銀河で F06 を判定する。必勝法が見つかったら直し方を台帳に載せて選んでもらう | `tools/strategy.js`・`tools/search.js`・`tools/fun-report.js`・`EDITIONS` | B-067・B-068 | M | 道具と検証 | `sessions.md` の 15・`game-plan.md` の段 12・`fun.md` の 5 |
| B-067 | **済み (#187)**。探索で変えられる値に、入植・交易・統治体制の選び方を足す (`fun.md` の 6.3) | `tools/strategy.js`・`tools/search.js` | — | M | 道具と検証 | `fun.md` の 5 (#117) |
| B-068 | **済み (#187)**。人間に近い遅れつきのボット (いまのボットは光の遅れなしで判断する)。拡張の一強は、いまの main では遅れなし・遅れつきのどちらでも出ない (`fun.md` の 6.2) | `tools/strategy.js`・`tools/bots.js`・`earthWarYearly` | — | M | 道具と検証 | `critique/04-plan.md` の 7 の G3・6 の Q5・5 |
| B-069 | **測り直しは済み (#194)。直すのは持ち主 (`fun.md` の 7.2 の表)**。自動対戦で見つかった壊れを直す: 挑戦「60 星系」「遠征」が届かない・拡張の一強・何もしないとお金が山になる。構造転換 (#152) のあとの版で測り直してから | `CHALLENGES`・`challengesYearly`・`colonize`・`score` | Q4・Q5・B-068 | M | 道具と検証 | `critique/04-plan.md` の 0-8・2.3 の 10〜12・2.1 の注意 |
| B-070 | **測りは済み (回 DO4)。直すのは政治 (`fun.md` の 9・`notices/SE/2026-10-23-DO-vassal-tier.md`)**。従属国の型のティアリスト: 自動対戦で「全部を直轄にするのが最善」や「維持費のかからない家臣の量産」にならず、どの型もどこかの距離で最善になるかを確かめる | `tools/vassal-export.js` (`--force`)・`REGIMES`・`tools/strategy.js` | B-067 | M | 道具と検証 | `critique/04-plan.md` の 3-6・3 の 4 |
| B-071 | **済み (#189・#194)**。面白さの物差しを F 系の目標にする (最初の入植船まで・2 時間の継続・最初の 20 年の出来事・1 時間の重大な知らせ・戦略ごとの 1 位・挑戦の達成率・出来事の繰り返し・説明の段の数)。CI の表で大きく悪くなる PR を止める線を決める | `targets/targets.json`・`tools/check-targets.js`・`tools/fun-report.js`・`tools/ci-report.js` | Q1 | S | 道具と検証 | `critique/04-plan.md` の 5・3-2・0-7 |
| B-072 | **済み (回 DO6)。ゲームの中のボタンは画面と最初の体験に頼んだ (`notices/GA/2026-10-23-DO-export-button.md`)。`docs/export.md`**。データの書き出し: SNA・GFS/COFOG・部門の貸借・値段・交易 (BACI)・戦争 (COW) の国・星系・年の表、政策の出来事の記録、コードブック、設定 1 つで N 銀河の一括実行と分析の例、ゲームの中の「データを書き出す」ボタン (同意の仕組みを通す)。形は `tools/vassal-export.js` に合わせる | `tools/headless.js`・新しい (`tools/`)・`exportSave` | B-001・B-060 | L | 道具と検証 | `sessions.md` の 25・`econ-policy.md` の 6 と 7 の 7・`vassal-history.md` の 8・`game-plan.md` の 6 (実データと同じ形の書き出し) |
| B-221 | **済み (回 DO4)**。試験の一覧 (`tools/ci-tests.js` の `TESTS`) を、`tools/tests/` に置いたファイルを自動で拾う形にする (合否の決まりは試験のファイルの側に)。みんなが書き足して衝突したため | `tools/ci-tests.js`・`tools/tests/` | — | S | 道具と検証 | 回 W1 の Q1 (`docs/requests/2026-10-23-common.md`) |
| B-222 | 結末の型の分布を自動対戦で測る (評論家の 2-6)。`g.ending()` (`src/screen/eras-score.js`。状態を読むだけ) が `{ type, label, causes, share, indep, loose }` を返す。回 GA4 の手元の 10 試合 (300 年) では、地球だけは帝国の維持 4、6 か国は均衡 5・衰え 1、連邦への移行は 0 | `tools/fun-targets.js` か新しい道具 | B-058 | S | 道具と検証 | 状態のファイルの前からの知らせ (回 GA4・B-058)。回 DO7 で移した |
| B-223 | 1 時間あたりの重大な知らせの数を CI の表に出す (評論家の 0-7)。`railNews(g, g.knownEvents(), new Set(g.acked), () => false)` (`src/screen/events-ui.js`) が帯で目立たせる知らせ (`majors`) と予算を超えた件数 (`over`) を返す。40 年 ≈ 遊んで 1 時間。回 GA2 の手元の測り: 前は 40 年あたり平均 78・最大 192 件、後は平均約 9・最大 12 件。上限を目標にするかは画面と最初の体験で決める (`fun.md` の 7.4) | `tools/ci-report.js`・`tools/headless.js` | B-048 | S | 道具と検証 | 状態のファイルの前からの知らせ (回 GA2・B-048)。回 DO7 で移した |

## 外向き

| 番号 | 中身 | 触るコードの場所 | 依存 | 大きさ | 新しいレーン案 | 出どころ |
|---|---|---|---|---|---|---|
| B-073 | **済み (回 T1・#283。`docs/i18n.md`)** 画面の文字列を 1 か所に集めて、訳せる形にする (ほかが止まっている時期に 1 本だけで) | `src/index.html` の全体・新しい (文字列の表) | Q2 | XL | 外向き | `sessions.md` の 18・`game-plan.md` の段 13・`critique/04-plan.md` の 3-4・7 の G6・`restart.md` の 4 |
| B-074 | **済み (#183。回 SO1。`docs/glossary/`)** 固有名詞の一覧と用語集を先に作る (訳の質で叩かれないように) | 新しい (`docs/`) | — | S | 外向き | `critique/04-plan.md` の 3 の 12 |
| B-075 | **済み (回 T1・#283。`src/outward/lang-en.js`。校正は QD-73)** 英語を入れる | 新しい (文字列の表) | B-073・B-074 | M | 外向き | `sessions.md` の 18・`critique/04-plan.md` の 4-4 |
| B-076 | 簡体中国語を入れる | 新しい (文字列の表) | B-073・B-074・Q11 | M | 外向き | `sessions.md` の 18・`critique/04-plan.md` の 4-4・6 の Q11 |
| B-077 | ストアの文を英語と中国語に | `store/` | B-075・B-076 | S | 外向き | `status/S.md`・`store/steamworks.md` の 10 |
| B-078 | **済み (#183。回 SO1。`store/page-ja.md` の 8)** ストアの下書きを今のゲームと突き合わせる (物理はゲーム版にも入った・第三次産業と研究が入った・従属国の型が入った) | `store/page-ja.md` | — | S | 外向き | `store/README.md`・`store/page-ja.md` の 7 |
| B-079 | **済み (#183。回 SO1。`desktop/shots/shoot.mjs`・`store/images.md` の 2・5)** スクリーンショットを撮るためのセーブと、カプセルの案を作る | `store/images.md`・`desktop/` | S の返事 (大きさ・カプセルの絵) | S | 外向き | `status/S.md`・`store/images.md` の 4 |
| B-080 | **済み (回 SO3。`desktop/trailer/trailer.mjs`・`store/images.md` の 3。音楽は音の素材が入ってから)** 予告編 (30〜60 秒。光の球 → 20 年後に届く → 講和のあとも戦う艦隊 → 答え合わせ) | `store/images.md`・新しい | B-052・B-054 | M | 外向き | `store/images.md` の 3・`critique/04-plan.md` の 4-1 |
| B-081 | ストアのページを公開 (近日公開) し、名前と副題の案を 2〜3 作って反応を比べる | `store/` | Steamworks のアカウント (ユーザー)・B-079・Q7・Q10 | S | 外向き | `critique/04-plan.md` の 4-1・4-8・4-9・`store/steamworks.md` の 9 |
| B-082 | 体験版 = 最初の時代 (2300〜2400 年) を作り、Next Fest に出る。配信者に鍵を配る | `END_CHOICES`・`ERA_YEARS`・`desktop/` | B-054・B-081 | M | 外向き | `critique/04-plan.md` の 4-2・4-5・4-6・`store/steamworks.md` の 3 |
| B-083 | Steamworks の SDK をつなぐ: 実績・Steam Cloud とスロットのセーブ (案 D)・オーバーレイ (`--in-process-gpu`)・画面のキーボード (案 C)・ワークショップ | `desktop/electron`・新しい | Steamworks のアカウント (ユーザー) | L | 外向き | `status/S.md`・`desktop/README.md` の 4・`desktop/controller.md` の 2・`store/steamworks.md` の 8・10・`critique/04-plan.md` の 4-7 |
| B-084 | SteamPipe でビルドを上げて審査に出し、Playtest を開く | `desktop/` | Steamworks のアカウント (ユーザー) | S | 外向き | `store/steamworks.md` の 9 の 7・8 |
| B-085 | **済み (#190。回 SO2。`desktop/steam-input/`。Deck の実機での読み込みは QD-72)** Steam Input の既定の設定のファイル (案 A。Action Manifest の VDF) | `desktop/` | — | S | 外向き | `desktop/controller.md` の 2 の案 A・`store/steamworks.md` の 7 |
| B-086 | **済み (#190。回 SO2。CI の「包装 (Windows と Linux)」。`desktop/README.md` の 1-4)** Windows 版を Windows の上で動かして確かめる (実機か、CI に Windows を足す) | `desktop/`・`.github/workflows/` | — | S | 外向き | `status/S.md` の残り |
| B-087 | Steam Deck の実機で確かめる: F08 の描画の速さ・Game Mode の全画面・`<select>` の出方・Gamepad API・セーブの書き出しと読み込み・小さな文字 | `desktop/bench/run.mjs` | ユーザーの実機 | S | 外向き | `status/S.md` の残り・`desktop/README.md` の 4・`desktop/controller.md` の 3 |
| B-088 | **済み (#183。回 SO1。字体は包装で同梱。Firebase の SDK は同梱しない。`desktop/README.md` の 1-2)** 字体を同梱する (いまは Google Fonts をネットから読む)。Firebase の SDK もネットなしでどうするか決める | `src/index.html` の頭の `<link>`・`FB_SDK`・`desktop/` | — | S | 外向き | `status/S.md` の残り・`desktop/README.md` の 4 |
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
| B-104 | (R01 は回 KE4 でゲーム版が合格。残りは R02 とシミュレーション版) R01 (交易と距離) の直し方 (案 A〜C) と、R02 (RICardo) の取得 | `TRADE`・`routeRoom`・`data/raw/` | B-014 | M | 経済 | `game-plan.md` の 5 と 6 (G2)・`trade.md` の 5・`reality-check.md` の 4 の 7 |
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
