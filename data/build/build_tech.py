#!/usr/bin/env python3
"""製造業の中の中・高技術の割合と所得の様式化された事実を計算する (目標 R61。回 KE5)。

統計量 (WDI の NV.MNF.TECH.ZS.UN (UNIDO) と NY.GDP.PCAP.PP.KD。国・年):
  R61: 1 人あたり所得 (2021 年の国際ドル) の 5 分位ごとの、製造業の付加価値のうち中・高技術の割合の 25%〜75% 点 (R36 と同じ形)
  ゲームの需要の曲線 (src/economy/market-consts.js の STRUCTURE.hitech): 工業品の付加価値のうち高付加価値物品の割合 = 1 / (1 + exp(−(a + b ln y)))
      (ゲームは、これを工業品の需要 (STRUCTURE.goods) の分け方に読み替える)。中・高技術の割合の logit を ln y に当てた最小二乗 (国・年をそのまま)。
      y はゲームの所得の物差し (2011 年の国際ドル) にするため、2021 年のドルを米国の GDP デフレーターの比 1.21 で割ってから当てる (R36 と同じ読み替え)

使い方: python3 data/build/build_tech.py → data/derived/tech.json
        python3 data/build/build_tech.py ゲームのパネル.csv → ゲームの R61 (列 colony, galaxy, year, income (2011 年のドル), hitech (高付加価値物品の割合))
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'tech', 'wdi_tech.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'tech.json')
TO2011 = 1.21  # 2021 年のドル ÷ 2011 年のドル (米国の GDP デフレーター。R36 と同じ)


def panel():
    d = pd.read_csv(RAW)
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index()
    x = w.dropna(subset=['NV.MNF.TECH.ZS.UN', 'NY.GDP.PCAP.PP.KD']).copy()
    x['share'] = x['NV.MNF.TECH.ZS.UN'] / 100
    x['y'] = x['NY.GDP.PCAP.PP.KD']
    return x[(x['share'] > 0) & (x['share'] < 1) & (x['y'] > 0)]


def quintiles(y):
    ly = np.log(y)
    edges = np.quantile(ly, [0, .2, .4, .6, .8, 1])
    return np.clip(np.searchsorted(edges, ly, side='right') - 1, 0, 4), [float(np.exp(e)) for e in edges]


def game(path):
    t = {r['id']: r for r in json.load(open(os.path.join(HERE, '..', '..', 'targets', 'targets.json'), encoding='utf-8'))['realism']}['R61']
    g = pd.read_csv(path)
    g['y21'] = g['income'] * TO2011
    out, ok, n = [], 0, 0
    for b in t['bands']:
        lo, hi = b['income']
        s = g[(g['y21'] >= lo) & (g['y21'] < hi)]['hitech']
        if len(s) < 100:
            out.append({'income': b['income'], 'n': len(s)})
            continue
        m = float(s.median())
        inside = b['share'][0] <= m <= b['share'][1]
        n += 1; ok += inside
        out.append({'income': b['income'], 'n': len(s), 'median': round(m, 4), 'band': b['share'], 'inside': inside})
    passed = n >= 3 and ok >= 2 * n / 3
    print(json.dumps(out, ensure_ascii=False))
    print(f"R61 {'合格' if passed else '不合格'} (比べられる分位 {n}、幅の中 {ok})")


def main():
    if len(sys.argv) > 1:
        return game(sys.argv[1])
    x = panel()
    q, edges = quintiles(x['y'])
    bands = []
    for i in range(5):
        s = x['share'][q == i]
        bands.append({'income': [round(edges[i]), round(edges[i + 1])], 'share': [round(float(np.quantile(s, .25)), 4), round(float(np.quantile(s, .75)), 4)],
                      'median': round(float(np.median(s)), 4), 'n': int(len(s))})
    # 需要の曲線: logit(割合) = a + b ln (y ÷ 1.21)
    X = np.log(x['y'] / TO2011).to_numpy()
    Y = np.log(x['share'] / (1 - x['share'])).to_numpy()
    b, a = np.polyfit(X, Y, 1)
    out = {
        'source': 'data/raw/tech/wdi_tech.csv.gz (WDI の NV.MNF.TECH.ZS.UN (UNIDO の CIP)・NY.GDP.PCAP.PP.KD)。計算は data/build/build_tech.py',
        'countries': int(x['iso3'].nunique()), 'country_years': int(len(x)), 'years': [int(x['year'].min()), int(x['year'].max())],
        'by_income': bands,
        'note': '所得は 2021 年の国際ドル。割合は製造業の付加価値のうち中・高技術の産業の割合',
        'game': {'hitech': [round(float(a), 4), round(float(b), 4)], 'cpi': round(float(np.median(x['share'])), 3),
                 'note': 'hitech = STRUCTURE.hitech。工業品の付加価値のうち高付加価値物品の割合 = 1/(1+exp(-(a + b ln y)))、y は 2011 年の国際ドル。'
                         'cpi = すべての国・年の割合の中央値 (消費者物価の工業品を、低付加価値物品と高付加価値物品に分ける値打ちの割合)'},
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
