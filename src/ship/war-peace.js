  lastPeace(key) {
    let best = null;
    for (const r of this.peaces) if (r.key === key && (!best || r.year > best.year)) best = r;
    return best;
  }
  // 戦っている (と、その場の軍が思っている) か: 戦争中か、終戦の知らせがまだ届いていない。
  // 知らせは講和の結ばれた星系から owner の主星 (首都) へ光速で届き、そこから星系 x の艦隊へ光速で伝えられる
  fightingAt(owner, target, x) {
    if (this.atWar(owner, target)) return true;
    if (owner === target) return false;
    const rec = this.lastPeace(this.warKey(owner, target));
    if (!rec) return false;
    const cap = this.system(owner);
    return this.year < rec.year + distance(this.system(rec.from), cap) + distance(cap, this.system(x));
  }
  warKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
  atWar(a, b) { return a !== b && this.realmWars[this.warKey(a, b)] !== undefined; }
  // root の国と交戦中の国 (首都) の一覧
  enemiesOf(root) {
    return Object.keys(this.realmWars).map((k) => k.split('|').map(Number)).filter((p) => p.includes(root)).map((p) => (p[0] === root ? p[1] : p[0]));
  }
  // 国の名前。国家選択の国は決めた名前、独立した星系の国は「星系の名前 + 接尾辞」(接尾辞は星系ごとに決まる)
  realmName(root) { return this.nationOf(root)?.name || (root === 0 ? '地球の国' : `${this.system(root).name}${SECEDE_SUFFIX[hashSeed(`${this.galaxy.seed}/${root}`) % SECEDE_SUFFIX.length]}`); }
  // 地球 (プレイヤー) が知っている戦争: 開戦の知らせが光速で地球に届いたもの (観戦モードはすべて)
  // 終わった戦争も、終戦の知らせが地球に届くまでは交戦中に見える (開戦を知っていた場合)
  warKnown(key) {
    if (this.realmWars[key] !== undefined) {
      if (this.spectate) return true;
      const news = this.warNews[key];
      return !news || this.year >= news.year + this.lightDelay(news.from);
    }
    if (this.spectate) return false;
    const rec = this.lastPeace(key);
    if (!rec || this.year >= rec.year + this.lightDelay(rec.from)) return false;
    return !rec.news || rec.news.year + this.lightDelay(rec.news.from) <= this.year;
  }
  knownAtWar(a, b) { return a !== b && this.warKnown(this.warKey(a, b)); }
  // 地球の知る限り、星系 a と b の国が交戦中か (交易路の開設先の候補から外すのに使う)
  knownHostile(a, b) {
    const realm = (id) => (id === this.cap ? this.realmOf(id) : this.known(id)?.realm ?? this.cap);
    return this.knownAtWar(realm(a), realm(b));
  }
  knownWarKeys() { return [...new Set([...Object.keys(this.realmWars), ...this.peaces.map((r) => r.key)])].filter((k) => this.warKnown(k)); }
  knownEnemiesOf(root) {
    return this.knownWarKeys().map((k) => k.split('|').map(Number)).filter((p) => p.includes(root)).map((p) => (p[0] === root ? p[1] : p[0]));
  }
  // 戦争の開戦年・仕掛けた国 (終わったが知らせが届いていない戦争も)
  warStart(key) { return this.realmWars[key] ?? this.lastPeace(key)?.start; }
  warAggressor(key) { return this.realmWars[key] !== undefined ? this.warBy[key] : this.lastPeace(key)?.by; }
  // 地球から見た国の戦力: 把握している星系の駐留艦隊の合計
  knownRealmShips(root) { return this.knownSystems().filter((x) => (x.id === this.cap ? this.realmOf(x.id) : this.known(x.id)?.realm ?? this.cap) === root).reduce((k, x) => k + this.knownGarrison(x.id), 0); }
  // 地球から見えている建設中の事業: 太陽系はいまのもの、ほかの星系は光が届いている記録のもの
  knownProjects() {
    const out = this.projects.filter((j) => j.sys === this.cap);
    for (const x of this.knownSystems()) if (x.id !== this.cap) for (const j of this.known(x.id)?.projects || []) out.push({ ...j, sys: x.id });
    return out;
  }
  // 開戦。by = 仕掛けた国、target = 仕掛けられた国、from = 知らせが広がり始める星系
  beginWar(by, target, from = by) {
    const key = this.warKey(by, target);
    this.realmWars[key] = this.year;
    this.warStats[key] = { k: {}, t: {} };
    if (BARGAIN.on) this.warStats[key].z = { [by]: this.misread(), [target]: this.misread() }; // 国ごとの読み違い (自分だけが知っている)
    this.warBy[key] = by;
    this.warNews[key] = { year: this.year, from };
  }
  // 国でなくなった (首都が攻め落とされた・従属した) 側の戦争を片づける
  cleanWars() {
    const alive = (r) => this.isColonized(r) && this.realmOf(r) === r;
    for (const k of Object.keys(this.realmWars)) {
      const [a, b] = k.split('|').map(Number);
      if (!alive(a) || !alive(b)) { delete this.realmWars[k]; delete this.warBy[k]; delete this.warNews[k]; }
    }
  }
  // --- 戦争疲弊・戦勝点 ---
  exhaust(root, v) { if (root !== undefined && root !== null) this.exhaustion[root] = clamp((this.exhaustion[root] || 0) + v, 0, 100); }
  // 艦隊戦で沈んだ艦隊を数える (by = 沈めた国、lost = 沈められた国)
  warLoss(by, lost, n) {
    if (n <= 0) return;
    const st = this.warStats[this.warKey(by, lost)];
    if (st) st.k[by] = (st.k[by] || 0) + n;
    this.exhaust(lost, EXHAUST.ship * n);
  }
  // 星系を攻め落とした
  warTake(by, lost) {
    const st = this.warStats[this.warKey(by, lost)];
    if (st) st.t[by] = (st.t[by] || 0) + 1;
    this.exhaust(lost, EXHAUST.system);
  }
  // a から見た b との戦争の戦勝点
  warScore(a, b) {
    const st = this.warStats[this.warKey(a, b)];
    if (!st) return 0;
    return Math.round(clamp(WARSCORE.ship * ((st.k[a] || 0) - (st.k[b] || 0)) + WARSCORE.system * ((st.t[a] || 0) - (st.t[b] || 0)), -100, 100));
  }
  // 年 1 回: 戦っている国は疲れ、平和な国は回復する
  exhaustionYearly() {
    const roots = new Set([...this.colonizedSystems().map((x) => this.realmOf(x.id)), ...Object.keys(this.exhaustion).map(Number)]);
    for (const r of roots) {
      if (!this.isColonized(r) || this.realmOf(r) !== r) { delete this.exhaustion[r]; continue; }
      const wars = this.enemiesOf(r).length;
      const besieged = this.sieges.filter((g) => this.realmOf(g.sys) === r).length;
      this.exhaust(r, wars ? EXHAUST.warYear * wars + EXHAUST.siegeYear * besieged : -EXHAUST.peaceYear);
      if (!this.exhaustion[r]) delete this.exhaustion[r];
    }
    for (const k of Object.keys(this.warStats)) if (this.realmWars[k] === undefined) delete this.warStats[k];
    this.peaceOffers = this.peaceOffers.filter((o) => o.until > this.year && this.realmWars[o.key] !== undefined);
  }
  // --- 講和 ---
  // 講和が決まった: 戦勝点が勝っている側が講和会議で条件を選ぶ (差が小さければ白紙講和)
  makePeace(a, b, from) {
    const ws = this.warScore(a, b);
    if (Math.abs(ws) < TREATY.white) {
      this.endWar(a, b, from);
      this.event('politics', from, `${this.realmName(a)}と${this.realmName(b)}が白紙講和を結んだ (戦勝点 ${ws})`, this.isHuman(a) || this.isHuman(b));
      return;
    }
    const [w, l] = ws > 0 ? [a, b] : [b, a];
    this.startConference(l, [{ realm: w, pts: Math.abs(ws) }], from);
  }
  // 講和会議を開く。loser = 負けた国、winners = [{ realm, pts }]。
  // 勝った国は持ち点 (戦勝点、100 まで) で条件を選ぶ。複数の国が勝っていれば同時に入札し、同じ条件を選んだら持ち点の多い国が取る。
  // 人間の国は 3 年のうちに条件を選ぶ (選ばなければ自動で選ぶ)。戦争は会議が開いた時点で終わる
  startConference(loser, winners, from = loser) {
    for (const w of winners) this.endWar(w.realm, loser, from);
    const bids = winners.filter((w) => w.pts >= 1).map((w) => ({ realm: w.realm, pts: Math.min(100, Math.round(w.pts)), picks: null }));
    if (!bids.length) return;
    const c = { id: this.nextShipId++, loser, year: this.year, until: this.year + TREATY.years, from, bids };
    for (const b of c.bids) if (!this.isHuman(b.realm)) b.picks = this.aiTreatyPicks(c, b);
    this.event('politics', from, `${this.realmName(loser)}との講和会議が開かれた (${c.bids.map((b) => `${this.realmName(b.realm)} 持ち点 ${b.pts}`).join('・')})`, c.bids.some((b) => this.isHuman(b.realm)) || this.isHuman(loser));
    if (c.bids.every((b) => b.picks)) return this.resolveConference(c);
    this.conferences.push(c);
  }
  // 会議で選べる条件
  treatyTerms(c) {
    const l = c.loser;
    const out = [];
    if (c.bids.length === 1) out.push({ id: 'v', label: `${this.realmName(l)}を従属させる (配下の星系ごと)`, cost: TREATY.vassal });
    for (const x of this.realmSystems(l)) {
      if (x.id === l) continue;
      const pop = this.coloniesIn(x.id).reduce((k, col) => k + col.pop, 0);
      out.push({ id: `s${x.id}`, sys: x.id, label: `${x.name} を割譲させる`, cost: 5 + Math.min(25, Math.round(Math.sqrt(pop) / 4)) });
    }
    const cash = Math.min(TREATY.cashMax, Math.floor(Math.max(0, this.gov(l).credits) / TREATY.cash));
    for (let i = 1; i <= cash; i++) out.push({ id: `c${i}`, label: `賠償金 ${fmtAmt(TREATY.cash)} cr (${i} 口目)`, cost: TREATY.cashPts });
    return out;
  }
  // AI の選び方: 近くて持ち点が足りれば従属、そうでなければ自分の首都に近い星系から、残りは賠償金
  aiTreatyPicks(c, b) {
    const terms = this.treatyTerms(c);
    const picks = [];
    if (b.pts >= TREATY.vassal && terms.some((t) => t.id === 'v') && this.sysDist(b.realm, c.loser) <= 30) picks.push('v');
    picks.push(...terms.filter((t) => t.sys !== undefined).sort((x, y) => this.sysDist(b.realm, x.sys) - this.sysDist(b.realm, y.sys)).map((t) => t.id));
    picks.push(...terms.filter((t) => t.id[0] === 'c').map((t) => t.id));
    return picks;
  }
  // 人間の国が条件を選ぶ (命令 treaty)
  submitTreaty(d) {
    const c = this.conferences.find((x) => x.id === Number(d.id));
    const b = c?.bids.find((x) => x.realm === this.cap);
    if (!b) return fail('講和会議がない');
    const ids = new Set(this.treatyTerms(c).map((t) => t.id));
    b.picks = (Array.isArray(d.picks) ? d.picks : []).filter((x) => ids.has(x));
    if (c.bids.every((x) => x.picks)) this.resolveConference(c);
    return { ok: true, msg: '講和会議に条件を出した' };
  }
  conferencesYearly() {
    for (const c of [...this.conferences]) {
      if (c.until > this.year) continue;
      for (const b of c.bids) if (!b.picks) b.picks = this.aiTreatyPicks(c, b); // 期限までに選ばなかった
      this.resolveConference(c);
    }
  }
  // 同時入札: 各国が、まだ取られていない条件のうち持ち点で払える最初のものに入札する。
  // 同じ条件に入札が重なれば、残りの持ち点の多い国が取る (同じなら先の国)。取れなかった国はその条件を外して次の回へ
  resolveConference(c) {
    this.conferences = this.conferences.filter((x) => x !== c);
    const terms = new Map(this.treatyTerms(c).map((t) => [t.id, t]));
    const left = c.bids.map((b) => b.pts);
    const lists = c.bids.map((b) => [...(b.picks || [])]);
    const won = c.bids.map(() => []);
    const taken = new Set();
    for (let round = 0; round < 200; round++) {
      const offers = new Map();
      c.bids.forEach((b, i) => {
        const id = lists[i].find((x) => terms.has(x) && !taken.has(x) && terms.get(x).cost <= left[i] && !(x === 'v' && taken.size) && !taken.has('v'));
        if (id) (offers.get(id) || offers.set(id, []).get(id)).push(i);
      });
      if (!offers.size) break;
      for (const [id, who] of offers) {
        const i = who.sort((x, y) => left[y] - left[x] || x - y)[0];
        taken.add(id);
        left[i] -= terms.get(id).cost;
        won[i].push(id);
        for (const j of who) if (j !== i) lists[j] = lists[j].filter((x) => x !== id);
      }
    }
    const l = c.loser;
    const lines = [];
    c.bids.forEach((b, i) => {
      const got = [];
      if (!this.isColonized(b.realm) || this.realmOf(b.realm) !== b.realm) won[i] = []; // 会議のあいだに国でなくなった
      for (const id of won[i]) {
        const t = terms.get(id);
        if (id === 'v') { if (this.isColonized(l) && this.realmOf(l) === l) { this.surrender(l, b.realm); got.push('従属'); } }
        else if (t.sys !== undefined) {
          if (this.realmOf(t.sys) !== l) continue;
          const gv = this.gov(t.sys);
          Object.assign(gv, { lord: b.realm, independent: false, loyalty: 30, friend: 0 });
          got.push(this.system(t.sys).name);
        } else {
          const amt = Math.min(TREATY.cash, Math.max(0, this.gov(l).credits));
          this.cash('treaty', -amt, { gov: l });
          this.cash('treaty', amt, { gov: b.realm });
          got.push(`賠償金 ${fmtAmt(amt)} cr`);
        }
      }
      lines.push(`${this.realmName(b.realm)}: ${got.length ? got.join('・') : 'なし'}`);
    });
    this.event('politics', c.from, `${this.realmName(l)}との講和条約が結ばれた (${lines.join(' / ')})`, c.bids.some((b) => this.isHuman(b.realm)) || this.isHuman(l));
  }
  // 人間の国への講和の申し入れに応じる (命令 acceptpeace)
  acceptPeace(d) {
    const o = this.peaceOffers.find((x) => x.key === d.key && x.to === this.cap);
    if (!o || this.realmWars[o.key] === undefined) return fail('講和の申し入れがない');
    this.peaceOffers = this.peaceOffers.filter((x) => x !== o);
    this.makePeace(o.from, o.to, this.cap);
    return { ok: true };
  }
  realmShips(root) {
    return this.realmSystems(root).reduce((k, x) => k + (this.garrison[x.id] || 0), 0)
      + this.fleets.filter((f) => (f.owner ?? 0) === root).reduce((k, f) => k + f.n, 0)
      + this.sieges.filter((g) => g.realm === root).reduce((k, g) => k + g.ships, 0)
      + this.battles.reduce((k, b) => k + (b.realm === root ? b.a : 0) + (this.realmOf(b.sys) === root ? b.d : 0), 0);
  }

