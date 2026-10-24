// 首都と開拓星系の所得の差 (回 KE5。docs/regions.md)。画面なしの版で銀河を回し、国の首都でない入植地の 1 人あたりの実質の所得 (incomeUSD。2011 年のドル) を、
// 首都と比べる。B (賃金と民間の資本) の回でも同じ物差しで比べる。ゲームの中身は変えない
//   1. 終わりの年の、首都でない入植地 (人口 50 万人以上) の所得の 10%・50%・90% 点と、人口の重みの平均 ÷ 首都の平均
//   2. 人口の大きさごとの入植地の数・所得の中央値・工業の就業の割合
//   3. 止まっている理由の分け方 (交易路なし・工業に人がいない・工業の人はいるが原料待ち・工業が動いている)
//   4. 国の中の β 収束: 10 年の ln 所得の伸びを、初めの ln 所得に当てる (国 × 年の中で引く)。速さ = −ln(1 + 係数 × 10) ÷ 10
// 使い方: node tools/region-gap.js [銀河の数=8] [年数=150] [国の数=6]   (HTML=… で版を選ぶ)
const path = require('path');
const H = require(path.resolve(__dirname, 'headless'));
const [nS = '8', yS = '150', natS = '6'] = process.argv.slice(2);
const N = Number(nS), years = Number(yS), nations = Number(natS);
const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
const isCap = (g, c) => g.realmOf(c.sys) === c.sys;
const BINS = [[0.5, 5], [5, 50], [50, 1e9]];
const bins = BINS.map(() => ({ n: 0, y: [], ind: 0 }));
const kinds = {};
const ys = [];
let fy = 0, fp = 0, cy = 0, cp = 0, cols = 0, sysN = 0, popN = 0, nFront = 0;
const pairs = []; // [国 × 年の鍵, 初めの ln y, 10 年の伸び]
for (let sd = 1; sd <= N; sd++) {
  const g = sim.newGame(String(sd), { nations });
  const hist = {}; // 星系 → 年 → [国, ln y]
  for (let y = 0; y <= years; y += 10) {
    if (y) sim.run(g, 10);
    const by = {};
    for (const c of g.colonies) {
      if (c.pop < 0.5) continue;
      const b = (by[c.sys] ??= { p: 0, yp: 0 });
      b.p += c.pop; b.yp += c.pop * g.incomeUSD(c);
    }
    for (const [s, b] of Object.entries(by)) (hist[s] ??= {})[y] = [g.realmOf(Number(s)), Math.log(Math.max(b.yp / b.p, 1))];
  }
  for (const h of Object.values(hist)) for (const [y, [realm, ly]] of Object.entries(h)) {
    const f = h[Number(y) + 10];
    if (f && f[0] === realm) pairs.push([`${sd}|${realm}|${y}`, ly, (f[1] - ly) / 10]);
  }
  cols += g.colonies.length; sysN += new Set(g.colonies.map((c) => c.sys)).size; popN += g.colonies.reduce((k, c) => k + c.pop, 0);
  const onRoute = new Set(g.routes.flatMap((r) => [r.a, r.b]));
  for (const c of g.colonies) {
    if (c.pop < 0.5) continue;
    const y = g.incomeUSD(c);
    if (isCap(g, c)) { cy += y * c.pop; cp += c.pop; continue; }
    nFront++; fy += y * c.pop; fp += c.pop; ys.push(y);
    const i = BINS.findIndex(([a, b]) => c.pop >= a && c.pop < b);
    bins[i].n++; bins[i].y.push(y); bins[i].ind += c.sh.ind + (c.sh.hi || 0);
    const k = !onRoute.has(c.sys) ? '交易路がない' : (c.industry ?? 0) > 0.5 ? '工業が動いている' : c.sh.ind > 0.05 ? '工業の人はいるが原料待ち' : '交易路はあるが工業に人がいない';
    const K = (kinds[k] ??= { n: 0, y: [] }); K.n++; K.y.push(y);
  }
}
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(p * (b.length - 1))] : 0; };
// β 収束 (国 × 年の中で引く)
const grp = {};
for (const [k, x, gr] of pairs) (grp[k] ??= []).push([x, gr]);
let sxy = 0, sxx = 0, n = 0;
for (const v of Object.values(grp)) {
  if (v.length < 2) continue;
  const mx = v.reduce((s, [x]) => s + x, 0) / v.length, mg = v.reduce((s, [, gr]) => s + gr, 0) / v.length;
  for (const [x, gr] of v) { sxy += (x - mx) * (gr - mg); sxx += (x - mx) ** 2; n++; }
}
const b = sxx > 0 ? sxy / sxx : 0, beta = -Math.log(Math.max(1 + b * 10, 1e-9)) / 10;
console.log(`${N} 銀河 × ${years} 年 × ${nations} か国: 入植地 ${(cols / N).toFixed(1)}・星系 ${(sysN / N).toFixed(1)}・総人口 ${Math.round(popN / N)} 百万人`);
console.log(`首都でない入植地 (人口 50 万人以上、1 銀河 ${(nFront / N).toFixed(1)}) の所得 [2011 年のドル]: 10% ${Math.round(q(ys, 0.1))}・50% ${Math.round(q(ys, 0.5))}・90% ${Math.round(q(ys, 0.9))}。人口の重みの平均 ${Math.round(fy / fp || 0)} (首都 ${Math.round(cy / cp || 0)}、比 ${((fy / fp) / (cy / cp) * 100 || 0).toFixed(1)}%)`);
console.log('人口の大きさごと [百万人]:');
bins.forEach((B, i) => console.log(`  ${BINS[i][0]}〜${BINS[i][1] < 1e9 ? BINS[i][1] : ''}: 1 銀河 ${(B.n / N).toFixed(1)}・所得の中央値 ${Math.round(med(B.y))}・工業の就業 ${(B.ind / Math.max(B.n, 1) * 100).toFixed(1)}%`));
console.log('止まっている理由:');
for (const [k, v] of Object.entries(kinds).sort((x, y) => y[1].n - x[1].n)) console.log(`  ${k}: ${(v.n / Math.max(nFront, 1) * 100).toFixed(0)}% (所得の中央値 ${Math.round(med(v.y))})`);
console.log(`国の中の β 収束 (10 年): 係数 ${b.toFixed(4)} → 年 ${(beta * 100).toFixed(2)}% (組 ${n})`);
