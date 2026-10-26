  // 市場の値段を決め直す (MARKET の説明)。ふだんの消費は、この刻みの需要 (absorb) を smooth 年でならしたもの
  // 市場は { u, p, L } (どれも資源ごとの入れ物 ResVec。資源は番号で回す。world.js)
  marketStep(h) {
    const a = Math.min(1, h / MARKET.smooth);
    for (const [key, st] of Object.entries(this.stock)) {
      const id = Number(key), fresh = !this.market[id]; // 新しい市場は、この刻みの需要をそのまま「ふだんの消費」にする (回 KE4・B-019。0 から 1 年かけて立ち上げると、
      // 需要で決まる生産が始めほとんど作らず、試合の始めの本星と新しい星系で 1〜2 年の飢餓になった)
      const m = (this.market[id] ??= { u: zeroRes(), p: basePrices(), L: undefined });
      m.L ??= resCopy(m.p); // ならした値段
      const got = this.absorb[id], short = this.unmet[id], { u, p, L } = m;
      const cap = stockCap(this.flowPop?.[id] || 0);
      for (let i = 0; i < NRES; i++) {
        if (u[i] === undefined) { u[i] = 0; p[i] = basePriceI(i); L[i] = p[i]; } // 前の版のセーブの市場 (高付加価値物品がない。回 KE5)
        u[i] += ((got?.[i] || 0) / h + (short?.[i] || 0) - u[i]) * (fresh ? 1 : a); // 受注残は年あたりの需要として
        let goal = this.priceAtI(i, st[i], u[i], MARKET.anchor ? L[i] : undefined); // 使い道がなければ最低の値段
        if (st[i] < 0.95 * cap) goal = Math.max(goal, L[i] * (1 - MARKET.store)); // 倉に空きがあれば、蓄える人が値段を支える
        p[i] = MARKET.tau > 0 ? p[i] * GM.pow(goal / p[i], Math.min(1, h / MARKET.tau)) : goal;
        L[i] += (p[i] - L[i]) * Math.min(1, h / MARKET.long);
      }
    }
  }
  // 資源 r は名前でも番号でもよい (mv と同じ)
  price(sys, r) { const i = typeof r === 'number' ? r : RES_INDEX[r]; return this.market[sys]?.p[i] ?? basePriceI(i); }
  // 在庫 stock・ふだんの消費 u のときの、在庫から決まる値段 (MARKET の式)。ref = ふだんの値段 (省くと基準の値段)。
  // ふだんの値段を、ならした値段 (m.L。MARKET.long 年) にすると、在庫の厚さが目標から離れたときだけ値段が動き、つり合いの値段の水準は
  // 作る費用 (部門の稼ぎが等しくなる所) で決まる (Deaton & Laroque 1992 の形: 値段は「ふだんの値段」からの在庫によるずれ)。
  // 基準の値段に固定すると、作る費用が基準の値段と違う資源は、値段を合わせるために在庫が目標から外れたまま (食料の在庫が消費の 0.1 年など) になる。
  // 値段はどちらでも、基準の値段の min〜max 倍に収める
  priceAt(r, stock, u, ref) { return this.priceAtI(RES_INDEX[r], stock, u, ref); }
  priceAtI(i, stock, u, ref = basePriceI(i)) { // 資源を番号で
    const need = u * COVER_I[i];
    const cover = need > 1e-9 ? Math.max(stock, 0) / need : Infinity;
    const base = basePriceI(i), lo = base * MARKET.min, hi = base * MARKET.max;
    if (cover === Infinity) return lo;
    return clamp(cover > 0 ? ref * GM.pow(cover, -MARKET.eta) : hi, lo, hi);
  }
  // まとめて q 買うときの 1 単位の値段: いまの値段と、買ったあとの在庫で決まる値段の平均 (大口の注文は値段を押し上げる。市場の厚み)。r は名前でも番号でもよい
  bulkPrice(sys, r, q) {
    const i = typeof r === 'number' ? r : RES_INDEX[r], m = this.market[sys];
    if (!m) return basePriceI(i);
    return 0.5 * (m.p[i] + this.priceAtI(i, (this.stock[sys]?.[i] || 0) - q, m.u[i])); // 在庫は読むだけ (stockOf は無い星系の在庫を作る)
  }
  // 売り手の星系 S から運ぶ物の値段: 売り手の市場の値段 × 運ぶ年数ぶんの利子 (買い手の利子率) × 売り手の商才 (種族の特性。売り手が高く売れる)。
  // 前の版 (MARKET.buy = 0) は基準価格 × 利子
  // tc = tradeCost(years, rate) (求めてあるとき。同じ売り手・買い手で資源だけ違う値段を続けて引くとき)
  tradePrice(S, r, years, rate, q = 0, tc = tradeCost(years, rate)) {
    if (!MARKET.buy) return PRICE_I[typeof r === 'number' ? r : RES_INDEX[r]] * tc;
    return (q ? this.bulkPrice(S, r, q) : this.price(S, r)) * tc * (this.nations ? this.modsOf(S).trade : 1);
  }
  // 交易の代金の受け渡し: 生産物 (在庫) は会社のものなので、星系の会社の帳簿で払う・受け取る (MARKET.buy = 0 なら前の版どおり政府)
  payFrom(kind, v, sys) { if (MARKET.buy) this.cash(kind, v, { fm: sys }); else this.earn(kind, v, sys); }
  // 1 人 (人口の単位) あたりの年の産出。sector = farm (食料)・mine (資源 r)・ind (低付加価値物品)・hi (高付加価値物品。回 KE5)
  yieldOf(c, sector, r) { return this.yieldBy(this.yieldCtx(c), c, sector, r); }
  // 1 つの入植地の部門をいくつも続けて引くときは、国・技術・働き手の倍率を 1 回だけ引いておく (yieldCtx)。その入植地の値が変わる前に使い切る
  yieldCtx(c) { const realm = this.realmOf(c.sys); return { realm, A: this.tech[realm]?.A, k0: (this.productivity || 1) * STRUCTURE.modern, lk: this.laborK(c), hk: c.hk ?? 1, tm: null, forced: null, b: null, fert: null }; }
  yieldBy(x, c, sector, r) {
    const k = x.k0 * (x.A ? x.A[sector] ?? 1 : 1) * x.lk * x.hk; // 開始時に選ぶ生産性 × 物差しの倍率 × 国の技術の水準 (techA) × 働き手の倍率 (回 KE2) × 学歴 (回 KE5)
    if (sector === 'farm') return k * YIELD.farm * (1 + (x.fert ??= this.fertility(c))) * (1 + 0.25 * c.lv.farm);
    const tm = (x.tm ??= this.modsOfRealm(x.realm));
    if (sector === 'ind') return k * YIELD.ind * (1 + 0.25 * c.lv.factory) * tm.ind;
    if (sector === 'hi') return k * YIELD.hi * (1 + 0.25 * c.lv.factory) * tm.ind; // 工場の段と種族の工業の特性は、低付加価値の工業と同じく効く
    const forced = (x.forced ??= REGIMES[regimeKey(this.govs[c.sys])].mine || 1); // 強制労働の採掘の上乗せ
    return k * YIELD.mine * ((x.b ??= this.target(c.sys, c.body)).deposits?.[r] || 0) * (1 + 0.25 * c.lv.mine) * tm.mine * forced;
  }
  // 1 単位の付加価値 [cr]: 低付加価値物品 = 値段 − 金属 0.5 − 燃料 0.2、高付加価値物品 = 値段 − 低付加価値物品 0.5 − 希少元素 0.05 (HITECH)。p = 値段 (資源の番号の関数。basePriceI など)
  vaGoods(p) { return Math.max(0, p(RI.goods) - 0.5 * p(RI.metal) - 0.2 * p(RI.fuel)); }
  vaHitech(p) { return Math.max(0, p(RI.hitech) - HITECH.goods * p(RI.goods) - HITECH.rare * p(RI.rare)); }
  // 部門ごとの、値段から見た 1 人あたりの年の稼ぎ [cr]。工業は投入 (金属 0.5・燃料 0.2。高付加価値は HITECH) を引いた付加価値で、原料が足りなかった分 (c.industry・c.industryHi) だけ下がる。
  // 稼働率 (sold = util): 需要で決まる生産 (economy の 1) で作る分だけ稼ぐ。売れない物は作らないので、その部門の人は稼働率の分しか稼がない
  // (会社は売れた物の分だけ賃金を払える。段 5 の 3。これがないと、会社が売れない産出の賃金を借りで払い続け、民間の信用が GDP の 30 倍になった)
  wagesOf(c) {
    const mp = this.market[c.sys]?.p, p = mp ? (i) => mp[i] ?? basePriceI(i) : basePriceI; // = price(c.sys, i)。資源は番号で
    const K = this.util?.[c.sys];
    const sold = (i) => (K ? K[i] ?? 1 : 1);
    const x = this.yieldCtx(c);
    const w = {
      farm: p(RI.food) * this.yieldBy(x, c, 'farm') * sold(RI.food),
      mine: MINED_I.reduce((k, i) => k + p(i) * this.yieldBy(x, c, 'mine', RES[i]) * sold(i), 0),
      ind: this.vaGoods(p) * this.yieldBy(x, c, 'ind') * (c.industry ?? 1) * sold(RI.goods),
      hi: this.vaHitech(p) * this.yieldBy(x, c, 'hi') * (c.industryHi ?? 1) * sold(RI.hitech),
      serv: 0, // (下で、物の部門の付加価値から決める)
      home: basePriceI(RI.food) * YIELD.home, // 自給: 自分の食べる分の値打ち (基準の値段。留保賃金)
    };
    // サービスの売上 = serv ÷ (1 − serv) × 物の部門の付加価値 (serv は所得で決まる割合。構造転換)。1 人あたりの稼ぎ = 売上 ÷ サービスの人数
    const sh = c.sh || sharesOf(c.focus);
    const goods = w.farm * sh.farm + w.mine * sh.mine + w.ind * sh.ind + w.hi * (sh.hi || 0);
    const serv = this.servShareOf(c);
    w.serv = (serv / (1 - serv)) * goods / Math.max(sh.serv, 0.01);
    return w;
  }
  // 構造転換の曲線 (STRUCTURE)。y = 1 人あたりの実質の所得 [2011 年の国際ドル]
  servShare(y) { const [a, b] = STRUCTURE.serv; return clamp(1 / (1 + GM.exp(-(a + b * GM.log(Math.max(y, 1))))), 0.02, 0.95); }
  // 入植地の servShare(c.inc)。所得が前に求めたときと同じなら前の値を返す (1 刻みに何度も同じ所得で呼ぶので。値は同じ)
  servShareOf(c) {
    const y = c.inc ?? STRUCTURE.y0, M = (this._servMemo ??= new WeakMap()), e = M.get(c);
    if (e && e.y === y && e.t === STRUCTURE.serv) return e.v;
    const v = this.servShare(y);
    M.set(c, { y, t: STRUCTURE.serv, v });
    return v;
  }
  goodsNeed(y) { const [c0, c1, c2] = STRUCTURE.goods, l = GM.log(Math.max(y, 1)); return clamp(GM.exp(c0 + c1 * l + c2 * l * l), STRUCTURE.goodsCap[0], STRUCTURE.goodsCap[1]); }
  // 研究者の数 [人/100 万人]: 所得 y [2011 年のドル] と学力 q (試験の点数の物差し。省くと所得の曲線の学力) で (STRUCTURE.research)
  researchers(y, q = this.learnCurve(y)) { const [d0, d1, d2] = STRUCTURE.research; return GM.exp(d0 + d1 * GM.log(Math.max(y, 1)) + d2 * (q / 100)); }
  // 入植地の研究者の数 [人/100 万人]: 学歴と学力を決める所得 (eduY) と、その年に学校を出る世代の学力 (learnCurve。目標 R64 と同じ) で。
  // データの学力 (HCI の試験の点数) は学校にいる子どもの学力なので、それに合わせる (大人や 25〜29 歳の平均では、所得の伸びに遅れて豊かな国の研究者が R66 の幅より少なかった。
  // docs/innovation.md の 1)。研究者の数そのものは eduY (smooth 年でならした所得) で遅れて動く
  researchersOf(c) { return this.researchers(this.eduY(c), this.learnCurve(this.eduY(c), this.eduSpendPct(c))); }
  // 工業品の需要の値打ちのうち、高付加価値物品の割合 (回 KE5)。付加価値の割合が STRUCTURE.hitech の曲線 v になるように決める:
  // 高付加価値物品 x 単位は原料に低付加価値物品 g x 単位を使うので、付加価値の割合 v = a_h x ÷ (a_h x + a_l (家計の低付加価値物品 + g x)) を、需要の値打ちの割合について解いた
  // (a = 1 単位の付加価値、基準の値段で)
  hitechShare(y) {
    const [a, b] = STRUCTURE.hitech, v = 1 / (1 + GM.exp(-(a + b * GM.log(Math.max(y, 1)))));
    const pg = PRICE.goods, ph = PRICE.hitech, al = this.vaGoods((i) => PRICE_I[i]), ah = this.vaHitech((i) => PRICE_I[i]);
    const D = ah * (1 - v) - v * al * HITECH.goods;
    return D > 0 ? clamp((v * al * ph) / (pg * D + v * al * ph), 0, 0.95) : 0.95;
  }
  // 星系 sys の国の、分野 f の技術の水準 (まだなければ 1)
  techA(sys, f) { const A = this.tech[this.realmOf(sys)]?.A; return A ? A[f] ?? 1 : 1; } // 前の版のセーブの国には hi (回 KE5) がない
  // 研究 (RESEARCH): 国ごとに研究者を数え、分野に分けて技術の水準を伸ばす。試合の始めに alpha を決める。
  // 研究者の曲線の数 (Sc) を、政府が出す分 (Sg) と会社が出す分に分け、会社の分に税額控除と公の研究の呼び水の倍率を掛ける (RND。回 KE6・B-122)
  researchStep(h) {
    const byRealm = {};
    for (const c of this.colonies) {
      const root = this.realmOf(c.sys), R = (byRealm[root] ??= { S: 0, Sc: 0, Sg: 0, va: { farm: 0, mine: 0, ind: 0, hi: 0 }, L: 0, p: 0, cost: 0, priv: 0, y: 0, cr: [] });
      const w = this.wagesOf(c), n = c.pop * this.researchersOf(c), g = this.gshareOf(c), y = this.incomeWith(c, w), k = this.rndCost(c); // [人] (人口は 100 万人、研究者は 100 万人あたり)
      R.Sc += n; R.Sg += g * n; R.y += y;
      R.cost += (n * k * y) / (c.pop * 1e6); // 曲線の研究者の研究開発費 [cr/年] = 人数 × (費用の比 × 1 人あたり所得)
      const pv = ((1 - g) * n * k * y) / (c.pop * 1e6);
      R.priv += pv;
      R.cr.push([c.sys, pv]);
      R.L += c.pop * this.laysOf(c); R.p += c.pop;
      const sh = c.sh || sharesOf(c.focus);
      for (const f of RESEARCH.fields) R.va[f] += c.pop * (sh[f] || 0) * w[f];
    }
    for (const [key, R] of Object.entries(byRealm)) R.S = this.rndRealm(key, R, h);
    if (this.alpha === undefined) {
      const S = byRealm[this.players[0]?.cap ?? 0]?.S;
      if (!(S > 0)) return;
      this.alpha = RESEARCH.g0 / S; // 本星の始めの伸びが g0 になるように (A = 1)
    }
    for (const [key, R] of Object.entries(byRealm)) {
      const T = this.tech[key];
      const tot = RESEARCH.fields.reduce((k, f) => k + R.va[f], 0);
      for (const f of RESEARCH.fields) {
        T.A[f] ??= 1; // 前の版のセーブの国 (hi がない)
        const Sf = tot > 0 ? (R.S * R.va[f]) / tot : R.S / RESEARCH.fields.length;
        T.A[f] *= 1 + this.alpha * Sf * GM.pow(T.A[f], -RESEARCH.beta) * h;
      }
      T.S = R.S;
    }
    for (const key of Object.keys(this.tech)) if (!byRealm[key]) delete this.tech[key]; // 入植地のなくなった国
    this.diffuseStep(h, byRealm);
    this.gptStep(h, byRealm);
  }
  // 研究開発の政策 (RND。回 KE6・B-122)。研究者 1 人の研究開発費 ÷ 1 人あたり所得 (所得は学歴と学力を決める所得 eduY) と、研究開発費のうち政府が出す割合 (0〜1)
  rndCost(c) { const [a, b] = RND.cost; return GM.exp(a + b * GM.log(Math.max(this.eduY(c), 1))); }
  gshareOf(c) { const [a, b] = RND.gshare; return clamp(a + b * GM.log(Math.max(this.eduY(c), 1)), RND.range[0], RND.range[1]) / 100; }
  // 国 key の研究者 [人] (技術の伸びに効く数): 曲線の公の分 + 予算の「研究」で雇った公の研究者 (lag 年前の平均) + 会社の分 × 倍率 (税額控除と呼び水。adjust 年でならす)。
  // 税額控除 (会社の研究開発費 × 控除の率) を首都の政府が星系の会社に払う。記録: T.rd = 研究開発費・政府が出した分・税額控除 [cr/年] と所得
  rndRealm(key, R, h) {
    const T = (this.tech[key] ??= { A: { farm: 1, mine: 1, ind: 1, hi: 1 } });
    if (!(R.Sc > 0)) { T.rd = { spend: 0, pub: 0, credit: 0, y: R.y }; return 0; }
    const root = Number(key), w = R.cost / R.Sc; // 研究者 1 人の費用 [cr/年] (国の平均)
    // 予算の「研究」(人間の国だけ。budgetStep が首都の家計に払う): 払った額 ÷ 1 人の費用だけ公の研究者を足す。効くのは lag 年前の値の平均
    const share = this.fiscalFor(root, root).budget?.research || 0, gv = this.govs[root];
    const paid = this.isHuman(root) && share > 0 ? share * (gv?.bpaid ?? 1) * Math.max(0, gv?.ledger?.tax || 0) : 0;
    const P = (T.pe ??= []);
    const room = Math.max(0, (RND.max[0] / 100) * R.y - R.Sg * w), hired = Math.min(paid, room); // 政府の研究開発費の上限までに足せる額 [cr/年]
    const Snow = w > 0 ? hired / w : 0; // いま予算で雇っている公の研究者
    if (!P.length || this.year - P[P.length - 1][0] >= 1 - 1e-9) P.push([this.year, Snow]);
    while (P.length > 1 && this.year - P[0][0] > RND.lag[1] + 1) P.shift();
    const lagged = P.filter(([t]) => this.year - t >= RND.lag[0] - 1e-9 && this.year - t <= RND.lag[1] + 1e-9);
    const Sx = lagged.length ? lagged.reduce((k, [, x]) => k + x, 0) / lagged.length : 0;
    // 会社の分の倍率: 税額控除 (首都で効いている率) と、公の研究者の呼び水
    const s = this.fiscalFor(root, root).rdcredit ?? FISCAL_DEFAULT.rdcredit, s0 = FISCAL_DEFAULT.rdcredit;
    const want = GM.pow((1 - s) / (1 - s0), -RND.elastic) * (R.Sg > 0 ? GM.pow((R.Sg + Snow) / R.Sg, RND.crowd) : 1); // 呼び水はいまの公の研究者で
    const cap = R.priv > 0 ? Math.max(1, ((RND.max[1] / 100) * R.y) / R.priv) : 1; // 会社の研究開発費の上限 (曲線の分は超えていてもそのまま)
    T.m = (T.m ?? 1) + (Math.min(want, cap) - (T.m ?? 1)) * (1 - GM.exp(-h / RND.adjust));
    // 税額控除: 星系ごとの会社の研究開発費 × その星系で効いている控除の率 (首都の政府が払う)
    let credit = 0;
    for (const [sys, pv] of R.cr) {
      const x = (this.fiscalFor(root, sys).rdcredit ?? s0) * pv * T.m;
      if (x > 0) { this.earn('rdcredit', -x * h, root, { fm: sys }); credit += x; }
    }
    T.rd = { spend: R.Sg * w + hired + R.priv * T.m, pub: R.Sg * w + hired, credit, y: R.y }; // 研究開発費はいま雇っている分 (技術に効くのは遅れて)
    return R.Sg + Sx + (R.Sc - R.Sg) * T.m;
  }
  // 汎用技術 (GPT。回 KE6・B-123)。国 i の GPT g の採用 (0〜1) と、その遅れ [年] (L = 国ごとの LAYS)
  gptLag(i, g, L) { const top = Math.max(...Object.values(L)); return this.sysDist(g.inv, Number(i)) + GPT.ladder * Math.max(0, top - (L[i] ?? top)); }
  gptAdopt(t, g, lag) { return 1 / (1 + GM.exp(-GPT.sigma * (t - g.t - lag - GM.log(1 / GPT.start - 1) / GPT.sigma))); }
  // 画面向け: 国 i に知らせが届いた (発明した国の首都から光の年数がたった) GPT ごとの採用と段階の名前 ([{ k, t: 現れた年, inv: 発明した国の首都, a: 採用 (0〜1), phase }])
  gptPhases(i, L = this.laysByRealm()) {
    return (this.gpts ?? []).flatMap((g, k) => {
      if (this.year < g.t + this.sysDist(g.inv, Number(i))) return [];
      const a = this.gptAdopt(this.year, g, this.gptLag(i, g, L));
      return [{ k, t: g.t, inv: g.inv, a, phase: GPT.phases[GPT.cut.filter((c) => a >= c).length] }];
    });
  }
  // 到来: 刻みごとに rate × 刻みの年数 の確率 (シードと刻みのハッシュで引く。試合の乱数の流れを変えない)。発明国は研究者の数の比で引く。
  // 国ごとに GPT の前の刻みの効き目 (e = 遅れた採用、da = 採用の速さ) を覚え (tech の gp)、増えた分だけ ln A に足す。覚えていない GPT (独立した国が元の国から技術を
  // 持ってきたときなど) は、いまの値から数え始める
  gptStep(h, byRealm) {
    const G = (this.gpts ??= []), keys = Object.keys(byRealm).filter((k) => this.tech[k]), tick = Math.round(this.year * 4);
    const hash = (tag) => (hashSeed(`${this.galaxy.seed}/gpt/${tick}${tag}`) % 1000000) / 1000000;
    if (keys.length && hash('') < GPT.rate * h) {
      const tot = keys.reduce((k, i) => k + (byRealm[i].S || 0), 0);
      let r = hash('/inv') * tot, inv = keys[keys.length - 1];
      for (const i of keys) { r -= byRealm[i].S || 0; if (r <= 0) { inv = i; break; } }
      G.push({ t: this.year, inv: Number(inv) });
    }
    if (!G.length) return;
    const L = Object.fromEntries(keys.map((k) => [k, byRealm[k].p > 0 ? byRealm[k].L / byRealm[k].p : 0]));
    for (const i of keys) {
      const T = this.tech[i], st = (T.gp ??= {});
      let d = 0;
      G.forEach((g, k) => {
        const lag = this.gptLag(i, g, L), a = this.gptAdopt(this.year, g, lag), e = this.gptAdopt(this.year - GPT.effect, g, lag), da = GPT.sigma * a * (1 - a);
        if (st[k]) d += GPT.size * (e - st[k][0]) - GPT.jdip * (da - st[k][1]);
        st[k] = [e, da];
      });
      if (d) for (const f of RESEARCH.fields) T.A[f] *= GM.exp(d);
    }
  }
  // その年に学校を出る世代の、学力で調整した就学年数 [年] (LAYS。DIFFUSE の theta)
  laysOf(c) { const y = this.eduY(c), pct = this.eduSpendPct(c); return (this.schoolCurve(y, pct) * this.learnCurve(y, pct)) / LEARN.full; }
  // 国 key の分野 f の技術の、年 at の値 (DIFFUSE.step 年ごとの記録の、at 以前でいちばん新しいもの。記録より前なら 0 = まだ見えない)
  techSeen(key, f, at) {
    const H = this.tech[key]?.h;
    if (!H?.length || at < H[0][0]) return 0;
    let lo = 0, hi = H.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (H[m][0] <= at) lo = m; else hi = m - 1; }
    return H[lo][1 + RESEARCH.fields.indexOf(f)] ?? 1;
  }
  // 国 i から見えている前線 (分野ごとの F = ほかの国の、光の年数だけ前の技術のいちばん高い値、theta = 吸収の上限、top = その国)。L = 国ごとの LAYS (省くと数える)。
  // 画面にも使える (前線のない分野は F = 0)
  techFrontier(i, L = this.laysByRealm()) {
    const yr = this.year, out = {};
    for (const f of RESEARCH.fields) {
      let F = 0, top = null;
      for (const j of Object.keys(this.tech)) {
        if (j === i || !(j in L)) continue;
        const a = this.techSeen(j, f, yr - this.sysDist(Number(i), Number(j)));
        if (a > F) { F = a; top = j; }
      }
      out[f] = { F, top, theta: top ? Math.min(1, GM.exp(DIFFUSE.lays * ((L[i] ?? 0) - L[top]))) : 0 }; // 前線の国の LAYS はいまの値 (光の遅れの分は小さい)
    }
    return out;
  }
  // 国ごとの LAYS (laysOf の人口の重みの平均)
  laysByRealm() {
    const s = {};
    for (const c of this.colonies) { const r = this.realmOf(c.sys), v = (s[r] ??= [0, 0]); v[0] += c.pop * this.laysOf(c); v[1] += c.pop; }
    return Object.fromEntries(Object.entries(s).map(([k, [a, p]]) => [k, p > 0 ? a / p : 0]));
  }
  // 技術の伝播 (DIFFUSE。回 KE6・B-121): 光速で遅れて見える前線の theta 倍まで、年 kappa の割合で追いつく。全部の国の増え分を先に出してから足す (国の順に依らない)
  diffuseStep(h, byRealm) {
    const yr = this.year, keys = Object.keys(byRealm).filter((k) => this.tech[k]);
    for (const k of keys) {
      const H = (this.tech[k].h ??= []), A = this.tech[k].A;
      if (!H.length || yr - H[H.length - 1][0] >= DIFFUSE.step - 1e-9) H.push([yr, ...RESEARCH.fields.map((f) => Number((A[f] ?? 1).toPrecision(6)))]);
      while (H.length > 1 && yr - H[1][0] > DIFFUSE.keep) H.shift();
    }
    const L = Object.fromEntries(keys.map((k) => [k, byRealm[k].p > 0 ? byRealm[k].L / byRealm[k].p : 0])), add = [];
    for (const i of keys) {
      const A = this.tech[i].A, fr = this.techFrontier(i, L);
      for (const f of RESEARCH.fields) {
        const gap = fr[f].theta * fr[f].F - A[f];
        if (fr[f].top && gap > 0) add.push([A, f, DIFFUSE.kappa * gap * h]);
      }
    }
    for (const [A, f, d] of add) A[f] += d;
  }
  // 入植地の 1 人あたりの生産力 [2011 年の国際ドル] (構造転換の曲線に入れる所得 c.inc): いまの就業の割合で物の部門が作れる付加価値を基準の値段で測り
  // (生産側の実質 GDP。市場の値段の揺れと売れ残りの値下がりを受けない)、物の部門の人 1 人あたりにしたもの (サービスの人も同じ生産力とみなす)。
  // 市場で測った所得 (incomeUSD) を入れると、値段の揺れが需要に跳ね返って経済が振れた (docs/structure.md の 5 の「試してやめたもの」)
  potentialUSD(c) {
    const sh = c.sh || sharesOf(c.focus), x = this.yieldCtx(c);
    const v = sh.farm * basePriceI(RI.food) * this.yieldBy(x, c, 'farm') + sh.mine * MINED_I.reduce((k, i) => k + basePriceI(i) * this.yieldBy(x, c, 'mine', RES[i]), 0)
      + sh.ind * this.vaGoods(basePriceI) * this.yieldBy(x, c, 'ind') + (sh.hi || 0) * this.vaHitech(basePriceI) * this.yieldBy(x, c, 'hi') + sh.home * basePriceI(RI.food) * YIELD.home;
    return (v / Math.max(1 - sh.serv, 0.05) / basePriceI(RI.food)) * STRUCTURE.usdPerT;
  }
  // 入植地の 1 人あたりの実質の所得 [2011 年の国際ドル] (目標 R10 の sim の定義):
  // 所得 (付加価値。自給の分も入れる = GDP) を地元の消費者物価 (食料 1・工業品 0.3・水 0.1 (水が要る入植地だけ) の基準の量を、いまの値段 ÷ 基準の値段で
  // 測ったもの) で割り、食料の基準の値段を 2011 年の世界の穀物の値段 (STRUCTURE.usdPerT) に合わせて読み替え、人口で割る。
  // 工業品 0.3 (低付加価値物品の単位) は、基準の値打ちの STRUCTURE.cpiHitech を高付加価値物品にする (回 KE5。基準の値段で測った量は前と同じ)
  incomeUSD(c, income = this.incomeAll(c)) {
    const gl = 0.3 * (1 - STRUCTURE.cpiHitech), gh = (0.3 * STRUCTURE.cpiHitech * PRICE.goods) / PRICE.hitech;
    const basket = this.needsWater(c) ? [[RI.food, 1], [RI.goods, gl], [RI.hitech, gh], [RI.water, 0.1]] : [[RI.food, 1], [RI.goods, gl], [RI.hitech, gh]];
    const P = basket.reduce((k, [i, q]) => k + q * this.price(c.sys, i), 0) / basket.reduce((k, [i, q]) => k + q * basePriceI(i), 0);
    return (income / P / basePriceI(RI.food)) * STRUCTURE.usdPerT / Math.max(c.pop, 1e-9);
  }
  // 入植地の民間の年の所得 (付加価値) [cr]: 物の産出 × 市場の値段 (工業は投入を引く) + サービス。値段は wagesOf と同じ。
  // 自給 (home) の分は市場を通らないので、税の土台 (incomeOf) には入れない (現実の自給農業も課税されにくい)。GDP に入れるときは incomeAll
  incomeOf(c) { return this.incomeWith(c, this.wagesOf(c)); }
  incomeWith(c, w) { const sh = c.sh || sharesOf(c.focus); return c.pop * MARKET_SECTORS.reduce((k, x) => k + (sh[x] || 0) * w[x], 0); } // w = いまの wagesOf(c) (求めてあるとき)
  incomeAll(c) { const sh = c.sh || sharesOf(c.focus); return this.incomeOf(c) + c.pop * sh.home * basePriceI(RI.food) * YIELD.home; }
  // 人の部門の移り: 稼ぎが平均より低い部門から、年に mobility × (平均との差の割合) の人が出て、平均より高い部門に、差の大きさに比べて入る
  // (移るのに費用がかかるので一度に全員は動かない。Artuç, Chaudhuri & McLaren 2010 の形)。入る先は差の大きさで決まり、いまの大きさには比べないので、
  // 小さな部門 (1% の下限) でも稼ぎが高ければ速く増える (前は割合 × ln(稼ぎ ÷ 平均) で、1% から 30% まで 40 年かかった)。どの部門にも少しは残す
  laborStep(h) {
    const k = Math.min(1, MARKET.mobility * h);
    for (const c of this.colonies) {
      const sh = (c.sh ??= sharesOf(c.focus)), now = this.wagesOf(c);
      const w = (c.wexp ??= { ...now }); // 見込みの稼ぎ (expect 年でならす)
      for (const x of SECTORS) { if (!Number.isFinite(sh[x])) sh[x] = 0; w[x] = (w[x] ?? now[x]) + (now[x] - (w[x] ?? now[x])) * Math.min(1, h / MARKET.expect); }
      let avg = SECTORS.reduce((a, x) => a + sh[x] * w[x], 0);
      const tot = SECTORS.reduce((a, x) => a + w[x], 0);
      if (!(tot > 0)) continue; // どの部門にも稼ぎがなければ動かない
      if (!(avg > 0)) avg = 1e-9 * tot; // いまの部門の稼ぎが 0 で、ほかの部門に稼ぎがあるなら、そちらへ移る
      let out = 0, gain = 0;
      for (const x of SECTORS) { if (w[x] < avg) { const m = k * sh[x] * ((avg - w[x]) / avg); sh[x] -= m; out += m; } else gain += w[x] - avg; }
      if (out > 0 && gain > 0) for (const x of SECTORS) if (w[x] > avg) sh[x] += out * ((w[x] - avg) / gain);
      let sum = 0;
      for (const x of SECTORS) { sh[x] = Math.max(0.001, sh[x]); sum += sh[x]; }
      for (const x of SECTORS) sh[x] /= sum;
      c.wage = avg;
    }
  }
  // 1 刻みの経済。0〜8 の順に、下の econ… のメソッドで進める (前は 1 つの大きな関数だった。大きすぎると JavaScript の最適化 (JIT) に時間がかかり、
  // 物の形が変わるたびに最適化が外れて遅い段階で動く時間が長かったので分けた。順番と計算は分ける前と同じ)
  economy(h) {
    this.stepH = h;
    this.econEnergy(h);
    const flow = {};
    const F = (s) => (flow[s] ??= { prod: zeroRes(), cons: zeroRes(), short: zeroRes(), pop: 0 }); // short = 原料が足りずに使えなかった投入 (交易の買い手が見る)
    const plan = this.econProduce(h, F);
    this.econIndustry(h, F);
    this.econIndustryHi(h, F);
    this.econLocalShort(plan, flow, F);
    const va = this.econConsume(h, F);
    this.econNatives(h, F);
    // 5. 交易路
    this.budgetStep(h);
    this.trade(h, flow);
    // 6. 備蓄の上限を超えた分は捨てる (売る先の「域外」はないので、お金にはならない。物質の保存: 目標 R03)
    for (const [s, st] of Object.entries(this.stock)) {
      const id = Number(s), cap = stockCap(flow[id]?.pop || 0);
      for (let i = 0; i < NRES; i++) if (st[i] > cap) this.mv(id, i, cap - st[i], 'waste');
    }
    this.flowPop = Object.fromEntries(Object.entries(flow).map(([k, v]) => [k, v.pop]));
    this.marketStep(h);
    this.absorb = {};
    this.unmet = {};
    this.laborStep(h);
    this.researchStep(h);
    this.econWages(va);
    this.econUpkeep(h);
    this.econSupply(h, F);
    this.flow = flow;
    this.econIncomeU(h);
    this.econPin(h);
    this.econLedgers(h);
  }
  econEnergy(h) {
    // 0. エネルギー: スウォームの発電を蓄える。蓄えの上限 (SWARM.store 年分の出力) を超えた分は捨てる
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), P = this.power(id);
      if (!P) continue;
      this.bookE('swarm', P * h, id);
      const over = this.govs[id].E - SWARM.store * P;
      if (over > 0) this.bookE('waste', -over, id);
    }
  }
  econProduce(h, F) {
    // 1. 生産: 人口を就業の割合 (c.sh。値段で動く。laborStep) で農業・鉱業・工業・サービスに振り分ける。施設レベル1ごとに +25%。
    //    需要で決まる生産 (段 5 の 3): 部門の人が作れる量 (plan) のうち、星系の需要 (市場のふだんの消費 u。消費・工業の投入・建設・輸出・補給と、足りなかった分) と
    //    在庫の目標 (cover) への不足を MARKET.fill 年で埋める分だけ作る (Metzler 1941 の在庫の形。稼働率 util)。売れない物は作らず、その部門の人は稼働率の分しか稼がない (wagesOf)。
    //    鉱業は埋蔵の資源をまとめて掘るので、いちばん需要のある資源の稼働率で掘る (ほかの資源は副産物。余れば倉の上限で捨てる)
    const plan = {}, yx = []; // yx = 入植地ごとの yieldCtx (下の生産でも同じ値を使う。このあいだ入植地の値は変わらない)
    for (const c of this.colonies) {
      const f = (c.sh ??= sharesOf(c.focus)), P = (plan[c.sys] ??= zeroRes());
      if (!Number.isFinite(f.hi)) f.hi = 0; // 前の版のセーブ (高付加価値の工業がない。回 KE5)
      const x = this.yieldCtx(c);
      yx.push(x);
      P.food += c.pop * f.farm * this.yieldBy(x, c, 'farm');
      for (const i of MINED_I) P[i] += c.pop * f.mine * this.yieldBy(x, c, 'mine', RES[i]);
      P.goods += c.pop * f.ind * this.yieldBy(x, c, 'ind');
      P.hitech += c.pop * f.hi * this.yieldBy(x, c, 'hi');
    }
    const oy = this.outposts.map((o) => this.outpostYield(o)), ky = this.capacity.map((k) => this.capacityYield(k)); // 下の生産でも同じ値を使う
    this.outposts.forEach((o, i) => { const P = (plan[o.sys] ??= zeroRes()); for (const [r, v] of Object.entries(oy[i])) P[RI[r]] += v; });
    this.capacity.forEach((k, i) => { const P = (plan[k.sys] ??= zeroRes()); for (const [r, v] of Object.entries(ky[i])) P[RI[r]] += v; }); // 民間の採掘の能力 (回 KE5)
    this.util = {};
    for (const [key, P] of Object.entries(plan)) {
      const id = Number(key), m = this.market[id], st = this.stockOf(id), K = (this.util[id] = new UtilVec());
      for (let i = 0; i < NRES; i++) {
        if (!MARKET.buy) { K[i] = 1; continue; }
        const u = m ? m.u[i] : 0, want = u + (COVER_I[i] * u - st[i]) / MARKET.fill;
        K[i] = P[i] > 1e-9 ? clamp(want / P[i], 0, 1) : 1;
      }
      let mine = 0; // 埋蔵の資源のうち作れるものの、いちばん高い稼働率
      for (const i of MINED_I) if (P[i] > 1e-9) mine = Math.max(mine, K[i]);
      K.mine = mine;
    }
    this.colonies.forEach((c, i) => {
      const f = c.sh, K = this.util[c.sys], x = yx[i];
      const fl = F(c.sys);
      const add = (i, v) => { this.mv(c.sys, i, v * h, 'extract'); fl.prod[i] += v; }; // 資源は番号で
      add(RI.food, c.pop * f.farm * this.yieldBy(x, c, 'farm') * K.food);
      add(RI.food, c.pop * (f.home || 0) * YIELD.home); // 自給 (自分で食べる分。消費は下で、ほかの人と同じく備蓄から)
      for (const i of MINED_I) add(i, c.pop * f.mine * this.yieldBy(x, c, 'mine', RES[i]) * K.mine);
      c.plan = c.pop * f.ind * this.yieldBy(x, c, 'ind') * K.goods;
      c.planHi = c.pop * f.hi * this.yieldBy(x, c, 'hi') * K.hitech;
      fl.pop += c.pop;
    });
    [...this.outposts, ...this.capacity].forEach((o, i) => {
      const fl = F(o.sys), K = this.util[o.sys], n = this.outposts.length;
      const y = o.lv !== undefined ? (i < n ? oy[i] : this.outpostYield(o)) : i >= n ? ky[i - n] : this.capacityYield(o); // 上の計画で求めた値 (同じ物)
      for (const [r, v] of Object.entries(y)) { const i = RI[r]; this.mv(o.sys, i, v * K.mine * h, 'extract'); fl.prod[i] += v * K.mine; }
    });
    return plan;
  }
  econIndustry(h, F) {
    // 2. 工業: 工業品1につき金属0.5と燃料0.2を使う。原料が足りなければ減産
    for (const c of this.colonies) {
      const st = this.stockOf(c.sys);
      const fl = F(c.sys);
      let need = c.plan * h;
      if (MARKET.buy && need > 0) {
        // 投入が高ければ使う量を減らし、付加価値が出なければ作らない
        const p = (i) => this.price(c.sys, i) / basePriceI(i);
        const unit = 0.5 * this.price(c.sys, RI.metal) + 0.2 * this.price(c.sys, RI.fuel);
        need *= unit < this.price(c.sys, RI.goods) ? clamp(GM.pow((0.5 * PRICE.metal * p(RI.metal) + 0.2 * PRICE.fuel * p(RI.fuel)) / (0.5 * PRICE.metal + 0.2 * PRICE.fuel), -MARKET.input), 0, 1) : 0;
      }
      const k = need > 0 ? clamp(Math.min(st.metal / (0.5 * need), st.fuel / (0.2 * need)), 0, 1) : 0;
      // 原料が足りずに作れなかった分の投入も需要 (掘る合図) に数える。数えないと、原料がない → 工場が止まる → 投入の需要が記録されない → 鉱山も掘らない、の行き詰まりになる
      if (MARKET.buy && need > 0 && k < 1 && this.stepping) { const un = (this.unmet[c.sys] ??= zeroRes()); un.metal += (0.5 * need * (1 - k)) / h; un.fuel += (0.2 * need * (1 - k)) / h; }
      // 質量の釣り合い: 金属 0.5 単位 (50 万 t) が工業品 1 単位 (50 万 t) になる。燃料は燃やして出ていく
      this.mv(c.sys, RI.metal, -0.5 * need * k, 'use');
      this.mv(c.sys, RI.fuel, -0.2 * need * k, 'burn');
      this.mv(c.sys, RI.goods, need * k, 'make');
      const run = c.plan > 0 ? (need / (c.plan * h)) * k : 0; // 稼働率 (値段で減らした分と、原料が足りなかった分)
      fl.cons.metal += 0.5 * c.plan * (MARKET.buy ? run : 1);
      fl.cons.fuel += 0.2 * c.plan * (MARKET.buy ? run : 1);
      if (MARKET.buy && need > 0 && k < 1) { const want = (need / h) * (1 - k); fl.short.metal += 0.5 * want; fl.short.fuel += 0.2 * want; } // 使えなかった原料も、取り寄せる合図にする (trade の use)
      fl.prod.goods += c.plan * run;
      c.industry = run;
      const L = c.lv.slaveworks || 0;
      if (L) {
        const use = SLAVEWORKS_USE * L * h;
        const ks = clamp(st.slaves / use, 0, 1);
        this.mv(c.sys, RI.slaves, -use * ks, 'consume');
        this.mv(c.sys, RI.goods, SLAVEWORKS_OUT * L * h * ks, 'extract'); // 働かされる人が地元で集めた原料から作る
        fl.cons.slaves += SLAVEWORKS_USE * L;
        fl.prod.goods += SLAVEWORKS_OUT * L * ks;
        c.slaveWork = ks;
      }
      if (c.pop >= 1 && c.plan > 0) {
        this.watch(c, 'industry', k, 'shortage', () => `${c.name} の工場が原料 (金属・燃料) 不足で減産 (稼働 ${pct(k)})`, `${c.name} の工場の原料不足が解消した`);
      }
    }
  }
  econIndustryHi(h, F) {
    // 2b. 高付加価値の工業 (回 KE5): 高付加価値物品 1 につき低付加価値物品 0.5 と希少元素 0.05 を使う (HITECH)。原料が足りなければ減産。質量は原料と同じ
    for (const c of this.colonies) {
      const st = this.stockOf(c.sys), fl = F(c.sys);
      let need = (c.planHi || 0) * h;
      if (MARKET.buy && need > 0) {
        // 原料が高ければ減らし (低付加価値の工業と同じ)、利ざや (値段 − 原料) が値段の HITECH.ramp より薄ければ、その分だけ減らす。
        // 低付加価値の工業と同じく「割に合わなければ止める」にすると、低付加価値物品の値段が跳ねるたびに工場が止まって在庫が戻り、また動いて値段が跳ねる、を刻みごとに繰り返した。
        // ならした値段で決める形も試したが、高付加価値物品が値段の天井に張りついたまま人が集まり、首都の農業の人が抜けて飢えた
        const p = (i) => this.price(c.sys, i);
        const unit = HITECH.goods * p(RI.goods) + HITECH.rare * p(RI.rare), base = HITECH.goods * basePriceI(RI.goods) + HITECH.rare * basePriceI(RI.rare);
        need *= clamp(GM.pow(unit / base, -MARKET.input), 0, 1) * clamp((p(RI.hitech) - unit) / (HITECH.ramp * p(RI.hitech)), 0, 1);
      }
      const k = need > 0 ? clamp(Math.min(st.goods / (HITECH.goods * need), st.rare / (HITECH.rare * need)), 0, 1) : 0;
      if (MARKET.buy && need > 0 && k < 1 && this.stepping) { const un = (this.unmet[c.sys] ??= zeroRes()); un.goods += (HITECH.goods * need * (1 - k)) / h; un.rare += (HITECH.rare * need * (1 - k)) / h; }
      this.mv(c.sys, RI.goods, -HITECH.goods * need * k, 'use');
      this.mv(c.sys, RI.rare, -HITECH.rare * need * k, 'use');
      this.mv(c.sys, RI.hitech, need * k, 'make');
      const run = c.planHi > 0 ? (need / (c.planHi * h)) * k : 0;
      fl.cons.goods += HITECH.goods * (c.planHi || 0) * (MARKET.buy ? run : 1);
      fl.cons.rare += HITECH.rare * (c.planHi || 0) * (MARKET.buy ? run : 1);
      if (MARKET.buy && need > 0 && k < 1) { const want = (need / h) * (1 - k); fl.short.goods += HITECH.goods * want; fl.short.rare += HITECH.rare * want; }
      fl.prod.hitech += (c.planHi || 0) * run;
      c.industryHi = run;
    }
  }
  econLocalShort(plan, flow, F) {
    // 地元で作れば儲かるのに作れていない工業品 (市場の需要 − 星系の工場の生産) の原料も、取り寄せる合図にする (docs/regions.md の 2。輸入の代わりに地元で作る)。
    // 工業の人がほとんどいない星系は、いまの工場の不足だけを数えると注文が最小の量に届かず、原料が来ない → 人が来ない、のまま動かなかった
    if (MARKET.buy) for (const key of Object.keys(plan)) {
      const id = Number(key), u = this.market[id]?.u.goods || 0, made = flow[id]?.prod.goods || 0;
      if (!(u > made) || !(0.5 * this.price(id, RI.metal) + 0.2 * this.price(id, RI.fuel) < this.price(id, RI.goods))) continue;
      const fl = F(id), gap = u - made;
      fl.short.metal += 0.5 * gap; fl.short.fuel += 0.2 * gap;
    }
    if (MARKET.buy) for (const key of Object.keys(plan)) { // 高付加価値物品も同じ (回 KE5)
      const id = Number(key), u = this.market[id]?.u.hitech || 0, made = flow[id]?.prod.hitech || 0;
      if (!(u > made) || !(HITECH.goods * this.price(id, RI.goods) + HITECH.rare * this.price(id, RI.rare) < this.price(id, RI.hitech))) continue;
      const fl = F(id), gap = u - made;
      fl.short.goods += HITECH.goods * gap; fl.short.rare += HITECH.rare * gap;
    }
  }
  econConsume(h, F) {
    // 3. 消費と人口の増減、税収
    // 食べ物・水・工業品の在庫は星系でまとめて持つので、不足の知らせは星系でいちばん大きな入植地 (head) だけが出し、ほかの入植地は状態 (alerts) を写す
    // (回 KE4・B-019。前は国の本星の星系のステーションも同じ不足をそれぞれ知らせ、1 試合の飢餓の知らせ約 48 件のうち 27 件がそれだった)
    const head = {}, va = {};
    for (const c of this.colonies) if (!head[c.sys] || c.pop > head[c.sys].pop) head[c.sys] = c;
    for (const c of this.colonies) this.econConsumeOne(c, h, F, head, va);
    for (const c of this.colonies) { // 星系でいちばん大きな入植地の不足の状態を写す (知らせは出さない)
      const H = head[c.sys];
      if (H === c || !H) continue;
      c.alerts ??= {};
      c.alerts.food = !!H.alerts?.food;
      c.alerts.goods = !!H.alerts?.goods;
      if (this.needsWater(c) && this.needsWater(H)) c.alerts.water = !!H.alerts?.water;
    }
    return va;
  }
  // 3 の入植地 1 つ分 (head = 星系でいちばん大きな入植地、va = 星系の市場の付加価値)
  econConsumeOne(c, h, F, head, va) {
    const lead = head[c.sys] === c;
    const st = this.stockOf(c.sys);
    const fl = F(c.sys);
    const inc = c.inc ?? STRUCTURE.y0;
    const ct = MARKET.buy ? this.ctaxAt(c.sys) : 0; // 消費税 (買い物の値段に乗る。セッション 20 の 2)
    let spent = 0, incK; // 家計が買った物の代金 (地元の市場の値段。消費税は別に払う)。incK = 所得の倍率 (資源によらないので 1 回だけ求める)
    const use = (i, v) => { // i = 資源の番号
      let e = MARKET.buy ? ELASTIC_I[i] || 0 : 0;
      if (e && i !== RI.goods) e = Math.max(MARKET.elasticFloor, e * (incK ??= GM.pow(Math.max(inc, 1) / MARKET.elasticY, -MARKET.elasticSlope))); // 所得が高いほど食料は値段に動じない
      const k = e ? clamp(GM.pow((this.price(c.sys, i) * (1 + ct)) / basePriceI(i), -e), 0.3, 2) : 1; // 値段 (消費税を含む) で消費が動く
      fl.cons[i] += v;
      const want = v * k * h;
      const got = Math.min(Math.max(st[i], 0), want);
      this.mv(c.sys, i, -got, 'consume');
      if (MARKET.buy && v * h > got && this.stepping) { const un = (this.unmet[c.sys] ??= zeroRes()); un[i] += (v * h - got) / h; } // 必要な量のうち買えなかった分 (高くて控えた分も) は需要 (作る合図) に数える。値段で控えた消費だけを需要と見ると、不足のまま生産を絞って値段が天井に張りつく
      spent += got * this.price(c.sys, i);
      if (got > 0 && this.stepping) { const b = ((this.basket ??= {})[c.sys] ??= [0, 0]); b[0] += got * this.price(c.sys, i); b[1] += got * basePriceI(i); } // 国の物価の指数 (cbStep)
      return v > 0 ? Math.min(1, got / (v * h)) : 1; // 充足率は必要な量に対して
    };
    const food = use(RI.food, c.pop), wet = this.needsWater(c); // wet = 水を消費する入植地 (天体で決まる)
    const water = wet ? use(RI.water, 0.1 * c.pop) : 1;
    // 工業品の需要は所得で決まる (Engel 曲線)。その値打ちのうち hitechShare の割合が高付加価値物品 (回 KE5)。充足率は値打ちで重みをつけた平均
    const gNeed = (MARKET.buy ? this.goodsNeed(inc) : 0.3) * c.pop, sH = MARKET.buy ? this.hitechShare(inc) : 0;
    const low = use(RI.goods, gNeed * (1 - sH)), high = sH > 0 ? use(RI.hitech, (gNeed * sH * PRICE.goods) / PRICE.hitech) : 1;
    const goods = (1 - sH) * low + sH * high;
    c.sat = { food, water, goods, hitech: high };
    if (lead) this.watch(c, 'food', food, 'famine', () => `${c.name} で飢餓が発生 (食料の充足率 ${pct(food)})`, `${c.name} の飢餓が解消した`);
    if (wet && (lead || !this.needsWater(head[c.sys]))) this.watch(c, 'water', water, 'famine', () => `${c.name} で水不足が発生 (充足率 ${pct(water)})`, `${c.name} の水不足が解消した`);
    if (lead && c.pop >= 1) this.watch(c, 'goods', goods, 'shortage', () => `${c.name} で工業品が不足 (充足率 ${pct(goods)})`, `${c.name} の工業品不足が解消した`);
    const life = Math.min(food, water);
    const n = c.kind === 'planet' ? this.nativeOf(c.sys, c.body) : null;
    const unrest = n && n.st.status !== 'integrated' && n.st.rel < -20 ? 0.02 : 0;
    const welfare = 1 + BUDGET.welfare.growth * this.budgetAt(this.realmOf(c.sys), c.sys, 'welfare'); // 福祉の予算
    const mg = this.modsOf(c.sys).growth, rg = REGIMES[regimeKey(this.govs[c.sys])].growth || 1, cap = this.capOf(c); // 種族・統治体制・人口の上限 (下の 2 つの式で同じ値)
    // 年齢つきの人口 (回 KE2。demography.js): 出生のしやすさ fert は、前の人口の増え方 (POP_GROWTH に掛けていたもの) と同じ要素。飢えと不穏は死亡に上乗せ。
    // 混み具合は、上限の手前 DEMO.crowd の割合から出生を減らす (前のロジスティックの 1 − 人口 ÷ 上限 をそのまま掛けると、上限の 83% の地球で出生が 6 分の 1 になった)
    const fert = welfare * mg * rg * clamp((1 - c.pop / cap) / DEMO.crowd, 0, 1) * life * (0.5 + 0.5 * goods) * (c.plague > this.year ? 0.2 : 1);
    const pop0 = c.pop, nat = this.demoStep(c, h, ED.demoTotal ? 1 : fert, ED.demoTotal ? 0 : 0.05 * (1 - life) + unrest); // 補正のときは、出生のしやすさ・飢えは合計の側 (下) に入れ、年齢の中身は現実の率のまま
    if (ED.demoTotal) {
      // 補正 (台帳の C13): 合計は前のロジスティックの増え方のまま。年齢の中身 (死亡・年をとる・出生率) は現実の率で動かす。年数を 1 世代の比で延ばすと、
      // 現実の率では人口が年 1.3% より速く増えられない (QD-29)。合計に足りない分は、出生率が高い入植地ほど生まれた子として、低い入植地ほど移民の年齢で足す
      // (DEMO.fill の 2 つの出生率で折れ線。豊かな国が人口を移民で保つ形)。多すぎる分は年齢の割合のまま減らす。
      // 試してやめたもの: 全部を子どもにする (豊かな本星で 0〜14 歳 34%)・全部を移民にする (どの入植地も移民の形に寄る)・全部を年齢の割合のまま増やす (高齢も増え、
      // 高齢の死亡率を下げたのと同じになって、低い所得でも 65 歳以上 15%)
      const g0 = Math.min(ED.growthCap, POP_GROWTH * welfare * mg * rg * (1 - c.pop / cap) * life * (0.5 + 0.5 * goods) * (c.plague > this.year ? 0.2 : 1)) - 0.05 * (1 - life) - unrest;
      c.pop = Math.max(0.001, c.pop * (1 + g0 * h));
      const gap = c.pop - nat;
      if (gap > 0) {
        const kb = clamp((c.tfr - DEMO.fill[0]) / (DEMO.fill[1] - DEMO.fill[0]), 0, 1), ms = DEMO.migrant.reduce((x, v) => x + v, 0);
        c.age.m[0] += gap * kb * DEMO.boy; c.age.f[0] += gap * kb * (1 - DEMO.boy);
        for (let a = 0; a < DEMO.bins; a++) { const x = (gap * (1 - kb) * DEMO.migrant[a]) / ms / 2; c.age.f[a] += x; c.age.m[a] += x; }
      } else { const k = nat > 0 ? c.pop / nat : 1; for (let a = 0; a < DEMO.bins; a++) { c.age.f[a] *= k; c.age.m[a] *= k; } }
    } else c.pop = Math.max(0.001, nat);
    c.growth = GM.log(c.pop / Math.max(pop0, 1e-9)) / h; // 年あたりの増え方 (見せる・記録する)
    if (c.pop >= 1) this.watch(c, 'aging', DEMO.alert / Math.max(this.ageShares(c).dep, 1e-9), 'shortage', () => `${c.name} の扶養比が ${Math.round(this.ageShares(c).dep * 100)} に上がった (働き手 100 人で支える子どもと高齢の数。年金と医療が増える)`, `${c.name} の扶養比が下がった`); // 10-5 の知らせ
    const wg = MARKET.buy ? this.wagesOf(c) : null, income = MARKET.buy ? this.incomeWith(c, wg) : 0;
    c.incY = income; // この刻みの所得 (年金と医療で使う。ageSpendStep)
    va[c.sys] = (va[c.sys] || 0) + income * h; // 星系の市場の付加価値 (賃金と配当に分ける。economy の 7)
    if (MARKET.buy) {
      // 家計は買った物とサービスの代金を会社に払う (サービスの売上 = サービスの人の稼ぎの合計)。会社は売上を賃金として家計に払う (刻みの終わり。economy の 7)
      const S = c.pop * (c.sh || sharesOf(c.focus)).serv * wg.serv * h; // wg = 上の所得と同じ wagesOf (このあいだ値段も入植地も変わらない)
      if (spent + S > 0) { this.cash('spend', -(spent + S), { hh: c.sys }); this.cash('spend', spent + S, { fm: c.sys }); }
      if (ct > 0 && spent + S > 0) this.earn('ctax', ct * (spent + S), c.sys, { hh: c.sys }); // 消費税: 物とサービスの買い物の値段 × 税率を、家計が星系の政府に払う
    }
    const base = MARKET.buy ? MARKET.tax * income : BASE_TAX[c.kind] + 0.08 * c.pop * (0.5 + 0.5 * goods); // 所得への税 (前の版は人口から。自給の分は入らない)
    this.earn('tax', base * this.taxK(c.sys) * h, c.sys, { hh: c.sys }); // 星系の家計が払う。税の重さは財政で選ぶ
    if (MARKET.buy) { const y = this.potentialUSD(c); c.inc = c.inc === undefined ? y : c.inc + (y - c.inc) * Math.min(1, h / STRUCTURE.smooth); } // 1 人あたりの生産力 (smooth 年でならす。構造転換の曲線に使う)
  }
  econNatives(h, F) {
    // 4. 先住民: 拠点がある星系では友好度が少しずつ上がる。友好的なら交易、制圧していれば貢納
    for (const [key, st] of Object.entries(this.natives)) {
      const sys = Number(key.split('|')[0]);
      if (!this.isColonized(sys)) continue;
      if (st.status === 'independent') {
        // 征服戦争中は友好度が上がらない
        if (!this.wars.some((w) => `${w.sys}|${w.body}` === key)) st.rel = Math.min(100, st.rel + 3 * h);
        if (st.rel >= 40) {
          this.earn('natives', 0.02 * st.pop * h, sys, { nat: key });
          this.mv(sys, RI.rare, 0.005 * st.pop * h, 'extract'); // 先住民との交易で手に入る
        }
      } else if (st.status === 'subjugated') {
        this.earn('natives', 0.03 * st.pop * h, sys, { nat: key });
      } else {
        const stock = this.stockOf(sys);
        const fl = F(sys);
        for (const [r, v] of Object.entries(this.nativeYield(sys, key.split('|')[1], st))) { const i = RI[r]; this.mv(sys, i, v * h, 'extract'); fl.prod[i] += v; }
      }
    }
  }
  econWages(va) {
    // 7. 賃金と配当: 会社は、この刻みの市場の付加価値の 1 − alpha を賃金として払い (CAPITAL。回 KE5。手持ちが足りなければ借りる)、残りの手持ち
    //    (売上 (家計の買い物・政府の資材の買い付け・輸出) − 賃金) をすべて配当として家計に払う (会社の手持ちは 0)。前は売上をすべて賃金と配当 (wages) として払っていた
    //    (労働分配率は実質 100%)。賃金の全部を「作った物の値打ち」で払う形は前に試して、値段の高いときに在庫を作って安いときに売る (在庫の評価損) で会社の借りが
    //    毎年 GDP の 5〜10% 増え続けた (docs/structure.md の 7)。いまは評価損を配当 (alpha の分) が受ける。会社の手持ちのマイナス (借り) に残るのは、
    //    輸入の代金 (出荷のときに払い、売ってから返す運転資金。回 KE4) と、配当で受けきれなかった評価損。設備の借りは別の残高 (gv.bl。回 KE3)
    if (MARKET.buy) for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[id], W = (1 - CAPITAL.alpha) * (va[id] || 0);
      if (W > 0) { this.cash('wages', -W, { fm: id }); this.cash('wages', W, { hh: id }); }
      if (gv.fm > 0) {
        const v = gv.fm;
        let here = v;
        this.cash('dividend', -v, { fm: id });
        if (gv.own) { // 遠くの持ち主の分 (OWNER): 利潤 (付加価値の alpha。配当できる手持ちまで) × 持ち分を、光速で送る
          const P = Math.min(v, CAPITAL.alpha * (va[id] || 0));
          for (const [o, s] of Object.entries(gv.own)) { const x = P * s; here -= x; this.remit(id, Number(o), x); }
        }
        this.cash('dividend', here, { hh: id });
      }
    }
  }
  econUpkeep(h) {
    // 7. 軍の維持費
    // 駐留する星系の政府が払う (入植していない星系に置いた艦隊と移動中の部隊は太陽系、移動中の艦隊は行き先)。受け取るのは払う星系の民間 (兵の給料と補給の買い付け)
    const payer = (id) => (this.isColonized(id) ? id : 0);
    // 国家方針が軍拡期なら、地球の国の艦隊の維持費が40%安い
    const upk = (p) => WARSHIP_UPKEEP * (this.policy && this.policyAt(p) === 'military' ? 0.6 : 1);
    for (const [id, n] of Object.entries(this.garrison)) if (n) { const p = payer(Number(id)); this.earn('upkeep', -upk(p) * n * h, p, { hh: p }); }
    for (const f of this.fleets) { const p = payer(f.to); this.earn('upkeep', -upk(p) * f.n * h, p, { hh: p }); }
    for (const c of this.colonies) {
      const u = TROOP_UPKEEP * c.troops + SLAVE_TROOP_UPKEEP * c.slaveTroops;
      if (u) this.earn('upkeep', -u * h, c.sys, { hh: c.sys });
    }
    for (const m of this.troopMoves) this.earn('upkeep', -(TROOP_UPKEEP * m.troops + SLAVE_TROOP_UPKEEP * m.slave) * h, 0, { hh: 0 });
  }
  econSupply(h, F) {
    // 8. 兵站: 艦隊は1艦隊あたり年に FLEET_SUPPLY の燃料と金属を使う。駐留する星系の備蓄から出す
    //    (入植していない星系に置いた艦隊と攻撃中の艦隊は、その国の最も近い星系 = 補給の拠点から)。
    //    需要に数えるので、足りなければ交易路で運ばれてくる。備蓄で足りなければ補給不足になって戦力が落ちる
    //    (前は資金で「現地調達」できたが、物がどこからか湧くのでやめた。物質の保存: 目標 R03)
    const supply = (realm, sys, n) => {
      const base = this.supplyBase(realm, sys);
      if (!base) return { k: 0, d: Infinity };
      const st = this.stockOf(base.id), fl = F(base.id);
      let k = 1;
      for (const [r, v] of Object.entries(FLEET_SUPPLY)) {
        const i = RI[r];
        fl.cons[i] += v * n;
        const want = v * n * h;
        const got = Math.min(Math.max(st[i], 0), want);
        this.mv(base.id, i, -got, 'supply');
        if (want > 0) k = Math.min(k, got / want);
      }
      return { k, d: base.d };
    };
    const smooth = (old, k) => (old === undefined ? k : old + (k - old) * Math.min(1, h)); // 1年ほどでならす
    for (const id of Object.keys(this.supplied)) if (!this.garrison[id]) delete this.supplied[id];
    for (const [id, n] of Object.entries(this.garrison)) {
      if (!n) continue;
      const sys = Number(id);
      const sp = supply(this.isColonized(sys) ? this.realmOf(sys) : 0, sys, n);
      this.supplied[id] = { k: smooth(this.supplied[id]?.k, sp.k), d: sp.d };
    }
    for (const b of this.battles) {
      const sa = supply(b.realm, b.sys, b.a, b.realm), sd = supply(this.realmOf(b.sys), b.sys, b.d);
      b.sup = smooth(b.sup, sa.k); b.line = sa.d; b.dsup = smooth(b.dsup, sd.k);
    }
    for (const g of this.sieges) { const sp = supply(g.realm, g.sys, g.ships, g.realm); g.sup = smooth(g.sup, sp.k); g.line = sp.d; }
  }
  econIncomeU(h) {
    // 学歴と学力を決める所得 (SCHOOL.smooth。回 KE5): 刻みの終わりの、市場で測った 1 人あたりの実質の所得 (R10・R62 と同じ incomeUSD) をならす。始めは生産力から。
    // (刻みの途中の所得で測ると、値段と量の 2 刻みの振れがそろって、刻みの終わりの値の約 2 倍になった)
    if (MARKET.buy) for (const c of this.colonies) { const y = this.incomeUSD(c), u = c.incU ?? c.inc ?? y; c.incU = u + (y - u) * Math.min(1, h / SCHOOL.smooth); }
  }
  econPin(h) {
    // 国の外との配当 (GNI − GDP。OWNER。回 KE5): 首都の政府に、1 年でならした年あたりの額 (財政の画面)
    const pinT = this._pinT || {};
    this._pinT = {};
    for (const root of new Set(this.colonizedSystems().map((x) => this.realmOf(x.id)))) {
      const gv = this.govs[root], now = (pinT[root] || 0) / h;
      if (gv && (now || gv.pinY)) gv.pinY = (gv.pinY || 0) + (now - (gv.pinY || 0)) * Math.min(1, h);
    }
  }
  // 収支の表 (gv.ledger・gv.eledger。LedgerVec・ELedgerVec の並びで、番号で回す) を、この刻みの分 (gv.led・gv.eled。名前の物) で 1 年ほどでならす
  econLedgers(h) {
    const a = Math.min(1, h), LK = LedgerVec.prototype.names, EK = ELedgerVec.prototype.names;
    for (const gv of Object.values(this.govs)) {
      const led = gv.led || {}, fresh = !gv.ledger, L = (gv.ledger ??= new LedgerVec());
      for (let i = 0; i < LK.length; i++) {
        const now = (led[LK[i]] || 0) / h, old = L[i];
        L[i] = fresh || old === undefined ? now : old + (now - old) * a; // 値のない名前 (前の版のセーブ) は、いまの値から
      }
      const eled = gv.eled || {};
      for (let i = 0; i < EK.length; i++) {
        const now = (eled[EK[i]] || 0) / h;
        if (!now && gv.eledger?.[i] === undefined) continue; // 使ったことのない種類は表に載せない
        const E = (gv.eledger ??= new ELedgerVec().fill(undefined)), old = E[i];
        E[i] = old === undefined ? now : old + (now - old) * a;
      }
    }
  }

