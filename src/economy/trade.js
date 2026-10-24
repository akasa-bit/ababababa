  // 交易網による自動輸送。情報は光速でしか伝わらないので、物資移送要求を介して動く。
  // 1) 生産が需要に届かない星系は、交易路でつながった余剰のある星系へ「物資移送要求」を送る (光速で直進)
  // 2) 要求が届いた星系が、交易路を乗り継いで荷を送る。交易路の輸送量が足りなければ待機して少しずつ送る
  // 受け手の目標 = 需要 × (2年 + 要求の往復と航行の年数)。輸送中の荷と未処理の要求も数え、備蓄上限の8割は超えない。
  trade(h, flow) {
    this.refundsArrive(); // 光速で届いた返金 (回 KE3)
    this.recordEconIntel(flow); // 経済の記録 (econ-intel.js。買い手と移民の送り手は、光の遅れのぶん古い記録で相手を選ぶ)
    if (!this.routes.length) { for (const q of this.requests) if (q.kind === 'trade') this.refund(q); this.requests = this.requests.filter((q) => q.kind !== 'trade'); return; }
    // 輸送中の量は毎回、貨物から数え直す (足し引きの積み重ねだと、読み込み直したゲームと最後の桁がずれて結果が分かれるので)
    this.rebuildTransit();
    // 交易路の向きごとの残りの輸送量と送った量 (キーは 交易路の番号×2+向き)
    const room = new Map();
    for (const r of this.routes) { const c = this.routeCap(r) * h; room.set(r.id * 2, c); room.set(r.id * 2 + 1, c); }
    const sent = new Map();
    const spareOf = (id, res) => this.stockOf(id)[res] - 2 * (flow[id]?.cons[res] || 0); // 送り手が自分の在庫を見るとき
    // 届いた要求を処理する
    for (const q of this.requests) {
      if (q.kind !== 'trade' || q.arrive > this.year) continue;
      if (this.tradeBlocked(q.to, q.from)) { this.refund(q); continue; } // 送り手が開戦を知っていれば断る
      const rp = this.routePath(q.to, q.from);
      const spare = spareOf(q.to, q.res);
      // 余りがなければ取り消さずに入荷待ちにして、作れた分から送る。届いてから TRADE.wait 年たっても送りきれなければ、残りを取り消す
      if (!rp || this.year > q.arrive + TRADE.wait) { this.refund(q); continue; }
      if (spare <= 0.001) { q.state = 'waiting'; continue; }
      const legs = this.legsOf(rp.path).map((l, i) => ({ ...l, next: rp.path[i + 1] }));
      let amt = Math.min(q.amt, spare, (this.routeRoom(q.to, q.from) * UNIT_KG) / RES_KG[q.res]); // 送る側の加速と受ける側の減速のエネルギー
      for (const l of legs) amt = Math.min(amt, room.get(l.r.id * 2 + l.dir));
      q.state = 'waiting';
      if (amt <= 0.001) continue;
      // 代金 (基準価格に、航行の年数ぶんの利子を乗せた値段) は、売り手が送り出すときに受け手の会社が払う (信用状。回 KE4・B-016)。
      // 市場のない版は、受け手の政府が注文のときに先に払ってある (q.pre)。先払いの足りない分は、送り手が受け手の主人なら支援として無償で送る。そうでなければ送らない
      const price = q.price ?? PRICE[q.res] * tradeCost(this.reach(q.to).dist[q.from] ?? 0, this.rateAt(q.from));
      const prepaid = q.pre !== undefined;
      const paid = Math.min(amt, Math.max(0, prepaid ? q.pre : MARKET.buy ? Infinity : this.gov(q.from).credits) / price);
      const aid = this.gov(q.from).lord === q.to ? amt - paid : 0;
      amt = paid + aid;
      if (amt <= 0.001) { this.refund(q); continue; }
      if (paid > 0) {
        if (prepaid) this.cash('import', -paid * price, { way: q, f: 'pre' }); else this.payFrom('import', -paid * price, q.from);
        this.payFrom('trade', paid * price, q.to); this.noteLordTrade(q.from, q.to, paid * price);
        const duty = MARKET.buy ? this.tariffFor(q.from, q.to) * paid * price : 0;
        if (duty > 0) this.earn('tariff', duty, q.from, { fm: q.from }); // 関税: 買い手の会社が、買い手の星系の政府に払う (ほかの国からの輸入だけ。送り出すときに記帳)
      }
      if (aid > 0) { this.receiveAid(q.from, aid * price); this.noteLordTrade(q.from, q.to, aid * price); }
      for (const l of legs) {
        const k = l.r.id * 2 + l.dir;
        room.set(k, room.get(k) - amt);
        sent.set(k, (sent.get(k) || 0) + amt);
      }
      if (TRADE_AUDIT) TRADE_AUDIT.push([q.to, q.from, this.year, amt * PRICE[q.res], 't', q.res]);
      const cMode = this.routeMode(q.to, q.from, (amt * RES_KG[q.res]) / UNIT_KG);
      if (SIM_ONLY) this.bookPath('cargo', amt * RES_KG[q.res], [q.to, ...legs.map((l) => l.next)], cMode); else this.bookShip('cargo', amt * RES_KG[q.res], SHIP_SPEED, cMode, q.to, q.from);
      this.shipCargo(q.to, legs, q.res, amt);
      q.amt -= amt;
      q.shipped = (q.shipped || 0) + amt;
    }
    for (const q of this.requests) if (q.kind === 'trade' && q.amt <= 0.001 && q.pre > 0) this.refund(q);
    this.requests = this.requests.filter((q) => q.kind !== 'trade' || q.amt > 0.001);
    // 未処理の要求の量 (受け手ごと・送り手ごと) と、要求の組 (受け手・送り手・資源。同じ要求を重ねないため)。
    // 何度も引くので、キーは文字列でなく数 (星系の番号と資源の番号から作る)
    const sysRes = (sys, res) => Number(sys) * 8 + RES_INDEX[res];
    const pairKey = (from, to, res) => (Number(from) * 65536 + Number(to)) * 8 + RES_INDEX[res];
    const asked = new Map();
    const promised = new Map();
    const pendingPair = new Set();
    for (const q of this.requests) {
      if (q.kind !== 'trade') continue;
      const ka = sysRes(q.from, q.res), kp = sysRes(q.to, q.res);
      asked.set(ka, (asked.get(ka) || 0) + q.amt);
      promised.set(kp, (promised.get(kp) || 0) + q.amt);
      pendingPair.add(pairKey(q.from, q.to, q.res));
    }
    // 新しい要求を送る (このあいだ戦争の状態は変わらないので、取引できるかは組ごとに一度だけ調べる)
    const blockMemo = new Map();
    const realmMemo = new Map();
    const realmQ = (id) => {
      let r = realmMemo.get(id);
      if (r === undefined) { r = this.realmOf(id); realmMemo.set(id, r); }
      return r;
    };
    const blocked = (x, y) => {
      const k = Number(x) * 65536 + Number(y);
      let v = blockMemo.get(k);
      if (v === undefined) { v = this.tradeBlockedIn(x, realmQ(x), realmQ(y)); blockMemo.set(k, v); }
      return v;
    };
    for (const T of [...new Set(this.routes.flatMap((r) => [r.a, r.b]))]) {
      const ft = flow[T];
      if (!ft) continue;
      const use = (res) => ft.cons[res] + (ft.short?.[res] || 0); // 使った量 + 原料が足りずに使えなかった量 (docs/regions.md の 2。使った量だけを見ると、燃料のない星の工場は止まったまま輸入も始まらなかった)
      const needs = RES.filter((res) => ft.prod[res] < use(res));
      if (!needs.length) continue;
      const { dist } = this.reach(T);
      const rate = this.rateAt(T); // 買い手の国の利子率
      const sources = this.reachSorted(T);
      const inb = (this.inbound[T] ??= zeroRes());
      const sto = this.stockOf(T);
      const lord = this.gov(T).lord;
      for (const res of needs) {
        const min = Math.max(0.5, 0.05 * use(res));
        // 代金は買い手の星系の民間が払う (払えない分は銀行から借りる)。前の版 (MARKET.buy = 0) は政府が払い、払えない星系は主人にだけ支援を求める
        const broke = !MARKET.buy && this.gov(T).credits < min * PRICE[res];
        const ka = sysRes(T, res);
        // 売り手の候補 (交易路網で近い順に TRADE.sources まで)。重み = 売れる量 × (輸送中の利子)^(−σ) (Krugman 1978/2010 と CES の需要)
        const cands = [];
        let W = 0, WL = 0;
        for (const S of broke ? sources.filter((x) => x === lord) : sources) {
          if (cands.length >= TRADE.sources) break;
          const kpair = pairKey(T, S, res);
          if (pendingPair.has(kpair)) continue;
          if (blocked(T, S)) continue; // 交戦中の国どうしでは取引しない (開戦を知ってから)
          const kp = sysRes(S, res);
          const avail = this.spareSeen(T, S, res) - (promised.get(kp) || 0); // 買い手に届いている売り手の余り (回 KE3。前はいまの余り)
          if (avail <= min) continue;
          const w = avail * GM.pow((this.tradePrice(S, res, dist[S], rate) * (1 + this.tariffFor(T, S))) / PRICE[res], -TRADE.sigma); // 値段の安い売り手ほど多く買う。関税のぶん、ほかの国の売り手は高く見える
          const lead = dist[S] + this.travelYears(T, S);
          cands.push({ S, kpair, kp, avail, w });
          W += w; WL += w * lead;
        }
        if (!cands.length) continue;
        // 受け手の目標 = 需要 × (在庫の厚さ + 要求の往復と航行の年数の重み付きの平均)。在庫の厚さは現実の値 (MARKET.cover。前の版は 2 年)
        const want = Math.min(((MARKET.buy ? MARKET.cover[res] : 2) + WL / W) * use(res), 0.8 * stockCap(ft.pop)) - sto[res] - inb[res] - (asked.get(ka) || 0);
        if (want <= min) continue;
        // 市場のある版は、代金は送り出すときに払う (信用状: 買い手の銀行が注文の時点で払うと約束するので、売り手は光速の送金を待たずに送れる。回 KE4・B-016。
        // 前は注文のときに先に払い、入荷待ちの注文 (平均 16 年) のぶん、試合の始めに GDP の約 1% が運ぶ途中に寝ていた)。
        // 市場のない版は注文のときに先に払う (主人への支援の頼みは払わない)。資金が足りなければ、どの売り手への注文も同じ割合で減らす
        for (const c of cands) { c.price = this.tradePrice(c.S, res, dist[c.S], rate); c.amt = Math.min((want * c.w) / W, c.avail); }
        const bill = cands.reduce((k, c) => k + c.amt * c.price, 0);
        const scale = broke || bill <= 0 || MARKET.buy ? 1 : Math.min(1, Math.max(0, this.gov(T).credits) / bill);
        for (const c of cands) {
          const price = c.price;
          const amt = c.amt * scale;
          if (amt <= min) continue;
          const pre = broke || MARKET.buy ? 0 : amt * price;
          const q = { id: this.nextShipId++, kind: 'trade', from: T, to: c.S, res, amt, price, sent: this.year, arrive: this.year + this.travelYears(T, c.S), state: 'sending' };
          if (!MARKET.buy) q.pre = 0; // 先払いのない要求 (q.pre がない) は、送り出すときに払う
          this.requests.push(q);
          if (pre) { this.payFrom('import', -pre, T); this.cash('import', pre, { way: q, f: 'pre' }); } // 先払いは、送り手に渡るまで運ぶ途中
          pendingPair.add(c.kpair);
          asked.set(ka, (asked.get(ka) || 0) + amt);
          promised.set(c.kp, (promised.get(c.kp) || 0) + amt);
        }
      }
    }
    for (const r of this.routes) {
      for (const dir of [0, 1]) r.vol[dir] += ((sent.get(r.id * 2 + dir) || 0) / h - r.vol[dir]) * Math.min(1, h);
    }
  }
  // 取り消した物資移送要求の先払いを、受け手に返す。返金は送り手 (q.to) から光速で届く (回 KE3・B-170。前はすぐ返していた)。
  // 届くまでは運ぶ途中のお金 (this.refunds の v)。届いたら refundsArrive で受け手の会社 (前の版は政府) へ
  refund(q) {
    if (q.pre > 0) {
      const r = { to: q.from, from: q.to, v: 0, at: this.year + this.sysDist(q.to, q.from) };
      const v = q.pre;
      this.cash('import', -v, { way: q, f: 'pre' });
      this.cash('import', v, { way: r, f: 'v' });
      this.refunds.push(r);
    }
    q.amt = 0;
  }
  refundsArrive() {
    if (!this.refunds.length) return;
    const left = [];
    for (const r of this.refunds) {
      if (r.at > this.year) { left.push(r); continue; }
      const v = r.v;
      if (MARKET.buy) { this.cash('import', -v, { way: r, f: 'v' }); this.cash('import', v, { fm: r.to }); } else this.release('import', r, 'v', r.to, r.to);
    }
    this.refunds = left;
  }
  // 貨物を積み出す。path は経由する星系の列、times は各星系に着く年
  shipCargo(from, legs, res, amt) {
    const path = [from, ...legs.map((l) => l.next)];
    const dest = path[path.length - 1];
    this.mv(from, res, -amt, 'ship');
    (this.inbound[dest] ??= zeroRes())[res] += amt;
    for (const l of legs) l.r.transit[l.dir][res] += amt;
    let times = [this.year], cly = 0;
    for (let i = 1; i < path.length; i++) { times.push(times[i - 1] + this.shipYears(path[i - 1], path[i])); cly += this.sysDist(path[i - 1], path[i]); }
    times = SIM_ONLY ? this.stopTimes(path, times, () => SHIP_SPEED, ACCEL.cargo) : withAccel(times, accelExtra(cly, SHIP_SPEED, ACCEL.cargo, this.physics)); // 荷は 10g
    const key = path.join('>');
    let p = null;
    for (let i = this.cargo.length - 1; i >= Math.max(0, this.cargo.length - 64) && !p; i--) {
      if (this.cargo[i].key === key) p = this.cargo[i];
    }
    if (!p || times[times.length - 1] - p.arrive >= 0.5) {
      p = { key, path, times, arrive: times[times.length - 1], load: {} };
      this.cargo.push(p);
    }
    p.load[res] = (p.load[res] || 0) + amt;
  }
  // 区間 (path[i] → path[i+1]) の交易路と向き
  legsOf(path) {
    const out = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const r = this.routeBetween(path[i], path[i + 1]);
      if (r) out.push({ r, dir: r.a === path[i] ? 0 : 1 });
    }
    return out;
  }
  // 輸送中の量 (交易路ごと・受け手ごと) を貨物から数え直す
  rebuildTransit() {
    for (const r of this.routes) r.transit = [zeroRes(), zeroRes()];
    this.inbound = {};
    for (const p of this.cargo) {
      const dest = p.path[p.path.length - 1];
      for (const [res, amt] of Object.entries(p.load)) {
        (this.inbound[dest] ??= zeroRes())[res] += amt;
        for (const l of this.legsOf(p.path)) l.r.transit[l.dir][res] += amt;
      }
    }
  }

