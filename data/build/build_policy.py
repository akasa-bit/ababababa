#!/usr/bin/env python3
"""現実の経済政策で使われた値の幅を、生データから出す (セッション 19 の一覧と、セッション 20 の「選べる値の幅」の案)。

  - 政策金利: BIS WS_CBPOL (月次)。国ごとの最低・最高と、全体の 1%・5%・50%・95%・99% 点。マイナス金利の国と期間
  - WDI: インフレ率・貸出金利・預金金利・税収 ÷ GDP・政府の支出 ÷ GDP・債務 ÷ GDP・純貸出 ÷ GDP・関税率・税の種類の割合・広い意味のお金 ÷ GDP の、
    国・年の分布 (最低・最高の国と年、分位点) と、国ごとの中央値の分布

使い方: python3 data/build/build_policy.py → data/derived/policy.json
"""
import gzip, io, json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'policy')
OUT = os.path.join(HERE, '..', 'derived', 'policy.json')
Q = [0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99]

def dist(v):
    v = pd.to_numeric(v, errors='coerce').dropna()
    return {'n': int(v.size), 'quantiles': {str(q): round(float(v.quantile(q)), 4) for q in Q}, 'min': round(float(v.min()), 4), 'max': round(float(v.max()), 4)}

def extremes(d, col, k=5):
    d = d.dropna(subset=[col]).sort_values(col)
    pick = lambda x: [{'where': str(r['where']), 'when': str(r['when']), 'value': round(float(r[col]), 4)} for _, r in x.iterrows()]
    return {'lowest': pick(d.head(k)), 'highest': pick(d.tail(k)[::-1])}

def bis():
    d = pd.read_csv(gzip.open(os.path.join(RAW, 'bis_cbpol.csv.gz')), dtype=str)
    d['v'] = pd.to_numeric(d['OBS_VALUE'], errors='coerce')
    d = d.dropna(subset=['v']).rename(columns={'REF_AREA': 'where', 'TIME_PERIOD': 'when'})
    per = d.groupby('where')['v'].agg(['min', 'max', 'median', 'count'])
    neg = d[d['v'] < 0].groupby('where')['when'].agg(['min', 'max', 'count'])
    return {'source': 'BIS central bank policy rates (WS_CBPOL)、月次・期末', 'countries': int(d['where'].nunique()), 'period': [str(d['when'].min()), str(d['when'].max())],
            'all_months': dist(d['v']), 'extremes': extremes(d, 'v'),
            'country_min_median_max': {c: [round(float(r['min']), 3), round(float(r['median']), 3), round(float(r['max']), 3)] for c, r in per.iterrows()},
            'negative': {c: {'from': str(r['min']), 'to': str(r['max']), 'months': int(r['count'])} for c, r in neg.iterrows()}}

def wdi():
    d = pd.read_csv(gzip.open(os.path.join(RAW, 'wdi_policy.csv.gz')))
    d = d.rename(columns={'country': 'where', 'year': 'when'})
    out = {}
    for ind, g in d.groupby('indicator'):
        med = g.groupby('iso3')['value'].median()
        out[ind] = {'countries': int(g['iso3'].nunique()), 'years': [int(g['when'].min()), int(g['when'].max())], 'all': dist(g['value']),
                    'country_medians': dist(med), 'extremes': extremes(g, 'value')}
    return out

def main():
    res = {'note': '値は % (WDI の単位のまま)。extremes は国・年 (BIS は国・月) の最低と最高。country_medians は国ごとの中央値の分布', 'policy_rate': bis(), 'wdi': wdi()}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    p = res['policy_rate']
    print(f"政策金利: {p['countries']} か国 {p['period']}、最低 {p['extremes']['lowest'][0]}、最高 {p['extremes']['highest'][0]}、マイナス金利 {len(p['negative'])} か国")
    for ind, r in res['wdi'].items():
        print(f"{ind}: {r['countries']} か国、最低 {r['extremes']['lowest'][0]['where']} {r['extremes']['lowest'][0]['when']} {r['extremes']['lowest'][0]['value']}、最高 {r['extremes']['highest'][0]['where']} {r['extremes']['highest'][0]['when']} {r['extremes']['highest'][0]['value']}、国の中央値の 10〜90% {r['country_medians']['quantiles']['0.1']}〜{r['country_medians']['quantiles']['0.9']}")

if __name__ == '__main__':
    sys.exit(main())
