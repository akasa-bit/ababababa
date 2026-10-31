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

### 品ごとの交易 (R01 の品ごとの幅。回 KE5)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_trade_goods.py` → `data/raw/trade_goods/` | CEPII BACI HS17 V202501 (Gaulier & Zignago 2010)。元の zip (約 690 MB) はリポジトリに置けないので、2017〜2019 年 (CEPII Gravity の距離と重なる年) の品目別の額を、HS の章・項・号の頭でゲームの資源 (食料・燃料・金属・低付加価値物品・高付加価値物品・水・希少元素・その他) にまとめて `baci_hs17_groups_2017_2019.csv.gz` (2.5 MB) に置く。元の zip の URL・取得日・SHA-256、まとめ方・行数・額の割合を `data/raw/trade_goods/MANIFEST.json` に記録する。同じ zip からは同じバイト列になる |
| 加工 | `data/build/analyze_trade_goods.py` (推定は `data/build/gravity.py`) → `data/derived/trade_goods.json` | 品ごとに R01 と同じ式 (PPML、輸出国×年・輸入国×年の固定効果、ln 距離だけ、空の組は使わない)。距離は `data/raw/trade/` の distw_harmonic |

```sh
python3 data/fetch/fetch_trade_goods.py     # 生データを取り直す (約 690 MB を落とす。約 3 分)
python3 data/build/analyze_trade_goods.py   # 推定する (numpy が要る。約 20 秒)
```

- **推定の結果**: 燃料 −1.251・食料 −1.088・金属 −1.060・低付加価値物品 −0.984・高付加価値物品 −0.782 (全部まとめると −0.842)。重くて値打ちの低い物ほど距離が効く。希少元素 −0.48・水 −1.89 は参考 (額が小さいか、ゲームの品と合わない)
- **工業品の分け方** (目標の版 17): 高付加価値物品 = 28〜38 章 (化学品・医薬品)・84〜93 章 (機械・電気機器・輸送機械・精密機器・武器)。OECD の研究開発の強さで中・高技術とされる産業で、R61 (UNIDO の中・高技術の製造業) と同じ分け方。低付加価値物品 = 残りの 25〜96 章。版 16 は合わせて工業品 (−0.819) にしていた
- **額の割合**: 高付加価値物品 50%・低付加価値物品 19%・燃料 13%・食料 9%・金属 6%・その他 (金・宝石・美術品など) 4%
- **限界**: HS の品目をゲームの 4 つの品に分けるのは粗い (たとえば 25 章の土石は工業品に入れた)。BACI は正の交易額しか載せない (R01 と同じ)

出典: Gaulier, G. & Zignago, S. (2010) BACI: International Trade Database at the Product-Level. The 1994-2007 Version, CEPII Working Paper 2010-23

## 製造業の中の高付加価値の割合のデータ (目標 R61。回 KE5)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_tech.py` → `data/raw/tech/` | 世界銀行 WDI の API: NV.MNF.TECH.ZS.UN (製造業の付加価値のうち中・高技術の産業の割合。UNIDO の Competitive Industrial Performance database)・NV.IND.MANF.ZS (製造業 ÷ GDP。参考)・NY.GDP.PCAP.PP.KD (1 人あたり GDP、2021 年の国際ドル)。国だけ。取得日・URL・SHA-256・行数を `MANIFEST.json` に記録する |
| 加工 | `data/build/build_tech.py` → `data/derived/tech.json` | 所得の 5 分位ごとの中・高技術の割合の 25%〜75% 点 (R61)。ゲームの需要の曲線 (工業品の需要の値打ちのうち高付加価値物品の割合 = logit を ln 所得に当てたもの。所得は 2021 年のドル ÷ 1.21 で 2011 年のドルに) |

```sh
python3 data/fetch/fetch_tech.py     # 生データを取り直す
python3 data/build/build_tech.py     # 計算する
python3 data/build/build_tech.py ゲームのパネル.csv   # ゲームの R61 を同じ分位で
```

