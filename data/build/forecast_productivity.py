#!/usr/bin/env python3
"""2300 年の生産性を、現実の長い期間の生産性の伸びから予測する (開始時に選ぶ「生産性」の「2300 年の予測」)。

やり方:
  1. 最前線の生産性: 米国の 1 時間あたりの労働生産性 (BCL。2010 年の購買力平価ドル。1890〜2023 年。2024 年より後の表の値は
     見込みなので使わない)。研究 (Gordon 2016・BCL) と同じく米国を最前線とする。各年にいちばん高い国をとると、2005 年以後は
     アイルランド (多国籍企業の利益の付け替えで GDP が大きく見える) やノルウェー (石油) になるので使わない (参考に値だけ出す)。
  2. 長い期間の傾向 μ: 最前線の ln 生産性の年あたりの平均の伸び。
  3. コンドラチェフの波: 伸び率を 11 年の中心移動平均でならし、μ + a sin(2πt/P) + b cos(2πt/P) を、周期 P = 40〜70 年 (0.5 年刻み) の
     それぞれで最小二乗で当てはめ、残差の最も小さい P をとる。同じことを Maddison Project の 1 人あたり GDP の最前線
     (英国・オランダ・米国のうち最も高い国。1820〜2022 年) でも行い、周期を確かめる。
  4. 予測: ln(生産性 2300 ÷ 生産性 2023) = μ × 277 + 波の積分。中心は 1890〜2023 年の μ と BCL の波。1950 年・1973 年・2005 年
     からの μ でも計算し、幅として並べる (遠い未来の伸びは研究者の間で割れている。Gordon 2016 は減速を見込む)。
  ゲームの「いまのまま」の生産性を、現代 (2023 年) の最前線の生産性とみなし、倍率 = 生産性 2300 ÷ 生産性 2023。

使い方: python3 data/build/forecast_productivity.py   → data/derived/productivity.json
"""
import json, math, os
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'productivity')
OUT = os.path.join(HERE, '..', 'derived', 'productivity.json')
LAST, GOAL = 2023, 2300

def bcl():
    d = pd.read_excel(os.path.join(RAW, 'BCLDatabase_online_v2.7.xlsx'), 'Labor Productivity', header=0)
    d = d.rename(columns={d.columns[0]: 'year'}).set_index('year')
    d = d[[c for c in d.columns if isinstance(c, str) and len(c) == 3]]  # 国だけ (ユーロ圏 ZE と空の列を除く)
    return d[d.index <= LAST]

def frontier_mpd():
    d = pd.read_csv(os.path.join(RAW, 'mpd2023_full.csv.gz'))
    d = d[d.countrycode.isin(['GBR', 'NLD', 'USA']) & (d.year >= 1820) & (d.year <= 2022)]
    w = d.pivot(index='year', columns='countrycode', values='gdppc').dropna()
    return w.max(axis=1)

def fit_wave(level):
    """ln level の伸び率を 11 年でならし、周期 40〜70 年の正弦波を当てはめる"""
    g = np.log(level).diff().dropna()
    s = g.rolling(11, center=True).mean().dropna()
    t = s.index.to_numpy(float)
    best = None
    for P in np.arange(40, 70.01, 0.5):
        X = np.column_stack([np.ones_like(t), np.sin(2 * math.pi * t / P), np.cos(2 * math.pi * t / P)])
        coef, *_ = np.linalg.lstsq(X, s.to_numpy(), rcond=None)
        sse = float(((X @ coef - s.to_numpy()) ** 2).sum())
        if best is None or sse < best['sse']:
            best = {'P': float(P), 'mu_fit': float(coef[0]), 'a': float(coef[1]), 'b': float(coef[2]), 'sse': sse}
    best['amplitude'] = math.hypot(best['a'], best['b'])
    best['r2'] = 1 - best['sse'] / float(((s - s.mean()) ** 2).sum())
    # 波の伸び率がいちばん高い年 (最近の山)
    phase = math.atan2(best['a'], best['b'])  # a sin x + b cos x = A cos(x − phase)
    peak = phase * best['P'] / (2 * math.pi)
    while peak + best['P'] <= LAST: peak += best['P']
    while peak > LAST: peak -= best['P']
    best['last_peak'] = round(peak, 1)
    best['years'] = [int(t[0]), int(t[-1])]
    return best

def wave_integral(w, t0, t1):
    """∫ (a sin(2πt/P) + b cos(2πt/P)) dt"""
    k = 2 * math.pi / w['P']
    return (-w['a'] * (math.cos(k * t1) - math.cos(k * t0)) + w['b'] * (math.sin(k * t1) - math.sin(k * t0))) / k

def main():
    d = bcl()
    lp, who = d['USA'], d.idxmax(axis=1)
    wave = fit_wave(lp)
    wave_mpd = fit_wave(frontier_mpd())
    lnlp = np.log(lp)
    mus = {str(y): float((lnlp[LAST] - lnlp[y]) / (LAST - y)) for y in [1890, 1950, 1973, 2005]}
    out = {
        'source': 'Bergeaud, Cette & Lecat, Long-Term Productivity Database v2.7 (最前線 = 米国の 1 時間あたりの労働生産性)、'
                  'Maddison Project Database 2023 (周期の確かめ)',
        'frontier': {'first': int(lp.index[0]), 'last': LAST, 'lp_first': round(float(lp.iloc[0]), 3), 'lp_last': round(float(lp[LAST]), 3),
                     'highest_country_each_year (参考)': who.value_counts().to_dict(),
                     'highest_growth_1890_2023 (参考)': round(float((np.log(d.max(axis=1)[LAST]) - np.log(d.max(axis=1).iloc[0])) / (LAST - 1890)), 5)},
        'trend_growth': {k: round(v, 5) for k, v in mus.items()},
        'kondratiev_bcl': {k: (round(v, 5) if isinstance(v, float) else v) for k, v in wave.items()},
        'kondratiev_maddison': {k: (round(v, 5) if isinstance(v, float) else v) for k, v in wave_mpd.items()},
    }
    W = wave_integral(wave, LAST, GOAL)
    out['wave_effect_2023_2300'] = round(math.exp(W), 4)
    out['forecast'] = {}
    for k, mu in mus.items():
        out['forecast'][f'trend_from_{k}'] = {'growth': round(mu, 5), 'multiplier_2300': round(math.exp(mu * (GOAL - LAST) + W), 2)}
    out['central'] = out['forecast']['trend_from_1890']['multiplier_2300']
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
