#!/usr/bin/env python3
"""物理学者が SF の描写を物理で論じた事例 (P-6) をまとめる。

入力: data/raw/sf_critiques/ の 6 つの集め (人ごとに分けて集めた。どの事例も、確かめた出典の URL つき) と classified.json (事例ごとの分類)。
出力: data/derived/sf_critiques.json (事例ごとに分類を足したもの・選んだ事例・集計)。

選び方 (docs/sf-critiques.md):
  1. 物理学か天文学の研究者 (博士か教授) の指摘だけ (credential_ok)
  2. 今 (2026 年) の物理学の知見で、指摘の芯が正しいもの (second_opinion == 'valid')
  3. NoLongerUbiquitous に当てはまるか (game_relevance: applies_flaw = ゲームにも同じ欠点 / applies_ok = ゲームは正しく描いている / not_applicable = 描いていない)
"""
import json
import pathlib
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw/sf_critiques'
SETS = ['tyson_plait', 'krauss_kaku_thorne', 'siegel_sutter', 'games_allain', 'comics_books', 'east_asia']


def main():
    cases = []
    for s in SETS:
        for x in json.loads((RAW / f'{s}.json').read_text()):
            cases.append({**x, 'set': s})
    cls = json.loads((RAW / 'classified.json').read_text())
    assert len(cls) == len(cases), (len(cls), len(cases))
    for i, (x, c) in enumerate(zip(cases, cls)):
        assert c['i'] == i
        x.update({k: c[k] for k in ('second_opinion', 'disagree_reason', 'credential_ok', 'principle', 'game_relevance', 'audit_refs', 'edition', 'game_note')})
        x['id'] = i
    sel = [x for x in cases if x['credential_ok'] and x['second_opinion'] == 'valid']
    flaws = defaultdict(list)
    for x in sel:
        if x['game_relevance'] == 'applies_flaw':
            flaws[x['principle']].append(x['id'])
    summary = {
        'cases': len(cases),
        'credentialed': sum(x['credential_ok'] for x in cases),
        'status': Counter(x['second_opinion'] for x in cases),
        'medium': Counter(x['medium'] for x in cases),
        'selected': len(sel),
        'selected_relevance': Counter(x['game_relevance'] for x in sel),
        'selected_principle': Counter(x['principle'] for x in sel),
        'flaws_by_principle': dict(sorted(flaws.items(), key=lambda kv: -len(kv[1]))),
        'ok_by_principle': Counter(x['principle'] for x in sel if x['game_relevance'] == 'applies_ok'),
    }
    out = {'summary': summary, 'selected_ids': [x['id'] for x in sel], 'cases': cases}
    (ROOT / 'data/derived/sf_critiques.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
