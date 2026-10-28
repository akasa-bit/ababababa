# 星系の中の集団の生データ (回 SE6・B-020。目標 R42)

`python3 data/fetch/fetch_groups.py` で取る (手で書き換えない)。取得日・URL・SHA-256 は `MANIFEST.json`。計算は `python3 data/build/analyze_groups.py` (結果は `data/derived/groups.json`)。

| ファイル | 中身 | 使う所 |
|---|---|---|
| `EPR-2021.csv` | EPR Core 2021: 国ごとの民族の集団の、期間ごとの人口の割合と、中央の政治権力への近さ (独占・優位・上級の分担・下級の分担・無力・差別・自ら離脱) | R42 の締め出された割合・集団の形 |
| `ACD2EPR-2021.csv` | 武力紛争の当事者と EPR の集団のつながり (claim・recruitment) | 民族の紛争かどうか |
| `ucdp-dyadic-211.csv` | UCDP 二者間の紛争 21.1 (組・年・争点) | 紛争の始まりの年と、争点が領土か |
| `wdi_quintiles.csv` | WDI の所得の 5 分位の分け前 (%) | 集団の所得 |
| `qog_wvs.csv` | QoG Standard Cross-Section (2025 年 1 月) の WVS の国の平均の項目 5 つと 1 人あたり GDP | 価値観の 2 軸の近い形 |

引用: Vogt ほか 2015 (JCR 59(7))・UCDP (CC BY 4.0)・World Bank WDI (CC BY 4.0)・Teorell ほか (QoG Jan25)。WVS の個票 (2 軸を正しく作るのに要る) は登録が要るので取っていない。
