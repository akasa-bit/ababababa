#!/usr/bin/env python3
"""市場 (値段と在庫) の生データを取得する (手で書き換えない)。段 5 の需要で決まる生産と物価の目標 (R23〜R26) 用。

取得するもの:
  - World Bank Commodity Price Data (Pink Sheet) の年次の表 (1960 年〜。名目と実質の値段・指数)
    … https://www.worldbank.org/en/research/commodity-markets
  - USDA Foreign Agricultural Service, Production, Supply and Distribution (PSD) の穀物と豆類 (国ごと・年ごとの
    生産・消費・期末在庫)。元の zip は 2.9 MB (中の CSV は 30 MB ほど) なので、小麦・とうもろこし・米の
    期末在庫と国内消費の行だけを取り出して data/raw/market/psd_cereals.csv.gz に置く (同じ zip から作り直せる)
    … https://apps.fas.usda.gov/psdonline/
  - FRED ISRATIO (米国の企業全体の在庫 ÷ 売上、月次。U.S. Census Bureau の Manufacturing and Trade Inventories and Sales)
保存先は data/raw/market/。取得日・URL・SHA-256・大きさを data/raw/market/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_market.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'market')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
PINK = 'https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Annual.xlsx'
PSD = 'https://apps.fas.usda.gov/psdonline/downloads/psd_grains_pulses_csv.zip'
FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=ISRATIO'
CROPS = {'Wheat', 'Corn', 'Rice, Milled'}
ATTRS = {'Ending Stocks', 'Domestic Consumption'}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()

def rec(name, url, data, **extra):
    return {'file': name, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), **extra}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    for url, name in [(PINK, 'CMO-Historical-Data-Annual.xlsx'), (FRED, 'fred_isratio.csv')]:
        data = fetch(url)
        with open(os.path.join(ROOT, name), 'wb') as f:
            f.write(data)
        out.append(rec(name, url, data))
    z = fetch(PSD)
    with zipfile.ZipFile(io.BytesIO(z)) as zf:
        member = next(n for n in zf.namelist() if n.endswith('.csv'))
        rows = list(csv.DictReader(io.TextIOWrapper(zf.open(member), encoding='utf-8-sig')))
    keep = [r for r in rows if r['Commodity_Description'] in CROPS and r['Attribute_Description'] in ATTRS]
    cols = ['Commodity_Description', 'Country_Code', 'Country_Name', 'Market_Year', 'Attribute_Description', 'Unit_Description', 'Value']
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for r in keep:
        w.writerow([r[c] for c in cols])
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, 'psd_cereals.csv.gz'), 'wb') as f:
        f.write(data)
    out.append(rec('psd_cereals.csv.gz', f'{PSD}#{member}', data, source_sha256=hashlib.sha256(z).hexdigest(),
                   rows=len(keep), filter='小麦・とうもろこし・米 (Wheat, Corn, Rice, Milled) の Ending Stocks と Domestic Consumption'))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
