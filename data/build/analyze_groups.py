#!/usr/bin/env python3
"""星系の中の集団 (回 SE6・B-020) の生データ (data/raw/groups/) から、目標 R42 の統計量と、集団の値の元になる数を計算する。

1. R42 (政治から締め出された人口の割合と、民族の分離の紛争): EPR Core 2021 の国・年 (1946〜2019 年) ごとに、締め出された集団
   (無力 POWERLESS・差別 DISCRIMINATED・自ら離脱 SELF-EXCLUSION) の人口の割合を足す。国が崩れた年 (STATE COLLAPSE) は除く。
   紛争の始まり = UCDP 二者間 21.1 の、争点が領土 (1 か 3) の組の最初の年のうち、ACD2EPR 2021 でその国の EPR の集団のために戦うと言い (claim ≥ 1)、
   その集団から兵を集めた (recruitment = 1) もの。国・年のロジット (Wimmer, Cederman & Min 2009 の国の形): 始まり ~ 締め出された割合 + ln 1 人あたり GDP
   + ln 人口 (Maddison 2023) + 平和の年数の 3 次式。民族の領土の紛争が続いている年は除く (始まりだけを数える)。締め出された割合の係数とその 95% 信頼区間
2. 集団の形 (Cederman, Wimmer & Min 2010 の集団の形): 集団・年のロジット: 集団のための領土の紛争の始まり ~ 締め出された + 2 年以内に権力の段が下がった
   + ln 相対的な大きさ + ln 1 人あたり GDP + 平和の年数の 3 次式。締め出しと格下げのオッズ比
3. 所得の 5 分位の分け前: WDI (SI.DST.*) の国・年の分け前の中央値 (全体と、Maddison の 1 人あたり GDP の 5 分位ごと)
4. 価値観の 2 軸の近い形: QoG の WVS の国の平均の項目を国の間で標準化し、伝統 ↔ 世俗 = (−神の大切さ・自律の指数) の平均、生存 ↔ 自己表現 =
   (脱物質主義・幸福・人への信頼) の平均。それぞれを ln 1 人あたり GDP (2021 年の購買力平価) で回帰した切片・傾き・決定係数
書き出し: data/derived/groups.json

使い方: python3 data/build/analyze_groups.py
"""
import csv, gzip, json, math, os, statistics, sys
import numpy as np

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'groups')
OUT = os.path.join(HERE, '..', 'derived', 'groups.json')
sys.path.insert(0, HERE)
from analyze_history import logit, ols, coef  # 同じ統計の関数を使う

EXCL = {'POWERLESS', 'DISCRIMINATED', 'SELF-EXCLUSION'}
INCL = {'MONOPOLY', 'DOMINANT', 'SENIOR PARTNER', 'JUNIOR PARTNER'}
RANK = {'MONOPOLY': 6, 'DOMINANT': 5, 'SENIOR PARTNER': 4, 'JUNIOR PARTNER': 3, 'POWERLESS': 2, 'SELF-EXCLUSION': 2, 'DISCRIMINATED': 1}
Y0, Y1 = 1946, 2019
# EPR の国名 → Maddison 2023 の国の符号 (名前が違うもの。ないものは対照の数がないので落ちる)
MPD_FIX = {'United States of America': 'USA', 'Cuba': 'CUB', 'Venezuela': 'VEN', 'Bolivia': 'BOL', 'German Federal Republic': 'DEU', 'Czechoslovakia': 'CSK',
           'Czech Republic': 'CZE', 'Italy/Sardinia': 'ITA', 'Macedonia (FYROM/North Macedonia)': 'MKD', 'Yugoslavia': 'YUG', 'Bosnia-Herzegovina': 'BIH',
           'Moldova': 'MDA', 'Rumania': 'ROU', 'Russia (Soviet Union)': 'RUS', 'Belarus (Byelorussia)': 'BLR', 'Cape Verde': 'CPV', "Cote D'Ivoire": 'CIV',
           'Burkina Faso (Upper Volta)': 'BFA', 'Congo, Democratic Republic of (Zaire)': 'COD', 'Tanzania (Tanganyika)': 'TZA', 'Zimbabwe (Rhodesia)': 'ZWE',
           'Swaziland (Eswatini)': 'SWZ', 'Madagascar (Malagasy)': 'MDG', 'Libya': 'LBY', 'Iran (Persia)': 'IRN', 'Turkey (Ottoman Empire)': 'TUR', 'Syria': 'SYR',
           'Yemen (Arab Republic of Yemen)': 'YEM', 'Afghanistan': 'AFG', 'Kyrgyz Republic': 'KGZ', "Korea, People's Republic of": 'PRK', 'Korea, Republic of': 'KOR',
           'Myanmar (Burma)': 'MMR', 'Sri Lanka (Ceylon)': 'LKA', 'Cambodia (Kampuchea)': 'KHM', 'Laos': 'LAO', 'Vietnam, Democratic Republic of': 'VNM'}


