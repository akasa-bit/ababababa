# 開始時に選ぶ生産性

ユーザーの依頼 (`docs/requests/2026-10-20-C.md` の C-13) で、新しいゲームを始めるときに、1 人あたりの産出 (農業・鉱業・工業・採掘基地) の倍率を選べるようにしました。開始の画面の「生産性」で選びます。値はセーブに入ります。

| 選択 | 倍率 | 中身 |
|---|---|---|
| 現代のまま | ×1 | いまのゲームの生産性を、現代 (2023 年) の最前線の国の生産性とみなす |
| 2300 年の予測 | ×253 | 現実の生産性の伸びから、ゲームの始まる 2300 年の生産性を予測した値 (下の 2) |
| 自分で決める | 0.1〜1000 倍 | 倍率を入れる |

## 1. 生データ

`data/fetch/fetch_productivity.py` → `data/raw/productivity/`

- **Long-Term Productivity Database v2.7** (Bergeaud, Cette & Lecat 2016、2026 年 2 月版): 25 か国、1890 年〜の 1 時間あたりの労働生産性・TFP・1 人あたり GDP。2024 年より後の値は表の中の見込みなので使わない。
- **Maddison Project Database 2023** (Bolt & van Zanden 2024): 国ごと・年ごとの 1 人あたり GDP。コンドラチェフの波の周期を、より長い期間 (1820 年〜) で確かめるのに使う。

## 2. 予測のやり方 (`data/build/forecast_productivity.py` → `data/derived/productivity.json`)

1. **最前線**: 米国の 1 時間あたりの労働生産性 (2010 年の購買力平価ドル)。研究 (Gordon 2016・BCL) と同じ。
   - 各年にいちばん高い国をとると、2005 年以後はアイルランド (多国籍企業の利益の付け替えで GDP が大きく見える) やノルウェー (石油) になるので、使わない。
2. **長い期間の傾向**: ln 生産性の年あたりの平均の伸び。
3. **コンドラチェフの波**: 伸び率を 11 年の中心移動平均でならし、周期 40〜70 年の正弦波を最小二乗で当てはめる。
4. **2300 年まで延ばす**: 2023 年の値 × exp(傾向 × 277 年 + 波の積分)。

### 結果

| 延ばす伸び | 年の伸び | 2300 年の倍率 (2023 年比) |
|---|---|---|
| **1890〜2023 年 (いちばん長い記録。ゲームの「2300 年の予測」)** | **2.00%** | **×253** |
| 1950〜2023 年 | 1.87% | ×178 |
| 1973〜2023 年 | 1.50% | ×63 |
| 2005〜2023 年 (最近の減速) | 1.27% | ×33 |

| コンドラチェフの波 | 周期 | 振れ幅 (伸び率) | 当てはまり (R²) |
|---|---|---|---|
| BCL の米国 (1896〜2018 年、ならした伸び) | 70 年 (探す範囲の上の端) | 年 0.48% | 0.20 |
| Maddison の英国・オランダ・米国の最前線 (1826〜2017 年) | 44.5 年 | 年 0.47% | 0.10 |

- **波はデータでは弱い**: 当てはまりは R² 0.1〜0.2 で、周期もデータによって 44.5 年と 70 年に分かれた。長い波があるかどうかは、研究者の間でも争われている (Kondratiev 1926、Schumpeter 1939、Korotayev & Tsirel 2010 は肯定的。Solomou 1987 などは否定的)。
- **それでも 2300 年の水準にはほとんど効かない**: 277 年は波の 4〜6 周ぶんで、上下が打ち消し合う。2023〜2300 年の波の積分は ×0.99。
- **いちばん長い記録を使う理由**: 遠い先を延ばすときは、波を何周も含むいちばん長い記録の平均を使うのがふつう。ただし、最近の減速 (Gordon 2016。Bloom ほか 2020 の「アイデアが見つけにくくなる」) が続くなら ×33 にとどまる。この幅は開始の画面の説明にも出し、「自分で決める」で好きな倍率を入れられる。

## 3. ゲームへの効き方

- 倍率は、入植地の 1 人あたりの産出 (`yieldOf`) と採掘基地の産出 (`outpostYield`) にかかる。人の消費の量は変えない。
- 生産性が高いほど、作るのに要る資材が揃いやすくなり、広がりが速い。1 銀河 (シード 1)・6 か国・100 年の試しでは、入植地は ×1 で 27、×253 で 89。

## 出典

- Bergeaud, A., Cette, G. & Lecat, R. (2016). Productivity Trends in Advanced Countries between 1890 and 2012. *Review of Income and Wealth* 62(3), 420–444. (データは http://www.longtermproductivity.com/ の v2.7)
- Bolt, J. & van Zanden, J. L. (2024). Maddison style estimates of the evolution of the world economy: A new 2023 update. *Journal of Economic Surveys*. (Maddison Project Database 2023)
- Gordon, R. J. (2016). *The Rise and Fall of American Growth*. Princeton University Press.
- Bloom, N., Jones, C. I., Van Reenen, J. & Webb, M. (2020). Are Ideas Getting Harder to Find? *American Economic Review* 110(4), 1104–1144.
- Kondratiev, N. D. (1926). Die langen Wellen der Konjunktur. *Archiv für Sozialwissenschaft und Sozialpolitik* 56, 573–609.
- Korotayev, A. & Tsirel, S. (2010). A Spectral Analysis of World GDP Dynamics: Kondratieff Waves, Kuznets Swings, Juglar and Kitchin Cycles in Global Economic Development, and the 2008–2009 Economic Crisis. *Structure and Dynamics* 4(1).
- Solomou, S. (1987). *Phases of Economic Growth, 1850–1973: Kondratieff Waves and Kuznets Swings*. Cambridge University Press.
