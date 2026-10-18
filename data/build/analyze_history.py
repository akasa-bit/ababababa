#!/usr/bin/env python3
"""歴史の生データ (data/raw/history/) から、目標 R08・R09・R13・R14・R16 の統計量を計算する。

- R08・R09 植民地の存続: COLDAT の植民地ごとの期間。本国の首都からの距離 (大円距離) を ICOW の国の位置で出し、
  存続年数の中央値と、Cox 比例ハザードモデル (Breslow) の距離のハザード比を求める。独立が暴力を伴った割合は ICOW から
- R13 国家間戦争の長さ: COW 4.0。戦争ごとに最初の開始日から最後の終了日まで。平均 ÷ 中央値
- R14 紛争の終わり方: UCDP Conflict Termination 4-2024 (紛争のエピソード単位)
- R16 戦闘: CDB90。攻撃側の勝ちを兵力比の対数でロジスティック回帰した傾きと、損害の比を兵力比で回帰した傾き (ランチェスター則の指数)
書き出し: data/derived/history.json

使い方: python3 data/build/analyze_history.py
"""
import csv, datetime, json, math, os, statistics, sys
import numpy as np

RAW = os.path.join(os.path.dirname(__file__), '..', 'raw', 'history')
OUT = os.path.join(os.path.dirname(__file__), '..', 'derived', 'history.json')

def rows(name, enc='utf-8-sig'):
    with open(os.path.join(RAW, name), encoding=enc, newline='') as f:
        return list(csv.DictReader(f))

def num(x):
    try:
        v = float(x)
        return None if math.isnan(v) else v
    except (TypeError, ValueError):
        return None

def pnorm(z):
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))

def cox(t, d, X, iters=50):
    """Cox 比例ハザードモデル (同時刻は Breslow の近似)。係数・標準誤差を返す"""
    t, d, X = np.asarray(t, float), np.asarray(d, float), np.asarray(X, float)
    n, p = X.shape
    b = np.zeros(p)
    for _ in range(iters):
        eta = X @ b
        w = np.exp(eta - eta.max())
        g = np.zeros(p); H = np.zeros((p, p))
        for i in range(n):
            if not d[i]:
                continue
            r = t >= t[i]
            wr = w[r]; s0 = wr.sum(); s1 = (wr[:, None] * X[r]).sum(0); s2 = (wr[:, None, None] * X[r][:, :, None] * X[r][:, None, :]).sum(0)
            g += X[i] - s1 / s0
            H -= s2 / s0 - np.outer(s1, s1) / s0 ** 2
        step = np.linalg.solve(H, g)
        b -= step
        if np.abs(step).max() < 1e-10:
            break
    se = np.sqrt(np.diag(np.linalg.inv(-H)))
    return b, se

def logit(y, X, iters=100):
    y, X = np.asarray(y, float), np.asarray(X, float)
    b = np.zeros(X.shape[1])
    for _ in range(iters):
        p = 1 / (1 + np.exp(-(X @ b)))
        W = p * (1 - p)
        H = X.T @ (W[:, None] * X)
        step = np.linalg.solve(H, X.T @ (y - p))
        b += step
        if np.abs(step).max() < 1e-10:
            break
    return b, np.sqrt(np.diag(np.linalg.inv(H)))

def ols(y, X):
    y, X = np.asarray(y, float), np.asarray(X, float)
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    r = y - X @ b
    s2 = r @ r / (len(y) - X.shape[1])
    return b, np.sqrt(np.diag(s2 * np.linalg.inv(X.T @ X)))

def coef(b, se, k, name, exp=False):
    lo, hi = b[k] - 1.96 * se[k], b[k] + 1.96 * se[k]
    o = {'name': name, 'coef': round(float(b[k]), 4), 'se': round(float(se[k]), 4), 'ci95': [round(float(lo), 4), round(float(hi), 4)], 'p': round(2 * (1 - pnorm(abs(b[k] / se[k]))), 4)}
    if exp:
        o['hr'] = round(math.exp(b[k]), 4); o['hr_ci95'] = [round(math.exp(lo), 4), round(math.exp(hi), 4)]
    return o

# 本国の首都 (緯度・経度)
CAPITALS = {'britain': (51.507, -0.128), 'france': (48.857, 2.352), 'spain': (40.417, -3.704), 'portugal': (38.722, -9.139),
            'netherlands': (52.370, 4.895), 'belgium': (50.850, 4.352), 'germany': (52.520, 13.405), 'italy': (41.903, 12.496)}
