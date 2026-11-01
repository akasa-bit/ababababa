// --- 国と種族 (国家選択) ---
// 種族の特性 (回 SE8・B-029。QD-110 = a: 倍率から規則の違いへ)。特性ごとに、得る規則 good と失う規則 bad を 1 つずつ持つ (desc = 画面の説明。good と bad をつないだもの) (人口の上限のように規則にしにくいものだけ倍率を残す)。
// 種族は架空なので、規則と値はゲームの読みやすさで決めた (補正の台帳の C08 と同じ扱い)。釣り合いは国ごとの勝率で測って直す (QD-112 = a。docs/nations.md)。
// 規則の値 (traitMods がまとめる): colonizePop = 入植船を出せる星系の人口の倍率・starve = 飢えで人口が減る速さの倍率・councilDrift = 議会のいら立ちの倍率・
//   policyYears = 国家方針を変えられる間隔・harsh = 住みにくい惑星 (適性 1) の人口の上限の倍率・forbid = 入植できない惑星の型・warFree = 宣戦に政治力が要らない・
//   exhaust = 戦争疲弊の溜まり方の倍率・noPacts = 結べない協定・build = 施設の建設費の倍率・outpost = 採掘基地の費用の倍率・tradePacts = 交易協定を相手の AI が断らない・
//   tariffMax = 関税の上限・billBonus = 法案の支持に足す点・pcCap = 政治力の上限。growth・cap・capBy・ind は前からの倍率
const SPECIES_TRAITS = {
  prolific: { label: '多産', desc: '入植船を同時に 1 隻多く飛ばせ、出せる星系の人口が 3 分の 1。代わりに 食料が足りないと人口の減り方が 1.5 倍', good: '入植船を同時に 1 隻多く飛ばせ、出せる星系の人口が 3 分の 1', bad: '食料が足りないと人口の減り方が 1.5 倍', colonizePop: 1 / 3, colonyShips: 1, starve: 1.5 },
  longlived: { label: '長命', desc: '議会のいら立ちが半分 (毎年 −0.125)。代わりに 国家方針を変えられる間隔が 45 年 (ふつう 30 年)・人口の増え方 ×0.8', good: '議会のいら立ちが半分 (毎年 −0.125)', bad: '国家方針を変えられる間隔が 45 年 (ふつう 30 年)・人口の増え方 ×0.8', councilDrift: 0.5, policyYears: 45, growth: 0.8 },
  adaptable: { label: '適応力', desc: '住みにくい惑星 (適性 1) の人口の上限 ×3', good: '住みにくい惑星 (適性 1) の人口の上限 ×3', bad: 'なし', harsh: 3 },
  aquatic: { label: '水棲', desc: '海洋の惑星で人口の上限 ×1.5。代わりに 乾燥した惑星に入植できない', good: '海洋の惑星で人口の上限 ×1.5', bad: '乾燥した惑星に入植できない', capBy: { ocean: 1.5 }, forbid: ['desert'] },
  cryophile: { label: '寒冷適応', desc: '寒冷な惑星で人口の上限 ×1.5。代わりに 温暖な惑星に入植できない', good: '寒冷な惑星で人口の上限 ×1.5', bad: '温暖な惑星に入植できない', capBy: { frozen: 1.5 }, forbid: ['temperate'] },
  xerophile: { label: '乾燥適応', desc: '乾燥した惑星で人口の上限 ×1.5。代わりに 海洋の惑星に入植できない', good: '乾燥した惑星で人口の上限 ×1.5', bad: '海洋の惑星に入植できない', capBy: { desert: 1.5 }, forbid: ['ocean'] },
  warlike: { label: '好戦的', desc: '宣戦に政治力が要らない・戦争疲弊の溜まり方 ×0.5。代わりに 不可侵と防衛同盟の協定を結べない', good: '宣戦に政治力が要らない・戦争疲弊の溜まり方 ×0.5', bad: '不可侵と防衛同盟の協定を結べない', warFree: true, exhaust: 0.5, noPacts: ['nap', 'ally'] },
  industrious: { label: '勤勉', desc: '施設の建設費 ×0.75。代わりに 議会のいら立ち 毎年 −0.5 (ふつう −0.25)', good: '施設の建設費 ×0.75', bad: '議会のいら立ち 毎年 −0.5 (ふつう −0.25)', build: 0.75, councilDrift: 2 },
  miners: { label: '鉱夫', desc: '採掘基地の費用 ×0.5。代わりに 工業の生産 ×0.95', good: '採掘基地の費用 ×0.5', bad: '工業の生産 ×0.95', outpost: 0.5, ind: 0.95 },
  traders: { label: '商才', desc: '破約をしていなければ、交易協定の申し入れを AI の国は断らない。代わりに 関税を 5% より上げられない', good: '破約をしていなければ、交易協定の申し入れを AI の国は断らない', bad: '関税を 5% より上げられない', tradePacts: true, tariffMax: 0.05 },
  wise: { label: '賢明', desc: '法案の支持 +10 点 (説得がうまい)。代わりに 政治力の上限 70 (ふつう 100)', good: '法案の支持 +10 点 (説得がうまい)', bad: '政治力の上限 70 (ふつう 100)', billBonus: 0.1, pcCap: 70 },
  // 回 SE10 (B-144。ユーザーの依頼 2026-11-01「種族の特性は、全部せ」= 案の 8 つすべて)
  scholarly: { label: '学究', desc: '研究者の生産性 ×1.25 (技術の伸び)。代わりに 人口の増え方 ×0.85', good: '研究者の生産性 ×1.25 (技術の伸び)', bad: '人口の増え方 ×0.85', research: 1.25, growth: 0.85 },
  bureaucratic: { label: '官僚的', desc: '財政の行政の遅れ ×0.5。代わりに 政治力の上限 80 (ふつう 100)', good: '財政の行政の遅れ ×0.5', bad: '政治力の上限 80 (ふつう 100)', admin: 0.5, pcCap: 80 },
  hardy: { label: '頑強', desc: '食料が足りないと人口の減り方 ×0.5。代わりに 惑星の人口の上限 ×0.9 (母星を除く)', good: '食料が足りないと人口の減り方 ×0.5', bad: '惑星の人口の上限 ×0.9 (母星を除く)', starve: 0.5, cap: 0.9 },
  voidborn: { label: '航宙民', desc: '艦隊の維持費 ×0.75。代わりに 惑星の人口の上限 ×0.9 (母星を除く)', good: '艦隊の維持費 ×0.75', bad: '惑星の人口の上限 ×0.9 (母星を除く)', upkeep: 0.75, cap: 0.9 },
  cohesive: { label: '結束', desc: '政治から締め出された人口の不満が半分 (集団の忠誠度の差と、離反の起きやすさへの効き)。代わりに 恒星間移民の数 ×0.5', good: '政治から締め出された人口の不満が半分 (集団の忠誠度の差と、離反の起きやすさへの効き)', bad: '恒星間移民の数 ×0.5', excl: 0.5, migrate: 0.5 },
  nomadic: { label: '遊牧', desc: '恒星間移民の数 ×2。代わりに 施設の建設費 ×1.1', good: '恒星間移民の数 ×2', bad: '施設の建設費 ×1.1', migrate: 2, build: 1.1 }, // 建設費は 1 回目の測りで勝率の比 0.45 (×1.25) だったので ×1.1 に
  diplomatic: { label: '外交的', desc: '協定の申し入れの政治力 ×0.5。代わりに 宣戦の政治力 ×2', good: '協定の申し入れの政治力 ×0.5', bad: '宣戦の政治力 ×2', pactPc: 0.5, warPc: 2 },
  pious: { label: '信心深い', desc: '家臣の忠誠度の目標 +3。代わりに 研究者の生産性 ×0.9 (技術の伸び)', good: '家臣の忠誠度の目標 +3', bad: '研究者の生産性 ×0.9 (技術の伸び)', loyalty: 3, research: 0.9 },
};
const HUMAN_TRAITS = ['adaptable', 'traders'];
const TRAIT_CLASH = [['prolific', 'longlived'], ['aquatic', 'cryophile', 'xerophile'], ['adaptable', 'longlived'],
  ['cohesive', 'nomadic'], ['warlike', 'diplomatic'], ['prolific', 'hardy'], ['scholarly', 'pious']]; // 回 SE10: 移民の向きが逆・宣戦の政治力が逆・飢えの減り方が逆・研究の向きが逆
