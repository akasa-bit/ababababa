# 研究の生産性の生データ (セッション 9 の目標 R11)

取得: `python3 data/fetch/fetch_ideas.py <置き場>`。加工: `python3 data/build/build_ideas.py <置き場>` → `data/derived/ideas.json`。

- 中身: Bloom, Jones, Van Reenen & Webb 2020, "Are Ideas Getting Harder to Find?", American Economic Review 110(4), 1104–44 の再現用の一式 `IdeaPFPrograms.zip` (Chad Jones のページ)。
- **zip はリポジトリに置かない** (Compustat は WRDS の有料のデータなので)。`MANIFEST.json` に zip と、計算に使う中のファイルの SHA-256 を残した。計算に使うのは、台本に書き込まれた公開の統計 (BEA の NIPA の知的財産への投資・BLS の多要素生産性・CPS の大卒の所得・半導体の研究費) だけ。
- AEA の openICPSR (project 111743) は 403 で取れなかった。
- 計算し直した値と論文の値:

| | この計算 | 論文 |
|---|---|---|
| 全体 (米国の TFP): 研究者の増え方 | ×22.2 (1930 年代 → 2000 年代) | ×23 |
| 全体: 研究の生産性 | 年 −5.09% | 年 −5.3% |
| ムーアの法則 (広い定義): 研究者 | ×18.3 (1971 → 2014 年) | ×18 |
| ムーアの法則: 研究の生産性 | 年 −6.76% | 年 −6.8% |

全体のずれは、抜けた年の賃金の埋め方 (台本の `interplin2` を対数の直線で置き換えた) くらいの大きさ。
