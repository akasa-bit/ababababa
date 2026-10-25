"""Cross-country correlations: education spending/human capital vs innovation outputs.
Usage: python3 -I analyze.py <download_dir>
"""
import sys, json, math
import numpy as np
import pandas as pd

DL = sys.argv[1]

# ---------- country metadata (exclude aggregates) ----------
meta = json.load(open(f"{DL}/countries.json"))[1]
real = {c["id"]: c for c in meta if c["region"]["value"] != "Aggregates"}
iso3 = set(real)
inc = {k: v["incomeLevel"]["value"] for k, v in real.items()}

def load(series):
    raw = json.load(open(f"{DL}/wdi_{series}.json"))
    rows = []
    for r in raw[1] or []:
        c = r["countryiso3code"]
        if c in iso3 and r["value"] is not None:
            rows.append((c, int(r["date"]), float(r["value"])))
    return pd.DataFrame(rows, columns=["c", "y", "v"])

S = {
    "edu_gdp": "SE.XPD.TOTL.GD.ZS", "edu_gov": "SE.XPD.TOTL.GB.ZS",
    "tert_pc": "SE.XPD.TERT.PC.ZS", "prim_pc": "SE.XPD.PRIM.PC.ZS",
    "seco_pc": "SE.XPD.SECO.PC.ZS", "tert_share": "SE.XPD.TERT.ZS", "prim_share": "SE.XPD.PRIM.ZS", "seco_share": "SE.XPD.SECO.ZS",
    "rd": "GB.XPD.RSDV.GD.ZS", "res": "SP.POP.SCIE.RD.P6",
    "pat": "IP.PAT.RESD", "pop": "SP.POP.TOTL", "gdppc": "NY.GDP.PCAP.PP.KD",
    "ter_enr": "SE.TER.ENRR", "hci": "HD.HCI.OVRL", "lays": "HD.HCI.LAYS",
    "hlos": "HD.HCI.HLOS", "eyrs": "HD.HCI.EYRS", "art": "IP.JRN.ARTC.SC",
    "ba25": "SE.TER.CUAT.BA.ZS",
}
D = {k: load(v) for k, v in S.items()}
for k, v in S.items():
    d = D[k]
    print(f"{k:10s} {v:20s} obs={len(d):6d} countries={d.c.nunique():4d} years={d.y.min() if len(d) else None}-{d.y.max() if len(d) else None}")

def avg(k, y0, y1):
    d = D[k]
    d = d[(d.y >= y0) & (d.y <= y1)]
    return d.groupby("c").v.mean()

# per-capita derived panels
def percap(k, y0, y1):
    d = D[k].merge(D["pop"], on=["c", "y"], suffixes=("", "_p"))
    d = d[(d.y >= y0) & (d.y <= y1)]
    d["pc"] = d.v / d.v_p * 1e6
    return d.groupby("c").pc.mean()

W0, W1 = 2013, 2022
X = pd.DataFrame({k: avg(k, W0, W1) for k in ["edu_gdp", "edu_gov", "tert_pc", "prim_pc", "seco_pc", "tert_share", "prim_share", "seco_share", "rd", "res", "gdppc", "ter_enr", "ba25"]})
for lv in ["tert", "prim", "seco"]:
    X[lv + "_ppp"] = X[lv + "_pc"] / 100 * X.gdppc
X["pat_pm"] = percap("pat", W0, W1)
X["art_pm"] = percap("art", W0, W1)
for k in ["hci", "lays", "hlos", "eyrs"]:
    X[k] = avg(k, 2017, 2020)
X["lgdp"] = np.log(X.gdppc)

# ---------- PWT 11.0: TFP growth & level ----------
pwt = pd.read_excel(f"{DL}/pwt110.xlsx", "Data")
pwt = pwt[["countrycode", "year", "rtfpna", "ctfp", "hc", "rgdpna", "pop"]]
def pw(var, yr):
    return pwt[pwt.year == yr].set_index("countrycode")[var]
X["g_tfp_00_19"] = (np.log(pw("rtfpna", 2019)) - np.log(pw("rtfpna", 2000))) / 19 * 100
X["g_tfp_10_19"] = (np.log(pw("rtfpna", 2019)) - np.log(pw("rtfpna", 2010))) / 9 * 100
X["ctfp_2000"] = pw("ctfp", 2000)
X["ctfp_2019"] = pw("ctfp", 2019)
X["hc_2019"] = pw("hc", 2019)
X["lgdp_pwt_2000"] = np.log(pw("rgdpna", 2000) / pw("pop", 2000))

