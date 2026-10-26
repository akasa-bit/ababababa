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
const LedgerVec = namedVec(Object.keys(LEDGER_LABEL)); // 政府の収支の表 (gv.ledger。年あたりにならした値) の並び (world.js の namedVec)。この刻みの分 (gv.led) は名前の物のまま
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
  rule: '統治体制の変更', bundle: '約定の交渉', jointcut: '共同統治の分け前', depose: '統治者の任免', fiscal: '財政の変更', mandate: '委任方針の変更', governor: '総督の方針の変更', inspect: '視察団', decide: '返事', policy: '国家方針の変更',
};
const SEED_FUNDS = { planet: 200, station: 80 }; // 入植船が新しい政府に持っていく開拓資金 (入植船の費用に含まれる)
const BASE_TAX = { planet: 5, station: 2 }; // 入植地ごとの基本の税収 [cr/年] (小さな入植地の政府を回すため) // 従属する星系が主人に納める、年間収入の割合

const stockCap = (pop) => 500 + 5 * pop; // 星系の備蓄上限 (資源ごと)
// 試合 (Game) の物に、作ったあと (刻みの途中や読み込みのとき) に初めて書き込む値の名前。constructor の始めに undefined として置き、試合の物の形を始めから固定する。
// JavaScript の JIT は物の形 (値の名前と並び) ごとに速いコードを作るので、途中で値が増えて形が変わるたびに、this.… の読み出しやメソッドの呼び出しが遅い道
// (megamorphic) に落ちて戻らない (この一覧を置いただけで、試合を回す時間が 2 割ほど減った)。値は undefined なので、??= や === undefined の判定は前と同じ。
// 試合の物に新しく途中で書き込む値を足したら、ここにも名前を足す (tools/tests/shape.js が足し忘れを見つける)。セーブには入らない (セーブは SAVE_LEGACY と saveField の項目だけ)
const GAME_LATE_FIELDS = [
  '_sdG', '_sd', 'nmap', 'live', 'ksCache', 'stepping', 'stepH', 'aif', 'basket', '_demoLn', '_demoCache', '_schoolRefK', '_servMemo', 'intelSpan', 'flowPop',
  'alpha', 'gpts', '_pinT', 'routeIx', '_peaceIx', 'travelCache', 'reachCache', 'msgTo', 'snapVer', 'pinc', '_remit', 'lastIndependence', 'pirateRaids',
  'endShown', '_eduY', 'colIdx',
];
// 星系の政府の物の値の名前と並び。政府はいつも newGov で、この並びの物として作る (読み込みのときも同じ並びに入れ直す。restore)。
// 政府ごとに値の付く順が違うと物の形が 1 つずつ違い (5 つの試合で 885 通り)、値を消す (delete) と遅い辞書の形になって、政府の値を読むたびに遅い道に落ちていた。
// まだない値は undefined (セーブには書かれない)。値を消すときも delete せずに undefined を入れる。セーブの JSON の鍵の並びはこの並びになる (中身は同じ)。
// 政府に新しい値を足したら、ここにも名前を足す (tools/tests/shape.js が足し忘れを見つける)
const GOV_FIELDS = [
  // 主従と統治体制
  'lord', 'credits', 'founded', 'loyalty', 'independent', 'regime', 'direct', 'law', 'fact', 'elite', 'patron', 'lord2', 'jointCut', 'jointSolo', 'grudge', 'unionEnd',
  'arrears', 'mandate', 'governor',
  // 政治 (忠誠・恐怖・友好・関与・不満・要求)
  'fear', 'friend', 'orders', 'attended', 'dep', 'aid', 'aidYear', 'lordTrade', 'lordTradeYear', 'unrest', 'taxFree', 'autonomy', 'scar', 'did', 'lastColony',
  'lastStation', 'far',
  // お金 (家計・会社・銀行・国債・財政の反応・遠くの持ち主)
  'hh', 'hloan', 'fm', 'loan', 'hm', 'bl', 'bond', 'b0', 'cpn', 'bondPaid', 'due', 'c0', 'bw', 'bpaid', 'apaid', 'dflt', 'nd', 'inc', 'fr', 'own', 'ownY', 'pinY',
  'pv', // 前の版の「民間」(読み込みで家計に移す)
  // 収支の帳簿 (この刻みの分・ならした年あたりの値) とエネルギー
  'led', 'ledger', 'eled', 'eledger', 'E', 'sw', 'pvd',
];
const GOV_BLANK = Object.fromEntries(GOV_FIELDS.map((k) => [k, undefined]));
// 政府の物を作る (init の値を入れる。GOV_FIELDS にない名前は後ろに足される)
const newGov = (init) => Object.assign({ ...GOV_BLANK }, init);
// 入植地の物の値の名前と並び (政府の GOV_FIELDS と同じ決まり)。入植地は newCol で、この並びの物として作る (読み込みのときも同じ並びに入れ直す。restore)。
// 値の付く順が入植地ごとに違うと物の形が分かれ (4 つの試合で 12 通り)、c.pop・c.sys などの読み出しが遅い道に落ちていた (docs/perf.md)。
// セーブには undefined の値は書かないので、セーブの中身は変わらない (JSON の鍵の並びはこの順になる)。入植地に新しい値を足したら、ここにも名前を足す (tools/tests/shape.js)
const COL_FIELDS = [
  // 作ったときの値 (addColony)
  'sys', 'body', 'kind', 'founded', 'name', 'pop', 'focus', 'lv', 'troops', 'slaveTroops', 'races',
  // 経済
  'sh', 'plan', 'planHi', 'industry', 'industryHi', 'sat', 'alerts', 'avg', 'alertSince',
  // 年齢と教育・所得
  'age', 'tfr', 'ws', 'edu', 'hk', 'growth', 'incY', 'inc', 'wexp', 'wage', 'incU',
  // 移民・奴隷労働・疫病
  'crowdLogged', 'migOut', 'slaveWork', 'migIn', 'plague',
];
const COL_BLANK = Object.fromEntries(COL_FIELDS.map((k) => [k, undefined]));
const newCol = (init) => Object.assign({ ...COL_BLANK }, init);
