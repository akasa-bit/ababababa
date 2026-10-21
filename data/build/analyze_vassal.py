#!/usr/bin/env python3
"""従属国の事例 (data/derived/vassal.json と data/raw/vassal/) から、型ごとの存続と移り変わりを推定する (レーン H・セッション H2-2)。

- 型ごとの存続年数 (Kaplan–Meier の中央値と四分位。続いている事例は打ち切り)
- Cox 比例ハザードモデル (Breslow): 終わり (どの終わり方でも) と独立 (ほかの終わり方は打ち切り) のそれぞれについて
    M1 型の家族 (基準: 植民地) + 始まりの世紀
    M2 束 (実態の層で従属国が握る項目の数) + 法と実態の差 + 始まりの世紀 + ln 距離
    M3 束の 8 項目 (実態の層。S = 0, M = 0.5, V = 1) + 始まりの世紀
- 移り変わり: 型 → 終わり方、型 → 移り先の型
- 独立が暴力を伴った割合: 型ごと・軍事の項目ごと・宗主の種類ごと
- 質的比較分析 (crisp-set QCA): 条件 (遠い・大きい・文化が近い・陸続き・海の帝国) → 結果 (戦争なしの独立 / 併合) の真理表と、十分条件の組み合わせ
- 条件 → 型の家族のクロス表 (AI の国の型の決め方の材料)
書き出し: data/derived/vassal_survival.json

使い方: python3 data/build/analyze_vassal.py   (numpy が要る。先に build_vassal.py を回す)
"""
import csv, datetime, itertools, json, math, os, re, sys
from collections import Counter, defaultdict
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from analyze_history import cox, coef, pnorm  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
RAW = os.path.join(ROOT, 'raw', 'vassal')
DERIVED = os.path.join(ROOT, 'derived')
ITEMS = ['dip', 'mil', 'tax', 'law', 'appt', 'trade', 'rel', 'succ']
FAMILY = {'T01': 'ritual', 'T02': 'ritual', 'T18': 'ritual',
          'T03': 'treaty', 'T04': 'treaty', 'T06': 'treaty', 'T16': 'treaty', 'T19': 'treaty',
          'T17': 'legal', 'T05': 'settler', 'T12': 'settler', 'T07': 'colony', 'T20': 'colony', 'T09': 'colony',
          'T10': 'client', 'T11': 'client', 'T13': 'dynastic', 'T14': 'dynastic', 'T15': 'dynastic', 'T08': 'dynastic'}
FAMILY_NAMES = {'ritual': '儀礼の宗主権 (冊封朝貢・藩部・貢納公国)', 'treaty': '条約の保護 (保護国・藩王国・委任統治 A・緩衝国・プラット型)', 'legal': '法と交易だけ (不平等条約)',
                'settler': '入植者の自治と自由連合 (自治領・自由連合)', 'colony': '直轄 (植民地・委任統治 B/C・特許会社領)', 'client': '傀儡と衛星', 'dynastic': '君主と封の網 (封臣・藩・同君連合・共同統治)'}
NUM = {'S': 0.0, 'M': 0.5, 'V': 1.0}
NOW = 2026

def km_curve(t, d):
    """Kaplan–Meier。t: 年数、d: 1 = 終わった、0 = 打ち切り。(時刻, 生存率) の列と中央値・四分位を返す"""
    order = np.argsort(t)
    t, d = np.asarray(t, float)[order], np.asarray(d, int)[order]
    s, out, at_risk = 1.0, [], len(t)
    q = {}
    for ti in sorted(set(t)):
        di = int(d[t == ti].sum()); ni = int((t >= ti).sum())
        if di:
            s *= 1 - di / ni
            out.append((float(ti), round(s, 4)))
            for p in (0.75, 0.5, 0.25):
                if s <= p and p not in q:
                    q[p] = float(ti)
    return out, q

