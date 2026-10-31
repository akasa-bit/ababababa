#!/usr/bin/env python3
"""星系の中の集団の価値観 (QD-42。docs/groups.md の 1) の値を、Global Flourishing Study (CC BY 4.0) の個票から出す。

材料 (data/fetch/fetch_values.py が取る): GFS の 1 年目の個票 (22 か国と香港・約 20 万人。国・重み・世帯の所得の区分・この国で生まれたか・9 項目)、WDI の 1 人あたり GDP。

形:
  1. 項目を 0〜1 に直し (高いほど伝統・高いほど安心と信頼)、全体の重み付きの平均と標準偏差で標準化して、2 つの指数にする
     - 伝統 ↔ 世俗: 宗教が日々の暮らしで大切か・宗教の集まりに出る多さ・法にはいつも従うべきか の平均 (世俗 = −伝統)。WVS の 2 軸の
       「神の大切さ・自律の指数・権威の尊重」にあたる。国への帰属の感じ (WVS の国の誇りにあたる) は国の間で揃わないので入れない
     - 生存 ↔ 自己表現 (近い形): 人がたがいに信頼しているか・暮らしの心配のなさ (安全・食べもの・住まい)・幸福 の平均。GFS には WVS の
       目印の項目 (脱物質主義・寛容・署名) がないので、Inglehart–Welzel が自己表現の土台とした「暮らしの安心」と信頼・幸福で作る近い形
  2. 国の平均 (重み付き) を、国の間の標準偏差で割って (0 が国の平均)、ln 1 人あたり GDP に最小二乗で当てる (ゲームの GROUPS.values の切片と傾き)
  3. 国の中の差: 国の平均を引いた指数 (同じく国の間の標準偏差の単位) を、国の中の所得の 5 分位 (重み付きの順位。3 分位を基準) と
     よそ生まれ (この国の外で生まれた) のダミーに、国ごとの固定効果つきの重み付き最小二乗で当てる
結果は data/derived/values.json。

使い方: python3 data/build/analyze_values.py
"""
import csv, gzip, json, math, os, sys
import numpy as np

RAW = os.path.join(os.path.dirname(__file__), '..', 'raw', 'values')
OUT = os.path.join(os.path.dirname(__file__), '..', 'derived', 'values.json')
TRAD = ['rel', 'attend', 'obey']
SELF = ['trust', 'secure', 'happy']


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return math.nan


def scale(v, lo, hi, rev=False):
    if not lo <= v <= hi:
        return math.nan
    x = (v - lo) / (hi - lo)
    return 1 - x if rev else x