# COLDAT の国名 → 位置の表の国名
NAME_FIX = {'Antigua & Barbuda': 'Antigua and Barbuda', 'Congo - Brazzaville': 'Congo [Republic]', 'Congo - Kinshasa': 'Congo [DRC]',
            'Côte d’Ivoire': "Côte d'Ivoire", 'Eswatini': 'Swaziland', 'Micronesia (Federated States of)': 'Micronesia', 'Myanmar (Burma)': 'Myanmar [Burma]',
            'St. Kitts & Nevis': 'Saint Kitts and Nevis', 'St. Lucia': 'Saint Lucia', 'St. Vincent & Grenadines': 'Saint Vincent and the Grenadines',
            'São Tomé & Príncipe': 'São Tomé and Príncipe', 'Trinidad & Tobago': 'Trinidad and Tobago'}
SAIL_KM_DAY = 150  # 帆船の 1 日あたりの航海距離の目安 (Kaukiainen 2001 の 19 世紀前半の郵便船の速さ程度)
ROUTE = 1.3        # 大円距離に対する航路の長さの比 (目安)
GENERATION = 28    # 人の世代の長さ [年]

def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))

def colonies():
    pos = {r['name']: (float(r['latitude']), float(r['longitude'])) for r in rows('countries.csv') if r['latitude']}
    out = []
    for r in rows('coldat_dyads.csv'):
        if r['col'] != '1':
            continue
        s, e = num(r['colstart_mean']), num(r['colend_mean'])
        name = NAME_FIX.get(r['country'], r['country'])
        if s is None or e is None or name not in pos:
            continue
        dist = km(CAPITALS[r['colonizer']], pos[name])
        delay = ROUTE * dist / SAIL_KM_DAY / 365.25  # 片道の知らせの年数 (帆船の時代の目安)
        out.append({'country': r['country'], 'colonizer': r['colonizer'], 'start': s, 'end': e, 'dur': e - s, 'km': round(dist), 'delay': delay})
    return out

def colony_stats(cs, ICOW):
    res = {'n': len(cs), 'note': 'COLDAT の期間 (平均の版)。いまの独立国だけが載るので、どの植民地も独立で終わっている (打ち切りなし)'}
    groups = {'britain_france': ['britain', 'france'], 'spain_portugal_netherlands': ['spain', 'portugal', 'netherlands'], 'all': list(CAPITALS)}
    for g, members in groups.items():
        d = [c['dur'] for c in cs if c['colonizer'] in members]
        q = np.percentile(d, [25, 50, 75])
        res[g] = {'n': len(d), 'median_years': round(float(q[1]), 1), 'iqr': [round(float(q[0]), 1), round(float(q[2]), 1)], 'mean_years': round(statistics.mean(d), 1)}
    for c in sorted(CAPITALS):
        d = [x['dur'] for x in cs if x['colonizer'] == c]
        if d:
            res.setdefault('by_colonizer', {})[c] = {'n': len(d), 'median_years': round(statistics.median(d), 1)}
    # 距離 (通信の遅れ ÷ 1 世代) とハザード: 英仏で推定 (R08)
    bf = [c for c in cs if c['colonizer'] in groups['britain_france']]
    t = [c['dur'] for c in bf]; dd = [1] * len(bf)
    lr = [math.log(c['delay'] / GENERATION) for c in bf]
    st = [(c['start'] - 1800) / 100 for c in bf]
    b, se = cox(t, dd, np.column_stack([lr]))
    m1 = coef(b, se, 0, 'log(通信の遅れ ÷ 1 世代)', True)
    b2, se2 = cox(t, dd, np.column_stack([lr, st]))
    m2 = [coef(b2, se2, 0, 'log(通信の遅れ ÷ 1 世代)', True), coef(b2, se2, 1, '植民の始まりの年 (100 年あたり)', True)]
    # 統治の仕方の代わりに本国を使う: イギリス = 間接統治、フランス = 直接統治 (Lange 2009、Crowder 1964 の古典的な区分)
    fr = [1 if c['colonizer'] == 'france' else 0 for c in bf]
    b3, se3 = cox(t, dd, np.column_stack([fr, lr, st]))
    m3 = [coef(b3, se3, 0, 'フランス (直接統治) ÷ イギリス (間接統治)', True), coef(b3, se3, 1, 'log(通信の遅れ ÷ 1 世代)', True), coef(b3, se3, 2, '植民の始まりの年 (100 年あたり)', True)]
    ratio = [c['delay'] / GENERATION for c in bf]
    res['hazard_britain_france'] = {
        'model1': m1, 'model2': m2, 'model3_direct_vs_indirect': m3,
        'delay_over_generation': {'median': round(statistics.median(ratio), 5), 'min': round(min(ratio), 5), 'max': round(max(ratio), 5)},
        'assumptions': {'sail_km_per_day': SAIL_KM_DAY, 'route_factor': ROUTE, 'generation_years': GENERATION},
        'note': 'ハザード比は「通信の遅れ ÷ 1 世代」が e 倍になったときの独立の起きやすさの倍率 (べき乗則の指数 = 係数)',
    }
    # 独立が暴力を伴った割合 (ICOW。IndType 2 = 植民地からの独立、3 = 国からの分離)
    dec = [r for r in ICOW if r['IndType'] == '2']
    sec = [r for r in ICOW if r['IndType'] == '3']
    viol = lambda xs: round(sum(1 for r in xs if r['IndViol'] == '1') / len(xs), 3)
    res['violent_share'] = {'decolonization': {'n': len(dec), 'share': viol(dec)}, 'secession': {'n': len(sec), 'share': viol(sec)}}
    by = {}
    for code, name in [('200', 'britain'), ('220', 'france'), ('230', 'spain'), ('235', 'portugal'), ('210', 'netherlands')]:
        xs = [r for r in dec if r['IndFrom'] == code]
        if xs:
            by[name] = {'n': len(xs), 'share': viol(xs)}
    res['violent_share']['decolonization_by_ruler'] = by
    return res

