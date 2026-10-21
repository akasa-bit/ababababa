#!/usr/bin/env python3
"""産業構造と所得の様式化された事実を計算する (目標 R10 の幅の案。固定はセッション 9 が行う)。

部門は 3 つにまとめる (Herrendorf・Rogerson・Valentinyi 2014 と同じ):
  農業 = Agriculture、工業 = Mining・Manufacturing・Utilities・Construction、サービス = 残りの 5 部門
2 つのデータで同じ計算をする:
  - GGDC 10 部門 (就業者、1950〜2012 年) × Maddison 2023 の 1 人あたり所得 (2011 年の国際ドル)
  - WDI (ILOSTAT のモデル推計の就業の割合、1991 年〜) × WDI の 1 人あたり所得 (PPP、2021 年の国際ドル)
統計量 (R10 の文のとおり):
  1. 所得の 5 分位 (国 × 年をまとめた ln 所得の分位) ごとの、3 部門の割合の四分位範囲 (25%〜75% 点)
  2. 工業の割合が最大になる所得: 工業の割合を ln 所得の 2 次式で当てはめた頂点 (国ごとの固定効果つき)。
     国を引き直すブートストラップ (500 回) の 5%〜95% 点を幅にする
ゲームの所得を 2011 年の国際ドルに読み替える物差し (anchor。目標 R10 の測り方。セッション 9 で固定):
  ゲームの食料 1 単位 = 穀物 100 万 t (src の UNIT_KG。1 人 1 t/年) なので、食料の基準の値段を、2011 年の世界の穀物の値段
  (World Bank Pink Sheet の名目の年の値段: 小麦 US HRW・とうもろこし・米 Thai 5%) を USDA PSD の 2011 年の世界の消費量で重みづけた平均に合わせる。
  生データは data/raw/market/ (data/fetch/fetch_market.py で取ったもの)

使い方: python3 data/build/build_sectors.py → data/derived/sectors.json
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'sectors')
MARKET = os.path.join(HERE, '..', 'raw', 'market')
OUT = os.path.join(HERE, '..', 'derived', 'sectors.json')
AGR = ['Agriculture ']
IND = ['Mining', 'Manufacturing', 'Utilities', 'Construction']
SRV = ['Trade, restaurants and hotels', 'Transport, storage and communication', 'Finance, insurance, real estate and business services',
       'Government services', 'Community, social and personal services']

def ggdc():
    d = pd.read_excel(os.path.join(RAW, '10sd_jan15_2014.xlsx'), sheet_name='dataset')
    d = d[d['Variable'] == 'EMP'].copy()
    for c in AGR + IND + SRV:
        d[c] = pd.to_numeric(d[c], errors='coerce')
    tot = d[AGR + IND + SRV].sum(axis=1, min_count=10)
    p = pd.DataFrame({'iso3': d['Country'], 'year': d['Year'].astype(int), 'agr': d[AGR].sum(axis=1) / tot,
                      'ind': d[IND].sum(axis=1) / tot, 'srv': d[SRV].sum(axis=1) / tot}).dropna()
    m = pd.read_csv(os.path.join(RAW, 'mpd2023.csv.gz'))[['countrycode', 'year', 'gdppc']].rename(columns={'countrycode': 'iso3'})
    return p.merge(m, on=['iso3', 'year']).dropna()

def wdi():
    d = pd.read_csv(os.path.join(RAW, 'wdi_sectors.csv.gz'))
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index()
    w = w.rename(columns={'SL.AGR.EMPL.ZS': 'agr', 'SL.IND.EMPL.ZS': 'ind', 'SL.SRV.EMPL.ZS': 'srv', 'NY.GDP.PCAP.PP.KD': 'gdppc'})
    w[['agr', 'ind', 'srv']] /= 100
    return w.dropna(subset=['agr', 'ind', 'srv', 'gdppc'])

def peak(p):
    """工業の割合 = 国の固定効果 + b1 ln y + b2 (ln y)² の頂点 exp(−b1 ÷ 2 b2)。"""
    x = np.log(p['gdppc'].to_numpy())
    y = p['ind'].to_numpy()
    g = p['iso3'].to_numpy()
    X = np.column_stack([x, x * x])
    # 国ごとに平均を引く (固定効果を消す)
    Xd, yd = X.copy(), y.copy()
    for c in np.unique(g):
        k = g == c
        Xd[k] -= X[k].mean(axis=0)
        yd[k] -= y[k].mean()
    b = np.linalg.lstsq(Xd, yd, rcond=None)[0]
    return float(np.exp(-b[0] / (2 * b[1]))) if b[1] < 0 else float('nan'), [float(v) for v in b]

def facts(p, seed=1):
    lq = np.log(p['gdppc'])
    edges = np.quantile(lq, [0, .2, .4, .6, .8, 1])
    p = p.assign(q=np.clip(np.searchsorted(edges, lq, side='right') - 1, 0, 4))
    bins = []
    for q in range(5):
        s = p[p['q'] == q]
        bins.append({'income': [float(np.exp(edges[q])), float(np.exp(edges[q + 1]))], 'n': int(len(s)),
                     **{k: [float(np.quantile(s[k], .25)), float(np.quantile(s[k], .5)), float(np.quantile(s[k], .75))] for k in ('agr', 'ind', 'srv')}})
    pk, b = peak(p)
    rng = np.random.default_rng(seed)
    cs = p['iso3'].unique()
    boots = []
    for _ in range(500):
        pick = rng.choice(cs, len(cs))
        bp = pd.concat([p[p['iso3'] == c].assign(iso3=f'{c}#{i}') for i, c in enumerate(pick)])
        v, _ = peak(bp)
        if np.isfinite(v):
            boots.append(v)
    return {'n': int(len(p)), 'countries': int(len(cs)), 'years': [int(p['year'].min()), int(p['year'].max())], 'quintiles': bins,
            'industry_peak_income': pk, 'industry_peak_band_5_95': [float(np.quantile(boots, .05)), float(np.quantile(boots, .95))],
            'industry_peak_fit': {'b_lny': b[0], 'b_lny2': b[1]}, 'boots': len(boots)}

def anchor(year=2011):
    """世界の穀物の 1 t の値段 (その年の名目のドル = 2011 年なら 2011 年の国際ドル)。Pink Sheet の 3 品目を、PSD の世界の消費量で重みづける。"""
    import openpyxl
    ws = openpyxl.load_workbook(os.path.join(MARKET, 'CMO-Historical-Data-Annual.xlsx'), read_only=True)['Annual Prices (Nominal)']
    rows = list(ws.iter_rows(values_only=True))
    head = next(r for r in rows if r[1] == 'Crude oil, average')
    row = next(r for r in rows if r[0] in (year, str(year)))
    col = {'Wheat': 'Wheat, US HRW', 'Corn': 'Maize', 'Rice, Milled': 'Rice, Thai 5% '}
    price = {k: float(row[head.index(v)]) for k, v in col.items()}
    d = pd.read_csv(os.path.join(MARKET, 'psd_cereals.csv.gz'))
    d = d[(d['Market_Year'] == year) & (d['Attribute_Description'] == 'Domestic Consumption')]
    cons = {k: float(d[d['Commodity_Description'] == k]['Value'].sum()) * 1e3 for k in col}  # (1000 MT) → t
    usd = sum(price[k] * cons[k] for k in col) / sum(cons.values())
    return {'year': year, 'usd_per_t': usd, 'prices_usd_per_t': {k: price[k] for k in col}, 'consumption_t': cons,
            'series': {k: v.strip() for k, v in col.items()},
            'note': 'ゲームの食料の基準の値段 (cr / 100 万 t) を、この 1 t の値段 × 100 万に合わせる。1 人あたり所得 (ドル) = 実質の所得 [cr] ÷ 食料の基準の値段 [cr / 100 万 t] × usd_per_t ÷ 人口 [百万人]'}

def main():
    res = {'note': '割合は 0〜1。所得は ggdc = 2011 年の国際ドル (Maddison 2023)、wdi = 2021 年の国際ドル (PPP)。分位の帯は [下, 中央, 上] = 25%・50%・75% 点',
           'ggdc': facts(ggdc()), 'wdi': facts(wdi()), 'anchor': anchor()}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    a = res['anchor']
    print(f"物差し: {a['year']} 年の世界の穀物 1 t = {a['usd_per_t']:.1f} ドル ({', '.join(f'{k} {v:.1f}' for k, v in a['prices_usd_per_t'].items())})")
    for k in ('ggdc', 'wdi'):
        r = res[k]
        print(f"{k}: {r['countries']} か国・{r['years']}・工業の頂点の所得 {r['industry_peak_income']:.0f} (5〜95%: {r['industry_peak_band_5_95'][0]:.0f}〜{r['industry_peak_band_5_95'][1]:.0f})")
        for q in r['quintiles']:
            print(f"  所得 {q['income'][0]:8.0f}〜{q['income'][1]:8.0f}: 農業 {q['agr'][0]:.2f}〜{q['agr'][2]:.2f}  工業 {q['ind'][0]:.2f}〜{q['ind'][2]:.2f}  サービス {q['srv'][0]:.2f}〜{q['srv'][2]:.2f}")

if __name__ == '__main__':
    sys.exit(main())
