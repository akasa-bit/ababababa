// 星間マップの自動生成 (回 GA10・B-195。依頼 GA-3) の試験。画面なしの版で回す:
//   同じ銀河の番号なら同じ銀河・違えば違う・実在の星の表と同じ密度 (±10%) と主星の型の割合 (±2 ポイント。目標 R04 の「手続き的に作る範囲」の幅)・
//   板 (版 5 から ±4 光年の板から取って、縦を詰めてゲームの中では ±2 光年) と半径の中・星系どうしが 1 光年以上離れる・実在の星の番号や名前を持たない・惑星がある・
//   セーブに作り方 (gen) が入り、読み込み (ネット対戦の参加者と同じ道) で同じ銀河になる・古いセーブ (作り方なし) は平面の銀河・試合が進む・
//   実在の銀河は版 4 (板 ±2 光年) の古いセーブなら前と同じ・版 5 は ±4 光年の板の実在の星をすべて使い、高さを半分に詰める (星系がおよそ 2 倍。2026-10-31 の依頼 GA-2)
// 使い方: node tools/tests/galaxygen.js [銀河の番号]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('自動生成の銀河 合格') ? '' : '自動生成の銀河が違う') }];
if (require.main !== module) return;
const path = require('path');
const crypto = require('crypto');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const hash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const make = (s, kind = 'gen', gen = sim.GALAXY_GEN) => sim.generateGalaxy({ seed: String(s), starCount: 400, meanSpacing: 4, kind, gen });
const res = {};
const a = make(seed), b = make(seed), c = make(`${seed}x`);
res.same = hash(a) === hash(b) && hash(a) !== hash(c) && a.kind === 'gen';
// 実在の星の表と比べる (表の ±17 光年の板の密度と、主星の型の割合)
const S = sim.evaluate('REAL_STARS'), slab = a.srcSlab || a.slab, gameSlab = a.slab, GEN_MIN = sim.evaluate('GEN_MIN'); // 密度は星を取った板で、置く場所はゲームの中の板で見る
const rho = S.s.length / (Math.PI * S.radius ** 2 * 2 * S.slab), frac = {};
for (const r of S.s) frac[r[5][0][0]] = (frac[r[5][0][0]] || 0) + 1 / S.s.length;
const stats = (g) => {
  const sys = g.systems.slice(1), f = {};
  for (const s of sys) f[s.stars[0].cls] = (f[s.stars[0].cls] || 0) + 1 / sys.length;
  const dens = sys.length / (Math.PI * S.radius ** 2 * 2 * slab);
  return { dens, f, worst: Math.max(...Object.keys({ ...frac, ...f }).map((k) => Math.abs((f[k] || 0) - (frac[k] || 0)))) };
};
const st = stats(a);
res.density = Math.abs(st.dens / rho - 1) <= 0.1;
res.types = st.worst <= 0.02;
let minD = Infinity;
for (let i = 0; i < a.systems.length; i++) for (let j = i + 1; j < a.systems.length; j++) { const p = a.systems[i], q = a.systems[j]; minD = Math.min(minD, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)); }
res.shape = gameSlab === 2 && a.systems.every((s) => Math.abs(s.z) <= gameSlab + 1e-9) && a.systems.some((s) => Math.abs(s.z) > 1) && a.systems.every((s) => Math.hypot(s.x, s.y) <= S.radius + 1e-9) && minD >= GEN_MIN - 1e-9;
res.names = a.systems.slice(1).every((s) => !s.cat && !s.real) && new Set(a.systems.map((s) => s.name)).size === a.systems.length && a.systems.slice(1).some((s) => s.bodies.length > 0);
// セーブと読み込み (ネット対戦の参加者も、親のセーブから同じ道で銀河を作り直す)
const g = sim.newGame(seed, { galaxy: 'gen' });
sim.run(g, 30);
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const kindOf = sim.evaluate('galaxyKindOf');
const g2 = new sim.Game(make(d.seed, kindOf(d.galaxy)));
const chart = (gx) => gx.systems.map((s) => [s.name, s.x, s.y, s.z, s.stars.map((t) => [t.cls, t.mass]), s.bodies.map((b) => [b.id, b.type, b.a])]); // 星図 (天体の埋蔵量などは試合で変わる)
const strip = (o) => { const x = JSON.parse(JSON.stringify(o)); delete x.savedAt; return hash(x); };
res.saveLoad = d.galaxy === 'gen' && g2.restore(d) !== false && hash(chart(g2.galaxy)) === hash(chart(g.galaxy)) && strip(sim.buildSave(g2)) === strip(d);
res.oldSave = kindOf(undefined) === 'flat' && kindOf('real') === 'real' && sim.evaluate('is3D')(a) && !sim.evaluate('is3D')(make(seed, 'flat'));
res.plays = g.colonies.length > 1 && g.year > 2329;
// 実在の銀河: 版 4 (板 ±2 光年) は前と同じ (回 GA10 で星の作りを共用にした。番号 1 の銀河の要約)。版 5 は ±4 光年の板の実在の星をすべて使い、高さ z を半分にする (x・y はそのまま)
const r4 = make('1', 'real', 4), r5 = make('1', 'real');
const inSlab = S.s.filter((r) => Math.abs(r[2]) <= slab).length;
res.realSame = hash(r4) === 'a326b463d44aa81a' && r4.slab === 2 && make('1', 'gen', 4).slab === 2;
const src5 = S.s.filter((r) => Math.abs(r[2]) <= 4);
res.realThick = sim.GALAXY_GEN >= 5 && slab === 4 && r5.slab === 2 && r5.srcSlab === 4 && r5.systems.length - 1 === inSlab
  && r5.systems.slice(1).every((s, k) => s.x === src5[k][0] && s.y === src5[k][1] && Math.abs(s.z - src5[k][2] / 2) < 1e-12);
const ok = Object.values(res).every(Boolean);
console.log(`自動生成の銀河 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
console.log(`星系 ${a.systems.length - 1} (実在の銀河 ${make(seed, 'real').systems.length - 1}。版 4 は ${make(seed, 'real', 4).systems.length - 1})・密度 ${(st.dens * 1000).toFixed(3)} / 表 ${(rho * 1000).toFixed(3)} (千立方光年あたり)・型の割合の差の最大 ${(st.worst * 100).toFixed(1)} ポイント・いちばん近い星系の間 ${minD.toFixed(2)} 光年`);
process.exitCode = ok ? 0 : 1;