# ---------- Barro-Lee ----------
bl = pd.read_csv(f"{DL}/BL_v3_MF2564.csv")
bl15 = bl[bl.year == 2015].set_index("WBcode")
bl00 = bl[bl.year == 2000].set_index("WBcode")
X["yrs_2015"] = bl15.yr_sch
X["lh_2015"] = bl15.lh          # % with some tertiary
X["lhc_2015"] = bl15.lhc        # % completed tertiary
X["yrs_ter_share_2000"] = bl00.yr_sch_ter / bl00.yr_sch
X["lh_2000"] = bl00.lh
X["yrs_2000"] = bl00.yr_sch

X = X[X.index.isin(iso3)]
print("\nN countries in frame:", len(X))

# ---------- helpers ----------
def ols(y, Xm):
    """OLS with HC1 robust SE. Xm includes constant."""
    n, k = Xm.shape
    b = np.linalg.lstsq(Xm, y, rcond=None)[0]
    e = y - Xm @ b
    XtXi = np.linalg.inv(Xm.T @ Xm)
    meat = (Xm * e[:, None]).T @ (Xm * e[:, None])
    V = XtXi @ meat @ XtXi * n / (n - k)
    r2 = 1 - (e @ e) / ((y - y.mean()) @ (y - y.mean()))
    return b, np.sqrt(np.diag(V)), r2

def rank(a):
    return pd.Series(a).rank().values

LOGV = {"rd", "res", "pat_pm", "art_pm", "tert_pc", "prim_pc", "seco_pc", "tert_ppp", "prim_ppp", "seco_ppp"}

def tr(name, s):
    return np.log(s) if name in LOGV else s

def corr_block(xn, yn, frame=X):
    d = frame[[xn, yn, "lgdp"]].replace([np.inf, -np.inf], np.nan).dropna()
    if xn in LOGV or yn in LOGV:
        d = d[(d[xn] > 0) & (d[yn] > 0)]
    n = len(d)
    if n < 10:
        return None
    x, y, g = d[xn].values, d[yn].values, d["lgdp"].values
    r_lvl = np.corrcoef(x, y)[0, 1]
    xt, yt = tr(xn, x), tr(yn, y)
    r_tr = np.corrcoef(xt, yt)[0, 1]
    rho = np.corrcoef(rank(x), rank(y))[0, 1]
    # partial on log GDP pc
    Z = np.column_stack([np.ones(n), g])
    ex = xt - Z @ np.linalg.lstsq(Z, xt, rcond=None)[0]
    ey = yt - Z @ np.linalg.lstsq(Z, yt, rcond=None)[0]
    r_part = np.corrcoef(ex, ey)[0, 1]
    b, se, r2 = ols(yt, np.column_stack([np.ones(n), xt, g]))
    return dict(x=xn, y=yn, n=n, r_level=r_lvl, r_trans=r_tr, spearman=rho, partial_lgdp=r_part,
                slope_cond=b[1], se_cond=se[1], t=b[1] / se[1], r2_cond=r2)

edu_vars = ["edu_gdp", "edu_gov", "prim_pc", "seco_pc", "tert_pc", "prim_ppp", "seco_ppp", "tert_ppp", "prim_share", "seco_share", "tert_share", "ter_enr", "ba25", "hci", "hlos", "lays", "eyrs", "yrs_2015", "lh_2015", "hc_2019"]
out_vars = ["rd", "res", "pat_pm", "art_pm", "g_tfp_00_19", "g_tfp_10_19", "ctfp_2019"]
res = []
for xv in edu_vars:
    for yv in out_vars:
        r = corr_block(xv, yv)
        if r:
            res.append(r)
R = pd.DataFrame(res)
pd.set_option("display.width", 250); pd.set_option("display.max_rows", 500)
print(f"\n=== Cross-section correlations, WDI averages {W0}-{W1} (HCI 2017-2020; PWT TFP; Barro-Lee) ===")
print("r_trans uses log() for rd,res,pat_pm,art_pm and per-student spending; partial/slope control for log GDP pc PPP (2013-22 avg)")
print(R.round(3).to_string(index=False))

