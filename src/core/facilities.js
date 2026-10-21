const FACILITY = { farm: '農場', mine: '鉱山', factory: '工場', habitat: '居住区', slaveworks: '奴隷工房', shipyard: '軍事基地', barracks: '軍事教練所' };
const FACILITY_MAX = { farm: 10, mine: 10, factory: 10, habitat: 10, slaveworks: 10, shipyard: 1, barracks: 5 };
const LV0 = () => ({ farm: 0, mine: 0, factory: 0, habitat: 0, slaveworks: 0, shipyard: 0, barracks: 0 });
// 奴隷工房: 奴隷 (市場で取引される先住民) を働かせて工業品を作る。Lv1 ごとに奴隷を年 SLAVEWORKS_USE 人使いつぶし
// (寿命で死ぬ分)、工業品を SLAVEWORKS_OUT 作る。奴隷が足りなければそのぶん減産
const SLAVEWORKS_USE = 1;
const SLAVEWORKS_OUT = 5;
// 市場奴隷にした先住民は、毎年その人口の SLAVE_SALE (1.5%) が奴隷として市場に出る (備蓄に入り、交易路で取引される)
const SLAVE_SALE = 0.015;
// 歩兵 (連隊)。軍事教練所で市民から訓練するか、軍事奴隷から徴集する。交易路を通って惑星間を移動する
const TROOP_COST = { credits: 30, goods: 10 };
const TROOP_DRAFT = 0.05; // 1連隊に徴集する人口[百万人]
const TROOP_UPKEEP = 2; // cr/年
const SLAVE_TROOP_UPKEEP = 0.5;
const SLAVE_TROOP_POWER = 0.6; // 奴隷兵1連隊の戦力
// 奴隷の扱い。奴隷化すると市場奴隷になり、手動で切り替えられる
const SLAVE_TYPES = { market: '市場奴隷', military: '軍事奴隷', livestock: '家畜' };
const HUMAN = '人類';
