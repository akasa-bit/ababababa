"""Decade TFP growth from BCL v2.7 and Fernald quarterly TFP (annual tab).
Usage: python3 -I tfp_long.py <bcl.xlsx> <fernald.xlsx>
"""
import sys
import numpy as np
import pandas as pd

bcl = pd.read_excel(sys.argv[1], sheet_name='TFP', header=0, index_col=0)
bcl.index = pd.to_numeric(bcl.index, errors='coerce')
bcl = bcl[bcl.index.notna()]
bcl.index = bcl.index.astype(int)
bcl = bcl.apply(pd.to_numeric, errors='coerce')
bcl = bcl.drop(columns=[c for c in bcl.columns if str(c).startswith('Unnamed')])
bcl = bcl[bcl['USA'].notna()]
print('BCL TFP years', bcl.index.min(), bcl.index.max(), 'countries', bcl.shape[1])
print(list(bcl.columns))
periods = [(1890, 1900), (1900, 1910), (1910, 1920), (1920, 1930), (1930, 1940), (1940, 1950), (1950, 1960), (1960, 1970),
           (1970, 1980), (1980, 1990), (1990, 2000), (2000, 2010), (2010, 2019), (2010, bcl.index.max())]
lg = np.log(bcl)
for c in ['USA', 'GBR', 'FRA', 'DEU', 'JPN']:
    if c not in bcl.columns:
        continue
    out = []
    for a, b in periods:
        if a in lg.index and b in lg.index:
            out.append(f'{a}-{b}:{(lg.loc[b, c] - lg.loc[a, c]) / (b - a) * 100:.2f}')
    print(c, ' '.join(out))
# frontier (max TFP level each year) growth
front = bcl.max(axis=1)
leader = bcl.idxmax(axis=1)
out = []
for a, b in periods:
    if a in lg.index and b in lg.index:
        out.append(f'{a}-{b}:{(np.log(front[b]) - np.log(front[a])) / (b - a) * 100:.2f}')
print('Frontier(max)', ' '.join(out))
print('Leader by decade:', {y: leader[y] for y in range(1890, bcl.index.max() + 1, 10)})
# Long-run averages
for a, b in [(1890, 2019), (1913, 1950), (1950, 1973), (1973, 1995), (1995, 2005), (2005, 2019)]:
    if b in lg.index:
        g = (lg.loc[b] - lg.loc[a]) / (b - a) * 100
        print(f'{a}-{b}: USA {g.get("USA"):.2f} median across {g.notna().sum()} countries {g.median():.2f}')
# relative TFP to US
rel = bcl.div(bcl['USA'], axis=0)
for y in [1890, 1950, 1973, 2000, 2019]:
    if y in rel.index:
        r = rel.loc[y].drop('USA').dropna()
        print(f'TFP rel US {y}: median {r.median():.2f} p25 {r.quantile(.25):.2f} p75 {r.quantile(.75):.2f} n={len(r)}')

# Fernald annual
f = pd.read_excel(sys.argv[2], sheet_name='annual', header=None)
# find header row containing 'dtfp'
hdr = None
for i in range(40):
    row = [str(x).strip() for x in f.iloc[i].tolist()]
    if 'dtfp' in row:
        hdr = i
        break
f.columns = [str(x).strip() for x in f.iloc[hdr].tolist()]
f = f.iloc[hdr + 1:]
f = f[pd.to_numeric(f.iloc[:, 0], errors='coerce').notna()]
f.index = pd.to_numeric(f.iloc[:, 0]).astype(int)
cols = [c for c in ['dtfp', 'dtfp_util', 'dLP', 'dY'] if c in f.columns]
f = f[cols].apply(pd.to_numeric, errors='coerce')
print('Fernald annual', f.index.min(), f.index.max(), cols)
for a, b in [(1948, 1973), (1973, 1995), (1995, 2004), (2004, 2019), (2019, 2024), (2004, f.index.max()), (1948, f.index.max())]:
    s = f.loc[a + 1:b]
    print(f'Fernald {a}-{b}: ' + ' '.join(f'{c}={s[c].mean():.2f}' for c in cols) + f' (n={len(s)})')
for d in range(1950, 2030, 10):
    s = f.loc[d:d + 9]
    if len(s):
        print(f'  {d}s: dtfp={s["dtfp"].mean():.2f} dtfp_util={s["dtfp_util"].mean():.2f} n={len(s)}')
print('Fernald annual dtfp sd:', round(f['dtfp'].std(), 2), 'dtfp_util sd:', round(f['dtfp_util'].std(), 2))
