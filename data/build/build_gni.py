#!/usr/bin/env python3
"""国民総所得 ÷ 国内総生産 (GNI ÷ GDP) と所得の様式化された事実を計算する (目標 R65。回 KE5・B-114)。

統計量 (世界銀行 WDI の NY.GNP.MKTP.CD・NY.GDP.MKTP.CD (data/raw/gni/wdi_gni.csv.gz) と NY.GDP.PCAP.PP.KD (data/raw/tech/wdi_tech.csv.gz)。国・年):
  R65: 1 人あたり所得 (2021 年の国際ドル) の 5 分位ごとの、GNI ÷ GDP の 25%〜75% 点 (1990 年から。R36・R61・R62 と同じ形)。
       GNI ÷ GDP − 1 = 外からの所得の受け取り − 外への支払い (利潤・配当・利子・雇用者の報酬) の GDP 比
  ゲームの係数 (目標ではない): fdi = 新しい投資のうち外国が出す割合 (直接投資の受け入れ (純) ÷ 総固定資本形成) の、国ごとの中央値の中央値
       (src/economy/market-consts.js の OWNER.fdi。遠くの持ち分は、資本の入れ替わりの速さでこの値に近づく)

使い方: python3 data/build/build_gni.py → data/derived/gni.json
        python3 data/build/build_gni.py ゲームのパネル.csv → ゲームの R65
            (列 country, galaxy, year, income (1 人あたりの実質の所得。2011 年の国際ドル), gdp, gni。国・年ごとに 1 行)
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'gni', 'wdi_gni.csv.gz')
INC = os.path.join(HERE, '..', 'raw', 'tech', 'wdi_tech.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'gni.json')
TO2011 = 1.21  # 2021 年のドル ÷ 2011 年のドル (米国の GDP デフレーター。R36・R61・R62 と同じ)


def panel():
    d = pd.read_csv(RAW)
    d = d[d['indicator'].isin(['NY.GNP.MKTP.CD', 'NY.GDP.MKTP.CD'])]  # 表を組むときに、ほかの指標の欠けで行が落ちないように
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index()
    w = w.rename(columns={'NY.GNP.MKTP.CD': 'gni', 'NY.GDP.MKTP.CD': 'gdp'}).dropna(subset=['gni', 'gdp'])
    w = w[w['gdp'] > 0]
    inc = pd.read_csv(INC)
    inc = inc[inc['indicator'] == 'NY.GDP.PCAP.PP.KD'][['iso3', 'year', 'value']].rename(columns={'value': 'y'})
    x = w.merge(inc, on=['iso3', 'year']).dropna()
    x = x[x['y'] > 0].copy()
    x['r'] = x['gni'] / x['gdp']
    return x


def fdi_share():
    """直接投資の受け入れ (純) ÷ 総固定資本形成 (国・年。総固定資本形成が正のものだけ) の、国ごとの中央値の分布"""
    d = pd.read_csv(RAW)
    d = d[d['indicator'].isin(['BX.KLT.DINV.WD.GD.ZS', 'NE.GDI.FTOT.ZS'])]
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index().dropna(subset=['BX.KLT.DINV.WD.GD.ZS', 'NE.GDI.FTOT.ZS'])
    w = w[w['NE.GDI.FTOT.ZS'] > 0]
    f = w['BX.KLT.DINV.WD.GD.ZS'] / w['NE.GDI.FTOT.ZS']
    c = f.groupby(w['iso3']).median()
    return {'value': round(float(np.median(c)), 4), 'country_p25_p75': [round(float(np.quantile(c, .25)), 4), round(float(np.quantile(c, .75)), 4)],
            'country_years_median': round(float(np.median(f)), 4), 'countries': int(len(c)), 'country_years': int(len(f)),
            'note': '新しい投資のうち外国が出す割合 = BX.KLT.DINV.WD.GD.ZS ÷ NE.GDI.FTOT.ZS。value は国ごとの中央値の中央値 (OWNER.fdi)'}


def quintiles(y):
    ly = np.log(y)
    edges = np.quantile(ly, [0, .2, .4, .6, .8, 1])
    return np.clip(np.searchsorted(edges, ly, side='right') - 1, 0, 4), [float(np.exp(e)) for e in edges]


def game(path):
    T = {r['id']: r for r in json.load(open(os.path.join(HERE, '..', '..', 'targets', 'targets.json'), encoding='utf-8'))['realism']}
    g = pd.read_csv(path)
    g = g[g['gdp'] > 0].copy()
    g['y21'] = g['income'] * TO2011
    g['r'] = g['gni'] / g['gdp']
    out, ok, n = [], 0, 0
    for b in T['R65']['bands']:
        lo, hi = b['income']
        s = g[(g['y21'] >= lo) & (g['y21'] < hi)]['r']
        if len(s) < 100:
            out.append({'income': b['income'], 'n': len(s)}); continue
        m = float(s.median()); inside = b['ratio'][0] <= m <= b['ratio'][1]
        n += 1; ok += inside
        out.append({'income': b['income'], 'n': len(s), 'median': round(m, 4), 'band': b['ratio'], 'inside': bool(inside)})
    res = {'R65': {'pass': bool(n >= 3 and ok >= 2 * n / 3), 'compared': n, 'inside': ok, 'bins': out}}
    print(json.dumps(res, ensure_ascii=False))
    print(f"R65 {'合格' if res['R65']['pass'] else '不合格'} (比べられる分位 {n}、幅の中 {ok})")


def main():
    if len(sys.argv) > 1:
        return game(sys.argv[1])
    x = panel()
    q, edges = quintiles(x['y'])
    r65 = []
    for i in range(5):
        s = x['r'][q == i]
        r65.append({'income': [round(edges[i]), round(edges[i + 1])], 'ratio': [round(float(np.quantile(s, .25)), 4), round(float(np.quantile(s, .75)), 4)],
                    'median': round(float(np.median(s)), 4), 'n': int(len(s))})
    c = x.groupby('iso3')['r'].median()
    out = {
        'source': 'data/raw/gni/wdi_gni.csv.gz (世界銀行 WDI の NY.GNP.MKTP.CD・NY.GDP.MKTP.CD)・data/raw/tech/wdi_tech.csv.gz (NY.GDP.PCAP.PP.KD)。計算は data/build/build_gni.py',
        'countries': int(x['iso3'].nunique()), 'country_years': int(len(x)), 'years': [int(x['year'].min()), int(x['year'].max())],
        'by_income': r65,
        'country_median': {k: round(float(v), 4) for k, v in zip(['p10', 'p25', 'p50', 'p75', 'p90'], np.quantile(c, [.1, .25, .5, .75, .9]))},
        'note': '所得は 2021 年の国際ドル。ratio = GNI ÷ GDP (名目の米ドルどうし)',
        'game': {'fdi': fdi_share()},
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
