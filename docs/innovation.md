# 技術革新 (回 KE6・B-120〜B-123)

ユーザーの依頼 (2026-10-25、`docs/requests/2026-10-25-KE.md` の KE-1・KE-2):「技術革新による生産性向上の概念を追加して欲しい」・「おすすめ四つでお願い」。調べもの (536 件の目録) と 4 つの仕組みの選び方は `docs/research/innovation.md`。この文書には、入れた仕組みを 1 つずつ書く。

| | 仕組み | 目標 | 状態 |
|---|---|---|---|
| 1 | 研究者の数を所得だけでなく学力で決める (B-120) | R66・R67 (版 21) | この PR |
| 2 | 光速で遅れる技術の伝播 (B-121) | R68〜R72・R11 の測り方 (版 22) | |
| 3 | 研究開発の政策 (公の研究の予算と税額控除。B-122) | | |
| 4 | 汎用技術 (GPT) と J カーブ (B-123) | | |

## 1. 学力で決まる研究者 (B-120)

### 1.1 現実の目標 (目標の版 21)

作る前に固定した (`docs/targets.md` の版 21)。生データは前からある WDI の研究者 (SP.POP.SCIE.RD.P6)・所得 (NY.GDP.PCAP.PP.KD)・HCI の試験の点数 (HD.HCI.HLOS)。

| 目標 | 統計量 | 実データ |
|---|---|---|
| R66 研究者の数と所得 | 所得 (2021 年の国際ドル) の 5 分位ごとの、研究者 (人口 100 万人あたり) の 25%〜75% 点 (138 か国・1,930 国・年) | 中央値 95.9・696.0・1,571.8・3,220.4・4,642.0 人 |
| R67 研究者と学力 | ln 研究者を ln 所得と学力 (試験の点数 ÷ 100) に当てた学力の係数 (104 か国・301 国・年) | 1.2098 (幅 0.605〜1.815) |

### 1.2 作り (`STRUCTURE.research`。`economy/market-consts.js`・`economy/market-economy.js`)

| | 中身 | 値の出どころ |
|---|---|---|
| 研究者の曲線 | ln 研究者 [人/100 万人] = a + b ln y + c × 学力 ÷ 100。a = −6.3481、b = 0.7712、c = 1.2098 (`researchers(y, q)`) | R67 と同じ当てはめ (`data/build/build_innovation.py` → `data/derived/innovation.json` の `game.research`)。R² 0.745。前は所得だけ (exp(−6.3424 + 1.3536 ln y)) |
| 所得 y | 学歴と学力を決める所得 (市場で測った 1 人あたりの実質の所得を 5 年でならした `c.incU`。`eduY`) | 前は生産力 (`c.inc`。売れ残りを数えない)。学歴と同じ所得にした (`docs/hcap.md` の 2) |
| 学力 q | その年に学校を出る世代の学力 (`learnCurve(eduY, 教育の支出)`。目標 R64 と同じ) | データの試験の点数は学校にいる子どもの学力なので、それに合わせた |
| 国の研究者 | Σ 入植地の人口 × 研究者の数 (`researchersOf`)。分野への分け方と α (本星の始めの伸びが年 1.67%) は前のまま (`docs/structure.md` の 3) | |

- 学力を入れると、所得の係数が 1.37 から 0.77 に下がる。研究者の所得の勾配の大半は学力の勾配で、学力の高い国ほど同じ所得で研究者が多い。予算の「教育」(学力を上げる) は、研究者を通して技術の伸びにも効くようになった。
- **試してやめたもの**: 学力を大人 (25〜64 歳) の平均や、学校を出たばかりの世代 (25〜29 歳の区分) の平均にする形。どちらも、所得の伸びに遅れて学力が低めに出るので、豊かな国の研究者が R66 の幅より少なかった (25〜29 歳では 30 銀河で 5 分位のうち 3 つ、上の 2 分位が幅の下)。
- **直したもの**: 研究のパネル (`tools/research-panel.js`、R11) の分野の重みに、回 KE5 で足した hi (高付加価値の工業) が入っていなかった。伸びが NaN になり、R11 を測れていなかった。
- 測るための技術革新の国・年のパネル `tools/innovation-panel.js` を足した (→ `data/build/build_innovation.py --game`)。

### 1.3 結果

(測定中)

## 出典

- Bloom, N., Jones, C. I., Van Reenen, J. & Webb, M. (2020). Are Ideas Getting Harder to Find? *American Economic Review* 110(4), 1104–1144.
- Jones, C. I. (1995). R&D-Based Models of Economic Growth. *Journal of Political Economy* 103(4), 759–784.
- Patrinos, H. A. & Angrist, N. (2018). Global Dataset on Education Quality: A Review and Update (2000–2017). World Bank Policy Research Working Paper 8592.
- World Bank. World Development Indicators (SP.POP.SCIE.RD.P6・NY.GDP.PCAP.PP.KD)・Human Capital Index (HD.HCI.HLOS)。
