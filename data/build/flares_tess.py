#!/usr/bin/env python3
"""TESS の光度曲線から、ゲームの M 型星のフレアを数え、星ごとのフレアの頻度の分布を当てはめる。docs/physics.md の 6。

入力: data/raw/tess/MANIFEST.json (data/fetch/fetch_tess.py が書く) と、そこにある光度曲線 (<置き場>/*.fits)、
      data/raw/tess/tess-response-function-v2.0.csv (TESS の感度の曲線)、data/derived/stars.json (星の温度と半径)
出力: data/derived/tess_flares.json

やり方 (フレアの研究の普通の手順。Chang ほか 2015・Davenport 2014・Ilin ほか 2021 など):
  1. PDCSAP の光の強さ。品質の旗の立った点を除き、0.5 日以上のすき間で区切る
  2. 区切りごとに、0.3 日の移動中央値でならす。上に外れた点 (2.5σ) を除いて 3 回くり返す。σ は残りの MAD × 1.4826
  3. 3σ を超える点が 3 つ以上続けば候補。前後に 1σ まで広げ、等価幅 ED = Σ (強さ ÷ ならした値 − 1) Δt [秒]
  4. 注入と回収: Davenport 2014 の形のフレア (半値幅 4〜20 分) を、ED を変えて 1 本に 60 個ずつ埋めこみ、同じ手順で拾えた割合から、
     拾える割合が 90% になる ED (ED90) を出す。数えるのは ED90 より大きいものだけ
  5. エネルギー: 星の TESS の帯域の明るさ L_TESS = 4π R² π∫B_λ(T*) S(λ) dλ に ED を掛け、9,000 K の黒体のフレアとしてボロメトリックに直す
     (E_bol = E_TESS × σT⁴ ÷ π∫B_λ(9000 K) S dλ。Shibayama ほか 2013・Günther ほか 2020 と同じ)
  6. 星ごとに、E ≥ E_c (セクタごとの ED90 から決まるいちばん大きいもの) のフレアで、べき乗の指数を最尤法で出す
     (α = 1 + n / Σ ln(E/E_c)。累積の傾き a = 1 − α)。回数の割合は、E_c 以上を数えられた時間で割る
使い方: python data/build/flares_tess.py <置き場>   (astropy と numpy が要る)
"""
import json, math, multiprocessing, os, sys, zlib
import numpy as np
from astropy.io import fits

HERE = os.path.dirname(__file__)
MAN = os.path.join(HERE, '..', 'raw', 'tess', 'MANIFEST.json')
OUT = os.path.join(HERE, '..', 'derived', 'tess_flares.json')
H, C, KB, SIG = 6.62607015e-34, 2.99792458e8, 1.380649e-23, 5.670374419e-8
RSUN = 6.957e8

resp = np.array([[float(x) for x in l.split(',')] for l in open(os.path.join(HERE, '..', 'raw', 'tess', 'tess-response-function-v2.0.csv')) if l[0].isdigit()])
LAM = resp[:, 0] * 1e-9; S = resp[:, 1]

def band(T):
    """π ∫ B_λ(T) S(λ) dλ [W/m²] (TESS の帯域で、黒体の表面 1 m² から出る分)"""
    B = 2 * H * C ** 2 / LAM ** 5 / np.expm1(H * C / (LAM * KB * T))
    return math.pi * np.trapezoid(B * S, LAM)

def runmed(y, w):
    h = w // 2
    p = np.pad(y, h, mode='edge')
    v = np.lib.stride_tricks.sliding_window_view(p, 2 * h + 1)
    return np.nanmedian(v, axis=1)[:len(y)]

def detrend(t, f):
    """移動中央値 (0.3 日) を、上に外れた点を除いて 3 回"""
    w = max(15, int(0.3 / np.median(np.diff(t))) | 1)
    y = f.copy(); m = runmed(y, w)
    for _ in range(3):
        r = y - m; s = 1.4826 * np.nanmedian(np.abs(r - np.nanmedian(r)))
        y = np.where(r > 2.5 * s, m, f)
        m = runmed(y, w)
    r = f - m; s = 1.4826 * np.nanmedian(np.abs(r - np.nanmedian(r)))
    return m, s

def find(t, f, m, s, dt):
    """3σ を超える点が 3 つ以上続く所 → (始め, 終わり, ED [秒])"""
    z = (f - m) / s
    hit = z > 3
    out = []; i = 0; n = len(z)
    while i < n:
        if hit[i]:
            j = i
            while j + 1 < n and hit[j + 1]: j += 1
            if j - i + 1 >= 3:
                a, b = i, j
                while a > 0 and z[a - 1] > 1: a -= 1
                while b + 1 < n and z[b + 1] > 1: b += 1
                ed = float(np.sum((f[a:b + 1] / m[a:b + 1] - 1)) * dt)
                if out and a <= out[-1][1] + 1: out[-1] = (out[-1][0], b, out[-1][2] + ed)
                else: out.append((a, b, ed))
            i = j + 1
        else: i += 1
    return out

def davenport(x):
    """Davenport 2014 のフレアの形 (半値幅 = 1 の時間で、頂点 = 1)"""
    y = np.zeros_like(x)
    r = (x > -1) & (x <= 0)
    y[r] = 1 + 1.941 * x[r] - 0.175 * x[r] ** 2 - 2.246 * x[r] ** 3 - 1.125 * x[r] ** 4
    d = x > 0
    y[d] = 0.6890 * np.exp(-1.600 * x[d]) + 0.3030 * np.exp(-0.2783 * x[d])
    return y

def segments(t):
    cut = np.where(np.diff(t) > 0.5)[0]
    return np.split(np.arange(len(t)), cut + 1)

