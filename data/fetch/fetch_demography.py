#!/usr/bin/env python3
"""年齢つきの人口の生データを取得する (手で書き換えない)。セッション 10 (段 6) の目標の幅の案と、5 歳きざみのコーホートの率の当てはめ用。

取得するもの:
  - 国連 World Population Prospects 2024 (WPP) の CSV (推計の期間 1950〜2023 年。国だけ、5 年ごと + 2023 年)
      人口 (1 月 1 日、5 歳きざみ × 性別)・簡易生命表 (5 歳きざみ × 性別)・年齢別出生率 (5 歳きざみ)・人口の指標 (毎年)
    元のファイルは 16〜145 MB の gzip なので、下の行と列だけを取り出して data/raw/demography/ に置く (同じファイルから作り直せる)
    … https://population.un.org/wpp/downloads
  - 世界銀行 World Development Indicators (WDI) の API: 年齢 3 区分の割合・合計特殊出生率・平均寿命・1 人あたり所得 (PPP、2021 年の国際ドル)
    … https://data.worldbank.org/
取れないもの (登録が要る):
  - Human Mortality Database (HMD)・Human Fertility Database (HFD) は利用者の登録が要るので、取得スクリプトにできない。
    WPP の生命表と年齢別出生率は、HMD・HFD のある国ではそれらを入力に使っている (WPP 2024 の方法の文書)。
  - 国連の国際移民の年齢の表 (International Migrant Stock 2020) は、この環境から 403 で取れなかった。
保存先は data/raw/demography/。取得日・URL・SHA-256・大きさを data/raw/demography/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_demography.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'demography')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
WPP = 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/'
YEARS = set(range(1950, 2021, 5)) | {2023}
YEARS10 = set(range(1950, 2021, 10)) | {2023}  # 生命表は大きいので 10 年ごと
# (元のファイル, 置くファイル, 残す列, 残す年 (None ならすべて))
WPP_FILES = [
    ('WPP2024_Population1JanuaryByAge5GroupSex_Medium.csv.gz', 'wpp_pop_age5.csv.gz',
     ['ISO3_code', 'Location', 'Time', 'AgeGrpStart', 'AgeGrpSpan', 'PopMale', 'PopFemale', 'PopTotal'], YEARS),
    ('WPP2024_Life_Table_Abridged_Medium_1950-2023.csv.gz', 'wpp_lifetable_age5.csv.gz',
     ['ISO3_code', 'Location', 'Time', 'Sex', 'AgeGrpStart', 'AgeGrpSpan', 'mx', 'qx', 'ex'], YEARS10),
    ('WPP2024_Fertility_by_Age5.csv.gz', 'wpp_asfr_age5.csv.gz',
     ['ISO3_code', 'Location', 'Time', 'AgeGrpStart', 'ASFR', 'Births'], YEARS),
    ('WPP2024_Demographic_Indicators_Medium.csv.gz', 'wpp_indicators.csv.gz',
     ['ISO3_code', 'Location', 'Time', 'TPopulation1Jan', 'MedianAgePop', 'CBR', 'CDR', 'TFR', 'MAC', 'LEx', 'LE15', 'LE65',
      'NetMigrations', 'CNMR'], None),
]
WDI = ['SP.POP.0014.TO.ZS', 'SP.POP.1564.TO.ZS', 'SP.POP.65UP.TO.ZS', 'SP.DYN.TFRT.IN', 'SP.DYN.LE00.IN', 'NY.GDP.PCAP.PP.KD']

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()

def rec(name, url, data, **extra):
    return {'file': name, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), **extra}

def write_gz(name, cols, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(cols)
    w.writerows(rows)
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    return data

def wdi(ind):
    """WDI の 1 つの指標を、国だけ (地域の集計を除く) 全部の年で取る。"""
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
    out = []
    for src, name, cols, years in WPP_FILES:
        raw = fetch(WPP + src)
        keep = []
        for r in csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(raw)), encoding='utf-8-sig')):
            # 国だけ (LocTypeID 4)、推計の期間 (2023 年まで)。中位推計の将来は使わない
            if r.get('LocTypeID') != '4' or not r['Time'] or int(r['Time']) > 2023:
                continue
            if years and int(r['Time']) not in years:
                continue
            if r.get('Sex') == 'Total':  # 男女の合計は、男女の表と人口から作れる
                continue
            if r.get('Variant', 'Medium') != 'Medium':
                continue
            keep.append([r[c] for c in cols])
        data = write_gz(name, cols, keep)
        out.append(rec(name, WPP + src, data, source_sha256=hashlib.sha256(raw).hexdigest(), rows=len(keep),
                       filter=f'国 (LocTypeID 4)・中位推計の 2023 年まで{"・" + "/".join(map(str, sorted(years))) + " 年" if years else ""}・男女の合計の行を除く・列 {",".join(cols)}'))
        print(name, len(keep))
    countries = {c['id'] for c in json.loads(fetch('https://api.worldbank.org/v2/country?format=json&per_page=400'))[1] if c['region']['id'] != 'NA'}
    rows = []
    for ind in WDI:
        got, url = wdi(ind)
        rows += [[ind, *r] for r in got if r[0] in countries]
        print(ind, len(got))
    data = write_gz('wdi_demography.csv.gz', ['indicator', 'iso3', 'country', 'year', 'value'], rows)
    out.append(rec('wdi_demography.csv.gz', 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}', data, rows=len(rows),
                   filter='国だけ (地域の集計を除く)・1960〜2024 年'))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
