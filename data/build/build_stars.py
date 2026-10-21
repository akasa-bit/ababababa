#!/usr/bin/env python3
"""data/raw の生データから、ゲームで使う近くの恒星系の表を作る。

  1. CNS5 の各天体の赤経・赤緯・視差から、銀河座標の 3 次元の位置 [光年] を出す
     (x = 銀河中心の方向、y = 銀河の回転の方向、z = 銀河の北極の方向)
  2. 同じグリーゼ番号 (連星の組) と、互いに 0.25 光年以内の天体を 1 つの恒星系にまとめる
  3. HIP 番号があれば SIMBAD のスペクトル型、なければ Gaia の色 (G−RP) と絶対等級から、
     Mamajek の表でスペクトル型・温度・質量・光度・半径を求める
     (同じ色の主系列星より 3.5 等以上暗ければ白色矮星、2.5 等以上明るければ巨星、L/T/Y 型は褐色矮星)
  4. 銀河面から ±SLAB 光年の板の中で、太陽に近い (銀河面に沿った距離が短い) 順に COUNT 系を選ぶ
  5. NASA Exoplanet Archive の既知の惑星を、Gaia DR3 番号か HIP 番号で恒星系に結びつける
結果は data/derived/stars.json と、src/core/galaxy.js の STARS の区切りのあいだに書く。

使い方: python3 data/build/build_stars.py
"""
import csv, json, math, os, re

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw')
OUT = os.path.join(HERE, '..', 'derived')
SRC = os.path.join(HERE, '..', '..', 'src', 'core', 'galaxy.js')  # src/index.html を分けたあとの、区切りのあるファイル (回 R3)
SLAB = 17.0      # 銀河面からの厚さの半分 [光年]
COUNT = 600      # 選ぶ恒星系の数 (太陽系を除く)
MERGE_LY = 0.25  # この距離より近い天体は同じ恒星系
LY_PER_PC = 3.26156
MG_SUN = 4.67    # 太陽の G 等級の絶対等級 (近似)

# 赤道座標 (J2000) → 銀河座標の回転行列
T = [[-0.0548755604, -0.8734370902, -0.4838350155],
     [0.4941094279, -0.4448296300, 0.7469822445],
     [-0.8676661490, -0.1980763734, 0.4559837762]]

def num(v):
    v = (v or '').strip()
    try:
        return float(v)
    except ValueError:
        return None

def read_cns5():
    with open(os.path.join(RAW, 'cns5.tsv'), encoding='utf-8') as f:
        rows = [l.rstrip('\n').split('\t') for l in f if l.strip() and not l.startswith('#')]
    head = [h.strip() for h in rows[0]]
    out = []
    for r in rows[3:]:
        d = {h: (r[i].strip() if i < len(r) else '') for i, h in enumerate(head)}
        out.append(d)
    return out

def read_mamajek():
    rows = []
    head = None
    with open(os.path.join(RAW, 'mamajek_dwarf.txt'), encoding='utf-8') as f:
        for l in f:
            if l.startswith('#SpT') and head is None:
                head = l[1:].split()
                continue
            if head is None or l.startswith('#') or not l.strip():
                continue
            parts = l.split()
            if len(parts) < 10 or not re.match(r'^[OBAFGKMLTY]\d', parts[0]):
                continue
            rows.append({h: parts[i] if i < len(parts) else '...' for i, h in enumerate(head)})
    def col(r, k):
        v = r.get(k, '...')
        return None if v in ('...', '....', '.....') else num(v)
    table = []
    for r in rows:
        table.append({'spt': r['SpT'], 'teff': col(r, 'Teff'), 'logL': col(r, 'logL'), 'R': col(r, 'R_Rsun'), 'M': col(r, 'Msun'),
                      'grp': col(r, 'G-Rp'), 'MG': col(r, 'M_G'), 'MKs': col(r, 'M_Ks')})
    return table

def interp(table, key, x):
    """table を key の値で並べ、x に近い 2 行のあいだを線形に補間した行を返す"""
    pts = sorted([r for r in table if r[key] is not None], key=lambda r: r[key])
    if not pts:
        return None
    if x <= pts[0][key]:
        return pts[0]
    if x >= pts[-1][key]:
        return pts[-1]
    for a, b in zip(pts, pts[1:]):
        if a[key] <= x <= b[key]:
            t = 0 if b[key] == a[key] else (x - a[key]) / (b[key] - a[key])
            near = a if t < 0.5 else b
            out = {'spt': near['spt']}
            for k in ('teff', 'logL', 'R', 'M', 'grp', 'MG', 'MKs'):
                va, vb = a[k], b[k]
                out[k] = None if va is None or vb is None else va + t * (vb - va)
            return out
    return pts[-1]

SPT_RE = re.compile(r'^(?:sd)?([OBAFGKM])(\d(?:\.\d+)?)?')

