#!/usr/bin/env python3
"""中立の利子率 (自然利子率 r*) と、1 人あたりの潜在の伸びの関係を計算する (回 KE6・B-118。ゲームの係数で、目標ではない)。

生データ: Holston, Laubach & Williams (2023) の推計 (data/raw/hlw/hlw_estimates.csv.gz。米国・カナダ・ユーロ圏の四半期) と、
          WDI の人口の伸び (data/raw/hlw/wdi_popgrow.csv.gz。SP.POP.GROW)。どちらも data/fetch/fetch_hlw.py で取得。
計算: 年ごとに平均し、1 人あたりの潜在の伸び gpc = g (HLW の潜在の伸び、総額) − 人口の伸び とする。
  game.c・game.z = r* を gpc に当てた最小二乗 (3 つの経済をまとめる。r* = z + c × gpc。どれも % / 年)。
      HLW は r* = g + z (c = 1) を総額の伸びで置くが、ゲームの国は入植と移民で人口が年に何十 % も増えるので、1 人あたりの伸びに当て直した
      (ラムゼーの式 r = ρ + σ g の形。人口の伸びは入らない)
  game.range = r* の 1%〜99% 点 (ゲームの中立の金利の幅)
使い方: python3 data/build/build_rstar.py → data/derived/rstar.json
"""
import json, os
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'hlw')
OUT = os.path.join(HERE, '..', 'derived', 'rstar.json')
ISO = {'US': 'USA', 'CA': 'CAN', 'EA': 'EMU'}


def ols(x, y):
    X = np.column_stack([np.ones(len(x)), x])
    b = np.linalg.lstsq(X, y, rcond=None)[0]
    return float(b[0]), float(b[1])


def main():
    h = pd.read_csv(os.path.join(RAW, 'hlw_estimates.csv.gz'))
    h['year'] = pd.to_datetime(h['date']).dt.year
    a = h.groupby(['economy', 'year'])[['g', 'z', 'rstar', 'gap']].mean().reset_index()
    p = pd.read_csv(os.path.join(RAW, 'wdi_popgrow.csv.gz')).rename(columns={'value': 'n'})
    a['iso3'] = a['economy'].map(ISO)
    a = a.merge(p, on=['iso3', 'year']).dropna()
    a['gpc'] = a['g'] - a['n']
    z, c = ols(a['gpc'], a['rstar'])
    by = {}
    for k, x in a.groupby('economy'):
        zk, ck = ols(x['gpc'], x['rstar'])
        by[k] = {'years': [int(x['year'].min()), int(x['year'].max())], 'g': round(float(x['g'].mean()), 3), 'n': round(float(x['n'].mean()), 3),
                 'gpc': round(float(x['gpc'].mean()), 3), 'rstar': round(float(x['rstar'].mean()), 3), 'z_hlw': round(float(x['z'].mean()), 3),
                 'corr': round(float(x[['rstar', 'gpc']].corr().iloc[0, 1]), 3), 'z': round(zk, 3), 'c': round(ck, 3)}
    res = {
        'note': 'r* = z + c × (1 人あたりの潜在の伸び)。どれも % / 年。HLW の推計 (片側) と WDI の人口の伸びの年平均。ゲームの係数 (src/economy/fiscal-consts.js の CB.rs)',
        'rows': int(len(a)),
        'game': {'z': round(z, 3), 'c': round(c, 3), 'range': [round(float(a['rstar'].quantile(0.01)), 3), round(float(a['rstar'].quantile(0.99)), 3)],
                 'corr': round(float(a[['rstar', 'gpc']].corr().iloc[0, 1]), 3)},
        'gpc_median': round(float(a['gpc'].median()), 3),
        'rstar_median': round(float(a['rstar'].median()), 3),
        'by_economy': by,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(json.dumps(res['game'], ensure_ascii=False), 'gpc の中央値', res['gpc_median'], 'r* の中央値', res['rstar_median'])


if __name__ == '__main__':
    main()
