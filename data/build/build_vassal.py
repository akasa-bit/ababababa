#!/usr/bin/env python3
"""従属国の事例 (data/raw/vassal/) を加工して data/derived/vassal.json を作る (レーン H・セッション H2-1)。

- cases.csv (131 件、20 型) と、2 回別々に行った符号化 (coding_A.tsv: 型の順・型の説明つき、coding_B.tsv: 年代順・型を伏せて)
  の一致の度合い (Krippendorff の α、名義尺度) を、項目ごと・層ごとに出す
- 食い違った所の一覧 (disagreements) を出す。食い違いは 3 人目の裁定 (resolutions.tsv) で決め、一致した符号と合わせて事例ごとの最終の符号にする
- 始まり・終わりの年と終わり方を、ISD 2.2 (1816 年以降の国家) と ICOW (独立の年と暴力) に突き合わせる
- Lake 2009 の上下関係の指標 (1950〜2000 年) を、重なる事例ごとに平均する
- Seshat Equinox-2020 の政体の一覧から、1816 年より前の事例に当たる政体の年代を添える

使い方: python3 data/build/build_vassal.py   (pandas と openpyxl が要る)
"""
import csv, datetime, json, math, os, sys
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..')
RAW = os.path.join(ROOT, 'raw', 'vassal')
HIST = os.path.join(ROOT, 'raw', 'history')
OUT = os.path.join(ROOT, 'derived', 'vassal.json')
ITEMS = ['dip', 'mil', 'tax', 'law', 'appt', 'trade', 'rel', 'succ']
LAYERS = ['law', 'fact']
CODES = ['S', 'M', 'V']
NOW = 2026

def read_csv(path, delim=','):
    with open(path, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f, delimiter=delim))

def krippendorff_alpha_nominal(units):
    """units: list of lists of codes (各単位ごとの、符号者の値の一覧)。名義尺度の Krippendorff の α"""
    # Krippendorff (2011) の計算: 一致の行列 o_ck と、期待の行列 e_ck
    vals = sorted({v for u in units for v in u})
    idx = {v: i for i, v in enumerate(vals)}
    k = len(vals)
    o = [[0.0] * k for _ in range(k)]
    n_total = 0
    for u in units:
        m = len(u)
        if m < 2:
            continue
        n_total += m
        # 同じ単位の中のすべての順序つきの組を数える (Krippendorff 2011 の o_ck)
        for i in range(m):
            for j in range(m):
                if i != j:
                    o[idx[u[i]]][idx[u[j]]] += 1.0 / (m - 1)
    if n_total == 0:
        return None
    n_c = [sum(o[c]) for c in range(k)]
    do = sum(o[c][d] for c in range(k) for d in range(k) if c != d)
    de = sum(n_c[c] * n_c[d] for c in range(k) for d in range(k) if c != d) / (n_total - 1)
    if de == 0:
        return 1.0
    return 1 - do / de

