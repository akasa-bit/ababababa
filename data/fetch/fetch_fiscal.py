#!/usr/bin/env python3
"""財政と金融の生データを取得する (手で書き換えない)。段 4 の財政の目標 (R19〜R22・R27・R28) と国債の値用。

取得するもの:
  - Jordà–Schularick–Taylor Macrohistory Database R6 (18 か国 1870〜2020 年。税収・政府支出・政府債務・
    短期と長期の利子率・民間の信用・名目 GDP など) … https://www.macrohistory.net/database/
    引用: Jordà, Ò., Schularick, M. & Taylor, A. M. (2017). Macrofinancial History and the New Business Cycle Facts.
    NBER Macroeconomics Annual 31. 使う条件はサイトの記載どおり (研究と教育の目的・引用)
  - Schmelzing, P. (2020). Eight centuries of global real interest rates, R-G, and the 'suprasecular' decline, 1311–2018.
    Bank of England Staff Working Paper 845 のデータ … bankofengland.co.uk
保存先は data/raw/fiscal/。取得日・URL・SHA-256・大きさを data/raw/fiscal/MANIFEST.json に記録する。
  - Eurostat の一般政府 (S13) の金融資産のうち現金・預金 (nasa_10_f_bs、F2、資産、GDP 比、連結) と、総収入 (gov_10a_main、TR、GDP 比)
    … https://ec.europa.eu/eurostat/ 。国債の段で、政府が手元に置く資金 (税収の何年分か) を決めるのに使う。
    使う条件は Eurostat の再利用の方針 (出典を示す)
(Bank of England の「A millennium of macroeconomic data」(約 27 MB) は大きすぎるので、ここでは取らない)

使い方: python3 data/fetch/fetch_fiscal.py
"""
import datetime, hashlib, json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'fiscal')
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
FILES = [
    ('https://www.macrohistory.net/app/download/9834512569/JSTdatasetR6.xlsx', 'JSTdatasetR6.xlsx'),
    ('https://www.macrohistory.net/app/download/9834516169/JST_documentationR6.pdf', 'JST_documentationR6.pdf'),
    ('https://www.bankofengland.co.uk/-/media/boe/files/working-paper/2020/eight-centuries-of-global-real-interest-rates-r-g-and-the-suprasecular-decline-1311-2018-data.xlsx', 'schmelzing2020_data.xlsx'),
    ('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nasa_10_f_bs?format=JSON&sector=S13&finpos=ASS&na_item=F2&unit=PC_GDP&co_nco=CO&lang=EN', 'eurostat_s13_f2_assets.json'),
    ('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_main?format=JSON&sector=S13&na_item=TR&unit=PC_GDP&lang=EN', 'eurostat_s13_revenue.json'),
]

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()

def main():
    os.makedirs(ROOT, exist_ok=True)
    out = []
    for url, name in FILES:
        data = fetch(url)
        with open(os.path.join(ROOT, name), 'wb') as f:
            f.write(data)
        out.append({'file': name, 'url': url, 'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for o in out:
        print(o['file'], o['bytes'], o['sha256'][:12])

if __name__ == '__main__':
    sys.exit(main())
