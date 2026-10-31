#!/usr/bin/env python3
"""家臣の要求をのむかの判断 (QD-41 = c・B-142。docs/demands.md) の傾きを、実データから出す。

材料 (data/fetch/fetch_demands.py が取る): Germann & Sambanis 2021 の再現データの集団・年 (自決を求める運動 SDM・地域の自治・権力への近さ・人口の割合・武力の紛争)、
GeoEPR 2021 の集団の地域の重心、CShapes 2.0 の首都と国の面積。

形: 運動が前の年から続いている集団・年 (sdm = 1 が 2 年続く) について、その年に政府が譲ったか (地域の自治を新しく与えた regaut 0 → 1、
または締め出しをやめた status_excl 1 → 0) を、次の 3 つでロジット回帰する (標準誤差は普通のもの)。
  - 大きさ: ln (集団の人口 ÷ 国の人口) (EPR の groupsize)
  - 遠さ: ln ((集団の地域の重心から首都までの大円距離 + 10 km) ÷ 国の面積と同じ円の半径)
  - 見込み: 前の年に運動と政府の武力の紛争があったか (violsd。UCDP の 25 人以上の死者の紛争)
ゲームはこの 3 つの傾きを AI の主人の判断に使う (src/politics/policy-consts.js の DEMAND_AI)。結果は data/derived/demands.json。

使い方: python3 data/build/analyze_demands.py
      python3 data/build/analyze_demands.py --game <tools/demands-panel.js の書き出し>…   (ゲームの AI の判断に同じロジットをかけて傾きを比べる)
"""
import csv, json, math, os, statistics, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from analyze_history import logit, coef, km  # 同じ統計の関数を使う

RAW = os.path.join(os.path.dirname(__file__), '..', 'raw', 'demands')
OUT = os.path.join(os.path.dirname(__file__), '..', 'derived', 'demands.json')
OFFSET_KM = 10  # 首都のある地域でも ln が取れるように足す [km]


def rows(name):
    with open(os.path.join(RAW, name), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def num(v):
    return float(v) if v not in ('', None) else None


def main():
    caps = {}
    for r in rows('cshapes_capitals.csv'):
        caps.setdefault(int(r['gwcode']), []).append((int(r['gwsyear']), int(r['gweyear']), float(r['caplat']), float(r['caplong']), float(r['area'])))
    def cap(gw, y):
        for a, b, la, lo, ar in caps.get(gw, []):
            if a <= y <= b:
                return la, lo, ar
        return None
    cen = {}
    for r in rows('geoepr_centroids.csv'):
        cen.setdefault(int(r['gwgroupid']), []).append((int(r['from']), int(r['to']), float(r['cen_lat']), float(r['cen_lon'])))
    def centroid(g, y):
        for a, b, la, lo in cen.get(g, []):
            if a <= y <= b:
                return la, lo
        return None
    by = {}
    for r in rows('gs_sdm_groups.csv'):
        by.setdefault(int(r['gwgroupid']), {})[int(r['year'])] = r
    data = []
    skipped = {'距離なし': 0, '大きさなし': 0}
    for g, ys in by.items():
        for y, r in ys.items():
            p = ys.get(y - 1)
            if not p or num(r['sdm']) != 1 or num(p['sdm']) != 1:
                continue
            aut0, aut1, ex0, ex1 = num(p['regaut']), num(r['regaut']), num(p['status_excl']), num(r['status_excl'])
            if None in (aut0, aut1, ex0, ex1):
                continue
            size = num(r['groupsize'])
            gw = int(float(r['countries_gwid']))
            c, k = cap(gw, y), centroid(g, y)
            if not size or size <= 0:
                skipped['大きさなし'] += 1
                continue
            if not c or not k:
                skipped['距離なし'] += 1
                continue
            rad = math.sqrt(c[2] / math.pi)
            acc = int((aut0 == 0 and aut1 == 1) or (ex0 == 1 and ex1 == 0))
            data.append({'g': g, 'y': y, 'acc': acc, 'size': math.log(size), 'dist': math.log((km(c[:2], k) + OFFSET_KM) / rad),
                         'risk': num(p['violsd']) or 0.0, 'excl': ex0, 'aut': aut0})
    y = np.array([d['acc'] for d in data])
    X = np.column_stack([np.ones(len(data))] + [[d[k] for d in data] for k in ('size', 'dist', 'risk')])
    b, se = logit(y, X)
    main_fit = {k: coef(b, se, i + 1, name) for i, (k, name) in enumerate([('size', 'ln 人口の割合'), ('dist', 'ln 首都までの距離 ÷ 国の半径'), ('risk', '前の年の武力の紛争')])}
    main_fit['const'] = coef(b, se, 0, '定数')
    # 確かめ: 権力への近さと自治を足しても、3 つの傾きの符号と大きさは変わらないか
    X2 = np.column_stack([X] + [[d[k] for d in data] for k in ('excl', 'aut')])
    b2, se2 = logit(y, X2)
    rob = {k: coef(b2, se2, i + 1, k) for i, k in enumerate(['size', 'dist', 'risk', 'excl', 'aut'])}
    groups = {d['g'] for d in data}
    out = {
        'note': '運動が続いている集団・年に、その年に政府が譲ったか (自治を新しく与えた・締め出しをやめた) のロジット。docs/demands.md',
        'n': len(data), 'events': int(y.sum()), 'groups': len(groups), 'years': [min(d['y'] for d in data), max(d['y'] for d in data)],
        'rate': round(float(y.mean()), 4), 'skipped': skipped,
        'mean': {k: round(statistics.mean(d[k] for d in data), 4) for k in ('size', 'dist', 'risk')},
        'logit': main_fit,
        'robust_with_status': rob,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f"集団・年 {out['n']} (集団 {out['groups']}・{out['years'][0]}〜{out['years'][1]})・譲った年 {out['events']} ({out['rate']:.1%})")
    for k in ('size', 'dist', 'risk'):
        c = main_fit[k]
        print(f"  {c['name']}: {c['coef']} (95% {c['ci95'][0]}〜{c['ci95'][1]}・p {c['p']})  権力への近さと自治を足すと {rob[k]['coef']}")


def game(paths):
    """tools/demands-panel.js の書き出し (AI の主人の判断) に同じロジットをかけ、傾きを実データと並べる"""
    d = []
    for p in paths:
        with open(p, encoding='utf-8') as f:
            d += [r for r in csv.DictReader(f)]
    y = np.array([int(r['accept']) for r in d])
    X = np.column_stack([np.ones(len(d)), [math.log(float(r['share'])) for r in d], [math.log(float(r['rel'])) for r in d], [float(r['risk']) for r in d]])
    b, se = logit(y, X)
    with open(OUT, encoding='utf-8') as f:
        real = json.load(f)['logit']
    print(f'ゲームの判断 {len(d)}・のんだ割合 {y.mean():.3f}')
    for i, k in enumerate(('size', 'dist', 'risk')):
        lo, hi = b[i + 1] - 1.96 * se[i + 1], b[i + 1] + 1.96 * se[i + 1]
        print(f"  {real[k]['name']}: ゲーム {b[i + 1]:.3f} (95% {lo:.3f}〜{hi:.3f})・実データ {real[k]['coef']}")


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--game':
        sys.exit(game(sys.argv[2:]))
    sys.exit(main())
