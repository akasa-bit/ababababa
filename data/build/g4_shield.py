# 遮蔽の中の被曝を Geant4 (モンテカルロの粒子輸送) で測る。docs/physics.md の 3。
# 星間の気体 (陽子・ヘリウムの原子核) が、船から見て 1 核子あたり (γ−1) m_p c² の運動エネルギーで、前面に一様に当たる。
# 横に広い板 (横の幅は無限とみなせる) なので、細い線の 1 本の粒子を打ち、深さの層ごとに「横に全部足した」吸収エネルギーを数えれば、
# 一様な流れ (フルエンス Φ 個/cm²) のときの線量 D(t) = Φ × (層のエネルギー ÷ 層の質量の厚さ) になる。
# 深い所は粒子がほとんど届かないので、段に分ける (MCNP の面の線源 SSW/SSR と同じ考え):
#   - 段の板は深さ [−upstream, thick] (段の頭からの深さ)。粒子は深さ 0 から打つ。板の後ろの面から前向きに出た粒子を全部書き出す。
#   - 次の段は、そこから打ち直す。板の手前 (upstream) は、後ろへ跳ね返って戻ってくる粒子のため。手前で測った線量は、前の段の同じ深さに足す
#     (前の段は後ろに物がない形で回したので、その分が抜けている。線形の輸送なので、足せば元の 1 枚の板と同じになる)。
#   - 打ち直す粒子は、運動エネルギーに比べた確率で選び (奥まで届く高いエネルギーの中性子を多めに)、重み = 元の重み ÷ 選ぶ確率 を持たせる
#     (重要度サンプリング。二次粒子は親の重みを受け継ぐ)。横の位置は捨ててよい (横に一様なので、層ごとの合計は変わらない)。
# 線量当量は、測る層 (probe) の中の 1 歩ごとに、その粒子の水の中の LET (阻止能) から ICRP 60 の Q(L) を掛けて足す。
# 使い方: python g4_shield.py --ke 2066.6 --events 2000 --out run1   (段に分けるのは data/build/g4_stages.sh)
import argparse, json, math, os, random, sys, time
import numpy as np
import geant4_pybind as g4

ap = argparse.ArgumentParser()
ap.add_argument('--material', default='G4_WATER')
ap.add_argument('--particle', default='proton')
ap.add_argument('--ke', type=float, default=2066.6, help='1 粒子の運動エネルギー [MeV] (ヘリウムなら原子核全体)')
ap.add_argument('--thick', type=float, default=300.0, help='この段の板の厚さ [g/cm²]')
ap.add_argument('--upstream', type=float, default=0.0, help='打つ面の手前に置く板 [g/cm²] (2 段目から。跳ね返りのため)')
ap.add_argument('--probe', type=float, default=50.0, help='測る層の間隔 [g/cm²]')
ap.add_argument('--probe-w', type=float, default=2.0, help='測る層の厚さ [g/cm²]')
ap.add_argument('--events', type=int, default=200)
ap.add_argument('--physlist', default='FTFP_BERT')
ap.add_argument('--cut', type=float, default=1.0, help='二次粒子を作る下限の飛程 [mm] (ガンマ線など)')
ap.add_argument('--ecut', type=float, default=100.0, help='δ 線 (電子・陽電子) を別の粒子として作る下限の飛程 [mm]。'
                'ICRP の Q(L) は δ 線のエネルギーも元の粒子の LET (制限なし) に入れて数えるので、δ 線はその場に落とす')
ap.add_argument('--ntime', type=float, default=10.0, help='中性子を追う時間の上限 [ms] (物理の一式の既定は 10 µs。熱中性子の捕獲のガンマ線を落とさないよう延ばす)')
ap.add_argument('--source', default=None, help='前の段が書き出した面の粒子 (.npz)')
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--out', required=True)
A = ap.parse_args()

