import json, sys, os, math
D=sys.argv[1]
def load(ind):
    j=json.load(open(os.path.join(D,ind+".json"))); out={}
    for r in j[1]:
        if r["value"] is None or not r["countryiso3code"]: continue
        out.setdefault(r["countryiso3code"],{})[int(r["date"])]=float(r["value"])
    return out
cj=json.load(open(os.path.join(D,"countries.json")))
ctry={c["id"] for c in cj[1] if c["region"]["value"]!="Aggregates"}
rd=load("GB.XPD.RSDV.GD.ZS"); rs=load("SP.POP.SCIE.RD.P6"); pop=load("SP.POP.TOTL"); gpc=load("NY.GDP.PCAP.PP.KD")
W=rs["WLD"]; P=pop["WLD"]
for y0,y1 in [(2000,2010),(2010,2020),(2000,2020)]:
    s0=W[y0]*P[y0]/1e6; s1=W[y1]*P[y1]/1e6
    print(f"World researchers (WDI WLD agg): {y0} {s0/1e6:.2f}M -> {y1} {s1/1e6:.2f}M; growth {100*math.log(s1/s0)/(y1-y0):.2f}%/yr; per-million growth {100*math.log(W[y1]/W[y0])/(y1-y0):.2f}%/yr")
# R&D spending concentration (PPP const 2021 $): R&D% * GDPpc * pop, latest year <=2022 per country with fill-back up to 3 years
for Y in [2000, 2010, 2021]:
    tot={}
    for c in ctry:
        ys=[y for y in range(Y-3,Y+1) if y in rd.get(c,{})]
        if not ys: continue
        y=max(ys)
        if Y in gpc.get(c,{}) and Y in pop.get(c,{}):
            tot[c]=rd[c][y]/100*gpc[c][Y]*pop[c][Y]
    T=sum(tot.values()); top=sorted(tot.items(), key=lambda x:-x[1])[:8]
    print(f"\nR&D spend {Y} (sum over {len(tot)} countries) = {T/1e12:.2f} trillion 2021 PPP$; top shares: " + ", ".join(f"{c} {100*v/T:.1f}%" for c,v in top))
    gdp=sum(gpc[c][Y]*pop[c][Y] for c in tot)
    print(f"   implied R&D/GDP over reporting countries: {100*T/gdp:.2f}%")
# High-income-only slope ln R&D% on ln GDPpc
inc={c["id"]:c["incomeLevel"]["value"] for c in cj[1]}
def avg(s,a,b):
    v=[s[y] for y in range(a,b+1) if y in s]; return sum(v)/len(v) if v else None
xs=[];ys=[]
for c in ctry:
    if inc.get(c)!="High income": continue
    r=avg(rd.get(c,{}),2015,2023); g=avg(gpc.get(c,{}),2015,2023)
    if r and g and r>0: xs.append(math.log(g)); ys.append(math.log(r))
n=len(xs); mx=sum(xs)/n; my=sum(ys)/n; sxy=sum((a-mx)*(b-my) for a,b in zip(xs,ys)); sxx=sum((a-mx)**2 for a in xs); syy=sum((b-my)**2 for b in ys)
print(f"\nHigh-income only: ln R&D% on ln GDPpc slope={sxy/sxx:.3f} r={sxy/math.sqrt(sxx*syy):.3f} n={n}")
# Countries above 2% R&D intensity count
cnt=[c for c in ctry if avg(rd.get(c,{}),2019,2023) and avg(rd.get(c,{}),2019,2023)>=2]
print("Countries with avg 2019-23 R&D>=2% GDP:", len(cnt))
