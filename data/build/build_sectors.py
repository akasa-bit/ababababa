#!/usr/bin/env python3
"""産業構造と所得の様式化された事実を計算する (目標 R10 の幅の案。固定はセッション 9 が行う)。

部門は 3 つにまとめる (Herrendorf・Rogerson・Valentinyi 2014 と同じ):
  農業 = Agriculture、工業 = Mining・Manufacturing・Utilities・Construction、サービス = 残りの 5 部門
2 つのデータで同じ計算をする:
  - GGDC 10 部門 (就業者、1950〜2012 年) × Maddison 2023 の 1 人あたり所得 (2011 年の国際ドル)
  - WDI (ILOSTAT のモデル推計の就業の割合、1991 年〜) × WDI の 1 人あたり所得 (PPP、2021 年の国際ドル)
統計量 (R10 の文のとおり):
  1. 所得の 5 分位 (国 × 年をまとめた ln 所得の分位) ごとの、3 部門の割合の四分位範囲 (25%〜75% 点)
  2. 工業の割合が最大になる所得: 工業の割合を ln 所得の 2 次式で当てはめた頂点 (国ごとの固定効果つき)。
     国を引き直すブートストラップ (500 回) の 5%〜95% 点を幅にする
ゲームの所得を 2011 年の国際ドルに読み替える物差し (anchor。目標 R10 の測り方。セッション 9 で固定):
  ゲームの食料 1 単位 = 穀物 100 万 t (src の UNIT_KG。1 人 1 t/年) なので、食料の基準の値段を、2011 年の世界の穀物の値段
  (World Bank Pink Sheet の名目の年の値段: 小麦 US HRW・とうもろこし・米 Thai 5%) を USDA PSD の 2011 年の世界の消費量で重みづけた平均に合わせる。
  生データは data/raw/market/ (data/fetch/fetch_market.py で取ったもの)

ゲームに入れる曲線 (structure。セッション 9 の構造転換。docs/structure.md):
  - services: サービスの就業の割合を ln 所得の logit で当てた (GGDC の EMP × Maddison、プール)。ゲームの人々は所得のこの割合をサービスに使う
  - goods: 工業品 (鉱業・製造業・電気ガス水道) の 1 人あたりの実質の付加価値 (VA_Q05 ÷ Maddison の人口) を ln 所得の 2 次式で当てた
    Engel 曲線 (国の固定効果つき。通貨の単位は固定効果に吸われる)。水準は、米国 2010 年の名目の付加価値の割合 × 所得 ÷ 工業品 1 単位の値段
    (基準の値段の比 PRICE.goods ÷ PRICE.food = 4 × anchor) で、1 人 (100 万人) あたりの単位にする
  - research: 研究者の数 (人口 100 万人あたり。WDI SP.POP.SCIE.RD.P6) を ln 所得に当てた (プール)。data/raw/research/ (fetch_research.py)
  - stages: 惑星の発展段階の境目 (R10 の分位の境目と工業の頂点)

使い方: python3 data/build/build_sectors.py → data/derived/sectors.json
        python3 data/build/build_sectors.py --game <パネル.csv>   ゲームのパネル (tools/sector-panel.js) を同じ関数で計算し、R10 の合否を出す
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'sectors')
MARKET = os.path.join(HERE, '..', 'raw', 'market')
OUT = os.path.join(HERE, '..', 'derived', 'sectors.json')
AGR = ['Agriculture ']
IND = ['Mining', 'Manufacturing', 'Utilities', 'Construction']
SRV = ['Trade, restaurants and hotels', 'Transport, storage and communication', 'Finance, insurance, real estate and business services',
       'Government services', 'Community, social and personal services']

def ggdc():
    d = pd.read_excel(os.path.join(RAW, '10sd_jan15_2014.xlsx'), sheet_name='dataset')
    d = d[d['Variable'] == 'EMP'].copy()
    for c in AGR + IND + SRV:
        d[c] = pd.to_numeric(d[c], errors='coerce')
    tot = d[AGR + IND + SRV].sum(axis=1, min_count=10)
    p = pd.DataFrame({'iso3': d['Country'], 'year': d['Year'].astype(int), 'agr': d[AGR].sum(axis=1) / tot,
                      'ind': d[IND].sum(axis=1) / tot, 'srv': d[SRV].sum(axis=1) / tot}).dropna()
    m = pd.read_csv(os.path.join(RAW, 'mpd2023.csv.gz'))[['countrycode', 'year', 'gdppc']].rename(columns={'countrycode': 'iso3'})
    return p.merge(m, on=['iso3', 'year']).dropna()

def wdi():
    d = pd.read_csv(os.path.join(RAW, 'wdi_sectors.csv.gz'))
    w = d.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').reset_index()
    w = w.rename(columns={'SL.AGR.EMPL.ZS': 'agr', 'SL.IND.EMPL.ZS': 'ind', 'SL.SRV.EMPL.ZS': 'srv', 'NY.GDP.PCAP.PP.KD': 'gdppc'})
    w[['agr', 'ind', 'srv']] /= 100
    return w.dropna(subset=['agr', 'ind', 'srv', 'gdppc'])

def peak(p):
    """工業の割合 = 国の固定効果 + b1 ln y + b2 (ln y)² の頂点 exp(−b1 ÷ 2 b2)。"""
    x = np.log(p['gdppc'].to_numpy())
    y = p['ind'].to_numpy()
    g = p['iso3'].to_numpy()
    X = np.column_stack([x, x * x])
    # 国ごとに平均を引く (固定効果を消す)
    Xd, yd = X.copy(), y.copy()
    for c in np.unique(g):
        k = g == c
        Xd[k] -= X[k].mean(axis=0)
        yd[k] -= y[k].mean()
    b = np.linalg.lstsq(Xd, yd, rcond=None)[0]
    return float(np.exp(-b[0] / (2 * b[1]))) if b[1] < 0 else float('nan'), [float(v) for v in b]

def facts(p, seed=1):
    lq = np.log(p['gdppc'])
    edges = np.quantile(lq, [0, .2, .4, .6, .8, 1])
    p = p.assign(q=np.clip(np.searchsorted(edges, lq, side='right') - 1, 0, 4))
    bins = []
    for q in range(5):
        s = p[p['q'] == q]
        bins.append({'income': [float(np.exp(edges[q])), float(np.exp(edges[q + 1]))], 'n': int(len(s)),
                     **{k: [float(np.quantile(s[k], .25)), float(np.quantile(s[k], .5)), float(np.quantile(s[k], .75))] for k in ('agr', 'ind', 'srv')}})
    pk, b = peak(p)
    rng = np.random.default_rng(seed)
    cs = p['iso3'].unique()
    boots = []
    for _ in range(500):
        pick = rng.choice(cs, len(cs))
        bp = pd.concat([p[p['iso3'] == c].assign(iso3=f'{c}#{i}') for i, c in enumerate(pick)])
        v, _ = peak(bp)
        if np.isfinite(v):
            boots.append(v)
    return {'n': int(len(p)), 'countries': int(len(cs)), 'years': [int(p['year'].min()), int(p['year'].max())], 'quintiles': bins,
            'industry_peak_income': pk, 'industry_peak_band_5_95': [float(np.quantile(boots, .05)), float(np.quantile(boots, .95))],
            'industry_peak_fit': {'b_lny': b[0], 'b_lny2': b[1]}, 'boots': len(boots)}

def anchor(year=2011):
    """世界の穀物の 1 t の値段 (その年の名目のドル = 2011 年なら 2011 年の国際ドル)。Pink Sheet の 3 品目を、PSD の世界の消費量で重みづける。"""
    import openpyxl
    ws = openpyxl.load_workbook(os.path.join(MARKET, 'CMO-Historical-Data-Annual.xlsx'), read_only=True)['Annual Prices (Nominal)']
    rows = list(ws.iter_rows(values_only=True))
    head = next(r for r in rows if r[1] == 'Crude oil, average')
    row = next(r for r in rows if r[0] in (year, str(year)))
    col = {'Wheat': 'Wheat, US HRW', 'Corn': 'Maize', 'Rice, Milled': 'Rice, Thai 5% '}
    price = {k: float(row[head.index(v)]) for k, v in col.items()}
    d = pd.read_csv(os.path.join(MARKET, 'psd_cereals.csv.gz'))
    d = d[(d['Market_Year'] == year) & (d['Attribute_Description'] == 'Domestic Consumption')]
    cons = {k: float(d[d['Commodity_Description'] == k]['Value'].sum()) * 1e3 for k in col}  # (1000 MT) → t
    usd = sum(price[k] * cons[k] for k in col) / sum(cons.values())
    return {'year': year, 'usd_per_t': usd, 'prices_usd_per_t': {k: price[k] for k in col}, 'consumption_t': cons,
            'series': {k: v.strip() for k, v in col.items()},
            'note': 'ゲームの食料の基準の値段 (cr / 100 万 t) を、この 1 t の値段 × 100 万に合わせる。1 人あたり所得 (ドル) = 実質の所得 [cr] ÷ 食料の基準の値段 [cr / 100 万 t] × usd_per_t ÷ 人口 [百万人]'}

RESEARCH = os.path.join(HERE, '..', 'raw', 'research', 'wdi_research.csv.gz')
GOODS = ['Mining', 'Manufacturing', 'Utilities']  # ゲームの「工業品」にあたる部門 (建設は政府が建てるので除く)
US_REF = ('USA', 2010)                           # 工業品の需要の水準を合わせる国・年
GOODS_PER_FOOD = 4.0                             # 基準の値段の比 PRICE.goods ÷ PRICE.food (src/index.html の PRICE)

def logit_fit(x, share):
    s = np.clip(share, 0.02, 0.98)
    A = np.column_stack([np.ones_like(x), x])
    b = np.linalg.lstsq(A, np.log(s / (1 - s)), rcond=None)[0]
    return [float(v) for v in b]

def structure(ggdc_emp, usd_per_t):
    """ゲームに入れる曲線の係数。"""
    d = pd.read_excel(os.path.join(RAW, '10sd_jan15_2014.xlsx'), sheet_name='dataset')
    for c in AGR + IND + SRV:
        d[c] = pd.to_numeric(d[c], errors='coerce')
    m = pd.read_csv(os.path.join(RAW, 'mpd2023.csv.gz'))[['countrycode', 'year', 'gdppc', 'pop']].rename(columns={'countrycode': 'iso3'})
    # サービスの就業の割合 (R10 と同じ就業のデータ)
    serv = logit_fit(np.log(ggdc_emp['gdppc'].to_numpy()), ggdc_emp['srv'].to_numpy())
    # 工業品の Engel 曲線
    q = d[d['Variable'] == 'VA_Q05'].copy()
    q['g'] = q[GOODS].sum(axis=1, min_count=3)
    e = pd.DataFrame({'iso3': q['Country'], 'year': q['Year'].astype(int), 'g': q['g']}).dropna().merge(m, on=['iso3', 'year']).dropna()
    e = e[e['g'] > 0]
    x = np.log(e['gdppc'].to_numpy()); y = np.log(e['g'].to_numpy() / e['pop'].to_numpy()); g = e['iso3'].to_numpy()
    X = np.column_stack([x, x * x]); Xd, yd = X.copy(), y.copy()
    for c in np.unique(g):
        k = g == c
        Xd[k] -= X[k].mean(axis=0); yd[k] -= y[k].mean()
    b1, b2 = [float(v) for v in np.linalg.lstsq(Xd, yd, rcond=None)[0]]
    va = d[d['Variable'] == 'VA']
    tot = va[AGR + IND + SRV].sum(axis=1, min_count=10)
    i = va[(va['Country'] == US_REF[0]) & (va['Year'] == US_REF[1])].index[0]
    share = float(va.loc[i, GOODS].sum() / tot[i])
    y_us = float(m[(m['iso3'] == US_REF[0]) & (m['year'] == US_REF[1])]['gdppc'].iloc[0])
    units_us = share * y_us / (GOODS_PER_FOOD * usd_per_t)  # 1 人 (100 万人) あたりの工業品 [単位/年]。1 単位の値段 = 4 × 食料 1 単位 (100 万 t × anchor)
    l = np.log(y_us)
    b0 = float(np.log(units_us) - b1 * l - b2 * l * l)
    # 研究者の数
    r = pd.read_csv(RESEARCH)
    s = r[r['indicator'] == 'SP.POP.SCIE.RD.P6'][['iso3', 'year', 'value']].merge(m[['iso3', 'year', 'gdppc']], on=['iso3', 'year']).dropna()
    s = s[s['value'] > 0]
    xs = np.log(s['gdppc'].to_numpy())
    rb = [float(v) for v in np.linalg.lstsq(np.column_stack([np.ones_like(xs), xs]), np.log(s['value'].to_numpy()), rcond=None)[0]]
    def at(ys, f):
        return {str(int(v)): round(float(f(np.log(v))), 4) for v in ys}
    grid = [1000, 2000, 5000, 8000, 15000, 25000, 50000]
    return {'note': '所得 y は 1 人あたり 2011 年の国際ドル。serv = logit(a + b ln y) のサービスの就業の割合、goods = exp(c0 + c1 ln y + c2 ln y²) の工業品の需要 [単位/100 万人/年]、research = exp(d0 + d1 ln y) の研究者 [人/100 万人]',
            'services': {'logit': serv, 'n': int(len(ggdc_emp)), 'at': at(grid, lambda l: 1 / (1 + np.exp(-(serv[0] + serv[1] * l))))},
            'goods': {'coef': [b0, b1, b2], 'n': int(len(e)), 'countries': int(e['iso3'].nunique()), 'us_share_of_va': share, 'us_income': y_us, 'us_units_per_million': units_us,
                      'at': at(grid, lambda l: np.exp(b0 + b1 * l + b2 * l * l)), 'elasticity_at': at(grid, lambda l: b1 + 2 * b2 * l)},
            'research': {'coef': rb, 'n': int(len(s)), 'countries': int(s['iso3'].nunique()), 'years': [int(s['year'].min()), int(s['year'].max())], 'at': at(grid, lambda l: np.exp(rb[0] + rb[1] * l))}}

MIN_POP = 1.0       # 比べる星系・年の人口の下限 [100 万人] (R10 の sim)
MIN_ROWS = 10       # 銀河の中で、分位に値があるとみなす星系・年の数
def game(path):
    """ゲームのパネルを、実データ (GGDC) の分位の境目で分け、銀河ごとの中央値と頂点 (peak。実データと同じ関数) を出して R10 を判定する。"""
    real = json.load(open(OUT, encoding='utf-8'))
    with open(os.path.join(HERE, '..', '..', 'targets', 'targets.json'), encoding='utf-8') as f:
        tgt = next(r for r in json.load(f)['realism'] if r['id'] == 'R10')
    qs = tgt['quintiles']
    edges = [qs[0]['income'][0]] + [q['income'][1] for q in qs]
    p = pd.read_csv(path)
    p = p[p['pop'] >= MIN_POP]
    gal = sorted(p['galaxy'].unique())
    per = {q: {k: [] for k in ('agr', 'ind', 'srv')} for q in range(5)}
    peaks, outside = [], {'below': 0, 'above': 0}
    for gx in gal:
        d = p[p['galaxy'] == gx]
        outside['below'] += int((d['gdppc'] < edges[0]).sum())
        outside['above'] += int((d['gdppc'] > edges[-1]).sum())
        d = d[(d['gdppc'] >= edges[0]) & (d['gdppc'] <= edges[-1])]
        b = np.clip(np.searchsorted(edges, d['gdppc'], side='right') - 1, 0, 4)
        for q in range(5):
            s = d[b == q]
            if len(s) >= MIN_ROWS:
                for k in per[q]:
                    per[q][k].append(float(s[k].median()))
        v = peak(p[p['galaxy'] == gx])[0] if p[p['galaxy'] == gx]['iso3'].nunique() > 1 and len(p[p['galaxy'] == gx]) > 3 else float('nan')
        peaks.append(v)
    n = len(gal)
    res = {'galaxies': n, 'rows': int(len(p)), 'outside_rows': outside, 'quintiles': [], 'pass': True}
    judged = 0
    for q in range(5):
        row = {'income': qs[q]['income'], 'galaxies': len(per[q]['agr'])}
        if len(per[q]['agr']) * 2 >= n and n:
            judged += 1
            for k in ('agr', 'ind', 'srv'):
                m = float(np.median(per[q][k]))
                ok = qs[q][k][0] <= m <= qs[q][k][1]
                row[k] = {'game': round(m, 3), 'real': qs[q][k], 'ok': ok}
                res['pass'] &= ok
        res['quintiles'].append(row)
    res['judged'] = judged
    if judged < 3:
        res['pass'] = False
    pk = np.array(peaks, float)
    has = np.isfinite(pk)
    res['peak'] = {'galaxies_with_peak': int(has.sum()), 'median': float(np.median(pk[has])) if has.any() else None, 'band': tgt['band']}
    res['peak']['ok'] = bool(has.sum() * 2 >= n and res['peak']['median'] is not None and tgt['band'][0] <= res['peak']['median'] <= tgt['band'][1])
    res['pass'] = bool(res['pass'] and res['peak']['ok'])
    lo = p['gdppc'].quantile([.1, .5, .9]).round(0).tolist() if len(p) else []
    res['income_p10_p50_p90'] = lo
    print(json.dumps(res, ensure_ascii=False, indent=1))
    return 0

def main():
    if len(sys.argv) > 2 and sys.argv[1] == '--game':
        return game(sys.argv[2])
    res = {'note': '割合は 0〜1。所得は ggdc = 2011 年の国際ドル (Maddison 2023)、wdi = 2021 年の国際ドル (PPP)。分位の帯は [下, 中央, 上] = 25%・50%・75% 点',
           'ggdc': facts(ggdc()), 'wdi': facts(wdi()), 'anchor': anchor()}
    g = res['ggdc']
    res['structure'] = {**structure(ggdc(), res['anchor']['usd_per_t']),
                        'stages': {'edges_usd': [g['quintiles'][0]['income'][1], g['industry_peak_income'], g['quintiles'][3]['income'][1]],
                                   'note': '農業期 → 工業化期 (第 1 分位の上端) → 成熟期 (工業の頂点) → 脱工業期 (第 4 分位の上端)'}}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    a = res['anchor']
    print(f"物差し: {a['year']} 年の世界の穀物 1 t = {a['usd_per_t']:.1f} ドル ({', '.join(f'{k} {v:.1f}' for k, v in a['prices_usd_per_t'].items())})")
    for k in ('ggdc', 'wdi'):
        r = res[k]
        print(f"{k}: {r['countries']} か国・{r['years']}・工業の頂点の所得 {r['industry_peak_income']:.0f} (5〜95%: {r['industry_peak_band_5_95'][0]:.0f}〜{r['industry_peak_band_5_95'][1]:.0f})")
        for q in r['quintiles']:
            print(f"  所得 {q['income'][0]:8.0f}〜{q['income'][1]:8.0f}: 農業 {q['agr'][0]:.2f}〜{q['agr'][2]:.2f}  工業 {q['ind'][0]:.2f}〜{q['ind'][2]:.2f}  サービス {q['srv'][0]:.2f}〜{q['srv'][2]:.2f}")
    st = res['structure']
    print(f"曲線: サービス logit {st['services']['logit']}、工業品 {st['goods']['coef']} (米国 {US_REF[1]} 年 {st['goods']['us_units_per_million']:.2f} 単位/100 万人)、研究者 {st['research']['coef']}")
    for k in ('services', 'goods', 'research'):
        print(f"  {k}: {st[k]['at']}")

if __name__ == '__main__':
    sys.exit(main())
