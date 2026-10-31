  // 重要なイベント。ログにも流す
  // 遠くの星系の出来事は、光が地球に届くまでプレイヤーには分からない (seen = 地球に知らせが届く年)
  // 光の遅れは、いま操作しているプレイヤーの首都から数える
  lightDelay(sys) { return sys === undefined || sys === null || sys === this.cap ? 0 : this.sysDist(this.cap, sys); }
  event(kind, sys, text, good = false) {
    if (STORY_RESET.has(kind) && this.story) this.story.last = this.year; // 語り手は、何かが起きた年から数え直す
    this.events.unshift({ id: this.nextShipId++, year: this.year, seen: this.year + this.lightDelay(sys), kind, sys, text, good, ...(this.players[this.pi]?.ai ? { p: this.pi } : {}) }); // AI の席の出来事は、その席だけに見せる
    this.events.length = Math.min(this.events.length, 300);
    this.message(text, sys, kind);
  }
  // 知らせが届く年: 出来事の星系からいまのプレイヤーの首都まで光が届く年 (地球が首都なら記録した seen のまま)
  seenOf(e) { return e.sys === undefined || e.sys === null ? e.seen ?? e.year : e.year + this.lightDelay(e.sys); }
  knownEvents() {
    const mine = (e) => e.p === undefined || e.p === this.pi; // ほかの席 (AI の国) だけの出来事は出さない
    if (this.spectate) return this.events.filter((e) => e.year <= this.year && mine(e)).sort((a, b) => b.year - a.year);
    if (this.cap !== 0 || this.players.length > 1) return this.events.filter(mine).map((e) => ({ ...e, seen: this.seenOf(e) })).filter((e) => e.seen <= this.year).sort((a, b) => b.seen - a.seen);
    return this.events.filter((e) => (e.seen ?? e.year) <= this.year).sort((a, b) => (b.seen ?? b.year) - (a.seen ?? a.year));
  }
  // 充足率などの悪化と回復を見張る (ばたつかないよう 93% 未満で発生、99% 以上で解消)。
  // 判定には1年程度でならした値を使い、荷の到着の波で発生と解消を繰り返さないようにする。
  // 不足は「状態」として入植地に持たせ (地図・イベントタブの「いま起きている問題」に出る)、出来事の記録には
  // 長く続いたもの (WATCH_LOG_YEARS 年以上) だけを書く。解消は、記録した不足についてだけ書く
  watch(c, key, raw, kind, onText, offText) {
    if (!c.alerts) c.alerts = {};
    if (!c.avg) c.avg = {};
    if (!c.alertSince) c.alertSince = {};
    const v = c.avg[key] = c.avg[key] === undefined ? raw : c.avg[key] + (raw - c.avg[key]) * Math.min(1, this.stepH || 0.25);
    if (!c.alerts[key] && v < 0.93) {
      c.alerts[key] = true;
      c.alertSince[key] = this.year;
    } else if (c.alerts[key] && v >= 0.99) {
      c.alerts[key] = false;
      const logged = c.alertSince[key] === null;
      delete c.alertSince[key];
      if (logged) this.event(kind, c.sys, offText, true);
    } else if (c.alerts[key] && c.alertSince[key] !== null && this.year - (c.alertSince[key] ??= this.year) >= (WATCH_LOG_YEARS[kind] ?? 0)) {
      const years = this.year - c.alertSince[key];
      c.alertSince[key] = null; // 記録した印
      this.event(kind, c.sys, `${onText()}${years >= 1.5 ? JA` — ${Math.round(years)}年続いている` : ''}`);
    }
  }

  // msgTo: 人間が複数いるとき、そのプレイヤーだけに見せる記録 (命令の結果など) の宛先
  message(text, sys, kind) {
    const to = this.msgTo ?? (this.players[this.pi]?.ai ? this.pi : undefined); // AI の席の記録は、その席だけに見せる
    this.log.unshift({ year: this.year, seen: this.year + this.lightDelay(sys), text, ...(kind ? { kind } : {}), ...(sys !== undefined && sys !== null ? { sys } : {}), ...(to !== undefined ? { p: to } : {}) });
    this.log.length = Math.min(this.log.length, 120);
  }
  knownLog() {
    if (this.players.length > 1) return this.knownLogRaw().filter((l) => l.p === undefined || l.p === this.pi);
    return this.knownLogRaw();
  }
  knownLogRaw() {
    if (this.spectate) return this.log.filter((l) => l.year <= this.year).sort((a, b) => b.year - a.year);
    if (this.cap !== 0 || this.players.length > 1) return this.log.map((l) => ({ ...l, seen: this.seenOf(l) })).filter((l) => l.seen <= this.year).sort((a, b) => b.seen - a.seen);
    return this.log.filter((l) => (l.seen ?? l.year) <= this.year).sort((a, b) => (b.seen ?? b.year) - (a.seen ?? a.year));
  }

  // --- 星系の様子の記録 (地球から見えるのは光が届いた時点の様子) ---
  snapshot(id) {
    const gv = this.govs[id];
    const fl = this.flow[id];
    return {
      year: this.year,
      ...(this.stackOwner[id] !== undefined && !this.isColonized(id) ? { stack: this.stackOwner[id] } : {}),
      cols: this.coloniesIn(id).map((c) => ({
        key: colKey(c), name: c.name, kind: c.kind, body: c.body, pop: c.pop, cap: this.capOf(c), growth: c.growth || 0,
        sat: c.sat ? { ...c.sat } : null, focus: c.focus, sh: c.sh ? { ...c.sh } : null, inc: c.inc, lv: { ...c.lv }, troops: c.troops, slaveTroops: c.slaveTroops,
        races: { ...(c.races || {}) }, alerts: { ...(c.alerts || {}) }, industry: c.industry, slaveWork: c.slaveWork, ages: c.age ? this.ageShares(c) : null,
      })),
      stock: { ...this.stockOf(id) },
      prod: fl ? { ...fl.prod } : zeroRes(), cons: fl ? { ...fl.cons } : zeroRes(),
      garrison: this.garrison[id] || 0, fort: this.forts?.[id] || 0, held: this.held[id] || 0, awe: this.awe[id] || 0, supply: this.supplied[id]?.k,
      projects: this.projects.filter((j) => j.sys === id).map((j) => ({ type: j.type, n: j.n, col: j.col, fac: j.fac, body: j.body, to: j.to, kind: j.kind, start: j.start, ready: j.ready, label: j.label })),
      credits: gv ? gv.credits : 0, bond: gv?.bond || 0, hh: gv?.hh || 0, loan: gv?.loan || 0, income: gv ? this.income(id) : 0, lord: gv ? gv.lord : null, energy: gv?.E || 0, power: this.power(id),
      ...(() => { // その星系で効いている財政 (標準でないものだけ)
        if (!this.isColonized(id)) return {};
        const root = this.realmOf(id), f = this.fiscalAt(id), t = taxRateOf(f.tax), w = this.budgetAt(root, id, 'welfare'), sc = this.budgetAt(root, id, 'security');
        const l = f.ctax > 0 || f.tariff > 0 ? this.policyLoss(id, f) : null; // 家計の損の割合 (消費税・関税があるときだけ。回 KE8・B-012)
        const pi = this.inflOf(id); // 国の物価の上がり方 (忠誠度の物価の項。回 KE9)
        return { ...(Math.abs(t - MARKET.tax) > 1e-9 ? { tax: t } : {}), ...(l ? { ctax: f.ctax || 0, tariff: f.tariff || 0, loss: l } : {}), ...(w ? { welfare: w } : {}), ...(sc ? { security: sc } : {}), ...(Math.abs(pi - CB.pistar) > 1e-9 ? { infl: pi } : {}) };
      })(),
      outposts: this.outposts.filter((o) => o.sys === id).map((o) => ({ body: o.body, lv: o.lv })),
      natives: Object.fromEntries(this.system(id).bodies.filter((b) => this.natives[`${id}|${b.id}`]).map((b) => [b.id, { ...this.natives[`${id}|${b.id}`] }])),
      wars: this.wars.filter((w) => w.sys === id).map((w) => ({ body: w.body, progress: w.progress, enemy: w.enemy })),
      unrest: gv?.unrest?.stage ? { ...gv.unrest } : null, attended: gv ? gv.attended ?? gv.founded : undefined, direct: !!gv?.direct, mandate: gv?.mandate || 'balanced', governor: gv?.governor || 'ask',
      taxFree: gv?.taxFree || 0, autonomy: gv?.autonomy || 0, ...(gv?.regime ? { regime: gv.regime } : {}), ...(gv?.law ? { law: gv.law } : {}), ...(gv?.fact ? { fact: gv.fact } : {}), ...(gv?.elite ? { elite: gv.elite } : {}), ...(gv?.include ? { include: { ...gv.include } } : {}), ...(this.isColonized(id) ? { groups: this.groupsOf(id) } : {}), ...(gv?.lord2 !== undefined ? { lord2: gv.lord2 } : {}), ...(gv?.jointCut ? { jointCut: true } : {}), ...(gv?.arrears ? { arrears: gv.arrears } : {}), ...(gv?.scar ? { scar: gv.scar } : {}), ...(gv?.did?.length ? { did: gv.did.slice() } : {}), ...(this.exhaustion?.[id] && this.isColonized(id) && this.realmOf(id) === id ? { exh: this.exhaustion[id] } : {}), policy: this.isColonized(id) ? this.policyAt(id) : null,
      loyalty: gv ? gv.loyalty ?? LOYALTY_START : null, orders: gv ? gv.orders || 0 : 0, fear: gv ? gv.fear || 0 : 0, friend: gv ? gv.friend || 0 : 0, lordTrade: gv ? gv.lordTrade || 0 : 0, realm: this.isColonized(id) ? this.realmOf(id) : null, independent: !!gv?.independent, founded: gv ? gv.founded : undefined, aid: gv ? gv.aid || 0 : 0, dep: gv ? gv.dep || 0 : 0,
      siege: (() => { const g = this.sieges.find((x) => x.sys === id); return g ? { realm: g.realm, ships: g.ships, progress: g.progress, eff: this.fleetEff(g.sup, g.line), line: g.line } : null; })(),
      battle: (() => { const b = this.battleAt(id); return b ? { realm: b.realm, a: b.a, d: b.d, a0: b.a0, d0: b.d0, start: b.start, ea: this.fleetEff(b.sup, b.line), ed: this.fleetEff(b.dsup, 0), line: b.line } : null; })(),
    };
  }
  // --- AI の国の知っていること (光の遅れ) ---
  // 知らせが銀河の端まで届く年数 (いちばん遠い 2 つの星系の光年)。セーブに入れず、初めて要るときに計算する (読み込みの直後でも同じ値。回 FU3 で 4 か所の式をまとめた)
  intelSpanYears() { return (this.intelSpan ??= Math.ceil(Math.max(...this.galaxy.systems.map((a) => Math.max(...this.galaxy.systems.map((b) => distance(a, b))))))); }
  // 年ごとに、入植星系と艦隊のいる星系の [年, 国, 駐留艦隊, よその艦隊] を記録する (前と同じなら足さない)。
  // よその艦隊 = { [国]: n }: その星系を出発してまだ移動中の艦隊 (出発は見えるが、着いたかはまだ見えない)・その星系を攻囲している艦隊・攻めている艦隊。
  // いちばん遠い 2 つの星系の距離より古い記録は、もうどこからも見えないので、その時点の 1 つだけ残して捨てる
  recordIntel() {
    const span = this.intelSpanYears() + 1;
    const away = {};
    const add = (id, r, n) => { if (n > 0) { const a = (away[id] ??= {}); a[r] = (a[r] || 0) + n; } };
    for (const f of this.fleets) add(f.from, f.owner ?? 0, f.n);
    for (const g of this.sieges) add(g.sys, g.realm, g.ships);
    for (const b of this.battles) { add(b.sys, b.realm, b.a); if (this.isColonized(b.sys)) add(b.sys, this.realmOf(b.sys), b.d); }
    const ids = new Set([...this.colonizedSystems().map((x) => x.id), ...Object.keys(this.garrison).filter((k) => this.garrison[k] > 0).map(Number), ...Object.keys(away).map(Number), ...Object.keys(this.intel).map(Number)]);
    for (const id of ids) {
      const realm = this.isColonized(id) ? this.realmOf(id) : null, gar = this.garrison[id] || 0, out = away[id] || null;
      const list = (this.intel[id] ??= []);
      const last = list[list.length - 1];
      if (!last || last[1] !== realm || last[2] !== gar || JSON.stringify(last[3] || null) !== JSON.stringify(out)) list.push(out ? [this.year, realm, gar, out] : [this.year, realm, gar]);
      let i = 0;
      while (i + 1 < list.length && list[i + 1][0] <= this.year - span) i++;
      if (i) list.splice(0, i);
    }
  }
  // 星系 viewer から見えている星系 id の [年, 国, 駐留艦隊, よその艦隊]。光がまだ届いていない分は見えない。
  // その年の記録がなければ、いちばん古い記録 (試合の始まりの様子) を使う
  seenBy(viewer, id) {
    if (viewer === id) { const list = this.intel[id]; return [this.year, this.isColonized(id) ? this.realmOf(id) : null, this.garrison[id] || 0, list?.[list.length - 1]?.[3]]; }
    const list = this.intel[id];
    if (!list?.length) return null;
    const t = this.year - this.sysDist(viewer, id);
    let best = list[0];
    for (const e of list) { if (e[0] <= t) best = e; else break; }
    return best;
  }
  // 国 root (の首都) が知っている、国 e の艦隊の数: 駐留している分と、出発したのが見えてまだ着いたのが見えていない分・攻囲や艦隊戦の分
  seenShips(root, e) {
    let n = 0;
    for (const id of Object.keys(this.intel)) { const v = this.seenBy(root, Number(id)); if (v) n += (v[1] === e ? v[2] : 0) + (v[3]?.[e] || 0); }
    return n;
  }
  // 国 root (の首都) が、その戦争の開戦の知らせを受け取ったか
  aiKnowsWar(root, key) {
    if (this.realmWars[key] === undefined) return false;
    const news = this.warNews[key];
    return !news || this.year >= news.year + this.sysDist(news.from, root);
  }
  aiEnemiesOf(root) { return this.enemiesOf(root).filter((e) => this.aiKnowsWar(root, this.warKey(root, e))); }
  // 国 root (の首都) が開戦を知った年。講和を考えるときの「戦争の年数」は、ここから数える
  aiWarSince(root, key) {
    const news = this.warNews[key];
    return news ? Math.max(this.realmWars[key], news.year + this.sysDist(news.from, root)) : this.realmWars[key];
  }
  // 届いた艦隊の指令を実行する (その星系がまだ同じ国で、相手とまだ交戦中で、艦隊が残っていれば)
  // 首都 root から、星系 from の艦隊を to へ送る指令を出す (首都の艦隊ならその場で。ほかは指令が光速で届いてから)
  aiOrder(root, from, to, n) {
    if (from === root) { this.sendFleet(from, to, n); return; }
    if (this.aiOrders.some((o) => o.from === from)) return; // 前の指令がまだ届いていない
    this.aiOrders.push({ at: this.year + this.sysDist(root, from), realm: root, from, to, n });
  }
  aiOrdersYearly() {
    const due = this.aiOrders.filter((o) => o.at <= this.year + 1e-9);
    if (!due.length) return;
    this.aiOrders = this.aiOrders.filter((o) => o.at > this.year + 1e-9);
    for (const o of due) {
      if (!this.isColonized(o.from) || this.realmOf(o.from) !== o.realm || this.realmOf(o.realm) !== o.realm) continue;
      const dest = this.isColonized(o.to) ? this.realmOf(o.to) : null;
      if (dest === null || (dest !== o.realm && !this.atWar(o.realm, dest))) continue; // 自国の星系へは、救援・集結 (B-168)
      const n = Math.min(o.n, (this.garrison[o.from] || 0) - 1);
      if (n >= 1) this.sendFleet(o.from, o.to, n);
    }
  }
  recordSnapshots() {
    this.recordIntel();
    if (BARGAIN.on) this.recordShips();
    this.snapVer = (this.snapVer || 0) + 1; // 記録が変わった (knownSystems の使い回しをやめる)
    const ids = new Set([...this.colonizedSystems().map((x) => x.id), ...Object.keys(this.garrison).filter((k) => this.garrison[k] > 0).map(Number)]);
    const caps = this.players.map((p) => p.cap); // AI の席も、光の遅れのぶん古い記録で判断する
    for (const id of ids) {
      if (caps.every((c) => c === id)) continue; // 席の首都はいつも最新が見える
      const list = (this.snaps[id] ??= []);
      list.push(this.snapshot(id));
      // どの席からも見えなくなった古い記録は捨てる (いちばん遠い席の分まで残す)
      const seenYear = this.year - Math.max(...caps.map((c) => (c === id ? 0 : this.sysDist(c, id))));
      let i = 0;
      while (i + 1 < list.length && list[i + 1].year <= seenYear) i++;
      if (i) list.splice(0, i);
    }
  }
  // 地球から見えている星系の様子。太陽系はいつも最新。まだ光が届いていなければ null
  known(id) {
    if (id === this.cap) return this.snapshot(id);
    // 観戦モードでは、いまの実際の様子 (同じ時刻のあいだは使い回す)
    if (this.spectate) {
      if (!this.live || this.live.year !== this.year) this.live = { year: this.year, map: new Map() };
      if (!this.live.map.has(id)) this.live.map.set(id, this.isColonized(id) || this.garrison[id] > 0 ? this.snapshot(id) : null);
      return this.live.map.get(id);
    }
    const list = this.snaps[id];
    if (!list) return null;
    const seenYear = this.year - this.lightDelay(id);
    let best = null;
    for (const x of list) if (x.year <= seenYear) best = x;
    // 古い記録には新しい資源 (奴隷) がない
    if (best) for (const o of [best.stock, best.prod, best.cons]) for (const r of RES) if (o && !Number.isFinite(o[r])) { o[r] = 0; SNAP_JSON.delete(best); }
    return best;
  }
  // 地球の知っている入植星系 (太陽系を含む)。known の結果は、年・記録・観戦モードの「いまの様子」が同じなら変わらないので、
  // そのあいだは一覧を使い回す (地図・パネル・自動化で何度も呼ぶので)。呼び出し側が並べ替えてもよいように写しを返す
  knownSystems() {
    const live = this.spectate ? this.live : null;
    const c = this.ksCache;
    if (c && c.year === this.year && c.cap === this.cap && c.spectate === this.spectate && c.snaps === this.snaps && c.ver === this.snapVer && c.live === live && (live !== null) === this.spectate) return c.list.slice();
    const list = this.galaxy.systems.filter((x) => x.id === this.cap || this.known(x.id)?.cols.length);
    this.ksCache = { year: this.year, cap: this.cap, spectate: this.spectate, snaps: this.snaps, ver: this.snapVer, live: this.spectate ? this.live : null, list };
    return list.slice();
  }
  // 帝国タブに出す星系: 国家選択のある試合では自分の国 (と家臣) の星系だけ。従来の試合は把握しているすべての入植星系
  knownOwnSystems() {
    const list = this.knownSystems();
    return this.nations ? list.filter((x) => x.id === this.cap || (this.known(x.id)?.realm ?? this.cap) === this.cap) : list;
  }
  knownColonies(id) {
    if (id === this.cap) return this.coloniesIn(id);
    const k = this.known(id);
    return k ? k.cols.map((c) => ({ ...c, sys: id })) : [];
  }
  knownColonyAt(id, body, kind) { return this.knownColonies(id).find((c) => c.body === body && c.kind === kind); }
  knownColonized(id) { return this.knownColonies(id).length > 0; }
  knownGarrison(id) { return id === this.cap ? this.garrison[id] || 0 : this.known(id)?.garrison || 0; }
  knownOutposts(id) { return id === this.cap ? this.outposts.filter((o) => o.sys === id) : (this.known(id)?.outposts || []).map((o) => ({ ...o, sys: id })); }
  knownWars(id) { return id === this.cap ? this.wars.filter((w) => w.sys === id) : (this.known(id)?.wars || []).map((w) => ({ ...w, sys: id })); }
  knownNative(id, body) {
    const n = this.nativeOf(id, body);
    if (!n || id === this.cap) return n;
    const st = this.known(id)?.natives?.[body];
    return { def: n.def, st: st ? { ...st } : { rel: n.def.mood, status: 'independent', pop: n.def.pop } };
  }
  // 情報の古さ [年]。太陽系は0、まだ何も届いていなければ null
  dataAge(id) {
    if (id === this.cap) return 0;
    const k = this.known(id);
    return k ? this.year - k.year : null;
  }
  routeKnown(r) { return this.spectate || r.built === undefined || r.built + this.lightDelay(r.by ?? r.a) <= this.year; }
  // 地球から見た動くものの位置。posAt(t) は年 t の位置。光が地球に届くのにかかる時間を差し引いた位置を返す
  // (出発がまだ見えていない・到着がもう見えているなら null)
  apparent(posAt, t0, t1) {
    if (this.spectate) return this.year < t0 || this.year > t1 ? null : posAt(this.year); // 観戦モードは実際の位置
    const E = this.system(this.cap);
    const f = (t) => { const q = posAt(t); return t + distance(q, E) - this.year; };
    if (f(t0) > 0 || f(t1) <= 0) return null;
    let lo = t0;
    let hi = t1;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
    return posAt(lo);
  }
  // apparent((t) => this.pathPosition(path, times, t), t0, t1) と同じ計算を、途中で物を作らずに行う
  // (地図で毎フレーム、輸送中の荷や船の数だけ呼ぶので)。式と順番は pathPosition・shipPosition と同じ
  apparentPath(path, times, t0, t1) {
    if (this.spectate || path.length < 2) return this.apparent((t) => this.pathPosition(path, times, t), t0, t1);
    const E = this.system(this.cap);
    let px = 0, py = 0, pz = 0;
    const place = (t) => {
      let i = 0;
      while (i < path.length - 2 && t >= times[i + 1]) i++;
      const a = this.system(path[i]);
      const b = this.system(path[i + 1]);
      const f = clamp((t - times[i]) / Math.max(1e-9, times[i + 1] - times[i]), 0, 1);
      px = a.x + (b.x - a.x) * f;
      py = a.y + (b.y - a.y) * f;
      pz = (a.z || 0) + ((b.z || 0) - (a.z || 0)) * f;
    };
    const f = (t) => { place(t); return t + GM.hypot(px - E.x, py - E.y, pz - (E.z || 0)) - this.year; };
    if (f(t0) > 0 || f(t1) <= 0) return null;
    let lo = t0;
    let hi = t1;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
    place(lo);
    return { x: px, y: py, z: pz };
  }
  departSeen(sys, t) { return t + (this.spectate ? 0 : this.lightDelay(sys)) <= this.year; }
  // 観戦モードの切り替え。オンにすると地球政府の自動化 (開発・防衛配備・居住区・資金援助) もすべてオンにする
  setSpectate(on) {
    this.spectate = !!on;
    this.live = null;
    if (on) { this.auto[this.cap] = true; this.autoDefense = true; this.autoBuild = true; this.autoHabitat = true; this.autoGrant = true; }
    this.message(on ? '観戦モードにした (実際の様子を見る。地球政府も自動で動く)' : '観戦モードを終えた (地球に届く光で見る)');
  }
