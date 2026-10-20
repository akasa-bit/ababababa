#!/usr/bin/env python3
"""研究の生産性の下がり方を、Bloom・Jones・Van Reenen・Webb 2020 (AER 110, 1104) の台本と同じ式で計算し直す (目標 R11 の幅の案)。

アイデアの生産関数: Ȧ/A = α × S (S = 実効の研究者の数)。研究の生産性 α = (Ȧ/A) ÷ S。
S は研究費を研究者の賃金で割ったもの。賃金は、論文の本文と同じく大卒 (4 年以上) の男性の平均所得 (CPS。WageSci/WageEducation.m、
抜けた年は対数で直線に埋める)。頑健性の確認として、1 人あたりの名目 GDP (WageSci/WageNominalGDP.m) でも計算する。
  - 全体 (Aggregate/AggregateBLSIPP.m): Ȧ/A = 米国の TFP の伸び (1930・40 年代は Gordon、1950 年代からは BLS。研究開発と知的財産の寄与を足し戻す)、
    研究費 = 知的財産への投資 (NIPA)。10 年ごとの幾何平均で比べる。
  - ムーアの法則 (MooresLaw/IntelGraph.m): Ȧ/A = 2 年で 2 倍 (35%/年) で一定、研究費 = 半導体の研究費 (6 つの定義。本文は「広い定義」)。
台本の数字は zip の中の .m に書き込まれている (公開の統計)。ここでは Matlab を使わず、同じ計算をする。

使い方: python3 data/build/build_ideas.py <置き場>   (置き場は data/fetch/fetch_ideas.py と同じ) → data/derived/ideas.json
"""
import json, math, os, re, sys, zipfile

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'derived', 'ideas.json')

def matrices(text):
    """Matlab の、行をまたぐ `名前=[ ... ];` (閉じかっこが行の頭) を読む。% から行末は注釈。'1929-01-01' のような日付は年にする。"""
    out = {}
    for m in re.finditer(r'^(\w+)\s*=\s*\[[ \t]*(?:%[^\n]*)?\n(.*?)^\s*\];', text, re.S | re.M):
        rows = []
        for line in m.group(2).split('\n'):
            line = re.sub(r'(\d{4})-\d{2}-\d{2}', r'\1', line.split('%')[0]).strip()
            if line:
                rows.append([float('nan') if v == 'NaN' else float(v) for v in line.split()])
        out[m.group(1)] = rows
    return out

def wage_college(z):
    text = z.read('WageSci/WageEducation.m').decode('latin-1')
    text = text.replace('90276*(90276/87681)', repr(90276 * 90276 / 87681))  # 台本の 2015 年の「大まかな見積もり」
    pts = sorted((int(r[0]), math.log(r[1])) for r in matrices(text)['eddata'])
    out = {}
    for (y0, a), (y1, b) in zip(pts, pts[1:]):
        for y in range(y0, y1 + 1):
            out[y] = math.exp(a + (b - a) * (y - y0) / (y1 - y0))
    return out

def wage_gdp(z):
    m = matrices(z.read('WageSci/WageNominalGDP.m').decode('latin-1'))
    gdp = {int(r[0]): r[1] for r in m['datagdp']}
    pop = {int(r[0]): r[1] for r in m['datapop']}
    return {y: gdp[y] * 1e9 / (pop[y] * 1e3) for y in gdp}

