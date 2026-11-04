  // 観戦モードの地球政府の戦争の判断 (年1回): 交戦中の独立国に対し、優勢なら手近な敵の星系へ艦隊を差し向け、
  // 劣勢なら講和を申し入れる。戦時は太陽系で艦隊を編成する。
  // 平時の宣戦は、AI の国と同じ交渉の模型で決める (回 AI6・B-306・QD-115 = a): 開戦を知っている戦争がなければ、年 declareChance の確率で
  // (自分から分かれた国があれば RECLAIM.chance)、首都の記録で warDist 光年以内の独立国 (人間の国も) のうち、受け入れる線 (+ 請求権 + 記憶のずれ) が
  // declare を超えていちばん良い相手に宣戦する (ship/war-ai.js の realmsYearly と同じ)。前は 25 光年以内の独立国ごとに、艦隊が 5 倍なら年 5% で宣戦し、
  // AI の国の 17〜31 倍宣戦していたので、人間の代わりとして測りが偏っていた (docs/ai-behavior.md の 12.2)
  earthWarYearly() {
    // 講和の申し入れ・講和会議は、疲れているか勝っていれば応じ、条件はおまかせで選ぶ
    for (const o of this.peaceOffers.filter((x) => x.to === this.cap)) if ((this.exhaustion[this.cap] || 0) > 40 || this.warScore(this.cap, o.from) > 10) this.acceptPeace(o);
    for (const c of [...this.conferences]) { const b = c.bids.find((x) => x.realm === this.cap && !x.picks); if (b) this.submitTreaty({ id: c.id, picks: this.aiTreatyPicks(c, b) }); }
    const ours = this.realmShips(this.cap);
    const ordered = (act, sys) => this.requests.some((q) => q.kind === 'order' && q.act === act && Number(q.d.sys) === sys);
    this.spectateDeclare();
    for (const x of this.colonizedSystems()) {
      const root = x.id;
      if (root === this.cap || this.realmOf(root) !== root || !this.gov(root).independent) continue;
      const theirs = this.realmShips(root);
      if (!this.atWar(this.cap, root)) continue;
      if (this.hasShipyard(this.cap) && this.funds(this.cap) >= 2 * WARSHIP_COST.credits) this.buildWarship(this.cap);
      if (ours < 0.7 * theirs || (this.exhaustion[this.cap] || 0) > 60) { if (!ordered('peace', root)) this.command('peace', { sys: root }); continue; }
      let best = null;
      for (const t of this.realmSystems(root)) {
        if (ordered('fleet', t.id) || this.fleets.some((f) => f.to === t.id && (f.owner ?? 0) === this.cap)) continue;
        const b = this.battleAt(t.id);
        const need = (this.garrison[t.id] || 0) + (b ? b.d : 0) + 2;
        for (const s of this.realmSystems(this.cap)) {
          const n = (this.garrison[s.id] || 0) - 1;
          if (n < need) continue;
          const d = distance(s, t);
          if (!best || d < best.d) best = { s, t, n, d };
        }
      }
      if (best) this.command('fleet', { from: best.s.id, sys: best.t.id, n: best.n });
    }
  }
  // 観戦の AI の平時の宣戦 (上の説明。AI の国の realmsYearly と同じ交渉の模型)。tools/strategy.js の戦略の「model」もこれを呼ぶ
  spectateDeclare() {
    if (!BARGAIN.on || this.aiEnemiesOf(this.cap).length) return;
    const roots = this.colonizedSystems().map((x) => x.id).filter((r) => this.realmOf(r) === r && (this.isHuman(r) || this.gov(r).independent));
    if (this.rand() >= (roots.some((r) => this.claimBy(r) === this.cap) ? RECLAIM.chance : BARGAIN.declareChance)) return;
    let best = null;
    for (const r of roots) {
      if (r === this.cap || this.seenBy(this.cap, r)?.[1] !== r || this.sysDist(r, this.cap) > BARGAIN.warDist || this.pactBars(this.cap, r)) continue;
      const z = this.misread(), v = this.reservation(this.cap, r, z, 0) + this.claimBonus(this.cap, r) + this.aiWarBias(this.cap, r);
      if (v > this.pressLine() && (!best || v > best.v)) best = { r, v, z }; // 威圧の線 (回 AI7。politics/coerce.js)
    }
    if (best) this.aiPress(this.cap, best); // 先に威圧するか、宣戦する (politics/coerce.js。AI の国と同じ。回 AI7)
  }