def lc(path):
    with fits.open(path) as h:
        d = h[1].data; hdr = h[0].header
        t = np.array(d['TIME'], float); f = np.array(d['PDCSAP_FLUX'], float); q = np.array(d['QUALITY'])
    ok = np.isfinite(t) & np.isfinite(f) & (q == 0)
    return t[ok], f[ok], int(hdr.get('SECTOR', 0))

def analyze(path, rng):
    t, f, sector = lc(path)
    if len(t) < 1000: return None
    dt = float(np.median(np.diff(t))) * 86400
    flares, model, sig, idx = [], np.zeros_like(f), np.zeros_like(f), segments(t)
    for ix in idx:
        if len(ix) < 50: continue
        m, s = detrend(t[ix], f[ix]); model[ix] = m; sig[ix] = s
        for a, b, ed in find(t[ix], f[ix], m, s, dt):
            flares.append({'t': float(t[ix][a]), 'ed': ed, 'n': b - a + 1})
    # 注入と回収: ED を 1〜1,000 秒の対数で振って埋め、拾えた割合
    eds = np.logspace(-0.5, 3, 15); rec = []
    for ed in eds:
        got = 0; tries = 0
        for _ in range(4):
            ff = f.copy(); placed = []
            for ix in idx:
                if len(ix) < 400: continue
                for k in range(15):
                    c = int(rng.integers(ix[0] + 30, ix[-1] - 120))
                    fw = rng.uniform(4, 20) / 1440  # 半値幅 [日]
                    x = (t - t[c]) / fw
                    shape = davenport(x)
                    area = fw * 86400 * 1.827  # 形の面積 [秒] (半値幅の単位で ∫ = 1.827)
                    amp = ed / area
                    sl = slice(max(0, c - 20), min(len(t), c + 400))
                    ff[sl] += amp * shape[sl] * model[sl]
                    placed.append(t[c])
            if not placed: continue
            found = []
            for ix in idx:
                if len(ix) < 50: continue
                m, s = detrend(t[ix], ff[ix])
                found += [t[ix][a] for a, b, e in find(t[ix], ff[ix], m, s, dt)]
            found = np.array(found)
            for p in placed:
                tries += 1
                if len(found) and np.min(np.abs(found - p)) < 0.02: got += 1
        rec.append(got / tries if tries else 0)
    rec = np.array(rec)
    ed90 = float(eds[np.argmax(rec >= 0.9)]) if np.any(rec >= 0.9) else float(eds[-1])
    T = len(t) * dt / 86400
    return {'file': os.path.basename(path), 'sector': sector, 'days': T, 'sigma_rel': float(np.median(sig[sig > 0] / model[sig > 0])),
            'ed90': ed90, 'recovery': list(map(float, rec)), 'eds': list(map(float, eds)), 'flares': flares}

def one(path):
    return analyze(path, np.random.default_rng(zlib.crc32(os.path.basename(path).encode())))

def main():
    cache = sys.argv[1]
    man = json.load(open(MAN))
    stars = {s['cat']: s for s in json.load(open(os.path.join(HERE, '..', 'derived', 'stars.json')))['systems']}
    k9 = SIG * 9000 ** 4 / band(9000)
    # 光度曲線ごとの解析を 4 つ並べる (注入の乱数はファイルの名前から決めるので、何度回しても同じ)
    paths = sorted({os.path.join(cache, f['obs_id'] + '_lc.fits') for sy in man['systems'] for tc in sy['tics'] for f in tc['files']})
    with multiprocessing.Pool(4) as pool:
        done = dict(zip(paths, pool.map(one, paths)))
    out = []
    for sy in man['systems']:
        game = stars[sy['cat']]
        ms = [(k, st) for k, st in enumerate(game['stars']) if st[0] == 'M']
        for tc in sy['tics']:
            if not tc['files']: continue
            # 系の中のどの M 型星か: TIC の温度がいちばん近いもの (温度がなければ一番目の M 型星)
            k, st = min(ms, key=lambda m: abs(m[1][4] - (tc['teff'] or m[1][4])))
            Lt = 4 * math.pi * (st[5] * RSUN) ** 2 * band(st[4])  # 星の TESS の帯域の明るさ [W]
            secs = [r for r in (done[os.path.join(cache, f['obs_id'] + '_lc.fits')] for f in tc['files']) if r]
            for r in secs:
                for fl in r['flares']: fl['E'] = fl['ed'] * Lt * k9 * 1e7  # ボロメトリック [erg]
                r['E90'] = r['ed90'] * Lt * k9 * 1e7
            out.append({'cat': sy['cat'], 'name': sy['name'], 'star': k, 'spt': st[1], 'teff': st[4], 'radius': st[5], 'tic': tc['tic'], 'L_tess_W': Lt, 'sectors': secs})
            print(sy['cat'], k, st[1], tc['tic'], [(r['sector'], len(r['flares']), f"{r['E90']:.1e}") for r in secs], flush=True)
    # 星ごとの当てはめ
    for o in out:
        if not o['sectors']: continue
        Ec = max(r['E90'] for r in o['sectors'])
        E = np.array([fl['E'] for r in o['sectors'] for fl in r['flares'] if fl['E'] >= Ec])
        T = sum(r['days'] for r in o['sectors'])
        n = len(E)
        alpha = 1 + n / np.sum(np.log(E / Ec)) if n >= 5 else None
        o['fit'] = {'Ec': Ec, 'n': n, 'days': T, 'rate_Ec_per_day': (n + 0.5) / T, 'alpha': alpha,
                    'alpha_err': (alpha - 1) / math.sqrt(n) if alpha else None, 'Emax_obs': float(E.max()) if n else None}
    json.dump({'stars': out}, open(OUT, 'w'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    main()
