#!/usr/bin/env python3
"""政府の医療の支出と死亡率の生データを取得する (手で書き換えない)。医療の水準 (0〜300%) を死亡率につなぐための調べもの (docs/research/health-mortality.md)。

取得するもの:
  - 世界銀行 World Development Indicators (WDI) の API (国だけ。地域の集計を除く。1995〜2022 年)
      SH.XPD.GHED.GD.ZS  政府の医療の支出 (国内の財源。GDP 比 %)
      SH.XPD.CHEX.GD.ZS  経常の医療の支出の合計 (GDP 比 %)
      SH.XPD.GHED.CH.ZS  経常の医療の支出のうち政府の割合 (%)
      NY.GDP.PCAP.PP.KD  1 人あたり GDP (PPP、2021 年の国際ドル)
      SP.POP.TOTL        総人口
      SP.DYN.AMRT.MA/FE  成人の死亡率 (15 歳の人が 60 歳までに死ぬ確率、千人あたり。男・女)
      SP.REG.DTHS.ZS     死亡の登録の完全さ (死因つき、%)。死亡率が実際に測られている国かどうかの目安
    … https://data.worldbank.org/
  - WDI の国の一覧 (地域と所得の区分。地域の集計を除く)
  - UCDP/PRIO Armed Conflict Dataset 26.1 (国家が当事者の武力紛争。年 25 人以上の戦闘の死者) と
    UCDP Battle-Related Deaths Dataset 26.1 (紛争 × 年の戦闘の死者数と戦闘の場所)。どちらも元の zip の中の CSV をそのまま gzip にして置く
    … https://ucdp.uu.se/downloads/
65 歳の平均余命は、前から置いてある WPP 2024 の data/raw/demography/wpp_indicators.csv.gz (LE65) を使う (ここでは取らない)。
保存先は data/raw/healthmort/。取得日・URL・SHA-256・大きさ・行数を data/raw/healthmort/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_healthmort.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'healthmort')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
WDI = ['SH.XPD.GHED.GD.ZS', 'SH.XPD.CHEX.GD.ZS', 'SH.XPD.GHED.CH.ZS', 'NY.GDP.PCAP.PP.KD', 'SP.POP.TOTL', 'SP.DYN.AMRT.MA', 'SP.DYN.AMRT.FE',
       'SP.REG.DTHS.ZS']
YEARS = '1995:2022'
UCDP = [
    ('https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-261-csv.zip', 'ucdp_prio_acd_261.csv.gz'),
    ('https://ucdp.uu.se/downloads/brd/ucdp-brd-conf-261-csv.zip', 'ucdp_brd_conf_261.csv.gz'),
]

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()

def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def rec(name, url, data, **extra):
    return {'file': name, 'url': url, 'fetched': now(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), **extra}

def save(name, data):
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    return data

def write_csv(name, cols, rows, gz=True):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(cols)
    w.writerows(rows)
    raw = buf.getvalue().encode('utf-8')
    return save(name, gzip.compress(raw, mtime=0) if gz else raw)

def wdi(ind):
    """WDI の 1 つの指標を、全部の経済 (あとで国だけに絞る) について取る。"""
    url = f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&per_page=20000&date={YEARS}'
    out, page = [], 1
    while True:
        meta, rows = json.loads(fetch(f'{url}&page={page}'))
        out += [[r['countryiso3code'], r['country']['value'], r['date'], r['value']] for r in rows or [] if r['value'] is not None]
        if page >= meta['pages']:
            return out, url, meta.get('lastupdated')
        page += 1

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    # 国の一覧 (地域の集計は region.id が NA)
    curl = 'https://api.worldbank.org/v2/country?format=json&per_page=400'
    meta = [c for c in json.loads(fetch(curl))[1] if c['region']['id'] != 'NA']
    crow = sorted([c['id'], c['name'], c['region']['id'], c['region']['value'], c['incomeLevel']['id']] for c in meta)
    data = write_csv('wdi_countries.csv', ['iso3', 'name', 'region', 'region_name', 'income'], crow, gz=False)
    out.append(rec('wdi_countries.csv', curl, data, rows=len(crow), filter='地域の集計を除く (region.id が NA でないもの)・列 id,name,region,incomeLevel'))
    countries = {c[0] for c in crow}
    rows, updated = [], {}
    for ind in WDI:
        got, url, upd = wdi(ind)
        keep = [[ind, *r] for r in got if r[0] in countries]
        rows += keep
        updated[ind] = upd
        print(ind, len(keep))
    data = write_csv('wdi_health.csv.gz', ['indicator', 'iso3', 'country', 'year', 'value'], rows)
    out.append(rec('wdi_health.csv.gz', 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}?format=json&date=' + YEARS, data,
                   rows=len(rows), lastupdated=updated, filter=f'国だけ (wdi_countries.csv にあるもの)・{YEARS.replace(":", "〜")} 年・値のない行を除く'))
    for url, name in UCDP:
        z = fetch(url)
        zf = zipfile.ZipFile(io.BytesIO(z))
        inner = [n for n in zf.namelist() if n.lower().endswith('.csv')][0]
        body = zf.read(inner)
        data = save(name, gzip.compress(body, mtime=0))
        out.append(rec(name, url, data, source_sha256=hashlib.sha256(z).hexdigest(), member=inner, member_sha256=hashlib.sha256(body).hexdigest(),
                       rows=body.count(b'\n') - 1, filter='zip の中の CSV をそのまま gzip にしたもの (行も列も削らない)'))
        print(name, inner)
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
