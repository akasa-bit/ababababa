  // --- 指令: 地球から他の星系への指示は光速で届き、届いた先の政府が実行する ---
  cmdTarget(act, d) {
    const colSys = (key) => this.colonyByKey(key)?.sys;
    switch (act) {
      case 'send': case 'candsend': case 'fleet': return Number(d.from);
      case 'redirect': return null; // 移動中の艦隊への指令は sendRedirect で送る
      case 'troopsend': return colSys(d.from);
      case 'route2': return Number(d.a);
      case 'uproute': return this.routes.find((r) => r.id === Number(d.route))?.a;
      case 'upgrade': case 'train': case 'focus': return colSys(d.col);
      case 'peace': return Number(d.sys);
      case 'policy': case 'fiscal': return this.cap;
      case 'rule': case 'bundle': case 'jointcut': case 'depose': case 'mandate': case 'governor': case 'inspect': case 'decide': case 'pvdesign': return Number(d.sys);
      default: return d.sys;
    }
  }
  command(act, d) {
    // 政治力: 足りなければ送れない。送れたら払う
    const pc = this.pcCost(act, d);
    if (pc > this.pc + 1e-9) return fail(`政治力が足りない (${pc} 必要、いま ${Math.floor(this.pc)})`);
    const old = this.msgTo;
    if (this.players.length > 1) this.msgTo = this.pi;
    try {
      const r = this.commandRaw(act, d);
      if (r?.ok && pc) this.pc -= pc;
      return r;
    } finally { this.msgTo = old; }
  }
  // 設定の切り替え (自動化など)。ネット対戦ではすべての端末で同じ時点に変わるように、これも命令として扱う
  setSetting(d) {
    const v = d.value;
    if (d.key === 'auto') {
      const id = Number(d.sys);
      if (!this.isColonized(id) || this.realmOf(id) !== this.cap) return fail(`${this.realmName(this.cap)}の星系だけ`);
      this.auto[id] = !!v;
      return { ok: true, msg: `${this.system(id).name} の自動開発を${v ? 'オン' : 'オフ'}にした` };
    }
    if (d.key === 'acked') { this.acked = [...new Set([...(this.acked || []), ...(v || []).map(Number)])].slice(-300); return { ok: true }; }
    const SET = {
      warThreshold: (x) => `戦争方針を「${(WAR_POLICIES.find(([y]) => y === x) || [0, x])[1]}」にした`,
      autoHabitat: (x) => `過密時の居住区の自動拡張を${x ? 'オン' : 'オフ'}にした`,
      autoRoutes: (x) => `混んだ交易路の自動拡張を${x ? 'オン' : 'オフ'}にした`,
      migration: (x) => `恒星間移民を${x ? '許可' : '停止'}した`,
      autoGrant: () => '', autoBuild: () => '',
      autoAwe: (x) => `反乱防止のための威圧を${x ? 'オン' : 'オフ'}にした`,
      autoDefense: (x) => `自動防衛配備を${x ? 'オン' : 'オフ'}にした`,
      regime: (x) => `新しい入植地の統治体制を「${REGIMES[regimeNorm(x)].label}」にした`,
    };
    if (d.key === 'regime' && (!regimeNorm(v) || regimeNorm(v) === 'direct')) return fail('選べない統治体制');
    if (!SET[d.key]) return fail('設定がない');
    const x = d.key === 'warThreshold' ? Number(v) : d.key === 'regime' ? regimeNorm(v) : !!v;
    this[d.key] = x;
    if (d.key === 'autoAwe' && x) this.aweYearly();
    if (d.key === 'autoDefense' && x) this.autoDefend();
    return { ok: true, msg: SET[d.key](x) };
  }
  commandRaw(act, d) {
    if (act === 'set') return this.setSetting(d);
    if (act === 'treaty') return this.submitTreaty(d);
    if (act === 'acceptpeace') return this.acceptPeace(d);
    if (act === 'drop') { this.players[this.pi].human = false; return { ok: true }; } // ネット対戦で接続が切れた国は AI に任せる
    if (act === 'fleet' && !this.ownStackKnown(Number(d.from))) return fail('他国の艦隊には命令できない');
    // 移動中の艦隊への進路変更・指令の取り消し (光速の指令が追いついた地点で効く)
    if (act === 'sendredirect' || act === 'sendclear') {
      const f = this.fleets.find((x) => x.id === Number(d.fleet));
      if (!f || (f.owner ?? 0) !== this.cap) return fail('自国の艦隊ではない');
      return act === 'sendclear' ? this.sendFleetClear(f) : this.sendRedirect(f, Number(d.sys), d.route || []);
    }
    if (act === 'declarewar') return this.declareWar(Number(d.sys));
    if (act === 'pact') return this.proposePact(d); // 遅れて届く外交 (政治。politics/diplomacy.js)
    if (act === 'policy') return this.setPolicy(d.value);
    if (act === 'fiscal') return this.setFiscal(d);
    if (act === 'grant') {
      const to = Number(d.sys);
      if (to === this.cap || !this.isColonized(to) || this.realmOf(to) !== this.cap) return fail(`${this.realmName(this.cap)}の星系にだけ送れる`);
      return this.sendGrant(this.cap, to, Number(d.amt));
    }
    if (act === 'decide') {
      const r = this.sendDecision(d);
      if (!r.ok) return r;
      d = { ...d, sys: Number(d.sys) };
    }
    if (act === 'rule' && d.value !== 'direct' && d.value !== 'delegate') {
      const id = Number(d.sys);
      if (!regimeNorm(d.value)) return fail('不明な統治体制');
      if (this.known(id)?.lord !== this.cap || (this.known(id)?.realm ?? this.cap) !== this.cap) return fail('直属の従属星系だけ統治体制を選べる');
    }
    if (act === 'jointcut' || act === 'depose') {
      const id = Number(d.sys);
      if (this.known(id)?.lord !== this.cap || (this.known(id)?.realm ?? this.cap) !== this.cap || this.known(id)?.direct) return fail('直属の従属星系 (直轄でないもの) だけ');
    }
    if (act === 'bundle') {
      const id = Number(d.sys);
      if (!BUNDLE_ITEMS.includes(d.item) || !BUNDLE_CODES[d.value]) return fail('不明な項目');
      if (this.known(id)?.lord !== this.cap || (this.known(id)?.realm ?? this.cap) !== this.cap || this.known(id)?.direct) return fail('直属の従属星系 (直轄でないもの) とだけ約定を交わせる');
    }
    if (act === 'rule' && d.value === 'direct') {
      const id = Number(d.sys);
      if (this.known(id)?.lord !== this.cap || (this.known(id)?.realm ?? this.cap) !== this.cap) return fail('直属の従属星系だけを直轄にできる');
      if (!this.isDirect(id) && this.directPlanned() >= this.directMax()) return fail(`直轄は ${this.directMax()} 星系まで`);
    }
    // 集結は、それぞれの出発地への指令に分ける
    if (act === 'rally') {
      const from = this.rallySources(Number(d.sys)); // 首都に届いている記録で (B-030。src/ship/fleets.js)
      if (!from.length) return fail('集められる艦隊がない');
      for (const id of from) this.command('fleet', { from: id, sys: d.sys, n: 'all' });
      return { ok: true };
    }
    if (act === 'troopsrally') {
      const to = this.colonyByKey(d.to);
      const src = this.troopRallySources(to); // 首都に届いている記録で (B-030。src/ship/fleets.js)
      if (!src.length) return fail('集められる歩兵がいない');
      for (const c of src) this.command('troopsend', { from: colKey(c), to: d.to, n: 'all' });
      return { ok: true };
    }
    const target = this.cmdTarget(act, d);
    if (target === undefined || target === null || target === this.cap) return this.exec(act, d);
    const arrive = this.year + this.lightDelay(target);
    this.requests.push({ id: this.nextShipId++, kind: 'order', from: this.cap, ...(this.cap !== 0 ? { by: this.cap } : {}), to: target, act, d: { ...d }, label: CMD_LABEL[act] || act, sent: this.year, arrive, state: 'sending' });
    this.message(`${this.system(target).name} へ指令「${CMD_LABEL[act] || act}」を送った (届くまで ${(arrive - this.year).toFixed(1)} 年)`);
    return { ok: true, queued: true };
  }
  exec(act, d) {
    const sys = d.sys === undefined ? undefined : Number(d.sys);
    const body = d.body;
    const n = d.n === 'all' ? Infinity : Number(d.n);
    const col = d.col ? this.colonyByKey(d.col) : null;
    switch (act) {
      case 'send': case 'candsend': return this.dispatch(Number(d.from), sys, body, d.kind);
      case 'upgrade': return col ? this.upgrade(col, d.fac) : fail('入植地がない');
      case 'route': return this.openRoute(sys, Number(d.dest));
      case 'route2': return this.openRoute(Number(d.a), Number(d.b));
      case 'uproute': { const r = this.routes.find((x) => x.id === Number(d.route)); return r ? this.upgradeRoute(r) : fail('交易路がない'); }
      case 'warship': return this.buildWarship(sys, Number(d.n) || 1);
      case 'fleet': {
        const from = Number(d.from);
        if (this.stackRealm(from) !== this.cap) return fail('他国の艦隊には命令できない');
        if (d.aweBack) { // 威圧の艦隊の引き揚げ: 威圧の分だけを動かす (命令で駐留している分はそのまま)
          const k = Math.min(n, this.awe[from] || 0, this.garrison[from] || 0);
          if (k < 1) return fail('威圧の艦隊がいない');
          const held = this.held[from];
          this.awe[from] -= k;
          const r = this.sendFleet(from, sys, k, '[威圧の解除] ');
          if (held !== undefined) this.held[from] = Math.min(held, this.garrison[from] || 0);
          if (r.ok) this.fleets[this.fleets.length - 1].aweBack = true;
          else this.awe[from] += k;
          return r;
        }
        const r = this.sendFleet(from, sys, n, d.awe ? '[威圧] ' : d.auto ? '[自動防衛] ' : '', d.route);
        if (r.ok && d.awe) this.fleets[this.fleets.length - 1].awe = true;
        return r;
      }
      case 'redirect': return this.redirectFleet(Number(d.fleet), sys, d);
      case 'fleetclear': return this.clearFleetOrders(d);
      case 'gift': return this.gift(sys, body);
      case 'integrate': return this.integrate(sys, body);
      case 'conquer': return this.conquer(sys, body);
      case 'enslave': return this.enslave(sys, body);
      case 'slavetype': return this.setSlaveType(sys, body, d.type);
      case 'liberate': return this.liberate(sys, body);
      case 'train': return col ? this.trainTroop(col) : fail('入植地がない');
      case 'troopsend': return this.sendTroops(d.from, d.to, n);
      case 'outpost': return this.buildOutpost(sys, body);
      case 'focus': if (MARKET.buy) return fail('方針はなくなった (就業は値段で決まる)'); if (col && FOCUS[d.value]) { col.focus = d.value; return { ok: true }; } return fail('入植地がない');
      case 'peace': return this.offerPeace(sys);
      case 'rule': return this.setRule(sys, d.value);
      case 'bundle': return this.setBundleItem(sys, d.item, d.value);
      case 'jointcut': return this.setJointCut(sys, !!d.value);
      case 'depose': return this.depose(sys);
      case 'mandate': { const gv = this.govs[sys]; if (!gv || !MANDATES[d.value]) return fail('政府がない'); gv.mandate = d.value; return { ok: true }; }
      case 'pvdesign': return this.setPvDesign(sys, d.value);
      case 'governor': { const gv = this.govs[sys]; if (!gv || !GOVERNOR[d.value]) return fail('政府がない'); gv.governor = d.value; return { ok: true }; }
      case 'inspect': { const gv = this.govs[sys]; if (!gv) return fail('政府がない'); gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 3); return { ok: true }; }
      case 'decide': return this.resolveDecision(d.id, d.opt);
      case 'policy': return this.setPolicy(d.value);
      default: return fail('不明な指令');
    }
  }

  // 交易路網での最短距離 (出発地ごとにキャッシュ。交易路が増えたら作り直す)。
  // ダイクストラ法: 未確定の星系のうち距離が最小 (同じなら番号の小さい方) を確定し、交易路の並び順に隣を緩和する
  reach(a) {
    a = Number(a);
    const sig = `${this.routes.length}:${this.routes[this.routes.length - 1]?.id}`;
    if (this.reachCache?.sig !== sig) {
      // 隣接リスト (交易路の並び順) と区間の航行年数を、交易路が変わるたびに作り直す
      const adj = new Map();
      for (const r of this.routes) {
        if (!adj.has(r.a)) adj.set(r.a, []);
        if (!adj.has(r.b)) adj.set(r.b, []);
        adj.get(r.a).push([r.b, this.shipYears(r.a, r.b)]);
        if (r.b !== r.a) adj.get(r.b).push([r.a, this.shipYears(r.b, r.a)]);
      }
      this.reachCache = { sig, map: {}, adj };
    }
    if (this.reachCache.map[a]) return this.reachCache.map[a];
    const adj = this.reachCache.adj;
    const dist = { [a]: 0 };
    const prev = {};
    const open = [a];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) {
        const k = open[i], u0 = open[bi];
        if (dist[k] < dist[u0] || (dist[k] === dist[u0] && k < u0)) bi = i;
      }
      const u = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      for (const [v, w] of adj.get(u) || []) {
        const d = dist[u] + w;
        if (dist[v] === undefined) { dist[v] = d; prev[v] = u; open.push(v); }
        else if (d < dist[v]) { dist[v] = d; prev[v] = u; }
      }
    }
    return (this.reachCache.map[a] = { dist, prev });
  }
  // 交易路でつながった星系を、交易路網での近い順に (自分は除く。reach と同じく交易路が変わるまで使い回す)
  reachSorted(a) {
    const r = this.reach(a);
    return (r.sorted ??= Object.keys(r.dist).map(Number).filter((id) => id !== a).sort((x, y) => r.dist[x] - r.dist[y]));
  }
  // 軍事以外の船の航路: 交易路をたどり、目的地に最も近い星系まで行ってから最後だけ直行する。
  // 目的地が交易路網の中なら全区間が交易路。戻り値の times は出発からの経過年数
  voyage(a, b, offSpeed = SHIP_SPEED) {
    if (a === b) return { path: [a], times: [0], years: 0 };
    // 航路は交易路の網と距離だけで決まるので、交易路が変わるまで (reachCache が作り直されるまで) 覚えておく。返すのは写し
    const r = this.reach(a);
    const cacheable = typeof a === 'number' && typeof b === 'number';
    const vk = `${a}|${b}|${offSpeed}`;
    const vc = (this.reachCache.voy ??= new Map());
    const hit = cacheable && vc.get(vk);
    if (hit) return { path: hit.path.slice(), times: hit.times.slice(), years: hit.years };
    const { dist, prev } = r;
    let end = a, best = this.sysDist(a, b);
    for (const k of (r.ids ??= Object.keys(dist).map(Number))) {
      const d = this.sysDist(k, b);
      if (d < best - 1e-9 || (Math.abs(d - best) < 1e-9 && dist[k] < dist[end])) { end = k; best = d; }
    }
    const path = [end];
    while (path[0] !== a) path.unshift(prev[path[0]]);
    if (end !== b) path.push(b);
    const times = [0];
    for (let i = 1; i < path.length; i++) {
      const onRoute = !!this.routeBetween(path[i - 1], path[i]);
      times.push(times[i - 1] + this.shipYears(path[i - 1], path[i]) * (onRoute ? 1 : SHIP_SPEED / offSpeed));
    }
    // 加速と減速の遅れ (この試合の physics.accel のとき。人の乗る船の 1g。入植船・移民船・同行する歩兵がこの道のりを使う)
    let ly = 0;
    for (let i = 1; i < path.length; i++) ly += this.sysDist(path[i - 1], path[i]);
    const tt = SIM_ONLY ? this.stopTimes(path, times, (i) => (this.routeBetween(path[i - 1], path[i]) ? SHIP_SPEED : offSpeed), ACCEL.crew)
      : withAccel(times, accelExtra(ly, path.length > 2 || this.routeBetween(path[0], path[1]) ? SHIP_SPEED : offSpeed, ACCEL.crew, this.physics));
    const v = { path, times: tt, years: tt[tt.length - 1] };
    if (cacheable) vc.set(vk, { path: path.slice(), times: tt.slice(), years: v.years });
    return v;
  }
  // 経路 (星系の列) と各星系に着く年から現在位置を求める
  pathPosition(path, times, at = this.year) {
    let i = 0;
    while (i < path.length - 2 && at >= times[i + 1]) i++;
    if (path.length < 2) { const s = this.system(path[0]); return { x: s.x, y: s.y, z: s.z || 0 }; }
    return this.shipPosition({ from: path[i], to: path[i + 1], depart: times[i], arrive: times[i + 1] }, at);
  }

  // 船・艦隊の現在位置 (from→to を直線で移動)
  // 艦隊の位置。進路を変えた艦隊は、それまでの区間 (prev) も覚えていて、昔の時刻ならその区間の位置を返す
  fleetPosition(f, at = this.year) {
    for (const leg of f.prev || []) if (at < leg.cut) return this.shipPosition(leg, at);
    return this.shipPosition(f, at);
  }
  shipPosition(s, at = this.year) {
    const a = s.fromXY || this.system(s.from);
    const b = s.toXY || this.system(s.to);
    const f = clamp((at - s.depart) / Math.max(1e-9, s.arrive - s.depart), 0, 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * f, f };
  }
}

