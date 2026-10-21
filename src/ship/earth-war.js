  // 観戦モードの地球政府の戦争の判断 (年1回): 交戦中の独立国に対し、優勢なら手近な敵の星系へ艦隊を差し向け、
  // 劣勢なら講和を申し入れる。戦時は太陽系で艦隊を編成する。平時でも独立国より5倍以上強ければ年5%の確率で宣戦する
  earthWarYearly() {
    // 講和の申し入れ・講和会議は、疲れているか勝っていれば応じ、条件はおまかせで選ぶ
    for (const o of this.peaceOffers.filter((x) => x.to === this.cap)) if ((this.exhaustion[this.cap] || 0) > 40 || this.warScore(this.cap, o.from) > 10) this.acceptPeace(o);
    for (const c of [...this.conferences]) { const b = c.bids.find((x) => x.realm === this.cap && !x.picks); if (b) this.submitTreaty({ id: c.id, picks: this.aiTreatyPicks(c, b) }); }
    const ours = this.realmShips(this.cap);
    const ordered = (act, sys) => this.requests.some((q) => q.kind === 'order' && q.act === act && Number(q.d.sys) === sys);
    for (const x of this.colonizedSystems()) {
      const root = x.id;
      if (root === this.cap || this.realmOf(root) !== root || !this.gov(root).independent) continue;
      const theirs = this.realmShips(root);
      if (!this.atWar(this.cap, root)) {
        if (ours > 5 * Math.max(1, theirs) && this.sysDist(this.cap, root) <= 25 && this.rand() < 0.05) this.declareWar(root); // AI の国と同じく首都から 25 光年まで
        continue;
      }
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

