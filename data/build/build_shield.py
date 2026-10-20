#!/usr/bin/env python3
"""Geant4 の段ごとの結果 (data/derived/g4/) を継いで、遮蔽の深さと線量の表を作り、ゲームに書きこむ。docs/physics.md の 3。

入力: data/derived/g4/<名前>_<段>.json (data/build/g4_shield.py が書く。段 k は深さ (k−1)×段の厚さ から始まる)
      data/raw/ism/pstar_water.txt・pdg_water.txt (確かめ用)
出力: data/derived/shield.json、src/index.html の SHIELD:BEGIN〜SHIELD:END

線量は、船の前面に当たる核子 1 個/cm² あたり (Gy cm² と Sv cm²)。ヘリウムの原子核は、4 核子が別々に当たるのと同じとみなす
(重ね合わせの近似。宇宙線の物理の普通のやり方。a95 の計算で確かめる)。
"""
import glob, json, math, os, re

HERE = os.path.dirname(__file__)
G4 = os.path.join(HERE, '..', 'derived', 'g4')
OUT = os.path.join(HERE, '..', 'derived', 'shield.json')
SRC = os.path.join(HERE, '..', '..', 'src', 'index.html')
RUNS = {'p95': 'FTFP_BERT・陽子 0.95c (2066.6 MeV)', 'p90': 'FTFP_BERT・陽子 0.9c (1214.2 MeV)',
        'g95': 'FTFP_BERT・横の壁の銀河宇宙線 0.95c (線量は 1 秒あたり)', 'g90': 'FTFP_BERT・横の壁の銀河宇宙線 0.9c (線量は 1 秒あたり)',
        's00': 'FTFP_BERT・惑星の地面のフレアの陽子 (ε = 2.13、全方向の F(>10 MeV) 1 /cm² あたり)', 'c00': 'FTFP_BERT・惑星の地面の銀河宇宙線 (止まった所、1 秒あたり)',
        'p95q': 'QBBC・陽子 0.95c (物理の模型の違いを見る)', 'a95': 'FTFP_BERT・ヘリウムの原子核 0.95c (8210 MeV。重ね合わせの確かめ)'}

def stitch(name):
    """段を継ぐ。段 k の深さ 0 は、全体の深さ (k−1)×段の厚さ。2 段目からの手前の板 (深さが負) で測った分は、前の段の同じ深さに足す"""
    files = sorted(glob.glob(os.path.join(G4, f'{name}_*.json')), key=lambda f: int(re.search(r'_(\d+)\.json$', f).group(1)))
    acc = {}
    for k, f in enumerate(files):
        d = json.load(open(f))
        off = k * d['args']['thick']
        for i, z in enumerate(d['depth']):
            t = round(off + z, 6)
            a = acc.setdefault(t, {'t': t, 'D': 0.0, 'v_D': 0.0, 'H': 0.0, 'v_H': 0.0, 'stage': k + 1})
            a['D'] += d['D_Gy_cm2'][i]; a['v_D'] += d['dD'][i] ** 2
            a['H'] += d['H_Sv_cm2'][i]; a['v_H'] += d['dH'][i] ** 2
    pts = []
    for t in sorted(acc):
        a = acc[t]
        pts.append({'t': t, 'D': a['D'], 'dD': math.sqrt(a['v_D']), 'H': a['H'], 'dH': math.sqrt(a['v_H']), 'stage': a['stage']})
    return pts, files

def good(pts, key, rel=0.35):
    """統計の誤差が rel より小さい点だけ (深さの順)"""
    return [p for p in pts if p[key] > 0 and p['d' + key] / p[key] < rel]

def fit_tail(pts, key, n=6):
    """一番深い n 点の、ln(線量) の重みつきの直線 → 減る長さ λ [g/cm²]"""
    q = pts[-n:]
    w = [(p[key] / p['d' + key]) ** 2 for p in q]
    x = [p['t'] for p in q]; y = [math.log(p[key]) for p in q]
    W = sum(w); xm = sum(a * b for a, b in zip(w, x)) / W; ym = sum(a * b for a, b in zip(w, y)) / W
    sxx = sum(a * (b - xm) ** 2 for a, b in zip(w, x)); sxy = sum(a * (b - xm) * (c - ym) for a, b, c in zip(w, x, y))
    slope = sxy / sxx
    return {'lambda': -1 / slope, 'lambda_err': (1 / math.sqrt(sxx)) / slope ** 2, 't_ref': q[-1]['t'], 'ln_ref': ym + slope * (q[-1]['t'] - xm)}

def pstar():
    rows = []
    for line in open(os.path.join(HERE, '..', 'raw', 'ism', 'pstar_water.txt')):
        f = line.split()
        if len(f) == 7 and re.match(r'^\d\.\d+E[+-]\d+$', f[0]):
            rows.append((float(f[0]), float(f[3]), float(f[4])))  # T [MeV]・全阻止能 [MeV cm²/g]・CSDA 飛程 [g/cm²]
    return rows

