#!/usr/bin/env python3
"""国ごとに違う開始の大きさ (回 SE8・B-029。QD-111 = c) の元の数を、実データから出す。

材料:
  - Maddison Project Database 2023 (data/raw/productivity/mpd2023_full.csv.gz。fetch_productivity.py が取る): 1820 年の国 (いまの国境の 90 か国) の人口
  - Correlates of War の国力の指標 6.0 (data/raw/nations/nmc_6.csv。fetch_nations.py が取る): 国・年ごとの総人口 (tpop)・軍の人員 (milper)・軍事費 (milex)
出すもの (data/derived/nations.json):
  - size: 1820 年の国の人口 ÷ 中央値 の 10・25・50・75・90% 点 (ゲームは 10〜90% 点のあいだから引く)。照合として、COW の 1820 年の主権国家 (国力の指標に人口のある国) の同じ点
  - army: ln 軍の人員 = a + b × ln 総人口 (1816〜1850 年の国・年。年の固定効果つきの最小二乗。標準誤差は国でまとめたもの)。ゲームは開始の艦隊を人口の比の b 乗で決める
  - money: ln 軍事費 = a + b × ln 総人口 (同じ形。開始の資金と資材の参考)

使い方: python3 data/build/analyze_nations.py
"""
import csv, gzip, io, json, math, os, statistics, sys
import numpy as np

HERE = os.path.dirname(__file__)
MPD = os.path.join(HERE, '..', 'raw', 'productivity', 'mpd2023_full.csv.gz')
NMC = os.path.join(HERE, '..', 'raw', 'nations', 'nmc_6.csv')
OUT = os.path.join(HERE, '..', 'derived', 'nations.json')
PCTS = [10, 25, 50, 75, 90]


def quantiles(xs):
    xs = sorted(xs)
    def q(p):  # 線形の内挿 (numpy の既定と同じ)
        return float(np.percentile(xs, p))
    med = q(50)
    return {str(p): round(q(p) / med, 4) for p in PCTS}, med


def ols_fe(rows, ykey):
    """ln y = a + b ln tpop + 年の固定効果。国でまとめた標準誤差"""
    data = [(r['ccode'], int(r['year']), math.log(float(r[ykey])), math.log(float(r['tpop']))) for r in rows
            if r[ykey] not in ('', '-9') and r['tpop'] not in ('', '-9') and float(r[ykey]) > 0 and float(r['tpop']) > 0]
    years = sorted({d[1] for d in data})
    X = np.array([[d[3]] + [1.0 if d[1] == y else 0.0 for y in years] for d in data])
    Y = np.array([d[2] for d in data])
    beta, *_ = np.linalg.lstsq(X, Y, rcond=None)
    e = Y - X @ beta
    XtXi = np.linalg.pinv(X.T @ X)
    meat = np.zeros((X.shape[1], X.shape[1]))
    for c in {d[0] for d in data}:
        idx = [i for i, d in enumerate(data) if d[0] == c]
        s = X[idx].T @ e[idx]
        meat += np.outer(s, s)
    V = XtXi @ meat @ XtXi
    return {'b': round(float(beta[0]), 4), 'se': round(float(math.sqrt(V[0, 0])), 4), 'n': len(data), 'states': len({d[0] for d in data}), 'years': [years[0], years[-1]]}


def main():
    with gzip.open(MPD, 'rt', encoding='utf-8') as f:
        mpd = [r for r in csv.DictReader(f) if r['year'] == '1820' and r['pop'] not in ('', None)]
    size, med = quantiles([float(r['pop']) for r in mpd])
    with open(NMC, encoding='utf-8') as f:
        nmc = list(csv.DictReader(f))
    cow1820 = [float(r['tpop']) for r in nmc if r['year'] == '1820' and r['tpop'] not in ('', '-9') and float(r['tpop']) > 0]
    cow, cmed = quantiles(cow1820)
    early = [r for r in nmc if 1816 <= int(r['year']) <= 1850]
    out = {
        'size': {'source': 'Maddison Project Database 2023, 1820 年', 'countries': len(mpd), 'median_pop_thousands': med, 'ratio_to_median': size},
        'size_check_cow': {'source': 'COW National Material Capabilities 6.0, 1820 年の主権国家', 'states': len(cow1820), 'median_pop_thousands': cmed, 'ratio_to_median': cow},
        'army': {'source': 'COW NMC 6.0, 1816〜1850 年、ln milper ~ ln tpop + 年', **ols_fe(early, 'milper')},
        'money': {'source': 'COW NMC 6.0, 1816〜1850 年、ln milex ~ ln tpop + 年', **ols_fe(early, 'milex')},
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    sys.exit(main())
