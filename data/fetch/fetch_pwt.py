#!/usr/bin/env python3
"""Penn World Table 11.0 の生データを取得する (手で書き換えない)。技術革新の目標 (技術水準の前線比・規模効果・TFP の収束ほか。回 KE6・B-121。
docs/research/innovation.md)。

取得するもの: Penn World Table 11.0 (Feenstra, Inklaar & Timmer 2015 の 2025 年の更新。DataverseNL doi:10.34894/FABVLR の pwt110.xlsx、CC BY 4.0)。
使う列だけを取り出して data/raw/tfp/pwt110.csv.gz に置く:
  countrycode, country, year, rgdpe・rgdpo (支出・生産の側の実質 GDP、百万 2021 年 US ドル)、pop・emp (人口・就業者、百万人)、hc (人的資本の指数)、
  ctfp (TFP の水準。その年の購買力平価、米国 = 1)、rtfpna (TFP。各国の物価、2021 年 = 1)、labsh (労働分配率)、cn・rnna (資本ストック)
取得日・URL・SHA-256・行数を data/raw/tfp/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_pwt.py [pwt110.xlsx のパス] [それを落とした日時 (UTC)]   (パスを省くと取得する。pandas と openpyxl が要る)
"""
import datetime, gzip, hashlib, io, json, os, sys, tempfile, urllib.request
import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'tfp')
URL = 'https://dataverse.nl/api/access/datafile/554105'
COLS = ['countrycode', 'country', 'year', 'rgdpe', 'rgdpo', 'pop', 'emp', 'hc', 'ctfp', 'rtfpna', 'labsh', 'cn', 'rnna']
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


def main():
    os.makedirs(ROOT, exist_ok=True)
    local = len(sys.argv) > 1
    src = sys.argv[1] if local else get(URL, '.xlsx')
    fetched = sys.argv[2] if len(sys.argv) > 2 else None if local else datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    p = pd.read_excel(src, sheet_name='Data')[COLS].sort_values(['countrycode', 'year'], kind='stable')
    p['year'] = p['year'].astype(int)
    path = os.path.join(ROOT, 'pwt110.csv.gz')
    # gzip の頭に時刻を入れない (同じ元のファイルから同じバイト列になるように)
    with open(path, 'wb') as fo, gzip.GzipFile(fileobj=fo, mode='wb', compresslevel=9, mtime=0, filename='') as gz, \
            io.TextIOWrapper(gz, encoding='utf-8', newline='') as g:
        p.to_csv(g, index=False, lineterminator='\n')
    man = {
        'source': 'Penn World Table 11.0 (Feenstra, Inklaar & Timmer 2015, AER 105(10) の更新。DataverseNL 10.34894/FABVLR の pwt110.xlsx、CC BY 4.0)',
        'url': URL, 'fetched': fetched or '(手元のファイルから作った)', 'license': 'CC BY 4.0 (出典を明記する)',
        'files': [{'file': 'pwt110.csv.gz', 'from': 'pwt110.xlsx (シート Data)', 'columns': COLS, 'rows': int(len(p)), 'sha256': sha(path), 'source_sha256': sha(src),
                   'filter': 'なし (列だけを取り出した)'}],
    }
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    if not local:
        os.remove(src)
    print('pwt110.csv.gz', len(p), '行', p['countrycode'].nunique(), 'か国', p['year'].min(), '〜', p['year'].max())


if __name__ == '__main__':
    sys.exit(main())
