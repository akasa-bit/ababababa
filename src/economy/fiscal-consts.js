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
// 利子率 (政策金利) は中央銀行の則 (CB) で決まる (回 KE1)。rate は人間の国が「自分で決める」を選んだときの政策金利 (名目)、cb = 1 なら中央銀行に任せる
const AI_FISCAL = { vary: 0, taxK: [0.51, 1, 1.54], ctaxShare: [0.096, 0.313, 0.442], tariff: [0.02, 0.0526, 0.1367] };
// 予算: 首都の税収のうち、毎年その政策に使う割合。効き目 = 最大 × 割合 ÷ (割合 + BUDGET_HALF) (使うほど伸びが鈍る)
const BUDGET = {
  welfare: { label: '福祉', good: '家臣の忠誠度の目標 +最大 12・人口の増え方 ×最大 1.15', loyalty: 12, growth: 0.15 },
  security: { label: '治安', good: '離反の起きやすさ ×最大 0.6', hazard: 0.4 },
  military: { label: '軍事', good: '艦隊の戦力 ×最大 1.25', fleet: 0.25 },
  // 教育 (回 KE5・B-117。ユーザーの依頼 2026-10-24): 効き目は budgetEffect でなく、教育の支出 ÷ GDP で学校を出る世代の就学年数を延ばす (SCHOOL.spend。docs/hcap.md)
  education: { label: '教育', good: '学校を出る世代の就学年数が延び、その世代が働くようになると生産性が上がる (教育の支出 GDP の 1% ごとに、所得 5,000 ドルの入植地で約 0.2 年。効くのは世代が入れ替わる数十年あと)' },
  // 研究 (回 KE6・B-122): 効き目は budgetEffect でなく、払った額 ÷ 研究者 1 人の費用だけ公の研究者を足す (RND。docs/innovation.md の 3)
  research: { label: '研究', good: '公の研究者が増え、8〜15 年あとから国の技術の伸びが速くなる (研究者 1 人の費用は 1 人あたり所得の約 4〜5 倍)。民間の研究も呼び込む (弾力性 0.5)' },
};
const BUDGET_HALF = 0.1;
const budgetEffect = (share) => (share > 0 ? share / (share + BUDGET_HALF) : 0);
// 研究開発の税額控除 (回 KE6・B-122): 会社の研究開発費の rdcredit の割合を、国の政府が会社に返す。幅は OECD の R&D Tax Incentives の、税の優遇 ÷ 会社の研究開発費の
// 国・年の 1〜99% 点 (0〜27.9%)。既定はその国ごとの平均の中央値 3.90% を刻みに丸めた 4% (data/derived/innovation.json の rnd.credit)
const RDCREDIT_RANGE = [0, 0.28], RDCREDIT_STEP = 0.005;
const FISCAL_DEFAULT = { tax: MARKET.tax, ctax: 0, tariff: 0, rate: 0.01, cb: 1, deficit: 0, rdcredit: 0.04, budget: { welfare: 0, security: 0, military: 0, education: 0, research: 0 } };
const FISCAL_COST = 5; // 税か利子率を変えるときの政治力 (予算の割り振りは政治力が要らない)
// 国債と財政の反応 (docs/debt.md)。人間が動かしていない政府は、目標の基礎収支 ÷ GDP
//   s* = a + rho × (国債 ÷ GDP) + beta × (GDP の傾向からのずれ) + war × (国が戦争中) + u   (u は 1 年の自己相関 ar・ばらつき sd)
// に合わせて国債を出し入れする (Bohn 1998 の形。係数は JST R6 の 18 か国 1870〜2020 年を国ごとに推定した中央値。data/build/analyze_fiscal.py)。
// trend = 傾向をならす年数、gap = 傾向からのずれの範囲 (JST の 18 か国の HP フィルターのずれの 1%〜99% 点)、
// cash = 手元に置く資金 (税収の何年分。Eurostat の一般政府の現金・預金 ÷ 税収の、30 か国 1995〜2025 年の国ごとの中央値の中央値)、
// spend = それを超えた資金を行政サービスに使いきる年数、limit = 買い物のために借りられる国債 ÷ GDP の上限 (JST の国ごとの中央値の中央値。90% 点の 0.914 では債務 R21 が 1.13 と幅を超えた)。
// 係数と cash・limit は data/build/analyze_fiscal.py が data/derived/fiscal.json の params に書き出す値
// repay = 1 なら、手元の資金が多すぎる分で国債を先に返す (前の版)。0 なら行政サービスに使い、国債は式の分だけ返す (回 KE1。R28 が 0.08 → 0.045 で幅に入る。QD-28)
const DEBT = { a: -0.0023, rho: 0.0336, beta: 0.056, war: -0.0171, sd: 0.0269, ar: 0.6971, trend: 10, gap: [-0.1756, 0.1451], cash: 0.1613, spend: 1, limit: 0.4687, repay: 0 };
// 中央銀行・国の物価・利回り・国債の信用の危険 (回 KE1・B-001。docs/money.md の 5)。帳簿は前のまま基準の値段 (実質の cr) で持ち、物価の水準 P は国ごとの数として持つ。
// 利子の受け払いは実質の利子率 (名目 − 物価の上がり方。Fisher) で行うので、思ったより物価が上がれば国債の重さが減り、預金が目減りする (インフレ税の入口)。
//   政策金利 i: 人間でない国 (と、任せた人間の国) の中央銀行は Taylor (1993) の則 i = r* + π + phiPi (π − pistar) + phiY × 景気のずれ。幅は RATE_RANGE。
//     景気のずれは、国の GDP のこの 1 年の伸び − 潜在の産出 (入植地の人口 × 生産力 potentialUSD) の 1 年の伸び (前の刻みにもあった星系だけで。Walsh 2003 の速さの則を
//     潜在の伸びと比べる形にした。回 KE6・B-118)。幅 gap は JST R6 の 18 か国の、実質 GDP の伸び − HP フィルター (λ = 100) の傾向の伸び の 1%〜99% 点 (data/build/analyze_fiscal.py の params)
//     r* = 国の中立の実質の金利 = rs[0] + rs[1] × (1 人あたりの潜在の伸びを trend 年でならしたもの)、幅 rsr (回 KE6・B-118)。Holston, Laubach & Williams (2023) の
//     米国・カナダ・ユーロ圏の r* を、WDI の人口の伸びを引いた 1 人あたりの潜在の伸びに当てた最小二乗 (184 の国・年、相関 0.80) と、r* の 1%〜99% 点 (data/build/build_rstar.py)。
//     HLW は総額の伸びで r* = g + z と置くが、ゲームの国は入植と移民で人口が年に何十 % も増えるので、1 人あたりに当て直した (ラムゼーの式の形)。
//     trend = 10 年 (国債の式の傾向 DEBT.trend と同じ)。rstar = 始めの中立の金利と、中央銀行のない所の既定 (前の利子率の既定 年 1%。R01 の較正がこれで行われている)
//     pistar = 物価の目標 (先進国の中央銀行の 2%)、phiPi・phiY は Taylor (1993) の値
//   物価の上がり方 π = pistar + x + kappa × 景気のずれ − lambda × (実質の政策金利 − r*) + u。x は人々の見込みの目標からのずれで、
//     実際の上がり方に theta の速さで寄り、anchor の速さで目標に戻る (中央銀行への信認)。u は 1 年の自己相関 ar・ばらつき sd のゆらぎ。
//     政策金利を物価より低いまま止めておくと、見込みが上がって物価の上がり方が高いまま続く。
//     見込みの寄り方 theta ÷ (theta + anchor) と lambda の和が 1 に近いと、ずれが何十倍にもふくらむ (anchor なし、または 0.71 + 0.25 では、政策金利の下限 −1% で
//     デフレが自分で深まり、試しのシード 7 で 2315 年から π が −20% に張りついた)。いまは 0.5 + 0.1 で、ずれは 2.5 倍まで。pi は π の幅
//   国の物価の指数 (cpi) = P × 家計が買った物の値段の指数 (物の量を、いまの値段と基準の値段で比べた Paasche 指数。サービスは入れない)
//   長期の国債の利回り = 期待の仮説 (いまの政策金利が persist 年でならしの値 r* + pistar に戻ると見て、mat 年の平均) + 期間の上乗せ tp + 信用の上乗せ credit × 国債 ÷ GDP。
//     tp と credit は JST R6 の 18 か国で (長期 − 短期) を債務 ÷ GDP に当てた国ごとの切片と傾きの中央値 (目標 R34・R35。data/build/analyze_fiscal.py の params)
//   国債の利子: 政府ごとの国債の利札 cpn (出した年の長期の利回りの、額で重みをつけた平均)。毎年 1 ÷ roll ずつ、いまの利回りで借り換える
//   不履行: 国債 ÷ GDP が dmax (JST の 18 か国の、国ごとの債務 ÷ GDP の最大の中央値) を超えた政府は、国債の haircut (Cruces & Trebesch 2013 の 180 件の平均 37%) を払わない。
//     銀行の損は、利子と同じく預金の額に比べて預金から引く (銀行の純資産は 0 のまま)
// kappa・lambda・theta・anchor・sd・ar・persist・roll は仮の値 (現実の政策の反応と比べるのは回 KE3・B-006)
const CB = { rstar: 0.01, rs: [0.00234, 1.343], rsr: [0.0023, 0.0567], trend: 10, pistar: 0.02, phiPi: 0.5, phiY: 0.5, gap: [-0.1355, 0.1175], kappa: 0.1, lambda: 0.1, theta: 0.3, anchor: 0.3, sd: 0.01, ar: 0.5, pi: [-0.2, 1], persist: 3, mat: 10, roll: 7, tp: -0.0004, credit: 0.0175, dmax: 1.3821, haircut: 0.37 };
// 中央銀行の状態 (国ごと。国 = 首都の星系): P = 物価の水準 (基準の値段 = 1)、x = 見込みの目標からのずれ、u = ゆらぎ、pi = 物価の上がり方、i = 政策金利、m = 物の値段の指数、
// yp・pp・np = 前の刻みの星系ごとの GDP・潜在の産出・人口、g1・gp = GDP と潜在の産出の 1 年でならした伸び、gt = 1 人あたりの潜在の伸びを trend 年でならしたもの、
// rs = 中立の実質の金利 (回 KE6。前の版のセーブは gs が残るだけで使わない)、h = 政策金利の 1 年ごとの記録 [[年, i]] (遠い星系には、知らせが光速で届いた分の政策金利が効く)
saveField('cb', (game) => (Object.keys(game.cb).length ? game.cb : undefined), {
  init: (game) => { game.cb = {}; },
  read: (game, d) => { game.cb = d.cb && typeof d.cb === 'object' ? Object.fromEntries(Object.entries(d.cb).filter(([, s]) => s && Number.isFinite(s.P) && Number.isFinite(s.i) && Array.isArray(s.h))) : {}; },
});
// 民間の信用 (回 KE3・B-002。目標 R22。docs/debt.md の 7)。家計の借り (住宅など。gv.hm) と会社の借り (設備投資など。gv.bl) を、預金と差し引かない残高として持つ
// (前は家計と会社の手持ちと借りを差し引いた 1 つの値だったので、預金と借りを同時に持てず、R22 が 0 だった)。
// 毎年 GDP の stock ÷ years を新しく借り、残高の 1 ÷ years を返す。定常では残高 ÷ GDP = stock (伸びる星系ではそれより低い)。
//   stock = JST R6 の 18 か国の民間の信用 ÷ GDP の中央値の中央値 (0.474) を、家計 (thh) と会社 (tbus) の中央値の比で分けた値 (data/build/analyze_fiscal.py の params の loans_hh・loans_fm)
//   years = 返す年数 (家計 15 年: 住宅ローンと消費者の借りの間、会社 5 年。仮の値)
//   家計は借りた分で会社から住宅を買う (housing。会社の売上になり、賃金として家計に戻る)。会社は借りた分を設備に使う (会社の手持ちになり、賃金として家計に戻る)。
//   どちらも利子は、その星系の実質の利子率 (rateAt) で払う
const LOANS = { hh: { stock: 0.214, years: 15 }, fm: { stock: 0.26, years: 5 } };
