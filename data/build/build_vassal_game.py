#!/usr/bin/env python3
"""従属国の型 (19 型 + 植民地) を、ゲームの値の表 VASSAL_TYPES にして src/index.html に書く (レーン H・セッション H3-1)。

材料は data/derived/vassal.json (事例ごとの最終の束) と data/derived/vassal_survival.json (型ごとのまとめ)。
src/index.html の /* VASSAL:BEGIN … VASSAL:END */ のあいだを書き換える (手で直さない)。

ゲームの値の決め方 (docs/vassal-game.md):
  - 束 law・fact: 型の事例の最頻の符号 (宗 S・分 M・従 V。8 項目: 外交・軍事・課税と朝貢・法と裁判・任免・交易・宗教と文化・継承)
  - gap: 型の事例の、法と実態の差の項目の数の平均
  - hr (離反の倍率): 事例 131 件の Cox モデル (終わりまでの時間 ~ 法と実態の差 + 始まりの世紀) の係数で、
    exp(b_gap × (gap − gap_基準))。基準は藩王国 (T04 = いまの間接統治)。植民地 (直轄、T20) は前に COLDAT の英仏の植民地で
    推定した 1.39 (目標 R08。data/derived/history.json) をそのまま使う
  - war (独立が戦争になる確率): 型の事例の暴力の割合を、家族の割合へ 4 件分寄せたもの ((k + 4 p_家族) ÷ (n + 4))。
    藩王国 (T04 = 間接統治) と植民地 (T20 = 直接統治) は、前に ICOW の 128 件で推定した英 9%・仏 32% をそのまま使う (標本が大きい)
  - tribute (朝貢): 実態の課税と朝貢が 宗 50%・分 25%・従 5% (いまの直接統治・間接統治・自治領の値)
  - rank (自治の度合い 0〜4): 法の束の点 (宗 0・分 0.5・従 1) の合計 ÷ 2
  - delay (遠さへの敏感さ、ゲーム版だけ。台帳 C03): 1.6 × 0.88^(実態の束の点の合計)
  - loyalty (忠誠度の目標への効き): 0 (法と実態の差の効きは hr に入っているので、二重に数えない)。直轄の +10 と強制労働の −10 はゲームの側で足す
  - noOrders: 実態で外交と任免を従属国が握る型は、指令を受けない (統治体制を変える指令だけは受ける)
  - refuseAt: 指令を拒むことがある忠誠度 = 50 + 5 × (実態の点 − 基準の実態の点)、30〜80
使い方: python3 data/build/build_vassal_game.py   (numpy が要る。先に build_vassal.py と analyze_vassal.py を回す)
"""
import json, math, os, re, sys
from collections import Counter
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from analyze_history import cox, coef  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, '..', 'src', 'index.html')
ITEMS = ['dip', 'mil', 'tax', 'law', 'appt', 'trade', 'rel', 'succ']
NUM = {'S': 0.0, 'M': 0.5, 'V': 1.0}
BASE = 'T04'
SHRINK = 4

