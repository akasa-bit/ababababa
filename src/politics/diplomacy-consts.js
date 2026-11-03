// --- 遅れて届く外交 (回 SE2・B-026。docs/decisions.md の QD-35〜QD-38) ---
// 協定は 3 種類。どれも申し入れが光速で相手の首都に届き、相手はそこで決める。受けた時点から相手が縛られ、返事が光速で戻った時点からこちらが縛られる
//   nap = 不可侵 (互いに宣戦しない)、ally = 防衛同盟 (相手が宣戦されたら、その知らせが届いた年に参戦する)、trade = 交易 (互いの関税を 0。経済の tariffFor)
const PACT_KINDS = {
  nap: { label: '不可侵', note: '互いに宣戦しない' },
  ally: { label: '防衛同盟', note: '相手が宣戦されたら、知らせが届いた年に参戦する' },
  trade: { label: '交易', note: '互いの関税を 0 にする' },
};
// 値 (社会の式。仮の値、向きは事例から):
//   years = 協定の長さ (日ソ中立条約 5 年・独ソ不可侵条約 10 年・英仏通商条約 10 年 → ゲームの時間の物差しで 30 年)
//   受けるかの点 s (0 以上で受ける。相手の強さは交渉の模型と同じく、首都に届いている記録 × 読み違い):
//     不可侵 = napBase + (見えている相手の艦隊 − 自分の艦隊) ÷ (両方 + 1)。相手が強く見えるほど受ける
//     同盟 = allyBase + 共通の脅威 (近くの国で、自分より強く見えるもの。交戦中なら + atWar) + allyHelp × 相手の艦隊の割合
//     交易 = tradeBase。交戦中は受けない
//   distrust = 破約 1 回ごとに s から引く (distrustYears 年のあいだ。Gibler 2008: 同盟を破った国は次の同盟を結びにくい)
//   giftScale = 贈り物 giftScale cr で s が 1 上がる
//   breachCouncil = 人間の国が破約したときの議会の支持の減り
//   aiPropose = AI の国が年に申し入れる確率 (見込みがいちばん良い相手と種類に)
//   honorLine = AI の国が防衛同盟の参戦に応じる、見込む戦勝点の下限 (politics/threat.js の aiHonor。下回れば断って破約。回 AI2)
// 較正 (回 AI2。tools/ai-headless.js の 8 銀河 × 300 年): aiPropose 0.04 → 0.3・napBase 0.2 → 0.4 で、国が新しく結ぶ協定の数 (R90。ATOP 5.1 の国の 25〜75% 点 6.13〜15.79) が
//   1.05 → 7.67。allyBase −0.3 → −0.05 で、共通の脅威に向けた防衛同盟 (R91。帯 15.7〜73.9%) が 84.4 → 74.1%。allyBase が 0 では 8.9% に落ちる
//   (艦隊の見えない相手との同盟は、脅威があるときしか結ばれないので、−0.1〜−0.05 で 74〜76% にとどまる)
const PACT = { years: 30, napBase: 0.4, allyBase: -0.05, allyHelp: 0.5, atWar: 0.5, tradeBase: 0.5, distrust: 0.5, distrustYears: 30, giftScale: 2000, breachCouncil: 10, aiPropose: 0.3, replyYears: 10, honorLine: -30 };
saveField('diplo', (game) => game.diplo, {
  init: (game) => { game.diplo = { pacts: [], sent: [], breach: {} }; },
  read: (game, d) => {
    const o = d.diplo && typeof d.diplo === 'object' ? d.diplo : {};
    game.diplo = { pacts: Array.isArray(o.pacts) ? o.pacts : [], sent: Array.isArray(o.sent) ? o.sent : [], breach: o.breach && typeof o.breach === 'object' ? o.breach : {} };
  },
});
