#!/usr/bin/env python3
"""学歴 (就学年数) の生データを取得する (手で書き換えない)。目標 R62・R63 と、学歴と生産性 (人的資本) の作り (回 KE5・B-117)。

取得するもの (世界銀行の Education Statistics (EdStats。API の source 12) に載っている Barro–Lee の推計。Barro & Lee 2013, JDE 104 の 2021 年の更新):
  - BAR.SCHL.25UP: 25 歳以上の平均の就学年数 [年]
  - BAR.SCHL.2529: 25〜29 歳の平均の就学年数 [年] (学校を出たばかりの世代)
  1950〜2015 年の 5 年ごと。所得は R61 と同じ WDI の NY.GDP.PCAP.PP.KD (data/raw/tech/wdi_tech.csv.gz。data/fetch/fetch_tech.py) を使う。
  - SE.XPD.TOTL.GD.ZS: 政府の教育の支出 ÷ GDP [%] (UNESCO 統計研究所。同じ EdStats の写し。1970〜2015 年。予算の「教育」の効き方を決める。回 KE5)
  - BAR.SCHL.3034〜BAR.SCHL.7074・BAR.SCHL.75UP: 5 歳ごとの年齢の区分の平均の就学年数 (始めからある入植地の、年齢ごとの就学年数の形を決める。回 KE5)
  (Barro–Lee の元の頁 barrolee.github.io の表は「All rights reserved」なので、CC BY 4.0 で配られている世界銀行の写しを使う)
保存先は data/raw/hcap/edstats_bl.csv.gz (就学年数)・data/raw/hcap/edstats_age.csv.gz (年齢の区分ごとの就学年数)・data/raw/hcap/edstats_spend.csv.gz (教育の支出) (列 indicator, iso3, country, year, value。国だけ、地域の集計を除く)。
取得日・URL・SHA-256・行数を data/raw/hcap/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_hcap.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'hcap')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
IND = ['BAR.SCHL.25UP', 'BAR.SCHL.2529']
SPEND = ['SE.XPD.TOTL.GD.ZS']
AGES = [f'BAR.SCHL.{a}{a + 4}' for a in range(25, 75, 5)] + ['BAR.SCHL.75UP']


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()


def edstats(ind, years='1950:2015'):
    """EdStats の 1 つの指標を、全部の国・地域と全部の年で取る (国だけにするのは呼ぶ側)"""
    url = f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&source=12&per_page=20000&date={years}'
    out, page = [], 1
    while True:
        meta, rows = json.loads(fetch(f'{url}&page={page}'))
        out += [[r['countryiso3code'], r['country']['value'], r['date'], r['value']] for r in rows or [] if r['value'] is not None]
        if page >= meta['pages']:
            return out
        page += 1


def write(name, inds, countries, years, filt):
    rows = []
    for ind in inds:
        got = edstats(ind, years)
        rows += [[ind, *r] for r in got if r[0] in countries]
        print(ind, len(got))
    rows.sort(key=lambda r: (r[0], r[1], r[3]))
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['indicator', 'iso3', 'country', 'year', 'value'])
    w.writerows(rows)
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    print(name, len(rows), '行', hashlib.sha256(data).hexdigest()[:12])
    return {'file': name, 'url': 'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(inds) + '}?source=12',
            'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'rows': len(rows),
            'filter': filt, 'license': 'CC BY 4.0 (世界銀行の利用条件)。元の推計は Barro & Lee 2013・UNESCO 統計研究所 (出典を明記する)'}


def main():
    os.makedirs(ROOT, exist_ok=True)
    countries = {c['id'] for c in json.loads(fetch('https://api.worldbank.org/v2/country?format=json&per_page=400'))[1] if c['region']['id'] != 'NA'}
    man = [write('edstats_bl.csv.gz', IND, countries, '1950:2015', '国だけ (地域の集計を除く)・1950〜2015 年'),
           write('edstats_age.csv.gz', AGES, countries, '1950:2015', '国だけ (地域の集計を除く)・1950〜2015 年'),
           write('edstats_spend.csv.gz', SPEND, countries, '1970:2015', '国だけ (地域の集計を除く)・1970〜2015 年')]
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    sys.exit(main())