def interp_log(x, xs, ys):
    for i in range(len(xs) - 1):
        if xs[i] <= x <= xs[i + 1]:
            a = (math.log(x) - math.log(xs[i])) / (math.log(xs[i + 1]) - math.log(xs[i]))
            return math.exp(math.log(ys[i]) + a * (math.log(ys[i + 1]) - math.log(ys[i])))
    raise ValueError(x)

def checks():
    """Geant4 の先頭の粒子を、NIST PSTAR (電離の減速) と PDG (核相互作用長) に比べる"""
    out = {}
    f = os.path.join(G4, 'v95.json')
    if not os.path.exists(f): return out
    d = json.load(open(f))
    tab = pstar(); T = [r[0] for r in tab]; R = [r[2] for r in tab]
    E0 = d['args']['ke']; R0 = interp_log(E0, T, R)
    rows = []
    for z, s, ke in zip(d['depth'], d['primary_survive'], d['primary_ke']):
        if z <= 0 or s <= 0 or d['primary_survive'][d['depth'].index(z)] * d['args']['events'] < 30: continue
        e_pstar = interp_log(R0 - z, R, T)  # 飛程の表を逆に引く
        rows.append({'t': z, 'survive': s, 'ke_g4': ke, 'ke_pstar': e_pstar})
    # 生き残りの割合 exp(−t/λ) の傾き
    x = [r['t'] for r in rows]; y = [math.log(r['survive']) for r in rows]
    n = len(x); xm = sum(x) / n; ym = sum(y) / n
    lam = -sum((a - xm) ** 2 for a in x) / sum((a - xm) * (b - ym) for a, b in zip(x, y))
    pdg = float(re.search(r'Nuclear interaction length\s+([\d.]+)', open(os.path.join(HERE, '..', 'raw', 'ism', 'pdg_water.txt')).read()).group(1))
    out = {'rows': rows, 'lambda_inel_g4': lam, 'lambda_inel_pdg': pdg, 'R0_pstar': R0,
           'ke_ratio_max': max(abs(r['ke_g4'] / r['ke_pstar'] - 1) for r in rows),
           'stop_pstar_at_E0': interp_log(E0, T, [r[1] for r in tab])}
    # 止まった船の宇宙線を、火星探査機 MSL の巡航の実測 (Zeitlin ほか 2013: 0.481 mGy/日・1.84 mSv/日) と比べる。
    # MSL の測定器の周りの遮蔽は、向きの半分ほどで 10 g/cm² 未満なので、0〜10 g/cm² の平均と比べる
    f = os.path.join(G4, 'g00.json')
    if os.path.exists(f):
        d = json.load(open(f))
        sel = [i for i, z in enumerate(d['depth']) if 0 <= z <= 10]
        day = 86400 * 1e3
        out['msl'] = {'D_mGy_day': sum(d['D_Gy_cm2'][i] for i in sel) / len(sel) * day, 'H_mSv_day': sum(d['H_Sv_cm2'][i] for i in sel) / len(sel) * day,
                      'D_msl': 0.481, 'H_msl': 1.84,
                      'profile': [(z, d['D_Gy_cm2'][i] * day, d['H_Sv_cm2'][i] * day) for i, z in enumerate(d['depth'])]}
    return out

def isotonic_dec(y, w):
    """重みつきの isotonic 回帰 (隣り合う違反をまとめる)。y を、増えない列のうち重みつきの二乗の差が一番小さいものにする"""
    blocks = []  # [平均, 重み, 個数]
    for v, ww in zip(y, w):
        blocks.append([v, ww, 1])
        while len(blocks) > 1 and blocks[-2][0] < blocks[-1][0]:
            a, b = blocks[-2], blocks[-1]
            W = a[1] + b[1]
            blocks[-2:] = [[(a[0] * a[1] + b[0] * b[1]) / W, W, a[2] + b[2]]]
    out = []
    for m, _, k in blocks: out += [m] * k
    return out

