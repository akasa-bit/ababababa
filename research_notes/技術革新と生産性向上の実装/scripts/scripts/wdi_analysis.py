import json, sys, math, os
D = sys.argv[1]
def load(ind):
    with open(os.path.join(D, ind + ".json")) as f:
        j = json.load(f)
    meta = j[0]
    out = {}
    for r in j[1]:
        if r["value"] is None: continue
        iso = r["countryiso3code"]
        if not iso: continue
        out.setdefault(iso, {})[int(r["date"])] = float(r["value"])
    return out, meta.get("lastupdated")
with open(os.path.join(D, "countries.json")) as f:
    cj = json.load(f)
ctry = {}
for c in cj[1]:
    if c["region"]["value"] == "Aggregates": continue
    ctry[c["id"]] = {"name": c["name"], "inc": c["incomeLevel"]["value"], "reg": c["region"]["value"]}
inds = ["GB.XPD.RSDV.GD.ZS","SP.POP.SCIE.RD.P6","IP.PAT.RESD","IP.PAT.NRES","SP.POP.TOTL","NY.GDP.PCAP.PP.KD","SP.POP.TECH.RD.P6"]
data = {}
for i in inds:
    data[i], lu = load(i)
    print(i, "lastupdated", lu, "countries", len([k for k in data[i] if k in ctry]), "maxyear", max(y for k in data[i] for y in data[i][k]))
def avg_window(ser, y0, y1):
    v = [ser[y] for y in range(y0, y1+1) if y in ser]
    return sum(v)/len(v) if v else None
def latest(ser, y0, y1):
    ys = [y for y in range(y0, y1+1) if y in ser]
    return (ser[max(ys)], max(ys)) if ys else (None, None)
def ols(x, y):
    n = len(x); mx = sum(x)/n; my = sum(y)/n
    sxx = sum((a-mx)**2 for a in x); syy = sum((b-my)**2 for b in y); sxy = sum((a-mx)*(b-my) for a,b in zip(x,y))
    b = sxy/sxx; a = my - b*mx; r = sxy/math.sqrt(sxx*syy)
    res = [yy-(a+b*xx) for xx,yy in zip(x,y)]
    s2 = sum(e*e for e in res)/(n-2); se = math.sqrt(s2/sxx)
    return b, a, r, n, se
def rank(v):
    idx = sorted(range(len(v)), key=lambda i: v[i]); r=[0]*len(v)
    for k,i in enumerate(idx): r[i]=k
    return r
def spearman(x,y):
    return ols(rank(x), rank(y))[2]
W0, W1 = 2015, 2023
gdp = data["NY.GDP.PCAP.PP.KD"]; pop = data["SP.POP.TOTL"]
def prep(ind, transform):
    xs, ys, names = [], [], []
    for iso in ctry:
        if iso not in data[ind] or iso not in gdp: continue
        v = avg_window(data[ind][iso], W0, W1); g = avg_window(gdp[iso], W0, W1)
        if v is None or g is None: continue
        if ind.startswith("IP.PAT"):
            p = avg_window(pop.get(iso, {}), W0, W1)
            if not p: continue
            v = v / p * 1e6
        t = transform(v)
        if t is None: continue
        xs.append(math.log(g)); ys.append(t); names.append(iso)
    return xs, ys, names
print("\n=== Cross-country, country averages over %d-%d, x = ln GDP pc PPP (const 2021 intl$) ===" % (W0, W1))
specs = [("GB.XPD.RSDV.GD.ZS", "R&D %GDP (level, pct points)", lambda v: v),
         ("GB.XPD.RSDV.GD.ZS", "ln R&D %GDP", lambda v: math.log(v) if v>0 else None),
         ("SP.POP.SCIE.RD.P6", "ln researchers per million", lambda v: math.log(v) if v>0 else None),
         ("SP.POP.SCIE.RD.P6", "researchers per million (level)", lambda v: v),
         ("SP.POP.TECH.RD.P6", "ln R&D technicians per million", lambda v: math.log(v) if v>0 else None),
         ("IP.PAT.RESD", "ln resident patent apps per million", lambda v: math.log(v) if v>0 else None),
         ("IP.PAT.NRES", "ln nonresident patent apps per million", lambda v: math.log(v) if v>0 else None)]
res = {}
for ind, lab, tr in specs:
    xs, ys, names = prep(ind, tr)
    b, a, r, n, se = ols(xs, ys)
    print(f"{lab:42s} slope={b:.3f} (se {se:.3f}) intercept={a:.3f} r={r:.3f} R2={r*r:.3f} spearman={spearman(xs,ys):.3f} n={n}")
    res[lab] = (xs, ys, names)
