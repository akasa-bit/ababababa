# データ

生データは取得スクリプトで取り、手で書き換えません。ゲームで使う形への加工も、スクリプトで行います。

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_stars.py` → `data/raw/` | CNS5 (VizieR J/A+A/670/A19)・Mamajek の主系列星の表・NASA Exoplanet Archive (27 pc 以内)・SIMBAD の固有名とスペクトル型。取得日・URL・SHA-256・行数を `data/raw/MANIFEST.json` に記録する |
| 加工 | `data/build/build_stars.py` → `data/derived/stars.json` と `src/index.html` | 銀河座標の 3 次元の位置、連星・近い天体 (0.25 光年以内) のまとめ、スペクトル型と物理量、銀河面から ±17 光年の板の中で近い順に 600 系、既知の惑星の結びつけ。`src/index.html` の `STARS:BEGIN` と `STARS:END` のあいだに書く |

```sh
python3 data/fetch/fetch_stars.py   # 生データを取り直す (ネットにつながる環境で)
python3 data/build/build_stars.py   # 加工してゲームに書き込む
node tools/build.mjs                # 公開用の index.html を作る
```

## 加工の決まり

- **位置**: 赤経・赤緯・視差から、銀河座標 (x = 銀河中心の方向、y = 銀河の回転の方向、z = 銀河の北極の方向) の位置 [光年] を出す
- **恒星系**: 同じグリーゼ番号の組と、互いに 0.25 光年以内の天体を 1 つにまとめる (ケンタウルス座アルファ AB とプロキシマが 1 つになる)
- **スペクトル型と物理量**
  - HIP 番号のある恒星 (連星なら主星) は、SIMBAD のスペクトル型を使う。明るい星は Gaia の測光が飽和するため
  - それ以外は、Gaia の色 (G−RP) と絶対等級から Mamajek の表で求める
  - 同じ色の主系列星より 3.5 等以上暗ければ白色矮星、2.5 等以上明るければ巨星とみなす。L・T・Y 型は褐色矮星として除く
- **範囲**: 銀河面からの高さが ±17 光年の板の中で、銀河面に沿った距離が近い順に 600 系。ゲームの銀河の版 3 からは、そのうち ±2 光年 (`THIN_SLAB`) の中の 72 系と太陽だけを使う (表は版 2 までのセーブのために、そのまま残す)
- **既知の惑星**: Gaia DR3 番号か HIP 番号で恒星に結びつける。連星の伴星を回る惑星は、その伴星を主星として温度などを決める
- **連星の間隔**: 空の上での角距離 × 距離 (奥行きの差は分からないので、実際の間隔の下限の目安)

## 分かっている限界

- CNS5 は、ケンタウルス座アルファ A と B を 1 つの天体 (AB) として載せている。そのため、ゲームでも A と B は 1 つの恒星として扱う
- 色からの推定は主系列星の表に頼るので、若い星・金属の少ない星では温度や質量が少しずれる
- 褐色矮星だけの系は除いた

## 歴史と社会のデータ

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_history.py` → `data/raw/history/` | COLDAT (Becker 2019、植民地の期間)・ICOW Colonial History 1.1 (独立と暴力)・国の位置 (Google DSPL)・Correlates of War 国家間戦争 4.0・Correlates of War 国家の一覧 2016 (その年の国の数)・UCDP Conflict Termination 4-2024・CDB90 (陸上の戦闘)。取得日・URL・SHA-256・行数を `data/raw/history/MANIFEST.json` に記録する |
| 加工 | `data/build/analyze_history.py` → `data/derived/history.json` | 植民地の存続年数の中央値・Cox 比例ハザードモデル (遅れ ÷ 1 世代・本国・植民の始まりの年)・独立が暴力を伴った割合・戦争の長さの平均 ÷ 中央値・国家間戦争の多さ (国 100 年あたりの参加の始まり)・戦死者数のべき指数・紛争の終わり方の割合・戦闘の勝敗と兵力比 |

```sh
python3 data/fetch/fetch_history.py    # 生データを取り直す
python3 data/build/analyze_history.py  # 統計量を計算する (numpy が要る)
```

