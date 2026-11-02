// 従属国の不満の行き着く先を型ごとに分ける (回 SE12・B-070。docs/vassal-game.md の 10): 最後通牒の期限で独立を宣言する見込み (declareChance) に、
// 型の事例の決着 (独立か併合) のうち独立だった割合の、事例全体との比 (REGIMES の indepK。data/build/build_vassal_game.py) を掛ける。画面なしの版で回す:
//   1. どの型にも indepK があり、事例の併合の多い型ほど小さい (幕藩制の藩 < 藩王国 < 自治領 < 植民地)
//   2. 同じ恐怖度・友好度・忠誠度の家臣で、見込みの比が indepK の比と同じ。1 を超えない
//   3. 地球の知る記録 (known) でも同じ見込みになる (星系の欄の「見通し」と同じ)
// 使い方: node tools/tests/vassalend.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ judge: (o) => (o.includes('不満の行き着く先 合格') ? '' : '不満の行き着く先 (型ごとの独立の見込み) が違う') }];
if (require.main !== module) return;
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'headless'));
const sim = H.load({});
const R = sim.evaluate('REGIMES');
const fails = [];
const k = (r) => R[r]?.indepK;
for (const r of Object.keys(R)) if (!(k(r) > 0)) fails.push(`型 ${r} に indepK がない`);
if (!(k('T14') < k('T04') && k('T04') < k('T05') && k('T05') < k('direct'))) fails.push(`indepK の順が史実と違う (T14 ${k('T14')}・T04 ${k('T04')}・T05 ${k('T05')}・直轄 ${k('direct')})`);
const g = sim.newGame('3', { nations: 6 });
const base = { fear: 10, friend: 20, loyalty: 30 };
const p = (regime, extra = {}) => g.declareChance({ ...base, ...(regime === 'direct' ? { direct: true } : regime === 'T04' ? {} : { regime }), ...extra });
const p04 = p('T04'), p14 = p('T14'), p05 = p('T05');
if (Math.abs(p14 / p04 - k('T14') / k('T04')) > 1e-9) fails.push(`幕藩制の藩と藩王国の見込みの比 ${(p14 / p04).toFixed(3)} が indepK の比 ${(k('T14') / k('T04')).toFixed(3)} と違う`);
if (Math.abs(p05 / p04 - k('T05') / k('T04')) > 1e-9) fails.push('自治領と藩王国の見込みの比が indepK の比と違う');
if (!(p('direct', { fear: 0, friend: 0, loyalty: 0 }) <= 1)) fails.push('見込みが 1 を超えた');
// known の形 (k.direct・k.regime) でも同じ
const known = { ...base, regime: 'T14' };
if (Math.abs(g.declareChance(known) - p14) > 1e-12) fails.push('地球の知る記録での見込みが違う');
console.log(JSON.stringify({ indepK: { T14: k('T14'), T04: k('T04'), T05: k('T05'), direct: k('direct') }, p: { T04: +p04.toFixed(4), T14: +p14.toFixed(4), T05: +p05.toFixed(4) } }));
console.log(fails.length ? `不満の行き着く先 不合格: ${fails.join('・')}` : '不満の行き着く先 合格');
process.exit(fails.length ? 1 : 0);
