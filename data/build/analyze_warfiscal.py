#!/usr/bin/env python3
"""戦争と財政の生データ (data/raw/warfiscal/ と、すでにある JST・COW) から、戦争疲弊 E が税収・年金・医療に効くかを推定する。

ゲームでは、戦争疲弊 E (0〜100) が政府の税収を (1 − 0.004 E) 倍にし、年金と医療の支出は E によらず全部払う。
ここでは現実の国・年のデータで次を求める:
  1. f_tax(E): 歳入 ÷ GDP が E でどう変わるか (徴収の強さ)。GDP の落ち込みは別に見る (実質の歳入の額 = 歳入 ÷ GDP × 実質 GDP)
  2. f_pension(E)・f_health(E): 公的な社会保護 (老齢) と保健の支出 ÷ GDP と、1 人あたり実質の額
  3. E の作り方: 戦争の年数と戦闘の死者 (人口 1,000 人あたり) から、ゲームと同じ溜まり方 (戦争の年 +1、平和の年 −5、0〜100) で作る
主に国家間戦争 (ゲームの国どうしの戦争) で決め、内戦 (反乱・独立) と外国への介入は比べるために別に出す。

手順 (どれも乱数の種を固定するので、同じ入力からは同じ結果になる):
  - 戦争の国・年: COW 国家間戦争 4.0 (1816〜2007)・UCDP/PRIO の国家間 (1946〜2025)・COW 国内戦争 4.1 (1816〜2014)・UCDP の国内と国際化した国内
  - 財政: IMF の Public Finances in Modern History (FPP、1800 年〜、本推定)・JST R6 (18 か国)・IMF WoRLD (1980 年〜)・
    IMF GFS COFOG (保健・社会保護・老齢・防衛)・WDI (政府の保健支出 2000 年〜・軍事費)
  - 選び方: データがそろう → 高インフレと通貨改革の年を除く → 系列の切れ目 (1 年で 10 ポイントを超える跳び) で系列を分ける・
    1 年だけの跳ねを除く → 開戦の前の傾きが平和な時期の 95% の幅を外れる戦争を除く → 頑健回帰 (Huber) で
    |標準化残差| > 3 か Cook の距離 > 4/n の点を除く
  - 推定: 系列 (国) と年の固定効果。信頼区間は国を単位にした (ペアの) クラスター・ブートストラップ。
    出来事の分析は、開戦と終戦の前後で、同じ年に戦争をしていない国を対照にした差の差 (エピソードごと) を平均する
書き出し: data/derived/warfiscal.json

使い方: python3 data/build/analyze_warfiscal.py   (numpy と pandas が要る。4 コアで約 30 分。ブートストラップを 4 つのプロセスで回す)
"""
import datetime, json, math, os, sys, warnings

import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'warfiscal')
HIST = os.path.join(HERE, '..', 'raw', 'history')
FISC = os.path.join(HERE, '..', 'raw', 'fiscal')
OUT = os.path.join(HERE, '..', 'derived', 'warfiscal.json')

SEED = 20261108
BOOT = 1000          # ブートストラップの回数
KAPPA = 5.0          # 戦闘の死者 (人口 1,000 人あたり 1 人) を E の何点とみなすか
WAR_YEAR = 1.0       # 戦争 1 つにつき年 +1 (ゲームと同じ)
PEACE_YEAR = 5.0     # 平和な年は −5 (ゲームと同じ)
E_BINS = [0, 5, 15, 30, 60, 100.01]
BREAK_PP = 10.0      # 1 年でこれを超えて GDP 比が動いたら系列の切れ目とみなす (ポイント)
SPIKE_PP = 5.0       # 1 年だけ跳ねて戻る (前後とも 5 ポイント超、向きが逆) なら、その年を除く
BREAK_LOG = 50.0     # 支出の内訳 (保健・社会保護・老齢・防衛。GDP の数 % の小さな値) は、100 × ln の跳びで判定する (50 = 約 1.65 倍)
SPIKE_LOG = 30.0
HYPER = 100.0        # 年の物価上昇率がこれ (%) を超える年と次の年を除く
MIN_SPELL = 5        # 切れ目で分けた系列の最短の長さ (年)
FEW = 10             # 係数を支える国 (説明変数が 0 でない国) がこれより少ないか、
FEW_EFF = 5.0        # 実効の国の数 (変動の国ごとの分け前のハーフィンダール指数の逆数) がこれより少なければ、信頼区間はあてにならないと印をつける
KAPPAS = [0.0, 1.0, 2.0, 10.0, 20.0]  # κ の感度 (当てはまりの比較)
KAPPAS_BOOT = [0.0, 2.0, 10.0]  # κ の感度 (ブートストラップまで出すもの)
PRE = 5              # 出来事の前の年数
POST = 8             # 出来事の後の年数

# COW の国の番号 → ISO3。歴史的な国は、財政の系列が続いている国に寄せる (オーストリア=ハンガリー → AUT、ユーゴスラビア → SRB、
# 北イエメン → YEM、ソ連 → RUS)。東ドイツ・南ベトナム・南イエメン・ドイツ統一前の諸邦などは財政の系列がないので載せない
COW2ISO = {
    2: 'USA', 20: 'CAN', 31: 'BHS', 40: 'CUB', 41: 'HTI', 42: 'DOM', 51: 'JAM', 52: 'TTO', 53: 'BRB', 54: 'DMA', 55: 'GRD', 56: 'LCA',
    57: 'VCT', 58: 'ATG', 60: 'KNA', 70: 'MEX', 80: 'BLZ', 90: 'GTM', 91: 'HND', 92: 'SLV', 93: 'NIC', 94: 'CRI', 95: 'PAN', 100: 'COL',
    101: 'VEN', 110: 'GUY', 115: 'SUR', 130: 'ECU', 135: 'PER', 140: 'BRA', 145: 'BOL', 150: 'PRY', 155: 'CHL', 160: 'ARG', 165: 'URY',
    200: 'GBR', 205: 'IRL', 210: 'NLD', 211: 'BEL', 212: 'LUX', 220: 'FRA', 221: 'MCO', 223: 'LIE', 225: 'CHE', 230: 'ESP', 232: 'AND',
    235: 'PRT', 255: 'DEU', 260: 'DEU', 290: 'POL', 300: 'AUT', 305: 'AUT', 310: 'HUN', 315: 'CZE', 316: 'CZE', 317: 'SVK', 325: 'ITA',
    338: 'MLT', 339: 'ALB', 341: 'MNE', 343: 'MKD', 344: 'HRV', 345: 'SRB', 346: 'BIH', 349: 'SVN', 350: 'GRC', 352: 'CYP', 355: 'BGR',
    359: 'MDA', 360: 'ROU', 365: 'RUS', 366: 'EST', 367: 'LVA', 368: 'LTU', 369: 'UKR', 370: 'BLR', 371: 'ARM', 372: 'GEO', 373: 'AZE',
    375: 'FIN', 380: 'SWE', 385: 'NOR', 390: 'DNK', 395: 'ISL', 402: 'CPV', 403: 'STP', 404: 'GNB', 411: 'GNQ', 420: 'GMB', 432: 'MLI',
    433: 'SEN', 434: 'BEN', 435: 'MRT', 436: 'NER', 437: 'CIV', 438: 'GIN', 439: 'BFA', 450: 'LBR', 451: 'SLE', 452: 'GHA', 461: 'TGO',
    471: 'CMR', 475: 'NGA', 481: 'GAB', 482: 'CAF', 483: 'TCD', 484: 'COG', 490: 'COD', 500: 'UGA', 501: 'KEN', 510: 'TZA', 516: 'BDI',
    517: 'RWA', 520: 'SOM', 522: 'DJI', 530: 'ETH', 531: 'ERI', 540: 'AGO', 541: 'MOZ', 551: 'ZMB', 552: 'ZWE', 553: 'MWI', 560: 'ZAF',
    565: 'NAM', 570: 'LSO', 571: 'BWA', 572: 'SWZ', 580: 'MDG', 581: 'COM', 590: 'MUS', 591: 'SYC', 600: 'MAR', 615: 'DZA', 616: 'TUN',
    620: 'LBY', 625: 'SDN', 626: 'SSD', 630: 'IRN', 640: 'TUR', 645: 'IRQ', 651: 'EGY', 652: 'SYR', 660: 'LBN', 663: 'JOR', 666: 'ISR',
    670: 'SAU', 678: 'YEM', 679: 'YEM', 690: 'KWT', 692: 'BHR', 694: 'QAT', 696: 'ARE', 698: 'OMN', 700: 'AFG', 701: 'TKM', 702: 'TJK',
    703: 'KGZ', 704: 'UZB', 705: 'KAZ', 710: 'CHN', 712: 'MNG', 713: 'TWN', 730: 'KOR', 731: 'PRK', 732: 'KOR', 740: 'JPN', 750: 'IND',
    760: 'BTN', 770: 'PAK', 771: 'BGD', 775: 'MMR', 780: 'LKA', 781: 'MDV', 790: 'NPL', 800: 'THA', 811: 'KHM', 812: 'LAO', 816: 'VNM',
    820: 'MYS', 830: 'SGP', 835: 'BRN', 840: 'PHL', 850: 'IDN', 860: 'TLS', 900: 'AUS', 910: 'PNG', 920: 'NZL', 935: 'VUT', 940: 'SLB',
    946: 'KIR', 947: 'TUV', 950: 'FJI', 955: 'TON', 970: 'NRU', 983: 'MHL', 986: 'PLW', 987: 'FSM', 990: 'WSM'}
# Gleditsch-Ward の番号は COW とほぼ同じ。違うところだけ直す (GW 260 = ドイツ連邦共和国・統一ドイツ、340 = セルビア、
# 678 = イエメン (北と統一後)、816 = ベトナム)
GW2ISO = {**COW2ISO, 260: 'DEU', 340: 'SRB', 345: 'SRB', 678: 'YEM', 816: 'VNM', 817: None, 680: None, 265: None, 347: None, 711: None}
# 価格のデータがない年 (1960 年より前、JST の 18 か国の外) の高インフレ。Hanke & Krus (2013) の一覧から (記憶による)
HYPER_LIST = {'AUT': [(1921, 1922)], 'HUN': [(1923, 1924), (1945, 1946)], 'POL': [(1921, 1924)], 'RUS': [(1918, 1924)],
              'GRC': [(1941, 1946)], 'CHN': [(1937, 1949)], 'TWN': [(1945, 1949)], 'PHL': [(1942, 1945)], 'DEU': [(1920, 1924)]}


def gz(name):
    return os.path.join(RAW, name)


def years(a, b):
    return list(range(int(a), int(b) + 1))


def num(x):
    """数 (COW の CSV には '10,000' のようにコンマの入った数がある)"""
    try:
        return float(str(x).replace(',', ''))
    except ValueError:
        return np.nan


# ---------------------------------------------------------------- 戦争の国・年

def gw_list(x):
    if pd.isna(x) or str(x).strip() == '':
        return []
    return [int(v) for v in str(x).replace(' ', '').split(',') if v]


