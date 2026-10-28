  // --- 入植船の設計 (回 FU3・B-033。SHIP_DESIGN・SHIP_TEMPLATES は ship/colonists.js) ---
  // 国 realm の設計 (なければひな形の「小」)。値は選べる幅に収める
  designOf(realm) {
    const d = this.designs?.[realm] || SHIP_TEMPLATES.small;
    return { crew: clamp(Math.round(Number(d.crew)) || SHIP_TEMPLATES.small.crew, ...SHIP_DESIGN.crew), speed: SHIP_DESIGN.speeds[d.speed] ? String(d.speed) : 'std',
      cargo: Math.max(0, Number(d.cargo) || 0), ages: SHIP_DESIGN.ages[d.ages] ? d.ages : 'migrant' };
  }
  settlerDesign(fromId) { return this.designOf(this.realmOf(fromId)); }
  // 設計を変える (命令 design)。船を造る首都で決めるので、光速の指令にならず政治力も要らない。tpl = ひな形、ほかは値ごとに
  setDesign(d) {
    const next = d.tpl && SHIP_TEMPLATES[d.tpl] ? { ...SHIP_TEMPLATES[d.tpl] } : { ...this.designOf(this.cap) };
    for (const k of ['crew', 'speed', 'cargo', 'ages']) if (d[k] !== undefined) next[k] = d[k];
    this.designs[this.cap] = next;
    const v = (this.designs[this.cap] = this.designOf(this.cap)); // 選べる幅に収めて覚える
    return { ok: true, msg: `入植船の設計を ${fmtPeople(v.crew)}・${SHIP_DESIGN.speeds[v.speed]}・積み荷の工業品 ${v.cargo}・${SHIP_DESIGN.ages[v.ages]} にした` };
  }
  // 住む場所 (船の構造) の工業品 [単位]
  habitatGoods(des) { return (des.crew * SHIP_DESIGN.habitatKg) / RES_KG.goods; }
  // 設計の速さ [c]。標準は前と同じ (交易路をたどるなら 0.95c、そうでなければ 0.9c)
  designSpeed(des, path) { return des.speed === 'std' ? (path.length > 2 ? SHIP_SPEED : OFFROUTE_SPEED) : Number(des.speed); }
  // 設計の速さで行く道のりと年数 (遅い設計は、交易路の上も外も同じ速さ)
  settlerVoyage(fromId, toId, des) {
    if (des.speed === 'std') return this.voyage(fromId, toId, OFFROUTE_SPEED);
    const b = Number(des.speed), v = this.voyage(fromId, toId, b), times = [0];
    for (let i = 1; i < v.path.length; i++) times.push(times[i - 1] + (this.shipYears(v.path[i - 1], v.path[i]) * SHIP_SPEED) / b);
    return { path: v.path, times, years: times[times.length - 1] };
  }
  // 国家方針が拡張期なら、船の費用 (開拓資金を除く) が25%安い
  // エネルギーは、船の構造 (住む場所の工業品)・積み荷・積む食料と水・乗る人の質量を、加速はレーザー、減速は磁気帆と反物質で運ぶ分 (同じ星系の中なら要らない)
  shipCost(kind, fromId, toId, des = this.settlerDesign(fromId)) {
    const f = this.policyAt(fromId) === 'expand' ? 0.75 : 1;
    const sup = this.shipSupplies(kind, fromId, toId, des);
    const hab = this.habitatGoods(des);
    const cost = { credits: Math.round(SHIP_DESIGN.credits * hab * f) + SEED_FUNDS[kind], goods: Math.round((hab + des.cargo) * 1000) / 1000, ...sup };
    const fl = this.settlerFlight(kind, fromId, toId, sup, des);
    if (fl && SIM_ONLY) cost.energy = this.bookPath('settler', fl.m, fl.path, 'free', { book: false });
    else if (fl) {
      const sh = shieldOf('settler', fl.m, fl.beta, fl.ly ?? 0, this.physics);
      const p = propulsion(fl.m + sh.kg, fl.beta, 'free');
      cost.energy = p.acc + p.dec;
      if (sh.kg > 0) cost.shield = sh.kg / fl.m; // 遮蔽 ÷ 船の質量 (費用の内訳に 1 行で出す。資材ではないので procure は見ない)
    }
    return cost;
  }
  // 入植船の質量 [kg] と速さ [c]
  settlerFlight(kind, fromId, toId, sup = this.shipSupplies(kind, fromId, toId), des = this.settlerDesign(fromId)) {
    if (fromId === toId) return null;
    const m = (this.habitatGoods(des) + des.cargo) * RES_KG.goods + sup.food * RES_KG.food + sup.water * RES_KG.water + des.crew * PERSON_KG;
    const path = this.settlerVoyage(fromId, toId, des).path;
    return { m, beta: this.designSpeed(des, path), ly: this.sysDist(fromId, toId), ...(SIM_ONLY ? { path } : {}) };
  }
  launch(fromId, toId, bodyId, kind, supplies = {}, job = null) {
    const des = job?.design || this.settlerDesign(fromId); // 注文したときの設計 (前の版の注文は、いまの設計)
    // 出発地の星系に駐留する歩兵から同行させる (奴隷兵は後回し)
    let want = this.escortNeed(toId, bodyId, kind);
    const escort = { troops: 0, slave: 0 };
    for (const c of this.coloniesIn(fromId)) { const k = Math.min(want, c.troops); c.troops -= k; escort.troops += k; want -= k; }
    for (const c of this.coloniesIn(fromId)) { const k = Math.min(want, c.slaveTroops); c.slaveTroops -= k; escort.slave += k; want -= k; }
    const v = this.settlerVoyage(fromId, toId, des);
    const years = v.years;
    if (escort.troops + escort.slave && fromId !== toId) {
      if (SIM_ONLY) this.bookPath('troop', (escort.troops + escort.slave) * TROOP_KG, v.path, 'free', { payer: fromId });
      else this.bookShip('troop', (escort.troops + escort.slave) * TROOP_KG, this.designSpeed(des, v.path), 'free', fromId, fromId, this.sysDist(fromId, toId));
    }
    const ship = {
      id: this.nextShipId++, from: fromId, to: toId, body: bodyId, kind,
      path: v.path, times: v.times.map((t) => this.year + t), supplies, escort,
      depart: this.year, arrive: this.year + years, crew: des.crew, ages: des.ages,
    };
    this.ships.push(ship);
    if (job?.seed) { const v = job.seed; this.cash('build', -v, { way: job, f: 'seed' }); this.cash('build', v, { way: ship, f: 'seed' }); }
    this.message(`${this.system(fromId).name} → ${this.system(toId).name} へ入植船が出発 (${KIND_LABEL[kind]}・${fmtPeople(des.crew)}、${v.path.length > 2 ? `交易路経由、` : ''}到着まで ${years.toFixed(2)} 年${escort.troops + escort.slave ? `、歩兵 ${escort.troops + escort.slave} 連隊が同行` : ''})`, fromId);
    return { ok: true, ship };
  }
  // 入植団が降りる (着いた船。core の到着から呼ぶ)。乗ってきた人数と年齢の形で入植地を作る。
  // 始まりのうちに絶える確率 (colonyFailP。人数が少ないほど高い) のくじに外れたら、入植地を作らずに false を返す
  settlersLand(s, kind, name) {
    const n = s.crew ?? SETTLERS[kind] * 1e6; // 前の版の船は前の人数
    if (s.crew !== undefined) {
      const p = colonyFailP(n);
      if (p > 0 && this.rand() < p) {
        this.event('colony', s.to, `${name} (${this.system(s.to).name}) に降りた ${fmtPeople(n)} の入植団は、増える前に絶えた (この人数で始まりのうちに絶える見込み ${pct(p)})`);
        return false;
      }
    }
    this.addColony(s.to, s.body, kind, name, n / 1e6, s.from);
    if (s.crew !== undefined) {
      const c = this.colonyAt(s.to, s.body, kind);
      const w = s.ages === 'home' ? this.homeAgeShape(s.from) : ageShape(s.ages);
      const tot = w.reduce((k, x) => k + x, 0) || 1;
      c.age = { f: w.map((x) => ((x / tot) * c.pop) / 2), m: w.map((x) => ((x / tot) * c.pop) / 2) }; // 乗ってきた年齢の形 (経済の ageSync は、表があれば作り直さない)
    }
    return true;
  }
  // 送り出した星系のいちばん大きい入植地の年齢の形 (設計の「送り出す星系と同じ」)
  homeAgeShape(fromId) {
    const big = this.coloniesIn(fromId).reduce((m, x) => (!m || x.pop > m.pop ? x : m), null);
    return big?.age ? big.age.f.map((v, a) => v + big.age.m[a]) : DEMO.migrant;
  }