def spt_code(spt):
    m = SPT_RE.match(spt)
    if not m:
        return None
    return 'OBAFGKM'.index(m.group(1)) * 10 + float(m.group(2) or 5)

def from_simbad(sp, o, table):
    """SIMBAD のスペクトル型から種類と物理量を決める (明るい星は Gaia の測光より確か)。分からなければ None"""
    sp = sp.strip().split('+')[0]
    plx, g = num(o['plx']), num(o['Gmagr'])
    mg = g + 5 * math.log10(plx) - 10 if g is not None and plx else None
    if sp.startswith('D') and len(sp) > 1 and sp[1] in 'ABOQZCX':
        m = re.search(r'(\d+(?:\.\d+)?)', sp)
        teff = 50400 / float(m.group(1)) if m and float(m.group(1)) > 0 else 10000
        lum = 10 ** (-0.4 * (mg - MG_SUN)) if mg is not None else 0.0115 ** 2 * (teff / 5772) ** 4
        return {'cls': 'WD', 'label': sp[:6], 'mass': 0.6, 'lum': lum, 'teff': teff, 'radius': 0.0115}
    code = spt_code(sp)
    if code is None:
        return None
    giant = re.search(r'(?<![V])(III|II|Ib|Ia|I)(?![V])', sp[1:]) is not None
    ms = min((r for r in table if r['spt'][0] in 'OBAFGKM'), key=lambda r: abs(spt_code(r['spt']) - code))
    if giant and mg is not None:
        lum = 10 ** (-0.4 * (mg - MG_SUN))
        teff = ms['teff'] or 5000
        return {'cls': SPT_RE.match(sp).group(1), 'label': f"{SPT_RE.match(sp).group(0)} III", 'mass': max(1.0, (ms['M'] or 1) * 1.5), 'lum': lum, 'teff': teff, 'radius': math.sqrt(lum) * (5772 / teff) ** 2, 'giant': True}
    lum = 10 ** ms['logL'] if ms.get('logL') is not None else (ms['M'] or 0.3) ** 3.5
    return {'cls': SPT_RE.match(sp).group(1), 'label': f"{SPT_RE.match(sp).group(0)} V", 'mass': ms['M'] or 0.2, 'lum': lum, 'teff': ms['teff'] or 3000, 'radius': ms['R'] or 0.3}

def classify(o, table, sptypes=None):
    """1 つの天体の種類と物理量。返り値 None は分からない (光らない天体など)"""
    # SIMBAD の型は HIP 番号の天体 (連星なら主星) のもの。伴星には当てない
    sp = (sptypes or {}).get(o.get('HIP', '')) if (o.get('Comp') or '') in ('', 'A', 'AB', 'Aab') or o.get('P?') == '1' else None
    if sp:
        c = from_simbad(sp, o, table)
        if c:
            return c
    plx = num(o['plx'])
    g, grp, ks = num(o['Gmagr']), num(o['(G-RP)r']), num(o['Ksmag'])
    if plx is None or plx <= 0:
        return None
    mg = g + 5 * math.log10(plx) - 10 if g is not None else None
    if grp is not None and mg is not None:
        ms = interp(table, 'grp', grp)
        if ms is None or ms['MG'] is None:
            return None
        dm = mg - ms['MG']
        if dm > 3.5:  # 白色矮星
            teff = max(4000, min(40000, 7090 / max(0.05, grp + 0.35)))  # 色から大まかな温度
            lum = 10 ** (-0.4 * (mg - MG_SUN))
            return {'cls': 'WD', 'label': f'DA{50400 / teff:.1f}', 'mass': 0.6, 'lum': lum, 'teff': teff, 'radius': 0.0115}
        if dm < -2.5:  # 巨星・準巨星
            lum = 10 ** (-0.4 * (mg - MG_SUN))
            teff = ms['teff'] or 5000
            radius = math.sqrt(lum) * (5772 / teff) ** 2
            if ms['spt'][0] not in 'OBAFGKM':
                return None
            return {'cls': ms['spt'][0], 'label': f"{ms['spt'].rstrip('V')} III", 'mass': max(1.0, (ms['M'] or 1) * 1.5), 'lum': lum, 'teff': teff, 'radius': radius, 'giant': True}
        spt = ms['spt']
    elif ks is not None:
        mks = ks + 5 * math.log10(plx) - 10
        ms = interp(table, 'MKs', mks)
        if ms is None:
            return None
        spt = ms['spt']
    else:
        return None
    if spt[0] in 'LTY':
        return {'cls': 'BD', 'label': spt, 'bd': True}
    if spt[0] not in 'OBAFGKM':
        return None
    lum = 10 ** ms['logL'] if ms.get('logL') is not None else (ms['M'] or 0.3) ** 3.5
    return {'cls': spt[0], 'label': f"{spt.rstrip('V')} V", 'mass': ms['M'] or 0.2, 'lum': lum, 'teff': ms['teff'] or 3000, 'radius': ms['R'] or 0.3}

