# 帰着の分け前と行政の遅れ (回 KE8・B-012 の調べもの)

帰着の表 (`incidenceOf`・`groupIncidence`。`src/economy/incidence.js`) と、集団の分位の忠誠度の差 (`groupDev`) に使う `INCIDENCE` (`src/economy/fiscal-consts.js`)、行政の遅れ `ADMIN_LAG` の元にした数の記録。下の英語の部分は、調べたときの記録をそのまま残したもの (文中のファイル名は調べたときの作業場所のもので、PDF と表はリポジトリに入れていない)。ゲームの使い方は `docs/fiscal.md` の 7。

## 使った値 (所得の 5 分位の、合計に対する %。下 → 上)

| 手段 | Q1 | Q2 | Q3 | Q4 | Q5 | 出どころ (下の英語の部分の番号) | 選んだわけ |
|---|---|---|---|---|---|---|---|
| 所得への税 `tax` | 3.2 | 6.0 | 11.1 | 19.5 | 60.3 | 1b 英国 ONS 2023/24 の所得税 (税額控除を差し引く前) | 米国 (1a) は還付つきの控除で下の 2 つが負で、ゲームの所得への税 (比例の率) と形が違う。OECD の 23 か国の下の分位の 4.2% (1c) と近い |
| 消費税 `ctax` | 11.7 | 15.2 | 18.6 | 22.5 | 32.1 | 2a OECD・韓国租税研究院 2014 の 19 か国 | 国の間の平均。英国 (2b) も近い (12.6〜29.9) |
| 関税 `tariff` | 8.8 | 13.0 | 15.9 | 23.8 | 38.4 | 4a Reynolds 2021 (米国の 2018〜20 年) | 国の間の分位の表は見つからなかった。図から読んだ値 (±5%) |
| 会社の損得の持ち主 `firm` | 0.6 | 2.1 | 4.8 | 10.5 | 82.0 | 3 米国財務省 2025 の法人税 (負の所得の家族の 1% を除いて足し直した) | 国の間の表は見つからなかった |
| 福祉 `welfare` | 26.6 | 22.3 | 19.4 | 17.6 | 14.1 | 5c 世界銀行 ASPIRE の高所得国の社会扶助 | ゲームの福祉の予算は年金と別 (年金は回 KE2 の `pension`)。英国の現金の給付 (5b) は年金を含む |
| 教育 `education` | 20.9 | 20.6 | 21.3 | 19.8 | 17.4 | 7a Verbist ほか 2012 の OECD 27 か国 (すべての段) | 国の間の平均 |
| 政策金利の上げ `rate` | 1.2 | 10.4 | 14.3 | 21.0 | 53.1 | 8b Tzamourani 2019 のユーロ圏の金利の差の持ち高 × ゲームの所得の分け前 | 直接の利子の受け払いだけ (雇用を通した効きは入らない。8b) |

- 治安・軍事・研究の予算は、首都の家計への賃金と買い付けなので、所得の分け前 (`GROUPS.quint`) と同じに分ける (帰着の調べには当たる表がない)。
- 分位の並べ方: 調べの多くは手取りの所得で並べ、ゲームは市場の所得で並べる。年金で差が大きいので、年金は使っていない (帰着の表の手段ではない)。
- 民族の間の所得の差 (水平の不平等) は入れていない (`docs/groups.md` の 7)。どの民族も、星系と同じ分位の分け前とした。

## 行政の遅れ (決めてから首都で効くまで)

| 手段 | 年 | 出どころ |
|---|---|---|
| 所得への税・研究開発の税額控除 | 0.85 | Mertens & Ravn (2012, AEJ: Economic Policy 4(2)) の Romer & Romer の米国の税の変更 70 件のうち 37 件が法の成立から施行まで 90 日より長く、その中央値は 6 四半期 (NBER WP 16289、2010 年の版の数。この回では検索の要約で読み、PDF の本文には当たっていない)。90 日以内の 33 件を半四半期 (0.125 年) と置いた平均 = (33 × 0.125 + 37 × 1.5) ÷ 70 |
| 消費税の率の変更 | 0.05 | 英国 2008 年の引き下げ (11 月 24 日の発表 → 12 月 1 日。7 日) とドイツ 2020 年の引き下げ (6 月 3 日の連立の決定 → 7 月 1 日。28 日) の平均 |
| 消費税を新しく入れる | 1.75 | 準備に 18〜24 か月 (Tait 1988 *Value Added Tax: International Practice and Problems*、IMF。米国会計検査院 GAO/GGD-93-78、1993。どちらも付加価値税の運営の本 (Cambridge) と GAO の報告の要約から読んだ孫引き) の真ん中 |
| 関税 | 0.05 | 米国 2018 年の鉄鋼・アルミの関税 (3 月 8 日の布告 → 3 月 23 日に発効。15 日) |
| 予算 | 0.5 | 予算は次の会計年度から (決める時が年の中で一様なら平均半年)。CBO の支出の進み方 (人件費は 1 年目に 9 割・建設は 2 割) は入れていない |
| 政策金利・中央銀行に任せるか・赤字の上限 | 0 | 中央銀行の決定は次の日から。借りる上限は首都の政府が決める |

- 英国 2008 年・ドイツ 2020 年・米国 2018 年の日付は、よく知られた公の発表の日付で、この回で原文には当たっていない。
- 関税の値段への転嫁 (帰着の表で関税を家計の損と見る根拠): Amiti, Redding & Weinstein (2019, *Journal of Economic Perspectives* 33(4))・Fajgelbaum, Goldberg, Kennedy & Khandelwal (2020, *Quarterly Journal of Economics* 135(1)) は、米国の 2018 年の関税がほぼすべて米国の輸入の値段に移ったと推定した (この回では原文を開いていない)。

