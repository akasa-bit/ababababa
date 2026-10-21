  // --- 軍事 ---
  hasShipyard(sysId) { return this.coloniesIn(sysId).some((c) => c.lv.shipyard >= 1); }
  // n 艦隊をまとめて編成する (費用は n 倍、指令の政治力は1回ぶん)
  buildWarship(sysId, n = 1) {
    if (!this.hasShipyard(sysId)) return fail('軍事基地がない');
    n = clamp(Math.floor(n) || 1, 1, 100);
    return this.order(mulCost(WARSHIP_COST, n), sysId, { type: 'warship', n, label: `${this.system(sysId).name} の艦隊${n > 1 ? ` ×${n}` : ''}` });
  }
  // 補給の拠点: その国の入植星系のうち sys に最も近いところ (sys 自身がその国の星系ならそこ)
  supplyBase(realm, sys) {
    if (this.isColonized(sys) && this.realmOf(sys) === realm) return { id: sys, d: 0 };
    let best = null;
    for (const x of this.realmSystems(realm)) { const d = this.sysDist(x.id, sys); if (!best || d < best.d) best = { id: x.id, d }; }
    return best;
  }
  // 補給線の効き: 拠点から SUPPLY_NEAR 光年までは1、遠いほど下がって SUPPLY_FAR 光年で 0.5 (それより先も 0.5)
  lineEff(d) { return d <= SUPPLY_NEAR ? 1 : Math.max(0.5, 1 - (0.5 * (d - SUPPLY_NEAR)) / (SUPPLY_FAR - SUPPLY_NEAR)); }
  // 艦隊の戦力の倍率: 補給線の効き × (0.5 + 0.5 × 補給の充足率)。補給がまったくなければ半分
  fleetEff(k = 1, d = 0) { return this.lineEff(d) * (0.5 + 0.5 * k); }
  // 艦隊は直行する。交易路が直接結ぶ区間なら 0.95c、それ以外は 0.9c
  fleetYears(from, to) {
    const onRoute = !!this.routeBetween(from, to);
    return this.shipYears(from, to, onRoute) + accelExtra(this.travelYears(from, to), onRoute ? SHIP_SPEED : OFFROUTE_SPEED, ACCEL.crew, this.physics);
  }
  // route = 着いたあとに順に回る経由地 (星系の id の列)。艦隊戦・攻囲をまたいでも保たれる
  // chain = 経由地を回っている艦隊の最初の id (取り消しの指令が後を追うのに使う)
  sendFleet(from, to, n, prefix = '', route = null, chain = undefined) {
    const have = this.garrison[from] || 0;
    n = Math.min(n, have);
    if (from === to || n < 1) return fail('派遣できる艦隊がない');
    this.garrison[from] = have - n;
    if (this.held[from]) this.held[from] = Math.max(0, this.held[from] - n);
    if (this.awe[from] > this.garrison[from]) this.awe[from] = this.garrison[from];
    const years = this.fleetYears(from, to);
    // 自動防衛配備 (prefix つき) 以外で送った艦隊は、着いた先に命令で駐留する (自動防衛配備で動かさない)
    // 交戦中でない他国の星系へ送った艦隊は奇襲攻撃になる (着いた時点で戦争を始める)
    const owner = this.stackRealm(from);
    const dest = this.isColonized(to) ? this.realmOf(to) : owner;
    const surprise = dest !== owner && !this.atWar(owner, dest);
    this.pushFleet({ id: this.nextShipId++, from, to, n, owner, start: this.year, depart: this.year, arrive: this.year + years, auto: !!prefix, surprise, route: route?.length ? [...route] : undefined, chain });
    if (surprise) this.message(`${this.system(to).name} (${this.realmName(dest)}) への奇襲攻撃に ${n} 艦隊が出撃した。到着すると戦争になる`, from);
    this.message(`${prefix}${this.system(from).name} → ${this.system(to).name} へ ${n} 艦隊が出撃 (到着まで ${years.toFixed(2)} 年)`, from);
    return { ok: true };
  }

  // 経由地の残りがあれば、着いた星系から次の経由地へ向かう
  continueRoute(sys, n, route, chain) {
    if (!route?.length) return;
    const [next, ...rest] = route;
    this.sendFleet(sys, next, n, '', rest, chain);
  }
  // 移動中の艦隊への進路変更の指令。地球から光速で送り、艦隊に追いついた時刻・地点で届く (艦隊は光より遅いので必ず追いつく)
  // 星系 origin (既定は地球) から光速で送った指令が移動中の艦隊 f に追いつく時刻 (二分法)
  fleetIntercept(f, origin = 0) {
    const E = this.system(origin);
    const t0 = this.year;
    const gap = (t) => { const p = this.fleetPosition(f, t); return (t - t0) - GM.hypot(p.x - E.x, p.y - E.y, (p.z || 0) - (E.z || 0)); };
    let hi = t0 + 1;
    for (let i = 0; i < 20 && gap(hi) < 0; i++) hi = t0 + (hi - t0) * 2;
    let lo = t0;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (gap(m) < 0) lo = m; else hi = m; }
    return hi;
  }
  sendRedirect(f, target, route = null) {
    const t0 = this.year;
    const hi = this.fleetIntercept(f, this.cap); // 指令は首都から出る (地球の国でなくても)
    const p = this.fleetPosition(f, hi);
    this.requests.push({ id: this.nextShipId++, kind: 'order', from: this.cap, ...(this.cap !== 0 ? { by: this.cap } : {}), to: f.to, act: 'redirect', label: CMD_LABEL.redirect,
      d: { fleet: f.id, sys: target, from: f.to, n: f.n, x: p.x, y: p.y, route: route?.length ? [...route] : undefined }, sent: t0, arrive: hi, state: 'sending' });
    this.message(`移動中の ${f.n} 艦隊 (${this.system(f.from).name} → ${this.system(f.to).name}) へ、${this.system(target).name} への進路変更を命じた (指令が追いつくまで ${(hi - t0).toFixed(1)} 年)`);
    return { ok: true, queued: true };
  }
  // 艦隊への指令の取り消し。移動中の艦隊へは光速の指令が追いついた時点で効く
  sendFleetClear(f, origin = this.cap) {
    const t0 = this.year;
    const hi = this.fleetIntercept(f, origin);
    this.requests.push({ id: this.nextShipId++, kind: 'order', from: origin, ...(this.cap !== 0 ? { by: this.cap } : {}), to: f.to, act: 'fleetclear', label: CMD_LABEL.fleetclear,
      d: { fleet: f.chain ?? f.id, sys: f.to }, sent: t0, arrive: hi, state: 'sending' });
    if (origin !== this.cap) return { ok: true, queued: true };
    this.message(`移動中の ${f.n} 艦隊 (${this.system(f.from).name} → ${this.system(f.to).name}) へ、指令の取り消しを送った (追いつくまで ${(hi - t0).toFixed(1)} 年)`);
    return { ok: true, queued: true };
  }
  // 取り消しの指令が届いた。移動中の艦隊: この先の経由地をやめ、いまの行き先に着いたら自動防衛配備に任せる (行き先は変えない)。
  // 星系にいる艦隊: 命令による駐留 (held) と、艦隊戦・攻囲のあとに回る経由地をやめ、自動防衛配備に任せる
  clearFleetOrders(d) {
    const id = d.fleet === undefined ? undefined : Number(d.fleet);
    const f = id !== undefined ? this.fleets.find((x) => x.id === id) || this.fleets.find((x) => x.chain === id && x.to === Number(d.sys)) : null;
    // 届く前に艦隊がこの星系に着いて次の経由地へ発っていたら、ここから光速で後を追わせる
    const gone = id !== undefined && !f ? this.fleets.find((x) => x.chain === id && x.from === Number(d.sys)) : null;
    if (gone) { this.sendFleetClear(gone, Number(d.sys)); return { ok: true }; }
    if (f) {
      const had = !!f.route?.length || !f.auto;
      f.route = undefined;
      f.auto = true;
      return had ? { ok: true } : fail('取り消す指令がない');
    }
    const sys = Number(d.sys);
    let had = (this.held[sys] || 0) > 0;
    delete this.held[sys];
    for (const x of [...this.sieges, ...this.battles]) if (x.sys === sys && x.realm === this.cap && x.route?.length) { x.route = undefined; had = true; }
    return had ? { ok: true } : fail('取り消す指令がない');
  }
  // 進路変更の指令が届いた: いまの位置から新しい行き先へ直行する (0.9c)。もう着いていれば、着いた星系から送り直す
  redirectFleet(id, to, d = {}) {
    const f = this.fleets.find((x) => x.id === id);
    if (!f) return this.sendFleet(Number(d.from), to, Number(d.n) || Infinity, '', d.route);
    f.route = d.route?.length ? [...d.route] : undefined;
    if (f.to === to) return { ok: true };
    if (SIM_ONLY && f.depart > this.year) { // まだ前の進路変更で止まっている途中: 止まる点から新しい行き先へ
      f.to = to;
      const dly = Math.max(0.001, distance(this.system(to), f.fromXY));
      f.arrive = f.depart + dly / OFFROUTE_SPEED + accelExtra(dly, OFFROUTE_SPEED, ACCEL.crew, this.physics);
    } else {
      const p = this.fleetPosition(f, this.year);
      (f.prev ??= []).push({ from: f.from, fromXY: f.fromXY, to: f.to, depart: f.depart, arrive: f.arrive, cut: this.year });
      let at = { x: p.x, y: p.y, z: p.z || 0 }, t0 = this.year;
      if (SIM_ONLY) {
        // 慣性 (シミュレーション版だけ): 0.9c の船はその場で向きを変えられない。いまの向きのまま 1g で減速して止まってから、新しい行き先へ加速する。
        // 止まるまでに (c/a)γβ 年かかり、(c²/a)(γ − 1) 光年 進む (0.9c で 2.0 年・1.3 光年)。もとの行き先がそれより近ければ、そこで止まる
        const gm = 1 / Math.sqrt(1 - OFFROUTE_SPEED ** 2), T = C_LIGHT / (ACCEL.crew * 9.80665) / YEAR_S;
        const xs = T * (gm - 1), b = this.system(f.to), rem = distance(b, p);
        const stop = rem <= xs ? { x: b.x, y: b.y, z: b.z || 0, t: Math.max(f.arrive, this.year) }
          : { x: p.x + ((b.x - p.x) * xs) / rem, y: p.y + ((b.y - p.y) * xs) / rem, z: (p.z || 0) + (((b.z || 0) - (p.z || 0)) * xs) / rem, t: this.year + T * gm * OFFROUTE_SPEED };
        f.prev.push({ from: f.from, fromXY: at, toXY: { x: stop.x, y: stop.y, z: stop.z }, depart: this.year, arrive: stop.t, cut: stop.t });
        at = { x: stop.x, y: stop.y, z: stop.z }; t0 = stop.t;
      }
      f.fromXY = at;
      f.depart = t0;
      f.to = to;
      const dly = Math.max(0.001, distance(this.system(to), at));
      f.arrive = t0 + dly / OFFROUTE_SPEED + accelExtra(dly, OFFROUTE_SPEED, ACCEL.crew, this.physics);
    }
    const owner = f.owner ?? 0;
    // 進路を変えるには、いまの速さを磁気帆と反物質で落として、もう一度加速する (宇宙の途中なので、国の首都の政府が払う)
    this.bookShip('fleet', f.n * FLEET_KG, OFFROUTE_SPEED, 'free', owner, owner, (f.arrive - this.year) * OFFROUTE_SPEED);
    const dest = this.isColonized(to) ? this.realmOf(to) : owner;
    f.surprise = dest !== owner && !this.atWar(owner, dest);
    f.auto = false;
    this.message(`${f.n} 艦隊が進路を ${this.system(to).name} へ変えた (到着まで ${(f.arrive - this.year).toFixed(1)} 年)`, to);
    return { ok: true };
  }
