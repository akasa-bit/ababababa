#!/usr/bin/env python3
"""年齢つきの人口の様式化された事実を計算する (セッション 10 の目標の幅の案。固定はセッション 10 が行う)。

統計量:
  1. 所得の 5 分位 (WDI の国 × 年、1990〜2023 年) ごとの、0〜14 歳・15〜64 歳・65 歳以上の割合の四分位範囲 (25%〜75% 点)
  2. 人口転換: ln (合計特殊出生率) を ln (1 人あたり所得) に当てはめた傾き (年の固定効果つき・国を引き直すブートストラップ 500 回)
  3. 所得の 5 分位ごとの、出生時の平均余命・65 歳の平均余命・出産の平均年齢 (WPP) の四分位範囲
  4. 5 歳きざみの率の表の形: WPP の生命表 (2023 年) と年齢別出生率から、所得の 5 分位ごとの中央値の国の
     5 歳きざみの死亡率 mx・出生率 ASFR (セッション 10 が、世代の比で延ばしてコーホートの率にする元)

使い方: python3 data/build/build_demography.py → data/derived/demography.json
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'demography')
OUT = os.path.join(HERE, '..', 'derived', 'demography.json')

def wdi():
    d = pd.read_csv(os.path.join(RAW, 'wdi_demography.csv.gz'))
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index()
    return w.rename(columns={'SP.POP.0014.TO.ZS': 'young', 'SP.POP.1564.TO.ZS': 'work', 'SP.POP.65UP.TO.ZS': 'old',
                             'SP.DYN.TFRT.IN': 'tfr', 'SP.DYN.LE00.IN': 'le', 'NY.GDP.PCAP.PP.KD': 'gdppc'})

def quintiles(p):
    lq = np.log(p['gdppc'])
    edges = np.quantile(lq, [0, .2, .4, .6, .8, 1])
    return p.assign(q=np.clip(np.searchsorted(edges, lq, side='right') - 1, 0, 4)), [float(np.exp(e)) for e in edges]

def iqr(s):
    return [float(np.quantile(s, .25)), float(np.quantile(s, .5)), float(np.quantile(s, .75))]

def slope(p):
    """ln TFR = 年の固定効果 + b ln y。"""
    x, y, g = np.log(p['gdppc'].to_numpy()), np.log(p['tfr'].to_numpy()), p['year'].to_numpy()
    xd, yd = x.copy(), y.copy()
    for t in np.unique(g):
        k = g == t
        xd[k] -= x[k].mean()
        yd[k] -= y[k].mean()
    return float((xd @ yd) / (xd @ xd))

def main():
    w = wdi()
    p = w[(w['year'] >= 1990) & (w['year'] <= 2023)].dropna(subset=['young', 'work', 'old', 'gdppc', 'tfr'])
    p, edges = quintiles(p)
    age = [{'income': [edges[q], edges[q + 1]], 'n': int((p['q'] == q).sum()), **{k: iqr(p.loc[p['q'] == q, k] / 100) for k in ('young', 'work', 'old')},
            'tfr': iqr(p.loc[p['q'] == q, 'tfr'])} for q in range(5)]
    b = slope(p)
    rng = np.random.default_rng(1)
    cs = p['iso3'].unique()
    boots = []
    for _ in range(500):
        pick = rng.choice(cs, len(cs))
        boots.append(slope(pd.concat([p[p['iso3'] == c] for c in pick])))
    # WPP: 2023 年の国の所得の分位 (WDI の 2023 年の所得)
    ind = pd.read_csv(os.path.join(RAW, 'wpp_indicators.csv.gz'))
    ind = ind[ind['Time'] == 2023].rename(columns={'ISO3_code': 'iso3'})
    y23 = w[w['year'] == 2023][['iso3', 'gdppc']].dropna()
    c23, e23 = quintiles(ind.merge(y23, on='iso3'))
    lt = pd.read_csv(os.path.join(RAW, 'wpp_lifetable_age5.csv.gz'))
    lt = lt[lt['Time'] == 2023]
    fx = pd.read_csv(os.path.join(RAW, 'wpp_asfr_age5.csv.gz'))
    fx = fx[fx['Time'] == 2023]
    life, rates = [], []
    for q in range(5):
        s = c23[c23['q'] == q]
        life.append({'income': [e23[q], e23[q + 1]], 'n': int(len(s)), 'le0': iqr(s['LEx']), 'le65': iqr(s['LE65']), 'mac': iqr(s['MAC']), 'tfr': iqr(s['TFR'])})
        mid = s.iloc[(s['TFR'] - s['TFR'].median()).abs().argsort().iloc[0]]  # 出生率が分位の中央値に近い国
        m = lt[lt['ISO3_code'] == mid['iso3']]
        f = fx[fx['ISO3_code'] == mid['iso3']]
        rates.append({'iso3': mid['iso3'], 'country': mid['Location'], 'tfr': float(mid['TFR']),
                      'mx': {sex: {int(r.AgeGrpStart): float(r.mx) for r in m[m['Sex'] == sex].itertuples()} for sex in ('Male', 'Female')},
                      'asfr': {int(r.AgeGrpStart): float(r.ASFR) / 1000 for r in f.itertuples()}})
    res = {'note': '割合は 0〜1。所得は 2021 年の国際ドル (WDI、PPP)。帯は [25%, 50%, 75%] 点。asfr は女性 1 人あたり年あたりの出生',
           'age_by_income': age, 'years': [int(p['year'].min()), int(p['year'].max())], 'countries': int(len(cs)),
           'tfr_income_elasticity': {'b': b, 'band_5_95': [float(np.quantile(boots, .05)), float(np.quantile(boots, .95))], 'boots': len(boots)},
           'life_by_income_2023': life, 'rates_2023_median_country': rates}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(f"{res['countries']} か国・{res['years']}・出生率の所得弾力性 {b:.3f} (5〜95%: {res['tfr_income_elasticity']['band_5_95'][0]:.3f}〜{res['tfr_income_elasticity']['band_5_95'][1]:.3f})")
    for a in age:
        print(f"  所得 {a['income'][0]:8.0f}〜{a['income'][1]:8.0f}: 0〜14 {a['young'][0]:.2f}〜{a['young'][2]:.2f}  15〜64 {a['work'][0]:.2f}〜{a['work'][2]:.2f}  65〜 {a['old'][0]:.3f}〜{a['old'][2]:.3f}  TFR {a['tfr'][0]:.1f}〜{a['tfr'][2]:.1f}")
    for l, r in zip(life, rates):
        print(f"  2023 所得 {l['income'][0]:8.0f}〜: 平均寿命 {l['le0'][0]:.1f}〜{l['le0'][2]:.1f}  出産の平均年齢 {l['mac'][1]:.1f}  中央の国 {r['country']} (TFR {r['tfr']:.2f})")

if __name__ == '__main__':
    sys.exit(main())
