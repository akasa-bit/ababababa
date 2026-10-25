#!/usr/bin/env python3
"""技術革新 (回 KE6・B-120〜B-123。docs/research/innovation.md) の様式化された事実を計算する。目標 R66・R67。

統計量 (国・年):
  R66: 1 人あたり所得 (WDI NY.GDP.PCAP.PP.KD、2021 年の国際ドル) の 5 分位ごとの、研究者の数 (人口 100 万人あたり。WDI SP.POP.SCIE.RD.P6。
       UNESCO 統計研究所) の 25%〜75% 点 (1996〜2024 年。R36・R61・R62 と同じ形)
  R67: ln 研究者 (人口 100 万人あたり) を、ln 所得と、学力 (世界銀行 Human Capital Index の調和された試験の点数 HD.HCI.HLOS ÷ 100) に当てた
       最小二乗の、学力の係数 (所得をそろえたときの学力の効き。2010・2017・2018・2020 年の国・年。国を引き直すブートストラップの 5%〜95% 点も)
  ゲームの係数 (目標ではない。src/economy/market-consts.js の STRUCTURE.research): ln 研究者 = a + b ln y + c 学力 ÷ 100 の a・b・c。
       y はゲームの所得の物差し (2011 年の国際ドル) にするため、2021 年のドルを米国の GDP デフレーターの比 1.21 で割ってから当てる (R62 と同じ読み替え)

使い方: python3 data/build/build_innovation.py → data/derived/innovation.json
        python3 data/build/build_innovation.py --game ゲームのパネル.csv → ゲームの R66・R67
            (列 country, galaxy, year, pop (100 万人), income (1 人あたりの実質の所得。2011 年の国際ドル)、researchers (人口 100 万人あたり)、
             learn (大人の平均の学力。試験の点数の物差し)。国・年ごとに 1 行)
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RES = os.path.join(HERE, '..', 'raw', 'research', 'wdi_research.csv.gz')
INC = os.path.join(HERE, '..', 'raw', 'tech', 'wdi_tech.csv.gz')
HLO = os.path.join(HERE, '..', 'raw', 'hcap', 'hci_hlos.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'innovation.json')
TO2011 = 1.21  # 2021 年のドル ÷ 2011 年のドル (米国の GDP デフレーター。R36・R61・R62 と同じ)


def series(path, ind, name):
    d = pd.read_csv(path)
    return d[d['indicator'] == ind][['iso3', 'year', 'value']].rename(columns={'value': name})


def panel():
    x = series(RES, 'SP.POP.SCIE.RD.P6', 'res').merge(series(INC, 'NY.GDP.PCAP.PP.KD', 'y'), on=['iso3', 'year']).dropna()
    return x[(x['res'] > 0) & (x['y'] > 0)]


def quintiles(y):
    ly = np.log(y)
    edges = np.quantile(ly, [0, .2, .4, .6, .8, 1])
    return np.clip(np.searchsorted(edges, ly, side='right') - 1, 0, 4), [float(np.exp(e)) for e in edges]


def ols(t):
    X = np.column_stack([np.ones(len(t)), t['ly'], t['h']])
    return np.linalg.lstsq(X, t['lr'], rcond=None)[0]


def learning(x):
    """R67 とゲームの係数: ln 研究者 = a + b ln (y ÷ 1.21) + c 学力 ÷ 100 (学力のある国・年)"""
    t = x.merge(series(HLO, 'HD.HCI.HLOS', 'q'), on=['iso3', 'year']).dropna()
    t = t.assign(ly=np.log(t['y'] / TO2011), h=t['q'] / 100, lr=np.log(t['res']))
    beta = ols(t)
    pred = np.column_stack([np.ones(len(t)), t['ly'], t['h']]) @ beta
    r2 = 1 - float(((t['lr'] - pred) ** 2).sum() / ((t['lr'] - t['lr'].mean()) ** 2).sum())
    b0 = np.polyfit(t['ly'], t['lr'], 1)
    rng = np.random.default_rng(20261025)
    cs = t['iso3'].unique()
    bs = [ols(pd.concat([t[t['iso3'] == c] for c in rng.choice(cs, len(cs))])) for _ in range(1000)]
    bs = np.array(bs)
    return {'a': round(float(beta[0]), 4), 'b': round(float(beta[1]), 4), 'c': round(float(beta[2]), 4), 'r2': round(r2, 3),
            'rows': int(len(t)), 'countries': int(len(cs)), 'years': sorted(int(v) for v in t['year'].unique()),
            'c_boot_5_95': [round(float(v), 4) for v in np.quantile(bs[:, 2], [.05, .95])],
            'b_boot_5_95': [round(float(v), 4) for v in np.quantile(bs[:, 1], [.05, .95])],
            'income_only': {'a': round(float(b0[1]), 4), 'b': round(float(b0[0]), 4)},
            'note': 'ln 研究者 [人/100 万人] = a + b ln y + c 学力 ÷ 100。y は 2011 年の国際ドル (2021 年のドル ÷ 1.21)。学力は HCI の試験の点数 (300〜625 点)。'
                    'income_only は学力を入れない同じ国・年の当てはめ'}


def game(path):
    T = {r['id']: r for r in json.load(open(os.path.join(HERE, '..', '..', 'targets', 'targets.json'), encoding='utf-8'))['realism']}
    g = pd.read_csv(path)
    g = g[(g['pop'] >= 1) & (g['researchers'] > 0) & (g['income'] > 0)].copy()
    g['y21'] = g['income'] * TO2011
    res = {}
    out, ok, n = [], 0, 0
    for b in T['R66']['bands']:
        lo, hi = b['income']
        s = g[(g['y21'] >= lo) & (g['y21'] < hi)]['researchers']
        if len(s) < 100:
            out.append({'income': b['income'], 'n': len(s)}); continue
        m = float(s.median()); inside = b['researchers'][0] <= m <= b['researchers'][1]
        n += 1; ok += inside
        out.append({'income': b['income'], 'n': len(s), 'median': round(m, 1), 'band': b['researchers'], 'inside': bool(inside)})
    res['R66'] = {'pass': bool(n >= 3 and ok >= 2 * n / 3), 'compared': n, 'inside': ok, 'bins': out}
    t = g.dropna(subset=['learn'])
    t = t.assign(ly=np.log(t['income']), h=t['learn'] / 100, lr=np.log(t['researchers']))
    c = float(ols(t)[2]) if len(t) >= 100 else None
    band = T['R67']['band']
    res['R67'] = {'pass': c is not None and band[0] <= c <= band[1], 'coef': None if c is None else round(c, 4), 'band': band, 'rows': int(len(t))}
    print(json.dumps(res, ensure_ascii=False))
    print(f"R66 {'合格' if res['R66']['pass'] else '不合格'} (比べられる分位 {n}、幅の中 {ok})")
    print(f"R67 {'合格' if res['R67']['pass'] else '不合格'} (学力の係数 {res['R67']['coef']}、幅 {band[0]}〜{band[1]})")


def main():
    if len(sys.argv) > 2 and sys.argv[1] == '--game':
        return game(sys.argv[2])
    x = panel()
    q, edges = quintiles(x['y'])
    r66 = []
    for i in range(5):
        s = x['res'][q == i]
        r66.append({'income': [round(edges[i]), round(edges[i + 1])], 'researchers': [round(float(np.quantile(s, .25)), 1), round(float(np.quantile(s, .75)), 1)],
                    'median': round(float(np.median(s)), 1), 'n': int(len(s))})
    lr = learning(x)
    out = {
        'source': 'data/raw/research/wdi_research.csv.gz (WDI SP.POP.SCIE.RD.P6)・data/raw/tech/wdi_tech.csv.gz (NY.GDP.PCAP.PP.KD)・'
                  'data/raw/hcap/hci_hlos.csv.gz (HD.HCI.HLOS)。計算は data/build/build_innovation.py',
        'researchers': {'countries': int(x['iso3'].nunique()), 'country_years': int(len(x)), 'years': [int(x['year'].min()), int(x['year'].max())], 'by_income': r66,
                        'note': '所得は 2021 年の国際ドル。研究者は人口 100 万人あたり'},
        'learning': lr,
        'game': {'research': [lr['a'], lr['b'], lr['c']], 'note': 'STRUCTURE.research = [a, b, c]: ln 研究者 [人/100 万人] = a + b ln y + c 学力 ÷ 100 (y は 2011 年の国際ドル)'},
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
