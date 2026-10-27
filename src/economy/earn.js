  // 政府の収支を記帳する。other を渡すと、その帳簿が相手になる (税と維持費は星系の民間、先住民は先住民)。
  // 渡さないもの (交易・朝貢・資金援助) は、呼ぶ側が相手の政府か運ぶ途中の帳簿を動かす。
  // 種族の特性とハンディキャップで増えた (減った) 分は、その星系の民間が出す (受け取る)
  earn(kind, amount, sys = 0, other = null) {
    const gv = this.gov(sys);
    const base = amount;
    if (this.nations && amount > 0) {
      if (kind === 'trade') amount *= this.modsOf(sys).trade; // 種族の特性: 商才
      if (AI_INCOME_KINDS.has(kind) && !this.isHuman(this.realmOf(sys))) amount *= HANDICAP[this.handicap].aiIncome; // ハンディキャップ: AI の国の収入
    }
    if (kind === 'tax' && amount > 0) amount *= (1 - EXHAUST.tax * (this.exhaustion[this.realmOf(sys)] || 0)) * (1 - FORCED.scarTax * (gv.scar || 0)); // 戦争疲弊・強制労働の後遺症
    gv.credits += amount;
    gv.led ??= {};
    gv.led[kind] = (gv.led[kind] || 0) + amount;
    if (amount > 0) gv.inc = (gv.inc || 0) + amount;
    if (MONEY_AUDIT) { const f = (MONEY_AUDIT[kind] ??= {}); f.gov = (f.gov || 0) + amount; }
    if (other) this.cash(kind, -amount, other);
    else if (amount !== base) this.cash(kind, base - amount, { fm: sys }); // 商才とハンディキャップの差は、その星系の会社が出す (受け取る)
  }
  // --- お金の帳簿 (段 4)。お金は湧かず消えない: どの出入りも、どこかの帳簿から出て、どこかの帳簿へ入る ---
  // 帳簿: { gov: 星系 } = 政府 (gv.credits)、{ hh: 星系 } = 星系の家計 (人々。gv.hh、借りは gv.hloan)、{ fm: 星系 } = 星系の会社 (gv.fm、借りは gv.loan)、
  // { nat: 'sys|body' } = 先住民 (st.cr)、{ way: 物, f: 欄 } = 運ぶ途中 (物資移送要求の先払い q.pre・朝貢と資金援助の q.amt・返事に添えた額 dec.cr・入植船の開拓資金 seed)。
  // { pv: 星系 } は家計の別名 (前の版の「民間」。段 5 の 3 で家計と会社に分けた。docs/structure.md の 7)。
  // 家計: 会社から賃金と配当 (wages) を受け取り、物とサービスの代金 (spend) と税を払い、政府からの賃金・給付 (建設・維持費・行政サービス・予算) を受け取る。
  // 会社: 在庫 (星系の備蓄) を持ち、売上 (家計の買い物・政府の資材の買い付け・輸出) を受け取って、刻みの終わりにすべて賃金と配当として家計に払う (手持ちは 0)。
  // 輸入の先払いは手持ちがなければ銀行から借り、売ってから返す (運転資金。目標 R22 の民間の信用はこれだけなので小さい。docs/structure.md の 7)。
  // 銀行: 家計・会社・先住民は、手持ちで払えない分を銀行から借りる。銀行は貸すと同時に預金を作り、返されると消す
  // (貸出 = 作った預金なので、銀行の純資産は 0。Godley & Lavoie 2007 の第 7 章)。手持ちができたら、まず借りを返す。利子は interestStep。
  // 政府の収支の表 (led) に載せるものは earn を通す
  cash(kind, v, acct) {
    let t;
    if (acct.gov !== undefined) { this.gov(acct.gov).credits += v; t = 'gov'; }
    else if (acct.hh !== undefined || acct.pv !== undefined) { bankMove(this.gov(acct.hh ?? acct.pv), 'hh', v, 'hloan'); t = 'hh'; }
    else if (acct.fm !== undefined) { bankMove(this.gov(acct.fm), 'fm', v); t = 'fm'; }
    else if (acct.nat !== undefined) { bankMove(this.natives[acct.nat], 'cr', v); t = 'nat'; }
    else { acct.way[acct.f] = (acct.way[acct.f] || 0) + v; t = 'way'; }
    if (MONEY_AUDIT) { const f = (MONEY_AUDIT[kind] ??= {}); f[t] = (f[t] || 0) + v; }
    if (v > 0 && (t === 'hh' || t === 'fm') && GOV_BUY.has(kind)) { const gv = this.govs[acct.hh ?? acct.pv ?? acct.fm]; if (gv) gv.kB = (gv.kB || 0) + v; } // 政府が民間から買った分 (GDP。会社の資本の目当て。回 KE6。保存に入るよう星系の政府に持つ)
  }
  // 運ぶ途中の額を受け手へ渡す (受け手の政府がなければ送り手へ返す)。渡した額を返す
  release(kind, q, f, to, back) {
    const v = q[f] || 0;
    if (!v) return 0;
    this.cash(kind, -v, { way: q, f });
    if (this.govs[to]) this.earn(kind, v, to); else this.earn(kind, v, back);
    return v;
  }

  // --- エネルギーの記帳 ---
  isHome(id) { return id === 0 || !!this.nations?.some((n) => n.cap === id); }
