#!/usr/bin/env python3
"""M 型星のフレアから、惑星の軌道に届く高エネルギー陽子 (>10 MeV) の 1 年のフルエンスを星ごとに作る。docs/physics.md の 6。

入力: data/raw/flares/ (data/fetch/fetch_flares.py が取る)、data/derived/stars.json
出力: data/derived/flares.json、src/index.html の FLARES:BEGIN〜FLARES:END

鎖 (どれも太陽で測られた関係を、星のフレアに当てはめる。いちばん大きな仮定は「M 型星でも太陽と同じ割合で陽子が飛び出す」こと):
  1. 星ごとのフレアの頻度: 累積の回数 R(>E) = R_c (E/E_c)^(1−α) [回/日] (E = ボロメトリックのエネルギー [erg])。
     ゲームの M 型星の TESS の光度曲線から自分で数えたもの (data/build/flares_tess.py → data/derived/tess_flares.json)。
     フレアが 5 個未満の星は、指数 α を 5 個以上の星の中央値にし、回数は (n + 0.5) / 日数。TESS の 2 分ごとの光度曲線がない星は、
     測れた星 (静かな星も含む) の中央値。突き合わせに、Günther ほか 2020 (フレアを起こす M 型星 673 個) と Galletta ほか 2025 (10 pc 以内) を使う
  2. フレアのエネルギー → X 線 (GOES 1〜8 Å) の頂点の明るさ: E = 3.3×10³¹ erg × (C/X1.4)^0.72 (Cliver ほか 2020 の式 1、新しい較正。
     Papaioannou ほか 2023 の脚注)。古い較正の値は新しいものの 0.7 倍
  3. X 線 → 1 AU の陽子のフルエンス F(>10 MeV): Papaioannou ほか 2023 の付録 C の 65 回に、同じ RMA 回帰をかけ直す。
     測った範囲 (いちばん強い X 線) より上は、回帰を延ばさず、上限の式 F ∝ F_SXR^(5/6) (Takahashi ほか 2016・Papaioannou ほか 2023 の式 5) で延ばす
  4. フレア 1 回あたりで陽子が来る割合: 同じ期間 (1984〜2017 年) の NOAA の GOES の全部のフレアの数で割る (X 線の等級ごと)
  5. 1 年のフルエンス = Σ (回数 × 割合 × フルエンス)。フレアは、1 年に 1 回起きるエネルギーまで数える (それより大きいものは 1 年に 1 回未満)
  6. 惑星までの距離 a [AU] の 2 乗で割る (ゲームの中で)
"""
import gzip, json, math, os, re, statistics

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'flares')
OUT = os.path.join(HERE, '..', 'derived', 'flares.json')
SRC = os.path.join(HERE, '..', '..', 'src', 'index.html')
YEARS = 2017 + 1 - 1984 - 0.5  # NOAA の記録の年数 (2017 年は年の途中まで: 約 34 年。1984-01〜2017-06 とみなす)
C6 = 6e-6  # Papaioannou の標本の下限 (C6.0、古い較正 [W/m²])
OLD_TO_NEW = 1 / 0.7

def sxr(cls):
    """'M2.9' → 2.9e-5 W/m² (古い較正)"""
    m = re.match(r'\s*([ABCMX])\s*([\d.]+)', cls)
    return {'A': 1e-8, 'B': 1e-7, 'C': 1e-6, 'M': 1e-5, 'X': 1e-4}[m.group(1)] * float(m.group(2))

def e_bol(F_old):
    """X 線の頂点 (古い較正) → フレアのボロメトリックのエネルギー [erg] (Cliver ほか 2020)"""
    return 3.3e31 * (F_old * OLD_TO_NEW / 1.4e-4) ** 0.72

def F_of_E(E):
    return (E / 3.3e31) ** (1 / 0.72) * 1.4e-4 / OLD_TO_NEW

