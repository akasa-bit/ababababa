# 政策の反応の目標 (回 KE7・B-006 の調べもの)

目標 R80〜R83 (`targets/targets.json` の版 27) の元にした数の記録。論文の PDF を読んで表と図から取り出したもの (図は PDF の線の座標から読んだ)。本文の数と照らして合っていることを確かめた。英語のまま残す。PDF そのものはリポジトリに入れていない (文中のファイル名は調べたときの作業場所のもの)。Ramey & Zubairy の JPE の版の数は、論文から読めなかったので作者の公開したデータとコードで推定し直した値で、**[NOT FROM PAPER]** と書いてある。目標には、論文から読んだ 2014 年の NBER の版の表 1 の数を使った。

---


Compiled 2026-10-29. Every number below was read from a PDF downloaded into this folder (one subfolder per paper), unless it is marked **[NOT FROM PAPER]** or **[UNVERIFIED]**.

**How to read the tags**
- **[TABLE]**: copied from a printed table.
- **[TEXT]**: stated in the paper's prose.
- **[DIGITIZED-VECTOR]**: read from the figure's vector drawing coordinates in the PDF (`pdftocairo -svg`), then mapped to the axis tick coordinates. Precision is about ±0.01 to 0.02 in plotted units. Every case I could check against a number in the text matched it (checks are listed per paper).
- **[DIGITIZED-RASTER]**: read from a 300-dpi bitmap figure by pixel tracing (RR 2004 only). Precision is about ±0.05 pp, and every check against the text matched.
- **SE from a figure** is the half-width of the plotted ±1 SE band, or the 90% band divided by 1.645 where stated.

**Annual conversion conventions.** These follow the timing used in each paper; check that they match your simulation.
- Quarterly papers: quarter 4 is year 1, quarter 8 is year 2, and quarter 12 is year 3. These are point-in-time values h quarters after the shock quarter. I also give annual averages, for example year 0 = mean of quarters 0–3 and year 1 = mean of quarters 4–7. The averages come from the digitized point estimates, so **they have no SEs**: the cross-horizon covariances are not reported.
- Monthly paper: month 12 is year 1, 24 is year 2, 36 is year 3 and 48 is year 4. Annual averages: year 0 = mean of months 0–11, year 1 = mean of months 12–23, and so on.
- Annual papers: horizons are as printed.

---

## 1. Jordà, Schularick & Taylor: monetary policy, trilemma LP-IV (annual panel)

**Citation.** Jordà, Òscar, Moritz Schularick, and Alan M. Taylor. 2020. "The effects of quasi-random monetary experiments." *Journal of Monetary Economics* 112: 22–40. doi:10.1016/j.jmoneco.2019.01.021.

**Version read.** FRBSF Working Paper 2017-02, revised May 2018 (`jst2020/frbsf2017-02.pdf`). I cross-checked it against NBER WP 23074, "January 2017, Revised May 2018" (`jst2020/nber_w23074.pdf`), and the numbers are identical.
- **[UNVERIFIED]** I could not access the published JME version, which is paywalled. Table and figure numbers or values may differ slightly in print.

**Setup.**
- Sample: 17 countries, 1870–2013, excluding 1914–1919 and 1939–1947.
- Outcome: 100 × log change of real GDP per capita and of CPI, relative to the year-0 baseline.
- Shock: the one-year change in the short rate in year 0, normalized to +100 bp.
- Estimation: the LP-IV estimates are for the "pegs" subpopulation (the trilemma instrument).
- SEs are cluster-robust.

**Source: Table 5, "LP-OLS vs. LP-IV. Attenuation bias…", matched samples (p. 18) [TABLE].** Cells show coefficient (SE).