def main():
    V = json.load(open(os.path.join(DERIVED, 'vassal.json'), encoding='utf-8'))
    cases = V['cases']
    cond = {r['case_id']: r for r in csv.DictReader(open(os.path.join(RAW, 'conditions.csv'), encoding='utf-8'))}
    raw = {r['case_id']: r for r in csv.DictReader(open(os.path.join(RAW, 'cases.csv'), encoding='utf-8'))}
    out = {'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'n': len(cases),
           'bundle_source': Counter(c.get('bundle_source', 'none') for c in cases), 'families': FAMILY_NAMES}
    for c in cases:
        c['family'] = FAMILY[c['type_id']]
        c['event_any'] = 0 if c['censored'] else 1
        c['event_indep'] = 1 if c['end_kind'] == 'indep' else 0
        c['next'] = None
        note = raw[c['case_id']]['note']
        m = re.search(r'\((T\d\d)\)', note)
        if c['end_kind'] == 'transferred':
            c['next'] = m.group(1) if m else 'other_suzerain_or_type'
        elif c['end_kind'] == 'annexed':
            c['next'] = 'T20' if c['type_id'] != 'T20' else 'absorbed'
        elif c['end_kind'] in ('indep', 'suzerain_end'):
            c['next'] = 'INDEP'
        elif c['end_kind'] == 'merger':
            c['next'] = 'MERGED'

    # ---- 型ごと・家族ごとの存続 ----
    def group_stats(key):
        res = {}
        for g in sorted({c[key] for c in cases}):
            cs = [c for c in cases if c[key] == g]
            t = [c['duration'] for c in cs]; d = [c['event_any'] for c in cs]
            curve, q = km_curve(t, d)
            r = {'n': len(cs), 'n_censored': int(len(cs) - sum(d)), 'km_median': q.get(0.5), 'km_q25_q75': [q.get(0.75), q.get(0.25)],
                 'durations': sorted(t), 'end_kinds': dict(Counter(c['end_kind'] for c in cs)),
                 'violent_end_share': round(sum(1 for c in cs if c['violent_end']) / len(cs), 3),
                 'indep_share': round(sum(c['event_indep'] for c in cs) / len(cs), 3),
                 'next': dict(Counter(c['next'] for c in cs if c['next']))}
            if all('bundle' in c for c in cs):
                r['mean_gap'] = round(float(np.mean([c['law_fact_gap'] for c in cs])), 2)
                r['mean_v_fact'] = round(float(np.mean([c['v_count']['fact'] for c in cs])), 2)
                r['modal_bundle'] = {layer: {it: Counter(c['bundle'][layer][it] for c in cs).most_common(1)[0][0] for it in ITEMS} for layer in ('law', 'fact')}
            res[g] = r
        return res
    out['by_type'] = group_stats('type_id')
    out['by_family'] = group_stats('family')
    for tid, r in out['by_type'].items():
        r['name'] = V['types'][tid]['name']; r['family'] = FAMILY[tid]
    allc, q = km_curve([c['duration'] for c in cases], [c['event_any'] for c in cases])
    out['all'] = {'n': len(cases), 'km_median': q.get(0.5), 'km_q25_q75': [q.get(0.75), q.get(0.25)], 'curve': allc}

    # ---- Cox ----
    have_bundle = all('bundle' in c for c in cases)
    fams = [f for f in FAMILY_NAMES if f != 'colony']
    def design_family(c):
        return [1.0 if c['family'] == f else 0.0 for f in fams] + [c['start'] / 100.0]
    def fit(name, X, names, event_key):
        t = np.array([c['duration'] for c in cases], float); d = np.array([c[event_key] for c in cases], float)
        Xa = np.array(X, float)
        try:
            b, se = cox(t, d, Xa)
            return {'name': name, 'n': len(cases), 'events': int(d.sum()), 'terms': [coef(b, se, k, nm, exp=True) for k, nm in enumerate(names)]}
        except Exception as e:
            return {'name': name, 'error': str(e)}
    models = {}
    for ev, label in (('event_any', 'any_end'), ('event_indep', 'independence')):
        models[f'M1_family_{label}'] = fit('型の家族 (基準: 直轄) + 始まりの世紀', [design_family(c) for c in cases], [f'family={f}' for f in fams] + ['start_century'], ev)
        if have_bundle:
            X2 = [[c['v_count']['fact'], c['law_fact_gap'], c['start'] / 100.0, math.log(max(float(cond[c['case_id']]['distance_km']), 50.0))] for c in cases]
            models[f'M2_bundle_{label}'] = fit('実態で従属国が握る項目の数 + 法と実態の差 + 始まりの世紀 + ln 距離', X2, ['v_count_fact', 'law_fact_gap', 'start_century', 'ln_distance_km'], ev)
            X3 = [[NUM[c['bundle']['fact'][it]] for it in ITEMS] + [c['start'] / 100.0] for c in cases]
            models[f'M3_items_{label}'] = fit('束の 8 項目 (実態。S=0・M=0.5・V=1) + 始まりの世紀', X3, [f'fact_{it}' for it in ITEMS] + ['start_century'], ev)
    out['cox'] = models

    # ---- 暴力の割合 ----
    viol = {'by_type': {t: r['violent_end_share'] for t, r in out['by_type'].items()}, 'by_family': {f: r['violent_end_share'] for f, r in out['by_family'].items()},
            'by_suzerain_kind': {}, 'by_fact_mil': {}}
    for k in sorted({cond[c['case_id']]['suzerain_kind'] for c in cases}):
        cs = [c for c in cases if cond[c['case_id']]['suzerain_kind'] == k]
        viol['by_suzerain_kind'][k] = {'n': len(cs), 'share': round(sum(1 for c in cs if c['violent_end']) / len(cs), 3)}
    if have_bundle:
        for code in 'SMV':
            cs = [c for c in cases if c['bundle']['fact']['mil'] == code and not c['censored']]
            if cs:
                viol['by_fact_mil'][code] = {'n': len(cs), 'share': round(sum(1 for c in cs if c['violent_end']) / len(cs), 3),
                                            'indep_share': round(sum(c['event_indep'] for c in cs) / len(cs), 3)}
    out['violence'] = viol

    # ---- QCA (crisp set) ----
    def conds(c):
        k = cond[c['case_id']]
        return {'far': int(float(k['distance_km']) > 3000), 'big': int(int(k['pop_ratio_class']) >= 3), 'close_culture': int(int(k['culture']) >= 1),
                'contiguous': int(k['contiguous'] == 'Y'), 'maritime': int(k['suzerain_kind'] == 'maritime_empire')}
    names = ['far', 'big', 'close_culture', 'contiguous', 'maritime']
    def qca(outcome_fn, label):
        done = [c for c in cases if not c['censored']]
        table = {}
        for c in done:
            key = tuple(conds(c)[n] for n in names)
            e = table.setdefault(key, {'n': 0, 'y': 0, 'cases': []})
            e['n'] += 1; e['y'] += outcome_fn(c); e['cases'].append(c['case_id'])
        rows = []
        for key, e in sorted(table.items(), key=lambda kv: (-kv[1]['n'])):
            rows.append({'config': dict(zip(names, key)), 'n': e['n'], 'consistency': round(e['y'] / e['n'], 2), 'cases': e['cases']})
        # 十分条件の組み合わせ: 一貫性 0.8 以上で 2 件以上の行を、Quine–McCluskey の簡単な形で縮める (1 条件ずつ落として、落としても一貫性が保たれるか見る)
        suff = [r for r in rows if r['consistency'] >= 0.8 and r['n'] >= 2]
        reduced = []
        for r in suff:
            cfg = dict(r['config'])
            for n in names:
                trial = {k: v for k, v in cfg.items() if k != n}
                sub = [c for c in done if all(conds(c)[k] == v for k, v in trial.items())]
                if sub and sum(outcome_fn(c) for c in sub) / len(sub) >= 0.8 and len(sub) >= 2:
                    cfg = trial
            cover = [c for c in done if all(conds(c)[k] == v for k, v in cfg.items())]
            reduced.append({'conditions': cfg, 'n': len(cover), 'consistency': round(sum(outcome_fn(c) for c in cover) / len(cover), 2)})
        uniq = {json.dumps(r['conditions'], sort_keys=True): r for r in reduced}
        return {'outcome': label, 'n': len(done), 'outcome_share': round(sum(outcome_fn(c) for c in done) / len(done), 3), 'truth_table': rows, 'sufficient': list(uniq.values())}
    out['qca'] = {'peaceful_independence': qca(lambda c: int(c['end_kind'] == 'indep' and not c['violent_end']), '戦争なしの独立'),
                  'annexation': qca(lambda c: int(c['end_kind'] == 'annexed'), '宗主への併合'),
                  'violent_end': qca(lambda c: int(c['violent_end']), '終わりに暴力')}

    # ---- 条件 → 型の家族 (AI の型の決め方の材料) ----
    cross = {}
    for c in cases:
        k = conds(c)
        key = f"far={k['far']},big={k['big']},culture={k['close_culture']},contiguous={k['contiguous']},maritime={k['maritime']}"
        cross.setdefault(key, Counter())[c['family']] += 1
    out['conditions_to_family'] = {k: dict(v) for k, v in sorted(cross.items(), key=lambda kv: -sum(kv[1].values()))}
    # 条件ごとの家族の割合 (1 条件ずつ)
    marg = {}
    for n in names:
        for v in (0, 1):
            cs = [c for c in cases if conds(c)[n] == v]
            marg[f'{n}={v}'] = {'n': len(cs), 'family_share': {f: round(sum(1 for c in cs if c['family'] == f) / len(cs), 2) for f in FAMILY_NAMES} if cs else {}}
    out['condition_marginals'] = marg

    with open(os.path.join(DERIVED, 'vassal_survival.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1, default=str)
    print('all km median', out['all']['km_median'], 'q', out['all']['km_q25_q75'])
    for t, r in out['by_type'].items():
        print(t, r['name'], 'n', r['n'], 'median', r['km_median'], 'viol', r['violent_end_share'], 'indep', r['indep_share'])
    for k, m in models.items():
        if 'terms' in m:
            print(k, [(x['name'], x['hr'], x['p']) for x in m['terms']])

if __name__ == '__main__':
    sys.exit(main())
