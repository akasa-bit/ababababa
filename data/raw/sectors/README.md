# 産業構造の生データ (セッション 9 の目標 R10)

取得: `python3 data/fetch/fetch_sectors.py`。加工: `python3 data/build/build_sectors.py` → `data/derived/sectors.json` (ブートストラップで 3 分ほど)。

| ファイル | 中身 | 出典 |
|---|---|---|
| `10sd_jan15_2014.xlsx` | 10 部門の付加価値と就業者 (42 か国・1950〜2012 年)。そのまま | Timmer, de Vries & de Vries 2015, "Patterns of Structural Change in Developing Countries", Routledge Handbook of Industry and Development (GGDC 10-Sector Database, 2014 年 1 月版) |
| `mpd2023.csv.gz` | 1 人あたり所得 (2011 年の国際ドル) と人口。1800 年から | Bolt & van Zanden 2024, Maddison Project Database 2023 (doi:10.34894/INZBF2) |
| `wdi_sectors.csv.gz` | 農業・工業・サービスの就業者の割合 (ILOSTAT のモデル推計) と 1 人あたり所得 (PPP)。国だけ | 世界銀行 WDI (CC BY 4.0) |

- ILOSTAT の窓口 (rplumber.ilo.org) は中身が空で返ったので、WDI に載っている ILOSTAT の推計を使った。
- GGDC の 42 か国のうち、Maddison と国の記号が合った 31 か国を使った (`build_sectors.py`)。
