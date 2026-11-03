// --- 中の事情 (回 AI4・B-303。docs/ai-behavior.md の 11) ---
// AI の国の外への判断 (宣戦・講和・協定・同盟の参戦) を、国の中の勢力の綱引きで動かす。外交は国内の政治との 2 つの交渉
// (Putnam 1988 の 2 レベルゲーム: 国内で批准されない合意・戦争は選べない)。式は交渉の模型の「受け入れる線」(ship/war-ai.js の reservation) に、
// 中の事情の重さ (戦勝点) を引く 1 項として入る。宣戦・講和・同盟の参戦が同じ線で動く。人間の国 (観戦でないとき) には効かない (人が決める)
//   council = 議会の支持 c (0〜100。席の国だけ) のずれ: + council × (councilRef − c) ÷ councilRef。支持が低いほど戦争を選びにくく、講和を受けやすい
//   groups = 権力に加わっている集団の、軍備の国家方針への支持 S (politics/support.js の billSupport。声の重さつき) のずれ: + groups × (groupsRef − S) × 2
//   外の国への派閥 (lob。下の説明) の重み: + lob.war × (親 e 派の重み − 反 e 派の重み)
//   戦争疲弊は前から線に入っている (BARGAIN.costEx)。理由の文に出すだけ
//   pactCouncil = 協定の受けやすさ s のずれ: − pactCouncil × (councilRef − c) ÷ councilRef (批准のしにくさ)。派閥は + lob.pact × (親 p 派 − 反 p 派)
//   council・groups の境は過半数 (50・0.5)。国の平均に合わせない (支持の高い政府は戦争を選びやすく、低い政府は選びにくい)
// 外の国への派閥 (ユーザーの依頼 AI-1「内政を作る際には、Victoria 3 を参考にして」。Victoria 3 の政治の派閥 (lobby) の形にならう。名前と数は写さない):
//   国の、権力に加わっている集団 (politics/groups.js の民族 × 所得の 5 分位) のうち、ある外の国に向けて同じ立場をとるものが派閥 (親 X 派・反 X 派) になる。
//   派閥は、きっかけ (why) があると年 chance の確率でできる (外交のきっかけ。Victoria 3 の diplomatic catalyst の形):
//     trade = X との交易路の輸送量が国の trade 以上 (親。上の 2 分位の集団: 輸出と商いの担い手。Mayda・Rodrik 2005 で所得と技能の高い人ほど自由な交易を支持)、
//     thank = X への恩 (救援・贈り物。politics/memory.js の帳簿) が mem 以上 (親。自己表現の価値観が国の平均以上の集団)、
//     grudge = X への恨み (侵略・裏切り・独立の支援・内政への干渉) が mem 以上 (反。伝統の価値観が国の平均以上の集団。Inglehart・Welzel 2005: 伝統の価値観は国への誇りと強く結びつく)、
//     fund = X が資金を出した (親。いちばん上の分位の集団。資金はその家計へ。下の meddle の lobby)
//   重み = 派閥の集団の声の重さ ÷ 国の声の重さ (politics/support.js の billSupport と同じ重さ。minClout より軽い派閥はできない)。資金が効いているあいだは × (1 + fundBoost)
//   きっかけが半分より弱まると派閥は消える (資金の派閥は資金が切れると)。消えた派閥は keep 年残す (遠い国には、光が届くまで見えている)
//   満足 ap (−apMax〜apMax): 政府が派閥の望む向きに動けば上がり、逆なら下がる (memory.js の帳簿に残る行い: 侵略・裏切り・独立の支援・干渉は親 X 派に −1、救援は +1、
//     贈り物・協定は +0.5。反 X 派は逆)。年 apDecay を掛けて 0 に戻る。席の国の議会の支持が、年 council × 重み × 満足 だけ動く (派閥の満足が集団の支持になる)
// 遠い総督の思惑 (Galbraith 1960『The "Turbulent Frontier" as a Factor in British Expansion』: 辺境の役人が本国の指令より先に版図を広げる):
//   首都から farLy 光年以上の星系 (AI の国。首都でない) は、年 govChance の確率で、govRange 光年以内に見える外の国と、自分の目で
//   (近くの相手は光の遅れが小さい。艦隊はいまの数) 戦争の見込みを測り、交渉の模型と同じ式で govBold を足して declare を超えれば、国の名で宣戦する
//   首都は、その知らせが光で届いた年に、首都の記録で見込みを測り直し、endorse 以上なら追認、下回れば否認する
//   (否認すると、その戦争の受け入れる線から disavow を引いて講和に向かい、独断した星系の忠誠度を disavowLoyalty 下げる)
// 中の勢力への手 (外の国が、相手の国の中の勢力を支える・揺さぶる手。人間の国も AI の国も):
//   資金 cost cr と政治力 pc で、相手の国の星系へ光速で資金を送り、届いた年に払う。
//   相手の首都へ: lobby = 親 (自分の国) 派に資金を出す (Victoria 3 の派閥への資金の形。派閥がなければ fund の派閥ができ、あれば重みが fundYears 年 × (1 + fundBoost))・
//     undermine = 反対派を支える (議会の支持を − council)。
//   相手の家臣の星系へ: back = 主人の側を支える / undermine = 分離派を支える (主人への忠誠度を ± loyalty)。
//   派閥への資金と揺さぶりは exposed の確率で相手に知られ、内政への干渉として記憶に残る (politics/memory.js の帳簿。恨み)。主人の側への資金は相手の政府が受け取るので、恩として残る
//   (向きは Levin 2016「When the Great Power Gets a Vote」: 選挙への介入は支えた側を押し上げる・Salehyan・Gleditsch・Cunningham 2011: 敵対する国は相手の反乱勢力を支える)
//   AI の国は年 aiChance の確率で、政治力が aiPc 以上・資金が cost 以上あれば、いちばんの脅威 (politics/threat.js の alignOf) を揺さぶるか、協定の相手の国に親 (自分の国) 派を育てる
//   (AI の国の席の政治力はたいてい上限の近く。首都の資金は人間の国も AI の国も中央値で 150〜270 cr ほどなので、cost はその半分ほど)
// 値はどれも仮の値 (向きは上の原典。形は Victoria 3 の派閥。R29 を保つように測って決めた。docs/ai-behavior.md の 11.1)
const INNER = {
  council: 15, councilRef: 50, groups: 10, groupsRef: 0.5, pactCouncil: 0.3,
  farLy: 12, govRange: 10, govChance: 0.01, govBold: 10, endorse: 0, disavow: 60, disavowLoyalty: 10,
  lob: { war: 20, pact: 0.4, trade: 0.1, mem: 0.5, chance: 0.2, minClout: 0.05, council: 1, apDecay: 0.8, apMax: 3, fundBoost: 0.5, fundYears: 10, keep: 60 },
  meddle: { cost: 150, pc: 15, council: 3, loyalty: 6, exposed: 0.3, aiChance: 0.05, aiPc: 35 },
};
// 派閥のきっかけの名前と、帳簿の行いごとの親 X 派の満足の動き (反 X 派は逆。pact は協定を結んだとき)
const LOBBY_WHY = { trade: '交易', thank: '恩', grudge: '恨み', fund: '外からの資金' };
const LOBBY_ACT = { agg: -1, betray: -1, indep: -1, meddle: -1, rescue: 1, gift: 0.5, pact: 0.5 };
// inner = { gov: { 戦争の鍵: { s: 独断した星系, y: 年, ok: null (首都に届く前)・1 (追認)・0 (否認) } }, sent: [資金の届く途中 { id, from, to, mode, amt, sent, at }],
//   lob: [派閥 { r: 国, to: 相手の国, pro: 親か, why, y: できた年, end: 消えた年 (null = いまある), ap: 満足, fund: 資金が効く年まで }] }
saveField('inner', (game) => (Object.keys(game.inner.gov).length || game.inner.sent.length || game.inner.lob.length ? game.inner : undefined), {
  init: (game) => { game.inner = { gov: {}, sent: [], lob: [] }; },
  read: (game, d) => {
    const o = d.inner && typeof d.inner === 'object' ? d.inner : {};
    game.inner = {
      gov: Object.fromEntries(Object.entries(o.gov && typeof o.gov === 'object' ? o.gov : {}).filter(([, v]) => v && Number.isFinite(v.s) && Number.isFinite(v.y))),
      sent: Array.isArray(o.sent) ? o.sent.filter((x) => x && Number.isFinite(x.to) && Number.isFinite(x.at)) : [],
      lob: Array.isArray(o.lob) ? o.lob.filter((l) => l && Number.isFinite(l.r) && Number.isFinite(l.to) && LOBBY_WHY[l.why] && Number.isFinite(l.y))
        .map((l) => ({ r: l.r, to: l.to, pro: !!l.pro, why: l.why, y: l.y, end: Number.isFinite(l.end) ? l.end : null, ap: Number.isFinite(l.ap) ? l.ap : 0, fund: Number.isFinite(l.fund) ? l.fund : 0 })) : [],
    };
  },
});
