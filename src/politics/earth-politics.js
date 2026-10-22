  // 地球の国の外の主人 (と地球の国の家臣の家臣の主人) は、放っておかれた家臣に少額の資金援助を送って関与する (年に半々)
  lordsAttendYearly() {
    for (const [k, gv] of Object.entries(this.govs)) {
      const id = Number(k);
      const lord = gv.lord;
      if (lord === null || lord === undefined || this.isHuman(lord) || !this.isColonized(id) || this.neglectOf(gv) < 20) continue;
      if (this.gov(lord).credits < 300 || this.rand() < 0.5) continue;
      this.sendGrant(lord, id, 50, true);
    }
  }
  // 観戦モードの地球政府の政治の判断 (年1回): 国家方針、決めること、放っておかれた直属の家臣への視察
  earthPoliticsYearly() {
    const n = this.realmSystems(this.cap).length;
    const want = this.aiPolicy || (this.enemiesOf(this.cap).length ? 'military' : n < 25 ? 'expand' : 'consolidate'); // aiPolicy は実験用 (自動対戦で方針を固定する)
    if (this.policy?.id !== want && (!this.policy || this.year - this.policy.since >= POLICY_YEARS) && this.pc >= POLICY_COST + 10) this.command('policy', { value: want });
    for (const dec of this.visibleDecisions()) {
      let k = dec.def;
      if (dec.kind === 'demand') k = (this.garrison[this.cap] || 0) >= 2 * this.knownRebelFleet(dec.sys) + 1 && this.rand() < 0.5 ? 'awe' : 'accept';
      else {
        // 払える選択肢のうち、いまの国の様子でいちばん選びたいもの (語り手の weigh。少しの揺らぎを足す)
        const ok = dec.opts.filter((o) => (o.cr || 0) <= 0.2 * this.gov(this.cap).credits && this.pcCost('decide', { sys: dec.sys, id: dec.id, opt: o.k }) <= this.pc - 10);
        const w = STORY[dec.type]?.weigh;
        let best = -Infinity;
        for (const o of ok) { const v = (w ? w(this, dec, o.k) : 0) + 0.4 * this.rand(); if (v > best) { best = v; k = o.k; } }
      }
      if (k) this.command('decide', { sys: dec.sys, id: dec.id, opt: k });
    }
    const neglected = this.knownSystems().filter((s) => s.id !== this.cap && this.known(s.id)?.lord === this.cap && (this.known(s.id).realm ?? this.cap) === this.cap)
      .map((s) => ({ s, y: this.year - (this.known(s.id).attended ?? this.known(s.id).founded ?? this.year) }))
      .filter((x) => x.y > 30 && !this.requests.some((q) => q.kind === 'order' && q.act === 'inspect' && Number(q.d.sys) === x.s.id))
      .sort((a, b) => b.y - a.y);
    // 年に1か所まで (政治力に余裕があるとき)
    for (const { s } of neglected.slice(0, 1)) if (this.pc >= this.pcCost('inspect', { sys: s.id }) + 20) this.command('inspect', { sys: s.id });
  }