def main():
    cases = read_csv(os.path.join(RAW, 'cases.csv'))
    by_id = {c['case_id']: c for c in cases}
    out = {'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'n_cases': len(cases), 'types': {}, 'items': ITEMS, 'layers': LAYERS}
    for c in cases:
        t = out['types'].setdefault(c['type_id'], {'name': c['type_name'], 'n': 0})
        t['n'] += 1

    # ---- 2 回の符号化と一致の度合い ----
    codings = {}
    pa = os.path.join(RAW, 'coding_A.tsv'); pb = os.path.join(RAW, 'coding_B.tsv')
    if os.path.exists(pa):
        codings['A'] = {r['case_id']: r for r in read_csv(pa, '\t')}
    if os.path.exists(pb):
        ids = {r['b_id']: r['case_id'] for r in read_csv(os.path.join(RAW, 'coding_B_ids.csv'))}
        codings['B'] = {ids.get(r['case_id'], r['case_id']): r for r in read_csv(pb, '\t')}
    agreement = {}
    disagreements = []
    if len(codings) == 2:
        A, B = codings['A'], codings['B']
        common = [cid for cid in by_id if cid in A and cid in B]
        agreement['n_cases'] = len(common)
        per = {}
        all_units = []
        for layer in LAYERS:
            for it in ITEMS:
                col = f'{layer}_{it}'
                units = [[A[cid][col].strip().upper(), B[cid][col].strip().upper()] for cid in common
                         if A[cid][col].strip().upper() in CODES and B[cid][col].strip().upper() in CODES]
                all_units += units
                agree = sum(1 for u in units if u[0] == u[1])
                per[col] = {'n': len(units), 'percent_agreement': round(agree / len(units), 3) if units else None,
                            'alpha': round(krippendorff_alpha_nominal(units), 3) if units else None}
                for cid in common:
                    a, b = A[cid][col].strip().upper(), B[cid][col].strip().upper()
                    if a != b:
                        disagreements.append({'case_id': cid, 'name': by_id[cid]['name_ja'], 'type_id': by_id[cid]['type_id'], 'code': col, 'A': a, 'B': b})
        agreement['per_code'] = per
        agreement['overall'] = {'n': len(all_units), 'percent_agreement': round(sum(1 for u in all_units if u[0] == u[1]) / len(all_units), 3),
                                'alpha': round(krippendorff_alpha_nominal(all_units), 3)}
        for layer in LAYERS:
            units = []
            for it in ITEMS:
                col = f'{layer}_{it}'
                units += [[A[cid][col].strip().upper(), B[cid][col].strip().upper()] for cid in common
                          if A[cid][col].strip().upper() in CODES and B[cid][col].strip().upper() in CODES]
            agreement[f'layer_{layer}'] = {'n': len(units), 'alpha': round(krippendorff_alpha_nominal(units), 3)}
        agreement['verified'] = {k: sum(1 for r in v.values() if r.get('verified', '').strip().upper() == 'Y') for k, v in codings.items()}
        # 型ごとの一致 (B は型を伏せたので、型の名前が符号を引っ張っていないかの目安)
        bt = {}
        for tid in out['types']:
            units = []
            for cid in common:
                if by_id[cid]['type_id'] != tid:
                    continue
                for layer in LAYERS:
                    for it in ITEMS:
                        col = f'{layer}_{it}'
                        a, b = A[cid][col].strip().upper(), B[cid][col].strip().upper()
                        if a in CODES and b in CODES:
                            units.append([a, b])
            bt[tid] = {'n': len(units), 'percent_agreement': round(sum(1 for u in units if u[0] == u[1]) / len(units), 3) if units else None}
        agreement['by_type'] = bt
    out['agreement'] = agreement
    out['disagreements'] = disagreements

    # ---- 最終の符号: 2 人の一致した符号 + 食い違いの裁定 (resolutions.tsv) ----
    final = None
    pr = os.path.join(RAW, 'resolutions.tsv')
    if len(codings) == 2 and os.path.exists(pr):
        res = {(r['case_id'], r['code']): r for r in read_csv(pr, '\t')}
        final, missing = {}, []
        for cid in by_id:
            row = {}
            for layer in LAYERS:
                for it in ITEMS:
                    col = f'{layer}_{it}'
                    a, b = codings['A'][cid][col].strip().upper(), codings['B'][cid][col].strip().upper()
                    if a == b:
                        row[col] = a
                    elif (cid, col) in res and res[(cid, col)]['final'].strip().upper() in CODES:
                        row[col] = res[(cid, col)]['final'].strip().upper()
                    else:
                        missing.append((cid, col)); row[col] = a
            final[cid] = row
        rv = list(res.values())
        agreement['resolution'] = {'n': len(rv), 'took_A': sum(1 for r in rv if r['final'] == r['A']), 'took_B': sum(1 for r in rv if r['final'] == r['B']),
                                   'third_value': sum(1 for r in rv if r['final'] not in (r['A'], r['B'])), 'uncertain': sum(1 for r in rv if '不確か' in r['reason']),
                                   'missing': missing}
    out['final_coding_available'] = final is not None

    # ---- 事例ごとの出力 ----
    recs = []
    for c in cases:
        start, end = int(c['start']), int(c['end'])
        cont = c['end_kind'] == 'continuing'
        rec = {'case_id': c['case_id'], 'type_id': c['type_id'], 'name': c['name_ja'], 'polity': c['polity'], 'suzerain': c['suzerain'],
               'start': start, 'end': None if cont else end, 'duration': (NOW - start) if cont else (end - start), 'censored': cont,
               'end_kind': c['end_kind'], 'violent_end': c['violent_end'] == 'Y'}
        src = final[c['case_id']] if final and c['case_id'] in final else (codings.get('A', {}).get(c['case_id']))
        if src:
            rec['bundle'] = {layer: {it: src[f'{layer}_{it}'].strip().upper() for it in ITEMS} for layer in LAYERS}
            rec['bundle_source'] = 'final' if final and c['case_id'] in final else 'A (provisional)'
            gap = sum(1 for it in ITEMS if rec['bundle']['law'][it] != rec['bundle']['fact'][it])
            rec['law_fact_gap'] = gap
            rec['v_count'] = {layer: sum(1 for it in ITEMS if rec['bundle'][layer][it] == 'V') for layer in LAYERS}
        recs.append(rec)
    out['cases'] = recs

    # ---- 型ごとのまとめ (束の最頻の符号、年数) ----
    for tid, t in out['types'].items():
        rs = [r for r in recs if r['type_id'] == tid]
        t['durations'] = sorted(r['duration'] for r in rs)
        t['n_censored'] = sum(1 for r in rs if r['censored'])
        t['end_kinds'] = dict(Counter(r['end_kind'] for r in rs))
        t['war_at_end_share'] = round(sum(1 for r in rs if r['violent_end']) / len(rs), 3)
        if all('bundle' in r for r in rs):
            t['modal_bundle'] = {layer: {it: Counter(r['bundle'][layer][it] for r in rs).most_common(1)[0][0] for it in ITEMS} for layer in LAYERS}
            t['mean_gap'] = round(sum(r['law_fact_gap'] for r in rs) / len(rs), 2)

    # ---- ISD との突き合わせ (1816 年以降の事例) ----
    checks = {'isd': [], 'icow': []}
    try:
        import pandas as pd
        isd = pd.read_excel(os.path.join(RAW, 'isd_2_2_update.xlsx'))
        isd_map = {  # case_id → ISD の StateName (部分一致)
            'T01-02': 'Korea', 'T01-03': 'Ryukyu', 'T01-04': 'Vietnam', 'T01-05': 'Siam', 'T01-06': 'Burma',
            'T02-01': 'Mongolia', 'T02-03': 'Tibet', 'T03-01': 'Tunisia', 'T03-02': 'Morocco', 'T03-03': 'Korea', 'T03-04': 'Egypt',
            'T03-05': 'Tonga', 'T03-06': 'Cambodia', 'T03-07': 'Bukhara', 'T03-08': 'Madagascar', 'T04-01': 'Hyderabad', 'T04-02': 'Mysore',
            'T04-03': 'Awadh', 'T04-04': 'Baroda', 'T04-05': 'Perak', 'T04-06': 'Sokoto', 'T04-07': 'Buganda', 'T04-08': 'Barotse',
            'T05-01': 'Canada', 'T05-02': 'Australia', 'T05-03': 'New Zealand', 'T05-04': 'South Africa', 'T05-05': 'Newfoundland',
            'T05-06': 'Ireland', 'T05-07': 'India', 'T06-01': 'Iraq', 'T06-03': 'Jordan', 'T06-04': 'Syria', 'T06-05': 'Lebanon',
            'T07-01': 'Tanzania', 'T07-03': 'Namibia', 'T07-05': 'Nauru', 'T07-06': 'Samoa', 'T08-01': 'Sudan', 'T08-02': 'Vanuatu',
            'T08-05': 'Andorra', 'T10-01': 'Manchukuo', 'T10-04': 'Slovakia', 'T10-05': 'Croatia', 'T11-01': 'Poland', 'T11-02': 'Hungary',
            'T11-03': 'Czechoslovakia', 'T11-04': 'German Democratic', 'T11-05': 'Romania', 'T11-06': 'Mongolia', 'T11-07': 'Albania',
            'T12-01': 'Marshall', 'T12-02': 'Micronesia', 'T12-03': 'Palau', 'T12-06': 'Grenada', 'T12-07': 'Dominica',
            'T15-01': 'Hanover', 'T15-05': 'Norway', 'T15-06': 'Austria', 'T16-01': 'Afghanistan', 'T16-02': 'Nepal', 'T16-03': 'Tibet',
            'T16-04': 'Belgium', 'T16-05': 'Luxembourg', 'T16-06': 'Persia', 'T17-01': 'China', 'T17-02': 'Japan', 'T17-03': 'Ottoman',
            'T17-04': 'Siam', 'T17-05': 'Persia', 'T17-06': 'Korea', 'T17-07': 'Morocco', 'T18-01': 'Wallachia', 'T18-02': 'Moldavia',
            'T18-03': 'Serbia', 'T18-06': 'Egypt', 'T18-07': 'Bulgaria', 'T19-01': 'Cuba', 'T19-02': 'Panama', 'T19-03': 'Dominican',
            'T19-04': 'Haiti', 'T19-05': 'Nicaragua', 'T20-03': 'Philippines', 'T20-05': 'Indonesia', 'T20-06': 'Kenya',
        }
        def year(v):
            try:
                return int(str(v).split('-')[-1]) if '-' in str(v) else int(float(v))
            except Exception:
                return None
        for cid, key in isd_map.items():
            c = by_id[cid]
            m = isd[isd['StateName'].astype(str).str.contains(key, case=False, na=False) | isd['OtherName'].astype(str).str.contains(key, case=False, na=False)]
            rows = []
            for _, r in m.iterrows():
                rows.append({'state': str(r['StateName']), 'start': year(r['Start']), 'end': year(r['End']), 'start_type': int(r['StartType']) if r['StartType'] == r['StartType'] else None,
                             'end_type': int(r['EndType']) if r['EndType'] == r['EndType'] else None, 'vio_start': int(r['VioStart']), 'vio_end': int(r['VioEnd']),
                             'sovereignty_ambiguous': int(r['Sovereignty_Am']), 'category': int(r['ISD_Category']) if r['ISD_Category'] == r['ISD_Category'] else None})
            checks['isd'].append({'case_id': cid, 'name': c['name_ja'], 'case_start': int(c['start']), 'case_end': int(c['end']), 'end_kind': c['end_kind'], 'isd': rows[:4]})
    except Exception as e:  # pandas がないときは飛ばす
        checks['isd_error'] = str(e)

    # ---- ICOW との突き合わせ (独立で終わった事例) ----
    icow = read_csv(os.path.join(HIST, 'icow_colhist.csv'))
    icow_map = {'T03-01': 'Tunisia', 'T03-02': 'Morocco', 'T03-04': 'Egypt', 'T03-05': 'Tonga', 'T03-06': 'Cambodia', 'T05-01': 'Canada', 'T05-02': 'Australia',
                'T05-03': 'New Zealand', 'T05-04': 'South Africa', 'T05-06': 'Ireland', 'T05-07': 'India', 'T06-01': 'Iraq', 'T06-02': 'Israel', 'T06-03': 'Jordan',
                'T06-04': 'Syria', 'T06-05': 'Lebanon', 'T07-01': 'Tanzania', 'T07-02': 'Rwanda', 'T07-03': 'Namibia', 'T07-05': 'Nauru', 'T07-06': 'Samoa',
                'T08-01': 'Sudan', 'T08-02': 'Vanuatu', 'T12-01': 'Marshall', 'T12-02': 'Micronesia', 'T12-03': 'Palau', 'T12-06': 'Grenada', 'T12-07': 'Dominica',
                'T16-01': 'Afghanistan', 'T16-02': 'Nepal', 'T18-01': 'Romania', 'T18-03': 'Serbia', 'T18-07': 'Bulgaria', 'T19-01': 'Cuba', 'T19-02': 'Panama',
                'T20-01': 'Algeria', 'T20-02': 'Ghana', 'T20-03': 'Philippines', 'T20-05': 'Indonesia', 'T20-06': 'Kenya'}
    for cid, key in icow_map.items():
        c = by_id[cid]
        m = [r for r in icow if r['Name'].lower() == key.lower()] or [r for r in icow if r['Name'].lower().startswith(key.lower())]
        rows = [{'name': r['Name'], 'ind_from': r['IndFrom'], 'ind_date': r['IndDate'], 'ind_viol': r['IndViol'], 'ind_type': r['IndType']} for r in m[:2]]
        same_event = bool(rows) and rows[0]['ind_date'] not in ('-9', '') and abs(int(rows[0]['ind_date'][:4]) - int(c['end'])) <= 3
        checks['icow'].append({'case_id': cid, 'name': c['name_ja'], 'case_end': int(c['end']), 'violent_end': c['violent_end'], 'same_event': same_event, 'icow': rows})
    # 突き合わせの要約: ICOW が同じ出来事 (独立の年が ±3 年) を載せている事例で、暴力の符号が一致するか
    agree = tot = 0
    mism = []
    for ch in checks['icow']:
        if ch['same_event'] and ch['icow'][0]['ind_viol'] in ('0', '1'):
            tot += 1
            ok = (ch['icow'][0]['ind_viol'] == '1') == (ch['violent_end'] == 'Y')
            agree += int(ok)
            if not ok:
                mism.append(ch['case_id'])
    checks['icow_violence_agreement'] = {'n_same_event': tot, 'agree': agree, 'mismatch': mism}
    out['checks'] = checks

    # ---- Lake 2009 の指標 (1950〜2000 年に重なる事例) ----
    try:
        import pandas as pd
        lake = pd.read_stata(os.path.join(RAW, 'lake_hir_country_year.dta'))
        ccode = {'T11-01': 290, 'T11-02': 310, 'T11-03': 315, 'T11-04': 265, 'T11-05': 360, 'T11-06': 712, 'T11-07': 339,
                 'T12-01': 983, 'T12-02': 987, 'T12-03': 986, 'T19-01': 40, 'T19-02': 95, 'T19-03': 42, 'T19-04': 41, 'T19-05': 93,
                 'T16-01': 700, 'T16-02': 790, 'T17-01': 710, 'T17-02': 740}
        lk = []
        for cid, cc in ccode.items():
            c = by_id[cid]
            s, e = max(int(c['start']), 1950), min(int(c['end']), 2000)
            sub = lake[(lake['ccode'] == cc) & (lake['year'] >= s) & (lake['year'] <= e)]
            if len(sub):
                lk.append({'case_id': cid, 'name': c['name_ja'], 'years': [s, e], 'n_years': int(len(sub)),
                           'us_security_hierarchy_mean': round(float(sub['us_SH1995'].mean()), 3) if sub['us_SH1995'].notna().any() else None,
                           'us_economic_hierarchy_mean': round(float(sub['us_EH1995'].mean()), 3) if sub['us_EH1995'].notna().any() else None,
                           'warsaw_pact_share': round(float(sub['warsaw'].mean()), 3) if 'warsaw' in sub else None})
        # 比べる基準: 全体の分布
        allv = lake[['us_SH1995', 'us_EH1995']].dropna()
        out['lake'] = {'cases': lk, 'all_country_years': {'n': int(len(allv)), 'security_q': [round(float(allv['us_SH1995'].quantile(q)), 3) for q in (0.1, 0.5, 0.9)],
                                                          'economic_q': [round(float(allv['us_EH1995'].quantile(q)), 3) for q in (0.1, 0.5, 0.9)]},
                       'note': 'Lake 2009 の指標は米に対する上下関係だけ。ソ連の衛星国には米の指標は低く出るので、衛星国の実態は warsaw (ワルシャワ条約の加盟) で見る'}
    except Exception as e:
        out['lake_error'] = str(e)

    # ---- Seshat の政体 (1816 年より前の事例の年代の文脈) ----
    try:
        import pandas as pd
        pol = pd.read_excel(os.path.join(RAW, 'seshat_equinox_2020.xlsx'), sheet_name='Polities')
        keys = {'T01': ['Ming', 'Qing', 'Chosun', 'Joseon', 'Ryukyu'], 'T13': ['Carolingian', 'Capetian', 'Norman', 'Burgund', 'Papal', 'Scotland', 'Wales', 'Portugal'],
                'T14': ['Tokugawa', 'Japan'], 'T15': ['Lithuania', 'Poland', 'Habsburg', 'Denmark', 'Sweden'], 'T18': ['Ottoman', 'Crimea', 'Ragusa', 'Wallachia'], 'T09': ['Mughal', 'Dutch']}
        ss = {}
        for tid, ks in keys.items():
            rows = []
            for k in ks:
                for _, r in pol[pol['PolName'].astype(str).str.contains(k, case=False, na=False)].iterrows():
                    rows.append({'polity': str(r['PolName']), 'id': str(r['PolID']), 'start': int(r['Start']), 'end': int(r['End'])})
            ss[tid] = rows[:12]
        out['seshat_polities'] = {'note': 'Equinox-2020 の政体の一覧 (Polities) で、事例の宗主か従属国に当たる政体の年代。上位政体との関係の符号は Equinox には入っていない', 'by_type': ss}
    except Exception as e:
        out['seshat_error'] = str(e)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('cases', len(recs), '| agreement', json.dumps(agreement.get('overall'), ensure_ascii=False), '| disagreements', len(disagreements),
          '| icow violence agree', checks['icow_violence_agreement'])

if __name__ == '__main__':
    sys.exit(main())
