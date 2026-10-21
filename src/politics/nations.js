// --- 国と種族 (国家選択) ---
// 種族の特性 (係数表)。国の種族の特性が、その国のすべての星系に効く。値は倍率 (pc は政治力の年あたりの加算)
const SPECIES_TRAITS = {
  prolific: { label: '多産', desc: '人口の増え方 ×1.3', growth: 1.3 },
  longlived: { label: '長命', desc: '人口の増え方 ×0.8・人口の上限 ×1.15', growth: 0.8, cap: 1.15 },
  adaptable: { label: '適応力', desc: '人口の上限 ×1.1', cap: 1.1 },
  aquatic: { label: '水棲', desc: '海洋の惑星で人口の上限 ×1.5、乾燥した惑星で ×0.6', capBy: { ocean: 1.5, desert: 0.6 } },
  cryophile: { label: '寒冷適応', desc: '寒冷な惑星で人口の上限 ×1.5、温暖な惑星で ×0.8', capBy: { frozen: 1.5, temperate: 0.8 } },
  xerophile: { label: '乾燥適応', desc: '乾燥した惑星で人口の上限 ×1.5、海洋の惑星で ×0.8', capBy: { desert: 1.5, ocean: 0.8 } },
  warlike: { label: '好戦的', desc: '艦隊の戦力 ×1.2', fleet: 1.2 },
  industrious: { label: '勤勉', desc: '工業の生産 ×1.2', ind: 1.2 },
  miners: { label: '鉱夫', desc: '鉱業の生産 ×1.25', mine: 1.25 },
  traders: { label: '商才', desc: '交易の収入 ×1.25', trade: 1.25 },
  wise: { label: '賢明', desc: '政治力 +1/年', pc: 1 },
};
const HUMAN_TRAITS = ['adaptable', 'traders'];
const TRAIT_CLASH = [['prolific', 'longlived'], ['aquatic', 'cryophile', 'xerophile'], ['adaptable', 'longlived']];
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
// 特性をまとめた倍率
function traitMods(traits) {
  const m = { growth: 1, cap: 1, capBy: {}, fleet: 1, ind: 1, mine: 1, trade: 1, pc: 0 };
  for (const k of traits || []) {
    const t = SPECIES_TRAITS[k];
    if (!t) continue;
    for (const f of ['growth', 'cap', 'fleet', 'ind', 'mine', 'trade']) if (t[f]) m[f] *= t[f];
    if (t.pc) m.pc += t.pc;
    for (const [s, v] of Object.entries(t.capBy || {})) m.capBy[s] = (m.capBy[s] || 1) * v;
  }
  return m;
}
const NO_MODS = traitMods([]);
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
