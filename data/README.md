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
| 取得 | `data/fetch/fetch_history.py` → `data/raw/history/` | COLDAT (Becker 2019、植民地の期間)・ICOW Colonial History 1.1 (独立と暴力)・国の位置 (Google DSPL)・Correlates of War 国家間戦争 4.0・UCDP Conflict Termination 4-2024・CDB90 (陸上の戦闘)。取得日・URL・SHA-256・行数を `data/raw/history/MANIFEST.json` に記録する |
| 加工 | `data/build/analyze_history.py` → `data/derived/history.json` | 植民地の存続年数の中央値・Cox 比例ハザードモデル (遅れ ÷ 1 世代・本国・植民の始まりの年)・独立が暴力を伴った割合・戦争の長さの平均 ÷ 中央値・戦死者数のべき指数・紛争の終わり方の割合・戦闘の勝敗と兵力比 |

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
