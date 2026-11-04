// 国どうしの威圧 (回 AI7・B-305・W6-Q3 = a。docs/ai-behavior.md の 14) の試験。画面なしの版で回す
// 1. 求める条件: 点の分だけ、講和会議と同じ値段で選ぶ (従属は点が足りて近ければそれだけ・星系・交易協定・資金)。点が足りなければ威圧しない
// 2. 光の遅れ: 要求は相手の首都に光速で届いてから答えられ、返事も光速で戻る
// 3. AI の国の判断: 戦えば見込む点が −(求められた点 + 譲る面目) 以下なら飲む。飲めば条件を果たす (星系・資金・交易協定)。理由の内訳が記録に付く (F30)
// 4. 断られたら: 宣戦の見込み + 引き下がる面目が線を越えれば宣戦する (脅しを実行する)。越えなければ引き下がる。どちらも理由が付く
// 5. 人間の国には「決めること」として届き、飲む・断る・期限切れ (断る) で答える。返事は光速で戻る
// 6. 威圧の返事を待つ国は、同じ相手に重ねて威圧も宣戦もしない。威圧された国は威圧した国を恨む (帳簿の coerce)
// 7. セーブと読み込みで、届く途中と返事待ちの威圧が残る
// 使い方: node tools/tests/coerce.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('国どうしの威圧') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const C = sim.evaluate('COERCE'), T = sim.evaluate('TREATY'), B = sim.evaluate('BARGAIN');

const g = sim.newGame('7', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.diplo = { pacts: [], sent: [], breach: {} };
g.coerce = [];
const ai = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.realmAlive(c)).sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b));
check(ai.length >= 3, `AI の国が足りない (${ai.length})`);
// a と b は互いに宣戦できる距離 (届いた記録でも国) の組
const reach = (x, y) => g.sysDist(x, y) <= sim.evaluate('BARGAIN.warDist') && g.seenBy(x, y)?.[1] === y;
const pair = ai.flatMap((x) => ai.map((y) => [x, y])).find(([x, y]) => x !== y && reach(x, y) && reach(y, x));
check(pair, '互いに届く AI の国の組がない');
const [a, b] = pair || ai, c = ai.find((x) => x !== a && x !== b);
const last = (r) => (g.aiLog[r] || [])[(g.aiLog[r] || []).length - 1]?.t || '';
// 受け入れる線の点を決めて与える (読み違いも 0 に)。理由の内訳の数も埋める
const res0 = g.reservation, mis0 = g.misread, bias0 = g.aiWarBias, claim0 = g.claimBonus;
const fix = (val) => { g.misread = () => 0; g.aiWarBias = () => 0; g.claimBonus = () => 0; g.reservation = (r, e, z, ws, out) => { if (out) Object.assign(out, { ours: 30, theirs: 10, allies: 0, p: 0.73, expect: 28, cost: 1, shift: 0 }); return typeof val === 'function' ? val(r, e) : val; }; };
const unfix = () => { g.reservation = res0; g.misread = mis0; g.aiWarBias = bias0; g.claimBonus = claim0; };
const give = (r, n) => { const s = g.realmSystems(r); for (const x of s.slice(1)) g.gov(x.id).lord = r; return s.length; };
give(b);

// 1. 条件
const t30 = g.coerceTerms(a, b, 30), t100 = g.coerceTerms(a, b, 100), t1 = g.coerceTerms(a, b, 1);
check(t30.terms.length && t30.pts <= 30 && t30.pts === t30.terms.reduce((k, t) => k + t.c, 0), `30 点の条件の点が合わない (${JSON.stringify(t30)})`);
check(!t1.terms.length, `1 点で条件が選ばれた (${JSON.stringify(t1)})`);
if (g.sysDist(a, b) <= 30) check(t100.terms.length === 1 && t100.terms[0].k === 'v' && t100.pts === T.vassal, `100 点で近い国に従属を求めない (${JSON.stringify(t100)})`);
check(t30.terms.some((t) => t.k === 't') || g.pactBetween(a, b, 'trade') || !g.pactAllowed(a, b, 'trade') || t30.terms.reduce((k, t) => k + t.c, 0) + C.tradePts > 30, `点が残るのに交易協定 (協定) を求めない (${JSON.stringify(t30)})`);

