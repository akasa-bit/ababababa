  // 予算: 人間の国の首都の政府が、税収 (ならした値) × 予算の割合を毎刻み使う。受け取るのは首都の民間 (給付・給料・買い付け)。
  // 払いきれなかった割合だけ効き目が下がる (bpaid、1 年ほどでならす)
  budgetStep(h) {
    for (const p of this.players) {
      const gv = p.human && p.fiscal && this.govs[p.cap];
      if (!gv) continue;
      const tax = Math.max(0, gv.ledger?.tax || 0);
      const B = this.fiscalFor(p.cap, p.cap).budget; // 首都で効いている予算 (行政の遅れのあいだは前の予算)
      const parts = Object.keys(BUDGET).map((k) => [k, (B?.[k] || 0) * tax * h]).filter(([, x]) => x > 0);
      const want = parts.reduce((a, [, x]) => a + x, 0);
      const f = want > 0 ? Math.min(1, Math.max(0, gv.credits) / want) : 1;
      for (const [k, x] of parts) this.earn(k, -x * f, p.cap, { hh: p.cap });
      gv.bpaid = (gv.bpaid ?? 1) + (f - (gv.bpaid ?? 1)) * Math.min(1, h);
    }
    this.soeStep(); // 国有化と民営化 (development.js。回 KE9・B-011)
    this.ageSpendStep(h); // 年金と医療 (demography.js。回 KE2)
    this.cbStep(h); // 中央銀行・物価・利回り (central-bank.js)
    this.creditStep(h); // 民間の信用 (回 KE3)
    this.interestStep(h);
    this.debtStep(h);
  }
  // 国債 (docs/debt.md)。人間が動かしていない政府は、財政の反応の式 (DEBT) で決まる基礎収支に、国債の利子を足した分だけ国債を出す
  // (マイナスなら返す。手元の資金で返しきれない分は持ち越す)。銀行が国債を買い、同じ額の預金を政府に作るので、政府の純額 (資金 − 国債) は変わらない (お金は湧かない)。
  // 行政サービス (民間の賃金と買い付け) には、式で決まる使える額 (税収 − s* × GDP) から、ふだんの支出 (建設・船・維持費・予算など、
  // DEBT.spend 年ほどでならした額) を除いた残りを使う (投資が先、行政サービスが後)。買い物で資金がマイナスになった分 (funds の
  // 借りられる額で買った分) は国債で埋める。手元の資金が税収の DEBT.cash 年分を超えたら、超えた分を行政サービスに使う (国債を返すのは式の分だけ。回 KE1)。
  // 人間が動かす首都は、財政で選んだ赤字の上限の範囲で、資金のマイナスを国債で埋め、手元の資金が多すぎれば国債を返す (行政サービスは自動では払わない)
  debtStep(h) {
    const war = new Set(Object.keys(this.realmWars).flatMap((k) => k.split('|').map(Number)));
    const keep = GM.pow(DEBT.ar, h), out = 1 - GM.exp(-h / DEBT.spend), fade = GM.exp(-h);
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key];
      const paid = gv.bondPaid || 0;
      gv.bondPaid = 0;
      if (!this.isColonized(id)) continue;
      const y = this.coloniesIn(id).reduce((k, c) => k + this.incomeOf(c), 0);
      if (!(y > 0)) continue;
      const fr = (gv.fr ??= { y, t: GM.log(y), g: 0, u: 0 });
      fr.y += (y - fr.y) * Math.min(1, h);
      // 傾向: ln GDP の水準と伸び (Holt の線形の平滑化。伸びる星系でも、傾向が遅れて「好景気」に見えないように)
      const lv = fr.t + (fr.g || 0) * h, e = GM.log(fr.y) - lv, k = 1 - GM.exp(-h / DEBT.trend);
      fr.t = lv + k * e;
      fr.g = (fr.g || 0) + (k * k / h) * e;
      const keepCash = DEBT.cash * Math.max(0, (gv.ledger?.tax || 0) + (gv.ledger?.natives || 0));
      if (this.isHuman(id) && !this.spectate) {
        const deficit = this.fiscalFor(id, id).deficit || 0;
        gv.bw = (gv.bw || 0) * fade;
        if (gv.credits < 0 && deficit > 0 && !this.dfltOut(gv)) { const x = -gv.credits; gv.credits = 0; gv.bond = (gv.bond || 0) + x; gv.bw += x; }
        const extra = gv.credits - keepCash;
        if (extra > 0 && gv.bond > 0) { const x = Math.min(gv.bond, extra * out); gv.credits -= x; gv.bond -= x; }
        continue;
      }
      // ふだんの支出 = (税・先住民・利子の受け取り) − 前の刻みの終わりからの資金の増加 (国債の出し入れと行政サービスは含まない)
      const L = gv.led || {}, inflow = (L.tax || 0) + (L.natives || 0) + (L.interest || 0);
      if (gv.c0 !== undefined) fr.d = (fr.d ?? 0) + ((inflow - (gv.credits - gv.c0)) / h - (fr.d ?? 0)) * (1 - GM.exp(-h / DEBT.spend));
      fr.u = fr.u * keep + DEBT.sd * Math.sqrt(1 - keep * keep) * this.randNormal();
      const gap = clamp(GM.log(fr.y) - fr.t, DEBT.gap[0], DEBT.gap[1]);
      const s = DEBT.a + DEBT.rho * ((gv.bond || 0) / fr.y) + DEBT.beta * gap + (war.has(this.realmOf(id)) ? DEBT.war : 0) + fr.u;
      // 返しきれなかった分 (手元の資金が足りなかった分) は、次の刻みから先に返す (gv.due)
      let x = -s * fr.y * h + paid - (gv.due || 0);
      gv.due = 0;
      if (x < 0) {
        const pay = Math.min(-x, gv.bond || 0, Math.max(0, gv.credits));
        gv.due = Math.min(-x - pay, (gv.bond || 0) - pay);
        x = -pay;
      }
      if (this.dfltOut(gv)) x = Math.min(x, 0); // 不履行のあとは新しく出せない (資金のマイナスは、戻るまで残る。QD-26)
      else if (gv.credits + x < 0) x = -gv.credits;
      if (x) { gv.credits += x; gv.bond = Math.max(0, (gv.bond || 0) + x); }
      const T = Math.max(0, (gv.ledger?.tax || 0) + (gv.ledger?.natives || 0));
      const pub = Math.min(Math.max(0, gv.credits), Math.max(0, T - s * fr.y - (fr.d ?? 0)) * h);
      if (pub > 0) this.earn('public', -pub, id, { hh: id });
      const extra = gv.credits - keepCash;
      // 手元の資金が多すぎれば、行政サービスに使う。前は国債があれば先に返していた (DEBT.repay = 1。国債のある政府だけが余りで黒字になり、財政の反応 R28 が
      // 式の 0.034 よりずっと強く 0.08 になった。返すのは式 s* の分だけにした。回 KE1・B-003。QD-28)
      if (extra > 0 && DEBT.repay && gv.bond > 0) { const r = Math.min(gv.bond, extra * out); gv.credits -= r; gv.bond -= r; }
      else if (extra > 0) this.earn('public', -extra * out, id, { hh: id });
      gv.c0 = gv.credits;
    }
  }
  // 民間の信用 (LOANS)。入植している星系ごとに、家計と会社が GDP (ならした値) に比べて新しく借り、残高に比べて返す。
  // 借りる・返すは銀行が預金を作る・消すだけなので、家計と会社の純額 (手持ち − 借り) は変わらない (お金の試験の出入りに載せない)。
  // 家計が借りた分で住宅を買う代金 (housing) だけが、家計から会社への出入り
  creditStep(h) {
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key], y = gv.fr?.y || 0;
      if (!this.isColonized(id) || !(y > 0)) continue;
      const nh = (LOANS.hh.stock / LOANS.hh.years) * y * h, rh = (gv.hm || 0) * Math.min(1, h / LOANS.hh.years);
      bankMove(gv, 'hh', nh - rh, 'hloan');
      gv.hm = (gv.hm || 0) + nh - rh;
      if (nh > 0) { this.cash('housing', -nh, { hh: id }); this.cash('housing', nh, { fm: id }); }
      const nf = (LOANS.fm.stock / LOANS.fm.years) * y * h, rf = (gv.bl || 0) * Math.min(1, h / LOANS.fm.years);
      bankMove(gv, 'fm', nf - rf);
      gv.bl = (gv.bl || 0) + nf - rf;
    }
  }
  // 使える資金 = 手元の資金 + 国債で借りられる額。人間が動かしていない政府は、国債 ÷ GDP が DEBT.limit になるまで借りられる。
  // 人間が動かす首都は、財政で選んだ赤字の上限 (この 1 年に出した国債を除く) まで。足りない分の国債は、刻みの終わりに出す (debtStep)
  funds(id) {
    const gv = this.govs[id];
    if (!gv) return 0;
    const y = gv.fr?.y || 0;
    let room = this.dfltOut(gv) ? 0 : Math.max(0, DEBT.limit * y - (gv.bond || 0) - (gv.due || 0)); // 不履行のあとは借りられない (QD-26)
    if (this.isHuman(id) && !this.spectate) room = Math.min(room, Math.max(0, (this.fiscalFor(id, id).deficit || 0) * y - (gv.bw || 0)));
    return gv.credits + room;
  }
  // 利子: 銀行から借りている会社・家計・先住民が、その星系で効いている実質の利子率 (政策金利 − 物価の上がり方。rateAt) で、国債の政府が国債の実質の利札 (bondRate) で
  // 利子を払う (帳簿は実質の cr なので。回 KE1)。銀行はそれを、預金
  // (政府の資金・家計と会社と先住民の手持ち) の額に比べて分ける。銀行の儲けは 0 (docs/fiscal.md)。運ぶ途中のお金には利子がつかない。
  // 回 KE9 (B-009): 国債の利札は銀行が持つ分 (国債 − 中央銀行の持つ qb) に払い、中央銀行の持つ分には政策金利 (回 KE10・B-124)。金融抑圧の国は、銀行が持つ分の利札を repress 点
  // 下げて払い、下げた分は国の中の預金者 (その国の星系の政府・家計・会社・先住民) が受け取らない (国の中の預金者がふつうに受け取る額まで)
  interestStep(h) {
    const debtors = [], deposits = [], rep = {}, heldR = {};
    let paid = 0, held = 0;
    const realmAt = (sys) => (this.isColonized(sys) ? this.realmOf(sys) : null);
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key];
      if (gv.loan > 0) { const x = gv.loan * this.rateAt(id) * h; debtors.push([{ fm: id }, x]); paid += x; }
      if (gv.hloan > 0) { const x = gv.hloan * this.rateAt(id) * h; debtors.push([{ hh: id }, x]); paid += x; }
      if (gv.hm > 0) { const x = gv.hm * this.rateAt(id) * h; debtors.push([{ hh: id }, x]); paid += x; } // 民間の信用 (回 KE3)
      if (gv.bl > 0) { const x = gv.bl * this.rateAt(id) * h; debtors.push([{ fm: id }, x]); paid += x; }
      const bk = Math.max(0, (gv.bond || 0) - (gv.qb || 0));
      if (bk > 0) {
        const x = bk * this.bondRate(id) * h, root = this.realmOf(id), rp = this.isColonized(id) && this.isHuman(root) && !this.spectate ? bk * (this.fiscalFor(root, id).repress || 0) * h : 0;
        debtors.push([{ gov: id }, x, rp, root]); paid += x;
        if (rp) rep[root] = (rep[root] || 0) + rp;
      }
      // 中央銀行の持つ分は、中央銀行が準備に払う政策金利 (実質) を政府が負う (利札との差は中央銀行の儲けか損として国に納めるか埋める。回 KE10・B-124)
      if (gv.qb > 0) { const x = gv.qb * this.rateAt(id) * h; debtors.push([{ gov: id }, x]); paid += x; }
      const R = realmAt(id), dep = (acct, v, gov) => { deposits.push([acct, v, gov, R]); held += v; if (R !== null) heldR[R] = (heldR[R] || 0) + v; };
      if (gv.credits > 0) dep({ gov: id }, gv.credits, id);
      if (gv.hh > 0) dep({ hh: id }, gv.hh);
      if (gv.fm > 0) dep({ fm: id }, gv.fm);
    }
    for (const [key, st] of Object.entries(this.natives)) {
      const sys = Number(key.split('|')[0]), R = realmAt(sys);
      if (st.loan > 0) { const x = st.loan * this.rateAt(sys) * h; debtors.push([{ nat: key }, x]); paid += x; }
      if (st.cr > 0) { deposits.push([{ nat: key }, st.cr, undefined, R]); held += st.cr; if (R !== null) heldR[R] = (heldR[R] || 0) + st.cr; }
    }
    if (!paid || !(held > 0)) return; // マイナスの利子率なら向きが逆になる (預金が払い、借り手が受け取る。スイス 2014〜2022 年の形)
    // 金融抑圧の下げ幅は、国の中の預金者がふつうに受け取る額まで (足りない分は政府がふつうに払う)
    const k = {};
    for (const [R, r] of Object.entries(rep)) { const full = Math.max(0, (paid * (heldR[R] || 0)) / held); k[R] = r > full ? full / r : 1; rep[R] = Math.min(r, full); }
    for (const [acct, x, rp = 0, root] of debtors) {
      const y = x - rp * (k[root] ?? 0);
      if (acct.gov !== undefined) { this.earn('interest', -y, acct.gov); this.govs[acct.gov].bondPaid = (this.govs[acct.gov].bondPaid || 0) + y; } else this.cash('interest', -y, acct);
    }
    for (const [acct, v, gov, R] of deposits) {
      const x = paid * (v / held) - (R !== null && rep[R] ? (rep[R] * v) / heldR[R] : 0);
      if (gov !== undefined) this.earn('interest', x, gov); else this.cash('interest', x, acct);
    }
  }
  // 財政のグラフの記録 (回 GA9・B-059。年 1 回、人間の席ごと): 首都に届いた記録 (known) から、国の GDP の伸び・国債 ÷ GDP・政府の収支 ÷ GDP、首都の中央銀行から
  // 物価の上がり方・政策金利・長期の利回り。伸びと収支は、前の年も記録のあった星系だけで比べる (入植や併合で国が大きくなった分を入れない。前の年の星系ごとの
  // [GDP, 政府の純額] は c.p に持ち、セーブにも入れる (読み込んだあとも同じ記録になるように))。収支 = 政府の純額 (資金 − 国債) の 1 年の増え
  chronYearly() {
    const cap = this.cap, now = {}, c = (this.chron[cap] ??= { r: [], m: [] }), prev = c.p;
    let Y = 0, D = 0, a = 0, b = 0, w = 0;
    for (const s of this.knownOwnSystems()) {
      const k = this.known(s.id);
      if (!(k?.gdp > 0)) continue;
      now[s.id] = [k.gdp, (k.credits || 0) - (k.bond || 0)];
      Y += k.gdp; D += k.bond || 0;
      const p = prev?.[s.id];
      if (p) { a += k.gdp; b += p[0]; w += now[s.id][1] - p[1]; }
    }
    c.p = now;
    if (!(Y > 0)) return;
    const r4 = (v) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4), s = this.cb[cap];
    c.r.push([Math.round(this.year), r4(a > 0 && b > 0 ? GM.log(a / b) : null), r4(s?.pi ?? null), r4(this.cbRateAt(cap)), r4(this.govs[cap] ? this.longYield(cap) : null), r4(D / Y), r4(a > 0 ? w / a : null)]);
  }
  // 財政。fiscalFor(国, 星系) = その星系で効いている、その国の財政 (変えた知らせが光速で届くまでは前の財政)。人間でない国は標準。
  // 手段ごとに行政の遅れがあり (ADMIN_LAG。回 KE8・B-012)、f.on[手段] = 首都で効き始める年。遠い星系は、そのうえ光の遅れのあと。f.done = いちばん遅い手段の年
  fiscalFor(root, id) {
    const f = this.players[this.playerOf(root)]?.fiscal;
    if (!f) return this.isHuman(root) ? FISCAL_DEFAULT : this.aiFiscal(root);
    const at = this.year - this.sysDist(root, id);
    if (at >= (f.done ?? f.since)) return f;
    const prev = f.prev ?? FISCAL_DEFAULT;
    if (!f.on || at < f.since) return prev; // 前の版のセーブ (on がない) は、どの手段も光の遅れだけ
    const m = { ...f };
    for (const [k, t] of Object.entries(f.on)) if (at < t) m[k] = prev[k];
    return m;
  }
  fiscalAt(id) { return this.fiscalFor(this.realmOf(id), id); }
  taxK(id) { return taxRateOf(this.fiscalAt(id).tax) / MARKET.tax; }
  // 人間でない国の財政 (AI_FISCAL)。シードと首都から決まる (試合の乱数は使わない)。税率は現実の国の分布の 10・50・90% 点を折れ線でつなぎ、幅の刻みに丸める。
  // 独立した国は元の国の財政を引き継ぐ (declareIndependence)。読み込みのあとは、独立した国の引き継ぎが残らないので、セーブに入れる (aif)
  aiFiscal(root) {
    const c = (this.aif ??= {});
    if (c[root]) return c[root];
    if (!AI_FISCAL.vary) return (c[root] = FISCAL_DEFAULT);
    // 10・50・90% 点を折れ線でつなぎ、一様な u から引く (端は 10% 点・90% 点で止める)
    const draw = (tag, [a, b, d]) => { const u = (hashSeed(`${this.galaxy.seed}/fiscal/${root}${tag}`) % 10000) / 10000; return u < 0.1 ? a : u < 0.5 ? a + ((u - 0.1) / 0.4) * (b - a) : u < 0.9 ? b + ((u - 0.5) / 0.4) * (d - b) : d; };
    const step = (v, st, [lo, hi]) => clamp(Math.round(v / st) * st, lo, hi);
    const total = MARKET.tax * draw('', AI_FISCAL.taxK); // 税の合計 ÷ 所得
    const share = draw('/c', AI_FISCAL.ctaxShare); // 消費税が税収に占める割合
    const tax = step(total * (1 - share), TAX_STEP, TAX_RANGE); // 所得への税率
    const ctax = step((total * share) / (1 - total * (1 - share)), CTAX_STEP, CTAX_RANGE); // 消費税率: 買い物 ≈ 所得 − 所得への税 とみて、税収の割合が share になる率
    const tariff = step(draw('/t', AI_FISCAL.tariff), TARIFF_STEP, [TARIFF_RANGE[0], Math.min(TARIFF_RANGE[1], this.modsOf(root).tariffMax)]); // 商才は 5% まで (回 SE8)
    return (c[root] = { ...FISCAL_DEFAULT, tax, ctax, tariff });
  }
  ctaxAt(id) { return this.fiscalAt(id).ctax || 0; } // 消費税 (その星系で効いている国の)
  // 関税: 買い手の星系で効いている国の関税率。同じ国の中の取引には掛からない
  tariffFor(buyer, seller) { return this.dutiable(buyer, seller) ? this.fiscalAt(buyer).tariff || 0 : 0; }
  // 輸出禁止と禁輸 (回 KE9・B-008): 売り手の国が資源 r の輸出を止めている、か、どちらかの国が相手の国を禁輸にしていれば、売り買いしない (同じ国の中はいつも売り買いする)
  tradeBarred(buyer, seller, r) {
    const a = this.realmOf(buyer), b = this.realmOf(seller);
    if (a === b) return false;
    const fs = this.fiscalAt(seller), fb = this.fiscalAt(buyer);
    return !!(fs.ban?.[r] || fs.embargo?.[a] || fb.embargo?.[b]);
  }
  dutiable(buyer, seller) { return this.realmOf(buyer) !== this.realmOf(seller) && !this.pactFreeTrade(this.realmOf(buyer), this.realmOf(seller)); } // 交易協定の相手には掛けない (政治の pactFreeTrade。回 SE2)
  // 予算の効き目 (0〜1)。首都が予算を払いきれていなければ、払えた割合だけ効く
  budgetAt(root, id, k) { return budgetEffect((this.fiscalFor(root, id).budget?.[k] || 0) * (this.govs[root]?.bpaid ?? 1)); }
  // 国 (首都とその従属星系の政府) の支出を 10 機能に分ける (COFOG。回 KE8・B-007): [{ code, label, v: cr/年, share, oecd }]。ならした帳簿の支払い (負の値) から。
  // 利子は払った分だけ (受け取りと差し引きの値なので、負のときだけ数える)
  cofogOf(root) {
    const L = {};
    for (const x of this.realmSystems(root)) { const gv = this.govs[x.id]; for (const led of [gv?.ledger, gv?.cof]) for (const [k, v] of Object.entries(led || {})) L[k] = (L[k] || 0) + v; }
    const rows = COFOG.map((f) => ({ code: f.code, label: f.label, oecd: f.oecd, v: f.kinds.reduce((t, k) => t + Math.max(0, -(L[k] || 0)), 0) }));
    const sum = rows.reduce((t, r) => t + r.v, 0);
    for (const r of rows) r.share = sum > 0 ? r.v / sum : 0;
    return rows;
  }
  // 艦隊の戦力の倍率 (種族の特性 × 軍事の予算)。x は国か星系、at は戦う星系
  fleetMul(x, at) { const root = this.realmOf(x); return this.modsOf(x).fleet * (1 + BUDGET.military.fleet * this.budgetAt(root, at, 'military')); }
  // 財政を変える (命令 fiscal)。政策金利と中央銀行の任せ方はすぐ変わり (中央銀行の決定)、ほかの手段は議会の審議にかける (回 SE7・B-022。QD-109 b。
  // politics/support.js の proposeBill)。d に書いていない手段は、審議中の法案の値から。now = 審議を通さずすぐ変える (試験と道具から)
  setFiscal(d, now = false) {
    const cur = now ? this.fiscal || FISCAL_DEFAULT : this.fiscalDraft(), dec = this.fiscal || FISCAL_DEFAULT;
    const rawTax = d.tax ?? cur.tax;
    if (!(typeof rawTax === 'number' || TAX_LEVELS[rawTax])) return fail('選べない値');
    const cb0 = dec.cb ?? 1, cb = d.cb !== undefined ? Number(d.cb) : Number(d.rate ?? dec.rate) !== dec.rate ? 0 : cb0; // 政策金利を動かしたら「自分で決める」に
    if (cb !== 0 && cb !== 1) return fail('選べない値');
    // 任せていたのをやめるときは、いまの中央銀行の政策金利から始める
    const start = cb0 === 1 && cb === 0 && (d.rate === undefined || Number(d.rate) === dec.rate);
    const tax = taxRateOf(rawTax), rate = start ? clamp(Math.round(this.cbRateAt(this.cap) / RATE_STEP) * RATE_STEP, RATE_RANGE[0], RATE_RANGE[1]) : Number(d.rate ?? dec.rate), deficit = Number(d.deficit ?? cur.deficit ?? 0), ctax = Number(d.ctax ?? cur.ctax ?? 0), tariff = Number(d.tariff ?? cur.tariff ?? 0);
    const rdcredit = Number(d.rdcredit ?? cur.rdcredit ?? FISCAL_DEFAULT.rdcredit); // 研究開発の税額控除 (回 KE6。前の版のセーブは既定)
    // 物価の目標と量的緩和 (中央銀行の決定なので、政策金利と同じくすぐ)・金融抑圧 (法なので審議にかける)。回 KE9・B-009。前の版のセーブは既定
    const pistar = Number(d.pistar ?? dec.pistar ?? FISCAL_DEFAULT.pistar), qe = Number(d.qe ?? dec.qe ?? 0), repress = Number(d.repress ?? cur.repress ?? 0);
    const soe = Number(d.soe ?? cur.soe ?? 0), capctl = Number(d.capctl ?? cur.capctl ?? 0); // 国有化・民営化・資本規制 (法なので審議にかける。回 KE9・B-011)
    const budget = {};
    for (const k of Object.keys(BUDGET)) budget[k] = Number(d[k] ?? cur.budget?.[k] ?? 0);
    // 幅と刻みは docs/policy-ranges.md (前の段階の名前 (重税など) は刻みに乗らなくてもよい)
    if ((typeof rawTax === 'number' && !onStep(tax, TAX_RANGE, TAX_STEP)) || tax < TAX_RANGE[0] - 1e-9 || tax > TAX_RANGE[1] + 1e-9) return fail(JA`税率は ${TAX_RANGE[0] * 100}〜${TAX_RANGE[1] * 100}% (刻み ${TAX_STEP * 100}%)`);
    if (!onStep(rate, RATE_RANGE, RATE_STEP)) return fail(JA`政策金利は年 ${RATE_RANGE[0] * 100}〜${RATE_RANGE[1] * 100}% (刻み ${RATE_STEP * 100}%)`);
    if (!onStep(deficit, DEFICIT_RANGE, DEFICIT_STEP)) return fail(JA`赤字の上限は GDP の 0〜${DEFICIT_RANGE[1] * 100}% (刻み ${DEFICIT_STEP * 100}%)`);
    if (!onStep(ctax, CTAX_RANGE, CTAX_STEP)) return fail(JA`消費税は 0〜${CTAX_RANGE[1] * 100}% (刻み ${CTAX_STEP * 100}%)`);
    if (!onStep(tariff, TARIFF_RANGE, TARIFF_STEP)) return fail(JA`関税は 0〜${TARIFF_RANGE[1] * 100}% (刻み ${TARIFF_STEP * 100}%)`);
    if (tariff > this.modsOf(this.cap).tariffMax + 1e-9) return fail(JA`商才の種族の国は、関税を ${this.modsOf(this.cap).tariffMax * 100}% より上げられない`); // 回 SE8
    if (!onStep(rdcredit, RDCREDIT_RANGE, RDCREDIT_STEP)) return fail(JA`研究開発の税額控除は 0〜${RDCREDIT_RANGE[1] * 100}% (刻み ${RDCREDIT_STEP * 100}%)`);
    if (Object.values(budget).some((v) => !onStep(v, BUDGET_RANGE, BUDGET_STEP))) return fail(JA`予算は機能ごとに 0〜${BUDGET_RANGE[1] * 100}% (刻み ${BUDGET_STEP * 100}%)`);
    if (!onStep(pistar, TARGET_RANGE, TARGET_STEP)) return fail(JA`物価の目標は年 0〜${TARGET_RANGE[1] * 100}% (刻み ${TARGET_STEP * 100}%)`);
    if (!onStep(qe, QE_RANGE, QE_STEP)) return fail(JA`量的緩和は国債の 0〜${QE_RANGE[1] * 100}% (刻み ${QE_STEP * 100}%)`);
    if (!onStep(soe, SOE_RANGE, SOE_STEP)) return fail(JA`国有の割合は 0〜${SOE_RANGE[1] * 100}% (刻み ${SOE_STEP * 100}%)`);
    if (!onStep(capctl, CAPCTL_RANGE, CAPCTL_STEP)) return fail(JA`資本規制は 0〜${CAPCTL_RANGE[1] * 100}% (刻み ${CAPCTL_STEP * 100}%)`);
    if (!onStep(repress, REPRESS_RANGE, REPRESS_STEP)) return fail(JA`金融抑圧は 0〜${REPRESS_RANGE[1] * 100} 点 (刻み ${REPRESS_STEP * 100} 点)`);
    const total = Object.values(budget).reduce((a, v) => a + v, 0);
    if (total > BUDGET_TOTAL + 1e-9) return fail(JA`予算は合わせて税収の ${BUDGET_TOTAL * 100}% まで`);
    // 価格統制と交易の規制 (回 KE9・B-008): 値段の上限・配給・輸出禁止・禁輸。0 と false は外す
    const ctl = this.fiscalCtl(d, cur);
    if (!ctl.ok) return ctl;
    const { ceil, ration, ban, embargo } = ctl;
    const next = { tax, ctax, tariff, rate, cb, deficit, rdcredit, budget, ceil, ration, ban, embargo, pistar, qe, repress, soe, capctl };
    const same = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});
    const rest = !(Math.abs(tax - taxRateOf(dec.tax)) < 1e-9 && ctax === (dec.ctax || 0) && tariff === (dec.tariff || 0) && deficit === (dec.deficit || 0) && rdcredit === (dec.rdcredit ?? FISCAL_DEFAULT.rdcredit) && Object.keys(BUDGET).every((k) => budget[k] === (dec.budget?.[k] || 0))
      && same(ceil, dec.ceil) && same(ration, dec.ration) && same(ban, dec.ban) && same(embargo, dec.embargo) && repress === (dec.repress || 0) && soe === (dec.soe || 0) && capctl === (dec.capctl || 0));
    const cbPart = rate !== dec.rate || cb !== cb0 || pistar !== (dec.pistar ?? FISCAL_DEFAULT.pistar) || qe !== (dec.qe || 0);
    if (now) return rest || cbPart ? this.applyFiscal(next) : fail('いまと同じ');
    const pending = this.bill('fiscal');
    if (!rest && !cbPart) { if (!pending) return fail('いまと同じ'); return this.billAct('fiscal', 'withdraw'); } // 法案を出す前の値に戻した
    const cool = this.me.bills?.cool?.fiscal || 0;
    if (rest && this.year < cool - 1e-9) return fail(JA`財政の法案は廃案になったばかりで、${(cool - this.year).toFixed(1)} 年あとまで出せない`);
    if (cbPart) this.applyFiscal({ ...dec, rate, cb, pistar, qe }); // 政策金利・物価の目標・量的緩和はすぐ
    if (!rest) { if (pending) this.billAct('fiscal', 'withdraw'); return { ok: true }; }
    return this.proposeBill('fiscal', next);
  }
  // 価格統制と交易の規制の説明 (なければ空)
  ctlText(f) {
    const out = [];
    for (const [r, k] of Object.entries(f.ceil || {})) out.push(JA`${RES_LABEL[r]}の値段の上限 ×${k}`);
    for (const r of Object.keys(f.ration || {})) out.push(JA`${RES_LABEL[r]}の配給`);
    for (const r of Object.keys(f.ban || {})) out.push(JA`${RES_LABEL[r]}の輸出禁止`);
    for (const c of Object.keys(f.embargo || {})) out.push(JA`${this.realmName(Number(c))}への禁輸`);
    return out.join('・');
  }
  // 価格統制と交易の規制を d から読む (書いていないものは cur のまま)。値は並べ替えた写し (比べるときに JSON で比べるので)
  fiscalCtl(d, cur) {
    const pick = (k) => (d[k] !== undefined ? d[k] : cur[k]) || {};
    const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    const ceil = {}, ration = {}, ban = {}, embargo = {};
    for (const [r, v] of Object.entries(pick('ceil'))) {
      const k = Number(v);
      if (!CTL_RES.includes(r) || !(k === 0 || onStep(k, CEIL_RANGE, CEIL_STEP))) return fail(JA`値段の上限は基準の値段の ${CEIL_RANGE[0]}〜${CEIL_RANGE[1]} 倍 (刻み ${CEIL_STEP})`);
      if (k) ceil[r] = k;
    }
    for (const [r, v] of Object.entries(pick('ration'))) { if (!RATION_RES.includes(r)) return fail('配給を選べない資源'); if (v) ration[r] = true; }
    for (const [r, v] of Object.entries(pick('ban'))) { if (!CTL_RES.includes(r)) return fail('輸出を止められない資源'); if (v) ban[r] = true; }
    for (const [c, v] of Object.entries(pick('embargo'))) { const x = Number(c); if (x === this.cap || !this.realmAlive(x)) return fail('禁輸の相手の国がない'); if (v) embargo[x] = true; }
    return { ok: true, ceil: sorted(ceil), ration: sorted(ration), ban: sorted(ban), embargo: sorted(embargo) };
  }
  // 財政をいま変える (法案が通ったとき・政策金利・試験)。next = { tax, ctax, tariff, rate, cb, deficit, rdcredit, budget, ceil, ration, ban, embargo, pistar, qe, repress, soe, capctl }
  applyFiscal(n) {
    const cur = this.fiscal || FISCAL_DEFAULT, next = { tax: taxRateOf(n.tax), ctax: n.ctax || 0, tariff: n.tariff || 0, rate: n.rate, cb: n.cb ?? 1, deficit: n.deficit || 0, rdcredit: n.rdcredit ?? FISCAL_DEFAULT.rdcredit, budget: { ...FISCAL_DEFAULT.budget, ...(n.budget || {}) },
      ceil: { ...(n.ceil || {}) }, ration: { ...(n.ration || {}) }, ban: { ...(n.ban || {}) }, embargo: { ...(n.embargo || {}) }, pistar: n.pistar ?? FISCAL_DEFAULT.pistar, qe: n.qe || 0, repress: n.repress || 0, soe: n.soe || 0, capctl: n.capctl || 0 };
    const { tax, ctax, tariff, rate, cb, deficit, rdcredit, budget, pistar, qe, repress, soe, capctl } = next;
    // 前の財政 = いま首都で効いている値 (行政の遅れの途中の手段は、その前の値)。手段ごとの効き始め on: 変えた手段は今 + 行政の遅れ、変えていない手段は前の効き始めのまま。
    // 同じ時に 2 度変えたとき (政策金利と、すぐ通った法案。回 SE7) は 1 度目を直したものとみて、1 度目の前の財政を引き継ぐ (遠い星系が光の遅れなしに 1 度目を受けないように)
    const e = cur.since === this.year && cur.prev ? cur.prev : this.fiscalFor(this.cap, this.cap);
    const prev = { tax: taxRateOf(e.tax), ctax: e.ctax || 0, tariff: e.tariff || 0, rate: e.rate, cb: e.cb ?? 1, deficit: e.deficit || 0, rdcredit: e.rdcredit ?? FISCAL_DEFAULT.rdcredit, budget: { ...(e.budget || FISCAL_DEFAULT.budget) },
      ceil: { ...(e.ceil || {}) }, ration: { ...(e.ration || {}) }, ban: { ...(e.ban || {}) }, embargo: { ...(e.embargo || {}) }, pistar: e.pistar ?? FISCAL_DEFAULT.pistar, qe: e.qe || 0, repress: e.repress || 0, soe: e.soe || 0, capctl: e.capctl || 0 };
    const on = {};
    const obj = new Set(['ceil', 'ration', 'ban', 'embargo']);
    const eq = (k, a) => (k === 'budget' ? Object.keys(BUDGET).every((b) => budget[b] === (a.budget?.[b] || 0)) : k === 'tax' ? Math.abs(tax - taxRateOf(a.tax)) < 1e-9 : obj.has(k) ? JSON.stringify(next[k]) === JSON.stringify(a[k] || {}) : next[k] === (a[k] ?? FISCAL_DEFAULT[k]));
    for (const k of Object.keys(next)) on[k] = eq(k, prev) ? this.year : eq(k, cur) && cur.on?.[k] > this.year ? cur.on[k] : this.year + adminLag(k, next, prev);
    const changed = Object.keys(next).filter((k) => !eq(k, cur));
    if (changed.length) (this.chron[this.cap] ??= { r: [], m: [] }).m.push([Math.round(this.year * 100) / 100, changed]); // 財政のグラフの印 (回 GA9)
    this.fiscal = { ...next, since: this.year, on, done: Math.max(...Object.values(on)), prev };
    const parts = [JA`税率は ${(tax * 100).toFixed(1)}%`, JA`消費税は ${(ctax * 100).toFixed(1)}%`, JA`関税は ${(tariff * 100).toFixed(1)}%`, cb ? '政策金利は中央銀行に任せる' : JA`政策金利は年 ${(rate * 100).toFixed(2)}%`, JA`赤字の上限は ${deficit ? JA`GDP の ${(deficit * 100).toFixed(1)}%` : 'なし (国債を出さない)'}`, JA`研究開発の税額控除は ${(rdcredit * 100).toFixed(1)}%`, JA`予算は ${Object.entries(BUDGET).map(([k, b]) => `${b.label} ${Math.round(budget[k] * 100)}%`).join('・')}`];
    const ctl = this.ctlText(next);
    if (ctl) parts.push(JA`価格統制と交易の規制は ${ctl}`);
    if (pistar !== FISCAL_DEFAULT.pistar) parts.push(JA`物価の目標は年 ${(pistar * 100).toFixed(0)}%`);
    if (qe) parts.push(JA`量的緩和で中央銀行が国債の ${Math.round(qe * 100)}% を持つ`);
    if (repress) parts.push(JA`金融抑圧で国債の利札を ${(repress * 100).toFixed(1)} 点下げる`);
    if (soe) parts.push(JA`国の星系の会社の ${Math.round(soe * 100)}% を政府が持つ`);
    if (capctl) parts.push(JA`資本規制 ${Math.round(capctl * 100)}%`);
    this.event('goal', this.cap, JA`財政を変えた (${parts.join('、')})。遠い星系には知らせが光速で届いてから効く`, true);
    return { ok: true };
  }