def war_records():
    """戦争の記録 (国・年・種類・戦争の番号・その年の死者・COW の結果) の表"""
    rec = []
    # COW 国家間戦争 4.0: 参加国ごとの期間 (2 つ目の期間もある)。死者 BatDeath は参加国の戦争全体の死者なので、年に均等に割る
    for r in pd.read_csv(os.path.join(HIST, 'cow_interstate_v4.csv'), encoding='latin-1').itertuples():
        iso = COW2ISO.get(r.ccode)
        if not iso:
            continue
        ys = years(r.StartYear1, r.EndYear1)
        if r.StartYear2 > 0:
            ys += years(r.StartYear2, r.EndYear2)
        ys = sorted(set(ys))
        d = r.BatDeath / len(ys) if r.BatDeath >= 0 else np.nan
        for y in ys:
            rec.append((iso, y, 'inter', f'cowi{r.WarNum}', d, r.Outcome, 'cow'))
    # COW 国内戦争 4.1: 内戦 (中央の支配 = 4、地方の問題 = 5)。政府の行は CcodeA が国で、SideB に反乱側の名がある行。
    # それ以外で国の番号がある行は、外国からの介入
    c = pd.read_csv(gz('cow_intrastate_v41.csv.gz'), encoding='latin-1')
    c = c[c['WarType'].isin([4, 5])]
    for r in c.itertuples():
        e1 = 2014 if r.EndYear1 == -7 else (r.StartYear1 if pd.isna(r.EndYear1) else r.EndYear1)  # -7 = 続いている、空欄 (2 件) は 1 年で終わったとみなす
        if e1 < 0:
            continue
        ys = years(r.StartYear1, e1)
        if r.StartYear2 > 0 and r.EndYear2 > 0:
            ys += years(r.StartYear2, r.EndYear2)
        ys = sorted(set(ys))
        da = num(r.SideADeaths) if num(r.SideADeaths) >= 0 else np.nan
        db = num(r.SideBDeaths) if num(r.SideBDeaths) >= 0 else (0.0 if num(r.SideBDeaths) == -8 else np.nan)
        gov = r.CcodeA > 0 and str(r.SideB).strip() != '-8'
        if gov:
            iso = COW2ISO.get(int(r.CcodeA))
            d = (da + db) / len(ys) if not (np.isnan(da) or np.isnan(db)) else np.nan
            if iso:
                for y in ys:
                    rec.append((iso, y, 'civil', f'cowc{r.WarNum}', d, np.nan, 'cow'))
        else:
            code = r.CcodeA if r.CcodeA > 0 else r.CcodeB
            iso = COW2ISO.get(int(code)) if code > 0 else None
            dd = da if r.CcodeA > 0 else db
            if iso:
                for y in ys:
                    rec.append((iso, y, 'interv', f'cowc{r.WarNum}', dd / len(ys) if not np.isnan(dd) else np.nan, np.nan, 'cow'))
    # UCDP/PRIO 26.1 と、1989 年からの戦闘の死者 (紛争・年)
    acd = pd.read_csv(gz('ucdp_prio_acd_261.csv.gz'))
    brd = pd.read_csv(gz('ucdp_brd_conf_261.csv.gz'))
    bd = {(r.conflict_id, r.year): float(r.bd_best) for r in brd.itertuples()}
    for r in acd.itertuples():
        a, b, a2, b2 = gw_list(r.gwno_a), gw_list(r.gwno_b), gw_list(r.gwno_a_2nd), gw_list(r.gwno_b_2nd)
        deaths = bd.get((r.conflict_id, r.year), np.nan)
        cid = f'ucdp{r.conflict_id}'
        if r.type_of_conflict == 2:
            kind = 'inter' if r.intensity_level == 2 else 'inter_minor'
            prim = [g for g in a + b if GW2ISO.get(g)]
            for g in prim:
                rec.append((GW2ISO[g], r.year, kind, cid, deaths / len(prim) if prim else np.nan, np.nan, 'ucdp'))
            for g in a2 + b2:
                if GW2ISO.get(g):
                    rec.append((GW2ISO[g], r.year, kind, cid, 0.0 if not np.isnan(deaths) else np.nan, np.nan, 'ucdp'))
        elif r.type_of_conflict in (3, 4):
            kind = 'civil' if r.intensity_level == 2 else 'civil_minor'
            for g in a:
                if GW2ISO.get(g):
                    rec.append((GW2ISO[g], r.year, kind, cid, deaths, np.nan, 'ucdp'))
            for g in a2 + b2:
                if GW2ISO.get(g):
                    rec.append((GW2ISO[g], r.year, 'interv', cid, 0.0 if not np.isnan(deaths) else np.nan, np.nan, 'ucdp'))
        elif r.type_of_conflict == 1:
            for g in a:
                if GW2ISO.get(g):
                    rec.append((GW2ISO[g], r.year, 'colonial', cid, deaths, np.nan, 'ucdp'))
    return pd.DataFrame(rec, columns=['iso3', 'year', 'kind', 'war', 'deaths', 'outcome', 'src'])


def war_panel(rec):
    """国・年ごとの戦争の状態。COW の記録がある年は COW を、ない年は UCDP を使う (同じ戦争を 2 度数えない)"""
    out = {}
    for (iso, y), g in rec.groupby(['iso3', 'year']):
        row = {}
        for kind in ['inter', 'civil', 'interv']:
            k = g[g['kind'] == kind]
            if len(k):
                kc = k[k['src'] == 'cow']
                use = kc if len(kc) else k
                row[kind] = 1
                row[f'n_{kind}'] = use['war'].nunique()
                dd = use.groupby('war')['deaths'].sum(min_count=1)
                row[f'd_{kind}'] = float(dd.sum()) if dd.notna().all() else np.nan
                if kind == 'inter':
                    oc = kc.dropna(subset=['outcome'])
                    if len(oc):  # 戦争が重なる年は死者の多い戦争の結果
                        oc = oc.sort_values('deaths', ascending=False)
                        row['outcome'] = int(oc['outcome'].iloc[0])
                    row['war_inter'] = use.sort_values('deaths', ascending=False)['war'].iloc[0]
        for kind in ['inter_minor', 'civil_minor', 'colonial']:
            if (g['kind'] == kind).any():
                row[kind] = 1
        out[(iso, y)] = row
    w = pd.DataFrame.from_dict(out, orient='index')
    w.index = pd.MultiIndex.from_tuples(w.index, names=['iso3', 'year'])
    for c in ['inter', 'civil', 'interv', 'inter_minor', 'civil_minor', 'colonial']:
        w[c] = w.get(c, 0)
        w[c] = w[c].fillna(0).astype(int)
    # 重い方を優先: 国家間戦争の年は小さい国家間紛争に数えない、内戦の年は小さい内戦に数えない、国家間戦争の年は介入に数えない
    w.loc[w['inter'] == 1, 'inter_minor'] = 0
    w.loc[w['civil'] == 1, 'civil_minor'] = 0
    w.loc[w['inter'] == 1, 'interv'] = 0
    return w.reset_index()


def population():
    """人口 (千人)。Maddison を先に、なければ COW NMC の tpop、なければ WDI"""
    m = pd.read_csv(gz('mpd2023.csv.gz')).rename(columns={'countrycode': 'iso3'})
    p = m.dropna(subset=['pop']).set_index(['iso3', 'year'])['pop']
    n = pd.read_csv(gz('cow_nmc60.csv.gz'))
    n = n[n['tpop'] > 0]
    n['iso3'] = n['ccode'].map(COW2ISO)
    n = n.dropna(subset=['iso3']).groupby(['iso3', 'year'])['tpop'].max()
    w = pd.read_csv(gz('wdi_warfiscal.csv.gz'))
    w = w[w['indicator'] == 'SP.POP.TOTL'].set_index(['iso3', 'year'])['value'] / 1e3
    return p.combine_first(n).combine_first(w)


def e_proxy(w, pop, kappa=KAPPA, y0=1816, y1=2025):
    """ゲームと同じ溜まり方の E を、種類ごと (国家間・内戦・介入) に作る。
    戦争の年: E += 戦争の数 × 1 + κ × その年の戦闘の死者 (人口 1,000 人あたり)。平和な年: E −= 5。0〜100 に収める。
    合わせて、いまの戦争の通算の年数 (dur)、その戦争で通算の死者 (人口 1,000 人あたり、cumd)、戦争が終わってからの年数 (post、1〜5) も作る"""
    w = w.set_index(['iso3', 'year'])
    rows = []
    for iso in sorted(w.index.get_level_values(0).unique().union(pop.index.get_level_values(0).unique())):
        sub = w.xs(iso) if iso in w.index.get_level_values(0) else pd.DataFrame()
        pp = pop.xs(iso) if iso in pop.index.get_level_values(0) else pd.Series(dtype=float)
        st = {k: {'E': 0.0, 'dur': 0, 'cumd': 0.0, 'since': 99} for k in ['inter', 'civil', 'interv']}
        for y in range(y0, y1 + 1):
            r = sub.loc[y] if y in sub.index else None
            px = pp.get(y, np.nan)
            row = {'iso3': iso, 'year': y}
            for k, s in st.items():
                at = r is not None and r.get(k, 0) == 1
                if at:
                    d = r.get(f'd_{k}', np.nan)
                    dpk = d / px if (px > 0 and d == d) else np.nan
                    s['E'] = min(100.0, s['E'] + WAR_YEAR * r.get(f'n_{k}', 1) + kappa * (dpk if dpk == dpk else 0.0))
                    s['dur'] = s['dur'] + 1 if s['since'] == 0 else 1
                    s['cumd'] = (s['cumd'] if s['since'] == 0 else 0.0) + (dpk if dpk == dpk else 0.0)
                    s['since'] = 0
                    row[f'dknown_{k}'] = int(dpk == dpk)
                    row[f'dpk_{k}'] = dpk
                else:
                    s['E'] = max(0.0, s['E'] - PEACE_YEAR)
                    s['since'] = s['since'] + 1 if s['since'] < 99 else 99
                row[f'E_{k}'] = s['E']
                row[f'dur_{k}'] = s['dur'] if at else 0
                row[f'cumd_{k}'] = s['cumd'] if at else 0.0
                row[f'post_{k}'] = s['since'] if 1 <= s['since'] <= 5 else 0
            rows.append(row)
    e = pd.DataFrame(rows)
    return e


# ---------------------------------------------------------------- 財政

def pick_sector(d, prefer, cols):
    """国ごとに、観測の多い政府の範囲を 1 つだけ選ぶ (同じ系列の中で定義を混ぜない)。同数なら prefer の順"""
    cnt = d[d['indicator'].isin(cols)].groupby(['iso3', 'sector']).size().reset_index(name='n')
    cnt['rank'] = cnt['sector'].map({s: i for i, s in enumerate(prefer)})
    cnt = cnt.sort_values(['iso3', 'n', 'rank'], ascending=[True, False, True]).drop_duplicates('iso3')
    keep = set(zip(cnt['iso3'], cnt['sector']))
    d = d[[(a, b) in keep for a, b in zip(d['iso3'], d['sector'])]]
    return d, dict(zip(cnt['iso3'], cnt['sector']))