# R&D intensity by income group
print("\n=== Median/mean by WB income group (avg %d-%d) ===" % (W0, W1))
for ind, lab in [("GB.XPD.RSDV.GD.ZS","R&D %GDP"),("SP.POP.SCIE.RD.P6","Researchers per million"),("IP.PAT.RESD","Resident patents per million")]:
    groups = {}
    for iso, m in ctry.items():
        if iso not in data[ind]: continue
        v = avg_window(data[ind][iso], W0, W1)
        if v is None: continue
        if ind.startswith("IP.PAT"):
            p = avg_window(pop.get(iso, {}), W0, W1)
            if not p: continue
            v = v/p*1e6
        groups.setdefault(m["inc"], []).append(v)
    for gname in ["High income","Upper middle income","Lower middle income","Low income"]:
        v = sorted(groups.get(gname, []))
        if not v: continue
        med = v[len(v)//2] if len(v)%2 else (v[len(v)//2-1]+v[len(v)//2])/2
        print(f"  {lab:30s} {gname:22s} n={len(v):3d} median={med:9.3f} mean={sum(v)/len(v):9.3f} min={v[0]:.3f} max={v[-1]:.3f}")
# Top R&D intensity, latest year
print("\n=== Latest-year R&D %GDP top 15 and selected ===")
lat = []
for iso in ctry:
    if iso in data["GB.XPD.RSDV.GD.ZS"]:
        v, y = latest(data["GB.XPD.RSDV.GD.ZS"][iso], 2015, 2024)
        if v is not None: lat.append((v, y, iso))
lat.sort(reverse=True)
print("  ", ", ".join(f"{iso} {v:.2f} ({y})" for v,y,iso in lat[:15]))
for iso in ["USA","CHN","JPN","DEU","KOR","ISR","GBR","FRA","IND","BRA","RUS","ZAF","IDN","NGA","EGY","MEX","TUR"]:
    for ind in ["GB.XPD.RSDV.GD.ZS","SP.POP.SCIE.RD.P6"]:
        if iso in data[ind]:
            v, y = latest(data[ind][iso], 2010, 2024)
            print(f"  {iso} {ind} = {v:.2f} ({y})" if v is not None else f"  {iso} {ind} NA")
# World-level aggregates
print("\n=== WLD / income aggregates R&D %GDP and researchers per million ===")
for agg in ["WLD","HIC","UMC","LMC","LIC","OED","EUU","EAS","SSF"]:
    for ind in ["GB.XPD.RSDV.GD.ZS","SP.POP.SCIE.RD.P6"]:
        s = data[ind].get(agg, {})
        if s:
            ys = sorted(s)
            pick = [y for y in [2000, 2005, 2010, 2015, 2020, 2021, 2022, 2023] if y in s]
            print(f"  {agg} {ind}: " + ", ".join(f"{y}:{s[y]:.2f}" for y in pick) + f" (last {ys[-1]})")
# Within-country time-series: change in R&D intensity vs income growth (long differences 2000->2019)
print("\n=== Long-difference 2000-2004 avg vs 2015-2019 avg ===")
dx, dy = [], []
for iso in ctry:
    r = data["GB.XPD.RSDV.GD.ZS"].get(iso); g = gdp.get(iso)
    if not r or not g: continue
    r0, r1 = avg_window(r, 2000, 2004), avg_window(r, 2015, 2019)
    g0, g1 = avg_window(g, 2000, 2004), avg_window(g, 2015, 2019)
    if None in (r0, r1, g0, g1) or r0 <= 0 or r1 <= 0: continue
    dx.append(math.log(g1/g0)); dy.append(math.log(r1/r0))
b,a,r,n,se = ols(dx, dy)
print(f"  dln(R&D%GDP) on dln(GDPpc): slope={b:.3f} (se {se:.3f}) intercept={a:.3f} r={r:.3f} n={n}; mean dln R&D%GDP={sum(dy)/n:.3f}")
# researchers per million: elasticity in a researchers-share formula S/pop = c * y^e
xs, ys, names = res["ln researchers per million"]
b,a,r,n,se = ols(xs, ys)
print(f"\nImplied f(income): researchers per million = exp({a:.2f}) * GDPpc^{b:.2f}; at GDPpc=2000 -> {math.exp(a)*2000**b:.0f}, 10000 -> {math.exp(a)*10000**b:.0f}, 50000 -> {math.exp(a)*50000**b:.0f}, 80000 -> {math.exp(a)*80000**b:.0f}")
# Ratio: resident patents per researcher
print("\n=== Resident patent apps per 1000 researchers, avg 2015-2023, selected ===")
for iso in ["USA","CHN","JPN","DEU","KOR","GBR","FRA","IND","BRA","RUS"]:
    p = avg_window(data["IP.PAT.RESD"].get(iso, {}), W0, W1); rs = avg_window(data["SP.POP.SCIE.RD.P6"].get(iso, {}), W0, W1); pp = avg_window(pop.get(iso, {}), W0, W1)
    if p and rs and pp:
        print(f"  {iso}: {p/(rs*pp/1e6)*1000:.0f} per 1000 researchers; researchers total ~{rs*pp/1e6/1e3:.0f}k")
