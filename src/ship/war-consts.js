const HANDICAP = {
  easy: { label: 'やさしい', aiIncome: 0.8, aiCost: 1.2, info: 'full' },
  normal: { label: 'ふつう', aiIncome: 1, aiCost: 1, info: 'full' },
  hard: { label: 'むずかしい', aiIncome: 1.25, aiCost: 0.9, info: 'fuzzy' },
  brutal: { label: 'とてもむずかしい', aiIncome: 1.5, aiCost: 0.8, info: 'hidden' },
};
const AI_INCOME_KINDS = new Set(['tax', 'trade', 'natives']);
const INFO_LABEL = { full: 'の数は正確に見える', fuzzy: 'の数は5艦隊単位の概数', hidden: 'の数は見えない' };
// 戦争疲弊 (国ごと 0〜100): 失った艦隊・星系と、戦争の年数で増え、平和なあいだに減る。
// 税収が最大 40% 減り、家臣の忠誠度・議会の支持が下がる。疲れた国ほど講和に応じやすい
const EXHAUST = { ship: 1.5, system: 8, warYear: 1, siegeYear: 1, peaceYear: 5, tax: 0.004, loyalty: 0.25, council: 1 / 40 };
// 戦勝点 (−100〜100): 沈めた艦隊の差 (1 艦隊 2 点) と、攻め落とした星系の差 (1 つ 20 点)
const WARSCORE = { ship: 2, system: 20 };
// 講和会議の条件の値段 (勝った側は戦勝点を、100 を上限に条件に使う)
const TREATY = { vassal: 70, cash: 1000, cashPts: 5, cashMax: 10, white: 5, years: 3 };
// AI の講和の判断: 開戦から minYears 年たち、戦争疲弊が sueEx 以上か戦勝点が sueWs 以下なら申し入れる (人間の国へは offerEvery 年に 1 回、offerYears 年有効)。
// 申し入れに応じる確率 (peaceChance): 負けている側は base + |戦勝点|/loseWs + 疲弊/exLose、勝っている側は winBase + 疲弊/exWin − 戦勝点/winWs
// にらみ合い: 戦闘も攻め落としもない戦争は、年 stalemate ÷ (1 + 年数 ÷ stalemateHalf) の確率で講和を求める。
// 始まってすぐは終わりやすく、長引いた戦争ほど泥沼になる (実際の戦争の長さも、多くは短く一部がとても長い)
// 交渉の型 (段 8。Fearon 1995 の情報の非対称と約束の問題。docs/negotiation.md)。on: false で、上の確率表 (PEACE) の前の形に戻る。
// 国 r は、相手 e の艦隊を光が届いている記録 (seenShips) × exp(読み違い × 幅) と見る。読み違いは戦争ごとに国ごとに引く (自分だけが知っている)。
// 幅 = sigma0 + sigmaAge × 相手の首都までの光の遅れ (年)。戦争中は、沈めた・沈められた艦隊の数で見積もりを直す (learn 隻で半々に信じる)。
// 勝つ見込み p = 自分 ÷ (自分 + 見積もった相手)。戦い続けたときの見込みの結果 = 戦勝点 + (2p − 1) × swing (−100〜100)。
// 費用 = (cost + costEx × 戦争疲弊) × horizon。力の移り変わり = shift × max(0, 相手の艦隊の伸び − 自分の伸び (shiftYears 年の年率)) × 100。
// 受け入れる線 L = 見込みの結果 − 費用 + 力の移り変わり。L(r) + L(e) ≤ 0 なら、その真ん中 x = (L(r) − L(e)) ÷ 2 で講和する。
// |x| < TREATY.white で白紙、capitulate 以上で全面降伏、そのあいだは x を持ち点にした講和会議。
// 宣戦: 平時の国は、warDist 光年以内の独立国ごとに、開戦したときの L (戦勝点 0) が declare を超えれば、年 declareChance の確率で宣戦する
// 値は、国家間戦争の多さ (COW から計算した、国 100 年あたり 2.34 回。目標にする) に合わせて選んだ (docs/negotiation.md の 3)。R14 (確認用) には合わせていない
const BARGAIN = { on: true, sigma0: 0.8, sigmaAge: 0.01, learn: 30, swing: 60, cost: 0.2, costEx: 0.02, horizon: 5, shift: 1, shiftYears: 10, capitulate: 90, declare: 20, declareChance: 0.08, warDist: 25 };
const PEACE = { minYears: 3, sueEx: 60, sueWs: -50, stalemate: 0.35, stalemateHalf: 4, offerEvery: 5, offerYears: 10, base: 0.15, loseWs: 80, exLose: 120, winBase: 0.05, exWin: 100, winWs: 400, min: 0.03, max: 0.95 };
// 光速で届く途中の講和の申し入れ・講和会議の知らせ (B-030。届いたら peaceOffers・conferences へ移す)。なければ書かない
saveField('peaceSent', (game) => (game.peaceSent.length ? game.peaceSent : undefined), {
  init: (game) => { game.peaceSent = []; },
  read: (game, d) => { game.peaceSent = Array.isArray(d.peaceSent) ? d.peaceSent.filter((o) => o && typeof o.key === 'string' && Number.isFinite(o.at)) : []; },
});
saveField('confSent', (game) => (game.confSent.length ? game.confSent : undefined), {
  init: (game) => { game.confSent = []; },
  read: (game, d) => { game.confSent = Array.isArray(d.confSent) ? d.confSent.filter((c) => c && Array.isArray(c.bids) && Number.isFinite(c.at)) : []; },
});