# ---------- innovation outputs vs income ----------
print("\n=== Innovation outputs vs log GDP per capita PPP (2013-2022 avg) ===")
for yv in ["rd", "res", "pat_pm", "art_pm", "edu_gdp", "tert_pc", "hci"]:
    d = X[[yv, "lgdp"]].dropna()
    if yv in LOGV:
        d = d[d[yv] > 0]
    yt = tr(yv, d[yv].values)
    b, se, r2 = ols(yt, np.column_stack([np.ones(len(d)), d.lgdp.values]))
    print(f"{yv:8s} n={len(d):3d} slope={b[1]:.3f} (se {se[1]:.3f}) const={b[0]:.3f} R2={r2:.3f}  corr={np.corrcoef(yt, d.lgdp)[0,1]:.3f}  {'(log-log elasticity)' if yv in LOGV else '(level on log income)'}")

# quadratic for researchers (f(income) shape)
d = X[["res", "lgdp"]].dropna(); d = d[d.res > 0]
b, se, r2 = ols(np.log(d.res.values), np.column_stack([np.ones(len(d)), d.lgdp.values, d.lgdp.values ** 2]))
print(f"log res = {b[0]:.2f} + {b[1]:.3f} lgdp + {b[2]:.4f} lgdp^2  (n={len(d)}, R2={r2:.3f}; se {se[1]:.3f}, {se[2]:.4f})")

# ---------- by income group ----------
print("\n=== Medians by World Bank income group (2013-2022 avg) ===")
X["inc"] = [inc.get(c) for c in X.index]
cols = ["edu_gdp", "tert_pc", "prim_pc", "seco_pc", "tert_ppp", "prim_ppp", "tert_share", "ter_enr", "rd", "res", "pat_pm", "art_pm", "hci", "hlos", "g_tfp_00_19"]
g = X.groupby("inc")[cols].median().round(2)
g["n_rd"] = X.groupby("inc").rd.count(); g["n_edu"] = X.groupby("inc").edu_gdp.count()
print(g.to_string())

# ---------- multivariate: what predicts log researchers & log R&D ----------
print("\n=== Multivariate (HC1 SE): log outcome on edu_gdp, HLO test score/100, log GDP pc ===")
for yv in ["res", "rd", "pat_pm"]:
    d = X[[yv, "edu_gdp", "hlos", "lgdp"]].dropna(); d = d[d[yv] > 0]
    Xm = np.column_stack([np.ones(len(d)), d.edu_gdp, d.hlos / 100, d.lgdp])
    b, se, r2 = ols(np.log(d[yv].values), Xm)
    print(f"log {yv}: n={len(d)} edu_gdp {b[1]:.3f}({se[1]:.3f})  hlos/100 {b[2]:.3f}({se[2]:.3f})  lgdp {b[3]:.3f}({se[3]:.3f})  R2={r2:.3f}")
for yv in ["res", "rd", "pat_pm"]:
    d = X[[yv, "yrs_2015", "hlos", "lgdp"]].dropna(); d = d[d[yv] > 0]
    Xm = np.column_stack([np.ones(len(d)), d.yrs_2015, d.hlos / 100, d.lgdp])
    b, se, r2 = ols(np.log(d[yv].values), Xm)
    print(f"log {yv}: n={len(d)} yrs_sch(BL2015) {b[1]:.3f}({se[1]:.3f})  hlos/100 {b[2]:.3f}({se[2]:.3f})  lgdp {b[3]:.3f}({se[3]:.3f})  R2={r2:.3f}")

# ---------- Vandenbussche-style: TFP growth on tertiary x proximity ----------
print("\n=== TFP growth 2000-2019 (PWT rtfpna, %/yr) on Barro-Lee 2000 tertiary share x proximity (ctfp 2000, US=1) ===")
d = X[["g_tfp_00_19", "lh_2000", "yrs_2000", "ctfp_2000"]].dropna()
d = d[(d.ctfp_2000 > 0) & (d.ctfp_2000 < 2)]
lh = d.lh_2000 / 100
prox = np.log(d.ctfp_2000)
Xm = np.column_stack([np.ones(len(d)), lh, prox, lh * prox, d.yrs_2000])
b, se, r2 = ols(d.g_tfp_00_19.values, Xm)
names = ["const", "tert_share(0-1)", "log prox", "tert x logprox", "yrs_sch"]
print(f"n={len(d)} R2={r2:.3f}")
for nm, bb, ss in zip(names, b, se):
    print(f"  {nm:16s} {bb:8.3f} ({ss:.3f})")
