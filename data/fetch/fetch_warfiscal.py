#!/usr/bin/env python3
"""戦争と財政 (戦争疲弊が税収・年金・医療に効くか) の生データを取得する (手で書き換えない)。

取得するもの (保存先は data/raw/warfiscal/):
  - UCDP/PRIO Armed Conflict Dataset 26.1 (1946〜2025 年の紛争・年。国家間 / 国内 / 国際化した国内) … https://ucdp.uu.se/downloads/
  - UCDP Battle-Related Deaths 26.1 (紛争・年ごとの戦闘の死者。1989 年〜)
  - Correlates of War の国内戦争 4.1 (1816〜2014 年。内戦の年と死者)
  - Correlates of War の National Material Capabilities 6.0 (1816〜2016 年の軍事費・兵員・人口。入れ子の zip の中の abridged の CSV から 6 列だけ)
  - IMF Public Finances in Modern History (Mauro ほか 2015 を毎年更新。歳入・歳出・利払いを除く歳出・利払い・債務の GDP 比。1800 年〜)
    … IMF DataMapper の API
  - IMF World Revenue Longitudinal Data (WoRLD。1980 年〜の歳入・税収・贈与の GDP 比。一般政府と中央政府) … IMF の SDMX の API
  - IMF Government Finance Statistics の機能別の支出 (COFOG。保健・社会保護・老齢・防衛・支出の合計の GDP 比。一般政府・中央政府・予算の中央政府)
  - 世界銀行 WDI (1960〜2025 年。政府の保健支出・軍事費・税収・歳入の GDP 比、1 人あたり実質 GDP、人口、物価上昇率)
  - Maddison Project Database 2023 (1 人あたり実質 GDP と人口。1800 年〜の行だけ)
  - Our World in Data の長期の公的社会支出と公的保健支出の GDP 比 (Lindert 2004 と OECD をつないだもの)
  - countrycode (Arel-Bundock ほか 2018) の COW・Gleditsch-Ward の国名の表 (照合の確認用。対応表そのものは加工のスクリプトに書く)
すでにあるものは取り直さず、そのまま使う: data/raw/fiscal/JSTdatasetR6.xlsx (JST R6)・data/raw/history/cow_interstate_v4.csv (COW 国家間戦争 4.0)・
data/raw/history/cow_states2016.csv。
取得日・URL・SHA-256・大きさ・行数を data/raw/warfiscal/MANIFEST.json に記録する。gzip は mtime=0 で作るので、同じ入力からは同じバイト列になる。

使い方: python3 data/fetch/fetch_warfiscal.py
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, urllib.request, zipfile

import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'warfiscal')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
UCDP = 'https://ucdp.uu.se/downloads/'
IMF_SDMX = 'https://api.imf.org/external/sdmx/2.1/data/'
SDMX_CSV = 'application/vnd.sdmx.data+csv;version=1.0.0'
WDI = ['SH.XPD.GHED.GD.ZS',   # 政府の保健支出 ÷ GDP (%)。2000 年〜
       'MS.MIL.XPND.GD.ZS',   # 軍事費 ÷ GDP (%)。SIPRI による
       'GC.TAX.TOTL.GD.ZS',   # 税収 ÷ GDP (%)。中央政府
       'GC.REV.XGRT.GD.ZS',   # 歳入 (贈与を除く) ÷ GDP (%)。中央政府
       'NY.GDP.PCAP.KD',      # 1 人あたり実質 GDP (2015 年の米ドル)
       'SP.POP.TOTL',         # 人口
       'FP.CPI.TOTL.ZG',      # 消費者物価の上昇率 (%)
       'NY.GDP.DEFL.KD.ZG']   # GDP デフレーターの上昇率 (%)
FPP = ['rev', 'exp', 'prim_exp', 'ie', 'd']


def fetch(url, accept=None):
    h = dict(UA)
    if accept:
        h['Accept'] = accept
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=600) as r:
        return r.read()


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def record(name, data, url, **extra):
    with open(os.path.join(ROOT, name), 'wb') as f:
        f.write(data)
    return {'file': name, 'url': url, 'fetched': stamp(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), **extra}


def gz_csv(df):
    return gzip.compress(df.to_csv(index=False, lineterminator='\n').encode('utf-8'), mtime=0)


def zip_csv(url):
    """zip の中の CSV を 1 つ取り出す。(CSV のバイト列, 中の名前, zip の SHA-256)"""
    raw = fetch(url)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith('.csv'))
        return z.read(name), name, hashlib.sha256(raw).hexdigest()


def ucdp(out):
    for path, name in [('ucdpprio/ucdp-prio-acd-261-csv.zip', 'ucdp_prio_acd_261.csv.gz'),
                       ('brd/ucdp-brd-conf-261-csv.zip', 'ucdp_brd_conf_261.csv.gz')]:
        data, inner, zsha = zip_csv(UCDP + path)
        rows = len(pd.read_csv(io.BytesIO(data)))
        out.append(record(name, gzip.compress(data, mtime=0), f'{UCDP}{path}#{inner}', rows=rows, source_zip_sha256=zsha,
                          note='zip の中の CSV をそのまま gzip にした'))


def cow(out):
    url = 'https://correlatesofwar.org/wp-content/uploads/Intra-StateWarData_v4.1.csv'
    data = fetch(url)
    rows = len(pd.read_csv(io.BytesIO(data), encoding='latin-1'))
    out.append(record('cow_intrastate_v41.csv.gz', gzip.compress(data, mtime=0), url, rows=rows, note='元の CSV (latin-1) をそのまま gzip にした'))
    # NMC 6.0: 説明書の zip (約 10 MB) の中に、さらに abridged の zip がある
    url = 'https://correlatesofwar.org/wp-content/uploads/NMC_Documentation-6.0.zip'
    raw = fetch(url)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        with zipfile.ZipFile(io.BytesIO(z.read('NMC-60-abridged.zip'))) as z2:
            d = pd.read_csv(io.BytesIO(z2.read('NMC-60-abridged.csv')))
    cols = ['stateabb', 'ccode', 'year', 'milex', 'milper', 'tpop']
    d = d[cols]
    out.append(record('cow_nmc60.csv.gz', gz_csv(d), f'{url}#NMC-60-abridged.zip/NMC-60-abridged.csv', rows=len(d), source_zip_sha256=hashlib.sha256(raw).hexdigest(),
                      columns=cols, note='milex は 1913 年まで千英ポンド、1914 年から千米ドル (名目)。milper は千人、tpop は千人。-9 は欠け'))


def imf_fpp(out):
    rows = {}
    for ind in FPP:
        v = json.loads(fetch(f'https://www.imf.org/external/datamapper/api/v1/{ind}'))['values'][ind]
        for iso, ys in v.items():
            for y, x in ys.items():
                rows.setdefault((iso, int(y)), {})[ind] = x
    d = pd.DataFrame([{'iso3': k[0], 'year': k[1], **v} for k, v in sorted(rows.items())])[['iso3', 'year', *FPP]]
    out.append(record('imf_fpp.csv.gz', gz_csv(d), 'https://www.imf.org/external/datamapper/api/v1/{' + ','.join(FPP) + '}', rows=len(d),
                      note='Public Finances in Modern History (FPP)。rev 歳入・exp 歳出・prim_exp 利払いを除く歳出・ie 利払い・d 債務、すべて GDP 比 (%)'))


def imf_sdmx(out, flow, key, name, keep, note, dataonly=True):
    """SDMX の CSV。属性 (WoRLD の政府の範囲 SECTOR など) が要るときは dataonly=False にして、要る列だけ残す"""
    url = f'{IMF_SDMX}{flow}/{key}' + ('?detail=dataonly' if dataonly else '')
    d = pd.read_csv(io.BytesIO(fetch(url, SDMX_CSV)), low_memory=False)
    d = d.dropna(subset=['OBS_VALUE'])[keep + ['TIME_PERIOD', 'OBS_VALUE']]
    d = d.rename(columns={'COUNTRY': 'iso3', 'SECTOR': 'sector', 'INDICATOR': 'indicator', 'TIME_PERIOD': 'year', 'OBS_VALUE': 'value'})
    d['year'] = d['year'].astype(int)
    d = d.sort_values(['iso3', 'sector', 'indicator', 'year']).reset_index(drop=True)
    out.append(record(name, gz_csv(d), url, rows=len(d), note=note))


def wdi(out):
    countries = {c['id'] for c in json.loads(fetch('https://api.worldbank.org/v2/country?format=json&per_page=400'))[1] if c['region']['id'] != 'NA'}
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['indicator', 'iso3', 'year', 'value'])
    n = 0
    for ind in WDI:
        url = f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&per_page=20000&date=1960:2025'
        page = 1
        while True:
            meta, rows = json.loads(fetch(f'{url}&page={page}'))
            for r in rows or []:
                if r['value'] is not None and r['countryiso3code'] in countries:
                    w.writerow([ind, r['countryiso3code'], r['date'], r['value']])
                    n += 1
            if page >= meta['pages']:
                break
            page += 1
    out.append(record('wdi_warfiscal.csv.gz', gzip.compress(buf.getvalue().encode('utf-8'), mtime=0),
                      'https://api.worldbank.org/v2/country/all/indicator/{' + ','.join(WDI) + '}', rows=n, filter='国だけ (地域の集計を除く)・1960〜2025 年'))


def maddison(out):
    url = 'https://dataverse.nl/api/access/datafile/421302'
    raw = fetch(url)
    d = pd.read_excel(io.BytesIO(raw), sheet_name='Full data')
    d = d[d['year'] >= 1800][['countrycode', 'year', 'gdppc', 'pop']].dropna(subset=['gdppc', 'pop'], how='all')
    d = d.sort_values(['countrycode', 'year']).reset_index(drop=True)
    out.append(record('mpd2023.csv.gz', gz_csv(d), url + '#mpd2023_web.xlsx/Full data', rows=len(d), source_sha256=hashlib.sha256(raw).hexdigest(),
                      note='Maddison Project Database 2023 (doi:10.34894/INZBF2)。1800 年からの行と 4 列だけ。gdppc は 2011 年の購買力平価のドル、pop は千人'))


def owid(out):
    for slug in ['social-spending-oecd-longrun', 'public-health-expenditure-share-gdp-owid']:
        url = f'https://ourworldindata.org/grapher/{slug}.csv'
        data = fetch(url)
        out.append(record(f'owid_{slug}.csv', data, url, rows=data.count(b'\n') - 1, note='Our World in Data のグラフの CSV (CC BY 4.0)。1960 年より前は 10 年おき'))


def countrycode(out):
    base = 'https://raw.githubusercontent.com/vincentarelbundock/countrycode/main/dictionary/'
    for f, code in [('data_cow.csv', 'cown'), ('data_gw.csv', 'gwn')]:
        d = pd.read_csv(io.BytesIO(fetch(base + f)))
        d = d.groupby([code, 'country'])['year'].agg(['min', 'max']).reset_index().rename(columns={'min': 'year_min', 'max': 'year_max'})
        out.append(record(f'countrycode_{f.replace("data_", "").replace(".csv", "")}.csv', d.to_csv(index=False, lineterminator='\n').encode('utf-8'),
                          base + f, rows=len(d), note='国・年の行を、番号と国名の組ごとの最初と最後の年にまとめた'))


def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    ucdp(out)
    cow(out)
    imf_fpp(out)
    imf_sdmx(out, 'IMF.FAD,WORLD,3.0.1', '.G1_POGDP_PT_R+G11_POGDP_PT_R+G13_POGDP_PT_R..A', 'imf_world.csv.gz', ['COUNTRY', 'SECTOR', 'INDICATOR'],
             'WoRLD。G1 歳入・G11 税収・G13 贈与の GDP 比 (%)。sector (観測ごとの属性) S13 = 一般政府、S1311MIXED = 中央政府 (国により範囲が違う)。'
             '同じ国でも年によって sector が違うことがある', dataonly=False)
    imf_sdmx(out, 'IMF.STA,GFS_COFOG,11.0.0', '.S13+S1311+S1311B..GF07_T+GF10_T+GF1020_T+GF02_T+TOTOUT_T.POGDP_PT.A', 'imf_cofog.csv.gz',
             ['COUNTRY', 'SECTOR', 'INDICATOR'],
             'GFS の機能別の支出 (COFOG) の GDP 比 (%)。GF07 保健・GF10 社会保護・GF1020 老齢 (年金)・GF02 防衛・TOTOUT 支出の合計。'
             'sector S13 = 一般政府、S1311 = 中央政府 (社会保障基金を除く)、S1311B = 予算の中央政府')
    wdi(out)
    maddison(out)
    owid(out)
    countrycode(out)
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o.get('rows'), o['sha256'][:12])


if __name__ == '__main__':
    sys.exit(main())