nist = g4.G4NistManager.Instance()
MAT = nist.FindOrBuildMaterial(A.material)
WATER = nist.FindOrBuildMaterial('G4_WATER')  # LET と Q は水で決める (人の体の代わり)
VAC = nist.FindOrBuildMaterial('G4_Galactic')
rho = MAT.GetDensity() / (g4.g / g4.cm3)  # [g/cm³]
cm_of = lambda gcm2: gcm2 / rho * g4.cm  # 質量の厚さ [g/cm²] → 長さ
HALF_XY = 200 * g4.m  # 横の半幅 (シャワーの横の広がり 数 m より十分大きい)
U = A.upstream if A.source else 0.0
T = U + A.thick  # 板の全体の厚さ
zloc = lambda d: cm_of(d + U) - cm_of(T) / 2  # 段の頭からの深さ d → 板の中の z
probes = [float(p) for p in np.arange(-U, A.thick - 1e-9, A.probe)]  # 測る層の深さ (段の頭から)

def Q_of_L(L):  # ICRP 60 の線質係数。L = 水の中の LET [keV/µm]
    if L < 10: return 1.0
    if L <= 100: return 0.32 * L - 2.2
    return 300.0 / math.sqrt(L)

class Geo(g4.G4VUserDetectorConstruction):
    def Construct(self):
        wbox = g4.G4Box('W', HALF_XY * 1.1, HALF_XY * 1.1, cm_of(T) + 1 * g4.m)
        self.wlv = g4.G4LogicalVolume(wbox, VAC, 'W')
        wpv = g4.G4PVPlacement(None, g4.G4ThreeVector(), self.wlv, 'W', None, False, 0)
        blk = g4.G4Box('B', HALF_XY, HALF_XY, cm_of(T) / 2)
        self.blv = g4.G4LogicalVolume(blk, MAT, 'B')
        g4.G4PVPlacement(None, g4.G4ThreeVector(0, 0, 0), self.blv, 'B', self.wlv, False, 0)
        self.plv = []
        for i, d in enumerate(probes):
            pb = g4.G4Box(f'P{i}', HALF_XY, HALF_XY, cm_of(A.probe_w) / 2)
            lv = g4.G4LogicalVolume(pb, MAT, f'P{i}')
            g4.G4PVPlacement(None, g4.G4ThreeVector(0, 0, zloc(d) + cm_of(A.probe_w) / 2), lv, f'P{i}', self.blv, False, i)
            self.plv.append(lv)
        # 板の一番後ろの 1 mm: ここに前から入った粒子を書き出す (そのまま後ろの真空へ出ていく)
        sb = g4.G4Box('S', HALF_XY, HALF_XY, 0.5 * g4.mm)
        self.slv = g4.G4LogicalVolume(sb, MAT, 'S')
        g4.G4PVPlacement(None, g4.G4ThreeVector(0, 0, cm_of(T) / 2 - 0.5 * g4.mm), self.slv, 'S', self.blv, False, 0)
        return wpv
    def ConstructSDandField(self):
        sdm = g4.G4SDManager.GetSDMpointer()
        for i, lv in enumerate(self.plv):
            sd = ProbeSD(f'probe{i}', i); sdm.AddNewDetector(sd); lv.SetSensitiveDetector(sd); KEEP.append(sd)
        sd = PlaneSD('plane'); sdm.AddNewDetector(sd); self.slv.SetSensitiveDetector(sd); KEEP.append(sd)

KEEP = []
N = len(probes)
EV = {'E': np.zeros(N), 'H': np.zeros(N)}  # この 1 事象の、測る層ごとの (重みつきの) 吸収エネルギー [MeV] と、Q を掛けたもの
SUM = {k: np.zeros(N) for k in ('E', 'E2', 'H', 'H2')}
PRI = {'n': np.zeros(N), 'ke': np.zeros(N)}  # 測る層に入ったときに、まだ核反応していない一番前の粒子 (確かめ用: 核反応の長さと電離の減速)
REC = []  # 後ろの面を前向きに通った粒子: (PDG, 運動エネルギー MeV, 方向 ux, uy, uz, 重み)

