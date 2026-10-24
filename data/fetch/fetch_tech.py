#!/usr/bin/env python3
"""製造業の中の中・高技術の割合の生データを取得する (手で書き換えない)。目標 R61 と、工業品を低付加価値物品と高付加価値物品に分ける需要の曲線 (回 KE5)。

取得するもの (世界銀行 World Development Indicators の API):
  - NV.MNF.TECH.ZS.UN: 製造業の付加価値のうち中・高技術の産業の割合 [%] (UNIDO の Competitive Industrial Performance database。
    産業の分け方は OECD の研究開発の強さ (ISIC。化学・機械・電気・輸送機械・精密機器など))
  - NV.IND.MANF.ZS: 製造業の付加価値 ÷ GDP [%] (参考)
  - NY.GDP.PCAP.PP.KD: 1 人あたり GDP (購買力平価、2021 年の国際ドル)
保存先は data/raw/tech/wdi_tech.csv.gz (列 indicator, iso3, country, year, value。国だけ、地域の集計を除く)。
取得日・URL・SHA-256・行数を data/raw/tech/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_tech.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'tech')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
WDI = ['NV.MNF.TECH.ZS.UN', 'NV.IND.MANF.ZS', 'NY.GDP.PCAP.PP.KD']


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()


def wdi(ind):
    """WDI の 1 つの指標を、全部の国・地域と全部の年で取る (国だけにするのは呼ぶ側)"""
    url = f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&per_page=20000&date=1960:2024'
    out, page = [], 1
    while True:
        meta, rows = json.loads(fetch(f'{url}&page={page}'))
        out += [[r['countryiso3code'], r['country']['value'], r['date'], r['value']] for r in rows or [] if r['value'] is not None]
        if page >= meta['pages']:
            return out, url
        page += 1


def main():
    os.makedirs(ROOT, exist_ok=True)
    countries = {c['id'] for c in json.loads(fetch('https://api.worldbank.org/v2/country?format=json&per_page=400'))[1] if c['region']['id'] != 'NA'}
    rows = []
    for ind in WDI:
        got, url = wdi(ind)
        rows += [[ind, *r] for r in got if r[0] in countries]
        print(ind, len(got))
    rows.sort(key=lambda r: (r[0], r[1], r[3]))
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['indicator', 'iso3', 'country', 'year', 'value'])
    w.writerows(rows)
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, 'wdi_tech.csv.gz'), 'wb') as f:
        f.write(data)
    man = [{'file': 'wdi_tech.csv.gz', 'url': 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}',
            'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'rows': len(rows),
            'filter': '国だけ (地域の集計を除く)・1960〜2024 年', 'license': 'CC BY 4.0 (世界銀行の利用条件)'}]
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wdi_tech.csv.gz', len(rows), '行', man[0]['sha256'][:12])


if __name__ == '__main__':
    sys.exit(main())
