#!/usr/bin/env python3
"""スウォームの太陽電池が、フレアの高エネルギー陽子で傷む割合を作る。docs/physics.md の 7。

入力: data/raw/pv/ (data/fetch/fetch_pv.py が取る)、data/derived/flares.json (星ごとの陽子)
出力: data/derived/pv.json、src/index.html の PV_DAMAGE:BEGIN〜PV_DAMAGE:END

やり方 (NRL の変位損傷の線量 DDD の方法。Summers ほか 1993・Messenger ほか 2001・Walters ほか 2004):
  1. 陽子のスペクトル: 全方向の積分のスペクトル F(>E) = F10 (E/10 MeV)^−ε、ε = 2.13 (フレアの陽子と同じ。Papaioannou ほか 2023 の中央値)。
     10 MeV より下も同じべきで 3 MeV まで延ばす (それより遅い陽子は 100 µm のカバーガラスで止まる。実際の陽子のスペクトルは低い所で平らになるので、少し多めに見積もる)。
     刻みは、エネルギー 3,000・向き 200 (ガラスをぎりぎり抜ける陽子の所で NIEL が急に大きくなるので細かく。6,000・400 と 1% で合う)
  2. カバーガラス 100 µm (セリウム入りのホウケイ酸ガラス 2.554 g/cm³ = 25.5 mg/cm²) を、表と裏 (同じ厚さの基板とする) から通る。
     等方の陽子なら、向き cosθ = μ の割合は μ によらず一様で、通る厚さは t/μ。抜けたときのエネルギーを、飛程の表 (NIST PSTAR のパイレックス) で出す
  3. 電池の接合での DDD = Σ (陽子の数 × その時のエネルギーの GaAs の NIEL) (SR-NIEL、Ed = 21 eV)
  4. 出力の残り RF = 1 − C log10(1 + DDD/Dx)。3 接合の電池 (Spectrolab 3J の Pmp): C = 0.27、Dx = 1.70×10⁹ MeV/g
     (Walters, Morton & Messenger 2004, NASA/TP-2004-213338 の表 3。陽子)
  5. 確かめ: 太陽の 1 AU (静止軌道) で、1 年の劣化を、静止軌道の 11 機の GaAs の太陽電池の実測 (年 0.44〜1.03%。Lohmeyer ほか 2018) と比べる
     (実測には紫外線・温度の上下・電子の分も入るので、陽子だけの計算はそれ以下になるはず)
"""
import bisect, json, math, os, re

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'pv')
OUT = os.path.join(HERE, '..', 'derived', 'pv.json')
SRC = os.path.join(HERE, '..', '..', 'src', 'index.html')
EPS = 2.13
GLASS = 100e-4 * 2.554  # [g/cm²]
C, DX = 0.27, 1.70e9
GEO_FLIGHT = (0.0044, 0.0103)  # GaAs の 1 年の劣化 (Lohmeyer ほか 2018)
LIFE = 15  # 素子を取り替えるまでの年数 (静止衛星の設計寿命の目安)

def table(path, cols):
    out = []
    for l in open(path, encoding='utf8'):
        f = l.split()
        if len(f) >= max(cols) + 1 and re.match(r'^\d\.\d+E?e?[+-]\d+$', f[0]):
            out.append(tuple(float(f[c]) for c in cols))
    return out

niel = table(os.path.join(RAW, 'srniel_proton_GaAs_Ed21.txt'), (0, 1))
rng = table(os.path.join(RAW, 'pstar_pyrex.txt'), (0, 4))  # T [MeV]・CSDA の飛程 [g/cm²]

def interp_log(x, xs, ys):
    if x <= xs[0]: return ys[0]
    if x >= xs[-1]: return ys[-1]
    i = bisect.bisect_right(xs, x) - 1
    t = (math.log(x) - math.log(xs[i])) / (math.log(xs[i + 1]) - math.log(xs[i]))
    return math.exp(math.log(ys[i]) + t * (math.log(ys[i + 1]) - math.log(ys[i])))

NE, NR = [e for e, _ in niel], [n for _, n in niel]
RE, RR = [e for e, _ in rng], [r for _, r in rng]

def after_glass(E, t):
    R = interp_log(E, RE, RR) - t
    return interp_log(R, RR, RE) if R > RR[0] else 0.0