- **結果**: 149 か国・5,184 国・年 (1990〜2024 年)。中・高技術の割合の中央値は所得の低い分位から 0.099・0.129・0.185・0.271・0.374。需要の曲線は logit = −6.127 + 0.490 ln y (y は 2011 年のドル。2,000 ドルで 0.08、50,000 ドルで 0.30)
- **限界**: これは作る側 (製造業の付加価値) の割合で、買う側の割合ではない。ゲームでは、工業品の需要の曲線 (これも工業の付加価値から当てたもの) を同じ割合で分ける。OECD の分け方は 2 桁の産業ごとで、同じ産業の中の品の違いは見ない

出典: UNIDO, Competitive Industrial Performance (CIP) database (World Bank WDI, NV.MNF.TECH.ZS.UN)・Galindo-Rueda, F. & Verger, F. (2016) OECD Taxonomy of Economic Activities Based on R&D Intensity, OECD Science, Technology and Industry Working Papers 2016/04

## 国の中の地域と労働分配率のデータ (目標 R38・R39。回 KE5)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_regions.py` → `data/raw/regions/` | DOSE v2 (Wenz ほか 2023。83 か国・1,661 地域・1953〜2020 年。Zenodo 7573249) の地域の 1 人あたり総生産と人口・統計の切れ目の 8 列 (`dose_v2.csv.gz`)、Penn World Table 10.01 (DataverseNL) の labsh・rgdpe・pop と、資本の irr・delta・cn・cgdpo・csh_i (`pwt1001.csv.gz`)。元のファイルの URL・取得日・SHA-256、列・行数を `data/raw/regions/MANIFEST.json` に記録する (pandas が要る) |
| 加工 | `data/build/build_regions.py` → `data/derived/regions.json` | R38: 地域の 1 人あたり総生産 (2015 年の値段) の 10 年の伸びを初めの ln に当てた β 収束 (国 × 期間の固定効果。重ならない 10 年。統計の切れ目をまたぐ組は使わない) と、国を引き直すブートストラップ。参考に、国の中の地域の 90% 点 ÷ 10% 点。R39: labsh の国ごとの中央値の分布と、所得の 5 分位ごとの四分位範囲。ゲームの資本の値 (`CAPITAL`): 資本の分け前 = 1 − labsh・減価償却・資本の収益率の国ごとの中央値 |

```sh
python3 data/fetch/fetch_regions.py     # 生データを取り直す (約 18 MB)
python3 data/build/build_regions.py     # 計算する (約 20 秒)
python3 data/build/build_regions.py 地域のパネル.csv [労働分配率のパネル.csv]   # ゲームの R38・R39 を同じ式で
```

- **結果**: R38 年 1.82% (54 か国・2,190 組。ブートストラップの 5〜95% 点 1.35〜2.20%。統計の切れ目を気にしないと 1.96%)。R39 国ごとの中央値の 10・50・90% 点 0.384・0.549・0.690 (138 か国)。所得の分位ごとの中央値は 0.50〜0.56 で、所得とほとんど関係がない
- **資本の値** (国ごとの中央値の 25・50・75% 点): 減価償却 0.035・0.040・0.047、資本の実質の収益率 0.068・0.107・0.164、資本 ÷ 産出 2.06・2.70・3.94、投資 ÷ GDP 0.154・0.208・0.260。ゲームの `CAPITAL` は alpha 0.451・delta 0.040・irr 0.107 (`data/derived/regions.json` の capital の game)
- **統計の切れ目**: DOSE の StructChange は、元のデータか地域の境が変わった年に 0 でない値をとる (Wenz ほか 2023 の Methods)。2015 年に 3 がつく国が多い (44 か国) ので、2010〜2020 年の組の多くは使っていない
- **限界**: DOSE は国によって始まりの年が違い (中央値 1995 年)、地域の数も違う。labsh は国によって推計のしかたが違う (PWT の文書)。3 か国はどの年も同じ値 (推計で埋めた値とみられる) で、そのまま入れた

