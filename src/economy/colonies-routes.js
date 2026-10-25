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
    // 入植者は、送り出した星系のいちばん大きい入植地の、年齢の区分ごとの就学年数と学力を持って来る (よそ生まれ。回 KE5)。送り出した星系がなければ、所得の曲線で決める (schoolBy)
    const from = lord !== null && lord !== undefined && lord !== sysId ? this.coloniesIn(lord).reduce((m, x) => (!m || x.pop > m.pop ? x : m), null) : null;
    if (from) { const c = this.colonies[this.colonies.length - 1], e = this.eduAges(from); c.edu = { away: this.eduGroup(c, e.s, e.q) }; }
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
  // --- 輸送船 (SHIPPING。回 KE5) ---
  routeTrip(r) { return 2 * this.shipYears(r.a, r.b) + SHIPPING.port; } // 1 隻の往復の年数
  shipsFor(r, cap) { return (cap * this.routeTrip(r)) / SHIPPING.payload; } // 片道 cap [質量の単位/年] を運ぶのに要る船の数
  routeShips(r) { return r.ships ?? this.shipsFor(r, SHIPPING.base * r.lv); } // 前の版のセーブの交易路は、前の送れる量 (段 × 200) の分の船があるとみる
  portCap(r) { return SHIPPING.base * r.lv; } // 両端の発射所と減速設備の容量 [質量の単位/年、片道]。交易路の段 (政府が広げる) × base
  routeCap(r) { return Math.min((this.routeShips(r) * SHIPPING.payload) / this.routeTrip(r), this.portCap(r)); } // 片道あたりの送れる量 [質量の単位/年] (船と港の小さいほう)
  // n 隻の船を造る費用: 船の質量 (積み荷 × hull) を高付加価値物品と金属で、造る手間 (家計の賃金) は資材の値打ちと同じ
  freighterCost(n) {
    const m = n * SHIPPING.payload * SHIPPING.hull, hitech = (m * SHIPPING.hitech * UNIT_KG) / RES_KG.hitech, metal = (m * (1 - SHIPPING.hitech) * UNIT_KG) / RES_KG.metal;
    const v = hitech * basePrice('hitech') + metal * basePrice('metal');
    return { credits: v, hitech, metal }; // 丸めない (市場の値段の水準では船 1 隻が 1 cr より安い)
  }
  // 運賃 [cr / 質量の単位 / 光年] (船の年の費用 ÷ 1 隻が 1 年に運ぶ質量 × 光年)
  freightRate() {
    const c = this.freighterCost(1), v = c.hitech * basePrice('hitech') + c.metal * basePrice('metal') + c.credits;
    return ((CAPITAL.irr + 1 / SHIPPING.life) * v) / (SHIPPING.payload * SHIP_SPEED * SHIPPING.load);
  }
  // 輸送船を造る造船所: 払う星系から交易路網で近い順に、高付加価値物品の在庫が足りる星系 (なければ払う星系)。t = 造った船が交易路まで飛ぶ年数
  shipyard(o, cost) {
    if (this.stockOf(o).hitech >= cost.hitech) return { id: o, t: 0 };
    const { dist } = this.reach(o);
    for (const s of this.reachSorted(o)) if (!this.tradeBlocked(o, s) && this.stockOf(s).hitech >= cost.hitech) return { id: s, t: dist[s] };
    return { id: o, t: 0 };
  }
  // 交易路 r に n 隻の輸送船を足す。pay = 払う帳簿 ({ gov: 星系 } か { fm: 星系 })
  buyShips(r, n, pay, job) {
    const cost = this.freighterCost(n), y = this.shipyard(pay.gov ?? pay.fm, cost);
    return this.order(cost, y.id, { type: 'ships', route: r.id, n, delay: y.t, pay, ...job });
  }
  routeCost(a, b) { return { credits: Math.round(100 + 10 * this.sysDist(a, b)) }; } // 両端の発射所と減速設備 (船は別に造る)
  routeUpCost(r) { return { credits: 150 * r.lv, metal: 50 * r.lv }; } // 交易路の拡張 = 港を広げる (船は運送業の会社が足す)
  openRoute(a, b) {
    if (a === b || !this.isColonized(a) || !this.isColonized(b)) return fail('両端に入植地が必要');
    if (this.routeBetween(a, b)) return fail('開設済み');
    // 交戦中の国の星系とは新しく結べない (a が開戦の知らせを受け取ってから。既存の交易路は残る)
    if (this.realmOf(a) !== this.realmOf(b) && this.tradeBlocked(a, b)) return fail('交戦中の国とは交易路を結べない');
    const paid = this.pay(this.routeCost(a, b), undefined, a);
    if (!paid.ok) return paid;
    const r = { id: this.nextShipId++, a, b, lv: 1, ships: 0, transit: [zeroRes(), zeroRes()], vol: [0, 0], built: this.year, by: a };
    this.routes.push(r);
    this.message(`${this.system(a).name} ⇄ ${this.system(b).name} の交易路を開設した`, a);
    // 最初の船 (片道 base の分) を、開いた星系の政府が造る。船ができるまでは送れない。造れなければ、運送業の会社があとで造る (routesYearly)
    this.buyShips(r, this.shipsFor(r, SHIPPING.base), { gov: a }, { label: `${this.system(a).name} ⇄ ${this.system(b).name} の輸送船` });
    return { ok: true };
  }
  upgradeRoute(r, tag = '') {
    if (this.pending((j) => j.type === 'route' && j.route === r.id)) return fail('拡張中');
    return this.order(this.routeUpCost(r), r.a, { type: 'route', route: r.id, label: `${tag}${this.system(r.a).name} ⇄ ${this.system(r.b).name} の交易路 Lv${r.lv + 1}` });
  }
  routeOwner(r) { const o = r.by ?? r.a; return this.isColonized(o) ? o : this.isColonized(o === r.a ? r.b : r.a) ? (o === r.a ? r.b : r.a) : null; } // 船の持ち主 (開いた星系。いなくなっていれば反対の端)
  routeUse(r) { const c = this.routeCap(r); return c > 0 ? Math.max(r.vol[0], r.vol[1]) / c : r.vol[0] + r.vol[1] > 0 ? Infinity : 0; }
  // 交易路の混雑 (年1回): 片道の輸送量が容量の9割を超えたら知らせ、端の星系 (r.a) の政府が自動で拡張する。
  // 太陽系と直轄の星系の交易路は「交易路の自動拡張」がオンのときだけ。資金が費用の1.5倍以上あり、資材が手に入るとき。
  // 知らせは混み始めたときに1回 (8割を下回ったら数え直す)、地球の国の星系がかかわる交易路だけ
  routesYearly() {
    // 輸送船 (SHIPPING): 船は年に 1 ÷ life ずつ古くなって減る。持ち主の運送業の会社が自分の払いで造る (SHIPPING の説明)。造りかけの船があれば待つ
    for (const r of this.routes) {
      r.ships = this.routeShips(r); // 前の版のセーブの交易路にも船を持たせる
      if (!MARKET.buy) continue; // 市場のない版は、船は古くならない
      const lost = r.ships / SHIPPING.life, use = this.routeUse(r);
      r.ships -= lost;
      const o = this.routeOwner(r);
      if (o === null || this.pending((j) => j.type === 'ships' && j.route === r.id)) continue;
      // 使われている交易路は港の容量の分まで、使われていない交易路 (使われた割合が idle 未満) は片道 base の分まで船をそろえる (古くなった分と、港が広がった分)
      const n = this.shipsFor(r, use >= SHIPPING.idle ? this.portCap(r) : SHIPPING.base) - r.ships;
      if (n > 0) this.buyShips(r, n, { fm: o }, { label: `${this.system(r.a).name} ⇄ ${this.system(r.b).name} の輸送船` });
    }
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
      if (this.routeCap(r) < 0.9 * this.portCap(r)) continue; // 足りないのが船なら、運送業の会社が足す (港を広げても送れる量は増えない。船は古くなった分の 1 年は少ないので 9 割で見る)
      const cost = this.routeUpCost(r);
      if (this.funds(r.a) < 1.5 * cost.credits || this.procure(cost, r.a).why) continue;
      this.upgradeRoute(r, '[自動] ');
    }
  }