def jst_panel():
    j = pd.read_excel(os.path.join(FISC, 'JSTdatasetR6.xlsx'))
    j = j.rename(columns={'iso': 'iso3'})[['iso3', 'year', 'revenue', 'expenditure', 'gdp', 'rgdpmad', 'pop', 'cpi', 'xrusd']]
    j = j.sort_values(['iso3', 'year'])
    j['rev_jst'] = 100 * j['revenue'] / j['gdp']
    j['exp_jst'] = 100 * j['expenditure'] / j['gdp']
    j['rgdp_jst'] = j['rgdpmad'] * j['pop']
    j['infl_jst'] = 100 * (j['cpi'] / j.groupby('iso3')['cpi'].shift(1) - 1)
    j.loc[j['year'] != j.groupby('iso3')['year'].shift(1) + 1, 'infl_jst'] = np.nan
    # 軍事費: COW NMC の milex (1913 年まで千英ポンド、1914 年から千米ドル) を、JST の為替 (自国通貨 ÷ 米ドル) で自国通貨にする。
    # JST の GDP の単位 (十億か百万か) は国で違うので、1960〜2016 年の WDI の軍事費 ÷ GDP と比べて 10 の累乗の倍率を国ごとに決める
    inv = {v: k for k, v in COW2ISO.items() if v in set(j['iso3']) and k not in (260, 300)}
    n = pd.read_csv(gz('cow_nmc60.csv.gz'))
    n = n[n['ccode'].isin(inv.values())]
    n['iso3'] = n['ccode'].map({v: k for k, v in inv.items()})
    n['milex'] = n['milex'].astype(float).where(n['milex'] >= 0)
    j = j.merge(n[['iso3', 'year', 'milex', 'milper', 'tpop']], on=['iso3', 'year'], how='left')
    gbp = j[j['iso3'] == 'GBR'].set_index('year')['xrusd']
    usd = np.where(j['year'] < 1914, j['milex'] / j['year'].map(gbp), j['milex'])
    raw = 100 * usd * 1e3 * j['xrusd'] / 1e9 / j['gdp']
    w = pd.read_csv(gz('wdi_warfiscal.csv.gz'))
    w = w[w['indicator'] == 'MS.MIL.XPND.GD.ZS'].set_index(['iso3', 'year'])['value']
    k = {}
    for iso in j['iso3'].unique():
        m = (j['iso3'] == iso) & (j['year'] >= 1960)
        r = pd.Series(raw[m].to_numpy(), index=j.loc[m, 'year']).where(lambda s: s > 0)
        ww = w.xs(iso) if iso in w.index.get_level_values(0) else pd.Series(dtype=float)
        ratio = (ww / r.reindex(ww.index)).dropna()
        k[iso] = int(np.round(np.log10(ratio.median()))) if len(ratio) >= 10 else None
    j['mil_jst'] = raw * j['iso3'].map(lambda i: 10.0 ** k[i] if k.get(i) is not None else np.nan)
    j['nonmil_jst'] = j['exp_jst'] - j['mil_jst']
    j['mob_jst'] = 100 * j['milper'] / j['tpop']
    return j[['iso3', 'year', 'rev_jst', 'exp_jst', 'rgdp_jst', 'infl_jst', 'mil_jst', 'nonmil_jst', 'mob_jst']], k


def fiscal():
    f = pd.read_csv(gz('imf_fpp.csv.gz')).rename(columns={'rev': 'rev_fpp', 'exp': 'exp_fpp', 'prim_exp': 'pexp_fpp', 'ie': 'int_fpp', 'd': 'debt_fpp'})
    m = pd.read_csv(gz('mpd2023.csv.gz')).rename(columns={'countrycode': 'iso3'})
    m['rgdp_mpd'] = m['gdppc'] * m['pop']
    m = m.rename(columns={'gdppc': 'gdppc_mpd', 'pop': 'pop_mpd'})
    j, jk = jst_panel()
    wo = pd.read_csv(gz('imf_world.csv.gz'))
    wo, wsec = pick_sector(wo, ['S13', 'S1311MIXED'], ['G1_POGDP_PT_R'])
    wo = wo.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').rename(
        columns={'G1_POGDP_PT_R': 'rev_world', 'G11_POGDP_PT_R': 'tax_world', 'G13_POGDP_PT_R': 'grants_world'}).reset_index()
    wo['revx_world'] = wo['rev_world'] - wo['grants_world']
    co = pd.read_csv(gz('imf_cofog.csv.gz'))
    co, csec = pick_sector(co, ['S13', 'S1311', 'S1311B'], ['GF07_T', 'GF10_T'])
    co = co.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').rename(
        columns={'GF07_T': 'health_cofog', 'GF10_T': 'social_cofog', 'GF1020_T': 'oldage_cofog', 'GF02_T': 'def_cofog', 'TOTOUT_T': 'out_cofog'}).reset_index()
    wd = pd.read_csv(gz('wdi_warfiscal.csv.gz'))
    wd = wd.pivot_table(index=['iso3', 'year'], columns='indicator', values='value').rename(
        columns={'SH.XPD.GHED.GD.ZS': 'health_ghed', 'MS.MIL.XPND.GD.ZS': 'mil_wdi', 'GC.TAX.TOTL.GD.ZS': 'tax_wdi', 'GC.REV.XGRT.GD.ZS': 'rev_wdi',
                 'NY.GDP.PCAP.KD': 'gdppc_wdi', 'SP.POP.TOTL': 'pop_wdi', 'FP.CPI.TOTL.ZG': 'cpi_wdi', 'NY.GDP.DEFL.KD.ZG': 'defl_wdi'}).reset_index()
    p = f.merge(m, on=['iso3', 'year'], how='outer')
    for d in [j, wo, co, wd]:
        p = p.merge(d, on=['iso3', 'year'], how='outer')
    p = p[(p['year'] >= 1816) & (p['year'] <= 2025)].sort_values(['iso3', 'year']).reset_index(drop=True)
    # 物価の上昇率: JST の CPI、なければ WDI の CPI と GDP デフレーターの大きい方
    p['infl'] = p['infl_jst'].combine_first(p[['cpi_wdi', 'defl_wdi']].max(axis=1, skipna=True))
    hyper = p['infl'] > HYPER
    for iso, spans in HYPER_LIST.items():
        for a, b in spans:
            hyper |= (p['iso3'] == iso) & p['year'].between(a, b) & p['infl'].isna()
    nxt = hyper.groupby(p['iso3']).shift(1, fill_value=False) & (p['year'] == p.groupby('iso3')['year'].shift(1) + 1)
    p['hyper'] = hyper | nxt
    return p, {'world_sector': wsec, 'cofog_sector': csec, 'jst_milex_pow10': jk}


# ---------------------------------------------------------------- 推定の道具

def rng_for(name):
    """名前ごとに決まった乱数 (呼ぶ順番によらず同じ結果)"""
    return np.random.default_rng([SEED, sum((i + 1) * b for i, b in enumerate(name.encode()))])


class Groups:
    """群ごとの (重み付きの) 平均を、並べ替えと reduceat でまとめて求める"""
    def __init__(self, g, w):
        self.order = np.argsort(g, kind='stable')
        gs = g[self.order]
        self.starts = np.r_[0, np.flatnonzero(np.diff(gs)) + 1]
        self.size = np.diff(np.r_[self.starts, len(g)])
        self.w = w[self.order]
        self.wsum = np.add.reduceat(self.w, self.starts)

    def mean(self, M):
        s = np.add.reduceat(M[self.order] * self.w[:, None], self.starts, axis=0) / self.wsum[:, None]
        out = np.empty_like(M)
        out[self.order] = np.repeat(s, self.size, axis=0)
        return out


def _demean_fast(M, g1, g2, tol, maxit):
    """重みなしの速い道: 系列の順に並べたまま平均を引き、年の平均だけ並べ替えて求める"""
    o1 = np.argsort(g1, kind='stable')
    A = M[o1]
    a, b = g1[o1], g2[o1]
    st1 = np.r_[0, np.flatnonzero(np.diff(a)) + 1]
    n1 = np.diff(np.r_[st1, len(a)])
    o2 = np.argsort(b, kind='stable')
    bs = b[o2]
    st2 = np.r_[0, np.flatnonzero(np.diff(bs)) + 1]
    n2 = np.diff(np.r_[st2, len(bs)])
    inv2 = np.empty_like(o2)
    inv2[o2] = np.arange(len(o2))

    def m1(X):
        return np.repeat(np.add.reduceat(X, st1, axis=0) / n1[:, None], n1, axis=0)

    def m2(X):
        return np.repeat(np.add.reduceat(X[o2], st2, axis=0) / n2[:, None], n2, axis=0)[inv2]
    A = A - m1(A)
    for _ in range(maxit):
        d = m2(A)
        A -= d
        d1 = m1(A)
        A -= d1
        if max(np.abs(d).max(), np.abs(d1).max()) < tol:
            break
    out = np.empty_like(A)
    out[o1] = A
    return out


def demean(M, g1, g2, w=None, trend=None, tol=1e-8, maxit=3000):
    """2 つの固定効果を交互の射影で除く (重み w があれば重み付き)。trend (年) を渡すと、系列ごとの直線の傾きも除く"""
    if w is None and trend is None:
        return _demean_fast(np.asarray(M, float), g1, g2, tol, maxit)
    w = np.ones(len(M)) if w is None else w
    G1, G2 = Groups(g1, w), Groups(g2, w)
    if trend is None:
        P1 = G1.mean
    else:
        tc = (trend - G1.mean(trend[:, None].astype(float))[:, 0])[:, None]
        tt = G1.mean(tc ** 2)
        tt[tt < 1e-12] = np.inf

        def P1(A):
            return G1.mean(A) + tc * G1.mean(tc * A) / tt
    M = M - P1(M)
    for _ in range(maxit):
        d = G2.mean(M)
        M = M - d
        d1 = P1(M)
        M = M - d1
        if max(np.abs(d).max(), np.abs(d1).max()) < tol:
            break
    return M


def fe_ols(y, X, g1, g2, w=None, trend=None):
    """固定効果を除いた (重み付き) 最小二乗。係数・残差・除いたあとの X"""
    M = demean(np.column_stack([y, X]), g1, g2, w, trend)
    yt, Xt = M[:, 0], M[:, 1:]
    sw = np.ones(len(y)) if w is None else np.sqrt(w)
    ok = np.sqrt((Xt ** 2).sum(0)) > 1e-8
    b = np.full(X.shape[1], np.nan)
    if ok.any():
        A = Xt[:, ok] * sw[:, None]
        sv = np.linalg.svd(A / np.linalg.norm(A, axis=0), compute_uv=False)
        if sv.min() < 1e-7 * sv.max():  # 説明変数が (ほぼ) 一次従属: 係数が定まらないので欠けにする (ブートストラップの引き直しで起きる)
            return b, yt.copy(), Xt
        b[ok] = np.linalg.lstsq(A, yt * sw, rcond=None)[0]
    r = yt - Xt[:, ok] @ b[ok]
    return b, r, Xt


def codes(*cols):
    """列の組から 0 始まりの番号"""
    k = pd.MultiIndex.from_arrays(cols) if len(cols) > 1 else pd.Index(cols[0])
    return pd.factorize(k)[0]


def _boot_chunk(args):
    y, X, g1, g2, cl, seed, n, trend = args
    rng = np.random.default_rng(seed)
    cu, cinv = np.unique(cl, return_inverse=True)
    idx_by = [np.flatnonzero(cinv == i) for i in range(len(cu))]
    G = len(cu)
    out = np.full((n, X.shape[1]), np.nan)
    for b in range(n):
        draw = rng.integers(0, G, G)
        idx = np.concatenate([idx_by[c] for c in draw])
        copy = np.concatenate([np.full(len(idx_by[c]), j) for j, c in enumerate(draw)])
        out[b] = fe_ols(y[idx], X[idx], g1[idx] + copy * (g1.max() + 1), g2[idx], trend=None if trend is None else trend[idx])[0]
    return out


POOL = None
CHUNKS = 4