| Year h | GDP LP-OLS, full | GDP **LP-IV, full** | CPI LP-OLS, full | CPI **LP-IV, full** | GDP LP-IV, post-WW2 | CPI LP-IV, post-WW2 |
|---|---|---|---|---|---|---|
| 0 | 0.11 (0.03) | **−0.21 (0.11)** | 0.10 (0.05) | **−0.21 (0.19)** | −0.02 (0.07) | 0.17 (0.14) |
| 1 | −0.18 (0.10) | **−0.99 (0.23)** | 0.17 (0.11) | **−0.68 (0.33)** | −0.75 (0.25) | 0.08 (0.26) |
| 2 | −0.22 (0.16) | **−1.88 (0.33)** | 0.02 (0.18) | **−1.57 (0.43)** | −1.58 (0.35) | −0.46 (0.32) |
| 3 | −0.26 (0.21) | **−2.20 (0.42)** | −0.22 (0.30) | **−2.84 (0.70)** | −1.70 (0.37) | −1.21 (0.42) |
| 4 | −0.18 (0.25) | **−2.87 (0.54)** | −0.39 (0.43) | **−3.83 (0.92)** | −2.20 (0.50) | −1.78 (0.54) |

- Full sample: N = 667, Kleibergen-Paap (KP) weak-IV statistic = 87.83 for GDP and 70.57 for CPI.
- Post-WW2 (1948–2013): N = 522.
- Post-WW2 LP-OLS, GDP: 0.06 (0.02), −0.13 (0.09), −0.22 (0.13), −0.24 (0.16), −0.17 (0.20).
- Post-WW2 LP-OLS, CPI: 0.05 (0.05), 0.11 (0.08), −0.03 (0.13), −0.27 (0.22), −0.47 (0.34).

**Other estimates in the same paper.**
- **Table 4 [TABLE]**: unmatched LP-OLS over all observations (N = 1253), by regime. GDP h=4: pegs −0.33 (0.20), floats −0.84 (0.31), bases −0.34 (0.13).
- **Table 6 [TABLE]**: LP-IV for the US and UK using the Romer-Romer / Cloyne-Hürtgen instrument (N = 71, KP = 4.25, weak). GDP: 0.05 (0.40), −0.59 (0.74), −1.71 (1.20), −2.19 (1.44), −1.88 (1.41). CPI: −0.17 (0.31), 0.32 (0.47), 0.24 (0.80), −1.00 (1.44), −3.05 (2.42).
- **Figure 2 "Full baseline results", full sample, LP-IV with the full variable set (p. 24) [DIGITIZED-VECTOR].** SE is the half-width of the "1 S.D." band.
  - Real GDP per capita, h=0…4: −0.24 (0.13), −0.79 (0.28), −1.50 (0.37), −1.82 (0.40), −2.03 (0.57).
  - Price level, h=0…4: −0.05 (0.17), −0.54 (0.35), −1.21 (0.58), −2.25 (0.81), −3.28 (1.06).
  - The paper's text gives about 2% for GDP and 3% for prices (see the quote below), which matches.
  - The sample behind Figure 2 is not stated. It gives a smaller GDP effect than Table 5.
- **Policy-rate path** (needed because the shock is temporary), Figure 2 text [TEXT]: "short-term interest rates increase by +150 bps in year 1, drop back to +75 bps in year 2, and then decline to effectively zero in both years 3 and 4."
- **Spillover-corrected bounds**, Figure 1 [TEXT]: the output response is "about 0.5 to 1 percentage points less negative by year 4" than plain LP-IV.

**Quotes.**
- pp. 17–19: "Using LP-OLS estimates (column 1) and the full sample, output would be estimated to be about 0.18% lower four years after an increase in interest rates of 1%. In contrast, the LP-IV effect is measured to be nearly a 2.9% decline, or about a 0.5% annualized rate of lower growth."
- p. 23 (Figure 2): "a +100 bps increase in the short rate causally leads to a 2% decline in real GDP per capita (or about −0.5% per annum), a 1.5% decline in real consumption per capita, a 3.5% decline in real investment per capita, and a 3% decline in the price level."

