// AI の国の判断の理由 (回 AI2・B-301。F30「AI の判断の理由の表示」= 100%) の試験。画面なしの版で回す
// 1. AI の国の宣戦 (AI どうし・人間の国へ) は、知らせと記録に理由の内訳 (首都に届いた記録の艦隊・勝つ見込み・見込む戦勝点・戦費) が付く。人間の国にも自分の判断で宣戦できる
// 2. 講和: AI どうしの申し入れに答えたとき・人間の国からの申し入れを受けた/断ったとき・AI が講和を申し入れたときに、受け入れる線の内訳が付く (断られた人間には返事にも出る)
// 3. 協定: 受けた・断った・申し入れたとき、防衛同盟の参戦に応じた・断ったときに、理由 (共通の脅威・便乗・艦隊の見え方・破約・勝つ見込み) が付く。防衛同盟は、共通の脅威 (th) と均衡か便乗か (mode) を覚える
// 4. 星系の欄 (その国の首都の節「この国の判断と理由」) に出る。プレイヤーの首都に光が届くまでは出ない
// 5. 便乗と均衡の分かれ目: いちばん脅威な国に、味方を集めて届けば均衡、届かなければ便乗
// 6. セーブと読み込みで記録が残る
// F30 = 起こした判断のうち、記録と星系の欄に理由が出たものの割合
// 使い方: node tools/tests/aiwhy.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('AI の判断の理由') }];
if (require.main !== module) return;
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const g = sim.newGame('7', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 30);
for (const k of Object.keys(g.realmWars)) delete g.realmWars[k];
g.diplo = { pacts: [], sent: [], breach: {} };
const ai = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.realmAlive(c)).sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b));
check(ai.length >= 4, `AI の国が足りない (${ai.length})`);
const [a, b, c, d] = ai;
const last = (r) => (g.aiLog[r] || [])[(g.aiLog[r] || []).length - 1]?.t || '';
let made = 0, shown = 0;
const panel = (r) => { const sp = g.spectate; g.spectate = true; try { return String(sim.evaluate('aiLogSec')(g, r)); } finally { g.spectate = sp; } };
const judged = (r, re, what) => { made++; const t = last(r), html = panel(r); const ok = re.test(t) && html.includes(t.slice(0, 12)); if (ok) shown++; else fails.push(`${what}の理由が出ない (${t || 'なし'})`); };

