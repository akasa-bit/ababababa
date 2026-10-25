#!/usr/bin/env python3
"""国民総所得 (GNI) と国内総生産 (GDP) の生データを取得する (手で書き換えない)。目標 R65 と、遠くの持ち主 (利潤の送り返し) の作り (回 KE5・B-114)。

取得するもの (世界銀行 World Development Indicators の API。どちらも名目の米ドル):
  - NY.GNP.MKTP.CD: 国民総所得 (GNI) = GDP + 外からの所得の受け取り − 外への支払い (雇用者の報酬・利潤・配当・利子)
  - NY.GDP.MKTP.CD: 国内総生産 (GDP)
  - BX.KLT.DINV.WD.GD.ZS: 直接投資の受け入れ (純) ÷ GDP [%]、NE.GDI.FTOT.ZS: 総固定資本形成 ÷ GDP [%]
    (新しい投資のうち外国が出す割合 = 直接投資 ÷ 総固定資本形成。遠くの持ち分が近づく先 OWNER.fdi を決める。目標ではない)
  1990〜2024 年。所得の分位は R61・R62 と同じ WDI の NY.GDP.PCAP.PP.KD (data/raw/tech/wdi_tech.csv.gz。data/fetch/fetch_tech.py) で分ける。
保存先は data/raw/gni/wdi_gni.csv.gz (列 indicator, iso3, country, year, value。国だけ、地域の集計を除く)。
取得日・URL・SHA-256・行数を data/raw/gni/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_gni.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'gni')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
WDI = ['NY.GNP.MKTP.CD', 'NY.GDP.MKTP.CD', 'BX.KLT.DINV.WD.GD.ZS', 'NE.GDI.FTOT.ZS']


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()


def wdi(ind):
    """WDI の 1 つの指標を、全部の国・地域と全部の年で取る (国だけにするのは呼ぶ側)"""
    url = f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&per_page=20000&date=1990:2024'
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
    rows = []
    for ind in WDI:
        got = wdi(ind)
        rows += [[ind, *r] for r in got if r[0] in countries]
        print(ind, len(got))
    rows.sort(key=lambda r: (r[0], r[1], r[3]))
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['indicator', 'iso3', 'country', 'year', 'value'])
    w.writerows(rows)
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, 'wdi_gni.csv.gz'), 'wb') as f:
        f.write(data)
    man = [{'file': 'wdi_gni.csv.gz', 'url': 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}',
            'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'rows': len(rows),
            'filter': '国だけ (地域の集計を除く)・1990〜2024 年', 'license': 'CC BY 4.0 (世界銀行の利用条件)'}]
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wdi_gni.csv.gz', len(rows), '行', man[0]['sha256'][:12])


if __name__ == '__main__':
    sys.exit(main())
