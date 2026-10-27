#!/usr/bin/env python3
"""中立の利子率 (自然利子率) と潜在の伸びの生データを取得する (手で書き換えない)。中央銀行の中立の金利 (回 KE6・B-118。docs/money.md の 5)。

取得するもの:
  - Holston, Laubach & Williams (2023) の推計 (ニューヨーク連銀 Holston_Laubach_Williams_current_estimates.xlsx の HLW Estimates のシート。片側の推計、四半期):
      米国・カナダ・ユーロ圏の潜在の伸び g (年率 %)・その他の要因 z・自然利子率 r*・需給ギャップ
      → data/raw/hlw/hlw_estimates.csv.gz (列 economy, date, g, z, rstar, gap)
  - 同じファイルの推計に使った実質 GDP の対数 (US・CA・EA input data のシートの gdp.log。四半期)
      → data/raw/hlw/hlw_gdp.csv.gz (列 economy, date, gdp_log)
  - World Development Indicators の人口の伸び (SP.POP.GROW。% / 年) の米国・カナダ・ユーロ圏 (EMU)
      → data/raw/hlw/wdi_popgrow.csv.gz (列 iso3, year, value)
取得日・URL・SHA-256・行数を data/raw/hlw/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_hlw.py   (pandas と openpyxl が要る)
"""
import csv, datetime, gzip, hashlib, io, json, os, tempfile, urllib.request
import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'hlw')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
HLW = 'https://www.newyorkfed.org/medialibrary/media/research/economists/williams/data/Holston_Laubach_Williams_current_estimates.xlsx'
POP = 'https://api.worldbank.org/v2/country/USA;CAN;EMU/indicator/SP.POP.GROW?format=json&per_page=1000&date=1960:2025'
# HLW Estimates のシートの列: 日付 (0)、g (2〜4)、z (6〜8)、r* (10〜12)、需給ギャップ (14〜16)。それぞれ米国・カナダ・ユーロ圏の順
COLS = {'US': (2, 6, 10, 14), 'CA': (3, 7, 11, 15), 'EA': (4, 8, 12, 16)}


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
    raw = fetch(HLW)
    fd, p = tempfile.mkstemp(suffix='.xlsx')
    with os.fdopen(fd, 'wb') as f:
        f.write(raw)
    d = pd.read_excel(p, sheet_name='HLW Estimates', header=None)
    inp = {k: pd.read_excel(p, sheet_name=f'{k} input data') for k in COLS}
    os.remove(p)
    d = d[pd.to_datetime(d[0], errors='coerce', format='mixed').notna()]
    rows = []
    for k, cs in COLS.items():
        for _, r in d.iterrows():
            v = [r[c] for c in cs]
            if any(pd.isna(x) for x in v):
                continue
            rows.append([k, pd.to_datetime(r[0]).strftime('%Y-%m-%d'), *(round(float(x), 6) for x in v)])
    lic = 'Federal Reserve Bank of New York の公開のデータ (Holston, Laubach & Williams 2023, Measuring the Natural Rate of Interest after COVID-19。出典を明記する)'
    m = save('hlw_estimates.csv.gz', ['economy', 'date', 'g', 'z', 'rstar', 'gap'], rows)
    man.append({**m, 'url': HLW, 'source_sha256': hashlib.sha256(raw).hexdigest(), 'filter': 'HLW Estimates のシートの、値のそろった四半期だけ', 'license': lic})
    rows = [[k, pd.to_datetime(r['date']).strftime('%Y-%m-%d'), round(float(r['gdp.log']), 6)] for k, x in inp.items() for _, r in x.iterrows() if pd.notna(r['gdp.log'])]
    m = save('hlw_gdp.csv.gz', ['economy', 'date', 'gdp_log'], rows)
    man.append({**m, 'url': HLW, 'source_sha256': hashlib.sha256(raw).hexdigest(), 'filter': 'US・CA・EA input data のシートの date・gdp.log', 'license': lic})
    meta, got = json.loads(fetch(POP))
    rows = sorted([r['countryiso3code'], int(r['date']), r['value']] for r in got or [] if r['value'] is not None)
    m = save('wdi_popgrow.csv.gz', ['iso3', 'year', 'value'], rows)
    man.append({**m, 'url': POP, 'filter': '値のある行だけ', 'license': 'CC BY 4.0 (世界銀行の利用条件)'})
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