def boot_fe(y, X, g1, g2, cl, name, B=None, trend=None):
    """国を単位にしたペアのクラスター・ブートストラップ。国をそのまま (国の中の系列と年をまとめて) 復元抽出し、
    引いた国の写しごとに系列の固定効果を別にする。B 回を 4 つに分け、名前から決まる種で回す (並列でも同じ結果)"""
    B = B or BOOT
    seeds = np.random.SeedSequence([SEED, sum((i + 1) * b for i, b in enumerate(name.encode()))]).spawn(CHUNKS)
    sizes = [B // CHUNKS + (1 if i < B % CHUNKS else 0) for i in range(CHUNKS)]
    jobs = [(y, X, g1, g2, cl, seeds[i], sizes[i], trend) for i in range(CHUNKS)]
    parts = POOL.map(_boot_chunk, jobs) if POOL is not None else [_boot_chunk(j) for j in jobs]
    return np.vstack(parts)


def summarize(b, draws, names, scale=1.0):
    res = {}
    for i, nm in enumerate(names):
        d = draws[:, i]
        d = d[np.isfinite(d)]
        if not np.isfinite(b[i]) or len(d) < 0.5 * len(draws):
            res[nm] = {'coef': None, 'ci95': None, 'se': None, 'p_boot': None, 'boot_ok': int(len(d))}
            continue
        lo, hi = np.percentile(d, [2.5, 97.5])
        # 両側の p 値: 0 をまたぐ側の割合 × 2 (ブートストラップの分布から)
        p = min(1.0, 2 * min((d <= 0).mean(), (d >= 0).mean()))
        res[nm] = {'coef': round(float(b[i]) * scale, 4), 'ci95': [round(float(lo) * scale, 4), round(float(hi) * scale, 4)],
                   'se': round(float(d.std(ddof=1)) * scale, 4), 'p_boot': round(float(p), 4), 'boot_ok': int(len(d))}
    return res


def huber_fe(y, X, g1, g2, c=1.345, maxit=100):
    """Huber の IRLS (固定効果つき)。尺度は残差の MAD"""
    w = np.ones(len(y))
    for _ in range(maxit):
        b, r, _ = fe_ols(y, X, g1, g2, w)
        s = 1.4826 * np.median(np.abs(r - np.median(r)))
        u = r / s
        wn = np.minimum(1.0, c / np.maximum(np.abs(u), 1e-12))
        if np.abs(wn - w).max() < 1e-6:
            w = wn
            break
        w = wn
    return b, r, s, w


def cooks(y, X, g1, g2):
    """最小二乗 (固定効果つき) の Cook の距離。固定効果のてこ比は 1/T_系列 + 1/N_年 − 1/n で近似する (つり合った表なら正確)"""
    b, r, Xt = fe_ols(y, X, g1, g2)
    ok = np.sqrt((Xt ** 2).sum(0)) > 1e-8
    Xo = Xt[:, ok]
    hx = np.einsum('ij,jk,ik->i', Xo, np.linalg.pinv(Xo.T @ Xo), Xo)
    n = len(y)
    n1 = np.bincount(g1)[g1]
    n2 = np.bincount(g2)[g2]
    h = np.clip(hx + 1 / n1 + 1 / n2 - 1 / n, 0, 0.999)
    p = ok.sum() + g1.max() + 1 + g2.max()
    s2 = (r @ r) / max(n - p, 1)
    return (r ** 2 / (p * s2)) * h / (1 - h) ** 2, p


# ---------------------------------------------------------------- 表を組む

KINDS = ['inter', 'civil', 'interv', 'inter_minor', 'civil_minor', 'colonial']


def mobilization():
    """兵員 ÷ 人口 (%)。COW NMC"""
    n = pd.read_csv(gz('cow_nmc60.csv.gz'))
    n = n[(n['milper'] >= 0) & (n['tpop'] > 0)]
    n['iso3'] = n['ccode'].map(COW2ISO)
    n['mob'] = 100 * n['milper'] / n['tpop']
    return n.dropna(subset=['iso3']).groupby(['iso3', 'year'])['mob'].max()


def episodes(wf, kind):
    """種類ごとの戦争のエピソード (続いた年の連なり)。開戦の前 PRE 年に同じ種類の戦争がなく、前 3 年に国家間戦争も内戦もないものを「きれいな開戦」とする"""
    out = []
    for iso, g in wf.groupby('iso3'):
        g = g.set_index('year')
        at = g[kind]
        ys = sorted(at[at == 1].index)
        runs, cur = [], []
        for y in ys:
            if cur and y == cur[-1] + 1:
                cur.append(y)
            else:
                if cur:
                    runs.append(cur)
                cur = [y]
        if cur:
            runs.append(cur)
        for r in runs:
            t0, t1 = r[0], r[-1]
            pre = [g[kind].get(y, 0) for y in range(t0 - PRE, t0)]
            major = [g['inter'].get(y, 0) + g['civil'].get(y, 0) for y in range(t0 - 3, t0)]
            post = [g[kind].get(y, 0) for y in range(t1 + 1, t1 + 6)]
            oc = g.loc[t0:t1, 'outcome'].dropna() if 'outcome' in g else pd.Series(dtype=float)
            out.append({'iso3': iso, 'onset': int(t0), 'end': int(t1), 'years': len(r), 'clean_onset': sum(pre) == 0 and sum(major) == 0,
                        'clean_end': sum(post) == 0, 'outcome': int(oc.iloc[-1]) if len(oc) else None,
                        'cumd': float(g.loc[t0:t1, f'dpk_{kind}'].fillna(0).sum()) if f'dpk_{kind}' in g and kind in ('inter', 'civil', 'interv') else None,
                        'dknown': bool(g.loc[t0:t1, f'dknown_{kind}'].fillna(0).all()) if f'dknown_{kind}' in g else False,
                        'mob_peak': float(g.loc[t0:t1, 'mob'].max()) if 'mob' in g and g.loc[t0:t1, 'mob'].notna().any() else None,
                        'E_end': float(g.loc[t1, f'E_{kind}']) if f'E_{kind}' in g else None})
    return pd.DataFrame(out)


def build():
    rec = war_records()
    w = war_panel(rec)
    pop = population()
    e = e_proxy(w, pop)
    # κ の感度: 死者の重みを変えた E (κ = 0 は戦争の年数だけ)
    for kap in KAPPAS:
        ek = e_proxy(w, pop, kappa=kap)
        for k in ['inter', 'civil', 'interv']:
            e[f'E_{k}_k{kap:g}'] = ek[f'E_{k}'].to_numpy()
    p, meta = fiscal()
    wf = e.merge(w[['iso3', 'year', *KINDS, 'outcome']], on=['iso3', 'year'], how='left')
    for k in KINDS:
        wf[k] = wf[k].fillna(0).astype(int)
    wf = wf.merge(mobilization().rename('mob').reset_index(), on=['iso3', 'year'], how='left')
    wf['pop'] = [pop.get((i, y), np.nan) for i, y in zip(wf['iso3'], wf['year'])]
    # 国家間戦争の属性 (結果・総動員・死者) を、そのエピソードの年と、終わってからの E が残る年に付ける
    ep = episodes(wf, 'inter')
    wf['last_outcome'], wf['last_mob'], wf['last_cumd'], wf['last_dknown'] = np.nan, np.nan, np.nan, np.nan
    wf = wf.set_index(['iso3', 'year'])
    for r in ep.itertuples():
        stop = r.end + 20
        nxt = ep[(ep['iso3'] == r.iso3) & (ep['onset'] > r.end)]
        if len(nxt):
            stop = min(stop, nxt['onset'].min() - 1)
        idx = [(r.iso3, y) for y in range(r.onset, stop + 1) if (r.iso3, y) in wf.index]
        wf.loc[idx, 'last_outcome'] = r.outcome if r.outcome is not None else np.nan
        wf.loc[idx, 'last_mob'] = r.mob_peak if r.mob_peak is not None else np.nan
        wf.loc[idx, 'last_cumd'] = r.cumd
        wf.loc[idx, 'last_dknown'] = float(r.dknown)
    wf = wf.reset_index()
    d = p.merge(wf, on=['iso3', 'year'], how='left')
    for k in KINDS:
        d[k] = d[k].fillna(0).astype(int)
    for c in [c for c in d.columns if c.startswith(('E_', 'dur_', 'cumd_', 'post_'))]:
        d[c] = d[c].fillna(0.0)
    d['anywar'] = (d[KINDS].sum(axis=1) > 0).astype(int)
    wf['anywar'] = (wf[KINDS].sum(axis=1) > 0).astype(int)
    return d, wf, rec, meta


def regressors(d, model):
    """モデルごとの説明変数 (列名の一覧) を d に作って返す"""
    X = {}
    if model == 'status':
        for k in ['inter', 'civil', 'interv']:
            X[k] = d[k]
            X[f'post_{k}'] = ((d[f'post_{k}'] >= 1) & (d[k] == 0)).astype(int)
    elif model == 'dose':
        for k in ['inter', 'civil']:
            X[k] = d[k]
            X[f'dur_{k}'] = np.minimum(d[f'dur_{k}'], 10)
            X[f'cumd_{k}'] = d[f'cumd_{k}']
            X[f'post_{k}'] = ((d[f'post_{k}'] >= 1) & (d[k] == 0)).astype(int)
        X['interv'] = d['interv']
    elif model == 'E_lin':
        for k in ['inter', 'civil', 'interv']:
            X[f'E_{k}'] = d[f'E_{k}']
    elif model == 'E_bin':
        for k in ['inter', 'civil']:
            for i in range(len(E_BINS) - 1):
                X[f'E_{k}_{E_BINS[i]:g}_{E_BINS[i + 1]:.0f}'] = ((d[f'E_{k}'] > E_BINS[i]) & (d[f'E_{k}'] <= E_BINS[i + 1])).astype(int)
        X['E_interv'] = d['E_interv']
    elif model.startswith('E_split:'):
        # E_inter を属性で分ける (時代・勝ち負け・強さ)
        how = model.split(':')[1]
        E = d['E_inter']
        if how == 'era':
            parts = {'pre1946': d['year'] <= 1945, 'post1945': d['year'] > 1945}
        elif how == 'outcome':
            parts = {'winner': d['last_outcome'] == 1, 'loser': d['last_outcome'] == 2, 'other_or_unknown': ~d['last_outcome'].isin([1, 2])}
        elif how == 'mobilization':
            parts = {'mass_mob_ge2pct': d['last_mob'] >= 2, 'limited_mob': ~(d['last_mob'] >= 2)}
        elif how == 'deaths':
            parts = {'deaths_ge1_per_1000': d['last_cumd'] >= 1, 'deaths_lt1_per_1000': ~(d['last_cumd'] >= 1)}
        for nm, m in parts.items():
            X[f'E_inter_{nm}'] = E * m.astype(float)
        X['E_civil'] = d['E_civil']
        X['E_interv'] = d['E_interv']
    for k in ['inter_minor', 'civil_minor', 'colonial']:
        X[k] = d[k]
    return pd.DataFrame(X, index=d.index).astype(float)


# ---------------------------------------------------------------- 出来事の分析 (開戦・終戦の前後の差の差)

def chi2_sf(x, k):
    """χ² 分布の上側の確率 (自由度は整数)"""
    if k <= 0 or not np.isfinite(x):
        return None
    if k % 2 == 0:
        s, t = 0.0, 1.0
        for j in range(k // 2):
            if j > 0:
                t *= (x / 2) / j
            s += t
        return math.exp(-x / 2) * s
    p = math.erfc(math.sqrt(x / 2))
    if k > 1:
        t = math.sqrt(2 * x / math.pi) * math.exp(-x / 2)
        s = t
        for j in range(1, (k - 1) // 2):
            t *= x / (2 * j + 1)
            s += t
        p += s
    return p


class Grid:
    """国 × 年の表 (結果と、戦争のない年か)"""
    def __init__(self, sample, wf, y0=1816, y1=2025):
        self.y0, self.y1 = y0, y1
        self.isos = sorted(set(sample['iso3']))
        self.idx = {c: i for i, c in enumerate(self.isos)}
        I, T = len(self.isos), y1 - y0 + 1
        self.Y = np.full((I, T), np.nan)
        self.Y[[self.idx[c] for c in sample['iso3']], (sample['year'] - y0).to_numpy()] = sample['y'].to_numpy()
        aw = np.zeros((I, T))
        w = wf[wf['iso3'].isin(self.idx) & wf['year'].between(y0, y1)]
        aw[[self.idx[c] for c in w['iso3']], (w['year'] - y0).to_numpy()] = w['anywar'].to_numpy()
        self.cum = np.concatenate([np.zeros((I, 1)), np.cumsum(aw, 1)], 1)

    def col(self, y):
        return y - self.y0 if self.y0 <= y <= self.y1 else None

    def clean(self, a, b):
        a, b = max(a, self.y0), min(b, self.y1)
        return (self.cum[:, b - self.y0 + 1] - self.cum[:, a - self.y0]) == 0


def _prep(G, events, ks):
    ev = [e for e in events if e['iso3'] in G.idx and G.col(e['base']) is not None and np.isfinite(G.Y[G.idx[e['iso3']], G.col(e['base'])])]
    E, K, I = len(ev), len(ks), len(G.isos)
    ti = np.array([G.idx[e['iso3']] for e in ev], dtype=int)
    dT = np.full((E, K), np.nan)
    Dc = np.full((E, I, K), np.nan)
    for n, e in enumerate(ev):
        i, cb = ti[n], G.col(e['base'])
        yb = G.Y[:, cb]
        ctrl = G.clean(*e['win']) & np.isfinite(yb)
        ctrl[i] = False
        for j, k in enumerate(ks):
            c = G.col(e['ref'] + k)
            if c is None:
                continue
            dT[n, j] = G.Y[i, c] - yb[i]
            Dc[n, ctrl, j] = G.Y[ctrl, c] - yb[ctrl]
    F = np.isfinite(Dc).astype(float)
    return ev, ti, dT, np.where(F > 0, Dc, 0.0), F


def _est(ti, dT, D0, F, wts):
    num = np.einsum('eik,i->ek', D0, wts)
    den = np.einsum('eik,i->ek', F, wts)
    cm = np.where(den > 0, num / np.where(den > 0, den, 1), np.nan)
    did = dT - cm
    ok = np.isfinite(did)
    we = wts[ti][:, None] * ok
    sw = we.sum(0)
    b = np.where(sw > 0, (np.where(ok, did, 0) * we).sum(0) / np.where(sw > 0, sw, 1), np.nan)
    return b, did


def did_point(G, events, ks):
    ev, ti, dT, D0, F = _prep(G, events, ks)
    if not ev:
        return ev, np.empty((0, len(ks)))
    return ev, _est(ti, dT, D0, F, np.ones(len(G.isos)))[1]


def event_study(G, events, ks, name, B=None):
    """events: iso3・ref (出来事の年)・base (基準の年)・win (対照が戦争をしていない期間)。
    エピソードごとに (処置の国の変化 − 対照の国の変化の平均) を出し、エピソードで平均する。信頼区間は国の復元抽出"""
    B = B or BOOT
    ev, ti, dT, D0, F = _prep(G, events, ks)
    K, I = len(ks), len(G.isos)
    if not ev:
        return None
    b, did = _est(ti, dT, D0, F, np.ones(I))
    rng = rng_for('es:' + name)
    draws = np.empty((B, K))
    for r in range(B):
        draws[r] = _est(ti, dT, D0, F, np.bincount(rng.integers(0, I, I), minlength=I).astype(float))[0]
    okk = np.isfinite(did)
    res = {'episodes': len(ev), 'countries': int(len(set(ti.tolist()))), 'k': {}}
    for j, k in enumerate(ks):
        d = draws[:, j][np.isfinite(draws[:, j])]
        res['k'][str(k)] = {'coef': None if not np.isfinite(b[j]) else round(float(b[j]), 3),
                            'ci95': None if len(d) < B / 2 else [round(float(x), 3) for x in np.percentile(d, [2.5, 97.5])],
                            'n_episodes': int(okk[:, j].sum())}
    pre = [j for j, k in enumerate(ks) if k <= -2 and np.isfinite(b[j]) and okk[:, j].sum() >= 3]
    good = np.isfinite(draws[:, pre]).all(1) if pre else None
    if pre and good.sum() > len(pre) + 10:
        V = np.atleast_2d(np.cov(draws[good][:, pre].T))
        bb = b[pre]
        W = float(bb @ np.linalg.pinv(V) @ bb)
        res['pretrend_wald'] = {'k': [ks[j] for j in pre], 'chi2': round(W, 3), 'df': len(pre), 'p': round(chi2_sf(W, len(pre)), 4)}
    for nm, lo, hi in [('avg_0_5', 0, 5), ('avg_6_8', 6, 8)]:
        js = [j for j, k in enumerate(ks) if lo <= k <= hi and np.isfinite(b[j])]
        if js:
            m = np.nanmean(draws[:, js], 1)
            res[nm] = {'coef': round(float(np.mean(b[js])), 3), 'ci95': [round(float(x), 3) for x in np.nanpercentile(m, [2.5, 97.5])]}
    return res


def onset_events(ep, kind_filter=None):
    ev = []
    for r in ep.itertuples():
        if not r.clean_onset:
            continue
        ev.append({'iso3': r.iso3, 'ref': r.onset, 'base': r.onset - 1, 'win': (r.onset - PRE, r.onset + POST), 'outcome': r.outcome,
                   'end': r.end, 'cumd': r.cumd, 'mob': r.mob_peak})
    return ev


def end_events(ep):
    ev = []
    for r in ep.itertuples():
        if not r.clean_end:
            continue
        ev.append({'iso3': r.iso3, 'ref': r.end, 'base': r.onset - 1, 'win': (min(r.onset - 1, r.end - 3), r.end + POST), 'outcome': r.outcome,
                   'onset': r.onset, 'cumd': r.cumd, 'mob': r.mob_peak})
    return ev


def placebo_slopes(G):
    """平和な国・年を開戦に見立てたときの、前 5 年の傾き (差の差) の分布"""
    ks = np.arange(-PRE, 0, dtype=float)
    out = []
    for T in range(G.y0 + PRE, G.y1 - POST + 1):
        yb = G.Y[:, G.col(T - 1)]
        ctrl = G.clean(T - PRE, T + POST) & np.isfinite(yb)
        unit = G.clean(T - PRE, T) & np.isfinite(yb)
        if ctrl.sum() < 3 or unit.sum() == 0:
            continue
        Yk = np.column_stack([G.Y[:, G.col(T + int(k))] - yb for k in ks])
        with np.errstate(all='ignore'), warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)
            cm = np.nanmean(np.where(ctrl[:, None], Yk, np.nan), 0)
        out.append(slopes(Yk[unit] - cm, ks))
    s = np.concatenate(out) if out else np.empty(0)
    return s[np.isfinite(s)]


def slopes(D, ks):
    """行ごとに、使える点 (3 点以上) で D を ks に回帰した傾き"""
    ok = np.isfinite(D)
    n = ok.sum(1)
    kk = np.where(ok, ks[None, :], 0.0)
    km = kk.sum(1) / np.maximum(n, 1)
    dm = np.where(ok, D, 0).sum(1) / np.maximum(n, 1)
    sxx = (np.where(ok, (ks[None, :] - km[:, None]) ** 2, 0)).sum(1)
    sxy = (np.where(ok, (ks[None, :] - km[:, None]) * (np.where(ok, D, 0) - dm[:, None]), 0)).sum(1)
    return np.where((n >= 3) & (sxx > 0), sxy / np.where(sxx > 0, sxx, 1), np.nan)


# ---------------------------------------------------------------- 結果の変数と、標本の選び方

# 名前・GDP 比の列 (切れ目の判定に使う)・変数の形・掛ける列・切れ目の幅・説明
OUTCOMES = [
    ('rev_fpp', 'rev_fpp', 'log', None, BREAK_PP, '歳入 ÷ GDP (IMF FPP)'),
    ('rrev_fpp', 'rev_fpp', 'log_real', 'rgdp_mpd', BREAK_PP, '実質の歳入 (FPP の歳入 ÷ GDP × Maddison の実質 GDP)'),
    ('gdp_fpp', 'rev_fpp', 'log_level', 'rgdp_mpd', BREAK_PP, '実質 GDP (Maddison。歳入の標本と同じ国・年)'),
    ('exp_fpp', 'exp_fpp', 'log', None, BREAK_PP, '歳出 ÷ GDP (FPP)'),
    ('pexp_fpp', 'pexp_fpp', 'log', None, BREAK_PP, '利払いを除く歳出 ÷ GDP (FPP)'),
    ('debt_fpp', 'debt_fpp', 'level', None, 50.0, '政府債務 ÷ GDP (FPP、ポイント)'),
    ('rev_jst', 'rev_jst', 'log', None, BREAK_PP, '歳入 ÷ GDP (JST、18 か国の中央政府)'),
    ('rrev_jst', 'rev_jst', 'log_real', 'rgdp_jst', BREAK_PP, '実質の歳入 (JST)'),
    ('exp_jst', 'exp_jst', 'log', None, BREAK_PP, '歳出 ÷ GDP (JST)'),
    ('nonmil_jst', 'nonmil_jst', 'log', None, BREAK_PP, '軍事費を除く歳出 ÷ GDP (JST − COW NMC の軍事費)'),
    ('tax_world', 'tax_world', 'log', None, BREAK_PP, '税収 ÷ GDP (IMF WoRLD、1980 年〜)'),
    ('rev_world', 'rev_world', 'log', None, BREAK_PP, '歳入 ÷ GDP (WoRLD)'),
    ('revx_world', 'revx_world', 'log', None, BREAK_PP, '贈与を除く歳入 ÷ GDP (WoRLD)'),
    ('health_cofog', 'health_cofog', 'log', None, 'log', '公的な保健支出 ÷ GDP (IMF COFOG)'),
    ('rhealth_cofog', 'health_cofog', 'log_real', 'gdppc_wdi', 'log', '1 人あたり実質の公的な保健支出 (COFOG × WDI)'),
    ('social_cofog', 'social_cofog', 'log', None, 'log', '社会保護の支出 ÷ GDP (COFOG)'),
    ('rsocial_cofog', 'social_cofog', 'log_real', 'gdppc_wdi', 'log', '1 人あたり実質の社会保護の支出 (COFOG × WDI)'),
    ('oldage_cofog', 'oldage_cofog', 'log', None, 'log', '老齢 (年金) の支出 ÷ GDP (COFOG)'),
    ('roldage_cofog', 'oldage_cofog', 'log_real', 'gdppc_wdi', 'log', '1 人あたり実質の老齢 (年金) の支出 (COFOG × WDI)'),
    ('def_cofog', 'def_cofog', 'log', None, 'log', '防衛の支出 ÷ GDP (COFOG)'),
    ('health_ghed', 'health_ghed', 'log', None, 'log', '政府の保健支出 ÷ GDP (WDI、WHO GHED、2000 年〜)'),
    ('rhealth_ghed', 'health_ghed', 'log_real', 'gdppc_wdi', 'log', '1 人あたり実質の政府の保健支出 (GHED × WDI)'),
    ('mil_wdi', 'mil_wdi', 'level', None, BREAK_PP, '軍事費 ÷ GDP (WDI = SIPRI、ポイント)'),
]
SPEC = {o[0]: o for o in OUTCOMES}


def make_y(d, key):
    _, share, form, extra, _, _ = SPEC[key]
    if form == 'log':
        return 100 * np.log(d[share])
    if form == 'log_real':
        return 100 * np.log(d[share] * d[extra])
    if form == 'log_level':
        return 100 * np.log(d[extra])
    return d[share]


def war_counts(s):
    return {'n': int(len(s)), 'countries': int(s['iso3'].nunique()), **{k: int(s[k].sum()) for k in KINDS}}


def split_spells(s, col, brk):
    """切れ目で系列を分ける。1 年だけ跳ねて戻る年は除く。brk が 'log' なら 100 × ln の値で判定する。
    戻り値: 残す行の印・系列の名前・切れ目の一覧 (国・年・跳び・種類)・跳ねの一覧"""
    keep = np.ones(len(s), bool)
    spell = np.empty(len(s), object)
    breaks, spikes = [], []
    spike_th = SPIKE_PP
    if brk == 'log':
        brk, spike_th = BREAK_LOG, SPIKE_LOG
    for iso, g in s.groupby('iso3', sort=False):
        ix = g.index.to_numpy()
        v, yr = g[col].to_numpy(), g['year'].to_numpy()
        if spike_th == SPIKE_LOG:
            v = 100 * np.log(v)
        pos = {j: n for n, j in enumerate(ix)}
        drop = set()
        for t in range(1, len(v) - 1):
            if yr[t] - yr[t - 1] == 1 and yr[t + 1] - yr[t] == 1:
                d1, d2 = v[t] - v[t - 1], v[t + 1] - v[t]
                if abs(d1) > spike_th and abs(d2) > spike_th and np.sign(d1) != np.sign(d2) and abs(v[t + 1] - v[t - 1]) < min(abs(d1), abs(d2)) / 2:
                    drop.add(t)
                    spikes.append((iso, int(yr[t])))
        sid, prev = 0, None
        for t in range(len(v)):
            if t in drop:
                keep[s.index.get_loc(ix[t])] = False
                continue
            if prev is not None and (yr[t] - yr[prev] > 5 or (yr[t] - yr[prev] == 1 and abs(v[t] - v[prev]) > brk)):
                sid += 1
                breaks.append((iso, int(yr[t]), round(float(v[t] - v[prev]), 2), 'gap' if yr[t] - yr[prev] > 5 else 'jump'))
            spell[s.index.get_loc(ix[t])] = f'{iso}#{sid}'
            prev = t
    return keep, spell, breaks, spikes


def design(s, model, ekey=''):
    """回帰の y・X・固定効果の番号・クラスター"""
    dd = s.copy()
    if ekey:
        for k in ['inter', 'civil', 'interv']:
            dd[f'E_{k}'] = dd[f'E_{k}_{ekey}']
    X = regressors(dd, model)
    X = X.loc[:, X.abs().sum() > 0]
    g1, g2 = codes(s['spell'].to_numpy()), codes(s['year'].to_numpy())
    # 固定効果を除いたあとに一次従属になる列 (例: 戦争がどれも 1 年なら「戦争の年」と「戦争の通算の年数」が同じ) を、前から順に除く
    M = demean(X.to_numpy(float), g1, g2)
    keep = []
    for j in range(M.shape[1]):
        v = M[:, j]
        nv = np.linalg.norm(v)
        if nv < 1e-8:
            continue
        if keep:
            K = M[:, keep]
            res = v - K @ np.linalg.lstsq(K, v, rcond=None)[0]
            if np.linalg.norm(res) < 1e-4 * nv:
                continue
        keep.append(j)
    X = X.iloc[:, keep]
    return s['y'].to_numpy(float), X, g1, g2, s['iso3'].to_numpy()


def fit(s, model, name, ekey='', trend=False, B=None):
    y, X, g1, g2, cl = design(s, model, ekey)
    tr = s['year'].to_numpy(float) if trend else None
    b, r, Xt = fe_ols(y, X.to_numpy(), g1, g2, trend=tr)
    draws = boot_fe(y, X.to_numpy(), g1, g2, cl, name, B, trend=tr)
    coef = summarize(b, draws, list(X.columns))
    cu, ci = np.unique(cl, return_inverse=True)
    for j, c in enumerate(X.columns):
        nz = sorted(set(cl[X[c].to_numpy() != 0]))
        # 実効の国の数: 固定効果を除いたあとの説明変数の変動 (二乗和) を国ごとに分けたときの、ハーフィンダール指数の逆数
        S = np.bincount(ci, weights=Xt[:, j] ** 2, minlength=len(cu))
        neff = float(S.sum() ** 2 / (S ** 2).sum()) if S.sum() > 0 else 0.0
        top = [str(cu[k]) for k in np.argsort(-S)[:3]]
        coef[c].update({'countries': len(nz), 'effective_countries': round(neff, 2), 'top_countries': top,
                        'few_countries': len(nz) < FEW or neff < FEW_EFF})
    return {'n': int(len(y)), 'countries': int(len(set(cl))), 'within_r2': within_r2(y, r, g1, g2, tr), 'coef': coef}, (b, draws, list(X.columns))


def within_r2(y, r, g1, g2, trend=None):
    """固定効果を除いたあとの y の変動のうち、説明変数で説明できた割合"""
    yt = demean(y[:, None], g1, g2, trend=trend)[:, 0]
    return round(float(1 - (r @ r) / (yt @ yt)), 5)


def kappa_profile(s, key):
    """κ を変えたときの、E の直線のモデルの当てはまり (固定効果の内側の R²) と係数 (ブートストラップなし)"""
    out = []
    for kap in [KAPPA] + KAPPAS:
        ekey = '' if kap == KAPPA else f'k{kap:g}'
        y, X, g1, g2, _ = design(s, 'E_lin', ekey)
        b, r, _ = fe_ols(y, X.to_numpy(), g1, g2)
        out.append({'kappa': kap, 'within_r2': within_r2(y, r, g1, g2), 'E_inter': round(float(b[list(X.columns).index('E_inter')]), 4),
                    'E_civil': round(float(b[list(X.columns).index('E_civil')]), 4) if 'E_civil' in X.columns else None})
    return sorted(out, key=lambda o: o['kappa'])


def select(d, wf, eps, key):
    """結果ごとの標本の選び方 (S0〜S5)。各段の国・年の数 (戦争の種類ごと) と、除いたものの一覧"""
    _, share, form, extra, brk, label = SPEC[key]
    funnel, info = [], {}
    s0 = d[d[share].notna()].copy()
    funnel.append(('S0', '候補: GDP 比の値がある国・年', s0))
    m = s0[share].notna() if form == 'level' else s0[share] > 0
    if extra:
        m &= s0[extra] > 0
    s1 = s0[m].copy()
    s1['y'] = make_y(s1, key)
    s1 = s1[np.isfinite(s1['y'])]
    s1 = s1[s1.groupby('iso3')['year'].transform('size') >= MIN_SPELL]
    s1['spell'] = s1['iso3']
    funnel.append(('S1', f'データがそろう (正の値{"・" + extra if extra else ""}・国に {MIN_SPELL} 年以上)', s1))
    s2 = s1[~s1['hyper']].sort_values(['iso3', 'year'])
    funnel.append(('S2', f'物価の上昇率 {HYPER:g}% 超の年とその次の年、価格のデータがない高インフレの年 (Hanke & Krus の一覧) を除く', s2))
    keep, spell, breaks, spikes = split_spells(s2, share, brk)
    s3 = s2[keep].copy()
    s3['spell'] = spell[keep]
    s3 = s3[s3.groupby('spell')['year'].transform('size') >= MIN_SPELL]
    rule = (f'1 年の跳ね (前後とも 100 × ln で {SPIKE_LOG:g} 超、向きが逆で戻る) を除き、100 × ln で {BREAK_LOG:g} 超の跳び' if brk == 'log' else
            f'1 年の跳ね (前後とも {SPIKE_PP:g} ポイント超、向きが逆で戻る) を除き、{brk:g} ポイント超の跳び')
    funnel.append(('S3', rule + f'か 5 年超の欠けで系列を分け、{MIN_SPELL} 年未満の系列を除く', s3))
    ws = s2.set_index(['iso3', 'year'])
    info['breaks'] = {'n': len(breaks), 'in_war_years': [b for b in breaks if ws.loc[(b[0], b[1]), 'anywar'] == 1] if breaks else []}
    info['spikes'] = {'n': len(spikes), 'in_war_years': [x for x in spikes if ws.loc[x, 'anywar'] == 1]}
    # S4: 開戦の前の傾き。平和な国・年を開戦に見立てた傾きの 2.5〜97.5% の外なら、その戦争の前後 (開戦の 5 年前〜終戦の 5 年後) を除く
    G = Grid(s3, wf)
    plac = placebo_slopes(G)
    lo, hi = np.percentile(plac, [2.5, 97.5]) if len(plac) > 50 else (-np.inf, np.inf)
    drop = np.zeros(len(s3), bool)
    rej, tested = [], {}
    ks = np.arange(-PRE, 0, dtype=float)
    for kind in ['inter', 'civil', 'interv']:
        ev, did = did_point(G, onset_events(eps[kind]), list(range(-PRE, 0)))
        sl = slopes(did, ks) if len(ev) else np.empty(0)
        tested[kind] = {'episodes_with_base': len(ev), 'tested': int(np.isfinite(sl).sum())}
        for e, v in zip(ev, sl):
            if np.isfinite(v) and (v < lo or v > hi):
                rej.append({'kind': kind, 'iso3': e['iso3'], 'onset': e['ref'], 'end': e['end'], 'slope': round(float(v), 3)})
                drop |= ((s3['iso3'] == e['iso3']) & s3['year'].between(e['ref'] - PRE, e['end'] + 5)).to_numpy()
    s4 = s3[~drop]
    funnel.append(('S4', '開戦の前 5 年の傾き (差の差) が、平和な国・年を開戦に見立てた傾きの 95% の幅を外れる戦争の前後を除く', s4))
    info['pretrend'] = {'placebo_n': int(len(plac)), 'placebo_slope_95': [round(float(lo), 3), round(float(hi), 3)], 'tested': tested,
                        'rejected': rej}
    # S5: 頑健回帰 (Huber、E の直線のモデル) の |標準化残差| > 3 か、最小二乗の Cook の距離 > 4/n を除く
    y, X, g1, g2, _ = design(s4, 'E_lin')
    hb, hr, hs, hw = huber_fe(y, X.to_numpy(), g1, g2)
    cd, npar = cooks(y, X.to_numpy(), g1, g2)
    out = (np.abs(hr / hs) > 3) | (cd > 4 / len(y))
    s5 = s4[~out]
    s5 = s5[s5.groupby('spell')['year'].transform('size') >= 2]
    funnel.append(('S5', '頑健回帰 (Huber) で |標準化残差| > 3 か Cook の距離 > 4/n の国・年を除く (選んだ標本)', s5))
    hi = s5[s5['E_inter'] > 5].groupby('iso3')['year'].agg(['min', 'max', 'size'])
    info['countries_with_E_inter_gt5'] = {i: {'years': [int(r['min']), int(r['max'])], 'n': int(r['size'])} for i, r in hi.iterrows()}
    rm = s4[out]
    info['outliers'] = {'huber_scale': round(float(hs), 3), 'resid_gt3': int((np.abs(hr / hs) > 3).sum()), 'cooks_gt_4_over_n': int((cd > 4 / len(y)).sum()),
                        'removed_war_years_by_E_inter_bin': {f'{E_BINS[i]:g}-{E_BINS[i + 1]:.0f}': int(((rm['E_inter'] > E_BINS[i]) & (rm['E_inter'] <= E_BINS[i + 1])).sum())
                                                             for i in range(len(E_BINS) - 1)},
                        'huber_coef_E_lin': {c: round(float(v), 4) for c, v in zip(X.columns, hb)}}
    counts = []
    prev = None
    for step, desc, smp in funnel:
        c = war_counts(smp)
        c.update({'step': step, 'rule': desc, 'removed': None if prev is None else prev - c['n']})
        counts.append(c)
        prev = c['n']
    return {'S1': s1, 'S3': s3, 'S4': s4, 'S5': s5}, counts, info


def jsonable(o):
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if not np.isfinite(o) else round(float(o), 6)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


# ---------------------------------------------------------------- まとめ

# status と dose のモデルまで出す結果 (ほかは E の直線と区切りだけ)
MAIN = ['rev_fpp', 'rrev_fpp', 'gdp_fpp', 'rev_jst', 'rrev_jst', 'tax_world', 'revx_world', 'health_cofog', 'rhealth_cofog', 'social_cofog',
        'rsocial_cofog', 'oldage_cofog', 'roldage_cofog', 'health_ghed', 'rhealth_ghed']
# 開戦・終戦の前後を出す結果
ES_OUT = ['rev_fpp', 'rrev_fpp', 'gdp_fpp', 'exp_fpp', 'debt_fpp', 'rev_jst', 'rrev_jst', 'exp_jst', 'nonmil_jst', 'tax_world', 'revx_world',
          'health_cofog', 'social_cofog', 'oldage_cofog', 'def_cofog', 'health_ghed', 'rhealth_ghed', 'mil_wdi']
SUBSETS = {'winner': lambda e: e['outcome'] == 1, 'loser': lambda e: e['outcome'] == 2,
           'mass_mobilization_ge2pct': lambda e: (e['mob'] or 0) >= 2, 'limited_mobilization': lambda e: not ((e['mob'] or 0) >= 2),
           'deaths_ge1_per_1000': lambda e: (e['cumd'] or 0) >= 1, 'deaths_lt1_per_1000': lambda e: not ((e['cumd'] or 0) >= 1)}


def candidates(d):
    """候補: 戦争をしていた国・年のうち、財政のデータがあるもの (データの出どころ × 戦争の種類)"""
    src = {'FPP 歳入': 'rev_fpp', 'JST 歳入': 'rev_jst', 'WoRLD 税収': 'tax_world', 'WoRLD 歳入': 'rev_world', 'COFOG 保健': 'health_cofog',
           'COFOG 社会保護': 'social_cofog', 'COFOG 老齢': 'oldage_cofog', 'GHED 保健': 'health_ghed', 'JST 軍事費を除く歳出': 'nonmil_jst'}
    out = {nm: {k: int(((d[col].notna()) & (d[k] == 1)).sum()) for k in KINDS} for nm, col in src.items()}
    rev_any = d[['rev_fpp', 'rev_jst', 'tax_world', 'rev_world']].notna().any(axis=1)
    out['歳入 (FPP・JST・WoRLD のどれか)'] = {k: int((rev_any & (d[k] == 1)).sum()) for k in KINDS}
    fis_any = d[list(src.values())].notna().any(axis=1)
    out['財政のどれか'] = {k: int((fis_any & (d[k] == 1)).sum()) for k in KINDS}
    for v in out.values():
        v['all_war_years'] = int(sum(v[k] for k in KINDS))
    return out


def events_for(smp, wf, eps, key):
    G5, G3 = Grid(smp['S5'], wf), Grid(smp['S3'], wf)
    on, end = list(range(-PRE, POST + 1)), list(range(-3, POST + 1))
    r = {'inter_onset': event_study(G5, onset_events(eps['inter']), on, f'{key}:inter_onset'),
         'inter_onset_before_pretrend_filter': event_study(G3, onset_events(eps['inter']), on, f'{key}:inter_onset_S3'),
         'inter_end': event_study(G5, end_events(eps['inter']), end, f'{key}:inter_end'),
         'civil_onset': event_study(G5, onset_events(eps['civil']), on, f'{key}:civil_onset'),
         'civil_onset_before_pretrend_filter': event_study(G3, onset_events(eps['civil']), on, f'{key}:civil_onset_S3'),
         'civil_end': event_study(G5, end_events(eps['civil']), end, f'{key}:civil_end'),
         'interv_onset': event_study(G5, onset_events(eps['interv']), on, f'{key}:interv_onset')}
    if key in ('rev_fpp', 'rrev_fpp', 'gdp_fpp', 'rev_jst', 'rrev_jst', 'exp_fpp', 'debt_fpp', 'nonmil_jst'):
        r['inter_onset_by'] = {nm: event_study(G5, [e for e in onset_events(eps['inter']) if f(e)], on, f'{key}:inter_onset:{nm}') for nm, f in SUBSETS.items()}
        r['inter_end_by'] = {nm: event_study(G5, [e for e in end_events(eps['inter']) if f(e)], end, f'{key}:inter_end:{nm}') for nm, f in SUBSETS.items()}
    return r


def pick(res, names):
    return {n: res['coef'].get(n) for n in names if n in res['coef']}


def robustness(smp, key):
    """E の直線のモデルの頑健さ (歳入 ÷ GDP)"""
    s5 = smp['S5']
    E3 = ['E_inter', 'E_civil', 'E_interv']
    rows = []

    def add(name, s, model='E_lin', ekey='', trend=False, note=''):
        res = fit(s, model, f'{key}:rob:{name}', ekey=ekey, trend=trend)[0]
        names = [c for c in res['coef'] if c.startswith('E_')]
        rows.append({'name': name, 'note': note, 'n': res['n'], 'countries': res['countries'], 'within_r2': res['within_r2'], 'war_years_inter': int(s['inter'].sum()),
                     'war_years_civil': int(s['civil'].sum()), 'coef': pick(res, names)})

    add('baseline', s5, note='選んだ標本 (S5)')
    add('no_outlier_removal', smp['S4'], note='頑健回帰で外れ値を除く前 (S4)')
    add('no_pretrend_no_outlier', smp['S3'], note='前の傾きと外れ値で除く前 (S3)')
    add('no_filters_country_fe', smp['S1'], note='選ぶ前 (S1)。系列を分けず国の固定効果')
    ww = s5['year'].between(1914, 1919) | s5['year'].between(1939, 1946)
    add('drop_world_wars', s5[~ww], note='1914〜1919 年と 1939〜1946 年を除く')
    add('pre1946_only', s5[s5['year'] <= 1945], note='1945 年まで')
    add('post1945_only', s5[s5['year'] > 1945], note='1946 年から')
    add('country_trends', s5, trend=True, note='系列ごとの直線の傾きも除く')
    for kap in KAPPAS_BOOT:
        add(f'kappa_{kap:g}', s5, ekey=f'k{kap:g}', note=f'E の死者の重み κ = {kap:g} (基本は {KAPPA:g})')
    for how in ['era', 'outcome', 'mobilization', 'deaths']:
        add(f'split_{how}', s5, model=f'E_split:{how}', note={'era': '国家間戦争の E を 1945 年までと 1946 年からに分ける', 'outcome': 'COW の結果 (勝ち・負け・そのほか) で分ける',
                                                              'mobilization': '兵員 ÷ 人口の最大が 2% 以上 (総動員) か', 'deaths': '戦争の死者が人口 1,000 人あたり 1 人以上か'}[how])
    lv = s5.copy()
    lv['y'] = lv[SPEC[key][1]]
    add('level_pp', lv, note=f'y を GDP 比のポイントのまま (log でなく)。標本の平均 {lv["y"].mean():.2f} ポイント')
    return rows


def e_mapping(wf, eps, dose):
    """E の作り方の確かめ: 国家間戦争と内戦のエピソードの長さ・死者・終わりの E"""
    out = {'rule': {'war_year': WAR_YEAR, 'kappa_per_death_per_1000': KAPPA, 'peace_year': -PEACE_YEAR, 'cap': [0, 100],
                    'formula': 'E_t = min(100, E_{t-1} + 1 × (その年に戦っている戦争の数) + κ × (その年の戦闘の死者 ÷ 人口 × 1000))、平和な年は E_t = max(0, E_{t-1} − 5)',
                    'deaths': 'COW の戦闘の死者 (参加国ごと、戦争全体) を戦争の年に均等に割る。COW にない年は UCDP の戦闘の死者 (1989 年〜。国家間は当事国で等分)。'
                              '分からない年は 0 (年数だけ数える)'}}
    for kind in ['inter', 'civil']:
        ep = eps[kind]
        ep = ep[ep['onset'] >= 1816]
        kn = ep[ep['dknown']]
        q = lambda x: {f'p{p}': round(float(np.percentile(x, p)), 2) for p in (10, 25, 50, 75, 90)} if len(x) else None
        out[kind] = {'episodes': int(len(ep)), 'with_deaths_known': int(len(kn)), 'years': q(ep['years']), 'deaths_per_1000': q(kn['cumd']),
                     'E_at_end': q(ep['E_end']), 'E_at_end_deaths_known': q(kn['E_end']),
                     'share_E_end_ge_50': round(float((ep['E_end'] >= 50).mean()), 3), 'share_E_end_100': round(float((ep['E_end'] >= 99.999).mean()), 3)}
    ex = [('GBR', 1914), ('FRA', 1914), ('DEU', 1914), ('ITA', 1915), ('USA', 1917), ('GBR', 1939), ('DEU', 1939), ('JPN', 1937), ('USA', 1941),
          ('CAN', 1939), ('AUS', 1939), ('RUS', 1941), ('USA', 1950), ('USA', 1965), ('PRY', 1932), ('BOL', 1932), ('IRN', 1980), ('IRQ', 1980),
          ('ISR', 1973), ('EGY', 1973), ('GBR', 1982), ('ARG', 1982), ('ETH', 1998), ('ERI', 1998), ('USA', 2003), ('RUS', 2022), ('UKR', 2022)]
    ep = eps['inter'].set_index(['iso3', 'onset'])
    rows = []
    for iso, y in ex:
        if (iso, y) in ep.index:
            r = ep.loc[(iso, y)]
            rows.append({'iso3': iso, 'onset': y, 'end': int(r['end']), 'years': int(r['years']), 'deaths_per_1000': round(float(r['cumd']), 2),
                         'deaths_known': bool(r['dknown']), 'mob_peak_pct': None if r['mob_peak'] is None or not np.isfinite(r['mob_peak']) else round(float(r['mob_peak']), 1),
                         'E_end': round(float(r['E_end']), 1), 'outcome': None if r['outcome'] is None or not np.isfinite(r['outcome']) else int(r['outcome'])})
    out['examples'] = rows
    out['examples_note'] = 'COW の Outcome: 1 = 勝ち、2 = 負け、3 = 妥協、4 = 別の種類の戦争に変わった、6 = 引き分け、7 = 続いている、8 = 寝返った'
    # 歳入の反応から逆算した κ: dose のモデルの (死者 1/1000 の係数) ÷ (戦争の 1 年の係数)
    b, draws, cols = dose
    if 'cumd_inter' in cols and 'dur_inter' in cols:
        i, j = cols.index('cumd_inter'), cols.index('dur_inter')
        r = draws[:, i] / draws[:, j]
        r = r[np.isfinite(r)]
        out['kappa_implied_by_revenue'] = {'point': round(float(b[i] / b[j]), 3) if b[j] != 0 else None,
                                           'boot_p25_p50_p75': [round(float(x), 3) for x in np.percentile(r, [25, 50, 75])],
                                           'share_boot_dur_coef_negative': round(float((draws[:, j] < 0).mean()), 3),
                                           'note': '戦争の年数の係数が 0 に近いと比は定まらない。目安にしかならない'}
    return out


def owid_ww1():
    """第一次世界大戦の前後 (1910 年と 1920 年) の公的な社会支出と保健支出の GDP 比 (Our World in Data。1960 年より前は 10 年おき)。
    交戦国 (COW の第一次世界大戦の参加国) と中立国の変化を並べるだけの記述 (国の数が少なく、戦時中の年はない)"""
    cow = pd.read_csv(os.path.join(HIST, 'cow_interstate_v4.csv'), encoding='latin-1')
    bell = {COW2ISO.get(c) for c in cow[cow['WarName'].str.contains('World War I$', regex=True)]['ccode']} - {None}
    out = {'belligerents_cow': sorted(bell)}
    for nm, f in [('social', 'owid_social-spending-oecd-longrun.csv'), ('health', 'owid_public-health-expenditure-share-gdp-owid.csv')]:
        d = pd.read_csv(gz(f))
        d = d.pivot_table(index='Code', columns='Year', values=d.columns[-1])
        if 1910 not in d or 1920 not in d:
            continue
        x = d[[1910, 1920]].dropna()
        x = x[x[1910] > 0]
        ch = (x[1920] - x[1910]).round(3)
        b, n = ch[ch.index.isin(bell)], ch[~ch.index.isin(bell)]
        out[nm] = {'change_1910_1920_pp': {'belligerent': b.to_dict(), 'other': n.to_dict()},
                   'mean_belligerent': round(float(b.mean()), 3) if len(b) else None, 'mean_other': round(float(n.mean()), 3) if len(n) else None,
                   'mean_log_ratio_belligerent': round(float(np.log(x.loc[b.index, 1920] / x.loc[b.index, 1910]).replace([np.inf, -np.inf], np.nan).mean()), 3) if len(b) else None,
                   'mean_log_ratio_other': round(float(np.log(x.loc[n.index, 1920] / x.loc[n.index, 1910]).replace([np.inf, -np.inf], np.nan).mean()), 3) if len(n) else None}
    out['note'] = '1920 年は戦争の 2 年後。戦時中の削減は見えない。オーストラリア・カナダ・ニュージーランドは参戦したが COW では 1920 年まで国でないので「その他」に入る'
    return out


def recommend(models):
    """ゲームの式の案。E の直線のモデルの係数 (E 1 点あたり %) を、95% の区間が 0 をまたがなければ使い、またげば 0 にする"""
    def term(key, name):
        c = models[key]['E_lin']['coef'].get(name)
        if not c or c['coef'] is None:
            return None
        if c.get('few_countries'):
            return {'outcome': key, 'term': name, 'pct_per_E_point': c['coef'], 'ci95': c['ci95'], 'countries': c['countries'],
                    'effective_countries': c['effective_countries'], 'top_countries': c['top_countries'], 'recommended_pct_per_E_point': None,
                    'note': f'この項を支える国が {FEW} か国未満か、実効の国の数が {FEW_EFF:g} 未満。推奨には使わない'}
        a = c['coef'] if (c['ci95'][0] > 0 or c['ci95'][1] < 0) else 0.0
        return {'outcome': key, 'term': name, 'pct_per_E_point': c['coef'], 'ci95': c['ci95'], 'p_boot': c['p_boot'], 'countries': c['countries'],
                'effective_countries': c['effective_countries'], 'top_countries': c['top_countries'],
                'recommended_pct_per_E_point': round(a, 3),
                'multiplier_at_E50': round(math.exp(c['coef'] * 50 / 100), 3), 'multiplier_at_E100': round(math.exp(c['coef'] * 100 / 100), 3),
                'multiplier_at_E100_ci95': [round(math.exp(c['ci95'][0]), 3), round(math.exp(c['ci95'][1]), 3)]}
    out = {'game_now': {'tax': 'f_tax(E) = 1 − 0.004 E (E = 100 で −40%、log では −51 点)', 'pension_health': '1 (E によらない)'}}
    for nm, key in [('f_tax', 'rev_fpp'), ('f_tax_jst', 'rev_jst'), ('f_tax_world_tax', 'tax_world'), ('f_tax_world_rev_ex_grants', 'revx_world'),
                    ('real_revenue', 'rrev_fpp'), ('real_gdp', 'gdp_fpp'), ('f_pension_oldage', 'oldage_cofog'), ('f_pension_social', 'social_cofog'),
                    ('real_pension_oldage_pc', 'roldage_cofog'), ('real_social_pc', 'rsocial_cofog'), ('f_health_cofog', 'health_cofog'),
                    ('f_health_ghed', 'health_ghed'), ('real_health_pc_ghed', 'rhealth_ghed'), ('real_health_pc_cofog', 'rhealth_cofog')]:
        out[nm] = {k: term(key, f'E_{k}') for k in ['inter', 'civil', 'interv']}
    # 内戦は E の傾きでなく、戦っている間の段差で見る (status と dose のモデルの civil の係数)
    for nm, key in [('civil_step_revenue', 'rev_fpp'), ('civil_step_real_revenue', 'rrev_fpp'), ('civil_step_gdp', 'gdp_fpp'), ('civil_step_tax_world', 'tax_world'),
                    ('civil_step_health_cofog', 'health_cofog'), ('civil_step_social_cofog', 'social_cofog'), ('civil_step_health_ghed', 'health_ghed')]:
        m = models[key]
        out[nm] = {'status_civil': m['status']['coef'].get('civil'), 'status_post_civil': m['status']['coef'].get('post_civil'),
                   'dose_civil': m['dose']['coef'].get('civil'), 'dose_dur_civil': m['dose']['coef'].get('dur_civil'), 'dose_cumd_civil': m['dose']['coef'].get('cumd_civil')}
    for nm, key in [('inter_status_revenue', 'rev_fpp'), ('inter_status_real_revenue', 'rrev_fpp'), ('inter_status_gdp', 'gdp_fpp')]:
        m = models[key]
        out[nm] = {c: m[mod]['coef'].get(c) for mod, c in [('status', 'inter'), ('status', 'post_inter'), ('dose', 'inter'), ('dose', 'dur_inter'), ('dose', 'cumd_inter')]}
    return out


def game_proposal(models, es):
    """ゲームの式の提案 (docs/research/war-fiscal.md の 8 章)。recommended の数から、解釈を加えて決めたもの"""
    ti = models['rev_fpp']['E_lin']['coef']['E_inter']
    civ = {'status': models['rev_fpp']['status']['coef']['civil']['coef'], 'dose': models['rev_fpp']['dose']['coef']['civil']['coef'],
           'event_0_5': es['rev_fpp']['civil_onset']['avg_0_5']['coef']}
    step = float(np.mean(list(civ.values())))
    return {
        'f_tax_interstate': {
            'form': 'f_tax(E) = 1 (国家間戦争の E で税の倍率を変えない。いまの 1 − 0.004 E をやめる)',
            'data_pct_per_E_point': ti['coef'], 'data_ci95': ti['ci95'],
            'reason': '歳入 ÷ GDP は E とともに上がり (区間はいまの式の −0.4 と逆向き)、その多くは政府の増税の判断の結果。ゲームでは税率をプレイヤーが決めるので、'
                      '自動の倍率でなく、E が 30 を超えたときに増税への反発 (議会の支持・家臣の忠誠の低下) を小さくし、戦後もしばらく残す形で入れる',
            'alternative_if_automatic': f'f_tax(E) = exp(a E)、a = {ti["coef"] / 100:.4f} (95% 区間 {ti["ci95"][0] / 100:.4f}〜{ti["ci95"][1] / 100:.4f})'},
        'f_tax_civil_step': {
            'form': f'反乱・独立戦争を戦っている間だけ f_tax = {1 + step / 100:.2f} (E の大きさによらない段差)',
            'step_pct': round(step, 2), 'inputs_pct': civ,
            'reason': '内戦では歳入 ÷ GDP が戦っている間に数 % 落ちる (どの推定でも負、区間はおおむね 0 にかかる)。E の傾きはない'},
        'f_pension': {'form': 'f_pension(E) = 1 (いまのまま)', 'reason': '国家間戦争では国が少なく推定できない。介入・内戦で老齢の支出 ÷ GDP は動かない'},
        'f_health': {'form': 'f_health(E) = 1 (いまのまま)', 'reason': '介入・内戦で保健の支出 ÷ GDP は動かない。1 人あたり実質は GDP とともに落ちる (所得の側で出る)'},
        'E_mapping': {'form': f'E_t = min(100, E_(t-1) + {WAR_YEAR:g} × 戦争の数 + {KAPPA:g} × 戦闘の死者 ÷ 人口 × 1000)、平和な年は −{PEACE_YEAR:g}',
                      'note': '艦隊 1 つ (+1.5) は人口 1,000 人あたり 0.3 人の死者にあたる。ふつうの国家間戦争が E 5〜15、総力戦だけが 60〜100 に届くように重みを合わせる'}}


def main():
    global POOL
    import multiprocessing as mp
    POOL = mp.get_context('fork').Pool(CHUNKS)
    try:
        d, wf, rec, meta = build()
        eps = {k: episodes(wf, k) for k in ['inter', 'civil', 'interv']}
        out = {'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
               'settings': {'seed': SEED, 'bootstrap': BOOT, 'kappa': KAPPA, 'kappa_sensitivity': KAPPAS, 'war_year': WAR_YEAR, 'peace_year': PEACE_YEAR,
                            'E_bins': E_BINS[:-1] + [100], 'break_pp': BREAK_PP, 'spike_pp': SPIKE_PP, 'break_log': BREAK_LOG, 'spike_log': SPIKE_LOG,
                            'hyperinflation_pct': HYPER, 'min_spell': MIN_SPELL, 'event_window': [-PRE, POST],
                            'y': '100 × ln (GDP 比、または実質の額)。係数は E 1 点あたりの % (log 点)。debt_fpp と mil_wdi はポイント',
                            'fixed_effects': '系列 (国。切れ目で分けたもの) と年', 'ci': '国を単位にしたペアのクラスター・ブートストラップの 2.5〜97.5% 点'},
               'sector_choice': meta, 'candidates': candidates(d)}
        ep_summary = {}
        for k, ep in eps.items():
            ep_summary[k] = {'episodes': int(len(ep)), 'clean_onsets': int(ep['clean_onset'].sum()), 'clean_ends': int(ep['clean_end'].sum())}
        out['episodes'] = ep_summary
        sel, models, es = {}, {}, {}
        rob, dose = None, None
        for key, *_ in OUTCOMES:
            smp, counts, info = select(d, wf, eps, key)
            sel[key] = {'label': SPEC[key][5], 'funnel': counts, **info}
            m = {}
            for model in (['status', 'dose', 'E_lin', 'E_bin'] if key in MAIN else ['E_lin', 'E_bin']):
                res, raw = fit(smp['S5'], model, f'{key}:{model}')
                m[model] = res
                if key == 'rev_fpp' and model == 'dose':
                    dose = raw
            models[key] = m
            if key in ES_OUT:
                es[key] = events_for(smp, wf, eps, key)
            if key in ('rev_fpp', 'rev_jst'):
                out.setdefault('robustness', {})[key] = robustness(smp, key)
                out.setdefault('kappa_profile', {})[key] = kappa_profile(smp['S5'], key)
            print(key, 'n', counts[-1]['n'], 'E_inter', m['E_lin']['coef'].get('E_inter'), flush=True)
        out['selection'] = sel
        out['models'] = models
        out['event_studies'] = es
        out['E_mapping'] = e_mapping(wf, eps, dose)
        out['recommended'] = recommend(models)
        out['game_proposal'] = game_proposal(models, es)
        out['owid_ww1_decadal'] = owid_ww1()
    finally:
        POOL.close()
        POOL.join()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(jsonable(out), f, ensure_ascii=False, indent=1)
    print('wrote', OUT)


if __name__ == '__main__':
    sys.exit(main())
