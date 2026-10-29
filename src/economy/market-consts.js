// 市場の値段 (段 5)。星系ごと・資源ごとに、在庫 ÷ ふだんの消費 (年) が目標の在庫の厚さ cover [年] から離れるほど値段が動く:
//   値段 = 基準価格 × (在庫 ÷ (消費 × cover))^(−eta)  (在庫の多い年は安く、少ない年は高い。Deaton & Laroque 1992 の競争的な貯蔵の形)
// cover は現実の在庫の厚さ (食料など: 世界の穀物の在庫 ÷ 消費の中央値 0.28 年。工業品: 米国の在庫 ÷ 売上の中央値 1.39 か月)。
// ふだんの消費は、地元の消費・工業の投入・建設・積み出し (輸出)・艦隊の補給を合わせたもの (その星系の物への需要)。
// 人は、値段から見た 1 人あたりの稼ぎ (値段 × 生産性。工業は投入を引いた付加価値) が高い部門へ、年に mobility の速さで移る。
// サービス (蓄えられず、地元で消費する) には、人々が所得の serv(y) の割合を使う (y = 1 人あたりの実質の所得。STRUCTURE)。サービスの 1 人あたりの稼ぎは、
// その売上 ÷ サービスの人数なので、人が集まりすぎれば下がる (つり合いでは、サービスの人の割合 = serv(y)。構造転換。docs/structure.md)。
// 値段は、在庫から決まる値段へ tau 年かけて寄っていく (値段の粘り。0 ならすぐ)。
// 競争的な貯蔵 (Williams & Wright 1991・Deaton & Laroque 1992): 倉に空きがあるあいだは、値段が戻ると見込んで蓄える人がいるので、
// 値段は「ならした値段 (long 年) × (1 − 貯蔵の年の費用 store)」より下がらない。人は、expect 年でならした稼ぎを見て部門を移る。
// eta・smooth・mobility・tau・store・long・expect は仮の値で、目標 R23〜R26 に合わせて決める (docs/market.md)。buy: 1 なら、政府は建設の資材を市場の値段で民間から買う
const MARKET = { eta: 1, smooth: 1, min: 0.1, max: 10, cover: { food: 0.28, water: 0.28, metal: 0.28, fuel: 0.28, rare: 0.28, goods: 1.39 / 12, slaves: 0.28, hitech: 1.39 / 12 },
  mobility: 0.2, buy: 1, tau: 0, store: 1, long: 5, expect: 0.25, anchor: 0, fill: 1, // fill: 在庫の目標への不足を埋める年数 (需要で決まる生産。economy の 1) // anchor: 1 なら、値段はならした値段 (long 年) からの在庫によるずれ (priceAt の説明。試したら値段の揺れ R23 が 0.27 → 0.54、食料の在庫 R25 が 3.7 年になったのでやめた)
  // 人の消費の短期の値段の弾力性 (消費 = 必要な量 × (値段 ÷ 基準価格)^(−弾力性)、0.3〜2 倍に収める)。食料: Andreyeva, Long & Brownell 2010 のメタ分析、
  // 工業品: 耐久財のおおよその値。高くて買えない分は充足率が下がる (飢えや不足として人口に効く)。安ければ必要より多く使う (飼料・無駄)。
  // 食料と水の弾力性は所得が上がるほど小さくなる (食費の割合が小さくなるので値段に動じない。Seale & Regmi 2006 の国の所得ごとの食料の需要の推定では、
  // 低い所得の国の約半分が高い所得の国): 弾力性 × (所得 ÷ elasticY)^(−elasticSlope)、elasticFloor を下限に
  elastic: { food: 0.3, water: 0.3, goods: 1, hitech: 1 }, elasticY: 2000, elasticSlope: 0.34, elasticFloor: 0.1,
  input: 0.5, // 工場の投入 (金属・燃料) の値段の弾力性。投入の費用が工業品の値段を上回るなら作らない
  // 税: buy のときは、民間の所得 (その入植地の付加価値 = 産出 × 市場の値段 − 工業の投入 + サービス) × 税率 tax。前の版は人口から決まる額。
  // 税率は、現実の税収 ÷ GDP の中央値 (R19、Jordà–Schularick–Taylor の 18 か国 1870〜2020 年: 0.155) から
  tax: 0.155,
  // 値段の水準 [cr ÷ 基準価格]: 物 1 単位が何 cr か。建設・船・維持費の cr と、経済の大きさ (産出 × 値段) の比を決める 1 つの値で、
  // 政府支出 ÷ GDP (R27) が現実の幅に入るように決める (docs/market.md)。単位によらない量 (交易と距離の弾力性 R01 など) は変わらない。
  // 0.01 → 0.2 (セッション 9。工業品の需要を所得の Engel 曲線にしたら、物の値段 (cr) で測った経済が約 30 分の 1 になったので決め直した。docs/structure.md の 4)
  // → 0.15 (同じセッションの 2 つめの PR。需要で決まる生産と値段の幅 0.1〜10 倍で政府の借りが減り、R21 が幅を下回ったので決め直した。docs/structure.md の 7)
  level: 0.15 };
