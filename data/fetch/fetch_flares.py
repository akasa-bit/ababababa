#!/usr/bin/env python3
"""M 型星のフレアと、フレアの高エネルギー陽子の生データを取得する (手で書き換えない)。docs/physics.md の 6。

取得するもの:
  - Günther ほか 2020 (AJ 159, 60) の表 2: TESS の 1・2 セクタでフレアを起こした 1,228 星の、星ごとのフレアの頻度の分布の当てはめ
    (log10 回/日 = aFFD log10 E_bol + bFFD)。CDS の J/AJ/159/60
  - その星の位置 (TESS Input Catalog v8.2、VizieR IV/39 を TAP で TIC 番号から引く)
  - Galletta ほか 2025 (A&A 698, A180) の表 3 と星の表: 10 pc 以内の M 型星 172 個 (体積で選んだ、偏りのない標本) の TESS のセクタごとのフレアの数。CDS の J/A+A/698/A180
  - Papaioannou ほか 2023 (A&A 671, A66) の付録 C: 1984〜2017 年の、よく磁力線でつながった太陽の高エネルギー陽子の現象 65 回の、
    陽子のフルエンス (>10・30・60・100 MeV) と元のフレアの X 線の等級。arXiv の原稿 (2211.15312) の LaTeX から表だけを取り出す
  - NOAA の GOES の X 線のフレアの記録 (1984〜2017 年の年ごと)。同じ期間の、全部のフレアの数を数えるため
保存先は data/raw/flares/。取得日・URL・SHA-256・行数を data/raw/flares/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_flares.py
"""
import datetime, gzip, hashlib, io, json, os, re, tarfile, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'flares')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def fetch(url, data=None):
    for k in range(5):  # 接続が途中で切れたら、間をあけて取り直す
        try:
            req = urllib.request.Request(url, headers=UA, data=data)
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except (urllib.error.URLError, ConnectionError) as e:
            if getattr(e, 'code', None) == 404 or k == 4: raise
            time.sleep(2 ** (k + 1))

def save(path, data, url, **extra):
    with open(os.path.join(ROOT, path), 'wb') as f:
        f.write(data)
    return {'file': path, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'lines': data.count(b'\n'), **extra}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    cds = 'https://cdsarc.cds.unistra.fr/ftp/'
    for cat, files in (('J/AJ/159/60', ['ReadMe', 'table2.dat']), ('J/A+A/698/A180', ['ReadMe', 'stars.dat', 'table3.dat'])):
        tag = 'gunther2020' if '159' in cat else 'galletta2025'
        for f in files:
            url = cds + cat + '/' + f
            b = fetch(url)
            if b[:2] == b'\x1f\x8b': b = gzip.decompress(b)
            out.append(save(f'{tag}_{f.replace(".dat", "")}.txt', b, url))
    # Günther の星の位置 (TIC v8.2)
    tics = sorted({int(l[0:9]) for l in open(os.path.join(ROOT, 'gunther2020_table2.txt')) if l[:9].strip().isdigit()})
    q = 'SELECT TIC, RAJ2000, DEJ2000, Tmag, Teff, Dist FROM "IV/39/tic82" WHERE TIC IN (' + ','.join(map(str, tics)) + ')'
    url = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync'
    b = fetch(url, urllib.parse.urlencode({'request': 'doQuery', 'lang': 'ADQL', 'format': 'csv', 'query': q}).encode())
    out.append(save('gunther2020_tic.csv', b, url, query='SELECT TIC, RAJ2000, DEJ2000, Tmag, Teff, Dist FROM "IV/39/tic82" WHERE TIC IN (表 2 の TIC)'))
    # Papaioannou ほか 2023 の付録 C
    url = 'https://arxiv.org/e-print/2211.15312'
    tgz = fetch(url)
    with tarfile.open(fileobj=io.BytesIO(tgz)) as t:
        tex = t.extractfile('43407corr.tex').read().decode('utf8', 'replace')
    i = tex.index('label{appendix:C}')
    m = re.search(r'\\begin\{tabular\}.*?\\end\{tabular\}', tex[i:], re.S)
    out.append(save('papaioannou2023_appC.tex', m.group(0).encode('utf8'), url + '#43407corr.tex (appendix C)', source_sha256=hashlib.sha256(tgz).hexdigest()))
    # NOAA の GOES の X 線のフレアの記録
    base = 'https://www.ngdc.noaa.gov/stp/space-weather/solar-data/solar-features/solar-flares/x-rays/goes/xrs/'
    allb = b''
    for y in range(1984, 2018):
        allb += fetch(base + f'goes-xrs-report_{y}{"-ytd" if y == 2017 else ""}.txt')  # 2017 年は年の途中までのファイルしかない
    # 6 MB あるので gzip にして置く (mtime 0 にして、同じ中身なら同じバイト列に)。SHA-256 は展開した中身のもの
    o = save('goes_xrs_1984_2017.txt.gz', gzip.compress(allb, mtime=0), base + 'goes-xrs-report_{1984..2016}.txt と goes-xrs-report_2017-ytd.txt (年ごとのファイルをつないだ)')
    o['sha256_uncompressed'] = hashlib.sha256(allb).hexdigest(); o['lines'] = allb.count(b'\n')
    out.append(o)
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    for o in out:
        print(o['file'], o['lines'], o['sha256'][:12])

if __name__ == '__main__':
    main()
