// --- 国と国のあいだの記憶と評判・指導者 (回 AI3・B-302。docs/ai-behavior.md の 10) ---
// 帳簿 mem: { "a|b": [{ k, y, at, w }] } = a が b にしたこと。k = agg (侵略: 自分の判断で宣戦した)・betray (裏切り: b との協定を破った)・
//   rescue (救援: 同盟に従って b を守るため参戦した)・gift (贈り物: 協定に添えた額 ÷ giftUnit)・indep (独立の支援: b から分かれた国と協定を結んだ)
// 観る国 o には、出来事の星系 at から o の首都まで光が届いた年から効く。重さは半減 half 年で薄れる (破約の記憶の 30 年 = PACT.distrustYears と同じ。Gibler 2008)
// 効き (仮の値。向きは Crescenzi 2018『Of Friends and Foes』: 相手が自分にしたことで次の判断が変わる。評判はできにくいという Mercer 1996 も踏まえ、
//   自分にしたことだけを数える。ほかの国への振る舞いは、前からの破約の数 pactBreaches だけ):
//   協定の受けやすさ s に +thank × (救援 + 贈り物) − grudge × (侵略 + 裏切り + 独立の支援)
//   宣戦の見込み (受け入れる線の点) に +revenge × (侵略 + 裏切り + 独立の支援) − mercy × (救援 + 贈り物)
//   keep 年より古いものと、組ごとに max 件を超えた古いものは捨てる
const MEM = { half: 30, thank: 0.3, grudge: 0.3, revenge: 8, mercy: 8, giftUnit: 2000, keep: 150, max: 12 };
// 指導者 (回 AI3。W5-Q7 = b: 名前と経歴まで。台詞は付けない)。人間が動かしていない国ごとに 1 人
//   exit = 年に退く確率 (Archigos 4.1 の在任の年数の中央値 1.979 年 → 1 − 0.5^(1 ÷ 1.979))
//   irregular = 退いたうち不規則 (政変・反乱・暗殺など) の割合 (Archigos 4.1 の 18.5%)。交戦中で戦勝点が負けていれば × war (Goemans 2000: 負けた指導者は不規則に退きやすい。仮の値)
//   careers = 経歴の割合 w と、宣戦の見込みのずれ war (仮の値。向きは Horowitz・Stam・Ellis 2015『Why Leaders Fight』: 戦ったことのない軍人と反乱の指導者がいちばん宣戦しやすく、
//   戦ったことのある軍人は控えめ。割合は同書の LEAD の軍歴のある指導者がおよそ 3 割から)。ずれは割合で重みを付けた平均が 0 (+0.1) になるように置く
//   (国全体の戦争の多さは変えず、国ごとの差だけを作る。R29 を全体で保つ)
const LEADER = {
  exit: 0.2955, irregular: 0.185, war: 2,
  careers: {
    mil: { label: '軍人 (戦ったことがない)', w: 0.15, war: 5 },
    vet: { label: '軍人 (戦ったことがある)', w: 0.15, war: 1 },
    rebel: { label: '反乱の指導者', w: 0.1, war: 5 },
    bureau: { label: '官僚', w: 0.25, war: -1 },
    merchant: { label: '実業家', w: 0.2, war: -3 },
    scholar: { label: '学者', w: 0.15, war: -3 },
  },
};
saveField('mem', (game) => (Object.keys(game.mem).length ? game.mem : undefined), {
  init: (game) => { game.mem = {}; },
  read: (game, d) => {
    const o = d.mem && typeof d.mem === 'object' ? d.mem : {};
    game.mem = Object.fromEntries(Object.entries(o).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.filter((e) => e && typeof e.k === 'string' && Number.isFinite(e.y))]));
  },
});
saveField('leaders', (game) => (Object.keys(game.leaders).length ? game.leaders : undefined), {
  init: (game) => { game.leaders = {}; },
  read: (game, d) => {
    const o = d.leaders && typeof d.leaders === 'object' ? d.leaders : {};
    game.leaders = Object.fromEntries(Object.entries(o).filter(([, v]) => v && typeof v.name === 'string' && LEADER.careers[v.career]));
  },
});
