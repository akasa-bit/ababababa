  // --- 中央銀行・国の物価・利回り・国債の信用の危険 (回 KE1・B-001。式と値は CB、説明は docs/money.md の 5) ---
  cbOf(root) { return (this.cb[root] ??= { P: 1, x: 0, u: 0, pi: CB.pistar, i: CB.rstar + CB.pistar, m: 1, h: [] }); }
  // 人間の国が中央銀行に任せているか (その星系に届いている財政で)
  cbRule(root, id = root) { return !this.isHuman(root) || this.spectate || (this.fiscalFor(root, id).cb ?? 1) === 1; }
  // 景気の速さのずれ (国の GDP の、この 1 年の伸び − speed 年でならした伸び。Walsh 2003 の速さの則) と、国の中立の金利 (回 KE6・B-118。Laubach & Williams 2003・
  // Holston, Laubach & Williams 2023 の形)。毎刻み進める。
  // 中立の金利 s.rs = rs[0] + rs[1] × (1 人あたりの潜在の伸びを trend 年でならしたもの) (幅 rsr。始めは rstar から)。潜在の産出 = 入植地の人口 × 生産力
  //   (potentialUSD。物の部門が作れる付加価値を基準の値段で測ったもの。売れ残りと原料の不足を受けない)
  // 国債の式の「傾向からのずれ」は、入植地の S 字の伸び (始めの年 70% から数十年で 0%) に一方向のならしが遅れて、何十年も幅の端に張りつくので使わない。
  //   潜在の産出からのずれ (この 1 年の伸び − 潜在の産出のこの 1 年の伸び) も試したが、試合の始めに市場が立ち上がる 20 年ほどのあいだ GDP が潜在の産出より
  //   年 15〜20% 速く伸びてずれが幅の上の端に張りつき、R35 (国債の上乗せの債務への傾き) が 0.017 → 0.053 と幅の外になったので使わない (docs/money.md の 5.3)
  // 伸びは、前の刻みにも国にあった星系だけで測る (入植や併合で国が大きくなった分を景気と見ない。前の刻みの値は s.yp・s.pp・s.np)。pot = 星系ごとの [潜在の産出, 人口]
  speedGap(root, s, h, pot) {
    const now = {}, pp = {}, np = {};
    for (const x of this.realmSystems(root)) {
      const y = this.govs[x.id]?.fr?.y, q = pot[x.id];
      if (y > 0) now[x.id] = y;
      if (q?.[0] > 0 && q[1] > 0) { pp[x.id] = q[0]; np[x.id] = q[1]; }
    }
    let a = 0, b = 0, pa = 0, pb = 0, na = 0, nb = 0;
    for (const [id, y] of Object.entries(now)) if (s.yp?.[id] > 0) { a += y; b += s.yp[id]; }
    for (const id of Object.keys(pp)) if (s.pp?.[id] > 0 && s.np?.[id] > 0) { pa += pp[id]; pb += s.pp[id]; na += np[id]; nb += s.np[id]; }
    s.yp = now; s.pp = pp; s.np = np;
    if (a > 0 && b > 0) {
      const g = GM.log(a / b) / h;
      s.g1 = s.g1 === undefined ? g : s.g1 + (g - s.g1) * Math.min(1, h);
      s.gs = s.gs === undefined ? s.g1 : s.gs + (s.g1 - s.gs) * Math.min(1, h / CB.speed);
    }
    if (pa > 0 && pb > 0 && na > 0 && nb > 0) {
      const gpc = GM.log(pa / pb) / h - GM.log(na / nb) / h, gt = s.gt ?? (CB.rstar - CB.rs[0]) / CB.rs[1]; // 始めは中立の金利が rstar になる伸びから
      s.gt = gt + (gpc - gt) * Math.min(1, h / CB.trend);
      s.rs = clamp(CB.rs[0] + CB.rs[1] * s.gt, CB.rsr[0], CB.rsr[1]);
    }
    return s.g1 === undefined ? 0 : clamp(s.g1 - s.gs, CB.gap[0], CB.gap[1]);
  }
  rstarOf(root) { return this.cb[root]?.rs ?? CB.rstar; } // 国の中立の実質の金利
  // 物価の目標 (回 KE9・B-009): 人間の国は財政で選んだ値、ほかの国は CB.pistar。targetSeen = 人々が見込む目標 (s.T。選んだ目標へ CB.theta の速さで近づく)
  targetOf(root) { return this.isHuman(root) && !this.spectate ? this.fiscalFor(root, root).pistar ?? CB.pistar : CB.pistar; }
  targetSeen(root) { return this.cb[root]?.T ?? CB.pistar; }
  // 量的緩和 (回 KE9・B-009): 国の星系の政府ごとに、中央銀行の持つ国債 qb を、その星系で効いている財政の割合 × 国債 へ QE.speed 年かけて近づける。
  // 国ごとの買い入れ ÷ GDP を返す (物価の押し上げ s.q に使う)。中央銀行が国債を銀行から買うと、銀行の国債が準備に替わるだけで、預金・貸出・国債の合計は変わらない。
  // 政府が国債を返した分は、銀行と中央銀行の持つ分に比べて返したとみる (qbB = 前の刻みの国債。不履行で減った分は銀行の分なので qbB からも引く)。買い入れに数えない
  qeStep(h) {
    const out = {};
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key];
      if (!(gv.qb > 0) && !(this.isColonized(id) && this.isHuman(this.realmOf(id)) && !this.spectate)) continue;
      const root = this.realmOf(id), b = gv.bond || 0, want = this.isColonized(id) && this.isHuman(root) && !this.spectate ? (this.fiscalFor(root, id).qe || 0) * b : 0;
      const q0 = Math.min((gv.qb || 0) * (gv.qbB > b ? b / gv.qbB : 1), b), q = Math.max(0, Math.min(b, q0 + (want - q0) * Math.min(1, h / QE.speed)));
      if (q > 0) { gv.qb = q; gv.qbB = b; } else { delete gv.qb; delete gv.qbB; }
      const o = (out[root] ??= [0, 0, 0]);
      o[0] += q - q0;
      o[2] += q0; // 買う前の持ち高 (効きの薄れに使う。回 KE10・B-124)
    }
    for (const [root, o] of Object.entries(out)) for (const x of this.realmSystems(Number(root))) o[1] += this.govs[x.id]?.fr?.y || 0;
    return out;
  }
  // 毎刻み: 国ごとに、物の値段の指数・政策金利・物価の上がり方を進め、政府ごとに長期の利回りと国債の利札を進め、払えない政府は不履行にする
  cbStep(h) {
    const roots = [...new Set(this.colonizedSystems().map((x) => this.realmOf(x.id)))];
    for (const key of Object.keys(this.cb)) if (!roots.includes(Number(key))) delete this.cb[key]; // なくなった国
    const keep = GM.pow(CB.ar, h), B = this.basket || {};
    const sum = {};
    for (const [sys, b] of Object.entries(B)) { const r = this.realmOf(Number(sys)), o = (sum[r] ??= [0, 0]); o[0] += b[0]; o[1] += b[1]; }
    this.basket = {};
    const pot = {}; // 星系ごとの [潜在の産出, 人口]
    for (const c of this.colonies) { const o = (pot[c.sys] ??= [0, 0]); o[0] += c.pop * this.potentialUSD(c); o[1] += c.pop; }
    const qe = this.qeStep(h); // 量的緩和の買い入れ (回 KE9)
    for (const root of roots) {
      const s = this.cbOf(root), gap = this.speedGap(root, s, h, pot), rs = s.rs ?? CB.rstar;
      if (sum[root]?.[1] > 0) s.m = sum[root][0] / sum[root][1];
      // 物価の目標 (回 KE9・B-009): 中央銀行の則は選んだ目標 T で、物価の上がり方と見込みの錨は人々が見込む目標 s.T (T へ CB.theta の速さで近づく)。ふだんは 2% のまま
      const T = this.targetOf(root);
      if (s.T !== undefined || T !== CB.pistar) { s.T = (s.T ?? CB.pistar) + (T - (s.T ?? CB.pistar)) * Math.min(1, CB.theta * h); if (Math.abs(s.T - CB.pistar) < 1e-9 && T === CB.pistar) delete s.T; }
      const Ts = s.T ?? CB.pistar;
      // 量的緩和の物価の押し上げ s.q (買い入れ ÷ GDP × QE.pi を、QE.fade の速さで消える上がり方として足す。合計の上がりが QE.pi × 買い入れ ÷ GDP)。
      // 回 KE10 (B-124): 買い入れ ÷ GDP は、持ち高の効き qeEff の増えた分 (持ち高が GDP の 20% を超えると薄れる)
      const q = qe[root];
      if (s.q || (q && q[0])) { s.q = (s.q || 0) * GM.exp(-QE.fade * h) + (q && q[1] > 0 ? QE.pi * QE.fade * (qeEff((q[2] + q[0]) / q[1]) - qeEff(q[2] / q[1])) : 0); if (Math.abs(s.q) < 1e-12) delete s.q; }
      // s.e = 則から外す分 (政策のショック。ふだんは無い。政策の反応を測る実験 tools/policy-irf.js だけが入れる。回 KE7・B-006)
      const rule = clamp(rs + s.pi + CB.phiPi * (s.pi - T) + CB.phiY * gap + (s.e || 0), RATE_RANGE[0], RATE_RANGE[1]);
      s.i = this.cbRule(root) ? rule : this.fiscalFor(root, root).rate ?? rule;
      s.u = s.u * keep + CB.sd * Math.sqrt(1 - keep * keep) * this.randNormal();
      s.pi = clamp(Ts + s.x + CB.kappa * gap - CB.lambda * (s.i - s.pi - rs) + s.u + (s.q || 0), CB.pi[0], CB.pi[1]);
      s.x += (CB.theta * (s.pi - Ts - s.x) - CB.anchor * s.x) * h;
      s.P *= GM.exp(s.pi * h);
      // 政策金利の記録 (1 年ごと)。いちばん遠い星系に届くまでの分だけ残す
      const y = Math.floor(this.year);
      if (!s.h.length || s.h[s.h.length - 1][0] < y) s.h.push([y, s.i]); else s.h[s.h.length - 1][1] = s.i;
      const far = Math.max(0, ...this.realmSystems(root).map((x) => this.sysDist(root, x.id)));
      while (s.h.length > 1 && s.h[1][0] <= this.year - far - 1) s.h.shift();
    }
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key], b = gv.bond || 0, b0 = gv.b0 || 0;
      if (b > 0) {
        const yl = this.longYield(id);
        if (!(gv.cpn >= -1)) gv.cpn = yl;
        if (b > b0) gv.cpn = (gv.cpn * b0 + yl * (b - b0)) / b; // 新しく出した分は、いまの利回りで
        gv.cpn += (yl - gv.cpn) * Math.min(1, h / CB.roll); // 借り換え
        if (gv.fr?.y > 0 && this.isColonized(id) && b / gv.fr.y > CB.dmax && !this.dfltOut(gv)) this.sovDefault(id);
      } else delete gv.cpn;
      gv.b0 = gv.bond || 0;
    }
  }
  // その星系で効いている政策金利 (名目)。任せていない人間の国は財政の値。任せていれば、首都の中央銀行の決めた値が光速で届いた分
  cbRateAt(id) {
    const root = this.realmOf(id), s = this.cb[root];
    if (!this.cbRule(root, id)) return this.fiscalFor(root, id).rate ?? CB.rstar + CB.pistar;
    if (!s) return CB.rstar + CB.pistar;
    const at = this.year - this.sysDist(root, id);
    let i = s.h.length ? s.h[0][1] : s.i;
    for (const [y, v] of s.h) if (y <= at) i = v;
    return id === root ? s.i : i;
  }
  inflOf(id) { return this.cb[this.realmOf(id)]?.pi ?? CB.pistar; } // その星系の国の物価の上がり方
  cpiOf(root) { const s = this.cb[root]; return s ? s.P * s.m : 1; } // 国の物価の指数
  // その星系で効いている実質の利子率 (政策金利 − 物価の上がり方)。会社と家計の借り・預金・交易の運ぶ年数の利子に使う
  rateAt(id) { return this.cbRateAt(id) - this.inflOf(id); }
  // 長期の国債の利回り (名目): 期待の仮説 (国の中立の金利 + 物価の目標 に戻る) + 期間の上乗せ + 信用の上乗せ
  // 中央銀行の持つ国債 ÷ GDP × QE.tp だけ下がる (量的緩和。回 KE9)。錨の物価は人々が見込む目標 (ふだんは 2%)
  longYield(id) {
    const root = this.realmOf(id), n = this.rstarOf(root) + this.targetSeen(root), i = this.cbRateAt(id), k = CB.persist / CB.mat;
    const gv = this.govs[id], d = gv?.fr?.y > 0 ? Math.min(CB.dmax, (gv.bond || 0) / gv.fr.y) : 0; // 不履行の線より上は同じ (払えない分は不履行で消える)
    const qe = gv?.qb > 0 && gv.fr?.y > 0 ? QE.tp * qeEff(Math.min(gv.qb / gv.fr.y, CB.dmax)) : 0; // 持ち高が GDP の 20% を超えると薄れる (回 KE10・B-124)
    return n + (i - n) * k * (1 - GM.exp(-1 / k)) + CB.tp + CB.credit * d + this.dfltSpread(gv) - qe;
  }
  // 不履行のあと、新しく国債を出せない間か (QD-26 = b。CB.exclude 年。債務の再編は払わなかった割合 gv.hc に比べて伸びる。回 KE9)
  dfltOut(gv) { return gv?.dflt !== undefined && this.year - gv.dflt < (CB.exclude * (gv.hc ?? CB.haircut)) / CB.haircut; }
  // 不履行のあとの利回りの上乗せ (QD-26 = c): 1 年目 haircut × spread[0] から 4〜5 年目 haircut × spread[1] へ指数で下がり、spread[2] 年で消える (haircut = 払わなかった割合)
  dfltSpread(gv) {
    const t = gv?.dflt !== undefined ? this.year - gv.dflt : Infinity;
    if (!(t < CB.spread[2])) return 0;
    const k = GM.log(CB.spread[0] / CB.spread[1]) / 3.5; // 1 年目から 4.5 年目までの下がり方
    return (gv.hc ?? CB.haircut) * CB.spread[0] * GM.exp(-k * Math.max(0, t - 1));
  }
  // 国債の実質の利子率 (利札 − 物価の上がり方)
  bondRate(id) { const gv = this.govs[id]; return (gv.cpn ?? this.longYield(id)) - this.inflOf(id); }
  // 国債の不履行: 銀行が持つ国債 (中央銀行の持つ分 qb を除く) の hc を払わない。銀行の損は、預金 (政府・家計・会社・先住民) から額に比べて引く (銀行の純資産は 0 のまま)。
  // 人間の国が選んだ債務の再編 (restructure。回 KE9) もこれで、知らせは restructure が出す (quiet)。払えた額を返す
  sovDefault(id, hc = CB.haircut, quiet = false) {
    const gv = this.govs[id], x = Math.max(0, (gv.bond || 0) - (gv.qb || 0)) * hc;
    const dep = [];
    let held = 0;
    for (const key of Object.keys(this.govs)) {
      const v = this.govs[key];
      if (v.credits > 0) { dep.push([{ gov: Number(key) }, v.credits]); held += v.credits; }
      if (v.hh > 0) { dep.push([{ hh: Number(key) }, v.hh]); held += v.hh; }
      if (v.fm > 0) { dep.push([{ fm: Number(key) }, v.fm]); held += v.fm; }
    }
    for (const [key, st] of Object.entries(this.natives)) if (st.cr > 0) { dep.push([{ nat: key }, st.cr]); held += st.cr; }
    if (!(x > 0) || !(held > x)) return 0;
    this.bondMove('default', -x, id);
    if (gv.qbB > 0) gv.qbB = Math.max(0, gv.qbB - x); // 中央銀行の持つ分は減らさない (量的緩和の qeStep が返済と見ないように)
    for (const [acct, v] of dep) this.cash('default', -x * (v / held), acct);
    gv.dflt = this.year;
    if (hc !== CB.haircut) gv.hc = hc; else delete gv.hc;
    gv.nd = (gv.nd || 0) + 1; // 不履行の回数
    if (!quiet && this.realmOf(id) === this.cap && !this.spectate) this.event('goal', id, JA`国の星系の政府が国債の ${Math.round(CB.haircut * 100)}% (${Math.round(x)} cr) を払えなくなった (不履行)。預金がそのぶん目減りした。これから ${Math.round(CB.exclude)} 年は新しく国債を出せない`, true);
    return x;
  }
  // 債務の再編 (回 KE9・B-009。命令 restructure): 国のすべての星系の政府の、銀行が持つ国債の hc を払わない (RESTRUCTURE.hc から選ぶ)。
  // 不履行と同じく預金が目減りし、借りられない年数と利回りの上乗せが払わなかった割合に比べて伸びる
  restructure(hc) {
    hc = Number(hc);
    if (!RESTRUCTURE.hc.includes(hc)) return fail('選べない値');
    if (this.dfltOut(this.govs[this.cap])) return fail('不履行か再編のあとで、まだ借りられない間');
    const ids = this.realmSystems(this.cap).map((x) => x.id).filter((id) => this.isColonized(id) && (this.govs[id]?.bond || 0) - (this.govs[id]?.qb || 0) > 1e-6);
    if (!ids.length) return fail('銀行が持つ国債がない');
    let x = 0;
    for (const id of ids) x += this.sovDefault(id, hc, true);
    if (!(x > 0)) return fail('預金が足りず、再編できない');
    const gc = this.govs[this.cap]; // 首都の政府に国債がなくても、国として借りられない間と上乗せを持つ
    gc.dflt = this.year;
    if (hc !== CB.haircut) gc.hc = hc; else delete gc.hc;
    gc.rsx = [this.year, hc]; // 再編の政治の損 (回 KE10・B-125。rsxLoss)
    this.event('goal', this.cap, JA`債務を再編した: 国の ${ids.length} 星系の政府の国債のうち、銀行が持つ分の ${Math.round(hc * 100)}% (${Math.round(x)} cr) を払わない。預金がそのぶん目減りした。これから ${((CB.exclude * hc) / CB.haircut).toFixed(1)} 年は新しく国債を出せず、そのあとも利回りに上乗せがつく`, true);
    return { ok: true };
  }
  // 再編の政治の損 (回 KE10・B-125): 国 root が債務を再編してから RESTRUCTURE.years 年のあいだの、家計の所得に比べた損の割合 (忠誠度と議会に LOSS で効く)
  rsxLoss(root) {
    const r = this.govs[root]?.rsx;
    if (!r) return 0;
    const t = this.year - r[0];
    return t >= 0 && t < RESTRUCTURE.years ? RESTRUCTURE.loss * (r[1] / CB.haircut) * (1 - t / RESTRUCTURE.years) : 0;
  }
  // 国債の残高を動かす (v > 0 で増える)。お金の試験 (MONEY_AUDIT) に、政府の純額 (資金 − 国債) の変化として載せる
  bondMove(kind, v, id) {
    const gv = this.govs[id];
    gv.bond = (gv.bond || 0) + v;
    if (MONEY_AUDIT) { const f = (MONEY_AUDIT[kind] ??= {}); f.gov = (f.gov || 0) - v; }
  }
