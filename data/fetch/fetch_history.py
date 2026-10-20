#!/usr/bin/env python3
"""歴史と社会の生データを取得する (手で書き換えない)。

取得するもの:
  - COLDAT (Becker 2019、植民地の宗主国と期間) … Harvard Dataverse doi:10.7910/DVN/T9SDEW
  - ICOW Colonial History 1.1 (Hensel、独立の年と、独立が暴力を伴ったか) … paulhensel.org
  - 国の位置 (首都のおおよその緯度・経度。Google DSPL の countries.csv)
  - Correlates of War の国家間戦争 4.0 (戦争の期間)
  - Correlates of War の国家の一覧 (State System Membership 2016。その年に国がいくつあったか)
  - UCDP Conflict Termination 4-2024 (紛争の終わり方)
  - CDB90 (約 660 の陸上の戦闘の兵力と損害。jrnold/CDB90)
保存先は data/raw/history/。取得日・URL・SHA-256・行数を data/raw/history/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_history.py
"""
import datetime, hashlib, io, json, os, sys, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'history')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()

def save(path, data, url):
    with open(os.path.join(ROOT, path), 'wb') as f:
        f.write(data)
    return {'file': path, 'url': url, 'fetched': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'lines': data.count(b'\n')}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    dv = 'https://dataverse.harvard.edu/api/access/datafile/{}?format=original'
    for fid, name in [(7416946, 'coldat_colonies.csv'), (7416947, 'coldat_dyads.csv')]:
        url = dv.format(fid)
        out.append(save(name, fetch(url), url))
    # ICOW は zip の中の CSV だけを置く
    url = 'https://www.paulhensel.org/Data/colhist.zip'
    with zipfile.ZipFile(io.BytesIO(fetch(url))) as z:
        name = next(n for n in z.namelist() if n.endswith('.csv'))
        out.append(save('icow_colhist.csv', z.read(name), f'{url}#{name}'))
    for url, name in [
        ('https://raw.githubusercontent.com/google/dspl/master/samples/google/canonical/countries.csv', 'countries.csv'),
        ('https://correlatesofwar.org/wp-content/uploads/Inter-StateWarData_v4.0.csv', 'cow_interstate_v4.csv'),
        ('https://correlatesofwar.org/wp-content/uploads/states2016.csv', 'cow_states2016.csv'),
        ('https://ucdp.uu.se/downloads/monadterm/UCDPConflictTerminationDataset_v4_2024_Conflict.csv', 'ucdp_termination_conflict.csv'),
        ('https://raw.githubusercontent.com/jrnold/CDB90/master/data/battles.csv', 'cdb90_battles.csv'),
        ('https://raw.githubusercontent.com/jrnold/CDB90/master/data/belligerents.csv', 'cdb90_belligerents.csv'),
    ]:
        out.append(save(name, fetch(url), url))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['lines'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