**Caveat.** p. 9 defines y(h) as "100 times the log difference between real GDP in t+h relative to t", but h=0 responses are non-zero and the controls include contemporaneous variables. Treat h=0 as the impact-year response.

---

## 2. Romer & Romer (2010): tax shocks (US quarterly, 1950:I–2007:IV)

**Citation.** Romer, Christina D., and David H. Romer. 2010. "The Macroeconomic Effects of Tax Changes: Estimates Based on a New Measure of Fiscal Shocks." *American Economic Review* 100(3): 763–801.
- Read: the published AER PDF (`rr2010/rr2010_aer.pdf`).

**Experiment.**
- Shock: an exogenous legislated tax increase of 1% of GDP, ΔT = 1 in quarter 0. This is a permanent step in tax liabilities.
- Outcome: log real GDP, in percent.
- Bands are ±1 SE.
- The baseline regresses ΔY on ΔT at lags 0–12, so values exist only up to quarter 12 (equation 6).

**Source: Figure 4 (single equation, no controls, p. 782) [DIGITIZED-VECTOR].**
- Check against the text: the peak digitizes as −3.082 at Q10 with SE 0.874, giving t = −3.53. The text says "−3.08 percent after ten quarters (t = −3.53)".

| Quarter | 0 | 1 | 2 | 3 | **4 (yr 1)** | 5 | 6 | 7 | **8 (yr 2)** | 9 | **10 (peak)** | 11 | **12 (yr 3)** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Estimate | −0.09 | −0.39 | −0.23 | −0.75 | **−1.12** | −1.36 | −1.67 | −2.43 | **−2.73** | −2.99 | **−3.08** | −2.72 | **−2.52** |
| SE | 0.29 | 0.41 | 0.51 | 0.58 | **0.63** | 0.68 | 0.72 | 0.76 | **0.80** | 0.84 | **0.87** | 0.92 | **0.96** |

- Annual averages of the Figure 4 path (no SE): year 0 (Q0–3) −0.36, year 1 (Q4–7) −1.65, year 2 (Q8–11) −2.88.

**Two-variable VAR: Figure 6, panel C (innovation of 1% of GDP to the tax series, p. 783) [DIGITIZED-VECTOR].**
- Check against the text: the peak digitizes as −2.933 at Q10 with SE 1.046, giving t = −2.80. The text says "2.93 percent after ten quarters (t = −2.80)".
- Values, estimate (SE):
  - Q4: −0.99 (0.76)
  - Q8: −2.68 (0.96)
  - Q10: −2.93 (1.05)
  - Q12: −2.24 (1.15)
  - Q16: −1.86 (1.15)
  - Q20: −1.82 (1.07)
- Bands are slightly asymmetric; the SE given is the band half-width.
- Annual averages: year 0 −0.24, year 1 −1.57, year 2 −2.74, year 3 −2.05, year 4 −1.84.

**Controlling for lagged GDP growth: Figure 5 [TEXT].**
- Peak −3.02 at Q10 (t = −2.90, so SE ≈ 1.04).
- Footnote 16: "the estimated effect diminishes from −3.02 percent in quarter 10 to −2.41 percent in quarter 12, and then fluctuates between −2.3 and −2.5 percent" out to Q24.
- **[NOT EXTRACTED]** Q4 and Q8 for this specification. Its dashed lines are drawn as filled shapes; the paper says it tracks Figure 4 "very closely at all horizons".

**Subtypes: Figure 9 [TEXT].**
- Long-run-motivated tax changes: peak −2.99 at Q10 (t = −2.92).
- Deficit-driven tax changes: much smaller and imprecise.

**Quotes.**
- p. 764: "Our estimates suggest that a tax increase of 1 percent of GDP reduces output over the next three years by nearly three percent."
- p. 781: "The maximum effect is a fall in output of 3.08 percent after ten quarters (t = −3.53)."

---

## 3. Ramey & Zubairy (2018): government spending multipliers (US quarterly, 1889–2015)