def aggregate(z, w):
    m = matrices(z.read('Aggregate/AggregateBLSIPP.m').decode('latin-1'))
    gordon = {int(r[0]): r[1] for r in m['Gordondata']}
    bls = m['blsdata']
    yrs = [int(r[0]) for r in bls]
    lvl = [r[1] for r in bls]
    def d(xs):
        return [math.log(b) - math.log(a) if a == a and b == b else 0.0 for a, b in zip(xs, xs[1:])]
    g = [a + b + c for a, b, c in zip(d(lvl), d([r[2] for r in bls]), d([r[3] for r in bls]))]
    idx = [lvl[0]]
    for x in g:
        idx.append(idx[-1] * math.exp(x))
    ends = [1950, 1960, 1970, 1980, 1990, 2000, 2014]
    at = {y: idx[yrs.index(y)] for y in ends}
    fixed = [100 * (math.log(at[b]) - math.log(at[a])) / (b - a) for a, b in zip(ends, ends[1:])]
    tfp = [gordon[1940], gordon[1950]] + fixed  # 1930 年代〜2000 年代の 8 つ
    # 研究費は 2 年遅らせる (台本の annualyrs = 年 + 2)
    rnd = {int(r[0]) + 2: r[4] for r in m['datarnd']}  # 5 列目 = 民間と政府の知的財産への投資の合計
    sci = {y: rnd[y] / w[y] * 1e9 for y in rnd if y in w}
    spans = [(1930, 1940), (1940, 1950), (1950, 1960), (1960, 1970), (1970, 1980), (1980, 1990), (1990, 2000), (2000, 2015)]
    S = []
    for a, b in spans:
        ys = [y for y in sci if a < y <= b]  # 台本の average(…, yrs − yr0) は (a, b] の年 (yr0 = 1928 から数えた番号)
        S.append(math.exp(sum(math.log(sci[y]) for y in ys) / len(ys)))
    S = [s / S[0] for s in S]
    idea = [t / s for t, s in zip(tfp, S)]
    idea = [x / idea[0] for x in idea]
    T = 0.5 * (2000 + 2015) - 0.5 * (1940 + 1930)
    return {'decades': [f'{a}s' for a, _ in spans], 'tfp_growth_pct': tfp, 'researchers_index': S, 'research_productivity_index': idea,
            'growth_researchers_pct': 100 * math.log(S[-1] / S[0]) / T, 'growth_research_productivity_pct': 100 * math.log(idea[-1] / idea[0]) / T,
            'factor_researchers': S[-1] / S[0], 'factor_productivity_decline': idea[0] / idea[-1]}

def moore(z, w):
    m = matrices(z.read('MooresLaw/IntelGraph.m').decode('latin-1'))
    rows = m['data']
    names = ['Narrow', 'Narrow (half)', 'Broad', 'Broad (half)', 'Intel only', 'Intel+AMD']
    y0, y1 = int(rows[0][0]), int(rows[-1][0])
    out = {}
    for k, name in enumerate(names):
        s0 = rows[0][1 + k] / w[y0]
        s1 = rows[-1][1 + k] / w[y1]
        g = 100 * math.log(s1 / s0) / (y1 - y0)
        out[name] = {'factor_researchers': s1 / s0, 'growth_researchers_pct': g, 'growth_research_productivity_pct': -g}
    return {'years': [y0, y1], 'idea_growth_pct': 100 * math.log(2) / 2, 'versions': out, 'baseline': 'Broad'}

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    with zipfile.ZipFile(os.path.join(sys.argv[1], 'IdeaPFPrograms.zip')) as z:
        w, wg = wage_college(z), wage_gdp(z)
        res = {'source': 'Bloom, Jones, Van Reenen & Webb 2020, AER 110(4) 1104-44。IdeaPFPrograms.zip の台本と同じ計算',
               'wage': '大卒の男性の平均所得 (CPS)', 'aggregate': aggregate(z, w), 'moore': moore(z, w),
               'robustness_gdp_per_person': {'aggregate': aggregate(z, wg), 'moore': moore(z, wg)},
               'paper': {'aggregate_growth_research_productivity_pct': -5.3, 'aggregate_factor_researchers': 23,
                         'moore_growth_research_productivity_pct': -6.8, 'moore_factor_researchers': 18}}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    a, mo = res['aggregate'], res['moore']['versions']['Broad']
    print(f"全体: 研究者 ×{a['factor_researchers']:.1f} (年 {a['growth_researchers_pct']:.1f}%)、研究の生産性 年 {a['growth_research_productivity_pct']:.2f}% (1/{a['factor_productivity_decline']:.0f})")
    print(f"ムーアの法則 (広い定義): 研究者 ×{mo['factor_researchers']:.1f}、研究の生産性 年 {mo['growth_research_productivity_pct']:.2f}%")

if __name__ == '__main__':
    sys.exit(main())
