#!/usr/bin/env python3
"""財政と金融の様式化された事実を計算する (目標 R19〜R22・R27・R28)。

同じ関数 stats() を、現実のパネル (Jordà–Schularick–Taylor R6) にも、ゲームが書き出したパネル
(tools/fiscal-panel.js。列は JST と同じ名前) にもかける (targets.json の決まり: 合否は実データと同じ統計コードで計算する)。

パネルの列 (JST と同じ): year, country, gdp (名目 GDP), revenue (政府の収入), expenditure (政府の支出),
  debtgdp (政府債務 ÷ GDP), tloans (民間の非金融部門への銀行の貸出、名目)、
  R28 だけに使う列: ltrate (長期の利子率 [%/年]), rgdpbarro (実質 GDP), war (その年に国家間戦争をしていれば 1)。
  現実の war は Correlates of War の国家間戦争のデータ v4.0 (data/raw/history/cow_interstate_v4.csv。data/fetch/fetch_history.py で取ったもの) の参戦の期間から作る
統計量 (国ごとの中央値を出し、国のあいだの分布を見る。1 つの国が長く載っていても重みが偏らないように):
  R19 税収 ÷ GDP              revenue / gdp
  R20 政府が黒字だった年の割合  revenue > expenditure の年 ÷ 年数
  R21 政府債務 ÷ GDP           debtgdp
  R22 民間の信用 ÷ GDP          tloans / gdp
  R27 政府支出 ÷ GDP           expenditure / gdp (2026-10-20 に足した。費用の大きさを経済に合わせるため)
  R28 財政の反応              国ごとの最小二乗 pb = a + ρ·d(前の年) + β·gap + γ·war の ρ (Bohn 1998 の形)。
                              pb = 基礎収支 ÷ GDP = (revenue − expenditure) / gdp + ltrate/100 × d(前の年) (利子の払いは
                              JST にないので、長期の利子率 × 前の年の債務で近づける)、d = debtgdp、
                              gap = ln(rgdpbarro) − HP フィルター (λ = 100) の傾向。30 年以上ある国だけ (2026-10-20 に足した)
幅の決め方 (ゲームの結果を見る前に決めた): 現実の国ごとの値の 10%〜90% 点。ゲームは、銀河ごと・国ごとの値の中央値がこの幅に入れば合格。

使い方:
  python3 data/build/analyze_fiscal.py                     現実のデータ → data/derived/fiscal.json
  python3 data/build/analyze_fiscal.py ゲームのパネル.csv    ゲームの値を同じ式で計算して表示する
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'fiscal', 'JSTdatasetR6.xlsx')
COW = os.path.join(HERE, '..', 'raw', 'history', 'cow_interstate_v4.csv')  # data/fetch/fetch_history.py で取ったもの
OUT = os.path.join(HERE, '..', 'derived', 'fiscal.json')
# JST の国 → Correlates of War の国の番号 (ドイツは 1945〜1990 年の西ドイツ 260 も)
COW_CODE = {'USA': [2], 'Canada': [20], 'UK': [200], 'Ireland': [205], 'Netherlands': [210], 'Belgium': [211], 'France': [220],
            'Switzerland': [225], 'Spain': [230], 'Portugal': [235], 'Germany': [255, 260], 'Italy': [325], 'Finland': [375],
            'Sweden': [380], 'Norway': [385], 'Denmark': [390], 'Japan': [740], 'Australia': [900]}
STATS = {
    'R19': ('税収 ÷ GDP', lambda d: d['revenue'] / d['gdp']),
    'R20': ('政府が黒字だった年の割合', lambda d: (d['revenue'] > d['expenditure']).astype(float).where(d['revenue'].notna() & d['expenditure'].notna())),
    'R21': ('政府債務 ÷ GDP', lambda d: d['debtgdp']),
    'R22': ('民間の信用 ÷ GDP', lambda d: d['tloans'] / d['gdp']),
    'R27': ('政府支出 ÷ GDP', lambda d: d['expenditure'] / d['gdp']),
}

def hp_trend(y, lam=100.0):
    """Hodrick–Prescott フィルターの傾向 (年次の λ = 100)"""
    n = len(y)
    D = np.diff(np.eye(n), 2, axis=0)
    return np.linalg.solve(np.eye(n) + lam * D.T @ D, y)

def reaction(df):
    """R28: 国ごとの財政の反応の傾き ρ (pd.Series、国 → ρ)"""
    out = {}
    for c, d in df.sort_values('year').groupby('country'):
        d = d.copy()
        d['dl'] = d['debtgdp'].shift(1)
        d['pb'] = (d['revenue'] - d['expenditure']) / d['gdp'] + d['ltrate'] / 100 * d['dl']
        y = np.log(d['rgdpbarro'].where(d['rgdpbarro'] > 0))
        ok = y.notna()
        d['gap'] = np.nan
        if ok.sum() >= 3:
            d.loc[ok, 'gap'] = y[ok] - hp_trend(y[ok].to_numpy(float))
        s = d.dropna(subset=['pb', 'dl', 'gap', 'war'])
        if len(s) < 30:
            continue
        cols = [np.ones(len(s)), s['dl'], s['gap']] + ([s['war']] if s['war'].sum() > 0 else [])
        b, *_ = np.linalg.lstsq(np.column_stack(cols), s['pb'].to_numpy(float), rcond=None)
        out[c] = b[1]
    return pd.Series(out, dtype=float)

def summary(name, per, rows):
    return {'name': name, 'countries': int(per.size), 'rows': int(rows),
            'median': round(float(per.median()), 4) if per.size else None,
            'p10': round(float(per.quantile(0.1)), 4) if per.size else None,
            'p90': round(float(per.quantile(0.9)), 4) if per.size else None}

def stats(df, years=None):
    if years:
        df = df[(df['year'] >= years[0]) & (df['year'] <= years[1])]
    out = {}
    for k, (name, f) in STATS.items():
        d = df.assign(v=f(df)).dropna(subset=['v'])
        per = d.groupby('country')['v'].mean() if k == 'R20' else d.groupby('country')['v'].median()
        out[k] = summary(name, per, len(d))
    if {'ltrate', 'rgdpbarro', 'war'} <= set(df.columns):
        out['R28'] = summary(REACTION, reaction(df), len(df))
    return out

REACTION = '財政の反応 (前の年の債務 ÷ GDP に対する基礎収支 ÷ GDP の傾き)'

def with_war(jst):
    """JST に war の列 (Correlates of War の国家間戦争に参戦していた年なら 1) を足す"""
    cow = pd.read_csv(COW, encoding='latin-1')
    years = {}
    for c, codes in COW_CODE.items():
        ys = set()
        for _, r in cow[cow['ccode'].isin(codes)].iterrows():
            for a, b in ((r['StartYear1'], r['EndYear1']), (r['StartYear2'], r['EndYear2'])):
                if a > 0:
                    ys |= set(range(int(a), int(b) + 1))
        years[c] = ys
    return jst.assign(war=[float(y in years.get(c, ())) for c, y in zip(jst['country'], jst['year'])])

def game_stats(df):
    """ゲームのパネル: 銀河ごとに stats() をかけ、国のあいだの中央値を、銀河のあいだでさらに中央値にする (targets.json の sim)。
    galaxy の列がなければ (現実のデータ)、stats() と同じ"""
    if 'galaxy' not in df.columns:
        return stats(df)
    per = {g: stats(d) for g, d in df.groupby('galaxy')}
    out = {}
    for k, name in [(k, n) for k, (n, _) in STATS.items()] + ([('R28', REACTION)] if any('R28' in s for s in per.values()) else []):
        v = pd.Series([s[k]['median'] for s in per.values() if k in s and s[k]['median'] is not None])
        out[k] = {'name': name, 'galaxies': int(v.size), 'median': round(float(v.median()), 4) if v.size else None,
                  'p10': round(float(v.quantile(0.1)), 4) if v.size else None, 'p90': round(float(v.quantile(0.9)), 4) if v.size else None}
    return out

def main():
    if len(sys.argv) > 1:
        print(json.dumps(game_stats(pd.read_csv(sys.argv[1])), ensure_ascii=False, indent=1))
        return
    jst = with_war(pd.read_excel(RAW))
    res = {'source': 'Jordà–Schularick–Taylor Macrohistory Database R6 (data/raw/fiscal/JSTdatasetR6.xlsx)',
           'all': stats(jst), '1870-1913': stats(jst, (1870, 1913)), '1950-2020': stats(jst, (1950, 2020))}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
