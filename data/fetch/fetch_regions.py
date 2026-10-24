#!/usr/bin/env python3
"""国の中の地域と労働分配率の生データを取得する (手で書き換えない)。目標 R38・R39 (回 KE5。docs/regions.md の 3.3)。

取得するもの:
  - DOSE v2 (Wenz, Carr, Kögel, Kotz & Kalkuhl 2023。83 か国・1,661 地域・1953〜2020 年) … Zenodo 7573249 の DOSE_V2.csv (約 15 MB)。
    使う列だけを取り出して data/raw/regions/dose_v2.csv.gz に置く:
      country, GID_0, GID_1, year, pop, grp_pc_lcu_2015 (2015 年の値段の地域の 1 人あたり総生産、自国通貨), grp_pc_usd_2015, StructChange (統計の切れ目)
  - Penn World Table 10.01 (Feenstra, Inklaar & Timmer 2015) … DataverseNL doi:10.34894/QT5BCC の pwt1001.dta (約 3.5 MB)。
    使う列だけを取り出して data/raw/regions/pwt1001.csv.gz に置く:
      countrycode, year, labsh (労働分配率), rgdpe (支出側の実質 GDP、2017 年の購買力平価の百万ドル), pop (百万人),
      irr (資本の実質の収益率), delta (資本の減価償却の率), cn (資本ストック、いまの購買力平価の百万ドル), cgdpo (生産側の GDP、同じ), csh_i (投資 ÷ GDP)
元のファイルの URL・取得日・SHA-256 と、取り出した列・行数を data/raw/regions/MANIFEST.json に記録する (同じ元のファイルから同じバイト列になる)。

使い方: python3 data/fetch/fetch_regions.py [DOSE_V2.csv のパス] [pwt1001.dta のパス] [それを落とした日時 (UTC)]   (パスを省くと取得する。pandas が要る)
"""
import datetime, gzip, hashlib, io, json, os, sys, tempfile, urllib.request

import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'regions')
DOSE_URL = 'https://zenodo.org/api/records/7573249/files/DOSE_V2.csv/content'
PWT_URL = 'https://dataverse.nl/api/access/datafile/354098'
DOSE_COLS = ['country', 'GID_0', 'GID_1', 'year', 'pop', 'grp_pc_lcu_2015', 'grp_pc_usd_2015', 'StructChange']
PWT_COLS = ['countrycode', 'year', 'labsh', 'rgdpe', 'pop', 'irr', 'delta', 'cn', 'cgdpo', 'csh_i']
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}


def get(url, suffix):
    fd, p = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, 'wb') as f, urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        f.write(r.read())
    return p


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def write_gz(df, name):
    path = os.path.join(ROOT, name)
    # gzip の頭に時刻を入れない (同じ元のファイルから同じバイト列になるように)
    with open(path, 'wb') as fo, gzip.GzipFile(fileobj=fo, mode='wb', compresslevel=9, mtime=0, filename='') as gz, \
            io.TextIOWrapper(gz, encoding='utf-8', newline='') as g:
        df.to_csv(g, index=False, lineterminator='\n')
    return {'file': name, 'columns': list(df.columns), 'rows': len(df), 'sha256': sha(path)}


def main():
    os.makedirs(ROOT, exist_ok=True)
    local = len(sys.argv) > 2
    dose, pwt = (sys.argv[1], sys.argv[2]) if local else (get(DOSE_URL, '.csv'), get(PWT_URL, '.dta'))
    fetched = sys.argv[3] if len(sys.argv) > 3 else None if local else datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    d = pd.read_csv(dose)[DOSE_COLS].sort_values(['GID_0', 'GID_1', 'year'], kind='stable')
    p = pd.read_stata(pwt)[PWT_COLS].dropna(subset=['labsh']).sort_values(['countrycode', 'year'], kind='stable')
    p['year'] = p['year'].astype(int)
    files = [
        {**write_gz(d, 'dose_v2.csv.gz'), 'from': 'DOSE_V2.csv', 'url': DOSE_URL, 'source_sha256': sha(dose), 'filter': 'なし (列だけを取り出した)'},
        {**write_gz(p, 'pwt1001.csv.gz'), 'from': 'pwt1001.dta', 'url': PWT_URL, 'source_sha256': sha(pwt), 'filter': 'labsh のある国・年'},
    ]
    man = {
        'source': 'DOSE v2 (Wenz ほか 2023, Scientific Data 10, 425。Zenodo 10.5281/zenodo.7573249、CC BY 4.0)・'
                  'Penn World Table 10.01 (Feenstra, Inklaar & Timmer 2015, AER 105(10)。DataverseNL 10.34894/QT5BCC、CC BY 4.0)',
        'fetched': fetched or '(手元のファイルから作った)',
        'license': 'どちらも CC BY 4.0 (出典を明記する)',
        'files': files,
    }
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    if not local:
        os.remove(dose)
        os.remove(pwt)
    for x in files:
        print(x['file'], x['rows'], '行', f"{os.path.getsize(os.path.join(ROOT, x['file'])) / 1e6:.1f} MB")


if __name__ == '__main__':
    main()
