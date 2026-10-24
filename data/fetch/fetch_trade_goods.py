#!/usr/bin/env python3
"""品ごとの交易の生データ (CEPII BACI HS17) を取得する (手で書き換えない)。目標 R01 の品ごとの距離の効き方 (回 KE5)。

取得するもの:
  - CEPII BACI HS17 V202501 (Gaulier & Zignago 2010) … https://www.cepii.fr/DATA_DOWNLOAD/baci/data/
    元の zip は約 690 MB (中の CSV は 7 年で約 2.5 GB) あり、リポジトリには置けない。そこで、2017〜2019 年 (CEPII Gravity の距離と重なる年) の行を、
    HS の 6 桁の品目からゲームの品の分け方 (下の GROUPS) にまとめた額にして data/raw/trade_goods/baci_hs17_groups_2017_2019.csv.gz に置く。
    元の zip の URL・取得日・SHA-256 と、まとめ方・行数を data/raw/trade_goods/MANIFEST.json に記録する
    (同じ zip から、このスクリプトで同じファイルが作り直せる)。

品の分け方 (ゲームの資源 RES に合わせる。HS 2017 の章 (2 桁)・項 (4 桁)・号 (6 桁) の頭で決める。先に当たったもの):
  water: 2201 (水。ゲームの水は大口の水と氷で、現実の交易はほとんど瓶詰めなので、合否には使わない)
  rare:  280530 (希土類の金属)・2846 (希土類の化合物)・7110 (白金族)。ゲームの希少元素
  food:  01〜24 章 (動物・植物・食品)。ゲームの食料
  fuel:  27 章 (鉱物性燃料)。ゲームの燃料
  metal: 26 章 (鉱石)・72 (鉄鋼)・74〜76・78〜81 章 (卑金属)。ゲームの金属 (工業の原料)
  other: 71 章の残り (金・宝石。値打ちが重さと関係しないので外す)・97〜99 章 (美術品・分類できないもの)
  hitech: 28〜38 章 (化学品・医薬品)・84〜93 章 (機械・電気機器・輸送機械・精密機器・武器)。ゲームの高付加価値物品
          (OECD の研究開発の強さで中・高技術とされる産業。UNIDO の中・高技術の製造業 (WDI の NV.MNF.TECH.ZS.UN。目標 R61) と同じ分け方)
  goods: それ以外の 25〜96 章 (土石・プラスチック・ゴム・皮革・木材・紙・繊維・衣類・履物・ガラス・陶磁器・金属製品・家具・雑品)。
         ゲームの低付加価値物品 (OECD の中・低技術と低技術。前の版 (目標の版 16) は hitech も含めて工業品にしていた)
列: year, iso3_o (輸出国), iso3_d (輸入国), group, v (千米ドル)

使い方: python3 data/fetch/fetch_trade_goods.py [zip のパス (省略すると取得する)] [その zip を落とした日時 (UTC。MANIFEST に書く)]
"""
import csv, datetime, gzip, hashlib, io, json, os, sys, tempfile, urllib.request, zipfile

ROOT = os.path.join(os.path.dirname(__file__), '..', 'raw', 'trade_goods')
URL = 'https://www.cepii.fr/DATA_DOWNLOAD/baci/data/BACI_HS17_V202501.zip'
YEARS = (2017, 2019)
UA = {'User-Agent': 'NoLongerUbiquitous data fetch (research game; contact via repository)'}
METAL = {'26', '72', '74', '75', '76', '78', '79', '80', '81'}


def group(k):
    """HS の 6 桁の品目 (文字列) → ゲームの品"""
    k = k.zfill(6)
    ch = k[:2]
    if k[:4] == '2201':
        return 'water'
    if k == '280530' or k[:4] in ('2846', '7110'):
        return 'rare'
    if '01' <= ch <= '24':
        return 'food'
    if ch == '27':
        return 'fuel'
    if ch in METAL:
        return 'metal'
    if ch == '71' or ch >= '97':
        return 'other'
    if '28' <= ch <= '38' or '84' <= ch <= '93':
        return 'hitech'
    return 'goods'


def main():
    os.makedirs(ROOT, exist_ok=True)
    if len(sys.argv) > 1:
        zpath, fetched = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
        local = True
    else:
        fd, zpath = tempfile.mkstemp(suffix='.zip')
        with os.fdopen(fd, 'wb') as f, urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=1800) as r:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        fetched = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        local = False
    h = hashlib.sha256()
    with open(zpath, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    with zipfile.ZipFile(zpath) as z:
        names = z.namelist()
        cc = next(n for n in names if n.startswith('country_codes'))
        iso = {row['country_code']: row['country_iso3'] for row in csv.DictReader(io.TextIOWrapper(z.open(cc), encoding='utf-8'))}
        agg = {}
        members = []
        for y in range(YEARS[0], YEARS[1] + 1):
            m = next(n for n in names if n.startswith(f'BACI_HS17_Y{y}_'))
            members.append(m)
            for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding='utf-8')):
                if row['i'] == row['j']:
                    continue
                key = (y, iso.get(row['i'], row['i']), iso.get(row['j'], row['j']), group(row['k']))
                agg[key] = agg.get(key, 0.0) + float(row['v'])
            print(y, len(agg), flush=True)
    out_name = f'baci_hs17_groups_{YEARS[0]}_{YEARS[1]}.csv.gz'
    out_path = os.path.join(ROOT, out_name)
    cols = ['year', 'iso3_o', 'iso3_d', 'group', 'v']
    # gzip の頭に時刻を入れない (同じ zip から同じバイト列になるように)
    with open(out_path, 'wb') as fo, gzip.GzipFile(fileobj=fo, mode='wb', compresslevel=9, mtime=0, filename='') as gz, \
            io.TextIOWrapper(gz, encoding='utf-8', newline='') as g:
        w = csv.writer(g)
        w.writerow(cols)
        for key in sorted(agg):
            w.writerow([*key, f'{agg[key]:.3f}'])
    with open(out_path, 'rb') as f:
        sha_out = hashlib.sha256(f.read()).hexdigest()
    tot = {}
    for (_, _, _, gname), v in agg.items():
        tot[gname] = tot.get(gname, 0.0) + v
    s = sum(tot.values())
    man = {
        'source': 'CEPII BACI HS17 V202501 (Gaulier, G. & Zignago, S. 2010, CEPII Working Paper 2010-23)',
        'url': URL, 'members': members, 'zip_sha256': h.hexdigest(), 'fetched': fetched or '(手元の zip から作った)',
        'license': 'CEPII のデータの利用条件 (出典を明記して研究・教育に使う) に従う',
        'groups': 'data/fetch/fetch_trade_goods.py の品の分け方の説明 (HS の章・項・号の頭で、ゲームの資源に分ける。目標の版 17 で工業品を goods と hitech に分けた)',
        'files': [{'file': out_name, 'columns': cols, 'years': list(YEARS), 'rows': len(agg), 'sha256': sha_out,
                   'filter': '輸出国 ≠ 輸入国。額は品目の額 (千米ドル) を品のまとまりごとに足したもの',
                   'share': {k: round(v / s, 4) for k, v in sorted(tot.items())}}],
    }
    with open(os.path.join(ROOT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    if not local:
        os.remove(zpath)
    print(f'{out_name}: {len(agg)} 行、{os.path.getsize(out_path) / 1e6:.1f} MB', man['files'][0]['share'])


if __name__ == '__main__':
    main()
