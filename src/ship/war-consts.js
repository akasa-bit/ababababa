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
// white: 戦勝点の差がこれより小さければ白紙講和 (回 FU2 の R14 の直し e で 5 → 20。はっきり勝ったときだけ講和会議を開く)
const TREATY = { vassal: 70, cash: 1000, cashPts: 5, cashMax: 10, white: 20, years: 3 };
// 戦争の終わり方 (回 FU2 の R14 の直し e。ユーザーの決定。docs/requests/2026-10-22-FU.md の FU-3):
// lapse = 戦果 (沈めた艦隊・攻め落とした星系) がこの年数動かない戦争は、講和会議を開かずに立ち消えで終わる (活動低下)。
// decisiveP = 勝つ見込み (艦隊の比と戦果から。読み違いの前) がこれ以上の国は、講和を受けず全面降伏 (持ち点 100) を求める。
//   交渉は両方の首都が開戦を知った直後に始まり、戦果の知らせはまだ届いていないことが多いので、戦勝点ではなく見込みで決める
// yieldAt = 降伏を求められた国は、自分の受け入れる線がこれ以下 (勝てる見込みがない) なら降伏する。そうでなければ戦い続ける
// decisiveP と yieldAt は、R14 (終わり方) を見て選んだ (0.95 で勝利 57%、0.97・−60 で白紙がいちばん多い、0.98・−40 で R14 に合う。docs/negotiation.md の 4.3)
const WAREND = { lapse: 10, decisiveP: 0.98, yieldAt: -40 };
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
// 値は、国家間戦争の多さ (COW から計算した、国 100 年あたり 2.34 回。目標にする) に合わせて選んだ (docs/negotiation.md の 3)。R14 (確認用) には合わせていない。
// declareChance は回 FU2 で 0.08 → 0.05 (光の遅れ・艦隊戦・光速の一撃のあと、32 の銀河 × 300 年で R29 が 3.07 → 2.45)
const BARGAIN = { on: true, sigma0: 0.8, sigmaAge: 0.01, learn: 30, swing: 60, cost: 0.2, costEx: 0.02, horizon: 5, shift: 1, shiftYears: 10, capitulate: 90, declare: 20, declareChance: 0.05, warDist: 25 };
const PEACE = { minYears: 3, sueEx: 60, sueWs: -50, stalemate: 0.35, stalemateHalf: 4, offerEvery: 5, offerYears: 10, base: 0.15, loseWs: 80, exLose: 120, winBase: 0.05, exWin: 100, winWs: 400, min: 0.03, max: 0.95 };
// 艦隊戦 (B-034。HOI4 の海戦を元にした形。docs/proposals/13-battle.md・docs/requests/2026-10-22-FU.md の FU-2)。
// 1 艦隊 = 耐久 (hp) と組織力 (org) を持つ 1 つの単位。1 年を rounds 回の撃ち合いに分け、戦っている艦は毎回 1 発撃つ:
// 当たる確率 = hit × 位置取り × 戦機 × 兵站と国の補正 × (0.5 + 0.5 × 自分の組織力) (最大 0.95)。当たった艦は耐久を dmg、組織力を org (÷ 士気) ずつ (それぞれ 0.5〜1.5 倍の幅で) 失う。
// 耐久が 0 で沈む。組織力が orgRet を切った艦は退き始め、retRounds 回のあいだ撃たれながら離れる (撃ち返さない)。
// 位置取り = 1 ÷ (1 + pos × max(0, 自分の戦っている艦 ÷ 相手の − 1)): 大きすぎる艦隊はまとまって動けない (HOI4 の positioning)。数の効きを二乗則より弱める。
// 戦機 = exp(luck × 正規乱数)・士気 = exp(morale × 正規乱数): 戦いごとに両軍に引く (索敵・先に撃つ側・指揮)。勝ち負けの偶然。
// どちらかの戦っている艦がいなくなれば終わり。沈んだ艦の乗員 (crew 人) を戦死者に数える (仮の値。B-033 の船の設計で差し替える)。
// 攻囲の住民は年 siegeDead ずつ亡くなる (補給を断たれた星系の飢えと病)。
// pos と luck は補正 (台帳の C27・C28)。版の値 ED.battle で上書きする
const BATTLE = { rounds: 24, hit: 0.2, dmg: 0.45, org: 0.55, orgRet: 0.5, retRounds: 2, pos: 0.3, luck: 1, morale: 1.15, crew: 1e5, siegeDead: 0.01, reports: 20, ...(ED.battle || {}) };
// 光速に近い艦隊の一撃 (B-035。QD-04 = b): 減速せずに星系へ突っ込む艦隊。0.9c の 1 艦隊の運動エネルギー (FLEET_KE) は惑星の表面を焼くので、
// 1 艦隊で 1 つの天体の入植地を焼く (人口の survive だけが地下に残り、施設・備蓄・歩兵はなくなる)。艦隊は使い切る。光の遅れで、守る側には着く直前まで見えず、止められない。
// 釣り合い: 使った国の悪名 (atrocity) が増え、知らせが光速で届いた国は、使った国へ宣戦する (撃たれた国は retaliateHit、reach 光年以内の国は retaliate の確率)。
// 使った国の家臣は、知らせが届くと忠誠度が loyalty 下がる。人間の国の悪名 (先住民の友好度) は infamy 増える。
// AI の国は、戦争で大きく負けていて (首都に届いた戦勝点が desperate 以下)、首都に 2 艦隊以上いれば、年 aiChance の確率で、相手の首都 (首都に届いた記録で、まだ相手の国のもの) へ 1 艦隊を撃つ。
// 人間の国の星系は、ほかの攻め方と同じく狙わない。ここまで負ける前に講和することが多いので、AI の一撃はまれ (6 か国の 12 の銀河 × 300 年で 31 回。1 つの銀河の 300 年で 2〜3 回)
const STRIKE = { survive: 0.001, retaliate: 0.6, retaliateHit: 1, reach: 40, loyalty: 20, infamy: 50, desperate: -20, aiChance: 0.5, keep: 200 };
// 戦死者の数の書き方 (人)
function fmtDead(n) { return n >= 1e8 ? `${(n / 1e8).toFixed(1)} 億人` : n >= 1e4 ? `${Math.round(n / 1e4)} 万人` : `${Math.round(n)} 人`; } // 出来事の文にも入るので、端末ごとに違う toLocaleString は使わない
// 艦隊戦の報告の 1 行 (battleReports の 1 つから)
function battleText(r) {
  return `${(r.end - r.start).toFixed(1)} 年、攻撃 ${r.a0} 艦隊 (沈没 ${r.sunk[0]}・退却 ${r.esc[0]}) 対 防衛 ${r.d0} 艦隊 (沈没 ${r.sunk[1]}・退却 ${r.esc[1]})、戦死 ${fmtDead(r.dead)}${r.odds !== null && r.odds !== undefined ? `。始まる前の攻撃側の見込み ${Math.round(r.odds * 100)}%` : ''}`;
}
// 光速で届く途中の講和の申し入れ・講和会議の知らせ (B-030。届いたら peaceOffers・conferences へ移す)。なければ書かない
saveField('peaceSent', (game) => (game.peaceSent.length ? game.peaceSent : undefined), {
  init: (game) => { game.peaceSent = []; },
  read: (game, d) => { game.peaceSent = Array.isArray(d.peaceSent) ? d.peaceSent.filter((o) => o && typeof o.key === 'string' && Number.isFinite(o.at)) : []; },
});
saveField('confSent', (game) => (game.confSent.length ? game.confSent : undefined), {
  init: (game) => { game.confSent = []; },
  read: (game, d) => { game.confSent = Array.isArray(d.confSent) ? d.confSent.filter((c) => c && Array.isArray(c.bids) && Number.isFinite(c.at)) : []; },
});
// 艦隊戦の報告 (新しい順に BATTLE.reports 件)。勝つ見込みと損害の内訳 (B-034 の 13-5)
saveField('battleReports', (game) => (game.battleReports.length ? game.battleReports : undefined), {
  init: (game) => { game.battleReports = []; },
  read: (game, d) => { game.battleReports = Array.isArray(d.battleReports) ? d.battleReports.filter((r) => r && Number.isFinite(r.sys)).slice(0, BATTLE.reports) : []; },
});
// 光速の一撃の記録 (B-035): { id, year, sys (撃たれた星系), by (撃った国), hit (撃たれた国), dead, told: [知らせが届いて応じた国・星系] }。STRIKE.keep 年で捨てる
saveField('strikes', (game) => (game.strikes.length ? game.strikes : undefined), {
  init: (game) => { game.strikes = []; },
  read: (game, d) => { game.strikes = Array.isArray(d.strikes) ? d.strikes.filter((x) => x && Number.isFinite(x.sys) && Number.isFinite(x.year)) : []; },
});
