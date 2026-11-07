  // --- 艦隊群 (依頼 2026-11-07 の FU-1。HOI4 の軍 (師団をまとめて役割を与える) を参考にした。docs/fleet-groups.md) ---
  // 艦隊は星系ごとの数 (garrison) で持つので、群の艦は次の 4 つで持つ:
  //   駐留: gship[星系][群] = 数 (駐留の数のうち、その群の分)。移動中: 艦隊の f.g。艦隊戦: 艦の札 (5 つめの値が群・6 つめが「退かない」)。攻囲: g.gs[群] = 数。
  // 群に入っていない艦は前と同じ (自動防衛配備が動かす。命令で送った分は held で動かさない)。群の艦は、自動防衛配備でも、群を言わない指令でも動かさない。
  // 群の決まり (役割・撤退・拠点) の変更は首都から光速で広がり、光が届いた所から効く (届く前の所では前の決まり。財政の fiscalFor と同じ形)。
  // 群への出し入れは、艦隊のいる星系への光速の指令 (fgassign・fgfree)。AI の国は群を使わない (群がなければ、どこも前と同じに動く)

  // 星系 sys が、国 owner から見て他国の星系か (他国の入植星系か、他国の艦隊のいる入植していない星系)。自動の艦隊は攻め込まない (war-ai.js の fleetArrives)
  foreignAt(owner, sys) {
    if (this.isColonized(sys)) return this.realmOf(sys) !== owner;
    return (this.garrison[sys] || 0) > 0 && this.stackRealm(sys) !== owner;
  }
  fgOf(realm = this.cap) { return this.fgroups.filter((x) => x.realm === realm && x.role !== 'gone'); }
  fgGet(id) { return id === undefined || id === null ? null : this.fgroups.find((x) => x.id === Number(id)) || null; }
  // 星系 sys で効いている群の決まり。変更は首都 (from) から光速で広がり、光が届く前の所では前の決まり (prev)
  fgEff(gr, sys) {
    if (!gr) return null;
    if (!gr.prev || sys === undefined || sys === null || this.year >= gr.at + this.sysDist(gr.from, Number(sys)) - 1e-9) return gr;
    return { ...gr, ...gr.prev };
  }
  // 群がその星系では解かれている (解く決まりが光で届いた) か、もうない
  fgLoose(gid, sys) { const e = this.fgEff(this.fgGet(gid), sys); return !e || e.role === 'gone'; }
  // 星系 sys の、群ごとの艦の数 (解かれた群は除く)
  fgAt(sys) {
    const m = this.gship[sys];
    if (!m) return null;
    const out = {};
    for (const [gid, n] of Object.entries(m)) if (n > 0 && !this.fgLoose(gid, sys)) out[gid] = n;
    return Object.keys(out).length ? out : null;
  }
  // 星系 sys の群の艦の数 (駐留の数まで)
  fgCount(sys) {
    if (!this.gship[sys]) return 0;
    let k = 0;
    for (const n of Object.values(this.fgAt(sys) || {})) k += n;
    return Math.min(k, this.garrison[sys] || 0);
  }
  fgFree(sys) { return Math.max(0, (this.garrison[sys] || 0) - this.fgCount(sys)); }
  fgAdd(sys, gid, n) {
    if (!(n > 0) || !this.fgGet(gid)) return;
    const m = (this.gship[sys] ??= {});
    m[gid] = (m[gid] || 0) + n;
  }
  fgTake(sys, gid, n) {
    const m = this.gship[sys];
    if (!m || !(m[gid] > 0)) return 0;
    const k = Math.min(n, m[gid]);
    m[gid] -= k;
    if (m[gid] <= 0) delete m[gid];
    if (!Object.keys(m).length) delete this.gship[sys];
    return k;
  }
  // 艦隊戦の艦の札: 群の艦は [耐久, 組織力, 退くまで, 0 (要塞でない), 群, 退かない]。退かないは、その星系で効いている群の決まり
  fgShip(gid, sys) { const e = this.fgEff(this.fgGet(gid), sys); return [1, 1, -1, 0, Number(gid), e?.ret === 'never' ? 1 : 0]; }
  // 星系 sys に駐留している群の艦を、艦隊戦の防衛側 (s = 1) の艦にする (群の数は駐留から外す。艦隊戦の数 b.d は呼ぶ側が足す)。
  // 入れるのは、その側の国の群だけ (独立で星系の持ち主が変わったときなどに残っていた、ほかの国の群の数は捨てる)
  fgIntoBattle(b, s, sys) {
    const m = this.fgAt(sys);
    delete this.gship[sys];
    if (!m) return;
    const realm = s === 0 ? b.realm : this.isColonized(sys) ? this.realmOf(sys) : this.stackRealm(sys);
    const u = s === 0 ? b.ua : b.ud;
    let room = this.garrison[sys] || 0;
    for (const [gid, n] of Object.entries(m)) {
      if (this.fgGet(gid)?.realm !== realm) continue;
      const k = Math.min(n, room);
      for (let i = 0; i < k; i++) u.push(this.fgShip(gid, sys));
      room -= k;
      if (k > 0) b.fg = 1;
    }
  }
  // 星系 sys の群の艦の数を、合わせて n までに削って取り出す (駐留から外す。独立戦争で、駐留していた艦が攻め側になるとき)
  fgTakeAll(sys, n) {
    const m = this.fgAt(sys);
    delete this.gship[sys];
    if (!m) return null;
    const out = {};
    let room = n;
    for (const [gid, k] of Object.entries(m)) { const t = Math.min(k, room); if (t > 0) { out[gid] = t; room -= t; } }
    return Object.keys(out).length ? out : null;
  }
  // 艦隊戦の艦の札から、群ごとの数 ({ 群: 数 })
  fgTags(u) { const t = {}; for (const x of u || []) if (!x[3] && x[4] !== undefined && x[4] !== null) t[x[4]] = (t[x[4]] || 0) + 1; return t; }
  // 艦隊戦のあいだに、群の「退かない」の決まりが光で届いたら、艦の札を合わせる
  fgBattleSync(b) {
    if (!b.fg) return;
    for (const u of [b.ua, b.ud]) for (const x of u) if (!x[3] && x[4] !== undefined && x[4] !== null) { const e = this.fgEff(this.fgGet(x[4]), b.sys); x[5] = e?.ret === 'never' ? 1 : 0; }
  }
  // 退いた群の艦の行き先: その星系で効いている群の拠点 (自国の星系で、戦場でなければ)。なければ、いちばん近い自国の星系
  fgRetreatTo(realm, sys, gid) {
    const e = this.fgEff(this.fgGet(gid), sys);
    const base = e?.base;
    if (base !== undefined && base !== null && base !== sys && this.isColonized(base) && this.realmOf(base) === realm) return base;
    return this.retreatHome(realm, sys);
  }
  // 群の艦が戦場から退く: 群の拠点へ向かい、群に残る (前は「自動」の艦隊になり、着いた先で自動防衛配備に回されていた)
  fgRetreat(realm, sys, gid, n) {
    if (!(n > 0)) return;
    const to = this.fgRetreatTo(realm, sys, gid);
    if (to === undefined) return;
    this.pushFleet({ id: this.nextShipId++, from: sys, to, n, owner: realm, g: Number(gid), ret: 1, depart: this.year, arrive: this.year + this.fleetYears(sys, to) });
  }
  // 艦隊戦・攻囲から退く艦を、群の分は群の拠点へ (fgRetreat)、残りを返す
  fgSplitRetreat(realm, sys, tags, n) {
    let rest = n;
    for (const [gid, k] of Object.entries(tags || {})) {
      const m = Math.min(k, rest);
      if (m > 0 && this.fgGet(gid)) { this.fgRetreat(realm, sys, gid, m); rest -= m; }
    }
    return rest;
  }
  // 攻囲の群の数を、攻囲の艦の数に合わせる (補給不足で脱落したとき)。群に入っていない艦から先に減り、群は番号の大きいものから
  fgTrimSiege(g) {
    if (!g.gs) return;
    let over = Object.values(g.gs).reduce((k, v) => k + v, 0) - g.ships;
    for (const gid of Object.keys(g.gs).sort((a, b) => b - a)) { if (over <= 0) break; const k = Math.min(over, g.gs[gid]); g.gs[gid] -= k; over -= k; if (g.gs[gid] <= 0) delete g.gs[gid]; }
    if (!Object.keys(g.gs).length) delete g.gs;
  }
  // 1 歩ごと (群があるときだけ): 群の数を駐留の数に合わせる (海賊・歩兵の戦い・光速の一撃・独立などで駐留が減ったとき。番号の大きい群から減らす。
  // 他国の艦隊になった星系・解かれた群の分は外す)。年の切れ目には、守備の群のうち拠点の外にいる艦が拠点へ戻る。解いた群は、決まりが銀河の端まで届いたら消す
  fgStep() {
    for (const key of Object.keys(this.gship)) {
      const sys = Number(key), m = this.gship[key], realm = this.stackRealm(sys);
      for (const gid of Object.keys(m)) { const gr = this.fgGet(gid); if (!gr || gr.realm !== realm || this.fgLoose(gid, sys) || !(m[gid] > 0)) delete m[gid]; }
      let over = Object.values(m).reduce((k, v) => k + v, 0) - (this.garrison[sys] || 0);
      for (const gid of Object.keys(m).sort((a, b) => b - a)) { if (over <= 0) break; const k = Math.min(over, m[gid]); m[gid] -= k; over -= k; if (m[gid] <= 0) delete m[gid]; }
      if (!Object.keys(m).length) delete this.gship[key];
    }
    if (this.autoTimer === 0) {
      for (const key of Object.keys(this.gship)) {
        const sys = Number(key);
        for (const [gid, n] of Object.entries(this.gship[key] || {})) {
          const e = this.fgEff(this.fgGet(gid), sys);
          if (e?.role !== 'hold' || e.base === undefined || e.base === null || e.base === sys || this.battleAt(sys)) continue;
          if (!this.isColonized(e.base) || this.realmOf(e.base) !== this.fgGet(gid).realm) continue;
          this.sendFleet(sys, e.base, n, '', null, undefined, Number(gid));
        }
      }
      const span = this.intelSpanYears();
      if (this.fgroups.some((x) => x.role === 'gone' && this.year >= x.at + span)) this.fgroups = this.fgroups.filter((x) => !(x.role === 'gone' && this.year >= x.at + span));
    }
  }
  // --- 群の命令 (首都で決める。群の決まりは光速で広がる。群への出し入れは艦隊のいる星系への光速の指令) ---
  fgNew(d) {
    if (this.fgOf().length >= FG.max) return fail(JA`艦隊群は ${FG.max} まで`);
    const role = FG.roles.includes(d.role) ? d.role : 'atk', ret = FG.rets.includes(d.ret) ? d.ret : 'org';
    const base = d.base === undefined || d.base === null || d.base === '' ? this.cap : Number(d.base);
    const no = this.fgroups.filter((x) => x.realm === this.cap).length + 1;
    const gr = { id: this.nextShipId++, realm: this.cap, name: String(d.name || JA`第${no}艦隊群`).slice(0, 24), role, ret, base, at: this.year, from: this.cap, prev: null };
    this.fgroups.push(gr);
    return { ok: true, msg: JA`${gr.name} (${FG_ROLE_LABEL[role]}) を作った`, id: gr.id };
  }
  fgSet(d) {
    const gr = this.fgGet(d.g);
    if (!gr || gr.realm !== this.cap || gr.role === 'gone') return fail('艦隊群がない');
    if (d.name !== undefined) { gr.name = String(d.name).slice(0, 24) || gr.name; return { ok: true }; } // 名前は決まりでないので、すぐ変わる
    const next = { role: gr.role, ret: gr.ret, base: gr.base };
    if (d.role !== undefined) { if (!FG.roles.includes(d.role) && d.role !== 'gone') return fail('不明な役割'); next.role = d.role; }
    if (d.ret !== undefined) { if (!FG.rets.includes(d.ret)) return fail('不明な撤退の決まり'); next.ret = d.ret; }
    if (d.base !== undefined) { const b = Number(d.base); if (!this.isColonized(b) || this.realmOf(b) !== this.cap) return fail(JA`${this.realmName(this.cap)}の星系だけを拠点にできる`); next.base = b; }
    // 前の決まりは、いま首都で効いているもの (光がまだ届いていない所は、その前の決まりのまま扱う: 1 段だけ覚える)
    gr.prev = { role: gr.role, ret: gr.ret, base: gr.base };
    Object.assign(gr, next, { at: this.year, from: this.cap });
    const what = next.role === 'gone' ? JA`${gr.name} を解いた (艦は群から外れて自動防衛配備に任せる。決まりが光で届いた所から)` : JA`${gr.name} の決まりを変えた (${FG_ROLE_LABEL[next.role]}・${FG_RET_LABEL[next.ret]}・拠点 ${this.system(next.base).name}。光で届いた所から効く)`;
    return { ok: true, msg: what };
  }
  // 群への出し入れ (艦隊のいる星系で実行する光速の指令): n 艦隊を群 g に入れる (from = 前の群。なければ群に入っていない艦から)
  fgAssign(d) {
    const sys = Number(d.sys), gr = this.fgGet(d.g);
    if (!gr || gr.realm !== this.cap || this.fgLoose(gr.id, sys)) return fail('艦隊群がない');
    if (this.stackRealm(sys) !== this.cap) return fail('他国の艦隊には命令できない');
    const from = d.from === undefined || d.from === null || d.from === '' ? null : Number(d.from);
    const have = from === null ? this.fgFree(sys) : this.fgAt(sys)?.[from] || 0;
    const n = Math.min(d.n === 'all' ? Infinity : Number(d.n) || 0, have);
    if (n < 1) return fail('入れられる艦隊がない');
    if (from !== null) this.fgTake(sys, from, n);
    else if (this.held[sys]) this.held[sys] = Math.min(this.held[sys], this.fgFree(sys) - n); // 命令で駐留していた分から群に入れる
    this.fgAdd(sys, gr.id, n);
    return { ok: true, msg: JA`${this.system(sys).name} の ${n} 艦隊を ${gr.name} に入れた` };
  }
  // 群から外す: 外した艦は群に入っていない艦 (自動防衛配備に任せる)
  fgFreeShips(d) {
    const sys = Number(d.sys), gid = Number(d.g);
    if (this.stackRealm(sys) !== this.cap) return fail('他国の艦隊には命令できない');
    const k = this.fgTake(sys, gid, d.n === 'all' ? Infinity : Number(d.n) || 0);
    return k ? { ok: true, msg: JA`${this.system(sys).name} の ${k} 艦隊を群から外した (自動防衛配備に任せる)` } : fail('外す艦隊がない');
  }
  // 地球に届いている、星系 id の群ごとの艦の数 (首都はいまの値)
  knownFg(id) { return id === this.cap ? this.fgAt(id) : this.known(id)?.fg || null; }
  knownFgN(id) { return id === this.cap ? this.fgCount(id) : this.known(id)?.fgn || 0; }

  // 星系の欄と星間地図のための、艦隊戦の様子 (依頼 FU-1): 両軍の数・要塞の残り・始まる前の見込み・沈んだ艦・退いた艦・いま退いている艦・退く先
  battleSnap(id) {
    const b = this.battleAt(id);
    if (!b) return null;
    const def = this.isColonized(id) ? this.realmOf(id) : this.stackRealm(id);
    const fort = b.fortIn === undefined ? (this.isColonized(id) ? this.fortLevel(id) : 0) : Math.max(0, b.fortIn - (b.fortLost || 0));
    const going = (u) => (u || []).filter((x) => !x[3] && x[2] >= 0).length;
    return {
      realm: b.realm, a: b.a, d: b.d, a0: b.a0, d0: b.d0, start: b.start, ea: this.fleetEff(b.sup), ed: this.fleetEff(b.dsup), fort, odds: b.odds ?? null,
      sunk: [...(b.sunk || [0, 0])], esc: [...(b.esc || [0, 0])], going: [going(b.ua), going(b.ud)], to: [this.retreatHome(b.realm, id) ?? null, this.retreatHome(def, id) ?? null],
      ...(b.fg ? { fga: this.fgTags(b.ua), fgd: this.fgTags(b.ud) } : {}),
    };
  }