出典: Wenz, L., Carr, R. D., Kögel, N., Kotz, M. & Kalkuhl, M. (2023) DOSE – Global data set of reported sub-national economic output, Scientific Data 10, 425・Feenstra, R. C., Inklaar, R. & Timmer, M. P. (2015) The Next Generation of the Penn World Table, American Economic Review 105(10), 3150–3182・Barro, R. J. & Sala-i-Martin, X. (1992) Convergence, Journal of Political Economy 100(2), 223–251

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

## 技術革新のデータ (目標 R66〜R77。回 KE6・B-120〜B-123)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | 前からある `data/raw/research/` (WDI の研究者 SP.POP.SCIE.RD.P6・研究開発費 GB.XPD.RSDV.GD.ZS。`data/fetch/fetch_research.py`)・`data/raw/tech/` (所得 NY.GDP.PCAP.PP.KD)・`data/raw/hcap/` (HCI の試験の点数 HD.HCI.HLOS) | |
| 取得 | `data/fetch/fetch_pwt.py` → `data/raw/tfp/pwt110.csv.gz` | Penn World Table 11.0 (DataverseNL の pwt110.xlsx、CC BY 4.0) の使う列 (ctfp・rtfpna・labsh・pop・emp・hc・rgdpe・rgdpo・cn・rnna)。185 か国 1950〜2023 年。取得日・SHA-256 は `MANIFEST.json` |
| 取得 | `data/fetch/fetch_hcap.py hci_lays.csv.gz` → `data/raw/hcap/hci_lays.csv.gz` | 世界銀行 Human Capital Index の学力で調整した就学年数 (HD.HCI.LAYS。2010〜2020 年) |
| 取得 | `data/fetch/fetch_rnd.py` → `data/raw/rnd/oecd_rnd.csv.gz` | OECD の MSTI (研究開発費 ÷ GDP・そのうち政府が出した割合) と R&D Tax Incentives (税の優遇と、政府が直接出した会社の研究開発費の、GDP と会社の研究開発費に対する割合)。59 の国と集計、1981〜2025 年。CC BY 4.0 |
| 取得 | `data/fetch/fetch_gpt.py` → `data/raw/gpt/` | Fernald の利用率を補正した TFP (サンフランシスコ連銀。米国の企業部門、1947〜2025 年の年率)・OWID の米国の家庭の技術の普及 (45 の技術。Comin & Hobijn ほか、CC BY 4.0)・WDI の携帯電話の契約とインターネットの利用者 |
| 加工 | `data/build/build_innovation.py` → `data/derived/innovation.json` | 所得の 5 分位ごとの研究者 (人口 100 万人あたり) の 25%〜75% 点 (R66)・ln 研究者を ln 所得と学力に当てた係数 (R67 と、ゲームの研究者の曲線 game.research) ・技術水準の国際比較 (technology。R68〜R72): 所得の 5 分位ごとの前線比、規模効果、収束、LAYS の効き、発展会計の学歴の割合 |

```sh
python3 data/build/build_innovation.py                 # 計算する
python3 data/build/build_innovation.py --game ゲームのパネル.csv   # ゲームの R66〜R72 を同じ区分で (tools/innovation-panel.js)
```

