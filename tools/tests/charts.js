// 財政のグラフ (回 GA9・B-059) の試験。画面なしの版で回す:
//   人間の国の 1 年 1 行の記録 (chron) ができる・値は数か null・財政を変えた年の印・保存と読み込みで残る・
//   財政の画面のグラフが 5 つの図・期間 (app.chartSpan) で行が絞られる・記録が 2 年分ないときは説明だけ・星系の記録の項目がそろっている
// 使い方: node tools/tests/charts.js [シード]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3'], judge: (o) => (o.includes('財政のグラフ 合格') ? '' : '財政のグラフの記録か図が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3'] = process.argv.slice(2);
const sim = H.load({});
const res = {};
const g = sim.run(sim.newGame(seed, { nations: 6 }), 40);
g.setSpectate(false);
g.pc = 100;
for (let i = 0; i < 20; i++) g.advance(0.25);
g.setFiscal({ tax: 0.2 }, true);
const markYear = Math.round(g.year * 100) / 100;
for (let i = 0; i < 40; i++) g.advance(0.25);
const c = g.chron[g.cap];
res.rows = !!c && c.r.length >= 49 && c.r.every((r) => r.length === 7 && r.every((v) => v === null || Number.isFinite(v))) && c.r.every((r, i) => !i || r[0] === c.r[i - 1][0] + 1);
res.values = c.r.slice(-10).every((r) => r[2] !== null && r[3] !== null && r[4] !== null && r[5] !== null) && c.r.slice(-10).some((r) => r[1] !== null && r[6] !== null);
res.mark = c.m.some((m) => m[0] === markYear && m[1].includes('tax'));
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = JSON.stringify(g2.chron) === JSON.stringify(g.chron);
const html = sim.evaluate('(g) => fiscalChartsHtml(g)');
const all = html(g), svgs = (all.match(/<svg viewBox="0 0 260/g) || []).length, years = (s) => (s.match(/<tr><td>\d+<\/td>/g) || []).length;
res.panels = svgs === 5 && all.includes('data-act="chartspan"') && /stroke-dasharray="1 2"/.test(all); // 財政を変えた年の点線
sim.evaluate('app.chartSpan = 10'); // 画面の状態 app (画面なしの版にもある)
const ten = html(g);
sim.evaluate('app.chartSpan = 0');
const whole = html(g);
sim.evaluate('delete app.chartSpan');
res.span = years(ten) === 10 && years(whole) === c.r.length;
// 星系の記録 (known) に、GDP と、前からの項目 (主人・収入・借り・力) がそろっている (前に注釈の書き方の誤りで行の後ろの項目が消えた)
const v = Object.keys(g.govs).map(Number).find((id) => id !== g.cap && g.isColonized(id) && g.realmOf(id) === g.cap && g.govs[id].lord !== null);
res.snapshot = v === undefined || ['gdp', 'lord', 'income', 'loan', 'power', 'energy'].every((k) => k in (g.snapshot(v) || {}));
const g3 = sim.newGame(seed, { nations: 6 });
res.empty = !html(g3).includes('<svg');
const ok = Object.values(res).every(Boolean);
console.log(`財政のグラフ ${ok ? '合格' : '不合格'}`, JSON.stringify(res), `記録 ${c.r.length} 年・印 ${c.m.length}`);
process.exitCode = ok ? 0 : 1;
