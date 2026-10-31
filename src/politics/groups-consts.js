// 星系の中の集団 (回 SE6・B-020・B-021。決まった案 11-1 a・11-2 c・11-3 b・11-4 b。docs/groups.md・数は data/derived/groups.json)
// 集団 = 民族 × 所得の 5 分位。民族は、支配する種族 (国の首都の種族) の「よそ生まれ」(入植者と移民。経済の学歴の表の away) と「ここ生まれ」(here)、
// それとほかの種族ごと。価値観の 2 軸は星系の平均と、所得の分位・生まれごとの差で持つ (QD-42。groupValuesOf)
//   quint = 所得の 5 分位の分け前 (WDI の 171 か国 2,434 国・年の中央値。1 人あたり GDP の 5 分位ごとに見ても、いちばん上の分位が 40〜48% でほとんど変わらない)
//   exclBeta = 政治から締め出された人口の割合の、離反の起きやすさへの係数。ハザードに exp(exclBeta × (割合 − exclRef))。目標 R42 (較正用) に合わせた値: ゲームの書き出しに
//     実データと同じロジットをかけた係数が、実データの推定 2.089 (EPR・UCDP の国・年) に合うようにした (12 銀河 × 300 年で 入れた 1.5 → 測った 2.03、1.7 → 2.38、2.089 → 2.92)。
//     ゲームの中では、締め出しが現地のエリートの抵抗を通して法と実態の差にも効くので、測った係数は入れた係数より大きくなる
//   exclRef = 締め出された割合の基準 (この割合で倍率 1)。集団を入れる前と、家臣の星系・年あたりの独立と不満の始まりが同じになる値 (R08 の合わせ直し。docs/groups.md の 3)
//   exclLoy = 締め出された集団と、権力に加わっている集団の忠誠度の差 [点] = 集団・年の形の締め出しの係数 1.314 (オッズ比 3.72) ÷ 忠誠度 1 点の離反への効き (HAZARD.loyalty)。
//     集団どうしの差だけで、集団の人口で平均した値は星系の忠誠度のまま (締め出しの効きは exclBeta の項だけで数え、二重に数えない)
//   values = 価値観の 2 軸 (国の平均を国の間の標準偏差で割った値。0 が国の平均) = 切片 + 傾き × ln 1 人あたりの所得 (2021 年の購買力平価のドル)。
//     Global Flourishing Study の 1 年目の個票 (22 か国と香港。CC BY 4.0。QD-42。data/build/analyze_values.py) で作った近い形: 伝統 ↔ 世俗 = −(宗教が日々大切か・宗教の集まり・
//     法にはいつも従うべきか) (ln GDP との相関 0.88)、生存 ↔ 自己表現 = 人の信頼・暮らしの心配のなさ・幸福 (相関 0.28)。quint = 国の中の所得の 5 分位ごとの差 (平均 0)、
//     away = よそ生まれ (国の外で生まれた人) の、ここ生まれとの差 (どちらも国の固定効果つき)。WVS の個票は非営利に限るので使わない
//     (前は QoG の WVS の国の平均の項目で、傾きは 0.7357・0.3234)
//   elite = 現地のエリートにする「ここ生まれ」の割合の下限 (それより少ない若い入植地は、よそ生まれの上の分位がエリート)
const GROUPS = { quint: [0.07, 0.119, 0.163, 0.222, 0.424], exclBeta: 1.5, exclRef: 0.1, exclLoy: Math.round(1.3142 / HAZARD.loyalty), elite: 0.05,
  values: { secular: [-10.2031, 1.0101], selfexp: [-3.2396, 0.3207],
    quint: { secular: [-0.0247, -0.0444, -0.0164, 0.016, 0.0695], selfexp: [-0.7634, -0.2404, 0.0159, 0.2927, 0.6952] }, away: { secular: -0.1139, selfexp: -0.0329 } } };
// 権力への近さ (EPR の 7 段を 5 つに。incl = 中央の権力に加わっている)。11-3 b: 統治体制の実態 (束の「統治者の任免」) から決まる (groupStatus)
const GROUP_STATUS = { dom: { label: '優位', incl: true }, senior: { label: '上級の分担', incl: true }, junior: { label: '下級の分担', incl: true },
  powerless: { label: '無力', incl: false }, discr: { label: '差別', incl: false } };
const GROUP_QUINT_LABEL = ['いちばん下', '下', '中', '上', 'いちばん上'];
// 直轄の星系だけ、民族の権力への近さを手で上書きできる (命令 include。光速の指令)。incl = 権力に加える (下級の分担)・excl = 締め出す・auto = 統治体制のまま
const GROUP_INCLUDE = { auto: '統治体制のまま', incl: '権力に加える', excl: '締め出す' };
const groupQuint = (q) => GROUPS.quint[q] / GROUPS.quint.reduce((a, b) => a + b, 0); // 分位 q の所得の分け前 (合計を 1 に)
// 価値観の 2 軸 (星系の 1 人あたりの所得 inc = 2011 年のドルから。経済の DEMO.usd2021 で 2021 年のドルに)
const groupValues = (inc) => { const x = GM.log(Math.max(1, inc * DEMO.usd2021)), V = GROUPS.values; return { secular: V.secular[0] + V.secular[1] * x, selfexp: V.selfexp[0] + V.selfexp[1] * x }; };
