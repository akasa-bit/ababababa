  // --- 年齢つきの人口 (回 KE2・B-010。式と値は DEMO、説明は docs/demography.md) ---
  // 入植地の所得で補間した、5 歳きざみの率 { f, m, asfr } (現実の年あたり)。所得は 2021 年のドル
  demoRates(c) {
    const R = DEMO.rates, y = GM.log(Math.max(1, (c.inc ?? STRUCTURE.y0) * DEMO.usd2021));
    let i = 0;
    while (i < R.length - 2 && y > GM.log(R[i + 1].income)) i++;
    const a = GM.log(R[i].income), b = GM.log(R[i + 1].income), t = clamp((y - a) / (b - a), 0, 1);
    const mix = (k) => R[i][k].map((v, j) => v + (R[i + 1][k][j] - v) * t);
    return { f: mix('f'), m: mix('m'), asfr: mix('asfr') };
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
    const r = this.demoRates(c), G = ED.generation / 28, dt = h / G, n = DEMO.bins, up = Math.min(1, dt / DEMO.width), ex = GM.exp(-extra * h);
    let births = 0;
    for (let a = 0; a < n; a++) births += c.age.f[a] * r.asfr[a] * dt;
    births *= Math.max(0, fert);
    c.tfr = r.asfr.reduce((k, v) => k + v, 0) * DEMO.width; // その年に当てた合計特殊出生率 (目標 R37 を測る)
    for (const [s, mx] of [['f', r.f], ['m', r.m]]) {
      const A = c.age[s];
      for (let a = 0; a < n; a++) A[a] *= GM.exp(-mx[a] * dt) * ex;
      for (let a = n - 2; a >= 0; a--) { const x = A[a] * up; A[a] -= x; A[a + 1] += x; }
    }
    c.age.m[0] += births * DEMO.boy;
    c.age.f[0] += births * (1 - DEMO.boy);
    const pop = c.age.f.reduce((k, v) => k + v, 0) + c.age.m.reduce((k, v) => k + v, 0);
    c.ws = this.ageShares(c).work; // 働き手の割合 (生産に効く。yieldOf)
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
  // 政府の年金と医療 (10-3 の c)。星系の政府が、その星系の家計に年金を、会社に医療の代金を払う。人間が動かす首都は、手元の資金の分だけ払う (払えた割合 apaid)
  ageSpendStep(h) {
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key];
      if (!this.isColonized(id)) continue;
      let pen = 0, med = 0;
      for (const c of this.coloniesIn(id)) {
        const y = MARKET.buy ? this.incomeOf(c) : 0, s = this.ageShares(c);
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
