// 語り手の連作 (回 SE3・B-050) の試験。画面なしの版で回す
// 1. 返事が届くと、続きの段が 8〜15 年あとに同じ星系で予約され、その年に起きる。続きの知らせは光の遅れで地球に届く
// 2. 前の段の答えで、次の段の中身が変わる (難民: 同化政策 → 地下の抵抗、自治区 → 自前の議会)
// 3. 続きの星系が自国でなくなったら、連作はそこで切れる
// 4. 同じ種類 (頭の出来事) は 1 試合に STORY_MAX 回まで。種類は 20 以上
// 5. どの選択肢にも観戦の AI の重み (weigh) があり、セーブで予約が残る
// 6. 星系の政府が決めたこと (gv.did。回 SE4): 期限切れで現地が決めた・総督が方針で要求に答えた、を覚え、光の遅れで地球に届く
// 使い方: node tools/tests/story.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('語り手') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const { STORY } = sim.tables;

const g = sim.newGame('5', { nations: 0 }); // 観戦で広げてから、人の手に戻す
sim.run(g, 60);
for (let y = 0; y < 200 && !g.realmSystems(g.cap).some((x) => x.id !== g.cap && g.lightDelay(x.id) > 2); y += 10) sim.run(g, 10);
g.setSpectate(false);
const far = g.realmSystems(g.cap).map((x) => x.id).filter((id) => id !== g.cap && g.lightDelay(id) > 2).sort((a, b) => g.lightDelay(b) - g.lightDelay(a))[0];
if (far === undefined) { console.log('語り手 不合格\n光の遅れの大きい自国の星系がない'); process.exit(1); }
g.story.queue = [];
g.decisions = [];

// 1・2
STORY.cult.start(g, far);
const d1 = g.decisions.find((x) => x.type === 'cult');
check(d1 && d1.seen > g.year + 1, '頭の出来事が光より速く見えた');
g.year = d1.seen;
g.pc = 100;
const rd = g.command('decide', { sys: far, id: d1.id, opt: 'suppress' });
check(rd.ok, `返事が送れない (${JSON.stringify(rd)})`);
const arrive = g.requests.find((q) => q.act === 'decide' && Number(q.d.id) === d1.id)?.arrive;
check(arrive > g.year, '返事が光速の指令として送られていない');
const steps = Math.ceil(4 * (arrive - g.year + 1));
for (let i = 0; i < steps; i++) g.advance(0.25);
const q = g.story.queue.find((x) => x.type === 'cult2');
check(q && q.sys === far && q.data.path === 'suppress' && q.at >= arrive + 8 - 1e-6 && q.at <= arrive + 15 + 1e-6, `続きの段が予約されない、か年が違う (${JSON.stringify(q)})`);
if (q) {
  g.year = q.at - 0.01;
  g.storyYearly();
  check(!g.decisions.some((x) => x.type === 'cult2'), '予約の年より前に続きが起きた');
  g.year = q.at + 0.01;
  g.storyYearly();
  const d2 = g.decisions.find((x) => x.type === 'cult2');
  check(d2 && Math.abs(d2.seen - (g.year + g.lightDelay(far))) < 1e-6, '続きの段が起きない、か知らせが光の遅れで届かない');
  check(d2 && d2.opts.some((o) => o.k === 'raid'), '前の段の答え (抑えた) で、続きの中身が分かれない');
  // 2: 自治区を選んだ難民の続き
  g.decisions = [];
  STORY.refugees3.start(g, far, { species: 'テスト人', path: 'enclave' });
  check(g.decisions.at(-1)?.opts.some((o) => o.k === 'grant'), '自治区の続きが「自前の議会」にならない');
}

// 3
g.story.queue = [{ type: 'scandal2', sys: far, at: g.year, data: {} }];
const gv = g.govs[far];
const lord = gv.lord;
gv.lord = null; gv.independent = true;
g.storyYearly();
check(!g.decisions.some((x) => x.type === 'scandal2') && !g.story.queue.length, '自国でなくなった星系で、連作の続きが起きた');
gv.lord = lord; gv.independent = false;

// 4
const types = Object.keys(STORY);
check(types.length >= 20, `種類が 20 より少ない (${types.length})`);
g.story.count = Object.fromEntries(types.map((t) => [t, sim.tables.STORY_MAX ?? 2]));
g.story.phase = 'on'; g.story.phaseEnd = g.year + 50; g.story.last = g.year - 30; g.story.recent = {};
const n0 = g.decisions.length;
for (let i = 0; i < 20; i++) { g.year += 1; g.storyYearly(); }
check(g.decisions.length === n0, '上限まで来た種類の出来事が、また来た');

// 5
for (const [t, def] of Object.entries(STORY)) if (def.start && t !== 'raid') check(typeof def.weigh === 'function' && typeof def.resolve === 'function', `${t} に weigh か resolve がない`);
g.story.queue = [{ type: 'signal2', sys: far, at: g.year + 5, data: {} }];
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '5', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && g2.story.queue?.[0]?.type === 'signal2', '連作の予約がセーブから戻らない');

// 6
g.decisions = [];
gv.did = [];
STORY.accident.start(g, far);
const d6 = g.decisions.find((x) => x.type === 'accident');
check(d6, '事故の出来事が起きない');
if (d6) {
  g.year = d6.deadline + 0.01;
  g.decisionsYearly();
  const did = g.govs[far].did?.at(-1);
  check(did && did.year === Math.floor(g.year) && /現地で決めた/.test(did.why), `期限切れで現地が決めたことを覚えない (${JSON.stringify(g.govs[far].did)})`);
  g.recordSnapshots();
  check(!(g.known(far)?.did || []).some((x) => x.year === did?.year && x.what === did?.what), '星系の政府が決めたことが光より速く地球に見えた');
  const t0 = g.year;
  for (let i = 0; i < Math.ceil(g.lightDelay(far)) + 1; i++) { g.year = t0 + i + 1; g.recordSnapshots(); }
  check((g.known(far)?.did || []).some((x) => x.what === did?.what), '星系の政府が決めたことが、光の遅れのあとも地球に届かない');
}
gv.governor = 'yield';
gv.unrest = { stage: 1, since: g.year - 10 };
g.raiseDemand(far, gv);
check(/総督の方針「譲歩する」/.test(gv.did?.at(-1)?.why || ''), `総督が方針で要求に答えたことを覚えない (${JSON.stringify(gv.did?.at(-1))})`);
gv.did = Array.from({ length: 20 }, (_, i) => ({ year: Math.floor(g.year) - 30 + i, what: 'x', why: 'y' }));
g.govDid(far, 'z', 'w');
check(gv.did.length <= sim.tables.GOV_DID.max && gv.did.every((x) => x.year > g.year - sim.tables.GOV_DID.years), `古い決めたことを捨てない (${gv.did.length} 件)`);
const g3 = new sim.Game(sim.generateGalaxy({ seed: '5', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g3.restore(JSON.parse(JSON.stringify(sim.buildSave(g)))) && g3.govs[far].did?.at(-1)?.what === 'z', '星系の政府が決めたことがセーブから戻らない');

console.log(fails.length ? `語り手 不合格\n${fails.join('\n')}` : `語り手 合格 (種類 ${types.length}・光の遅れ ${g.lightDelay(far).toFixed(1)} 年の星系で)`);
process.exit(fails.length ? 1 : 0);
