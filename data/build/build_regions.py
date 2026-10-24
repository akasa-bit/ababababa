#!/usr/bin/env python3
"""国の中の地域の収束と労働分配率の様式化された事実を計算する (目標 R38・R39。回 KE5。docs/regions.md の 3.3)。

統計量:
  R38 国の中の地域の収束 (β 収束。Barro & Sala-i-Martin 1992 の形): 地域の 1 人あたり総生産 (2015 年の値段、自国通貨) の 10 年の伸び
      g = (ln y(t+10) − ln y(t)) ÷ 10 を、初めの ln y(t) に当てる。国 × 期間 (t) の固定効果つき (国の中の差だけを見る)、重みなし。
      期間は 10 で割り切れる年から始まる重ならない 10 年 (1960〜1970・…・2010〜2020)。両端の年に値があり、間 (t の次の年〜t+10) に
      統計の切れ目 (StructChange ≠ 0: 元のデータか地域の境が変わった年) がない地域だけを使う。
      速さ λ = −ln(1 + 10 b) ÷ 10 (b は傾き。年あたり)。国を引き直すブートストラップ 1000 回の 5%〜95% 点も出す
  (参考) 国の中の地域の差: 国・年ごとに、地域の 1 人あたり総生産の 90% 点 ÷ 10% 点 (地域が 5 つ以上)。国ごとの中央値の分布
  R39 労働分配率: Penn World Table 10.01 の labsh の国ごとの中央値の分布 (10%・25%・50%・75%・90% 点)。所得 (rgdpe ÷ pop) の 5 分位ごとの中央値も
  ゲームの資本の値 (src/economy/market-consts.js の CAPITAL。回 KE5): 資本の分け前 alpha = 1 − labsh の国ごとの中央値の中央値、減価償却 delta・資本の収益率 irr・
      資本 ÷ 産出 (cn ÷ cgdpo)・投資 ÷ GDP (csh_i) の国ごとの中央値の中央値と四分位範囲

使い方: python3 data/build/build_regions.py → data/derived/regions.json
        python3 data/build/build_regions.py 地域のパネル.csv [労働分配率のパネル.csv] → ゲームの R38・R39 (同じ式。tools/region-panel.js の出力)
          地域のパネルの列: GID_0 (国), GID_1 (地域), year, pop, grp_pc (1 人あたりの実質の所得), StructChange (0)
          労働分配率のパネルの列: countrycode (国), year, labsh
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'regions')
OUT = os.path.join(HERE, '..', 'derived', 'regions.json')
SPAN = 10
BOOT = 1000


def pairs(d, col):
    """地域ごとの重ならない 10 年の組: [国, 期間の始めの年, ln y(t), 年あたりの伸び]"""
    out = []
    for (c, r), x in d.groupby(['GID_0', 'GID_1'], sort=True):
        v = dict(zip(x['year'].astype(int), x[col]))
        brk = set(x.loc[x['StructChange'] != 0, 'year'].astype(int))
        for t in sorted(v):
            if t % SPAN or t + SPAN not in v:
                continue
            a, b = v[t], v[t + SPAN]
            if not (a > 0 and b > 0) or any(t < s <= t + SPAN for s in brk):
                continue
            out.append((c, t, float(np.log(a)), float((np.log(b) - np.log(a)) / SPAN)))
    return pd.DataFrame(out, columns=['c', 't', 'ly', 'g'])


def beta(p):
    """国 × 期間の固定効果つきの傾き b と、速さ λ = −ln(1 + 10 b) ÷ 10"""
    k = p['c'] + '|' + p['t'].astype(str)
    xd = p['ly'] - p.groupby(k)['ly'].transform('mean')
    gd = p['g'] - p.groupby(k)['g'].transform('mean')
    sxx = float((xd * xd).sum())
    b = float((xd * gd).sum() / sxx) if sxx > 0 else 0.0
    return b, float(-np.log(max(1 + SPAN * b, 1e-9)) / SPAN)


def convergence(d, col):
    p = pairs(d, col)
    n = p.groupby(p['c'] + '|' + p['t'].astype(str))['ly'].transform('size')
    p = p[n >= 2].reset_index(drop=True)  # 国 × 期間の中に地域が 2 つ以上
    b, lam = beta(p)
    return p, {'b': round(b, 5), 'speed': round(lam, 5), 'pairs': len(p), 'countries': int(p['c'].nunique()),
               'periods': sorted(int(t) for t in p['t'].unique())}


def bootstrap(p, seed=20261024):
    rng = np.random.default_rng(seed)
    cs = np.array(sorted(p['c'].unique()))
    by = {c: x for c, x in p.groupby('c')}
    lam = []
    for i in range(BOOT):
        pick = rng.choice(cs, len(cs), replace=True)
        q = pd.concat([by[c].assign(c=f'{c}#{j}') for j, c in enumerate(pick)], ignore_index=True)
        lam.append(beta(q)[1])
    return [round(float(np.quantile(lam, f)), 5) for f in (0.05, 0.5, 0.95)]


def spread(d, col):
    """国・年ごとの地域の 90% 点 ÷ 10% 点 (地域が 5 つ以上) の、国ごとの中央値"""
    r = []
    for (c, y), x in d.dropna(subset=[col]).groupby(['GID_0', 'year']):
        v = x[col].to_numpy()
        if len(v) >= 5 and np.quantile(v, 0.1) > 0:
            r.append((c, float(np.quantile(v, 0.9) / np.quantile(v, 0.1))))
    m = pd.DataFrame(r, columns=['c', 'r']).groupby('c')['r'].median()
    return {'countries': len(m), 'q': {str(f): round(float(np.quantile(m, f)), 3) for f in (0.1, 0.25, 0.5, 0.75, 0.9)}}


def labor_share(p):
    m = p.groupby('countrycode')['labsh'].median()
    out = {'countries': len(m), 'country_years': len(p), 'q': {str(f): round(float(np.quantile(m, f)), 4) for f in (0.1, 0.25, 0.5, 0.75, 0.9)}}
    if 'rgdpe' in p and 'pop' in p:
        x = p.dropna(subset=['rgdpe', 'pop']).copy()
        x = x[(x['pop'] > 0) & (x['rgdpe'] > 0)]
        ly = np.log(x["rgdpe"] / x["pop"])  # 2017 年の購買力平価のドル / 人 (どちらも百万)
        edges = np.quantile(ly, [0, .2, .4, .6, .8, 1])
        x['q'] = np.clip(np.searchsorted(edges, ly, side='right') - 1, 0, 4)
        out['by_income'] = [{'income': [round(float(np.exp(edges[i]))), round(float(np.exp(edges[i + 1])))],
                             'q': [round(float(np.quantile(g['labsh'], f)), 4) for f in (0.25, 0.5, 0.75)]} for i, g in x.groupby('q')]
    return out


def capital(p):
    """ゲームの資本の値 (CAPITAL) の元: 国ごとの中央値の、国のあいだの 25%・50%・75% 点"""
    x = p.assign(ky=p['cn'] / p['cgdpo'])
    q = lambda col: [round(float(v), 4) for v in x.dropna(subset=[col]).groupby('countrycode')[col].median().quantile([0.25, 0.5, 0.75])]
    out = {k: q(k) for k in ('labsh', 'delta', 'irr', 'ky', 'csh_i')}
    out['game'] = {'alpha': round(1 - out['labsh'][1], 3), 'delta': round(out['delta'][1], 3), 'irr': round(out['irr'][1], 3)}
    return out


def game(region_csv, labsh_csv=None):
    d = pd.read_csv(region_csv, dtype={'GID_0': str, 'GID_1': str})
    p, est = convergence(d, 'grp_pc')
    res = {'R38': est, 'spread': spread(d, 'grp_pc')}
    if labsh_csv:
        res['R39'] = labor_share(pd.read_csv(labsh_csv, dtype={'countrycode': str}))
    print(json.dumps(res, ensure_ascii=False))


def main():
    if len(sys.argv) > 1:
        return game(*sys.argv[1:3])
    d = pd.read_csv(os.path.join(RAW, 'dose_v2.csv.gz'))
    p, est = convergence(d, 'grp_pc_lcu_2015')
    est['bootstrap_5_50_95'] = bootstrap(p)
    print('R38', est, flush=True)
    # 参考: 統計の切れ目を気にしない・2015 年の米ドルで測る (国の中の比べなので通貨はほぼ効かない)
    ref = {'keep_breaks': convergence(d.assign(StructChange=0), 'grp_pc_lcu_2015')[1],
           'usd_2015': convergence(d, 'grp_pc_usd_2015')[1]}
    print('参考', ref, flush=True)
    pw = pd.read_csv(os.path.join(RAW, 'pwt1001.csv.gz'))
    ls = labor_share(pw)
    print('R39', ls, flush=True)
    cap = capital(pw)
    print('資本', cap, flush=True)
    out = {
        'source': 'data/raw/regions/ (DOSE v2・Penn World Table 10.01)。計算は data/build/build_regions.py',
        'convergence': {**est, 'reference': ref,
                        'note': '国 × 期間の固定効果つきの β 収束。期間は重ならない 10 年、統計の切れ目 (StructChange ≠ 0) をまたぐ組は使わない。速さは年あたり'},
        'spread_90_10': spread(d, 'grp_pc_lcu_2015'),
        'labor_share': ls,
        'capital': {**cap, 'note': '国ごとの中央値の、国のあいだの 25%・50%・75% 点。game はゲームの CAPITAL に写す値 (alpha = 1 − labsh の中央値)'},
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
