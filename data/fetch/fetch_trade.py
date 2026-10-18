#!/usr/bin/env python3
"""交易の生データ (CEPII Gravity) を取得する (手で書き換えない)。目標 R01 用。

取得するもの:
  - CEPII Gravity database V202211 (Conte, Cotterlaz & Mayer 2022) … https://www.cepii.fr/DATA_DOWNLOAD/gravity/data/
    元の zip は約 200 MB (中の CSV は 1.25 GB) あり、リポジトリには置けない。そこで、2000〜2019 年の行と、
    重力モデルの推定に使う列だけを取り出して data/raw/trade/cepii_gravity_2000_2019.csv.gz に置く。
    元の zip の URL・取得日・SHA-256 と、取り出した列・行数を data/raw/trade/MANIFEST.json に記録する
    (同じ zip から、このスクリプトで同じファイルが作り直せる)。

取り出す列: year, iso3_o, iso3_d, dist (人口の多い都市どうしの距離 km), distw_harmonic (人口で重みを付けた距離 km),
  contig (隣接), comlang_off (公用語が同じ), comcol (同じ宗主国の植民地だった), col_dep_ever (植民地と宗主国の関係),
  fta_wto (自由貿易協定), tradeflow_baci (BACI の貿易額、千米ドル)
行: 2000〜2019 年、輸出国と輸入国が違う組で、その年に両方の国が存在するもの

使い方: python3 data/fetch/fetch_trade.py [zip のパス (省略すると取得する)]
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, tempfile, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'trade')
URL = 'https://www.cepii.fr/DATA_DOWNLOAD/gravity/data/Gravity_csv_V202211.zip'
MEMBER = 'Gravity_V202211.csv'
COLS = ['year', 'iso3_o', 'iso3_d', 'dist', 'distw_harmonic', 'contig', 'comlang_off', 'comcol', 'col_dep_ever', 'fta_wto', 'tradeflow_baci']
YEARS = (2000, 2019)
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def main():
    os.makedirs(ROOT, exist_ok=True)
    if len(sys.argv) > 1:
        zpath, fetched = sys.argv[1], None
    else:
        fd, zpath = tempfile.mkstemp(suffix='.zip')
        with os.fdopen(fd, 'wb') as f, urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=900) as r:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        fetched = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    h = hashlib.sha256()
    with open(zpath, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    out_name = f'cepii_gravity_{YEARS[0]}_{YEARS[1]}.csv.gz'
    out_path = os.path.join(ROOT, out_name)
    n = 0
    # gzip の頭に時刻を入れない (同じ zip から同じバイト列になるように)
    with zipfile.ZipFile(zpath) as z, z.open(MEMBER) as raw, open(out_path, 'wb') as fo, \
            gzip.GzipFile(fileobj=fo, mode='wb', compresslevel=9, mtime=0, filename='') as gz, \
            io.TextIOWrapper(gz, encoding='utf-8', newline='') as g:
        rd = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8'))
        w = csv.writer(g)
        w.writerow(COLS)
        for row in rd:
            y = int(row['year'])
            if y < YEARS[0] or y > YEARS[1] or row['iso3_o'] == row['iso3_d']:
                continue
            if row['country_exists_o'] != '1' or row['country_exists_d'] != '1':
                continue
            w.writerow([row[c] for c in COLS])
            n += 1
    with open(out_path, 'rb') as f:
        sha_out = hashlib.sha256(f.read()).hexdigest()
    man = {
        'source': 'CEPII Gravity database V202211 (Conte, M., Cotterlaz, P. & Mayer, T. 2022, CEPII Working Paper 2022-05)',
        'url': URL, 'member': MEMBER, 'zip_sha256': h.hexdigest(), 'fetched': fetched or '(手元の zip から作った)',
        'license': 'CEPII のデータの利用条件 (出典を明記して研究・教育に使う) に従う',
        'files': [{'file': out_name, 'columns': COLS, 'years': list(YEARS), 'rows': n, 'sha256': sha_out,
                   'filter': '輸出国 ≠ 輸入国、その年に両方の国が存在する (country_exists = 1)'}],
    }
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    if fetched:
        os.remove(zpath)
    print(f'{out_name}: {n} 行、{os.path.getsize(out_path) / 1e6:.1f} MB')

if __name__ == '__main__':
    main()
