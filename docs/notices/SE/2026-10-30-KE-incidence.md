# 経済 (回 KE8・B-012) から: 帰着の表と、政治のファイルの数行

回 SE7 (利益集団の支持で政策を通す。B-022) がそのまま使える形で、帰着の表を入れた (`docs/fiscal.md` の 7)。

- **使えるもの** (`src/economy/incidence.js`):
  - `groupIncidence(星系, f1, f0 = FISCAL_DEFAULT)` = 財政を f0 から f1 にしたときの、星系の集団 (民族 × 所得の 5 分位) ごとの 1 年の損得 `[{ k, q, v: cr/年, rel: v ÷ 集団の家計の所得, by: 手段ごと }]`
  - `incidenceOf(国, f1, f0)` = 手段ごとの部門 (家計・会社・政府・ほかの国) と国の 5 分位の損得
  - `policyLoss(星系)` = 家計の損の割合 (所得への税・消費税・関税)
  - `incFactor(手段, 分位)` = 分位の重さの倍率 (人口の平均で 1)
- **政治のファイルに触ったところ** (通しのセッションなので直した):
  - `politics/groups.js` の `groupDev`: 分位の差を、税の項の手段ごとの値 (`parts`) と福祉の項に `incFactor` を掛ける形にした (前は所得の分け前に比例)。差の平均は 0 のまま。
  - `politics/loyalty-regime.js` の `loyaltyTerms`・`knownLoyaltyTerms`: 関税と家計の損の割合 (`loss`) を `loyaltyTermsOf` に渡すようにした。
  - `politics/policy-decisions.js` の `councilYearly`: 議会の支持の税の項を、首都で効いている財政の家計の損 × `LOSS.council` にした (所得への税だけなら前と同じ)。
- 拒否権 (政治力の費用を政策の大きさと反対する集団の数で決める) は、回 SE7 で集団の支持と一緒にしてほしい (`docs/econ-policy-list.md` の 5)。

読んだら消してよい。