def galactic(o):
    plx = num(o['plx'])
    ra, de = math.radians(num(o['RAJ2000'])), math.radians(num(o['DEJ2000']))
    d = 1000 / plx * LY_PER_PC
    v = [math.cos(de) * math.cos(ra), math.cos(de) * math.sin(ra), math.sin(de)]
    g = [sum(T[i][j] * v[j] for j in range(3)) for i in range(3)]
    return [d * g[0], d * g[1], d * g[2]], d, ra, de

# 固有名の日本語 (SIMBAD の NAME を、よく使われる日本語の表記に)。ないものは空のまま (ゲームがカタカナの名前を付ける)
JA = {
    'Sirius': 'シリウス', 'Procyon': 'プロキオン', 'Altair': 'アルタイル', 'Vega': 'ベガ', 'Fomalhaut': 'フォーマルハウト',
    'Pollux': 'ポルックス', 'Arcturus': 'アークトゥルス', 'Capella': 'カペラ', 'Aldebaran': 'アルデバラン', 'Rigil Kentaurus': 'リギル・ケンタウルス',
    'Toliman': 'トリマン', 'Proxima Centauri': 'プロキシマ・ケンタウリ', "Barnard's star": 'バーナード星', "Barnard's Star": 'バーナード星',
    'Wolf 359': 'ウォルフ359', 'Lalande 21185': 'ラランド21185', "Luyten's Star": 'ルイテン星', "Kapteyn's star": 'カプタイン星',
    "Teegarden's Star": 'ティーガーデン星', "van Maanen's Star": 'ファン・マーネン星', 'Ran': 'ラーン', 'Achird': 'アキルド', 'Caph': 'カフ',
    'Ankaa': 'アンカー', 'Hamal': 'ハマル', 'Sheratan': 'シェラタン', 'Algol': 'アルゴル', 'Keid': 'ケイド', 'Tabit': 'タビト',
    'Menkent': 'メンケント', 'Alderamin': 'アルデラミン', 'Rasalhague': 'ラス・アルハゲ', 'Denebola': 'デネボラ', 'Zosma': 'ゾスマ',
    'Alkaid': 'アルカイド', 'Mizar': 'ミザール', 'Alcor': 'アルコル', 'Muphrid': 'ムフリド', 'Porrima': 'ポリマ', 'Unukalhai': 'ウヌクアルハイ',
    'Diphda': 'ディフダ', 'Rana': 'ラナ', 'Gliese 581': 'グリーゼ581', 'Titawin': 'ティタウィン', 'Fafnir': 'ファフニール',
}

