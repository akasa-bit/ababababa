  // 海賊の戦力の基準値と、起こりうる最大値 (乱数の幅は基準の0.5〜1.5倍)。基準は2320年に1/3、40年ごとに +1/3
  pirateBase() { return (1 + Math.max(0, this.year - PIRATE_START) / 40) / 3; }
  pirateMax() { return Math.max(1, Math.round(1.5 * this.pirateBase())); }
  // 自動防衛配備で目指す駐留数。太陽系は海賊に狙われないので1艦隊、他の入植星系は海賊の最大戦力ぶん (海賊が現れる前は1艦隊)
  defenseGoal(id) { return this.isHuman(id) || this.year < PIRATE_START ? 1 : this.pirateMax(); } // 人間の国の首都は海賊に狙われない
  incoming(id) { return this.fleets.filter((f) => f.to === id && !f.awe).reduce((k, f) => k + f.n, 0); }
  knownAwe(id) { return id === this.cap ? 0 : Math.min(this.knownGarrison(id), this.known(id)?.awe || 0); }
  defenseGap(id) { return Math.max(0, this.defenseGoal(id) - (this.knownGarrison(id) - this.knownAwe(id)) - this.incoming(id)); } // 地球から見た不足 (威圧の駐留は数えない)

  // 自動防衛配備: 年に1回、目標に足りない入植星系へ、人口の多い順に、近くの余っている艦隊を回す。
  // 余っている = 入植星系なら自分の目標を超えた分、入植していない星系にいる艦は全部。ただし命令で送った艦隊 (held) は除く。
  // autoBuild なら、それでも足りない分を太陽系の軍事基地で編成する (資金が費用の2倍以上あるとき、年5艦隊まで)。
  autoDefend() {
    if (!this.autoDefense) return;
    // 地球に届いている情報 (光の遅れぶん昔の様子) で判断し、太陽系以外の艦隊は光速の指令で動かす。
    // 送った指令は届くまで数え、同じ指令を重ねない
    const C = this.cap;
    const realmK = (id) => (id === C ? C : this.known(id)?.cols.length ? this.known(id).realm ?? C : (this.known(id)?.stack ?? 0) === C ? null : -1);
    const pop = (id) => this.knownColonies(id).reduce((k, c) => k + c.pop, 0);
    const orders = this.requests.filter((q) => q.kind === 'order' && q.act === 'fleet');
    const orderedTo = (id) => orders.filter((q) => Number(q.d.sys) === id).reduce((k, q) => k + (Number(q.d.n) || 0), 0);
    const orderedFrom = (id) => orders.filter((q) => Number(q.d.from) === id).reduce((k, q) => k + (Number(q.d.n) || 0), 0);
    const heldK = (id) => (id === C ? this.held[C] || 0 : this.known(id)?.held || 0);
    // 威圧のための駐留 (awe) は海賊対策とは別なので、数えず動かさない
    const pirateK = (id) => this.knownGarrison(id) - this.knownAwe(id);
    const gapK = (id) => Math.max(0, this.defenseGoal(id) - pirateK(id) - this.incoming(id) - orderedTo(id));
    const spareK = (id) => pirateK(id) - orderedFrom(id) - Math.max(realmK(id) === C ? this.defenseGoal(id) : 0, Math.min(heldK(id), pirateK(id)));
    const known = [C, ...Object.keys(this.snaps).map(Number).filter((id) => id !== C)];
    const targets = this.knownSystems().filter((s) => realmK(s.id) === C && gapK(s.id) > 0).sort((a, b) => pop(b.id) - pop(a.id));
    for (const t of targets) {
      let gap = gapK(t.id);
      const sources = known.filter((id) => id !== t.id && spareK(id) > 0 && (realmK(id) === C || realmK(id) === null))
        .sort((a, b) => this.lightDelay(a) + this.fleetYears(a, t.id) - this.lightDelay(b) - this.fleetYears(b, t.id));
      for (const id of sources) {
        if (gap <= 0) break;
        const n = Math.min(gap, spareK(id));
        this.command('fleet', { from: id, sys: t.id, n, auto: true });
        gap -= n;
      }
    }
    if (!this.autoBuild) return;
    // 足りない分は太陽系の軍事基地で編成する
    const short = this.knownSystems().filter((s) => realmK(s.id) === C).reduce((k, s) => k + gapK(s.id), 0)
      - queuedWarships(this.projects, C);
    for (let i = 0; i < Math.min(short, 5) && this.hasShipyard(C); i++) {
      if (this.funds(C) < 2 * WARSHIP_COST.credits || this.procure(WARSHIP_COST, C).why) break;
      this.order(WARSHIP_COST, C, { type: 'warship', label: `[自動防衛] ${this.system(C).name} の艦隊` });
    }
  }
  // 反乱防止の威圧: 年に1回、地球の直属の従属星系 (主人が太陽系) に、反乱したときの推定艦隊の2倍の地球の艦隊を駐留させる。
  // 海賊対策の駐留とは別に数える。忠誠度が50以上の星系には送らない。地球に届いている情報で判断し、忠誠度の低い順に太陽系の艦隊を送る
  // (太陽系には1艦隊残す)。足りなければ「足りない艦隊は自動で編成」がオンのとき、太陽系で資金と資源の続く限り編成する
  aweGoal(id) { return 2 * this.knownRebelFleet(id); }
  aweTargets() { return this.knownSystems().filter((s) => s.id !== this.cap && this.known(s.id)?.cols.length && (this.known(s.id).realm ?? this.cap) === this.cap && this.known(s.id).lord === this.cap
    && !this.aweUnneeded(this.known(s.id))); }
  // 威圧が要らない (地球の知る忠誠度が50以上か、主人との友好度が十分高く反乱しない)
  aweUnneeded(k) { return (k.loyalty ?? LOYALTY_START) >= 50 || (k.friend || 0) >= FRIEND_SAFE; }
  aweGap(id) {
    // 向かっている艦隊と、着いたがその知らせがまだ地球に届いていない艦隊 (ghosts) も数える
    const coming = [...this.fleets, ...this.ghosts.fleets].filter((f) => f.awe && f.to === id).reduce((k, f) => k + f.n, 0)
      + this.requests.filter((q) => q.kind === 'order' && q.act === 'fleet' && q.d.awe && Number(q.d.sys) === id).reduce((k, q) => k + (Number(q.d.n) || 0), 0);
    return Math.max(0, this.aweGoal(id) - this.knownAwe(id) - coming);
  }
  aweYearly() {
    if (!this.autoAwe) return;
    // 威圧が要らなくなった星系からは、威圧の艦隊を太陽系へ引き揚げる (光速の指令で。引き揚げ中・指令の送信中は重ねない)
    for (const s of this.knownSystems()) {
      const id = s.id;
      const k = id === this.cap ? null : this.known(id);
      const n = id === this.cap ? 0 : this.knownAwe(id);
      if (n < 1 || !k?.cols.length || (k.realm ?? this.cap) !== this.cap || !this.aweUnneeded(k)) continue;
      if (this.requests.some((q) => q.kind === 'order' && q.act === 'fleet' && q.d.aweBack && Number(q.d.from) === id)) continue;
      if ([...this.fleets, ...this.ghosts.fleets].some((f) => f.aweBack && f.from === id)) continue;
      this.command('fleet', { from: id, sys: this.cap, n, aweBack: true });
    }
    const targets = this.aweTargets().sort((a, b) => (this.known(a.id).loyalty ?? 100) - (this.known(b.id).loyalty ?? 100));
    let short = 0;
    for (const t of targets) {
      const gap = this.aweGap(t.id);
      if (gap <= 0) continue;
      const spare = Math.max(0, (this.garrison[this.cap] || 0) - Math.max(this.defenseGoal(this.cap), this.held[this.cap] || 0));
      const n = Math.min(gap, spare);
      if (n >= 1) this.command('fleet', { from: this.cap, sys: t.id, n, awe: true });
      short += gap - n;
    }
    if (!this.autoBuild || short <= 0) return;
    short -= queuedWarships(this.projects, this.cap);
    for (let i = 0; i < Math.min(short, 1000) && this.hasShipyard(this.cap); i++) {
      if (this.funds(this.cap) < WARSHIP_COST.credits) break;
      if (!this.order(WARSHIP_COST, this.cap, { type: 'warship', label: `[威圧] ${this.system(this.cap).name} の艦隊` }).ok) break;
    }
  }
  undefended() { return this.knownSystems().filter((s) => (s.id === this.cap || (this.known(s.id)?.realm ?? this.cap) === this.cap) && this.defenseGap(s.id) > 0); }

