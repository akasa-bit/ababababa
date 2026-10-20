#!/usr/bin/env python3
"""スウォームの太陽電池が陽子で傷む計算の生データを取得する (手で書き換えない)。docs/physics.md の 7。

取得するもの:
  - GaAs の中の陽子の NIEL (結晶の原子をはじき出すのに使われるエネルギー、MeV cm²/g)。SR-NIEL の計算機 (v11.1、ハドロン + クーロン、
    はじき出しのしきい Ed = 21 eV)。0.01〜1,000 MeV
  - カバーガラスの中の陽子の飛程: NIST PSTAR のパイレックス (ホウケイ酸ガラス。セリウム入りのカバーガラスの代わり。物質の番号 169)
保存先は data/raw/pv/。取得日・URL・SHA-256・行数を data/raw/pv/MANIFEST.json に記録する。

使い方: python3 data/fetch/fetch_pv.py
"""
import datetime, hashlib, json, os, re, time, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'pv')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}

def fetch(url, data=None):
    for k in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA, data=data), timeout=180) as r:
                return r.read()
        except Exception:
            if k == 4: raise
            time.sleep(2 ** (k + 1))

def save(path, data, url, **extra):
    open(os.path.join(ROOT, path), 'wb').write(data)
    return {'file': path, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'sha256': hashlib.sha256(data).hexdigest(), 'lines': data.count(b'\n'), **extra}

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    url = 'https://www.sr-niel.org/index.php/sr-niel-web-calculators/niel-calculator-for-electrons-protons-and-ions/protons-ions-niel-calculator'
    form = 'Zi=1&Ionmodel=1&Scale=0&TARGET=0&NELEM=2&Z1=31&Stoich1=1&Th1=21&Z2=33&Stoich2=1&Th2=21&Emin=0.01&Emax=1000&AddEnergy=&Fluence=1&formSubmit=CALCULATE'
    page = fetch(url, form.encode()).decode('utf8', 'replace')
    res = re.search(r'https?://www\.sr-niel\.org/Simulation/\d+niel_p\.html', page).group(0)
    html = fetch(res).decode('utf8', 'replace')
    rows = [l.split()[:2] for l in re.sub(r'<[^>]+>', ' ', html).splitlines() if re.match(r'^\s+\d\.\d+e[+-]\d+\s+\d', re.sub(r'<[^>]+>', ' ', l))]
    txt = '# 陽子の NIEL in GaAs (SR-NIEL v11.1、ハドロン + クーロン、Ed = 21 eV)\n# E [MeV]  NIEL [MeV cm2/g]\n' + ''.join(f'{a} {b}\n' for a, b in rows)
    out.append(save('srniel_proton_GaAs_Ed21.txt', txt.encode(), url + ' (POST ' + form + ')'))
    url = 'https://physics.nist.gov/cgi-bin/Star/ap_table-t.pl'
    html = fetch(url, urllib.parse.urlencode({'matno': '169', 'ShowDefault': 'on', 'prog': 'PSTAR'}).encode()).decode('latin1')
    body = re.sub(r'<[^>]+>', '', re.sub('<br>', '\n', re.search(r'<pre>(.*?)</pre>', html, re.S).group(1)))
    out.append(save('pstar_pyrex.txt', body.encode('utf8'), url + ' (POST matno=169&ShowDefault=on&prog=PSTAR)'))
    json.dump(out, open(os.path.join(ROOT, 'MANIFEST.json'), 'w'), indent=1, ensure_ascii=False)
    for o in out: print(o['file'], o['lines'], o['sha256'][:12])

if __name__ == '__main__':
    main()
