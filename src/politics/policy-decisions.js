  setPolicy(id) {
    if (!POLICIES[id]) return fail('不明な方針');
    if (this.policy?.id === id) return fail('いまの方針と同じ');
    if (this.policy && this.year - this.policy.since < POLICY_YEARS) return fail(`${Math.ceil(this.policy.since + POLICY_YEARS - this.year)}年後まで変えられない`);
    this.policy = { id, since: this.year, prev: this.policy?.id ?? null };
    this.event('goal', this.cap, `国家方針を「${POLICIES[id].label}」にした (${POLICIES[id].good}。${POLICIES[id].bad})。遠い星系には知らせが光速で届いてから効く`, true);
    return { ok: true };
  }
  // 統治体制の切り替え (指令が届いたとき)。直接統治 = 直轄 (gv.direct)。'delegate' は間接統治 (古い指令の名前)
  setRule(id, value) {
    const gv = this.govs[id];
    if (!gv || !this.isColonized(id)) return fail('入植地がない');
    const regime = regimeNorm(value);
    if (!regime) return fail('不明な統治体制');
    if (regime === 'direct') {
      if (gv.lord !== this.cap || this.realmOf(id) !== this.cap) return fail('直属の従属星系だけを直轄にできる');
      if ((gv.autonomy || 0) > this.year) return fail('自治を認めているので直轄にできない');
      if (!gv.direct && this.directCount() >= this.directMax()) return fail(`直轄は ${this.directMax()} 星系まで`);
    }
    return this.setRegime(id, regime);
  }
  // 直轄にしている星系と、直轄にする指令を送った星系の数 (上限の判定用)
  directPlanned() {
    return this.directCount() + this.requests.filter((q) => q.kind === 'order' && q.act === 'rule' && q.d.value === 'direct' && !this.isDirect(Number(q.d.sys))).length;
  }

  // --- 決めること (要求・出来事) ---
  // 遠い星系で起きたことは光が地球に届いてから見え (seen)、返事は光速の指令で戻る (届いた時点で効く)。
  // 期限 (deadline) までに返事を送らなければ、現地が既定の選択肢 (def) で決める
  addDecision(dec) {
    Object.assign(dec, { id: this.nextShipId++, year: this.year, seen: this.year + this.lightDelay(dec.sys), state: 'open' });
    this.decisions.push(dec);
    return dec;
  }
  visibleDecisions() { return this.decisions.filter((d) => d.state === 'open' && (this.spectate || d.seen <= this.year)); }
  decisionOpt(d) { const dec = this.decisions.find((x) => x.id === Number(d.id)); return dec?.opts.find((o) => o.k === d.opt); }
  // 返事を送る (command から)。資金は地球からすぐ払い、効果は返事が届いたときに出る
  sendDecision(d) {
    const dec = this.decisions.find((x) => x.id === Number(d.id));
    if (!dec || dec.state !== 'open') return fail('もう決まっている');
    if (!this.spectate && dec.seen > this.year) return fail('まだ知らせが届いていない');
    const o = dec.opts.find((x) => x.k === d.opt);
    if (!o) return fail('不明な選択肢');
    if ((o.cr || 0) > this.funds(this.cap)) return fail(`資金が足りない (${o.cr} cr)`);
    if (o.cr) { this.earn('grant', -o.cr, this.cap); dec.payer = this.cap; this.cash('grant', o.cr, { way: dec, f: 'cr' }); }
    dec.state = 'sent';
    dec.reply = o.k;
    dec.sentAt = this.year;
    if (dec.kind === 'demand' && o.k === 'awe') {
      const n = Math.max(1, 2 * this.knownRebelFleet(dec.sys));
      const spare = Math.max(0, (this.garrison[this.cap] || 0) - 1);
      if (spare >= 1) this.command('fleet', { from: this.cap, sys: dec.sys, n: Math.min(n, spare), awe: true });
    }
    return { ok: true };
  }
  // 返事が届いた (または期限が過ぎて現地が決めた)
  resolveDecision(id, k, local = false) {
    const dec = this.decisions.find((x) => x.id === Number(id));
    if (!dec || dec.state === 'done') return { ok: true };
    dec.state = 'done';
    dec.reply = k;
    dec.local = local;
    if (dec.kind === 'demand') {
      if (dec.cr) this.release('grant', dec, 'cr', dec.payer ?? 0, dec.payer ?? 0);
      const gv = this.govs[dec.sys];
      if (!gv || gv.unrest?.stage !== 2) return { ok: true };
      if (k === 'accept') this.grantDemand(dec.sys, gv);
      else this.refuseDemand(dec.sys, gv, k === 'awe' ? `${this.homeName()}は要求を拒み、威圧の艦隊を差し向けた` : `${this.homeName()}に要求を拒まれた`, k === 'awe' ? 'awe' : 'refuse');
      return { ok: true };
    }
    const s = STORY[dec.type];
    if (s) s.resolve(this, dec, k, local);
    if (dec.cr) this.release('grant', dec, 'cr', dec.payer ?? 0, dec.payer ?? 0); // 使われなかった額は返す
    return { ok: true };
  }
  // 返事に添えた額を、届いた先で使う (acct: 受け取る帳簿)
  spendDecision(dec, acct) {
    const v = dec.cr || 0;
    if (!v) return;
    this.cash('grant', -v, { way: dec, f: 'cr' });
    this.cash('grant', v, acct);
  }
  decisionsYearly() {
    for (const dec of this.decisions) {
      if (dec.state !== 'open' || dec.kind === 'demand' || this.year < dec.deadline) continue;
      this.resolveDecision(dec.id, dec.def, true);
    }
    // 片づいたものは50年で消す
    this.decisions = this.decisions.filter((d) => d.state !== 'done' || this.year - (d.seen ?? d.year) < 50);
  }

  // --- 語り手: 何も起きない年が続くと、小さな出来事を配る (押す時期と休む時期を交互に) ---
  storyYearly() {
    const s = this.story;
    if (this.year >= s.phaseEnd) {
      s.phase = s.phase === 'on' ? 'off' : 'on';
      s.phaseEnd = this.year + (s.phase === 'on' ? 12 + 8 * this.rand() : 6 + 4 * this.rand());
    }
    if (s.phase !== 'on') return;
    const gap = this.year - s.last;
    if (this.rand() >= clamp(0.15 * (gap - 2), 0, 0.7)) return;
    // 同じ種類は25年に1回まで
    s.recent ??= {};
    const cands = Object.entries(STORY).filter(([type]) => !(this.year - (s.recent[type] ?? -1e9) < 25)).map(([type, def]) => ({ type, def, sys: def.pick(this) })).filter((x) => x.sys !== null && x.sys !== undefined);
    const pick = cands.length ? cands[Math.floor(this.rand() * cands.length)] : null;
    if (!pick) return;
    pick.def.start(this, pick.sys);
    s.recent[pick.type] = this.year;
    s.last = this.year;
  }

  // --- 議会の支持・時代の課題・挑戦・点数 ---
  councilAdd(v, why) {
    this.council = clamp(this.council + v, 0, 100);
    if (why) this.message(`議会の支持 ${v > 0 ? '+' : ''}${v} (${why})`);
  }
  councilYearly() {
    this.council = clamp(this.council - 0.25 - EXHAUST.council * Math.max(0, (this.exhaustion[this.cap] || 0) - 20) + TAX_COUNCIL * (burdenK(this.fiscal || FISCAL_DEFAULT) - 1), 0, 100); // 戦争疲弊が 20 を超えると支持が落ちる。重い税も落とす
    if (this.council < 15) {
      this.event('goal', this.cap, `議会の支持が ${Math.round(this.council)} まで落ち、政権が交代した。国家方針は白紙に戻り、貯めていた政治力を失った`);
      this.policy = null;
      this.pc = 0;
      this.council = 45;
    }
  }
