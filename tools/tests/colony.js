// 入植船の設計と入植集団 (回 FU3・B-033。目標 R17) の試験。画面なしの版で回す
// 1. HERITAGE (Marin & Beluffi 2018) の表 1 の前提で 100 回の旅ずつ回すと、論文の結論が出る: 98 人 (49 組) は絶える割合 3% 以下 (論文: 100 回とも続く)、
//    25 組 (50 人) は 35〜65% (論文: 50 ± 15%)
// 2. 入植地の前提 (COLONY_RISK) の表 COLONY_FAIL が式 (heritageRate) と合う (98 人・500 人。差 0.03 以内)
// 3. 設計: 住む場所の工業品は 人 × 250 t、船の質量と推進のエネルギーは人数で増え、遅い船はエネルギーが少し少なく (止まる所の反物質は速さによらない) 着くのが遅い
// 4. 試合で設計の人数と年齢の形の入植地ができ、セーブで設計が残る (保存して読み直しても同じ筋)
// 使い方: node tools/tests/colony.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('入植集団') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const ev = (code) => sim.evaluate(code);

// 1. HERITAGE の再現
const e98 = ev('heritageRate(98)'), e50 = ev('heritageRate(50)');
console.log(`HERITAGE の前提 (100 回の旅): 98 人で絶えた割合 ${e98}・25 組 (50 人) で ${e50}`);
check(e98 <= 0.03, `98 人で絶える割合が ${e98} (論文は 100 回とも続く)`);
check(e50 >= 0.35 && e50 <= 0.65, `25 組で絶える割合が ${e50} (論文は 50 ± 15%)`);

// 2. 入植地の前提の表
for (const n of [98, 500]) {
  const f = ev(`heritageRate(${n}, COLONY_RISK, 100)`), t = ev(`COLONY_FAIL[${n}]`);
  console.log(`入植地の前提: ${n} 人で絶える割合 ${f} (表 ${t})`);
  check(Math.abs(f - t) <= 0.03, `入植地の前提の表 COLONY_FAIL[${n}] = ${t} が式の ${f} と合わない`);
}

// 3. 設計の費用と質量
const g = sim.newGame('3', { nations: 6 });
g.setSpectate(false);
const cap = g.cap;
const t = g.nearSystems(cap).find(([id, d]) => id !== cap && d > 4 && !g.isColonized(id) && g.system(id).bodies.some((b) => (b.settle?.grade || 0) >= 1))?.[0];
const body = g.system(t).bodies.find((b) => (b.settle?.grade || 0) >= 1);
const cost = (crew, speed = 'std') => { g.designs[cap] = { crew, speed, cargo: 0, ages: 'migrant' }; return { c: g.shipCost('planet', cap, t), f: g.settlerFlight('planet', cap, t), v: g.settlerVoyage(cap, t, g.designOf(cap)) }; };
const a = cost(500), b = cost(40000), s = cost(40000, '0.5');
console.log(`500 人: 工業品 ${a.c.goods}・質量 ${a.f.m.toExponential(2)} kg・エネルギー ${a.c.energy.toExponential(2)} J / 40,000 人: ${b.c.goods}・${b.f.m.toExponential(2)}・${b.c.energy.toExponential(2)} / 40,000 人 0.5c: ${s.c.energy.toExponential(2)} J・${s.v.years.toFixed(1)} 年 (標準 ${b.v.years.toFixed(1)} 年)`);
check(Math.abs(a.c.goods - (500 * 2.5e5) / 5e8) < 1e-3, `500 人の住む場所の工業品が ${a.c.goods} (250 t × 500 人 = 0.25 単位)`);
check(b.f.m > 50 * a.f.m && b.c.energy > 50 * a.c.energy, '人数を増やしても船の質量とエネルギーが増えない');
check(s.c.energy < b.c.energy && s.v.years > 1.5 * b.v.years, '遅い船のエネルギーが減らないか、着くのが遅くならない');

// 4. 試合で設計どおりの入植地ができる
g.designs[cap] = null;
const r1 = g.command('design', { tpl: 'small' }), r2 = g.command('design', { ages: 'young' });
check(r1.ok && r2.ok && g.designOf(cap).crew === 500 && g.designOf(cap).ages === 'young', `設計の命令が効かない (${JSON.stringify(g.designs[cap])})`);
g.credits = 1e6;
g.gov(cap).E = 1e40;
Object.assign(g.stockOf(cap), { goods: 1e4, food: 1e4, water: 1e4 });
const d = g.dispatch(cap, t, body.id, 'planet');
check(d.ok, `入植船を出せない: ${d.reason}`);
let col = null;
for (let i = 0; i < 4 * 60 && !col; i++) { g.advance(0.25); const c = g.colonyAt(t, body.id, 'planet'); if (c && g.govs[t]?.lord === cap) col = c; } // 着いたすぐあと (首都の船の入植地)
check(col && Math.abs(col.pop * 1e6 - 500) < 50, `500 人の入植地ができない (${col ? col.pop * 1e6 : 'なし'})`);
const kids = col?.age ? [0, 1, 2].reduce((k, a) => k + col.age.f[a] + col.age.m[a], 0) / col.pop : 0, old = col?.age ? [10, 11, 12, 13, 14, 15].reduce((k, a) => k + col.age.f[a] + col.age.m[a], 0) / col.pop : 1;
check(col && kids > 0.1 && old < 0.01, `「働き手と子ども」の年齢で降りていない (子ども ${kids.toFixed(2)}・年寄り ${old.toFixed(3)})`);
// セーブ
const strip = (x) => { const o = sim.buildSave(x); delete o.savedAt; return JSON.stringify(o); };
const s1 = strip(g);
const g2 = new sim.Game(sim.generateGalaxy({ seed: g.galaxy.seed, starCount: 400, meanSpacing: 4, kind: 'real', gen: g.galaxy.gen }));
g2.restore(JSON.parse(s1));
check(JSON.stringify(g2.designOf(cap)) === JSON.stringify(g.designOf(cap)), 'セーブで設計が残らない');
for (let i = 0; i < 40; i++) { g.advance(0.25); g2.advance(0.25); }
check(strip(g) === strip(g2), '保存して読み直すと筋が変わる');

console.log(fails.length ? `入植集団 不合格\n${fails.join('\n')}` : '入植集団 合格');
process.exit(fails.length ? 1 : 0);
