#!/usr/bin/env python3
"""星系の中の集団の価値観 (QD-42。回 SE6 の続き。docs/groups.md の 1) の生データを取得する (手で書き換えない)。

世界価値観調査 (WVS) の個票は「非営利に限る・再配布しない」が条件なので (売るゲームには合わない)、代わりに次を使う:
  - Global Flourishing Study の 1・2 年目の全世界の個票 (VanderWeele, Johnson ほか。Gallup・Center for Open Science。CC BY 4.0。https://osf.io/c8hbk/):
    22 か国と香港の約 20 万人。使う列 (国・1 年目の重み・世帯の所得の区分・この国で生まれたか・価値観に近い 9 項目の 1 年目) だけ残し、gzip で置く
  - 世界銀行 WDI (CC BY 4.0) の 1 人あたり GDP (NY.GDP.PCAP.PP.KD。2021 年の購買力平価のドル)。上の国の 2022 年
取得日・URL・SHA-256 (取ってきたままのファイルの)・行数を data/raw/values/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_values.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, time, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'values')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
GFS = 'https://osf.io/download/vrejf/'  # gfs_all_countries_wave2.csv (OSF xk3yc → ge2x5「Waves 1 and 2 Global Data」)
CODEBOOK = 'https://osf.io/download/285w7/'  # GFS_codebook_wave2.pdf (国の番号・所得の区分・項目の言い回し)
GFS_COLS = ['COUNTRY', 'ANNUAL_WEIGHT_C1', 'INCOME_Y1', 'BORN_COUNTRY_Y1', 'REL_IMPORTANT_Y1', 'ATTEND_SVCS_Y1', 'OBEY_LAW_Y1', 'BELONGING_Y1',
            'HAPPY_Y1', 'TRUST_PEOPLE_Y1', 'FREEDOM_Y1', 'SAY_IN_GOVT_Y1', 'WORRY_SAFETY_Y1']
# GFS の国の番号 (codebook の COUNTRY) → ISO3
ISO = {1: 'ARG', 2: 'AUS', 3: 'BRA', 4: 'EGY', 5: 'DEU', 6: 'IND', 7: 'IDN', 8: 'ISR', 9: 'JPN', 10: 'KEN', 11: 'MEX', 12: 'NGA', 13: 'PHL', 14: 'POL',
       16: 'ZAF', 17: 'ESP', 18: 'TZA', 19: 'TUR', 20: 'GBR', 22: 'USA', 23: 'SWE', 24: 'HKG', 25: 'CHN'}
WDI = 'https://api.worldbank.org/v2/country/{}/indicator/NY.GDP.PCAP.PP.KD?format=json&date=2022&per_page=200'


def get(url):
    for wait in (10, 30, 60, None):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=900) as r:
                return r.read()
        except Exception:
            if wait is None:
                raise
            time.sleep(wait)


def main():
    os.makedirs(ROOT, exist_ok=True)
    now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    sha = lambda b: hashlib.sha256(b).hexdigest()
    files = []
    # 1. GFS の個票: 使う列だけ
    raw = get(GFS)
    rows = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    out = io.StringIO()
    w = csv.writer(out, lineterminator='\n')
    w.writerow(GFS_COLS)
    n = 0
    for r in rows:
        w.writerow([r[c].strip() for c in GFS_COLS])
        n += 1
    data = gzip.compress(out.getvalue().encode('utf-8'), mtime=0)  # mtime を 0 にして、同じ元から同じバイト列にする
    with open(os.path.join(ROOT, 'gfs_wave1_values.csv.gz'), 'wb') as f:
        f.write(data)
    files.append({'file': 'gfs_wave1_values.csv.gz', 'bytes': len(data), 'rows': n, 'url': GFS, 'sha256_source': sha(raw), 'fetched': now(),
                  'filter': f'列 {", ".join(GFS_COLS)} だけ (1 年目の項目と重み)'})
    cb = get(CODEBOOK)
    files.append({'file': '(置かない) GFS_codebook_wave2.pdf', 'url': CODEBOOK, 'sha256_source': sha(cb), 'fetched': now(), 'note': '国の番号・所得の区分・項目の言い回しを読んだ'})
    # 2. 1 人あたり GDP
    raw = get(WDI.format(';'.join(ISO.values())))
    keep = [['iso3', 'country', 'year', 'gdppc_ppp2021']]
    for x in json.loads(raw)[1]:
        if x['value'] is not None:
            keep.append([x['countryiso3code'], x['country']['value'], x['date'], x['value']])
    out = io.StringIO()
    csv.writer(out, lineterminator='\n').writerows(keep)
    data = out.getvalue().encode('utf-8')
    with open(os.path.join(ROOT, 'wdi_gdppc_2022.csv'), 'wb') as f:
        f.write(data)
    files.append({'file': 'wdi_gdppc_2022.csv', 'bytes': len(data), 'rows': len(keep) - 1, 'url': WDI.format(';'.join(ISO.values())), 'sha256_source': sha(raw), 'fetched': now()})
    man = {
        'sources': {
            'gfs_wave1_values.csv.gz': 'Global Flourishing Study, Waves 1 and 2 Global Data (VanderWeele, Johnson, Bialowolski ほか。Gallup・Center for Open Science。https://osf.io/c8hbk/)。CC BY 4.0',
            'wdi_gdppc_2022.csv': 'World Bank, World Development Indicators (NY.GDP.PCAP.PP.KD)。CC BY 4.0',
        },
        'country_codes': {str(k): v for k, v in ISO.items()},
        'files': files,
    }
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    for x in files:
        print(x['file'], x.get('rows', ''), '行')


if __name__ == '__main__':
    sys.exit(main())
