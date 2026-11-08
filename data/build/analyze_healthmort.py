#!/usr/bin/env python3
"""政府の医療の支出と死亡率の弾力性を推定する (医療の水準 L → 死亡のハザードの倍率。docs/research/health-mortality.md)。

問い: 実質の 1 人あたりの政府の医療の支出が 1% 変わると、65 歳以上 (と 15〜60 歳) の死亡のハザードは何 % 変わるか。
単位: 国 × 重ならない 5 年の変化 (2000→2005・2005→2010・2010→2015・2015→2019。2020 年からはコロナの年なので使わない)。
式 (一階差分。国の固定効果を差で消す):
  Δln μ = 期間の固定効果 + β Δln (支出) + γ Δln (1 人あたり GDP) + 誤差
  μ65 = 65 歳の死亡のハザードの水準。WPP の 65 歳の平均余命 e65 から、ゴンペルツのハザード μ(x) = μ65 exp(b (x − 65)) を仮定して逆算する
        (b = 0.095。0.08・0.11 で感度を見る。年齢 65〜165 歳を 0.01 年きざみで積分して e65 を出し、ln μ65 の細かい格子から線形補間で戻す)
  μa = 15〜60 歳の平均のハザード = −ln (1 − 45q15) ÷ 45 (WDI の成人の死亡率。男女のハザードの平均)
  支出 = (GDP 比 % ÷ 100) × 1 人あたり GDP (PPP、2021 年の国際ドル)。政府 (SH.XPD.GHED.GD.ZS) と経常の合計 (SH.XPD.CHEX.GD.ZS) の 2 つ
選び方 (順に。数を JSON の counts に書く):
  0 候補 = WDI のすべての国 (217) × 4 つの窓
  1 両端の年に、政府と合計の医療の支出・1 人あたり GDP・人口・e65 がそろう
  2 初めの年の人口が 100 万人以上
  3 武力紛争がない: 窓の年 (t0〜t1、両端を含む) に国の中で起きた戦闘の死者 (UCDP Battle-Related Deaths 26.1 の best。
    戦闘の場所 gwno_battle が複数の国なら、それぞれの国に全部を数える) の合計が、初めの年の人口の 10 万人に 1 人以上なら除く。
    感度: 厳しい (年 25 人以上の紛争の年が 1 つでもあれば除く)・戦争だけ (UCDP/PRIO で intensity 2 = 年 1,000 人以上の紛争の年があれば除く)・なし
  4 ありえない飛び: 5 年で政府か合計の医療の支出の GDP 比が 2 倍を超えて増えるか半分より減る (|Δln| > ln 2。会計の切れ目のしるし)、
    |Δln 1 人あたり GDP| > 0.6 (年 +12.7% を超える伸びか、45% を超える落ち込み)、|Δe65| > 2 年
  5 頑健な回帰 (Huber、k = 1.345、尺度は MAD) の標準化した残差 (残差 ÷ (尺度 × √(1 − てこ比))) の絶対値が 3 を超えるか、
    最小二乗の Cook の距離が 4 ÷ n を超える観測を除く。65 歳以上は政府と合計の 2 つの式のどちらかで当たれば除く (2 つを同じ標本で推定するため)。
    15〜60 歳は同じやり方を、4 のあとの標本に別に当てる
推定: 選んだ標本の最小二乗。標準誤差は国でまとめたもの (CR1)。95% 信頼区間は国を引き直すブートストラップ (2,000 回、乱数の種 1) の 2.5〜97.5% 点。
頑健さ: 候補の段ごと・期間ごと・所得の 3 分位ごと・データの質 (死亡の登録の完全さ ≥ 90% の国・世界銀行の高所得国)・地域を 1 つずつ抜く・
       ゴンペルツの b・紛争の決め方・飛びの除き方・初めの水準を入れる・人口の重み・Huber・長い差 (2000→2019)・前の窓の支出 (遅れ)・
       次の窓の支出 (先取りの偽の検定)・政府と民間を一緒に・減らす向きと増やす向きを分ける・選び方ごと引き直すブートストラップ。
       死亡の登録 ≥ 90% の部分標本でも、期間ごと・地域を抜くなどを見る (WPP の e65 は、死亡の登録が不十分な国ではモデルで埋めた値で、
       5 年の変化に支出の効き目が出にくいため)。死亡の登録 = SP.REG.DTHS.ZS の国ごとの年の中央値
ゲームへの写し方: ln 0 は定まらないので、合計の支出の弾力性 β_tot と政府の割合 s から 倍率 = (s L + (1 − s))^β_tot。L = 0, 0.5, 1, 2, 3 の値と、β_tot の
       ブートストラップの点から出した 95% の幅を書く。推奨は、死亡の登録 ≥ 90% の国の β_tot と高所得国の s の中央値の組 (mapping.recommended_65)。
       全部の国の β_tot・長い差・政府の弾力性そのまま (L^β_pub) も alternatives_65 に書く。15〜60 歳は推奨なし (倍率 1)

使い方: python3 data/build/analyze_healthmort.py → data/derived/healthmort.json (numpy と pandas が要る。約 20 秒)
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'healthmort')
WPP = os.path.join(HERE, '..', 'raw', 'demography', 'wpp_indicators.csv.gz')
OUT = os.path.join(HERE, '..', 'derived', 'healthmort.json')
WINDOWS = [(2000, 2005), (2005, 2010), (2010, 2015), (2015, 2019)]
B_GOMP, B_SENS = 0.095, (0.08, 0.11)
POP_MIN = 1e6
BRD_PER = 1e-5  # 窓の中の戦闘の死者 ÷ 人口 (10 万人に 1 人)
JUMP_SHARE, JUMP_GDP, JUMP_LE65 = np.log(2), 0.6, 2.0
HUBER_K, RESID_MAX = 1.345, 3.0
BOOT, BOOT_SUB, BOOT_PIPE, SEED = 2000, 1000, 1000, 1
LEVELS = [0, 0.5, 1, 2, 3]
NAMES = {'SH.XPD.GHED.GD.ZS': 'ghed', 'SH.XPD.CHEX.GD.ZS': 'che', 'SH.XPD.GHED.CH.ZS': 'gshare', 'NY.GDP.PCAP.PP.KD': 'gdppc',
         'SP.POP.TOTL': 'pop', 'SP.DYN.AMRT.MA': 'am', 'SP.DYN.AMRT.FE': 'af', 'SP.REG.DTHS.ZS': 'vr'}
VR_MIN = 90  # 死亡の登録の完全さ (年の中央値、%) がこれ以上の国を「死亡率が測られている国」とする
# Gleditsch–Ward の国の番号 → ISO3 (UCDP の 1995〜2022 年に出てくるもの。足りなければ止める)
GW = {2: 'USA', 41: 'HTI', 70: 'MEX', 90: 'GTM', 100: 'COL', 101: 'VEN', 130: 'ECU', 135: 'PER', 200: 'GBR', 211: 'BEL', 220: 'FRA',
      290: 'POL', 338: 'MLT', 339: 'ALB', 343: 'MKD', 344: 'HRV', 345: 'SRB', 346: 'BIH', 365: 'RUS', 369: 'UKR', 371: 'ARM', 372: 'GEO',
      373: 'AZE', 404: 'GNB', 432: 'MLI', 433: 'SEN', 434: 'BEN', 435: 'MRT', 436: 'NER', 437: 'CIV', 438: 'GIN', 439: 'BFA', 450: 'LBR',
      451: 'SLE', 461: 'TGO', 471: 'CMR', 475: 'NGA', 482: 'CAF', 483: 'TCD', 484: 'COG', 490: 'COD', 500: 'UGA', 501: 'KEN', 510: 'TZA',
      516: 'BDI', 517: 'RWA', 520: 'SOM', 522: 'DJI', 530: 'ETH', 531: 'ERI', 540: 'AGO', 541: 'MOZ', 565: 'NAM', 570: 'LSO', 581: 'COM',
      615: 'DZA', 616: 'TUN', 620: 'LBY', 625: 'SDN', 626: 'SSD', 630: 'IRN', 640: 'TUR', 645: 'IRQ', 651: 'EGY', 652: 'SYR', 660: 'LBN',
      663: 'JOR', 666: 'ISR', 670: 'SAU', 678: 'YEM', 694: 'QAT', 696: 'ARE', 700: 'AFG', 702: 'TJK', 703: 'KGZ', 704: 'UZB', 710: 'CHN',
      750: 'IND', 760: 'BTN', 770: 'PAK', 771: 'BGD', 775: 'MMR', 780: 'LKA', 790: 'NPL', 800: 'THA', 811: 'KHM', 820: 'MYS', 840: 'PHL',
      850: 'IDN', 900: 'AUS', 910: 'PNG'}


# ---- 死亡のハザード ----

def gompertz_inverse(b):
    """e65 → ln μ65 (ゴンペルツ μ(x) = μ65 exp(b (x − 65)))。生存 S(t) = exp(−(μ65 ÷ b)(e^{bt} − 1)) を 0〜100 年で台形の積分"""
    t = np.arange(0, 100.0001, 0.01)
    g = (np.exp(b * t) - 1) / b
    lm = np.linspace(-7, 0, 7001)
    s = np.exp(-np.exp(lm)[:, None] * g[None, :])
    e = ((s[:, 1:] + s[:, :-1]) / 2).sum(axis=1) * 0.01  # lm が増えると e は減る
    return lambda x: np.interp(x, e[::-1], lm[::-1], left=np.nan, right=np.nan), (lm, e)


def gompertz_e65(mu, b):
    t = np.arange(0, 100.0001, 0.01)
    s = np.exp(-mu * (np.exp(b * t) - 1) / b)
    return float(((s[1:] + s[:-1]) / 2).sum() * 0.01)


# ---- データ ----

def load():
    cs = pd.read_csv(os.path.join(RAW, 'wdi_countries.csv'), keep_default_na=False)
    w = pd.read_csv(os.path.join(RAW, 'wdi_health.csv.gz'))
    p = w.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').rename(columns=NAMES)
    idx = pd.MultiIndex.from_product([cs['iso3'], range(1995, 2023)], names=['iso3', 'year'])
    p = p.reindex(idx).reset_index()
    ind = pd.read_csv(WPP, usecols=['ISO3_code', 'Time', 'LE65']).rename(columns={'ISO3_code': 'iso3', 'Time': 'year'})
    p = p.merge(ind.dropna(subset=['iso3']), on=['iso3', 'year'], how='left')
    p['pub'] = p['ghed'] / 100 * p['gdppc']
    p['tot'] = p['che'] / 100 * p['gdppc']
    p['priv'] = p['tot'] - p['pub']
    p['mua'] = (-np.log(1 - p['am'] / 1000) - np.log(1 - p['af'] / 1000)) / 2 / 45
    for b in (B_GOMP, *B_SENS):
        inv, _ = gompertz_inverse(b)
        p[f'lmu_{b}'] = inv(p['LE65'].to_numpy())
    return cs, p


def conflict(cs):
    """国 × 年の戦闘の死者 (gwno_battle の国ごとに全部を数える)、紛争の年があるか、戦争 (intensity 2) の年があるか"""
    brd = pd.read_csv(os.path.join(RAW, 'ucdp_brd_conf_261.csv.gz'), dtype=str)
    acd = pd.read_csv(os.path.join(RAW, 'ucdp_prio_acd_261.csv.gz'), dtype=str)
    m = brd.merge(acd[['conflict_id', 'year', 'intensity_level']], on=['conflict_id', 'year'], how='left')
    assert m['intensity_level'].notna().all(), 'BRD の紛争の年が ACD にない'
    rows = []
    for _, r in m.iterrows():
        y = int(r['year'])
        for g in str(r['gwno_battle']).split(','):
            g = int(g)
            if 1995 <= y <= 2022:
                assert g in GW, f'GW {g} の ISO3 がない'
            if g in GW:
                rows.append((GW[g], y, float(r['bd_best']), int(r['intensity_level'])))
    c = pd.DataFrame(rows, columns=['iso3', 'year', 'bd', 'intensity'])
    c = c.groupby(['iso3', 'year']).agg(bd=('bd', 'sum'), war=('intensity', lambda s: int((s == 2).any())), n=('bd', 'size')).reset_index()
    missing = sorted(set(c['iso3']) - set(cs['iso3']))
    return c, missing


def windows(cs, p, c):
    v = p.set_index(['iso3', 'year'])
    cols = ['pub', 'tot', 'priv', 'gdppc', 'pop', 'LE65', 'ghed', 'che', 'gshare', 'mua', *[f'lmu_{b}' for b in (B_GOMP, *B_SENS)]]
    reg = dict(zip(cs['iso3'], cs['region']))
    inc = dict(zip(cs['iso3'], cs['income']))
    cy = c.set_index(['iso3', 'year'])
    out = []
    for t0, t1 in WINDOWS:
        a = v.xs(t0, level='year')[cols]
        b = v.xs(t1, level='year')[cols]
        d = a.add_suffix('0').join(b.add_suffix('1'))
        d['t0'], d['t1'] = t0, t1
        d = d.reset_index()
        d['region'] = d['iso3'].map(reg)
        d['income'] = d['iso3'].map(inc)
        bd, any_, war = [], [], []
        for iso in d['iso3']:
            k = [(iso, y) for y in range(t0, t1 + 1) if (iso, y) in cy.index]
            bd.append(sum(cy.at[x, 'bd'] for x in k))
            any_.append(len(k) > 0)
            war.append(any(cy.at[x, 'war'] for x in k))
        d['brd'], d['conf_any'], d['conf_war'] = bd, any_, war
        out.append(d)
    d = pd.concat(out, ignore_index=True)
    for k in ('pub', 'tot', 'priv', 'gdppc', 'ghed', 'che', 'mua'):
        d['d' + k] = np.log(d[k + '1']) - np.log(d[k + '0'])
    for b in (B_GOMP, *B_SENS):
        d[f'dlmu_{b}'] = d[f'lmu_{b}1'] - d[f'lmu_{b}0']
    d['dlmu'] = d[f'dlmu_{B_GOMP}']
    d['lmu0'] = d[f'lmu_{B_GOMP}0']
    d['lgdp0'] = np.log(d['gdppc0'])
    d['dle65'] = d['LE651'] - d['LE650']
    d['brd_rate'] = d['brd'] / d['pop0']
    vr = p.dropna(subset=['vr']).groupby('iso3')['vr'].median()
    d['vr_med'] = d['iso3'].map(vr)
    d['vr_good'] = d['vr_med'] >= VR_MIN
    # 前の窓 (t0 − 5 → t0) と次の窓 (t1 → t1 + 5) の支出の変化 (遅れと先取りの検定)
    key = d.set_index(['iso3', 't1'])['dpub']
    d['dpub_lag'] = [key.get((i, t), np.nan) for i, t in zip(d['iso3'], d['t0'])]
    key = d.set_index(['iso3', 't0'])['dpub']
    d['dpub_lead'] = [key.get((i, t), np.nan) for i, t in zip(d['iso3'], d['t1'])]
    return d


# ---- 回帰 ----

def design(d, xs, ctrl=('dgdppc',)):
    cols = [d[x].to_numpy(float) for x in (*xs, *ctrl)]
    ts = sorted(d['t0'].unique())
    cols += [(d['t0'].to_numpy() == t).astype(float) for t in ts]  # 期間の固定効果 (定数の代わり)
    return np.column_stack(cols)


def ols(y, X, w=None):
    if w is None:
        b = np.linalg.lstsq(X, y, rcond=None)[0]
    else:
        s = np.sqrt(w)
        b = np.linalg.lstsq(X * s[:, None], y * s, rcond=None)[0]
    return b, y - X @ b


def cluster_se(X, u, g, w=None):
    """国でまとめた標準誤差 (CR1)"""
    n, k = X.shape
    Xw = X if w is None else X * w[:, None]
    bread = np.linalg.pinv(X.T @ Xw)
    meat = np.zeros((k, k))
    gs = np.unique(g)
    for c in gs:
        m = g == c
        s = Xw[m].T @ u[m]
        meat += np.outer(s, s)
    G = len(gs)
    v = bread @ meat @ bread * G / (G - 1) * (n - 1) / (n - k)
    return np.sqrt(np.diag(v))


def hat(X):
    q, _ = np.linalg.qr(X)
    return (q * q).sum(axis=1)


def huber(y, X, k=HUBER_K, it=200):
    b, r = ols(y, X)
    for _ in range(it):
        s = np.median(np.abs(r - np.median(r))) / 0.6745
        u = np.abs(r) / s
        w = np.where(u <= k, 1.0, k / np.maximum(u, 1e-12))
        bn, _ = ols(y, X, w)
        done = np.max(np.abs(bn - b)) < 1e-10
        b, r = bn, y - X @ bn
        if done:
            break
    s = np.median(np.abs(r - np.median(r))) / 0.6745
    return b, r, s


def outliers(y, X):
    """頑健な回帰の標準化した残差 > 3 か、Cook の距離 > 4 ÷ n"""
    n, k = X.shape
    h = hat(X)
    _, r, s = huber(y, X)
    z = r / (s * np.sqrt(1 - h))
    _, e = ols(y, X)
    s2 = (e @ e) / (n - k)
    cook = e ** 2 / (k * s2) * h / (1 - h) ** 2
    return (np.abs(z) > RESID_MAX) | (cook > 4 / n), np.abs(z) > RESID_MAX, cook > 4 / n


def fit(d, y, xs, ctrl=('dgdppc',), weight=None, boot=BOOT, seed=SEED, robust=False):
    """最小二乗 (と国でまとめた標準誤差・国を引き直すブートストラップ)。xs の係数を返す"""
    d = d.dropna(subset=[y, *xs, *ctrl])
    X, Y, g = design(d, xs, ctrl), d[y].to_numpy(float), d['iso3'].to_numpy()
    w = None if weight is None else d[weight].to_numpy(float)
    if robust:
        b, u, _ = huber(Y, X)
        se = np.full(len(b), np.nan)
    else:
        b, u = ols(Y, X, w)
        se = cluster_se(X, u, g, w)
    res = {'n': int(len(d)), 'countries': int(len(np.unique(g)))}
    draws = None
    if boot:
        rng = np.random.default_rng(seed)
        cs = np.unique(g)
        rows = [np.flatnonzero(g == c) for c in cs]
        draws = []
        for _ in range(boot):
            idx = np.concatenate([rows[i] for i in rng.integers(0, len(cs), len(cs))])
            Xb = X[idx]
            keep = Xb.any(axis=0)  # 引き直しで空になった期間の列を除く
            Xb = Xb[:, keep]
            if robust:
                bb = huber(Y[idx], Xb)[0]
            else:
                bb = ols(Y[idx], Xb, None if w is None else w[idx])[0]
            draws.append(bb[:len(xs)])
        draws = np.array(draws)
    for j, x in enumerate(xs):
        r = {'b': float(b[j]), 'se': float(se[j]) if np.isfinite(se[j]) else None}
        if draws is not None:
            lo, hi = np.quantile(draws[:, j], [0.025, 0.975])
            r['ci'] = [float(lo), float(hi)]
            r['p_boot_pos'] = float((draws[:, j] > 0).mean())  # ブートストラップで正になった割合
        res[x] = r
    return res, (None if draws is None else draws[:, 0])


def rnd(x, k=4):
    if isinstance(x, dict):
        return {a: rnd(v, k) for a, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [rnd(v, k) for v in x]
    if isinstance(x, (float, np.floating)):
        return None if not np.isfinite(x) else round(float(x), k)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


# ---- 選び方 ----

def jumps(d):
    return ((np.abs(d['dghed']) > JUMP_SHARE) | (np.abs(d['dche']) > JUMP_SHARE) | (np.abs(d['dgdppc']) > JUMP_GDP)
            | (np.abs(d['dle65']) > JUMP_LE65))


def robust_drop(d, y, specs):
    """specs (説明の変数の組) のどれかで外れ値なら除く"""
    flag = np.zeros(len(d), bool)
    detail = {}
    for xs in specs:
        X, Y = design(d, xs), d[y].to_numpy(float)
        f, fz, fc = outliers(Y, X)
        detail['+'.join(xs)] = {'resid': int(fz.sum()), 'cook': int(fc.sum()), 'either': int(f.sum())}
        flag |= f
    return flag, detail


def select(d, conflict_rule='main', jump=True, robust=True, y='dlmu', specs=(('dpub',), ('dtot',))):
    """候補から選んだ標本までの段ごとの標本 (段の名前, 標本, メモ)"""
    steps = [('0 候補 (国 × 窓)', d, None)]
    need = ['pub0', 'pub1', 'tot0', 'tot1', 'gdppc0', 'gdppc1', 'pop0', 'pop1', 'LE650', 'LE651']
    if y == 'dmua':
        need += ['mua0', 'mua1']
    s = d.dropna(subset=need)
    steps.append(('1 両端の年のデータがそろう', s, None))
    s = s[s['pop0'] >= POP_MIN]
    steps.append(('2 人口 100 万人以上', s, None))
    if conflict_rule == 'main':
        s = s[s['brd_rate'] < BRD_PER]
    elif conflict_rule == 'strict':
        s = s[~s['conf_any']]
    elif conflict_rule == 'war':
        s = s[~s['conf_war']]
    steps.append(('3 武力紛争がない', s, None))
    if jump:
        s = s[~jumps(s)]
    steps.append(('4 ありえない飛びがない', s, None))
    note = None
    if robust:
        f, note = robust_drop(s, y, specs)
        s = s[~f]
    steps.append(('5 頑健な回帰の外れ値でない', s, note))
    return steps


# ---- 本体 ----

def counts_of(steps):
    out, prev = [], None
    for name, s, note in steps:
        r = {'step': name, 'n': int(len(s)), 'countries': int(s['iso3'].nunique()), 'removed': None if prev is None else int(prev - len(s))}
        if note:
            r['detail'] = note
        out.append(r)
        prev = len(s)
    return out


def long_diff(p, keep):
    """長い差 (2000→2019。国に 1 つ)。4 つの窓のどれでも選ばれた国 (keep) だけ"""
    v = p.set_index(['iso3', 'year'])
    a, b = v.xs(2000, level='year'), v.xs(2019, level='year')
    ld = pd.DataFrame({'dpub': np.log(b['pub'] / a['pub']), 'dtot': np.log(b['tot'] / a['tot']), 'dgdppc': np.log(b['gdppc'] / a['gdppc']),
                       'dlmu': b[f'lmu_{B_GOMP}'] - a[f'lmu_{B_GOMP}'], 'dmua': np.log(b['mua'] / a['mua'])}).reset_index()
    ld['t0'] = 2000
    return ld[ld['iso3'].isin(keep)].dropna(subset=['dpub', 'dtot', 'dgdppc', 'dlmu'])


def make_row(rob):
    def row(group, name, s, xs=('dpub',), y='dlmu', ctrl=('dgdppc',), weight=None, robust=False, boot=BOOT_SUB):
        if len(s) < 15:
            rob.append({'group': group, 'name': name, 'n': int(len(s)), 'skip': '観測が少ない'})
            return
        r, _ = fit(s, y, list(xs), ctrl=ctrl, weight=weight, robust=robust, boot=boot)
        out = {'group': group, 'name': name, 'n': r['n'], 'countries': r['countries']}
        for x in xs:
            out[x] = r[x]
        rob.append(out)
    return row


def dist(s):
    s = s.dropna()
    qs = [0, .01, .05, .25, .5, .75, .95, .99, 1]
    return {'n': int(len(s)), **{f'p{int(q * 100)}': float(s.quantile(q)) for q in qs}}


def main():
    cs, p = load()
    c, missing = conflict(cs)
    d = windows(cs, p, c)
    inv, _ = gompertz_inverse(B_GOMP)
    mu20 = float(np.exp(inv(np.array([20.0]))[0]))
    gcheck = {f'{x}': {'lmu65': float(inv(np.array([x]))[0]), 'mu65': float(np.exp(inv(np.array([x]))[0])),
                       'e65_back': gompertz_e65(float(np.exp(inv(np.array([x]))[0])), B_GOMP)} for x in (10.0, 15.0, 20.0)}

    # ---- 65 歳以上: 選び方 ----
    steps = select(d)
    sel = steps[-1][1].copy()
    counts = counts_of(steps)
    s2, s3 = steps[2][1], steps[3][1]
    conflict_counts = {'main (戦闘の死者 ≥ 人口 10 万人に 1 人)': int((s2['brd_rate'] >= BRD_PER).sum()),
                       'strict (年 25 人以上の紛争の年がある)': int(s2['conf_any'].sum()),
                       'war (年 1,000 人以上の紛争の年がある)': int(s2['conf_war'].sum())}
    jump_counts = {'政府の医療の支出の GDP 比 |Δln| > ln 2': int((np.abs(s3['dghed']) > JUMP_SHARE).sum()),
                   '合計の医療の支出の GDP 比 |Δln| > ln 2': int((np.abs(s3['dche']) > JUMP_SHARE).sum()),
                   '|Δln 1 人あたり GDP| > 0.6': int((np.abs(s3['dgdppc']) > JUMP_GDP).sum()),
                   '|Δe65| > 2 年': int((np.abs(s3['dle65']) > JUMP_LE65).sum()),
                   'どれか': int(jumps(s3).sum())}
    jumped = s3[jumps(s3)][['iso3', 't0', 'dghed', 'dche', 'dgdppc', 'dle65']].round(3).to_dict('records')
    dropped5 = sorted(set(map(tuple, steps[4][1][['iso3', 't0']].values.tolist())) - set(map(tuple, sel[['iso3', 't0']].values.tolist())))
    vr = sel[sel['vr_good']]

    # ---- 15〜60 歳: 選び方 (外れ値は別に) ----
    asteps = select(d, y='dmua')
    asel = asteps[-1][1].copy()
    avr = asel[asel['vr_good']]

    # 長い差 (2000→2019): 4 つの窓すべてで選ばれた国
    allwin = sel.groupby('iso3')['t0'].nunique()
    ld = long_diff(p, set(allwin[allwin == len(WINDOWS)].index))
    ld['vr_good'] = ld['iso3'].map(sel.drop_duplicates('iso3').set_index('iso3')['vr_good']).fillna(False).astype(bool)

    # ---- 主な推定 ----
    est, draws = {}, {}
    for nm, s, y in (('old', sel, 'dlmu'), ('old_vr', vr, 'dlmu'), ('old_ld', ld, 'dlmu'), ('old_ld_vr', ld[ld['vr_good']], 'dlmu'),
                     ('adult', asel, 'dmua'), ('adult_vr', avr, 'dmua')):
        for x in ('dpub', 'dtot'):
            r, dr = fit(s, y, [x, 'dgdppc'], ctrl=())
            h, _ = fit(s, y, [x, 'dgdppc'], ctrl=(), robust=True, boot=0)
            est[f'{nm}_{x}'] = {**r, 'huber': h[x]['b']}
            draws[f'{nm}_{x}'] = dr

    # ---- 頑健さ (65 歳以上、選んだ標本) ----
    rob = []
    row = make_row(rob)
    for x in ('dpub', 'dtot'):
        for name, s, _ in steps[1:]:
            row(f'段ごと ({x})', name, s, xs=(x,))
        for t0, t1 in WINDOWS:
            row(f'期間ごと ({x})', f'{t0}→{t1}', sel[sel['t0'] == t0], xs=(x,))
        q = np.quantile(sel['lgdp0'], [1 / 3, 2 / 3])
        terc = np.searchsorted(q, sel['lgdp0'])
        for k, nm in enumerate(('低い', '中ほど', '高い')):
            row(f'所得の 3 分位 ({x})', f'{nm} (初めの年の 1 人あたり GDP)', sel[terc == k], xs=(x,))
        row(f'データの質 ({x})', f'死亡の登録 ≥ {VR_MIN}%', vr, xs=(x,))
        row(f'データの質 ({x})', f'死亡の登録 < {VR_MIN}% か値なし', sel[~sel['vr_good']], xs=(x,))
        row(f'データの質 ({x})', '高所得国 (世界銀行の HIC)', sel[sel['income'] == 'HIC'], xs=(x,))
        row(f'データの質 ({x})', '高所得国でない', sel[sel['income'] != 'HIC'], xs=(x,))
        for rg in sorted(sel['region'].unique()):
            row(f'地域を抜く ({x})', f'{rg} を抜く', sel[sel['region'] != rg], xs=(x,))
        for b in B_SENS:
            row(f'ゴンペルツの b ({x})', f'b = {b}', sel, xs=(x,), y=f'dlmu_{b}')
        for rule in ('strict', 'war', 'none'):
            row(f'紛争の決め方 ({x})', rule, select(d, conflict_rule=rule)[-1][1], xs=(x,))
        row(f'飛びの除き方 ({x})', '飛びを除かない', select(d, jump=False)[-1][1], xs=(x,))
        row(f'式 ({x})', '初めの ln μ65 と ln 1 人あたり GDP を入れる', sel, xs=(x,), ctrl=('dgdppc', 'lmu0', 'lgdp0'))
        row(f'式 ({x})', '1 人あたり GDP の伸びを入れない', sel, xs=(x,), ctrl=())
        row(f'式 ({x})', '人口の重み', sel, xs=(x,), weight='pop0')
        row(f'式 ({x})', 'Huber (頑健な回帰)', sel, xs=(x,), robust=True, boot=200)
        row(f'式 ({x})', '外れ値を除かず Huber', steps[4][1], xs=(x,), robust=True, boot=200)
        row(f'長い差 ({x})', '2000→2019 (4 つの窓すべてで選ばれた国)', ld, xs=(x,))
        row(f'長い差 ({x})', f'2000→2019、死亡の登録 ≥ {VR_MIN}%', ld[ld['vr_good']], xs=(x,))
    row('時の向き (dpub)', '遅れ: 前の 5 年の Δln 政府の支出 (と今の窓の)', sel, xs=('dpub', 'dpub_lag'))
    row('時の向き (dpub)', '先取り (偽の検定): 次の 5 年の Δln 政府の支出 (と今の窓の)', sel, xs=('dpub', 'dpub_lead'))
    row('政府と民間 (同じ式)', 'Δln 政府 と Δln 民間 (合計 − 政府)', sel[(sel['priv0'] > 0) & (sel['priv1'] > 0)], xs=('dpub', 'dpriv'))
    sel = sel.assign(dpub_neg=np.minimum(sel['dpub'], 0), dpub_pos=np.maximum(sel['dpub'], 0),
                     dtot_neg=np.minimum(sel['dtot'], 0), dtot_pos=np.maximum(sel['dtot'], 0))
    row('減らす向きと増やす向き', 'Δln 政府 を負と正に分ける', sel, xs=('dpub_neg', 'dpub_pos'))
    row('減らす向きと増やす向き', 'Δln 合計 を負と正に分ける', sel, xs=('dtot_neg', 'dtot_pos'))

    # 選び方ごと引き直すブートストラップ (4 の段の標本から、国を引き直して外れ値の除き方もやり直す)
    s4 = steps[4][1]
    rng = np.random.default_rng(SEED)
    g = s4['iso3'].to_numpy()
    cl = np.unique(g)
    rows_ = [np.flatnonzero(g == x) for x in cl]
    pipe = {'dpub': [], 'dtot': []}
    for _ in range(BOOT_PIPE):
        idx = np.concatenate([rows_[i] for i in rng.integers(0, len(cl), len(cl))])
        bs = s4.iloc[idx]
        f, _ = robust_drop(bs, 'dlmu', (('dpub',), ('dtot',)))
        bs = bs[~f]
        for x in pipe:
            pipe[x].append(ols(bs['dlmu'].to_numpy(float), design(bs, [x]))[0][0])
    for x in pipe:
        a = np.array(pipe[x])
        rob.append({'group': '選び方ごと引き直すブートストラップ', 'name': f'{x} ({BOOT_PIPE} 回)', 'n': int(len(s4)),
                    x: {'b': float(np.median(a)), 'ci': [float(np.quantile(a, 0.025)), float(np.quantile(a, 0.975))], 'p_boot_pos': float((a > 0).mean())}})

    # ---- 頑健さ (65 歳以上、死亡の登録 ≥ 90% の部分標本) ----
    rvr = []
    row = make_row(rvr)
    for x in ('dpub', 'dtot'):
        for t0, t1 in WINDOWS:
            row(f'期間ごと ({x})', f'{t0}→{t1}', vr[vr['t0'] == t0], xs=(x,))
        for rg in sorted(vr['region'].unique()):
            row(f'地域を抜く ({x})', f'{rg} を抜く', vr[vr['region'] != rg], xs=(x,))
        for b in B_SENS:
            row(f'ゴンペルツの b ({x})', f'b = {b}', vr, xs=(x,), y=f'dlmu_{b}')
        row(f'式 ({x})', '初めの ln μ65 と ln 1 人あたり GDP を入れる', vr, xs=(x,), ctrl=('dgdppc', 'lmu0', 'lgdp0'))
        row(f'式 ({x})', '人口の重み', vr, xs=(x,), weight='pop0')
    vr2 = sel[sel['vr_good']]
    row('時の向き (dpub)', '遅れ: 前の 5 年の Δln 政府の支出 (と今の窓の)', vr2, xs=('dpub', 'dpub_lag'))
    row('時の向き (dpub)', '先取り (偽の検定): 次の 5 年の Δln 政府の支出 (と今の窓の)', vr2, xs=('dpub', 'dpub_lead'))
    row('政府と民間 (同じ式)', 'Δln 政府 と Δln 民間 (合計 − 政府)', vr2[(vr2['priv0'] > 0) & (vr2['priv1'] > 0)], xs=('dpub', 'dpriv'))
    row('減らす向きと増やす向き', 'Δln 政府 を負と正に分ける', vr2, xs=('dpub_neg', 'dpub_pos'))
    row('減らす向きと増やす向き', 'Δln 合計 を負と正に分ける', vr2, xs=('dtot_neg', 'dtot_pos'))

    # ---- 頑健さ (15〜60 歳) ----
    arob = []
    row = make_row(arob)
    for x in ('dpub', 'dtot'):
        for name, s, _ in asteps[1:]:
            row(f'段ごと ({x})', name, s, xs=(x,), y='dmua')
        for t0, t1 in WINDOWS:
            row(f'期間ごと ({x})', f'{t0}→{t1}', asel[asel['t0'] == t0], xs=(x,), y='dmua')
        q = np.quantile(asel['lgdp0'], [1 / 3, 2 / 3])
        terc = np.searchsorted(q, asel['lgdp0'])
        for k, nm in enumerate(('低い', '中ほど', '高い')):
            row(f'所得の 3 分位 ({x})', nm, asel[terc == k], xs=(x,), y='dmua')
        row(f'データの質 ({x})', f'死亡の登録 ≥ {VR_MIN}%', avr, xs=(x,), y='dmua')
        row(f'データの質 ({x})', '高所得国 (世界銀行の HIC)', asel[asel['income'] == 'HIC'], xs=(x,), y='dmua')
        for rg in sorted(asel['region'].unique()):
            row(f'地域を抜く ({x})', f'{rg} を抜く', asel[asel['region'] != rg], xs=(x,), y='dmua')
        row(f'式 ({x})', '初めの ln 1 人あたり GDP を入れる', asel, xs=(x,), y='dmua', ctrl=('dgdppc', 'lgdp0'))
        row(f'長い差 ({x})', '2000→2019 (65 歳以上と同じ国)', ld.dropna(subset=['dmua']), xs=(x,), y='dmua')
    row('時の向き (dpub)', '先取り (偽の検定): 次の 5 年の Δln 政府の支出 (と今の窓の)', asel, xs=('dpub', 'dpub_lead'), y='dmua')

    # ---- 政府の割合 ----
    y19 = p[(p['year'] == 2019) & (p['pop'] >= POP_MIN)].dropna(subset=['gshare']).copy()
    y19['income'] = y19['iso3'].map(dict(zip(cs['iso3'], cs['income'])))
    hic = y19.loc[y19['income'] == 'HIC', 'gshare'] / 100
    q3 = np.quantile(np.log(y19['gdppc'].dropna()), [2 / 3])[0]
    share = {
        'all_2019': {'median': float(y19['gshare'].median() / 100), 'iqr': [float(y19['gshare'].quantile(.25) / 100), float(y19['gshare'].quantile(.75) / 100)], 'n': int(len(y19))},
        'high_income_2019': {'median': float(hic.median()), 'iqr': [float(hic.quantile(.25)), float(hic.quantile(.75))], 'n': int(len(hic))},
        'top_gdp_tercile_2019': {'median': float(y19.loc[np.log(y19['gdppc']) >= q3, 'gshare'].median() / 100), 'n': int((np.log(y19['gdppc']) >= q3).sum())},
        'selected_sample_t1': {'median': float(sel['gshare1'].median() / 100), 'n': int(sel['gshare1'].notna().sum())},
        'vr_sample_t1': {'median': float(vr['gshare1'].median() / 100), 'n': int(vr['gshare1'].notna().sum())},
        'note': '2019 年・人口 100 万人以上の国。high_income は世界銀行のいまの所得の区分 (HIC)。gshare = SH.XPD.GHED.CH.ZS',
    }

    # ---- 観測の幅 ----
    ranges = {
        'dln_pub_selected': dist(sel['dpub']), 'dln_pub_candidates_step2': dist(s2['dpub']), 'dln_pub_vr': dist(vr['dpub']),
        'dln_tot_selected': dist(sel['dtot']), 'dln_tot_candidates_step2': dist(s2['dtot']), 'dln_tot_vr': dist(vr['dtot']),
        'dln_mu65_selected': dist(sel['dlmu']), 'dln_mua_selected': dist(asel['dmua']),
        'neg_dpub_share_selected': float((sel['dpub'] < 0).mean()),
        'n_dpub_below_ln_half_selected': int((sel['dpub'] < np.log(0.5)).sum()),
        'note': '5 年 (2015→2019 は 4 年) の変化。p1 は 1% 点。dln_pub = Δln 実質の 1 人あたりの政府の医療の支出',
    }

    # ---- ゲームへの写し方 ----
    def mult(beta, s, L):
        return (s * L + 1 - s) ** beta

    lo, hi = ranges['dln_tot_selected']['p0'], ranges['dln_tot_selected']['p100']

    def table(key, x, s):
        b, dr = est[key][x]['b'], draws[key]
        return {str(L): {'mult': float(mult(b, s, L)), 'ci': [float(np.quantile(mult(dr, s, L), .025)), float(np.quantile(mult(dr, s, L), .975))],
                         'dln_total': float(np.log(s * L + 1 - s)), 'inside_observed': bool(lo <= np.log(s * L + 1 - s) <= hi)} for L in LEVELS}

    s_hi, s_all = share['high_income_2019']['median'], share['all_2019']['median']
    rec = table('old_vr_dtot', 'dtot', s_hi)
    for L in LEVELS:
        rec[str(L)]['e65_change_years_at_e65_20'] = gompertz_e65(mu20 * rec[str(L)]['mult'], B_GOMP) - 20.0
    mapping = {
        'formula': 'multiplier(L) = (s L + (1 − s))^β_tot。s = 経常の医療の支出のうち政府の割合 (中央値)、β_tot = 合計の医療の支出の弾力性 (5 年)。'
                   '65 歳以上の 5 歳きざみ (ゲームの 13〜20 番目) のハザードに掛ける',
        'recommended_65': {'basis': f'old_vr_dtot (死亡の登録 ≥ {VR_MIN}% の国、合計の支出)', 'beta_total': est['old_vr_dtot']['dtot'], 'share': s_hi,
                           'implied_public_elasticity_at_L1': est['old_vr_dtot']['dtot']['b'] * s_hi,
                           'public_elasticity_same_sample': est['old_vr_dpub']['dpub'], 'values': rec,
                           'observed_dln_tot_selected': [lo, hi]},
        'alternatives_65': {
            'vr_total_share_all': table('old_vr_dtot', 'dtot', s_all),
            'pooled_total_share_high_income': table('old_dtot', 'dtot', s_hi),
            'pooled_total_share_all': table('old_dtot', 'dtot', s_all),
            'long_diff_vr_total_share_high_income': table('old_ld_vr_dtot', 'dtot', s_hi),
            'long_diff_total_share_high_income': table('old_ld_dtot', 'dtot', s_hi),
            'pooled_public_direct': {str(L): (None if L == 0 else float(L ** est['old_dpub']['dpub']['b'])) for L in LEVELS},
        },
        'adult_15_64': {'recommended': 'なし (倍率 1)。合計でも政府でも、符号がそろわず 0 をはさむ',
                        'pooled_total_share_high_income': table('adult_dtot', 'dtot', s_hi),
                        'vr_total_share_high_income': table('adult_vr_dtot', 'dtot', s_hi)},
    }

    res = {
        'note': '政府の医療の支出と死亡のハザードの弾力性 (国 × 5 年の一階差分、期間の固定効果と 1 人あたり GDP の伸びをそろえる)。data/build/analyze_healthmort.py が作る。'
                'ブートストラップは国を引き直す (乱数の種 1)。ci は 2.5〜97.5% 点、se は国でまとめた標準誤差 (CR1)、p_boot_pos はブートストラップで係数が正になった割合。'
                'old = 65 歳以上 (Δln μ65)、adult = 15〜60 歳 (Δln μa)、_vr = 死亡の登録 ≥ 90% の国だけ、_ld = 長い差 (2000→2019、国に 1 つ)、'
                'dpub = Δln 政府の支出、dtot = Δln 合計の支出。mapping の inside_observed は、その L の Δln 合計の支出が選んだ標本の 5 年の変化の最小〜最大に入るか',
        'windows': WINDOWS,
        'settings': {'gompertz_b': B_GOMP, 'gompertz_b_sens': list(B_SENS), 'pop_min': POP_MIN, 'battle_deaths_per_pop': BRD_PER,
                     'jump': {'share_dln': float(JUMP_SHARE), 'gdppc_dln': JUMP_GDP, 'le65_years': JUMP_LE65}, 'vr_min': VR_MIN,
                     'huber_k': HUBER_K, 'resid_max': RESID_MAX, 'cook': '4/n', 'boot': BOOT, 'boot_sub': BOOT_SUB, 'boot_pipeline': BOOT_PIPE, 'seed': SEED},
        'gompertz_check': gcheck,
        'ucdp_iso3_not_in_wdi': missing,
        'counts_65': counts,
        'conflict_rule_counts_after_step2': conflict_counts,
        'jump_counts_after_step3': jump_counts,
        'jumped': jumped,
        'robust_dropped': [list(x) for x in dropped5],
        'vr_sample': {'n': int(len(vr)), 'countries': sorted(vr['iso3'].unique())},
        'estimates': est,
        'robustness_65': rob,
        'robustness_65_vr': rvr,
        'counts_adult': counts_of(asteps),
        'robustness_adult': arob,
        'government_share': share,
        'ranges': ranges,
        'mapping': mapping,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(rnd(res), f, ensure_ascii=False, indent=1)
    for r in counts:
        print(r)
    for k, v in est.items():
        x = 'dpub' if 'dpub' in k else 'dtot'
        print(f"{k:16s} n={v['n']} {x} {v[x]['b']:+.4f} [{v[x]['ci'][0]:+.4f}, {v[x]['ci'][1]:+.4f}]  gdp {v['dgdppc']['b']:+.4f}")
    print(rnd(share))
    print(rnd(mapping['recommended_65']))


if __name__ == '__main__':
    sys.exit(main())
