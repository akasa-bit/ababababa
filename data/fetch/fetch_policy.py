#!/usr/bin/env python3
"""現実の経済政策で使われた値の幅の生データを取得する (手で書き換えない)。セッション 19 (政策の一覧の「現実に使われた値の幅」) と
セッション 20 (税・利子率・予算・赤字の上限を現実の幅で細かく選べるようにする) に使う。

取得するもの:
  - BIS の中央銀行の政策金利 (WS_CBPOL、月次、全ての国。国によっては 1946 年から) … https://data.bis.org/ (BIS の利用条件: 出典を示す)
  - 世界銀行 WDI (国だけ・1960〜2024 年):
      FP.CPI.TOTL.ZG      消費者物価のインフレ率 (%)
      FR.INR.LEND         貸出金利 (%)
      FR.INR.DPST         預金金利 (%)
      GC.TAX.TOTL.GD.ZS   税収 ÷ GDP (%)
      GC.XPN.TOTL.GD.ZS   政府の支出 ÷ GDP (%)
      GC.DOD.TOTL.GD.ZS   中央政府の債務 ÷ GDP (%)
      GC.NLD.TOTL.GD.ZS   純貸出 (黒字) ÷ GDP (%)
      TM.TAX.MRCH.WM.AR.ZS 関税率 (加重平均、全品目、%)
      GC.TAX.GSRV.RV.ZS   財・サービスへの税 ÷ 税収 (%)
      GC.TAX.YPKG.RV.ZS   所得・利益・資本利得への税 ÷ 税収 (%)
      GC.TAX.INTT.RV.ZS   国際取引への税 ÷ 税収 (%)
      FM.LBL.BMNY.GD.ZS   広い意味のお金 ÷ GDP (%)
    … https://data.worldbank.org/ (CC BY 4.0)
保存先は data/raw/policy/。取得日・URL・SHA-256・大きさを data/raw/policy/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_policy.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'policy')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
BIS = 'https://stats.bis.org/api/v1/data/WS_CBPOL/M.?format=csv'
WDI = ['FP.CPI.TOTL.ZG', 'FR.INR.LEND', 'FR.INR.DPST', 'GC.TAX.TOTL.GD.ZS', 'GC.XPN.TOTL.GD.ZS', 'GC.DOD.TOTL.GD.ZS', 'GC.NLD.TOTL.GD.ZS',
       'TM.TAX.MRCH.WM.AR.ZS', 'GC.TAX.GSRV.RV.ZS', 'GC.TAX.YPKG.RV.ZS', 'GC.TAX.INTT.RV.ZS', 'FM.LBL.BMNY.GD.ZS']

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

def record(name, data, url, **extra):
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    return {'file': name, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), **extra}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    # BIS: 政策金利 (CSV をそのまま gzip)
    bis = fetch(BIS)
    rows = sum(1 for _ in csv.reader(io.StringIO(bis.decode('utf-8')))) - 1
    out.append(record('bis_cbpol.csv.gz', gzip.compress(bis, mtime=0), BIS, rows=rows, note='中央銀行の政策金利 (月次、期末)。列は BIS の SDMX の CSV のまま'))
    # WDI
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
    out.append(record('wdi_policy.csv.gz', gzip.compress(buf.getvalue().encode('utf-8'), mtime=0),
                      'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}', rows=n, filter='国だけ (地域の集計を除く)・1960〜2024 年'))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o.get('rows'), o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
