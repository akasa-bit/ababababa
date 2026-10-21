// 国の名前の接尾辞 (歴史上の国家の国号から)。w = 選ばれやすさ、t = その特性を持つ種族なら選ばれやすくなる
const NATION_SUFFIX = [
  { s: '王国', ex: 'イングランド王国', w: 4 }, { s: '帝国', ex: 'ローマ帝国', w: 3, t: ['warlike'] }, { s: '共和国', ex: 'ヴェネツィア共和国', w: 4, t: ['traders', 'wise'] },
  { s: '連邦', ex: 'ソビエト連邦', w: 2, t: ['adaptable'] }, { s: '公国', ex: 'モナコ公国', w: 2 }, { s: '大公国', ex: 'リトアニア大公国', w: 2 },
  { s: '侯国', ex: 'アンハルト侯国', w: 1 }, { s: '辺境伯領', ex: 'ブランデンブルク辺境伯領', w: 1, t: ['warlike'] }, { s: '選帝侯国', ex: 'ザクセン選帝侯国', w: 1, t: ['wise'] },
  { s: '首長国', ex: 'キレナイカ首長国', w: 2, t: ['xerophile'] }, { s: 'ハン国', ex: 'ブハラ・ハン国', w: 2, t: ['warlike', 'prolific'] }, { s: 'スルタン国', ex: 'ブルネイ・スルタン国', w: 2, t: ['traders'] },
  { s: '自由国', ex: 'アイルランド自由国', w: 2 }, { s: '独立国', ex: '(独立を国号に掲げた国)', w: 2 }, { s: '自由市', ex: 'ダンツィヒ自由市', w: 1, t: ['traders'] },
  { s: '連合王国', ex: 'グレートブリテン及び北アイルランド連合王国', w: 1 }, { s: '合衆国', ex: 'アメリカ合衆国', w: 1, t: ['adaptable', 'prolific'] }, { s: '同盟', ex: 'ハンザ同盟', w: 1, t: ['traders'] },
  { s: '共和国連邦', ex: 'ポーランド・リトアニア共和国', w: 1 }, { s: '人民共和国', ex: '(20 世紀の社会主義国の国号)', w: 1, t: ['industrious'] },
  { s: '民主共和国', ex: 'ドイツ民主共和国', w: 1, t: ['industrious'] }, { s: '連邦共和国', ex: 'ドイツ連邦共和国', w: 1 }, { s: '藩王国', ex: 'ハイデラバード藩王国', w: 1 },
  { s: '市国', ex: 'バチカン市国', w: 1, t: ['wise'] }, { s: '自治領', ex: 'カナダ自治領', w: 1, t: ['cryophile'] }, { s: '国', ex: '(国号の基本形)', w: 2 },
];
// 独立した星系の国の接尾辞 (分かれて立った国らしいもの)
const SECEDE_SUFFIX = ['独立国', '自由国', '共和国', '自治国', '公国', '大公国', '侯国', '首長国', '自由市', '連邦', '王国', '国'];
// 種族の名前から国の名前を作る (「ミナーラ人」→「ミナーラ独立国」)。rng があればそれで、なければ名前から決める
function nationName(species, traits = [], rng = null) {
  const stem = species.replace(/人$/, '') || species;
  const ws = NATION_SUFFIX.map((x) => x.w * (x.t && x.t.some((t) => traits.includes(t)) ? 3 : 1));
  let r = (rng ? rng.next() : (hashSeed(species) % 10007) / 10007) * ws.reduce((a, b) => a + b, 0);
  const i = ws.findIndex((w) => (r -= w) < 0);
  return `${stem}${NATION_SUFFIX[i < 0 ? 0 : i].s}`;
}
// 自作の国の母星の好み
const HOME_ENV = { any: 'おまかせ', temperate: '温暖な惑星', ocean: '海洋の惑星', frozen: '寒冷な惑星', desert: '乾燥した惑星' };
const HOME_DIST = { any: 'おまかせ', near: '近い (10〜25 光年)', mid: 'ふつう (25〜45 光年)', far: '遠い (45 光年より先)' };
const HOME_DIST_RANGE = { any: [10, Infinity], near: [10, 25], mid: [25, 45], far: [45, Infinity] };
const NATION_COUNTS = [1, 4, 5, 6, 7, 8]; // 1 = 地球だけ (国家選択なし)
