const RES = ['food', 'water', 'metal', 'fuel', 'rare', 'goods', 'slaves', 'hitech']; // goods = 低付加価値物品、hitech = 高付加価値物品 (回 KE5。前の版のセーブと番号をずらさないように末尾に足した)
const MINED = ['water', 'metal', 'fuel', 'rare'];
const RES_INDEX = Object.fromEntries(RES.map((r, i) => [r, i])); // 資源の番号 (計算用のキーに使う)
// 忠誠度の目標の内訳。目標 = 先頭から順に足した値 (0〜100 に収める)
// 忠誠度の目標の内訳。距離は直接には小さく効き、主人の関与 (指令・援助・艦隊・視察) が途絶えた年数が大きく効く
// (遠い星系ほど関与が届くのに時間と政治力がかかるので、距離は間接的に効く)
function loyaltyTermsOf({ dLord, dCapital, bigger, orders, lordShips, dep, neglect = 0, regime = BASE_REGIME, arrears = false, concession = false, policy = null, exhaustion = 0, tax = 'normal', ctax = 0, welfare = 0 }) {
  const taxK = burdenK({ tax, ctax });
  return [
    { label: '基準', v: 85 },
    { label: '主人との距離', v: -(0.6 * dLord), note: `${dLord.toFixed(1)} ly` },
    { label: '首都との距離', v: -(0.3 * dCapital), note: `${dCapital.toFixed(1)} ly` },
    { label: '主人より人口が多い', v: -(bigger ? 25 : 0) },
    { label: '最近の指令', v: -(2 * orders) },
    { label: '主人の星系の艦隊', v: Math.min(15, 2 * lordShips) },
    { label: '支援で深まった従属', v: Math.min(40, dep) },
    ...(NEGLECT_MAX ? [{ label: '放っておかれた年数', v: -Math.min(NEGLECT_MAX, NEGLECT_RATE * Math.max(0, neglect - NEGLECT_GRACE)), note: JA`${Math.floor(neglect)} 年` }] : []), // NEGLECT_MAX = 0 なら効かない
    { label: JA`統治体制 (${REGIMES[regime].label})`, v: REGIMES[regime].loyalty },
    { label: '減税・自治', v: concession ? 15 : 0 },
    ...(arrears ? [{ label: '関税受領官 (滞納)', v: -H33.arrears }] : []),
    { label: JA`国家方針${policy ? ` (${POLICIES[policy].label})` : ''}`, v: POLICY_LOYALTY[policy] || 0 },
    ...(exhaustion ? [{ label: '国の戦争疲弊', v: -EXHAUST.loyalty * exhaustion, note: `${Math.round(exhaustion)}` }] : []),
    ...(Math.abs(taxK - 1) > 1e-9 ? [{ label: JA`税 (${(taxRateOf(tax) * 100).toFixed(1)}%${ctax ? JA` + 消費税 ${(ctax * 100).toFixed(1)}%` : ''})`, v: TAX_LOYALTY * (taxK - 1) }] : []),
    ...(welfare ? [{ label: '福祉の予算', v: BUDGET.welfare.loyalty * welfare }] : []),
  ];
}
const RES_LABEL = { food: '食料', water: '水', metal: '金属', fuel: '燃料', rare: '希少元素', goods: '低付加価値物品', slaves: '奴隷', hitech: '高付加価値物品', credits: 'cr' };
const PRICE = { food: 1, water: 0.8, metal: 1.5, fuel: 2, rare: 8, goods: 4, slaves: 3, hitech: 12 }; // hitech: 原料 (低付加価値物品 0.5・希少元素 0.05) の 2.4 の 5 倍 (HITECH)
const TECH_LABEL = ['石器時代', '農耕時代', '産業時代', '情報時代'];
const KANA_A = ['カ', 'ヴェ', 'ロ', 'リ', 'サ', 'トゥ', 'ネ', 'ミ', 'ゾ', 'アル', 'エル', 'オル', 'ダ', 'フィ', 'ゼ', 'ユ', 'ハ', 'ボ', 'ギ', 'セ'];
const KANA_B = ['ラ', 'タ', 'ニス', 'ロン', 'ドール', 'リア', 'ソル', 'ヴェン', 'ムス', 'タン', 'リス', 'ガル', 'ファ', 'コン', 'ディス', 'リクス'];

// 埋蔵量は 0〜2.5 程度の係数。鉱業に就く 100万人あたりの年産量になる。
function makeDeposits(rng, b) {
  const d = { water: 0, metal: 0, fuel: 0, rare: 0 };
  const icy = b.surface === 'frozen';
  switch (b.type) {
    case 'rocky':
      d.metal = rng.range(0.4, 1.4);
      d.rare = rng.chance(0.3) ? rng.range(0.1, 0.6) : 0.02;
      d.water = 0.2 + 0.5 * clamp(b.water, 0, 1) + (icy ? 0.8 : 0);
      break;
    case 'dwarf':
      d.metal = rng.range(0.2, 0.8);
      d.rare = rng.chance(0.2) ? rng.range(0.1, 0.5) : 0;
      d.water = icy ? rng.range(0.8, 1.6) : 0.1;
      break;
    case 'belt': d.metal = rng.range(1.4, 2.4); d.rare = rng.range(0.3, 1); d.water = rng.range(0.1, 0.5); break;
    case 'gas-giant': d.fuel = rng.range(1.4, 2.4); d.water = 0.3 + 0.2 * d.fuel; break;
    case 'ice-giant': d.fuel = rng.range(0.7, 1.4); d.water = rng.range(1, 2); break;
    case 'mini-neptune': d.fuel = rng.range(0.4, 1); d.water = rng.range(0.4, 1); break;
    default: break;
  }
  return d;
}

