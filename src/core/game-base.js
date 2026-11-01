class Game {
  constructor(galaxy) {
    this.galaxy = galaxy;
    this.rs = hashSeed(`${galaxy.seed}/sim`); // 試合の乱数の状態 (mulberry32)。セーブに含める
    SIM = this;
    // プレイヤー (人間が動かす国)。cap = その国の首都。政治力・議会・方針・自動化などはプレイヤーごとに持ち、
    // this.pc などは「いま操作しているプレイヤー (pi 番目)」の値を読み書きする (PLAYER_KEYS)
    this.players = [{ cap: 0, human: true }];
    this.pi = 0;
    this.stackOwner = {}; // 入植していない星系に駐留する艦隊の持ち主の国 { [sysId]: 首都 } (ないときは地球の国)
    this.nations = null; // 国家選択のある試合の国 [{ cap, body, species, traits, name }] (null なら地球だけの従来の試合)
    this.handicap = 'normal';
    this.productivity = 1; // 開始時に選ぶ生産性の倍率 (PRODUCTIVITY)
    this.pvPolicy = null; // スウォームの素子の作りの試合の既定 (シミュレーション版だけ。PV_DESIGNS の名前。null なら星系ごとに自動)
    this.physics = { ...ED.physics }; // この試合の物理の切り替え (EDITIONS の physics。セーブに入り、物理を入れる前のセーブは PHYSICS_OFF のまま続く)
    this.year = START_YEAR;
    this.colonies = [];
    this.ships = [];
    this.log = [];
    this.nextShipId = 1;
    // 星系ごとの政府 (封建領主)。lord は従属先の星系 (太陽系はプレイヤー = 地球政府で null)
    this.govs = { 0: { lord: null, credits: START_CREDITS, founded: START_YEAR } };
    this.snaps = {}; // 星系ごとの様子の記録 (地球から見えるのは光が届いた分だけ)
    // 戦争は国 (首都の星系) の組ごと。キーは warKey(a, b) = '小さい方|大きい方'
    this.realmWars = {}; // 交戦中の国の組 { [key]: 開戦年 }
    this.exhaustion = {}; // 国ごとの戦争疲弊 { [首都]: 0〜100 }
    this.tech = {}; // 国ごとの技術の水準と研究者 { [首都]: { A: { farm, mine, ind }, S } } (RESEARCH)。alpha は試合の始めに決める
    this.warStats = {}; // 戦争ごとの戦果 { [key]: { k: { [国]: 沈めた艦隊 }, t: { [国]: 攻め落とした星系 } } }
    this.peaceOffers = []; // 人間の国への講和の申し入れ { key, from, to, year, until }
    this.conferences = []; // 講和会議 { id, loser, year, until, from, bids: [{ realm, pts, picks }] }
    this.warNews = {}; // 開戦の知らせ { [key]: { year, from } }。各星系は知らせが光速で届いてから交易をやめる
    this.held = {}; // 命令で送られて駐留している艦隊の数 { [星系]: n }。自動防衛配備はこの分を動かさない
    this.peaces = []; // 終わった戦争 { key, a, b, year, from, start, by, news }。終戦の知らせが光速で広がるまで使う
    this.warBy = {}; // 戦争を仕掛けた国 { [key]: 首都 }。仕掛けられた側は降伏せず、攻め落とされるまで戦う
    this.intel = {}; // 星系ごとの年ごとの記録 { [星系]: [[年, 国, 駐留艦隊], …] } (変わったときだけ足す)。AI の国は光の遅れのぶん古いものを見て判断する (docs/ai-knowledge.md)
    this.shipHist = {}; // 国ごとの艦隊の数の記録 { [国]: [[年, 数], …] } (変わったときだけ足す)。力の移り変わり (BARGAIN.shift) を光の遅れのぶん古い値で見る
    this.aiOrders = []; // AI の国の首都から出た艦隊の指令 { at (届く年), realm, from, to, n }。光速で指令を出す星系へ届く
    this.sieges = []; // 攻囲 { sys, realm (攻める国の首都), ships, progress, start }
    // 到着して消えたあとも、その到着の光が地球に届くまでは地図に見えている動くもの (表示用、セーブしない)
    this.ghosts = { cargo: [], fleets: [], requests: [], troopMoves: [], migrants: [], ships: [], legs: [] };
    this.battles = []; // 艦隊戦 { sys, realm (攻める国の首都), a (攻撃側), d (防衛側), a0, d0 (投入した総数), start, progress (中断した攻囲の進捗) }
    this.stock = {}; // 星系ごとの備蓄。同じ星系の入植地は備蓄を共有する
    this.market = {}; // 星系ごとの市場 { u: 資源ごとのふだんの消費 [/年], p: 値段 } (段 5)
    this.util = {}; // 星系ごとの稼働率 { [資源]: 0〜1, mine } (需要で決まる生産。economy の 1。読み込みのあと最初の刻みまで使うのでセーブに入れる)
    this.unmet = {}; // この刻みに、資材が足りずに断られた注文の不足 [量] (受注残)
    this.absorb = {}; // この刻みに星系の物へあった需要 (消費・投入・建設・積み出し・補給) [量]。marketStep で使って空にする
    this.routes = []; // 交易路 { id, a, b, lv, transit: [A→Bの輸送中量, B→A], vol: [年あたり輸送量] }
    this.requests = []; // 物資移送要求 { id, kind: 'trade'|'build', from (要求元), to (送り手), res, amt, sent, arrive, state }
    this.cargo = []; // 輸送中の貨物 { key, path: [経由する星系], times: [各星系に着く年], arrive, load }
    this.inbound = {}; // 星系ごとの、向かってくる荷の量 (保存しない。貨物から数え直す)
    this.garrison = { 0: 3 }; // 星系ごとの駐留艦隊数
    this.fleets = []; // 移動中の艦隊 { id, from, to, n, depart, arrive }
    this.natives = {}; // 先住民の状態 { 'sys|body': { rel, status, pop } }
    this.infamy = 0; // 先住民を制圧するたびに増え、他の先住民の友好度を下げる
    this.surveyed = [];
    this.outposts = []; // 採掘基地 { sys, body, lv }
    this.auto = {}; // 自動開発を有効にした星系 { [sysId]: true }
    this.spectate = false; // 観戦モード: 地図とタブを光の遅れなしの実際の様子で見せ、地球政府も自動で動く
    this.autoTimer = 0;
    this.migration = true; // 過密な入植地からの恒星間移民
    this.autoRoutes = true;
    this.supplied = {}; // 駐留艦隊の補給の状態 { 星系: { k: 補給の充足率 (1年ほどでならす), d: 補給の拠点までの距離 } } // 混んだ交易路を自動で拡張する (太陽系と直轄の星系の交易路。ほかの星系の政府はいつも自分で拡張する)
    this.autoHabitat = true; // 過密な入植地の居住区を自動で拡張する
    this.wars = []; // 征服戦争 { sys, body, start, progress }
    this.warThreshold = 40; // 戦争方針: 統一されていない先住民の友好度がこの値未満なら征服戦争 (-1000 で戦争しない、1000 で常に戦争)
    this.troopMoves = []; // 移動中の歩兵 { id, from, to (入植地キー), path, times, arrive, troops, slave }
    this.migrants = []; // 移動中の移民船 { id, from, to (入植地キー), fromSys, toSys, n, depart, arrive }
    this.migLog = []; // 移民の到着記録 { year, from, to, n }
    this.autoBuild = true; // 自動防衛配備で艦隊が足りなければ編成する
    this.autoGrant = true; // 入植後50年の自動資金援助 (地球から直接の従属星系へ)
    this.autoDefense = false; // 自動防衛配備: 艦隊のいない入植星系へ余っている艦隊を回す
    this.autoAwe = true; // 反乱防止の威圧: 地球の直属の従属星系に、反乱したときの推定艦隊の2倍の艦隊を駐留させる
    this.awe = {}; // 威圧のために駐留している地球の艦隊の数 { [星系]: n } (駐留艦隊 garrison の内数。海賊対策の駐留とは別に数える)
    this.events = []; // 重要なイベント { id, year, kind, sys, text, good }
    this.projects = []; // 資材の搬入を待つ建設 { id, type, sys, start, ready, from: [搬出元の星系], label, ... }
    this.flow = {}; // 直近の星系ごとの生産・需要[年あたり] (保存しない)
    this.pc = PC_START; // 政治力 (地球の意志)
    this.pcLast = 0; // 直近1年の政治力の増減 (表示用)
    this.council = COUNCIL_START; // 地球議会の支持
    this.policy = null; // 国家方針 { id, since, prev }
    this.decisions = []; // 決めること (要求・出来事) { id, kind, type, sys, year, seen, deadline, text, opts, def, state, reply }
    this.story = { last: START_YEAR, phase: 'on', phaseEnd: START_YEAR + 15 }; // 語り手: 最後の出来事の年、押す時期 (on) と休む時期 (off)
    this.era = null; // 時代の課題 { n, tasks: [{ id, label, target, check, deadline, base, status }], bonus }
    this.challenges = []; // 挑戦 [{ id, status: 'active'|'done'|'failed', at }]
    this.endYear = START_YEAR + 500; // 終わりの年 (null なら終わらない)
    this.ended = false;
    this.stats = { indepFromEarth: 0, tasksDone: 0, subjugated: 0, integrated: 0 };
    this.addColony(0, 'earth', 'planet', '地球', 10000);
    Object.assign(this.colonies[0].lv, { mine: 1, factory: 2, shipyard: 1, barracks: 1 });
    this.colonies[0].troops = 3;
    Object.assign(this.stock[0], { food: 5000, water: 1000, metal: 3000, fuel: 2000, rare: 300, goods: 2000 });
    this.message('ゲーム開始。地球から恒星間入植を進めよう。');
    for (const f of SAVE_FIELDS) if (f.init) f.init(this); // 仕組みごとに登録したセーブの項目の初期値 (core/base.js の saveField)
  }

  system(id) { return this.galaxy.systems[id]; }

  // --- 国 (国家選択) ---
  nationOf(root) { return this.nations ? this.nationMap().get(root) || null : null; }
  nationMap() { if (!this.nmap || this.nmap.src !== this.nations) this.nmap = { src: this.nations, m: new Map((this.nations || []).map((n) => [n.cap, n])) }; return this.nmap.m; }
  speciesOfRealm(root) { return this.nationOf(root)?.species || HUMAN; }
  // その星系の国の種族の特性の倍率 (国家選択のない試合では特性なし)
  modsOf(sys) {
    if (!this.nations) return noMods();
    const n = this.nationOf(this.realmOf(sys));
    return n ? (n.mods ??= traitMods(n.traits)) : noMods();
  }
  isHome(sys, body) { return this.nations ? this.nations.some((n) => n.cap === sys && n.body === body) : sys === 0 && body === 'earth'; }
  // 開始時に宇宙へ出ている国を作る: 地球 (人類) と、異星の種族の母星 count−1 か国。
  // 母星は、住みやすい岩石惑星から重みつきのくじで選ぶ (同じシードなら同じ)
  foundNations(count, handicap = 'normal', customs = []) { this.applyNations(this.planNations(count, customs), handicap); }
  // customs = ホーム画面の「国家づくり」で作った国 ({ name, species, traits, env, dist })。先に置き、残りをくじで埋める
  planNations(count, customs = []) {
    // size = 開始の大きさ (回 SE8・QD-111 = c。nationSizeOf)。種族の名前から別のくじで引く (国の置き場所のくじを変えないように)
    const sizeOf = (species, cu) => (cu && Number.isFinite(cu.size) ? cu.size : nationSizeOf(new Rng(hashSeed(`${this.galaxy.seed}/size/${species}`)).next()));
    const list = [{ cap: 0, body: 'earth', species: HUMAN, traits: HUMAN_TRAITS, name: '地球の国', size: sizeOf(HUMAN) }];
    const rng = new Rng(hashSeed(`${this.galaxy.seed}/nations`));
    // 候補: 太陽系から 10 光年より遠い、住みやすい岩石惑星 (銀河のどこでも)。
    // 文明の進んだ先住民の星や住みやすい星ほど選ばれやすいが、選ぶのは重みつきのくじ (毎回ちがう配置になる)
    const cands = [];
    for (const sys of this.galaxy.systems) {
      if (sys.id === 0 || this.sysDist(0, sys.id) < 10) continue;
      for (const b of sys.bodies) {
        const nat = b.natives || b.nativesSpare;
        if (b.type !== 'rocky' || (b.settle?.grade || 0) < 2) continue;
        cands.push({ sys: sys.id, body: b, d: this.sysDist(0, sys.id), w: (nat ? 2 + nat.tech : 1) * b.settle.grade });
      }
    }
    const draw = (ok) => {
      // ほかの国の首都から 12 光年以上 (候補がなければ 8 光年以上) 離れた候補から引く
      for (const gap of [12, 8]) {
        const pool = cands.filter((c) => ok(c) && list.every((n) => this.sysDist(n.cap, c.sys) >= gap));
        if (!pool.length) continue;
        let r = rng.next() * pool.reduce((t, c) => t + c.w, 0);
        return pool.find((c) => (r -= c.w) <= 0) || pool[pool.length - 1];
      }
      return null;
    };
    const used = new Set([HUMAN, ...customs.map((c) => c.species)]);
    for (let k = 1; k < count && cands.length; k++) {
      const cu = customs[k - 1];
      let pick;
      if (cu) {
        const [d0, d1] = HOME_DIST_RANGE[cu.dist] || HOME_DIST_RANGE.any;
        const env = (c) => !cu.env || cu.env === 'any' || c.body.surface === cu.env;
        const dist = (c) => c.d >= d0 && c.d < d1;
        pick = draw((c) => env(c) && dist(c)) || draw(env) || draw(dist) || draw(() => true); // 好みに合う星がなければ、条件をゆるめる
      } else pick = draw(() => true);
      if (!pick) break;
      const { sys, body } = pick;
      let species, traits, name;
      if (cu) ({ species, traits, name } = cu);
      else {
        const nat = body.natives || body.nativesSpare;
        species = nat && !used.has(nat.species) ? nat.species : '';
        while (!species || used.has(species)) species = JA`${rng.pick(KANA_A)}${rng.pick(KANA_B)}人`;
        traits = speciesTraits(species);
        name = nationName(species, traits, rng);
      }
      used.add(species);
      list.push({ cap: sys, body: body.id, species, traits: [...traits], name, size: sizeOf(species, cu) });
      cands.splice(0, cands.length, ...cands.filter((c) => c.sys !== sys));
    }
    return list;
  }
  // 国の一覧 (国家選択の画面で手を加えたものでもよい) から、開始時の国を置く
  applyNations(defs, handicap = 'normal') {
    this.handicap = HANDICAP[handicap] ? handicap : 'normal';
    this.nations = defs.map(({ mods, ...n }) => ({ ...n, traits: [...n.traits] }));
    for (const n of this.nations) {
      if (n.cap === 0) continue;
      const b = this.target(n.cap, n.body);
      if (b.natives) { this.natives[`${n.cap}|${n.body}`] = { rel: 100, status: 'integrated', pop: 0 }; } // 先住民がそのまま国になる
      this.govs[n.cap] = { lord: null, independent: true, credits: START_CREDITS, founded: START_YEAR, loyalty: LOYALTY_START };
      this.addColony(n.cap, n.body, 'planet', b.name, 10000, null, n.species);
      const c = this.colonies[this.colonies.length - 1];
      Object.assign(c.lv, { mine: 1, factory: 2, shipyard: 1, barracks: 1 });
      c.troops = 3;
      Object.assign(this.stockOf(n.cap), { food: 5000, water: 1000, metal: 3000, fuel: 2000, rare: 300, goods: 2000 });
      this.garrison[n.cap] = 3;
    }
    this.nmap = null;
    for (const n of this.nations) this.applyNationSize(n);
    this.applyHomeworlds();
    this.addAiSeats();
  }
  // 開始の大きさ (回 SE8・B-029・QD-111 = c。docs/nations.md): 人口・艦隊・兵・資金・備蓄を size に合わせる。母星の人口は上限 (12,000) があるので標準の 1.15 倍まで、
  // それより大きな国は、近くの住める惑星に入植地を足して持つ (size が 0.5 増えるごとに 1 星系。入植地の人口は上限の 6 割まで)。艦隊と兵は size の 0.958 乗、資金は 1.135 乗
  // (COW の国力の指標の、軍の人員と軍事費の人口への傾き)。size = 1 なら前と同じ
  applyNationSize(n) {
    const r = n.size ?? 1;
    if (Math.abs(r - 1) < 1e-9) return;
    const home = this.colonies.find((c) => c.sys === n.cap && c.body === n.body), army = GM.pow(r, NATION_SIZE.army);
    if (!home) return;
    const base = home.pop, hp = base * Math.min(r, 1.15);
    home.pop = hp;
    if (home.age) { const k = hp / base; for (const a of ['m', 'f']) home.age[a] = home.age[a].map((x) => x * k); }
    home.troops = Math.max(1, Math.round(3 * army));
    this.garrison[n.cap] = Math.max(1, Math.round(3 * army));
    this.gov(n.cap).credits = START_CREDITS * GM.pow(r, NATION_SIZE.money);
    const st = this.stockOf(n.cap);
    for (const k of Object.keys(st)) st[k] *= r;
    const extra = r > 1.15 ? Math.floor((r - 1) / 0.5) : 0;
    if (!extra) return;
    let rest = base * (r - Math.min(r, 1.15));
    const taken = new Set(this.nations.map((m) => m.cap));
    const spots = this.galaxy.systems.filter((s) => !taken.has(s.id) && !this.isColonized(s.id) && this.sysDist(n.cap, s.id) <= 12)
      .flatMap((s) => s.bodies.filter((b) => b.type === 'rocky' && (b.settle?.grade || 0) >= 2 && !b.natives && !this.blockedByNatives(s.id, b.id)).map((b) => ({ s, b, d: this.sysDist(n.cap, s.id) })))
      .sort((a, c) => (c.b.settle.grade - a.b.settle.grade) || (a.d - c.d));
    const used = new Set();
    for (const { s, b } of spots) {
      if (used.size >= extra || rest <= 0 || used.has(s.id)) continue;
      used.add(s.id);
      const pop = Math.min(rest / (extra - used.size + 1), 0.6 * [80, 80, 800, 4000][b.settle.grade]);
      this.addColony(s.id, b.id, 'planet', b.name, pop, n.cap, n.species);
      this.govs[s.id].founded = START_YEAR;
      rest -= pop;
    }
  }
  // 母星の資源の埋蔵は地球と同じにする (地球は特別に燃料を持つ。母星が燃料を持たないと工業が動かない)。
  // 銀河は読み込みのたびにシードから作り直すので、読み込み時にもかける
  applyHomeworlds() {
    for (const n of this.nations || []) {
      if (n.cap === 0) continue;
      const b = this.target(n.cap, n.body);
      const base = { water: 0.5, metal: 1, fuel: 0.4, rare: 0.15 };
      b.deposits = Object.fromEntries(Object.keys({ ...base, ...b.deposits }).map((k) => [k, Math.max(base[k] || 0, b.deposits?.[k] || 0)]));
    }
  }
  // プレイヤー (1 人目) の国を決める。地球でなければ地球は AI の国になる
  setPlayerNation(cap) { return this.setPlayers([cap]); }
  // 人間が動かす国を決める (ホットシート・ネット対戦では複数)。どのプレイヤーも 1 人目の初期値 (挑戦など) を写して始める
  setPlayers(caps) {
    if (!caps.length || caps.some((c) => !this.nationOf(c))) return fail('国がない');
    const base = JSON.parse(JSON.stringify(this.players[0]));
    this.players = caps.map((cap) => ({ ...JSON.parse(JSON.stringify(base)), cap, human: true }));
    this.pi = 0;
    for (const n of this.nations) this.gov(n.cap).independent = true; // どの国の首都も独立国 (人間が動かす国も含めて)
    this.addAiSeats();
    this.live = null; this.ksCache = null;
    return { ok: true };
  }
  humans() { return this.players.filter((p) => p.human); }
  // 国家選択の国のうち席のない国に、AI が動かす席を足す (2026-10-28 のユーザーの依頼「AI 国家にも、恐怖度や政治力などの、人間国家が持つすべての機能を」。回 SE5)。
  // 席の値の始めは、新しい試合のプレイヤーと同じ (挑戦は持たない。財政は AI の財政 aiFiscal のまま)。年ごとの政治と威圧は、観戦モードと同じ AI が動かす (politicsYearly)
  addAiSeats() {
    for (const n of this.nations || []) {
      if (this.players.some((p) => p.cap === n.cap)) continue;
      this.players.push({ cap: n.cap, human: false, ai: true, pc: PC_START, pcLast: 0, council: COUNCIL_START, policy: null, decisions: [], story: { last: this.year, phase: 'on', phaseEnd: this.year + 15 },
        era: null, challenges: [], stats: { indepFromEarth: 0, tasksDone: 0, subjugated: 0, integrated: 0 }, acked: [], autoBuild: true, autoGrant: true, autoDefense: false, autoAwe: true,
        autoHabitat: true, autoRoutes: true, migration: true, warThreshold: 40 });
    }
  }
  // 25 光年以内の星系と距離の一覧 (番号の小さい順)。星系は動かないので銀河ごとに一度だけ作る (入植先探しの範囲は最大 25 光年)
  nearSystems(id) {
    let m = NEAR_SYS.get(this.galaxy);
    if (!m) { m = new Map(); NEAR_SYS.set(this.galaxy, m); }
    let list = m.get(id);
    if (!list) {
      list = [];
      for (const t of this.galaxy.systems) { const d = this.sysDist(t.id, id); if (d <= 25) list.push([t.id, d]); }
      m.set(id, list);
    }
    return list;
  }
  // 星系どうしの距離。銀河ごとの表に覚えておき、2回目からは引くだけにする (値は distance() とまったく同じ)
  sysDist(a, b) {
    const n = this.galaxy.systems.length;
    let D = SYS_DIST.get(this.galaxy);
    if (!D) { D = new Float64Array(n * n).fill(NaN); SYS_DIST.set(this.galaxy, D); }
    let d = D[a * n + b];
    if (d !== d) { d = distance(this.galaxy.systems[a], this.galaxy.systems[b]); D[a * n + b] = D[b * n + a] = d; }
    return d;
  }

  // 星系内の入植対象: 惑星・小惑星帯・恒星
  targetsOf(sys) { return [...sys.bodies, ...sys.stars]; }
  // 天体・恒星を番号で引く (星系ごとに索引を作って使い回す。天体の一覧は銀河を作ったあと変わらない)
  target(sysId, bodyId) {
    const sys = this.system(sysId);
    const n = sys.bodies.length + sys.stars.length;
    let ix = TARGET_INDEX.get(sys);
    if (!ix || ix.n !== n) {
      ix = { n, map: new Map() };
      for (const b of this.targetsOf(sys)) if (!ix.map.has(b.id)) ix.map.set(b.id, b);
      TARGET_INDEX.set(sys, ix);
    }
    return ix.map.get(bodyId);
  }

  // 入植地の索引 (星系ごとの入植地・キーから入植地)。入植地の一覧は push か丸ごとの置き換えでしか変わらず、
  // 入植地の星系・天体・種類も変わらないので、一覧と件数が同じあいだは使い回す
  colIndex() {
    const list = this.colonies;
    if (this.colIdx?.list !== list || this.colIdx.n !== list.length) {
      const bySys = new Map();
      const byKey = new Map();
      for (const c of list) {
        if (!bySys.has(c.sys)) bySys.set(c.sys, []);
        bySys.get(c.sys).push(c);
        const k = colKey(c);
        if (!byKey.has(k)) byKey.set(k, c);
      }
      this.colIdx = { list, n: list.length, bySys, byKey };
    }
    return this.colIdx;
  }
  coloniesIn(sysId) { return this.colIndex().bySys.get(sysId)?.slice() ?? []; } // 呼び出し側が並べ替えてもよいように写しを返す
  colonyAt(sysId, bodyId, kind) { return this.colIndex().byKey.get(`${sysId}|${bodyId}|${kind}`); }
  colonyByKey(key) { return this.colIndex().byKey.get(key); }
  isColonized(sysId) { return this.colIndex().bySys.has(sysId); }
  colonizedSystems() { const ix = this.colIndex(); return (ix.systems ??= [...ix.bySys.keys()].map((i) => this.system(i))).slice(); } // 索引の星系は入植地の並び順 (前と同じ順)
  shipTo(sysId, bodyId, kind) {
    return this.ships.find((s) => s.to === sysId && s.body === bodyId && s.kind === kind);
  }
  stockOf(sysId) {
    if (!this.stock[sysId]) this.stock[sysId] = zeroRes();
    return this.stock[sysId];
  }
  // 備蓄の出入りはすべてここを通す (kind: extract = 採掘・収穫など自然から、make = 工業の産出、use = 工業の投入、burn = 燃やした燃料、
  // consume = 人の消費、build = 建設に使った、ship / arrive = 船で出した・着いた、supply = 艦隊の補給、waste = 捨てた、pirate = 海賊に奪われた)。試験で保存則を確かめる (目標 R03)
  mv(sysId, res, amt, kind) {
    this.stockOf(sysId)[res] += amt;
    if (amt < 0 && ABSORB.has(kind)) { const a = (this.absorb[sysId] ??= zeroRes()); a[res] -= amt; }
    if (MASS_AUDIT) { const f = (MASS_AUDIT.flows[sysId] ??= {}); const g = (f[res] ??= {}); g[kind] = (g[kind] || 0) + amt; }
  }
  totalPop() { return this.colonies.reduce((s, c) => s + c.pop, 0); }
  warships() { return Object.values(this.garrison).reduce((s, n) => s + n, 0) + this.fleets.reduce((s, f) => s + f.n, 0); }
  // プレイヤーの文脈: 席 (players) = 政治力・議会・国家方針・決めること・威圧などを持つ国。人間が動かす席 (human) と、AI が動かす席 (国家選択の国。addAiSeats) がある。
  // isHuman = 人間が動かす国の首都か。isSeat = 席を持つ国の首都か。asPlayer = i 番目の席として fn を実行する
  // (this.pc・this.cap などがその席を指す)。asRealm = 国 root の席として (なければ何もしない)。eachPlayer = 人間の席ごと、eachSeat = すべての席ごと
  homeName() { return this.cap === 0 ? '地球' : this.nationOf(this.cap)?.species || this.system(this.cap).name; }
  isHuman(cap) { return this.players.some((p) => p.human && p.cap === cap); }
  isSeat(cap) { return this.players.some((p) => p.cap === cap); }
  playerOf(cap) { return this.players.findIndex((p) => p.cap === cap); }
  asPlayer(i, fn) { const old = this.pi; this.pi = i; try { return fn(); } finally { this.pi = old; } }
  asRealm(root, fn) { const i = this.playerOf(root); return i < 0 ? undefined : this.asPlayer(i, fn); }
  eachPlayer(fn) { this.players.forEach((p, i) => { if (p.human) this.asPlayer(i, fn); }); }
  eachSeat(fn) { this.players.forEach((p, i) => this.asPlayer(i, fn)); }
  aiSeat() { return !this.players[this.pi]?.human; } // いまの席を AI が動かしているか (観戦モードは別。知らせはその席だけに見せる)
  // いま操作しているプレイヤーの政府の資金と収支
  get credits() { return this.gov(this.cap).credits; }
  set credits(v) { this.gov(this.cap).credits = v; }
  get ledger() { return this.gov(this.cap).ledger || {}; }
  income(id = this.cap) { return Object.values(this.gov(id).ledger || {}).reduce((s, v) => s + v, 0); }
  gov(id) {
    if (!this.govs[id]) this.govs[id] = { lord: 0, credits: 0, founded: this.year };
    return this.govs[id];
  }
  // 従属の連鎖 (自分 → 主人 → その主人 …)
  lordChain(id) {
    const out = [];
    for (let g = this.govs[id]; g && g.lord !== null && g.lord !== undefined && !out.includes(g.lord); g = this.govs[g.lord]) out.push(g.lord);
    return out;
  }
  vassalsOf(id) { return Object.keys(this.govs).map(Number).filter((k) => this.govs[k].lord === id); }
  // 国 = 従属の連鎖の頂点 (首都の星系)。地球の国は 0
  realmOf(id) {
    // 速い道 (回 KE13): 主人をたどるのに Set を作らない (交易の計算で何十万回も呼ばれる)。64 段で終わらなければ、輪になっているかもしれないので、前の Set の道で同じ答えを出す
    let cur = id;
    for (let i = 0; i < 64; i++) { const gv = this.govs[cur]; if (!gv || gv.lord === null || gv.lord === undefined) return cur; cur = gv.lord; }
    cur = id;
    const seen = new Set();
    while (this.govs[cur] && this.govs[cur].lord !== null && this.govs[cur].lord !== undefined && !seen.has(cur)) { seen.add(cur); cur = this.govs[cur].lord; }
    return cur;
  }
  // 星系に駐留する艦隊の持ち主の国 (入植星系ならその国、入植していない星系なら stackOwner)
  // いま操作しているプレイヤーから見て、その星系の艦隊が自国のものか (届いている情報で)
  ownStackKnown(id) {
    if (id === this.cap) return true;
    const k = this.known(id);
    return (k?.cols.length ? k.realm ?? this.cap : k?.stack ?? 0) === this.cap;
  }
  stackRealm(id) { return this.isColonized(id) ? this.realmOf(id) : this.stackOwner[id] ?? 0; }
  setStackOwner(id, realm) { if (realm) this.stackOwner[id] = realm; else delete this.stackOwner[id]; }
  realmSystems(root) { return this.colonizedSystems().filter((x) => this.realmOf(x.id) === root); }
  // 星系 x の政府が、相手の星系 other の国と交戦中だと知っているか (開戦の知らせが光速で x に届いたか)。交易をやめるのはそれから
  // 終戦後も、終戦の知らせが光速で x に届くまでは取引をやめたまま
  tradeBlocked(x, other) { return this.tradeBlockedIn(x, this.realmOf(x), this.realmOf(other)); }
  // a, b = x と相手の国 (首都)。何度も調べるときに国を先に求めておけるように分けてある
  tradeBlockedIn(x, a, b) {
    if (!this.atWar(a, b)) {
      const rec = this.lastPeace(this.warKey(a, b));
      return !!rec && this.year < rec.year + this.sysDist(rec.from, x);
    }
    const news = this.warNews[this.warKey(a, b)];
    return !news || this.year >= news.year + this.sysDist(news.from, x);
  }
