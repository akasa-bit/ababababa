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
    const T = this.tech?.[root]?.rd, P = T ? Math.max(0, (T.spend || 0) - (T.pub || 0)) : 0; // 国の会社の研究開発費
    for (const id of ids) {
      const gv = this.govs[id], Y = this.hhIncomeOf(id), M = gv.mx || 0, own = 1 - Object.values(gv.own || {}).reduce((a, s) => a + s, 0);
      if (t1 !== t0) { const x = -(t1 - t0) * Y; add(row('tax', '所得への税', 'tax', lagOf('tax')), id, x, 0, -x); }
      if ((f1.ctax || 0) !== (f0.ctax || 0)) { const x = -(lc(f1) - lc(f0)) * Y; add(row('ctax', '消費税', 'ctax', lagOf('ctax')), id, x, 0, -x); }
      if ((f1.tariff || 0) !== (f0.tariff || 0)) { const x = -((f1.tariff || 0) - (f0.tariff || 0)) * M; add(row('tariff', '関税', 'tariff', lagOf('tariff')), id, x, 0, -x); }
      if (i1 !== i0 && D > 0) {
        const di = i1 - i0, k = (L * di) / D;
        add(row('rate', '政策金利', 'rate', lagOf('rate')), id, k * Math.max(0, gv.hh || 0) - di * ((gv.hloan || 0) + (gv.hm || 0)), k * Math.max(0, gv.fm || 0) - di * ((gv.loan || 0) + (gv.bl || 0)), k * Math.max(0, gv.credits || 0), own);
      }
      const dc = (f1.rdcredit ?? FISCAL_DEFAULT.rdcredit) - (f0.rdcredit ?? FISCAL_DEFAULT.rdcredit);
      if (dc && P > 0 && Ysum > 0) { const x = (dc * P * Y) / Ysum; add(row('rdcredit', '研究開発の税額控除', 'firm', lagOf('rdcredit')), id, 0, x, -x, own); }
    }
    const gr = this.govs[root], tax = Math.max(0, gr?.ledger?.tax || 0) * (gr?.bpaid ?? 1);
    for (const k of Object.keys(BUDGET)) {
      const db = (f1.budget?.[k] || 0) - (f0.budget?.[k] || 0);
      if (db && tax > 0 && ids.includes(root)) { const x = db * tax; add(row(k, JA`${BUDGET[k].label}の予算`, INCIDENCE[k] ? k : 'income', lagOf('budget')), root, x, 0, -x); }
    }
    // 5 分位に分ける (会社の分は星系の家計が持つ分だけ。遠くの持ち主の分は q に入れない)
    const sh = (k, q) => (k === 'income' ? groupQuint(q) : INCIDENCE[k][q] / INCIDENCE[k].reduce((a, v) => a + v, 0));
    for (const r of Object.values(rows)) for (const s of Object.values(r.sys)) for (let q = 0; q < 5; q++) r.q[q] += s.hh * sh(r.share, q) + s.fm * s.own * sh('firm', q);
    return Object.values(rows);
  }
  // 星系の集団 (民族 × 所得の 5 分位。groupsOf) ごとの損得 (回 KE8・B-012。回 SE7 の利益集団の支持が使う): f1 にしたときの f0 と比べた 1 年の損得。
  // [{ k: 民族, q: 分位, v: cr/年, rel: v ÷ 集団の家計の所得, by: { 手段: cr/年 } }] (損の大きい順)。民族の間の所得の差は入れていない (どの民族も星系と同じ分位の分け前)
  // rows = 国の帰着の表 (incidenceOf。いくつもの星系で使うときに渡す)
  groupIncidence(id, f1, f0 = FISCAL_DEFAULT, rows = this.incidenceOf(this.realmOf(id), f1, f0)) {
    const G = this.groupsOf(id);
    if (!G) return [];
    const Y = this.hhIncomeOf(id), out = [];
    const sh = (k, q) => (k === 'income' ? groupQuint(q) : INCIDENCE[k][q] / INCIDENCE[k].reduce((a, v) => a + v, 0));
    for (const e of G.eth) for (let q = 0; q < 5; q++) {
      const by = {};
      for (const r of rows) { const s = r.sys[id]; if (s) by[r.k] = e.share * (s.hh * sh(r.share, q) + s.fm * s.own * sh('firm', q)); }
      const v = Object.values(by).reduce((a, x) => a + x, 0), inc = Y * e.share * groupQuint(q);
      out.push({ k: e.k, q, v, rel: inc > 0 ? v / inc : 0, by });
    }
    return out.sort((a, b) => a.rel - b.rel);
  }
  // 手段の、集団の分位ごとの重さの倍率 φ (分位の分け前 ÷ 所得の分け前 を、人口で平均して 1 にしたもの)。集団の忠誠度の差 (groupDev) が使う
  incFactor(k, q) {
    const r = (j) => INCIDENCE[k][j] / INCIDENCE[k].reduce((a, v) => a + v, 0) / groupQuint(j);
    return r(q) / ((r(0) + r(1) + r(2) + r(3) + r(4)) / 5);
  }
