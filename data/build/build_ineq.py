#!/usr/bin/env python3
"""国の中の所得の分け方 (所得の 5 分位の分け前) の様式化された事実を計算する (目標 R84。回 KE11・B-127。docs/fiscal.md の 12)。

生データ: 世界銀行 WDI の所得の 5 分位の分け前 (SI.DST.FRST.20・02ND・03RD・04TH・05TH。%。data/raw/groups/wdi_quintiles.csv。
data/fetch/fetch_groups.py が取ったもの) と、WDI の農業の就業の割合 (SL.AGR.EMPL.ZS。data/raw/sectors/wdi_sectors.csv.gz)。

統計量:
  対数正規の当てはめ: 所得が対数正規 (ばらつき σ) なら、5 分位の分け前は σ だけで決まる (上位 20% = 1 − Φ(z0.8 − σ) など)。
      国・年ごとに上位 20% の分け前から σ を解き、ほかの 4 つの分位の当てはまり (差の絶対値の平均) を出す
  R84 国の中の所得の偏り: 上位 20% の分け前の、国ごとの平均 (年で平均) の分布 (10%・50%・90% 点)。
      合格: ゲームの星系 (人口 100 万人以上) の上位 20% の分け前の中央値が、実データの国の平均の 10%〜90% 点の中で、
      ゲームの星系の 90% 点 − 10% 点 (ばらつき) が、実データの 90% 点 − 10% 点の ±50% の中
  (参考) σ の国の平均の分布と、国の中の年ごとのばらつき・σ を農業の就業の割合に当てた傾き (国・年。重みなし。土地の偏りの分の目安) と、そのときの農業の就業の割合の平均

使い方: python3 data/build/build_ineq.py → data/derived/ineq.json
        python3 data/build/build_ineq.py --game 星系のパネル.csv → ゲームの R84 (同じ式。tools/ineq-panel.js の出力。列: galaxy, year, sys, pop, q1〜q5 (%))
"""
import json, os, sys
from statistics import NormalDist
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw')
OUT = os.path.join(HERE, '..', 'derived', 'ineq.json')
N = NormalDist()
Z = [N.inv_cdf(p) for p in (0.2, 0.4, 0.6, 0.8)]


def shares(s):
    c = [0.0] + [N.cdf(z - s) for z in Z] + [1.0]
    return np.diff(c)


def sigma_of(q5):
    lo, hi = 0.01, 4.0
    for _ in range(80):
        m = (lo + hi) / 2
        if shares(m)[4] < q5: lo = m
        else: hi = m
    return (lo + hi) / 2


def real():
    q = pd.read_csv(os.path.join(RAW, 'groups', 'wdi_quintiles.csv'))
    q['sigma'] = [sigma_of(v / 100) for v in q.q5]
    pred = np.array([shares(s) for s in q.sigma]) * 100
    err = np.abs(pred - q[['q1', 'q2', 'q3', 'q4', 'q5']].values).mean(axis=0)
    cm = q.groupby('iso3').agg(q5=('q5', 'mean'), sigma=('sigma', 'mean'))
    within = (q.sigma - q.groupby('iso3').sigma.transform('mean')).std()
    p = lambda s, x: round(float(s.quantile(x)), 4)
    q5 = {str(x): p(cm.q5, x) for x in (0.1, 0.25, 0.5, 0.75, 0.9)}
    spread = q5['0.9'] - q5['0.1']
    s = pd.read_csv(os.path.join(RAW, 'sectors', 'wdi_sectors.csv.gz'))
    ag = s[s.indicator == 'SL.AGR.EMPL.ZS'][['iso3', 'year', 'value']].rename(columns={'value': 'agr'})
    d = q.merge(ag, on=['iso3', 'year']).dropna()
    X = np.column_stack([np.ones(len(d)), d.agr / 100])
    b = np.linalg.lstsq(X, d.sigma, rcond=None)[0]
    return {
        'source': 'World Bank WDI SI.DST.*.20 (所得の 5 分位の分け前) と SL.AGR.EMPL.ZS。CC BY 4.0',
        'lognormal': {'country_years': int(len(q)), 'countries': int(q.iso3.nunique()), 'mean_abs_err_pts': [round(float(x), 2) for x in err]},
        'R84': {'name': '国の中の所得の偏り (上位 20% の分け前の国ごとの平均、%)', 'countries': int(len(cm)), 'q': q5,
                'band': [q5['0.1'], q5['0.9']], 'spread': round(spread, 2), 'spread_band': [round(0.5 * spread, 2), round(1.5 * spread, 2)]},
        'sigma': {'country_mean_q': {str(x): p(cm.sigma, x) for x in (0.1, 0.25, 0.5, 0.75, 0.9)}, 'within_sd': round(float(within), 4),
                  'agr_slope': round(float(b[1]), 4), 'agr_mean': round(float((d.agr / 100).mean()), 4), 'agr_rows': int(len(d))},
    }


def game(path):
    g = pd.read_csv(path)
    g = g[g['pop'] >= 1]
    per = g.groupby(['galaxy', 'sys']).q5.mean()
    r = json.load(open(OUT, encoding='utf-8'))['R84']
    med, spread = float(per.median()), float(per.quantile(0.9) - per.quantile(0.1))
    ok = r['band'][0] <= med <= r['band'][1] and r['spread_band'][0] <= spread <= r['spread_band'][1]
    out = {'R84': {'systems': int(len(per)), 'median': round(med, 2), 'spread': round(spread, 2), 'band': r['band'], 'spread_band': r['spread_band'], 'pass': bool(ok)}}
    print(json.dumps(out, ensure_ascii=False))
    print(f"R84 {'合格' if ok else '不合格'} (中央値 {med:.1f}%・幅 {r['band'][0]}〜{r['band'][1]}、ばらつき {spread:.1f} 点・幅 {r['spread_band'][0]}〜{r['spread_band'][1]}、星系 {len(per)})")
    return out


def main():
    if len(sys.argv) > 2 and sys.argv[1] == '--game':
        return game(sys.argv[2])
    res = real()
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
