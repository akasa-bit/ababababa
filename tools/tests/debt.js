// 国債と財政の反応 (段 4 の 3) の試験: 国債が出ること・残高と持ち越しがマイナスにならないこと・手元の資金が税収の DEBT.cash 年分ほどに
// 収まる (超えた分は国債の返済か行政サービスに使う) こと・人間が動かす首都は、赤字の上限が「なし」なら国債を出さず行政サービスも払わず、
// 上限を選ぶとその分だけ借りられる (使える資金が増える) こと・保存と読み込みで残ること。画面なしの版で回す
// 使い方: node tools/tests/debt.js [シード] [年数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: ['3', '100'], judge: (o) => (o.includes('国債 合格') ? '' : '国債の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', years = '100'] = process.argv.slice(2);
const sim = H.load({});
const { DEBT } = sim.tables;
const g = sim.run(sim.newGame(seed, { nations: 6 }), Number(years));
const res = {};
const govs = Object.entries(g.govs).filter(([k]) => g.isColonized(Number(k))).map(([, v]) => v);
res.someBonds = govs.some((v) => v.bond > 0);
res.nonNegative = Object.values(g.govs).every((v) => !(v.bond < 0) && !(v.due < 0));
// できて 10 年までの政府は開拓資金 (200 cr) を持っていてよい。人口 100 万人未満の政府 (自給だけで市場の所得と税がなく、国債の式が働かない) は見ない
const govs2 = Object.entries(g.govs).filter(([k]) => g.isColonized(Number(k)) && g.coloniesIn(Number(k)).reduce((a, c) => a + c.pop, 0) >= 1).map(([, v]) => v);
const over = govs2.filter((v) => g.year - (v.founded ?? 0) > 10 && v.credits > 2 * DEBT.cash * Math.max(0, (v.ledger?.tax || 0) + (v.ledger?.natives || 0)) + 50);
res.cashSpent = over.length <= Math.max(1, 0.1 * govs2.length); // 1 つまでは、ならしている途中 (超えた分は 1 年ほどで使う) として許す
// 人間でない国の財政: AI_FISCAL.vary = 0 (既定。C-22) なら標準のまま、1 なら国ごとに現実の分布から引かれ幅の中にある
const { AI_FISCAL, FISCAL_DEFAULT } = sim.tables;
const ai = Object.values(g.aif || {});
res.aiFiscal = AI_FISCAL.vary ? ai.length > 1 && new Set(ai.map((f) => f.tax)).size > 1 && ai.every((f) => f.tax >= 0.02 && f.tax <= 0.34 && f.ctax >= 0 && f.ctax <= 0.27 && f.tariff >= 0 && f.tariff <= 0.29)
  : ai.every((f) => f.tax === FISCAL_DEFAULT.tax && !f.ctax && !f.tariff);
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = Object.keys(g.govs).every((k) => g2.govs[k]?.bond === g.govs[k].bond && JSON.stringify(g2.govs[k]?.fr) === JSON.stringify(g.govs[k].fr));
// 人間が動かす首都 (観戦でない) は前のまま
const h = sim.run(sim.newGame(seed, { nations: 6, spectate: false }), 30);
const cap = h.gov(h.cap);
res.humanExempt = !(cap.bond > 0) && !(cap.ledger?.public) && h.funds(h.cap) === cap.credits;
const set = h.setFiscal({ deficit: 0.03 }, true).ok, room = h.funds(h.cap) - cap.credits;
res.deficitRoom = set && Math.abs(room - Math.min(0.03 * cap.fr.y, DEBT.limit * cap.fr.y)) < 1e-6 && room > 0 && h.setFiscal({ deficit: 0.0225 }, true).ok === false && h.setFiscal({ deficit: 0.2 }, true).ok === false; // 刻み (0.5%) と幅 (15%) の外は選べない
const ok = Object.values(res).every(Boolean);
console.log(`国債 ${ok ? '合格' : '不合格'}`, JSON.stringify(res), `国債のある政府 ${govs.filter((v) => v.bond > 0).length}/${govs.length}・資金が多すぎる政府 ${over.length}`);
process.exitCode = ok ? 0 : 1;
