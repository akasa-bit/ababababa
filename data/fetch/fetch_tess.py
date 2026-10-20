#!/usr/bin/env python3
"""ゲームの地図の M 型星の、TESS の 2 分ごとの光度曲線 (SPOC) を取得する。docs/physics.md の 6。

  1. ゲームの星系 (銀河面 ±2 光年の板) の、0.25 光年以内にある CNS5 の天体を 1 つずつ (連星の伴星やプロキシマのように空で離れた星も)、
     その位置から TESS Input Catalog v8.2 (VizieR IV/39) で TIC 番号を引く (位置が 3 分角以内で、距離が 30% 以内のもの)
  2. MAST の Cone 検索で、その TIC の 2 分ごとの光度曲線 (obs_id が '-s' で終わる SPOC の timeseries) を探す
  3. 1 つの星につき、新しい順に 4 セクタまで落とす
光度曲線のファイル (1 つ 約 2 MB) はリポジトリに置かず、<置き場>/ に保存する。どのファイルを使ったか (URL・SHA-256) を
data/raw/tess/MANIFEST.json に記録する。同じファイルは何度落としても同じ (MAST の固定の名前)。

使い方: python data/fetch/fetch_tess.py <置き場>   (astropy が要る。numpy も)
"""
import concurrent.futures as cf, datetime, hashlib, json, math, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'raw', 'tess', 'MANIFEST.json')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
MAX_SECTORS = 4

def fetch(url, data=None, timeout=300):
    for k in range(5):
        try:
            req = urllib.request.Request(url, headers=UA, data=data)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception:
            if k == 4: raise
            time.sleep(2 ** (k + 1))

sys.path.insert(0, os.path.join(HERE, '..', 'build'))
import build_stars as BS  # CNS5 の読み方と、銀河座標への直し方を同じにする

def members(s, cns):
    """ゲームの星系 s の 0.25 光年以内にある CNS5 の天体 (位置・距離)"""
    out = []
    for o in cns:
        if not BS.num(o.get('plx')) or BS.num(o['plx']) <= 0: continue
        xyz, d, ra, de = o['_g']
        if math.dist(xyz, (s['x'], s['y'], s['z'])) <= 0.25: out.append((math.degrees(ra), math.degrees(de), d / 3.2616))
    return out

def tic_near(ra, de, dpc):
    q = (f'SELECT TIC, RAJ2000, DEJ2000, Tmag, Teff, Dist FROM "IV/39/tic82" WHERE '
         f"1=CONTAINS(POINT('ICRS', RAJ2000, DEJ2000), CIRCLE('ICRS', {ra:.6f}, {de:.6f}, 0.05))")
    b = fetch('https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync', urllib.parse.urlencode({'request': 'doQuery', 'lang': 'ADQL', 'format': 'csv', 'query': q}).encode())
    rows = []
    for l in b.decode().splitlines()[1:]:
        f = l.split(',')
        if len(f) < 6 or not f[5]: continue
        dist = float(f[5])
        teff = float(f[4]) if f[4] else None
        tmag = float(f[3]) if f[3] else None
        if teff and teff > 4200: continue  # M 型星だけ (明るい G・K 型の伴星は落とさない)
        if tmag is not None and tmag < 3: continue  # 明るすぎて TESS で飽和する星
        if abs(dist / dpc - 1) < 0.3: rows.append({'tic': int(f[0]), 'ra': float(f[1]), 'de': float(f[2]), 'tmag': float(f[3]) if f[3] else None, 'teff': float(f[4]) if f[4] else None, 'dist': dist})
    return rows

def mast_lcs(t):
    req = json.dumps({'service': 'Mast.Caom.Cone', 'format': 'json', 'params': {'ra': t['ra'], 'dec': t['de'], 'radius': 0.006}, 'pagesize': 2000, 'page': 1})
    d = json.loads(fetch('https://mast.stsci.edu/api/v0/invoke', urllib.parse.urlencode({'request': req}).encode(), timeout=600))
    key = f"{t['tic']:016d}"
    obs = sorted({r['obs_id'] for r in d.get('data', []) if r.get('obs_collection') == 'TESS' and r.get('dataproduct_type') == 'timeseries'
                  and str(r.get('obs_id', '')).endswith('-s') and key in str(r.get('obs_id', ''))}, key=lambda o: o.split('-')[1], reverse=True)
    return obs[:MAX_SECTORS]

def main():
    cache = sys.argv[1]; os.makedirs(cache, exist_ok=True)
    stars = json.load(open(os.path.join(HERE, '..', 'derived', 'stars.json')))['systems']
    game = [s for s in stars if abs(s['z']) <= 2 and any(st[0] == 'M' for st in s['stars'])]
    cns = [o for o in BS.read_cns5() if BS.num(o.get('plx')) and BS.num(o['plx']) > 0]
    for o in cns: o['_g'] = BS.galactic(o)
    def one(s):
        mem = members(s, cns)
        tics = {t['tic']: t for ra, de, dpc in mem for t in tic_near(ra, de, dpc)}.values()
        res = {'cat': s['cat'], 'name': s['name'], 'members': mem, 'tics': []}
        for t in tics:
            obs = mast_lcs(t)
            files = []
            for o in obs:
                url = f'https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:TESS/product/{o}_lc.fits'
                path = os.path.join(cache, f'{o}_lc.fits')
                if not os.path.exists(path): open(path, 'wb').write(fetch(url))
                b = open(path, 'rb').read()
                files.append({'obs_id': o, 'url': url, 'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b)})
            res['tics'].append({**t, 'files': files})
        print(s['cat'], s['name'], [(t['tic'], len(t['files'])) for t in res['tics']], flush=True)
        return res
    with cf.ThreadPoolExecutor(6) as ex:
        out = list(ex.map(one, game))
    json.dump({'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'max_sectors': MAX_SECTORS, 'systems': out},
              open(OUT, 'w'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    main()