def main():
    os.makedirs(OUT, exist_ok=True)
    table = read_mamajek()
    sptypes = {}
    with open(os.path.join(RAW, 'simbad_sptypes.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['sp_type'].strip():
                sptypes[r['hip'].replace('HIP ', '').strip()] = r['sp_type'].strip()
    objs = []
    for o in read_cns5():
        if not o.get('plx') or num(o['plx']) is None or num(o['plx']) <= 0:
            continue
        pos, d, ra, de = galactic(o)
        c = classify(o, table, sptypes)
        objs.append({'o': o, 'pos': pos, 'd': d, 'ra': ra, 'de': de, 'c': c})
    # まとめる: グリーゼ番号の組 + 0.25 光年以内
    parent = list(range(len(objs)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def union(i, j):
        parent[find(i)] = find(j)
    bygj = {}
    for i, x in enumerate(objs):
        key = x['o'].get('GJp') or x['o'].get('GJ')
        if key:
            bygj.setdefault(key, []).append(i)
    for ids in bygj.values():
        for j in ids[1:]:
            union(ids[0], j)
    order = sorted(range(len(objs)), key=lambda i: objs[i]['pos'][0])
    for a in range(len(order)):
        i = order[a]
        for b in range(a + 1, len(order)):
            j = order[b]
            if objs[j]['pos'][0] - objs[i]['pos'][0] > MERGE_LY:
                break
            if math.dist(objs[i]['pos'], objs[j]['pos']) < MERGE_LY:
                union(i, j)
    groups = {}
    for i in range(len(objs)):
        groups.setdefault(find(i), []).append(objs[i])
    # 惑星と固有名
    planets = {}
    with open(os.path.join(RAW, 'exoplanets.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            planets.setdefault(('gaia', r['gaia_dr3_id'].replace('Gaia DR3 ', '').strip()), []).append(r)
            if r.get('hip_name'):
                planets.setdefault(('hip', r['hip_name'].replace('HIP ', '').strip()), []).append(r)
    names = {}
    with open(os.path.join(RAW, 'simbad_names.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            nm = r['name'].replace('NAME ', '').strip()
            names.setdefault(r['hip'].replace('HIP ', '').strip(), []).append(nm)
    systems = []
    for g in groups.values():
        stars = [x for x in g if x['c'] and not x['c'].get('bd')]
        if not stars:
            continue
        stars.sort(key=lambda x: -x['c']['mass'])
        sun = stars[0]
        cx = [sum(x['pos'][k] for x in stars) / len(stars) for k in range(3)]
        if abs(cx[2]) > SLAB:
            continue
        rows = []
        for x in stars:
            # 主星からの見かけの角距離 × 距離 = 空の面での距離 [AU] (奥行きの差は分からないので、下限の目安)
            ang = math.acos(max(-1, min(1, math.sin(sun['de']) * math.sin(x['de']) + math.cos(sun['de']) * math.cos(x['de']) * math.cos(sun['ra'] - x['ra']))))
            sep = ang * (sun['d'] / LY_PER_PC) * 206264.8
            c = x['c']
            own = next((JA[n] for n in names.get(x['o'].get('HIP', ''), []) if n in JA), '')  # その恒星自身の固有名 (伴星にもあれば)
            rows.append([c['cls'], c['label'], round(c['mass'], 3), float(f"{c['lum']:.4g}"), round(c['teff']), round(c['radius'], 4), round(sep, 1), own])
        pl = []
        seen = set()
        for x in g:
            for key in (('gaia', x['o'].get('GaiaDR3', '')), ('hip', x['o'].get('HIP', ''))):
                for p in planets.get(key, []) if key[1] else []:
                    if p['pl_name'] in seen or not num(p['pl_orbsmax']):
                        continue
                    seen.add(p['pl_name'])
                    host = stars.index(x) if x in stars else 0  # 惑星が回る恒星 (連星なら伴星のこともある)
                    pl.append([p['pl_name'], num(p['pl_orbsmax']), num(p['pl_bmasse']), num(p['pl_rade']), host])
        nm = ''
        for x in g:
            for n in names.get(x['o'].get('HIP', ''), []):
                if n in JA:
                    nm = JA[n]
                    break
            if nm:
                break
        gj = sun['o'].get('GJp') or sun['o'].get('GJ')
        cat = f"GJ {gj}" if gj else (f"HIP {sun['o']['HIP']}" if sun['o'].get('HIP') else f"Gaia DR3 {sun['o'].get('GaiaDR3')}")
        systems.append({'x': round(cx[0], 2), 'y': round(cx[1], 2), 'z': round(cx[2], 2), 'name': nm, 'cat': cat, 'stars': rows, 'planets': sorted(pl, key=lambda p: p[1]),
                        'rxy': math.hypot(cx[0], cx[1])})
    systems.sort(key=lambda s: s['rxy'])
    systems = [s for s in systems if s['rxy'] > 0.01][:COUNT]
    radius = systems[-1]['rxy']
    for s in systems:
        del s['rxy']
    meta = {'source': 'CNS5 (Golovin ほか 2023)・Mamajek の主系列星の表・NASA Exoplanet Archive・SIMBAD', 'slab': SLAB, 'count': len(systems), 'radius': round(radius, 1),
            'manifest': json.load(open(os.path.join(RAW, 'MANIFEST.json'), encoding='utf-8'))}
    with open(os.path.join(OUT, 'stars.json'), 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'systems': systems}, f, ensure_ascii=False)
    # src/core/galaxy.js へ書き込む (STARS の区切りのあいだ)
    compact = {'slab': SLAB, 'radius': meta['radius'], 's': [[s['x'], s['y'], s['z'], s['name'], s['cat'], s['stars'], s['planets']] for s in systems]}
    block = '/* STARS:BEGIN (data/build/build_stars.py が書く。手で直さない) */\nconst REAL_STARS = ' + json.dumps(compact, ensure_ascii=False, separators=(',', ':')) + ';\n/* STARS:END */'
    src = open(SRC, encoding='utf-8').read()
    if '/* STARS:BEGIN' in src:
        src = re.sub(r'/\* STARS:BEGIN.*?/\* STARS:END \*/', lambda m: block, src, flags=re.S)
        open(SRC, 'w', encoding='utf-8').write(src)
        print('src/core/galaxy.js に書いた')
    cls = {}
    for s in systems:
        cls[s['stars'][0][0]] = cls.get(s['stars'][0][0], 0) + 1
    print(f"{len(systems)} 系、半径 {radius:.1f} 光年、厚さ ±{SLAB}、主星の型 {dict(sorted(cls.items()))}、名前つき {sum(1 for s in systems if s['name'])}、惑星つき {sum(1 for s in systems if s['planets'])}、連星 {sum(1 for s in systems if len(s['stars']) > 1)}")

if __name__ == '__main__':
    main()
