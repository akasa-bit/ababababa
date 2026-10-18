#!/usr/bin/env python3
"""近くの恒星の生データを取得する (手で書き換えない)。

取得するもの:
  - CNS5 (Golovin ほか 2023、25 pc 以内の天体の表) … VizieR J/A+A/670/A19
  - Mamajek の主系列星の色・温度の表 (EEM_dwarf_UBVIJHK_colors_Teff.txt)
  - NASA Exoplanet Archive の、27 pc 以内の既知の惑星 (pscomppars)
  - SIMBAD の固有名 (取得した恒星のうち、固有名 "NAME ..." を持つもの) とスペクトル型 (HIP 番号のある恒星)
保存先は data/raw/。取得日・URL・SHA-256・行数を data/raw/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_stars.py
"""
import datetime, hashlib, json, os, sys, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw')
UA = {'User-Agent': 'Moribin data fetch (research game; contact via repository)'}

def get(url, path, post=None):
    req = urllib.request.Request(url, headers=UA, data=urllib.parse.urlencode(post).encode() if post else None)
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read()
    with open(os.path.join(ROOT, path), 'wb') as f:
        f.write(data)
    return {'file': path, 'url': url, **({'query': post['query']} if post else {}), 'fetched': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'lines': data.count(b'\n')}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    cols = 'CNS5,GJ,Comp,NComp,P?,GJp,GaiaDR3,HIP,RAJ2000,DEJ2000,plx,e_plx,Gmagr,(G-RP)r,Jmag,Ksmag'
    q = urllib.parse.urlencode({'-source': 'J/A+A/670/A19', '-out': cols, '-out.max': 'unlimited'})
    out.append(get(f'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?{q}', 'cns5.tsv'))
    out.append(get('https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt', 'mamajek_dwarf.txt'))
    q = 'select pl_name,hostname,gaia_dr3_id,hip_name,sy_dist,pl_orbsmax,pl_bmasse,pl_rade,pl_eqt from pscomppars where sy_dist<27'
    out.append(get('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?' + urllib.parse.urlencode({'query': q, 'format': 'csv'}), 'exoplanets.csv'))
    # 固有名: HIP 番号のある恒星について、SIMBAD の "NAME ..." を引く
    hips = set()
    with open(os.path.join(ROOT, 'cns5.tsv'), encoding='utf-8') as f:
        rows = [l.rstrip('\n').split('\t') for l in f if l.strip() and not l.startswith('#')]
    head = rows[0]
    ih = head.index('HIP')
    for r in rows[3:]:
        if len(r) > ih and r[ih].strip():
            hips.add(r[ih].strip())
    ids = ','.join(f"'HIP {h}'" for h in sorted(hips, key=int))
    adql = f"select h.id as hip, n.id as name from ident as h join ident as n on h.oidref = n.oidref where h.id in ({ids}) and n.id like 'NAME %'"
    out.append(get('https://simbad.cds.unistra.fr/simbad/sim-tap/sync', 'simbad_names.csv', post={'request': 'doQuery', 'lang': 'adql', 'format': 'csv', 'query': adql}))
    # スペクトル型: 明るい星は Gaia の測光が飽和するので、HIP 番号のある恒星は SIMBAD の分類も取っておく
    adql = f"select i.id as hip, b.sp_type from ident as i join basic as b on i.oidref = b.oid where i.id in ({ids})"
    out.append(get('https://simbad.cds.unistra.fr/simbad/sim-tap/sync', 'simbad_sptypes.csv', post={'request': 'doQuery', 'lang': 'adql', 'format': 'csv', 'query': adql}))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['lines'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
