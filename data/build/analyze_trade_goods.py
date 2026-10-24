#!/usr/bin/env python3
"""品ごとの重力モデルの距離の弾力性を推定する (目標 R01 の品ごとの見直し。回 KE5)。

交易額は BACI HS17 をゲームの品にまとめたもの (data/raw/trade_goods/。data/fetch/fetch_trade_goods.py)、距離は CEPII Gravity の
人口で重みを付けた距離 (distw_harmonic、km。data/raw/trade/ の 2017〜2019 年)。式は R01 の本推定と同じ (data/build/gravity.py の elasticity:
PPML、輸出国 × 年・輸入国 × 年の固定効果、説明変数は ln 距離だけ、交易額が空の組は使わない)。品ごとに別々に推定する。
参考に、全部の品を足した額 (R01 の 2017〜2019 年の版) と、品の額の割合も出す。

使い方: python3 data/build/analyze_trade_goods.py → data/derived/trade_goods.json
        python3 data/build/analyze_trade_goods.py ゲームの書き出し.csv → ゲームの品ごとの推定 (tools/gravity.js の RES=1 の書き出し。列 year, iso3_o, iso3_d, dist, tradeflow, res)
"""
import csv, gzip, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from gravity import read_flows, elasticity

HERE = os.path.dirname(__file__)
FLOWS = os.path.join(HERE, '..', 'raw', 'trade_goods', 'baci_hs17_groups_2017_2019.csv.gz')
DIST = os.path.join(HERE, '..', 'raw', 'trade', 'cepii_gravity_2000_2019.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'trade_goods.json')
GROUPS = ['food', 'fuel', 'metal', 'goods', 'hitech']  # 合否に使う品 (goods = 低付加価値物品、hitech = 高付加価値物品。目標の版 17) (水・希少元素・その他は額が小さいか、ゲームの品と合わないので参考だけ)
REF = ['rare', 'water']


def by_group(rows, key):
    out = {}
    for r in rows:
        out.setdefault(r[key], []).append(r)
    return out


def game(path):
    """ゲームの書き出し (品ごと) の R01: 品をまとめた推定と、交易額の 5% 以上の品ごとの推定を、targets.json の幅と比べる"""
    T = next(r for r in json.load(open(os.path.join(HERE, '..', '..', 'targets', 'targets.json'), encoding='utf-8'))['realism'] if r['id'] == 'R01')
    rows = read_flows(path)
    tot, agg = {}, {}
    for r in rows:
        tot[r['res']] = tot.get(r['res'], 0.0) + float(r['tradeflow'])
        k = (r['year'], r['iso3_o'], r['iso3_d'])
        if k not in agg:
            agg[k] = {'year': r['year'], 'iso3_o': r['iso3_o'], 'iso3_d': r['iso3_d'], 'dist': r['dist'], 'tradeflow': 0.0}
        agg[k]['tradeflow'] += float(r['tradeflow'])
    s = sum(tot.values()) or 1
    allb = elasticity(list(agg.values()))['beta']
    res = {'all': round(allb, 4), 'share': {k: round(v / s, 4) for k, v in sorted(tot.items())}, 'goods': {}}
    lo, hi = T['band']
    ok = bool(lo <= allb <= hi)
    compared = 0
    for g, rs in sorted(by_group(rows, 'res').items()):
        try:
            e = elasticity(rs)
            res['goods'][g] = {'beta': round(e['beta'], 4), 'rows': e['rows']}
        except Exception as ex:  # 組が少なすぎる品
            res['goods'][g] = {'beta': None, 'rows': len(rs), 'error': str(ex)[:80]}
            continue
        band = T['goods'].get(g, {}).get('band')
        if band and tot[g] / s >= 0.05:
            compared += 1
            inside = band[0] <= e['beta'] <= band[1]
            res['goods'][g].update({'band': band, 'inside': inside})
            ok = ok and inside
    ok = ok and compared >= 2
    print(json.dumps(res, ensure_ascii=False))
    print(f"R01 {'合格' if ok else '不合格'} (まとめた推定 {allb:.3f}、幅 {lo}〜{hi}。交易額の 5% 以上の品 {compared})")


def main():
    if len(sys.argv) > 1:
        return game(sys.argv[1])
    dist = {}
    with gzip.open(DIST, 'rt', encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            if r['year'] in ('2017', '2018', '2019') and r['distw_harmonic']:
                dist[(r['year'], r['iso3_o'], r['iso3_d'])] = r['distw_harmonic']
    flows = read_flows(FLOWS)
    rows, miss, total = [], 0, {}
    for r in flows:
        d = dist.get((r['year'], r['iso3_o'], r['iso3_d']))
        if d is None:
            miss += 1
            continue
        rows.append({'year': r['year'], 'iso3_o': r['iso3_o'], 'iso3_d': r['iso3_d'], 'dist': d, 'tradeflow': r['v'], 'group': r['group']})
        k = (r['year'], r['iso3_o'], r['iso3_d'])
        total[k] = total.get(k, 0.0) + float(r['v'])
    allrows = [{'year': y, 'iso3_o': o, 'iso3_d': d, 'dist': dist[(y, o, d)], 'tradeflow': v} for (y, o, d), v in total.items()]
    est_all = elasticity(allrows)
    print('全部の品', est_all, flush=True)
    grp = by_group(rows, 'group')
    est = {}
    for g in GROUPS + REF:
        e = elasticity(grp[g])
        est[g] = {'beta': round(e['beta'], 4), 'rows': e['rows'], 'band': [round(e['beta'] - 0.3, 4), round(e['beta'] + 0.3, 4)] if g in GROUPS else None}
        print(g, est[g], flush=True)
    s = sum(float(r['tradeflow']) for r in rows)
    share = {g: round(sum(float(r['tradeflow']) for r in rs) / s, 4) for g, rs in sorted(grp.items())}
    out = {
        'source': 'data/raw/trade_goods/baci_hs17_groups_2017_2019.csv.gz (CEPII BACI HS17 V202501) × data/raw/trade/ の距離 (CEPII Gravity V202211)',
        'estimator': 'data/build/gravity.py の elasticity (R01 の本推定と同じ: PPML、輸出国 × 年・輸入国 × 年の固定効果、ln 距離だけ、空の組は使わない)',
        'years': [2017, 2019],
        'rows_without_distance': miss,
        'all_goods': {'beta': round(est_all['beta'], 4), 'rows': est_all['rows']},
        'goods': est,
        'share': share,
        'band_rule': 'R01 と同じ: 品ごとの推定値との差 0.3 以内',
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
