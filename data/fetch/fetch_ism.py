#!/usr/bin/env python3
"""星間の気体と、遮蔽の物理の生データを取得する (手で書き換えない)。docs/physics.md の 2。

取得するもの:
  - Linsky, Redfield & Tilipman (2019, ApJ 886, 41) の表 2「LIC Cloud Sight Line Properties」。
    HST の紫外線の分光 (D I・Fe II・Mg II の吸収) から測った、近くの星 62 本の視線の中性水素の柱密度 log N(H I)。
    arXiv の原稿 (1910.01243) の LaTeX から、表の部分 (deluxetable) だけを取り出す。
  - NIST PSTAR (液体の水の中の陽子の阻止能と CSDA の飛程)。Geant4 の計算を確かめるのに使う。
  - PDG の水の原子核の性質 (核相互作用長・核衝突長)。同じく確かめに使う。
保存先は data/raw/ism/。取得日・URL・SHA-256・行数を data/raw/ism/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_ism.py
"""
import datetime, hashlib, io, json, os, re, tarfile, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'ism')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def fetch(url, data=None):
    req = urllib.request.Request(url, headers=UA, data=data)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()

def save(path, data, url, **extra):
    with open(os.path.join(ROOT, path), 'wb') as f:
        f.write(data)
    return {'file': path, 'url': url, 'fetched': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'lines': data.count(b'\n'), **extra}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    # Linsky ほか 2019: 原稿の tar の中の innerlism.tex から、表 2 (label tab:licmem) の deluxetable を取り出す
    url = 'https://arxiv.org/e-print/1910.01243'
    tgz = fetch(url)
    with tarfile.open(fileobj=io.BytesIO(tgz)) as t:
        tex = t.extractfile('innerlism.tex').read().decode('utf8', 'replace')
    m = re.search(r'\\begin\{deluxetable\}\{lcccccccccccc\}.*?\\end\{deluxetable\}', tex, re.S)
    assert m and 'tab:licmem' in m.group(0), '表 2 が見つからない'
    out.append(save('linsky2019_tab2.tex', m.group(0).encode('utf8'), url + '#innerlism.tex (deluxetable tab:licmem)',
                    source_sha256=hashlib.sha256(tgz).hexdigest()))
    # NIST PSTAR (液体の水 = 物質の番号 276)
    url = 'https://physics.nist.gov/cgi-bin/Star/ap_table-t.pl'
    html = fetch(url, urllib.parse.urlencode({'matno': '276', 'ShowDefault': 'on', 'prog': 'PSTAR'}).encode()).decode('latin1')
    body = re.search(r'<pre>(.*?)</pre>', html, re.S).group(1)
    txt = re.sub(r'<br>', '\n', body)
    txt = re.sub(r'<[^>]+>', '', txt)
    out.append(save('pstar_water.txt', txt.encode('utf8'), url + ' (POST matno=276&ShowDefault=on&prog=PSTAR)'))
    # PDG の水の性質 (HTML から文字だけ)
    url = 'https://pdg.lbl.gov/2024/AtomicNuclearProperties/HTML/water_liquid.html'
    html = fetch(url).decode('utf8', 'replace')
    txt = re.sub(r'<[^>]+>', ' ', html)
    txt = '\n'.join(' '.join(l.split()) for l in txt.splitlines() if l.strip())
    out.append(save('pdg_water.txt', txt.encode('utf8'), url))
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    for o in out:
        print(o['file'], o['lines'], o['sha256'][:12])

if __name__ == '__main__':
    main()
