#!/usr/bin/env python3
"""遮蔽のほかの物理を見積もり、ゲームに入れるかを数字で決める。docs/physics.md の 4。
出力: data/derived/physics_checks.json

  1. 熱: 船から見た前面のエネルギーの流れ = γ n β c × (γ−1) m_p c²。放射で捨てるときの温度
  2. 気体の抵抗: 1 便で前面 1 cm² が受け止める気体の質量 ÷ 遮蔽の面密度 (= 速さが落ちる割合の目安)
  3. 横から来る銀河宇宙線: 銀河で等方的な宇宙線を船の系に直す (I'(p') = (p'/p)² I(p)、E = γ(E' + β p'_z c))。
     横の壁 (法線が進む向きに垂直) を通る流れを、銀河の系で同じ壁を通る流れと比べ、火星探査機 MSL の巡航で測った線量率に掛ける
  4. レーザーの回折: 送光口 D_t・帆 D_s・波長 λ のとき、帆に当たる割合 = 円い開口の Airy の環の中のエネルギー 1 − J0²(v) − J1²(v)、
     v = π D_t D_s / (2 λ x)。一定の (船の) 加速度 a で 0.95c まで加速するあいだの、光の要る量で重みをつけた平均。PROP.beam = 0.8 に要る D_t D_s
  5. 加速にかかる時間: 一定の加速度 a なら 0.95c まで t = (c/a) γβ、進む距離 (c²/a)(γ−1)。0.95c のまま飛ぶとした今の年数との差
"""
import json, math, os

HERE = os.path.dirname(__file__)
ISM = json.load(open(os.path.join(HERE, '..', 'derived', 'ism.json')))
C = 2.99792458e10  # cm/s
MP_MEV = 938.272
MEV_J = 1.602176634e-13
SIGMA_SB = 5.670374e-8
LY_CM = 9.4607e17
YEAR_S = 31557600
n = ISM['n_nucleon']

def gamma(b): return 1 / math.sqrt(1 - b * b)

def heat(beta):
    g = gamma(beta)
    q = g * n * beta * C * (g - 1) * MP_MEV * MEV_J * 1e4  # W/m²
    return {'beta': beta, 'W_m2': q, 'T_rad_K_eps09': (q / (0.9 * SIGMA_SB)) ** 0.25,
            'radiator_m2_per_m2_at_300K': q / (2 * 0.9 * SIGMA_SB * 300 ** 4)}

def drag(beta, ly=10, shield_gcm2=2000):
    swept = n * 1.66054e-24 * ly * LY_CM  # g/cm²
    return {'swept_g_cm2': swept, 'ratio_to_shield': swept / shield_gcm2}

def lis(E):
    """陽子の星間のスペクトル (Vos & Potgieter 2015, ApJ 815, 119)。E = 運動エネルギー [GeV]、[/(m² s sr MeV)]"""
    b2 = 1 - (MP_MEV / 1000 / (E + MP_MEV / 1000)) ** 2
    return 2.70 * E ** 1.12 / b2 * ((E + 0.67) / 1.67) ** -3.93

def side_gcr(beta, ecut_mev=150.0):
    """横の壁を通る、運動エネルギー ecut より上の陽子の流れ: 船の系 ÷ 銀河の系 (同じ壁が止まっているとき)"""
    g = gamma(beta); m = MP_MEV
    def flux_ship():
        tot = 0.0
        # 壁の法線を x 軸、進む向きを z 軸。入ってくる向き (n·u > 0) の半球で、cos を掛けて積分
        NE, NT, NP = 160, 90, 72
        lo, hi = math.log(ecut_mev), math.log(1e6)
        for i in range(NE):
            Ek = math.exp(lo + (i + 0.5) * (hi - lo) / NE); dE = Ek * (hi - lo) / NE
            Et = Ek + m; p = math.sqrt(Et * Et - m * m)
            for j in range(NT):
                th = (j + 0.5) * math.pi / NT  # z 軸からの角
                for k in range(NP):
                    ph = (k + 0.5) * 2 * math.pi / NP
                    ux = math.sin(th) * math.cos(ph)
                    if ux <= 0: continue
                    uz = math.cos(th)
                    Eg = g * (Et + beta * p * uz)  # 銀河の系の全エネルギー
                    pg = math.sqrt(Eg * Eg - m * m)
                    I = (p / pg) ** 2 * lis((Eg - m) / 1000)
                    tot += I * ux * math.sin(th) * (math.pi / NT) * (2 * math.pi / NP) * dE
        return tot
    def flux_gal():
        lo, hi = math.log(ecut_mev), math.log(1e6); NE = 400; tot = 0.0
        for i in range(NE):
            Ek = math.exp(lo + (i + 0.5) * (hi - lo) / NE); dE = Ek * (hi - lo) / NE
            tot += lis(Ek / 1000) * math.pi * dE  # 半球で cos を掛けた積分 = π
        return tot
    fs, fg = flux_ship(), flux_gal()
    proper_days_10ly = 10 * 365.25 / (g * beta)
    msl = 1.84e-3  # Sv/日 (MSL/RAD の火星への巡航。Zeitlin ほか 2013, Science 340, 1080)
    # 横の壁は前面の 4 × 細長さ (10) 倍の面積だが、等方の線量率は「どの向きからも来る」ときの値なので、比をそのまま掛ける (片側の半球の分)
    return {'beta': beta, 'ecut_MeV': ecut_mev, 'ratio_side_ship_over_gal': fs / fg,
            'proper_days_10ly': proper_days_10ly, 'msl_Sv_per_day': msl, 'side_dose_10ly_Sv': fs / fg * msl * proper_days_10ly}

