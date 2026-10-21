#!/usr/bin/env python3
"""研究者の多さと研究費の生データを取得する (手で書き換えない)。セッション 9 (S4) の研究 (目標 R11) で、研究者の割合を所得で決めるのに使う。

取得するもの (世界銀行 WDI の API。国だけ・1960〜2024 年):
  - SP.POP.SCIE.RD.P6   研究者の数 (人口 100 万人あたり。UNESCO 統計研究所の値)
  - GB.XPD.RSDV.GD.ZS   研究開発費 ÷ GDP (%)
  - SL.TLF.TOTL.IN      労働力人口 (研究者 ÷ 就業者の確かめ用)
  … https://data.worldbank.org/ (CC BY 4.0)
所得の軸は、R10 と同じく Maddison Project Database 2023 (data/raw/sectors/mpd2023.csv.gz、2011 年の国際ドル) を使う (ここでは取らない)。
保存先は data/raw/research/。取得日・URL・SHA-256・大きさを data/raw/research/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_research.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'research')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
WDI = ['SP.POP.SCIE.RD.P6', 'GB.XPD.RSDV.GD.ZS', 'SL.TLF.TOTL.IN']

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()

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
    with open(os.path.join(ROOT, 'wdi_research.csv.gz'), 'wb') as f:
        f.write(data)
    out = [{'file': 'wdi_research.csv.gz', 'url': 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}',
            'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'rows': n, 'filter': '国だけ (地域の集計を除く)・1960〜2024 年'}]
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['rows'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