- **植民地の遅れ**: 本国の首都から植民地の国の中心までの大円距離 × 1.3 (航路の長さ) ÷ 150 km/日 (帆船の目安) を、知らせの片道の年数とした。1 世代は 28 年
- **CDB90 の勝敗**: この版の CSV では、元の −1 (防御側の勝ち) が空欄になっている。損害の比で確かめて、空欄を防御側の勝ちとして読む
- **限界**: COLDAT はいまの独立国だけを載せるので、どの植民地も独立で終わっている (いまも続く属領は入らない)。存続年数は植民の始まりの年に強くよる (遅く始まった植民地ほど短い。20 世紀半ばの脱植民地化の波)

出典: Becker, B. (2019) COLDAT, Harvard Dataverse・Hensel, P. R. ICOW Colonial History Data Set 1.1・Sarkees & Wayman (2010) Resort to War (COW 4.0)・Kreutz, J. (2010) UCDP Conflict Termination・CAA (1990) CDB90 / Arnold, J. B. CDB90 (ODC-By)・Google DSPL countries.csv (Apache 2.0)

## 交易のデータ

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_trade.py` → `data/raw/trade/` | CEPII Gravity V202211 (Conte, Cotterlaz & Mayer 2022)。元の zip (約 200 MB、中の CSV は 1.25 GB) はリポジトリに置けないので、2000〜2019 年の行と推定に使う 11 列だけを `cepii_gravity_2000_2019.csv.gz` (6.5 MB) に取り出す。元の zip の URL・取得日・SHA-256、取り出した列・行数・SHA-256 を `data/raw/trade/MANIFEST.json` に記録する。同じ zip からは同じバイト列になる |
| 加工 | `data/build/analyze_trade.py` (推定は `data/build/gravity.py`) → `data/derived/trade.json` | 重力モデルの PPML 推定 (輸出国×年・輸入国×年の固定効果)。本推定は ln 距離だけ。参考に、制御変数 (隣接・公用語・植民地・自由貿易協定) あり・空の交易額を 0 とする・距離を dist にする・年ごとも出す |

```sh
python3 data/fetch/fetch_trade.py       # 生データを取り直す (約 200 MB を落とす)
python3 data/build/analyze_trade.py     # 推定する (numpy が要る。約 1 分)
```

- **推定の結果**: 本推定 −0.874。制御変数あり −0.680、空の交易額を 0 −0.873、距離を dist にする −0.871。年ごとでは 2000 年の −0.89 から 2019 年の −0.85 へ少しずつ小さくなる
- **推定のコード**は、ゲームの自動対戦の書き出しにもそのまま使う (目標の決まり「実データと同じ統計コードで計算する」)
- **限界**: BACI は正の交易額しか載せないので、空の組が 0 なのか、記録がないのかを区別できない (参考の推定で、どちらでもほぼ同じになることを確かめた)

出典: Conte, M., Cotterlaz, P. & Mayer, T. (2022) The CEPII Gravity database, CEPII Working Paper 2022-05・Santos Silva, J. M. C. & Tenreyro, S. (2006) The Log of Gravity, Review of Economics and Statistics 88, 641–658・Correia, S., Guimarães, P. & Zylkin, T. (2020) Fast Poisson estimation with high-dimensional fixed effects, Stata Journal 20, 95–115・Disdier, A.-C. & Head, K. (2008) The Puzzling Persistence of the Distance Effect on Bilateral Trade, Review of Economics and Statistics 90, 37–48

## 財政と金融のデータ (目標 R19〜R22)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_fiscal.py` → `data/raw/fiscal/` | Jordà–Schularick–Taylor Macrohistory Database R6 (18 か国 1870〜2020 年。税収・政府支出・政府債務・利子率・民間の信用・名目 GDP) と文書、Schmelzing (2020) の 1311〜2018 年の世界の実質利子率。取得日・URL・SHA-256・大きさを `data/raw/fiscal/MANIFEST.json` に記録する |
| 加工 | `data/build/analyze_fiscal.py` → `data/derived/fiscal.json` | 国ごとの税収 ÷ GDP・政府が黒字だった年の割合・政府債務 ÷ GDP・民間の信用 ÷ GDP・政府支出 ÷ GDP (R27)・財政の反応 (R28。Bohn 1998 の形の国ごとの傾き。戦争の年は `data/raw/history/` の Correlates of War から) と、国のあいだの 10%〜90% 点 (全期間・1870〜1913 年・1950〜2020 年) |