def powerlaw(xs, boots=500, seed=1):
    """べき乗則の裾の当てはめ (Clauset・Shalizi・Newman 2009、連続の近似)。xmin は KS 距離が最小になるもの。p 値は半パラメトリックなブートストラップ"""
    x = np.sort(np.asarray([v for v in xs if v > 0], float))
    def fit(x):
        best = None
        for xm in np.unique(x)[:-10]:
            t = x[x >= xm]
            a = 1 + len(t) / np.log(t / xm).sum()
            cdf = 1 - (t / xm) ** (1 - a)
            emp = np.arange(1, len(t) + 1) / len(t)
            ks = np.abs(emp - cdf).max()
            if best is None or ks < best[2]:
                best = (xm, a, ks, len(t))
        return best
    xm, a, ks, nt = fit(x)
    rng = np.random.default_rng(seed)
    below = x[x < xm]
    hits = 0
    for _ in range(boots):
        n_tail = rng.binomial(len(x), nt / len(x))
        tail = xm * (1 - rng.random(n_tail)) ** (-1 / (a - 1))
        body = rng.choice(below, len(x) - n_tail) if len(below) else np.empty(0)
        f = fit(np.concatenate([body, tail]))
        if f and f[2] >= ks:
            hits += 1
    return {'alpha': round(float(a), 3), 'alpha_se': round(float((a - 1) / math.sqrt(nt)), 3), 'xmin': float(xm), 'n_tail': int(nt), 'ks': round(float(ks), 4), 'p': round(hits / boots, 3), 'boots': boots}

def date(y, m, d):
    y, m, d = int(y), int(m), int(d)
    if y <= 0:
        return None
    return datetime.date(y, m if m > 0 else 6, d if d > 0 else 15)

def wars():
    by = {}
    for r in rows('cow_interstate_v4.csv', enc='latin-1'):
        s = date(r['StartYear1'], r['StartMonth1'], r['StartDay1'])
        e = date(r['EndYear1'], r['EndMonth1'], r['EndDay1'])
        e2 = date(r['EndYear2'], r['EndMonth2'], r['EndDay2'])
        w = by.setdefault(r['WarNum'], {'name': r['WarName'], 'start': s, 'end': e, 'deaths': 0})
        if s and (w['start'] is None or s < w['start']):
            w['start'] = s
        for x in (e, e2):
            if x and (w['end'] is None or x > w['end']):
                w['end'] = x
        bd = num(r['BatDeath'])
        if bd and bd > 0:
            w['deaths'] += bd
    dur = [((w['end'] - w['start']).days + 1) / 365.25 for w in by.values() if w['start'] and w['end']]
    mean, med = statistics.mean(dur), statistics.median(dur)
    return {'n': len(dur), 'mean_years': round(mean, 3), 'median_years': round(med, 3), 'mean_over_median': round(mean / med, 3),
            'share_under_1y': round(sum(1 for x in dur if x < 1) / len(dur), 3), 'deaths': sorted(int(w['deaths']) for w in by.values())}

