// 家臣の要求への AI の返事 (QD-41 = c・B-142。docs/demands.md) の試験。画面なしの版で回す
// 1. のむ見込みは、家臣が大きいほど・遠いほど・拒んだら独立する見込みが高いほど上がり、材料が基準ならちょうど半々
// 2. 傾きが実データの計算 (data/derived/demands.json) と同じ
// 3. 試合の家臣の材料が有限で、のむ見込みが 0〜1。席の国 (記録で見る) と席のない主人 (いまの値で見る) のどちらでも計算できる
// 4. 試合で AI の主人が要求をのむことも拒むこともある
// 使い方: node tools/tests/demands.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('要求への返事') }];
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const D = sim.evaluate('DEMAND_AI');
const P = (share, rel, risk) => sim.evaluate(`demandAcceptOf({ share: ${share}, rel: ${rel}, risk: ${risk} })`);

// 1. 向きと基準
const s0 = Math.exp(D.ref.size), r0 = Math.exp(D.ref.dist), k0 = D.ref.risk;
check(Math.abs(P(s0, r0, k0) - 0.5) < 1e-9, `材料が基準なのに、のむ見込みが ${P(s0, r0, k0)}`);
check(P(s0 * 10, r0, k0) > 0.5 && P(s0, r0 * 3, k0) > 0.5 && P(s0, r0, Math.min(1, k0 + 0.3)) > 0.5, '大きい・遠い・独立しそうな家臣ほど、のみやすくならない');
check(P(s0 / 10, r0, k0) < 0.5 && P(s0, r0 / 3, k0) < 0.5 && P(s0, r0, Math.max(0, k0 - 0.3)) < 0.5, '小さい・近い・独立しなさそうな家臣ほど、拒みやすくならない');

// 2. 実データと同じ傾き
const dj = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/derived/demands.json'), 'utf8'));
for (const k of ['size', 'dist', 'risk']) check(Math.abs(dj.logit[k].coef - D[k]) < 0.0005, `${k} の傾き ${D[k]} が実データの ${dj.logit[k].coef} と違う`);

// 3・4. 試合
const g = sim.newGame('2', { nations: 6 });
sim.evaluate(`globalThis.__dem = []; (() => { const P = Game.prototype, f = P.demandAcceptP; P.demandAcceptP = function (id, seen = false) { const p = f.call(this, id, seen); __dem.push({ seen: !!seen, p }); return p; }; })()`);
sim.run(g, 200);
let n = 0;
for (const id of Object.keys(g.govs).map(Number)) {
  const gv = g.govs[id];
  if (gv.lord === null || gv.lord === undefined || !g.isColonized(id)) continue;
  for (const seen of [false, true]) {
    if (seen && !g.asRealm(g.realmOf(id), () => !!g.known(id))) continue;
    const t = seen ? g.asRealm(g.realmOf(id), () => g.demandTermsOf(id, true)) : g.demandTermsOf(id);
    const p = seen ? g.asRealm(g.realmOf(id), () => g.demandAcceptP(id, true)) : g.demandAcceptP(id);
    if (t === undefined) continue;
    n++;
    check([t.share, t.rel, t.risk].every(Number.isFinite) && t.share > 0 && t.share <= 1 && t.rel > 0 && t.risk >= 0 && t.risk <= 1, `星系 ${id} の材料がおかしい (${JSON.stringify(t)})`);
    check(p > 0 && p < 1, `星系 ${id} ののむ見込みが ${p}`);
  }
}
check(n > 10, `材料を計算できた家臣が ${n}`);
const dem = sim.evaluate('__dem');
const lo = dem.filter((d) => d.p < 0.5).length, hi = dem.filter((d) => d.p > 0.5).length;
console.log(`家臣の材料 ${n} 件・試合の AI の判断 ${dem.length} 回 (のむ見込みの平均 ${(dem.reduce((a, d) => a + d.p, 0) / Math.max(1, dem.length)).toFixed(2)}・半々より上 ${hi}・下 ${lo})`);
check(dem.length >= 5 && lo > 0 && hi > 0, `AI の判断が片寄る (判断 ${dem.length}・半々より上 ${hi}・下 ${lo})`);

console.log(fails.length ? `要求への返事 不合格\n${fails.join('\n')}` : '要求への返事 合格');
process.exit(fails.length ? 1 : 0);
