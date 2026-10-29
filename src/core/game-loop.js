  // --- 種族 ---
  // 入植地に人を加え、種族の構成比を混ぜる。races は加える人々の構成比
  addPeople(c, n, races, edu) {
    const total = c.pop + n;
    if (total <= 0) return;
    this.eduMix(c, n, edu); // 学歴 (economy/demography.js。edu = 来た人の就学年数。回 KE5)
    const out = {};
    for (const [k, v] of Object.entries(c.races || { [HUMAN]: 1 })) out[k] = (out[k] || 0) + v * c.pop / total;
    for (const [k, v] of Object.entries(races)) out[k] = (out[k] || 0) + v * n / total;
    c.races = out;
    c.pop = total;
  }
  // 惑星ごとの種族: 入植地の住民と、同じ惑星の先住民 (奴隷・家畜・独立など)
  speciesOf(sysId, bodyId) {
    const list = [];
    for (const kind of ['planet', 'station']) {
      const c = this.colonyAt(sysId, bodyId, kind);
      if (c) for (const [k, v] of Object.entries(c.races || { [HUMAN]: 1 })) if (v * c.pop >= 0.0005) list.push({ name: k, pop: v * c.pop, role: '市民' });
    }
    const n = this.nativeOf(sysId, bodyId);
    if (n && n.st.status !== 'integrated') {
      const role = n.st.status === 'enslaved' ? SLAVE_TYPES[n.st.slave] : n.st.status === 'subjugated' ? '支配下' : '先住民';
      list.push({ name: n.def.species, pop: n.st.pop, role });
    }
    const merged = {};
    for (const x of list) {
      const k = `${x.name}|${x.role}`;
      merged[k] = merged[k] ? { ...merged[k], pop: merged[k].pop + x.pop } : { ...x };
    }
    return Object.values(merged).sort((a, b) => b.pop - a.pop);
  }

  // --- 時間の進行 ---
  // 試合の乱数 (0以上1未満)。Math.random は使わない
  rand() {
    this.rs = (this.rs + 0x6d2b79f5) >>> 0;
    let t = this.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // 標準正規分布の乱数 (Box–Muller。試合の乱数 rand から)
  randNormal() { return Math.sqrt(-2 * GM.log(1 - this.rand())) * GM.cos(2 * Math.PI * this.rand()); }
  advance(dt) {
    SIM = this;
    let changed = false;
    this.stepping = true; // 試合を進めているあいだ (受注残の記録など、画面からの確かめでは動かさないものに使う)
    while (dt > 1e-9) {
      const h = Math.min(STEP, dt);
      dt -= h;
      // 1歩の前の一覧 (写しは取らず、配列と件数を覚える。これらの一覧は末尾への追加か、別の配列への置き換えでしか変わらないので、
      // 前の配列の先頭から件数ぶんが、1歩の前の中身そのもの)
      const before = GHOST_KINDS.map((k) => [k, this[k], this[k].length]);
      this.year += h;
      for (const gv of Object.values(this.govs)) { gv.led = {}; gv.eled = {}; }
      if (this.arrivals()) changed = true;
      this.economy(h);
      if (this.pirates(h)) changed = true;
      if (this.battles.length) { this.battlesStep(h); changed = true; }
      this.autoTimer += h;
      this.keepGhosts(before);
      if (this.autoTimer >= 1) { this.autoTimer = 0; this.autoDevelop(); this.eachSeat(() => { this.autoDefend(); this.aweYearly(); }); this.migrate(); this.nativesYearly(); this.barracksYearly(); this.warsYearly(); this.realmsArm(); this.pirateDefenseYearly(); this.govsYearly(); this.govDevelopYearly(); this.stationsYearly(); this.routesYearly(); this.tributeYearly(); this.grantsYearly(); this.loyaltyYearly(); this.regimeYearly(); this.bundleYearly(); this.vassalTypesYearly(); this.aiOrdersYearly(); this.realmsYearly(); if (this.spectate) this.eachPlayer(() => this.earthWarYearly()); this.siegesYearly(); this.exhaustionYearly(); this.conferencesYearly(); this.politicsYearly(); this.recordSnapshots(); }
    }
    this.stepping = false;
    return changed;
  }

  // 政治力・議会・時代の課題・挑戦・語り手・決めること・終わりの年 (年1回)。AI が動かす席 (国家選択の AI の国) も同じ仕組みで動き、観戦モードと同じ AI が決める (回 SE5)
  politicsYearly() {
    this.lordsAttendYearly();
    this.diplomacyYearly(); // 遅れて届く外交 (政治。politics/diplomacy.js)
    this.eachSeat(() => {
      this.pcYearly();
      this.councilYearly();
      this.erasYearly();
      this.challengesYearly();
      this.storyYearly();
      this.decisionsYearly();
      if (this.spectate || this.aiSeat()) this.earthPoliticsYearly();
    });
    this.endYearly();
  }
  // 1歩のあいだに一覧から消えた動くものを、到着が地球から見えるまで表示用に残す
  keepGhosts(before) {
    const dest = {
      cargo: (p) => p.path[p.path.length - 1], fleets: (f) => f.to, requests: (q) => q.to, troopMoves: (m) => m.path[m.path.length - 1],
      migrants: (m) => m.toSys, ships: (s) => s.to,
    };
    for (const [k, arr, n] of before) {
      if (this[k] === arr) continue; // 同じ配列のままなら追加しかされておらず、消えたものはない
      const now = new Set(this[k]);
      for (let i = 0; i < n; i++) {
        const o = arr[i];
        if (now.has(o)) continue;
        if (k === 'projects') {
          for (const l of o.legs || []) {
            const until = l.times[l.times.length - 1] + this.lightDelay(o.sys);
            if (until > this.year) this.ghosts.legs.push({ ...l, until });
          }
          continue;
        }
        const until = Math.max(o.arrive ?? this.year, this.year - 1e-9) + this.lightDelay(dest[k](o));
        if (until > this.year) { o.until = until; this.ghosts[k].push(o); }
      }
    }
    // 消えるものがあるときだけ作り直す
    for (const k of Object.keys(this.ghosts)) {
      const g = this.ghosts[k];
      if (g.some((o) => !(o.until > this.year))) this.ghosts[k] = g.filter((o) => o.until > this.year);
    }
  }
  arrivals() {
    let changed = false;
    // 届いた朝貢と資金援助は受け手の政府へ (受け手の政府がなければ送り手へ返す)
    for (const q of this.requests) if (q.kind === 'tribute' && q.arrive <= this.year) this.release('tribute', q, 'amt', q.to, q.from);
    for (const q of this.requests) {
      if (q.kind !== 'grant' || q.arrive > this.year) continue;
      if (!this.govs[q.to]) { this.release('grant', q, 'amt', q.from, q.from); continue; }
      const amt = this.release('grant', q, 'amt', q.to, q.from);
      this.receiveAid(q.to, amt);
      if (this.govs[q.to]?.lord === q.from) this.attend(q.to); // 主人からの資金援助は関与になる
      if (!q.auto) this.message(JA`資金援助 ${fmtAmt(amt)} cr が ${this.system(q.to).name} に届いた`, q.to);
    }
    for (const q of this.requests) {
      if (q.kind !== 'order' || q.arrive > this.year) continue;
      const pi = this.playerOf(q.by ?? 0); // 指令を出したプレイヤー (古い指令は地球)
      if (pi < 0) continue;
      if (this.players.length > 1) this.msgTo = pi;
      this.asPlayer(pi, () => {
      // 艦隊は地球の国の軍なので、その星系の政府の忠誠度に関係なく命令に従う。要求への返事と視察はかならず受け取る
      const ob = ['peace', 'fleet', 'redirect', 'fleetclear', 'decide', 'inspect'].includes(q.act) ? { ok: true } : this.obeys(q.to, q.act);
      const r = ob.ok ? this.exec(q.act, q.d) : ob;
      // 地球からの指令が届いたことは関与になる (放っておかれた年数が0に戻る)
      if (ob.ok && !['fleet', 'redirect', 'fleetclear', 'peace'].includes(q.act)) this.attend(q.to);
      this.message(r.ok ? JA`指令「${q.label}」が ${this.system(q.to).name} に届き、実行された` : JA`指令「${q.label}」は ${this.system(q.to).name} で実行できなかった: ${r.reason}`, q.to);
      });
      this.msgTo = undefined;
    }
    this.requests = this.requests.filter((q) => !['build', 'tribute', 'order', 'grant'].includes(q.kind) || q.arrive > this.year);
    const done = this.projects.filter((j) => j.ready <= this.year);
    if (done.length) {
      changed = true;
      this.projects = this.projects.filter((j) => j.ready > this.year);
      for (const j of done) this.finish(j);
    }
    const arrived = this.ships.filter((s) => s.arrive <= this.year);
    if (arrived.length) {
      changed = true;
      this.ships = this.ships.filter((s) => s.arrive > this.year);
      for (const s of arrived) {
        const t = this.target(s.to, s.body);
        this.survey(s.to);
        let kind = s.kind;
        if (kind === 'planet' && this.blockedByNatives(s.to, s.body)) {
          this.message(JA`${t.name} の先住民に着陸を拒まれた。入植団は軌道上にとどまる`, s.to);
          kind = 'station';
        }
        // 積んできた食料と水は入植先の備蓄に入る (入植できなくても荷は下ろす)
        for (const [r, v] of Object.entries(s.supplies || {})) this.mv(s.to, r, v, 'arrive');
        const joinEscort = (col) => { if (col && s.escort) { col.troops += s.escort.troops; col.slaveTroops += s.escort.slave; } };
        // 開拓資金は新しい政府へ。政府がもうある星系なら、入植者が持ち込んで民間のお金になる
        const seedTo = (acct) => { if (s.seed) { const v = s.seed; this.cash('build', -v, { way: s, f: 'seed' }); this.cash('build', v, acct); } };
        if (this.colonyAt(s.to, s.body, kind)) { joinEscort(this.colonyAt(s.to, s.body, kind)); seedTo({ pv: s.to }); continue; }
        const fresh = !this.govs[s.to];
        if (!this.settlersLand(s, kind, t.name)) { seedTo({ gov: s.from }); continue; } // 乗ってきた人数と年齢で入植地を作る。始まりのうちに絶えたら作らない (船と戦争の ship/settler.js。B-033)
        seedTo(fresh ? { gov: s.to } : { pv: s.to });
        joinEscort(this.colonyAt(s.to, s.body, kind));
        if (kind === 'planet' && this.hostileNatives(s.to, s.body)) this.startWar(s.to, s.body);
        const sup = Object.entries(s.supplies || {}).filter(([, v]) => v > 0).map(([r, v]) => `${RES_LABEL[r]} ${fmtAmt(v)}`).join('・');
        this.event('colony', s.to, JA`${t.name} に${KIND_LABEL[kind]}を設立した (${this.system(s.to).name})${sup ? JA`。積み荷: ${sup}` : ''}`, true);
        if (fresh) this.asRealm(s.from, () => this.councilAdd(1)); // 人間の国の首都が送った入植船で新しい星系を拓いた
      }
    }
    if (this.migrants.some((m) => m.arrive <= this.year)) {
      const due = this.migrants.filter((m) => m.arrive <= this.year);
      this.migrants = this.migrants.filter((m) => m.arrive > this.year);
      for (const m of due) {
        const d = this.colonyByKey(m.to);
        const from = this.colonyByKey(m.from);
        if (!d) continue;
        this.addPeople(d, m.n, m.races || { [HUMAN]: 1 }, m.edu);
        d.migIn = (d.migIn || 0) + m.n;
        this.migLog.unshift({ year: this.year, seen: this.year + this.lightDelay(d.sys), from: from ? from.name : '?', to: d.name, n: m.n });
      }
      this.migLog.length = Math.min(this.migLog.length, 100);
    }
    if (this.troopMoves.some((m) => m.arrive <= this.year)) {
      changed = true;
      const due = this.troopMoves.filter((m) => m.arrive <= this.year);
      this.troopMoves = this.troopMoves.filter((m) => m.arrive > this.year);
      for (const m of due) {
        const d = this.colonyByKey(m.to) || this.coloniesIn(m.path[m.path.length - 1])[0];
        if (!d) continue;
        d.troops += m.troops;
        d.slaveTroops += m.slave;
        this.message(JA`歩兵 ${m.troops + m.slave} 連隊が ${d.name} に到着した`, d.sys);
      }
    }
    const fleets = this.fleets.filter((f) => f.arrive <= this.year);
    if (fleets.length) {
      changed = true;
      this.fleets = this.fleets.filter((f) => f.arrive > this.year);
      for (const f of fleets) {
        this.fleetArrives(f);
        this.survey(f.to);
      }
    }
    // 交易路ごとに距離が違うので、配列の先頭だけでなく到着済みの荷をすべて配る
    if (this.cargo.some((p) => p.arrive <= this.year)) {
      const due = this.cargo.filter((p) => p.arrive <= this.year);
      this.cargo = this.cargo.filter((p) => p.arrive > this.year);
      for (const p of due) {
        const dest = p.path[p.path.length - 1];
        const st = this.stockOf(dest);
        const inb = (this.inbound[dest] ??= zeroRes());
        const legs = this.legsOf(p.path);
        for (const [res, amt] of Object.entries(p.load)) {
          this.mv(dest, res, amt, 'arrive');
          inb[res] = Math.max(0, inb[res] - amt);
          for (const l of legs) l.r.transit[l.dir][res] = Math.max(0, l.r.transit[l.dir][res] - amt);
        }
      }
    }
    return changed;
  }

  // 収支を星系の政府につける。プラスの収入は朝貢の計算に使う
  // 主人から支援物資を受け取る: 代金は払わないかわりに従属が深まる。
  // 受け取った価値 10 cr ごとに忠誠度がすぐ +1 され、依存度 (年に2割ずつ薄れる) が忠誠度の目標を最大 +40 押し上げる
  receiveAid(id, value) {
    const gv = this.gov(id);
    gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + value / 10);
    gv.dep = (gv.dep || 0) + value / 10;
    gv.aidYear = (gv.aidYear || 0) + value;
  }