def rows(name, opener=open):
    with opener(os.path.join(RAW, name), 'rt', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def num(x):
    try:
        v = float(x)
        return None if math.isnan(v) else v
    except (TypeError, ValueError):
        return None


def maddison():
    p = os.path.join(HERE, '..', 'raw', 'sectors', 'mpd2023.csv.gz')
    with gzip.open(p, 'rt', encoding='utf-8') as f:
        rs = list(csv.DictReader(f))
    names = {r['country']: r['countrycode'] for r in rs}
    val = {(r['countrycode'], int(r['year'])): (num(r['gdppc']), num(r['pop'])) for r in rs}
    # USSR・ユーゴスラビアは、ロシア・セルビアの名で EPR が続くので、1991 年までは旧国の値
    return names, val


def code_of(name, gw, year, names):
    if gw == 365 and year <= 1991: return 'SUN'
    if gw == 345 and year <= 1991: return 'YUG'
    return MPD_FIX.get(name) or names.get(name)


def peace_terms(t):
    return [t / 10, (t / 10) ** 2, (t / 10) ** 3]


def main():
    epr = rows('EPR-2021.csv')
    acd = rows('ACD2EPR-2021.csv')
    dy = rows('ucdp-dyadic-211.csv')
    names, mpd = maddison()
    # 集団・年の権力の段
    gy = {}
    gsz, gsize = {}, {}
    for r in epr:
        gw, gid = int(r['gwid']), int(r['gwgroupid'])
        for y in range(max(Y0, int(r['from'])), min(Y1, int(r['to'])) + 1):
            gy[(gw, gid, y)] = r['status']
            gsz[(gw, gid, y)] = num(r['size']) or 0  # その期間の人口の割合
            gsize[(gw, gid)] = 1
    state = {}
    for r in epr:
        state[int(r['gwid'])] = r['statename']
    # 民族の領土の紛争の組: 組 → (国, 集団の一覧)。始まりの年は組の最初の年
    link = {}
    for r in acd:
        if not r['gwgroupid'] or num(r['claim']) is None or num(r['recruitment']) is None:
            continue
        if num(r['claim']) >= 1 and num(r['recruitment']) >= 1:
            link.setdefault(r['dyadid'], set()).add(int(r['gwgroupid']))
    first, years_of, terr = {}, {}, {}
    for r in dy:
        d, y = r['dyad_id'], int(r['year'])
        first[d] = min(first.get(d, 9999), y)
        years_of.setdefault(d, set()).add(y)
        if r['incompatibility'] in ('1', '3'):
            terr[d] = True
    onsets_g = {}  # (gw, gid) → 始まりの年の一覧
    active_c = set()  # 民族の領土の紛争が続いている国・年 (始まりの年を除く)
    for d, gs in link.items():
        if d not in first or not terr.get(d):
            continue
        for gid in gs:
            gw = gid // 100000  # gwgroupid = 国 (gwid) × 100000 + 集団
            onsets_g.setdefault((gw, gid), set()).add(first[d])
            for y in years_of[d]:
                if y != first[d]:
                    active_c.add((gw, y))
    # 1. 国・年
    X, Y, kept = [], [], []
    countries = sorted({gw for (gw, _, _) in gy})
    by_cy = {}
    for (gw, gid, y), s in gy.items():
        by_cy.setdefault((gw, y), []).append((gid, s))
    cy_onset = set()
    for (gw, gid), ys in onsets_g.items():
        for y in ys:
            cy_onset.add((gw, y))
    for gw in countries:
        ys = sorted(y for (g, y) in by_cy if g == gw)
        if not ys:
            continue
        since = ys[0]
        for y in ys:
            gs = by_cy[(gw, y)]
            if any(s == 'STATE COLLAPSE' for _, s in gs):
                continue
            on = (gw, y) in cy_onset
            if (gw, y) in active_c and not on:
                continue
            c = code_of(state[gw], gw, y, names)
            g, p = mpd.get((c, y), (None, None)) if c else (None, None)
            if g is None or p is None or g <= 0 or p <= 0:
                if on:
                    since = y
                continue
            ex = sum(gsz[(gw, gid, y)] for gid, s in gs if s in EXCL)
            X.append([1, ex, math.log(g), math.log(p * 1000), *peace_terms(y - since)])
            Y.append(1 if on else 0)
            kept.append((gw, y))
            if on:
                since = y
    b, se = logit(Y, X)
    r42 = coef(b, se, 1, '締め出された人口の割合 (0〜1)', exp=True)
    excl_vals = [x[1] for x in X]
    r42.update({'country_years': len(Y), 'onsets': int(sum(Y)), 'countries': len({k[0] for k in kept}),
                'excluded_share_median': round(statistics.median(excl_vals), 4), 'excluded_share_mean': round(statistics.mean(excl_vals), 4),
                'controls': {'ln_gdppc': coef(b, se, 2, 'ln 1 人あたり GDP'), 'ln_pop': coef(b, se, 3, 'ln 人口')}})
    # 2. 集団・年
    GX, GY = [], []
    for (gw, gid), _ in gsize.items():
        ys = sorted(y for (g, i, y) in gy if g == gw and i == gid)
        if not ys:
            continue
        since = ys[0]
        prev = []
        for y in ys:
            s = gy[(gw, gid, y)]
            on = y in onsets_g.get((gw, gid), set())
            if s in ('STATE COLLAPSE', 'IRRELEVANT'):
                prev.append(None)
                if on: since = y
                continue
            c = code_of(state[gw], gw, y, names)
            g, _p = mpd.get((c, y), (None, None)) if c else (None, None)
            down = any(q is not None and RANK.get(q, 0) > RANK.get(s, 0) for q in prev[-2:])
            prev.append(s)
            if g is None or g <= 0:
                if on: since = y
                continue
            # 相対的な大きさ: 権力のある集団の大きさに比べる (締め出された集団は 集団 ÷ (集団 + 権力のある集団の和)、権力のある集団は 集団 ÷ 権力のある集団の和)
            inc = sum(gsz[(gw, i, y)] for i, q in by_cy[(gw, y)] if q in INCL)
            sz = gsz[(gw, gid, y)]
            rel = sz / (sz + inc) if s in EXCL else (sz / inc if inc > 0 else 1)
            rel = min(max(rel, 1e-4), 1 - 1e-4)
            GX.append([1, 1 if s in EXCL else 0, 1 if down else 0, math.log(rel / (1 - rel)), math.log(g), *peace_terms(y - since)])
            GY.append(1 if on else 0)
            if on: since = y
    gb, gse = logit(GY, GX)
    grp = {'group_years': len(GY), 'onsets': int(sum(GY)), 'excluded': coef(gb, gse, 1, '締め出された', exp=True), 'downgraded': coef(gb, gse, 2, '2 年以内に格下げ', exp=True),
           'rel_size': coef(gb, gse, 3, 'ln 相対的な大きさ (ロジット)'), 'ln_gdppc': coef(gb, gse, 4, 'ln 1 人あたり GDP')}
    # 3. 所得の 5 分位
    q = rows('wdi_quintiles.csv')
    iso_g = {}
    for r in q:
        g, _p = mpd.get((r['iso3'], int(r['year'])), (None, None))
        iso_g[(r['iso3'], int(r['year']))] = g
    shares = [[num(r[k]) for k in ('q1', 'q2', 'q3', 'q4', 'q5')] for r in q]
    overall = [round(statistics.median(s[i] for s in shares), 2) for i in range(5)]
    with_g = [(iso_g[(r['iso3'], int(r['year']))], s) for r, s in zip(q, shares) if iso_g[(r['iso3'], int(r['year']))]]
    with_g.sort(key=lambda x: x[0])
    k = len(with_g)
    bands = []
    for j in range(5):
        part = with_g[j * k // 5:(j + 1) * k // 5]
        bands.append({'gdppc': [round(part[0][0]), round(part[-1][0])], 'n': len(part), 'shares': [round(statistics.median(s[i] for _, s in part), 2) for i in range(5)]})
    quint = {'country_years': len(shares), 'countries': len({r['iso3'] for r in q}), 'median': overall, 'by_income': bands,
             'note': '分け前は %。所得の分位は Maddison 2023 の 1 人あたり GDP (2011 年の購買力平価のドル) のある国・年だけ'}
    # 4. 価値観の 2 軸
    w = [r for r in rows('qog_wvs.csv')]
    items = ['wvs_godimp', 'wvs_auton', 'wvs_pmi4', 'wvs_hap', 'wvs_trust']
    z = {}
    for it in items:
        vs = [num(r[it]) for r in w if num(r[it]) is not None]
        m, sd = statistics.mean(vs), statistics.pstdev(vs)
        z[it] = {r['ccodealp']: (num(r[it]) - m) / sd for r in w if num(r[it]) is not None}
    axes = {}
    for name, parts in (('secular', [('wvs_godimp', -1), ('wvs_auton', 1)]), ('selfexp', [('wvs_pmi4', 1), ('wvs_hap', 1), ('wvs_trust', 1)])):
        xs, ys = [], []
        for r in w:
            c, g = r['ccodealp'], num(r['wdi_gdpcappppcon2021'])
            vals = [s * z[it][c] for it, s in parts if c in z[it]]
            if g and len(vals) == len(parts):
                xs.append([1, math.log(g)]); ys.append(statistics.mean(vals))
        bb, bse = ols(ys, xs)
        yy = np.array(ys); pred = np.array(xs) @ bb
        r2 = 1 - ((yy - pred) ** 2).sum() / ((yy - yy.mean()) ** 2).sum()
        sd_resid = float(np.sqrt(((yy - pred) ** 2).mean()))
        axes[name] = {'items': [f'{"−" if s < 0 else ""}{it}' for it, s in parts], 'countries': len(ys), 'intercept': round(float(bb[0]), 4), 'slope_ln_gdppc': round(float(bb[1]), 4),
                      'slope_se': round(float(bse[1]), 4), 'r2': round(float(r2), 3), 'sd_resid': round(sd_resid, 3), 'range': [round(min(ys), 2), round(max(ys), 2)]}
    out = {'R42': r42, 'group_level': grp, 'quintiles': quint, 'values': axes,
           'sources': 'data/raw/groups/MANIFEST.json (EPR Core 2021・ACD2EPR 2021・UCDP 二者間 21.1・WDI・QoG Jan25)・data/raw/sectors/mpd2023.csv.gz (Maddison 2023)'}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    sys.exit(main())
