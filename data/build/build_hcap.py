#!/usr/bin/env python3
"""学歴 (就学年数) と所得の様式化された事実を計算する (目標 R62・R63。回 KE5・B-117)。

統計量 (世界銀行 EdStats の Barro–Lee の推計 (data/raw/hcap/edstats_bl.csv.gz) と WDI の NY.GDP.PCAP.PP.KD (data/raw/tech/wdi_tech.csv.gz)。国・年):
  R62: 1 人あたり所得 (2021 年の国際ドル) の 5 分位ごとの、25 歳以上の平均の就学年数の 25%〜75% 点 (R36・R61 と同じ形。1990〜2010 年の 5 年ごと)
  R63: 25 歳以上の平均の就学年数の 10 年の伸び (年あたり) を、初めの就学年数で 6 つに分けた区分ごとの 25%〜75% 点 (1960〜2010 年。重ならない 10 年)
  ゲームの曲線 (src/economy/market-consts.js の SCHOOL): 学校を出たばかりの世代 (25〜29 歳) の就学年数 = top / (1 + exp(−(a + b ln y)))。
      top は 14 年 (国・年の最大 14.7 年に近い切りのよい値)。logit (s ÷ (top − s)) を ln y に当てた最小二乗 (国・年をそのまま)。
      y はゲームの所得の物差し (2011 年の国際ドル) にするため、2021 年のドルを米国の GDP デフレーターの比 1.21 で割ってから当てる (R36・R61 と同じ読み替え)

使い方: python3 data/build/build_hcap.py → data/derived/hcap.json
        python3 data/build/build_hcap.py ゲームのパネル.csv → ゲームの R62・R63
            (列 colony, galaxy, year, t, income (2011 年のドル), school (大人の平均の就学年数)。year はゲームの年で 1 年ごと、
             t は試合の始めからの現実の年数にあたる値 (ゲームの年数 × 28 ÷ 1 世代の年数。R63 の伸びの速さはこれで測る))
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'hcap', 'edstats_bl.csv.gz')
INC = os.path.join(HERE, '..', 'raw', 'tech', 'wdi_tech.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'hcap.json')
TO2011 = 1.21  # 2021 年のドル ÷ 2011 年のドル (米国の GDP デフレーター。R36・R61 と同じ)
TOP = 14.0  # 若い世代の就学年数の曲線の上限 [年]
BINS = [0, 2, 4, 6, 8, 10, 99]  # R63 の初めの就学年数の区分 [年]


def schooling():
    d = pd.read_csv(RAW)
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index()
    return w.rename(columns={'BAR.SCHL.25UP': 's', 'BAR.SCHL.2529': 'young'})


def panel():
    w = schooling()
    inc = pd.read_csv(INC)
    inc = inc[inc['indicator'] == 'NY.GDP.PCAP.PP.KD'][['iso3', 'year', 'value']].rename(columns={'value': 'y'})
    x = w.merge(inc, on=['iso3', 'year']).dropna(subset=['s', 'y'])
    return x[(x['y'] > 0)]


def quintiles(y):
    ly = np.log(y)
    edges = np.quantile(ly, [0, .2, .4, .6, .8, 1])
    return np.clip(np.searchsorted(edges, ly, side='right') - 1, 0, 4), [float(np.exp(e)) for e in edges]


def growth(w, key, col, year):
    """重ならない 10 年 (初めの年が 10 で割り切れる) ごとの、col の伸び (年あたり) と初めの値"""
    rows = []
    for k, d in w.groupby(key):
        v = dict(zip(d[year], d[col]))
        for y0 in sorted(v):
            if y0 % 10 == 0 and y0 + 10 in v and np.isfinite(v[y0]) and np.isfinite(v[y0 + 10]):
                rows.append((v[y0], (v[y0 + 10] - v[y0]) / 10))
    return pd.DataFrame(rows, columns=['s0', 'ds'])


def growth_t(g, key, col, step=10.0):
    """ゲームのパネル: t (現実の年数にあたる値) の 0・step・2 step… の値を補間し、重ならない step 年の伸び (年あたり) と初めの値を返す"""
    rows = []
    for k, d in g.groupby(key):
        t, v = d['t'].to_numpy(), d[col].to_numpy()
        o = np.argsort(t); t, v = t[o], v[o]
        if len(t) < 2:
            continue
        gap = float(np.median(np.diff(t))) * 1.5  # 1 年ごとの書き出しの間隔より広い抜けがあれば使わない
        for t0 in np.arange(np.ceil(t[0] / step) * step, t[-1] - step + 1e-9, step):
            w = (t >= t0 - gap) & (t <= t0 + step + gap)
            if np.any(np.diff(t[w]) > gap):
                continue
            a, b = np.interp([t0, t0 + step], t, v)
            rows.append((a, (b - a) / step))
    return pd.DataFrame(rows, columns=['s0', 'ds'])


def by_bin(g):
    g = g.copy()
    g['bin'] = pd.cut(g['s0'], BINS, right=False, labels=False)
    return g


def game(path):
    T = {r['id']: r for r in json.load(open(os.path.join(HERE, '..', '..', 'targets', 'targets.json'), encoding='utf-8'))['realism']}
    g = pd.read_csv(path)
    g['y21'] = g['income'] * TO2011
    res = {}
    # R62: 5 年ごとの年だけ (実データと同じ間隔。入植地・年)
    s5 = g[g['year'] % 5 == 0]
    out, ok, n = [], 0, 0
    for b in T['R62']['bands']:
        lo, hi = b['income']
        s = s5[(s5['y21'] >= lo) & (s5['y21'] < hi)]['school']
        if len(s) < 100:
            out.append({'income': b['income'], 'n': len(s)}); continue
        m = float(s.median()); inside = b['school'][0] <= m <= b['school'][1]
        n += 1; ok += inside
        out.append({'income': b['income'], 'n': len(s), 'median': round(m, 3), 'band': b['school'], 'inside': bool(inside)})
    res['R62'] = {'pass': bool(n >= 3 and ok >= 2 * n / 3), 'compared': n, 'inside': ok, 'bins': out}
    # R63: 入植地ごとの重ならない 10 年 (現実の年数にあたる t で、試合の始めから 10 年ごと)。t の 0・10・20… の値は前後の年から線形に補間する
    #      (ゲームの 1 年は t で 0.28 年なので、ちょうどの点はない)。10 年のあいだに書き出しの抜け (100 万人を下回った年など) がある組は使わない
    gr = by_bin(growth_t(g, 'colony', 'school'))
    out, ok, n = [], 0, 0
    for i, b in enumerate(T['R63']['bands']):
        s = gr[gr['bin'] == i]['ds']
        if len(s) < 100:
            out.append({'school': b['school'], 'n': len(s)}); continue
        m = float(s.median()); inside = b['growth'][0] <= m <= b['growth'][1]
        n += 1; ok += inside
        out.append({'school': b['school'], 'n': len(s), 'median': round(m, 4), 'band': b['growth'], 'inside': bool(inside)})
    res['R63'] = {'pass': bool(n >= 3 and ok >= 2 * n / 3), 'compared': n, 'inside': ok, 'bins': out}
    print(json.dumps(res, ensure_ascii=False))
    for k in ['R62', 'R63']:
        print(f"{k} {'合格' if res[k]['pass'] else '不合格'} (比べられる区分 {res[k]['compared']}、幅の中 {res[k]['inside']})")


def main():
    if len(sys.argv) > 1:
        return game(sys.argv[1])
    x = panel()
    q, edges = quintiles(x['y'])
    r62 = []
    for i in range(5):
        s = x['s'][q == i]
        r62.append({'income': [round(edges[i]), round(edges[i + 1])], 'school': [round(float(np.quantile(s, .25)), 3), round(float(np.quantile(s, .75)), 3)],
                    'median': round(float(np.median(s)), 3), 'n': int(len(s))})
    gr = by_bin(growth(schooling(), 'iso3', 's', 'year'))
    r63 = []
    for i in range(len(BINS) - 1):
        s = gr[gr['bin'] == i]['ds']
        r63.append({'school': [BINS[i], BINS[i + 1] if BINS[i + 1] < 99 else None], 'growth': [round(float(np.quantile(s, .25)), 4), round(float(np.quantile(s, .75)), 4)],
                    'median': round(float(np.median(s)), 4), 'n': int(len(s))})
    # 若い世代の曲線: logit (s ÷ (TOP − s)) = a + b ln (y ÷ 1.21)
    v = x.dropna(subset=['young'])
    v = v[(v['young'] > 0) & (v['young'] < TOP)]
    X = np.log(v['y'] / TO2011).to_numpy()
    Y = np.log(v['young'] / (TOP - v['young'])).to_numpy()
    b, a = np.polyfit(X, Y, 1)
    pred = TOP / (1 + np.exp(-(a + b * X)))
    r2 = 1 - float(((v['young'] - pred) ** 2).sum() / ((v['young'] - v['young'].mean()) ** 2).sum())
    out = {
        'source': 'data/raw/hcap/edstats_bl.csv.gz (世界銀行 EdStats の Barro–Lee の推計 BAR.SCHL.25UP・BAR.SCHL.2529)・data/raw/tech/wdi_tech.csv.gz (NY.GDP.PCAP.PP.KD)。計算は data/build/build_hcap.py',
        'countries': int(x['iso3'].nunique()), 'country_years': int(len(x)), 'years': [int(x['year'].min()), int(x['year'].max())],
        'by_income': r62,
        'growth_by_level': r63, 'growth_windows': int(len(gr)),
        'note': '所得は 2021 年の国際ドル。就学年数は 25 歳以上の平均 [年]。伸びは 10 年の差 ÷ 10 [年/年]',
        'game': {'young': [round(float(a), 4), round(float(b), 4)], 'top': TOP, 'r2': round(r2, 3), 'rows': int(len(v)),
                 'note': 'young = SCHOOL の曲線。学校を出たばかりの世代 (25〜29 歳) の就学年数 = top / (1 + exp(−(a + b ln y)))、y は 2011 年の国際ドル'},
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
