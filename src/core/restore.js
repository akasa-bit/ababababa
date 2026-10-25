  // セーブデータの復元。壊れたデータなら false を返す。古い形式(人口や経済がない)は既定値で補う。
  restore(d) {
    const ok = (sysId, bodyId) => this.galaxy.systems[sysId] && this.target(sysId, bodyId);
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
    const sysOk = (id) => !!this.galaxy.systems[id];
    if (!Array.isArray(d.colonies) || !Array.isArray(d.ships) || !Number.isFinite(d.year)) return false;
    if (!d.colonies.every((c) => ok(c.sys, c.body)) || !d.ships.every((s) => ok(s.to, s.body) && this.galaxy.systems[s.from])) return false;
    this.year = d.year;
    // 物理の切り替え (2026-10-21 から)。ないセーブ (物理を入れる前) は物理なしのまま続ける。flare は銀河を作るときに効くので版の値のまま
    this.physics = obj(d.physics) ? { ...PHYSICS_OFF, ...d.physics, flare: ED.physics.flare } : { ...PHYSICS_OFF, flare: ED.physics.flare };
    this.colonies = d.colonies;
    this.ships = d.ships;
    this.log = Array.isArray(d.log) ? d.log : [];
    this.nextShipId = d.nextShipId || 1;
    for (const c of this.colonies) {
      const earth = c.sys === 0 && c.body === 'earth' && c.kind === 'planet';
      if (!Number.isFinite(c.pop)) c.pop = earth ? 10000 : SETTLERS[c.kind];
      if (!FOCUS[c.focus]) c.focus = 'balanced';
      if (c.sh && !Number.isFinite(c.sh.home)) c.sh.home = 0; // 自給の部門 (前の版のセーブ)
      if (!obj(c.lv)) c.lv = earth ? { mine: 1, factory: 2, shipyard: 1 } : {};
      c.lv = { ...LV0(), ...c.lv };
      if (!Number.isFinite(c.troops)) c.troops = 0;
      if (!Number.isFinite(c.slaveTroops)) c.slaveTroops = 0;
      if (!obj(c.races)) c.races = { [HUMAN]: 1 };
    }
    if (obj(d.govs)) {
      this.govs = {};
      for (const [k, v] of Object.entries(d.govs)) if (sysOk(Number(k)) && obj(v)) this.govs[k] = v;
      for (const v of Object.values(this.govs)) if (v.pv !== undefined) { v.hh = (v.hh || 0) + v.pv; delete v.pv; } // 前の版の「民間」は家計に (借りは会社の借りのまま)
      // 前の版の収支の項目 (余剰の売却 export など) は消す (収入の合計に入らないように)
      for (const v of Object.values(this.govs)) if (obj(v.ledger)) for (const k of Object.keys(v.ledger)) if (!LEDGER_LABEL[k]) delete v.ledger[k];
    } else if (Number.isFinite(d.credits)) this.credits = d.credits;
    // 旧セーブの入植星系は地球 (太陽系) に従属させる
    for (const c of this.colonies) if (!this.govs[c.sys]) this.govs[c.sys] = { lord: c.sys === 0 ? null : 0, credits: 0, founded: c.founded ?? this.year };
    this.govs[0].lord = null;
    if (obj(d.snaps)) this.snaps = d.snaps;
    if (obj(d.realmWars)) this.realmWars = d.realmWars;
    if (obj(d.exhaustion)) this.exhaustion = d.exhaustion;
    if (obj(d.tech)) this.tech = d.tech;
    if (obj(d.aif)) this.aif = d.aif;
    if (Number.isFinite(d.alpha) && d.alpha > 0) this.alpha = d.alpha;
    if (Array.isArray(d.gpts)) this.gpts = d.gpts; // 汎用技術 (GPT。回 KE6)
    if (obj(d.warStats)) this.warStats = d.warStats;
    if (Array.isArray(d.peaceOffers)) this.peaceOffers = d.peaceOffers.filter((o) => o && typeof o.key === 'string');
    if (Array.isArray(d.conferences)) this.conferences = d.conferences.filter((c) => c && sysOk(c.loser) && Array.isArray(c.bids));
    if (obj(d.warBy)) this.warBy = d.warBy;
    if (obj(d.warNews)) this.warNews = d.warNews;
    if (obj(d.intel)) this.intel = d.intel;
    if (obj(d.shipHist)) this.shipHist = d.shipHist;
    if (Array.isArray(d.aiOrders)) this.aiOrders = d.aiOrders.filter((o) => o && sysOk(o.from) && sysOk(o.to));
    if (Array.isArray(d.peaces)) this.peaces = d.peaces.filter((x) => x && typeof x.key === 'string' && Number.isFinite(x.year));
    // 旧形式 (地球の国との戦争だけ。キーは独立国の首都、warBy は 'earth') を国の組のキーに直す
    for (const k of Object.keys(this.realmWars)) {
      if (k.includes('|')) continue;
      const key = this.warKey(0, Number(k));
      this.realmWars[key] = this.realmWars[k];
      this.warBy[key] = this.warBy[k] === 'earth' ? 0 : Number(k);
      if (this.warNews[k]) this.warNews[key] = this.warNews[k];
      delete this.realmWars[k]; delete this.warBy[k]; delete this.warNews[k];
    }
    if (obj(d.held)) this.held = d.held;
    // 着いたが、その知らせがまだプレイヤーに届いていない艦隊 (威圧の判断に使うので、セーブに含める)
    if (Array.isArray(d.ghostFleets)) this.ghosts.fleets = d.ghostFleets.filter((f) => f && sysOk(f.from) && sysOk(f.to) && Number.isFinite(f.until));
    if (obj(d.stackOwner)) this.stackOwner = Object.fromEntries(Object.entries(d.stackOwner).filter(([k, v]) => sysOk(Number(k)) && Number.isInteger(v)));
    if (obj(d.awe)) this.awe = d.awe;
    if (Array.isArray(d.sieges)) this.sieges = d.sieges.filter((g) => g && sysOk(g.sys));
    if (Array.isArray(d.battles)) this.battles = d.battles.filter((b) => b && sysOk(b.sys) && Number.isFinite(b.a) && Number.isFinite(b.d));
    // 記録のない星系 (旧セーブ) は、いまの様子が光の遅れぶん前に見えたものとして始める
    // (人間のプレイヤーの首都は記録しない。プレイヤーの一覧はこのあとで読むので、セーブの値を見る)
    const humanCaps = Array.isArray(d.players) && d.players.some((p) => p?.human && sysOk(p.cap)) ? d.players.filter((p) => p?.human).map((p) => p.cap) : [0];
    for (const sx of d.v >= 2 ? [] : this.colonizedSystems()) { // 新しいセーブには、記録のない星系はそのまま (読み込みで状態を変えない)
      if (humanCaps.every((c) => c === sx.id) || this.snaps[sx.id]?.length) continue;
      this.snaps[sx.id] = [{ ...this.snapshot(sx.id), year: this.year - this.lightDelay(sx.id) }];
    }
    if (obj(d.stock)) this.stock = { ...this.stock, ...d.stock };
    if (obj(d.market)) this.market = d.market;
    if (obj(d.absorb)) this.absorb = d.absorb; // 次の市場の刻みまでに溜まった需要と受注残
    if (obj(d.unmet)) this.unmet = d.unmet;
    if (obj(d.util)) this.util = d.util;
    for (const st of Object.values(this.stock)) for (const r of RES) if (!Number.isFinite(st[r])) st[r] = 0;
    for (const c of this.colonies) this.stockOf(c.sys);
    if (Array.isArray(d.routes)) this.routes = d.routes.filter((r) => sysOk(r.a) && sysOk(r.b) && Array.isArray(r.transit));
    if (Array.isArray(d.cargo)) {
      // 旧形式 (交易路1本ぶん) の貨物は経路つきに直す
      this.cargo = d.cargo.map((p) => {
        if (Array.isArray(p.path)) return p;
        const r = this.routes.find((x) => x.id === p.route);
        if (!r) return null;
        const path = p.dir ? [r.b, r.a] : [r.a, r.b];
        return { key: path.join('>'), path, times: [p.arrive - this.shipYears(r.a, r.b), p.arrive], arrive: p.arrive, load: p.load };
      }).filter((p) => p && p.path.every(sysOk) && Number.isFinite(p.arrive));
    }
    // 輸送中の量はセーブのものを使う (向かってくる荷の量 inbound は保存しないので、それだけ数え直す)
    const transit = this.routes.map((r) => r.transit);
    this.rebuildTransit();
    this.routes.forEach((r, i) => { if (Array.isArray(transit[i]) && transit[i].length === 2) r.transit = transit[i]; });
    if (obj(d.supplied)) this.supplied = d.supplied;
    if (obj(d.garrison)) this.garrison = d.garrison;
    if (Array.isArray(d.fleets)) this.fleets = d.fleets.filter((f) => sysOk(f.from) && sysOk(f.to));
    if (Array.isArray(d.outposts)) this.outposts = d.outposts.filter((o) => o && ok(o.sys, o.body) && o.lv >= 1);
    if (obj(d.auto)) this.auto = d.auto;
    if (Number.isFinite(d.autoTimer)) this.autoTimer = d.autoTimer;
    this.autoDefense = !!d.autoDefense;
    this.autoAwe = d.autoAwe ?? true;
    this.autoGrant = d.autoGrant === undefined ? true : !!d.autoGrant;
    if (typeof d.autoBuild === 'boolean') this.autoBuild = d.autoBuild;
    if (typeof d.migration === 'boolean') this.migration = d.migration;
    if (Number.isFinite(d.rs)) this.rs = d.rs >>> 0;
    // 国家選択のある試合の国とハンディキャップ
    this.handicap = HANDICAP[d.handicap] ? d.handicap : 'normal';
    this.productivity = Number.isFinite(d.productivity) && d.productivity > 0 ? d.productivity : 1;
    this.pvPolicy = PV_DESIGNS[d.pvPolicy] ? d.pvPolicy : null;
    this.pirateRaids = Array.isArray(d.pirateRaids) ? d.pirateRaids.filter((r) => r && sysOk(r.sys) && Number.isFinite(r.arrive)) : [];
    if (Array.isArray(d.nations) && d.nations.every((n) => n && sysOk(n.cap) && this.target(n.cap, n.body))) {
      this.nations = d.nations.map((n) => ({ ...n, traits: Array.isArray(n.traits) ? n.traits.filter((t) => SPECIES_TRAITS[t]) : speciesTraits(n.species) }));
      this.nmap = null;
      this.applyHomeworlds();
    }
    // プレイヤーの記録 (新しいセーブ)。古いセーブは上で読んだ値が players[0] に入っている
    if (Array.isArray(d.players) && d.players.length && d.players.every((p) => p && sysOk(p.cap))) {
      this.players = d.players;
      this.pi = Number.isInteger(d.pi) && d.pi >= 0 && d.pi < d.players.length ? d.pi : 0;
    }
    if (typeof d.autoRoutes === 'boolean') this.autoRoutes = d.autoRoutes;
    if (Array.isArray(d.wars)) this.wars = d.wars.filter((w) => w && ok(w.sys, w.body));
    if (Number.isFinite(d.warThreshold)) this.warThreshold = d.warThreshold;
    if (Array.isArray(d.troopMoves)) this.troopMoves = d.troopMoves.filter((m) => m && Array.isArray(m.path) && m.path.every(sysOk));
    if (typeof d.autoHabitat === 'boolean') this.autoHabitat = d.autoHabitat;
    this.spectate = !!d.spectate;
    if (Array.isArray(d.migrants)) this.migrants = d.migrants.filter((m) => m && sysOk(m.fromSys) && sysOk(m.toSys) && Number.isFinite(m.n));
    if (Array.isArray(d.migLog)) this.migLog = d.migLog;
    if (Array.isArray(d.requests)) this.requests = d.requests.filter((q) => q && sysOk(q.from) && sysOk(q.to) && Number.isFinite(q.arrive));
    if (Array.isArray(d.events)) this.events = d.events.filter((e) => e && typeof e.text === 'string');
    if (Array.isArray(d.projects)) this.projects = d.projects.filter((j) => j && sysOk(j.sys) && Number.isFinite(j.ready) && Array.isArray(j.from));
    if (obj(d.natives)) {
      for (const key of Object.keys(d.natives)) {
        const [sysStr, bodyId] = key.split('|');
        const b = this.target(Number(sysStr), bodyId);
        if (b && !b.natives && b.nativesSpare) b.natives = b.nativesSpare;
      }
      this.natives = d.natives;
      for (const st of Object.values(this.natives)) {
        if (st.status === 'livestock') { st.status = 'enslaved'; st.slave = 'livestock'; st.wasLivestock = true; }
        if (st.status === 'enslaved' && !SLAVE_TYPES[st.slave]) st.slave = 'market';
      }
    }
    if (Number.isFinite(d.infamy)) this.infamy = d.infamy;
    // 政治 (古いセーブにはない。そのときは、いまから始めたものとする)
    if (Number.isFinite(d.pc)) this.pc = d.pc;
    if (Number.isFinite(d.council)) this.council = d.council;
    if (obj(d.policy) && POLICIES[d.policy.id]) this.policy = d.policy;
    if (Array.isArray(d.decisions)) this.decisions = d.decisions.filter((x) => x && Array.isArray(x.opts) && sysOk(x.sys));
    this.story = obj(d.story) ? d.story : { last: this.year, phase: 'on', phaseEnd: this.year + 15 };
    if (obj(d.era) && Array.isArray(d.era.tasks)) this.era = d.era;
    if (Array.isArray(d.challenges)) this.challenges = d.challenges.filter((c) => c && CHALLENGES[c.id]);
    this.endYear = d.endYear === undefined ? Math.max(START_YEAR + 500, Math.ceil(this.year / 100) * 100 + 100) : d.endYear;
    this.ended = !!d.ended;
    if (Array.isArray(d.acked)) this.acked = d.acked.filter(Number.isFinite);
    this.endShown = !!d.endShown;
    if (obj(d.finalScore)) this.finalScore = d.finalScore;
    if (obj(d.stats)) this.stats = { ...this.stats, ...d.stats };
    // 古いセーブ (v1) の政府は、いま関与したものとして始める (いきなり「放っておかれた」にならないように)
    if (!(d.v >= 2)) for (const gv of Object.values(this.govs)) gv.attended ??= this.year;
    this.surveyed = Array.isArray(d.surveyed) ? d.surveyed.filter(sysOk) : [];
    for (const c of this.colonies) if (!this.contacted(c.sys)) this.surveyed.push(c.sys);
    for (const f of SAVE_FIELDS) if (f.read) f.read(this, d); // 仕組みごとに登録したセーブの項目 (core/base.js の saveField)
    return true;
  }