// 種族名から特性を 2〜3 個決める (同じ名前ならいつも同じ。食い違う特性は同時に持たない)
function speciesTraits(species) {
  if (species === HUMAN) return HUMAN_TRAITS;
  const rng = new Rng(hashSeed(`traits/${species}`));
  const keys = Object.keys(SPECIES_TRAITS).filter((k) => k !== 'adaptable');
  const out = [];
  const n = rng.chance(0.4) ? 3 : 2;
  while (out.length < n) {
    const k = rng.pick(keys);
    if (out.includes(k) || TRAIT_CLASH.some((g) => g.includes(k) && out.some((o) => g.includes(o)))) continue;
    out.push(k);
  }
  return out;
}
// 特性をまとめた倍率と規則
function traitMods(traits) {
  const m = { growth: 1, cap: 1, capBy: {}, fleet: 1, ind: 1, mine: 1, trade: 1, pc: 0,
    colonizePop: 1, colonyShips: 0, starve: 1, councilDrift: 1, policyYears: POLICY_YEARS, harsh: 1, forbid: [], warFree: false, exhaust: 1, noPacts: [], build: 1, outpost: 1, tradePacts: false, tariffMax: 1, billBonus: 0, pcCap: PC_CAP,
    research: 1, admin: 1, upkeep: 1, excl: 1, migrate: 1, pactPc: 1, warPc: 1, loyalty: 0 }; // 下の 8 つは回 SE10
  for (const k of traits || []) {
    const t = SPECIES_TRAITS[k];
    if (!t) continue;
    for (const f of ['growth', 'cap', 'fleet', 'ind', 'mine', 'trade', 'colonizePop', 'starve', 'councilDrift', 'exhaust', 'build', 'outpost', 'harsh', 'research', 'admin', 'upkeep', 'excl', 'migrate', 'pactPc', 'warPc']) if (t[f] !== undefined) m[f] *= t[f];
    if (t.loyalty) m.loyalty += t.loyalty;
    if (t.colonyShips) m.colonyShips += t.colonyShips;
    if (t.pc) m.pc += t.pc;
    for (const [s, v] of Object.entries(t.capBy || {})) m.capBy[s] = (m.capBy[s] || 1) * v;
    if (t.policyYears) m.policyYears = Math.max(m.policyYears, t.policyYears);
    if (t.forbid) m.forbid = [...m.forbid, ...t.forbid];
    if (t.noPacts) m.noPacts = [...m.noPacts, ...t.noPacts];
    if (t.warFree) m.warFree = true;
    if (t.tradePacts) m.tradePacts = true;
    if (t.tariffMax !== undefined) m.tariffMax = Math.min(m.tariffMax, t.tariffMax);
    if (t.billBonus) m.billBonus += t.billBonus;
    if (t.pcCap) m.pcCap = Math.min(m.pcCap, t.pcCap);
  }
  return m;
}
// 国ごとに違う開始の大きさ (回 SE8・B-029。QD-111 = c: 現実の国の大きさの散らばりから引き、釣り合わせない)。
// q = 1820 年の国の人口 ÷ 中央値 の 10・25・50・75・90% 点 (Maddison Project Database 2023 の 90 か国。data/build/analyze_nations.py → data/derived/nations.json)。
// 国ごとに 10〜90% 点のあいだの順位 u を一様に引き、点のあいだは対数で内挿する。ゲームの大きさ = 比 ^ EDITIONS.game.nationSize (母星の人口の上限があるので縮める。補正の台帳の C21)。
// army = ln 軍の人員 の ln 総人口 への傾き 0.958 (COW の国力の指標 6.0 の 1816〜1850 年。開始の艦隊と兵)・money = ln 軍事費 の傾き 1.135 (開始の資金)
const NATION_SIZE = { q: [[0.1, 0.0889], [0.25, 0.2616], [0.5, 1], [0.75, 2.2619], [0.9, 6.2471]], army: 0.9582, money: 1.135 };
function nationSizeOf(u) {
  const Q = NATION_SIZE.q, x = clamp(u, Q[0][0], Q[Q.length - 1][0]);
  let i = 0;
  while (i < Q.length - 2 && x > Q[i + 1][0]) i++;
  const [u0, r0] = Q[i], [u1, r1] = Q[i + 1], t = (x - u0) / (u1 - u0);
  return GM.exp((GM.log(r0) + t * (GM.log(r1) - GM.log(r0))) * (ED.nationSize ?? 0));
}
let NO_MODS_ = null;
const noMods = () => (NO_MODS_ ??= traitMods([])); // 特性なし (国家選択のない試合)。政治力の上限などの値が読み込まれてから作る
// ハンディキャップ表 (難易度)。AI の頭の良さは変えず、AI の国の収入と建設費の倍率と、プレイヤーに見える情報だけを変える
// info: full = 他国の艦隊の数も正確に見える、fuzzy = 5 艦隊単位の概数、hidden = 見えない
// 開始時に選ぶ生産性 (1 人あたりの産出の倍率。農業・鉱業・工業と採掘基地に効く)。「いまのまま」= 現代 (2023 年) の最前線の生産性とみなす。
// 「2300 年の予測」は、米国の 1 時間あたりの労働生産性 (Bergeaud, Cette & Lecat の Long-Term Productivity Database) の 1890〜2023 年の
// 伸び (年 2.0%) とコンドラチェフの波 (周期 40〜70 年の正弦波。効きは ×0.99) から 2300 年まで延ばした倍率。最近の伸び (2005〜2023 年、
// 年 1.27%) なら ×33、1973 年からなら ×63 (data/derived/productivity.json、docs/productivity.md)。「自分で決める」は 0.1〜1000 倍
const PRODUCTIVITY = {
  now: { label: '現代のまま (×1)', k: 1 },
  forecast: { label: '2300 年の予測 (×253)', k: 252.76 },
  custom: { label: '自分で決める' },
};
const PRODUCTIVITY_RANGE = [0.1, 1000];