---

# Fiscal incidence by income quintile: calibration sources

Compiled 2026-10-30. Every number below was read from a document downloaded into this folder (one subfolder per source; PDFs converted with `pdftotext -layout`), unless it is marked otherwise.

**Marks used**
- **[DIRECT]**: printed in the source as quintile values.
- **[DERIVED]**: computed by me from printed source values. The method is given each time, and the arithmetic is in `derived_numbers.txt` (scripts in `_scripts/`).
- **[FIGURE-EXTRACT]**: read from the vector geometry of a bar chart in the source PDF. These values are not printed in the source. The method is in section 6, and each set was checked against the source text or against country means.
- **[FIGURE-READ]**: read by eye from a raster chart, accurate to about ±5%.
- **[UNVERIFIED]**: I could not read this in the source.

**Sites I could not open** (bot protection or egress block): cbo.gov (DataDome), commitmentoequity.org (connection reset), web.archive.org, the HTML pages on oecd.org and oecd-ilibrary (the direct `oecd.org/content/dam/...pdf` files did download), elibrary.imf.org, Wiley, OUP, ScienceDirect, taxpolicycenter.org, usitc.gov and the Yale Budget Lab research pages. As a result, **no CBO or CEQ number below has been verified.** The US Treasury OTA tables stand in for CBO. For CEQ-type developing-country evidence I used the IMF benefit-incidence database and the World Bank ASPIRE database.

**Quintile conventions.** Quintiles are of persons, or of households where noted. They are ranked by (equivalised) disposable or cash income unless stated otherwise. Your simulation's quintiles are market-income shares (7.0 / 11.9 / 16.3 / 22.2 / 42.4). Most incidence studies rank people by disposable income, so the groups are not identical to yours. This matters most for pensions, because retirees with low market income rank low on market income but in the middle on disposable income.

---

## 0. Summary of recommended calibration values (Q1 = poorest)

| # | Instrument | Q1 | Q2 | Q3 | Q4 | Q5 | Unit | Source (coverage) | Mark |
|---|---|---|---|---|---|---|---|---|---|
| 1a | Personal income tax, net of refundable credits | -3.1 | -3.0 | 2.4 | 11.1 | 92.7 | % of total PIT | US Treasury OTA 2025 table (US) | DIRECT deciles → quintiles |
| 1b | Personal income tax (gross Income Tax) | 3.2 | 6.0 | 11.1 | 19.5 | 60.3 | % of total | UK ONS ETB 2023/24 (UK) | DERIVED from Table 2a |
| 1c | PIT + employee SSC, OECD anchor | 4.2 | – | – | – | top decile 31.6 | % of total | OECD Growing Unequal, OECD-23/24, mid-2000s | DIRECT |
| 2a | VAT, share of total | 12.6 | 16.1 | 18.1 | 23.2 | 29.9 | % of total VAT | UK ONS ETB 2023/24 | DERIVED from Table 2a |
| 2b | VAT, share of total | 11.7 | 15.2 | 18.6 | 22.5 | 32.1 | % of total VAT | OECD/KIPF 19-country rate × EUROMOD income shares | DERIVED |
| 2c | VAT as % of disposable income | 12.2 | 10.1 | 9.5 | 8.8 | 7.7 | % of DI | OECD/KIPF 2014, 19 OECD countries | DIRECT deciles → quintiles |
| 3 | Corporate income tax | 0.6 | 2.0 | 4.7 | 10.4 | 81.3 | % of total CIT (about 1% goes to negative-income families) | US Treasury OTA 2025 (US); 81.5% capital / 18.5% labour | DIRECT deciles → quintiles |
| 4 | Import tariffs (2018-20 Section 301), dollar burden | 8.8 | 13.0 | 15.9 | 23.8 | 38.4 | % of total burden | Reynolds 2021 (US, CES 2017) | DERIVED from FIGURE-READ deciles |
| 4b | Tariffs as % of after-tax income | ~0.79 | ~0.36 | ~0.27 | ~0.26 | ~0.21 | % of after-tax income | Reynolds 2021; deciles D1 = 1.2 and D10 = 0.18 (all consumer tariffs) are in the text | FIGURE-READ |
| 5a | All public cash transfers, OECD anchor | 24.4 | – | – | – | – | % of total | OECD Growing Unequal Table 4.7, OECD-23 | DIRECT |
| 5b | All cash benefits | 26.0 | 28.2 | 21.4 | 14.8 | 9.6 | % of total | UK ONS ETB 2023/24 | DERIVED |
| 5c | Old-age pension (UK State Pension) | 17.1 | 26.5 | 22.7 | 18.4 | 15.4 | % of total | UK ONS ETB 2023/24 | DERIVED |
| 5d | Means-tested benefits (UK) | 43.7 | 33.4 | 16.8 | 4.3 | 1.8 | % of total | UK ONS ETB 2023/24 | DERIVED |
| 5e | Social assistance, high-income countries | 26.6 | 22.3 | 19.4 | 17.6 | 14.1 | % of total | World Bank ASPIRE HIC aggregate | DIRECT (API) |
| 5f | Contributory pensions, 113 mostly developing countries | 5.3 | 9.1 | 12.6 | 19.4 | 53.6 | % of total | World Bank ASPIRE, simple country mean | DERIVED |
| 6a | Public health care | 20.3 | 21.3 | 19.6 | 19.6 | 19.2 | % of in-kind benefit | Verbist et al. 2012, OECD-27 average, 2007 | FIGURE-EXTRACT |
| 6b | Public health spending | 16.9 | 18.8 | 19.6 | 20.9 | 23.2 | % of spending | Davoodi et al. 2003, 26 developing/transition countries, 1990s | DIRECT |
| 7a | Public education, all levels | 20.9 | 20.6 | 21.3 | 19.8 | 17.4 | % of in-kind benefit | Verbist et al. 2012, OECD-27 (text: Q1 21%, Q5 18%) | FIGURE-EXTRACT |
| 7b | Compulsory (primary + lower secondary) | 23.0 | 23.0 | 21.4 | 18.7 | 14.0 | % | Verbist et al. 2012, OECD-27 (text: 23%, 14%) | FIGURE-EXTRACT |
| 7c | Tertiary education | 18.4 | 14.6 | 17.6 | 21.3 | 28.0 | % | Verbist et al. 2012, OECD-26 (text: Q5 close to 30%) | FIGURE-EXTRACT |
| 7d | Primary / tertiary, developing countries | 22.8 / 5.4 | 22.2 / 9.6 | 20.6 / 14.7 | 19.4 / 23.9 | 15.1 / 46.3 | % of spending | Davoodi et al. 2003, Table 9, 1990s | DIRECT |
| 8a | +100 bp rate rise: direct net-interest gain | 0.06 | 0.29 | 0.29 | 0.32 | 0.42 | % of the group's gross income | Tzamourani 2019, euro area, HFCS 2014 (euro-area mean 0.35%) | FIGURE-EXTRACT, mapped to quintiles |
| 8b | Share of total net-interest gain from a +100 bp rise | 1.2 | 10.4 | 14.3 | 21.0 | 53.1 | % of total | 8a × your market-income shares | DERIVED (illustrative) |

