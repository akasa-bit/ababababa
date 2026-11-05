// --- 国どうしの威圧 (回 AI7・B-305・W6-Q3 = a。docs/ai-behavior.md の 14) ---
// 宣戦の見込み (受け入れる線の点 + 請求権 + 記憶のずれ) が BARGAIN.declare を越えた国は、年 chance の確率で、宣戦の前に艦隊を見せて求める
// (Schelling 1966『Arms and Influence』の強要 compellence。交渉の模型で、戦わずに取れるなら戦費のぶん得をする。Fearon 1995)。
//   line = 威圧の線。宣戦の見込みが line を越え declare に届かない国は、威圧だけをする (断られたら、引き下がる面目 audience のぶん宣戦に寄る)。declare 以上には置かない
//   求めるもの = 受け入れる線の点 ask × v (100 まで) の分の条件。値段は講和会議と同じ表 (ship/war-peace.js の treatyTerms。星系の明け渡しと従属) に、
//     交易協定 (協定。関税 0。砲艦で港を開かせた 1853〜54 年のペリーの来航と日米和親条約のような形) tradePts 点と、資金 (賠償金と同じ 1 口 TREATY.cash cr) を足したもの。
//     選ぶ順は、従属 (点が足りて近ければ。それだけ) → 自分の首都に近い星系 → 交易協定 → 資金。いちばん安い条件にも点が足りなければ、威圧せずに宣戦する
//   要求は光速で相手の首都に届き、相手は自分の首都に届いた記録で決める。AI の国 (と観戦の人間の代わり) は、戦えば見込む点 (受け入れる線の点 + 記憶のずれ) が
//     −(求められた点 + face) 以下なら飲む。face = 譲る面目 (譲ると次の要求を招く。強い国の威圧ほど断られやすい Sechser 2010『Goliath's Curse』)。
//     人間の国には「決めること」として届く (replyYears 年のうちに返事がなければ断る)
//   返事も光速で戻る。断られた国は、返事が届いた年に (送ったときの読み違いのまま、首都に届いた新しい記録で) 考え直し、宣戦の見込み + audience が declare を越えれば宣戦する (脅しを実行する)。
//     越えなければ引き下がる。audience = 引き下がると失う面目 (観衆の費用。Fearon 1994)。ほかの国と交戦中なら、holdYears 年まで待ってから考え直す。
//     威圧の返事を待つ国は、その相手と不可侵も同盟も結ばない (politics/diplomacy.js の pactScore)
//   威圧された国は、威圧した国を mem の重さで恨む (帳簿の coerce。politics/memory.js)
// 人間の国からも威圧できる (回 AI8・B-308。命令 coerce。政治力は講和の申し入れと同じ PC_DIPLOMACY)。相手の AI の国は同じ線で答え、断られたら人が宣戦するか引き下がるかを決める。
//   引き下がると議会の支持 −backCouncil (破約と同じ 10。PACT.breachCouncil)
// 較正の的 (目標は足さない。W6-Q3 の回の文の「目標を足すなら、作る前に目標の変更の PR で」): 威圧が飲まれる割合を、
//   1918〜2001 年の強要の脅し 210 件 (Sechser・Fuhrmann 2017『Nuclear Weapons and Coercive Diplomacy』) のおよそ 3 割に合わせる (face 30 で 29.5%)。
//   chance は R29 (国家間戦争の多さ。COW に較正ずみ) を保つように決めた: 飲まれた威圧のぶん戦争が減るので、宣戦の判断のすべてで先に威圧すると (1) R29 が 2.37 → 1.75 に下がる。
//   0.5 で 2.22 (main と組にした差 −0.14 ± 0.11)。line は宣戦の線と同じ (下げても戦争の数はあまり変わらなかった)。値と測りは docs/ai-behavior.md の 14
const COERCE = { on: true, line: 20, chance: 0.5, ask: 1, face: 30, audience: 10, holdYears: 10, mem: 0.5, replyYears: 5, tradePts: 10, backCouncil: 10 };
// 届く途中と返事待ちの威圧: [{ id, st, from (威圧した国), to (相手), year (送った年), at (届く年), terms: [{ k, c }], pts, ships, z (送ったときの読み違い), ok? (返事), dec? (人間の決めることの番号), hold? (交戦中で考え直しを待つ期限) }]
//   st = go (相手の首都へ届く途中)・ask (人間の国の返事待ち)・back (返事が威圧した国の首都へ届く途中)・wait (人間の国が、断られたあと宣戦するか引き下がるかを決めるのを待つ。回 AI8)。k = v (従属)・s<星系> (明け渡し)・t (交易協定)・c<口> (資金)。c = 点
// 協定を破って宣戦する重さ (回 AI9・B-309。docs/ai-behavior.md の 16): 不可侵の協定に縛られた国も、宣戦の見込みから nap 点を引いて考える (破約。評判を失い、
// ほかの国が協定を受けにくくなる: politics/diplomacy.js の pactBreach・pactScore)。同盟の相手には宣戦しない。nap = null で前の形 (不可侵の相手にも宣戦しない)。
// 現実の破約の形 (Leeds 2003: 防衛同盟の義務の 3 割ほどは果たされない。不可侵の協定を破って攻めた例は 1941 年のバルバロッサ作戦など)
const PACT_BREAK = { nap: 25 };
saveField('coerce', (game) => (game.coerce.length ? game.coerce : undefined), {
  init: (game) => { game.coerce = []; },
  read: (game, d) => { game.coerce = Array.isArray(d.coerce) ? d.coerce.filter((o) => o && ['go', 'ask', 'back', 'wait'].includes(o.st) && Number.isFinite(o.from) && Number.isFinite(o.to) && Number.isFinite(o.at) && Array.isArray(o.terms)) : []; },
});
