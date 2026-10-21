# 従属国の歴史の生データ (レーン H・セッション H2-1)

`docs/vassal-history.md` の 6 の 2 と `docs/vassal-typology.md` (H1 の案) のための生データです。取得は `python3 data/fetch/fetch_vassal.py` (取得日・URL・SHA-256・大きさは `MANIFEST.json`)。加工は `python3 data/build/build_vassal.py` → `data/derived/vassal.json`。

## 取得したもの (手で書き換えない)

| ファイル | 中身 | 出典 | 使い方 |
|---|---|---|---|
| `isd_2_2_update.xlsx`・`isd_2_2_codebook.pdf` | International System(s) Dataset (ISD) 2.2。1816〜2016 年の国家 499 件。始まりと終わりの年、始まり方 (StartType: 1 領土の統合・2 分離・3 脱植民地化…)、終わり方 (EndType: 1 植民地化・2 征服と併合・3 合併…)、暴力の有無 (VioStart・VioEnd)、主権の曖昧さ (Sovereignty_Am)、ヨーロッパとの外交 (EuroDip)、移り先 (Destination) | Butcher & Griffiths 2020, Geopolitics 25(1). Harvard Dataverse doi:10.7910/DVN/FGXZHL (2025-10-02 の版) | 1816 年以降の事例の始まり・終わりの年と、終わり方・暴力の符号の突き合わせ。ヨーロッパ型でない国家と従属的な政体も入る |
| `lake_hir_country_year.dta`・`lake_hir_country_year_results.do` | Lake (2009) の国・年 (1950〜2000 年、9,737 行) の複製データ。米に対する安全保障の上下関係の指標 `us_SH1995` (駐留兵 `us_indexmilperpop1995` と独立した同盟 `us_indally` から) と経済の上下関係の指標 `us_EH1995` (為替制度 `us_indexexchangerate1995` と交易の依存 `us_indexreltradep1995` から) | Lake, D. A. (2009) Hierarchy in International Relations, Cornell UP. Harvard Dataverse doi:10.7910/DVN/90PR8O | 衛星国・自由連合・プラット型の「法では独立・実態は従属」を数で見る (1950〜2000 年の事例だけ) |
| `seshat_equinox_2020.xlsx`・`seshat_LICENSE` | Seshat Equinox-2020。444 の政体 (シート Polities: 始まりと終わりの年・地域) と、社会の複雑さ・戦争・宗教の符号化された変数 (シート Equinox2020_CanonDat、163 変数) | Turchin ほか 2022 (Seshat Databank). Zenodo doi:10.5281/zenodo.6642230 (v.1、2022-06-14)。**CC BY-NC-SA 4.0** (商用不可。出典の表示が要る) | 1816 年より前の政体 (冊封朝貢国・封臣・貢納公国など) の年代の突き合わせ |
| `cow_contcold.csv`・`cow_contcol.csv`・`cow_contcols.csv`・`cow_colonial_contiguity_codebook.pdf` | Correlates of War Colonial/Dependency Contiguity 3.1。1816〜2016 年の、国家の植民地・従属地どうしの隣接 (陸と 400 マイルまでの海)。`contcols` は国ごと・年ごとの従属地の隣接の数 | Correlates of War Project. https://correlatesofwar.org/?p=305 (版 3.1、2017 年) | 宗主ごと・年ごとの従属の広がり (網の目の材料) |

## 手で作ったもの (出典つき)

| ファイル | 中身 |
|---|---|
| `codebook.md` | 符号化のコードブック (主権の束 8 項目 × 法と実態の 2 層、符号 S/M/V、出力の形、決まり) |
| `cases.csv` | 事例の一覧 (131 件、20 型)。型・名前・政体・宗主・始まりと終わりの年・終わり方 (end_kind)・終わりが暴力を伴ったか (violent_end: 終わりの前 5 年に、従属国の側の組織的な武装闘争があったか。ICOW の IndViol の定義に近づけた)・注・主な出典。型は `docs/vassal-typology.md` の T01〜T19 と、いまの「直接統治」にあたる T20 植民地 (直轄) |
| `coding_A.tsv`・`coding_B.tsv` | 2 回別々に行った符号化。A は型の順に、型の説明 (`docs/vassal-typology.md` の 3) を手がかりにして符号化した。B は始まりの年の順に、**型を伏せて** (事例の名前・宗主・期間・注・出典だけで) 符号化した。それぞれ根拠 (basis)・出典 (sources)・一次史料の本文を読んだか (verified) つき |
| `resolutions.tsv` | 2 回の符号が食い違った所 (335 か所) を、3 人目が 2 人の根拠と出典を並べて裁定した記録 (A の値・B の値・最終の値・理由)。一致した符号と合わせたものが最終の符号 (`data/derived/vassal.json` の各事例の `bundle`) |