def main():
    res = {}
    for name, label in RUNS.items():
        pts, files = stitch(name)
        if not files: continue
        gD, gH = good(pts, 'D'), good(pts, 'H')
        res[name] = {'label': label, 'stages': len(files), 'events': json.load(open(files[0]))['args']['events'],
                     'geant4': json.load(open(files[0]))['geant4'].strip('$ ').replace('Name: ', ''),
                     'points': pts, 'tailD': fit_tail(gD, 'D'), 'tailH': fit_tail(gH, 'H'),
                     'deepest': {'D': gD[-1]['t'], 'H': gH[-1]['t']}}
    chk = checks()
    # 重ね合わせ (ヘリウム 1 個 = 核子 4 個) と、物理の模型の違い
    def ratio(a, b, key, na=1, nb=1):
        A = {p['t']: p for p in good(res[a]['points'], key)}; B = {p['t']: p for p in good(res[b]['points'], key)}
        return [(t, (A[t][key] / na) / (B[t][key] / nb)) for t in sorted(set(A) & set(B))]
    comp = {}
    if 'a95' in res and 'p95' in res: comp['alpha_over_4p'] = ratio('a95', 'p95', 'H', 4, 1)
    if 'p95q' in res and 'p95' in res: comp['qbbc_over_ftfp'] = ratio('p95q', 'p95', 'H')
        # ゲームに書く表: 0.95c と 0.9c の、線量の山 (ビルドアップ) から先の深さ [g/cm²]・ln(D)・ln(H)。
    # 統計で揺れるので、深さとともに減る形に均す (ln の重みつきの isotonic 回帰。重み = 1/σ²)。一番深い所から先は、減る長さで指数関数に延ばす
    def table(name, keys):
        r = res.get(name)
        if not r: return None
        row = {}
        for key in keys:
            g_ = good(r['points'], key)
            pk = max(range(len(g_)), key=lambda i: g_[i][key])
            q = g_[pk:]
            row['t' + key] = [p['t'] for p in q]
            row['ln' + key] = isotonic_dec([math.log(p[key]) for p in q], [(p[key] / p['d' + key]) ** 2 for p in q])
            lam = r['tail' + key]['lambda']
            row['lam' + key] = round(lam if 0 < lam < 1e5 else 1e5, 2)  # 奥でほぼ平ら (ミュー粒子) なら、延ばすときも平らに
        ts = sorted(set.intersection(*[set(row['t' + k]) for k in keys]))
        out = {'t': ts}
        for k in keys:
            out['ln' + k] = [round(row['ln' + k][row['t' + k].index(t)], 4) for t in ts]
            out['lam' + k] = row['lam' + k]
        return out
    game = {b: table(n, ('D', 'H')) for b, n in (('0.95', 'p95'), ('0.9', 'p90')) if n in res}
    gcr = {b: table(n, ('H',)) for b, n in (('0.95', 'g95'), ('0.9', 'g90')) if n in res}
    surf = {k: table(n, ('H',)) for k, n in (('sep', 's00'), ('gcr', 'c00')) if n in res}
    res_game = {'front': game, 'gcr': gcr, 'surface': surf}
    json.dump({'runs': res, 'checks': chk, 'compare': comp, 'game': res_game}, open(OUT, 'w'), indent=1, ensure_ascii=False)
    block = ('/* SHIELD:BEGIN (data/build/build_shield.py が書く。手で直さない) */\n'
             '// 深さ t [g/cm²] の水の中の線量 (前面に当たる核子 1 個/cm² あたり): lnD = ln(Gy cm²)・lnH = ln(Sv cm²)。線量の山から先だけ。\n'
             '// 表より深い所は、減る長さ lamD・lamH [g/cm²] で指数関数に延ばす (Geant4 11.4・FTFP_BERT。data/derived/shield.json)\n'
             'const SHIELD_DOSE = ' + json.dumps(game, separators=(',', ':')) + ';\n'
             '// 横の壁の銀河宇宙線 (船の系に直した Vos & Potgieter 2015 の星間のスペクトル。H, He, O, Fe): lnH = ln(Sv/s)\n'
             'const SHIELD_GCR = ' + json.dumps(gcr, separators=(',', ':')) + ';\n'
             '// 惑星の地面と居住区 (止まった所。上の半球から等方に。水の板): sep = フレアの陽子 (ln Sv、全方向の F(>10 MeV) 1 /cm² あたり)、gcr = 銀河宇宙線 (ln Sv/s)\n'
             'const SURFACE_DOSE = ' + json.dumps(surf, separators=(',', ':')) + ';\n/* SHIELD:END */')
    src = open(SRC, encoding='utf-8').read()
    if '/* SHIELD:BEGIN' in src:
        src = re.sub(r'/\* SHIELD:BEGIN.*?/\* SHIELD:END \*/', lambda m: block, src, flags=re.S)
        open(SRC, 'w', encoding='utf-8').write(src)
        print('src/index.html に書いた')
    for name, r in res.items():
        print(f"{name}: {r['label']}  段 {r['stages']}・深さ {r['deepest']['H']:.0f} g/cm² まで  一番奥の減る長さ D {r['tailD']['lambda']:.1f}±{r['tailD']['lambda_err']:.1f}・H {r['tailH']['lambda']:.1f}±{r['tailH']['lambda_err']:.1f} g/cm²")
    if chk:
        print(f"確かめ: 核反応で消える長さ Geant4 {chk['lambda_inel_g4']:.1f} / PDG {chk['lambda_inel_pdg']} g/cm²・先頭の陽子のエネルギーと PSTAR の差 最大 {chk['ke_ratio_max']*100:.1f}%")
        if 'msl' in chk: print(f"確かめ: 止まった船の宇宙線 (0〜10 g/cm²) {chk['msl']['D_mGy_day']:.2f} mGy/日・{chk['msl']['H_mSv_day']:.2f} mSv/日 (MSL の実測 0.481・1.84)")
    for k, v in comp.items():
        print(k, ' '.join(f'{t:.0f}:{x:.2f}' for t, x in v[::4]))

if __name__ == '__main__':
    main()
