# 政策の支持・声の重さ・通らないとき (回 SE7・B-022 の調べもの)

利益集団の支持で政策を通す形 (`docs/support.md`。`src/politics/support-consts.js` の `SUPPORT`・`ENACT`) の元にした数の記録。下の英語の部分は、調べたときの記録をそのまま残したもの (文中のファイル名と台本は調べたときの作業場所のもので、リポジトリに入れていない。米国 GSS 2016・2018 と Bremer & Bürgisser の再現データの集計は、その台本で個票から計算した値)。最後の「6. Suggested mapping to the game」は調べた人の意見で、ゲームの値はそれをそのまま使っていない (使った値と理由は `docs/support.md` の 2〜4)。

使ったもの:

| ゲームの値 | 元 (下の英語の部分の節) |
|---|---|
| 損得の係数 money = 8.3 | 1.1 の Kudrnáč 2023 (ESS 2018/19 の 13 か国の平均 75% ↔ 59%) と、回 KE8 の帰着の分け前 (`docs/research/incidence.md`) |
| 価値観の係数 | 2 の GSS の宗教の集まりと保守・革新の差、O'Rourke & Sinnott (排外と保護) |
| 関税の働き口の係数 0.52 | 1.2 の Mayda & Rodrik (所得が平均の 2 倍で自由貿易の支持 +7.0 点、元 23%) |
| 声の重さ 0.15 乗 (1.31 倍) | 3 の Lupu & Warner 2022 (52 か国で 16% 遠い)。Gilens & Page と、Enns 2026 の批判 |
| 審議の通る見込み | 3 の Schakel・Elsässer ほか (4 年のうちに通る割合と、支持が 10% → 90% の見込み)、5 の Victoria 3 の段と後退の数 |
| 入れていないもの | 4 の緊縮の支持率の損・暴動 (QD-108 の c・d の案)、2 の戦争と移民の効き |

---

# Policy support: calibration evidence for interest-group approval, clout and enactment

Compiled 2026-10-30. Tags: **[DIRECT]** number printed in a document I opened · **[DERIVED]** my arithmetic or my computation on microdata (method shown) · **[FIGURE-READ]** read off a chart (±2 pp) · **[UNVERIFIED]** seen only in a search snippet or third-party summary. "1C" = single-country result. Downloads: `support/downloads/<source>/`; scripts: `support/_scripts/` (run with `python3 -I`; R data read with `support/_venv`).

## 0. Summary table

"Q1" = bottom income quintile, "Q5" = top. Support = % favouring the stated direction.

| Instrument (direction) | Q1 / low income | Q5 / high income, or gradient | Source, sample |
|---|---|---|---|
| Redistribution ("government should reduce income differences", agree) | 75% | 59%; gap 16 pp (range 6 NO to 24 FR) [FIGURE-READ, mean DERIVED] | Kudrnáč 2023, ESS 2018/19, 13 W. European countries |
| same, all ESS rounds | gap ~0 (PT, HU) | up to 30 pp (NL, CH, EE, CZ); top quintile lowest in DK ~30% [DIRECT] | Kudrnáč 2023, ESS 2002–2019 |
| same, regression | — | −0.258 per income step on a 1–10 scale [DIRECT] | Alesina & Giuliano 2011, WVS 1981–2004, 20–80 countries |
| same (US, "eqwlth" 1–3) | 54% | 47% [DERIVED] | GSS 2016+18, 1C |
| Cut **top** income tax (inverse of progressivity) | 20% | 27%; 69% of all oppose [DERIVED] | Bremer & Bürgisser 2024 replication data, DE/ES/IT/UK, n=1,200 control |
| Cut income tax (general) | 62% | 64% (flat) [DERIVED] | same |
| Cut **VAT** (so a VAT rise is opposed roughly in this proportion) | 68% | 63% (poor slightly more pro-cut; ES 90% vs 68%) [DERIVED] | same |
| Free trade (oppose import limits) | — | earning 2× the national mean: +7.0 pp pro-trade, vs a 23% base [DIRECT] | Mayda & Rodrik, ISSP 1995, 23 countries |
| Trade restrictions (US) | — | +1 SD occupational wage: −7.3 pp support for restrictions; base 67% [DIRECT] | Scheve & Slaughter, NES 1992, 1C |
| Welfare / unemployment spending (more) | — | 7th vs 3rd income decile: 9 pp (unemployment), 7 pp (pensions), ~4 pp (health) [DIRECT] | Busemeyer, Goerres & Weschle 2009, ISSP 1996, 14 OECD |
| "Assistance to the poor" (spend more, US) | 80% | 64% [DERIVED] | GSS 2016+18, 1C |
| "Welfare" (spend more, US) | 31% | 20% (Q4 18%) [DERIVED] | GSS, 1C |
| Education (spend more) | 68% (US) | 76% (US) [DERIVED]; cross-national income cleavage only 3 pp [DIRECT] | GSS 1C; Busemeyer et al. 2009 |
| Military/defence (spend more) | 28% | 32% (inverted U, Q4 39%) [DERIVED]; ISSP average 21% more vs 40% less [DERIVED from DIRECT] | GSS 1C; Bartels ISSP 1985–96, 23 countries |
| Police/law enforcement (spend more) | 47% | 50% (peak Q3–Q4 59–60%) [DERIVED]; ISSP average 49% more vs 8% less | GSS 1C; Bartels ISSP |
| Scientific research (spend more) | 41% | 47% [DERIVED] | GSS 1C |
| Prioritise inflation over unemployment (tight money) | — | ±1 SD income quartile: +3.8 pp, so ~1.7 pp per quartile step [DIRECT; per-step DERIVED]; unemployed −7.1 pp | Scheve 2003/04, ISSP+EB, 20 OECD, 1976–97 |
| same, savers (UK) | — | ±1 SD nominal assets: +5.7 pp; debt has no effect [DIRECT] | Scheve, BHPS, 1C |