def main():
    man = json.load(open(os.path.join(RAW, 'MANIFEST.json'), encoding='utf-8'))
    iso = {int(k): v for k, v in man['country_codes'].items()}
    gdp = {r['iso3']: float(r['gdppc_ppp2021']) for r in csv.DictReader(open(os.path.join(RAW, 'wdi_gdppc_2022.csv'), encoding='utf-8'))}
    P = []
    with gzip.open(os.path.join(RAW, 'gfs_wave1_values.csv.gz'), 'rt', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            g = {k: num(v) for k, v in r.items()}
            rel = {1: 1.0, 2: 0.0}.get(g['REL_IMPORTANT_Y1'], math.nan)
            say = {1: 1.0, 2: 0.0, 3: 0.5}.get(g['SAY_IN_GOVT_Y1'], math.nan)
            P.append({'c': int(g['COUNTRY']), 'w': g['ANNUAL_WEIGHT_C1'], 'inc': g['INCOME_Y1'], 'abroad': {1: 0.0, 2: 1.0}.get(g['BORN_COUNTRY_Y1'], math.nan),
                      'rel': rel, 'attend': scale(g['ATTEND_SVCS_Y1'], 1, 5, True), 'obey': scale(g['OBEY_LAW_Y1'], 1, 5, True),
                      'trust': scale(g['TRUST_PEOPLE_Y1'], 1, 5, True), 'secure': scale(g['WORRY_SAFETY_Y1'], 0, 10), 'happy': scale(g['HAPPY_Y1'], 0, 10), 'say': say})
    W = np.array([p['w'] for p in P])
    C = np.array([p['c'] for p in P])
    # 所得の 5 分位: 国ごとに、区分を重み付きの累積の真ん中の順位で 5 つに分ける (区分の幅が粗いので、同じ区分の人は同じ分位)
    Q = np.full(len(P), np.nan)
    for c in set(C):
        idx = [i for i in np.where(C == c)[0] if 0 < P[i]['inc'] < 9000]
        tab = {}
        for i in idx:
            tab[P[i]['inc']] = tab.get(P[i]['inc'], 0) + W[i]
        tot, cum, mid = sum(tab.values()), 0, {}
        for k in sorted(tab):
            mid[k] = (cum + tab[k] / 2) / tot
            cum += tab[k]
        for i in idx:
            Q[i] = min(5, math.floor(mid[P[i]['inc']] * 5) + 1)
    # 1. 標準化して指数に
    Z = {}
    for k in TRAD + SELF:
        v = np.array([p[k] for p in P]); ok = ~np.isnan(v)
        m = np.average(v[ok], weights=W[ok]); s = math.sqrt(np.average((v[ok] - m) ** 2, weights=W[ok]))
        Z[k] = (v - m) / s
    def index(ks):  # 項目がそろっている人だけ
        M = np.column_stack([Z[k] for k in ks])
        return np.where(np.isnan(M).any(1), np.nan, np.nan_to_num(M).mean(1))
    out = {'note': 'Global Flourishing Study の 1 年目 (CC BY 4.0) から。単位は国の平均の国の間の標準偏差 (0 が国の平均)。docs/groups.md の 1',
           'people': len(P), 'countries': sorted(iso[c] for c in set(C))}
    ab = np.array([p['abroad'] for p in P])
    for name, ks, sign in (('secular', TRAD, -1), ('selfexp', SELF, 1)):
        x = sign * index(ks)
        cs = sorted(set(C))
        cm = {c: np.average(x[(C == c) & ~np.isnan(x)], weights=W[(C == c) & ~np.isnan(x)]) for c in cs}
        mu = np.mean(list(cm.values())); sd = np.std(list(cm.values()))
        ys = np.array([(cm[c] - mu) / sd for c in cs]); lg = np.array([math.log(gdp[iso[c]]) for c in cs])
        A = np.column_stack([np.ones(len(cs)), lg]); b = np.linalg.lstsq(A, ys, rcond=None)[0]
        r = float(np.corrcoef(lg, ys)[0, 1])
        # 3. 国の中の差 (国ごとの固定効果: 指数と説明の変数のどちらも、国の重み付きの平均を引く)
        ok = ~np.isnan(x) & ~np.isnan(Q) & ~np.isnan(ab)
        dev = (x - np.array([cm.get(c, np.nan) for c in C])) / sd
        cols = [(Q == k).astype(float) for k in (1, 2, 4, 5)] + [ab]
        X = np.column_stack(cols)[ok]; y = dev[ok]; w = W[ok]; cc = C[ok]
        for c in cs:
            s = cc == c
            X[s] -= np.average(X[s], axis=0, weights=w[s]); y[s] -= np.average(y[s], weights=w[s])
        beta, *_ = np.linalg.lstsq(X * np.sqrt(w)[:, None], y * np.sqrt(w), rcond=None)
        res = y - X @ beta
        # 標準誤差 (国でまとめた頑健な分散。国は 23 しかないので、目安)
        XtWX = (X * w[:, None]).T @ X
        meat = sum(np.outer(g := ((X[cc == c] * (w[cc == c] * res[cc == c])[:, None]).sum(0)), g) for c in cs)
        V = np.linalg.inv(XtWX) @ meat @ np.linalg.inv(XtWX)
        se = np.sqrt(np.diag(V))
        q = [float(beta[0]), float(beta[1]), 0.0, float(beta[2]), float(beta[3])]
        qm = sum(q) / 5  # 5 つの分位は人口が同じなので、平均を 0 にする
        out[name] = {'items': ks if sign > 0 else [f'−{k}' for k in ks], 'countries': len(cs), 'sd_between': round(float(sd), 4),
                     'intercept': round(float(b[0]), 4), 'slope_ln_gdppc': round(float(b[1]), 4), 'r': round(r, 3),
                     'quint': [round(v - qm, 4) for v in q], 'quint_se_vs_q3': [round(float(v), 4) for v in (se[0], se[1], 0.0, se[2], se[3])],
                     'away': round(float(beta[4]), 4), 'away_se': round(float(se[4]), 4), 'n': int(ok.sum()), 'away_share': round(float(np.average(ab[ok], weights=W[ok])), 4)}
        o = out[name]
        print(f"{name}: {o['countries']} か国・ln GDP との相関 {o['r']}・切片 {o['intercept']}・傾き {o['slope_ln_gdppc']} / 所得の分位 {o['quint']} / よそ生まれ {o['away']} (± {o['away_se']})・{o['n']} 人")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    sys.exit(main())
