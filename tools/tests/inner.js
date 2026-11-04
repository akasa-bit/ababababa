// 中の事情 (回 AI4・B-303。politics/inner.js) の試験。画面なしの版で回す
// 1. 議会の支持が低い AI の国は、受け入れる線が下がる (宣戦しにくく、講和を受けやすい)。人間の国には効かない
// 2. 外の国への派閥 (Victoria 3 の派閥の形。politics/lobby.js): 交易の深い相手には親 X 派ができ、受け入れる線が下がり (戦いにくい)、協定を受けやすい。
//    恨みからは反 X 派ができて線が上がる。政府が派閥の望みに逆らう (親 X 派の相手に宣戦する) と満足が下がり、議会の支持が下がる。協定の理由に派閥
// 3. 宣戦・同盟の参戦・講和の理由の文に「中の事情」が出る
// 4. 遠い総督の独断: 首都から遠い星系が、首都の指令より先に国の名で宣戦する (知らせはその星系から)。首都は知らせが届いてから追認か否認を決め、
//    否認すると受け入れる線が下がり (講和に向かう)、総督の星系の忠誠度が下がる
// 5. 中の勢力への手: 人間の国が AI の国の首都へ反対派を支える資金を送ると、光速で届いてから議会の支持が下がり、資金は届いた年に払う。
//    知られれば内政への干渉として恨まれる。親 (自分の国) 派に資金を出すと、派閥ができる (あれば重みが上がる)。家臣の星系の主人の側を支えると、
//    主人への忠誠度が上がり、恩として残る。AI の国も資金を出す
// 6. セーブと読み込みで、総督の独断と届く途中の資金と派閥が残る
// 使い方: node tools/tests/inner.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('中の事情') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const I = sim.evaluate('INNER');
const set = (k, v) => sim.evaluate(`INNER.${k} = ${JSON.stringify(v)}`);

const g = sim.newGame('7', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.diplo = { pacts: [], sent: [], breach: {} };
g.mem = {};
const ai = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.realmAlive(c) && g.isSeat(c)).sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b));
check(ai.length >= 2, `席のある AI の国が足りない (${ai.length})`);
const [a, b] = ai;
const seat = (r) => g.players[g.playerOf(r)];

// 1. 議会の支持
seat(a).council = 90;
const r90 = g.reservation(a, b, 0, 0);
seat(a).council = 10;
const r10 = g.reservation(a, b, 0, 0);
check(Math.abs((r90 - r10) - I.council * 80 / I.councilRef) < 1e-6, `議会の支持で受け入れる線がずれない (${r90.toFixed(2)} / ${r10.toFixed(2)})`);
check(g.innerCost(g.cap, a) === 0, '人間の国に中の事情が効いた');

