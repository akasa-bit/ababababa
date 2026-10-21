#!/usr/bin/env python3
"""産業構造 (第一次〜第三次産業の就業) の生データを取得する (手で書き換えない)。セッション 9 (S4) の目標 R10 用。

取得するもの:
  - GGDC 10-Sector Database (Timmer・de Vries・de Vries 2015、2014 年 1 月版)。42 か国・1950〜2012 年の 10 部門の就業者と付加価値
    … https://www.rug.nl/ggdc/structuralchange/previous-sectoral-database/10-sector-database
  - Maddison Project Database 2023 (Bolt & van Zanden 2024) の 1 人あたり所得 (2011 年の国際ドル) と人口。GGDC に所得がないので、
    Herrendorf・Rogerson・Valentinyi 2014 と同じく、これを所得の軸にする。元の xlsx (4.9 MB) の「Full data」の 1800 年からの行だけを置く
    … https://doi.org/10.34894/INZBF2 (dataverse.nl のファイル 421302)
  - 世界銀行 WDI の API: 農業・工業・サービスの就業者の割合 (ILOSTAT のモデル推計。1991 年〜) と、1 人あたり所得 (PPP、2021 年の国際ドル)
    … https://data.worldbank.org/
ILOSTAT の窓口 (rplumber.ilo.org) は、この環境から中身が空で返ったので、ILOSTAT の値は WDI に載っているもの (SL.*.EMPL.ZS) を使う。
保存先は data/raw/sectors/。取得日・URL・SHA-256・大きさを data/raw/sectors/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_sectors.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'sectors')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
GGDC = 'https://www.rug.nl/ggdc/docs/10sd_jan15_2014.xlsx'
MPD = 'https://dataverse.nl/api/access/datafile/421302'
WDI = ['SL.AGR.EMPL.ZS', 'SL.IND.EMPL.ZS', 'SL.SRV.EMPL.ZS', 'NY.GDP.PCAP.PP.KD']

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()

def rec(name, url, data, **extra):
    return {'file': name, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), **extra}

def wdi(ind):
    url = f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&per_page=20000&date=1960:2024'
    out, page = [], 1
    while True:
        meta, rows = json.loads(fetch(f'{url}&page={page}'))
        out += [[r['countryiso3code'], r['country']['value'], r['date'], r['value']] for r in rows or [] if r['value'] is not None]
        if page >= meta['pages']:
            return out
        page += 1

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    data = fetch(GGDC)
    with open(os.path.join(ROOT, '10sd_jan15_2014.xlsx'), 'wb') as f:
        f.write(data)
    out.append(rec('10sd_jan15_2014.xlsx', GGDC, data))
    raw = fetch(MPD)
    import openpyxl
    ws = openpyxl.load_workbook(io.BytesIO(raw), read_only=True)['Full data']
    rows = [r for r in ws.iter_rows(values_only=True)]
    keep = [r for r in rows[1:] if r[3] and r[3] >= 1800 and (r[4] is not None or r[5] is not None)]
    buf = io.StringIO()
    csv.writer(buf, lineterminator='\n').writerows([rows[0], *keep])
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, 'mpd2023.csv.gz'), 'wb') as f:
        f.write(data)
    out.append(rec('mpd2023.csv.gz', MPD + '#mpd2023_web.xlsx/Full data', data, source_sha256=hashlib.sha256(raw).hexdigest(), rows=len(keep),
                   filter='「Full data」の 1800 年からの行 (所得か人口のあるもの)'))
    countries = {c['id'] for c in json.loads(fetch('https://api.worldbank.org/v2/country?format=json&per_page=400'))[1] if c['region']['id'] != 'NA'}
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['indicator', 'iso3', 'country', 'year', 'value'])
    n = 0
    for ind in WDI:
        for r in wdi(ind):
            if r[0] in countries:
                w.writerow([ind, *r])
                n += 1
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, 'wdi_sectors.csv.gz'), 'wb') as f:
        f.write(data)
    out.append(rec('wdi_sectors.csv.gz', 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}', data, rows=n,
                   filter='国だけ (地域の集計を除く)・1960〜2024 年'))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
