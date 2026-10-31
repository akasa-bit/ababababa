  // --- 星系ごとの所得の分け方 (回 KE11・B-127。docs/fiscal.md の 12。値は INEQ・LAND_RANGE) ---
  // 星系の所得の偏り σ (対数正規のばらつき) = 素の偏り + INEQ.agr × (農業の就業の割合 × 地主の割合 − INEQ.agrRef)。地主の割合 = 1 − 効いている土地改革
  ineqSigma(id, land = null) {
    const base = this.ineqBase(id);
    if (!this.isColonized(id)) return base;
    let P = 0, A = 0;
    for (const c of this.coloniesIn(id)) { const sh = c.sh || sharesOf(c.focus); P += c.pop; A += c.pop * ((sh.farm || 0) + (sh.home || 0)); }
    const a = P > 0 ? A / P : INEQ.agrRef, L = 1 - (land ?? (this.fiscalAt(id).land || 0));
    return Math.max(INEQ.min, base + INEQ.agr * (a * L - INEQ.agrRef));
  }
  // 素の偏り: 決めてあれば gv.sgb。なければ、国の首都は国の平均の分布 (INEQ.q) から星系の番号で引き、ほかの星系は首都の値に INEQ.within のずれを足す
  // (どちらも銀河の番号と星系の番号から決まる別のくじ。試合の乱数は使わない)。決めるのは年ごとの ineqYearly (読むだけでは状態を変えない)
  ineqBase(id) {
    const gv = this.govs[id];
    if (gv && Number.isFinite(gv.sgb)) return gv.sgb;
    const rng = new Rng(hashSeed(`${this.galaxy.seed}/ineq/${id}`));
    const root = this.isColonized(id) ? this.realmOf(id) : id;
    if (root !== id) { const u1 = Math.max(1e-12, rng.next()), u2 = rng.next(); return this.ineqBase(root) + INEQ.within * Math.sqrt(-2 * GM.log(u1)) * GM.cos(2 * Math.PI * u2); }
    const Q = INEQ.q, u = rng.next();
    let i = 0;
    while (i < Q.length - 2 && u > Q[i + 1][0]) i++;
    const [u0, s0] = Q[i], [u1, s1] = Q[i + 1];
    return Math.max(INEQ.min, s0 + ((s1 - s0) * (u - u0)) / (u1 - u0)); // 点のあいだは直線、端の外はいちばん近い区間の傾きで延ばす
  }
  // 年に 1 回: 入植地のある星系の素の偏りを決める (はじめて入植地になった年の、その星系の国の首都から)
  ineqYearly() { for (const s of this.colonizedSystems()) { const gv = this.govs[s.id]; if (gv && !Number.isFinite(gv.sgb)) gv.sgb = this.ineqBase(s.id); } }
  // 星系の所得の 5 分位の分け前 (下から。合計 1)。σ の対数正規の分け前 (分位の境の正規分布の点 INEQ_Z)
  quintOf(id) { return quintShares(this.ineqSigma(id)); }
  // --- 帰着の表と損の大きさ (回 KE8・B-012。docs/fiscal.md の 7。値は INCIDENCE・LOSS・ADMIN_LAG、出どころは docs/research/incidence.md) ---
  // 星系の家計の市場の所得 [cr/年] (入植地のこの刻みの所得 incY の合計。自給の分は入らない)
  hhIncomeOf(id) { let y = 0; for (const c of this.coloniesIn(id)) y += c.incY || 0; return y; }
  // 家計の損の割合 ℓ (標準の財政と比べた、家計の市場の所得に対する 1 年の損。LOSS)。f = その星系で効いている財政。
  // 関税は、関税の掛かる輸入 (gv.mx) × 税率 を値段を通して家計が負うとみる (輸入 ÷ 所得は 1 まで。立ち上がりの入植地で、所得より輸入が大きくても損が膨らまないように)
  policyLoss(id, f = this.fiscalAt(id)) {
    const t = taxRateOf(f.tax), ct = f.ctax || 0, Y = f.tariff > 0 ? this.hhIncomeOf(id) : 0, M = this.govs[id]?.mx || 0;
    return { tax: t - MARKET.tax, ctax: (ct * (1 - t)) / (1 + ct), tariff: Y > 0 ? f.tariff * Math.min(1, M / Y) : 0 };
  }
  // 帰着の表: 国 root の財政を f0 から f1 にしたときの、手段ごとの 1 年の損得 [cr/年] (+ が得)。いまの帳簿の大きさに率の差を掛けた 1 次の近い形で、
  // 行動の変化 (買い物・輸入・研究の量) と、そのあとの景気や物価の動きは入れない (Harberger 1962 の帰着の表を、部門の帳簿の行で数える)。
  //   hh = 家計・fm = 会社・gov = 政府 (国の中のすべての星系の政府)・row = ほかの国 (足すと 0)。
  //   q = 国の家計の所得の 5 分位ごとの損得 (家計の分 × INCIDENCE の分け前 + 会社の分のうち星系の家計が持つ分 × 持ち主の分け前 INCIDENCE.firm)。
  //   sys = 星系ごとの { hh, fm (そのうち星系の家計が持つ分 own) } (集団ごとの表 groupIncidence が使う)。lag = 行政の遅れ [年]
  // 手段ごとの前提: 所得への税・消費税は家計が払い、関税は値段を通して家計が負う (輸入の値段への転嫁はほぼ全部。Amiti, Redding & Weinstein 2019・Fajgelbaum ほか 2020)。
  // 政策金利は、国の中の借り手 (家計・会社) が利子の差を払い、銀行を通して預金の持ち主 (ほかの国の預金も) が預金に比べて受け取る (国債の利札は 1 年目は変わらないとみる。
  // 先住民の借りと預金は入れない)。研究開発の税額控除は、国の会社の研究開発費に率の差を掛け、星系に家計の所得に比べて分ける。予算は首都の税収 × 割合の差を、
  // 首都の家計が受け取る (給付・賃金・買い付け)
  incidenceOf(root, f1, f0 = FISCAL_DEFAULT) {
    const ids = this.realmSystems(root).map((s) => s.id).filter((id) => this.isColonized(id) && this.govs[id]);
    const rows = {}, row = (k, label, share, lag) => (rows[k] ??= { k, label, lag, share, hh: 0, fm: 0, gov: 0, row: 0, q: [0, 0, 0, 0, 0], sys: {} });
    const add = (r, id, hh, fm, gov, own = 1) => {
      r.hh += hh; r.fm += fm; r.gov += gov; r.row -= hh + fm + gov;
      const s = (r.sys[id] ??= { hh: 0, fm: 0, own });
      s.hh += hh; s.fm += fm;
    };
    const lagOf = (k) => adminLag(k, f1, f0);
    const t0 = taxRateOf(f0.tax), t1 = taxRateOf(f1.tax), i0 = f0.cb === 0 ? f0.rate : this.cbRateAt(root), i1 = f1.cb === 0 ? f1.rate : this.cbRateAt(root);
    const lc = (f) => { const t = taxRateOf(f.tax), ct = f.ctax || 0; return (ct * (1 - t)) / (1 + ct); };
    // 政策金利: 国の中の借り (家計と会社) と、銀行に置かれたすべての預金 (政府の資金・家計・会社。ほかの国も)
    // (ほかの国の預金の受け取りは、add の差し引き row に入る)
    let L = 0, D = 0, Ysum = 0;
    if (i1 !== i0) {
      for (const id of ids) { const gv = this.govs[id]; L += (gv.hloan || 0) + (gv.hm || 0) + (gv.loan || 0) + (gv.bl || 0); }
      for (const gv of Object.values(this.govs)) D += Math.max(0, gv.credits || 0) + Math.max(0, gv.hh || 0) + Math.max(0, gv.fm || 0);
    }
    for (const id of ids) Ysum += this.hhIncomeOf(id);
    let DR = 0; // 国の中の預金 (金融抑圧と量的緩和の行)
    if ((f1.repress || 0) !== (f0.repress || 0) || (f1.qe || 0) !== (f0.qe || 0)) for (const id of ids) { const v = this.govs[id]; DR += Math.max(0, v.hh || 0) + Math.max(0, v.fm || 0) + Math.max(0, v.credits || 0); }
    const T = this.tech?.[root]?.rd, P = T ? Math.max(0, (T.spend || 0) - (T.pub || 0)) : 0; // 国の会社の研究開発費
    for (const id of ids) {
      const gv = this.govs[id], Y = this.hhIncomeOf(id), M = gv.mx || 0, own = 1 - Object.values(gv.own || {}).reduce((a, s) => a + s, 0);
      if (t1 !== t0) { const x = -(t1 - t0) * Y; add(row('tax', '所得への税', 'tax', lagOf('tax')), id, x, 0, -x); }
      if ((f1.ctax || 0) !== (f0.ctax || 0)) { const x = -(lc(f1) - lc(f0)) * Y; add(row('ctax', '消費税', 'ctax', lagOf('ctax')), id, x, 0, -x); }
      if ((f1.tariff || 0) !== (f0.tariff || 0)) { const x = -((f1.tariff || 0) - (f0.tariff || 0)) * M; add(row('tariff', '関税', 'tariff', lagOf('tariff')), id, x, 0, -x); }
      // 土地改革 (回 KE11・B-127): 家計の所得の合計は変わらず、5 分位の分け前が σ の下がり分だけ上の分位から下の分位へ移る (分位ごとの差 qd)
      if ((f1.land || 0) !== (f0.land || 0) && Y > 0) {
        const a = quintShares(this.ineqSigma(id, f1.land || 0)), b = quintShares(this.ineqSigma(id, f0.land || 0));
        add(row('land', '土地改革', 'land', lagOf('land')), id, 0, 0, 0);
        rows.land.sys[id].qd = a.map((x, q) => Y * (x - b[q]));
      }
      if (i1 !== i0 && D > 0) {
        const di = i1 - i0, k = (L * di) / D;
        add(row('rate', '政策金利', 'rate', lagOf('rate')), id, k * Math.max(0, gv.hh || 0) - di * ((gv.hloan || 0) + (gv.hm || 0)), k * Math.max(0, gv.fm || 0) - di * ((gv.loan || 0) + (gv.bl || 0)), k * Math.max(0, gv.credits || 0), own);
      }
      // 値段の上限 (回 KE9・B-008): 家計が買う物 (食料・水・工業品) は、いまの値段と上限の差 × ふだんの消費を、会社 (売り手) から家計へ。
      // 原料 (金属・燃料・希少元素) は買い手も会社なので、部門では差し引き 0 (行に入れない)。いまの値段が上限で止まっている所は、上限を外したときの値段の上がりを数えない
      for (const r of new Set([...Object.keys(f0.ceil || {}), ...Object.keys(f1.ceil || {})])) {
        if (!RATION_RES.includes(r) && r !== 'hitech') continue;
        const p = this.price(id, r), u = this.market[id]?.u[r] || 0, cap = (f) => (f.ceil?.[r] ? f.ceil[r] * basePrice(r) : Infinity);
        const eff = (c) => (p > c ? c + BLACK.evasion * (p - c) : p); // 闇市の分だけ上限が効かない (回 KE12)
        const x = -(eff(cap(f1)) - eff(cap(f0))) * u;
        if (x) add(row('ceil', '値段の上限', 'ctax', lagOf('ceil')), id, x, -x, 0, own);
      }
      // 金融抑圧と量的緩和 (回 KE9・B-009): 政府が払わなくなる国債の利子 (銀行が持つ国債 × 下げた点数、中央銀行が持つ国債 × (国債の実質の利子 − 政策金利の実質。回 KE10・B-124)) を、
      // 国の中の預金者 (家計・会社・政府) が預金に比べて受け取らない (量的緩和の利回りと物価の動きは入れない。分け前は政策金利と同じ rate)
      for (const [k, label, x] of [['repress', '金融抑圧', Math.max(0, (gv.bond || 0) - (gv.qb || 0)) * ((f1.repress || 0) - (f0.repress || 0))], ['qe', '量的緩和', (gv.bond || 0) * ((f1.qe || 0) - (f0.qe || 0)) * (this.bondRate(id) - this.rateAt(id))]]) {
        if (!x) continue;
        const r = row(k, label, 'rate', lagOf(k));
        add(r, id, 0, 0, x, own);
        if (DR > 0) for (const j of ids) { const v = this.govs[j]; add(r, j, (-x * Math.max(0, v.hh || 0)) / DR, (-x * Math.max(0, v.fm || 0)) / DR, (-x * Math.max(0, v.credits || 0)) / DR, 1 - Object.values(v.own || {}).reduce((a, q) => a + q, 0)); }
      }
      const dc = (f1.rdcredit ?? FISCAL_DEFAULT.rdcredit) - (f0.rdcredit ?? FISCAL_DEFAULT.rdcredit);
      if (dc && P > 0 && Ysum > 0) { const x = (dc * P * Y) / Ysum; add(row('rdcredit', '研究開発の税額控除', 'firm', lagOf('rdcredit')), id, 0, x, -x, own); }
    }
    const gr = this.govs[root], tax = Math.max(0, gr?.ledger?.tax || 0) * (gr?.bpaid ?? 1);
    for (const k of Object.keys(BUDGET)) {
      const db = (f1.budget?.[k] || 0) - (f0.budget?.[k] || 0);
      if (db && tax > 0 && ids.includes(root)) { const x = db * tax; add(row(k, JA`${BUDGET[k].label}の予算`, INCIDENCE[k] ? k : 'income', lagOf('budget')), root, x, 0, -x); }
    }
    // 5 分位に分ける (会社の分は星系の家計が持つ分だけ。遠くの持ち主の分は q に入れない)。所得に比べる手段は星系の所得の分け方で (回 KE11)、土地改革は分位ごとの差 qd
    const sh = (k, q) => INCIDENCE[k][q] / INCIDENCE[k].reduce((a, v) => a + v, 0);
    for (const r of Object.values(rows)) for (const [sid, s] of Object.entries(r.sys)) {
      const Q = r.share === 'income' ? this.quintOf(Number(sid)) : null;
      for (let q = 0; q < 5; q++) r.q[q] += (s.qd ? s.qd[q] : s.hh * (Q ? Q[q] : sh(r.share, q))) + s.fm * s.own * sh('firm', q);
    }
    return Object.values(rows);
  }
  // 星系の集団 (民族 × 所得の 5 分位。groupsOf) ごとの損得 (回 KE8・B-012。回 SE7 の利益集団の支持が使う): f1 にしたときの f0 と比べた 1 年の損得。
  // [{ k: 民族, q: 分位, v: cr/年, rel: v ÷ 集団の家計の所得, by: { 手段: cr/年 } }] (損の大きい順)。民族の間の所得の差は入れていない (どの民族も星系と同じ分位の分け前)
  // rows = 国の帰着の表 (incidenceOf。いくつもの星系で使うときに渡す)
  groupIncidence(id, f1, f0 = FISCAL_DEFAULT, rows = this.incidenceOf(this.realmOf(id), f1, f0)) {
    const G = this.groupsOf(id);
    if (!G) return [];
    const Y = this.hhIncomeOf(id), out = [], Q = this.quintOf(id); // 星系の所得の分け方 (回 KE11)
    const sh = (k, q) => (k === 'income' ? Q[q] : INCIDENCE[k][q] / INCIDENCE[k].reduce((a, v) => a + v, 0));
    for (const e of G.eth) for (let q = 0; q < 5; q++) {
      const by = {};
      for (const r of rows) { const s = r.sys[id]; if (s) by[r.k] = e.share * ((s.qd ? s.qd[q] : s.hh * sh(r.share, q)) + s.fm * s.own * sh('firm', q)); }
      const v = Object.values(by).reduce((a, x) => a + x, 0), inc = Y * e.share * Q[q];
      out.push({ k: e.k, q, v, rel: inc > 0 ? v / inc : 0, by });
    }
    return out.sort((a, b) => a.rel - b.rel);
  }
  // 手段の、集団の分位ごとの重さの倍率 φ (分位の分け前 ÷ 所得の分け前 を、人口で平均して 1 にしたもの)。集団の忠誠度の差 (groupDev) が使う
  // Q = 星系の所得の 5 分位の分け前 (quintOf。省くと標準の分け前 GROUPS.quint。回 KE11)
  incFactor(k, q, Q = null) {
    const r = (j) => INCIDENCE[k][j] / INCIDENCE[k].reduce((a, v) => a + v, 0) / (Q ? Q[j] : groupQuint(j));
    return r(q) / ((r(0) + r(1) + r(2) + r(3) + r(4)) / 5);
  }
