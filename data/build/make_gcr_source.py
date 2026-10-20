#!/usr/bin/env python3
"""船の横の壁に入ってくる銀河宇宙線を、Geant4 の面の線源 (data/build/g4_shield.py の --source) にする。docs/physics.md の 4。

銀河の系で等方的な陽子の星間のスペクトル (Vos & Potgieter 2015, ApJ 815, 119) を、速さ β の船の系に直す:
  I'(E', 向き) = (p'/p)² I(E)、E (全エネルギー) = γ (E' + β p' c u_z)   (u_z = 船の系での粒子の向きの、進む向きの成分)
横の壁 (法線 = x) を内向きに通る粒子を、流れ (I' × u_x) に比べた確率で選ぶ。Geant4 の板の法線は z なので、u_x を z に回す。
原子核の種類は、同じ核子あたりのエネルギーで陽子と同じ形のスペクトルとし、個数の比 (Simpson 1983, Ann. Rev. Nucl. Part. Sci. 33, 323 の
1 GeV/核子 あたりの値を丸めた) で混ぜる: He 0.07、C〜S の代わりに O 0.007、Fe 0.00025。浅い所の線量当量は重い原子核が主になるので、
陽子だけでは足りない (MSL の巡航では、吸収線量の平均の線質係数 3.8)。
重み w の合計 = 壁 1 cm² を 1 秒に通る原子核の数。Geant4 の線量の出力は、そのまま 1 秒あたりの線量 (Gy/s・Sv/s) になる。

使い方: python3 data/build/make_gcr_source.py <β> <出力.npz> [粒子の数]
      python3 data/build/make_gcr_source.py sep <ε> <出力.npz> [粒子の数]
        … フレアの高エネルギー陽子: 積分のスペクトル F(>E) ∝ E^−ε (10 MeV〜20 GeV)、上の半球から等方に。
          重みの合計 = 1/4 (全方向のフルエンス F(>10 MeV) = 1 /cm² のとき、地面 1 cm² を通る数)。線量の出力は F(>10 MeV) 1 /cm² あたりになる
"""
import math, random, sys
import numpy as np

MP = 938.272  # MeV
MIX = [(2212, 1, 1.0), (1000020040, 4, 0.07), (1000080160, 16, 0.007), (1000260560, 56, 0.00025)]  # (PDG, 核子の数, 陽子に比べた個数)

def lis(E):
    """陽子の星間のスペクトル [/(m² s sr MeV)]、E = 運動エネルギー [GeV]"""
    b2 = 1 - (MP / 1000 / (E + MP / 1000)) ** 2
    return 2.70 * E ** 1.12 / b2 * ((E + 0.67) / 1.67) ** -3.93

def sep(eps, out, N):
    rng = random.Random(2)
    lo, hi = 10.0, 2e4
    rows = []
    for _ in range(N):
        # 積分のスペクトル F(>E) = (E/10)^−ε を、10 MeV〜20 GeV で切って逆に引く
        u = rng.random()
        Fhi = (hi / lo) ** -eps
        E = lo * (1 - u * (1 - Fhi)) ** (-1 / eps)
        mu = math.sqrt(rng.random())  # 面を通る向きは cosθ に比例 (等方の流れ)
        ph = 2 * math.pi * rng.random(); st = math.sqrt(1 - mu * mu)
        rows.append((2212, E, st * math.cos(ph), st * math.sin(ph), mu))
    r = np.array(rows)
    W = 0.25 * (1 - (hi / lo) ** -eps)
    np.savez(out, pdg=r[:, 0].astype(np.int64), ke=r[:, 1], ux=r[:, 2], uy=r[:, 3], uz=r[:, 4], w=np.full(N, W / N))
    print(f'フレアの陽子 ε={eps}: 粒子 {N}、平均 {r[:,1].mean():.0f} MeV、重みの合計 {W:.4f}')

def main():
    if sys.argv[1] == 'sep':
        return sep(float(sys.argv[2]), sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 200000)
    beta = float(sys.argv[1]); out = sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 200000
    g = 1 / math.sqrt(1 - beta * beta)
    NE, NT, NP = 120, 90, 72
    lo, hi = math.log(10.0), math.log(1e6)
    cells, wts = [], []
    for i in range(NE):
        a, b = lo + i * (hi - lo) / NE, lo + (i + 1) * (hi - lo) / NE
        Ek = math.exp((a + b) / 2); dE = math.exp(b) - math.exp(a)
        Et = Ek + MP; p = math.sqrt(Et * Et - MP * MP)
        for j in range(NT):
            th = (j + 0.5) * math.pi / NT
            for k in range(NP):  # 壁に入る向きの半分 (−90°〜90°) だけに格子を取る
                ph = -math.pi / 2 + (k + 0.5) * math.pi / NP
                ux = math.sin(th) * math.cos(ph)
                uz = math.cos(th)
                Eg = g * (Et + beta * p * uz); pg = math.sqrt(Eg * Eg - MP * MP)
                c = (p / pg) ** 2 * lis((Eg - MP) / 1000) * ux * math.sin(th) * (math.pi / NT) * (math.pi / NP) * dE
                cells.append((a, b, j, k)); wts.append(c)
    wts = np.array(wts); Jp = wts.sum() * 1e-4  # 陽子 [/cm²/s]
    J = Jp * sum(m[2] for m in MIX)
    mcum = np.cumsum([m[2] for m in MIX]); mcum = mcum / mcum[-1]
    cum = np.cumsum(wts / wts.sum())
    rng = random.Random(1)
    rows = []
    for _ in range(N):
        a, b, j, k = cells[min(int(np.searchsorted(cum, rng.random())), len(cells) - 1)]
        Ek = math.exp(a + rng.random() * (b - a))
        # 格子の中では、壁を通る流れ ∝ u_x になるように選び直す (一様に選ぶと、壁にすれすれの粒子が多すぎる)
        umax = max(math.sin(t_) * math.cos(p_) for t_ in (j * math.pi / NT, (j + 0.5) * math.pi / NT, (j + 1) * math.pi / NT)
                   for p_ in (-math.pi / 2 + k * math.pi / NP, -math.pi / 2 + (k + 1) * math.pi / NP, -math.pi / 2 + (k + 0.5) * math.pi / NP))
        while True:
            th = (j + rng.random()) * math.pi / NT; ph = -math.pi / 2 + (k + rng.random()) * math.pi / NP
            ux = math.sin(th) * math.cos(ph)
            if rng.random() * umax < ux: break
        uy = math.sin(th) * math.sin(ph); uz = math.cos(th)
        pdg, A, _ = MIX[int(np.searchsorted(mcum, rng.random()))]
        rows.append((pdg, Ek * A, uy, uz, ux))  # 運動エネルギーは原子核全体。Geant4 の板の法線 z ← 壁の法線 x
    r = np.array(rows)
    np.savez(out, pdg=r[:, 0].astype(np.int64), ke=r[:, 1], ux=r[:, 2], uy=r[:, 3], uz=r[:, 4], w=np.full(N, J / N))
    print(f'β={beta}: 壁を通る原子核 {J:.3f} /cm²/s (陽子 {Jp:.3f})、粒子 {N} (重い原子核 {int((r[:,0] > 1e9).sum())})')

if __name__ == '__main__':
    main()
