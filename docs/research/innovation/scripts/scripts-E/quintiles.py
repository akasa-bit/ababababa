"""Compute income-quintile tables of innovation indicators from WDI JSON + PWT 10.01.
Usage: python3 -I quintiles.py <dl_dir>
"""
import json, sys, os, math
import numpy as np
import pandas as pd

D = sys.argv[1]

def load(ind):
    with open(os.path.join(D, ind + '.json')) as f:
        d = json.load(f)
    rows = []
    for r in d[1]:
        if r['value'] is None:
            continue
        rows.append((r['countryiso3code'], int(r['date']), float(r['value'])))
    return pd.DataFrame(rows, columns=['iso', 'year', ind])

with open(os.path.join(D, 'countries.json')) as f:
    c = json.load(f)
meta = {r['id']: (r['name'], r['region']['id'], r['incomeLevel']['id']) for r in c[1]}
real = {k for k, v in meta.items() if v[1] != 'NA'}

inds = ['GB.XPD.RSDV.GD.ZS', 'SP.POP.SCIE.RD.P6', 'IP.PAT.RESD', 'IP.PAT.NRES', 'SP.POP.TOTL',
        'TX.VAL.TECH.MF.ZS', 'NY.GDP.PCAP.PP.KD', 'IT.NET.USER.ZS', 'IT.CEL.SETS.P2', 'IT.NET.BBND.P2',
        'SP.POP.TECH.RD.P6']
dfs = {i: load(i) for i in inds}
panel = None
for i, df in dfs.items():
    panel = df if panel is None else panel.merge(df, on=['iso', 'year'], how='outer')
panel = panel[panel.iso.isin(real)]
panel['PAT_RES_PM'] = panel['IP.PAT.RESD'] / panel['SP.POP.TOTL'] * 1e6
panel['PAT_NRES_SHARE'] = panel['IP.PAT.NRES'] / (panel['IP.PAT.NRES'] + panel['IP.PAT.RESD'])

W0, W1 = 2015, 2023
win = panel[(panel.year >= W0) & (panel.year <= W1)]
# country-level: mean over window of each indicator (available years); GDP pc mean over window
cs = win.groupby('iso').mean(numeric_only=True)
cs = cs.drop(columns=['year'])
cs = cs[cs['NY.GDP.PCAP.PP.KD'].notna()]
cs['lngdp'] = np.log(cs['NY.GDP.PCAP.PP.KD'])
# quintiles over all countries with GDP data (unweighted)
cs['q'] = pd.qcut(cs['NY.GDP.PCAP.PP.KD'], 5, labels=[1, 2, 3, 4, 5]).astype(int)
bounds = cs.groupby('q')['NY.GDP.PCAP.PP.KD'].agg(['min', 'max', 'median', 'count'])
print(f'Window {W0}-{W1} country means. N countries with GDPpc = {len(cs)}')
print('Quintile GDP pc PPP (constant 2021 intl $) bounds:')
print(bounds.round(0).to_string())

show = [('GB.XPD.RSDV.GD.ZS', 'R&D exp % GDP'), ('SP.POP.SCIE.RD.P6', 'Researchers per million'),
        ('SP.POP.TECH.RD.P6', 'Technicians per million'),
        ('PAT_RES_PM', 'Resident patent apps per million'), ('PAT_NRES_SHARE', 'Non-resident share of patent apps'),
        ('TX.VAL.TECH.MF.ZS', 'High-tech exports % manuf exports'),
        ('IT.NET.USER.ZS', 'Internet users % pop'), ('IT.CEL.SETS.P2', 'Mobile subs per 100'),
        ('IT.NET.BBND.P2', 'Fixed broadband per 100')]

def stats(s):
    s = s.dropna()
    if len(s) == 0:
        return 'n=0'
    return f'n={len(s):3d} med={s.median():.3g} p25={s.quantile(.25):.3g} p75={s.quantile(.75):.3g}'

for col, lab in show:
    print('\n== ' + lab + ' [' + col + ']')
    for q in range(1, 6):
        print(f'  Q{q}: ' + stats(cs.loc[cs.q == q, col]))
    sub = cs[[col, 'lngdp']].dropna()
    sub = sub[sub[col] > 0]
    if len(sub) > 5:
        b = np.polyfit(sub['lngdp'], np.log(sub[col]), 1)
        r = np.corrcoef(sub['lngdp'], np.log(sub[col]))[0, 1]
        print(f'  log-log slope vs GDPpc: {b[0]:.2f} (r={r:.2f}, n={len(sub)}); zeros excluded: {int((cs[col]==0).sum())}')

# rank correlations
print('\nSpearman with GDPpc:')
for col, lab in show:
    sub = cs[[col, 'NY.GDP.PCAP.PP.KD']].dropna()
    print(f'  {lab}: rho={sub.corr(method="spearman").iloc[0,1]:.2f} n={len(sub)}')

# top performers
for col in ['GB.XPD.RSDV.GD.ZS', 'SP.POP.SCIE.RD.P6', 'PAT_RES_PM']:
    print('\nTop 8 by', col)
    print(cs[col].dropna().sort_values(ascending=False).head(8).round(2).to_string())