def j0(x):
    # 第 1 種のベッセル関数 (級数と漸近形)
    if abs(x) < 8:
        s, t, k = 0.0, 1.0, 0
        while abs(t) > 1e-17 or k < 5:
            s += t; k += 1; t *= -(x * x / 4) / (k * k)
            if k > 200: break
        return s
    return math.sqrt(2 / (math.pi * x)) * math.cos(x - math.pi / 4)
def j1(x):
    if abs(x) < 8:
        s, t, k = 0.0, x / 2, 0
        while abs(t) > 1e-17 or k < 5:
            s += t; k += 1; t *= -(x * x / 4) / (k * (k + 1))
            if k > 200: break
        return s
    return math.sqrt(2 / (math.pi * x)) * math.cos(x - 3 * math.pi / 4)
def ee(v): return 1 - j0(v) ** 2 - j1(v) ** 2 if v > 0 else 0.0

def beam_eff(DtDs, a, beta_end=0.95, lam=1e-6):
    """一定の加速度 a [m/s²] で 0.95c まで。帆に要る光 dE ∝ d(γβ) (1+β)/(1−β) を重みに、当たる割合の調和平均"""
    c = C / 100; N = 4000; num = den = 0.0
    for i in range(N):
        b = (i + 0.5) * beta_end / N
        g = gamma(b)
        dgb = g ** 3 * beta_end / N  # d(γβ)/dβ = γ³
        w = dgb * (1 + b) / (1 - b)
        x = c * c / a * (g - 1)
        f = ee(math.pi * DtDs / (2 * lam * x)) if x > 0 else 1.0
        num += w; den += w / max(f, 1e-12)
    return num / den

def need_DtDs(a, target=0.8):
    lo, hi = 1e2, 1e18
    for _ in range(200):
        mid = math.sqrt(lo * hi)
        if beam_eff(mid, a) < target: lo = mid
        else: hi = mid
    return hi

def accel(a, beta=0.95):
    c = C / 100; g = gamma(beta)
    t = c / a * g * beta / YEAR_S; x = c * c / a * (g - 1) / (LY_CM / 100)
    return {'a_m_s2': a, 'years': t, 'ly': x, 'extra_years_per_end': t - x / beta}

def main():
    out = {'n_nucleon': n,
           'heat': [heat(0.95), heat(0.9)],
           'drag': drag(0.95),
           'side_gcr': [side_gcr(0.95), side_gcr(0.9)],
           'diffraction': [{'a_g': g_, 'DtDs_m2_for_beam_0.8': need_DtDs(9.80665 * g_)} for g_ in (1, 10)],
           'accel': [accel(9.80665 * g_) for g_ in (1, 10)]}
    json.dump(out, open(os.path.join(HERE, '..', 'derived', 'physics_checks.json'), 'w'), indent=1)
    h = out['heat'][0]
    print(f"熱 (0.95c): {h['W_m2']/1e3:.1f} kW/m²、放射の温度 {h['T_rad_K_eps09']:.0f} K、300 K で捨てる放熱板 前面の {h['radiator_m2_per_m2_at_300K']:.0f} 倍")
    print(f"気体の抵抗: 10 光年で {out['drag']['swept_g_cm2']:.2e} g/cm² (遮蔽 2000 g/cm² の {out['drag']['ratio_to_shield']:.1e})")
    for s in out['side_gcr']:
        print(f"横の宇宙線 ({s['beta']}c): 船の系 ÷ 銀河の系 {s['ratio_side_ship_over_gal']:.3f}、10 光年 (船の時間 {s['proper_days_10ly']:.0f} 日) で {s['side_dose_10ly_Sv']:.3f} Sv")
    for d in out['diffraction']:
        print(f"回折 ({d['a_g']}g): 帆に当たる割合 0.8 に要る 送光口 × 帆 = {d['DtDs_m2_for_beam_0.8']:.2e} m² (帆 1 km なら送光口 {d['DtDs_m2_for_beam_0.8']/1e3/1e3:.0f} km)")
    for a in out['accel']:
        print(f"加速 ({a['a_m_s2']/9.80665:.0f}g): {a['years']:.2f} 年・{a['ly']:.2f} 光年、片側で {a['extra_years_per_end']:.2f} 年遅れる")

if __name__ == '__main__':
    main()