- **結果**: R66 は 138 か国・1,930 国・年。研究者の中央値は所得の低い分位から 95.9・696.0・1,571.8・3,220.4・4,642.0 人。R67 の学力の係数は 1.2098 (所得の係数 0.7712、R² 0.745、301 国・年)。学力を入れないと所得の係数は 1.3716
- **技術水準 (R68〜R72)**: ゲームの A は働き手 1 人あたりの産出に掛かるので、TFP を労働増大的な形 (ln ctfp ÷ その国と米国の労働分配率の平均) に直した。前線比の中央値は所得の低い分位から 0.175・0.295・0.446・0.627・0.894 (118 か国・3,479 国・年)。規模効果 (人的資本をそろえた ln 人口の係数) -0.0319、収束の傾き -0.01746、LAYS の係数 1.6062 %/年、学歴が所得のばらつきに占める割合 0.2095
- **研究開発 (R73〜R75)**: 研究開発費 ÷ GDP の中央値は所得の低い分位から 0.180・0.347・0.561・1.377・1.876%。政府が出す割合は国の中央値 32.4064%、税の優遇は GDP の 0.0299%。研究者 1 人の費用は 1 人あたり GDP の 5.19 倍 (rnd.cost)
- **汎用技術 (R76・R77)**: 前線の技術の伸びの 10 年の移動平均の標準偏差 0.9244 ポイント (労働増大的な形)。普及の logit の傾きの中央値 0.1226/年。採用の遅れは所得の 4 番目の分位から 3〜16 年
- 調べもの (536 件の目録) と、このあとの目標の案は `docs/research/innovation.md`

## 中立の利子率のデータ (回 KE6・B-118。ゲームの係数で、目標ではない)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_hlw.py` → `data/raw/hlw/` | Holston, Laubach & Williams (2023) の推計 (ニューヨーク連銀。米国・カナダ・ユーロ圏の四半期の潜在の伸び g・その他の要因 z・自然利子率 r*・需給ギャップ。片側の推計、2026 年 Q2 まで。推計に使った実質 GDP の対数も)・WDI の人口の伸び (SP.POP.GROW。米国・カナダ・ユーロ圏)。取得日・URL・SHA-256・行数は `MANIFEST.json` |
| 加工 | `data/build/build_rstar.py` → `data/derived/rstar.json` | 年平均の r* を、1 人あたりの潜在の伸び (g − 人口の伸び) に当てた最小二乗 (3 つの経済をまとめる): r* = 0.234 + 1.343 × 1 人あたりの伸び [% / 年] (184 の国・年、相関 0.80)。r* の 1%〜99% 点 0.23〜5.67%。HLW の g を実際の GDP の伸びの指数のならしでいちばんよく写す年数 5 年 (trend)。中央銀行の中立の金利 (`src/economy/fiscal-consts.js` の `CB.rs`・`CB.rsr`) |

## 投資と資本のデータ (目標 R78・R79。回 KE6・B-119)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | 前からある `data/raw/gni/` (WDI の総固定資本形成 ÷ GDP NE.GDI.FTOT.ZS)・`data/raw/tfp/` (Penn World Table 11.0 の cn・rgdpo)・`data/raw/tech/` (所得 NY.GDP.PCAP.PP.KD) | |
| 加工 | `data/build/build_capital.py` → `data/derived/capital.json` | 1 人あたり所得の 5 分位ごとの、投資 ÷ GDP の 25%〜75% 点 (R78。173 か国・5,378 国・年) と、資本 ÷ 産出 (cn ÷ rgdpo。2015〜2019 年) の 25%〜75% 点 (R79。174 か国) |

```sh
python3 data/build/build_capital.py                      # 計算する
python3 data/build/build_capital.py --game ゲームのパネル.csv   # ゲームの R78・R79 (tools/capital-panel.js。B-119 の実装で足す)
```

- **結果**: 投資 ÷ GDP の中央値は所得の低い分位から 19.22・23.06・21.64・22.83・22.18% (所得によらず約 20%)。資本 ÷ 産出の中央値は 2.37・3.51・4.32・4.49・4.71 (豊かな国ほど高い)