class ProbeSD(g4.G4VSensitiveDetector):
    def __init__(self, name, i):
        super().__init__(name); self.i = i
    def ProcessHits(self, step, hist):
        tr = step.GetTrack()
        pre = step.GetPreStepPoint()
        if A.source is None and tr.GetTrackID() == 1 and pre.GetStepStatus() == g4.G4StepStatus.fGeomBoundary and pre.GetMomentumDirection().z > 0:
            PRI['n'][self.i] += 1; PRI['ke'][self.i] += pre.GetKineticEnergy() / g4.MeV
        e = step.GetTotalEnergyDeposit()
        if e <= 0: return True
        w = tr.GetWeight()
        q = 1.0
        pd = tr.GetDefinition()
        if pd.GetPDGCharge() != 0:
            # LET = その粒子の、その歩の始めの運動エネルギーでの、水の中の電子の阻止能 (制限なし)。
            # 落としたエネルギー ÷ 歩幅 だと、遠くへ飛ぶ δ 線の分が抜けて、重い原子核の LET と Q が低く出る
            L = CALC.ComputeElectronicDEDX(pre.GetKineticEnergy(), pd, WATER) / (g4.MeV / g4.mm)  # MeV/mm = keV/µm
            q = Q_of_L(L)
        EV['E'][self.i] += w * e / g4.MeV
        EV['H'][self.i] += w * q * e / g4.MeV
        return True

class PlaneSD(g4.G4VSensitiveDetector):
    def ProcessHits(self, step, hist):
        pre = step.GetPreStepPoint()
        if pre.GetStepStatus() != g4.G4StepStatus.fGeomBoundary: return True
        d = pre.GetMomentumDirection()
        if d.z <= 0: return True
        t = step.GetTrack()
        if abs(t.GetDefinition().GetPDGEncoding()) in (12, 14, 16): return True  # ニュートリノは何も落とさない
        REC.append((t.GetDefinition().GetPDGEncoding(), pre.GetKineticEnergy() / g4.MeV, d.x, d.y, d.z, t.GetWeight()))
        return True

class Gun(g4.G4VUserPrimaryGeneratorAction):
    def __init__(self):
        super().__init__(); self.gun = g4.G4ParticleGun(1)
        self.tab = g4.G4ParticleTable.GetParticleTable()
        self.src = None
        if A.source:
            s = np.load(A.source); self.src = s
            imp = s['w'] * np.maximum(s['ke'], 0.1)  # 選ぶ確率 ∝ 重み × 運動エネルギー [MeV]
            self.q = imp / imp.sum(); self.cum = np.cumsum(self.q)
            self.wsum = float(s['w'].sum())
    def GeneratePrimaries(self, ev):
        if self.src is None:
            p = g4.G4Alpha.Definition() if A.particle == 'alpha' else self.tab.FindParticle(A.particle)
            self.gun.SetParticleDefinition(p); self.gun.SetParticleEnergy(A.ke * g4.MeV)
            self.gun.SetParticleMomentumDirection(g4.G4ThreeVector(0, 0, 1)); w = 1.0
        else:
            k = min(int(np.searchsorted(self.cum, random.random())), len(self.q) - 1)
            pdg = int(self.src['pdg'][k])
            p = g4.G4IonTable.GetIonTable().GetIon(pdg) if pdg > 1000000000 else self.tab.FindParticle(pdg)
            self.gun.SetParticleDefinition(p); self.gun.SetParticleEnergy(float(self.src['ke'][k]) * g4.MeV)
            self.gun.SetParticleMomentumDirection(g4.G4ThreeVector(float(self.src['ux'][k]), float(self.src['uy'][k]), float(self.src['uz'][k])))
            w = float(self.src['w'][k]) / float(self.q[k])  # 重要度サンプリングの重み (一番前の 1 粒子あたり)
        self.gun.SetParticlePosition(g4.G4ThreeVector(0, 0, zloc(0.0) + 1e-3 * g4.mm))
        self.gun.GeneratePrimaryVertex(ev)
        ev.GetPrimaryVertex(0).SetWeight(w)

