// 帰着の表と損の大きさと行政の遅れ (回 KE8・B-012) の試験。画面なしの版で回す:
//   帰着の表: 手段ごとに部門 (家計・会社・政府・ほかの国) を足すと 0・所得への税の家計の分 = −税率の差 × 家計の所得・5 分位の和 = 家計の分 + 星系の家計が持つ会社の分・
//     所得への税は上の分位に、消費税は下の分位に重い (分位の所得に対する割合)・集団ごとの表の和が星系の分と合う
//   忠誠と議会: 税の項 = LOSS.loyalty × 家計の損の割合 (所得への税だけなら前の式 −15 × (k − 1) と同じ)・集団の分位の倍率は人口で平均すると 1・集団の差の平均は 0
//   行政の遅れ: 所得への税は ADMIN_LAG.tax 年あとに首都で効く・消費税を新しく入れると ctaxNew 年・遅れの途中でほかの手段を変えても、前の手段の効き始めは動かない・
//     保存と読み込みで残る・前の版のセーブ (効き始めの on がない) は光の遅れだけ
// 使い方: node tools/tests/incidence.js [シード] [年数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3', '80'], judge: (o) => (o.includes('帰着 合格') ? '' : '帰着の表・損の大きさ・行政の遅れの結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', years = '80'] = process.argv.slice(2);
const sim = H.load({});
const { FISCAL_DEFAULT, LOSS, ADMIN_LAG, INCIDENCE, BUDGET } = sim.tables;
const g = sim.run(sim.newGame(seed, { nations: 6 }), Number(years)); // 観戦で国を育ててから、人間が動かす (財政を選べる)
g.setSpectate(false);
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const ids = g.realmSystems(g.cap).map((s) => s.id).filter((id) => g.isColonized(id));
const Y = ids.reduce((a, id) => a + g.hhIncomeOf(id), 0);
// 1. 帰着の表 (標準から、すべての手段を動かした財政へ)
const f1 = { ...FISCAL_DEFAULT, tax: 0.2, ctax: 0.1, tariff: 0.05, rate: 0.04, cb: 0, rdcredit: 0.1, budget: { ...FISCAL_DEFAULT.budget, welfare: 0.1, education: 0.05, military: 0.05 } };
const rows = g.incidenceOf(g.cap, f1, FISCAL_DEFAULT), by = Object.fromEntries(rows.map((r) => [r.k, r]));
res.rows = ['tax', 'ctax', 'rate', 'welfare', 'education', 'military'].every((k) => by[k]); // 関税と研究開発の税額控除は、輸入と会社の研究開発がなければ行がない
res.zeroSum = rows.every((r) => near(r.hh + r.fm + r.gov + r.row, 0, 1e-9));
res.taxHH = Y > 0 && near(by.tax.hh, -(0.2 - FISCAL_DEFAULT.tax) * Y);
res.qSum = rows.every((r) => near(r.q.reduce((a, v) => a + v, 0), Object.values(r.sys).reduce((a, s) => a + s.hh + s.fm * s.own, 0)));
const rel = (r, q) => r.q[q] / (Y * sim.tables.GROUPS.quint[q] / sim.tables.GROUPS.quint.reduce((a, v) => a + v, 0));
res.progressive = rel(by.tax, 4) < rel(by.tax, 0) && rel(by.ctax, 0) < rel(by.ctax, 4) && rel(by.welfare, 0) > rel(by.welfare, 4); // 損はマイナス: 所得税は上ほど、消費税は下ほど、福祉の得は下ほど大きい
const vas = ids.filter((id) => id !== g.cap && g.groupsOf(id)).sort((a, b) => g.hhIncomeOf(b) - g.hhIncomeOf(a))[0];
const gi = vas !== undefined ? g.groupIncidence(vas, f1, FISCAL_DEFAULT) : [];
res.groups = vas !== undefined && gi.length > 0 && near(gi.reduce((a, x) => a + x.v, 0), rows.reduce((a, r) => a + (r.sys[vas] ? r.sys[vas].hh + r.sys[vas].fm * r.sys[vas].own : 0), 0));
// 2. 忠誠と議会: 所得への税だけなら前の式と同じ・倍率の平均は 1・集団の差の平均は 0
res.factor = Object.keys(INCIDENCE).every((k) => near([0, 1, 2, 3, 4].reduce((a, q) => a + g.incFactor(k, q), 0) / 5, 1));
g.pc = 100;
res.set = g.setFiscal({ tax: 0.2, ctax: 0.1, tariff: 0.05, welfare: 0.1 }).ok;
const t0 = g.year;
res.lagged = g.fiscalFor(g.cap, g.cap).tax === FISCAL_DEFAULT.tax && g.fiscalFor(g.cap, g.cap).tariff === 0 && g.fiscalFor(g.cap, g.cap).ctax === 0; // 決めたばかりでは、首都でもまだ効いていない
g.advance(0.25); g.advance(0.25); // 0.5 年: 関税 (0.05 年) と予算 (0.5 年) は効き、所得への税 (0.85 年) と消費税 (新しく入れる 1.75 年) はまだ
const e1 = g.fiscalFor(g.cap, g.cap);
res.lagMid = e1.tariff === 0.05 && e1.budget.welfare === 0.1 && e1.tax === FISCAL_DEFAULT.tax && e1.ctax === 0;
res.pendingKept = g.setFiscal({ tariff: 0.06 }).ok && near(g.fiscal.on.ctax, t0 + ADMIN_LAG.ctaxNew) && near(g.fiscal.on.tax, t0 + ADMIN_LAG.tax) && g.fiscal.prev.ctax === 0; // 遅れの途中で関税を変えても、消費税と所得への税の効き始めは動かない
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = JSON.stringify(g2.fiscalFor(g2.cap, g2.cap)) === JSON.stringify(g.fiscalFor(g.cap, g.cap));
for (let i = 0; i < 8; i++) g.advance(0.25); // 2.5 年: すべて効く
const e2 = g.fiscalFor(g.cap, g.cap);
res.lagDone = e2.tax === 0.2 && e2.ctax === 0.1 && e2.tariff === 0.06 && e2 === g.fiscal;
const far = ids.filter((id) => id !== g.cap && g.gov(id).lord !== null).sort((a, b) => g.sysDist(g.cap, b) - g.sysDist(g.cap, a))[0];
if (far !== undefined) {
  for (let i = 0; i < Math.ceil(g.sysDist(g.cap, far) * 4) + 4; i++) g.advance(0.25);
  const T = g.loyaltyTerms(far) || [], tx = T.find((t) => t.label.startsWith('税 ('));
  const l = g.policyLoss(far);
  res.loyalty = !!tx && near(tx.v, LOSS.loyalty * (l.tax + l.ctax + l.tariff)) && near(tx.parts.tax, -15 * (0.2 / FISCAL_DEFAULT.tax - 1)) && tx.label === '税 (20.0% + 消費税 10.0% + 関税 6.0%)';
  const G = g.groupsOf(far);
  res.groupMean = !!G && near(G.eth.reduce((a, e) => a + e.share * [0, 1, 2, 3, 4].reduce((b, q) => b + 0.2 * g.groupDev(G, e.k, q, T), 0), 0), 0, 1e-9);
} else res.loyalty = res.groupMean = false;
// 議会: 首都の家計の損 × LOSS.council (戦争疲弊などは前と同じ)
res.council = LOSS.council < 0 && near(LOSS.council * 0.045, -0.5 * (0.2 / FISCAL_DEFAULT.tax - 1));
// 前の版のセーブ (on がない): 光の遅れだけ
const old = JSON.parse(JSON.stringify(sim.buildSave(g)));
const pf = old.players?.[0]?.fiscal;
if (pf) { delete pf.on; delete pf.done; pf.since = g.year; }
const g3 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
res.oldSave = !!pf && g3.restore(old) && g3.fiscalFor(g3.cap, g3.cap).tax === 0.2;
res.budgetLabel = by.welfare.label === `${BUDGET.welfare.label}の予算`;
const ok = Object.values(res).every(Boolean);
console.log(`帰着 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
console.log(rows.map((r) => `${r.k}: 家計 ${r.hh.toFixed(1)}・会社 ${r.fm.toFixed(1)}・政府 ${r.gov.toFixed(1)}・ほかの国 ${r.row.toFixed(1)}・分位 ${r.q.map((v, q) => (100 * rel(r, q)).toFixed(2)).join('/')}%`).join('\n'));
process.exitCode = ok ? 0 : 1;
