  // --- 年齢つきの人口 (回 KE2・B-010。式と値は DEMO、説明は docs/demography.md) ---
  // 入植地の所得で補間した、5 歳きざみの率 { f, m, asfr } (現実の年あたり)。所得は 2021 年のドル
  // 補間の位置は 1% きざみに丸め、率と 1 刻みの生き残りの割合 (sf・sm。dt ごと) を使い回す (セーブには入れない。決まった計算の exp が重く、試合が 3 割遅くなったので)
  demoRates(c, dt) {
    const R = DEMO.rates, L = (this._demoLn ??= R.map((x) => GM.log(x.income))), y = GM.log(Math.max(1, (c.inc ?? STRUCTURE.y0) * DEMO.usd2021));
    let i = 0;
    while (i < R.length - 2 && y > L[i + 1]) i++;
    const t = Math.round(clamp((y - L[i]) / (L[i + 1] - L[i]), 0, 1) * 100) / 100, key = `${i}|${t}|${dt}`;
    const C = (this._demoCache ??= new Map());
    let r = C.get(key);
    if (!r) {
      const mix = (k) => R[i][k].map((v, j) => v + (R[i + 1][k][j] - v) * t);
      r = { f: mix('f'), m: mix('m'), asfr: mix('asfr') };
      if (dt !== undefined) { r.sf = r.f.map((mx) => GM.exp(-mx * dt)); r.sm = r.m.map((mx) => GM.exp(-mx * dt)); }
      r.tfr = r.asfr.reduce((k, v) => k + v, 0) * DEMO.width;
      C.set(key, r);
    }
    return r;
  }
  // 年齢の表を c.pop に合わせる。ほかの所 (移民・入植・徴兵・戦争・疫病) が c.pop を動かした分は、増えたなら移民の年齢で足し、減ったなら年齢の割合のまま減らす。
  // 表がなければ作る: 人口の多い入植地 (始めからある本星) は、その所得の率で死なずに残る割合の形 (定常人口)、ほかは移民の年齢
  ageSync(c) {
    const n = DEMO.bins, mig = DEMO.migrant, ms = mig.reduce((k, v) => k + v, 0);
    if (!c.age) {
      let w = mig;
      if (c.pop > 100) {
        const r = this.demoRates(c);
        let l = 1;
        w = [];
        for (let a = 0; a < n; a++) { w.push(l); l *= GM.exp(-((r.f[a] + r.m[a]) / 2) * DEMO.width); }
      }
      const s = w.reduce((k, v) => k + v, 0);
      c.age = { f: w.map((v) => (c.pop * v) / s / 2), m: w.map((v) => (c.pop * v) / s / 2) };
      return;
    }
    const S = c.age.f.reduce((k, v) => k + v, 0) + c.age.m.reduce((k, v) => k + v, 0);
    const d = c.pop - S;
    if (Math.abs(d) <= 1e-12 * Math.max(1, c.pop)) return;
    if (d > 0 || !(S > 0)) for (let a = 0; a < n; a++) { const x = (Math.max(d, 0) * mig[a]) / ms / 2; c.age.f[a] += x; c.age.m[a] += x; }
    else { const k = c.pop / S; for (let a = 0; a < n; a++) { c.age.f[a] *= k; c.age.m[a] *= k; } }
  }
  // 1 刻み: 死亡 (率 × 1 ÷ 世代の比、飢えと不穏の上乗せ extra は年あたり)、年をとる (きざみの 1 ÷ (5 × 世代の比) ずつ次へ)、出生 (年齢別出生率 × fert)。
  // fert = 出生のしやすさ (福祉・種族・統治体制・混み具合・食べ物と工業品の充足・疫病。前の人口の増え方 POP_GROWTH に掛けていたもの)。新しい人口を返す
  demoStep(c, h, fert, extra) {
    this.ageSync(c);
    const G = ED.generation / 28, dt = h / G, r = this.demoRates(c, dt), n = DEMO.bins, up = Math.min(1, dt / DEMO.width), ex = extra ? GM.exp(-extra * h) : 1;
    let births = 0;
    for (let a = 0; a < n; a++) births += c.age.f[a] * r.asfr[a] * dt;
    births *= Math.max(0, fert);
    c.tfr = r.tfr; // その年に当てた合計特殊出生率 (目標 R37 を測る)
    for (const [s, sv] of [['f', r.sf], ['m', r.sm]]) {
      const A = c.age[s];
      for (let a = 0; a < n; a++) A[a] *= sv[a] * ex;
      for (let a = n - 2; a >= 0; a--) { const x = A[a] * up; A[a] -= x; A[a + 1] += x; }
    }
    c.age.m[0] += births * DEMO.boy;
    c.age.f[0] += births * (1 - DEMO.boy);
    const pop = c.age.f.reduce((k, v) => k + v, 0) + c.age.m.reduce((k, v) => k + v, 0);
    c.ws = this.ageShares(c).work; // 働き手の割合 (生産に効く。yieldOf)
    this.eduStep(c, up, births); // 学歴 (回 KE5)
    return pop;
  }
  // 年齢 3 区分の割合と扶養比 { young (0〜14 歳), work (15〜64 歳), old (65 歳〜), dep = (young + old) ÷ work }。表がなければ移民の年齢で
  ageShares(c) {
    const [w0, w1] = DEMO.work;
    let y = 0, w = 0, o = 0;
    const add = (a, v) => { if (a < w0) y += v; else if (a <= w1) w += v; else o += v; };
    if (c.age) for (let a = 0; a < DEMO.bins; a++) add(a, c.age.f[a] + c.age.m[a]);
    else DEMO.migrant.forEach((v, a) => add(a, v));
    const s = y + w + o || 1;
    return { young: y / s, work: w / s, old: o / s, dep: w > 0 ? (y + o) / w : 0 };
  }
  // 生産に効く働き手の倍率 (働き手の割合 ÷ 世界の 2023 年の割合)
  laborK(c) { return (c.ws ?? DEMO.workRef) / DEMO.workRef; }
  // --- 学歴と生産性 (SCHOOL。回 KE5・B-117。docs/hcap.md) ---
  // 表 c.edu = { 集団の鍵: { p: [5 歳の区分ごとの人数 (百万人)], s: [区分ごとの平均の就学年数], q: [区分ごとの平均の学力 (LEARN)] } }。区分は年齢の表 c.age と同じ
  // (人数の合計は c.age に合わせる)。就学年数と学力を持つのは 25 歳の区分 (SCHOOL.bin) から上だけ。鍵はいまは生まれ (here = ここ生まれ・away = よそ生まれ)。
  // 政治の SE6 が階層と価値観を足せる
  // 就学年数の折れ線の収益 φ(s) と、所得 y [2011 年のドル] の若い世代の曲線 (pct = 予算の教育の支出 ÷ GDP [%])
  schoolPhi(s) { const R = SCHOOL.ret; let v = 0, lo = 0; for (let i = 0; i < R.length; i++) { const hi = R[i][0]; v += R[i][1] * clamp(s - lo, 0, hi - lo); lo = hi; } return v; }
  schoolCurve(y, pct = 0) { return SCHOOL.top / (1 + GM.exp(-(SCHOOL.young[0] + SCHOOL.young[1] * GM.log(Math.max(y, 1)) + SCHOOL.spend * pct))); }
  // 始めの年齢ごとの就学年数: 年上の区分ほど、学校を出たころの所得が年 SCHOOL.cohort ずつ低かったとみる (EdStats の年齢の区分の就学年数に当てた値)
  schoolAgeProfile(y) { return Array.from({ length: DEMO.bins }, (_, a) => (a < SCHOOL.bin ? 0 : this.schoolCurve(y * GM.exp(-SCHOOL.cohort * DEMO.width * (a - SCHOOL.bin))))); }
  // 学校を出る世代の学力 (LEARN) と、始めの年齢ごとの学力 (就学年数と同じ所得の読み替え)
  learnCurve(y, pct = 0) { return LEARN.lo + (LEARN.hi - LEARN.lo) / (1 + GM.exp(-(LEARN.a + LEARN.b * GM.log(Math.max(y, 1)) + LEARN.spend * pct))); }
  learnAgeProfile(y) { return Array.from({ length: DEMO.bins }, (_, a) => this.learnAgeAt(y, a)); }
  learnAgeAt(y, a) { return a < SCHOOL.bin ? 0 : this.learnCurve(y * GM.exp(-SCHOOL.cohort * DEMO.width * (a - SCHOOL.bin))); } // learnAgeProfile の区分 a だけ
  // 学校を出る世代の学歴と学力を決める所得 (市場で測った所得をならしたもの。SCHOOL の説明) と、始めの形を決める所得 (まだ測れていなければ生産力)
  eduY(c) { return c.incU ?? c.inc ?? STRUCTURE.y0; }
  eduIncome(c) { return c.incU ?? c.inc ?? (MARKET.buy ? this.potentialUSD(c) : STRUCTURE.y0); }
  // 年齢の表 (なければ移民の年齢) の人数で、就学年数の形 s・学力の形 q (なければこの入植地の所得の形) の 1 つの集団を作る
  eduGroup(c, s, q = this.learnAgeProfile(this.eduIncome(c))) {
    const T = c.age ? c.age.f.map((v, a) => v + c.age.m[a]) : DEMO.migrant.map((v) => (c.pop * v) / DEMO.migrant.reduce((k, x) => k + x, 0));
    return { p: T, s: [...s], q: [...q] };
  }
  // 集団ごとの表。ないとき (始めからある入植地・前の版のセーブ) は、所得の年齢ごとの形の「ここ生まれ」で作る。学力のない前の版の集団には、所得の形の学力を足す
  schoolBy(c) {
    const E = (c.edu ??= { here: this.eduGroup(c, this.schoolAgeProfile(this.eduIncome(c))) });
    for (const g of Object.values(E)) g.q ??= this.learnAgeProfile(this.eduIncome(c));
    return E;
  }
  // 区分ごとの、集団を合わせた平均 (k = 's' 就学年数・'q' 学力。移民と入植者が運ぶ形)。人のいない区分は 0 (学力は所得の形の値)
  eduAvg(c, k) {
    const E = Object.values(this.schoolBy(c)), q0 = k === 'q' ? this.learnAgeProfile(this.eduIncome(c)) : null;
    return Array.from({ length: DEMO.bins }, (_, a) => { let p = 0, v = 0; for (const g of E) { p += g.p[a]; v += g.p[a] * g[k][a]; } return p > 0 ? v / p : q0 ? q0[a] : 0; });
  }
  schoolAges(c) { return this.eduAvg(c, 's'); }
  learnAges(c) { return this.eduAvg(c, 'q'); }
  eduAges(c) { return { s: this.schoolAges(c), q: this.learnAges(c) }; }
  // 年齢の区分 a0〜a1 の人の平均 (f = 就学年数と学力の関数)
  schoolMean(c, f = (s) => s, a0 = SCHOOL.bin, a1 = DEMO.bins - 1) {
    let p = 0, v = 0;
    for (const g of Object.values(this.schoolBy(c))) for (let a = a0; a <= a1; a++) { p += g.p[a]; v += g.p[a] * f(g.s[a], g.q[a]); }
    return p > 0 ? v / p : 0;
  }
  // 大人 (25 歳〜) の平均の就学年数と学力
  schoolOf(c) { return this.schoolMean(c); }
  learnOf(c) { return this.schoolMean(c, (s, q) => q); }
  // 働く人の生産性の倍率 (yieldOf): 25〜64 歳の exp(φ(学力で直した就学年数 s × q ÷ full)) の平均 ÷ exp(φ(ref))
  schoolK(c) { return this.schoolMean(c, (s, q) => GM.exp(this.schoolPhi((s * q) / LEARN.full)), SCHOOL.bin, DEMO.work[1]) / this.schoolRefK() || 1; }
  // 基準の就学年数の exp(φ(ref)) (表 SCHOOL が同じあいだは覚えておく)
  schoolRefK() {
    const m = this._schoolRefK;
    if (m && m.ref === SCHOOL.ref && m.ret === SCHOOL.ret) return m.v;
    return (this._schoolRefK = { ref: SCHOOL.ref, ret: SCHOOL.ret, v: GM.exp(this.schoolPhi(SCHOOL.ref)) }).v;
  }
  // 予算の教育の支出 ÷ GDP [%] (人間の国だけ。予算の割合 × 払えた割合 × 税収 ÷ 国の所得。光の遅れのある財政の値で)
  eduSpendPct(c) {
    const root = this.realmOf(c.sys), share = this.fiscalFor(root, c.sys).budget?.education || 0;
    if (!(share > 0)) return 0;
    const gv = this.govs[root], memo = (this._eduY ??= {});
    if (memo.year !== this.year) { memo.year = this.year; memo.y = {}; }
    const y = (memo.y[root] ??= this.colonies.reduce((k, x) => (this.realmOf(x.sys) === root ? k + (x.incY || 0) : k), 0));
    return y > 0 ? (100 * share * (gv?.bpaid ?? 1) * Math.max(0, gv?.ledger?.tax || 0)) / y : 0;
  }
  // 1 刻み (demoStep の年をとったあと): 集団ごとに年齢の表と同じ割合 up で次の区分へ移し、25 歳の区分に入る人は学校を出た世代の就学年数
  // ((1 − rho) × 所得の曲線 + rho × 大人の平均) と学力 (所得の曲線) を持つ。生まれた子 births は「ここ生まれ」の 0 歳の区分へ。最後に区分ごとの人数を c.age に合わせる
  // (死亡と、ほかの所の増減)
  eduStep(c, up, births) {
    const E = this.schoolBy(c), n = DEMO.bins, b = SCHOOL.bin, y = this.eduY(c), pct = this.eduSpendPct(c);
    const sNew = (1 - SCHOOL.rho) * this.schoolCurve(y, pct) + SCHOOL.rho * this.schoolOf(c), qNew = this.learnCurve(y, pct);
    for (const g of Object.values(E)) {
      for (let a = n - 2; a >= 0; a--) { const x = g.p[a] * up; g.p[a] -= x; this.eduAdd(g, a + 1, x, a + 1 === b ? sNew : g.s[a], a + 1 === b ? qNew : g.q[a]); }
    }
    (E.here ??= { p: Array(n).fill(0), s: Array(n).fill(0), q: Array(n).fill(0) }).p[0] += births;
    // 人のいない区分 (S が 0) に人を置くときは、集団を合わせた平均 (schoolAges・learnAges) の値を使う。人がいないのでその平均は、就学年数は 0、
    // 学力は所得の形の値 (learnAgeAt)。区分ごとに要るときだけ求める (前は全部の区分を先に求めていた。値は同じ)
    const G = Object.values(E);
    for (let a = 0; a < n; a++) {
      const T = c.age.f[a] + c.age.m[a];
      let S = 0;
      for (const g of G) S += g.p[a];
      if (S > 0) for (const g of G) g.p[a] *= T / S;
      else if (T > 0) { E.here.p[a] = T; E.here.s[a] = a >= b ? sNew : 0; E.here.q[a] = a >= b ? this.learnAgeAt(this.eduIncome(c), a) || qNew : 0; }
    }
    c.hk = this.schoolK(c);
  }
  // 集団 g の区分 a に、就学年数 s・学力 q の人 x を人数の重みで混ぜる (25 歳の区分より下は人数だけ)
  eduAdd(g, a, x, s, q) {
    const w = g.p[a] + x;
    if (a >= SCHOOL.bin) { g.s[a] = w > 0 ? (g.s[a] * g.p[a] + s * x) / w : s; g.q[a] = w > 0 ? (g.q[a] * g.p[a] + q * x) / w : q; }
    g.p[a] = w;
  }
  // よそから来た人 n [百万人] (移民・入植者。移民の年齢の形で来る) を「よそ生まれ」に混ぜる。e = その人たちの区分ごとの { s: 就学年数, q: 学力 } (eduAges)。
  // 前の版の移民は就学年数の配列か数だけ (学力はこの入植地の区分ごとの値)。分からなければ、この入植地の区分ごとの値。c.pop を増やす前に呼ぶ
  // (人数は、そのあと ageSync が c.age に足す分と同じ)
  eduMix(c, n, e) {
    if (!(n > 0)) return;
    const E = this.schoolBy(c), mig = DEMO.migrant, ms = mig.reduce((k, v) => k + v, 0), loc = e === undefined ? this.eduAges(c) : null;
    const S = loc ? loc.s : e.s ?? e, Q = loc ? loc.q : e.q ?? this.learnAges(c);
    const g = (E.away ??= { p: Array(DEMO.bins).fill(0), s: Array(DEMO.bins).fill(0), q: Array(DEMO.bins).fill(0) });
    for (let a = 0; a < DEMO.bins; a++) this.eduAdd(g, a, (n * mig[a]) / ms, Array.isArray(S) ? S[a] : S, Array.isArray(Q) ? Q[a] : Q);
  }
  // 政府の年金と医療 (10-3 の c)。星系の政府が、その星系の家計に年金を、会社に医療の代金を払う。人間が動かす首都は、手元の資金の分だけ払う (払えた割合 apaid)
  ageSpendStep(h) {
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key];
      if (!this.isColonized(id)) continue;
      let pen = 0, med = 0;
      for (const c of this.coloniesIn(id)) {
        const y = MARKET.buy ? c.incY ?? this.incomeOf(c) : 0, s = this.ageShares(c); // 所得は、この刻みの消費の所で計算したもの
        pen += DEMO.govScale * DEMO.pension * s.old * y;
        med += DEMO.govScale * DEMO.health * (1 + (DEMO.oldCost - 1) * s.old) * y;
      }
      const want = (pen + med) * h;
      if (!(want > 0)) continue;
      const f = this.isHuman(id) && !this.spectate ? clamp(Math.max(0, gv.credits) / want, 0, 1) : 1;
      if (pen > 0) this.earn('pension', -pen * h * f, id, { hh: id });
      if (med > 0) this.earn('health', -med * h * f, id, { fm: id });
      gv.apaid = f;
    }
  }
