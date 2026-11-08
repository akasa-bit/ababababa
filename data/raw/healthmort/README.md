# 医療の支出と死亡率の生データ (医療の水準を死亡率につなぐための調べもの)

取得: `python3 data/fetch/fetch_healthmort.py` (約 10 秒)。加工: `python3 data/build/analyze_healthmort.py` → `data/derived/healthmort.json`。説明は `docs/research/health-mortality.md`。

| ファイル | 中身 | 出典 |
|---|---|---|
| `wdi_health.csv.gz` | 国ごと・1995〜2022 年の長い形 (indicator, iso3, country, year, value)。SH.XPD.GHED.GD.ZS (政府の医療の支出、国内の財源、GDP 比 %)・SH.XPD.CHEX.GD.ZS (経常の医療の支出の合計、GDP 比 %)・SH.XPD.GHED.CH.ZS (経常の医療の支出のうち政府の割合 %)・NY.GDP.PCAP.PP.KD (1 人あたり GDP、PPP、2021 年の国際ドル)・SP.POP.TOTL (総人口)・SP.DYN.AMRT.MA / FE (成人の死亡率、15 歳の人が 60 歳までに死ぬ確率、千人あたり)・SP.REG.DTHS.ZS (死亡の登録の完全さ、死因つき %) | 世界銀行 World Development Indicators (医療の支出は WHO の Global Health Expenditure Database、成人の死亡率は国連 WPP から) |
| `wdi_countries.csv` | WDI の国の一覧 (地域の集計を除く 217)。ISO3・名前・地域 (EAS・ECS・LCN・MEA・NAC・SAS・SSF)・所得の区分 (取得した時点のもの) | 世界銀行 |
| `ucdp_prio_acd_261.csv.gz` | UCDP/PRIO Armed Conflict Dataset 26.1 (国家が当事者で、年 25 人以上の戦闘の死者が出た紛争 × 年、1946〜2025 年)。zip の中の CSV をそのまま gzip にしたもの。紛争の強さ (intensity_level 2 = 年 1,000 人以上) に使う | Uppsala Conflict Data Program |
| `ucdp_brd_conf_261.csv.gz` | UCDP Battle-Related Deaths Dataset 26.1 (紛争 × 年の戦闘の死者数 best・low・high と、戦闘の場所 gwno_battle、1989〜2025 年)。同じく CSV をそのまま gzip にしたもの。武力紛争の国 × 年を決めるのに使う | 同上 |

- 65 歳の平均余命 (LE65) は、ここでは取らない。前から置いてある `data/raw/demography/wpp_indicators.csv.gz` (国連 WPP 2024) を使う。
- WDI は、値のない行を除き、国だけに絞った。元の API の URL・取得日・SHA-256・行数・最終更新日は `MANIFEST.json`。UCDP は元の zip の SHA-256 と中の CSV の SHA-256 も記録した。
- UCDP の国の番号は Gleditsch–Ward の番号 (ISO3 ではない)。ISO3 への対応は `data/build/analyze_healthmort.py` の `GW` (1995〜2022 年に出てくる番号がすべて対応にあることを確かめる)。
- WHO の Global Health Observatory の API は使わなかった (WDI の医療の支出と成人の死亡率は、同じ WHO・国連のデータの写し)。

引用:

- World Bank, World Development Indicators (CC BY 4.0)。医療の支出は WHO Global Health Expenditure Database、成人の死亡率は United Nations, World Population Prospects による。
- UCDP/PRIO Armed Conflict Dataset: Gleditsch, N. P., Wallensteen, P., Eriksson, M., Sollenberg, M. & Strand, H. (2002) Armed Conflict 1946–2001: A New Dataset. Journal of Peace Research 39(5)。および Davies, S., Pettersson, T. & Öberg, M. (2026) Organized violence 1989–2025, and violent political protests. Journal of Peace Research (UCDP の 26.1 版の引用の指定)。
- UCDP Battle-Related Deaths Dataset: 上の Davies ほか (2026)。UCDP のデータは CC BY 4.0。
