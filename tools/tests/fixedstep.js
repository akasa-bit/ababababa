// 画面の進め方 (経済は 0.25 年ごと。QD-81 = a。core/game-loop.js の advanceFixed・docs/perf.md の 8.6) の試験。画面なしの版で回す:
//   1. コマごとの年がばらばら (速さ 1/12〜64 年/秒・コマ 20〜60/秒をまねる) でも、ためて 0.25 年ごとに進めた試合は、
//      画面なしの道具と CI の進め方 (advance(0.25) をくり返す) と、状態の要約が同じ
//   2. 1 回の計算の上限 (budget) を付けても、歩は先へ回るだけで、同じ要約になる。ためる年は STEP_BACKLOG 年まで
//   3. 表示の年 (viewYear) は、試合の年から 1 歩ぶん (0.25 年) までのあいだを進み、止めているあいだは動かない
//   4. 動くものの見かけの位置 (apparentPath) は、表示の年を渡すと、試合の年より先へ進んだ所になる (地図が刻みのあいだも動く)
// 使い方: node tools/tests/fixedstep.js [シード] [年数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3', '30'], judge: (o) => (o.includes('固定の刻み 合格') ? '' : (o.match(/^固定の刻み 不合格[^\n]*/m) || ['固定の刻みの結果が違う'])[0]) }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', yS = '30'] = process.argv.slice(2);
const years = Number(yS);
const fails = [];
const sim = H.load({});
const STEP = sim.evaluate('STEP'), BACKLOG = sim.evaluate('STEP_BACKLOG');
// 決まった乱数 (試合の乱数は使わない)
let s = 12345;
const u = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const SPEEDS = [1 / 12, 1 / 4, 1, 4, 16, 64];

// 1. ばらばらのコマで進める試合と、CI の進め方の試合
const g = sim.newGame(seed, { nations: 6 }), ref = sim.newGame(seed, { nations: 6 });
const y0 = g.year;
let frames = 0, maxAcc = 0, vyBad = 0;
while (g.year < y0 + years - 1e-9) {
  const speed = SPEEDS[Math.floor(u() * SPEEDS.length)];
  const dt = Math.min(0.1, 1 / (20 + 40 * u())); // コマの時間 (main-loop と同じく 0.1 秒まで)
  const before = g.year;
  g.advanceFixed(dt * speed);
  frames++;
  maxAcc = Math.max(maxAcc, g.stepAcc);
  const vy = g.viewYear();
  if (!(vy >= g.year - 1e-12 && vy <= g.year + STEP + 1e-12)) vyBad++;
  if (Math.abs(((g.year - before) / STEP) - Math.round((g.year - before) / STEP)) > 1e-9) fails.push(`1 コマで 0.25 年の倍数でない年だけ進んだ (${g.year - before})`);
}
const steps = Math.round((g.year - y0) / STEP);
for (let i = 0; i < steps; i++) ref.advance(STEP);
const ha = sim.hash(g), hb = sim.hash(ref);
if (ha !== hb) fails.push(`ばらばらのコマで進めた要約 ${ha} が、CI の進め方 ${hb} と違う`);
if (Math.abs(g.year - ref.year) > 1e-9) fails.push(`年が違う (${g.year} と ${ref.year})`);
if (vyBad) fails.push(`表示の年が試合の年から 1 歩ぶんの外に出たコマが ${vyBad}`);

// 2. 1 回の計算の上限: 時計を 1 回ごとに 30 ms 進める (上限 40 ms なら 1 回に 2 歩まで)
const gb = sim.newGame(seed, { nations: 6 }), refb = sim.newGame(seed, { nations: 6 });
let t = 0, perCallMax = 0, accMax = 0;
const clock = () => (t += 30);
for (let i = 0; i < 400; i++) {
  const before = gb.year;
  gb.advanceFixed(i < 200 ? 1.6 : 0.05, 40, clock); // 前半は 1 回 1.6 年 (16 年/秒・0.1 秒のコマ) を頼み、後半はゆっくり
  perCallMax = Math.max(perCallMax, Math.round((gb.year - before) / STEP));
  accMax = Math.max(accMax, gb.stepAcc);
}
const nb = Math.round((gb.year - refb.year) / STEP);
for (let i = 0; i < nb; i++) refb.advance(STEP);
if (sim.hash(gb) !== sim.hash(refb)) fails.push('上限を付けて進めた試合の要約が、CI の進め方と違う');
if (perCallMax > 2) fails.push(`上限 40 ms (1 回 30 ms) なのに 1 回で ${perCallMax} 歩進んだ`);
if (accMax > BACKLOG + 1e-12) fails.push(`ためた年が ${accMax} (上限 ${BACKLOG})`);

// 3. 止めているあいだ (y = 0) は表示の年が動かない
const vy0 = g.viewYear();
for (let i = 0; i < 5; i++) g.advanceFixed(0);
if (g.viewYear() !== vy0) fails.push('止めているのに表示の年が動いた');

// 4. 動くものの見かけの位置: 表示の年を渡すと、試合の年のときより先へ進む (観戦なので光の遅れなしの位置。飛んでいる途中の入植船)
const gm = sim.newGame(seed, { nations: 6 });
sim.run(gm, 20);
let moved = 0, same = 0, seen = 0;
gm.stepAcc = 0.2;
for (const p of gm.ships.filter((q) => q.path && q.times[0] < gm.year && q.arrive > gm.viewYear())) {
  const a = gm.apparentPath(p.path, p.times, p.times[0], p.arrive);
  const b = gm.apparentPath(p.path, p.times, p.times[0], p.arrive, gm.viewYear());
  if (!a || !b) continue;
  seen++;
  if (Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)) > 1e-9) moved++; else same++;
}
if (!seen) fails.push('飛んでいる途中の船がない (試験の銀河か年を変える)');
else if (!moved) fails.push(`飛んでいる船 ${seen} のどれも、表示の年で動かない`);
console.log(`コマ ${frames}・歩 ${steps}・ためた年の最大 ${maxAcc.toFixed(3)}・要約 ${ha} / ${hb}・上限ありの 1 回の歩の最大 ${perCallMax}・飛んでいる船 ${seen} (表示の年で動いた ${moved})`);
console.log(fails.length ? `固定の刻み 不合格 (${fails.join(' / ')})` : '固定の刻み 合格');
process.exit(fails.length ? 1 : 0);
