#!/usr/bin/env python3
"""AI の国の振る舞い (同盟と指導者) の様式化された事実を計算する (目標 R90〜R94。回 AI1・B-300。docs/ai-behavior.md の 4・5)。

生データ (data/fetch/fetch_ai.py が取ったもの。data/raw/ai/):
  ATOP 5.1 の同盟ごと (atop5_1a.csv) と加盟国ごと (atop5_1m.csv)。変数の意味は atop_5_1_codebook.pdf
  Archigos 4.1 (Archigos_4.1_stata14.dta)
  国家の一覧は Correlates of War の State System Membership 2016 (data/raw/history/cow_states2016.csv)

統計量 (幅はどれも、ここで計算した値だけから決める。ゲームの値は見ない。targets/targets.json の rules):
  R90 国が新しく結ぶ協定の数: 国ごとに、1816〜2016 年に同盟に加わった回数 (ATOP の加盟国ごとの行の加わった年 yrent) ÷ 国である年数 × 100。
      国である年数が 20 年以上の国の分布。幅は国の 25%〜75% 点
  R91 防衛同盟のうち、特定の脅威を名指しするものの割合 (SPECTHRT ≠ 0。脅威への均衡の目安。Walt 1987):
      防衛の約束 (DEFENSE = 1) のある同盟の、結んだ年の 10 年ごとの割合 (10 件以上の 10 年)。幅は 10 年ごとの 25%〜75% 点
  R92 終わった協定のうち、期限の前に破られたものの割合 (TERMMODE = 3。Leeds & Savun 2007):
      加盟国ごとの終わり (TERMMODE が 0 = まだ続いている と 4 = 加盟国が独立を失った を除く) の、終わった年の 10 年ごとの割合 (10 件以上)。
      幅は 10 年ごとの 25%〜75% 点
  R93 指導者の不規則な退き方の割合 (Archigos の exit が Irregular: クーデター・反乱・暗殺など):
      退いた指導者 (Still in Office と Unknown を除く) が 10 人以上の国の、国ごとの割合。幅は国の 25%〜75% 点
  R94 指導者の在任期間: 退いた指導者の在任の年数 (enddate − startdate) の、国ごとの中央値 (10 人以上の国)。幅は国の 25%〜75% 点
  (参考) 全体の値 (国を分けない割合・中央値) と、外国に退かされた指導者 (exit が Foreign) の割合

使い方: python3 data/build/build_ai.py → data/derived/ai.json
"""
import csv, collections, json, os
import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'ai')
OUT = os.path.join(HERE, '..', 'derived', 'ai.json')

def num(x):
    return int(float(x)) if x not in ('', None) else None

def pct(v, qs=(10, 25, 50, 75, 90)):
    return {f'p{q}': round(float(np.percentile(v, q)), 4) for q in qs}

def main():
    A = list(csv.DictReader(open(os.path.join(RAW, 'atop5_1a.csv'), encoding='latin-1')))
    M = list(csv.DictReader(open(os.path.join(RAW, 'atop5_1m.csv'), encoding='latin-1')))
    S = list(csv.DictReader(open(os.path.join(HERE, '..', 'raw', 'history', 'cow_states2016.csv'), encoding='latin-1')))
    out = {}
    # R90
    years = collections.Counter()
    for s in S:
        b, e = max(num(s['styear']), 1816), min(num(s['endyear']), 2016)
        if e >= b:
            years[num(s['ccode'])] += e - b + 1
    joins = collections.Counter(num(m['member']) for m in M if num(m['yrent']) and 1816 <= num(m['yrent']) <= 2016)
    rates = [joins[c] / years[c] * 100 for c in years if years[c] >= 20]
    out['R90'] = {'what': '国ごとの、同盟に加わった回数 (100 年あたり)', 'n_states': len(rates), **pct(rates),
                  'mean': round(float(np.mean(rates)), 3), 'all': round(sum(joins.values()) / sum(years.values()) * 100, 3),
                  'band': [round(float(np.percentile(rates, 25)), 2), round(float(np.percentile(rates, 75)), 2)]}
    # R91
    by = collections.defaultdict(list)
    for a in A:
        if a['defense'] != '1' or a['specthrt'] in ('', '-9'):
            continue
        by[num(a['begyr']) // 10 * 10].append(a['specthrt'] != '0')
    sh = {k: sum(v) / len(v) for k, v in sorted(by.items()) if len(v) >= 10}
    allv = [x for v in by.values() for x in v]
    out['R91'] = {'what': '防衛同盟のうち特定の脅威を名指しする割合 (10 年ごと)', 'n_alliances': len(allv), 'n_decades': len(sh),
                  'overall': round(sum(allv) / len(allv), 4), 'decades': {str(k): round(v, 4) for k, v in sh.items()}, **pct(list(sh.values())),
                  'band': [round(float(np.percentile(list(sh.values()), 25)), 4), round(float(np.percentile(list(sh.values()), 75)), 4)]}
    # R92
    by = collections.defaultdict(list)
    for m in M:
        if m['termmode'] in ('0', '', '4'):
            continue
        y = num(m['yrexit'])
        if y:
            by[y // 10 * 10].append(m['termmode'] == '3')
    sh = {k: sum(v) / len(v) for k, v in sorted(by.items()) if len(v) >= 10}
    allv = [x for v in by.values() for x in v]
    out['R92'] = {'what': '終わった協定 (加盟国ごと) のうち期限の前に破られた割合 (10 年ごと)', 'n_ends': len(allv), 'n_decades': len(sh),
                  'overall': round(sum(allv) / len(allv), 4), 'decades': {str(k): round(v, 4) for k, v in sh.items()}, **pct(list(sh.values())),
                  'band': [round(float(np.percentile(list(sh.values()), 25)), 4), round(float(np.percentile(list(sh.values()), 75)), 4)]}
    # R93・R94
    d = pd.read_stata(os.path.join(RAW, 'Archigos_4.1_stata14.dta'))
    ex = d[~d['exit'].isin(['Still in Office', 'Unknown'])].copy()
    ex['ten'] = (pd.to_datetime(ex['enddate'], errors='coerce') - pd.to_datetime(ex['startdate'], errors='coerce')).dt.days / 365.25
    big = ex.groupby('ccode').filter(lambda g: len(g) >= 10)
    irr = big.groupby('ccode')['exit'].apply(lambda s: float((s == 'Irregular').mean()))
    ten = big.groupby('ccode')['ten'].median().dropna()
    out['R93'] = {'what': '国ごとの、指導者の不規則な退き方の割合', 'n_countries': int(len(irr)), 'n_exits': int(len(ex)), **pct(irr.values),
                  'overall': round(float((ex['exit'] == 'Irregular').mean()), 4), 'foreign': round(float((ex['exit'] == 'Foreign').mean()), 4),
                  'band': [round(float(np.percentile(irr.values, 25)), 4), round(float(np.percentile(irr.values, 75)), 4)]}
    out['R94'] = {'what': '国ごとの、指導者の在任の年数の中央値', 'n_countries': int(len(ten)), **pct(ten.values),
                  'overall_median': round(float(ex['ten'].median()), 3),
                  'band': [round(float(np.percentile(ten.values, 25)), 2), round(float(np.percentile(ten.values, 75)), 2)]}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for k, v in out.items():
        print(k, v['what'], v['band'])

if __name__ == '__main__':
    main()
