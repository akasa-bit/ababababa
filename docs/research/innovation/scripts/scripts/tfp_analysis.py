import openpyxl, sys, math, statistics as st
fern, pwt = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(fern, read_only=True, data_only=True)
ws = wb["annual"]; rows = list(ws.iter_rows(values_only=True)); hdr = rows[0]
ix = {h:i for i,h in enumerate(hdr)}
ann = {r[0]: r for r in rows[1:] if isinstance(r[0], (int,float))}
print("Fernald annual, last year:", max(ann))
for a,b in []: #,(1974,1995),(1996,2004),(2005,2019),(2020,max(ann)),(1948,max(ann)),(2005,max(ann))]:
    ys=[y for y in range(a,b+1) if y in ann and ann[y][ix['dtfp']] is not None]
    f=lambda k: sum(ann[y][ix[k]] for y in ys)/len(ys)
    print(f"  {a}-{b}: dY={f('dY'):.2f} dLP={f('dLP'):.2f} dTFP={f('dtfp'):.2f} dTFP_util={f('dtfp_util'):.2f} (n={len(ys)})")
# PWT
wb = openpyxl.load_workbook(pwt, read_only=True, data_only=True)
print("PWT sheets:", wb.sheetnames)
ws = wb["Data"]; it = ws.iter_rows(values_only=True); hdr = next(it); ix = {h:i for i,h in enumerate(hdr)}
need = ["countrycode","year","rgdpe","rgdpo","pop","hc","ctfp","rtfpna","rnna","emp","cwtfp","rwtfpna","labsh"]
print("has:", [n for n in need if n in ix])
D = {}
for r in it:
    c=r[ix["countrycode"]]; y=r[ix["year"]]
    if c is None or not isinstance(y,(int,float)): continue
    y=int(y)
    D.setdefault(c,{})[y] = {k: r[ix[k]] for k in need if k in ix}
print("countries", len(D), "years", min(min(v) for v in D.values()), max(max(v) for v in D.values()))
def g(c,a,b,var="rtfpna"):
    try:
        x0=D[c][a][var]; x1=D[c][b][var]
        if x0 and x1 and x0>0 and x1>0: return 100*math.log(x1/x0)/(b-a)
    except KeyError: pass
    return None
# income terciles/quartiles by rgdpe/pop in 2019
inc = {}
for c in D:
    v=D[c].get(2019,{})
    if v.get("rgdpe") and v.get("pop"): inc[c]=v["rgdpe"]/v["pop"]
qs = sorted(inc.values()); 
def grp(c):
    x=inc.get(c)
    if x is None: return None
    if x>=40000: return "a) >=40k"
    if x>=15000: return "b) 15-40k"
    if x>=5000: return "c) 5-15k"
    return "d) <5k"
print("\nPWT11 rtfpna growth (%/yr, log), median across countries [mean] (n), groups by 2019 rgdpe/pop (2021 PPP$)")
eras=[(1954,1973),(1973,1995),(1995,2007),(2007,2019),(2019,2023),(1995,2019)]
for a,b in eras:
    allv=[g(c,a,b) for c in D]; allv=[v for v in allv if v is not None]
    line=f"  {a}-{b}: ALL med={st.median(allv):.2f} mean={st.mean(allv):.2f} n={len(allv)}"
    for G in ["a) >=40k","b) 15-40k","c) 5-15k","d) <5k"]:
        v=[g(c,a,b) for c in D if grp(c)==G]; v=[x for x in v if x is not None]
        if v: line+=f" | {G}: {st.median(v):.2f} [{st.mean(v):.2f}] n={len(v)}"
    print(line)
print("\nUS/major rtfpna growth by era:")
for c in ["USA","DEU","JPN","GBR","FRA","KOR","CHN","IND","BRA"]:
    print("  ",c, " ".join(f"{a}-{b}:{g(c,a,b):.2f}" if g(c,a,b) is not None else f"{a}-{b}:NA" for a,b in eras))
# ctfp vs income
def ols(x,y):
    n=len(x);mx=sum(x)/n;my=sum(y)/n;sxx=sum((a-mx)**2 for a in x);syy=sum((b-my)**2 for b in y);sxy=sum((a-mx)*(b-my) for a,b in zip(x,y))
    b=sxy/sxx; return b, my-b*mx, sxy/math.sqrt(sxx*syy), n
for yr in [1990, 2019, 2023]:
    xs=[];ys=[];hs=[]
    for c in D:
        v=D[c].get(yr,{})
        if v.get("ctfp") and v.get("rgdpe") and v.get("pop"):
            xs.append(math.log(v["rgdpe"]/v["pop"])); ys.append(math.log(v["ctfp"]))
    b,a,r,n=ols(xs,ys)
    ys_s=sorted(ys)
    p90=ys_s[int(0.9*(n-1))]; p10=ys_s[int(0.1*(n-1))]
    print(f"\nln ctfp (USA=1) on ln GDPpc (rgdpe/pop) {yr}: slope={b:.3f} r={r:.3f} n={n}; median ctfp={math.exp(st.median(ys)):.3f}; p90/p10 ctfp ratio={math.exp(p90-p10):.2f}")
    xs=[];ys=[]
    for c in D:
        v=D[c].get(yr,{})
        if v.get("hc") and v.get("rgdpe") and v.get("pop"):
            xs.append(math.log(v["rgdpe"]/v["pop"])); ys.append(math.log(v["hc"]))
    b,a,r,n=ols(xs,ys); print(f"  ln hc on ln GDPpc {yr}: slope={b:.3f} r={r:.3f} n={n}")
# TFP convergence: growth 1995-2019 (rtfpna) on initial ln ctfp 1995
for a0,b0 in [(1970,1995),(1995,2019),(2000,2023)]:
    xs=[];ys=[]
    for c in D:
        v=D[c].get(a0,{}); gg=g(c,a0,b0)
        if v.get("ctfp") and gg is not None: xs.append(math.log(v["ctfp"])); ys.append(gg)
    b,a,r,n=ols(xs,ys); print(f"TFP beta-convergence: rtfpna growth {a0}-{b0} on ln ctfp({a0}): slope={b:.3f} pp/yr per log point, r={r:.3f}, n={n}")
# labor productivity convergence (rgdpo/emp)
for a0,b0 in [(1960,1990),(1990,2019),(2000,2023)]:
    xs=[];ys=[]
    for c in D:
        v0=D[c].get(a0,{}); v1=D[c].get(b0,{})
        if v0.get("rgdpe") and v0.get("pop") and v1.get("rgdpe") and v1.get("pop"):
            y0=v0["rgdpe"]/v0["pop"]; y1=v1["rgdpe"]/v1["pop"]
            xs.append(math.log(y0)); ys.append(100*math.log(y1/y0)/(b0-a0))
    b,a,r,n=ols(xs,ys); print(f"Income beta-convergence: GDPpc growth {a0}-{b0} on ln GDPpc({a0}): slope={b:.3f} pp/yr per log point, r={r:.3f}, n={n}")
