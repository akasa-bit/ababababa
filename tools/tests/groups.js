// 星系の中の集団 (回 SE6・B-020・B-021。docs/groups.md) の試験。画面なしの版で回す
// 1. 権力への近さが統治体制の実態 (統治者の任免) から決まる: 宗 → よそ生まれが優位・ここ生まれは無力、分 → 上級と下級の分担、従 → ここ生まれが優位。
//    ほかの種族は無力 (強制労働の型は差別)。主人のいない首都は支配する種族がみな優位
// 2. 試合の星系の民族の割合の和が 1、締め出された割合が 0〜1、集団の忠誠度を人口で平均すると星系の忠誠度 (民族も分位も)。
//    集団の価値観 (QD-42) も人口で平均すると星系の値で、上の分位ほど自己表現寄り、よそ生まれは伝統寄り
// 3. 離反の起きやすさに「政治から締め出された人口」の項が入り、倍率が exp(β × (割合 − 基準))
// 4. 直轄の星系だけ、命令 include で権力への近さを変えられる (光速の指令)。地球に届く記録に集団が入る。セーブで残り、読み直しても同じ筋
// 5. 現地のエリート (B-021) は、ここ生まれのいちばん上の分位の集団の忠誠度で動く
// 使い方: node tools/tests/groups.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('集団') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const g = sim.newGame('4', { nations: 6 });
const GB = sim.evaluate('GROUPS.exclBeta'), GR = sim.evaluate('GROUPS.exclRef');

// 1. 権力への近さ
const st = (key, regime) => g.groupStatusOf(key, { fact: sim.evaluate(`REGIMES['${regime}'].fact`), regime });
const want = [['home', 'T07', 'dom'], ['local', 'T07', 'powerless'], ['home', 'T04', 'senior'], ['local', 'T04', 'junior'], ['home', 'T13', 'junior'], ['local', 'T13', 'dom'],
  ['other', 'T04', 'powerless'], ['other', 'encomienda', 'discr'], ['local', 'direct', 'powerless']];
for (const [k, r, s] of want) check(st(k, r) === s, `${r} の ${k} が ${st(k, r)} (${s} のはず)`);
check(g.groupStatusOf('local', { lord: false, fact: 'SSSSSSSS' }) === 'dom', '主人のいない首都のここ生まれが優位でない');
check(g.groupStatusOf('local', { fact: 'SSSSSSSS', regime: 'direct', include: { local: 'incl' } }) === 'junior', '手で加えたここ生まれが下級の分担でない');

// 2. 試合の星系
sim.run(g, 120);
let n = 0, nEx = 0;
for (const id of Object.keys(g.govs).map(Number)) {
  const G = g.groupsOf(id);
  if (!G) continue;
  n++;
  const sum = G.eth.reduce((a, e) => a + e.share, 0);
  check(Math.abs(sum - 1) < 1e-9, `星系 ${id} の民族の割合の和 ${sum}`);
  check(G.excl >= 0 && G.excl <= 1 + 1e-9, `星系 ${id} の締め出された割合 ${G.excl}`);
  if (G.excl > 0.05) nEx++;
  const terms = g.loyaltyTerms(id);
  const eth = G.eth.reduce((a, e) => a + e.share * g.groupDev(G, e.k, undefined, terms), 0);
  const all = G.eth.reduce((a, e) => a + e.share * [0, 1, 2, 3, 4].reduce((b, q) => b + 0.2 * g.groupDev(G, e.k, q, terms), 0), 0);
  check(Math.abs(eth) < 1e-9 && Math.abs(all) < 1e-9, `星系 ${id} の集団の忠誠度の平均が星系の忠誠度からずれる (${eth}・${all})`);
  // 価値観 (QD-42): 集団の値を人口で平均すると星系の値、上の分位ほど自己表現寄り、よそ生まれはここ生まれより伝統寄り
  for (const x of ['secular', 'selfexp']) {
    const m = G.eth.reduce((a, e) => a + e.share * [0, 1, 2, 3, 4].reduce((b, q) => b + 0.2 * g.groupValuesOf(G, e.k, q)[x], 0), 0);
    check(Math.abs(m - G.values[x]) < 1e-9, `星系 ${id} の集団の価値観 (${x}) の平均 ${m} が星系の値 ${G.values[x]} とずれる`);
  }
  check(g.groupValuesOf(G, 'local', 4).selfexp > g.groupValuesOf(G, 'local', 0).selfexp, `星系 ${id} の上の分位が自己表現寄りでない`);
  if (G.eth.some((e) => e.k === 'home') && G.eth.some((e) => e.k === 'local')) check(g.groupValuesOf(G, 'home').secular < g.groupValuesOf(G, 'local').secular, `星系 ${id} のよそ生まれが伝統寄りでない`);
  // 3. 離反の起きやすさの項
  const T = g.secessionTerms(id);
  if (T) {
    const t = T.find((x) => x.label === '政治から締め出された人口');
    const f = Math.exp(GB * (G.excl - GR) * (G.excl > GR ? G.xk ?? 1 : 1)); // 結束の種族の国は基準より多い分の効きが半分 (回 SE10)
    check(t && Math.abs(t.f - f) < 1e-9, `星系 ${id} の締め出しの項 ${t?.f} (${f} のはず)`);
  }
}
console.log(`集団のある星系 ${n}・締め出された人口が 5% を超える星系 ${nEx}`);
check(n > 20, `集団のある星系が少ない (${n})`);