// 構造転換 (段 5 の 3。セッション 9。docs/structure.md)。入植地の 1 人あたりの実質の所得 y [2011 年の国際ドル/人] で決まる曲線。係数は生データから
// data/build/build_sectors.py が data/derived/sectors.json の structure に書き出す値 (手で決めない):
//   serv:     サービスの就業の割合 = 1 / (1 + exp(−(a + b ln y)))。GGDC 10 部門 × Maddison 2023 の就業の割合 (31 か国 1948〜2012 年) の logit を ln 所得に当てた。
//             人々は所得のこの割合をサービスに使う (Baumol・Engel の形の縮約)
//   goods:    工業品の 1 人 (100 万人) あたりの需要 [単位/年] = exp(c0 + c1 ln y + c2 (ln y)²)。GGDC の鉱業・製造業・電気ガス水道の実質の付加価値 ÷ 人口を
//             ln 所得の 2 次式に当てた Engel 曲線 (国の固定効果つき)。水準は米国 2010 年 (名目の付加価値の割合 × 所得 ÷ 工業品 1 単位の値段)。
//             所得の弾力性は 2,000 ドルで 1.6、50,000 ドルで 0.6 (高い所得で下がるので、工業の就業がこぶ型になる)。goodsCap はその幅
//   research: 研究者の数 [人/100 万人] = exp(d0 + d1 ln y + d2 × 学力 ÷ 100)。WDI (UNESCO) の研究者を、ln 所得と HCI の試験の点数 (学力) に当てた
//             (104 か国・301 国・年、2010〜2020 年。data/derived/innovation.json の game の research。目標 R66・R67。回 KE6・B-120。docs/innovation.md の 1)。
//             y は学歴と学力を決める所得 (市場で測った所得をならした c.incU。eduY)、学力はその年に学校を出る世代の学力 (learnCurve)。前は所得だけ (exp(−6.3424 + 1.3536 ln y)、
//             生産力 c.inc。Maddison の所得の 135 か国 1996〜2022 年)。学力を入れると所得の係数は 1.37 から 0.77 に下がる (研究者の所得の勾配の大半は学力の勾配)
//   hitech:   工業品の付加価値のうち高付加価値物品の割合 = 1 / (1 + exp(−(a + b ln y)))。WDI の NV.MNF.TECH.ZS.UN (UNIDO。製造業の付加価値のうち中・高技術の産業の割合。
//             149 か国 1990〜2024 年) の logit を ln 所得に当てた (data/build/build_tech.py → data/derived/tech.json の game。目標 R61)。工業品の需要 (goods) を、
//             付加価値の割合がこの曲線になるように、低付加価値物品と高付加価値物品の値打ちに分ける (hitechShare)。cpiHitech: 消費者物価の工業品のうち
//             高付加価値物品の値打ちの割合 (同じデータのすべての国・年の中央値)
//   stages:   惑星の発展段階の名前の境目 [ドル] (R10 の第 1 分位の上端・工業の頂点・第 4 分位の上端)
//   usdPerT:  所得の物差し。食料 1 単位 (100 万 t) の基準の値段 = 2011 年の世界の穀物 1 t の値段 × 100 万 (Pink Sheet × USDA PSD。目標 R10 の sim)
//   y0:       所得がまだ測れていない入植地 (始めの刻み) に使う所得 [ドル] (いまの「現代のまま ×1」の本星のおおよその値)
//   modern:   開始時の生産性「現代のまま (×1)」の物差し上の倍率。1 人あたりの産出に掛け、値段の水準を同じだけ割る (お金の大きさは変わらず、物の量が増える)。
//             1 = 前のまま (物差しで本星が 1 人 約 2,800 ドル、1900 年ごろの世界の平均。自給に沈んで経済が回らない。docs/structure.md の 5)。
//             6 = 2022 年の世界の平均 (Maddison 16,857 ドル ÷ 2,800)、21 = 2022 年の米国 (58,487 ドル ÷ 2,800)。
//             ユーザーが選ぶ (docs/status/C.md の「決めてもらうこと」)。選ぶまでは世界の平均。1 つの値で戻せる
const STRUCTURE = { usdPerT: 356.4, y0: 2000, modern: 6, smooth: 1, // smooth = 曲線に入れる所得 (生産力) をならす年数
  serv: [-7.3719, 0.7908], goods: [-22.5061, 3.8272, -0.1476], goodsCap: [0.02, 40], research: [-6.3481, 0.7712, 1.2098], hitech: [-6.1273, 0.4903], cpiHitech: 0.195,
  stages: [[1999, '農業期'], [7944, '工業化期'], [22463, '成熟期'], [Infinity, '脱工業期']] };
