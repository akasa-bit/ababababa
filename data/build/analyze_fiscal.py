#!/usr/bin/env python3
"""財政と金融の様式化された事実を計算する (目標 R19〜R22)。

同じ関数 stats() を、現実のパネル (Jordà–Schularick–Taylor R6) にも、ゲームが書き出したパネル
(tools/fiscal-panel.js。列は JST と同じ名前) にもかける (targets.json の決まり: 合否は実データと同じ統計コードで計算する)。

パネルの列 (JST と同じ): year, country, gdp (名目 GDP), revenue (政府の収入), expenditure (政府の支出),
  debtgdp (政府債務 ÷ GDP), tloans (民間の非金融部門への銀行の貸出、名目)
統計量 (国ごとの中央値を出し、国のあいだの分布を見る。1 つの国が長く載っていても重みが偏らないように):
  R19 税収 ÷ GDP              revenue / gdp
  R20 政府が黒字だった年の割合  revenue > expenditure の年 ÷ 年数
  R21 政府債務 ÷ GDP           debtgdp
  R22 民間の信用 ÷ GDP          tloans / gdp
幅の決め方 (ゲームの結果を見る前に決めた): 現実の国ごとの値の 10%〜90% 点。ゲームは、銀河ごと・国ごとの値の中央値がこの幅に入れば合格。

使い方:
  python3 data/build/analyze_fiscal.py                     現実のデータ → data/derived/fiscal.json
  python3 data/build/analyze_fiscal.py ゲームのパネル.csv    ゲームの値を同じ式で計算して表示する
"""
import json, os, sys
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'fiscal', 'JSTdatasetR6.xlsx')
OUT = os.path.join(HERE, '..', 'derived', 'fiscal.json')
STATS = {
    'R19': ('税収 ÷ GDP', lambda d: d['revenue'] / d['gdp']),
    'R20': ('政府が黒字だった年の割合', lambda d: (d['revenue'] > d['expenditure']).astype(float).where(d['revenue'].notna() & d['expenditure'].notna())),
    'R21': ('政府債務 ÷ GDP', lambda d: d['debtgdp']),
    'R22': ('民間の信用 ÷ GDP', lambda d: d['tloans'] / d['gdp']),
}

def stats(df, years=None):
    if years:
        df = df[(df['year'] >= years[0]) & (df['year'] <= years[1])]
    out = {}
    for k, (name, f) in STATS.items():
        d = df.assign(v=f(df)).dropna(subset=['v'])
        per = d.groupby('country')['v'].mean() if k == 'R20' else d.groupby('country')['v'].median()
        out[k] = {'name': name, 'countries': int(per.size), 'rows': int(len(d)),
                  'median': round(float(per.median()), 4) if per.size else None,
                  'p10': round(float(per.quantile(0.1)), 4) if per.size else None,
                  'p90': round(float(per.quantile(0.9)), 4) if per.size else None}
    return out

def game_stats(df):
    """ゲームのパネル: 銀河ごとに stats() をかけ、国のあいだの中央値を、銀河のあいだでさらに中央値にする (targets.json の sim)。
    galaxy の列がなければ (現実のデータ)、stats() と同じ"""
    if 'galaxy' not in df.columns:
        return stats(df)
    per = {g: stats(d) for g, d in df.groupby('galaxy')}
    out = {}
    for k, (name, _) in STATS.items():
        v = pd.Series([s[k]['median'] for s in per.values() if s[k]['median'] is not None])
        out[k] = {'name': name, 'galaxies': int(v.size), 'median': round(float(v.median()), 4) if v.size else None,
                  'p10': round(float(v.quantile(0.1)), 4) if v.size else None, 'p90': round(float(v.quantile(0.9)), 4) if v.size else None}
    return out

def main():
    if len(sys.argv) > 1:
        print(json.dumps(game_stats(pd.read_csv(sys.argv[1])), ensure_ascii=False, indent=1))
        return
    jst = pd.read_excel(RAW)
    res = {'source': 'Jordà–Schularick–Taylor Macrohistory Database R6 (data/raw/fiscal/JSTdatasetR6.xlsx)',
           'all': stats(jst), '1870-1913': stats(jst, (1870, 1913)), '1950-2020': stats(jst, (1950, 2020))}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
