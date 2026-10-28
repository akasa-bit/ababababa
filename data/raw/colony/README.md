# 入植集団の大きさの文献 (セッション 12 の目標 R17)

- `literature.json`: 論文の前提と結論の数 (手で写した)。`checked` に、どこまで照らしたかを書いた。
- 書誌 (`*-doi.json` = Crossref、`*-arxiv.html` = arXiv の要旨のページ) は `python3 data/fetch/fetch_colony.py` で取る。

| 論文 | 前提 | 結論 | 照らしたか |
|---|---|---|---|
| Smith 2014 (Acta Astronautica 97, 16–29) | 150 年・5 世代、遺伝の多様性を保つ、災害も考える | 14,000〜44,000 人 | 書誌と、Marin & Beluffi の引用 (計算のやり方は本文と未照合) |
| Marin & Beluffi 2018 (arXiv:1806.03856、JBIS 71) | 6,300 年、近親婚の禁止と出産の制限、2,500 年目に 30% を失う災害 (表 1 を `literature.json` に写した) | 98 人で 100% 続く。25 組だと 50±15% で絶える。34 組から 94〜98% 続く | 本文 (arXiv v1) と照らした (2026-10-28) |
| Traill ほか 2007 (Biological Conservation 139) | 多くの種のメタ解析 | 中央値 4,169 | 書誌だけ |
| Frankham ほか 2014 (Biological Conservation 170) | 有効な集団の大きさの目安 | 短期 100・長期 1,000 | 書誌だけ |

セッション 12 は、照らしていない 3 本の数を本文と照らしてから使う。