// 研究 (段 5 の 3。docs/structure.md)。国ごと・分野 (農業 farm・鉱業 mine・工業 ind) ごとの技術の水準 A_f (始め 1) が、1 人あたりの産出に掛かる。
//   dA_f/dt = alpha × S_f × A_f^(1 − beta)   (Jones 1995 の形のアイデアの生産関数。研究者 1 人あたりの研究の生産性 (Ȧ/A) ÷ S = alpha × A^(−beta) は、
//   A が上がるほど下がる。Bloom ほか 2020「アイデアは見つけにくくなっている」)
//   beta = 研究の生産性の下がり方 ÷ TFP の伸び (Bloom ほか 2020 の米国全体: 年 5.09% ÷ 1930〜2000 年代の TFP の伸びの平均 年 1.67% = 3.04。data/derived/ideas.json の game)
//   研究者 S = 人口 × 所得と学力で決まる数 (STRUCTURE.research。回 KE6)。国の分野には、部門の付加価値の比で分ける。研究者はサービスの中の人 (目標 R10 の数え方)
//   alpha は試合の始めに 1 つ決める: 最初のプレイヤーの本星の技術の伸びが g0 (Bloom ほかの TFP の伸びの平均 年 1.67%) になる値。セーブに入れる (alpha)
const RESEARCH = { beta: 3.045, g0: 0.0167, fields: ['farm', 'mine', 'ind', 'hi'] }; // hi = 高付加価値の工業 (回 KE5。前の版のセーブの国は 1 から)
// 技術の伝播 (回 KE6・B-121。docs/innovation.md の 2)。ほかの国の技術は、首都どうしの光の年数だけ遅れて見える。国は、分野ごとに見えている前線 (いちばん高い国の値)
//   の theta 倍まで、年 kappa の割合で追いつく: dA_f/dt += kappa × max(0, theta × F_f − A_f)、F_f = max_j A_j,f(t − τ_ij)。前線の国には働かない ([·]⁺)
//   theta = min(1, exp(lays × (LAYS − 前線の国の LAYS)))。LAYS = その年に学校を出る世代の、学力で調整した就学年数 (就学年数 × 学力 ÷ 625。人口の重みの平均)。
//   lays は PWT 11.0 の技術の前線比 (労働増大的な形) の ln を WDI の LAYS に当てた傾き (116 か国。data/derived/innovation.json の game の diffusion)。
//   前線の国との差にするのは、ゲームの国の LAYS (5〜8 年) がデータの豊かな国 (11〜13 年) より低く、データの切片のままでは前線の国でも theta が 0.4 になるため
//   kappa は、同じ PWT と LAYS で、1995〜2019 年の技術の伸びを初めの水準と LAYS に当てた、初めの水準の係数の符号を変えたもの (条件つきの収束の速さ。
//   2000〜2019 年では 0.0325。LAYS の係数 ÷ kappa = 0.17 は上の lays と合う)。どちらも data/derived/innovation.json の game の diffusion
//   step・keep = 記録の間隔と覚えておく年数 (首都どうしのいちばん遠い光の年数 (400 星系の銀河で 100 光年ほど) より長く)。
//   国の技術 (tech) に h = [[年, A_farm, A_mine, A_ind, A_hi], …] (6 桁に丸めた値) を持つ。セーブが大きくならないように、間隔を 2 年にした
const DIFFUSE = { kappa: 0.0247, lays: 0.1824, step: 2, keep: 120 };
// 研究開発の政策 (回 KE6・B-122。docs/innovation.md の 3)。研究者 (STRUCTURE.research の曲線) を、政府が出す分と会社が出す分に分け、研究者に費用を付ける。
//   cost   = 研究者 1 人の研究開発費 ÷ 1 人あたり所得 = exp(a + b ln y) (y は 2011 年の国際ドル。WDI の研究開発費 ÷ 研究者、1861 国・年。所得の上の 2 分位で 4.551 倍)
//   gshare = 研究開発費のうち政府が出す割合 [%] = a + b ln y を range で止めたもの (OECD MSTI の G_FG、1234 国・年。目標 R74)。
//            曲線の研究者のこの割合は、政府のふだんの支出 (行政サービス) で雇われているとみる (お金の流れは足さない)
//   会社の研究者 = 曲線の (1 − gshare) × ((1 − 控除の率) ÷ (1 − 既定の率))^(−elastic) × (公の研究者 ÷ 曲線の公の研究者)^crowd。倍率は adjust 年でならす
//            elastic = 研究開発の税の値段への長期の弾力性 1 (Bloom, Van Reenen & Williams 2019, JEP 33(3) の展望で「1 以上」)、crowd = 政府の研究開発を 10% 増やすと会社の
//            研究開発が 5〜6% 増える (Moretti, Steinwender & Van Reenen, NBER w26483) の 0.5、adjust = 研究開発の懐妊の平均 1.94 年 (Li & Hall, NBER w22473) の 2 年
//   予算の「研究」で足した公の研究者は、lag 年 (8〜15 年。公の非防衛の研究開発が TFP を上げるまでの遅れ。Fieldhouse & Mertens 2023, Dallas Fed WP 2305) 前の値の平均で
//   技術に効く。記録は国の技術の pe に 1 年ごと
//   税額控除は、会社の研究開発費 × 控除の率を、国の首都の政府がその星系の会社に払う (お金の種類 rdcredit)
//   max = 効き目の上限 [GDP の %]: 政府が出す研究開発費と、会社が出す研究開発費の、OECD の国・年の 99% 点 (1.114%・3.559%。data/derived/innovation.json の rnd.caps)。
//         この 2 つと呼び水の弾力性は、現実で見た範囲の中でしか確かめられていないので、予算と控除で押し上げられる研究者はここまでにする (それを超えて払った分は人を雇えない)
const RND = { cost: [7.1542, -0.5388], gshare: [149.975, -10.816], range: [17.08, 66.31], elastic: 1, crowd: 0.5, adjust: 2, lag: [8, 15], max: [1.114, 3.559] };
// 汎用技術 (GPT。回 KE6・B-123。docs/innovation.md の 4)。銀河全体で年 rate の割合でばらばらに (ポアソン) 現れ、研究者の数の比で引いた国が発明する (周期の時計は入れない)。
//   国 i の採用 a_i(t) = 1 / (1 + exp(−sigma (t − 現れた年 − 遅れ_i − m)))、m = ln(1/start − 1) ÷ sigma (遅れのあと、採用が start から始まる)
//   遅れ_i = 発明した国の首都からの光の年数 + ladder × (いちばん LAYS の高い国の LAYS − 国の LAYS) (年)
//   効き目: どの分野の ln A にも size × a_i(t − effect) を足し、採用の途中は jdip × da_i/dt を引く (補完の投資に人を回す J カーブ。採用が終われば戻る)。A に畳み込む
//   rate  = 1/60 年 (蒸気・電気・ICT と、テキストで測った突破の特許の 3 つの波 (Kelly ほか 2021)。報告の C027〜C030 で 1/75〜1/50)
//   size  = 0.21 (蒸気 0.21・電気 0.17・ICT 0.26 の、成長会計で積み上げた労働生産性への寄与の平均。Crafts 2002・2004 ほか。報告の C034・C035・C038)
//   sigma = 0.1226/年 (米国の家庭の 43 の技術の普及率の logit の傾きの中央値。data/derived/innovation.json の gpt.adoption_speed)、start = 1%
//   ladder = 1.84 年 (携帯電話とインターネットが 10% に達した遅れを LAYS に当てた傾き 1.32・2.35 年 ÷ 年の平均。gpt.ladder.lag_per_lays)
//   effect = 10 年 (採用から生産性に効くまでの遅れ 5〜15 年の中ほど。報告の C030・C040)
//   jdip  = 3.69 年 (無形の補完投資を測りに入れると ICT の時代の TFP が 11.3% 高い (Brynjolfsson, Rock & Syverson 2021) を、採用の速さの山 sigma ÷ 4 で割った)
//   phases = 国の採用の段階の名前 (Perez の大きな波の段階。名前だけで、ゲームの数は変えない。報告の問い 13)。cut の採用で区切る: 10% = 立ち上がり (R77 と同じ)、
//            50% = J カーブの下がりが終わるあたり (ゲームで、10% に達してから約 15 年。docs/innovation.md の 4.3)
const GPT = { rate: 1 / 60, size: 0.21, sigma: 0.1226, start: 0.01, ladder: 1.84, effect: 10, jdip: 3.69, phases: ['導入期', '転換点', '展開期'], cut: [0.1, 0.5] };
// 資本の分け前 (回 KE5・B-114。docs/regions.md の 4)。会社は市場の付加価値の 1 − alpha を賃金、残りを配当として払う (economy の 7)。
//   alpha = 1 − 労働分配率、delta = 資本の減価償却、irr = 資本の実質の収益率。どれも Penn World Table 10.01 の国ごとの中央値
//   (data/build/build_regions.py の capital の game。目標 R39)。delta と irr は、民間の投資の行き先 (回 KE5 の次の PR) の収益率の基準に使う。
//   入植地ごとの資本 K を産出に (K ÷ K*)^alpha で効かせる形も試したが、首都の 1 人あたりの所得が 2〜5 割下がったので入れていない (docs/regions.md の 4.2)
const CAPITAL = { alpha: 0.451, delta: 0.04, irr: 0.107 };
// 民間の採掘の能力 (回 KE5・B-114 の 2。ユーザーの依頼 2026-10-24「現実に一番近い形にして」。docs/regions.md の 5)。
//   星系の会社が、銀行から借りて、採掘の能力 (game.capacity = [{ sys, body, k, by }]。k は採掘基地の段と同じ大きさの単位で、小数でよい) を買い足す。
//   毎年、値段が基準の (1 + margin) 倍より高く、いまの設備を全部動かしていて、需要 (ふだんの需要 + 地元の工業が動いたら要る原料) が産出を上回る資源について、
//   足りない分の speed の割合の能力を、その星系でいちばん埋蔵の多い採掘基地の天体に足す。地元の工業が動いたら要る原料 = 足りない工業品 (値段が高いときの
//   ふだんの需要 − 産出) × 原料の割合 (低付加価値物品 1 に金属 0.5・燃料 0.2、高付加価値物品 1 に希少元素 HITECH.rare)。
//   費用 [cr] = ky × 足す年の産出 × 基準の値段 (ky = alpha ÷ (irr + delta) = 3.07 は、PWT の値で、民間の収益率がふつうのときの資本 ÷ 付加価値)。
//   払うのはその星系の会社 (造る手間は家計の賃金。借りてよい)。能力は年 CAPITAL.delta ずつ古くなる。採掘基地 (政府が建てる。費用は決まった cr) と同じ式で掘る。
//   着工から build 年で掘り始める (Koeva 2000 の米国の工場の建設の年数。2 年ほど)。建設中の能力は、足りない分から引く (二重に注文しない)。
//   margin・speed は仮の値。遠くの会社が持つ形 (利潤を送り返す・GNI) は次の PR
const INVEST = { ky: CAPITAL.alpha / (CAPITAL.irr + CAPITAL.delta), margin: 0.5, speed: 0.5, build: 2, res: ['fuel', 'metal', 'rare'] };
// 遠くの持ち主と GNI (回 KE5・B-114。docs/regions.md の 6)。星系の会社の持ち分 gv.own = { [持ち主の星系]: 割合 } (残りはその星系の家計)。
//   新しく入植した星系の会社は、入植船を送った星系の家計がすべて (colony) 持って始まる (開拓の資本を出したのは送り手。入植会社・勅許会社の形)。
//   会社の利潤 (市場の付加価値の CAPITAL.alpha。配当できる手持ちまで) のうち持ち分の分を、遠くの持ち主へ光速で送る (届くまでは運ぶ途中のお金。refunds の hh。
//   届く年は年の終わりに切り上げ)。国の GNI = GDP + ほかの国の持ち主から受け取った配当 − ほかの国の持ち主に払った配当 (game.pinc に足す。目標 R65)。
//   新しい投資 (建て直しと伸びの分) のうち fdi の割合はほかの国が出す。出す国の重みは、国の大きさ (実質の所得の合計) × 1 人あたりの実質の所得の out 乗
//   (豊かな国ほど外へ出す。WDI の外への直接投資 ÷ GDP の所得への弾力性) で、その国の首都の家計が持つ。
//   持ち分は、その目標に資本の入れ替わりの速さ (年 delta + 伸び。伸びは地元の実質の所得 (学歴の c.incU と同じならした値) の伸びで、0〜gmax に収める) で近づく
//   (資本は年 delta ずつ古くなり、建て直しと伸びの分の新しい資本のうち fdi をほかの国が出す)。入植したときの送り手の持ち分も、同じ速さで目標 (同じ国なら 0) に近づく。
//   持ち分の決まり方には光の遅れを入れていない (年数十年かけて動くので)。配当の送金は光速。
//   fdi・out は data/derived/gni.json の game の fdi・outward (WDI の直接投資の受け入れ ÷ 総固定資本形成の、国ごとの中央値の中央値と、外への直接投資 ÷ GDP の
//   所得への弾力性。手で決めない)。
//   持ち主の星系に入植地がなくなったら、その分は地元のものになる。min より小さい持ち分は消す
const OWNER = { colony: 1, fdi: 0.1103, out: 1.0445, min: 1e-3, gmax: 0.2 };
// 会社の資本と投資 (回 KE6・B-119 の 1。ユーザーの決定 2026-10-26「資本を生産に効かせる」。docs/regions.md の 7)。星系の会社が資本 gv.K [cr] を持ち、年 CAPITAL.delta ずつ古くなる。
//   目当ての資本 K* = ky(y) × gv.kY ÷ (1 − delta × ky(y))。gv.kY = ならした (smooth 年) 市場の付加価値 + 政府が民間から買った分 (GOV_BUY。建設・維持費・予算)。
//   ÷ (1 − delta × ky) で、古くなった分の投資を足した GDP (国民経済計算の GDP = 消費 + 投資 + 政府。目標 R79 は資本 ÷ GDP) に対して資本 ÷ GDP が ky になる。ky(y) は星系の 1 人あたりの実質の所得 y (学歴と同じ c.incU。2011 年のドル) の ln で、
//   ky の 5 点 [所得, 資本 ÷ 産出] の間を直線で埋める (端より外は端の値)。5 点は Penn World Table 11.0 の資本 ÷ 産出 (cn ÷ rgdpo、2015〜2019 年) の、
//   所得の 5 分位ごとの所得と比の中央値 (目標 R79 と同じデータ。data/derived/capital.json の game.ky)。豊かな国ほど資本が多い。
//   会社は配当の前に、古くなった分 + 伸びの分 (ならした付加価値の伸び gv.kG × K*。0〜gmax) + 目当てとの差 × speed を投資する。払えるのは
//   その刻みの利潤 (付加価値の CAPITAL.alpha) まで (設備は手持ちの利潤で建てる。借りない)。建設の賃金として家計に払う (お金の種類 invest。利潤の使い道なので、
//   政府の買い物 (build) とは分ける。財政の目標の GDP (tools/fiscal-panel.js。付加価値 + 政府の買い物) に入れると、建設の賃金には税が掛からないので
//   税収 ÷ GDP (R19) が 0.134 → 0.105 に下がった。投資の目標の GDP (tools/capital-panel.js) には、国民経済計算のとおり投資として入れる)。
//   始めの資本は、初めて付加価値を測った刻みの K*。この段では資本は産出に効かない (B-119 の 2 で効かせる)。smooth・speed は仮の値
// 軍の維持費のうち主人の政府が払う割合 (約定の束の「軍事」の法ごと。QD-31 = c。回 SE6 の政治の返事: 宗 = 保護国・委任統治領・直轄など、分 = 藩部・自治領・封臣など、従 = 冊封・緩衝国など)
const UPKEEP_LORD = { S: 1, M: 0.5, V: 0 };
const GOV_BUY = new Set(['build', 'upkeep', 'welfare', 'security', 'military', 'education', 'public', 'health']); // 政府が民間から買う出入り (GDP に入る。tools/fiscal-panel.js と同じ)
const KSTOCK = { ky: [[2343, 2.37], [7106, 3.513], [13518, 4.315], [26436, 4.485], [50989, 4.706]], smooth: 5, speed: 0.5, gmax: OWNER.gmax };
saveField('capacity', (game) => (game.capacity.length ? game.capacity : undefined), {
  init: (game) => { game.capacity = []; },
  read: (game, d) => { game.capacity = Array.isArray(d.capacity) ? d.capacity.filter((k) => k && Number.isFinite(k.k) && k.k > 0 && game.system(k.sys)?.bodies.some((b) => b.id === k.body)) : []; },
});
// 部門ごとの 1 人あたりの産出の大きさ (開始時の生産性 ×1 のとき。docs/structure.md の 4)。farm = 食料 [単位/人/年] × (1 + 肥沃さ)、ind = 工業品 [単位/人/年]、
// mine = 埋蔵量の係数に掛ける倍率。前は farm 2 × (1 + 肥沃さ)・ind 1・mine 1 で、農業が最も生産的な部門だった (温暖な惑星で 1 人 4 単位。付加価値で工業の 1.4 倍)。
// 現実の低い所得の国では逆で、農業の 1 人あたりの付加価値は非農業の 1/4〜1/5 (GGDC 10 部門: 所得 604〜1,999 ドルの国で非農業 ÷ 農業 の中央値 5.4、
// 1,999〜5,516 ドルで 4.0。Gollin, Lagakos & Waugh 2014 の農業の生産性の差)。農業が最も生産的だと、人が農業に集まって食料を作りすぎ、
// 在庫が倉の上限に張りつく (R25 が 2.6 年)。ここでは、物差しで 1 人 約 1,500 ドルの「×1」の世界に合わせて、工業 ÷ 農業 の付加価値の比を約 4 にした
// home = 自給 (非市場の部門): 市場の稼ぎが「自分の食べる分を自分で作る値打ち」(食料 1 単位 × 基準の値段) を下回ると、人は市場の部門から自給に戻る
// (低い所得の国の自給農業。ILO の就業の数え方では農業に入る。労働供給の留保賃金)。自給の人は食料を 1 人 home 単位作って自分で食べる (技術の水準は掛からない。伝統的な農業)。
// 作りすぎで値段が床まで下がっても人が市場の部門に残り続け、在庫が倉の上限に張りつく (R25) のを、現実と同じ形で止める
// hi = 高付加価値の工業 (回 KE5): 1 人あたりの高付加価値物品 [単位/年]。付加価値は 1 単位 9.6 (値段 12 − 原料 2.4) で、低付加価値の工業 (3 単位 × 2.85) の 1.7 倍
// (中・高技術の製造業の労働生産性は低技術の 1.5〜2 倍ほど。仮の値)
const YIELD = { farm: 1, ind: 3, mine: 3, home: 1, hi: 1.5 };
// 高付加価値物品 1 単位の原料 (回 KE5): 低付加価値物品 0.5 単位と希少元素 0.05 単位 (機械・電子・船の部品)。質量は原料と同じ (RES_KG.hitech)。
// ramp: 利ざや (値段 − 原料) が値段のこの割合より薄いと、その分だけ作る量を減らす (market-economy.js の 2b)。どれも仮の値
const HITECH = { goods: 0.5, rare: 0.05, ramp: 0.5 };
// 輸送船 (回 KE5・B-116。ユーザーの依頼 2026-10-24。docs/trade.md の 9)。交易路で送れる量 [質量の単位/年、片道] = 走る船の数 × 1 隻の積み荷 ÷ 往復の年数
//   (前は交易路の段 × 200 単位/年で、距離によらず、数えるのも質量でなく単位だった)。質量の単位 = 100 万 t (UNIT_KG。食料・金属・燃料の 1 単位)。
//   payload: 1 隻の積み荷 [質量の単位]。hull: 船の質量 ÷ 積み荷 (光帆と磁気帆で加速・減速する軽い船)。船の質量のうち hitech の割合が高付加価値物品、残りが金属。
//   life: 船の年数 (UNCTAD の Review of Maritime Transport で、解体する船の平均の船齢は 25〜30 年)。port: 1 回の往復で港にいる年数。
//   運賃 [cr / 質量の単位 / 光年] = 船 1 隻の年の費用 ((CAPITAL.irr + 1 / life) × 船の値段) ÷ (1 隻が 1 年に運ぶ 質量 × 光年 = 積み荷 × 速さ × load)。
//     load = 行きと帰りを合わせた積みの割合の見込み。重くて安い物ほど、値打ちに比べて運賃が高い (荷の平均の距離 30 光年で、基準の値段に比べて食料 19%・燃料 9.5%・
//     金属 13%・低付加価値物品 2.3%・高付加価値物品 0.4%。hull は、ばら積みの貨物の運賃が値打ちの 1〜2 割という現実の目安 (Hummels 2007) に入るように選んだ)。
//   送れる量は、両端の港 (発射所と減速設備) の容量 (交易路の段 × base。前の送れる量と同じ) より多くならない。港を広げるのは前と同じく星系の政府 (交易路の拡張)。
//   運賃は交易路の持ち主 (開いた星系 r.by) の運送業の会社 (fm) が受け取り、買い手の会社が払う (freight)。運送業の会社は年に 1 回、自分の払いで (借りてよい) 船を造る:
//   使われている交易路は港の容量の分まで、使われた割合が idle 未満の交易路は片道 base の分まで (古くなった分と、港が広がった分)。
//   payload・hull・hitech・port・load は仮の値
const SHIPPING = { payload: 50, hull: 0.002, hitech: 0.1, life: 30, port: 0.1, load: 0.5, base: 200, idle: 0.3 };
// 市場の基準の値段 [cr] (値段の水準をかけたもの。開始時の生産性の物差し modern で割る)
const basePrice = (r) => PRICE[r] * (MARKET.buy ? MARKET.level / STRUCTURE.modern : 1);
// 発展段階の名前 (所得 y [ドル/人] から)
const stageName = (y) => (STRUCTURE.stages.find(([edge]) => (y || 0) < edge) || STRUCTURE.stages[STRUCTURE.stages.length - 1])[1];
const SECTORS = ['farm', 'mine', 'ind', 'hi', 'serv', 'home']; // home = 自給 (YIELD の説明)。hi = 高付加価値の工業 (回 KE5)
const MARKET_SECTORS = ['farm', 'mine', 'ind', 'hi', 'serv'];
const ABSORB = new Set(['consume', 'use', 'burn', 'build', 'ship', 'supply']); // 市場の需要に数える出入り (捨てた・奪われたは数えない)
// 方針 (前の版の FOCUS) から、始めの就業の割合を作る
const sharesOf = (focus) => { const f = FOCUS[focus] || FOCUS.balanced; return { farm: f.farm, mine: f.mine, ind: f.ind, hi: 0, serv: 0, home: 0 }; };
const zeroRes = () => { const o = {}; for (const r of RES) o[r] = 0; return o; };
const colKey = (c) => `${c.sys}|${c.body}|${c.kind}`;
// 経済の記録 (回 KE3・B-170。docs/structure.md の 8): 星系ごとに 1 年に 1 回、資源ごとの余り (在庫 − 2 年分の消費) と、入植地ごとの移民の受け入れ (食べ物と水が足りているか・空き) を記録する。
// 交易の買い手・移民の送り手は、光の遅れのぶん古い記録で相手を選ぶ (econSeen)。前は遠い星系のいまの在庫や空きを見ていた (光より速い。docs/research/game-physics-audit.md の 2.8 e)。
// { y: 最後に記録した年, s: { [星系]: [[年, [資源ごとの余り (RES の順)], { [入植地の鍵]: [受け入れられるか 0/1, 空き] }], …] } }。
// 値は 3 桁に丸める (セーブを小さくする)。いちばん遠い 2 つの星系の距離より古い記録は捨てる
saveField('econIntel', (game) => (Object.keys(game.econIntel.s).length ? game.econIntel : undefined), {
  init: (game) => { game.econIntel = { y: -Infinity, s: {} }; },
  read: (game, d) => { const o = d.econIntel; game.econIntel = o && typeof o === 'object' && o.s && typeof o.s === 'object' ? { y: Number.isFinite(o.y) ? o.y : -Infinity, s: o.s } : { y: -Infinity, s: {} }; },
});
// 光速で届く途中の返金 (回 KE3。trade.js の refund): [{ to: 受け手, from: 送り手, v: 額, at: 届く年 }]。hh: 1 は遠くの持ち主への配当 (受け手の家計へ。回 KE5。remit)。なければ書かない
saveField('refunds', (game) => (game.refunds.length ? game.refunds : undefined), {
  init: (game) => { game.refunds = []; delete game._remit; },
  read: (game, d) => { delete game._remit; game.refunds = Array.isArray(d.refunds) ? d.refunds.filter((r) => r && Number.isFinite(r.v) && Number.isFinite(r.at)) : []; },
});
// 銀河の汎用技術 (GPT。回 KE6。market-economy.js の gptStep): [{ t: 現れた年, inv: 発明した国の首都 }]。なければ書かない (回 DO7 で core/save.js の一覧からここへ移した)
saveField('gpts', (game) => (game.gpts?.length ? game.gpts : undefined), {
  read: (game, d) => { if (Array.isArray(d.gpts)) game.gpts = d.gpts; },
});
// 先住民と接触した年 { [星系]: 年 } (回 KE3。colonize.js の isSurveyed。接触の知らせは光速で広がる)。前の版のセーブ (項目がない) は、接触ずみの星系をずっと前から知っていたとして読む
saveField('surveyAt', (game) => (game.surveyAt && Object.keys(game.surveyAt).length ? game.surveyAt : undefined), {
  init: (game) => { game.surveyAt = {}; },
  read: (game, d) => { game.surveyAt = d.surveyAt && typeof d.surveyAt === 'object' ? Object.fromEntries(Object.entries(d.surveyAt).filter(([, v]) => Number.isFinite(v))) : {}; },
});