## GNI と GDP のデータ (目標 R65。回 KE5・B-114)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_gni.py` → `data/raw/gni/` | 世界銀行 World Development Indicators の API: NY.GNP.MKTP.CD (国民総所得)・NY.GDP.MKTP.CD (国内総生産)。名目の米ドル。BX.KLT.DINV.WD.GD.ZS (直接投資の受け入れ (純) ÷ GDP)・NE.GDI.FTOT.ZS (総固定資本形成 ÷ GDP)・BM.KLT.DINV.WD.GD.ZS (外への直接投資 ÷ GDP)。1990〜2024 年、国だけ。取得日・URL・SHA-256・行数を `MANIFEST.json` に記録する。所得は R61 と同じ `data/raw/tech/` の NY.GDP.PCAP.PP.KD |
| 加工 | `data/build/build_gni.py` → `data/derived/gni.json` | 所得の 5 分位ごとの GNI ÷ GDP の 25%〜75% 点 (R65)・国ごとの中央値の分布・ゲームの係数 (game): 新しい投資のうち外国が出す割合 (fdi = 直接投資 ÷ 総固定資本形成の国ごとの中央値の中央値)・外への直接投資 ÷ GDP の所得への弾力性 (outward) |

```sh
python3 data/fetch/fetch_gni.py     # 生データを取り直す
python3 data/build/build_gni.py     # 計算する
python3 data/build/build_gni.py ゲームのパネル.csv   # ゲームの R65 を同じ区分で (パネルは node tools/fiscal-panel.js の書き出し。列 gni・income)
```

- **結果**: 198 か国・6,623 国・年。GNI ÷ GDP の中央値は所得の低い分位から 0.989・0.982・0.976・0.971・0.991。国ごとの中央値の 10%〜90% 点は 0.942〜1.022。新しい投資のうち外国が出す割合は国ごとの中央値の中央値 0.110 (178 か国。25%〜75% 点 0.061〜0.176)。外への直接投資 ÷ GDP の所得への弾力性は 1.04 (受け入れ ÷ GDP は 0.24。172 か国)

## 学歴 (就学年数) と学力のデータ (目標 R62・R63・R64。回 KE5・B-117)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_hcap.py` → `data/raw/hcap/` | 世界銀行 Education Statistics (EdStats) の API: BAR.SCHL.25UP (25 歳以上の平均の就学年数)・BAR.SCHL.2529 (25〜29 歳) (`edstats_bl.csv.gz`)、5 歳ごとの区分 BAR.SCHL.2529〜BAR.SCHL.75UP (`edstats_age.csv.gz`)、SE.XPD.TOTL.GD.ZS (政府の教育の支出 ÷ GDP。UNESCO 統計研究所。`edstats_spend.csv.gz`)。Barro–Lee の推計 (Barro & Lee 2013) の写し。世界銀行 Human Capital Index (source 63) の HD.HCI.HLOS (調和された試験の点数。Patrinos & Angrist 2018。2010・2017・2018・2020 年。`hci_hlos.csv.gz`)。国だけ。ファイル名を並べると、そのファイルだけを取り直す。取得日・URL・SHA-256・行数を `MANIFEST.json` に記録する。所得は R61 と同じ `data/raw/tech/` の NY.GDP.PCAP.PP.KD |
| 加工 | `data/build/build_hcap.py` → `data/derived/hcap.json` | 所得の 5 分位ごとの就学年数の 25%〜75% 点 (R62)・10 年の伸びの、初めの就学年数の区分ごとの 25%〜75% 点 (R63)・ゲームの係数 (game): 若い世代の就学年数の曲線 (25〜29 歳の就学年数 = 14 ÷ (1 + exp(−(a + b ln y)))。所得は 2021 年のドル ÷ 1.21 で 2011 年のドルに)、教育の支出の効き方 (spend)、始めの年齢ごとの就学年数の形 (cohort)、学力の曲線 (learn)。所得の 5 分位ごとの試験の点数の 25%〜75% 点 (R64。learning) |