// 先住民は大気と海のある温暖な惑星にだけいる。pop は人口[百万人]。mood は初期の友好度。
function makeNatives(rng, b) {
  const lush = b.surface === 'temperate' || b.surface === 'ocean';
  if (!lush || !b.settle || b.settle.grade < 2 || !rng.chance(b.settle.grade === 3 ? 0.55 : 0.3)) return null;
  const tech = rng.weighted([0, 1, 2, 3], (t) => [0.4, 0.35, 0.18, 0.07][t]);
  return {
    species: JA`${rng.pick(KANA_A)}${rng.pick(KANA_B)}人`,
    pop: rng.logUniform(1, 300) * GM.pow((1 + tech), 1.5),
    tech,
    mood: Math.round(rng.range(-40, 30)),
  };
}

// 先住民の追加分。既存の銀河の先住民と資源を変えないよう、別の乱数列で上乗せする。
// 温暖・海洋の惑星は適性「困難」でも、乾燥・寒冷でも大気があれば、まれに先住民がいる。
function makeMoreNatives(rng, b) {
  if (b.natives || b.type !== 'rocky' || !b.settle || b.settle.grade < 1) return null;
  const lush = b.surface === 'temperate' || b.surface === 'ocean';
  const harsh = (b.surface === 'desert' || b.surface === 'frozen') && b.pressure >= 0.05;
  const p = lush ? [0, 0.35, 0.5, 0.6][b.settle.grade] : harsh ? 0.15 : 0;
  if (!p || !rng.chance(p)) return null;
  const tech = rng.weighted([0, 1, 2, 3], (t) => (lush ? [0.4, 0.35, 0.18, 0.07] : [0.6, 0.3, 0.08, 0.02])[t]);
  return {
    species: JA`${rng.pick(KANA_A)}${rng.pick(KANA_B)}人`,
    pop: rng.logUniform(1, lush ? 300 : 40) * GM.pow((1 + tech), 1.5),
    tech,
    mood: Math.round(rng.range(-40, 30)),
  };
}
const mayHaveNatives = (b) => b.type === 'rocky' && b.settle?.grade >= 1 && b.pressure >= 0.05 && ['temperate', 'ocean', 'desert', 'frozen'].includes(b.surface);

function addExtras(galaxy) {
  for (const sys of galaxy.systems) {
    const rng = new Rng(hashSeed(`${galaxy.seed}/extras/${sys.id}`));
    for (const b of sys.bodies) {
      b.deposits = makeDeposits(rng, b);
      b.natives = sys.id === 0 ? null : makeNatives(rng, b);
    }
    for (const s of sys.stars) s.deposits = { water: 0, metal: 0, fuel: 0, rare: 0 };
    if (sys.id === 0) continue;
    const more = new Rng(hashSeed(`${galaxy.seed}/natives2/${sys.id}`));
    for (const b of sys.bodies) if (!b.natives) b.natives = makeMoreNatives(more, b);
    // 出現率を半分にする。外した先住民は nativesSpare に残し、セーブで関わりのあったものは読み込み時に戻す
    const keep = new Rng(hashSeed(`${galaxy.seed}/natives-keep/${sys.id}`));
    for (const b of sys.bodies) if (b.natives && !keep.chance(0.5)) { b.nativesSpare = b.natives; b.natives = null; }
  }
  galaxy.systems[0].bodies.find((b) => b.id === 'earth').deposits = { water: 0.5, metal: 1, fuel: 0.4, rare: 0.15 };
}

// ゲーム状態: 時間、入植地、入植船、経済、交易、軍事、先住民。
// 人口の単位は百万人。資源の単位は「100万人が1年に食べる食料」= 1 を基準にした量。


// 通信 (物資移送要求・指令・朝貢・送金) は光速。船はそれより遅いので、地球へ向かう船も瞬間移動には見えない
const SHIP_SPEED = 0.95; // 交易路上の船の速度 [c] (貨物船・資材輸送船・入植船・移民船・歩兵・艦隊)
const OFFROUTE_SPEED = 0.9; // 交易路の外を飛ぶときの速度 [c] (艦隊・入植船・征服戦争の増援)
const START_YEAR = 2300;
const START_CREDITS = 1000;
// 民間・先住民の帳簿 o の手持ち o[f] を v だけ動かす。足りない分は銀行から借り (o[lf])、手持ちができたら返す。純額 (手持ち − 借り) は v だけ動く
function bankMove(o, f, v, lf = 'loan') {
  const net = (o[f] || 0) - (o[lf] || 0) + v;
  o[f] = Math.max(0, net);
  o[lf] = Math.max(0, -net);
}
const STEP = 0.25; // 経済シミュレーションの刻み[年]
const GHOST_KINDS = ['cargo', 'fleets', 'requests', 'troopMoves', 'migrants', 'ships', 'projects'];