// 2. 外の国への派閥
const L = I.lob;
const setL = (k, v) => sim.evaluate(`INNER.lob.${k} = ${JSON.stringify(v)}`);
g.inner.lob = [];
g.innerCache = null;
const c0 = g.innerCost(a, b);
const sa = g.realmSystems(a)[0].id, sb = g.realmSystems(b)[0].id;
g.routes.push({ id: g.nextShipId++, a: sa, b: sb, lv: 1, ships: 1, transit: [{}, {}], vol: [1e6, 1e6], built: g.year, by: sa });
g.innerCache = null;
setL('chance', 1);
g.lobbyYearly();
const lt = g.inner.lob.find((l) => l.r === a && l.to === b && l.why === 'trade');
check(lt && lt.pro && lt.end === null, `交易の深い相手に親 X 派ができない (${JSON.stringify(g.inner.lob)})`);
const wt = lt ? g.lobbyClout(lt) : 0, c1 = g.innerCost(a, b);
check(wt > 0.2 && wt < 0.7 && Math.abs(c1 - c0 - L.war * wt) < 1e-6, `親 X 派で受け入れる線が下がらない (重み ${wt.toFixed(2)}・重さ ${c0.toFixed(1)} → ${c1.toFixed(1)})`);
const ps = g.pactScore(a, b, 'trade');
check(/中の事情: .*親.*派 \(交易・重み/.test(ps.why), `協定の理由に派閥が出ない (${ps.why})`);
seat(a).council = 90;
const pHi = g.pactScore(a, b, 'nap').s;
seat(a).council = 10;
const pLo = g.pactScore(a, b, 'nap').s;
check(pHi > pLo, `議会の支持が低いと協定を批准しにくくならない (${pHi.toFixed(2)} / ${pLo.toFixed(2)})`);
// 政府が親 b 派に逆らう (b に宣戦した記憶) と満足が下がり、議会の支持が下がる
seat(a).council = 50;
g.memAdd(a, b, 'agg', a);
check(lt && lt.ap === -1, `親 X 派の相手に宣戦しても満足が下がらない (${lt?.ap})`);
const co0 = seat(a).council;
g.lobbyYearly();
check(Math.abs(seat(a).council - (co0 - L.council * wt)) < 1e-6, `派閥の不満で議会の支持が下がらない (${co0} → ${seat(a).council}・重み ${wt.toFixed(3)})`);
check(lt && Math.abs(lt.ap + L.apDecay) < 1e-9, `派閥の満足が薄まらない (${lt?.ap})`);
// 恨み: b が a を侵略した (a の星系で。a はすぐ知る) → 反 b 派ができ、線が上がる (戦いやすい)
g.memAdd(b, a, 'agg', a);
g.lobbyYearly();
const lg = g.inner.lob.find((l) => l.r === a && l.to === b && l.why === 'grudge' && l.end === null);
check(lg && !lg.pro, '恨みから反 X 派ができない');
// 派閥があるときとないときの重さの差 (議会の支持の動きを除くため、同じ年のうちに比べる)
const withOut = (l, f) => { const e = l.end; l.end = g.year; g.innerCache = null; const v0 = f(); l.end = e; g.innerCache = null; return [v0, f()]; };
if (lg) {
  const [cN, cY] = withOut(lg, () => g.innerCost(a, b));
  check(Math.abs(cY - (cN - L.war * g.lobbyClout(lg))) < 1e-6, `反 X 派で受け入れる線が上がらない (${cN.toFixed(1)} → ${cY.toFixed(1)})`);
}
check(/反.*派 \(恨み/.test(g.peaceWhy(a, b) + g.pactScore(a, b, 'nap').why), '理由の文に反 X 派が出ない');
// 交易が細ると親 X 派は消える
g.routes.pop();
g.innerCache = null;
g.lobbyYearly();
check(lt && lt.end !== null, '交易が細っても親 X 派が消えない');
setL('chance', L.chance);
g.inner.lob = [];
g.mem = {};
g.innerCache = null;
seat(a).council = 30;

// 3. 理由の文
g.aiLog = {};
g.aiDeclare(a, b, 0);
check((g.aiLog[a] || []).some((e) => /中の事情: 議会の支持 30/.test(e.t)), `宣戦の理由に中の事情が出ない (${JSON.stringify(g.aiLog[a])})`);
check(/中の事情/.test(g.peaceWhy(a, b)), `講和の理由に中の事情が出ない (${g.peaceWhy(a, b)})`);
check(/中の事情/.test(g.aiHonor(a, g.cap, b).why), '同盟の参戦の理由に中の事情が出ない');
// 同盟の参戦: 守る国への親 X 派は参戦を後押しする
{
  const l = g.lobbyForm(a, g.cap, true, 'thank');
  check(l, '守る国への親 X 派ができない');
  if (l) {
    const [hN, hY] = withOut(l, () => g.innerCost(a, b, null, g.cap)); // 参戦の見込みからは、この重さを引く (読み違いの乱数を除いて比べる)
    const h1 = g.aiHonor(a, g.cap, b);
    check(Math.abs(hN - hY - L.war * g.lobbyClout(l)) < 1e-6 && /親.*派 \(恩/.test(h1.why), `守る国への親 X 派で参戦の見込みが上がらない (${hN.toFixed(1)} → ${hY.toFixed(1)}・${h1.why})`);
  }
  g.inner.lob = [];
  g.innerCache = null;
}
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];

// 4. 遠い総督の独断
set('farLy', 0); set('govChance', 1); set('govBold', 1e6); set('govRange', 1e6);
g.inner.gov = {};
const before = new Set(Object.keys(g.realmWars));
g.governorsYearly();
const gk = Object.keys(g.inner.gov).find((k) => !before.has(k));
check(gk, '遠い総督が独断で宣戦しない');
if (gk) {
  const v = g.inner.gov[gk], root = g.warBy[gk], e = gk.split('|').map(Number).find((x) => x !== root);
  check(v.s !== root && g.realmOf(v.s) === root && g.warNews[gk].from === v.s && v.ok === null, `独断の知らせが総督の星系から出ていない (${JSON.stringify(v)}・${JSON.stringify(g.warNews[gk])})`);
  check((g.aiLog[root] || []).some((x) => /総督が.*独断で宣戦した/.test(x.t)), '独断の宣戦が判断の記録に出ない');
  const d = g.sysDist(v.s, root);
  if (d > 1) { g.governorReview(); check(g.inner.gov[gk].ok === null, '首都が、知らせの届く前に追認か否認をした'); }
  g.year += d + 0.01;
  set('endorse', 1e9); // 必ず否認する
  const res0 = g.reservation(root, e, 0);
  const loy0 = g.gov(v.s).loyalty ?? 50;
  g.governorReview();
  set('endorse', I.endorse);
  check(g.inner.gov[gk].ok === 0, '首都が否認しない');
  check(Math.abs(res0 - g.reservation(root, e, 0) - I.disavow) < 1e-6, `否認しても受け入れる線が下がらない (${res0.toFixed(1)} → ${g.reservation(root, e, 0).toFixed(1)})`);
  check((g.gov(v.s).loyalty ?? 50) <= loy0 - I.disavowLoyalty + 1e-6 || loy0 < I.disavowLoyalty, '否認しても総督の星系の忠誠度が下がらない');
  check((g.aiLog[root] || []).some((x) => /否認し、講和に向かう/.test(x.t)), '否認が判断の記録に出ない');
}
set('farLy', I.farLy); set('govChance', I.govChance); set('govBold', I.govBold); set('govRange', I.govRange);
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.inner.gov = {};

// 5. 揺さぶり
const M = I.meddle;
sim.evaluate('INNER.meddle.exposed = 1');
g.cash('test', 1e4, { gov: g.cap });
g.pc = 100;
seat(a).council = 50;
const cr0 = g.gov(g.cap).credits, pc0 = g.pc;
const r1 = g.command('meddle', { sys: a, mode: 'undermine' });
check(r1.ok && Math.abs(pc0 - g.pc - M.pc) < 1e-9 && g.gov(g.cap).credits === cr0, `揺さぶりが送れない、か政治力を払わない・資金を先に払った (${JSON.stringify(r1)}・${pc0} → ${g.pc})`);
const q = g.inner.sent.find((x) => x.to === a && x.from === g.cap);
check(q && Math.abs(q.at - (g.year + g.sysDist(g.cap, a))) < 1e-9, '揺さぶりの届く年が光速と違う');
check(!g.command('meddle', { sys: a, mode: 'undermine' }).ok, '同じ星系への資金を 2 つ送れた');
g.meddleArrive();
check(seat(a).council === 50 || g.sysDist(g.cap, a) < 1e-9, '揺さぶりが光より速く効いた');
const yA = g.year;
g.year = q.at + 0.01;
g.cash('test', 1e4, { gov: g.cap }); // 届くまでの年の支出のぶん
const cr1 = g.gov(g.cap).credits;
g.meddleArrive();
check(Math.abs(seat(a).council - (50 - M.council)) < 1e-6, `揺さぶりで議会の支持が下がらない (${seat(a).council})`);
check(Math.abs(cr1 - g.gov(g.cap).credits - M.cost) < 1e-6, `揺さぶりの資金を届いた年に払っていない (${cr1} → ${g.gov(g.cap).credits})`);
check((g.mem[`${g.cap}|${a}`] || []).some((e) => e.k === 'meddle'), '知られた揺さぶりが内政への干渉として残らない');
g.year = q.at + g.sysDist(a, a) + 0.02;
check(g.memView(a, g.cap).m.meddle > 0 && /内政への干渉/.test(g.memView(a, g.cap).text), `内政への干渉が恨みとして数えられない (${JSON.stringify(g.memView(a, g.cap))})`);
// 親 (自分の国) 派に資金を出す: 届いた年に払い、派閥ができる。もう一度出すと重みが上がる
g.year = yA;
check(g.command('meddle', { sys: b, mode: 'lobby' }).ok, '親 (自分の国) 派に資金を出せない');
const q3 = g.inner.sent.find((x) => x.to === b && x.from === g.cap);
check(q3 && q3.mode === 'lobby', '派閥への資金の向きが違う');
g.year = q3.at + 0.01;
g.cash('test', 1e4, { gov: g.cap });
const cr3 = g.gov(g.cap).credits;
g.meddleArrive();
const lf = g.inner.lob.find((l) => l.r === b && l.to === g.cap && l.pro && l.end === null);
check(lf && lf.why === 'fund' && lf.fund > g.year && Math.abs(cr3 - g.gov(g.cap).credits - M.cost) < 1e-6, `資金で親 (自分の国) 派ができない (${JSON.stringify(lf)})`);
if (lf) {
  const w0 = g.lobbyClout({ ...lf, fund: 0 }), w1 = g.lobbyClout(lf);
  check(Math.abs(w1 - Math.min(1, w0 * (1 + L.fundBoost))) < 1e-9 && w0 > 0, `資金の効くあいだに派閥の重みが上がらない (${w0.toFixed(3)} → ${w1.toFixed(3)})`);
}
// 家臣の星系の主人の側を支える
const vs = g.realmSystems(a).find((s) => s.id !== a)?.id;
if (vs !== undefined) {
  g.year = yA;
  const loy = g.gov(vs).loyalty = 40;
  check(g.command('meddle', { sys: vs, mode: 'back' }).ok, '家臣の星系へ資金を送れない');
  const q2 = g.inner.sent.find((x) => x.to === vs);
  g.year = q2.at + 0.01;
  g.cash('test', 1e4, { gov: g.cap });
  g.meddleArrive();
  check(Math.abs(g.gov(vs).loyalty - (loy + M.loyalty)) < 1e-6, `主人の側を支えても主人への忠誠度が上がらない (${g.gov(vs).loyalty})`);
  check((g.mem[`${g.cap}|${a}`] || []).some((e) => e.k === 'gift'), '主人の側を支えた資金が恩として残らない');
}
sim.evaluate(`INNER.meddle.exposed = ${M.exposed}`);
// AI の国の揺さぶり
sim.evaluate('INNER.meddle.aiChance = 1');
for (const r of ai) { seat(r).pc = 100; g.cash('test', 1e4, { gov: r }); }
g.inner.sent = [];
// いちばんの脅威が見えなくても、協定の相手に親 (自分の国) 派を育てる道があるように、a と b に協定を結ばせる (試合の道によらない試験にする)
if (!g.diplo.pacts.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) g.makePact(a, b, 'nap');
g.aiMeddleYearly();
sim.evaluate(`INNER.meddle.aiChance = ${M.aiChance}`);
check(g.inner.sent.some((x) => ai.includes(x.from)), 'AI の国が揺さぶりも派閥への資金も出さない');

// 6. セーブ
g.inner.gov['1|2'] = { s: 3, y: g.year, ok: null };
if (!g.inner.lob.length) g.inner.lob.push({ r: a, to: b, pro: false, why: 'grudge', y: g.year, end: null, ap: -0.5, fund: 0 });
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && JSON.stringify(g2.inner) === JSON.stringify(g.inner), '総督の独断か届く途中の資金か派閥がセーブから戻らない');

console.log(fails.length ? `中の事情 不合格\n${fails.join('\n')}` : `中の事情 合格 (議会の支持での線のずれ ${(r90 - r10).toFixed(1)}・交易の派閥の重み ${wt.toFixed(2)}・届く途中の資金 ${g.inner.sent.length}・派閥 ${g.inner.lob.length})`);
process.exit(fails.length ? 1 : 0);