```sh
python3 data/fetch/fetch_hcap.py     # 生データを取り直す (python3 data/fetch/fetch_hcap.py hci_hlos.csv.gz で試験の点数だけ)
python3 data/build/build_hcap.py     # 計算する
python3 data/build/build_hcap.py ゲームのパネル.csv   # ゲームの R62・R63・R64 を同じ区分で
```

- **結果**: R62 は 141 か国・702 国・年 (1990〜2010 年の 5 年ごと)。就学年数の中央値は所得の低い分位から 3.06・5.49・7.23・9.30・9.91 年。R63 は 144 か国・720 組 (1960〜2010 年)。伸びの中央値は初めの就学年数の低い区分から 0.053・0.098・0.118・0.114・0.110・0.066 年/年。若い世代の曲線は logit = −5.883 + 0.711 ln y (R² 0.59。200 ドルで 1.5 年、5,000 ドルで 7.6 年、60,000 ドルで 12.2 年)。R64 は 170 か国・595 国・年。試験の点数の中央値は所得の低い分位から 368.2・388.1・419.0・485.4・517.2 点。学力の曲線は 点数 = 300 + 325 ÷ (1 + exp(−(−6.834 + 0.675 ln y))) (R² 0.61。200 ドルで 312 点、5,000 ドルで 382 点、60,000 ドルで 509 点)。教育の支出を足すと、支出 1% (GDP 比) あたり logit +0.056 (国を引き直すブートストラップの 5〜95% 点 0.005〜0.109。136 か国・441 国・年)
- **限界**: 世界銀行の写しは 2010 年まで (Barro–Lee の元の表は 2015 年まで)。就学年数は学校に通った長さで、学んだ中身 (学力) は数えない。国の中の差 (地域・階層) は見ない
- **ゲームの係数** (回 KE5・B-117。目標ではない): 教育の支出 ÷ GDP が 1% 高いと、25〜29 歳の就学年数の logit が 0.059 高い (ln y と一緒に当てた。131 か国・488 組。国を引き直す 5%〜95% 点 0.027〜0.126)。年齢ごとの就学年数は、年上の区分ほど学校を出たころの所得が年 4.5% ずつ低かったとみると、5 歳ごとの区分 (7,722 組) をよく再現する
- **元の頁**: Barro–Lee の頁 (barrolee.github.io) の表は「All rights reserved」(引用すれば使ってよい) なので、生データは CC BY 4.0 の世界銀行の写しから取った

## 家臣の要求への返事のデータ (QD-41 = c・B-142。ゲームの係数で、目標ではない)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_demands.py` → `data/raw/demands/` | Germann & Sambanis 2021 (International Organization) の再現データ (Harvard Dataverse。CC0) から、一度でも自決を求める運動 (SDM 1.0) のあった EPR の集団の行と使う列だけ。GeoEPR 2021 から集団の地域の重心だけ、CShapes 2.0 から首都の位置と国の面積だけ (どちらも CC BY-NC-SA 4.0。研究のための抜き出しで、ゲームには係数だけを入れる)。取ってきたままのファイルの SHA-256 は `MANIFEST.json` |
| 加工 | `data/build/analyze_demands.py` → `data/derived/demands.json` | 運動が続いている集団・年 (263 集団・7,774 集団・年・1947〜2012) に、その年に政府が譲ったか (自治を新しく与えた・締め出しをやめた。139 年 = 1.8%) を、ln 人口の割合・ln 首都までの距離 ÷ 国の半径・前の年の武力の紛争でロジット回帰: 0.246・0.363・0.712。AI の主人の判断 (`src/politics/policy-consts.js` の `DEMAND_AI`) |

- **限界**: 運動の年ごとの譲歩で、ゲームの「要求 1 回への返事」とは単位が違う。水準 (のむ割合の平均) は実データから出さず、前の AI の半々にそろえた (`docs/demands.md` の 3)。遠さの割り方 (国の半径か、集団の距離の中央値か) で遠さの係数が 0.36 と 0.21 に分かれる