**Citation.** Ramey, Valerie A., and Sarah Zubairy. 2018. "Government Spending Multipliers in Good Times and in Bad: Evidence from US Historical Data." *Journal of Political Economy* 126(2): 850–901.

**[UNVERIFIED] I could not read the JPE PDF.**
- The only free copy is on econweb.ucsd.edu. Its TLS chain ends in an emSign root that is not in this machine's CA bundles (I did not disable verification), and WebFetch returned HTTP 503.
- The publisher (journals.uchicago.edu) and archive.org were blocked.

### 3a. From a paper I could read: NBER WP 20719 (November 2014), Table 1 [TABLE] (`rz2018/nber_w20719.pdf`)

This is an earlier draft whose sample ends in 2013, so the published numbers differ. Multipliers are cumulative ("integral") ΔY/ΔG, in dollars.

| Military news, 1889–2013 | Linear | High unemployment | Low unemployment |
|---|---|---|---|
| 2-year integral | **0.76 (0.102)** | 0.69 (0.094) | 0.78 (0.187) |
| 4-year integral | **0.84 (0.092)** | 0.76 (0.060) | 0.96 (0.218) |

- Table 2 of the same WP gives point estimates only, no SEs:
  - Blanchard-Perotti: 2-year **0.54**, 4-year **0.78**.
  - Subsample 1947–2013 (news): 2-year 0.89, 4-year 0.47.
  - Excluding WWII: 2-year 1.01 (0.376), 4-year 1.26 (0.365).
- Quote (WP p. 12): "the implied multipliers are below one and range from 0.7 to 0.96."

### 3b. JPE-consistent numbers [NOT FROM PAPER: my replication from the authors' data and code]

**Inputs.**
- Data: `RZDAT.xlsx`, Ramey's posted dataset (revised November 2016).
- Code: the authors' `jordagk.do` (dated 24 February 2018).
- Both were taken from a public replication repository, github.com/amalzmv-013/ramey-zubairy-2018-lp, cloned to `rz2018/repl_repo/`.

**Method.** I re-implemented the do-file's one-step LP-IV in Python (`../irf_scripts/rz_repl.py`):
- Regression: Σ_{j=0..h} y_{t+j} on Σ_{j=0..h} g_{t+j}, with g instrumented by news (or, for Blanchard-Perotti, by current g).
- Controls: 4 lags of news, y and g. Variables are divided by potential GDP (6th-degree trend). No time trends.
- 2-year = h=7, i.e. quarters 0–7; 4-year = h=15.

**Validation.** A search-engine snippet of JPE Table 1 shows military news, 2-year: linear .66, high unemployment .60, low unemployment .59. My replication gives .664, .603 and .595 at h=7, which matches.
- The point estimates should equal the JPE's.
- **The SEs are approximate.** They come from my implementation of ivreg2's Bartlett `bw(auto)` HAC, and they change by about ±0.01 to 0.03 across bandwidth choices.

| Shock, sample | 2-year integral | 4-year integral |
|---|---|---|
| Military news, 1889–2015 | **0.66 (≈0.07)** | **0.71 (≈0.04)** |
| Blanchard-Perotti, 1889–2015 | **0.38 (≈0.09)** | **0.47 (≈0.10)** |
| Military news, 1947–2015 | 0.75 (≈0.16) | 0.51 (≈0.15) |
| Blanchard-Perotti, 1947–2015 | 0.32 (≈0.20) | 0.32 (≈0.24) |

- Post-WWII news is a weak instrument; the paper discusses this.
- **[UNVERIFIED]** that the JPE prints the post-WWII and Blanchard-Perotti rows in Table 1. A search snippet says the JPE's second panel (Blanchard-Perotti) gives "0.4–0.5 in the linear case", which is consistent with 0.38 and 0.47.

---

## 4. Romer & Romer (2004): monetary shocks (US monthly, 1970:1–1996:12)

