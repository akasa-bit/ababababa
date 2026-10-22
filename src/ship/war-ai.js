  // --- 国家間の戦争 ---
  declareWar(root) {
    if (root === this.cap || this.realmOf(root) !== root || this.atWar(this.cap, root)) return fail('宣戦できない');
    this.beginWar(this.cap, root, this.cap);
    this.event('politics', this.cap, `${this.realmName(root)}に宣戦した (相手は攻め落とされるまで降伏しない)`);
    return { ok: true };
  }
  // 講和の申し入れ (光速の指令として相手の首都へ届く)。相手の艦隊が地球の国より少なければ受け入れ、そうでなくても30%
  // 相手が人間の国なら申し入れとして届き、相手が応じるのを待つ。AI の国は戦勝点と戦争疲弊で決める:
  // こちらが勝っていれば (相手が負けていれば) 応じやすく、相手が勝っていても相手が疲れていれば応じる
  offerPeace(root) {
    if (!this.atWar(this.cap, root) || this.realmOf(root) !== root) return fail('交戦中ではない');
    const key = this.warKey(this.cap, root);
    if (this.isHuman(root)) {
      this.postPeaceOffer(key, this.cap, root, this.year); // 指令として相手の首都に届いてから申し入れるので、もう届いている
      this.event('politics', root, `${this.realmName(this.cap)}が${this.realmName(root)}に講和を申し入れた (戦勝点 ${this.warScore(this.cap, root)})`, true);
      return { ok: true };
    }
    if (this.rand() < this.peaceChance(root, this.cap)) {
      this.makePeace(this.cap, root, root); // 講和の申し入れを受けた相手の首都で結ばれる
      return { ok: true };
    }
    return fail(`講和を拒否された (戦勝点 ${this.warScore(this.cap, root)}・相手の戦争疲弊 ${Math.round(this.exhaustion[root] || 0)})`);
  }
  // AI の国 r が、敵 e からの講和に応じる確率
  peaceChance(r, e) {
    if (BARGAIN.on) return this.warScore(r, e) >= this.reservation(r, e) ? PEACE.max : PEACE.min; // 受け入れる線を上回っていれば応じる
    const ws = this.warScore(r, e), ex = this.exhaustion[r] || 0;
    return clamp(ws <= 0 ? PEACE.base - ws / PEACE.loseWs + ex / PEACE.exLose : PEACE.winBase + ex / PEACE.exWin - ws / PEACE.winWs, PEACE.min, PEACE.max);
  }
  // 終戦。from = 講和の結ばれた星系 (終戦の知らせはここから光速で広がる)。
  // 各地の艦隊戦・攻囲は、終戦の知らせが攻める側の主星を経て届くまで続く (fightingAt)
  endWar(a, b, from = this.isHuman(a) ? b : a) {
    const key = this.warKey(a, b);
    if (this.realmWars[key] !== undefined) {
      this.peaces.push({ key, a, b, year: this.year, from, start: this.realmWars[key], by: this.warBy[key], news: this.warNews[key] });
    }
    this.peaces = this.peaces.filter((r) => this.year - r.year < 400);
    delete this.realmWars[key];
    delete this.warBy[key];
    delete this.warNews[key];
  }
  withdraw(g) {
    this.sieges = this.sieges.filter((x) => x !== g);
    const home = this.realmSystems(g.realm).sort((a, b) => distance(a, this.system(g.sys)) - distance(b, this.system(g.sys)))[0];
    if (home && g.ships > 0) this.pushFleet({ id: this.nextShipId++, from: g.sys, to: home.id, n: g.ships, owner: g.realm, auto: true, depart: this.year, arrive: this.year + this.fleetYears(g.sys, home.id) });
  }
  // 艦隊の到着。自国なら駐留 (戦闘中なら防衛に加わる)、交戦中の国の星系なら艦隊戦か攻囲になる
  fleetArrives(f) {
    const owner = f.owner ?? 0;
    const name = this.system(f.to).name;
    // 入植していない星系に他国の艦隊がいる: 交戦中なら艦隊戦 (一度に解く)、そうでなければ引き返す
    if (!this.isColonized(f.to) && (this.garrison[f.to] || 0) > 0 && this.stackRealm(f.to) !== owner) {
      const other = this.stackRealm(f.to);
      if (!this.atWar(owner, other)) {
        this.pushFleet({ ...f, id: this.nextShipId++, from: f.to, to: f.from, depart: this.year, arrive: this.year + this.fleetYears(f.to, f.from), surprise: false, route: undefined });
        this.message(`${f.n} 艦隊は ${name} に${this.realmName(other)}の艦隊がいるので引き返した`, f.to);
        return;
      }
      const a = f.n * this.fleetMul(owner, f.to), d = (this.garrison[f.to] || 0) * this.fleetMul(other, f.to);
      const win = a > d;
      const left = Math.floor(Math.sqrt(Math.abs(a * a - d * d)) / this.fleetMul(win ? owner : other, f.to));
      this.warLoss(other, owner, win ? f.n - left : f.n, f.to);
      this.warLoss(owner, other, win ? (this.garrison[f.to] || 0) : (this.garrison[f.to] || 0) - left, f.to);
      this.garrison[f.to] = left;
      if (win) this.setStackOwner(f.to, owner);
      this.event('battle', f.to, `${name} で${this.realmName(owner)}の ${f.n} 艦隊と${this.realmName(other)}の艦隊が戦い、${this.realmName(win ? owner : other)}が勝った (残り ${left} 艦隊)`, this.isHuman(owner) || this.isHuman(other));
      if (!win || left < 1) return;
      this.held[f.to] = left;
      this.continueRoute(f.to, left, f.route, f.chain ?? f.id);
      return;
    }
    if (!this.isColonized(f.to)) this.setStackOwner(f.to, owner);
    const destRealm = this.isColonized(f.to) ? this.realmOf(f.to) : owner;
    const b = this.battleAt(f.to);
    if (destRealm === owner) {
      if (b && b.realm !== owner) { b.d += f.n; b.d0 += f.n; this.message(`${f.n} 艦隊が ${name} の艦隊戦に防衛側で加わった`, f.to); return; }
      const sg = this.sieges.find((g) => g.sys === f.to && g.realm === owner);
      if (sg) { sg.ships += f.n; if (f.route?.length) sg.route ??= f.route; return; }
      this.garrison[f.to] = (this.garrison[f.to] || 0) + f.n;
      // 地球が命じて送った艦隊の来訪は関与になる (自動防衛配備・威圧の艦隊は数えない)
      if (this.isHuman(owner) && !f.auto && !f.awe && !f.aweBack && this.isColonized(f.to)) this.attend(f.to);
      if (f.awe) this.awe[f.to] = (this.awe[f.to] || 0) + f.n;
      else if (!f.auto) this.held[f.to] = (this.held[f.to] || 0) + f.n;
      this.message(`${f.n} 艦隊が ${name} に到着した${f.route?.length ? ` (経由地。次は ${this.system(f.route[0]).name})` : ''}`, f.to);
      this.continueRoute(f.to, f.n, f.route, f.chain ?? f.id);
      return;
    }
    if (!this.fightingAt(owner, destRealm, f.to) && f.surprise) {
      // 奇襲攻撃: 着いた時点で戦争を始め、そのまま艦隊戦 (守りがいなければ攻囲) に入る。開戦の知らせはこの星系から広がる
      this.beginWar(owner, destRealm, f.to);
      this.event('battle', f.to, `${this.realmName(owner)}の ${f.n} 艦隊が ${name} に奇襲攻撃をかけた。${this.realmName(destRealm)}との戦争が始まった`, false);
    }
    if (!this.fightingAt(owner, destRealm, f.to)) {
      this.pushFleet({ ...f, id: this.nextShipId++, from: f.to, to: f.from, depart: this.year, arrive: this.year + this.fleetYears(f.to, f.from), surprise: false, route: undefined });
      this.message(`${f.n} 艦隊は ${name} (${this.realmName(destRealm)}) と交戦中ではないので入れず、引き返した (攻め込むには先に宣戦する)`, f.to);
      return;
    }
    if (b && b.realm === owner) { b.a += f.n; b.a0 += f.n; if (f.route?.length) b.route ??= f.route; this.message(`${f.n} 艦隊が ${name} の艦隊戦に攻撃側で加わった`, f.to); return; }
    const sg = this.sieges.find((g) => g.sys === f.to && g.realm === owner);
    // 経由地の指令 (route) は艦隊戦・攻囲のあいだも保たれ、攻め落としたら次の経由地へ向かう
    const route = f.route?.length ? f.route : sg?.route;
    if ((this.garrison[f.to] || 0) > 0) {
      if (sg) this.sieges = this.sieges.filter((g) => g !== sg);
      this.startBattle(f.to, owner, f.n + (sg ? sg.ships : 0), sg ? sg.progress : 0, route);
    } else if (sg) { sg.ships += f.n; if (route) sg.route = route; }
    else {
      this.sieges.push({ sys: f.to, realm: owner, ships: f.n, progress: 0, start: this.year, route });
      this.event('battle', f.to, `${name} に守りの艦隊はなく、${this.realmName(owner)}の ${f.n} 艦隊が攻囲を始めた`, this.isHuman(owner) || this.isHuman(destRealm));
    }
  }
  // 艦隊戦はランチェスターの二次則を時間をかけて解く: 両軍とも1艦隊が1年に BATTLE_RATE 艦隊ずつ敵を壊滅させ、0.5艦隊を切った側が負け。
  // 同じくらいの戦力だと何年も続く。戦闘中に着いた艦隊や星系で造られた艦隊はその場で加わる
  battleAt(sys) { return this.battles.find((b) => b.sys === sys); }
  startBattle(sys, realm, ships, progress, route) {
    const d = this.garrison[sys] || 0;
    this.garrison[sys] = 0;
    this.battles.push({ sys, realm, a: ships, d, a0: ships, d0: d, start: this.year, progress: progress || 0, route });
    this.event('battle', sys, `${this.system(sys).name} で艦隊戦が始まった (攻撃 ${this.realmName(realm)} ${ships} 艦隊 対 防衛 ${d} 艦隊)`, this.isHuman(realm) || this.isHuman(this.realmOf(sys)));
  }
  battlesStep(dt) {
    for (const b of [...this.battles]) {
      if (!this.fightingAt(b.realm, this.realmOf(b.sys), b.sys)) { // 終戦の知らせが届いた: 防衛側は駐留に戻り、攻撃側は引き揚げる
        this.event('battle', b.sys, `${this.system(b.sys).name} の艦隊戦は、終戦の知らせが届いて終わった`, this.isHuman(b.realm) || this.isHuman(this.realmOf(b.sys)));
        this.battles = this.battles.filter((x) => x !== b);
        this.garrison[b.sys] = (this.garrison[b.sys] || 0) + Math.round(b.d);
        this.withdraw({ sys: b.sys, realm: b.realm, ships: Math.round(b.a) });
        continue;
      }
      b.d += this.garrison[b.sys] || 0;
      b.d0 += this.garrison[b.sys] || 0;
      this.garrison[b.sys] = 0;
      // 兵站: 攻撃側は補給線の長さと補給の充足率、防衛側は補給の充足率で戦力が変わる
      const ea = this.fleetEff(b.sup, b.line) * this.fleetMul(b.realm, b.sys), ed = this.fleetEff(b.dsup, 0) * this.fleetMul(b.sys, b.sys);
      for (let i = 0; i < 5; i++) {
        const a = b.a, d = b.d, h = dt / 5;
        b.a = Math.max(0, a - BATTLE_RATE * d * ed * h);
        b.d = Math.max(0, d - BATTLE_RATE * a * ea * h);
      }
      if (b.a >= 0.5 && b.d >= 0.5) continue;
      this.battles = this.battles.filter((x) => x !== b);
      const defender = this.realmOf(b.sys);
      this.warLoss(defender, b.realm, Math.round(b.a0 - (b.a >= 0.5 ? Math.max(1, Math.floor(b.a)) : 0)), b.sys);
      this.warLoss(b.realm, defender, Math.round(b.d0 - (b.a >= 0.5 ? 0 : Math.floor(b.d))), b.sys);
      const name = this.system(b.sys).name;
      const span = `${(this.year - b.start).toFixed(1)} 年、攻撃 ${Math.round(b.a0)} 艦隊 対 防衛 ${Math.round(b.d0)} 艦隊`;
      const mine = this.isHuman(b.realm) || this.isHuman(this.realmOf(b.sys));
      if (b.a >= 0.5) {
        const left = Math.max(1, Math.floor(b.a));
        this.sieges.push({ sys: b.sys, realm: b.realm, ships: left, progress: b.progress || 0, start: this.year, route: b.route });
        this.event('battle', b.sys, `${name} の艦隊戦で攻撃側 (${this.realmName(b.realm)}) が勝った (${span}、${left} 艦隊が残る)。攻囲が始まる`, mine);
      } else {
        this.garrison[b.sys] = Math.floor(b.d);
        this.event('battle', b.sys, `${name} の艦隊戦で攻撃側 (${this.realmName(b.realm)}) が全滅した (${span}、防衛側は ${Math.floor(b.d)} 艦隊が残る)`, mine);
      }
    }
  }
  // 攻囲: 年に、攻囲艦隊 ÷ (艦隊 + 地上の抵抗) × 0.12 ずつ進み、100% で降伏。地上の抵抗 = 歩兵 + 4×log10(1+人口)
  // 降伏した星系は、攻めた国の首都に直接従属する (その星系に従属していた星系も一緒に移る)
  siegesYearly() {
    for (const g of [...this.sieges]) {
      if (!this.fightingAt(g.realm, this.realmOf(g.sys), g.sys) || g.ships < 1) {
        if (g.ships >= 1) this.event('battle', g.sys, `終戦の知らせが届き、${this.system(g.sys).name} の攻囲を解いて引き揚げた`, this.isHuman(g.realm) || this.isHuman(this.realmOf(g.sys)));
        this.withdraw(g);
        continue;
      }
      // 守りの艦隊が造られたり届いたりしたら、攻囲を中断して艦隊戦になる (進捗は艦隊戦に勝てば引き継ぐ)
      if ((this.garrison[g.sys] || 0) > 0) { this.sieges = this.sieges.filter((x) => x !== g); this.startBattle(g.sys, g.realm, g.ships, g.progress, g.route); continue; }
      const pop = this.coloniesIn(g.sys).reduce((k, c) => k + c.pop, 0);
      const ground = this.troopPower(g.sys) + 4 * GM.log10(1 + pop);
      // 兵站: 補給線が長いほど・補給が足りないほど攻囲は遅れる。戦力が6割を切ると、年に5%ずつ艦隊が脱落する
      const eff = this.fleetEff(g.sup, g.line) * this.fleetMul(g.realm, g.sys);
      if (eff < 0.6) {
        g.wear = (g.wear || 0) + 0.05 * g.ships;
        while (g.wear >= 1 && g.ships >= 1) { g.wear -= 1; g.ships -= 1; }
        if (g.ships < 1) {
          this.event('battle', g.sys, `補給が続かず、${this.system(g.sys).name} を攻囲していた ${this.realmName(g.realm)}の艦隊が崩れた`, this.isHuman(g.realm) || this.isHuman(this.realmOf(g.sys)));
          this.sieges = this.sieges.filter((x) => x !== g);
          continue;
        }
      }
      g.progress = Math.min(1, g.progress + 0.12 * eff * g.ships / (g.ships + ground));
      if (this.troopPower(g.sys) >= 1) this.loseTroops(g.sys, 1);
      if (g.progress < 1) continue;
      const oldRealm = this.realmOf(g.sys);
      this.warTake(g.realm, oldRealm, g.sys);
      const gv = this.gov(g.sys);
      gv.lord = g.realm;
      gv.independent = false;
      gv.loyalty = 30;
      gv.friend = 0;
      this.garrison[g.sys] = g.ships;
      this.held[g.sys] = (this.held[g.sys] || 0) + g.ships; // 攻め落とした艦隊はそのまま駐留する
      this.sieges = this.sieges.filter((x) => x !== g);
      this.event('battle', g.sys, `${this.system(g.sys).name} が降伏し、${this.realmName(g.realm)}に従属した`, this.isHuman(g.realm));
      // 経由地の指令が残っていれば次へ。攻め落とした星系には守りとして2割 (最低1艦隊) を残す
      if (g.route?.length) {
        const keep = g.ships >= 2 ? Math.max(1, Math.round(g.ships * 0.2)) : 0;
        if (g.ships - keep >= 1) this.continueRoute(g.sys, g.ships - keep, g.route);
      }
      if (oldRealm === g.sys) this.cleanWars(); // 首都が落ちればその国は終わり、戦争も終わる
    }
  }
  // 海賊対策の建艦 (年1回、星系政府の自動開発より先): 海賊が現れる5年前から、各星系の政府は自分の資金で
  // 軍事基地を建て、駐留艦隊 + 向かっている艦隊 + 編成中が海賊の最大戦力に届くまで年1艦隊ずつ編成する
  // (海賊対策を優先するので、資金が費用の1.2倍以上あれば)。太陽系は海賊に狙われないので対象外 (観戦モードの地球政府は自動防衛配備で対応する)
  pirateDefenseYearly() {
    const base = Math.max(1, this.pirateMax());
    for (const s of this.colonizedSystems()) {
      const id = s.id;
      if (this.isHuman(id)) continue;
      const gv = this.gov(id);
      // 委任方針が軍備なら、海賊の最大戦力より2艦隊多く置く (海賊が現れる前から)
      if (this.year < PIRATE_START - 5 && gv.mandate !== 'arm') continue;
      const goal = base + (gv.mandate === 'arm' ? 2 : 0);
      const g = this.garrison[id] || 0;
      const have = g - Math.min(g, this.awe[id] || 0) + this.incoming(id) + queuedWarships(this.projects, id);
      if (have >= goal) continue;
      if (!this.hasShipyard(id)) {
        const big = this.coloniesIn(id).sort((a, b) => b.pop - a.pop)[0];
        if (big && this.funds(id) >= 1.2 * this.upgradeCost(big, 'shipyard').credits && !this.procure(this.upgradeCost(big, 'shipyard'), id).why) this.upgrade(big, 'shipyard');
      } else if (this.funds(id) >= 1.2 * WARSHIP_COST.credits && !this.procure(WARSHIP_COST, id).why) this.buildWarship(id);
    }
  }
  // 独立国の軍備 (年1回、星系政府の自動開発より先): どの独立国も星系ごとに軍事基地を建て、平時は守りの艦隊 (首都5・他3) を保つ。
  // 交戦中は資金の許すかぎり艦隊を編成する
  realmsArm() {
    for (const [key, gv0] of Object.entries(this.govs)) {
      const root = Number(key);
      if (this.isHuman(root) || !gv0.independent || this.realmOf(root) !== root || !this.isColonized(root)) continue;
      const war = this.aiEnemiesOf(root).length > 0;
      for (const x of this.realmSystems(root)) {
        const gv = this.gov(x.id);
        const big = this.coloniesIn(x.id).sort((a, b) => b.pop - a.pop)[0];
        const goal = x.id === root ? 5 : 3;
        if (!this.hasShipyard(x.id)) { if (big && this.funds(x.id) >= 2 * this.upgradeCost(big, 'shipyard').credits) this.upgrade(big, 'shipyard'); }
        else if (this.funds(x.id) >= 2 * WARSHIP_COST.credits && (war || (this.garrison[x.id] || 0) + queuedWarships(this.projects, x.id) < goal)) this.buildWarship(x.id);
      }
    }
  }
  // 国ごとの降伏: 首都が勝った国の首都に従属し、配下の星系もそのまま移る
  surrender(root, winner = 0) {
    const n = this.realmSystems(root).length;
    this.endWar(root, winner, root);
    const gv = this.gov(root);
    gv.lord = winner;
    gv.independent = false;
    gv.loyalty = 30;
    gv.friend = 0;
    gv.orders = 0;
    gv.attended = this.year;
    gv.unrest = { stage: 0 };
    this.asRealm(winner, () => { this.stats.subjugated++; this.councilAdd(10); });
    this.cleanWars();
    this.event('politics', root, `${this.realmName(root)}が降伏し、${this.realmName(winner)}に従属した${n > 1 ? ` (配下の ${n - 1} 星系も従う)` : ''}`, this.isHuman(winner));
  }
  // 独立国の戦争の判断 (年1回)
  // - 交戦中の国の手薄な星系 (20光年以内) を、いちばん艦隊の多い星系から攻める (年1回)
  // - 自分から仕掛けた戦争で大差で負けていれば降伏する: 開戦から5年以上・相手の戦力が5倍以上で年8%。仕掛けられた側は降伏しない
  // - 20年以上たっても互いに2倍の差がつかなければ年5%で講和 (地球から仕掛けた戦争は除く。それは地球が決める)
  // - どことも戦っていなければ、首都から25光年以内の独立国で、自分の1.5倍より弱いところへ年3%の確率で宣戦する
  // (BARGAIN.on のときは、講和と宣戦を上の 3 つの代わりに交渉の型で決める。攻める先の選び方は同じ)
  // --- 交渉の型 (BARGAIN) ---
  // 読み違い (平均 0・分散 1 に近い、一様乱数 4 つの和)
  misread() { return (this.rand() + this.rand() + this.rand() + this.rand() - 2) * 1.7320508075688772; }
  // 国 r から見た、国 e の艦隊の伸び (光が届いている分の、shiftYears 年の年率)。自分のものは遅れなし
  seenGrowth(r, e) {
    const t = this.year - (r === e ? 0 : this.sysDist(r, e));
    const now = this.shipsAt(e, t), then = this.shipsAt(e, t - BARGAIN.shiftYears);
    return now === null || then === null ? 0 : (now - then) / Math.max(1, then) / BARGAIN.shiftYears;
  }
  shipsAt(e, t) {
    let v = null;
    for (const [y, n] of this.shipHist[e] || []) { if (y <= t + 1e-9) v = n; else break; }
    return v;
  }
  // 国 r が戦争 (相手 e) で受け入れる線 (r の取り分の戦勝点、−100〜100)。z を渡せば、その読み違いで (宣戦の見込み)
  reservation(r, e, z = this.warStats[this.warKey(r, e)]?.z?.[r] ?? 0, ws = this.warScore(r, e)) {
    const ours = this.realmShips(r);
    const theirs = this.seenShips(r, e) * GM.exp(z * (BARGAIN.sigma0 + BARGAIN.sigmaAge * this.sysDist(r, e)));
    let p = (ours + 0.5) / (ours + theirs + 1);
    const st = this.warSeen(r, this.warKey(r, e)); // 首都に届いた戦果で
    if (st && this.atWar(r, e)) {
      const a = st.k[r] || 0, b = st.k[e] || 0, n = a + b;
      p = (BARGAIN.learn * p + n * (a + 1) / (n + 2)) / (BARGAIN.learn + n); // 戦いながら分かっていく
    }
    const expect = clamp(ws + (2 * p - 1) * BARGAIN.swing, -100, 100);
    const cost = (BARGAIN.cost + BARGAIN.costEx * (this.exhaustion[r] || 0)) * BARGAIN.horizon;
    const shift = BARGAIN.shift * Math.max(0, this.seenGrowth(r, e) - this.seenGrowth(r, r)) * 100;
    return expect - cost + shift;
  }
  // AI の国どうしの講和の交渉: 受け入れる線が重なれば、その真ん中で講和する (from = 結ばれる星系)
  bargain(r, e, from = r) {
    const lr = this.reservation(r, e), le = this.reservation(e, r);
    if (lr + le > 0) return false;
    const x = Math.round((lr - le) / 2); // r の取り分
    const [w, l] = x >= 0 ? [r, e] : [e, r];
    if (Math.abs(x) < TREATY.white) {
      this.endWar(r, e, from);
      this.event('politics', from, `${this.realmName(r)}と${this.realmName(e)}が白紙講和を結んだ`);
    } else this.startConference(l, [{ realm: w, pts: Math.abs(x) >= BARGAIN.capitulate ? 100 : Math.abs(x) }], from);
    return true;
  }
  recordShips() {
    for (const r of new Set(this.colonizedSystems().map((x) => this.realmOf(x.id)))) {
      const list = (this.shipHist[r] ??= []), n = this.realmShips(r), last = list[list.length - 1];
      if (!last || last[1] !== n) list.push([this.year, n]);
      while (list.length > 1 && list[1][0] <= this.year - (this.intelSpan || 0) - BARGAIN.shiftYears - 1) list.shift();
    }
    for (const k of Object.keys(this.shipHist)) if (!this.isColonized(Number(k)) || this.realmOf(Number(k)) !== Number(k)) delete this.shipHist[k];
  }
  realmsYearly() {
    this.cleanWars();
    const roots = this.colonizedSystems().map((x) => x.id).filter((r) => !this.isHuman(r) && this.realmOf(r) === r && this.gov(r).independent);
    for (const root of roots) {
      if (this.realmOf(root) !== root) continue; // この年のうちに降伏した
      const enemies = this.aiEnemiesOf(root); // 開戦の知らせが首都に届いた戦争だけ
      const mine = this.realmSystems(root);
      const strong = mine.filter((x) => (this.garrison[x.id] || 0) >= 3).sort((a, b) => (this.garrison[b.id] || 0) - (this.garrison[a.id] || 0))[0];
      if (strong && enemies.length) {
        const n = this.garrison[strong.id] - 1;
        // 攻める先は、首都に届いている記録 (光の遅れのぶん古い) で、敵の星系のうち駐留艦隊が少ないもの
        const foes = new Set(enemies);
        const target = this.galaxy.systems.filter((x) => { const v = this.seenBy(root, x.id); return v && foes.has(v[1]) && !this.isHuman(x.id) && v[2] < n; })
          .sort((a, b) => distance(a, strong) - distance(b, strong))[0];
        if (target && distance(target, strong) <= 20) this.aiOrder(root, strong.id, target.id, n);
      }
      for (const e of enemies) {
        const key = this.warKey(root, e);
        if (this.realmWars[key] === undefined) continue;
        if (BARGAIN.on) {
          if (this.isHuman(e)) {
            // 人間の国へは、いまの戦勝点で講和してよいときに申し入れる (offerEvery 年に 1 回まで)
            if (this.warScore(root, e) >= this.reservation(root, e) && !this.peaceOfferedRecently(key)) {
              this.postPeaceOffer(key, root, e); // 光速で相手の首都に届いてから見える
              this.event('politics', root, `${this.realmName(root)}が講和を申し入れてきた (戦勝点 ${this.warScoreAt(root, e, root)}・相手の戦争疲弊 ${Math.round(this.exhaustion[root] || 0)})`, true);
            }
          } else if (this.aiKnowsWar(e, key) && this.bargain(root, e, root)) break; // 相手も開戦を知っていれば交渉できる
          continue;
        }
        const ours = this.realmShips(root), theirs = this.seenShips(root, e), years = this.year - this.aiWarSince(root, key); // 知ってからの年数
        // 自分から仕掛けて大差で負けていれば、相手に全面的に任せる (持ち点 100 の講和会議)
        if (this.warBy[key] === root && years >= 5 && theirs >= 5 * Math.max(1, ours) && this.rand() < 0.08) { this.startConference(root, [{ realm: e, pts: 100 }], root); break; }
        // 疲れた・負けている国は講和を申し入れる。相手が AI なら相手の判断で、人間なら申し入れとして届く (5 年に 1 回まで)
        const ex = this.exhaustion[root] || 0, ws = this.warScore(root, e);
        const st = this.warStats[key];
        const quiet = st && !Object.keys(st.k).length && !Object.keys(st.t).length && this.rand() < PEACE.stalemate / (1 + years / PEACE.stalemateHalf);
        if (!quiet && (years < PEACE.minYears || (ex < PEACE.sueEx && ws > PEACE.sueWs))) continue;
        if (this.isHuman(e)) {
          if (!this.peaceOfferedRecently(key)) {
            this.postPeaceOffer(key, root, e);
            this.event('politics', root, `${this.realmName(root)}が講和を申し入れてきた (戦勝点 ${this.warScoreAt(root, e, root)}・相手の戦争疲弊 ${Math.round(ex)})`, true);
          }
        } else if (this.rand() < this.peaceChance(e, root)) this.makePeace(root, e, root);
      }
      if (BARGAIN.on) {
        if (enemies.length || this.rand() >= BARGAIN.declareChance) continue;
        // 首都に届いている記録で、まだ独立国の相手のうち、開戦の見込みがいちばん良いもの (読み違いはその場で引く)
        let best = null;
        for (const r of roots) {
          if (r === root || this.seenBy(root, r)?.[1] !== r || this.realmOf(r) !== r || this.sysDist(r, root) > BARGAIN.warDist) continue;
          const v = this.reservation(root, r, this.misread(), 0);
          if (v > BARGAIN.declare && (!best || v > best.v)) best = { r, v };
        }
        if (best) {
          this.beginWar(root, best.r, root);
          this.event('politics', root, `${this.realmName(root)}が${this.realmName(best.r)}に宣戦した`);
        }
        continue;
      }
      if (!enemies.length && this.rand() < 0.03) {
        const ours = this.realmShips(root);
        const prey = roots.filter((r) => r !== root && this.seenBy(root, r)?.[1] === r && this.sysDist(r, root) <= 25 && ours >= 1.5 * Math.max(1, this.seenShips(root, r)))
          .sort((a, b) => this.sysDist(a, root) - this.sysDist(b, root))[0];
        if (prey !== undefined) {
          this.beginWar(root, prey, root);
          this.event('politics', root, `${this.realmName(root)}が${this.realmName(prey)}に宣戦した`);
        }
      }
    }
  }