def main():
    V = json.load(open(os.path.join(ROOT, 'derived', 'vassal.json'), encoding='utf-8'))
    S = json.load(open(os.path.join(ROOT, 'derived', 'vassal_survival.json'), encoding='utf-8'))
    cases = V['cases']
    H = json.load(open(os.path.join(ROOT, 'derived', 'history.json'), encoding='utf-8'))
    H_VIOL = json.load(open(os.path.join(ROOT, '..', 'targets', 'targets.json'), encoding='utf-8'))
    H_VIOL = next(r for r in H_VIOL['realism'] if r['id'] == 'R08')['observed']['violent_share']['decolonization_by_ruler']
    # 離反の倍率のモデル: 終わりまでの時間 ~ 法と実態の差 + 実態の外交 + 始まりの世紀
    t = np.array([c['duration'] for c in cases], float)
    d = np.array([0 if c['censored'] else 1 for c in cases], float)
    X = np.array([[c['law_fact_gap'], c['start'] / 100.0] for c in cases], float)
    b, se = cox(t, d, X)
    model = [coef(b, se, k, n, exp=True) for k, n in enumerate(['law_fact_gap', 'start_century'])]
    bt = S['by_type']; bf = S['by_family']
    def dipnum(tid):
        cs = [c for c in cases if c['type_id'] == tid]
        return float(np.mean([NUM[c['bundle']['fact']['dip']] for c in cs]))
    base_gap, base_dip = bt[BASE]['mean_gap'], dipnum(BASE)
    base_fact = sum(NUM[v] for v in bt[BASE]['modal_bundle']['fact'].values())
    types = {}
    for tid in sorted(bt):
        r = bt[tid]
        law = ''.join(r['modal_bundle']['law'][i] for i in ITEMS)
        fact = ''.join(r['modal_bundle']['fact'][i] for i in ITEMS)
        cs = [c for c in cases if c['type_id'] == tid]
        k = sum(1 for c in cs if c['violent_end']); n = len(cs)
        p_fam = bf[r['family']]['violent_end_share']
        fact_pts = sum(NUM[x] for x in fact)
        hr = math.exp(b[0] * (r['mean_gap'] - base_gap))
        war = (k + SHRINK * p_fam) / (n + SHRINK)
        if tid == 'T20':
            hr = H['colonies']['hazard_britain_france']['model3_direct_vs_indirect'][0]['hr']
            war = H_VIOL['france']['share']
        if tid == BASE:
            war = H_VIOL['britain']['share']
        types[tid] = {
            'label': r['name'], 'family': r['family'], 'law': law, 'fact': fact, 'gap': r['mean_gap'],
            'hr': round(hr, 3), 'war': round(war, 3),
            'tribute': {'S': 0.5, 'M': 0.25, 'V': 0.05}[fact[ITEMS.index('tax')]],
            'rank': round(sum(NUM[x] for x in law) / 2, 2), 'delay': round(1.6 * 0.88 ** fact_pts, 3),
            'loyalty': 0, 'noOrders': fact[0] == 'V' and fact[4] == 'V',
            'refuseAt': int(min(80, max(30, round(50 + 5 * (fact_pts - base_fact))))),
            'n': n, 'median': r['km_median'], 'ratio': bf[r['family']].get('median_ratio'),
            'cases': [c['name'] for c in cs[:3]],
        }
    # AI の国の型の決め方 (H3-2): 歴史の事例を、宗主との位置で 3 つに分け (陸続き・近い海 (3,000 km 以下)・遠い海)、区分ごとの家族の数を数える。
    # 入植で生まれる従属国には、既にある国家を従えた型 (傀儡と衛星・法と交易だけ) と直轄 (人間だけ、上限あり) は使わない
    import csv
    cond = {r['case_id']: r for r in csv.DictReader(open(os.path.join(ROOT, 'raw', 'vassal', 'conditions.csv'), encoding='utf-8'))}
    ai = {'contiguous': Counter(), 'near': Counter(), 'far': Counter()}
    for c in cases:
        k = cond[c['case_id']]
        cls = 'contiguous' if k['contiguous'] == 'Y' else 'near' if float(k['distance_km']) <= 3000 else 'far'
        ai[cls][c['type_id']] += 1
    share = {cls: round(sum(v.values()) / len(cases), 3) for cls, v in ai.items()}
    skip = {'T10', 'T11', 'T17', 'T20'}
    out = {'model': model, 'base': BASE, 'types': types,
           'ai': {'share': share, 'types': {cls: {t: n for t, n in sorted(v.items()) if t not in skip} for cls, v in ai.items()}}}
    block = ('/* VASSAL:BEGIN (data/build/build_vassal_game.py が書く。手で直さない。docs/vassal-game.md) */\n'
             'const VASSAL_DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n/* VASSAL:END */')
    src = open(SRC, encoding='utf-8').read()
    if '/* VASSAL:BEGIN' in src:
        src = re.sub(r'/\* VASSAL:BEGIN.*?/\* VASSAL:END \*/', lambda m: block, src, flags=re.S)
    else:
        anchor = '// 統治体制 (家臣の星系ごとに主人が選ぶ)'
        assert anchor in src
        src = src.replace(anchor, block + '\n' + anchor, 1)
    open(SRC, 'w', encoding='utf-8').write(src)
    print('model', [(m['name'], m['hr'], m['hr_ci95'], m['p']) for m in model])
    for tid, x in types.items():
        print(tid, x['label'][:10], x['law'], x['fact'], 'hr', x['hr'], 'war', x['war'], 'trib', x['tribute'], 'rank', x['rank'], 'delay', x['delay'], 'loy', x['loyalty'], 'noOrd', x['noOrders'], 'ref', x['refuseAt'])

if __name__ == '__main__':
    sys.exit(main())
