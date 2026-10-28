// 星系の中の集団 (回 SE6・B-020・B-021。決まった案 11-1 a・11-2 c・11-3 b・11-4 b。docs/groups.md・数は data/derived/groups.json)
// 集団 = 民族 × 所得の 5 分位。民族は、支配する種族 (国の首都の種族) の「よそ生まれ」(入植者と移民。経済の学歴の表の away) と「ここ生まれ」(here)、
// それとほかの種族ごと。価値観の 2 軸は星系ごとの平均で持つ (WVS の個票がないので、集団ごとの差は持たない)
//   quint = 所得の 5 分位の分け前 (WDI の 171 か国 2,434 国・年の中央値。1 人あたり GDP の 5 分位ごとに見ても、いちばん上の分位が 40〜48% でほとんど変わらない)
//   exclBeta = 政治から締め出された人口の割合の、離反の起きやすさへの係数。ハザードに exp(exclBeta × (割合 − exclRef))。目標 R42 (較正用) に合わせた値: ゲームの書き出しに
//     実データと同じロジットをかけた係数が、実データの推定 2.089 (EPR・UCDP の国・年) に合うようにした (12 銀河 × 300 年で 入れた 1.5 → 測った 2.03、1.7 → 2.38、2.089 → 2.92)。
//     ゲームの中では、締め出しが現地のエリートの抵抗を通して法と実態の差にも効くので、測った係数は入れた係数より大きくなる
//   exclRef = 締め出された割合の基準 (この割合で倍率 1)。集団を入れる前と、家臣の星系・年あたりの独立と不満の始まりが同じになる値 (R08 の合わせ直し。docs/groups.md の 3)
//   exclLoy = 締め出された集団と、権力に加わっている集団の忠誠度の差 [点] = 集団・年の形の締め出しの係数 1.314 (オッズ比 3.72) ÷ 忠誠度 1 点の離反への効き (HAZARD.loyalty)。
//     集団どうしの差だけで、集団の人口で平均した値は星系の忠誠度のまま (締め出しの効きは exclBeta の項だけで数え、二重に数えない)
//   values = 価値観の 2 軸 (国の間で標準化した値。0 が国の平均) = 切片 + 傾き × ln 1 人あたりの所得 (2021 年の購買力平価のドル)。QoG の WVS の国の平均の項目で作った近い形:
//     伝統 ↔ 世俗 = −神の大切さ・子に望む資質の自律 (52 か国、決定係数 0.45)、生存 ↔ 自己表現 = 脱物質主義・幸福・人への信頼 (70 か国、決定係数 0.15)
//   elite = 現地のエリートにする「ここ生まれ」の割合の下限 (それより少ない若い入植地は、よそ生まれの上の分位がエリート)
const GROUPS = { quint: [0.07, 0.119, 0.163, 0.222, 0.424], exclBeta: 1.5, exclRef: 0.1, exclLoy: Math.round(1.3142 / HAZARD.loyalty), elite: 0.05,
  values: { secular: [-7.2402, 0.7357], selfexp: [-3.1997, 0.3234] } };
// 権力への近さ (EPR の 7 段を 5 つに。incl = 中央の権力に加わっている)。11-3 b: 統治体制の実態 (束の「統治者の任免」) から決まる (groupStatus)
const GROUP_STATUS = { dom: { label: '優位', incl: true }, senior: { label: '上級の分担', incl: true }, junior: { label: '下級の分担', incl: true },
  powerless: { label: '無力', incl: false }, discr: { label: '差別', incl: false } };
const GROUP_QUINT_LABEL = ['いちばん下', '下', '中', '上', 'いちばん上'];
// 直轄の星系だけ、民族の権力への近さを手で上書きできる (命令 include。光速の指令)。incl = 権力に加える (下級の分担)・excl = 締め出す・auto = 統治体制のまま
const GROUP_INCLUDE = { auto: '統治体制のまま', incl: '権力に加える', excl: '締め出す' };
const groupQuint = (q) => GROUPS.quint[q] / GROUPS.quint.reduce((a, b) => a + b, 0); // 分位 q の所得の分け前 (合計を 1 に)
// 価値観の 2 軸 (星系の 1 人あたりの所得 inc = 2011 年のドルから。経済の DEMO.usd2021 で 2021 年のドルに)
const groupValues = (inc) => { const x = GM.log(Math.max(1, inc * DEMO.usd2021)), V = GROUPS.values; return { secular: V.secular[0] + V.secular[1] * x, selfexp: V.selfexp[0] + V.selfexp[1] * x }; };
