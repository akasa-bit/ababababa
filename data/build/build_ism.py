#!/usr/bin/env python3
"""星間の気体の柱密度から、航路の前面に当たる核子の数密度を決める。docs/physics.md の 2。

入力: data/raw/ism/linsky2019_tab2.tex (近くの星 62 本の視線の log N(H I)。HST の紫外線の吸収)
出力: data/derived/ism.json

考え方 (Linsky ほか 2019 と同じ前提):
  - 雲 (局所星間雲 LIC と、近くの雲 G・Aql・Blue など) の中は、中性水素 n(H I) = 0.20 /cm³・電離した水素 n(H II) = 0.07 /cm³
    (Slavin & Frisch 2008。ヘリオスフェアに流れこむ中性原子の観測と、電離の平衡の計算)、ヘリウム He/H = 0.1 (個数)。
  - 視線のうち雲の中を通る長さ = N(H I) ÷ n(H I)。残り (雲の外) は、電離した温かい気体で、雲と圧力がつり合う:
    (n_p + n_e + n_He) T = 2710 K/cm³、T = 4 万 K (Linsky ほか 2019 の 7)。
  - 塵: 局所星間雲の塵の質量密度 (2.1 ± 0.6)×10⁻²⁴ kg/m³ (Krüger ほか 2015、Ulysses の 16 年の直接の測定)。雲の中だけにあるとする。
  - 船の前面に当たるのは原子核 (陽子と、ヘリウムの原子核の 4 核子)。光速近くでは、塵の粒も核子の集まりとして当たるので、核子の数で足す。
ゲームの地図は太陽から 16.5 pc (53.8 光年) 以内なので、その範囲の視線だけを使う。
"""
import json, math, os, re, statistics

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'raw', 'ism', 'linsky2019_tab2.tex')
OUT = os.path.join(HERE, '..', 'derived', 'ism.json')
SRC = os.path.join(HERE, '..', '..', 'src', 'ship', 'physics.js')  # src/index.html を分けたあとの、区切りのあるファイル (回 R3)
PC_CM = 3.0857e18
N_HI = 0.20      # 雲の中の中性水素 [/cm³] (Slavin & Frisch 2008)
N_HII = 0.07     # 雲の中の電離した水素 [/cm³] (同)
HE_H = 0.10      # ヘリウムと水素の個数の比 (Linsky ほか 2019 の圧力の式)
P_K = 2710.0     # 雲の圧力 (n_HI + n_e + n_p + n_He) T [K/cm³] (同)
T_IC = 4.0e4     # 雲の外の電離した気体の温度 [K] (同。圧力がつり合うとしたとき)
T_IC_RANGE = (2.0e4, 1.0e6)  # 幅: 温かい電離気体 〜 局所泡の熱い気体
DUST_KG_M3 = (2.1e-24, 0.6e-24)  # 塵の質量密度 (Krüger ほか 2015)
M_U = 1.66054e-27  # 原子質量単位 [kg] (核子 1 個の質量の目安)
MAP_PC = 16.5

def rows():
    tex = open(RAW, encoding='utf8').read()
    body = tex[tex.index('\\startdata') + len('\\startdata'):tex.index('\\enddata')]
    for rec in body.split('\\\\'):
        rec = ' '.join(rec.split())
        if not rec: continue
        f = [x.strip() for x in rec.split('&')]
        if len(f) < 10: continue
        notes = ''.join(re.findall(r'\\tablenotemark\{([a-e,]+)\}', rec))
        num = lambda s: float(re.sub(r'\\tablenotemark\{[^}]*\}', '', s).replace('$', '').replace('--', '-').split('\\pm')[0].strip())
        yield {'star': re.sub(r'[${}\\]', '', f[0]).strip(), 'l': num(f[2]), 'b': num(f[3]), 'd': num(f[4]), 'ion': f[7],
               'logN': num(f[9]), 'notes': notes}

