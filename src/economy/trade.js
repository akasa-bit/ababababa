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
    // 交易路の向きごとの残りの輸送量と送った量 [質量の単位] (キーは 交易路の番号×2+向き)。運賃 [cr / 質量の単位 / 光年] (市場のある版だけ。回 KE5)
    const room = new Map();
    for (const r of this.routes) { const c = this.routeCap(r) * h; room.set(r.id * 2, c); room.set(r.id * 2 + 1, c); }
    const sent = new Map();
    const fRate = MARKET.buy ? this.freightRate() : 0;
    const spareOf = (id, res) => this.stockOf(id)[res] - 2 * (flow[id]?.cons[res] || 0); // 送り手が自分の在庫を見るとき
    // 届いた要求を処理する
    for (const q of this.requests) {
      if (q.kind !== 'trade' || q.arrive > this.year) continue;
      if (this.tradeBlocked(q.to, q.from) || this.tradeBarred(q.from, q.to, q.res)) { this.refund(q); continue; } // 送り手が開戦を知っていれば断る。輸出禁止と禁輸 (回 KE9) も
      const rp = this.routePath(q.to, q.from);
      const spare = spareOf(q.to, q.res);
      // 余りがなければ取り消さずに入荷待ちにして、作れた分から送る。届いてから TRADE.wait 年たっても送りきれなければ、残りを取り消す
      if (!rp || this.year > q.arrive + TRADE.wait) { this.refund(q); continue; }
      if (spare <= 0.001) { q.state = 'waiting'; continue; }
      const legs = this.legsOf(rp.path).map((l, i) => ({ ...l, next: rp.path[i + 1] }));
      let amt = Math.min(q.amt, spare, (this.routeRoom(q.to, q.from) * UNIT_KG) / RES_KG[q.res]); // 送る側の加速と受ける側の減速のエネルギー
      const kg = RES_KG[q.res] / UNIT_KG; // 1 単位の質量 [質量の単位]
      for (const l of legs) amt = Math.min(amt, room.get(l.r.id * 2 + l.dir) / kg);
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
        if (MARKET.buy && this.dutiable(q.from, q.to)) {
          const T = (this._mxT ??= {}), duty = this.tariffFor(q.from, q.to) * paid * price;
          T[q.from] = (T[q.from] || 0) + paid * price; // 関税の掛かる輸入の額 (帰着の表の関税の元。gv.mx に 1 年でならす。回 KE8・B-012)
          if (duty > 0) this.earn('tariff', duty, q.from, { fm: q.from }); // 関税: 買い手の会社が、買い手の星系の政府に払う (ほかの国からの輸入だけ。送り出すときに記帳)
        }
      }
      if (aid > 0) { this.receiveAid(q.from, aid * price); this.noteLordTrade(q.from, q.to, aid * price); }
      for (const l of legs) {
        const k = l.r.id * 2 + l.dir;
        room.set(k, room.get(k) - amt * kg);
        sent.set(k, (sent.get(k) || 0) + amt * kg);
        // 運賃: 買い手の会社が、区間ごとに交易路の船の持ち主の会社へ払う (送り出すときに記帳)
        const o = fRate > 0 ? this.routeOwner(l.r) : null;
        if (o !== null) { const v = fRate * amt * kg * this.sysDist(l.r.a, l.r.b); this.cash('freight', -v, { fm: q.from }); this.cash('freight', v, { fm: o }); }
      }
      if (TRADE_AUDIT) TRADE_AUDIT.push([q.to, q.from, this.year, amt * PRICE[q.res], 't', q.res]);
      const cMode = this.routeMode(q.to, q.from, (amt * RES_KG[q.res]) / UNIT_KG);
      const dec = SIM_ONLY ? (this.bookPath('cargo', amt * RES_KG[q.res], [q.to, ...legs.map((l) => l.next)], cMode), 0) : this.bookShipDefer('cargo', amt * RES_KG[q.res], SHIP_SPEED, cMode, q.to, q.from);
      const cp = this.shipCargo(q.to, legs, q.res, amt);
      if (dec > 0) cp.dE = (cp.dE || 0) + dec; // 受け手の減速の分は着いたときに (回 FU6・B-173)
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
    // 取引できるかは、買い手の星系と、売り手の国 (首都) だけで決まる (tradeBlockedIn) ので、売り手の国ごとに一度だけ調べる (速さ。docs/perf.md)
    const blocked = (x, y) => {
      const a = realmQ(x), b = realmQ(y);
      const k = Number(x) * 65536 + Number(b);
      let v = blockMemo.get(k);
      if (v === undefined) { v = this.tradeBlockedIn(x, a, b); blockMemo.set(k, v); }
      return v;
    };
    // 速さ (依頼 2026-11-07。docs/perf.md): 売り手の候補を調べるあいだ、国・財政・関税・見えている記録は変わらないので、星系ごと・組ごとに一度だけ求める。
    // 式は tradeBarred・tariffFor・spareSeen と同じ (前は資源ごとに何度も呼び直していた)
    const fiscMemo = new Map();
    const fiscQ = (id) => {
      let f = fiscMemo.get(id);
      if (f === undefined) { f = this.fiscalFor(realmQ(id), id); fiscMemo.set(id, f); }
      return f;
    };
    // 国の財政を初めて見ると、AI の国の財政の覚え書き (aif。セーブに入る) ができる。覚え書きがすでにある国・人間の国・席の財政がある国は、
    // 見ても何も残らない (速さ。依頼 common-4: 売れる見込みのない売り手を、財政を見ずに飛ばしてよいかに使う。一度できた覚え書きは消えない)
    const fiscReady = new Set();
    const fiscQuiet = (root) => {
      if (fiscReady.has(root)) return true;
      const ok = !!this.players[this.playerOf(root)]?.fiscal || this.isHuman(root) || !!this.aif?.[root];
      if (ok) fiscReady.add(root);
      return ok;
    };
    const tariffMemo = new Map();
    const tariffQ = (x, y) => { // 関税も、買い手の星系と売り手の国だけで決まる (tariffFor・dutiable)
      const k = Number(x) * 65536 + Number(realmQ(y));
      let v = tariffMemo.get(k);
      if (v === undefined) { v = this.tariffFor(x, y); tariffMemo.set(k, v); }
      return v;
    };
    // 売り手が資源を売れる見込み (星系の経済の記録のどれかで、余りが 0.5 を超えるか。数でない値も「見込みあり」)。記録は年に 1 度しか変わらないので、
    // 記録の一覧が同じあいだは使い回す (this._sellMask はセーブしない)。見えている余り sp はどれかの記録の値か 0 なので、見込みがなければ sp ≤ 0.5 ≤ min。
    // 資源ごとの記録の余りの最大 (sellMax。数でない値があれば Infinity) も一緒に覚える: 最大が min 以下なら、どの記録が見えていても sp ≤ min (速さ。依頼 common-4)
    const sellMemo = (this._sellMask ??= new Map());
    const maskArr = [], maxArr = [];
    const NO_MAX = new Float64Array(RES.length);
    const sellMask = (S) => {
      let m = maskArr[S];
      if (m !== undefined) return m;
      const list = this.econIntel.s[S];
      let mx = NO_MAX;
      if (!list?.length) m = 0;
      else {
        const c = sellMemo.get(S), y0 = list[0][0], y1 = list[list.length - 1][0];
        if (c && c.list === list && c.len === list.length && c.y0 === y0 && c.y1 === y1) { m = c.m; mx = c.mx; }
        else {
          m = 0;
          mx = new Float64Array(RES.length).fill(-Infinity);
          for (const e of list) {
            for (let i = 0; i < RES.length; i++) {
              const v = e[1][i] ?? 0;
              if (!(v <= 0.5)) m |= 1 << i;
              if (typeof v !== 'number' || v !== v) mx[i] = Infinity; else if (v > mx[i]) mx[i] = v;
            }
          }
          sellMemo.set(S, { list, len: list.length, y0, y1, m, mx });
        }
      }
      maxArr[S] = mx;
      return (maskArr[S] = m);
    };
    const sellMax = (S, ri) => { if (maskArr[S] === undefined) sellMask(S); return maxArr[S][ri]; };
    // 国の財政の覚え書きがもうある (見ても何も残らない) 国の星系。一度そうなれば変わらないので、true だけ覚える
    const quietArr = [];
    const quietS = (S) => quietArr[S] || (quietArr[S] = fiscQuiet(realmQ(S)));
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
      // 売り手ごとの調べ (交戦・同じ国か・禁輸・見えている記録) は資源によらないので、この買い手のあいだ覚えておく。
      // 求める順と条件は前と同じ (交戦中なら財政を見ない。同じ国なら財政を見ない。財政を初めて見るときに AI の国の財政の覚え書きができるので)
      const rT = realmQ(T);
      const X = { T, Tn: Number(T), rT, info: [], pendingPair, promised, blocked, realmQ, fiscQ, fiscQuiet, quietS, tariffQ, sellMask, sellMax, dist, rate, fRate };
      for (const res of needs) {
        const min = Math.max(0.5, 0.05 * use(res));
        const ri = RES_INDEX[res]; // sysRes・pairKey と同じ鍵を、ここで組み立てる
        // 代金は買い手の星系の民間が払う (払えない分は銀行から借りる)。前の版 (MARKET.buy = 0) は政府が払い、払えない星系は主人にだけ支援を求める
        const broke = !MARKET.buy && this.gov(T).credits < min * PRICE[res];
        const ka = sysRes(T, res);
        // 売り手の候補 (交易路網で近い順に TRADE.sources まで)。重み = 売れる量 × (輸送中の利子)^(−σ) (Krugman 1978/2010 と CES の需要)。tradeCands で集める
        const { cands, W, WL } = this.tradeCands(X, res, ri, min, broke ? sources.filter((x) => x === lord) : sources);
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
  // 買い手 X.T の資源 res の売り手の候補を、交易路網で近い順 (list) に TRADE.sources まで集める (trade の中でいちばん回る繰り返しなので、
  // 小さな関数に分けた。速さ。docs/perf.md)。X = trade の中の覚え書き (info = 売り手ごとの調べ・pendingPair・promised) と調べる関数。
  // 調べる順・式・覚え書きのでき方は、分ける前と同じ:
  // - 売れる見込みのない売り手は候補にならない (下のどの道でも飛ばす)。ただし組の調べ (交戦・禁輸と、そのときに求める財政) は前と同じく 1 度はする
  //   (財政を初めて見ると AI の国の財政の覚え書きができるので)。済んでいれば飛ばす。min が数のときだけ
  // - 約束した量 (promised) は 0 以上なので、見えている余りが min 以下なら avail も min 以下 (前と同じく飛ばす)
  tradeCands(X, res, ri, min, list) {
    const { T, Tn, rT, info, pendingPair, promised, dist, rate, fRate } = X;
    const bit = 1 << ri, mayFlat = min >= 0.5, maxN = TRADE.sources;
    const cands = [];
    let W = 0, WL = 0;
    // 買い手の国の財政の覚え書きがもうあるかは、1 度だけ見る (覚え書きは一度できたら消えないので、古い「まだない」で調べに回っても、
    // 調べて何も残らないだけ。結果は同じ。速さ。依頼 common-4)
    const qT = mayFlat && X.fiscQuiet(rT);
    for (let n = 0; n < list.length; n++) {
      const S = list[n];
      if (cands.length >= maxN) break;
      // 売れる見込みのない売り手は候補にならない。調べると財政の覚え書きができる売り手 (買い手か売り手の国の覚え書きがまだない) だけは、前と同じく調べる
      if (mayFlat && !(X.sellMask(S) & bit)) { const I0 = info[S]; if (I0 !== undefined ? I0.blk || I0.same !== undefined : qT && X.quietS(S)) continue; }
      const kpair = (Tn * 65536 + S) * 8 + ri; // = pairKey(T, S, res) (S は交易路網の星系の番号 = 数)
      if (pendingPair.has(kpair)) continue;
      // 交戦中の国どうしでは取引しない (開戦を知ってから)。輸出禁止と禁輸 (回 KE9。式は tradeBarred と同じ)
      let I = info[S];
      if (I === undefined) I = info[S] = { blk: X.blocked(T, S), same: undefined, ban: undefined, emb: false, e: undefined };
      if (I.blk) continue;
      if (I.same === undefined) {
        const rS = X.realmQ(S);
        I.same = rT === rS;
        if (!I.same) { const fs = X.fiscQ(S), fb = X.fiscQ(T); I.ban = fs.ban; I.emb = !!(fs.embargo?.[rT] || fb.embargo?.[rS]); }
      }
      if (!I.same && (I.ban?.[res] || I.emb)) continue;
      const kp = S * 8 + ri; // = sysRes(S, res)
      if (mayFlat && !(X.sellMax(S, ri) > min)) continue; // どの記録の余りも min 以下なら、見えている余りも min 以下 (下の sp ≤ min と同じ。記録を探さずに飛ばす)
      if (I.e === undefined) I.e = this.econSeen(T, S);
      const sp = I.e?.[1][ri] ?? 0;
      if (sp <= min) continue;
      const avail = sp - (promised.get(kp) || 0); // 買い手に届いている売り手の余り (回 KE3。前はいまの余り)
      if (avail <= min) continue;
      const fr = (fRate * RES_KG[res] * dist[S] * SHIP_SPEED) / UNIT_KG; // 運賃の見込み (航行の年数 × 速さ = 光年)
      const w = avail * GM.pow((this.tradePrice(S, res, dist[S], rate) * (1 + X.tariffQ(T, S)) + fr) / PRICE[res], -TRADE.sigma); // 値段の安い売り手ほど多く買う。関税のぶん、ほかの国の売り手は高く見え、遠いほど運賃が乗る
      const lead = dist[S] + this.travelYears(T, S);
      cands.push({ S, kpair, kp, avail, w });
      W += w; WL += w * lead;
    }
    return { cands, W, WL };
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
      if (r.hh) { this.cash('dividend', -v, { way: r, f: 'v' }); this.cash('dividend', v, { hh: this.isColonized(r.to) || !this.govs[r.from] ? r.to : r.from }); this._remit?.delete(`${r.to}|${r.at}`); } // 遠くの持ち主への配当 (remit)
      else if (MARKET.buy) { this.cash('import', -v, { way: r, f: 'v' }); this.cash('import', v, { fm: r.to }); } else this.release('import', r, 'v', r.to, r.to);
    }
    this.refunds = left;
  }
  // 星系 from の会社の配当のうち、遠くの持ち主 to (OWNER) の分 v を、光速で送る (届くまでは運ぶ途中のお金。届く年は光の年数を年の終わりに切り上げ、
  // 同じ受け手・同じ届く年の分はまとめる (from は最初の送り手。受け手がなくなっていたら、そこへ返す))。国をまたぐ分は、国の GNI に数える
  // (game.pinc: 国ごとの、受け取った − 払った配当の合計。パネルが差を取る。_pinT: この刻みの分。首都の政府の gv.pinY (1 年でならした年あたりの額。財政の画面) に入れる)。
  // まとめる先の索引 _remit はセーブしない (なければ refunds から作り直す)
  remit(from, to, v) {
    if (!(v > 0)) return;
    const a = this.realmOf(to), b = this.realmOf(from);
    if (a !== b) { const P = (this.pinc ??= {}), T = (this._pinT ??= {}); P[a] = (P[a] || 0) + v; P[b] = (P[b] || 0) - v; T[a] = (T[a] || 0) + v; T[b] = (T[b] || 0) - v; }
    const at = Math.ceil(this.year + this.sysDist(from, to) - 1e-9), M = (this._remit ??= new Map(this.refunds.filter((q) => q.hh).map((q) => [`${q.to}|${q.at}`, q])));
    let r = M.get(`${to}|${at}`);
    if (!r) { r = { to, from, v: 0, at, hh: 1 }; this.refunds.push(r); M.set(`${to}|${at}`, r); }
    this.cash('dividend', v, { way: r, f: 'v' });
  }
  // 星系 from の家計から遠くの持ち主 to の家計へ、資本の受け渡し (国有化の補償。回 KE9・B-011) の v を光速で送る。配当と同じ返金の列に入るが、所得ではないので GNI に数えない
  sendCapital(from, to, v, kind) {
    if (!(v > 0)) return;
    const at = Math.ceil(this.year + this.sysDist(from, to) - 1e-9), M = (this._remit ??= new Map(this.refunds.filter((q) => q.hh).map((q) => [`${q.to}|${q.at}`, q])));
    let r = M.get(`${to}|${at}`);
    if (!r) { r = { to, from, v: 0, at, hh: 1 }; this.refunds.push(r); M.set(`${to}|${at}`, r); }
    this.cash(kind, v, { way: r, f: 'v' });
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
    return p;
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
    // 荷の区間 (legsOf) は、交易路の一覧が同じあいだ (routeBetween の索引と同じ見分け方: 一覧そのもの・数・最後の番号) は変わらないので、荷ごとに覚えて使い回す
    // (_legs はセーブしない。足す順は前と同じ。速さ。依頼 common-4・docs/perf.md の 9。前は刻みごと・資源ごとに求め直していた)
    const sig = `${this.routes.length}:${this.routes[this.routes.length - 1]?.id}`;
    let LC = this._legs;
    if (!LC || LC.sig !== sig || LC.list !== this.routes) LC = this._legs = { sig, list: this.routes, map: new WeakMap() };
    for (const p of this.cargo) {
      const dest = p.path[p.path.length - 1];
      let legs = null;
      for (const res in p.load) {
        const amt = p.load[res];
        (this.inbound[dest] ??= zeroRes())[res] += amt;
        if (legs === null) { legs = LC.map.get(p); if (legs === undefined) { legs = this.legsOf(p.path); LC.map.set(p, legs); } }
        for (const l of legs) l.r.transit[l.dir][res] += amt;
      }
    }
  }