- **同じ台本でゲームも測る**: `python3 data/build/analyze_fiscal.py <ゲームのパネル.csv>` で、ゲームが書き出した同じ列のパネル (`tools/fiscal-panel.js`) を同じ式で計算する
- **国ごとの値をとる理由**: 長く載っている国の重みが偏らないように、まず国ごとの中央値 (黒字の割合は平均) を出し、国のあいだの分布を見る
- **限界**: JST の revenue と expenditure は中央政府 (国によって範囲が少し違う。JST の文書を参照)。ゲームは首都と従属星系の政府をまとめた一般政府で比べる。Bank of England の「A millennium of macroeconomic data」(約 27 MB) は大きすぎるので取っていない

出典: Jordà, Ò., Schularick, M. & Taylor, A. M. (2017). Macrofinancial History and the New Business Cycle Facts. NBER Macroeconomics Annual 31, 213–263・Schmelzing, P. (2020). Eight centuries of global real interest rates, R-G, and the 'suprasecular' decline, 1311–2018. Bank of England Staff Working Paper 845

## 市場のデータ (目標 R23〜R26)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_market.py` → `data/raw/market/` | World Bank Commodity Price Data (Pink Sheet) の年次の表、USDA PSD の小麦・とうもろこし・米の期末在庫と国内消費 (国ごと・年ごと。元の zip から取り出したもの)、FRED ISRATIO (米国の企業全体の在庫 ÷ 売上、月次)。取得日・URL・SHA-256 を `data/raw/market/MANIFEST.json` に記録する |
| 加工 | `data/build/analyze_market.py` → `data/derived/market.json` | 品目ごとの Δln(実質の値段) の標準偏差と、傾向を除いた ln(値段) の 1 年の自己相関 (Deaton & Laroque 1992)、世界の穀物の在庫 ÷ 消費、在庫 ÷ 月の売上の 10%〜90% 点 |

- **品目とゲームの資源の対応**: 食料 ← 穀物・油・砂糖・肉など 18 品目、金属 ← アルミ・鉄鉱石・銅・鉛・すず・ニッケル・亜鉛、燃料 ← 原油・石炭・天然ガス、希少元素 ← 金・白金・銀 (`GROUPS`)。水・工業品・奴隷に対応する一次産品はない
- **世界の穀物**: PSD は世界の行を持たないので、国を足し上げる (PSD の世界の値も同じ足し上げ)
- **限界**: Pink Sheet の実質の値段は、先進国の工業品の輸出の単価 (MUV) で割ったもの。ISRATIO は米国だけ

出典: World Bank (2026) Commodity Price Data (The Pink Sheet)・USDA Foreign Agricultural Service, Production, Supply and Distribution Online・U.S. Census Bureau, Total Business: Inventories to Sales Ratio (FRED ISRATIO)・Deaton, A. & Laroque, G. (1992) On the Behaviour of Commodity Prices, Review of Economic Studies 59, 1–23

