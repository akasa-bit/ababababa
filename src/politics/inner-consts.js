// --- 中の事情 (回 AI4・B-303。docs/ai-behavior.md の 11) ---
// AI の国の外への判断 (宣戦・講和・協定・同盟の参戦) を、国の中の勢力の綱引きで動かす。外交は国内の政治との 2 つの交渉
// (Putnam 1988 の 2 レベルゲーム: 国内で批准されない合意・戦争は選べない)。式は交渉の模型の「受け入れる線」(ship/war-ai.js の reservation) に、
// 中の事情の重さ (戦勝点) を引く 1 項として入る。宣戦・講和・同盟の参戦が同じ線で動く。人間の国 (観戦でないとき) には効かない (人が決める)
//   council = 議会の支持 c (0〜100。席の国だけ) のずれ: + council × (councilRef − c) ÷ councilRef。支持が低いほど戦争を選びにくく、講和を受けやすい
//   groups = 権力に加わっている集団の、軍備の国家方針への支持 S (politics/support.js の billSupport。声の重さつき) のずれ: + groups × (groupsRef − S) × 2
//   trade = 相手の国との交易路の輸送量が、自分の国の交易路の輸送量に占める割合 t: + trade × min(1, t ÷ tradeRef)
//     (交易の深い相手とは戦いにくい。Oneal・Russett 1997 の交易による平和。利益集団 (商人) の利害)
//   戦争疲弊は前から線に入っている (BARGAIN.costEx)。理由の文に出すだけ
//   pactCouncil・pactTrade = 協定の受けやすさ s のずれ: − pactCouncil × (councilRef − c) ÷ councilRef (批准のしにくさ)・交易の協定は + pactTrade × min(1, t ÷ tradeRef)
// 遠い総督の思惑 (Galbraith 1960『The "Turbulent Frontier" as a Factor in British Expansion』: 辺境の役人が本国の指令より先に版図を広げる):
//   首都から farLy 光年以上の星系 (AI の国。首都でない) は、年 govChance の確率で、govRange 光年以内に見える外の国と、自分の目で
//   (近くの相手は光の遅れが小さい。艦隊はいまの数) 戦争の見込みを測り、交渉の模型と同じ式で govBold を足して declare を超えれば、国の名で宣戦する
//   首都は、その知らせが光で届いた年に、首都の記録で見込みを測り直し、endorse 以上なら追認、下回れば否認する
//   (否認すると、その戦争の受け入れる線から disavow を引いて講和に向かい、独断した星系の忠誠度を disavowLoyalty 下げる)
// 揺さぶり (外の国が、相手の国の中の勢力を支える・揺さぶる手。人間の国も AI の国も):
//   資金 cost cr と政治力 pc で、相手の国の星系へ光速で資金を送る。届いた年に、相手の首都なら議会の支持を ± council、
//   相手の家臣の星系なら主人への忠誠度を ± loyalty 動かす (back = 政府・主人の側を支える / undermine = 反対派・分離派を支える)。
//   揺さぶりは exposed の確率で相手に知られ、内政への干渉として記憶に残る (politics/memory.js の帳簿。恨み)。支えは相手の政府が受け取るので、恩として残る
//   (向きは Levin 2016「When the Great Power Gets a Vote」: 選挙への介入は支えた側を押し上げる・Salehyan・Gleditsch・Cunningham 2011: 敵対する国は相手の反乱勢力を支える)
//   AI の国は年 aiChance の確率で、政治力が aiPc 以上・資金が cost 以上あれば、いちばんの脅威 (politics/threat.js の alignOf) を揺さぶるか、同盟国の政府を支える
//   (AI の国の席の政治力はたいてい上限の近く。首都の資金は人間の国も AI の国も中央値で 150〜270 cr ほどなので、cost はその半分ほど)
// 値はどれも仮の値 (向きは上の原典。R29 を保つように測って決めた。docs/ai-behavior.md の 11.1)
const INNER = {
  council: 15, councilRef: 50, groups: 10, groupsRef: 0.5, trade: 15, tradeRef: 0.25, pactCouncil: 0.3, pactTrade: 0.3,
  farLy: 12, govRange: 10, govChance: 0.01, govBold: 10, endorse: 0, disavow: 60, disavowLoyalty: 10,
  meddle: { cost: 150, pc: 15, council: 3, loyalty: 6, exposed: 0.3, aiChance: 0.05, aiPc: 35 },
};
// inner = { gov: { 戦争の鍵: { s: 独断した星系, y: 年, ok: null (首都に届く前)・1 (追認)・0 (否認) } }, sent: [揺さぶりの届く途中 { id, from, to, mode, amt, sent, at }] }
saveField('inner', (game) => (Object.keys(game.inner.gov).length || game.inner.sent.length ? game.inner : undefined), {
  init: (game) => { game.inner = { gov: {}, sent: [] }; },
  read: (game, d) => {
    const o = d.inner && typeof d.inner === 'object' ? d.inner : {};
    game.inner = {
      gov: Object.fromEntries(Object.entries(o.gov && typeof o.gov === 'object' ? o.gov : {}).filter(([, v]) => v && Number.isFinite(v.s) && Number.isFinite(v.y))),
      sent: Array.isArray(o.sent) ? o.sent.filter((x) => x && Number.isFinite(x.to) && Number.isFinite(x.at)) : [],
    };
  },
});