def termination():
    eps = {}
    for r in rows('ucdp_termination_conflict.csv'):
        if r['c_epterm'] != '1':
            continue
        eps[(r['conflict_id'], r['c_epid'])] = r
    labels = {'1': 'peace_agreement', '2': 'ceasefire', '3': 'victory_side_a', '4': 'victory_side_b', '5': 'low_activity', '6': 'actor_ceased'}
    def shares(xs):
        n = len(xs)
        c = {}
        for r in xs:
            c[labels.get(r['c_outcome'], r['c_outcome'])] = c.get(labels.get(r['c_outcome'], r['c_outcome']), 0) + 1
        sh = {k: round(v / n, 3) for k, v in sorted(c.items(), key=lambda kv: -kv[1])}
        sh['victory'] = round(sh.get('victory_side_a', 0) + sh.get('victory_side_b', 0), 3)
        return {'n': n, 'shares': sh}
    inter = [r for r in eps.values() if r['type_of_conflict'] == '2']
    return {'all': shares(list(eps.values())), 'interstate': shares(inter),
            'codes': labels, 'note': 'UCDP の終わり方の区分 (codebook v4-2024)。type_of_conflict 2 = 国家間'}

def battles():
    bel = {}
    for r in rows('cdb90_belligerents.csv'):
        bel.setdefault(r['isqno'], {})['a' if r['attacker'] == '1' else 'd'] = r
    y, x, cr, fr = [], [], [], []
    for r in rows('cdb90_battles.csv'):
        b = bel.get(r['isqno'], {})
        if 'a' not in b or 'd' not in b:
            continue
        sa, sd = num(b['a']['str']), num(b['d']['str'])
        if not sa or not sd or sa <= 0 or sd <= 0:
            continue
        # wina: 1 = 攻撃側の勝ち、0 = 引き分け。元の CDB90 の −1 (防御側の勝ち) は、この版の CSV では空欄になっている
        # (損害の比で確かめた: 空欄の戦闘は攻撃側の損害の割合の中央値 12% で防御側 8% より多い。1 の戦闘は 5% と 18%)
        w = -1 if r['wina'].strip() == '' else num(r['wina'])
        if w in (1, -1):
            y.append(1 if w == 1 else 0); x.append(math.log(sa / sd))
        ca, cd = num(b['a']['cas']), num(b['d']['cas'])
        if ca and cd and ca > 0 and cd > 0:
            cr.append(math.log(ca / cd)); fr.append(math.log(sa / sd))
    b, se = logit(y, np.column_stack([np.ones(len(x)), x]))
    b2, se2 = ols(cr, np.column_stack([np.ones(len(fr)), fr]))
    slope = coef(b2, se2, 1, 'log(損害の比) を log(兵力の比) で回帰した傾き')
    return {'win_logit': {'n': len(y), 'intercept': coef(b, se, 0, '切片'), 'slope': coef(b, se, 1, 'log(攻撃側 ÷ 防御側の兵力)')},
            'casualty_ratio': {'n': len(cr), 'slope': slope,
                               'lanchester_exponent': {'value': round(-float(b2[1]), 3), 'ci95': [round(-slope['ci95'][1], 3), round(-slope['ci95'][0], 3)],
                                                       'note': '損害の比 ∝ (敵 ÷ 味方)^(p−q)。二乗則なら 1、一乗則なら 0'}}}

def main():
    ICOW = rows('icow_colhist.csv')
    out = {'generated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), 'colonies': colony_stats(colonies(), ICOW), 'wars_cow': wars(),
           'termination_ucdp': termination(), 'battles_cdb90': battles()}
    d = out['wars_cow']['deaths']
    out['wars_cow']['deaths'] = {'n': len(d), 'median': statistics.median(d), 'powerlaw': powerlaw(d)}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    sys.exit(main())