---

## 1. Personal income tax

### 1a. United States: Treasury OTA (single country; stands in for CBO)
- **Citation:** U.S. Department of the Treasury, Office of Tax Analysis (2024), *Distribution Table: 2025 001 — Distribution of Families, Cash Income, and Federal Taxes under 2025 Current Law (2025 Income Levels)*, dated June 12, 2024. https://home.treasury.gov/system/files/131/Distribution-of-Tax-Burden-Current-Law-2025.pdf (file: `treasury_ota/Distribution-of-Tax-Burden-Current-Law-2025.pdf`).
- **Table:** Distribution Table 2025 001, panel "Percent Distribution", column "Individual Income Taxes".
- **Deciles to quintiles:** I summed adjacent deciles in the "Percent Distribution" panel and checked the sums against the billions panel. Deciles are of tax families ranked by family-size-adjusted cash income.

| | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| Deciles (% of total) | -0.4, -2.7 | -2.2, -0.8 | 0.5, 1.9 | 3.9, 7.2 | 13.6, 79.1 |
| **Quintile share of PIT (%)** | **-3.1** | **-3.0** | **2.4** | **11.1** | **92.7** |
| Average PIT rate, % of cash income [DERIVED from the $bn panel] | -13.0 | -4.6 | 2.1 | 5.9 | 15.6 |
| Share of cash income (%) | 2.5 | 6.8 | 11.6 | 19.3 | 60.9 |