def nucleons(f_cloud, t_ic=T_IC, dust=DUST_KG_M3[0]):
    """雲の中を通る割合 f_cloud の航路の、平均の核子の数密度 [/cm³] と内訳"""
    cloud = (N_HI + N_HII) * (1 + 4 * HE_H)
    # 雲の外: 水素とヘリウムが全部電離 → 粒子の数 = n_p (1 + He/H) + n_e、n_e = n_p (1 + 2 He/H)
    n_p_ic = P_K / (t_ic * (2 + 3 * HE_H))
    ic = n_p_ic * (1 + 4 * HE_H)
    dust_n = dust / M_U * 1e-6  # [/cm³]
    return {'cloud': cloud, 'intercloud': ic, 'dust': dust_n, 'n_p_intercloud': n_p_ic,
            'total': f_cloud * (cloud + dust_n) + (1 - f_cloud) * ic}

def main():
    seen, use = set(), []
    for r in rows():
        if r['star'] in seen: continue
        if any(c in r['notes'] for c in 'bcd'): continue  # 論文で外した視線と、Fe II を優先した Mg II の行
        seen.add(r['star']); use.append(r)
    near = [r for r in use if r['d'] <= MAP_PC]
    for r in near:
        r['N'] = 10 ** r['logN']
        r['f'] = r['N'] / (N_HI * r['d'] * PC_CM)  # 雲の中を通る割合
        r['nHI'] = r['N'] / (r['d'] * PC_CM)
    f_mean = sum(r['N'] for r in near) / (N_HI * PC_CM * sum(r['d'] for r in near))  # 長さで重みをつけた平均
    f_med = statistics.median(r['f'] for r in near)
    logs = [math.log10(r['nHI']) for r in near]
    best = nucleons(min(1, f_mean))
    lo = nucleons(min(1, f_mean), t_ic=T_IC_RANGE[1], dust=DUST_KG_M3[0] - DUST_KG_M3[1])
    hi = nucleons(min(1, max(r['f'] for r in near)), t_ic=T_IC_RANGE[0], dust=DUST_KG_M3[0] + DUST_KG_M3[1])
    out = {
        'source': 'Linsky, Redfield & Tilipman 2019 (ApJ 886, 41) の表 2、Slavin & Frisch 2008、Krüger ほか 2015',
        'sightlines': len(near), 'map_pc': MAP_PC,
        'f_cloud_mean': f_mean, 'f_cloud_median': f_med, 'f_cloud_range': [min(r['f'] for r in near), max(r['f'] for r in near)],
        'nHI_mean': f_mean * N_HI, 'log_nHI_sd': statistics.pstdev(logs),
        'n_nucleon': best['total'], 'n_nucleon_range': [lo['total'], hi['total']], 'parts': best,
        'assume': {'n_HI': N_HI, 'n_HII': N_HII, 'He_H': HE_H, 'P_K': P_K, 'T_ic': T_IC, 'T_ic_range': T_IC_RANGE, 'dust_kg_m3': DUST_KG_M3},
        'rows': [{k: r[k] for k in ('star', 'l', 'b', 'd', 'ion', 'logN', 'f')} for r in near],
    }
    json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)
    block = ('/* ISM:BEGIN (data/build/build_ism.py が書く。手で直さない) */\n'
             f'const ISM = {{ nNuc: {best["total"]:.4f} }}; // 航路で前面に当たる核子の平均の数密度 [/cm³] (近くの星 {len(near)} 本の視線の H I の柱密度から。data/derived/ism.json)\n'
             '/* ISM:END */')
    src = open(SRC, encoding='utf-8').read()
    if '/* ISM:BEGIN' in src:
        src = re.sub(r'/\* ISM:BEGIN.*?/\* ISM:END \*/', lambda m: block, src, flags=re.S)
        open(SRC, 'w', encoding='utf-8').write(src)
        print('src/ship/physics.js に書いた')
    print(f"視線 {len(near)} 本 (≤{MAP_PC} pc)・雲の中を通る割合 平均 {f_mean:.3f} (中央値 {f_med:.3f}、幅 {out['f_cloud_range'][0]:.3f}〜{out['f_cloud_range'][1]:.3f})")
    print(f"平均の n(H I) = {f_mean*N_HI:.4f} /cm³ (視線ごとの散らばり σ(log) = {out['log_nHI_sd']:.2f})")
    print(f"核子の数密度 = {best['total']:.4f} /cm³ (雲 {best['cloud']:.3f}・雲の外 {best['intercloud']:.4f}・塵 {best['dust']:.5f})  幅 {lo['total']:.4f}〜{hi['total']:.4f}")

if __name__ == '__main__':
    main()
