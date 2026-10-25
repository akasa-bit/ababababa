#!/usr/bin/env python3
"""学歴 (就学年数)・学力と所得の様式化された事実を計算する (目標 R62・R63・R64。回 KE5・B-117)。

統計量 (世界銀行 EdStats の Barro–Lee の推計 (data/raw/hcap/edstats_bl.csv.gz) と WDI の NY.GDP.PCAP.PP.KD (data/raw/tech/wdi_tech.csv.gz)。国・年):
  R62: 1 人あたり所得 (2021 年の国際ドル) の 5 分位ごとの、25 歳以上の平均の就学年数の 25%〜75% 点 (R36・R61 と同じ形。1990〜2010 年の 5 年ごと)
  R63: 25 歳以上の平均の就学年数の 10 年の伸び (年あたり) を、初めの就学年数で 6 つに分けた区分ごとの 25%〜75% 点 (1960〜2010 年。重ならない 10 年)
  R64: 1 人あたり所得の 5 分位ごとの、調和された試験の点数 (世界銀行 Human Capital Index の HD.HCI.HLOS。data/raw/hcap/hci_hlos.csv.gz) の
       25%〜75% 点 (2010・2017・2018・2020 年。R62 と同じ形)
  ゲームの曲線 (src/economy/market-consts.js の SCHOOL): 学校を出たばかりの世代 (25〜29 歳) の就学年数 = top / (1 + exp(−(a + b ln y)))。
      top は 14 年 (国・年の最大 14.7 年に近い切りのよい値)。logit (s ÷ (top − s)) を ln y に当てた最小二乗 (国・年をそのまま)。
      y はゲームの所得の物差し (2011 年の国際ドル) にするため、2021 年のドルを米国の GDP デフレーターの比 1.21 で割ってから当てる (R36・R61 と同じ読み替え)
  ゲームの係数 (回 KE5・B-117。目標ではない):
    spend: 教育の支出 ÷ GDP [%] の効き方。25〜29 歳の就学年数の logit を ln y と、その世代が学校にいたころ (5〜20 年前) の教育の支出の平均に当てた傾き
           (国・年。国を引き直すブートストラップの 5%〜95% 点も)。予算の「教育」は、この傾きで若い世代の曲線をずらす
    stock: 25 歳以上の平均の就学年数の、同じ形の曲線 (参考)
    learn: 学力の曲線。学校を出る世代の点数 = lo + (hi − lo) / (1 + exp(−(a + b ln y + c × 教育の支出 [% GDP])))。lo 300・hi 625 は試験の点数の
           物差しの下と上 (HCI の「最低」と「上級」の基準)。(点数 − lo) ÷ (hi − 点数) の logit を ln y と、その年の前の 10 年の教育の支出の平均に当てた
           最小二乗 (国・年。支出は 3 年以上あるものだけ。国を引き直すブートストラップの 5%〜95% 点も)。支出なしの当てはめ (a0, b0) も出す
    cohort: 始めからある入植地の年齢ごとの就学年数の形。年齢 a の区分の就学年数 = 若い世代の曲線 (y × exp(−cohort × (a − 27)))、
            つまり年上の世代ほど、学校を出たころの所得が年 cohort ずつ低かったとみる。EdStats の 5 歳ごとの区分 (25〜29 歳 … 75 歳〜) に、
            二乗の誤差がいちばん小さくなる値を 0.0025 きざみで探す

使い方: python3 data/build/build_hcap.py → data/derived/hcap.json
        python3 data/build/build_hcap.py ゲームのパネル.csv → ゲームの R62・R63・R64
            (列 colony, galaxy, year, t, income (2011 年のドル), school (大人の平均の就学年数)、learn (その年に学校を出た世代の学力。試験の点数の物差し。
             ない版は R64 を比べない)。year はゲームの年で 1 年ごと、t は試合の始めからの現実の年数にあたる値 (ゲームの年数 × 28 ÷ 1 世代の年数。
             R63 の伸びの速さはこれで測る))
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'hcap', 'edstats_bl.csv.gz')
SPEND = os.path.join(HERE, '..', 'raw', 'hcap', 'edstats_spend.csv.gz')
AGE = os.path.join(HERE, '..', 'raw', 'hcap', 'edstats_age.csv.gz')
LEARN = os.path.join(HERE, '..', 'raw', 'hcap', 'hci_hlos.csv.gz')
INC = os.path.join(HERE, '..', 'raw', 'tech', 'wdi_tech.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'hcap.json')
TO2011 = 1.21  # 2021 年のドル ÷ 2011 年のドル (米国の GDP デフレーター。R36・R61 と同じ)
TOP = 14.0  # 若い世代の就学年数の曲線の上限 [年]
BINS = [0, 2, 4, 6, 8, 10, 99]  # R63 の初めの就学年数の区分 [年]
SCORE = (300.0, 625.0)  # 試験の点数の物差しの下と上 (HCI の「最低」と「上級」の基準。学力の曲線の lo・hi)


def schooling():
    d = pd.read_csv(RAW)
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index()
    return w.rename(columns={'BAR.SCHL.25UP': 's', 'BAR.SCHL.2529': 'young'})


def income():
    inc = pd.read_csv(INC)
    return inc[inc['indicator'] == 'NY.GDP.PCAP.PP.KD'][['iso3', 'year', 'value']].rename(columns={'value': 'y'})


def panel():
    x = schooling().merge(income(), on=['iso3', 'year']).dropna(subset=['s', 'y'])
    return x[(x['y'] > 0)]


def spending(v):
    """25〜29 歳の就学年数の logit を、ln y と、5〜20 年前の教育の支出 ÷ GDP [%] の平均に当てる。傾き (支出) と、国を引き直すブートストラップの 5%〜95% 点"""
    d = pd.read_csv(SPEND)
    d = d[d['indicator'] == 'SE.XPD.TOTL.GD.ZS']
    rows = []
    for _, r in v.iterrows():
        s = d[(d['iso3'] == r['iso3']) & (d['year'] >= r['year'] - 20) & (d['year'] <= r['year'] - 5)]['value']
        if len(s) >= 3:
            rows.append((r['iso3'], float(np.log(r['y'] / TO2011)), float(s.mean()), float(np.log(r['young'] / (TOP - r['young'])))))
    t = pd.DataFrame(rows, columns=['iso3', 'ly', 'sp', 'lg'])
    fit = lambda q: np.linalg.lstsq(np.column_stack([np.ones(len(q)), q['ly'], q['sp']]), q['lg'], rcond=None)[0]
    beta = fit(t)
    rng = np.random.default_rng(1)
    cs = t['iso3'].unique()
    bs = [fit(pd.concat([t[t['iso3'] == c] for c in rng.choice(cs, len(cs))]))[2] for _ in range(400)]
    return {'coef': round(float(beta[2]), 4), 'boot_5_95': [round(float(x), 4) for x in np.quantile(bs, [.05, .95])], 'rows': int(len(t)), 'countries': int(len(cs)),
            'median_spend': round(float(t['sp'].median()), 2), 'note': '教育の支出 ÷ GDP [%] 1 点あたりの、25〜29 歳の就学年数の logit のずれ (ln y と一緒に当てた最小二乗)'}


def learning():
    """試験の点数 × 所得 (国・年)"""
    d = pd.read_csv(LEARN)
    d = d[d['indicator'] == 'HD.HCI.HLOS'][['iso3', 'year', 'value']].rename(columns={'value': 'q'})
    x = d.merge(income(), on=['iso3', 'year']).dropna()
    return x[x['y'] > 0]


def learn_curve(x):
    """学力の曲線 (learn): logit ((q − lo) ÷ (hi − q)) = a + b ln (y ÷ 1.21) [+ c × 前の 10 年の教育の支出の平均]"""
    lo, hi = SCORE
    x = x[(x['q'] > lo) & (x['q'] < hi)].copy()
    x['ly'] = np.log(x['y'] / TO2011)
    x['lg'] = np.log((x['q'] - lo) / (hi - x['q']))
    b0, a0 = np.polyfit(x['ly'], x['lg'], 1)
    pred = lo + (hi - lo) / (1 + np.exp(-(a0 + b0 * x['ly'])))
    r2 = 1 - float(((x['q'] - pred) ** 2).sum() / ((x['q'] - x['q'].mean()) ** 2).sum())
    d = pd.read_csv(SPEND)
    d = d[d['indicator'] == 'SE.XPD.TOTL.GD.ZS']
    sp = []
    for _, r in x.iterrows():
        s = d[(d['iso3'] == r['iso3']) & (d['year'] >= r['year'] - 10) & (d['year'] <= r['year'] - 1)]['value']
        sp.append(float(s.mean()) if len(s) >= 3 else np.nan)
    t = x.assign(sp=sp).dropna(subset=['sp'])
    fit = lambda q: np.linalg.lstsq(np.column_stack([np.ones(len(q)), q['ly'], q['sp']]), q['lg'], rcond=None)[0]
    beta = fit(t)
    rng = np.random.default_rng(1)
    cs = t['iso3'].unique()
    bs = [fit(pd.concat([t[t['iso3'] == c] for c in rng.choice(cs, len(cs))]))[2] for _ in range(400)]
    return {'lo': lo, 'hi': hi, 'a0': round(float(a0), 4), 'b0': round(float(b0), 4), 'r2': round(r2, 3), 'rows': int(len(x)),
            'a': round(float(beta[0]), 4), 'b': round(float(beta[1]), 4), 'spend': round(float(beta[2]), 4),
            'spend_boot_5_95': [round(float(v), 4) for v in np.quantile(bs, [.05, .95])], 'spend_rows': int(len(t)), 'spend_countries': int(len(cs)),
            'median_spend': round(float(t['sp'].median()), 2),
            'note': '学校を出る世代の点数 = lo + (hi − lo) / (1 + exp(−(a + b ln y + spend × 教育の支出 [% GDP])))、y は 2011 年の国際ドル。'
                    'a0・b0 は支出なしの当てはめ (r2 はこちら)。支出は点数の年の前の 10 年の平均'}


def cohort(a, b):
    """始めの年齢ごとの就学年数の形 (cohort)。a, b = 若い世代の曲線"""
    d = pd.read_csv(AGE)
    d['age'] = d['indicator'].str.extract(r'BAR\.SCHL\.(\d\d)')[0].astype(int) + 2
    d.loc[d['indicator'] == 'BAR.SCHL.75UP', 'age'] = 80
    d = d.merge(income(), on=['iso3', 'year']).dropna()
    err = lambda g: float(((d['value'] - TOP / (1 + np.exp(-(a + b * (np.log(d['y'] / TO2011) - g * (d['age'] - 27)))))) ** 2).mean())
    gs = np.arange(0, 0.0601, 0.0025)
    g = float(gs[int(np.argmin([err(x) for x in gs]))])
    return {'value': round(g, 4), 'rows': int(len(d)), 'rmse': round(err(g) ** 0.5, 3), 'note': '年齢 a の区分の就学年数 = 若い世代の曲線 (y × exp(−value × (a − 27)))'}


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
    # R64: R62 と同じ 5 年ごとの入植地・年の、その年に学校を出た世代の学力
    if 'learn' in s5:
        out, ok, n = [], 0, 0
        for b in T['R64']['bands']:
            lo, hi = b['income']
            s = s5[(s5['y21'] >= lo) & (s5['y21'] < hi)]['learn'].dropna()
            if len(s) < 100:
                out.append({'income': b['income'], 'n': len(s)}); continue
            m = float(s.median()); inside = b['score'][0] <= m <= b['score'][1]
            n += 1; ok += inside
            out.append({'income': b['income'], 'n': len(s), 'median': round(m, 1), 'band': b['score'], 'inside': bool(inside)})
        res['R64'] = {'pass': bool(n >= 3 and ok >= 2 * n / 3), 'compared': n, 'inside': ok, 'bins': out}
    print(json.dumps(res, ensure_ascii=False))
    for k in [k for k in ['R62', 'R63', 'R64'] if k in res]:
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
    # 25 歳以上の曲線 (始めの入植地の就学年数)
    u = x[(x['s'] > 0) & (x['s'] < TOP)]
    bs_, as_ = np.polyfit(np.log(u['y'] / TO2011), np.log(u['s'] / (TOP - u['s'])), 1)
    sp = spending(v)
    lx = learning()
    lq, ledges = quintiles(lx['y'])
    r64 = []
    for i in range(5):
        s = lx['q'][lq == i]
        r64.append({'income': [round(ledges[i]), round(ledges[i + 1])], 'score': [round(float(np.quantile(s, .25)), 1), round(float(np.quantile(s, .75)), 1)],
                    'median': round(float(np.median(s)), 1), 'n': int(len(s))})
    out = {
        'source': 'data/raw/hcap/edstats_bl.csv.gz (世界銀行 EdStats の Barro–Lee の推計 BAR.SCHL.25UP・BAR.SCHL.2529)・data/raw/tech/wdi_tech.csv.gz (NY.GDP.PCAP.PP.KD)。計算は data/build/build_hcap.py',
        'countries': int(x['iso3'].nunique()), 'country_years': int(len(x)), 'years': [int(x['year'].min()), int(x['year'].max())],
        'by_income': r62,
        'growth_by_level': r63, 'growth_windows': int(len(gr)),
        'learning': {'source': 'data/raw/hcap/hci_hlos.csv.gz (世界銀行 Human Capital Index の HD.HCI.HLOS)', 'countries': int(lx['iso3'].nunique()),
                     'country_years': int(len(lx)), 'years': sorted(int(v) for v in lx['year'].unique()), 'by_income': r64},
        'note': '所得は 2021 年の国際ドル。就学年数は 25 歳以上の平均 [年]。伸びは 10 年の差 ÷ 10 [年/年]。学力は調和された試験の点数 (300〜625 点)',
        'game': {'young': [round(float(a), 4), round(float(b), 4)], 'top': TOP, 'r2': round(r2, 3), 'rows': int(len(v)),
                 'stock': [round(float(as_), 4), round(float(bs_), 4)], 'spend': sp, 'cohort': cohort(a, b), 'learn': learn_curve(lx),
                 'note': 'young = SCHOOL の曲線。学校を出たばかりの世代 (25〜29 歳) の就学年数 = top / (1 + exp(−(a + b ln y)))、y は 2011 年の国際ドル。'
                         'stock = 25 歳以上の平均の同じ形の曲線。spend = 教育の支出 ÷ GDP [%] 1 点あたりの logit のずれ (ln y と一緒に当てた傾き)'},
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
