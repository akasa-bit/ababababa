// 国と国のあいだの記憶と評判・指導者 (回 AI3・B-302。politics/memory.js) の試験。画面なしの版で回す
// 1. 帳簿: a が b にしたこと (侵略・裏切り・救援・贈り物・独立の支援) は、出来事の星系から観る国の首都へ光が届いた年から効き、半減 MEM.half 年で薄れる
// 2. 記録の入口: AI の国の宣戦 (aiDeclare) は侵略、協定の相手への宣戦と同盟の参戦を断るのは裏切り (pactBreach)、同盟に従った参戦は救援、協定の贈り物は贈り物
// 3. 効き: 恩があると協定を受けやすく (pactScore)、恨みがあると協定を受けにくく、宣戦の見込みが上がる (aiWarBias)。理由の文に記憶が出る
// 4. 指導者: 人間が動かしていない国ごとに、カタカナの名前 (英語の画面ではローマ字) と経歴がある。年がたつと代わり、前の指導者と退き方を覚える
// 5. 星系の欄 (その国の首都の節) に指導者と、プレイヤーの国についての記憶が出る (光の遅れで届いた分)
// 6. セーブと読み込みで帳簿と指導者が残る
// 使い方: node tools/tests/memory.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('記憶と指導者') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const MEM = sim.evaluate('MEM'), LEADER = sim.evaluate('LEADER');

const g = sim.newGame('7', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.diplo = { pacts: [], sent: [], breach: {} };
g.mem = {};
const ai = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.realmAlive(c)).sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b));
check(ai.length >= 3, `AI の国が足りない (${ai.length})`);
const [a, b, c] = ai;

// 1. 光の遅れと薄れ
const d = g.sysDist(a, b);
g.memAdd(a, b, 'agg', a);
check(g.memSum(b, a, b).agg === 0 || d < 1e-9, '侵略の記憶が、光が届く前に効いた');
check(Math.abs(g.memSum(b, a, b, g.year + d + 0.01).agg - Math.pow(0.5, (d + 0.01) / MEM.half)) < 1e-6, `光が届いたあとの重みが半減の式と違う (${g.memSum(b, a, b, g.year + d + 0.01).agg})`);
check(g.memSum(a, a, b).agg === 1, 'した国自身は、すぐに覚えていない');
check(g.memSum(b, a, b, g.year + d + MEM.half).agg < 0.51, '半減の年に半分まで薄れない');

// 3. 効き (光が届いたあとに)
const y0 = g.year;
g.year = y0 + d + 0.01;
const s0 = g.pactScore(b, a, 'nap'), w0 = g.aiWarBias(b, a);
g.mem = {};
const s1 = g.pactScore(b, a, 'nap'), w1 = g.aiWarBias(b, a);
check(s0.s < s1.s && /の記憶: 侵略/.test(s0.why), `侵略の恨みで協定が受けにくくならない、か理由に出ない (${s0.s.toFixed(2)} / ${s1.s.toFixed(2)}・${s0.why})`);
check(w0 > w1, `侵略の恨みで宣戦の見込みが上がらない (${w0} / ${w1})`);
g.memAdd(a, b, 'rescue', a);
g.year += d + 0.01;
const s2 = g.pactScore(b, a, 'nap');
check(s2.s > g.pactScore(c, a, 'nap').s - 10 && s2.s > s1.s - 1e-9 && /救援/.test(s2.why), `救援の恩で協定が受けやすくならない (${s2.s.toFixed(2)} / ${s1.s.toFixed(2)}・${s2.why})`);
g.year = y0;
g.mem = {};

// 2. 記録の入口
g.aiDeclare(a, b, 0);
check((g.mem[`${a}|${b}`] || []).some((e) => e.k === 'agg'), 'AI の国の宣戦が侵略として残らない');
g.pactBreach(c, 'ためし', b);
check((g.mem[`${c}|${b}`] || []).some((e) => e.k === 'betray'), '破約が裏切りとして残らない');
g.gov(c).credits = Math.max(g.gov(c).credits, 5000);
g.makePact(c, a, 'trade', 4000);
check((g.mem[`${c}|${a}`] || []).some((e) => e.k === 'gift' && Math.abs(e.w - 4000 / MEM.giftUnit) < 1e-6), `協定の贈り物が残らない (${JSON.stringify(g.mem[`${c}|${a}`])})`);
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.diplo.pacts = [];
const pc = g.makePact(c, b, 'ally', 0);
pc.onA = pc.onB = g.year - 1;
g.beginWar(a, b, a);
g.warNews[g.warKey(a, b)] = { year: g.year - 100, from: b };
const honor = sim.evaluate('PACT.honorLine');
sim.evaluate('PACT.honorLine = -1e9'); // 必ず応じる
if (g.isSeat(c)) g.asRealm(c, () => g.resolvePact({ type: 'call', pact: pc.id, ally: b, enemy: a }, 'join')); else g.diplomacyYearly();
sim.evaluate(`PACT.honorLine = ${honor}`);
check((g.mem[`${c}|${b}`] || []).some((e) => e.k === 'rescue') || g.isSeat(c), '同盟に従った参戦が救援として残らない');

// 4. 指導者
g.leaders = {};
g.leadersYearly();
const L = g.leaders[a];
check(L && /^[゠-ヿ]+$/.test(L.name) && LEADER.careers[L.career], `AI の国に指導者がいない、か名前と経歴の形が違う (${JSON.stringify(L)})`);
const roma = sim.evaluate('romanize')(L?.name || '');
check(roma && /^[A-Za-z ]+$/.test(roma), `指導者の名前がローマ字にならない (${roma})`);
check(!g.leaders[g.cap], '人間の国に指導者が置かれた');
let changed = 0;
for (let i = 0; i < 40; i++) { const n0 = g.leaders[a]?.name; g.year += 1; g.leadersYearly(); if (g.leaders[a]?.name !== n0) changed++; }
check(changed >= 4 && changed <= 30 && g.leaders[a]?.prev && 'irr' in g.leaders[a].prev, `指導者が年 ${LEADER.exit} の割合で代わらない、か前の指導者を覚えない (40 年で ${changed} 回)`);

// 5. 星系の欄
g.spectate = true;
g.memAdd(g.cap, a, 'agg', g.cap); // プレイヤーの国が a にしたこと (a の記憶)
for (const e of g.mem[`${g.cap}|${a}`]) e.y -= g.sysDist(g.cap, a) + 1; // a の首都へ光が届いた後にする
const html = String(sim.evaluate('aiLogSec')(g, a));
g.spectate = false;
check(html.includes(g.leaders[a].name) && /の記憶: 侵略/.test(html), `星系の欄に指導者と記憶が出ない (${html.slice(0, 200)})`);

// 6. セーブ
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && JSON.stringify(g2.mem) === JSON.stringify(g.mem) && JSON.stringify(g2.leaders) === JSON.stringify(g.leaders), '帳簿か指導者がセーブから戻らない');

console.log(fails.length ? `記憶と指導者 不合格\n${fails.join('\n')}` : `記憶と指導者 合格 (帳簿の組 ${Object.keys(g.mem).length}・指導者 ${Object.keys(g.leaders).length} 人・40 年で ${changed} 回交代)`);
process.exit(fails.length ? 1 : 0);