# split near/far
med = d.ctfp_2000.median()
for lab, sub in [("near (ctfp>=median)", d[d.ctfp_2000 >= med]), ("far (ctfp<median)", d[d.ctfp_2000 < med])]:
    Xm = np.column_stack([np.ones(len(sub)), sub.lh_2000 / 100, sub.yrs_2000, np.log(sub.ctfp_2000)])
    b, se, r2 = ols(sub.g_tfp_00_19.values, Xm)
    print(f"  {lab}: n={len(sub)} tert_share {b[1]:.3f}({se[1]:.3f}) yrs {b[2]:.3f}({se[2]:.3f}) logprox {b[3]:.3f}({se[3]:.3f}) R2={r2:.3f}; median ctfp={med:.2f}")

# ---------- Lags: does past education spending predict later researchers / R&D growth? ----------
print("\n=== Lag tests (cross-country) ===")
e_early = avg("edu_gdp", 1998, 2004)
g_early = np.log(avg("gdppc", 1998, 2004))
for outk, (a0, a1, b0, b1) in {"res": (1998, 2004, 2016, 2022), "rd": (1998, 2004, 2016, 2022)}.items():
    o0 = np.log(avg(outk, a0, a1)); o1 = np.log(avg(outk, b0, b1))
    gg = np.log(avg("gdppc", b0, b1)) - g_early
    d = pd.DataFrame({"e": e_early, "g0": g_early, "o0": o0, "o1": o1, "dg": gg}).replace([np.inf, -np.inf], np.nan).dropna()
    d = d[d.index.isin(iso3)]
    dy = (d.o1 - d.o0).values
    Xm = np.column_stack([np.ones(len(d)), d.e, d.g0, d.o0])
    b, se, r2 = ols(dy, Xm)
    print(f"dlog {outk} (1998-04 -> 2016-22) on edu%GDP 1998-04 | lgdp0, log {outk}0: n={len(d)} b_edu={b[1]:.3f}({se[1]:.3f}) b_lgdp0={b[2]:.3f}({se[2]:.3f}) b_o0={b[3]:.3f}({se[3]:.3f}) R2={r2:.3f}")
    Xm = np.column_stack([np.ones(len(d)), d.e, d.g0, d.o0, d.dg])
    b, se, r2 = ols(dy, Xm)
    print(f"   + income growth control: b_edu={b[1]:.3f}({se[1]:.3f}) b_dlgdp={b[4]:.3f}({se[4]:.3f}) R2={r2:.3f}")

# Long-difference: change in edu spending vs change in researchers, contemporaneous vs lagged
de1 = avg("edu_gdp", 2008, 2012) - avg("edu_gdp", 1998, 2002)
dres_c = np.log(avg("res", 2008, 2012)) - np.log(avg("res", 1998, 2002))
dres_l = np.log(avg("res", 2018, 2022)) - np.log(avg("res", 2008, 2012))
dg_c = np.log(avg("gdppc", 2008, 2012)) - np.log(avg("gdppc", 1998, 2002))
dg_l = np.log(avg("gdppc", 2018, 2022)) - np.log(avg("gdppc", 2008, 2012))
for lab, dr, dg in [("contemporaneous (98-02->08-12)", dres_c, dg_c), ("lagged 10y (08-12->18-22)", dres_l, dg_l)]:
    d = pd.DataFrame({"de": de1, "dr": dr, "dg": dg}).replace([np.inf, -np.inf], np.nan).dropna()
    d = d[d.index.isin(iso3)]
    b, se, r2 = ols(d.dr.values, np.column_stack([np.ones(len(d)), d.de, d.dg]))
    print(f"dlog res {lab} on d edu%GDP (98-02->08-12) | dlog gdppc: n={len(d)} b={b[1]:.3f}({se[1]:.3f}) r={np.corrcoef(d.de, d.dr)[0,1]:.3f}")

# Patents per researcher (productivity of research) vs income
d = X[["pat_pm", "res", "lgdp"]].dropna(); d = d[(d.pat_pm > 0) & (d.res > 0)]
ppr = np.log(d.pat_pm / d.res)
b, se, r2 = ols(ppr.values, np.column_stack([np.ones(len(d)), d.lgdp]))
print(f"\nlog(resident patents per researcher) on lgdp: n={len(d)} slope={b[1]:.3f}({se[1]:.3f}) R2={r2:.3f}; median patents/researcher={np.median(d.pat_pm/d.res):.4f}")
r = corr_block("res", "pat_pm"); print("res vs pat_pm:", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()})
r = corr_block("res", "rd"); print("res vs rd:", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()})
r = corr_block("rd", "g_tfp_00_19"); print("rd vs g_tfp:", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()})
r = corr_block("res", "g_tfp_00_19"); print("res vs g_tfp:", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()})
r = corr_block("hlos", "g_tfp_00_19"); print("hlos vs g_tfp:", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()})