def sep_events():
    tex = open(os.path.join(RAW, 'papaioannou2023_appC.tex'), encoding='utf8').read()
    rows = []
    for rec in tex.split('\\\\'):
        f = [x.strip() for x in rec.replace('\n', ' ').split('&')]
        if len(f) < 18 or not f[0].strip().isdigit(): continue
        cls = next((x for x in f[13:] if re.match(r'^[CMX]\s*[\d.]+$', x)), None)
        if not cls: continue
        rows.append({'no': int(f[0]), 'year': int(f[1]), 'F10': float(f[4]), 'F30': float(f[5]), 'F60': float(f[6]), 'F100': float(f[7]), 'cls': cls, 'sxr': sxr(cls)})
    return rows

def goes_flares():
    out = []
    for l in gzip.open(os.path.join(RAW, 'goes_xrs_1984_2017.txt.gz'), 'rt', encoding='latin1'):
        if len(l) < 63 or not l.startswith('31777'): continue
        letter, digits = l[59], l[60:63].strip()
        if letter not in 'BCMX' or not digits.isdigit(): continue
        out.append({'A': 1e-8, 'B': 1e-7, 'C': 1e-6, 'M': 1e-5, 'X': 1e-4}[letter] * int(digits) / 10)
    return out

def rma(x, y):
    n = len(x); xm = sum(x) / n; ym = sum(y) / n
    sx = math.sqrt(sum((a - xm) ** 2 for a in x) / (n - 1)); sy = math.sqrt(sum((b - ym) ** 2 for b in y) / (n - 1))
    r = sum((a - xm) * (b - ym) for a, b in zip(x, y)) / ((n - 1) * sx * sy)
    B = math.copysign(sy / sx, r)
    return {'A': ym - B * xm, 'B': B, 'r': r, 'n': n, 'scatter_dex': math.sqrt(sum((b - (ym - B * xm) - B * a) ** 2 for a, b in zip(x, y)) / (n - 2))}

BINS = [6e-6, 1e-5, 3e-5, 1e-4, 3e-4, 1e-2]

def sun():
    ev = sep_events()
    fl = [F for F in goes_flares() if F >= C6]
    fit = rma([math.log10(e['sxr']) for e in ev], [math.log10(e['F10']) for e in ev])
    fit['Fmax'] = max(e['sxr'] for e in ev)
    prob = []
    for lo, hi in zip(BINS, BINS[1:]):
        ns = sum(lo <= e['sxr'] < hi for e in ev); nf = sum(lo <= F < hi for F in fl)
        prob.append({'lo': lo, 'hi': hi, 'sep': ns, 'flares': nf, 'p': ns / nf if nf else 0})
    eps = statistics.median(math.log10(e['F10'] / e['F100']) for e in ev)  # 積分のスペクトルの指数 (10〜100 MeV の 1 桁)
    return ev, fl, fit, prob, eps

def p_of(F, prob):
    """陽子が来る割合 (X 線の等級ごとの区間の値を、区間の中心の log で直線につなぐ。両端より外は端の値)"""
    xs = [math.sqrt(b['lo'] * b['hi']) for b in prob]; ys = [b['p'] for b in prob]
    if F <= xs[0]: return ys[0]
    if F >= xs[-1]: return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= F <= xs[i + 1]:
            t = (math.log(F) - math.log(xs[i])) / (math.log(xs[i + 1]) - math.log(xs[i]))
            return ys[i] + t * (ys[i + 1] - ys[i])

def fluence_per_flare(F, fit, prob):
    lf = math.log10(F); top = math.log10(fit['Fmax'])
    if lf > top: lf_eff = fit['A'] + fit['B'] * top + (5 / 6) * (lf - top)  # 測った範囲の外は上限の式の傾き
    else: lf_eff = fit['A'] + fit['B'] * lf
    return p_of(F, prob) * 10 ** lf_eff

def annual(a, b, Emax, fit, prob, N=400):
    """累積 R(>E) = 10^b E^a [回/日] の星の、1 AU での 1 年の F(>10 MeV) [cm⁻²]"""
    Elo = e_bol(C6)
    if Emax <= Elo: return 0.0
    tot = 0.0; lo, hi = math.log(Elo), math.log(Emax)
    for i in range(N):
        E = math.exp(lo + (i + 0.5) * (hi - lo) / N); dE = E * (hi - lo) / N
        dNdE = -a * 10 ** b * E ** (a - 1) * 365.25
        tot += dNdE * dE * fluence_per_flare(F_of_E(E), fit, prob)
    return tot