**Citation.** Romer, Christina D., and David H. Romer. 2004. "A New Measure of Monetary Shocks: Derivation and Implications." *American Economic Review* 94(4): 1055–1084.
- Read: the published AER PDF (`rr2004/rr2004_aer.pdf`).

**Experiment.**
- Shock: a one-time realization of 1 pp of the new shock series (intended federal funds rate purged of Greenbook forecasts).
- The actual funds rate is transitory [TEXT, fn. 19]: it "rises more than one-for-one with our measure for the first few months following a shock, but quickly falls to zero (and then below)."
- Outcomes are in log levels, in percent: industrial production (IP, Figure 2) and the PPI for finished goods (Figure 4, the baseline price index).
- Bands are ±1 SE (Monte Carlo).
- Figures are raster images, so values are **[DIGITIZED-RASTER]**. Bold entries are exact values from the text.

| Month (year) | IP estimate (SE) | PPI estimate (SE) |
|---|---|---|
| 12 (yr 1) | −2.10 (≈0.86) | +0.05 (≈0.40) |
| 22–27 (IP trough) | **−4.3**; m22 2-SE CI **(−7.0, −1.4)**, so SE ≈ 1.4 | — |
| 24 (yr 2) | −4.32 (≈1.48) | −0.45 (≈0.64) |
| 30 | −3.76 (≈1.70) | **−1.9** [TEXT] (≈0.79) |
| 36 (yr 3) | −2.35 (≈1.97) | −3.30 (≈0.78) |
| 48 (yr 4) | **−1.7**; 2-SE CI **(−6.4, +3.0)**, so SE ≈ 2.35 | **−5.9**; 2-SE CI **(−8.0, −3.7)**, so SE ≈ 1.08 (t = 5.5) |

**Peaks and timing.**
- IP: −4.3% at months 22–27 [TEXT]. IP is slightly positive in months 1–4 (+0.6 at month 2).
- PPI: at most +0.3 within the first 8 months (not significant), then falling until month 48 with no trough inside 48 months. |t| reaches 2 at month 29 and 4 at month 37 [TEXT].

**Alternative price indices: Figure 5 [TEXT].**
- CPI excluding shelter at month 48: **−3.6 (t = 4.3, so SE ≈ 0.84)**. PCE price index: −3.6 (t = 5.0).
- Digitized CPI excluding shelter (no bands plotted): m12 +0.17, m24 −0.03, m36 −1.80.

**Annual averages of the digitized paths (no SE).**
- IP: year 0 (m0–11) −0.30, year 1 −3.13, year 2 −3.72, year 3 −1.98.
- PPI: year 0 +0.15, year 1 +0.02, year 2 −1.74, year 3 −4.52.

**Robustness [TEXT].**
- Omitting October 1979 to May 1981: IP peak −3.4.
- With 48 lags: IP at month 48 is −0.8.
- VAR (Figure 9): IP peak −2.9; price level −5.0 at month 48.

**Quote (p. 1069).** "The estimated effect is essentially flat at −4.3 percent in months 22 through 27. This means that a one-percentage-point rise in the Federal Reserve's intentions for the funds rate, not taken in response to information about future economic developments, reduces industrial production by over 4 percent."

---

## 5. Annual cross-country fiscal panels

### 5a. Guajardo, Leigh & Pescatori: narrative fiscal consolidations

**Citation.** Guajardo, Jaime, Daniel Leigh, and Andrea Pescatori. 2014. "Expansionary Austerity? International Evidence." *Journal of the European Economic Association* 12(4): 949–968.
- Read: IMF WP/11/158 (2011), "Expansionary Austerity: New International Evidence" (`panel/glp2014/imf_wp11158.pdf`).
- **[UNVERIFIED]** I did not access the JEEA print version.

**Setup.**
- Sample: 17 OECD countries, 1978–2009.
- Shock: a permanent deficit-driven (action-based) consolidation of 1% of GDP.
- Estimation: OLS distributed lag with 2 lags, country and year fixed effects, delta-method SEs.
- Timing: **t = 1 is the year of consolidation**.

