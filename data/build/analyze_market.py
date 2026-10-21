#!/usr/bin/env python3
"""市場 (値段と在庫) の様式化された事実を計算する (目標 R23〜R26)。

同じ関数を、現実の生データにも、ゲームが書き出したパネル (tools/market-panel.js。列は下と同じ) にもかける。
  値段のパネル: series, group, year, price (実質の値段。ゲームはお金の量が一定なので、名目 = 実質)
  在庫のパネル: series, year, stock, use (在庫と、その年の消費)
統計量:
  R23 値段の変化のばらつき   各系列の Δln(値段) の標準偏差 (年次)
  R24 値段の続き方           各系列の ln(値段) から直線の傾向を除いたものの 1 年の自己相関 (Deaton & Laroque 1992 の形)
  R25 穀物の在庫 ÷ 消費       世界の小麦・とうもろこし・米の、期末在庫 ÷ その年の国内消費の合計
  R26 工業品の在庫 ÷ 売上     米国の企業全体の在庫 ÷ 月の売上 (月数。FRED ISRATIO)
幅の決め方 (ゲームの結果を見る前に決めた): 現実の系列 (R23・R24) か、年・月 (R25・R26) の 10%〜90% 点。

使い方:
  python3 data/build/analyze_market.py                          現実のデータ → data/derived/market.json
  python3 data/build/analyze_market.py prices.csv food.csv goods.csv   ゲームのパネル (tools/market-panel.js) を同じ式で計算して表示する
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'market')
OUT = os.path.join(HERE, '..', 'derived', 'market.json')
# ゲームの資源に対応する一次産品 (Pink Sheet の列の名前)
GROUPS = {
    'food': ['Barley', 'Maize', 'Sorghum', 'Rice, Thai 5% ', 'Wheat, US SRW', 'Wheat, US HRW', 'Soybeans', 'Soybean oil', 'Soybean meal',
             'Palm oil', 'Coconut oil', 'Groundnut oil', 'Sugar, world', 'Beef', 'Chicken', 'Lamb', 'Banana, US', 'Orange'],
    'metal': ['Aluminum', 'Iron ore, cfr spot', 'Copper', 'Lead', 'Tin', 'Nickel', 'Zinc'],
    'fuel': ['Crude oil, average', 'Coal, Australian', 'Natural gas, US'],
    'rare': ['Gold', 'Platinum', 'Silver'],
}
MIN_YEARS = 30

def q(v):
    v = pd.Series(v).dropna()
    return {'n': int(v.size), 'median': round(float(v.median()), 4), 'p10': round(float(v.quantile(0.1)), 4), 'p90': round(float(v.quantile(0.9)), 4)} if v.size else None

def series_stats(prices):
    """prices: series, group, year, price → 系列ごとの R23・R24"""
    rows = []
    for (s, g), d in prices.dropna(subset=['price']).query('price > 0').sort_values('year').groupby(['series', 'group']):
        if len(d) < MIN_YEARS:
            continue
        lp = np.log(d['price'].to_numpy(float))
        t = d['year'].to_numpy(float)
        resid = lp - np.polyval(np.polyfit(t, lp, 1), t)
        # 値段がずっと同じ系列 (ゲームで値段が下限に張りついた星系など) は、自己相関が決まらないので NaN にする
        ar1 = float(np.corrcoef(resid[:-1], resid[1:])[0, 1]) if np.std(resid[:-1]) > 0 and np.std(resid[1:]) > 0 else np.nan
        rows.append({'series': s, 'group': g, 'sd_dlog': float(np.std(np.diff(lp), ddof=1)), 'ar1': ar1})
    return pd.DataFrame(rows)

def price_stats(prices):
    st = series_stats(prices)
    out = {'R23': {'name': '値段の変化のばらつき (Δln 値段の標準偏差)', 'all': q(st['sd_dlog'])}, 'R24': {'name': '値段の続き方 (傾向を除いた ln 値段の 1 年の自己相関)', 'all': q(st['ar1'])}}
    for g, d in st.groupby('group'):
        out['R23'][g] = q(d['sd_dlog'])
        out['R24'][g] = q(d['ar1'])
    return out

def stock_stats(stocks):
    r = (stocks['stock'] / stocks['use']).replace([np.inf, -np.inf], np.nan)
    return {'name': '在庫 ÷ その年の消費', 'all': q(r)}

def real_prices():
    d = pd.read_excel(os.path.join(RAW, 'CMO-Historical-Data-Annual.xlsx'), 'Annual Prices (Real)', header=None)
    names = [str(x) for x in d.iloc[6].tolist()]
    body = d.iloc[8:].copy()
    body.columns = names
    body = body.rename(columns={names[0]: 'year'})
    body['year'] = pd.to_numeric(body['year'], errors='coerce')
    rows = []
    for g, cols in GROUPS.items():
        for c in cols:
            v = pd.to_numeric(body[c], errors='coerce')
            rows += [{'series': c.strip(), 'group': g, 'year': int(y), 'price': p} for y, p in zip(body['year'], v) if pd.notna(y) and pd.notna(p)]
    return pd.DataFrame(rows)

def real_stocks():
    d = pd.read_csv(os.path.join(RAW, 'psd_cereals.csv.gz'))
    d = d[(d['Market_Year'] >= 1960) & (d['Market_Year'] <= 2024)]
    w = d.groupby(['Commodity_Description', 'Market_Year', 'Attribute_Description'])['Value'].sum().unstack()
    w = w.reset_index().rename(columns={'Commodity_Description': 'series', 'Market_Year': 'year', 'Ending Stocks': 'stock', 'Domestic Consumption': 'use'})
    return w

def per_galaxy(df, f):
    """ゲームのパネル: 銀河ごとに f をかけて中央値を出し、銀河のあいだの分布にする (targets.json の sim)"""
    v = pd.Series([f(d) for _, d in df.groupby('galaxy')]).dropna()
    return {'galaxies': int(v.size), **(q(v) or {})}

def game_stats(prices, food=None, goods=None):
    """ゲームのパネルのフォルダから: prices.csv (series, group, galaxy, year, price)、food.csv・goods.csv (series, galaxy, year, stock, use)"""
    p = pd.read_csv(prices)
    out = {'R23': per_galaxy(p, lambda d: series_stats(d)['sd_dlog'].median() if len(series_stats(d)) else np.nan),
           'R24': per_galaxy(p, lambda d: series_stats(d)['ar1'].median() if len(series_stats(d)) else np.nan)}
    for k, f in [('R25', food), ('R26', goods)]:
        if f:
            d = pd.read_csv(f)
            # 銀河の在庫の合計 ÷ 消費の合計を年ごとに出し、年の中央値 (現実の統計は世界の合計 ÷ 合計。版 12。前は星系ごとの比の中央値)
            out[k] = per_galaxy(d, lambda x: (x.groupby('year')['stock'].sum() / x.groupby('year')['use'].sum()).replace([np.inf, -np.inf], np.nan).median())
    return out

def main():
    if len(sys.argv) > 1:
        print(json.dumps(game_stats(*sys.argv[1:4]), ensure_ascii=False, indent=1))
        return
    isr = pd.read_csv(os.path.join(RAW, 'fred_isratio.csv'))
    res = {
        'source': 'World Bank Pink Sheet (年次・実質 2010 年ドル)、USDA PSD (小麦・とうもろこし・米、国の合計)、FRED ISRATIO',
        'prices': price_stats(real_prices()),
        'R25': {**stock_stats(real_stocks()), 'name': '穀物の在庫 ÷ その年の消費 (世界の小麦・とうもろこし・米。1960〜2024 年)'},
        'R26': {'name': '在庫 ÷ 月の売上 (米国の企業全体、月数。1992 年〜)', 'all': q(pd.to_numeric(isr['ISRATIO'], errors='coerce'))},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
