"""Scale-effect check: does TFP level rise with country size (PWT 10.01, 2015-2019 means)?
Usage: python3 -I scale_check.py <pwt.dta>
"""
import sys
import numpy as np
import pandas as pd
pwt = pd.read_stata(sys.argv[1])
p = pwt[(pwt.year >= 2015) & (pwt.year <= 2019)].copy()
p['ypc'] = p.rgdpo / p['pop']
c = p.groupby('countrycode')[['ctfp', 'ypc', 'pop', 'emp']].mean().dropna()
X = np.column_stack([np.ones(len(c)), np.log(c['pop']), np.log(c.ypc)])
b, *_ = np.linalg.lstsq(X, np.log(c.ctfp), rcond=None)
b1 = np.polyfit(np.log(c['pop']), np.log(c.ctfp), 1)
print(f'n={len(c)}; ln ctfp on ln pop alone: slope {b1[0]:.3f}; with ln ypc control: pop {b[1]:.3f}, ypc {b[2]:.3f}')
for iso in ['CHN', 'IND', 'USA', 'DEU', 'JPN', 'KOR', 'BRA', 'NGA', 'IDN', 'MEX']:
    if iso in c.index:
        print(iso, round(c.loc[iso, 'ctfp'], 3), round(c.loc[iso, 'ypc']))