- **Unit:** share of total net individual income tax. The shares are negative for Q1 and Q2 because refundable credits (EITC, CTC and others) are netted in. Year: 2025 law at 2025 income levels.
- **Quote** (table footnote 2): "The individual income tax is assumed to be borne by payers".
- **Quote** (OTA, *Treasury's Distribution Methodology and Results*, July 2021, p. 4, file `treasury_ota/Summary-OTA-Distribution-Methodology-2021.pdf`): "The average individual income tax rates ... for the lowest 40 percent of the income distribution are negative because they benefit from tax credits that generate tax refunds in excess of individual income tax liability."
- [UNVERIFIED] The equivalent CBO tables (*The Distribution of Household Income*) could not be opened because cbo.gov blocks automated access.

### 1b. United Kingdom: ONS, *Effects of Taxes and Benefits on Household Income* (single country)
- **Citation:** Office for National Statistics, *The effects of taxes and benefits on household income, UK, financial year ending 2024*, reference tables (`etbreferencetablesfye202324final.xlsx`). https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/datasets/theeffectsoftaxesandbenefitsonhouseholdincomefinancialyearending2014 (file: `ons_uk_etb/`). [UNVERIFIED: exact publication date of the release.]
- **Table:** Table 2a, "Average household incomes, taxes and benefits (£ per year) of all individuals by equivalised household disposable income quintile group, UK, 2023/24". Row "Income Tax": 1,674 / 3,162 / 5,857 / 10,333 / 31,949 (all individuals 10,595).
- **Shares [DERIVED]:** each quintile mean divided by the sum of the five means. The quintiles hold equal numbers of individuals (about 13.4m each, from the table's population row), and the five means sum to exactly 5 × the "All individuals" mean. Result: **3.2 / 6.0 / 11.1 / 19.5 / 60.3**. These are person-weighted household amounts, as in ONS's own tables.
- **Unit:** share of total Income Tax, gross. There are no refundable credits; UK credits are counted as benefits. Year: 2023/24.
- **Quote** (Table 8, "Percentages of gross income", Income Tax row): "7.1, 7.8, 10.2, 13, 22.3, 15.4" (Bottom to Top, then All).

### 1c. OECD cross-country anchors (no full quintile split published)
- **Citation:** OECD (2008), *Growing Unequal? Income Distribution and Poverty in OECD Countries*, OECD Publishing, Paris, https://doi.org/10.1787/9789264044197-en (file: `oecd_growing_unequal2008/9789264044197-en.pdf`, Chapter 4).
- **Table 4.7, column E** ("Share of taxes paid by lowest quintile"): **OECD-23 = 4.2%** (range 0.8% Australia to 12.4% Switzerland). "Taxes" here means household income taxes plus employee social security contributions, with people ranked by equivalised disposable income, mid-2000s.
- **Table 4.5, column B1** ("Share of taxes of richest decile"): **OECD-24 = 31.6%** (US 45.1%, UK 38.6%, Germany 31.2%, France 28.0%).
- **Table 4.3:** concentration coefficient of household taxes, **OECD-24 = 0.428**.
- **Quote** (Table 4.7 note): "Columns B and E show the shares of public transfers and household taxes received and paid, respectively, by people of the bottom quintile of the population."
- **Use:** the US/UK shapes are much more concentrated at the top than this OECD-wide anchor. The OECD figure includes employee SSC, which are roughly proportional, and the OECD average is less progressive than the US. For a "typical OECD" region, Q1 ≈ 4% and a top decile ≈ 32% (top quintile roughly 50%, [DERIVED guess, not in source]) are reasonable bounds.

---

## 2. Consumption tax / VAT

### 2a. Cross-country: OECD/KIPF (2014), 20 OECD countries (VAT figures for 19)
- **Citation:** OECD/Korea Institute of Public Finance (2014), *The Distributional Effects of Consumption Taxes in OECD Countries*, OECD Tax Policy Studies No. 22, OECD Publishing, http://dx.doi.org/10.1787/9789264224520-en (file: `oecd_vat/oecd_kipf_2014.pdf`, from https://www.oecd.org/content/dam/oecd/en/publications/reports/2014/12/the-distributional-effects-of-consumption-taxes-in-oecd-countries_g1g4a7fc/9789264224520-en.pdf).
- **Table:** Table 2.1, "Average VAT as a percentage of disposable income across income deciles", p. 41. The countries are AUT, BEL, CHL, CZE, DEU, ESP, EST, GBR, GRC, HUN, IRL, KOR, LUX, NLD, NZL, POL, SVN, SVK and TUR; Italy is blank. Survey years run from 2004 to 2013, mostly 2010. Deciles are of households ranked by equivalised disposable income.
- **19-country simple average by decile [DERIVED]:** 13.4, 11.1, 10.3, 10.0, 9.7, 9.3, 9.0, 8.6, 8.2, 7.3. The average of each pair of deciles gives the quintiles:
  - **VAT as % of disposable income: 12.2 / 10.1 / 9.5 / 8.8 / 7.7.** The report's Figure 2.2 plots the same all-country average.
- **VAT as % of expenditure:** Table 2.2 shows it is roughly flat or slightly progressive.
- **Share of total VAT [DERIVED]:** VAT/DI multiplied by the disposable-income quintile shares, then normalised. The income shares are the 5-country EUROMOD average from Paulus, Sutherland & Tsakloglou (2009), Table 6, "Cash only" column: 8.6 / 13.5 / 17.6 / 23.0 / 37.3. Result: **11.7 / 15.2 / 18.6 / 22.5 / 32.1.** This is an approximation: OECD/KIPF deciles are of households, while EUROMOD quintiles are of persons.
- **Quotes:** "Table 2.1 (and the left hand panel of Figure 2.2) shows VAT payments as a percentage of disposable income decreasing as income increases in all countries." Also: "Table 2.2 shows VAT payments as a proportion of pre-tax expenditure to be either roughly proportional, or slightly progressive in almost every country".

### 2b. United Kingdom: ONS ETB 2023/24 (single country; direct quintile amounts)
- Same citation as 1b. **Table 2a**, row "Value Added Tax (VAT)": £2,243 / 2,864 / 3,210 / 4,129 / 5,317.
  - **Share of total VAT [DERIVED]: 12.6 / 16.1 / 18.1 / 23.2 / 29.9.**
- **Table 8** "Percentages of disposable income", VAT row [DIRECT]: **11.3 / 8.4 / 6.8 / 6.6 / 5.2**. As % of expenditure it is 7.5 / 8.2 / 8.0 / 8.3 / 7.7, roughly flat.
- **Quote:** "Table 8: Taxes as a percentage of gross income, disposable income and expenditure for all individuals by equivalised household disposable income quintile group, UK, 2023/24".

---

## 3. Corporate income tax
- **Citation:** the same US Treasury OTA Distribution Table 2025 001 as 1a, column "Corporate Income Taxes".
- **Quintile shares (summed deciles):** Q1 0.1+0.5 = **0.6**; Q2 0.8+1.2 = **2.0**; Q3 1.8+2.9 = **4.7**; Q4 4.2+6.2 = **10.4**; Q5 9.9+71.4 = **81.3**. These sum to 99.0; the remaining 1% falls on families with negative income, who are excluded from the deciles. **Renormalised: 0.6 / 2.1 / 4.8 / 10.5 / 82.0.** The top 1% (99–100th percentile) bears 46.5%.
- **Average CIT rate as % of cash income [DERIVED]:** 0.52 / 0.62 / 0.85 / 1.12 / 2.77.
- **Split between capital and labour:**
  - OTA 2021 methodology, footnote 4: "The corporate income tax has been split between capital income (81.5 percent) and labor income (18.5 percent)."
  - Cronin, Lin, Power & Cooper (2012), OTA Technical Paper 5 (published in *National Tax Journal* 66(1), 2013, 239–262), abstract: "82% of the corporate income tax burden is distributed to capital income and 18% is distributed to labor income." File: `treasury_ota/TP-5.pdf`.
  - Incidence rule (table footnote 2): "the share of the corporate income tax that represents a tax on supernormal returns is assumed to be borne by supernormal corporate capital income as held by shareholders; and the remainder ... the normal return, is assumed to be borne equally by labor and positive normal capital income."
- **Quote** (OTA 2021, p. 5, 2022 income levels): "The bottom 50 percent of families bear 4 percent of the burden of the corporate income tax and the top 10 percent of families bear 73 percent of the burden of the corporate income tax."
- [UNVERIFIED] CBO's split (commonly cited as 75% capital / 25% labour) could not be checked because cbo.gov is blocked. TP-5 (p. 5) documents only CBO's history: "From 1990 to 1995, CBO generally allocated half of the corporate income tax burden to labor income and half to capital income".
- **Coverage:** US only, 2025. No OECD or CEQ quintile split of CIT incidence was found in the accessible sources.

---

## 4. Import tariffs

### 4a. US 2018–20 tariffs: Reynolds (2021) (single country)
- **Citation:** Kara M. Reynolds (2021), "Costs of Trade Wars: The Distributional Consequences of US Section 301 Tariffs Against China," American University working paper, June 2021. https://edspace.american.edu/reynolds/wp-content/uploads/sites/1780/2021/06/DistributionalCosts.pdf (file: `au_reynolds_tariffs/`). It uses 2017 Consumer Expenditure Survey households by decile of before-tax income, and follows the method of Furman, Russ & Shambaugh (2017) and Gailes et al. (USITC, 2018).
- **Figures:** Figure 4(a), cost in dollars by income decile, and Figure 4b, share of after-tax income. Both are raster images, so the values below are FIGURE-READ.
  - Dollar point estimates by decile, read as the midpoints of the plotted intervals: about 71, 73, 100, 112, 119, 141, 179, 210, 260 and 367. The text's "conservative" values ($63 for D1, $328 for D10) match the lower ends of the intervals.
  - **Quintile shares of the total dollar burden [DERIVED]: 8.8 / 13.0 / 15.9 / 23.8 / 38.4.** Using the lower ends of the intervals gives the same shares (8.8 / 13.0 / 15.9 / 23.9 / 38.5).
  - **% of after-tax income by quintile (mean of the two deciles):** about **0.79 / 0.36 / 0.27 / 0.26 / 0.21**. Decile 1 alone is about 1.15%; the bottom decile's measured income is very low relative to its spending in the CES.
- **Quotes** (abstract and conclusion): "the lowest income consumers pay more than 1.2 percent of their after-tax income to fight these trade wars, while the wealthiest consumers pay just 0.18 percent of their after-tax income." Also: "those in the middle of the income distribution are paying $120 per year (0.27 percent of their after-tax income)".
- **Caveats:** this covers consumer goods only, assumes full pass-through, and holds domestic prices fixed. Steel, aluminium and other intermediate-input tariffs are excluded, so it is a lower bound. The paper is a working paper, not peer-reviewed.

### 4b. Cross-country: Fajgelbaum & Khandelwal (2016), 40 countries (gains from trade, not tariffs)
- **Citation:** Pablo D. Fajgelbaum and Amit K. Khandelwal (2016), "Measuring the Unequal Gains from Trade," *Quarterly Journal of Economics* 131(3): 1113–1180 (journal version not fetched). NBER Working Paper 20331, which is the version read (2014, revised Aug 2015), file `nber_fajgelbaum_khandelwal2016/w20331.pdf`.
- **Number:** the real-income loss from moving to autarky averages 63% at the 10th percentile and 28% at the 90th, from the multi-sector model (text accompanying Figure 5 and Table 5). This is not a quintile share. It shows that the price effects of trade barriers fall roughly twice as hard, relative to income, on the 10th percentile as on the 90th.
- **Quote:** "On average, the real income loss from closing off trade is 63 percent at the 10th percentile of the income distribution and 28 percent for the 90th percentile."

### 4c. Treasury allocation of customs duties (an assumption, not an estimate)
- Treasury Table 2025 001 combines "Excises and Customs Duties" into one column: shares 3.2 / 7.1 / 11.0 / 19.7 / 58.5; average rate as % of cash income [DERIVED] 0.92 / 0.73 / 0.67 / 0.72 / 0.67. Footnote 2: customs duties are allocated "proportionately by labor and capital income". **Do not use this as empirical tariff incidence.**

### 4d. Not verified
- [UNVERIFIED] Yale Budget Lab, "State of U.S. Tariffs: November 17, 2025": search-engine summaries say the 2025 tariffs cost the bottom decile about 2.4% of post-tax-and-transfer income and the top decile about 0.8%. The page returned 403 and was not read.
- [UNVERIFIED] Gailes et al. (USITC 2018) reportedly find a tariff burden of about 0.25% of expenditure, flat across deciles. usitc.gov returned 403.
- Amiti, Redding & Weinstein (2019) and Furceri et al. (IMF) were not used; I did not open them to look for an income-quintile split.

---

## 5. Cash transfers and social protection

### 5a. OECD cross-country anchors: OECD (2008), *Growing Unequal?*, Chapter 4 (same citation as 1c)
- **Table 4.7, column B** ("Share of public transfers paid to lowest quintile"): **OECD-23 = 24.4%**. The range runs from 9.0% in Poland to 41.5% in Australia; Germany 17.4, France 16.2, Italy 12.6, UK 31.4, US 24.8, Sweden 25.9. The measure covers gross public cash transfers to the whole population in the mid-2000s.
- **Table 4.3**, concentration coefficients for public cash benefits (negative means pro-poor): total -0.099, working age -0.107, retirement age +0.085 (OECD-24).
- **Table 4.4**, concentration coefficients by programme, OECD-27: **old-age pensions -0.05**; disability -0.01; family -0.14; unemployment -0.10; **housing -0.29; "other" benefits, including social assistance, -0.24**.
- **Quote:** "public cash transfers are more targeted to the poorest 20% of the population in Australia, Denmark, New Zealand, Finland, the Netherlands, Ireland and the United Kingdom (where the lowest income quintile receive more than 30% of all transfers, and above 40% in Australia, Column B), and least targeted in Poland (where the poorest 20% receive less than 10% of all transfers)".
- No OECD-average Q2–Q5 split was found in a numeric table. Causa & Hermansen (2017, OECD ECO WP 1453; LIS WP 729, file `lis_causa_hermansen2017/`), Figures 5 and 6, show the targeting only graphically. In the text: "in Greece, Italy, Portugal and Spain, 10 per cent of total transfers or less accrues to bottom quintile households".

### 5b. Full quintiles for the UK: ONS ETB 2023/24 (single country; same citation as 1b)
Source: Table 2a, £ per year per individual's household. Quintiles are equal-person groups ranked by equivalised disposable income. Shares are [DERIVED].

| Programme (Table 2a rows) | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| Total cash benefits (£10,218 / 11,063 / 8,379 / 5,817 / 3,748) | **26.0** | **28.2** | **21.4** | **14.8** | **9.6** |
| State Pension (old-age) (£2,538 / 3,935 / 3,369 / 2,729 / 2,282) | **17.1** | **26.5** | **22.7** | **18.4** | **15.4** |
| Means-tested: Universal Credit + Income Support + Tax credits + Housing Benefit + Pension Credit | **43.7** | **33.4** | **16.8** | **4.3** | **1.8** |

- For the means-tested row, cells that ONS suppresses for small samples ("..") are counted as 0, which biases the Q3–Q5 shares slightly downward.

### 5c. Developing and emerging countries: World Bank ASPIRE (a stand-in for CEQ-type evidence)
- **Citation:** World Bank, *ASPIRE: The Atlas of Social Protection — Indicators of Resilience and Equity*, via the World Bank API (source 29, last updated 2025-08-25). The indicators are `per_allsp.ben_qN_tot` (all social protection and labour), `per_si_allsi.ben_qN_tot` (social insurance), `per_si_cp.ben_qN_tot` (contributory pensions), `per_sa_allsa.ben_qN_tot` (social assistance / safety nets) and `per_sa_ct.ben_qN_tot` (unconditional cash transfers), for N = 1 to 5. Raw JSON and summaries are in `worldbank_aspire/`.
- **Definition** (indicator metadata): "the percentage of total social protection and labor programs benefits received by the poorest 20% of the population". Quintiles are by household-survey welfare per capita. [UNVERIFIED] I assume the `_tot` series rank people by post-transfer welfare, because there is a separate `_preT` series.
- **ASPIRE's own aggregates** are labelled "2011-21S" and "2011-21W". [UNVERIFIED] I take S to be a simple average and W a population-weighted one.

| Programme | Aggregate | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|---|
| All social protection & labour | World 2011-21S | 8.8 | 11.6 | 14.2 | 19.1 | 46.3 |
| All social insurance (mainly pensions) | World 2011-21S | 4.7 | 8.1 | 11.9 | 19.6 | 55.7 |
| All social insurance | High income 2011-21S | 5.6 | 10.2 | 15.8 | 23.0 | 45.4 |
| Social assistance (largely targeted / means-tested) | World 2011-21S | 21.4 | 19.3 | 18.5 | 17.6 | 23.2 |
| Social assistance | High income 2011-21S | 26.6 | 22.3 | 19.4 | 17.6 | 14.1 |
| Social assistance | Upper-middle income 2011-21S | 24.2 | 21.2 | 20.7 | 17.5 | 16.4 |
| Contributory pensions [DERIVED: simple mean over 113 countries, latest survey per country, 2000–2023, median 2018] | – | 5.3 | 9.1 | 12.6 | 19.4 | 53.6 |
| Unconditional cash transfers [DERIVED: 83 countries] | – | 26.6 | 20.7 | 18.7 | 16.1 | 17.9 |

- ASPIRE's "high income" group covers only the high-income countries that have ASPIRE surveys, not the OECD as a whole. [UNVERIFIED] I did not obtain the list of countries in this group.

---

## 6. Public health spending (in-kind)

### 6a. OECD-27 (cross-country): Verbist, Förster & Vaalavuo (2012)
- **Citation:** Gerlinde Verbist, Michael Förster and Maria Vaalavuo (2012), "The Impact of Publicly Provided Services on the Distribution of Resources: Review of New Results and Methods," *OECD Social, Employment and Migration Working Papers* No. 130, OECD Publishing, https://dx.doi.org/10.1787/5k9h363c5szq-en (file: `oecd_verbist2012/5k9h363c5szq-en.pdf`). Related to OECD (2011), *Divided We Stand*, Chapter 8 [UNVERIFIED: exact relationship]. Data year 2007; quintiles of equivalised disposable cash income. Health care is valued at its insurance value (age- and sex-specific per-capita spending).
- **Figure 15**, "Distribution of health care in-kind benefits over quintiles", **OECD-average bar [FIGURE-EXTRACT]: 20.3 / 21.3 / 19.6 / 19.6 / 19.2.**
  - **How the values were extracted:** with `pdfplumber` I read the filled rectangles of the 100%-stacked bars and mapped colours to quintiles using the legend swatches. The last bar, set apart from the others by a gap, is the OECD average. Check: the simple mean of the 27 country bars is 20.3 / 21.2 / 19.9 / 19.3 / 19.3.
- **Table 7** [DIRECT]: health in-kind benefit as % of disposable income by quintile, 27-country average: **34.9 / 22.2 / 15.8 / 11.8 / 7.2** (total 13.9).
- **Quote:** "The distribution of the income advantage deriving from health care is rather uniformly distributed in the OECD countries (Figure 15)."
- **Check from EU microsimulation** (Paulus, Sutherland & Tsakloglou 2009, EUROMOD WP EM10/09; the *JPAM* 29(2) journal version was not fetched; file `euromod_paulus2009/`): Table 3 gives the relative mean per-capita public health transfer by quintile for BE, DE, EL, IT and UK. The 5-country mean converted to shares [DERIVED] is 21.6 / 21.9 / 20.0 / 18.5 / 18.0.
- **UK ONS ETB 2023/24, Table 2a, NHS** [DERIVED]: 23.3 / 21.1 / 20.3 / 18.4 / 16.8.

### 6b. Developing and transition countries: Davoodi, Tiongson & Asawanuchit (2003), IMF
- **Citation:** Hamid R. Davoodi, Erwin R. Tiongson and Sawitree S. Asawanuchit (2003), "How Useful Are Benefit Incidence Analyses of Public Education and Health Spending?" IMF Working Paper WP/03/227 (journal version, not fetched: "Benefit Incidence of Public Education and Health Spending Worldwide: Evidence from a New Database," *Poverty & Public Policy* 2(2), 2010). File: `imf_davoodi2003/wp03227.pdf`. Benefit-incidence studies from the 1990s, unweighted country averages.
- **Appendix Table 11**, "Benefit Incidence of Public Spending on Health in the 1990s", "All countries" [DIRECT]:
  - all health: **16.9 / 18.8 / 19.6 / 20.9 / 23.2** (n = 26)
  - primary health care: 17.3 / 21.4 / 19.9 / 20.4 / 20.8
  - hospitals: 13.3 / 16.6 / 19.4 / 22.4 / 28.7
- **Quote:** "Only 17 percent of the benefits from health spending accrue to the poorest quintile as compared with 23 percent for the richest quintile (Table 4)."

---

## 7. Public education spending (in-kind)

### 7a. OECD-27 (cross-country): Verbist, Förster & Vaalavuo (2012) (same citation as 6a)
**Figure 11**, "Distribution of education services over quintiles". The values are the OECD-average bar of each panel [FIGURE-EXTRACT, same method as 6a]:

| Panel | Q1 | Q2 | Q3 | Q4 | Q5 | Check against the text |
|---|---|---|---|---|---|---|
| A. Total education | **20.9** | **20.6** | **21.3** | **19.8** | **17.4** | text: Q1 21%, Q5 18% |
| B. Compulsory education | **23.0** | **23.0** | **21.4** | **18.7** | **14.0** | text: 23% vs 14% |
| C. Upper secondary | **18.7** | **20.2** | **21.4** | **21.4** | **18.3** | – |
| D. Tertiary | **18.4** | **14.6** | **17.6** | **21.3** | **28.0** | text: "close to 30%" to Q5 |

- **Tertiary caveat:** the Q1 value of 18.4% is inflated by the Nordic countries and Germany, where students living away from their parents form separate low-income households (Q1 share up to 51% in Denmark). The paper gives Estonia and Mexico as examples where Q1 receives less than 8%.
- **Quotes:** "the first quintile receives on average 21% of all education expenditures, compared to 18% in the fifth quintile". Also: "Compulsory education is slightly more oriented towards low income groups: on average, the bottom quintile receives 23% of expenditures of this education category, compared to only 14% for the top quintile". And: "The OECD-average indicates a regressive pattern with close to 30% of tertiary education expenditures going to the top quintile".
- **Table 7** [DIRECT]: education as % of disposable income, 30.6 / 18.5 / 14.2 / 10.4 / 5.6 (total 11.8).
- **UK ONS ETB 2023/24, Table 2a, Education** [DERIVED]: 34.4 / 21.0 / 20.3 / 14.3 / 9.9.

### 7b. Developing and transition countries: Davoodi et al. (2003), IMF WP/03/227 (same citation as 6b)
**Appendix Table 9**, "Benefit Incidence of Public Spending on Education in the 1990s", "All countries" [DIRECT]:

| Level | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| All education (n = 37) | 15.8 | 17.7 | 18.9 | 21.3 | 26.3 |
| Primary (43 countries) | 22.8 | 22.2 | 20.6 | 19.4 | 15.1 |
| Secondary | 11.3 | 16.7 | 20.8 | 23.3 | 27.9 |
| Tertiary | 5.4 | 9.6 | 14.7 | 23.9 | 46.3 |

- **Quote:** "Only 16 percent of benefits accrue to the poorest quintile. In contrast, the richest quintile receives about 27 percent of benefits ... The richest quintiles on average obtain almost 28 percent and 46 percent of benefits from secondary and tertiary education spending, respectively."
- [UNVERIFIED] CEQ multi-country education and health concentration shares were not reachable (commitmentoequity.org was blocked).

---

## 8. Interest rates and monetary policy

### 8a. Direct net-interest-income effect of a rate rise: Tzamourani (2019/2021), euro area
- **Citation:** Panagiota Tzamourani (2019), "The interest rate exposure of euro area households," Deutsche Bundesbank Discussion Paper No. 01/2019. The *European Economic Review* 132 (2021) version was not fetched [UNVERIFIED]. File: `bundesbank_tzamourani2019/dkp-01-2019.pdf`. Data: HFCS wave 2, 2014 reference year. The measure is the unhedged interest-rate exposure (URE, Auclert 2019), assuming full pass-through and no change in expected inflation.
- **Euro-area mean** [DIRECT]: "an increase in the real interest rate by 100 basis points ... would imply an increase of 0.35% of the euro area mean gross income, on average, per household, or €139". Table 6: URE/income = 0.35 for the euro area.
- **Figure 5**, "The unhedged interest rate exposure (URE) across the income distribution", euro-area panel [FIGURE-EXTRACT from vector bars]. Gridlines are 0.5 apart, at 16.02 pt per 0.5, with zero at y = 210.0. Mean URE as a share of the group's gross income:
  - <20th percentile 0.056; 20–50th 0.293; 50–70th 0.296; 70–95th 0.340; top 5% 0.543.
- **Mapped to quintiles [DERIVED]:** Q1 = <20 group; Q2 = 20–50; Q3 = average of 20–50 and 50–70; Q4 = average of 50–70 and 70–95; Q5 = 60% × (70–95) + 40% × (top 5%), assuming the top 5% hold about 40% of Q5's income.
  - **Gain from +100 bp, % of the group's gross income: 0.06 / 0.29 / 0.29 / 0.32 / 0.42.**
  - **Share of the total net-interest gain [DERIVED, illustrative],** weighting by your market-income shares (7.0 / 11.9 / 16.3 / 22.2 / 42.4): **1.2 / 10.4 / 14.3 / 21.0 / 53.1.** The implied aggregate URE/income is 0.336, compared with 0.35 in the paper.
- **Quote** (§3.3): "Taking the euro area as a whole, all income groups have positives UREs on average. Although the URE for the lowest income group is close to zero, and for the top 5% larger than the lower income groups, the URE does not increase monotonically with income."
- **Strong country differences** (Table 6): mean URE/income is 0.70 in Germany, 0.54 in Italy, -0.08 in Spain, -0.61 in Ireland and -0.72 in the Netherlands. In countries with many adjustable-rate mortgages, a rate rise lowers household net interest income.
- **Do not use Table 3** for this instrument. It looks like an income table but is by net-wealth group: euro-area mean interest gain per household from +100 bp is -87 / 27 / 77 / 340 / 951 EUR for wealth groups <20 / 20–50 / 50–70 / 70–95 / top 5%. The text says: "Tables 3 and 4 show the gains/losses ... across the net wealth distribution".

### 8b. Total (direct + indirect) effects: Ampudia et al. (2018), ECB
- **Citation:** Miguel Ampudia, Dimitris Georgarakos, Jiri Slacalek, Oreste Tristani, Philip Vermeulen and Giovanni L. Violante (2018), "Monetary policy and household inequality," ECB Working Paper No. 2170 (Discussion Paper), July 2018. File: `ecb_ampudia2018/ecb.wp2170.en.pdf`.
- **No quintile table of net interest income.** The quantitative decomposition (Figures 9–12, Table 3) is by hand-to-mouth status. Figure 6 (by income quintile) is reproduced from Lenza & Slacalek (2018) as a chart without printed values.
- **Quotes:** "We find that the indirect income channel has an overwhelming importance, especially for households holding few or no liquid assets." And: "the APP reduced the unemployment rate among households in the bottom income quintile by 2 percentage points, which boosted their mean income by more than 3 percent."
- **Implication for calibration:** the direct interest channel in 8a is small (0.35% of income per 100 bp). The indirect channel, through employment and wages, is larger and is concentrated in Q1.

### 8c. United States: Coibion, Gorodnichenko, Kueng & Silvia (2012/2017)
- **Citation:** Olivier Coibion, Yuriy Gorodnichenko, Lorenz Kueng and John Silvia (2012), "Innocent Bystanders? Monetary Policy and Inequality in the U.S.," NBER Working Paper 18170. File: `nber_coibion2012/w18170.pdf`. [UNVERIFIED] The published version is in the *Journal of Monetary Economics* (2017); I did not fetch it.
- **No quintile shares.** Results are given for Gini coefficients and percentile gaps.
- **Quote:** "Contractionary monetary policy actions systematically increase inequality in labor earnings, total income, consumption and total expenditures."

---

## Files in this folder

| Folder | What it holds |
|---|---|
| `treasury_ota/` | 2022, 2024 and 2025 distribution tables; 2021 methodology; TP-5 |
| `ons_uk_etb/` | ETB 2023/24 reference tables (xlsx) |
| `oecd_vat/` | OECD/KIPF 2014 |
| `oecd_growing_unequal2008/` | OECD 2008, *Growing Unequal?* |
| `oecd_verbist2012/` | OECD SEM WP 130 |
| `lis_causa_hermansen2017/` | LIS WP 729 |
| `oecd_joumard2012/` | Joumard et al., ECO WP 926 (downloaded and searched; no quintile numbers used) |
| `imf_davoodi2003/` | IMF WP/03/227 |
| `imf_2014_fiscal_policy_inequality/` | IMF 2014 policy paper (searched; no quintile tables) |
| `euromod_paulus2009/` | EUROMOD WP EM10/09 |
| `euromod_stats/` | EUROMOD I5.0+ statistics workbook (not used; see below) |
| `euromod_vat/` | Single-country EUROMOD VAT papers and the Maier & Ricci slides (not used) |
| `worldbank_aspire/` | ASPIRE API JSON and summaries |
| `au_reynolds_tariffs/` | Reynolds 2021 and rendered figure pages |
| `nber_fajgelbaum_khandelwal2016/` | NBER WP 20331 |
| `bundesbank_tzamourani2019/` | Bundesbank DP 01/2019 |
| `ecb_ampudia2018/` | ECB WP 2170 |
| `nber_coibion2012/` | NBER WP 18170 |

- **Why the EUROMOD workbook was not used:** it gives per-household means by decile, but the deciles contain equal numbers of persons and the workbook gives no household counts per decile. Quintile shares of totals therefore cannot be computed from it. An attempt to infer the counts by least squares (`_scripts/em_weights.py`) was too ill-conditioned to use.
- **Derived arithmetic:** `derived_numbers.txt`; scripts in `_scripts/`.
