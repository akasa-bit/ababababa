#!/usr/bin/env python3
"""研究開発の費用と政府の支援の生データを取得する (手で書き換えない)。技術革新の 3 つ目、研究開発の政策 (回 KE6・B-122。docs/research/innovation.md)。

取得するもの (OECD の SDMX の公開の API。OECD の利用条件 (CC BY 4.0)):
  - Main Science and Technology Indicators (MSTI。DSD_MSTI@DF_MSTI 1.3):
      G・PT_B1GQ    = 国内の研究開発費 (GERD) ÷ GDP [%]
      G_FG・PT_GERD = GERD のうち政府が出した割合 [%]
  - R&D tax incentives (DSD_RDTAX@DF_RDTAX 1.0):
      RDTAX・PT_B1GQ = 研究開発の税の優遇 (GTARD。税額控除などで減った税) ÷ GDP [%]
      DF・PT_B1GQ    = 政府が直接出した会社の研究開発費 ÷ GDP [%]
      RDTAX・PT_BERD・DF・PT_BERD = 同じものの、会社の研究開発費 (BERD) に対する割合 [%] (ゲームの既定の税額控除の率)
保存先は data/raw/rnd/oecd_rnd.csv.gz (列 dataset, measure, unit, iso3, year, value。値のある行だけ。国と OECD などの集計の両方)。
取得日・URL・SHA-256・行数を data/raw/rnd/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_rnd.py
"""
import csv, datetime, gzip, hashlib, io, json, os, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'rnd')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)', 'Accept': 'application/vnd.sdmx.data+csv; charset=utf-8'}
BASE = 'https://sdmx.oecd.org/public/rest/data/OECD.STI.STP,'
QUERIES = [('MSTI', 'DSD_MSTI@DF_MSTI,1.3/.A.G.PT_B1GQ..'), ('MSTI', 'DSD_MSTI@DF_MSTI,1.3/.A.G_FG.PT_GERD..'),
           ('RDTAX', 'DSD_RDTAX@DF_RDTAX,1.0/.A.RDTAX+DF.PT_B1GQ+PT_BERD...')]
START = 1981


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read().decode('utf-8')


def main():
    os.makedirs(ROOT, exist_ok=True)
    rows, urls = [], []
    for ds, key in QUERIES:
        url = f'{BASE}{key}?startPeriod={START}'
        urls.append(url)
        n = 0
        for r in csv.DictReader(io.StringIO(fetch(url))):
            if r['OBS_VALUE'] in ('', None):
                continue
            if ds == 'RDTAX' and (r.get('SIZE') not in ('_Z', '_T') or r.get('PROFIT_SCENARIO') not in ('_Z', '_T')):
                continue
            rows.append([ds, r['MEASURE'], r['UNIT_MEASURE'], r['REF_AREA'], int(r['TIME_PERIOD']), float(r['OBS_VALUE'])])
            n += 1
        print(ds, key, n)
    rows.sort(key=lambda r: (r[0], r[1], r[3], r[4]))
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['dataset', 'measure', 'unit', 'iso3', 'year', 'value'])
    w.writerows(rows)
    data = gzip.compress(buf.getvalue().encode('utf-8'), mtime=0)
    with open(os.path.join(ROOT, 'oecd_rnd.csv.gz'), 'wb') as f:
        f.write(data)
    man = [{'file': 'oecd_rnd.csv.gz', 'url': urls, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'rows': len(rows),
            'filter': f'値のある行だけ・{START} 年から。RDTAX は会社の大きさと利潤の想定の合計 (_Z・_T) だけ',
            'license': 'CC BY 4.0 (OECD の利用条件)。出典: OECD Main Science and Technology Indicators・OECD R&D Tax Incentives Database'}]
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('oecd_rnd.csv.gz', len(rows), '行')


if __name__ == '__main__':
    main()
