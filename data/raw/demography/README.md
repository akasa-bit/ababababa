# 年齢つきの人口の生データ (セッション 10 の目標の幅の案と、5 歳きざみのコーホートの率)

取得: `python3 data/fetch/fetch_demography.py` (約 1 分。元のファイルは合わせて約 270 MB を落として、下の行と列だけを置く)。加工: `python3 data/build/build_demography.py` → `data/derived/demography.json`。

| ファイル | 中身 | 出典 |
|---|---|---|
| `wpp_pop_age5.csv.gz` | 国ごと・1950〜2020 年の 5 年ごと + 2023 年の、1 月 1 日の人口 (5 歳きざみ × 性別、千人) | UN DESA, World Population Prospects 2024 |
| `wpp_lifetable_age5.csv.gz` | 簡易生命表 (5 歳きざみ × 性別の mx・qx・ex)、10 年ごと + 2023 年 | 同上 |
| `wpp_asfr_age5.csv.gz` | 年齢別出生率 (5 歳きざみ、女性千人あたり) と出生数 | 同上 |
| `wpp_indicators.csv.gz` | 毎年の人口の指標 (合計特殊出生率 TFR・出産の平均年齢 MAC・平均余命・純移動など) | 同上 |
| `wdi_demography.csv.gz` | 年齢 3 区分の割合・TFR・平均寿命・1 人あたり所得 (PPP、2021 年の国際ドル)。国だけ | 世界銀行 World Development Indicators |

- どれも推計の期間 (2023 年まで) の中位推計だけ。将来の推計は使わない。
- **取れなかったもの**: HMD・HFD (利用者の登録が要る)。WPP の生命表と出生率は、HMD・HFD のある国ではそれらを入力に使っている。国連の国際移民の年齢の表 (International Migrant Stock 2020) は 403 で取れなかった (`docs/proposals/10-age.md` の 10-4 の根拠にする予定だったもの)。
- 引用: United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024. 世界銀行のデータは CC BY 4.0。