def gunther():
    tic = {}
    for l in open(os.path.join(RAW, 'gunther2020_tic.csv'))[1:] if False else list(open(os.path.join(RAW, 'gunther2020_tic.csv')))[1:]:
        f = l.strip().split(',')
        if len(f) >= 3 and f[1]: tic[int(f[0])] = (float(f[1]), float(f[2]), float(f[5]) if len(f) > 5 and f[5] else None)
    rows = []
    for l in open(os.path.join(RAW, 'gunther2020_table2.txt')):
        if not l[:9].strip().isdigit(): continue
        g = lambda a, b: l[a - 1:b].strip()
        num = lambda a, b: float(g(a, b)) if g(a, b) else None
        t = int(g(1, 9))
        rows.append({'tic': t, 'sec': int(g(11, 11)), 'nfl': int(g(16, 18)), 'Emax': num(53, 61), 'teff': num(102, 106), 'spt': g(126, 131),
                     'a': num(162, 167), 'b': num(169, 175), 'pos': tic.get(t)})
    # 同じ星が 2 つのセクタにあれば、フレアの多いほうを使う
    best = {}
    for r in rows:
        if r['a'] is None or r['pos'] is None: continue
        if r['tic'] not in best or r['nfl'] > best[r['tic']]['nfl']: best[r['tic']] = r
    return list(best.values())

def galletta():
    stars = {}
    for l in open(os.path.join(RAW, 'galletta2025_stars.txt')):
        if len(l) < 46: continue
        nm = l[0:22].strip()
        ra = (int(l[23:25]) + int(l[26:28]) / 60 + float(l[29:34]) / 3600) * 15
        de = (int(l[36:38]) + int(l[39:41]) / 60 + float(l[42:46]) / 3600) * (-1 if l[35] == '-' else 1)
        stars[nm] = {'name': nm, 'ra': ra, 'de': de, 'n': []}
    for l in open(os.path.join(RAW, 'galletta2025_table3.txt')):
        nm = l[0:22].strip()
        if nm in stars and l[27:30].strip().isdigit(): stars[nm]['n'].append(int(l[27:30]))
    return list(stars.values())

def radec_of(sys_):
    """銀河座標 x, y, z [光年] → 赤経・赤緯 [度] (J2000)"""
    x, y, z = sys_['x'], sys_['y'], sys_['z']
    d = math.sqrt(x * x + y * y + z * z)
    l = math.atan2(y, x); b = math.asin(z / d)
    # 銀河座標 → 赤道座標 (IAU 1958、J2000 の極: α = 192.85948°, δ = 27.12825°, l_NCP = 122.93192°)
    ag, dg, lc = math.radians(192.85948), math.radians(27.12825), math.radians(122.93192)
    sd = math.sin(dg) * math.sin(b) + math.cos(dg) * math.cos(b) * math.cos(lc - l)
    de = math.asin(sd)
    ra = ag + math.atan2(math.cos(b) * math.sin(lc - l), math.cos(dg) * math.sin(b) - math.sin(dg) * math.cos(b) * math.cos(lc - l))
    return math.degrees(ra) % 360, math.degrees(de), d / 3.2616

def sep_deg(a, b):
    r1, d1, r2, d2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    c = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(r1 - r2)
    return math.degrees(math.acos(max(-1, min(1, c))))

