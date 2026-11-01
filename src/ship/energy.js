  // スウォームが恒星の光を覆う割合。gv.sw = [始めの割合, その年] からロジスティック曲線で 1 に近づく
  swarmCover(id) {
    const gv = this.govs[id];
    if (!gv || !this.isColonized(id)) return 0;
    const [f0, t0] = (gv.sw ??= this.isHome(id) ? [SWARM.home, START_YEAR] : [SWARM.seed, gv.founded ?? this.year]);
    const rate = this.physics.pv ? this.pvOf(id, this.pvDesign(id)).rate : Math.LN2 / SWARM.doubling;
    return 1 / (1 + (1 / f0 - 1) * GM.exp(-rate * Math.max(0, this.year - t0)));
  }
  // スウォームの素子の作り (シミュレーション版だけ)。星系の政府が選んだ作り、なければ試合の既定、それもなければ自動 ('auto' も選べる)
  pvDesign(id) {
    const k = this.govs[id]?.pvd ?? this.pvPolicy;
    return PV_DESIGNS[k] ? k : this.pvAuto(id);
  }
  // 作り k の星系での、出力の残り rf (恒星の光度で平均し、集光の損も掛ける) と、スウォームが広がる速さ rate [/年]
  pvOf(id, k) {
    const s = this.system(id), c = (s.pv ??= {});
    if (c[k]) return c[k];
    const d = PV_DESIGNS[k];
    s.lumSum ??= s.stars.reduce((a, x) => a + (x.lum || 0), 0);
    const rf = d.pf * (s.lumSum > 0 ? s.stars.reduce((a, x) => a + (x.lum || 0) * pvRemaining(x, d, this.physics.pv), 0) / s.lumSum : 1);
    return (c[k] = { rf, rate: ((Math.LN2 / SWARM.doubling) * PV_DESIGNS[PV_PICK.ref].sigma * rf) / d.sigma });
  }
  // 自動の作り: 持ちこんでから PV_PICK.horizon 年あとの発電が一番大きい作り
  pvAuto(id) {
    const f0 = this.isHome(id) ? SWARM.home : SWARM.seed;
    let best = PV_PICK.ref, top = -1;
    for (const k of Object.keys(PV_DESIGNS)) {
      const { rf, rate } = this.pvOf(id, k);
      const p = rf / (1 + (1 / f0 - 1) * GM.exp(-rate * PV_PICK.horizon));
      if (p > top) { top = p; best = k; }
    }
    return best;
  }
  // 素子の作りを変える (星系に届いた指令)。いまの覆う割合から、新しい作りの速さで広がり直す (素子は一度に取り替える。簡単のため)
  setPvDesign(id, k) {
    const gv = this.govs[id];
    if (!this.physics.pv || !gv || (k !== 'auto' && !PV_DESIGNS[k])) return fail('素子の作りを選べない');
    if (this.isColonized(id)) gv.sw = [Math.max(SWARM.seed, this.swarmCover(id)), this.year];
    gv.pvd = k;
    return { ok: true };
  }
  // 星系の発電 [J/年] = 恒星の光度の和 × 覆う割合 × 発電効率
  power(id) {
    const cover = this.swarmCover(id);
    if (!cover) return 0;
    const s = this.system(id);
    s.lumSum ??= s.stars.reduce((k, x) => k + (x.lum || 0), 0);
    // 太陽電池が陽子で傷んだ分と集光の損 (physics.pv のとき = シミュレーション版だけ。ゲーム版は 1 で、星系に何も書かない)
    const rf = this.physics.pv ? this.pvOf(id, this.pvDesign(id)).rf : 1;
    return s.lumSum * L_SUN_W * cover * PROP.pv * rf * YEAR_S;
  }
  energyOf(id) { return this.govs[id]?.E || 0; }
  // エネルギーを記帳する (kind ごとに、負なら使った量)。蓄えが負になってもよい (自動の移動の分。あとの発電で埋める)
  bookE(kind, J, id) {
    const gv = this.gov(id);
    gv.E = (gv.E || 0) + J;
    (gv.eled ??= {})[kind] = (gv.eled[kind] || 0) + J;
    if (MASS_AUDIT) { const f = (MASS_AUDIT.energy[id] ??= {}); f[kind] = (f[kind] || 0) + J; }
  }
  // 1 便の推進のエネルギーを記帳する。from = 加速する (と反物質を作る) 星系の政府、to = 交易路で減速する星系の政府
  // ly = 航路の長さ [光年] (遮蔽の厚さを決める)。from と to が航路の両端でない便 (入植船・艦隊など) は、呼ぶ側が渡す
  bookShip(kind, m, beta, mode, from, to = from, ly = from === to ? 0 : this.sysDist(from, to)) {
    const sh = shieldOf(kind, m, beta, ly, this.physics);
    const p = propulsion(m + sh.kg, beta, mode);
    if (mode === 'route') { this.bookE(kind, -p.acc, from); this.bookE(kind, -p.dec, to); } else this.bookE(kind, -(p.acc + p.dec), from);
    if (ENERGY_AUDIT) ENERGY_AUDIT.push({ kind, m, beta, mode, E: p.acc + p.dec, year: this.year, ly, shield: sh.kg, depth: sh.depth, side: sh.side, share: sh.share });
    return p.acc + p.dec;
  }
  // 交易路の道のり path を行く便の区間 (物理。シミュレーション版だけ)。0.95c の船は途中の星系で向きを変えられない (向きを変えるのにも c に近い速さの変化が要る) ので、
  // 途中の星系ごとにそこのレーザーで止めて、加速し直す。途中の区間は交易路の両端のレーザー ('route')、最後の区間は mode (交易路の外への直行は 0.9c)
  shipLegs(path, mode, offSpeed = OFFROUTE_SPEED) {
    const legs = [];
    for (let i = 1; i < path.length; i++) {
      legs.push({ from: path[i - 1], to: path[i], beta: this.routeBetween(path[i - 1], path[i]) ? SHIP_SPEED : offSpeed, mode: i < path.length - 1 ? 'route' : mode });
    }
    return legs;
  }
  // 区間ごとの推進のエネルギー。遮蔽は道のり全体の線量で決める (同じ船で行く)。payer があれば全部その星系が払う (入植船と同行の歩兵は出発する星系が手配する)。
  // ないときは、途中の区間は区間の両端のレーザー、最後が 'free' なら送る側 (path[0]) が磁気帆と反物質の分も払う。book = false なら記帳せずに合計だけ返す
  bookPath(kind, m, path, mode, { payer = null, offSpeed = OFFROUTE_SPEED, book = true } = {}) {
    let ly = 0, E = 0;
    for (let i = 1; i < path.length; i++) ly += this.sysDist(path[i - 1], path[i]);
    for (const l of this.shipLegs(path, mode, offSpeed)) {
      if (!book) { const p = propulsion(m + shieldOf(kind, m, l.beta, ly, this.physics).kg, l.beta, l.mode); E += p.acc + p.dec; continue; }
      const a = payer ?? (l.mode === 'free' ? path[0] : l.from);
      E += this.bookShip(kind, m, l.beta, l.mode, a, payer ?? (l.mode === 'free' ? path[0] : l.to), ly);
    }
    return E;
  }
  // 道のりの各星系に着く年 times に、加速と減速の遅れを足す。シミュレーション版は途中の星系ごとに止まるので、区間ごとに足す。betaOf(i) = 区間 i の速さ
  stopTimes(path, times, betaOf, gs) {
    let extra = 0;
    return times.map((t, i) => (i === 0 ? t : t + (extra += accelExtra(this.sysDist(path[i - 1], path[i]), betaOf(i), gs, this.physics))));
  }
  // 艦隊を出す (交易路が直接結ぶ自国の星系への移動なら、着く側のレーザーで減速する。ほかは磁気帆と反物質)。費用は出発する星系 (自国でなければ国の首都) の政府
  pushFleet(f) {
    const owner = f.owner ?? 0;
    const onRoute = !!this.routeBetween(f.from, f.to);
    const mine = (id) => this.isColonized(id) && this.realmOf(id) === owner;
    const payer = f.laser ?? (mine(f.from) ? f.from : owner); // 押すレーザーの星系 (sendFleet の laserBase)
    const mode = onRoute && mine(f.from) && mine(f.to) ? 'route' : 'free';
    this.bookShip('fleet', f.n * FLEET_KG, onRoute ? SHIP_SPEED : OFFROUTE_SPEED, mode, payer, f.to, this.sysDist(f.from, f.to));
    this.fleets.push(f);
  }
  // 交易路を通る荷 (貨物船・資材輸送船・移民船) を送れる量 [100 万 t]。ふつうは送る側が加速、受ける側が減速を払う。
  // 受ける側が払えなければ (入植したばかりの星系など)、送る側が磁気帆と反物質の分も払う
  // 回 FU6 (B-173): 受け手 (to) の蓄えは、送り手から光の遅れのぶん古い記録 (energySeen) で見る (前は受け手のいまの蓄えを見ていた。光より速い)
  routeRoom(from, to, eF = this.energyOf(from), eT = this.energySeen(from, to)) {
    eF = Math.max(0, eF); eT = Math.max(0, eT);
    return Math.max(Math.min(eF / E_UNIT, eT / decUnit()), eF / E_UNIT_FREE);
  }
  routeMode(from, to, mt) { return this.energyOf(from) >= mt * E_UNIT && this.energySeen(from, to) >= mt * decUnit() ? 'route' : 'free'; }
  // 星系 viewer から見えている、星系 id の蓄えのエネルギー (経済の記録 econIntel。光がまだ届いていなければ 0。自分の星系はいまの値)
  energySeen(viewer, id) { return viewer === id ? this.energyOf(id) : this.econSeen(viewer, id)?.[3] ?? 0; }
  // 交易路の荷 (貨物・移民) の推進: 送り手の加速の分だけいま記帳し、受け手の減速の分は返す (荷に持たせ、着いたときに受け手が払う。回 FU6・B-173)。
  // 'free' の便はいまのまま全部を送り手が払う (返すのは 0)
  bookShipDefer(kind, m, beta, mode, from, to, ly = from === to ? 0 : this.sysDist(from, to)) {
    if (mode !== 'route') { this.bookShip(kind, m, beta, mode, from, to, ly); return 0; }
    const sh = shieldOf(kind, m, beta, ly, this.physics), p = propulsion(m + sh.kg, beta, mode);
    this.bookE(kind, -p.acc, from);
    if (ENERGY_AUDIT) ENERGY_AUDIT.push({ kind, m, beta, mode, E: p.acc + p.dec, year: this.year, ly, shield: sh.kg, depth: sh.depth, side: sh.side, share: sh.share });
    return p.dec;
  }

