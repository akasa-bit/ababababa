#!/usr/bin/env python3
"""研究の生産性の生データ (Bloom・Jones・Van Reenen・Webb 2020 の再現用の一式) を取得する。セッション 9 (S4) の目標 R11 用。

取得するもの:
  - IdeaPFPrograms.zip (Chad Jones のページで公開されている、論文の再現用の台本とデータの一式。約 73 MB)
    … https://web.stanford.edu/~chadj/IdeaPFPrograms.zip (説明は IdeaPFDataAppendix.pdf)
    AEA の openICPSR の置き場 (project 111743) は、この環境から 403 で取れなかったので、著者のページの一式を使う。
一式には Compustat (WRDS の有料のデータ) が入っているので、zip はリポジトリに置かない (TESS と同じ扱い)。
置き場を引数で受け取って zip を落とし、zip と、計算に使う中のファイルの SHA-256 を data/raw/ideas/MANIFEST.json に残す。
計算に使うのは、台本に書き込まれた公開の統計 (BEA の NIPA・BLS の多要素生産性・ムーアの法則の研究費) だけ。

使い方: python3 data/fetch/fetch_ideas.py <置き場>   (そのあと python3 data/build/build_ideas.py <置き場>)
"""
import datetime, hashlib, json, os, sys, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'ideas')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
URL = 'https://web.stanford.edu/~chadj/IdeaPFPrograms.zip'
USED = ['Aggregate/AggregateBLSIPP.m', 'MooresLaw/IntelGraph.m', 'WageSci/WageEducation.m', 'WageSci/WageNominalGDP.m', 'ReadMe.txt']

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    os.makedirs(sys.argv[1], exist_ok=True)
    path = os.path.join(sys.argv[1], 'IdeaPFPrograms.zip')
    with urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=600) as r:
        data = r.read()
    with open(path, 'wb') as f:
        f.write(data)
    with zipfile.ZipFile(path) as z:
        members = {m: hashlib.sha256(z.read(m)).hexdigest() for m in USED}
    out = [{'file': 'IdeaPFPrograms.zip', 'url': URL, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'stored': False,
            'note': 'Compustat (WRDS) を含むので置かない。計算に使う中のファイルの SHA-256 は members', 'members': members}]
    os.makedirs(ROOT, exist_ok=True)
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(path, len(data), out[0]['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