// 1. 宣戦
const ev0 = g.events.length;
g.aiDeclare(a, b, 0);
check(g.atWar(a, b), 'AI どうしの宣戦が始まらない');
const ev = g.events.slice(0, g.events.length - ev0 + 1).find((e) => /に宣戦した \(首都に届いた記録で/.test(e.text));
check(ev && /艦隊 自分 \d+・相手 \d+.*勝つ見込み \d+%・見込む戦勝点 -?\d+・戦費 −\d+/.test(ev.text), `宣戦の知らせに理由の内訳がない (${ev?.text})`);
judged(a, /に宣戦した \(首都に届いた記録で: 艦隊 自分/, '宣戦');
g.aiDeclare(c, g.cap, 0);
check(g.atWar(c, g.cap), 'AI の国が人間の国に宣戦できない');
judged(c, /に宣戦した \(首都に届いた記録で/, '人間の国への宣戦');

// 2. 講和
g.bargain(a, b, b, g.reservation(a, b));
judged(b, /からの講和の申し入れを(受けた|断った) \(戦勝点 -?\d+・受け入れる線/, 'AI どうしの講和の返事');
g.pc = 100;
const rp = g.offerPeace(c);
judged(c, /からの講和の申し入れを(受けた|断った) \(戦勝点/, '人間の国からの講和への返事');
check(rp.ok || /相手の見立て: 戦勝点/.test(rp.reason || ''), `講和を断られた返事に理由がない (${JSON.stringify(rp)})`);

// 3. 協定
g.pactAnswerAi({ from: c, to: d, kind: 'trade', gift: 0 });
judged(d, /からの交易の協定を(受けた|断った) \(/, '協定の返事');
g.diplo.breach[a] = [g.year, g.year, g.year, g.year, g.year, g.year];
g.pactAnswerAi({ from: a, to: d, kind: 'nap', gift: 0 });
judged(d, /からの不可侵の協定を断った \(.*破約 6 回/, '協定を断った返事');
g.pactAnswerAi({ from: c, to: d, kind: 'ally', gift: 100000 });
const al = g.pactBetween(c, d, 'ally');
judged(d, /からの防衛同盟の協定を受けた \((共通の脅威|便乗|共通の脅威が見えない)/, '防衛同盟の返事');
check(al && (al.th === undefined || g.realmAlive(al.th)) && (al.mode === undefined || ['balance', 'bandwagon'].includes(al.mode)), `防衛同盟に共通の脅威と均衡か便乗かが残らない (${JSON.stringify(al)})`);
// 同盟の参戦: 勝つ見込みで応じるか決め、理由を記録する (席の国も席のない国も aiHonor)
const reply = g.asRealm(b, () => g.pactAiReply({ type: 'call', ally: d, enemy: a }));
check(['join', 'refuse'].includes(reply), `同盟の参戦の返事の形が違う (${reply})`);
judged(b, /(同盟国の.*を守るため.*に宣戦した|との防衛同盟の参戦を断った) \(首都に届いた記録で: 艦隊 自分と/, '同盟の参戦の返事');
const propose0 = sim.evaluate('PACT.aiPropose');
sim.evaluate('PACT.aiPropose = 1');
const before = Object.fromEntries(Object.entries(g.aiLog).map(([k, v]) => [k, v.length]));
g.diplomacyYearly();
sim.evaluate(`PACT.aiPropose = ${propose0}`);
const proposer = Object.keys(g.aiLog).find((k) => (g.aiLog[k].length > (before[k] || 0)) && /の協定を申し入れた \(/.test(last(Number(k))));
if (proposer !== undefined) judged(Number(proposer), /の協定を申し入れた \(/, '協定の申し入れ');

// 4. 光の遅れ
const far = ai.filter((r) => g.sysDist(g.cap, r) > 2).pop();
if (far !== undefined) {
  g.aiNote(far, 'ためし');
  const html0 = String(sim.evaluate('aiLogSec')(g, far));
  const y0 = g.year;
  g.year = y0 + g.sysDist(g.cap, far) + 0.01;
  const html1 = String(sim.evaluate('aiLogSec')(g, far));
  g.year = y0;
  check(!html0.includes('ためし') && html1.includes('ためし'), '星系の欄の判断が、光の遅れを待たずに出る (か、届いても出ない)');
}

// 5. 均衡と便乗の分かれ目 (見え方を与えて決める)
const view = (m) => (t) => m[t] ?? 0;
const alone = g.alignOf(a, view({ [a]: 1, [b]: 50, [c]: 0, [d]: 0 }));
const near = (x, y) => g.sysDist(x, y) <= sim.evaluate('BARGAIN.warDist');
if (near(a, b)) check(alone.t === b && alone.mode === 'bandwagon', `味方のいない弱い国が便乗しない (${JSON.stringify(alone)})`);
const mates = ai.filter((u) => u !== a && u !== b && near(a, u) && near(u, b));
if (near(a, b) && mates.length) {
  const m = { [a]: 10, [b]: 20 };
  for (const u of mates) m[u] = 15;
  const bal = g.alignOf(a, view(m));
  check(bal.t === b && bal.mode === 'balance' && bal.coal >= 20, `味方を集めて届くのに均衡しない (${JSON.stringify(bal)})`);
}

// 6. セーブ
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && JSON.stringify(g2.aiLog) === JSON.stringify(g.aiLog), 'AI の判断の記録がセーブから戻らない');

const f30 = made ? shown / made : 0;
check(f30 === 1, `F30 が 100% でない (${shown} / ${made})`);
console.log(fails.length ? `AI の判断の理由 不合格\n${fails.join('\n')}` : `AI の判断の理由 合格 (F30 理由の表示 ${shown} / ${made} = ${Math.round(100 * f30)}%)`);
process.exit(fails.length ? 1 : 0);