The pattern: income gradients are large for **cash redistribution and unemployment benefits** (10–25 pp from Q1 to Q5), small for **universal services** (education, health: under 5 pp), flat or hump-shaped for **security and defence**, and small for **consumption-tax versus income-tax trade-offs**. Values often move support more than income does (section 2).

---

## 1. Support for each instrument, by income

### 1.1 Redistribution and progressive taxation
- **Kudrnáč, A. (2023), "The Polls—Trends: Welfare Regimes and Support for Income Redistribution in Europe", *POQ* 86(4):968–996** (PMC9940779). ESS rounds 1–9 (2002–2019). Item: "The government should take measures to reduce differences in income levels" (agree + agree strongly). Income is harmonised into bottom 20% / middle 60% / top 20%.
  - Text: the low-minus-high gap is "up to 30 percentage points in the Netherlands, Switzerland, Estonia, and the Czech Republic"; Portugal and Hungary show "almost no differences"; the top quintile is lowest in Denmark (~30%), NL and CZ (~40%), CH and UK (~45%) [DIRECT].
  - Figures 3–6, last round (2018/19), low/high (gap): BE 76/64 (12), DE 80/67 (13), FR 85/61 (24), CH 72/49 (23), NL 70/50 (20), DK 47/28 (19), FI 80/58 (22), NO 70/64 (6), SE 66/52 (14), UK 76/55 (21), IE 76/61 (15), ES 84/74 (10), PT 93/83 (10) [FIGURE-READ; the gap numbers are printed on the chart].
  - Means: low = 975/13 = 75.0%; high = 766/13 = 58.9%; gap = 209/13 = 16.1 pp [DERIVED].
- **Alesina & Giuliano (2011), "Preferences for Redistribution", Handbook of Social Economics** (IZA DP 4056).
  - GSS 1972–2004, 1–5 scale, n=19,512: family income −0.043 (0.004) per income category; 1 SD of income ≈ 10% of an SD of preference [DIRECT].
  - WVS (country and wave fixed effects, 1–10 scale): income −0.258 (0.009); unemployed +0.305; left ideology +0.112 per point (1–10) [DIRECT]. The income scale is not defined in the table notes.
  - On Meltzer–Richard: "The basic Meltzer-Richards model has received scant empirical support"; individual income is "a strong determinant" but "not the only one" [DIRECT].
- **GSS 2016+2018 (US, 1C)** [DERIVED; `_scripts/gss_analysis.py`]. Weighted (`wtssall`); quintiles of `coninc` within each year; n=4,748 with income. Q1→Q5:
  - `eqwlth` 1–3 ("government should reduce differences"): 54 / 56 / 52 / 43 / 47%.
  - Own federal income tax "too high": 49 / 54 / 57 / 55 / 55%.