class EvAct(g4.G4UserEventAction):
    def BeginOfEventAction(self, ev):
        EV['E'][:] = 0; EV['H'][:] = 0
    def EndOfEventAction(self, ev):
        SUM['E'] += EV['E']; SUM['E2'] += EV['E'] ** 2; SUM['H'] += EV['H']; SUM['H2'] += EV['H'] ** 2

class Init(g4.G4VUserActionInitialization):
    def Build(self):
        self.SetUserAction(Gun()); self.SetUserAction(EvAct())

random.seed(A.seed)
g4.G4Random.setTheSeed(A.seed)
rm = g4.G4RunManagerFactory.CreateRunManager(g4.G4RunManagerType.Serial)
rm.SetUserInitialization(Geo())
pl = getattr(g4, A.physlist)()  # 物理の一式 (FTFP_BERT・QBBC など)
pl.SetDefaultCutValue(A.cut * g4.mm)
rm.SetUserInitialization(pl)
rm.SetUserInitialization(Init())
ui = g4.G4UImanager.GetUIpointer()
for c in ('/control/verbose 0', '/run/verbose 0', '/event/verbose 0', '/tracking/verbose 0', '/process/had/verbose 0', '/process/em/verbose 0',
          f'/run/setCutForAGivenParticle e- {A.ecut} mm', f'/run/setCutForAGivenParticle e+ {A.ecut} mm'):
    ui.ApplyCommand(c)
rm.Initialize()
CALC = g4.G4EmCalculator()
if os.environ.get('G4_DUMP_CUTS'):  # 確かめ用: 物質ごとの、粒子を作る下限のエネルギー (0 = γ、1 = e−、2 = e+)
    ct = g4.G4ProductionCutsTable.GetProductionCutsTable()
    ct.DumpCouples()
ui.ApplyCommand(f'/physics_engine/neutron/timeLimit {A.ntime} ms')  # 中性子を消す過程 (nKiller) は初期化のあとにできるので、ここで延ばす
t0 = time.time()
rm.BeamOn(A.events)
dt = time.time() - t0

n = A.events
MeV_J = 1.602176634e-13
def dose(k):  # 一番前の 1 粒子/cm² あたりの線量 [Gy cm²] と、その統計の誤差
    m = SUM[k] / n; v = SUM[k + '2'] / n - m * m
    se = np.sqrt(np.maximum(v, 0) / n)
    f = MeV_J / (A.probe_w * 1e-3)
    return (m * f).tolist(), (se * f).tolist()
D, dD = dose('E'); H, dH = dose('H')
rec = np.array(REC, dtype=float) if REC else np.zeros((0, 6))
np.savez(A.out + '.npz', pdg=rec[:, 0].astype(np.int64), ke=rec[:, 1], ux=rec[:, 2], uy=rec[:, 3], uz=rec[:, 4], w=rec[:, 5] / n)
json.dump({
    'args': vars(A), 'geant4': g4.G4Version, 'seconds': dt, 'rho': rho, 'upstream': U,
    'depth': probes, 'probe_mass': A.probe_w,
    'D_Gy_cm2': D, 'dD': dD, 'H_Sv_cm2': H, 'dH': dH,
    'primary_survive': (PRI['n'] / n).tolist(), 'primary_ke': (PRI['ke'] / np.maximum(PRI['n'], 1)).tolist(),
    'plane_particles': int(len(REC)), 'plane_weight_per_primary': float(rec[:, 5].sum() / n) if len(REC) else 0.0,
}, open(A.out + '.json', 'w'), indent=1)
print(f'{n} 事象 {dt:.1f} 秒  面を通った粒子 {len(REC)}', file=sys.stderr)
sys.stdout.flush(); sys.stderr.flush()
os._exit(0)  # Python の終わりの片付けで Geant4 が落ちる (segfault) ので、片付けずに終える
