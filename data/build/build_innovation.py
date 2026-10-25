#!/usr/bin/env python3
"""技術革新 (回 KE6・B-120〜B-123。docs/research/innovation.md) の様式化された事実を計算する。目標 R66・R67 と R68〜R72。

統計量 (国・年):
  R66: 1 人あたり所得 (WDI NY.GDP.PCAP.PP.KD、2021 年の国際ドル) の 5 分位ごとの、研究者の数 (人口 100 万人あたり。WDI SP.POP.SCIE.RD.P6。
       UNESCO 統計研究所) の 25%〜75% 点 (1996〜2024 年。R36・R61・R62 と同じ形)
  R67: ln 研究者 (人口 100 万人あたり) を、ln 所得と、学力 (世界銀行 Human Capital Index の調和された試験の点数 HD.HCI.HLOS ÷ 100) に当てた
       最小二乗の、学力の係数 (所得をそろえたときの学力の効き。2010・2017・2018・2020 年の国・年。国を引き直すブートストラップの 5%〜95% 点も)
  技術水準の国際比較 (Penn World Table 11.0。data/raw/tfp/pwt110.csv.gz)。ゲームの技術の水準 A は働き手 1 人あたりの産出に掛かる (資本は
  採掘の能力だけ) ので、TFP を労働増大的な形 a = ln ctfp ÷ (その国と米国の労働分配率の平均) に直して比べる (ctfp は米国 = 1 の購買力平価の
  水準で、PWT はその国と米国の労働分配率の平均で求めている)。伸びは ln rtfpna の差 ÷ その国のその期間の労働分配率の平均:
  R68: 1 人あたり所得の 5 分位ごとの、技術水準の前線比 exp(a) の 25%〜75% 点 (1990〜2019 年の国・年。R66 と同じ形)
  R69: 規模効果。2015〜2019 年の国ごとの平均の a を、ln 人口と ln 人的資本 (PWT の hc。学歴の指数) に当てた最小二乗の、ln 人口の係数
       (国を引き直すブートストラップの 5%〜95% 点が幅)
  R70: 技術の収束。1995〜2019 年の a の年率の伸びを 1995 年の a に当てた傾き (年あたりの伸び ÷ 対数の差)
  R71: 所得をそろえた技術の伸びと、学力で調整した就学年数 (LAYS。WDI HD.HCI.LAYS の 2010〜2020 年の国ごとの平均)。2000〜2019 年の a の
       年率の伸び [%/年] を LAYS と ln 所得 (2000 年) に当てた、LAYS の係数 [%/年 ÷ 年]
  R72: 発展会計で、学歴 (人的資本) が所得のばらつきに占める割合 cov(ln hc, ln y) ÷ var(ln y) (y は就業者 1 人あたりの実質 GDP rgdpo ÷ emp。
       2015〜2019 年の国ごとの平均)。資本と TFP の割合 (K/Y の形、資本の分配率 1/3) も参考に出す
  ゲームの係数 (目標ではない。src/economy/market-consts.js の STRUCTURE.research): ln 研究者 = a + b ln y + c 学力 ÷ 100 の a・b・c。
       y はゲームの所得の物差し (2011 年の国際ドル) にするため、2021 年のドルを米国の GDP デフレーターの比 1.21 で割ってから当てる (R62 と同じ読み替え)

使い方: python3 data/build/build_innovation.py → data/derived/innovation.json
        python3 data/build/build_innovation.py --game ゲームのパネル.csv → ゲームの R66・R67
            (列 country, galaxy, year, pop (100 万人), income (1 人あたりの実質の所得。2011 年の国際ドル)、researchers (人口 100 万人あたり)、
             learn (大人 (25〜64 歳) の平均の学力。試験の点数の物差し)、lnA (技術の水準の ln)、rel (銀河でいちばん大きい国との ln の差)、
             hk (学歴の倍率)、lays (学力で調整した就学年数)。国・年ごとに 1 行。tools/innovation-panel.js。lnA〜lays のない古いパネルは R66・R67 だけ)
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RES = os.path.join(HERE, '..', 'raw', 'research', 'wdi_research.csv.gz')
INC = os.path.join(HERE, '..', 'raw', 'tech', 'wdi_tech.csv.gz')
HLO = os.path.join(HERE, '..', 'raw', 'hcap', 'hci_hlos.csv.gz')
LAYS = os.path.join(HERE, '..', 'raw', 'hcap', 'hci_lays.csv.gz')
PWT = os.path.join(HERE, '..', 'raw', 'tfp', 'pwt110.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'innovation.json')
SEED = 20261025
LATE = 2401  # ゲームは 2301 年に始まり、始めはどの国も A = 1。100 年たってからの国・年だけを比べる (R68〜R72)
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


def pwt():
    """PWT 11.0 の国・年に、労働増大的な技術の水準 a (米国 = 0) を足す"""
    p = pd.read_csv(PWT).rename(columns={'countrycode': 'iso3'})
    us = p[p['iso3'] == 'USA'].set_index('year')['labsh']
    p = p[(p['ctfp'] > 0) & (p['labsh'] > 0)].copy()
    p['a'] = np.log(p['ctfp']) / ((p['labsh'] + p['year'].map(us)) / 2)
    return p


def boot(t, f, n=1000):
    rng = np.random.default_rng(SEED)
    return np.array([f(t.iloc[rng.integers(0, len(t), len(t))]) for _ in range(n)])


def fit(t, y, xs):
    X = np.column_stack([np.ones(len(t))] + [t[c] for c in xs])
    return np.linalg.lstsq(X, t[y], rcond=None)[0]


def growth(p, y0, y1):
    """y0 年から y1 年の a の年率の伸び (ln rtfpna の差 ÷ 年数 ÷ その期間の労働分配率の平均) と、y0 年の a"""
    s0, s1 = p[p['year'] == y0].set_index('iso3'), p[p['year'] == y1].set_index('iso3')
    ls = p[(p['year'] >= y0) & (p['year'] <= y1)].groupby('iso3')['labsh'].mean()
    j = s0[['a', 'rtfpna']].join(s1[['rtfpna']], rsuffix='1', how='inner').join(ls, how='inner')
    j = j[(j['rtfpna'] > 0) & (j['rtfpna1'] > 0)].dropna()
    return j.assign(g=(np.log(j['rtfpna1']) - np.log(j['rtfpna'])) / (y1 - y0) / j['labsh'])


def technology():
    """R68〜R72 (PWT 11.0・WDI)"""
    p = pwt()
    inc = series(INC, 'NY.GDP.PCAP.PP.KD', 'y')
    out = {}
    # R68
    x = p[(p['year'] >= 1990) & (p['year'] <= 2019)].merge(inc, on=['iso3', 'year']).dropna(subset=['a', 'y'])
    q, edges = quintiles(x['y'])
    r = np.exp(x['a'])
    out['frontier'] = {'countries': int(x['iso3'].nunique()), 'country_years': int(len(x)), 'years': [1990, 2019], 'by_income': [
        {'income': [round(edges[i]), round(edges[i + 1])], 'ratio': [round(float(np.quantile(r[q == i], .25)), 3), round(float(np.quantile(r[q == i], .75)), 3)],
         'median': round(float(np.median(r[q == i])), 3), 'hicks_median': round(float(np.median(x['ctfp'][q == i])), 3), 'n': int((q == i).sum())} for i in range(5)],
        'note': '前線比 = exp(a) = ctfp の (その国と米国の労働分配率の平均) 分の 1 乗 (米国 = 1)。hicks_median は ctfp そのままの中央値。所得は 2021 年の国際ドル'}
    # R69
    w = p[(p['year'] >= 2015) & (p['year'] <= 2019)].groupby('iso3').agg(a=('a', 'mean'), pop=('pop', 'mean'), hc=('hc', 'mean'), yo=('rgdpo', 'mean')).dropna()
    w = w.assign(lp=np.log(w['pop']), lh=np.log(w['hc']), ly=np.log(w['yo'] / w['pop']))
    b = fit(w, 'a', ['lp', 'lh'])
    bs = boot(w, lambda t: fit(t, 'a', ['lp', 'lh'])[1])
    out['scale'] = {'coef': round(float(b[1]), 4), 'boot_5_95': [round(float(v), 4) for v in np.quantile(bs, [.05, .95])], 'countries': int(len(w)),
                    'unconditional': round(float(fit(w, 'a', ['lp'])[1]), 4), 'given_income': round(float(fit(w, 'a', ['lp', 'ly'])[1]), 4),
                    'note': 'a = 2015〜2019 年の平均を ln 人口と ln hc に当てた ln 人口の係数。unconditional は ln 人口だけ、given_income は ln 人口と ln (rgdpo ÷ pop)'}
    # R70
    j = growth(p, 1995, 2019)
    b = np.polyfit(j['a'], j['g'], 1)
    bs = boot(j, lambda t: np.polyfit(t['a'], t['g'], 1)[0])
    out['convergence'] = {'slope': round(float(b[0]), 5), 'r': round(float(np.corrcoef(j['a'], j['g'])[0, 1]), 3), 'boot_5_95': [round(float(v), 5) for v in np.quantile(bs, [.05, .95])],
                          'countries': int(len(j)), 'years': [1995, 2019], 'note': '1995〜2019 年の a の年率の伸び ÷ 1995 年の a の傾き (伸びは割合/年、a は対数)'}
    # R71
    j = growth(p, 2000, 2019).join(series(LAYS, 'HD.HCI.LAYS', 'lays').groupby('iso3')['lays'].mean(), how='inner')
    j = j.join(inc[inc['year'] == 2000].set_index('iso3')['y'], how='inner').dropna()
    j = j.assign(g100=100 * j['g'], ly=np.log(j['y']))
    b = fit(j, 'g100', ['lays', 'ly'])
    bs = boot(j, lambda t: fit(t, 'g100', ['lays', 'ly'])[1])
    out['lays'] = {'coef': round(float(b[1]), 4), 'income_coef': round(float(b[2]), 4), 'boot_5_95': [round(float(v), 4) for v in np.quantile(bs, [.05, .95])], 'countries': int(len(j)),
                   'years': [2000, 2019], 'note': '2000〜2019 年の a の年率の伸び [%/年] を LAYS (2010〜2020 年の平均) と ln 所得 (2000 年、2021 年の国際ドル) に当てた LAYS の係数'}
    # R72
    d = p[(p['year'] >= 2015) & (p['year'] <= 2019) & (p['emp'] > 0) & (p['cn'] > 0) & (p['hc'] > 0)]
    d = d.groupby('iso3').agg(y=('rgdpo', 'mean'), emp=('emp', 'mean'), k=('cn', 'mean'), hc=('hc', 'mean')).dropna()
    al = 1 / 3
    d = d.assign(ly=np.log(d['y'] / d['emp']), lh=np.log(d['hc']), lk=al / (1 - al) * np.log(d['k'] / d['y']))
    share = lambda t, c: float(np.cov(t[c], t['ly'])[0, 1] / t['ly'].var())
    bs = boot(d, lambda t: share(t, 'lh'))
    out['accounting'] = {'human_capital': round(share(d, 'lh'), 4), 'boot_5_95': [round(float(v), 4) for v in np.quantile(bs, [.05, .95])],
                         'capital': round(share(d, 'lk'), 4), 'tfp': round(1 - share(d, 'lh') - share(d, 'lk'), 4), 'countries': int(len(d)),
                         'note': 'cov(ln X, ln y) ÷ var(ln y)。y = rgdpo ÷ emp、資本は (1/3 ÷ 2/3) ln (K/Y)、TFP は残り (2015〜2019 年の平均)'}
    return out


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
    if {'lnA', 'rel', 'hk', 'lays'} <= set(g.columns):
        res.update(game_tech(g, T))
    print(json.dumps(res, ensure_ascii=False))
    print(f"R66 {'合格' if res['R66']['pass'] else '不合格'} (比べられる分位 {n}、幅の中 {ok})")
    print(f"R67 {'合格' if res['R67']['pass'] else '不合格'} (学力の係数 {res['R67']['coef']}、幅 {band[0]}〜{band[1]})")
    for k in ('R68', 'R69', 'R70', 'R71', 'R72'):
        if k in res:
            print(f"{k} {'合格' if res[k]['pass'] else '不合格'} ({', '.join(f'{a} {b}' for a, b in res[k].items() if a not in ('pass', 'bins'))})")


def windows(g, n):
    """2401 年からの n 年の窓 (重ならない) ごとの、国の初めと終わりの行"""
    if g.empty:
        return pd.DataFrame()
    last = int(g['year'].max())
    out = []
    for t0 in range(LATE, last - n + 1, n):
        a = g[g['year'] == t0].set_index('country')
        b = g[g['year'] == t0 + n].set_index('country')
        mid = g[(g['year'] >= t0) & (g['year'] <= t0 + n)].groupby('country')['lays'].mean()
        j = a.join(b[['lnA']], rsuffix='1', how='inner').join(mid.rename('lays_w'), how='inner')
        out.append(j.assign(g=(j['lnA1'] - j['lnA']) / n))
    return pd.concat(out) if out else pd.DataFrame()


def game_tech(g, T):
    """R68〜R72 のゲームの値 (2401 年以後の国・年)"""
    g = g[g['year'] >= LATE].dropna(subset=['lnA', 'rel', 'hk']).copy()
    g['y21'] = g['income'] * TO2011
    res = {}
    out, ok, n = [], 0, 0
    for b in T['R68']['bands']:
        lo, hi = b['income']
        s = np.exp(g[(g['y21'] >= lo) & (g['y21'] < hi)]['rel'])
        if len(s) < 100:
            out.append({'income': b['income'], 'n': len(s)}); continue
        m = float(s.median()); inside = b['ratio'][0] <= m <= b['ratio'][1]
        n += 1; ok += inside
        out.append({'income': b['income'], 'n': len(s), 'median': round(m, 3), 'band': b['ratio'], 'inside': bool(inside)})
    res['R68'] = {'pass': bool(n >= 3 and ok >= 2 * n / 3), 'compared': n, 'inside': ok, 'bins': out}
    last = g['year'].max()
    w = g[g['year'] > last - 5].groupby('country').agg(rel=('rel', 'mean'), pop=('pop', 'mean'), hk=('hk', 'mean'), income=('income', 'mean'))
    w = w.assign(lp=np.log(w['pop']), lh=np.log(w['hk']), ly=np.log(w['income']))
    def one(k, v, rows):
        band = T[k]['band']
        res[k] = {'pass': bool(v is not None and rows >= 100 and band[0] <= v <= band[1]), 'value': None if v is None else round(v, 5), 'band': band, 'rows': int(rows)}
    one('R69', float(fit(w, 'rel', ['lp', 'lh'])[1]) if len(w) >= 10 else None, len(w))
    j = windows(g, 24)
    one('R70', float(np.polyfit(j['rel'], j['g'], 1)[0]) if len(j) >= 10 else None, len(j))
    j = windows(g.dropna(subset=['lays']), 19)
    if len(j):
        j = j.dropna(subset=['lays_w']).assign(g100=lambda t: 100 * t['g'], ly=lambda t: np.log(t['income'] * TO2011))
    one('R71', float(fit(j, 'g100', ['lays_w', 'ly'])[1]) if len(j) >= 10 else None, len(j))
    one('R72', float(np.cov(w['lh'], w['ly'])[0, 1] / w['ly'].var()) if len(w) >= 10 else None, len(w))
    return res


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
                  'data/raw/hcap/hci_hlos.csv.gz (HD.HCI.HLOS)・data/raw/hcap/hci_lays.csv.gz (HD.HCI.LAYS)・data/raw/tfp/pwt110.csv.gz (Penn World Table 11.0)。'
                  '計算は data/build/build_innovation.py',
        'researchers': {'countries': int(x['iso3'].nunique()), 'country_years': int(len(x)), 'years': [int(x['year'].min()), int(x['year'].max())], 'by_income': r66,
                        'note': '所得は 2021 年の国際ドル。研究者は人口 100 万人あたり'},
        'learning': lr,
        'technology': technology(),
        'game': {'research': [lr['a'], lr['b'], lr['c']], 'note': 'STRUCTURE.research = [a, b, c]: ln 研究者 [人/100 万人] = a + b ln y + c 学力 ÷ 100 (y は 2011 年の国際ドル)'},
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
