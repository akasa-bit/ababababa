#!/usr/bin/env python3
"""従属国の歴史の生データを取得する (手で書き換えない)。レーン H (従属国の歴史) のセッション H2-1。

取得するもの:
  - International System(s) Dataset (ISD) 2.2 (Butcher & Griffiths 2020、国家の一覧 1816〜2016。始まりと終わりの年・型・暴力・移り先) … Harvard Dataverse doi:10.7910/DVN/FGXZHL
  - Lake (2009) Hierarchy in International Relations の国・年の複製データ (安全保障と経済の上下関係の指標) … Harvard Dataverse doi:10.7910/DVN/90PR8O
  - Seshat Equinox-2020 (Turchin ほか 2022。政体の一覧と符号化された変数) … Zenodo doi:10.5281/zenodo.6642230 (CC BY-NC-SA 4.0)
  - Correlates of War Colonial/Dependency Contiguity 3.1 (植民地と従属の隣接 1816〜2016) … correlatesofwar.org
保存先は data/raw/vassal/。取得日・URL・SHA-256・行数を data/raw/vassal/MANIFEST.json に記録する。

取れなかったもの (理由は data/raw/vassal/README.md): Lange (2009) の間接統治の指標 (本の付録で、データの配布がない)。

使い方: python3 data/fetch/fetch_vassal.py
"""
import datetime, hashlib, io, json, os, sys, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'vassal')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()

def save(path, data, url, note=None):
    with open(os.path.join(ROOT, path), 'wb') as f:
        f.write(data)
    o = {'file': path, 'url': url, 'fetched': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
         'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'lines': data.count(b'\n')}
    if note:
        o['note'] = note
    return o

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    dv = 'https://dataverse.harvard.edu/api/access/datafile/{}?format=original'
    # ISD 2.2 (xlsx と codebook)
    for fid, name, note in [(12128047, 'isd_2_2_update.xlsx', 'ISD 2.2 本体 (シート ISD V2)'),
                            (12128044, 'isd_2_2_codebook.pdf', 'ISD 2.2 のコードブック')]:
        url = dv.format(fid)
        out.append(save(name, fetch(url), url, note))
    # Lake 2009 の国・年の表 (Stata .dta) と、表を再現する do ファイル (変数の定義の手がかり)
    for fid, name, note in [(3202537, 'lake_hir_country_year.dta', 'Lake 2009 の国・年の複製データ (表 4.1・6.1〜6.3)'),
                            (3202534, 'lake_hir_country_year_results.do', '同じ表を再現する Stata の台本 (変数の定義の手がかり)')]:
        url = dv.format(fid)
        out.append(save(name, fetch(url), url, note))
    # Seshat Equinox-2020: Zenodo の zip の中の xlsx だけを置く
    url = 'https://zenodo.org/api/records/6642230/files/seshatdb/Equinox_Data-v.1.zip/content'
    with zipfile.ZipFile(io.BytesIO(fetch(url))) as z:
        for n in z.namelist():
            if n.endswith('.xlsx'):
                out.append(save('seshat_equinox_2020.xlsx', z.read(n), f'{url}#{n}', 'Seshat Equinox-2020 (CC BY-NC-SA 4.0。シート Polities・Equinox2020_CanonDat・Variables ほか)'))
            elif n.endswith('LICENSE'):
                out.append(save('seshat_LICENSE', z.read(n), f'{url}#{n}'))
    # COW Colonial/Dependency Contiguity 3.1: zip の中の CSV と codebook
    url = 'https://correlatesofwar.org/wp-content/uploads/ColonialContiguity310.zip'
    with zipfile.ZipFile(io.BytesIO(fetch(url))) as z:
        for n in z.namelist():
            base = n.split('/')[-1]
            if base in ('contcold.csv', 'contcol.csv', 'contcols.csv'):
                out.append(save(f'cow_{base}', z.read(n), f'{url}#{n}', {'contcold.csv': '二国間 (dyadic) の植民地・従属の隣接', 'contcol.csv': '隣接の始まりと終わり', 'contcols.csv': '国と従属の組'}[base]))
            elif base.endswith('Codebook.pdf'):
                out.append(save('cow_colonial_contiguity_codebook.pdf', z.read(n), f'{url}#{n}'))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
