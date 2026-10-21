#!/usr/bin/env python3
"""入植集団の大きさ (最小の存続可能な集団) の文献の書誌を取得する。セッション 12 (段 9) の目標 R17 用。

R17 の生の材料は論文そのもの (前提と結論の数)。数は data/raw/colony/literature.json に、論文の何ページの何かを付けて手で写した
(この台本は書き換えない)。この台本は、写した論文が本物で、版が分かるように、書誌を公開の窓口から取って残すだけ。
  - Crossref の API (DOI ごとの題・雑誌・巻・ページ) … https://api.crossref.org/works/<DOI>
  - arXiv の要旨のページ (Marin & Beluffi の原稿の題と要旨。API の窓口はこの環境から 429 で取れなかった) … https://arxiv.org/abs/<id>
保存先は data/raw/colony/。取得日・URL・SHA-256 を data/raw/colony/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_colony.py
"""
import datetime, hashlib, json, os, sys, time, urllib.error, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'colony')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def fetch(url):
    for wait in (10, 30, 60, None):  # arXiv は混むと 429 を返すので、待って取り直す
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or wait is None:
                raise
            time.sleep(wait)

def main():
    lit = json.load(open(os.path.join(ROOT, 'literature.json'), encoding='utf-8'))
    out = []
    for s in lit['studies']:
        for kind, key in (('doi', 'https://api.crossref.org/works/{}'), ('arxiv', 'https://arxiv.org/abs/{}')):
            if not s.get(kind):
                continue
            url = key.format(s[kind])
            data = fetch(url)
            name = f"{s['id']}-{kind}.{'json' if kind == 'doi' else 'html'}"
            with open(os.path.join(ROOT, name), 'wb') as f:
                f.write(data)
            out.append({'file': name, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                        'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
            if kind == 'doi':
                m = json.loads(data)['message']
                print(s['id'], (m.get('title') or [''])[0][:70], '|', (m.get('container-title') or [''])[0], m.get('volume'), m.get('page'))
            else:
                print(s['id'], 'arXiv', len(data))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

if __name__ == '__main__':
    sys.exit(main())
