"""Diffusion speed facts: OWID US household adoption; WDI mobile/internet by income quintile; convergence.
Usage: python3 -I diffusion.py <dl_dir>
"""
import json, os, sys
import numpy as np
import pandas as pd

D = sys.argv[1]

# ---------- 1. OWID US household adoption ----------
o = pd.read_csv(os.path.join(D, 'owid_us_adoption.csv'))
o.columns = ['tech', 'year', 'share']
rows = []
for t, g in o.groupby('tech'):
    g = g.sort_values('year')
    def first(th):
        s = g[g.share >= th]
        return int(s.year.iloc[0]) if len(s) else None
    y10, y50, y90 = first(10), first(50), first(90)
    # logistic slope: regress log-odds on year for 5% < share < 95%
    m = g[(g.share > 5) & (g.share < 95)]
    slope = np.nan
    if len(m) >= 4:
        lo = np.log((m.share / 100) / (1 - m.share / 100))
        slope = np.polyfit(m.year, lo, 1)[0]
    rows.append(dict(tech=t, first_year=int(g.year.min()), first_share=g.share.iloc[0], y10=y10, y50=y50, y90=y90,
                     d10_50=(y50 - y10) if (y10 and y50) else None, d10_90=(y90 - y10) if (y10 and y90) else None,
                     logit_slope=slope, max_share=g.share.max()))
r = pd.DataFrame(rows).sort_values('y10')
pd.set_option('display.width', 200)
print(r.to_string(index=False))
v = r.dropna(subset=['d10_50'])
v = v[v.first_share < 10]  # observed crossing 10%
print(f'\nUS techs observed crossing 10% then 50%: n={len(v)} median years 10->50 = {v.d10_50.median()}  IQR {v.d10_50.quantile(.25)}-{v.d10_50.quantile(.75)}')
b = np.polyfit(v.y10, v.d10_50, 1)
print(f'  OLS years(10->50) on year(10%): slope {b[0]:.3f} yr per calendar yr (={b[0]*10:.2f} per decade), n={len(v)}')
for lo_, hi_ in [(1900, 1950), (1950, 1990), (1990, 2025)]:
    s = v[(v.y10 >= lo_) & (v.y10 < hi_)]
    print(f'  y10 in [{lo_},{hi_}): n={len(s)} median 10->50 = {s.d10_50.median()}')
w = r.dropna(subset=['logit_slope'])
print(f'  logistic slope (per yr) median {w.logit_slope.median():.3f} IQR {w.logit_slope.quantile(.25):.3f}-{w.logit_slope.quantile(.75):.3f} n={len(w)}')

# ---------- 2. WDI ICT diffusion by income quintile ----------
with open(os.path.join(D, 'countries.json')) as f:
    c = json.load(f)
real = {r_['id'] for r_ in c[1] if r_['region']['id'] != 'NA'}

def load(fn, ind):
    with open(os.path.join(D, fn)) as f:
        d = json.load(f)
    rr = [(x['countryiso3code'], int(x['date']), float(x['value'])) for x in d[1] if x['value'] is not None]
    df = pd.DataFrame(rr, columns=['iso', 'year', ind])
    return df[df.iso.isin(real)]

gdp = load('NY.GDP.PCAP.PP.KD.json', 'g')
gq = gdp[gdp.year.between(2015, 2023)].groupby('iso').g.mean()
q = pd.qcut(gq, 5, labels=[1, 2, 3, 4, 5]).astype(int)

for fn, ind, ths in [('hist_IT.CEL.SETS.P2.json', 'mob', [10, 50]), ('hist_IT.NET.USER.ZS.json', 'net', [10, 50])]:
    df = load(fn, ind)
    print(f'\n== {ind}: first year reaching threshold, by 2015-23 PPP income quintile')
    for th in ths:
        fy = df[df[ind] >= th].groupby('iso').year.min()
        tab = pd.concat([fy.rename('fy'), q.rename('q')], axis=1).dropna()
        out = []
        for k in range(1, 6):
            s = tab[tab.q == k].fy
            out.append(f'Q{k}: med {s.median():.0f} p25 {s.quantile(.25):.0f} p75 {s.quantile(.75):.0f} n={len(s)}')
        never = q.index.difference(fy.index)
        print(f'  >= {th}: ' + '; '.join(out) + f' | not yet reached (of quintile-classified): {len(never.intersection(df.iso.unique()))}')
        lead = tab.fy.quantile(0.05)
        print(f'    world 5th pct year = {lead:.0f}; median lag vs Q5 median: ' + ', '.join(f'Q{k} {tab[tab.q==k].fy.median()-tab[tab.q==5].fy.median():.0f}y' for k in range(1, 5)))
    # years from 10 to 50
    f10 = df[df[ind] >= 10].groupby('iso').year.min(); f50 = df[df[ind] >= 50].groupby('iso').year.min()
    dd = (f50 - f10).dropna()
    tab = pd.concat([dd.rename('d'), q.rename('q')], axis=1).dropna()
    print('  years 10->50: ' + '; '.join(f'Q{k} med {tab[tab.q==k].d.median():.0f} (n={(tab.q==k).sum()})' for k in range(1, 6)) + f'; all med {tab.d.median():.0f}')

# ---------- 3. Unconditional convergence (WDI constant 2015 US$) ----------
g15 = load('hist_NY.GDP.PCAP.KD.json', 'y')
for a, b_ in [(1960, 2000), (1990, 2019), (2000, 2019), (2000, 2023)]:
    A = g15[g15.year == a].set_index('iso').y; B = g15[g15.year == b_].set_index('iso').y
    j = pd.concat([A, B], axis=1, keys=['a', 'b']).dropna()
    gr = np.log(j.b / j.a) / (b_ - a) * 100
    sl = np.polyfit(np.log(j.a), gr, 1)[0]
    T = b_ - a
    # implied beta: gr = const - (1-exp(-beta T))/T * ln y0  -> beta = -ln(1 + slope/100*T)/T
    beta = -np.log(1 + sl / 100 * T) / T * 100
    print(f'Uncond. convergence {a}-{b_}: n={len(j)} slope of growth(%/yr) on ln y0 = {sl:.3f}; implied beta = {beta:.2f}%/yr')
