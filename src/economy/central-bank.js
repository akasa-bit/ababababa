  // --- 中央銀行・国の物価・利回り・国債の信用の危険 (回 KE1・B-001。式と値は CB、説明は docs/money.md の 5) ---
  cbOf(root) { return (this.cb[root] ??= { P: 1, x: 0, u: 0, pi: CB.pistar, i: CB.rstar + CB.pistar, m: 1, h: [] }); }
  // 人間の国が中央銀行に任せているか (その星系に届いている財政で)
  cbRule(root, id = root) { return !this.isHuman(root) || this.spectate || (this.fiscalFor(root, id).cb ?? 1) === 1; }
  // 景気の速さのずれ (国の GDP の、この 1 年の伸び − speed 年でならした伸び。Walsh 2003 の速さの則)。毎刻み進める。
  // 国債の式の「傾向からのずれ」は、入植地の S 字の伸び (始めの年 70% から数十年で 0%) に一方向のならしが遅れて、何十年も幅の端に張りつくので使わない
  // 伸びは、前の刻みにも国にあった星系だけで測る (入植や併合で国が大きくなった分を景気と見ない。前の刻みの値は s.yp)
  speedGap(root, s, h, systems = this.realmSystems(root)) {
    const now = {};
    for (const x of systems) { const y = this.govs[x.id]?.fr?.y; if (y > 0) now[x.id] = y; }
    let a = 0, b = 0;
    for (const [id, y] of Object.entries(now)) if (s.yp?.[id] > 0) { a += y; b += s.yp[id]; }
    s.yp = now;
    if (a > 0 && b > 0) {
      const g = GM.log(a / b) / h;
      s.g1 = s.g1 === undefined ? g : s.g1 + (g - s.g1) * Math.min(1, h);
      s.gs = s.gs === undefined ? s.g1 : s.gs + (s.g1 - s.gs) * Math.min(1, h / CB.speed);
    }
    return s.g1 === undefined ? 0 : clamp(s.g1 - s.gs, CB.gap[0], CB.gap[1]);
  }
  // 毎刻み: 国ごとに、物の値段の指数・政策金利・物価の上がり方を進め、政府ごとに長期の利回りと国債の利札を進め、払えない政府は不履行にする
  cbStep(h) {
    const roots = [...new Set(this.colonizedSystems().map((x) => this.realmOf(x.id)))];
    const bySys = this.systemsByRealm(); // 国ごとの入植星系 (realmSystems と同じ並び。この中で国は変わらないので 1 回だけ分ける)
    for (const key of Object.keys(this.cb)) if (!roots.includes(Number(key))) delete this.cb[key]; // なくなった国
    const keep = GM.pow(CB.ar, h), B = this.basket || {};
    const sum = {};
    for (const [sys, b] of Object.entries(B)) { const r = this.realmOf(Number(sys)), o = (sum[r] ??= [0, 0]); o[0] += b[0]; o[1] += b[1]; }
    this.basket = {};
    for (const root of roots) {
      const s = this.cbOf(root), gap = this.speedGap(root, s, h, bySys.get(root) || []);
      if (sum[root]?.[1] > 0) s.m = sum[root][0] / sum[root][1];
      const rule = clamp(CB.rstar + s.pi + CB.phiPi * (s.pi - CB.pistar) + CB.phiY * gap, RATE_RANGE[0], RATE_RANGE[1]);
      s.i = this.cbRule(root) ? rule : this.fiscalFor(root, root).rate ?? rule;
      s.u = s.u * keep + CB.sd * Math.sqrt(1 - keep * keep) * this.randNormal();
      s.pi = clamp(CB.pistar + s.x + CB.kappa * gap - CB.lambda * (s.i - s.pi - CB.rstar) + s.u, CB.pi[0], CB.pi[1]);
      s.x += (CB.theta * (s.pi - CB.pistar - s.x) - CB.anchor * s.x) * h;
      s.P *= GM.exp(s.pi * h);
      // 政策金利の記録 (1 年ごと)。いちばん遠い星系に届くまでの分だけ残す
      const y = Math.floor(this.year);
      if (!s.h.length || s.h[s.h.length - 1][0] < y) s.h.push([y, s.i]); else s.h[s.h.length - 1][1] = s.i;
      const far = Math.max(0, ...(bySys.get(root) || []).map((x) => this.sysDist(root, x.id)));
      while (s.h.length > 1 && s.h[1][0] <= this.year - far - 1) s.h.shift();
    }
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key], b = gv.bond || 0, b0 = gv.b0 || 0;
      if (b > 0) {
        const yl = this.longYield(id);
        if (!(gv.cpn >= -1)) gv.cpn = yl;
        if (b > b0) gv.cpn = (gv.cpn * b0 + yl * (b - b0)) / b; // 新しく出した分は、いまの利回りで
        gv.cpn += (yl - gv.cpn) * Math.min(1, h / CB.roll); // 借り換え
        if (gv.fr?.y > 0 && this.isColonized(id) && b / gv.fr.y > CB.dmax) this.sovDefault(id);
      } else delete gv.cpn;
      gv.b0 = gv.bond || 0;
    }
  }
  // その星系で効いている政策金利 (名目)。任せていない人間の国は財政の値。任せていれば、首都の中央銀行の決めた値が光速で届いた分
  cbRateAt(id) {
    const root = this.realmOf(id), s = this.cb[root];
    if (!this.cbRule(root, id)) return this.fiscalFor(root, id).rate ?? CB.rstar + CB.pistar;
    if (!s) return CB.rstar + CB.pistar;
    if (id === root) return s.i;
    // 記録は年の順に並んでいるので、at 以前でいちばん新しい記録を二分探索で探す (なければ最初の記録、記録がなければいまの値。頭から見ていくのと同じ結果)
    const at = this.year - this.sysDist(root, id), H = s.h;
    if (!H.length) return s.i;
    if (!(H[0][0] <= at)) return H[0][1];
    let lo = 0, hi = H.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (H[m][0] <= at) lo = m; else hi = m - 1; }
    return H[lo][1];
  }
  inflOf(id) { return this.cb[this.realmOf(id)]?.pi ?? CB.pistar; } // その星系の国の物価の上がり方
  cpiOf(root) { const s = this.cb[root]; return s ? s.P * s.m : 1; } // 国の物価の指数
  // その星系で効いている実質の利子率 (政策金利 − 物価の上がり方)。会社と家計の借り・預金・交易の運ぶ年数の利子に使う
  rateAt(id) { return this.cbRateAt(id) - this.inflOf(id); }
  // 長期の国債の利回り (名目): 期待の仮説 + 期間の上乗せ + 信用の上乗せ
  longYield(id) {
    const n = CB.rstar + CB.pistar, i = this.cbRateAt(id), k = CB.persist / CB.mat;
    const gv = this.govs[id], d = gv?.fr?.y > 0 ? Math.min(CB.dmax, (gv.bond || 0) / gv.fr.y) : 0; // 不履行の線より上は同じ (払えない分は不履行で消える)
    return n + (i - n) * k * (1 - GM.exp(-1 / k)) + CB.tp + CB.credit * d;
  }
  // 国債の実質の利子率 (利札 − 物価の上がり方)
  bondRate(id) { const gv = this.govs[id]; return (gv.cpn ?? this.longYield(id)) - this.inflOf(id); }
  // 国債の不履行: 国債の haircut を払わない。銀行の損は、預金 (政府・家計・会社・先住民) から額に比べて引く (銀行の純資産は 0 のまま)
  sovDefault(id) {
    const gv = this.govs[id], x = (gv.bond || 0) * CB.haircut;
    const dep = [];
    let held = 0;
    for (const key of Object.keys(this.govs)) {
      const v = this.govs[key];
      if (v.credits > 0) { dep.push([{ gov: Number(key) }, v.credits]); held += v.credits; }
      if (v.hh > 0) { dep.push([{ hh: Number(key) }, v.hh]); held += v.hh; }
      if (v.fm > 0) { dep.push([{ fm: Number(key) }, v.fm]); held += v.fm; }
    }
    for (const [key, st] of Object.entries(this.natives)) if (st.cr > 0) { dep.push([{ nat: key }, st.cr]); held += st.cr; }
    if (!(x > 0) || !(held > x)) return;
    this.bondMove('default', -x, id);
    for (const [acct, v] of dep) this.cash('default', -x * (v / held), acct);
    gv.dflt = this.year;
    gv.nd = (gv.nd || 0) + 1; // 不履行の回数
    if (this.realmOf(id) === this.cap && !this.spectate) this.event('goal', id, `国の星系の政府が国債の ${Math.round(CB.haircut * 100)}% (${Math.round(x)} cr) を払えなくなった (不履行)。預金がそのぶん目減りした`, true);
  }
  // 国債の残高を動かす (v > 0 で増える)。お金の試験 (MONEY_AUDIT) に、政府の純額 (資金 − 国債) の変化として載せる
  bondMove(kind, v, id) {
    const gv = this.govs[id];
    gv.bond = (gv.bond || 0) + v;
    if (MONEY_AUDIT) { const f = (MONEY_AUDIT[kind] ??= {}); f.gov = (f.gov || 0) - v; }
  }
