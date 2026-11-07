// 上の帯の資源 (依頼 2026-11-07 の GA-1。screen/resbar.js) の試験。画面なしの版で回す:
//   1. 帯に資源が 7 つ以上並び、上の段は首都 (選んでいなければ)、自分の国の別の星系を選ぶとその星系になる
//   2. 国全体の在庫は、自分の国の星系の、光が首都に届いた時点の記録 (known) の合計。首都のほかの星系は、いまの在庫でなく記録の値
//   3. 変化は、見てきた在庫の 1 年前との差 (年あたり)。押したときの欄に、需要と供給の行と国全体の列がある
//   4. 帯と欄を描いても試合の状態は変わらない (描かずに同じだけ進めた試合と、状態の要約が同じ)
// 使い方: node tools/tests/resbar.js [シード] [先に進める年]
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ args: ['3', '40'], judge: (o) => (o.includes('資源の帯 合格') ? '' : (o.match(/^資源の帯 不合格[^\n]*/m) || ['資源の帯の結果が違う'])[0]) }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const [seed = '3', yS = '40'] = process.argv.slice(2);
const fails = [];
const sim = H.load({});
const mk = () => { const g = sim.newGame(seed, { nations: 6 }); sim.run(g, Number(yS)); g.setSpectate(false); return g; };
const g = mk(), twin = mk();
const ui = sim.evaluate('({ bar: resBarHtml, pop: resPopHtml, sample: resSample, systems: resSystems, sum: resSum, change: resChange, R: RESBAR })');
// 2 年ぶん、0.25 年ごとに帯と欄を描きながら進める (双子は描かずに進める)
const capFood = [];
for (let i = 0; i < 8; i++) {
  g.advance(0.25); twin.advance(0.25);
  ui.sample(g);
  ui.bar(g, null); ui.pop(g, null, 'food');
  capFood.push([g.year, g.known(g.cap).stock.food]);
}
const bar = ui.bar(g, null), pop = ui.pop(g, null, 'food');
const chips = (bar.match(/data-res="/g) || []).length;
const capName = g.system(g.cap).name;
if (chips < 7) fails.push(`帯の資源が ${chips} 個`);
if (!bar.includes(`<b>${capName}</b>`)) fails.push('選んでいないのに上の段が首都でない');
// 別の星系を選ぶ
const own = ui.systems(g);
const other = own.find((x) => x.id !== g.cap);
if (other && !ui.bar(g, other.id).includes(`<b>${other.name}</b>`)) fails.push(`自分の国の別の星系 (${other.name}) を選んでも上の段が変わらない`);
// 国全体 = 記録の合計
const T = ui.sum(own);
let want = 0;
for (const s of g.knownOwnSystems()) want += g.known(s.id)?.stock?.food || 0;
if (Math.abs(T.stock.food - want) > 1e-6 * Math.max(1, want)) fails.push(`国全体の食料 ${T.stock.food} が記録の合計 ${want} と違う`);
const delayed = own.filter((x) => x.id !== g.cap && x.k.year < g.year - 1e-9).length;
// 変化 = 1 年前との差 (年あたり)
const [y0, f0] = capFood[3], [y1, f1] = capFood[7];
const ch = ui.change(g, f1, (h) => h.sys.get(g.cap)?.food);
const wantD = (f1 - f0) / (y1 - y0);
if (!ch) fails.push('2 年ぶん見たのに変化が出ない');
else if (Math.abs(ch.d - wantD) > 1e-9 * Math.max(1, Math.abs(wantD))) fails.push(`首都の食料の変化 ${ch.d} が 1 年前との差 ${wantD} と違う`);
if (!/<i class="(up|dn|z)">/.test(bar)) fails.push('帯に変化の割合が出ない');
for (const w of ['供給 (生産)', '需要', '国全体', '交易などの出入り']) if (!pop.includes(w)) fails.push(`欄に「${w}」がない`);
// 描いても状態は同じ
const ha = sim.hash(g), hb = sim.hash(twin);
if (ha !== hb) fails.push(`帯を描いた試合の状態の要約 ${ha} が、描かない試合 ${hb} と違う`);
console.log(`首都 ${capName}・自分の国の星系 ${own.length} (うち記録が古い ${delayed})・帯の資源 ${chips}・首都の食料 ${f1.toFixed(1)} (年 ${wantD >= 0 ? '+' : ''}${wantD.toFixed(1)})・状態の要約 ${ha} / ${hb}`);
console.log(fails.length ? `資源の帯 不合格 (${fails.join(' / ')})` : '資源の帯 合格');
process.exit(fails.length ? 1 : 0);
