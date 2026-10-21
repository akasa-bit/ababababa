# 研究者の多さの生データ (セッション 9 の研究。目標 R11 の仕組みの側)

取得: `python3 data/fetch/fetch_research.py`。加工: `python3 data/build/build_sectors.py` (`structure.research`) → `data/derived/sectors.json`。

| ファイル | 中身 | 出典 |
|---|---|---|
| `wdi_research.csv.gz` | 研究者の数 (人口 100 万人あたり。SP.POP.SCIE.RD.P6、UNESCO 統計研究所の値)・研究開発費 ÷ GDP (GB.XPD.RSDV.GD.ZS)・労働力人口 (SL.TLF.TOTL.IN)。国だけ、1960〜2024 年 | 世界銀行 WDI (CC BY 4.0) |

- 所得の軸は R10 と同じ Maddison Project Database 2023 (`data/raw/sectors/mpd2023.csv.gz`、2011 年の国際ドル)。
- ゲームでは、研究者の数 [人/100 万人] = exp(d0 + d1 ln 所得) を、135 か国 1996〜2022 年 (1,827 国・年) のプールの最小二乗で当てた (所得の弾力性 1.35。国の固定効果つきなら 0.86)。研究者はサービスの中の人として数え、国の分野 (農業・鉱業・工業) には部門の付加価値の比で分ける (`docs/structure.md`)。