// 2・3. 光の遅れと AI の国の判断 (飲む)
fix(-60);
g.coerceSend(a, b, 30, 0);
const o1 = g.coerce.find((o) => o.from === a && o.to === b);
check(o1 && o1.st === 'go' && Math.abs(o1.at - (g.year + g.sysDist(a, b))) < 1e-9, `威圧が光速で届く形でない (${JSON.stringify(o1)})`);
check(/に艦隊 \d+ を見せて、.*を求めた \(\d+ 点。首都に届いた記録で: 艦隊 自分 \d+・相手 \d+.*勝つ見込み \d+%/.test(last(a)), `威圧した国の記録に理由がない (${last(a)})`);
const y0 = g.year, cash0 = g.gov(a).credits, sysB0 = g.realmSystems(b).length;
g.coerceYearly();
check(g.coerce.includes(o1), '届く前に答えられた');
g.year = o1.at + 0.01;
g.coerceYearly();
const back1 = g.coerce.find((o) => o.from === a && o.to === b);
check(back1 && back1.st === 'back' && back1.ok === 1 && Math.abs(back1.at - (g.year + g.sysDist(b, a))) < 1e-9, `飲んだ返事が光速で戻らない (${JSON.stringify(back1)})`);
check(/の威圧 \(.*\) を飲んだ \(首都に届いた記録で: 艦隊 自分 \d+・相手 \d+.*戦えば見込む点 -?\d+・譲る点 −\d+・譲る面目 −\d+/.test(last(b)), `飲んだ国の記録に理由がない (${last(b)})`);
const gotSys = o1.terms.filter((t) => t.k[0] === 's').map((t) => Number(t.k.slice(1)));
check(gotSys.every((s) => g.realmOf(s) === a), '明け渡した星系が威圧した国のものにならない');
if (o1.terms.some((t) => t.k === 't')) check(g.pactBetween(a, b, 'trade'), '交易協定が結ばれない');
if (o1.terms.some((t) => t.k[0] === 'c')) check(g.gov(a).credits > cash0, '資金が届かない');
check(gotSys.length === 0 || g.realmSystems(b).length < sysB0, '星系が減らない');
check(g.memView(b, a).m.coerce > 0, '威圧された記憶が残らない');
g.year = back1.at + 0.01;
g.coerceYearly();
check(!g.coerce.length && /が威圧 \(.*\) を飲んだと知らせが届いた/.test(last(a)), `飲んだ返事が届いても記録にない (${last(a)})`);

// 4. 断られて宣戦する・引き下がる
for (const r of ai) g.gov(r).credits = Math.max(g.gov(r).credits, 10 * T.cash); // 条件に資金が残るように
fix((r) => (r === a ? B.declare - C.audience + 5 : 60));
g.coerceSend(a, b, 30, 0);
let o2 = g.coerce[0];
g.year = o2.at + 0.01; g.coerceYearly();
o2 = g.coerce[0];
check(o2 && o2.st === 'back' && o2.ok === 0, `強い国が威圧を飲んだ (${JSON.stringify(o2)})`);
check(/の威圧 \(.*\) を断った \(首都に届いた記録で/.test(last(b)), `断った国の記録に理由がない (${last(b)})`);
g.year = o2.at + 0.01; g.coerceYearly();
check(g.atWar(a, b), '断られて、見込み + 面目が線を越えても宣戦しない');
check(/威圧を断られた・引き下がる面目 \+\d+・首都に届いた記録で: 艦隊 自分/.test(last(a)), `脅しを実行した宣戦に理由がない (${last(a)})`);
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.coerce = [];
fix((r) => (r === b ? B.declare - C.audience - 5 : 60));
g.coerceSend(b, a, 30, 0);
let o3 = g.coerce[0];
g.year = o3.at + 0.01; g.coerceYearly();
o3 = g.coerce[0];
g.year = o3.at + 0.01; g.coerceYearly();
check(!g.atWar(b, a) && /に威圧を断られ、引き下がった \(見込む点 -?\d+・引き下がる面目 \+\d+・宣戦の線 \d+\)/.test(last(b)), `見込みが線に届かないのに引き下がらない (${last(b)})`);

// 4b. 返事を待つ国は、その相手と不可侵も同盟も結ばない。ほかの国と交戦中なら、holdYears 年まで待ってから考え直す
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.coerce = [];
fix((r) => (r === a ? B.declare - C.audience + 5 : 60));
g.coerceSend(a, b, 30, 0);
check(g.pactScore(a, b, 'nap').s < 0 && /への威圧の返事を待っている/.test(g.pactScore(a, b, 'nap').why) && g.pactScore(a, b, 'ally').s < 0, '威圧の返事を待つ国が、その相手と協定を結べる');
let o7 = g.coerce[0];
g.year = o7.at + 0.01; g.coerceYearly();
o7 = g.coerce[0];
g.beginWar(a, c, a); // ほかの国と交戦中 (開戦を知っている)
const known = g.aiKnowsWar; g.aiKnowsWar = () => true;
g.year = o7.at + 0.01; g.coerceYearly();
const held = g.coerce.find((o) => o.from === a && o.to === b);
check(held && held.st === 'back' && Number.isFinite(held.hold) && !g.atWar(a, b), `交戦中の国が、待たずに決めた (${JSON.stringify(held)})`);
delete g.realmWars[g.warKey(a, c)];
g.year = held.at + 0.01; g.coerceYearly();
check(g.atWar(a, b) && !g.coerce.some((o) => o.from === a && o.to === b), 'ほかの戦争が終わっても、待っていた考え直しをしない');
g.aiKnowsWar = known;
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.coerce = [];

// 6. 返事を待つ国は重ねない
fix(60);
g.coerce = [];
g.coerceSend(a, c, 30, 0);
const n0 = g.coerce.length;
g.aiPress(a, { r: c, v: 30, z: 0 });
check(g.coerce.length === n0 && !g.atWar(a, c), '返事を待つ相手に重ねて威圧か宣戦をした');
g.aiPress(a, { r: b, v: 30, z: 0 });
check(g.coerce.length === n0 && g.atWar(a, b), 'ほかの相手への返事を待つ国が、前のとおり宣戦しない');
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.coerce = [];
sim.evaluate('COERCE.on = false');
g.aiPress(a, { r: c, v: 30, z: 0 });
sim.evaluate('COERCE.on = true');
check(g.atWar(a, c) && !g.coerce.length, '威圧を切ると宣戦にならない');
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];

// 5. 人間の国へ: 決めること
g.coerce = [];
g.gov(g.cap).credits = Math.max(g.gov(g.cap).credits, 5 * T.cash);
g.coerceSend(a, g.cap, 30, 0);
let o4 = g.coerce[0];
g.year = o4.at + 0.01; g.coerceYearly();
o4 = g.coerce[0];
const dec = g.decisions.find((d) => d.kind === 'coerce' && d.cid === o4?.id);
check(o4 && o4.st === 'ask' && dec && dec.opts.map((x) => x.k).join() === 'accept,refuse' && dec.def === 'refuse', `人間の国に決めることとして届かない (${JSON.stringify(o4)})`);
check(dec && /を見せて、.*を求めてきた。首都に届いた記録で: .*勝つ見込み \d+%・戦えば見込む戦勝点 -?\d+ \(求められたものは \d+ 点\)。返事は光速で/.test(dec.text), `決めることに見立てがない (${dec?.text})`);
const capCash = g.gov(g.cap).credits;
g.pc = 100;
const rr = g.command('decide', { sys: g.cap, id: dec.id, opt: 'accept' });
check(rr.ok, `飲む返事を送れない (${JSON.stringify(rr)})`);
g.advance(0.25);
const o5 = g.coerce.find((o) => o.from === a && o.to === g.cap);
check(o5 && o5.st === 'back' && o5.ok === 1, `人間の国の飲む返事が戻らない (${JSON.stringify(o5)})`);
if (o4.terms.some((t) => t.k[0] === 'c')) check(g.gov(g.cap).credits < capCash, '人間の国が飲んでも資金が減らない');
// 期限切れは断る
g.coerce = [];
g.coerceSend(b, g.cap, 30, 0);
let o6 = g.coerce[0];
g.year = o6.at + 0.01; g.coerceYearly();
const dec6 = g.decisions.find((d) => d.kind === 'coerce' && d.cid === o6.id);
g.year = dec6.deadline + 0.01;
g.decisionsYearly();
o6 = g.coerce.find((o) => o.from === b);
check(o6 && o6.st === 'back' && o6.ok === 0, `期限切れで断らない (${JSON.stringify(o6)})`);

// 7. セーブ
g.coerceSend(c, a, 30, 0);
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && JSON.stringify(g2.coerce) === JSON.stringify(g.coerce) && g2.coerce.length >= 2, '威圧がセーブから戻らない');
unfix();

// 8. 試合の中で起きる (観戦。6 か国 × 150 年)
const h = sim.newGame('3', { nations: 6 });
let sent = 0, answered = 0;
const w = (n, f) => { const o = h[n].bind(h); h[n] = (...x) => f(o, ...x); };
w('coerceSend', (o, ...x) => { const r = o(...x); if (r) sent++; return r; });
w('coerceReply', (o, ...x) => { answered++; return o(...x); });
sim.run(h, 150);
check(sent > 0 && answered > 0, `試合の中で威圧が起きない (送った ${sent}・答えた ${answered})`);

console.log(fails.length ? `国どうしの威圧 不合格\n${fails.join('\n')}` : `国どうしの威圧 合格 (試合の中で送った ${sent}・答えた ${answered})`);
process.exit(fails.length ? 1 : 0);