def main():
    ev, fl, fit, prob, eps = sun()
    sun_pred = sum(fluence_per_flare(F, fit, prob) for F in fl) / YEARS
    sun_obs = sum(e['F10'] for e in ev) / YEARS
    G = gunther(); L = galletta()
    stars = json.load(open(os.path.join(HERE, '..', 'derived', 'stars.json')))['systems']
    game = [s for s in stars if abs(s['z']) <= 2]
    tess = json.load(open(os.path.join(HERE, '..', 'derived', 'tess_flares.json')))['stars']
    # 星ごとの当てはめ (露出で重みをつける): 下限 E_c = セクタの ED90 から出したエネルギーの中央値。E_c を拾えたセクタ (E90 ≤ E_c) だけの
    # 日数で、E_c 以上のフレアを数える。指数 α は最尤法 (α = 1 + n / Σ ln(E/E_c))、5 個未満なら中央値を使う
    for t in tess:
        secs = t['sectors']
        if not secs: t['fit'] = None; continue
        Ec = statistics.median(r['E90'] for r in secs)
        use = [r for r in secs if r['E90'] <= Ec]
        E = [fl['E'] for r in use for fl in r['flares'] if fl['E'] >= Ec]
        T = sum(r['days'] for r in use); n = len(E)
        alpha = 1 + n / sum(math.log(e / Ec) for e in E) if n >= 5 else None
        t['fit'] = {'Ec': Ec, 'n': n, 'days': T, 'sectors_used': len(use), 'rate_Ec_per_day': (n + 0.5) / T, 'alpha': alpha,
                    'alpha_err': (alpha - 1) / math.sqrt(n) if alpha else None, 'Emax_obs': max(E) if E else None}
    # 同じ星に TIC が 2 つ当たったら (伴星の温度がない時など)、測った日数の長いほうを使う
    byk = {}
    for t in tess:
        if not t.get('fit'): continue
        k = (t['cat'], t['star'])
        if k not in byk or t['fit']['days'] > byk[k]['fit']['days']: byk[k] = t
    fits = list(byk.values())
    good = [t for t in fits if t['fit']['alpha']]
    alpha_med = statistics.median(t['fit']['alpha'] for t in good)
    def rc32(t, alpha):  # 1e32 erg 以上の回数 [回/日]
        f = t['fit']; return f['rate_Ec_per_day'] * (1e32 / f['Ec']) ** (1 - alpha)
    r32_med = statistics.median(rc32(t, t['fit']['alpha'] or alpha_med) for t in fits)
    # 突き合わせ: Günther のフレアを起こす M 型星の中央値 (1e32 erg 以上の回数)、Galletta の傾き (累積) と自分の 1 − α
    gm = [r for r in G if r['teff'] and r['teff'] < 3900]
    g32 = statistics.median(10 ** r['b'] * 1e32 ** r['a'] for r in gm)
    cmp = []
    for t in good:
        sy = next(x for x in game if x['cat'] == t['cat'])
        pos = radec_of(sy)
        gl = [x for x in L if sep_deg(pos[:2], (x['ra'], x['de'])) < 1.0 and x['n']]
        if gl: cmp.append({'cat': t['cat'], 'ours_slope': 1 - t['fit']['alpha'], 'galletta_n_mean': statistics.mean(gl[0]['n'])})
    out_rows, table = [], {}
    for sy in game:
        vals = []
        for k, st in enumerate(sy['stars']):
            if st[0] != 'M': vals.append(None); continue
            t = next((x for x in fits if x['cat'] == sy['cat'] and x['star'] == k), None)
            if t:
                f = t['fit']; alpha = f['alpha'] or alpha_med
                Rc, Ec = f['rate_Ec_per_day'], f['Ec']
                src = f"TESS (TIC {t['tic']}、{f['sectors_used']} セクタ・{f['days']:.0f} 日・{f['Ec']:.1e} erg 以上 {f['n']} 個{'' if f['alpha'] else '、指数は中央値'})"
            else:
                alpha, Rc, Ec = alpha_med, r32_med, 1e32
                src = '測れた星の中央値 (TESS の 2 分ごとの光度曲線がない)'
            a = 1 - alpha; b = math.log10(Rc) - a * math.log10(Ec)
            Emax = min(1e36, Ec * (1 / (365.25 * Rc)) ** (1 / a)) if Rc * 365.25 > 1 else Ec
            F = annual(a, b, Emax, fit, prob)
            vals.append(F)
            out_rows.append({'system': sy['name'] or sy['cat'], 'cat': sy['cat'], 'star': k, 'spt': st[1], 'teff': st[4], 'alpha': alpha, 'a': a, 'b': b, 'Emax_1yr': Emax,
                             'rate_1e32_per_day': 10 ** b * 1e32 ** a, 'F10_1AU_per_yr': F, 'source': src})
        if any(v is not None for v in vals):
            table[sy['cat']] = [float(f'{v:.4g}') if v else 0 for v in [v or 0 for v in vals]]
    med = {'alpha': alpha_med, 'rate_1e32_per_day': r32_med, 'gunther_rate_1e32_per_day': g32, 'n_good': len(good), 'n_measured': len(fits)}
    tess_out = os.path.join(HERE, '..', 'derived', 'tess_flares.json')
    json.dump({'stars': tess}, open(tess_out, 'w'), indent=1, ensure_ascii=False)  # 当てはめを書き戻す
    res = {'sun': {'fit': fit, 'prob': prob, 'eps': eps, 'events': len(ev), 'goes_flares_ge_C6': len(fl), 'years': YEARS,
                   'F10_1AU_per_yr_pred': sun_pred, 'F10_1AU_per_yr_obs_wellconnected': sun_obs},
           'mdwarf': med, 'galletta_compare': cmp, 'stars': out_rows, 'game': {'sun': float(f'{sun_pred:.4g}'), 'mMedian': float(f"{statistics.median(r['F10_1AU_per_yr'] for r in out_rows):.4g}"), 'stars': table}}
    json.dump(res, open(OUT, 'w'), indent=1, ensure_ascii=False)
    block = ('/* FLARES:BEGIN (data/build/build_flares.py が書く。手で直さない) */\n'
             '// 星系の目録の名前 → 恒星ごとの、1 AU で 1 年に届くフレアの高エネルギー陽子 F(>10 MeV) [/cm²] (M 型星だけ。ほかの恒星は 0、太陽は sun)。\n'
             f'// 陽子のスペクトルは ε = 2.13 (Papaioannou ほか 2023 の中央値。Geant4 の線源。付録 C の 10〜100 MeV の比からは {eps:.2f})。docs/physics.md の 6\n'
             'const FLARES = ' + json.dumps(res['game'], separators=(',', ':'), ensure_ascii=False) + ';\n/* FLARES:END */')
    src = open(SRC, encoding='utf-8').read()
    if '/* FLARES:BEGIN' in src:
        src = re.sub(r'/\* FLARES:BEGIN.*?/\* FLARES:END \*/', lambda m: block, src, flags=re.S)
        open(SRC, 'w', encoding='utf-8').write(src)
        print('src/index.html に書いた')
    print(f"太陽: 65 回の RMA log F10 = {fit['A']:.2f} + {fit['B']:.2f} log F_SXR (r = {fit['r']:.2f}、散らばり {fit['scatter_dex']:.2f} 桁)・ε = {eps:.2f}")
    print('  陽子が来る割合:', ' / '.join(f"{b['lo']:.0e}〜{b['hi']:.0e}: {b['sep']}/{b['flares']} = {b['p']:.3f}" for b in prob))
    print(f"  1 AU の 1 年の F(>10 MeV): 鎖で {sun_pred:.2e}、よくつながった 65 回の和 {sun_obs:.2e} /cm²")
    print(f"ゲームの M 型星 (TESS で測れた {med['n_measured']} 個、当てはめ {med['n_good']} 個): α の中央値 {alpha_med:.2f}・1e32 erg 以上 {r32_med:.3f} 回/日 (Günther のフレアを起こす M 型星の中央値 {g32:.3f})")
    srcs = {}
    for r in out_rows: srcs[r['source'].split(' (')[0]] = srcs.get(r['source'].split(' (')[0], 0) + 1
    print('ゲームの M 型星:', len(out_rows), srcs)
    for r in sorted(out_rows, key=lambda r: -r['F10_1AU_per_yr'])[:12]:
        print(f"  {r['system']} [{r['star']}] {r['spt']}: α {r['alpha']:.2f}・1e32 erg 以上 {r['rate_1e32_per_day']:.2e} 回/日、F10(1 AU) {r['F10_1AU_per_yr']:.2e} /cm²/年  ← {r['source']}")

if __name__ == '__main__':
    main()
