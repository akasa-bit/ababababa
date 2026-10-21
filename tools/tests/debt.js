// 国債と財政の反応 (段 4 の 3) の試験: 国債が出ること・残高と持ち越しがマイナスにならないこと・手元の資金が税収の DEBT.cash 年分ほどに
// 収まる (超えた分は国債の返済か行政サービスに使う) こと・人間が動かす首都は、赤字の上限が「なし」なら国債を出さず行政サービスも払わず、
// 上限を選ぶとその分だけ借りられる (使える資金が増える) こと・保存と読み込みで残ること。画面なしの版で回す
// 使い方: node tools/tests/debt.js [シード] [年数]
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
const over = govs.filter((v) => g.year - (v.founded ?? 0) > 10 && v.credits > 2 * DEBT.cash * Math.max(0, (v.ledger?.tax || 0) + (v.ledger?.natives || 0)) + 50); // できて 10 年までの政府は開拓資金 (200 cr) を持っていてよい
res.cashSpent = over.length <= 0.1 * govs.length;
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = Object.keys(g.govs).every((k) => g2.govs[k]?.bond === g.govs[k].bond && JSON.stringify(g2.govs[k]?.fr) === JSON.stringify(g.govs[k].fr));
// 人間が動かす首都 (観戦でない) は前のまま
const h = sim.run(sim.newGame(seed, { nations: 6, spectate: false }), 30);
const cap = h.gov(h.cap);
res.humanExempt = !(cap.bond > 0) && !(cap.ledger?.public) && h.funds(h.cap) === cap.credits;
const set = h.setFiscal({ deficit: 0.03 }).ok, room = h.funds(h.cap) - cap.credits;
res.deficitRoom = set && Math.abs(room - Math.min(0.03 * cap.fr.y, DEBT.limit * cap.fr.y)) < 1e-6 && room > 0 && h.setFiscal({ deficit: 0.02 }).ok === false;
const ok = Object.values(res).every(Boolean);
console.log(`国債 ${ok ? '合格' : '不合格'}`, JSON.stringify(res), `国債のある政府 ${govs.filter((v) => v.bond > 0).length}/${govs.length}・資金が多すぎる政府 ${over.length}`);
process.exitCode = ok ? 0 : 1;
