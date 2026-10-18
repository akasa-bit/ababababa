#!/usr/bin/env python3
"""tools/gravity.js の書き出しから、距離の弾力性を推定する (目標 R01)。実データと同じ data/build/gravity.py の式を使う。
銀河をまとめた推定 (合否に使う) と、銀河ごとの推定の分布を出す。
使い方: python3 tools/gravity-analyze.py gravity.csv
"""
import json, os, statistics, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'data', 'build'))
from gravity import read_flows, elasticity

rows = read_flows(sys.argv[1])
band = next(r['band'] for r in json.load(open(os.path.join(os.path.dirname(__file__), '..', 'targets', 'targets.json')))['realism'] if r['id'] == 'R01')
pooled = elasticity(rows)
per = {}
for r in rows:
    per.setdefault(r['year'].split(':')[0], []).append(r)
each = []
for k, rs in per.items():
    if len({r['iso3_o'] for r in rs}) >= 3 and len({r['iso3_d'] for r in rs}) >= 3 and len(rs) >= 20:
        try:
            each.append(elasticity(rs)['beta'])
        except Exception:
            pass
each.sort()
q = lambda f: each[min(len(each) - 1, int(f * len(each)))] if each else float('nan')
ok = band[0] <= pooled['beta'] <= band[1]
print(f"まとめた推定 {pooled['beta']:.3f} ({pooled['rows']} 行) ・ 幅 {band[0]}〜{band[1]} ・ R01 {'合格' if ok else '不合格'}")
print(f"銀河ごと ({len(each)} 個): 中央値 {statistics.median(each) if each else float('nan'):.3f}・10% {q(0.1):.3f}・90% {q(0.9):.3f}")