## 星系の中の集団の価値観のデータ (QD-42。回 SE6 の続き。ゲームの係数で、目標ではない)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_values.py` → `data/raw/values/` | Global Flourishing Study の 1・2 年目の全世界の個票 (Gallup・Center for Open Science。CC BY 4.0) から、国・1 年目の重み・世帯の所得の区分・この国で生まれたか・9 項目の 1 年目だけを gzip で (`gfs_wave1_values.csv.gz`。207,919 人・2.3 MB)。世界銀行 WDI の 1 人あたり GDP (購買力平価の 2021 年のドル。2022 年)。取ってきたままのファイルの SHA-256 は `MANIFEST.json` |
| 加工 | `data/build/analyze_values.py` → `data/derived/values.json` | 伝統 ↔ 世俗 (宗教の大切さ・集まり・法に従う) と生存 ↔ 自己表現の近い形 (信頼・暮らしの心配のなさ・幸福) の国の平均を ln 1 人あたり GDP に当てた切片と傾き (23 の国と地域。相関 0.88・0.28)、国の中の所得の 5 分位ごとの差とよそ生まれの差 (国の固定効果つき)。`src/politics/groups-consts.js` の `GROUPS.values` |
| 加工 | `data/build/build_ineq.py` → `data/derived/ineq.json` | 所得の 5 分位の分け前 (WDI) を対数正規 (ばらつき σ) に当てはめ、上位 20% の分け前の国の平均の分布 (R84)・σ の国の平均の分布と国の中の年ごとのばらつき・σ を農業の就業の割合に当てた傾き。`--game` でゲームの星系のパネルに同じ式 (回 KE11) |

- **限界**: 22 か国と香港だけ。生存 ↔ 自己表現は WVS の目印の項目 (脱物質主義・寛容・署名) がなく、暮らしの安心と信頼・幸福で作る近い形。所得の区分は国ごとに粗く、分位の境は区分の境に寄る。世界価値観調査の個票は「非営利に限る・再配布しない」が条件なので使っていない (前の近い形は QoG の WVS の国の平均。`data/raw/groups/qog_wvs.csv` は比べるために残す)

## 国ごとに違う開始の大きさのデータ (回 SE8・B-029・QD-111 = c。ゲームの係数で、目標ではない)

| 段 | 場所 | 中身 |
|---|---|---|
| 取得 | `data/fetch/fetch_nations.py` → `data/raw/nations/` | Correlates of War の国力の指標 6.0 (National Material Capabilities。zip の中の abridged の zip の CSV。国・年ごとの総人口・軍の人員・軍事費ほか。1816〜2016 年)。取ってきたままのファイルの SHA-256 は `MANIFEST.json`。1820 年の国の人口は、前から置いてある Maddison Project Database 2023 (`data/raw/productivity/mpd2023_full.csv.gz`) を使う |
| 加工 | `data/build/analyze_nations.py` → `data/derived/nations.json` | 1820 年の国 (いまの国境の 90 か国) の人口 ÷ 中央値 (204.5 万人) の 10・25・50・75・90% 点: 0.089・0.262・1・2.26・6.25 (照合: COW の 1820 年の主権国家 23 か国で 0.28・0.43・1・3.0・7.8)。1816〜1850 年の国・年 (年の固定効果つき) で ln 軍の人員 の ln 総人口 への傾き 0.958 (国でまとめた標準誤差 0.078・37 か国・924 国・年)、ln 軍事費 の傾き 1.135 (0.075)。`src/politics/nations.js` の `NATION_SIZE` |

- **限界**: Maddison の 1820 年は、いまの国境で数えた人口 (当時の国でない地域も 1 つに数える)。ゲームは 10〜90% 点のあいだから引き、母星の人口の上限があるので比を 0.5 乗に縮めている (補正の台帳の C21)。軍の人員と軍事費の傾きは 19 世紀前半の主権国家だけ