**Source: Figure 2, GDP panel (p. 14) [DIGITIZED-VECTOR] and Table 1 "Baseline" (p. 18) [TABLE].**

| t (year) | 1 (impact year) | **2 (one year after)** | 3 |
|---|---|---|---|
| Real GDP, % | −0.32 (≈0.11) | **−0.62 (0.16)** [TABLE] | −0.52 (≈0.19) |

- Table 1 alternatives for GDP at t=2:
  - TSLS: −0.80 (0.31)
  - Two-variable VAR: −0.73 (0.19)
  - Static model: −0.65 (0.14)
- Private consumption at t=2: −0.75 (0.17). Unemployment rate: +0.32 (0.09).
- Using the change in the cyclically adjusted primary balance (CAPB) instead gives GDP +0.29 (t = 3.69), which is biased.

**Quote (p. 6).** "Our estimates imply that a 1 percent of GDP fiscal consolidation reduces real private consumption over the next two years by 0.75 percent, while real GDP declines by 0.62 percent."

### 5b. Jordà & Taylor: LP-IV with the GLP narrative instrument

**Citation.** Jordà, Òscar, and Alan M. Taylor. 2016. "The Time for Austerity: Estimating the Average Treatment Effect of Fiscal Policy." *Economic Journal* 126(590): 219–255.
- Read: NBER WP 19414 (September 2013) (`panel/jt2016/nber_w19414.pdf`).
- **[UNVERIFIED]** I did not access the EJ print version.

**Setup.**
- Data: the combined Alesina-Ardagna and GLP panel (17 OECD countries).
- Shock: change in CAPB of +1% of GDP, instrumented by the IMF narrative consolidation dummy.
- Outcome: 100 × log real GDP relative to year 0. Year 1 is the first year of fiscal impact, the same timing as GLP's t = 1.
- SEs are clustered by country.

**Source: Table 3 [TABLE].** Cells show estimate (SE).

| Year | 1 | 2 | 3 | 4 | 5 | Sum |
|---|---|---|---|---|---|---|
| IV, binary treatment | −0.34 (0.12) | **−0.72 (0.23)** | −0.76 (0.25) | −0.78 (0.23) | −0.88 (0.28) | −2.94 (0.84) |
| IV, continuous total | −0.46 (0.13) | −0.81 (0.23) | −0.69 (0.31) | −0.58 (0.28) | −0.68 (0.30) | −2.77 (0.97) |
| OLS, Table 1 (biased) | 0.11 (0.04) | 0.12 (0.05) | −0.04 (0.04) | −0.21 (0.07) | −0.32 (0.12) | −0.42 (0.16) |

- First-stage F is about 27 to 54. N = 457 at year 1 and 389 at year 5.
- Table 4 (binary IV) by state:
  - Slump: −0.25 (0.15), −0.76 (0.25), −0.95 (0.31), −0.79 (0.33), −0.93 (0.45).
  - Boom: −0.34 (0.33), −0.32 (0.50), −0.13 (0.51), −0.59 (0.52), −0.81 (0.59).

**Quote (p. 10).** "for every 1% in fiscal consolidation, the path of real GDP is pushed down by over 0.57 percent each year on average over the five subsequent years."

---

### Files
- PDFs and text extracts: `jst2020/`, `rr2010/`, `rr2004/`, `rz2018/`, `panel/glp2014/`, `panel/jt2016/`.
- Rendered figure pages and digitization intermediates: `*/fig/`.
- Scripts (kept outside the download folders):
  - `../irf_scripts/svgpaths.py`, `../irf_scripts/digitize.py`, `../irf_scripts/svgall.py`: vector digitizing.
  - `../irf_scripts/rasterlines3.py`: raster digitizing.
  - `../irf_scripts/rz_repl.py`: Ramey-Zubairy replication.
