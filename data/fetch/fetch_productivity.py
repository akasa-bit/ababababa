#!/usr/bin/env python3
"""生産性の長い期間の生データを取得する (手で書き換えない)。開始時に選ぶ「生産性」(2300 年の予測) 用。

取得するもの:
  - Long-Term Productivity Database v2.7 (Bergeaud, Cette & Lecat 2016、2026 年 2 月版): 25 か国 1890 年〜の
    1 時間あたりの労働生産性・TFP・1 人あたり GDP・1 人あたりの労働時間 … http://www.longtermproductivity.com/
    引用: Bergeaud, A., Cette, G. & Lecat, R. (2016). Productivity Trends in Advanced Countries between 1890 and 2012.
    Review of Income and Wealth 62(3), 420–444.
  - Maddison Project Database 2023 (Bolt & van Zanden 2024): 国ごと・年ごとの 1 人あたり GDP と人口。元の xlsx (4.9 MB) の
    「Full data」の表だけを CSV にして data/raw/productivity/mpd2023_full.csv.gz に置く (同じ xlsx から作り直せる)
    … https://www.rug.nl/ggdc/historicaldevelopment/maddison/
保存先は data/raw/productivity/。取得日・URL・SHA-256・大きさを data/raw/productivity/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_productivity.py
"""
import datetime, gzip, hashlib, io, json, os, sys, urllib.request
import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'productivity')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
BCL = 'http://www.longtermproductivity.com/download/BCLDatabase_online_v2.7.xlsx'
MPD = 'https://dataverse.nl/api/access/datafile/421302'

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()

def rec(name, url, data, **extra):
    return {'file': name, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), **extra}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    data = fetch(BCL)
    with open(os.path.join(ROOT, 'BCLDatabase_online_v2.7.xlsx'), 'wb') as f:
        f.write(data)
    out.append(rec('BCLDatabase_online_v2.7.xlsx', BCL, data))
    z = fetch(MPD)
    full = pd.read_excel(io.BytesIO(z), 'Full data')
    data = gzip.compress(full.to_csv(index=False).encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, 'mpd2023_full.csv.gz'), 'wb') as f:
        f.write(data)
    out.append(rec('mpd2023_full.csv.gz', f'{MPD}#Full data', data, source_sha256=hashlib.sha256(z).hexdigest(), rows=len(full),
                   source_file='mpd2023_web.xlsx (Maddison Project Database 2023)'))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
