#!/usr/bin/env python3
"""星系の中の集団 (回 SE6・B-020。docs/proposals/11-groups.md の決まった案) の生データを取得する (手で書き換えない)。

取得するもの (data/raw/groups/ に置く):
  - EPR Core 2021 (Ethnic Power Relations。Vogt ほか 2015, JCR 59(7)): 国ごとの民族の集団の、期間ごとの人口の割合と、中央の政治権力への近さ
    (独占・優位・上級の分担・下級の分担・無力・差別・自ら離脱)。https://icr.ethz.ch/data/epr/core/EPR-2021.csv
  - ACD2EPR 2021: UCDP/PRIO の武力紛争の当事者 (反政府の組織) と EPR の集団のつながり (集団のために戦うと言ったか claim・集団から兵を集めたか recruitment)。
    https://icr.ethz.ch/data/epr/acd2epr/ACD2EPR-2021.csv
  - UCDP 二者間の紛争 21.1 (Harbom ほか 2008・Davies ほか 2021。CC BY 4.0): 紛争の当事者の組と年、争点 (1 = 領土・2 = 政府)。ACD2EPR 2021 と同じ版。
    https://ucdp.uu.se/downloads/dyadic/ucdp-dyadic-211-csv.zip
  - 世界銀行 WDI (CC BY 4.0) の所得の 5 分位の分け前 (SI.DST.FRST.20・02ND・03RD・04TH・05TH。%) を国・年の表にしたもの
  - QoG Standard Cross-Section 2025 年 1 月版 (Teorell ほか。出典を明記して使える) から、WVS (世界価値観調査) の国の平均の項目と 1 人あたり GDP の列だけ
    (価値観の 2 軸の近い形を作るため。WVS の個票は登録が要るので取らない)
取得日・URL・SHA-256・行数を data/raw/groups/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_groups.py
"""
import csv, datetime, hashlib, io, json, os, sys, time, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'groups')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
EPR = 'https://icr.ethz.ch/data/epr/core/EPR-2021.csv'
ACD2EPR = 'https://icr.ethz.ch/data/epr/acd2epr/ACD2EPR-2021.csv'
DYADIC = 'https://ucdp.uu.se/downloads/dyadic/ucdp-dyadic-211-csv.zip'
WDI = 'https://api.worldbank.org/v2/country/all/indicator/{}?format=json&per_page=20000&date=1960:2025'
QUINT = ['SI.DST.FRST.20', 'SI.DST.02ND.20', 'SI.DST.03RD.20', 'SI.DST.04TH.20', 'SI.DST.05TH.20']
QOG = 'https://www.qogdata.pol.gu.se/data/qog_std_cs_jan25.csv'
# WVS の項目 (QoG の名前。意味は QoG の codebook): 神の大切さ・子に望む資質の自律の指数 (伝統 ↔ 世俗の項目)、
# 脱物質主義の指数 (4 項目)・幸福・人への信頼 (生存 ↔ 自己表現の項目)。Inglehart–Welzel の 2 軸のそれぞれ 5 項目のうち、QoG にあるもの
QOG_COLS = ['cname', 'ccodealp', 'wvs_godimp', 'wvs_auton', 'wvs_pmi4', 'wvs_hap', 'wvs_trust', 'wdi_gdpcappppcon2021']


def get(url):
    for wait in (10, 30, 60, None):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
                return r.read()
        except Exception:
            if wait is None:
                raise
            time.sleep(wait)


def save(name, data):
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    return {'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'rows': data.count(b'\n') - 1}


def main():
    os.makedirs(ROOT, exist_ok=True)
    now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    files = []
    for url, name in ((EPR, 'EPR-2021.csv'), (ACD2EPR, 'ACD2EPR-2021.csv')):
        files.append({**save(name, get(url)), 'url': url, 'fetched': now()})
    z = zipfile.ZipFile(io.BytesIO(get(DYADIC)))
    inner = [n for n in z.namelist() if n.endswith('.csv')][0]
    files.append({**save('ucdp-dyadic-211.csv', z.read(inner)), 'url': DYADIC, 'from': inner, 'fetched': now()})
    # WDI の 5 分位: 国・年ごとに 5 つの列 (値のない国・年は落とす)
    tab = {}
    for i, code in enumerate(QUINT):
        for x in json.loads(get(WDI.format(code)))[1]:
            if x['value'] is None or not x['countryiso3code']:
                continue
            k = (x['countryiso3code'], x['country']['value'], int(x['date']))
            tab.setdefault(k, [None] * 5)[i] = x['value']
    out = io.StringIO()
    w = csv.writer(out, lineterminator='\n')
    w.writerow(['iso3', 'country', 'year', 'q1', 'q2', 'q3', 'q4', 'q5'])
    for k in sorted(tab):
        if all(v is not None for v in tab[k]):
            w.writerow([*k, *tab[k]])
    files.append({**save('wdi_quintiles.csv', out.getvalue().encode('utf-8')), 'url': WDI.format(','.join(QUINT)), 'fetched': now(), 'filter': '5 つの分位がそろう国・年だけ'})
    # QoG: 使う列だけ
    rows = list(csv.DictReader(io.StringIO(get(QOG).decode('utf-8-sig'))))
    out = io.StringIO()
    w = csv.writer(out, lineterminator='\n')
    w.writerow(QOG_COLS)
    for r in rows:
        w.writerow([r.get(c, '') for c in QOG_COLS])
    files.append({**save('qog_wvs.csv', out.getvalue().encode('utf-8')), 'url': QOG, 'fetched': now(), 'filter': f'列 {", ".join(QOG_COLS)} だけ'})
    man = {
        'sources': {
            'EPR-2021.csv': 'Vogt, Bormann, Rüegger, Cederman, Hunziker & Girardin 2015. Integrating Data on Ethnicity, Geography, and Conflict: The Ethnic Power Relations Data Set Family. JCR 59(7), 1327-1342 (引用して使う)',
            'ACD2EPR-2021.csv': '同じ (EPR の家族。Wucherpfennig ほか 2012 の ACD2EPR の 2021 年版)',
            'ucdp-dyadic-211.csv': 'UCDP Dyadic Dataset 21.1 (Harbom, Melander & Wallensteen 2008・Davies, Pettersson & Öberg 2021)。CC BY 4.0',
            'wdi_quintiles.csv': 'World Bank, World Development Indicators (SI.DST.*)。CC BY 4.0',
            'qog_wvs.csv': 'Teorell ほか. The Quality of Government Standard Dataset, version Jan25 (WVS の国の平均の項目は Haerpfer ほか の World Values Survey から)',
        },
        'files': files,
    }
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    for x in files:
        print(x['file'], x['rows'], '行')


if __name__ == '__main__':
    sys.exit(main())
