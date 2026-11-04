  // --- 国どうしの威圧 (回 AI7・B-305・W6-Q3 = a。COERCE は politics/coerce-consts.js。docs/ai-behavior.md の 14) ---
  // 宣戦の見込みが線を越えた国 (ship/war-ai.js の realmsYearly と ship/earth-war.js の spectateDeclare から。best = { r, v, z }):
  // 届く途中か返事待ちの威圧がなければ、年 chance の確率で先に威圧する。その相手への威圧の返事を待っていれば、何もしない。ほかの相手への返事を待っていれば、前のとおり宣戦する
  aiPress(root, best) {
    if (COERCE.on) {
      const open = this.coerce.filter((o) => o.from === root);
      if (open.some((o) => o.to === best.r)) return;
      if (!open.length && this.rand() < COERCE.chance && this.coerceSend(root, best.r, best.v, best.z)) return;
    }
    this.aiDeclare(root, best.r, best.z); // 宣戦と、理由の内訳の知らせ (politics/threat.js。回 AI2)
  }
  // 点 d で求める条件 (r の首都に届いた記録の、e の星系): 従属 (点が足りて近ければ、それだけ) → r の首都に近い星系 → 交易協定 → 資金。値段は講和会議と同じ (ship/war-peace.js の treatyTerms)
  coerceTerms(r, e, d) {
    const c = { loser: e, bids: [{ realm: r, pts: d }] };
    c.sys = this.galaxy.systems.filter((x) => x.id !== e && this.seenBy(r, x.id)?.[1] === e).map((x) => x.id);
    c.cash = Math.min(TREATY.cashMax, Math.floor(Math.max(0, this.gov(e).credits) / TREATY.cash));
    const all = this.treatyTerms(c);
    const v = all.find((t) => t.id === 'v');
    if (v && d >= v.cost && this.sysDist(r, e) <= 30) return { terms: [{ k: 'v', c: v.cost }], pts: v.cost };
    const sys = all.filter((t) => t.sys !== undefined).sort((x, y) => this.sysDist(r, x.sys) - this.sysDist(r, y.sys));
    const trade = !this.pactBetween(r, e, 'trade') && this.pactAllowed(r, e, 'trade') ? [{ id: 't', cost: COERCE.tradePts }] : [];
    const terms = [];
    let left = d;
    for (const t of [...sys, ...trade, ...all.filter((x) => x.id[0] === 'c')]) if (t.cost <= left) { terms.push({ k: t.id, c: t.cost }); left -= t.cost; }
    return { terms, pts: d - left };
  }
  // 条件の文 (例: 「A・B の明け渡し・交易協定・資金 2,000 cr」)
  coerceText(o) {
    const parts = [], sys = o.terms.filter((t) => t.k[0] === 's').map((t) => this.system(Number(t.k.slice(1))).name), cash = o.terms.filter((t) => t.k[0] === 'c').length;
    if (o.terms.some((t) => t.k === 'v')) parts.push(JA`${this.realmName(o.to)}の従属 (配下の星系ごと)`);
    if (sys.length) parts.push(JA`${sys.join('・')} の明け渡し`);
    if (o.terms.some((t) => t.k === 't')) parts.push(JA`交易協定 (関税 0)`);
    if (cash) parts.push(JA`資金 ${fmtAmt(cash * TREATY.cash)} cr`);
    return parts.join(JA`・`);
  }
  // いまも果たせる条件 (星系がまだ相手のもの・交易協定をまだ結んでいない)
  coerceValid(o) {
    return o.terms.filter((t) => (t.k === 't' ? !this.pactBetween(o.from, o.to, 'trade') && this.pactAllowed(o.from, o.to, 'trade') : t.k[0] === 's' ? Number(t.k.slice(1)) !== o.to && this.realmOf(Number(t.k.slice(1))) === o.to : true));
  }
  // 威圧を送る (光速で相手の首都に届く)。理由の内訳は宣戦と同じ (politics/threat.js の aiWarReason。F30)
  coerceSend(r, e, v, z) {
    const t = this.coerceTerms(r, e, Math.min(100, Math.round(COERCE.ask * v)));
    if (!t.terms.length) return false;
    const why = this.aiWarReason(r, e, z);
    const o = { id: this.nextShipId++, st: 'go', from: r, to: e, year: this.year, at: this.year + this.sysDist(r, e), terms: t.terms, pts: t.pts, ships: Math.round(this.realmShips(r)), z };
    this.coerce.push(o);
    const list = this.coerceText(o);
    this.event('politics', r, JA`${this.realmName(r)}が${this.realmName(e)}に艦隊 ${o.ships} を見せて、${list}を求めた (${o.pts} 点。${why})`, false);
    this.aiNote(r, JA`${this.realmName(e)}に艦隊 ${o.ships} を見せて、${list}を求めた (${o.pts} 点。${why})`);
    return true;
  }
  // 年 1 回 (realmsYearly の始め): 届いた威圧と返事
  coerceYearly() {
    if (!this.coerce.length) return;
    const due = this.coerce.filter((o) => o.st !== 'ask' && o.at <= this.year + 1e-9);
    if (!due.length) return;
    this.coerce = this.coerce.filter((o) => !due.includes(o));
    for (const o of due) { if (o.st === 'go') this.coerceArrive(o); else this.coerceBack(o); }
  }
  // 威圧が相手の首都に届いた。届く前に戦争になった・どちらかが国でなくなった・果たせる条件が残っていなければ、消える (返事は出ない)
  coerceArrive(o) {
    const { from: r, to: e } = o;
    if (!this.realmAlive(r) || !this.realmAlive(e) || this.atWar(r, e)) return;
    o.terms = this.coerceValid(o);
    o.pts = o.terms.reduce((k, t) => k + t.c, 0);
    if (!o.terms.length) return;
    if (this.isHuman(e) && !this.spectate) { this.coerceAsk(o); this.memAdd(r, e, 'coerce', e, COERCE.mem); return; }
    const a = this.coerceJudge(e, r, o.pts);
    this.memAdd(r, e, 'coerce', e, COERCE.mem); // 威圧された記憶 (politics/memory.js)。判断のあとに足す (この判断には効かない)
    this.aiNote(e, JA`${this.realmName(r)}の威圧 (${this.coerceText(o)}。${o.pts} 点) を${a.ok ? '飲んだ' : '断った'} (${a.why})`);
    this.coerceReply(o, a.ok);
  }
  // AI の国 (と観戦の人間の代わり) の判断: 戦えば見込む点 (受け入れる線の点 + 記憶のずれ。読み違いはその場で引く) が −(求められた点 + 譲る面目) 以下なら飲む
  coerceJudge(e, r, pts) {
    const z = this.misread(), o = {};
    const v = this.reservation(e, r, z, 0, o) + this.aiWarBias(e, r);
    const mw = this.aiWarWhy(e, r), it = o.inner ? this.innerText(o.inner) : '';
    const why = JA`首都に届いた記録で: 艦隊 自分 ${Math.round(o.ours)}・相手 ${Math.round(o.theirs)}${o.allies >= 0.5 ? JA` (相手の同盟国 ${Math.round(o.allies)} を含む)` : ''}・勝つ見込み ${Math.round(100 * o.p)}%・戦えば見込む点 ${Math.round(v)}・譲る点 −${pts}・譲る面目 −${COERCE.face}${mw ? JA`・${mw}` : ''}${it ? JA`・${it}` : ''}`;
    return { ok: pts + COERCE.face <= -v, v, why };
  }
  // 人間の国には「決めること」として届く (届いた所 = 自分の首都なので、すぐ見える)。見立ては交渉の模型の受け入れる線 (読み違いなし)
  coerceAsk(o) {
    const { from: r, to: e } = o, list = this.coerceText(o), s = {};
    const v = this.reservation(e, r, 0, 0, s);
    this.asRealm(e, () => {
      const dec = this.addDecision({ kind: 'coerce', sys: e, from: r, cid: o.id, deadline: this.year + COERCE.replyYears, def: 'refuse',
        text: JA`${this.realmName(r)}が艦隊 ${o.ships} を見せて、${list}を求めてきた。首都に届いた記録で: ${this.realmName(r)}の艦隊 ${Math.round(s.theirs)}${s.allies >= 0.5 ? JA` (同盟国 ${Math.round(s.allies)} を含む)` : ''}・自分 ${Math.round(s.ours)}・勝つ見込み ${Math.round(100 * s.p)}%・戦えば見込む戦勝点 ${Math.round(v)} (求められたものは ${o.pts} 点)。返事は光速で ${this.sysDist(e, r).toFixed(1)} 年かけて届く。断れば、${this.realmName(r)}は戦争に訴えるかもしれない。${COERCE.replyYears} 年のうちに返事を出さなければ断る。`,
        opts: [{ k: 'accept', label: '飲む', note: JA`いま${list}を譲る` }, { k: 'refuse', label: '断る', note: JA`${this.realmName(r)}が宣戦するかもしれない` }] });
      o.dec = dec.id;
    });
    o.st = 'ask';
    this.coerce.push(o);
  }
  // 人間の国の返事 (policy-decisions.js の resolveDecision から)
  coerceDecided(dec, k) {
    const o = this.coerce.find((x) => x.id === dec.cid && x.st === 'ask');
    if (!o) return;
    this.coerce = this.coerce.filter((x) => x !== o);
    if (!this.realmAlive(o.from) || !this.realmAlive(o.to) || this.atWar(o.from, o.to)) return;
    o.terms = this.coerceValid(o);
    o.pts = o.terms.reduce((n, t) => n + t.c, 0);
    this.coerceReply(o, k === 'accept');
  }
  // 返事: 飲めば条件をいま果たし、返事は光速で威圧した国の首都へ戻る
  coerceReply(o, ok) {
    const { from: r, to: e } = o, list = this.coerceText(o);
    const got = ok ? this.coerceYield(o) : [];
    this.event('politics', e, ok ? JA`${this.realmName(e)}が${this.realmName(r)}の威圧に屈した (${got.length ? got.join('・') : JA`果たせる条件はなかった`})` : JA`${this.realmName(e)}が${this.realmName(r)}の威圧 (${list}) をはねつけた`, ok ? this.isHuman(r) : this.isHuman(e));
    const { dec, ...rest } = o;
    this.coerce.push({ ...rest, st: 'back', ok: ok ? 1 : 0, at: this.year + this.sysDist(e, r) });
  }
  // 条件を果たす (星系の明け渡しと資金は講和条約と同じ形。ship/war-peace.js の resolveConference)
  coerceYield(o) {
    const { from: r, to: e } = o, got = [];
    for (const t of this.coerceValid(o)) {
      if (t.k === 'v') { if (this.realmAlive(e)) { this.surrender(e, r); got.push(JA`従属`); } }
      else if (t.k === 't') { this.makePact(r, e, 'trade'); got.push(JA`交易協定`); }
      else if (t.k[0] === 's') {
        const s = Number(t.k.slice(1));
        Object.assign(this.gov(s), { lord: r, independent: false, loyalty: 30, friend: 0 });
        got.push(this.system(s).name);
      } else {
        const amt = Math.min(TREATY.cash, Math.max(0, this.gov(e).credits));
        if (amt <= 0) continue;
        this.cash('treaty', -amt, { gov: e });
        this.cash('treaty', amt, { gov: r });
        got.push(JA`資金 ${fmtAmt(amt)} cr`);
      }
    }
    return got;
  }
  // 返事が威圧した国の首都に届いた。断られたら、考え直して宣戦するか (脅しを実行する。引き下がる面目 audience のぶん宣戦に寄る)、引き下がる。
  // 考え直しは、送ったときの見立て (読み違い z) のまま、首都に届いた新しい記録で (断られたことは相手の強さの知らせにしない)
  coerceBack(o) {
    const { from: r, to: e } = o;
    if (!this.realmAlive(r)) return;
    if (o.ok) { this.aiNote(r, JA`${this.realmName(e)}が威圧 (${this.coerceText(o)}) を飲んだと知らせが届いた`); return; }
    if (!this.realmAlive(e) || this.atWar(r, e)) return;
    const z = Number.isFinite(o.z) ? o.z : 0, v = this.reservation(r, e, z, 0) + this.claimBonus(r, e) + this.aiWarBias(r, e);
    const bar = this.pactBars(r, e) ? JA`協定で宣戦できない` : this.aiEnemiesOf(r).length ? JA`ほかの国と交戦中` : this.sysDist(r, e) > BARGAIN.warDist || this.seenBy(r, e)?.[1] !== e ? JA`届かない` : '';
    if (!bar && v + COERCE.audience > BARGAIN.declare) { this.aiDeclare(r, e, z, JA`威圧を断られた・引き下がる面目 +${COERCE.audience}`); return; }
    this.aiNote(r, JA`${this.realmName(e)}に威圧を断られ、引き下がった (${bar || JA`見込む点 ${Math.round(v)}・引き下がる面目 +${COERCE.audience}・宣戦の線 ${BARGAIN.declare}`})`);
    this.event('politics', r, JA`${this.realmName(r)}が${this.realmName(e)}への威圧を引っ込めた`, this.isHuman(e));
  }
