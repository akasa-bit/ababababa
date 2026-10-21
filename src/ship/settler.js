  // 国家方針が拡張期なら、船の費用 (開拓資金を除く) が25%安い
  // エネルギーは、船の構造 (工業品)・積む食料と水・乗る人の質量を、加速はレーザー、減速は磁気帆と反物質で運ぶ分 (同じ星系の中なら要らない)
  shipCost(kind, fromId, toId) {
    const f = this.policyAt(fromId) === 'expand' ? 0.75 : 1;
    const sup = this.shipSupplies(kind, fromId, toId);
    const cost = { ...SHIP_COST[kind], credits: Math.round(SHIP_COST[kind].credits * f) + SEED_FUNDS[kind], ...sup };
    const fl = this.settlerFlight(kind, fromId, toId, sup);
    if (fl && SIM_ONLY) cost.energy = this.bookPath('settler', fl.m, fl.path, 'free', { book: false });
    else if (fl) {
      const sh = shieldOf('settler', fl.m, fl.beta, fl.ly ?? 0, this.physics);
      const p = propulsion(fl.m + sh.kg, fl.beta, 'free');
      cost.energy = p.acc + p.dec;
      if (sh.kg > 0) cost.shield = sh.kg / fl.m; // 遮蔽 ÷ 船の質量 (費用の内訳に 1 行で出す。資材ではないので procure は見ない)
    }
    return cost;
  }
  // 入植船の質量 [kg] と速さ [c]。交易路を通るなら 0.95c まで出す
  settlerFlight(kind, fromId, toId, sup = this.shipSupplies(kind, fromId, toId)) {
    if (fromId === toId) return null;
    const m = SHIP_COST[kind].goods * RES_KG.goods + sup.food * RES_KG.food + sup.water * RES_KG.water + SETTLERS[kind] * 1e6 * PERSON_KG;
    const path = this.voyage(fromId, toId, OFFROUTE_SPEED).path;
    return { m, beta: path.length > 2 ? SHIP_SPEED : OFFROUTE_SPEED, ly: this.sysDist(fromId, toId), ...(SIM_ONLY ? { path } : {}) };
  }
  launch(fromId, toId, bodyId, kind, supplies = {}, job = null) {
    // 出発地の星系に駐留する歩兵から同行させる (奴隷兵は後回し)
    let want = this.escortNeed(toId, bodyId, kind);
    const escort = { troops: 0, slave: 0 };
    for (const c of this.coloniesIn(fromId)) { const k = Math.min(want, c.troops); c.troops -= k; escort.troops += k; want -= k; }
    for (const c of this.coloniesIn(fromId)) { const k = Math.min(want, c.slaveTroops); c.slaveTroops -= k; escort.slave += k; want -= k; }
    const v = this.voyage(fromId, toId, OFFROUTE_SPEED);
    const years = v.years;
    if (escort.troops + escort.slave && fromId !== toId) {
      if (SIM_ONLY) this.bookPath('troop', (escort.troops + escort.slave) * TROOP_KG, v.path, 'free', { payer: fromId });
      else this.bookShip('troop', (escort.troops + escort.slave) * TROOP_KG, v.path.length > 2 ? SHIP_SPEED : OFFROUTE_SPEED, 'free', fromId, fromId, this.sysDist(fromId, toId));
    }
    const ship = {
      id: this.nextShipId++, from: fromId, to: toId, body: bodyId, kind,
      path: v.path, times: v.times.map((t) => this.year + t), supplies, escort,
      depart: this.year, arrive: this.year + years,
    };
    this.ships.push(ship);
    if (job?.seed) { const v = job.seed; this.cash('build', -v, { way: job, f: 'seed' }); this.cash('build', v, { way: ship, f: 'seed' }); }
    this.message(`${this.system(fromId).name} → ${this.system(toId).name} へ入植船が出発 (${KIND_LABEL[kind]}、${v.path.length > 2 ? `交易路経由、` : ''}到着まで ${years.toFixed(2)} 年${escort.troops + escort.slave ? `、歩兵 ${escort.troops + escort.slave} 連隊が同行` : ''})`, fromId);
    return { ok: true, ship };
  }