# Trend: world-level medians by year for R&D and researchers among countries with data in both 2010-12 and 2019-21
print('\nR&D/GDP: countries with data in both 2010-2012 and 2019-2021 (mean):')
a = panel[(panel.year.between(2010, 2012))].groupby('iso')['GB.XPD.RSDV.GD.ZS'].mean()
b2 = panel[(panel.year.between(2019, 2021))].groupby('iso')['GB.XPD.RSDV.GD.ZS'].mean()
j = pd.concat([a, b2], axis=1, keys=['early', 'late']).dropna()
print(f'  n={len(j)} median early={j.early.median():.2f} median late={j.late.median():.2f} share increased={(j.late>j.early).mean():.2f}')

# ICT diffusion speed: internet users median by income quintile in 2010 vs 2022
for yr in [2010, 2015, 2022]:
    s = panel[panel.year == yr].set_index('iso')['IT.NET.USER.ZS']
    s = s[s.index.isin(cs.index)]
    out = []
    for q in range(1, 6):
        v = s[s.index.isin(cs.index[cs.q == q])].dropna()
        out.append(f'Q{q} med={v.median():.1f} (n={len(v)})')
    print(f'Internet users % {yr}: ' + '; '.join(out))

# PWT
pwt = pd.read_stata(os.path.join(D, 'pwt_354098'))
p = pwt[(pwt.year >= 2015) & (pwt.year <= 2019)].copy()
p['rgdpo_pc'] = p['rgdpo'] / p['pop']
pc = p.groupby('countrycode')[['ctfp', 'rgdpo_pc', 'cgdpo', 'pop']].mean()
pc = pc[pc.rgdpo_pc.notna()]
pc['q'] = pd.qcut(pc['rgdpo_pc'], 5, labels=[1, 2, 3, 4, 5]).astype(int)
print('\nPWT 10.01 ctfp (US=1), 2015-2019 mean, quintiles by rgdpo/pop over N=%d' % len(pc))
for q in range(1, 6):
    print(f'  Q{q}: ' + stats(pc.loc[pc.q == q, 'ctfp']) + f'  GDPpc med={pc.loc[pc.q==q,"rgdpo_pc"].median():.0f}')
sub = pc[['ctfp', 'rgdpo_pc']].dropna()
b = np.polyfit(np.log(sub.rgdpo_pc), np.log(sub.ctfp), 1)
print(f'  log ctfp on log GDPpc slope={b[0]:.2f} n={len(sub)}')
# TFP growth distribution (rtfpna) annualized 2000-2019 and 1990-2019
for (y0, y1) in [(2000, 2019), (1990, 2019), (2010, 2019)]:
    a0 = pwt[pwt.year == y0].set_index('countrycode')['rtfpna']
    a1 = pwt[pwt.year == y1].set_index('countrycode')['rtfpna']
    g = (np.log(a1 / a0) / (y1 - y0) * 100).dropna()
    print(f'  rtfpna growth {y0}-{y1} %/yr: n={len(g)} med={g.median():.2f} p10={g.quantile(.1):.2f} p25={g.quantile(.25):.2f} p75={g.quantile(.75):.2f} p90={g.quantile(.9):.2f} sd={g.std():.2f} US={g.get("USA", float("nan")):.2f}')
    gq = pd.concat([g.rename('g'), pc['q']], axis=1).dropna()
    print('    by 2015-19 income quintile: ' + '; '.join(f'Q{q} med={gq[gq.q==q].g.median():.2f} (n={(gq.q==q).sum()})' for q in range(1, 6)))
# Development accounting variance share (Caselli-style): y = A^(1/(1-a)) * (K/Y)^(a/(1-a)) * h, use PWT
p19 = pwt[pwt.year == 2019].set_index('countrycode')
alpha = 1/3
y = p19['cgdpo'] / p19['emp']
ky = p19['cn'] / p19['cgdpo']
h = p19['hc']
dd = pd.concat([np.log(y), np.log(ky) * alpha / (1 - alpha), np.log(h)], axis=1, keys=['ly', 'lky', 'lh']).dropna()
dd['lykh'] = dd.lky + dd.lh
var_share = dd.lykh.var() / dd.ly.var()
cov_share = dd[['ly', 'lykh']].cov().iloc[0, 1] / dd.ly.var()
print(f'\nDev accounting 2019 PWT10.01 (alpha=1/3, output per worker): n={len(dd)} var(ln ykh)/var(ln y)={var_share:.2f}; cov(ln y, ln ykh)/var(ln y)={cov_share:.2f} => TFP share={1-cov_share:.2f}')
# 90/10 ratio decomposition
q90, q10 = dd.ly.quantile(.9), dd.ly.quantile(.1)
top = dd[dd.ly >= q90]; bot = dd[dd.ly <= q10]
print(f'  y90/y10 = {math.exp(top.ly.mean()-bot.ly.mean()):.1f}; (K/Y,h) factor ratio = {math.exp(top.lykh.mean()-bot.lykh.mean()):.1f}; residual = {math.exp((top.ly-top.lykh).mean()-(bot.ly-bot.lykh).mean()):.1f}')
# Caselli (2005) style: y = A k^a h^(1-a) per worker; success = var(ln ykh)/var(ln y)
k = p19['cn'] / p19['emp']
dd2 = pd.concat([np.log(y), alpha*np.log(k) + (1-alpha)*np.log(h)], axis=1, keys=['ly','lykh']).dropna()
print(f'Caselli-form 2019: n={len(dd2)} var(ln ykh)/var(ln y)={dd2.lykh.var()/dd2.ly.var():.2f}')
# Year counts for latest R&D obs
lat = panel.dropna(subset=['GB.XPD.RSDV.GD.ZS']).groupby('iso').year.max()
print('Latest R&D obs year distribution (countries):', lat[lat>=2015].value_counts().sort_index().to_dict())
