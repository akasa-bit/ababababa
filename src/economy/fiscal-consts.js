// 財政 (プレイヤーが選ぶ。国家方針と同じく、変えた知らせが光速で届いた星系から効く)。効き目の大きさは仮の値 (docs/fiscal.md)
// 税: k = 人口あたりの税の倍率、loyalty = 家臣の忠誠度の目標、council = 議会の支持の年あたりの変化
// 財政の手段の幅 (セッション 20。docs/policy-ranges.md)。生データ (BIS の政策金利・WDI) の国・年の 1〜99% 点で、作る前に固定した。
//   税率 (所得への税) 2〜34% (刻み 0.5%。標準は MARKET.tax = 15.5%)、利子率 −1〜50% (0.25%)、予算は機能ごとに 0〜60% で合わせて 100% まで (1%)、赤字の上限 0〜15% (0.5%)
const TAX_RANGE = [0.02, 0.34], TAX_STEP = 0.005;
const RATE_RANGE = [-0.01, 0.5], RATE_STEP = 0.0025;
const BUDGET_RANGE = [0, 0.6], BUDGET_STEP = 0.01, BUDGET_TOTAL = 1;
const DEFICIT_RANGE = [0, 0.15], DEFICIT_STEP = 0.005;
// セッション 20 の 2: 消費税 (家計の買い物の値段に掛ける。OECD の付加価値税の標準税率の最低 5%・最高 27% と、ない国の 0) と関税 (ほかの国からの輸入の値段に掛ける。WDI の加重平均の実行関税率の 1〜99% 点)
const CTAX_RANGE = [0, 0.27], CTAX_STEP = 0.005;
const TARIFF_RANGE = [0, 0.29], TARIFF_STEP = 0.005;
const onStep = (v, [lo, hi], step) => Number.isFinite(v) && v >= lo - 1e-9 && v <= hi + 1e-9 && Math.abs(v / step - Math.round(v / step)) < 1e-6;
// 前の版の税の 4 段階。古いセーブと命令の別名として残す (税率 = 標準 × k)
const TAX_LEVELS = {
  low: { label: '低い', k: 0.6 },
  normal: { label: '標準', k: 1 },
  high: { label: '高い', k: 1.4 },
  heavy: { label: '重税', k: 1.8 },
};
const taxRateOf = (t) => (typeof t === 'number' ? t : MARKET.tax * (TAX_LEVELS[t] || TAX_LEVELS.normal).k);
// 税の重さ k = 税率 ÷ 標準。家臣の忠誠度の目標 TAX_LOYALTY × (k − 1)、首都の議会の支持 年 TAX_COUNCIL × (k − 1)
// (前の 4 段階の値 (+6・0・−6・−12、+0.2・0・−0.2・−0.5) を直線にしたもの。重税の議会の −0.5 は −0.4 になった)
const TAX_LOYALTY = -15, TAX_COUNCIL = -0.5;
// 税の重さ k = (所得への税率 + 消費税) ÷ 標準。消費税は家計の買い物の値段に乗るので、家計にとっては所得への税と同じ重さと見る (関税は買い手の会社が払うので入れない)
const burdenK = (f) => (taxRateOf(f.tax) + (f.ctax || 0)) / MARKET.tax;
// 人間でない国の財政 (docs/fiscal.md の 1)。vary = 1 なら、国ごとに現実の国の分布から引く (docs/policy-ranges.md)。既定は 0 (標準): C-22「おすすめと既定のままで」。1 の結果は docs/fiscal.md の 1.3:
//   taxK = 税の合計 ÷ 所得 を、WDI の税収 ÷ GDP の国ごとの中央値の 10・50・90% 点 (8.0・15.7・24.2%) をゲームの標準 (15.5%) に合わせて 0.51・1・1.54 倍にしたもの
//   ctaxShare = そのうち消費税の割合 (WDI の 財・サービスへの税 ÷ 税収 GC.TAX.GSRV.RV.ZS の国ごとの中央値の 10・50・90% 点)、tariff = 関税率 (WDI TM.TAX.MRCH.WM.AR.ZS の同じ点)
//   3 つはシードと首都から別々に引く (試合の乱数は使わない)。vary = 0 なら標準 (所得への税 15.5%・消費税 0・関税 0)
// 利子率は、まだ物価がない (名目 = 実質) ので標準の 1% のまま (BIS の政策金利は名目。セッション 21 で)
const AI_FISCAL = { vary: 0, taxK: [0.51, 1, 1.54], ctaxShare: [0.096, 0.313, 0.442], tariff: [0.02, 0.0526, 0.1367] };
// 予算: 首都の税収のうち、毎年その政策に使う割合。効き目 = 最大 × 割合 ÷ (割合 + BUDGET_HALF) (使うほど伸びが鈍る)
const BUDGET = {
  welfare: { label: '福祉', good: '家臣の忠誠度の目標 +最大 12・人口の増え方 ×最大 1.15', loyalty: 12, growth: 0.15 },
  security: { label: '治安', good: '離反の起きやすさ ×最大 0.6', hazard: 0.4 },
  military: { label: '軍事', good: '艦隊の戦力 ×最大 1.25', fleet: 0.25 },
};
const BUDGET_HALF = 0.1;
const budgetEffect = (share) => (share > 0 ? share / (share + BUDGET_HALF) : 0);
const FISCAL_DEFAULT = { tax: MARKET.tax, ctax: 0, tariff: 0, rate: 0.01, deficit: 0, budget: { welfare: 0, security: 0, military: 0 } };
const FISCAL_COST = 5; // 税か利子率を変えるときの政治力 (予算の割り振りは政治力が要らない)
// 国債と財政の反応 (docs/debt.md)。人間が動かしていない政府は、目標の基礎収支 ÷ GDP
//   s* = a + rho × (国債 ÷ GDP) + beta × (GDP の傾向からのずれ) + war × (国が戦争中) + u   (u は 1 年の自己相関 ar・ばらつき sd)
// に合わせて国債を出し入れする (Bohn 1998 の形。係数は JST R6 の 18 か国 1870〜2020 年を国ごとに推定した中央値。data/build/analyze_fiscal.py)。
// trend = 傾向をならす年数、gap = 傾向からのずれの範囲 (JST の 18 か国の HP フィルターのずれの 1%〜99% 点)、
// cash = 手元に置く資金 (税収の何年分。Eurostat の一般政府の現金・預金 ÷ 税収の、30 か国 1995〜2025 年の国ごとの中央値の中央値)、
// spend = それを超えた資金を行政サービスに使いきる年数、limit = 買い物のために借りられる国債 ÷ GDP の上限 (JST の国ごとの中央値の中央値。90% 点の 0.914 では債務 R21 が 1.13 と幅を超えた)。
// 係数と cash・limit は data/build/analyze_fiscal.py が data/derived/fiscal.json の params に書き出す値
const DEBT = { a: -0.0023, rho: 0.0336, beta: 0.056, war: -0.0171, sd: 0.0269, ar: 0.6971, trend: 10, gap: [-0.1756, 0.1451], cash: 0.1613, spend: 1, limit: 0.4687 };
