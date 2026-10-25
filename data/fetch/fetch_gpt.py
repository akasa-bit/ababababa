#!/usr/bin/env python3
"""汎用技術 (GPT) と技術の波の生データを取得する (手で書き換えない)。技術革新の 4 つ目 (回 KE6・B-123。docs/research/innovation.md)。

取得するもの:
  - Fernald の利用率を補正した TFP (サンフランシスコ連銀 quarterly_tfp.xlsx の annual のシート。米国の企業部門、1947〜2025 年):
      列 year, dtfp (TFP の伸び [%/年])、dtfp_util (利用率を補正した TFP の伸び)、alpha (資本の分配率)
      → data/raw/gpt/fernald_annual.csv.gz
  - Our World in Data の、米国の家庭の技術の普及 (Comin & Hobijn 2004 ほか。45 の技術、普及率 [%])
      → data/raw/gpt/owid_adoption.csv.gz (列 technology, year, share)
  - World Development Indicators の携帯電話の契約 (IT.CEL.SETS.P2。100 人あたり) とインターネットの利用者 (IT.NET.USER.ZS。人口の %)
      → data/raw/gpt/wdi_adoption.csv.gz (列 indicator, iso3, country, year, value。国だけ、地域の集計を除く)
取得日・URL・SHA-256・行数を data/raw/gpt/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_gpt.py   (pandas と openpyxl が要る)
"""
import csv, datetime, gzip, hashlib, io, json, os, tempfile, urllib.request
import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'gpt')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
FERNALD = 'https://www.frbsf.org/wp-content/uploads/quarterly_tfp.xlsx'
OWID = 'https://ourworldindata.org/grapher/technology-adoption-by-households-in-the-united-states.csv?v=1&csvType=full&useColumnShortNames=true'
WDI = ['IT.CEL.SETS.P2', 'IT.NET.USER.ZS']


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()


def save(name, header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(header)
    w.writerows(rows)
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    print(name, len(rows), '行')
    return {'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'rows': len(rows),
            'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}


def main():
    os.makedirs(ROOT, exist_ok=True)
    man = []
    # Fernald
    raw = fetch(FERNALD)
    fd, p = tempfile.mkstemp(suffix='.xlsx')
    with os.fdopen(fd, 'wb') as f:
        f.write(raw)
    a = pd.read_excel(p, sheet_name='annual')
    os.remove(p)
    a = a[pd.to_numeric(a['date'], errors='coerce').notna()]
    rows = [[int(r['date']), *(None if pd.isna(r[c]) else round(float(r[c]), 6) for c in ('dtfp', 'dtfp_util', 'alpha'))] for _, r in a.iterrows()]
    m = save('fernald_annual.csv.gz', ['year', 'dtfp', 'dtfp_util', 'alpha'], rows)
    man.append({**m, 'url': FERNALD, 'source_sha256': hashlib.sha256(raw).hexdigest(), 'filter': 'annual のシートの date・dtfp・dtfp_util・alpha の列だけ',
                'license': 'Federal Reserve Bank of San Francisco の公開のデータ (Fernald 2014, A Quarterly, Utilization-Adjusted Series on Total Factor Productivity。出典を明記する)'})
    # OWID
    raw = fetch(OWID)
    d = pd.read_csv(io.BytesIO(raw))
    col = [c for c in d.columns if c not in ('entity', 'code', 'year')][0]
    rows = [[r['entity'], int(r['year']), float(r[col])] for _, r in d.iterrows() if pd.notna(r[col])]
    m = save('owid_adoption.csv.gz', ['technology', 'year', 'share'], sorted(rows))
    man.append({**m, 'url': OWID, 'source_sha256': hashlib.sha256(raw).hexdigest(), 'filter': f'列 {col} の値のある行',
                'license': 'CC BY 4.0 (Our World in Data。元は Comin & Hobijn 2004 ほか)'})
    # WDI
    countries = {c['id'] for c in json.loads(fetch('https://api.worldbank.org/v2/country?format=json&per_page=400'))[1] if c['region']['id'] != 'NA'}
    rows = []
    for ind in WDI:
        url, page = f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&per_page=20000&date=1960:2024', 1
        while True:
            meta, got = json.loads(fetch(f'{url}&page={page}'))
            rows += [[ind, r['countryiso3code'], r['country']['value'], int(r['date']), r['value']] for r in got or [] if r['value'] is not None and r['countryiso3code'] in countries]
            if page >= meta['pages']:
                break
            page += 1
    rows.sort(key=lambda r: (r[0], r[1], r[3]))
    m = save('wdi_adoption.csv.gz', ['indicator', 'iso3', 'country', 'year', 'value'], rows)
    man.append({**m, 'url': 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}', 'filter': '国だけ (地域の集計を除く)・1960〜2024 年',
                'license': 'CC BY 4.0 (世界銀行の利用条件。元は ITU)'})
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
