// 入植船の費用。工業品は船の構造 (住む場所を含む)。推進はエネルギー (shipCost が質量と速さから足す)
const SHIP_COST = { planet: { credits: 300, goods: 100 }, station: { credits: 150, goods: 50 } };
const SETTLERS = { planet: 0.2, station: 0.02 }; // 入植船が運ぶ人口[百万人]
// 人口の増え方の最大 [/年]。フッター派の約 4.1% (Eaton & Mayer 1953) がほぼ人の生物学的な上限 (目標 R12)。シミュレーション版は種族の特性があっても 4.2% で頭打ち
const POP_GROWTH = 0.04;
const WARSHIP_COST = { credits: 150, metal: 100, fuel: 50, rare: 10 };
const WARSHIP_UPKEEP = 5; // cr/年
// 兵站: 1艦隊が1年に使う補給物資。駐留する星系 (攻撃中や入植していない星系なら、その国の最も近い星系) の備蓄から出す
const FLEET_SUPPLY = { fuel: 2, metal: 1 };
// 補給線: 補給の拠点からこの距離 [光年] までは戦力そのまま、遠いほど落ち、SUPPLY_FAR で半分 (それより先も半分)
const SUPPLY_NEAR = 6, SUPPLY_FAR = 30;
const WARSHIP_BATCH = [1, 5, 10, 20]; // 一括編成の数
// 編成中の艦隊の数 (一括編成は1件で n 艦隊)
const queuedWarships = (list, sys) => list.reduce((k, j) => k + (j.type === 'warship' && j.sys === sys ? j.n || 1 : 0), 0);
const mulCost = (cost, n) => Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, v * n]));
const GIFT_COST = { credits: 100 };
// 採掘基地: 無人の基地で、ガス惑星からは水と燃料、岩石の天体からは金属と希少元素を採る
const OUTPOST_RES = { 'gas-giant': ['water', 'fuel'], 'ice-giant': ['water', 'fuel'], 'mini-neptune': ['water', 'fuel'], rocky: ['metal', 'rare'], dwarf: ['metal', 'rare'], belt: ['metal', 'rare'] };
const OUTPOST_RATE = 25; // 埋蔵量1・Lv1あたりの年産量
const outpostRes = (b) => (b && !b.label && OUTPOST_RES[b.type]) || [];
const PIRATE_START = 2320;
const LEDGER_ICON = { tax: 'tax', ctax: 'tax', tariff: 'import', trade: 'export', import: 'import', interest: 'credits', welfare: 'pop', security: 'loyalty', military: 'fleet', natives: 'natives', tribute: 'tribute', grant: 'grant', upkeep: 'fleet' };
const LEDGER_LABEL = { tax: '税収', ctax: '消費税', tariff: '関税', trade: '輸出', import: '輸入', interest: '利子 (貯えの利子 − 国債の利子)', public: '行政サービス', welfare: '福祉の予算', security: '治安の予算', military: '軍事の予算', natives: '先住民', tribute: '朝貢', grant: '資金援助', upkeep: '軍の維持費', pension: '年金', health: '医療' };
const LOYALTY_START = 70; // 新しい政府の忠誠度
const FRIEND_SAFE = 50; // 主人との友好度がこれ以上なら、威圧の艦隊を送らない
const FRIEND_DAMP = 0.6; // 友好度100で、最後通牒の期限に独立を宣言する確率が 1 − FRIEND_DAMP 倍になる
const GRANT_YEARS = 50; // 入植後この年数のあいだ、主人の星系が自動で資金援助を送る
const GRANT_MAX = 300; // 自動の資金援助の上限 [cr/年]。主人の資金の3%まで
const REALM_COLORS = ['#ff9f43', '#ee5aa8', '#a3e635', '#f5d142', '#60a5fa', '#c084fc', '#f87171', '#34d399'];
const CMD_LABEL = {
  peace: '講和の申し入れ', send: '入植船を送る', candsend: '入植船を送る', upgrade: '施設の拡張', route: '交易路の開設', route2: '交易路の開設', uproute: '交易路の拡張',
  warship: '艦隊の編成', fort: '宇宙要塞の強化', fleet: '艦隊の派遣', strike: '光速の一撃', redirect: '艦隊の進路変更', fleetclear: '艦隊への指令の取り消し', gift: '先住民への贈り物', integrate: '先住民を市民に', conquer: '先住民の制圧', enslave: '奴隷化',
  slavetype: '奴隷の扱いの変更', liberate: '先住民の解放', train: '歩兵の訓練', troopsend: '歩兵の派遣', outpost: '採掘基地の建設', focus: '方針の変更',
  rule: '統治体制の変更', bundle: '約定の交渉', include: '集団の権力への近さ', jointcut: '共同統治の分け前', depose: '統治者の任免', fiscal: '財政の変更', mandate: '委任方針の変更', governor: '総督の方針の変更', inspect: '視察団', decide: '返事', policy: '国家方針の変更',
};
const SEED_FUNDS = { planet: 200, station: 80 }; // 入植船が新しい政府に持っていく開拓資金 (入植船の費用に含まれる)
const BASE_TAX = { planet: 5, station: 2 }; // 入植地ごとの基本の税収 [cr/年] (小さな入植地の政府を回すため) // 従属する星系が主人に納める、年間収入の割合

const stockCap = (pop) => 500 + 5 * pop; // 星系の備蓄上限 (資源ごと)
