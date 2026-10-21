  addColony(sysId, bodyId, kind, name, pop = SETTLERS[kind], lord = 0, species = this.speciesOfRealm(this.realmOf(lord))) {
    // 新しく入植した星系には政府ができ、入植船を送った星系に従属する
    const fresh = !this.isColonized(sysId);
    if (!this.govs[sysId]) {
      this.govs[sysId] = { lord: sysId === 0 ? null : lord, credits: 0, founded: this.year, loyalty: LOYALTY_START };
      const reg = sysId === 0 ? BASE_REGIME : this.defaultRegime(this.realmOf(lord), sysId);
      if (reg !== BASE_REGIME) this.govs[sysId].regime = reg;
    }
    this.colonies.push({
      sys: sysId, body: bodyId, kind, founded: this.year, name, pop, focus: 'balanced',
      lv: LV0(), troops: 0, slaveTroops: 0, races: { [species]: 1 },
    });
    // 入植船が種のスウォームを持ちこむ (母星は 2300 年の割合から)
    if (fresh) this.govs[sysId].sw = this.isHome(sysId) ? [SWARM.home, START_YEAR] : [SWARM.seed, this.year];
    this.stockOf(sysId);
    this.survey(sysId);
  }

  // 国家方針が整備期なら、建設費 (資金) が25%安い
  upgradeCost(c, fac) {
    const k = GM.pow(2, c.lv[fac]);
    const f = this.policyAt(c.sys) === 'consolidate' ? 0.75 : 1;
    return { credits: Math.round((100 + 0.05 * c.pop) * k * f), metal: Math.round(50 * k) };
  }
  upgrade(c, fac) {
    if (c.lv[fac] >= FACILITY_MAX[fac]) return fail('最大レベル');
    const col = colKey(c);
    if (this.pending((j) => j.type === 'upgrade' && j.col === col && j.fac === fac)) return fail('建設中');
    return this.order(this.upgradeCost(c, fac), c.sys, { type: 'upgrade', col, fac, label: `${c.name} の${FACILITY[fac]} Lv${c.lv[fac] + 1}` });
  }

  // --- 交易路 ---
  // 2つの星系を結ぶ交易路 (最初に見つかるもの)。交易路は追加か丸ごとの置き換えでしか変わらないので、
  // 交易路の数と最後の番号が同じあいだは索引を使い回す
  routeBetween(a, b) {
    const sig = `${this.routes.length}:${this.routes[this.routes.length - 1]?.id}`;
    if (this.routeIx?.sig !== sig || this.routeIx.list !== this.routes) {
      const map = new Map();
      for (const r of this.routes) {
        if (typeof r.a !== 'number' || typeof r.b !== 'number') continue;
        const k1 = r.a * 65536 + r.b, k2 = r.b * 65536 + r.a;
        if (!map.has(k1)) map.set(k1, r);
        if (!map.has(k2)) map.set(k2, r);
      }
      this.routeIx = { sig, list: this.routes, map };
    }
    if (typeof a !== 'number' || typeof b !== 'number') return this.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
    return this.routeIx.map.get(a * 65536 + b);
  }
  routeCap(r) { return 200 * r.lv; } // 片道あたりの輸送量[単位/年]
  routeCost(a, b) { return { credits: Math.round(100 + 10 * this.sysDist(a, b)) }; }
  routeUpCost(r) { return { credits: 150 * r.lv, metal: 50 * r.lv }; }
  openRoute(a, b) {
    if (a === b || !this.isColonized(a) || !this.isColonized(b)) return fail('両端に入植地が必要');
    if (this.routeBetween(a, b)) return fail('開設済み');
    // 交戦中の国の星系とは新しく結べない (a が開戦の知らせを受け取ってから。既存の交易路は残る)
    if (this.realmOf(a) !== this.realmOf(b) && this.tradeBlocked(a, b)) return fail('交戦中の国とは交易路を結べない');
    const paid = this.pay(this.routeCost(a, b), undefined, a);
    if (!paid.ok) return paid;
    this.routes.push({ id: this.nextShipId++, a, b, lv: 1, transit: [zeroRes(), zeroRes()], vol: [0, 0], built: this.year, by: a });
    this.message(`${this.system(a).name} ⇄ ${this.system(b).name} の交易路を開設した`, a);
    return { ok: true };
  }
  upgradeRoute(r, tag = '') {
    if (this.pending((j) => j.type === 'route' && j.route === r.id)) return fail('拡張中');
    return this.order(this.routeUpCost(r), r.a, { type: 'route', route: r.id, label: `${tag}${this.system(r.a).name} ⇄ ${this.system(r.b).name} の交易路 Lv${r.lv + 1}` });
  }
  routeUse(r) { return Math.max(r.vol[0], r.vol[1]) / this.routeCap(r); }
  // 交易路の混雑 (年1回): 片道の輸送量が容量の9割を超えたら知らせ、端の星系 (r.a) の政府が自動で拡張する。
  // 太陽系と直轄の星系の交易路は「交易路の自動拡張」がオンのときだけ。資金が費用の1.5倍以上あり、資材が手に入るとき。
  // 知らせは混み始めたときに1回 (8割を下回ったら数え直す)、地球の国の星系がかかわる交易路だけ
  routesYearly() {
    for (const r of this.routes) {
      const use = this.routeUse(r);
      if (use < 0.8) { r.hot = false; continue; }
      if (use < 0.9) continue;
      if (!r.hot) {
        r.hot = true;
        if (this.isHuman(this.realmOf(r.a)) || this.isHuman(this.realmOf(r.b))) this.event('trade', r.a, `${this.system(r.a).name} ⇄ ${this.system(r.b).name} の交易路が混んでいる (容量の ${pct(use)})`);
      }
      const gv = this.gov(r.a);
      const owner = this.players[this.playerOf(this.realmOf(r.a))];
      if (owner && ((this.isHuman(r.a) && !this.spectate) || gv.direct) ? !owner.autoRoutes : false) continue;
      if (this.pending((j) => j.type === 'route' && j.route === r.id)) continue;
      const cost = this.routeUpCost(r);
      if (this.funds(r.a) < 1.5 * cost.credits || this.procure(cost, r.a).why) continue;
      this.upgradeRoute(r, '[自動] ');
    }
  }