- 事例の始まり・終わりの年と終わり方は、1816 年以降は ISD と ICOW (`data/raw/history/icow_colhist.csv`) に突き合わせ、食い違いは `data/derived/vassal.json` の `checks` に残す。
- 2 回の符号の一致の度合いは Krippendorff の α (名義尺度) で、項目ごと・層ごとに `data/derived/vassal.json` の `agreement` に出す。
- 条約の条文の番号は、本文がデジタル化されているもの (Avalon Project・Wikisource・worldjpn・FCDO Treaty Series・Fordham Sourcebook) に当たって確かめた。確かめた文書とその結果は `sources_checked.md`。

## 取れなかったもの

- **Lange (2009) の間接統治の指標** (1955 年の英の植民地 33 の、慣習法廷で扱われた事件の割合): 本 (Lineages of Despotism and Development, 第 2 章の表) と Lange 2004 (World Development 32-6) の表にあり、データの配布がない。H2-1 では手で写さず、法と裁判 (law) の符号の判定の目安 (「慣習法廷の割合が高い = M」) にだけ使った。
- **Seshat の「上位政体との関係」(suprapolity relations)**: Seshat Databank にはあるが、Equinox-2020 の公開版には入っていない (入っているのは社会の複雑さ・戦争・宗教・制度の 163 変数)。Polaris-2026 の版か API (seshat_api) で取れるが、名前と電子メールの登録が要るので取っていない。`docs/vassal-typology.md` の 5-2 の書き方 (Equinox に符号がある) は誤りで、H2-1 で直した。
- **Griffiths & Butcher の ISD の従属の型**: ISD には「従属の型」の変数はない (国家かどうかと、主権の曖昧さ Sovereignty_Am だけ)。型は条約の本文から符号化した。

## 限界

- 事例は 19 の型 + 植民地に 4〜8 件ずつ、型が分かれるように選んだもので、無作為標本ではない。存続年数の分布は、型の中の「有名な事例」に偏る。
- 符号化は 1 人の研究者 (この作業では 2 つの別々の符号者) が二次文献と一部の一次史料から行ったもので、文書館の史料には当たっていない。
- 「法」の層は、期間の大半を占めた条約の形。条約が途中で変わった事例 (保護国 → 併合など) は、その変化を basis に書いたが、符号は 1 組しか持たない。

## 条件 (`conditions.csv`、手で符号化。H2-2 の QCA と Cox の説明変数)

| 列 | 中身 | 出典・決め方 |
|---|---|---|
| `suz_lat`・`suz_lon`・`vas_lat`・`vas_lon`・`distance_km` | 宗主と従属国の首都 (特許会社はカルカッタかバタヴィア、幕府は江戸、教皇はローマ) のおおよその位置と大円距離 | 位置は地図の常識の値 (小数 1〜2 桁)。距離は `analyze_history.py` と同じ式 |
| `pop_ratio_class` | 始まりの頃の 従属国の人口 ÷ 宗主の人口 の桁: 1 = 0.01 未満、2 = 0.01〜0.1、3 = 0.1〜0.5、4 = 0.5 以上 | Maddison Project 2020・ISD の人口・Seshat の政体の人口からの桁の見積もり (正確な値ではない) |
| `culture` | 宗教と言語の系統の近さ: 0 = どちらも違う、1 = どちらか共有、2 = 両方共有 | 常識の判定 (例: 朝鮮と清は儒教と漢字を共有 = 2。チュニジアと仏 = 0) |
| `contiguous` | 陸続きか (Y/N) | 地図 |
| `prior` | 直前の状態: indep = 独立国、vassal = 別の宗主か別の型の従属、colony = 直轄の植民地、part = 宗主の一部、new = 新しく作られた | cases.csv の注 |
| `suzerain_kind` | 宗主の種類: land_empire・maritime_empire・company・feudal_kingdom・papacy・shogunate・personal_union・concert (列強の保障) | 事例の性質 |
