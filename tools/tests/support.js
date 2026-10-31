// 利益集団の支持で政策を通す (回 SE7・B-022) の試験。画面なしの版で回す:
//   支持: 声を持つのは権力に加わっている集団だけ・声の重さはいちばん上の分位の 1 人が下の 1.31 倍・支持は 0〜1・
//     福祉の予算を増やすと首都の下の分位ほど支持し、所得への税を上げると上の分位ほど反対する・関税は下の分位ほど支持する・軍事は伝統的な集団ほど支持する
//   審議: 支持が ENACT.now 以上ならすぐ通る・足りなければ審議中になり、関門で進めば 3 段で通り (財政が変わる)、3 回押し戻されると廃案 (しばらく出せない)・
//     押し戻されると「決めること」になり、押すと 1 段進む・出し直しても押し戻された回数は残る・引っ込められる・政策金利はすぐ変わる・国家方針も審議にかかる・保存と読み込みで残る
//   関門の見込み: 支持 0.1・0.5・0.7 で通る見込み 16%・50%・68% (文書の値)
// 使い方: node tools/tests/support.js [シード] [年数]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3', '80'], judge: (o) => (o.includes('支持 合格') ? '' : '利益集団の支持と審議の結果が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', years = '80'] = process.argv.slice(2);
const sim = H.load({});
const { FISCAL_DEFAULT, ENACT, SUPPORT, GROUP_STATUS, GROUPS } = sim.tables;
const g = sim.run(sim.newGame(seed, { nations: 6 }), Number(years)); // 観戦で国を育ててから、人間が動かす
g.setSpectate(false);
g.pc = 200;
const res = {}, near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const f0 = g.fiscal || FISCAL_DEFAULT;
const ff = (over) => ({ ...FISCAL_DEFAULT, ...f0, budget: { ...FISCAL_DEFAULT.budget, ...(f0.budget || {}) }, ...over });
// 1. 支持
const welfare = g.billSupport('fiscal', ff({ budget: { ...FISCAL_DEFAULT.budget, welfare: 0.15 } }));
res.range = welfare.S > 0 && welfare.S < 1 && welfare.groups.length > 0 && welfare.groups.every((x) => x.p > 0 && x.p < 1 && x.w > 0);
const capG = (s, q) => s.groups.find((x) => x.sys === g.cap && x.q === q && x.k === s.groups.find((y) => y.sys === g.cap)?.k);
res.welfareQ = capG(welfare, 0).p > capG(welfare, 4).p; // 福祉: 下の分位ほど得
const tax = g.billSupport('fiscal', ff({ tax: 0.25 }));
res.taxQ = capG(tax, 4).p < capG(tax, 0).p && tax.S < 0.5; // 所得への税: 上の分位ほど損。みな損なので半分より低い
const tariff = g.billSupport('fiscal', ff({ tariff: 0.1 }));
res.tariffQ = capG(tariff, 0).p > capG(tariff, 4).p; // 関税: 下の分位ほど働き口を守る保護を支持する
// 声の重さは星系の所得の分け前で (回 KE11)。標準の分け前 (GROUPS.quint) なら、いちばん上の分位の 1 人が下の 1.31 倍 (Lupu & Warner 2022)
const Q = g.quintOf(g.cap);
res.clout = near(capG(welfare, 4).w / capG(welfare, 0).w, Math.pow(Q[4] / Q[0], SUPPORT.clout), 1e-9) && near(Math.pow(GROUPS.quint[4] / GROUPS.quint[0], SUPPORT.clout), 1.31, 0.01);
// 声を持つのは権力に加わっている集団だけ (締め出された民族の集団は数えない)
res.included = welfare.groups.every((x) => { const id = x.sys, k = id === g.cap ? null : g.known(id), G = k ? k.groups : g.groupsOf(id); return GROUP_STATUS[G.eth.find((e) => e.k === x.k).st].incl; });
// 価値観: 軍事の予算は伝統的な集団ほど支持する (同じ集団の価値観だけを動かして比べる)
const Gc = g.groupsOf(g.cap), e0 = Gc.eth[0].k, fm = ff({ budget: { ...FISCAL_DEFAULT.budget, military: 0.1 } });
const lo = g.supportLogit('fiscal', fm, f0, { ...Gc, values: { ...Gc.values, secular: Gc.values.secular - 1 } }, e0, 2, [], false);
const hi = g.supportLogit('fiscal', fm, f0, { ...Gc, values: { ...Gc.values, secular: Gc.values.secular + 1 } }, e0, 2, [], false);
res.values = lo > hi && near(lo - hi, 2 * 0.45, 1e-9);
// 2. 審議
const orig = g.billSupport.bind(g);
let fake = null;
g.billSupport = (kind, target) => (fake === null ? orig(kind, target) : { S: fake, groups: [] });
fake = 0.8;
res.now = g.command('fiscal', { welfare: 0.05 }).ok && !g.bill('fiscal') && g.fiscal.budget.welfare === 0.05; // 支持が高いとすぐ通る
fake = 0.4;
const rate0 = g.cbRateAt(g.cap);
res.pending = g.command('fiscal', { tax: 0.2, rate: 0.03 }).ok && !!g.bill('fiscal') && Math.abs(Number(g.fiscal.tax) - FISCAL_DEFAULT.tax) < 1e-9 && g.fiscal.rate === 0.03 && g.fiscal.cb === 0 && g.fiscalDraft().tax === 0.2 && rate0 !== undefined; // 税は審議中、政策金利はすぐ
const origRand = g.rand.bind(g);
g.rand = () => 0; // 関門でいつも進む
for (let i = 0; i < 8; i++) g.advance(0.25); // 2 年: 0.5 年ごとの関門 3 つで通る
res.passed = !g.bill('fiscal') && g.fiscal.tax === 0.2;
g.rand = () => 0.85; // いつも押し戻される (0.9 より上は止まる)
const nd = g.decisions.length;
res.propose2 = g.command('fiscal', { tax: 0.22 }).ok;
g.advance(0.25); g.advance(0.25);
const dec = g.decisions.slice(nd).find((d) => d.kind === 'bill');
res.decision = !!dec && dec.opts.some((o) => o.k === 'push' && o.pc === g.billPushCost('fiscal')) && g.bill('fiscal').back === 1;
const st = g.bill('fiscal').stage, pc0 = g.pc;
res.push = g.command('decide', { sys: g.cap, id: dec.id, opt: 'push' }).ok;
for (let i = 0; i < 2 && g.bill('fiscal')?.stage === st; i++) g.advance(0.01); // 首都への返事が届くまで
res.pushed = g.bill('fiscal')?.stage === st + 1 && g.pc < pc0;
const back1 = g.bill('fiscal')?.back;
res.reproposeKeepsBack = g.command('fiscal', { tax: 0.225 }).ok && g.bill('fiscal').back === back1 && g.bill('fiscal').stage === 0; // 出し直しでも押し戻された回数は残る
for (let i = 0; i < 8; i++) g.advance(0.25);
res.failed = !g.bill('fiscal') && g.fiscal.tax === 0.2 && g.command('fiscal', { tax: 0.21 }).ok === false; // 廃案のあとしばらく出せない
for (let i = 0; i < 9; i++) g.advance(0.25);
res.withdraw = g.command('fiscal', { tax: 0.21 }).ok && !!g.bill('fiscal') && g.command('bill', { bill: 'fiscal', op: 'withdraw' }).ok && !g.bill('fiscal');
// 国家方針も審議にかかる・保存と読み込み
g.rand = origRand;
const want = g.policy?.id === 'consolidate' ? 'expand' : 'consolidate';
if (g.policy) g.policy.since = g.year - 100;
res.policy = g.command('policy', { value: want }).ok && g.bill('policy')?.target === want && g.policy?.id !== want;
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
g2.restore(d);
res.saveLoad = JSON.stringify(g2.players[g2.pi].bills) === JSON.stringify(g.players[g.pi].bills);
// 3. 関門の見込み (式そのものを数える。3 段で通り 3 回で廃案)
const passP = (S) => { const a = (1 - ENACT.stall) * (0.25 + 0.5 * S), b = (1 - ENACT.stall) * (0.75 - 0.5 * S), p = a / (a + b), q = 1 - p; return p ** 3 * (1 + 3 * q + 6 * q * q); };
res.odds = [0.1, 0.5, 0.7].map((S) => Math.round(passP(S) * 100)).join() === '16,50,68';
const ok = Object.values(res).every(Boolean);
console.log(`支持 ${ok ? '合格' : '不合格'}`, JSON.stringify(res));
console.log(`福祉 15%: 支持 ${(welfare.S * 100).toFixed(1)}%・税率 25%: ${(tax.S * 100).toFixed(1)}%・関税 10%: ${(tariff.S * 100).toFixed(1)}%・集団 ${welfare.groups.length}`);
process.exitCode = ok ? 0 : 1;
