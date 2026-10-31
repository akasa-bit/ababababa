#!/usr/bin/env python3
"""投資と資本の様式化された事実を計算する (目標 R78・R79。回 KE6・B-119。民間の投資を採掘のほかにも)。

統計量:
  R78: 1 人あたり所得 (NY.GDP.PCAP.PP.KD。2021 年の国際ドル) の 5 分位ごとの、総固定資本形成 ÷ GDP [%] (NE.GDI.FTOT.ZS) の 25%〜75% 点
       (data/raw/gni/wdi_gni.csv.gz と data/raw/tech/wdi_tech.csv.gz。1990〜2024 年の国・年。R73 と同じ形)
  R79: 同じ所得の 5 分位ごとの、資本ストック ÷ 産出 (Penn World Table 11.0 の cn ÷ rgdpo。どちらも 2017 年の購買力平価の百万ドル) の 25%〜75% 点
       (data/raw/tfp/pwt110.csv.gz。cn は時価の購買力平価、rgdpo は 2017 年の購買力平価の連鎖なので、基準の年に近い 2015〜2019 年だけを使う)
  ゲームの係数 (目標ではない。回 KE6・B-119 の実装): game.ky = R79 の 5 分位ごとの [所得の中央値 (2011 年のドル)、資本 ÷ 産出の中央値] の 5 点
       (src/economy/market-consts.js の KSTOCK.ky。会社の目当ての資本 ÷ 付加価値を、星系の所得の ln で 5 点の間を直線で埋めて決める。端より外は端の値)
使い方: python3 data/build/build_capital.py → data/derived/capital.json
        python3 data/build/build_capital.py --game ゲームのパネル.csv → ゲームの R78・R79
            (列 country, galaxy, year, pop (百万人), income (1 人あたりの実質の所得。2011 年の国際ドル), inv (投資 ÷ GDP [%]), ky (資本 ÷ 年の GDP)。
             tools/capital-panel.js の出力。回 KE6 の B-119 の実装で足す)
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
GNI = os.path.join(HERE, '..', 'raw', 'gni', 'wdi_gni.csv.gz')
INC = os.path.join(HERE, '..', 'raw', 'tech', 'wdi_tech.csv.gz')
PWT = os.path.join(HERE, '..', 'raw', 'tfp', 'pwt110.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'capital.json')
TO2011 = 1.21  # 2021 年のドル ÷ 2011 年のドル (米国の GDP デフレーター。R36・R61・R62 と同じ)
LATE = 2351  # ゲームは、資本と市場が立ち上がる始めの 50 年を除いて比べる
KY_YEARS = (2015, 2019)


def income():
    d = pd.read_csv(INC)
    return d[d['indicator'] == 'NY.GDP.PCAP.PP.KD'][['iso3', 'year', 'value']].rename(columns={'value': 'y'})


def quintiles(x, col, digits):
    """所得の 5 分位の境目と、分位ごとの col の 25%〜75% 点・中央値"""
    q, edges = pd.qcut(x['y'], 5, labels=False, retbins=True)
    edges = [int(round(e)) for e in edges]
    bands = []
    for k in range(5):
        v = x.loc[q == k, col]
        bands.append({'income': [edges[k], edges[k + 1]], col: [round(float(v.quantile(0.25)), digits), round(float(v.quantile(0.75)), digits)],
                      'median': round(float(v.median()), digits), 'n': int(len(v))})
    return bands


def compute():
    inc = income()
    g = pd.read_csv(GNI)
    g = g[g['indicator'] == 'NE.GDI.FTOT.ZS'][['iso3', 'year', 'value']].rename(columns={'value': 'inv'})
    a = g.merge(inc, on=['iso3', 'year']).dropna()
    a = a[(a['y'] > 0) & (a['inv'] > 0)]
    p = pd.read_csv(PWT).rename(columns={'countrycode': 'iso3'})
    p = p[(p['cn'] > 0) & (p['rgdpo'] > 0) & p['year'].between(*KY_YEARS)].assign(ky=lambda d: d['cn'] / d['rgdpo'])
    b = p[['iso3', 'year', 'ky']].merge(inc, on=['iso3', 'year']).dropna()
    b = b[b['y'] > 0]
    return {
        'R78': {'rows': int(len(a)), 'countries': int(a['iso3'].nunique()), 'years': [int(a['year'].min()), int(a['year'].max())],
                'bands': quintiles(a, 'inv', 2), 'median_all': round(float(a['inv'].median()), 2)},
        'R79': {'rows': int(len(b)), 'countries': int(b['iso3'].nunique()), 'years': list(KY_YEARS),
                'bands': quintiles(b, 'ky', 3), 'median_all': round(float(b['ky'].median()), 3)},
        'game': {'ky': [[round(float(x['y'].median()) / TO2011), round(float(x['ky'].median()), 3)] for _, x in b.groupby(pd.qcut(b['y'], 5, labels=False))]},
    }


def game(path):
    T = {r['id']: r for r in json.load(open(os.path.join(HERE, '..', '..', 'targets', 'targets.json'), encoding='utf-8'))['realism']}
    g = pd.read_csv(path)
    g = g[(g['pop'] >= 1) & (g['income'] > 0) & (g['year'] >= LATE)].copy()
    g['y21'] = g['income'] * TO2011
    res = {}
    for k, col in (('R78', 'inv'), ('R79', 'ky')):
        if k not in T or col not in g.columns:
            continue
        out, ok, n = [], 0, 0
        s0 = g.dropna(subset=[col])
        for b in T[k]['bands']:
            lo, hi = b['income']
            s = s0[(s0['y21'] >= lo) & (s0['y21'] < hi)][col]
            if len(s) < 100:
                out.append({'income': b['income'], 'n': int(len(s))}); continue
            m = float(s.median()); inside = b[col][0] <= m <= b[col][1]
            n += 1; ok += inside
            out.append({'income': b['income'], 'n': int(len(s)), 'median': round(m, 3), 'band': b[col], 'inside': bool(inside)})
        res[k] = {'pass': bool(n >= 3 and ok >= 2 * n / 3), 'compared': n, 'inside': ok, 'bins': out}
    print(json.dumps(res, ensure_ascii=False))
    for k, v in res.items():
        print(f"{k} {'合格' if v['pass'] else '不合格'} (比べられる分位 {v['compared']}、幅の中 {v['inside']})")


def main():
    if len(sys.argv) > 2 and sys.argv[1] == '--game':
        return game(sys.argv[2])
    res = compute()
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
        f.write('\n')
    for k in ('R78', 'R79'):
        r = res[k]
        print(k, r['rows'], '行', r['countries'], 'か国', '中央値', [b['median'] for b in r['bands']])
    print('game.ky', res['game']['ky'])


if __name__ == '__main__':
    main()
