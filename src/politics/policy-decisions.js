  // 国家方針を変える (命令 policy)。議会の審議にかける (回 SE7・B-022。QD-109 b。politics/support.js の proposeBill)。now = 審議を通さずすぐ (試験から)
  setPolicy(id, now = false) {
    if (!POLICIES[id]) return fail('不明な方針');
    if (this.policy?.id === id) return fail('いまの方針と同じ');
    if (this.policy && this.year - this.policy.since < this.policyYears()) return fail(JA`${Math.ceil(this.policy.since + this.policyYears() - this.year)}年後まで変えられない`);
    return now ? this.applyPolicy(id) : this.proposeBill('policy', id);
  }
  policyYears() { return this.modsOf(this.cap).policyYears; } // 国家方針を変えられる間隔 (長命は 45 年。回 SE8)
  pcCap() { return this.modsOf(this.cap).pcCap; } // 政治力の上限 (賢明は 70。回 SE8)
  applyPolicy(id) {
    this.policy = { id, since: this.year, prev: this.policy?.id ?? null };
    this.event('goal', this.cap, JA`国家方針を「${POLICIES[id].label}」にした (${POLICIES[id].good}。${POLICIES[id].bad})。遠い星系には知らせが光速で届いてから効く`, true);
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
      if (!gv.direct && this.directCount() >= this.directMax()) return fail(JA`直轄は ${this.directMax()} 星系まで`);
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
  // 指令が届くまでの年数。人を送る指令 (視察団・医療団のような team の選択肢) は光速でなく船で行く (B-171。監査の 2.8 の j)
  orderYears(act, d, target) {
    const team = act === 'inspect' || (act === 'decide' && this.decisionOpt(d)?.team);
    return team ? this.shipYears(this.cap, target, !!this.routeBetween(this.cap, target)) : this.lightDelay(target);
  }
  // 返事を送る (command から)。資金は地球からすぐ払い、効果は返事が届いたときに出る
  sendDecision(d) {
    const dec = this.decisions.find((x) => x.id === Number(d.id));
    if (!dec || dec.state !== 'open') return fail('もう決まっている');
    if (!this.spectate && dec.seen > this.year) return fail('まだ知らせが届いていない');
    const o = dec.opts.find((x) => x.k === d.opt);
    if (!o) return fail('不明な選択肢');
    if (o.cr && o.cr > this.funds(this.cap)) return fail(JA`資金が足りない (${o.cr} cr)`); // 費用のない選択肢は、資金がマイナスでも送れる
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
      else this.refuseDemand(dec.sys, gv, k === 'awe' ? JA`${this.homeName()}は要求を拒み、威圧の艦隊を差し向けた` : JA`${this.homeName()}に要求を拒まれた`, k === 'awe' ? 'awe' : 'refuse');
      return { ok: true };
    }
    if (dec.kind === 'pact') { this.resolvePact(dec, k); return { ok: true }; } // 遅れて届く外交 (politics/diplomacy.js)
    if (dec.kind === 'bill') { if (k !== 'wait' && this.bill(dec.type)?.since === dec.since) this.billAct(dec.type, k); return { ok: true }; } // 審議で押し戻された法案 (politics/support.js)
    const s = STORY[dec.type];
    if (s) {
      if (local) this.govDid(dec.sys, JA`「${dec.opts.find((o) => o.k === k)?.label || k}」を選んだ`, JA`${this.homeName()}の返事が期限までに届かず、現地で決めた`);
      s.resolve(this, dec, k, local);
      // 連作: 続きの段を予約する (返事が届いた年から数えて。回 SE3)
      const n = s.next?.(this, dec, k, local);
      if (n && STORY[n.type]) (this.story.queue ??= []).push({ type: n.type, sys: n.sys ?? dec.sys, at: this.year + n.delay, data: n.data || {} });
    }
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
    // 連作の続き: 予約した年が来たら、押す時期・休む時期にかかわらず起こす (その星系がまだ自国のものなら)
    s.queue ??= [];
    const due = s.queue.filter((q) => q.at <= this.year + 1e-9);
    if (due.length) {
      s.queue = s.queue.filter((q) => !due.includes(q));
      for (const q of due) {
        if (!this.isColonized(q.sys) || this.realmOf(q.sys) !== this.cap) continue;
        STORY[q.type].start(this, q.sys, q.data);
        s.last = this.year;
      }
    }
    if (this.year >= s.phaseEnd) {
      s.phase = s.phase === 'on' ? 'off' : 'on';
      s.phaseEnd = this.year + (s.phase === 'on' ? 12 + 8 * this.rand() : 6 + 4 * this.rand());
    }
    if (s.phase !== 'on') return;
    const gap = this.year - s.last;
    if (this.rand() >= clamp(0.15 * (gap - 2), 0, 0.7)) return;
    // 同じ種類は25年に1回まで、1 試合に STORY_MAX 回まで (目標 F19)。連作の続きの段は選ばない
    s.recent ??= {};
    s.count ??= {};
    const cands = Object.entries(STORY).filter(([type, def]) => def.pick && !(this.year - (s.recent[type] ?? -1e9) < 25) && (s.count[type] || 0) < STORY_MAX).map(([type, def]) => ({ type, def, sys: def.pick(this) })).filter((x) => x.sys !== null && x.sys !== undefined);
    const pick = cands.length ? cands[Math.floor(this.rand() * cands.length)] : null;
    if (!pick) return;
    pick.def.start(this, pick.sys);
    s.recent[pick.type] = this.year;
    s.count[pick.type] = (s.count[pick.type] || 0) + 1;
    s.last = this.year;
  }

  // --- 議会の支持・時代の課題・挑戦・点数 ---
  councilAdd(v, why) {
    this.council = clamp(this.council + v, 0, 100);
    if (why) this.message(JA`議会の支持 ${v > 0 ? '+' : ''}${v} (${why})`);
  }
  councilYearly() {
    this.council = clamp(this.council - 0.25 * this.modsOf(this.cap).councilDrift - EXHAUST.council * Math.max(0, (this.exhaustion[this.cap] || 0) - 20) + LOSS.council * (Object.values(this.policyLoss(this.cap)).reduce((a, v) => a + v, 0) + INFL_LOSS * Math.abs(this.inflOf(this.cap) - CB.pistar) + this.rsxLoss(this.cap)), 0, 100); // 戦争疲弊が 20 を超えると支持が落ちる。首都の家計の損 (税・消費税・関税。回 KE8・B-012) と、物価の目標 2% からの外れ (QD-27 = b。回 KE9) と、債務の再編のあと 2 年 (回 KE10・B-125) も落とす
    if (this.council < 15) {
      this.event('goal', this.cap, JA`議会の支持が ${Math.round(this.council)} まで落ち、政権が交代した。国家方針は白紙に戻り、貯めていた政治力を失った`);
      this.policy = null;
      this.pc = 0;
      this.council = 45;
    }
  }
