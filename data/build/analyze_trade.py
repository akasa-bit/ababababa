#!/usr/bin/env python3
"""交易の生データ (CEPII Gravity 2000〜2019) から、重力モデルの距離の弾力性を推定する (目標 R01)。

本推定 (合否に使う式。ゲームの書き出しにも同じ式を使う):
  PPML、輸出国 × 年と輸入国 × 年の固定効果、説明変数は ln 距離だけ。
  交易額は BACI (千米ドル)、距離は人口で重みを付けた距離 (distw_harmonic、km)。交易額が空の組は使わない。
  ゲームの星系には、隣接・言語・植民地の関係のような変数がないので、両方で同じ式にするため制御変数は入れない。
参考の推定 (合否には使わない): 制御変数あり・空の交易額を 0 とする・距離を dist にする・年ごと。

使い方: python3 data/build/analyze_trade.py   → data/derived/trade.json
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from gravity import read_flows, elasticity

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', 'raw', 'trade', 'cepii_gravity_2000_2019.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'trade.json')
CONTROLS = ('contig', 'comlang_off', 'comcol', 'fta_wto')


def main():
    rows = read_flows(SRC)
    for r in rows:
        r['tradeflow'] = r['tradeflow_baci']
    main_est = elasticity(rows, dist_col='distw_harmonic')
    print('本推定', main_est, flush=True)
    ref = {
        'controls': elasticity(rows, dist_col='distw_harmonic', controls=CONTROLS),
        'zeros': elasticity(rows, dist_col='distw_harmonic', zeros=True),
        'dist': elasticity(rows, dist_col='dist'),
    }
    for k, v in ref.items():
        print(k, v, flush=True)
    years = {}
    for y in range(2000, 2020):
        years[y] = round(elasticity([r for r in rows if r['year'] == str(y)], dist_col='distw_harmonic')['beta'], 4)
    print('年ごと', years)
    out = {
        'source': 'data/raw/trade/cepii_gravity_2000_2019.csv.gz (CEPII Gravity V202211)',
        'R01': {
            'statistic': 'PPML (輸出国×年・輸入国×年の固定効果) の ln 距離の係数。説明変数は ln 距離だけ。距離は distw_harmonic、交易額は tradeflow_baci (空の組は除く)',
            'estimate': round(main_est['beta'], 4), 'rows': main_est['rows'], 'iterations': main_est['iterations'],
            'band': [round(main_est['beta'] - 0.3, 4), round(min(main_est['beta'] + 0.3, 0.0), 4)],
            'band_rule': 'targets.json の R01 の合格の決まり (負で、実データとの差が 0.3 以内) をそのまま当てはめた',
        },
        'reference': {k: {'beta': round(v['beta'], 4), 'rows': v['rows'], **({'controls': {c: round(x, 4) for c, x in v['controls'].items()}} if v['controls'] else {})} for k, v in ref.items()},
        'by_year': years,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