// 4. 直轄の星系で include
g.setSpectate(false);
const cap = g.cap;
const vas = Object.keys(g.govs).map(Number).find((id) => g.govs[id].lord === cap && g.realmOf(id) === cap && g.isColonized(id) && id !== cap && g.groupsOf(id)?.eth.some((e) => e.k === 'local'));
if (vas === undefined) fails.push('地球の国の家臣の星系がない');
else {
  g.pc = 1000;
  const bad = g.command('include', { sys: vas, key: 'local', value: 'incl' });
  check(!bad.ok, '直轄でない星系に include が通った');
  Object.assign(g.govs[vas], { direct: true, loyalty: 100, autonomy: 0, unrest: { stage: 0 } }); delete g.govs[vas].regime; delete g.govs[vas].fact; delete g.govs[vas].law; // 指令に従う直轄の星系にする
  for (let i = 0; i < 4 * (g.lightDelay(vas) + 2); i++) g.advance(0.25); // 直轄になった記録を地球に届ける
  check(g.groupStatus(g.govs[vas], 'local') === 'powerless', `直轄のここ生まれが ${g.groupStatus(g.govs[vas], 'local')} (無力のはず)`);
  g.pc = 100; // 届けるあいだの年に政治力を使っていることがある (筋による。回 KE10) ので、送る前に足しておく
  const r = g.command('include', { sys: vas, key: 'local', value: 'incl' });
  check(r.ok, `include が送れない: ${r.reason}`);
  for (let i = 0; i < 4 * (g.lightDelay(vas) + 1) && !g.govs[vas].include; i++) g.advance(0.25);
  check(g.govs[vas].include?.local === 'incl' && g.groupStatus(g.govs[vas], 'local') === 'junior', `include が届いても変わらない (${JSON.stringify(g.govs[vas].include)})`);
  for (let i = 0; i < 4 * (g.lightDelay(vas) + 1); i++) g.advance(0.25);
  check(g.known(vas)?.groups?.eth?.some((e) => e.k === 'local' && e.st === 'junior') && g.known(vas)?.include?.local === 'incl', '地球に届いた記録に集団と include がない');
  // 5. 現地のエリート
  const G = g.groupsOf(vas);
  const el = g.eliteLoyalty(vas, g.govs[vas]), L = g.govs[vas].loyalty;
  const dev = g.groupDev(G, g.eliteKey(G), 4, g.loyaltyTerms(vas));
  check(Math.abs(el - Math.max(0, Math.min(100, L + dev))) < 1e-9, `エリートの忠誠度 ${el} (星系 ${L} + 差 ${dev})`);
  // セーブ
  const strip = (x) => { const o = sim.buildSave(x); delete o.savedAt; return JSON.stringify(o); };
  const s1 = strip(g);
  const g2 = new sim.Game(sim.generateGalaxy({ seed: g.galaxy.seed, starCount: 400, meanSpacing: 4, kind: 'real', gen: g.galaxy.gen }));
  g2.restore(JSON.parse(s1));
  check(g2.govs[vas].include?.local === 'incl', 'セーブで include が残らない');
  for (let i = 0; i < 40; i++) { g.advance(0.25); g2.advance(0.25); }
  check(strip(g) === strip(g2), '保存して読み直すと筋が変わる');
}

console.log(fails.length ? `集団 不合格\n${fails.join('\n')}` : '集団 合格');
process.exit(fails.length ? 1 : 0);
