#!/usr/bin/env python3
"""国ごとに違う開始 (回 SE8・B-029) の生データを取得する (手で書き換えない)。

取得するもの:
  - Correlates of War の国力の指標 (National Material Capabilities 6.0。Singer, Bremer & Stuckey 1972・Greig & Enterline 2021)
    … 国・年ごとの総人口 (tpop)・軍の人員 (milper)・軍事費 (milex) ほか。zip の中の abridged の CSV だけを置く
  1820 年の国の人口の散らばりは、Maddison Project Database 2023 (data/raw/productivity/mpd2023_full.csv.gz。fetch_productivity.py が取る) を使う (ここでは取らない)。
保存先は data/raw/nations/。取得日・URL・SHA-256・行数を data/raw/nations/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_nations.py
"""
import datetime, hashlib, io, json, os, sys, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'nations')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
NMC = 'https://correlatesofwar.org/wp-content/uploads/NMC_Documentation-6.0.zip'

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()

def save(path, data, url, **extra):
    with open(os.path.join(ROOT, path), 'wb') as f:
        f.write(data)
    return {'file': path, 'url': url, 'fetched': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'lines': data.count(b'\n'), **extra}

def main():
    os.makedirs(ROOT, exist_ok=True)
    z = fetch(NMC)
    # zip の中に、さらに abridged の zip がある (NMC-60-abridged.zip の中の CSV)
    with zipfile.ZipFile(io.BytesIO(z)) as f:
        inner = next(n for n in f.namelist() if n.lower().endswith('.zip') and 'abridged' in n.lower())
        with zipfile.ZipFile(io.BytesIO(f.read(inner))) as g:
            name = next(n for n in g.namelist() if n.lower().endswith('.csv'))
            out = [save('nmc_6.csv', g.read(name), f'{NMC}#{inner}#{name}', source_sha256=hashlib.sha256(z).hexdigest())]
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['lines'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
