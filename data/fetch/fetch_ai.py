#!/usr/bin/env python3
"""AI の国の振る舞い (同盟と指導者) の生データを取得する (手で書き換えない。回 AI1・B-300。docs/ai-behavior.md の 4)。

取得するもの:
  - ATOP 5.1 (Alliance Treaty Obligations and Provisions。Leeds ほか 2002。1815〜2018 年の同盟 789 件の中身と、加盟国ごとの出入り)
      … http://www.atopdata.org/ の CSV。同盟ごと (atop5_1a.csv) と加盟国ごと (atop5_1m.csv) と、コードブック (PDF)
  - Archigos 4.1 (Goemans・Gleditsch・Chiozza 2009。1875〜2015 年の指導者 3,409 人の就任と退任の仕方)
      … https://www.rochester.edu/college/faculty/hgoemans/data.htm の Stata ファイルと、コードブック (PDF)
国家の一覧 (Correlates of War の State System Membership 2016) は data/raw/history/cow_states2016.csv (fetch_history.py) を使う。
保存先は data/raw/ai/。取得日・URL・SHA-256・行数を data/raw/ai/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_ai.py
"""
import datetime, hashlib, io, json, os, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'ai')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()

def save(path, data, url):
    with open(os.path.join(ROOT, path), 'wb') as f:
        f.write(data)
    return {'file': path, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'lines': data.count(b'\n')}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    base = 'http://www.atopdata.org/uploads/6/9/1/3/69134503/'
    url = base + 'atop_5.1__.csv_.zip'
    with zipfile.ZipFile(io.BytesIO(fetch(url))) as z:
        for name in ['atop5_1a.csv', 'atop5_1m.csv']:
            inner = next(n for n in z.namelist() if n.endswith('/' + name))
            out.append(save(name, z.read(inner), f'{url}#{inner}'))
    url = base + 'atop_5_1_codebook.pdf'
    out.append(save('atop_5_1_codebook.pdf', fetch(url), url))
    g = 'https://www.rochester.edu/college/faculty/hgoemans/'
    for name in ['Archigos_4.1_stata14.dta']:  # コードブック (Archigos_4.1.pdf、3 MB) は置かない。同じ所にある
        out.append(save(name, fetch(g + name), g + name))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for x in out:
        print(x['file'], x['lines'], x['sha256'][:12])

if __name__ == '__main__':
    main()
