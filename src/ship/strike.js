  // --- 光速に近い艦隊の一撃 (B-035。STRIKE の説明は ship/war-consts.js) ---
  // 星系 from の n 艦隊を、減速せずに星系 to へ突っ込ませる。着くまでの時間は加速の半分だけ (減速しない)
  launchStrike(from, to, n) {
    const owner = this.stackRealm(from);
    const have = this.garrison[from] || 0;
    n = Math.min(Math.floor(n), have);
    if (from === to || n < 1) return fail('突入させる艦隊がない');
    if (!this.isColonized(to) || this.realmOf(to) === owner) return fail('他国の入植星系にだけ突入できる');
    this.garrison[from] = have - n;
    if (this.held[from]) this.held[from] = Math.max(0, this.held[from] - n);
    if (this.awe[from] > this.garrison[from]) this.awe[from] = this.garrison[from];
    const ly = this.travelYears(from, to);
    const years = ly / OFFROUTE_SPEED + accelExtra(ly, OFFROUTE_SPEED, ACCEL.crew, this.physics) / 2;
    this.pushFleet({ id: this.nextShipId++, from, to, n, owner, start: this.year, depart: this.year, arrive: this.year + years, auto: false, strike: true });
    this.message(JA`${this.system(from).name} の ${n} 艦隊が ${this.system(to).name} (${this.realmName(this.realmOf(to))}) へ、減速せずに突入する (着くまで ${years.toFixed(1)} 年。止められない)`, from);
    return { ok: true };
  }
  // 突入した艦隊が着いた: 人口の多い天体から順に、1 艦隊で 1 つの天体の入植地を焼く。艦隊は残らない
  strikeArrives(f) {
    const owner = f.owner ?? 0;
    if (!this.isColonized(f.to)) { this.message(JA`${f.n} 艦隊は ${this.system(f.to).name} に突入したが、焼くものはなかった`, f.to); return; }
    const hit = this.realmOf(f.to);
    if (hit === owner) { this.message(JA`${f.n} 艦隊は自国になった ${this.system(f.to).name} に突入した`, f.to); return; }
    if (!this.atWar(owner, hit)) this.beginWar(owner, hit, f.to);
    const bodies = [...new Set(this.coloniesIn(f.to).map((c) => c.body))]
      .map((body) => ({ body, pop: this.coloniesIn(f.to).filter((c) => c.body === body).reduce((k, c) => k + c.pop, 0) }))
      .sort((a, b) => b.pop - a.pop).slice(0, f.n);
    let dead = 0;
    for (const { body } of bodies) {
      for (const c of this.coloniesIn(f.to).filter((x) => x.body === body)) {
        dead += c.pop * (1 - STRIKE.survive) * 1e6;
        c.pop *= STRIKE.survive;
        c.lv = LV0();
        c.troops = 0; c.slaveTroops = 0;
      }
      this.outposts = this.outposts.filter((o) => !(o.sys === f.to && o.body === body));
    }
    if (bodies.length >= new Set(this.coloniesIn(f.to).map((c) => c.body)).size) { // 全部の天体を焼いた
      const st = this.stockOf(f.to);
      for (const r of RES) st[r] = 0;
      this.garrison[f.to] = 0;
    }
    this.warDead(hit, owner, dead);
    this.exhaustAt(hit, EXHAUST.system, f.to);
    if (this.isHuman(owner)) this.infamy += STRIKE.infamy;
    this.strikes.push({ id: this.nextShipId++, year: this.year, sys: f.to, by: owner, hit, dead, told: [] });
    this.event('battle', f.to, JA`${this.realmName(owner)}の ${f.n} 艦隊が光速に近い速さのまま ${this.system(f.to).name} に突入し、${bodies.length} つの天体の地表を焼いた (死者 ${fmtDead(dead)})`, false);
  }
  // 年 1 回: 光速の一撃の知らせが届いた国と星系が応じる (exhaustionYearly の始めから呼ぶ)
  strikesYearly() {
    if (!this.strikes?.length) return;
    this.strikes = this.strikes.filter((s) => this.year - s.year < STRIKE.keep);
    const roots = this.colonizedSystems().map((x) => x.id).filter((r) => this.realmOf(r) === r);
    for (const s of this.strikes) {
      const by = s.by;
      if (!this.isColonized(by) || this.realmOf(by) !== by) continue;
      const seen = (id) => this.year >= s.year + this.sysDist(s.sys, id);
      // 撃った国の家臣: 知らせが届けば忠誠が下がる
      for (const x of this.realmSystems(by)) {
        if (x.id === by || s.told.includes(x.id) || !seen(x.id)) continue;
        s.told.push(x.id);
        const gv = this.govs[x.id];
        if (gv) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - STRIKE.loyalty);
      }
      // ほかの国: 知らせが首都に届けば、撃った国へ宣戦する (人間の国は自分で決める)
      for (const r of roots) {
        if (r === by || s.told.includes(r) || !seen(r)) continue;
        s.told.push(r);
        if (this.isHuman(r) || this.atWar(r, by)) continue;
        const p = r === s.hit ? STRIKE.retaliateHit : this.sysDist(r, s.sys) <= STRIKE.reach ? STRIKE.retaliate : 0;
        if (p > 0 && this.rand() < p) {
          this.beginWar(r, by, r);
          this.event('politics', r, JA`${this.realmName(r)}が、${this.system(s.sys).name} を焼いた${this.realmName(by)}に宣戦した`, this.isHuman(by));
        }
      }
    }
  }
  // AI の国の一撃 (年 1 回。realmsYearly から): 大きく負けている戦争で、首都の 1 艦隊を相手の首都へ
  aiStrike(root, enemies) {
    if ((this.garrison[root] || 0) < 2 || this.rand() >= STRIKE.aiChance) return;
    const e = enemies.find((x) => this.warScore(root, x) <= STRIKE.desperate);
    if (e === undefined) return;
    // 狙うのは相手の首都 (首都に届いた記録で、まだ相手の国のもの)。AI の国は、ほかの攻め方と同じく人間の国の星系は狙わない
    if (this.seenBy(root, e)?.[1] !== e || this.isHuman(e)) return;
    // 同じ戦争で同じ相手に撃つのは 1 回まで (追い詰められた国の一度きりの手。回 FU3: 入植船が安くなって資源に余裕ができ、負けている戦争のあいだ毎年撃ち続けて、
    // 同じ相手の首都に 26 回撃つ国が出た。6 銀河 × 300 年で 6 回 → 81 回になり、戦死者の裾 R15 が壊れた)
    const st = this.warStats[this.warKey(root, e)];
    if (st?.struck?.includes(root)) return;
    this.launchStrike(root, e, 1);
    if (st) (st.struck ??= []).push(root);
  }
