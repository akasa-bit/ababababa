#!/usr/bin/env python3
"""家臣の要求をのむかの判断 (QD-41 = c・B-142。docs/demands.md) の生データを取得する (手で書き換えない)。

取得するもの (data/raw/demands/ に置く):
  - Germann & Sambanis 2021 (International Organization 75(1)) の再現データ GS_grievances_escalation (Harvard Dataverse doi:10.7910/DVN/EI1JMG。CC0):
    EPR の集団・年 (1946〜2012) に、自決を求める運動 (SDM。Sambanis, Germann & Schädel 2018 の SDM 1.0 を EPR に重ねたもの)・地域の自治 (regaut)・
    中央の権力への近さ (status_*)・人口の割合 (groupsize)・武力の紛争 (violsd) を付けたもの。一度でも運動のあった集団の行と、使う列だけ残す
  - GeoEPR 2021 (Vogt ほか 2015。CC BY-NC-SA 4.0): 集団の住む地域の多角形。上の集団の地域ごとに、面積で重みを付けた重心 (経度・緯度の平面で計算) だけ残す
  - CShapes 2.0 (Schvitz ほか 2022。CC BY-NC-SA 4.0): 国の期間ごとの首都の位置と面積。上の国の行と、使う列だけ残す
取得日・URL・SHA-256 (取ってきたままのファイルの)・行数を data/raw/demands/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_demands.py
"""
import csv, datetime, hashlib, io, json, os, sys, time, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'demands')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
GS = 'https://dataverse.harvard.edu/api/access/datafile/3861598'  # GS_grievances_escalation.tab (doi:10.7910/DVN/EI1JMG)
GEOEPR = 'https://icr.ethz.ch/data/epr/geoepr/GeoEPR-2021.geojson'
CSHAPES = 'https://icr.ethz.ch/data/cshapes/CShapes-2.0.csv'
GS_COLS = ['gwgroupid', 'year', 'countries_gwid', 'countryname', 'groupname', 'sdm', 'regaut', 'status_excl', 'status_pwrrank', 'groupsize', 'violsd']
CS_COLS = ['gwcode', 'cntry_name', 'gwsyear', 'gweyear', 'capname', 'caplat', 'caplong', 'area']


def get(url):
    for wait in (10, 30, 60, None):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=900) as r:
                return r.read()
        except Exception:
            if wait is None:
                raise
            time.sleep(wait)


def save(name, rows):
    out = io.StringIO()
    csv.writer(out, lineterminator='\n').writerows(rows)
    data = out.getvalue().encode('utf-8')
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    return {'file': name, 'bytes': len(data), 'rows': len(rows) - 1}


def ring_centroid(ring):
    """多角形の外側の輪の重心と面積 (経度・緯度の平面。符号付きの面積の式)"""
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        f = x1 * y2 - x2 * y1
        a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
    if abs(a) < 1e-12:
        return None, 0.0
    return (cx / (3 * a), cy / (3 * a)), abs(a) / 2


def main():
    os.makedirs(ROOT, exist_ok=True)
    now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    sha = lambda b: hashlib.sha256(b).hexdigest()
    files = []
    # 1. 集団・年: 一度でも運動 (sdm = 1) のあった集団の行だけ
    raw = get(GS)
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8')), delimiter='\t'))
    num = lambda v: v.split('.')[0] if v.endswith('.0') else v  # Stata の書き出しの 1946.0 → 1946
    ids = {r['gwgroupid'] for r in rows if r['sdm'] in ('1', '1.0')}
    keep = [GS_COLS] + [[num(r[c]) for c in GS_COLS] for r in rows if r['gwgroupid'] in ids]
    files.append({**save('gs_sdm_groups.csv', keep), 'url': GS, 'sha256_source': sha(raw), 'fetched': now(),
                  'filter': f'一度でも sdm = 1 の集団 ({len(ids)}) の行。列 {", ".join(GS_COLS)} だけ'})
    gws = {num(r['countries_gwid']) for r in rows if r['gwgroupid'] in ids}
    # 2. 集団の地域の重心
    raw = get(GEOEPR)
    keep = [['gwgroupid', 'gwid', 'from', 'to', 'type', 'sqkm', 'cen_lat', 'cen_lon']]
    for f in json.loads(raw)['features']:
        p = f['properties']
        if str(p['gwgroupid']) not in ids:
            continue
        tot = sx = sy = 0.0
        for poly in f['geometry']['coordinates']:
            c, a = ring_centroid(poly[0])
            if c:
                sx += c[0] * a; sy += c[1] * a; tot += a
        if tot:
            keep.append([p['gwgroupid'], p['gwid'], p['from'], p['to'], p['type'], p['sqkm'], round(sy / tot, 5), round(sx / tot, 5)])
    files.append({**save('geoepr_centroids.csv', keep), 'url': GEOEPR, 'sha256_source': sha(raw), 'fetched': now(),
                  'filter': '上の集団の地域ごとに、多角形 (外側の輪) の面積で重みを付けた重心 (経度・緯度の平面)。多角形そのものは置かない'})
    # 3. 首都と面積
    raw = get(CSHAPES)
    csv.field_size_limit(10 ** 9)
    keep = [CS_COLS] + [[r[c] for c in CS_COLS] for r in csv.DictReader(io.StringIO(raw.decode('utf-8'))) if r['gwcode'] in gws]
    files.append({**save('cshapes_capitals.csv', keep), 'url': CSHAPES, 'sha256_source': sha(raw), 'fetched': now(),
                  'filter': f'上の集団の国 ({len(gws)}) の行。列 {", ".join(CS_COLS)} だけ (国の形は置かない)'})
    man = {
        'sources': {
            'gs_sdm_groups.csv': 'Germann, M. & Sambanis, N. 2021. Political Exclusion, Lost Autonomy, and Escalating Conflict over Self-Determination. International Organization 75(1), 178-203。再現データ (Harvard Dataverse doi:10.7910/DVN/EI1JMG。CC0)。運動は Sambanis, Germann & Schädel 2018 (JCR 62(3)) の SDM、集団は EPR Core (Vogt ほか 2015)',
            'geoepr_centroids.csv': 'Vogt, Bormann, Rüegger, Cederman, Hunziker & Girardin 2015. Integrating Data on Ethnicity, Geography, and Conflict: The Ethnic Power Relations Data Set Family. JCR 59(7)。GeoEPR 2021 (CC BY-NC-SA 4.0。研究のための抜き出しで、ゲームには係数だけを入れる)',
            'cshapes_capitals.csv': 'Schvitz, Girardin, Rüegger, Weidmann, Cederman & Gleditsch 2022. Mapping the International System, 1886-2019: The CShapes 2.0 Dataset. JCR 66(1)。CC BY-NC-SA 4.0 (研究のための抜き出しで、ゲームには係数だけを入れる)',
        },
        'files': files,
    }
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    for x in files:
        print(x['file'], x['rows'], '行')


if __name__ == '__main__':
    sys.exit(main())