# selected country values for calibration anchors
print("\n=== Selected countries (2013-2022 avgs) ===")
sel = ["USA", "KOR", "ISR", "JPN", "DEU", "FIN", "SWE", "GBR", "FRA", "CHN", "IND", "BRA", "ZAF", "NGA", "IDN", "MEX", "RUS", "VNM"]
print(X.loc[[s for s in sel if s in X.index], ["gdppc", "edu_gdp", "tert_pc", "tert_share", "rd", "res", "pat_pm", "art_pm", "hci", "hlos", "g_tfp_00_19"]].round(2).to_string())
X.to_csv(sys.argv[2] if len(sys.argv) > 2 else "/dev/null")

# ---------- Two-way FE panel with lags (5-year periods) ----------
print("\n=== Two-way FE panel (country + period FE), 5-yr period means 1995-2024, cluster-robust SE by country ===")
def period_panel(k, percap_=False):
    d = D[k].copy()
    if percap_:
        d = d.merge(D["pop"], on=["c", "y"], suffixes=("", "_p")); d["v"] = d.v / d.v_p * 1e6
    d = d[(d.y >= 1995) & (d.y <= 2024)]
    d["p"] = (d.y - 1995) // 5
    return d.groupby(["c", "p"]).v.mean()
P = pd.DataFrame({"edu": period_panel("edu_gdp"), "res": period_panel("res"), "rd": period_panel("rd"),
                  "pat": period_panel("pat", True), "gdp": period_panel("gdppc"), "ter": period_panel("ter_enr")}).reset_index()
P = P[P.c.isin(iso3)]
P = P.sort_values(["c", "p"])
for L in [1, 2, 3]:
    P[f"edu_l{L}"] = P.groupby("c").edu.shift(L)
    P[f"ter_l{L}"] = P.groupby("c").ter.shift(L)
# requires consecutive periods: shift on groupby assumes no gaps; enforce by reindexing
full = pd.MultiIndex.from_product([P.c.unique(), range(6)], names=["c", "p"])
P = P.set_index(["c", "p"]).reindex(full).reset_index()
for L in [1, 2, 3]:
    P[f"edu_l{L}"] = P.groupby("c").edu.shift(L)
    P[f"ter_l{L}"] = P.groupby("c").ter.shift(L)

def fe_reg(df, y, xs):
    d = df[["c", "p", y] + xs].replace([np.inf, -np.inf], np.nan).dropna()
    # dummies
    C = pd.get_dummies(d.c, drop_first=True, dtype=float)
    T = pd.get_dummies(d.p, drop_first=True, dtype=float)
    Xm = np.column_stack([np.ones(len(d)), d[xs].values, C.values, T.values])
    yv = d[y].values
    b = np.linalg.lstsq(Xm, yv, rcond=None)[0]
    e = yv - Xm @ b
    XtXi = np.linalg.pinv(Xm.T @ Xm)
    meat = np.zeros((Xm.shape[1], Xm.shape[1]))
    for c_, idx in d.groupby("c").indices.items():
        s_ = Xm[idx].T @ e[idx]; meat += np.outer(s_, s_)
    G = d.c.nunique(); n, k = Xm.shape
    V = XtXi @ meat @ XtXi * (G / (G - 1)) * ((n - 1) / (n - k))
    se = np.sqrt(np.abs(np.diag(V)))
    return d, b[1:1 + len(xs)], se[1:1 + len(xs)], G, n
P["lres"] = np.log(P.res); P["lrd"] = np.log(P.rd); P["lpat"] = np.log(P.pat); P["lgdp"] = np.log(P.gdp)
for yv in ["lres", "lrd", "lpat"]:
    for xs in [["edu", "lgdp"], ["edu_l1", "lgdp"], ["edu_l2", "lgdp"], ["edu_l3", "lgdp"], ["edu", "edu_l1", "edu_l2", "lgdp"],
               ["ter", "lgdp"], ["ter_l1", "lgdp"], ["ter_l2", "lgdp"], ["ter_l3", "lgdp"]]:
        d, b, se, G, n = fe_reg(P, yv, xs)
        print(f"{yv:5s} ~ {'+'.join(xs):24s} N={n:4d} countries={G:3d}  " + "  ".join(f"{x}={bb:.3f}({ss:.3f})" for x, bb, ss in zip(xs, b, se)))