def ddd_per_F10(eps=EPS, glass=GLASS, Emin=3.0, Emax=1e4, NEb=3000, NMU=200):
    """全方向のフルエンス F(>10 MeV) 1 /cm² あたりの、接合での DDD [MeV/g]"""
    tot = 0.0
    lo, hi = math.log(Emin), math.log(Emax)
    for i in range(NEb):
        E = math.exp(lo + (i + 0.5) * (hi - lo) / NEb); dE = E * (hi - lo) / NEb
        f = eps / 10 * (E / 10) ** (-eps - 1)  # −dF/dE (F(>10) = 1)
        acc = 0.0
        for j in range(NMU):
            mu = (j + 0.5) / NMU
            Eo = after_glass(E, glass / mu)
            if Eo > 0: acc += interp_log(Eo, NE, NR) / NMU
        tot += f * dE * acc  # 表と裏の半分ずつ (全方向のフルエンスの 1/2 ずつ) で、足して 1 倍
    return tot

def rf(D): return max(0.0, 1 - C * math.log10(1 + D / DX))

def rf_avg(rate, life=LIFE, n=200):
    """1 年に rate [MeV/g] ずつ傷む素子を life 年ごとに取り替えるときの、平均の出力の残り"""
    return sum(rf(rate * life * (k + 0.5) / n) for k in range(n)) / n

def main():
    k = ddd_per_F10()
    ddd_by = {str(um): float(f'{ddd_per_F10(glass=um * 1e-4 * 2.554):.4g}') for um in (100, 300, 1000, 3000)}
    fl = json.load(open(os.path.join(HERE, '..', 'derived', 'flares.json')))
    sun = fl['game']['sun']
    geo = 1 - rf(sun * k)  # 1 AU の 1 年 (スウォームの素子は、地球と同じ明るさの距離 √L AU に置く: 1 AU)
    sens = {'glass_150um': ddd_per_F10(glass=150e-4 * 2.554) / k, 'eps_1.78': ddd_per_F10(eps=1.78) / k, 'converge_6000x400': ddd_per_F10(NEb=6000, NMU=400) / k}
    stars = []
    for r in fl['stars']:
        lum = None
        stars.append({'cat': r['cat'], 'star': r['star'], 'F10_1AU': r['F10_1AU_per_yr']})
    res = {'ddd_per_F10': k, 'ddd_by_glass_um': ddd_by, 'C': C, 'Dx': DX, 'glass_g_cm2': GLASS, 'eps': EPS, 'life_years': LIFE,
           'sun_1AU_per_year_loss': geo, 'geo_flight_range': GEO_FLIGHT, 'sensitivity': sens}
    json.dump(res, open(OUT, 'w'), indent=1, ensure_ascii=False)
    block = ('/* PV_DAMAGE:BEGIN (data/build/build_pv.py が書く。手で直さない) */\n'
             f'// スウォームの太陽電池: 全方向の F(>10 MeV) 1 /cm² あたりの接合の変位損傷の線量 ddd [MeV/g] を、カバーガラスの厚さ [µm] ごとに (ε = {EPS})。\n'
             '// 出力の残り = 1 − C log10(1 + DDD/Dx) (3 接合の電池。Walters ほか 2004)。使う厚さは glass、素子は life 年ごとに取り替える (設定の選択。docs/physics.md の 7)\n'
             'const PV_DAMAGE = ' + json.dumps({'ddd': ddd_by, 'glass': 100, 'C': C, 'Dx': DX, 'life': LIFE}, separators=(',', ':')) + ';\n/* PV_DAMAGE:END */')
    src = open(SRC, encoding='utf-8').read()
    if '/* PV_DAMAGE:BEGIN' in src:
        src = re.sub(r'/\* PV_DAMAGE:BEGIN.*?/\* PV_DAMAGE:END \*/', lambda m: block, src, flags=re.S)
        open(SRC, 'w', encoding='utf-8').write(src)
        print('src/index.html に書いた')
    print(f'F(>10 MeV) 1 /cm² あたりの DDD = {k:.3e} MeV/g (カバーガラス 150 µm で ×{sens["glass_150um"]:.2f}・ε 1.78 で ×{sens["eps_1.78"]:.2f}・刻みを倍にして ×{sens["converge_6000x400"]:.3f})')
    print(f'太陽の 1 AU: 1 年に F10 {sun:.2e} /cm² → 出力の劣化 {100*geo:.3f}%/年 (静止軌道の GaAs の実測 {100*GEO_FLIGHT[0]:.2f}〜{100*GEO_FLIGHT[1]:.2f}%/年。陽子のほかの原因も入る)')
    for F in (1e10, 1e11, 1e12, 1e13, 1e14, 1e15):
        print(f'  スウォームの軌道で 1 年 F10 = {F:.0e}: 平均の出力の残り (15 年で取り替え) {rf_avg(F * k):.3f}')

if __name__ == '__main__':
    main()