- **Bremer & Bürgisser (2024), "Lower taxes at all costs?", *JEPP*.** Replication data (Harvard Dataverse doi:10.7910/DVN/ECECZA): 4,800 respondents, 1,200 each in DE/ES/IT/UK; support for a tax *cut* on 0–10, ≥6 counted as support; income in deciles (per the script's axis labels). Control group, Q1 (deciles 1–2) → Q5 (9–10) [DERIVED; `_scripts/bremer_analysis.py`]:
  - Lower **top** income tax: 20 / 26 / 21 / 20 / 27%; 69% oppose (≤4).
  - Lower income tax: 62 / 67 / 67 / 58 / 64%.
  - Lower **VAT**: 68 / 71 / 69 / 62 / 63%. By country Q1 vs Q5: DE 59/59, ES 90/68, IT 81/83, UK 58/44.
  - **Trade-off framing matters more than income.** Support for a VAT cut falls from 67% to 37% when paired with a higher income tax, 45% with lower spending and 43% with higher debt. Support for an income-tax cut falls from 63% to 41% when it is financed by a higher VAT. Gradients stay within about ±10 pp in every arm.
  - The fieldwork year was not verified (the article text was not accessible).

### 1.2 Tariffs and trade protection
- **Mayda & Rodrik, NBER WP 8461 (published *EER* 2005).** ISSP 1995 National Identity, 23 countries, >20,000 people; item: should the country limit imports.
  - "Only 23 percent of the sample overall is pro-trade"; males are 7.4 pp more pro-trade [DIRECT].
  - Relative income: income twice the national average (earnrel = 2 vs 1) → +7.0 pp pro-trade; it is *relative*, not absolute, income that matters [DIRECT]. 7.0/23 ≈ +30% relative [DERIVED].
  - Education raises pro-trade views in rich countries; in the Philippines the effect is negative (Stolper–Samuelson) [DIRECT].
- **O'Rourke & Sinnott (2001), TCD WP / *Brookings Trade Forum*.** ISSP 1995, 24 countries; "limit the import of foreign products", 1–5 scale. Simulated P(most protectionist answer) ≈ 31% at the median.
  - Being high-skilled lowers it by 2.3 pp in a $5,000 GDP-per-capita country, 5.5 pp at $15,000 and 8.4 pp at $25,000 (a 27% fall) [DIRECT].
  - Women +7.4 pp [DIRECT].
- **Scheve & Slaughter, NBER WP 6531 (1998; *JIE* 2001), US NES 1992 (1C).**
  - "About 67% of respondents favored trade restrictions" [DIRECT].
  - Occupational wage from its mean to +1 SD: −0.073 in P(support restrictions); negative in 100% of simulations (Fig. 1) [DIRECT].
  - Homeowners in import-exposed counties: +0.029 to +0.039 [DIRECT].

### 1.3 Spending items (welfare, education, defence, police, research)
- **Bartels, "The Opinion-Policy Disconnect" (Princeton WP).** ISSP Role of Government 1985/1990/1996, 23 countries; average response shares (much more + more / less + much less) [DIRECT; sums DERIVED]:

  | Item | More | Same | Less |
  |---|---|---|---|
  | Health | 72.1 | 18.4 | 3.2 |
  | Education | 64.6 | 25.2 | 3.1 |
  | Pensions | 59.3 | 30.0 | 3.6 |
  | Environment | 54.6 | 30.8 | 5.9 |
  | Police and law enforcement | 48.7 | 35.4 | 7.8 |
  | Unemployment benefits | 32.0 | 37.4 | 22.3 |
  | Culture and arts | 25.3 | 37.5 | 27.8 |
  | Defence | 20.9 | 31.3 | 39.5 |

- **Busemeyer, Goerres & Weschle (2009), *JESP* 19(3).** ISSP 1996, 14 OECD countries. "Income cleavage" = |P(spend more) at the 7th decile − P at the 3rd decile|. Mean values [DIRECT]:
  - unemployment ≈ 9 pp (range 5 SE/ES to 15 GB);
  - pensions ≈ 7 pp (up to 14 NZ);
  - health ≈ 4 pp (1 IT to 12 CA);
  - education ≈ 3 pp (1 DE-W/SE/NZ).
  - Age cleavages are as large or larger: education 7 pp, pensions 6 pp.
  - Assuming linearity, a Q1-vs-Q5 gap (about 8 decile steps) would be about twice these values [DERIVED, assumption].
- **GSS 2016+2018 (US, 1C)** [DERIVED]: % "too little is spent" (= spend more), Q1→Q5. Items with an A/B suffix are split-ballot wordings.

  | Item | Q1 | Q2 | Q3 | Q4 | Q5 |
  |---|---|---|---|---|---|
  | Welfare (A) | 31 | 23 | 20 | 18 | 20 |
  | Assistance to the poor (B) | 80 | 77 | 71 | 70 | 64 |
  | Education (A) | 68 | 72 | 80 | 74 | 76 |
  | Military (A) | 28 | 36 | 37 | 39 | 32 |
  | Defence (B) | 34 | 36 | 37 | 32 | 29 |
  | Law enforcement (B) | 47 | 55 | 59 | 60 | 50 |
  | Environment (A) | 68 | 65 | 68 | 63 | 68 |
  | Science | 41 | 40 | 42 | 44 | 47 |

### 1.4 Interest rates, inflation and unemployment
- **Scheve, BoE WP 172 (2003), "Public demand for low inflation" (= *IO* 58(1), 2004).**
  - Cross-national data: 44 surveys in 20 OECD countries, 1976–97 (ISSP 1985/90/96 + Eurobarometer). ISSP item: "keeping down inflation or keeping down unemployment".
    - Income quartile logit coefficient 0.079 (0.009) in one pooled specification.
    - Moving income from −1 SD to +1 SD (SD = 1.106 quartiles): +0.038 in P(inflation priority).
    - Unemployed: −0.071 [DIRECT].
    - Per quartile step: 0.038/(2×1.106) = 1.7 pp [DERIVED].
  - UK BHPS (n=8,827; 1C):
    - Nominal assets −1 SD to +1 SD: +0.057 (SE 0.010).
    - Nominal liabilities: no effect, attributed to variable-rate mortgages.
    - Weeks unemployed: −0.012 to −0.032.
    - Female: −0.07 [DIRECT].
- **Ehrmann & Tzamourani, ECB WP 1095 (2009; *EJPE* 2012).** WVS, about 52,000 responses, 23 industrial countries, 1981–2000.
  - "Fighting rising prices" is the first priority of 15% on average; first or second for 50% in wave 1 versus 30–35% in waves 3–4 [DIRECT].
  - "Memories of hyperinflation are there to last", while milder inflation memories "erode after around 10 to 15 years" [DIRECT].
  - Higher income *reduces* the priority on prices relative to "maintaining order" (odds ratio 1.071 per income step, 9-step relative scale) [DIRECT]. This conflicts in sign with Scheve's result; the item frames differ (a four-way value battery versus inflation-vs-unemployment).

---

## 2. Values and identity beyond income

- **Values often outweigh income: GSS 2016+18 (US, 1C)** [DERIVED]. % spend more (or `eqwlth` 1–3), within income groups:

  | Item | Q1–2 liberal | Q1–2 conservative | Q4–5 liberal | Q4–5 conservative |
  |---|---|---|---|---|
  | Reduce income differences | 71 | 40 | 76 | 19 |
  | Assistance to the poor | 80 | 75 | 82 | 48 |
  | Environment | 74 | 55 | 84 | 46 |
  | Military | 23 | 46 | 16 | 55 |
  | Law enforcement | 40 | 59 | 38 | 68 |
  | Science | 44 | 37 | 56 | 35 |
  | Education | 73 | 67 | 83 | 59 |

  - Values gaps are 2–4× larger among the affluent: for redistribution 57 pp in Q4–5 versus 31 pp in Q1–2. Income × values interact.
  - Religious attendance (weekly or more vs never/less than yearly), Q1–2 / Q4–5:
    - reduce differences 56 vs 56 / 35 vs 55;
    - defence 47 vs 32 / 44 vs 20;
    - environment 55 vs 74 / 54 vs 74;
    - science 33 vs 44 / 35 vs 53;
    - assistance to the poor 74 vs 83 / 61 vs 72.
  - Traditional values raise support for defence and police by 15–25 pp, and lower support for environment and research by 10–20 pp.
- **Religion, cross-country.** Alesina & Giuliano, WVS (1–10 scale, versus atheists): Protestant −0.210, Catholic −0.068, Orthodox +0.174, other religion −0.144 [DIRECT]. In the US GSS, being raised religiously adds 3–6% of an SD [DIRECT].
- **Race and minority status.** Alesina & Giuliano, GSS: black +0.588 on the 1–5 scale; 1 SD of the black dummy ≈ 17% of an SD, larger than income's 10% [DIRECT]. In the GSS (derived), black respondents in Q4–5 favour more aid to the poor at 91% versus 64% for US-born whites [DERIVED].
- **Immigrants versus natives.**
  - GSS (US, 1C) [DERIVED]. Foreign-born versus US-born whites:
    - Q4–5: `eqwlth` 54 vs 41%; welfare (A) 26 vs 17%.
    - Q1–2: `eqwlth` 54 vs 53%; aid to the poor 67 vs 78%.
    - Small samples: n = 83–205 foreign-born.
  - **Burgoon 2011, Juan March WP (= *World Politics* 2014).** ESS 2002–2008, 22 countries, effect on natives' support:
    - Where the immigrant–native unemployment gap is high, foreign-born share from the 50th to the 90th percentile: P(support redistribution) .72 → .56.
    - Over the 1st to 99th percentile: .82 → .39.
    - The effect is much weaker where immigrants are integrated [DIRECT].
- **Nationalism and protection.**
  - O'Rourke & Sinnott: chauvinism from its 20th to its 80th percentile raises P(most protectionist answer) by 19.8 pp (+64%); patriotism by 10.1 pp (+32%) [DIRECT].
  - Mayda & Rodrik: strong neighbourhood or national attachment → less pro-trade; "cosmopolitans" → more [DIRECT, qualitative].
- **Cultural issues invert representation.** Lupu & Warner: on same-sex marriage the poor are "37% closer" to legislators than the rich (Latin America) [DIRECT].
- **Excluded ethnic groups.** Cederman, Wimmer & Min (2010), *World Politics* 62(1). EPR, 1946–2005, 29,519 group-years. Rebellion onset per group-year [DIRECT]:

  | Category | Onset rate |
  |---|---|
  | All included groups | 0.23% |
  | Senior partner | 0.31% |
  | Junior partner | 0.34% |
  | All excluded groups | 0.66% |
  | Regional autonomy | 0.24% |
  | Powerless | 0.60% |
  | Discriminated | 0.93% |
  | Separatist autonomy | 3.99% |

  - Excluded groups are "three times more likely" to rebel; ratio 0.66/0.23 = 2.9 [DERIVED].
  - A downgraded power status multiplies risk by 5.3; prior conflict by 2.4 [DIRECT].
  - The effect is strongest in poor countries [DIRECT].
  - No survey evidence was opened on excluded groups' *approval* of specific state policies (gap).

---

## 3. Political clout: whose preferences become policy

| Study | Setting | Key numbers |
|---|---|---|
| Gilens & Page 2014, *PoP* 12(3), Table 3 (reprinted in Bashir 2015, *Research & Politics*) | US, 1,779 issues, 1981–2002; outcome = change within 4 years | Alone: median citizens 0.64, elites (P90) 0.81, interest groups 0.59. Jointly (Model 4): **median citizens 0.03 (n.s.), P90 0.76\*\*\*, interest groups 0.56\*\*\*** [DIRECT] |
| Gilens, "Affluence & Influence" slides (Harvard Ash Center) | US | Logit slope on logit(% favour), all issues: P10 .34, P50 .41, P90 .53 [DIRECT]. When preferences diverge: low .09 vs high .54; middle .13 vs high .58. Divergent issues, P90 by election cycle: .44 (non-election years), 1.10 (presidential years) [DIRECT] |
| Gilens 2012, as cited by Enns 2026 | US | Slope P10 0.31 vs P90 0.49. Opinion correlations: r = 0.84 (P10–P90), 0.94 (P50–P90) [DIRECT in Enns] |
| Elsässer, Hense & Schäfer, MPIfG DP 18/5 (precursor of *JEPP* 2021) | Germany 1980–2013, 746 questions (222 with income) | 59% of proposals enacted within 4 years (54% within 2) [DIRECT]; 54/59 = 92% of 4-year adoptions occur in the first 2 [DERIVED]. P(change) at 10% → 90% support: P10 .69→.57, P50 .62→.63, P90 .46→.74, P99 .41→.76; self-employed .43→.73, unskilled .59→.62 [DIRECT]. Divergent issues: P10 .81→.42 (inverse), P90 .47→.74 [DIRECT; logit re-computed] |
| Schakel, UvA thesis ch. 3 (= *SER* 19(1), 2021) | Netherlands 1979–2012, 291 issues | Only 27% adopted; corr(P10, P90) = 0.76 [DIRECT]. Odds ratio per pp: P10 1.016, P50 1.020, P90 1.034 [DIRECT]; P(change) 10% → 90%: P10 .17→.42, P50 .15→.45, P90 .09→.59 [DERIVED, logit]. Divergent: P90 .03→.75 vs P10 .19→.34 [DERIVED]. Win rate 30% low-income vs 70% high-income [DIRECT] |
| Bartels 2005 (RSF abstract) and *PS* 2006 | US Senate 1989–94 | P75 has "almost three times as much influence" as P25; bottom fifth "little or no weight"; "no evidence of responsiveness" to the bottom third [DIRECT] |
| Lupu & Warner 2022, *JOP* 84(1) | 52 countries, 565 country-years, 92,000 elites, 3.9 million citizens | Least-affluent quintile is about 16% further from legislators than the richest (EMD gap .03 on a mean of .18); 31% further when rich and poor disagree; middle versus top not significant; Latin America: 11% (left-right), 7% (economic); poor over-represented on cultural issues [DIRECT] |

**Caveats.**
- Enns (2026, *Sociological Science* 13) argues that restricting the analysis to issues where groups' preferences diverge introduces Simpson's paradox, which inflates apparent unequal responsiveness.
- Enns also cites Bhatti & Erikson (2011): with larger samples they find no differential Senate responsiveness.
- Two orders of magnitude bracket the clout effect: cross-national congruence differs by about 16%; divergent-issue responsiveness in the US, DE and NL differs by roughly 4–6×.

---

## 4. When a policy lacks support

**Legislative failure and veto players.** Tsebelis (1999, *APSR* 93(3)), abstract: in 15 West European countries, 1981–91 (laws on working time and conditions), more veto players and greater ideological distance between them "reduce the ability... to produce significant laws". Output rises with government duration and with the ideological distance from the previous government [DIRECT, qualitative; full text not accessible]. Base rates for adopting a proposed change within 4 years: **27% (NL), 59% (DE)** (section 3).

**Delay (war of attrition).** Alesina, Ardagna & Trebbi (2006), NBER WP 12049; developed and developing countries, 1960–2003:
- Stabilisations are more likely in crises, at the start of a term, under "strong" governments and with fewer executive constraints; the IMF effect is weak.
- A crisis brings an average deficit cut of 1.5 pp of GDP, plus 1.9 pp more in presidential systems; up to about 4 pp over longer horizons [DIRECT].

**Electoral cost of fiscal adjustment.**
- Alesina, Carloni & Lecce (2011), NBER WP 17655; 19 OECD countries, 1975–2008; large adjustments (≥1.5% of GDP cyclically adjusted) [DIRECT]:
  - Government changed in 7 of 19 terminations (37%), versus a baseline of about 40%.
  - Among the 5 largest adjustments: 1 of 10.
  - Expenditure-heavy adjustments: 20% changed government; others: 56%. Tax-based adjustments look costlier (PTAX positive, not significant).
- Bojar, Bremer, Kriesi & Wang (2022), *BJPS* 52(1); 15 European countries, monthly polls during the Great Recession [DIRECT]:
  - An austerity package costs **0.6–0.8 pp** of government support immediately and **about 2 pp** by the end of 6 months; the effect then fades.
  - Externally imposed packages: 1.45 pp immediately, 3.58 pp total; domestic: 0.54 / 1.36 pp.
  - High protest (90th percentile): 0.87 / 2.1 pp.
  - Greece averaged over 6 pp total; PASOK lost over 12 pp after the 2011 mid-term package.
- Gabriel, Klein & Pessoa (2023), regional study: 124 regions in 8 European countries, 1980–2015, more than 200 elections. A 1% cut in regional public spending → **+~3 pp vote share for extreme parties**, lower turnout and more fragmentation [DIRECT].

**Unrest.**
- Ponticelli & Voth, BGSE WP 676 (2012; *JCE* 2020); 25 European countries, 1919–2008. CHAOS = riots + demonstrations + strikes + assassinations + attempted revolutions [DIRECT]:
  - Baseline 1.6 incidents per country-year; under 1.4 when spending rises.
  - About **4 per year when spending is cut by 5% or more** ("more than twice as many").
  - +1 SD expenditure cut → +0.4 incidents per year.
  - Tax rises: small and insignificant (under 0.01 per SD).
  - At −2% growth, cuts of 10% versus 1% almost double unrest.
- Drabo et al. (2023), IMF WP 2023/228 (abstract); 101 developing countries, 2001–2020. Fuel price increases raise the number of unrest events, mainly anti-government demonstrations. The effect is amplified in downturns, when health and education spending is low, and with high inequality, weak institutions or corruption [DIRECT, qualitative].
- For excluded groups, rebellion risk is in section 2 (CWM).

---

## 5. How games implement this

- **Victoria 3** (Paradox).
  - Mechanics: Dev Diary #80 (1.3), <https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-80-law-enactment-and-revolution-clock-in-13>:
    - Laws pass through **3 phases**.
    - Success / Advance / Debate / Stall chances are "based on the relative endorsement and opposition of the law from the Interest Groups in your government".
    - At most **3 setbacks**, then "automatic and irrevocable" failure.
    - A negative enactment chance spawns a "Legislative Failures" event.
    - The cancellation cooldown is 2 years [DIRECT].
  - Game constants: `common/defines/00_defines.txt` (third-party mirror `tjysdsg/Victoria-3-files`, commit 0e8b625) [DIRECT]:
    - Clout: Powerful above 0.20 (drops out below 0.18); Marginal below 0.05 (re-entry hysteresis at 0.04).
    - Approval range −20 to +20; Angry ≤ −10, Unhappy ≤ −5, Happy ≥ 5, Loyal ≥ 10.
    - Laws on the books: ±1 per law the IG favours or opposes, ±2 for a strong stance, capped at ±5 in total.
    - Changing a law: ±5; radical change ±10; extreme change ±20; the effect lingers 60 months.
    - Loyalists or radicals: ±15 at 100% of the IG.
    - Enactment: checkpoint base 100 days; advance chance = 2 × success chance; opposing IG clout → stall, multiplied by 0.5 if the IG is neutral, 1.0 if unhappy, 1.5 if angry; failure cooldown 730 days.
  - The official wiki (vic3.paradoxwikis.com) and forum dev diaries #6/#7 could not be opened (bot wall).
- **Democracy 4** (Positech), from a fan guide (gameplay.tips; official documentation not found):
  - About 20 voter groups. Each simulated voter belongs to several groups with variable strength, and joins a group above 50% identification.
  - Policies shift membership.
  - Per-group "cynicism" comes from pre-election pandering and flip-flops.
  - Turnout depends on strength of feeling; "if a voter is happy with you, they vote for you" [DIRECT from the guide; not official].
- **Tropico 5** (community Fandom wiki):
  - 10 factions. A citizen can support several, but not opposing pairs.
  - Each constitutional choice is approved or disapproved per faction, and the stances shift by era.
  - Citizens vote on personal happiness plus faction relations.
  - In Tropico 4 and 6, praising a faction in an election speech gives +10 relations [DIRECT from the wiki].

---

## 6. Suggested mapping to the game (my opinion, not evidence)

1. **Support per group g (ethnicity × quintile) for policy p.** Model support as a logit-scale score:

   `s_gp = α_p + β_p·Δy_gp/y_g + γ_p·trad_g + δ_p·selfexp_g + η_p·included_g + ε`

   where `Δy_gp/y_g` comes from your incidence table. Suggested magnitudes:
   - Redistribution and transfers: set β so that Q1 − Q5 ≈ 16 pp around a 67% mean (ESS).
   - Universal services (education, health): Q1 − Q5 ≈ 3–8 pp.
   - Police and military: roughly flat in income; drive them by values instead. Traditional or conservative values give +15 to +40 pp for defence and police, and −20 to −40 pp for environment and research.
   - Let values matter about twice as much in Q4–5 as in Q1–2 (GSS interaction).
   - Tariffs: the rich and skilled are more pro-trade in core worlds; in low-skill colonies flip the sign (Mayda & Rodrik, O'Rourke & Sinnott). Nationalism or chauvinism adds up to +20 pp protectionism.
   - VAT: weak income gradient (±5 pp). Opposition grows mostly when the player pairs it with visible trade-offs (−25 to −30 pp).
   - Interest rates: savers and high-income groups get +1.7 pp per quintile for anti-inflation policy; unemployed and indebted groups get −7 pp. Add a slowly decaying "inflation memory" (half-life about 10–15 years; permanent after hyperinflation).
2. **Ethnicity.**
   - Creoles: as natives.
   - Settlers from the core: an included or dominant group; more pro-redistribution only if poor, and less supportive of transfers to other species (the Luttmer/Alesina-type in-group term).
   - Other species, excluded: lower baseline legitimacy; rebellion hazard ×2.9 if powerless, ×4 if discriminated (0.93/0.23) relative to included groups; ×5.3 for one-off "downgrade" events.
   - Granting regional autonomy brings risk down to the included level (0.24%). This maps neatly onto your governance regimes.
3. **Clout.** Weight each group by population × a regime-specific affluence multiplier. A Lupu–Warner-style "egalitarian democracy" setting would weight Q5 roughly 1.2–1.5× Q1. A "Gilens-style oligarchy" setting would give Q5 about 1.6× on all issues (.53/.34) and about 4–6× when groups disagree, with Q1 weight near 0. Hysteresis on clout tiers, as in Vic3 (0.20/0.18), avoids flicker.
4. **Enactment.**
   - Base chance per 4-year window: 27–59%.
   - Probability rises from about 0.1 to about 0.6–0.75 as the support of the high-clout coalition goes from 10% to 90% (Schakel, Elsässer).
   - Each additional veto player or larger ideological distance lowers the per-checkpoint success chance.
   - Crises and a new government's first year raise it (war-of-attrition evidence).
   - Use Vic3-style checkpoints with stall and setback counters.
5. **Consequences of unpopular policy.**
   - Government approval −0.7 pp immediately and −2 pp over about 6 months per austerity package, decaying afterwards; ×2.6 if imposed by an external power (3.58/1.36).
   - Extreme-party share +3 pp per 1% spending cut.
   - Unrest roughly ×2.5 when spending cuts are 5% or more; tax rises themselves have little effect.
   - Price shocks to necessities (fuel, consumption tax) trigger protests, amplified by inequality and weak institutions.
   - Tax-based consolidation should cost more votes than spending-based consolidation (Alesina et al.; Bremer & Bürgisser).

---

## 7. Sources opened
- Alesina & Giuliano, IZA DP 4056: https://docs.iza.org/dp4056.pdf
- Kudrnáč 2023 *POQ*: https://pmc.ncbi.nlm.nih.gov/articles/PMC9940779/ (Figures 3–6)
- GSS 2016/2018 Stata files: https://gss.norc.org/content/dam/gss/get-the-data/documents/stata/2018_stata.zip (and the 2016 file)
- Bremer & Bürgisser replication data: https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/ECECZA
- Mayda & Rodrik, NBER WP 8461: https://www.nber.org/system/files/working_papers/w8461/w8461.pdf
- O'Rourke & Sinnott: https://tcd.ie/Economics/TEP/2001_papers/tepno10KO21.PDF
- Scheve & Slaughter, NBER WP 6531 (scanned; read as page images): https://www.nber.org/system/files/working_papers/w6531/w6531.pdf
- Bartels ISSP paper: https://econfaculty.gmu.edu/bcaplan/bartels.pdf
- Busemeyer et al. 2009: https://kops.uni-konstanz.de/bitstreams/b031935f-4eea-4578-b739-a302c65196e9/download
- Scheve, BoE WP 172: https://www.bankofengland.co.uk/-/media/boe/files/working-paper/2003/public-demand-for-low-inflation.pdf
- Ehrmann & Tzamourani, ECB WP 1095: https://www.ecb.europa.eu/pub/pdf/scpwps/ecbwp1095.pdf
- Burgoon 2011: https://digital.march.es/fedora/objects/fjm-pub:1020/datastreams/OBJ/content
- Cederman, Wimmer & Min 2010: https://www.research-collection.ethz.ch/server/api/core/bitstreams/d83313a3-e6b2-4ef8-a5a1-387b2700b23a/content
- Gilens & Page Table 3, via Bashir 2015: https://www.ifs.org/wp-content/uploads/2016/05/Bashir-2015-Gilens-Page-Critique.pdf
- Gilens slides: https://ash.harvard.edu/wp-content/uploads/2024/02/gilens_0.pdf
- Gilens & Page supplementary data codebooks: https://static.cambridge.org/content/id/urn:cambridge.org:id:article:S1537592714001595/resource/name/S1537592714001595sup003.pdf
- Enns 2026: https://sociologicalscience.com/download/volume-13/may/SocSci_v13_528to564.pdf
- Elsässer, Hense & Schäfer, MPIfG DP 18/5: https://unequaldemocracies.unige.ch/download_file/view/8/257
- Schakel: https://pure.uva.nl/ws/files/47921571/Chapter_3.pdf
- Bartels RSF abstract: https://www.russellsage.org/node/4352
- Bartels 2006 *PS*: https://apsanet.org/Portals/54/files/Task%20Force%20Reports/PSJan06Bartels.pdf
- Lupu & Warner: https://www.noamlupu.com/A&C.pdf
- Tsebelis 1999 abstract: https://ideas.repec.org/a/cup/apsrev/v93y1999i03p591-608_21.html
- Alesina, Ardagna & Trebbi: https://www.nber.org/system/files/working_papers/w12049/w12049.pdf
- Alesina, Carloni & Lecce: https://www.nber.org/papers/w17655.pdf
- Bojar et al. (Cambridge full text): https://www.cambridge.org/core/journals/british-journal-of-political-science/article/effect-of-austerity-packages-on-government-popularity-during-the-great-recession/AB8459689B9F126B11E50C488138CDEB
- Gabriel, Klein & Pessoa: https://ec.europa.eu/economy_finance/arc2023/documents/papers/Klein%20M.%20-%20The%20Political%20Costs%20of%20Austerity.pdf
- Ponticelli & Voth: https://bse.eu/sites/default/files/working_paper_pdfs/676.pdf
- IMF WP 2023/228 abstract: https://ideas.repec.org/p/imf/imfwpa/2023-228.html
- Victoria 3 Dev Diary #80 (link in section 5) and defines: https://raw.githubusercontent.com/tjysdsg/Victoria-3-files/0e8b62590c36bc9fdd2c8cba3cb5dda255092656/game/common/defines/00_defines.txt
- Democracy 4 guide: https://gameplay.tips/guides/8590-democracy-4.html
- Tropico wiki: https://tropico.fandom.com (pages "Faction (Tropico 5)" and "Election")

## 8. Could not open, or used a substitute
- **Gilens & Page 2014 full text**: Cambridge paywall; the Princeton copies redirect; the EPFL host does not resolve. Used Bashir's reprint of Table 3.
- **Gilens 2005 *POQ* and the Gilens 2012 book**: not opened. Used the slides and Enns's citations.
- **Paywalled or blocked (403)**: Luttmer 2001 *JPE*; Scheve & Stasavage 2006 *QJPS*; the OECD "Does Inequality Matter?" chapters; the IMF full-text PDF; the Bremer & Bürgisser article text (T&F); GameWatcher.
- **Victoria 3 wiki and the Paradox forum** (dev diaries #6 and #7): bot wall or HTTP 500.
- **Olivera 2015**: TLS error.
- **Not found as open copies**: Tsebelis 1999 full text; Tsebelis & Chang 2004; Alesina & Drazen 1991; Alesina, Perotti & Tavares 1998; Arias & Stasavage 2019; Cheibub, Przeworski & Saiegh 2004; Saiegh 2011; Reeskens & van Oorschot 2015; the published *JEPP* 2021 version of Elsässer et al.; Inglehart's postmaterialism spending studies.
- **Partial**: the Mayda & Rodrik NBER PDF is partly garbled (fonts). The DigiStatement Victoria 3 guide was opened, but the game's defines file superseded it.
- **Not attempted**: ISSP, ESS and WVS microdata require a login or registration.