## 物理 (星間の気体・宇宙線と遮蔽) のデータ

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_ism.py` → `data/raw/ism/` | Linsky, Redfield & Tilipman 2019 の表 2 (近くの星 62 本の視線の log N(H I)。arXiv 1910.01243 の原稿の LaTeX から表だけ)・NIST PSTAR (水の中の陽子)・PDG の水の性質。取得日・URL・SHA-256・行数を `data/raw/ism/MANIFEST.json` に記録する |
| 加工 | `data/build/build_ism.py` → `data/derived/ism.json` と `src/index.html` の `ISM` | 16.5 pc 以内の 24 本の視線から、雲の中を通る割合を出し、雲の中 (中性と電離した水素・ヘリウム・塵) と外 (圧力のつり合う電離した気体) の核子を足した、航路の平均の数密度 |
| 計算 | `data/build/g4_all.sh` (`g4_shield.py`・`g4_stages.sh`・`make_gcr_source.py`) → `data/derived/g4/` | Geant4 11.4 で、水の板の中の深さと線量 (前: 星間の気体の陽子とヘリウム、横: 船の系に直した銀河宇宙線)。4 コアで 2〜3 時間。Geant4 は `pip install geant4_pybind numpy` (初めての import で約 2 GB のデータを落とす) |
| 加工 | `data/build/build_shield.py` → `data/derived/shield.json` と `src/index.html` の `SHIELD_DOSE`・`SHIELD_GCR` | 段を継ぎ、線量の山から先を減る形に均した表。確かめ (PSTAR・PDG・MSL の実測) |
| 見積もり | `data/build/side_checks.py` → `data/derived/physics_checks.json` | ゲームに入れなかった物理の桁 (熱・気体の抵抗・横の宇宙線の比・回折・加速の時間) |

```sh
python3 data/fetch/fetch_ism.py
python3 data/build/build_ism.py
data/build/g4_all.sh <Geant4 の入った python> <作業場所> && cp <作業場所>/*.json data/derived/g4/
python3 data/build/build_shield.py
python3 data/build/side_checks.py
node tools/build.mjs
```

中身と結果は `docs/physics.md`。出典: Linsky, Redfield & Tilipman (2019) ApJ 886, 41・Slavin & Frisch (2008) A&A 491, 53・Krüger ほか (2015) ApJ 812, 139・NIST PSTAR・PDG・Vos & Potgieter (2015) ApJ 815, 119・Simpson (1983) Ann. Rev. Nucl. Part. Sci. 33, 323・Zeitlin ほか (2013) Science 340, 1080

## M 型星のフレアのデータ

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_tess.py <置き場>` → `data/raw/tess/MANIFEST.json` | ゲームの M 型星 (CNS5 の 1 つずつ) の TIC 番号 (VizieR IV/39) と、TESS の 2 分ごとの光度曲線 (MAST、1 星 4 セクタまで、約 290 MB)。光度曲線はリポジトリに置かず、URL と SHA-256 を記録する。TESS の感度の曲線 `tess-response-function-v2.0.csv` (HEASARC) |
| 取得 | `data/fetch/fetch_flares.py` → `data/raw/flares/` | Günther ほか 2020 の表 2 と TIC の位置、Galletta ほか 2025 の表 3 (10 pc 以内)、Papaioannou ほか 2023 の付録 C (太陽の陽子の現象 65 回)、NOAA の GOES の X 線のフレアの記録 (1984〜2017 年) |
| 加工 | `data/build/flares_tess.py <置き場>` → `data/derived/tess_flares.json` | 光度曲線からフレアを数える (移動中央値・3σ が 3 点・注入と回収で E90)。エネルギーは 9,000 K の黒体 |
| 加工 | `data/build/build_flares.py` → `data/derived/flares.json` と `src/index.html` の `FLARES` | 星ごとの分布の当てはめ (露出で重み・最尤法)、太陽で測った X 線 → 陽子の関係と、陽子が来る割合、1 AU の 1 年の F(>10 MeV) |

出典: Ricker ほか (2015) TESS・Stassun ほか (2019) / Paegert ほか (2021) TIC・Günther ほか (2020) AJ 159, 60・Galletta ほか (2025) A&A 698, A180・Papaioannou ほか (2023) A&A 671, A66・Cliver ほか (2020) ApJ 903, 41・NOAA NCEI GOES XRS flare reports・Davenport (2014) ApJ 797, 122

## 生産性のデータ (開始時に選ぶ「生産性」の「2300 年の予測」)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_productivity.py` → `data/raw/productivity/` | Long-Term Productivity Database v2.7 (Bergeaud, Cette & Lecat。25 か国 1890 年〜の労働生産性・TFP・1 人あたり GDP)、Maddison Project Database 2023 の「Full data」(国ごと・年ごとの 1 人あたり GDP と人口。元の xlsx から CSV にしたもの)。取得日・URL・SHA-256 を `data/raw/productivity/MANIFEST.json` に記録する |
| 加工 | `data/build/forecast_productivity.py` → `data/derived/productivity.json` | 米国の労働生産性の伸び (1890・1950・1973・2005 年から 2023 年)、コンドラチェフの波 (周期 40〜70 年の正弦波の当てはめ。Maddison でも確かめる)、2300 年の倍率 |

- **最前線は米国**: 各年にいちばん高い国をとると、2005 年以後はアイルランドやノルウェーになり、GDP の測り方の事情で高く出るので使わない
- **限界**: 長い波の当てはまりは弱い (R² 0.1〜0.2)。2300 年の倍率は、延ばす伸びの選び方で ×33〜×253 と大きく変わる (`docs/productivity.md`)

出典: Bergeaud, A., Cette, G. & Lecat, R. (2016) Productivity Trends in Advanced Countries between 1890 and 2012, Review of Income and Wealth 62(3), 420–444・Bolt, J. & van Zanden, J. L. (2024) Maddison style estimates of the evolution of the world economy: A new 2023 update, Journal of Economic Surveys
## スウォームの太陽電池の劣化のデータ

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_pv.py` → `data/raw/pv/` | GaAs の陽子の NIEL (SR-NIEL v11.1 の計算機、Ed = 21 eV、0.01〜1,000 MeV)・NIST PSTAR のパイレックス (カバーガラスの代わり) |
| 加工 | `data/build/build_pv.py` → `data/derived/pv.json` と `src/index.html` の `PV_DAMAGE` | フレアの陽子 (ε = 2.13) がカバーガラスを通って接合に与える変位損傷の線量、3 接合の電池の出力の残り (Walters ほか 2004 の C・Dx)、太陽の 1 AU での確かめ |

出典: SR-NIEL (Boschini ほか、www.sr-niel.org)・NIST PSTAR・Walters, Morton & Messenger (2004) NASA/TP-2004-213338・Lohmeyer, Aniceto, Cahoy & Carlton (2018) Int. J. Space Sci. Eng. 5, 61

## 従属国の歴史のデータ (レーン H)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_vassal.py` → `data/raw/vassal/` | ISD 2.2・Lake 2009 の国・年の複製データ・Seshat Equinox-2020 (CC BY-NC-SA 4.0)・COW Colonial/Dependency Contiguity 3.1。手で作った事例の一覧・コードブック・2 回の符号化・裁定・条件も同じフォルダ (出典と決め方は `data/raw/vassal/README.md`) |
| 加工 | `data/build/build_vassal.py` → `data/derived/vassal.json` | 事例ごとの最終の束 (8 項目 × 法と実態)・Krippendorff の α・ISD と ICOW との突き合わせ・Lake の指標 |
| 解析 | `data/build/analyze_vassal.py` → `data/derived/vassal_survival.json` | 型と家族ごとの存続 (Kaplan–Meier とブートストラップの区間)・Cox (家族・束・項目)・移り変わり・暴力の割合・QCA・条件と型 |

結果の説明は `docs/vassal-cases.md`。

## 物理学者が SF に付けた文句 (P-6)

| 段 | 場所 | 中身 |
|---|---|---|
| 集め | `data/raw/sf_critiques/` | 物理学者・天文学者が、SF の映画・テレビ・ゲーム・アニメ・コミックの描写を物理で論じた 349 件 (6 組に分けて集め、どれも出典のページを開いて確かめた URL つき)。`classified.json` は事例ごとの分類 (今の知見で正しいか・物理の論点・ゲームに当てはまるか) |
| 加工 | `data/build/build_sf_critiques.py` → `data/derived/sf_critiques.json` | 物理学者の指摘で、今の知見で正しい 266 件を選び、ゲームへの当てはまりを集計する。中身は `docs/sf-critiques.md` |
