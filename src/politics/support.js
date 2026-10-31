  // --- 利益集団の支持で政策を通す (回 SE7・B-022。値は politics/support-consts.js。docs/support.md) ---
  // 席ごとの審議中の法案 (players[i].bills = { fiscal, policy, cool: { 種類: 出せるようになる年 } })。
  // 法案 = { kind, target (財政なら通ったときの財政の値、国家方針なら方針の名前), since, at (次の関門の年), stage, back, S (支持), pushed }
  bill(kind) { return this.me.bills?.[kind] || null; }
  fiscalDraft() { return this.bill('fiscal')?.target || this.fiscal || FISCAL_DEFAULT; } // 画面のスライダーの値 (審議中なら出した値)
  // 集団 (民族 e・分位 q) の、法案への支持のロジット。inc = 星系の集団ごとの帰着 (groupIncidence)、G = 星系の集団、lord = 家臣の星系か
  supportLogit(kind, target, f0, G, e, q, inc, lord) {
    const V = this.groupValuesOf(G, e, q), rich = SUPPORT.rich[q];
    const val = (c, x) => (c ? rich * x * ((c.secular || 0) * V.secular + (c.selfexp || 0) * V.selfexp) : 0);
    if (kind === 'policy') {
      const dl = (POLICY_LOYALTY[target] || 0) - (POLICY_LOYALTY[this.policy?.id] || 0); // 家臣の忠誠度の目標の差 (首都には効かない)
      return (lord ? SUPPORT.money * SUPPORT.loyalty * dl : 0) + val(POLICY_VALUES[target], 1) - val(POLICY_VALUES[this.policy?.id], 1);
    }
    let x = SUPPORT.money * (inc?.find((g) => g.k === e && g.q === q)?.rel || 0);
    const R = SUPPORT.ref, d = (k) => ((target[k] ?? FISCAL_DEFAULT[k]) - (f0[k] ?? FISCAL_DEFAULT[k]));
    x += val(SUPPORT.values.tax, (taxRateOf(target.tax) - taxRateOf(f0.tax)) / R.tax);
    const dt = d('tariff') / R.tariff;
    x += val(SUPPORT.values.tariff, dt) - SUPPORT.skill * GM.log(5 * (G.quint?.[q] ?? groupQuint(q))) * dt; // 関税: 所得の低い分位ほど働き口を守る保護を支持する (分け前は星系の。回 KE11)
    for (const b of Object.keys(BUDGET)) x += val(SUPPORT.values[b], ((target.budget?.[b] || 0) - (f0.budget?.[b] || 0)) / R.budget);
    // 輸出禁止と禁輸 (回 KE9・B-008): 関税と同じく、生存の価値観 (排外) の集団ほど支持する (1 つ足すごとに関税を ref 上げるのと同じ重さ)
    const n = (k) => Object.keys(target[k] || {}).length - Object.keys(f0[k] || {}).length;
    x += val(SUPPORT.values.tariff, n('ban') + n('embargo'));
    return x;
  }
  // 法案の支持 (QD-106 b・QD-107 b): 国の星系の、権力に加わっている集団の支持の見込みを、声の重さ (人口 × 所得の分け前^clout) で平均した S。
  // 遠い星系は地球に届いている記録 (集団・人口) で数える (記録のない星系は数えない)。帰着 (損得) はいまの帳簿から。groups = [{ sys, k, q, w, p }]
  billSupport(kind, target) {
    const root = this.cap, f0 = this.fiscal || FISCAL_DEFAULT, out = [];
    const rows = kind === 'fiscal' ? this.incidenceOf(root, target, f0) : null;
    for (const s of this.realmSystems(root)) {
      const id = s.id, k = id === root ? null : this.known(id);
      if (id !== root && !k) continue;
      const G = k ? k.groups : this.groupsOf(id);
      if (!G) continue;
      const P = (k ? k.cols : this.coloniesIn(id)).reduce((a, c) => a + (c.pop || 0), 0);
      const inc = rows ? this.groupIncidence(id, target, f0, rows) : null, lord = id !== root;
      for (const e of G.eth) {
        if (!GROUP_STATUS[e.st]?.incl) continue;
        for (let q = 0; q < 5; q++) {
          const w = P * e.share * 0.2 * GM.pow(5 * (G.quint?.[q] ?? groupQuint(q)), SUPPORT.clout); // 分け前は星系の (回 KE11。前の版の記録は標準)
          if (w > 0) out.push({ sys: id, k: e.k, q, w, p: 1 / (1 + GM.exp(-this.supportLogit(kind, target, f0, G, e.k, q, inc, lord))) });
        }
      }
    }
    const W = out.reduce((a, g) => a + g.w, 0);
    const S = W > 0 ? out.reduce((a, g) => a + g.w * g.p, 0) / W : 0.5;
    return { S: Math.min(1, S + this.modsOf(root).billBonus), groups: out }; // 賢明は +10 点 (回 SE8)
  }
  // 法案を出す (財政か国家方針。命令の中から)。支持が ENACT.now 以上ならすぐ通る。審議中の同じ種類の法案は出し直しになる (始めの段から。
  // 押し戻された回数は引き継ぐ。出し直しで廃案を逃れられないように)
  proposeBill(kind, target) {
    const B = (this.me.bills ??= {}), cool = B.cool?.[kind] || 0;
    if (this.year < cool - 1e-9) return fail(JA`${BILL_LABEL[kind]}の法案は廃案になったばかりで、${(cool - this.year).toFixed(1)} 年あとまで出せない`);
    const { S } = this.billSupport(kind, target), back = B[kind]?.back || 0;
    delete B[kind];
    if (S >= ENACT.now) { this.enactBill(kind, target, S); return { ok: true }; }
    B[kind] = { kind, target, since: this.year, at: this.year + ENACT.step, stage: 0, back, S, pushed: 0 };
    this.event('goal', this.cap, JA`${BILL_LABEL[kind]}の法案 (${this.billText(kind, target)}) が審議に入った。支持 ${Math.round(S * 100)}% (${Math.round(ENACT.now * 100)}% あればすぐ通る)`, true);
    return { ok: true };
  }
  billText(kind, target) {
    if (kind === 'policy') return POLICIES[target]?.label || target;
    const f0 = this.fiscal || FISCAL_DEFAULT, p = (v) => `${(v * 100).toFixed(1)}%`, out = [];
    if (Math.abs(taxRateOf(target.tax) - taxRateOf(f0.tax)) > 1e-9) out.push(JA`税率 ${p(taxRateOf(target.tax))}`);
    if ((target.ctax || 0) !== (f0.ctax || 0)) out.push(JA`消費税 ${p(target.ctax || 0)}`);
    if ((target.tariff || 0) !== (f0.tariff || 0)) out.push(JA`関税 ${p(target.tariff || 0)}`);
    if ((target.deficit || 0) !== (f0.deficit || 0)) out.push(JA`赤字の上限 ${p(target.deficit || 0)}`);
    if ((target.rdcredit ?? FISCAL_DEFAULT.rdcredit) !== (f0.rdcredit ?? FISCAL_DEFAULT.rdcredit)) out.push(JA`研究開発の税額控除 ${p(target.rdcredit)}`);
    for (const [k, b] of Object.entries(BUDGET)) if ((target.budget?.[k] || 0) !== (f0.budget?.[k] || 0)) out.push(JA`${b.label}の予算 ${Math.round((target.budget?.[k] || 0) * 100)}%`);
    if (['ceil', 'ration', 'ban', 'embargo', 'reserve', 'floor'].some((k) => JSON.stringify(target[k] || {}) !== JSON.stringify(f0[k] || {}))) out.push(this.ctlText(target) || JA`価格統制と交易の規制をやめる`); // 回 KE9
    if ((target.repress || 0) !== (f0.repress || 0)) out.push(JA`金融抑圧 ${((target.repress || 0) * 100).toFixed(1)} 点`); // 回 KE9 (B-009)
    if ((target.soe || 0) !== (f0.soe || 0)) out.push(JA`国有の割合 ${Math.round((target.soe || 0) * 100)}%`); // 回 KE9 (B-011)
    if ((target.land || 0) !== (f0.land || 0)) out.push(JA`土地改革 ${Math.round((target.land || 0) * 100)}%`); // 回 KE11 (B-127)
    if ((target.capctl || 0) !== (f0.capctl || 0)) out.push(JA`資本規制 ${Math.round((target.capctl || 0) * 100)}%`);
    return out.join('・');
  }
  // 通す: 財政はいまの政策金利と中央銀行の任せ方のまま、ほかの手段を法案の値に。国家方針は方針を変える
  enactBill(kind, target, S) {
    if (this.me.bills) delete this.me.bills[kind];
    const msg = JA`${BILL_LABEL[kind]}の法案 (${this.billText(kind, target)}) が通った (支持 ${Math.round(S * 100)}%)`;
    if (kind === 'policy') { this.event('goal', this.cap, msg, true); return this.applyPolicy(target); }
    const cur = this.fiscal || FISCAL_DEFAULT;
    this.event('goal', this.cap, msg, true);
    return this.applyFiscal({ ...target, rate: cur.rate, cb: cur.cb ?? 1, pistar: cur.pistar ?? FISCAL_DEFAULT.pistar, qe: cur.qe || 0 }); // 中央銀行の決定 (政策金利・物価の目標・量的緩和) はいまの値のまま (回 KE9)
  }
  // 審議の関門 (毎刻み。席ごとに、関門の年が来た法案だけ)
  billsStep() {
    this.players.forEach((p, i) => {
      if (!p.bills) return;
      for (const kind of Object.keys(BILL_LABEL)) if (p.bills[kind] && this.year >= p.bills[kind].at - 1e-9) this.asPlayer(i, () => this.billCheckpoint(kind));
    });
  }
  billCheckpoint(kind) {
    const b = this.bill(kind);
    b.S = this.billSupport(kind, b.target).S; // 支持は関門ごとに数え直す (帳簿と記録が変わる)
    b.at = this.year + ENACT.step;
    const u = this.rand(), go = 1 - ENACT.stall, pa = go * (0.25 + 0.5 * b.S), pb = go * (0.75 - 0.5 * b.S);
    if (u < pa) { if (++b.stage >= ENACT.stages) this.enactBill(kind, b.target, b.S); return; }
    if (u >= pa + pb) return; // 止まった
    if (++b.back >= ENACT.setbacks) {
      delete this.me.bills[kind];
      (this.me.bills.cool ??= {})[kind] = this.year + ENACT.cooldown;
      this.event('goal', this.cap, JA`${BILL_LABEL[kind]}の法案 (${this.billText(kind, b.target)}) は審議で ${ENACT.setbacks} 回押し戻され、廃案になった (支持 ${Math.round(b.S * 100)}%)。${ENACT.cooldown} 年は出し直せない`, true);
      return;
    }
    // 押し戻された: 押すか・引っ込めるか・このまま待つかを決める (次の関門まで。決めなければ待つ)
    this.addDecision({ kind: 'bill', type: kind, sys: this.cap, since: b.since, deadline: b.at, def: 'wait',
      text: JA`${BILL_LABEL[kind]}の法案 (${this.billText(kind, b.target)}) が審議で押し戻された (${b.back}/${ENACT.setbacks} 回。進んだ段 ${b.stage}/${ENACT.stages}・支持 ${Math.round(b.S * 100)}%)。`,
      opts: [{ k: 'push', label: JA`押す (1 段進める。政治力 ${this.billPushCost(kind)})`, pc: this.billPushCost(kind) }, { k: 'withdraw', label: '引っ込める' }, { k: 'wait', label: 'このまま待つ' }] });
  }
  billPushCost(kind) { const b = this.bill(kind); return b ? Math.round(ENACT.push * (2 - b.S)) : 0; }
  // 押す・引っ込める (命令 bill か、決めること bill の返事から。押す政治力は命令の側で払う)
  billAct(kind, op) {
    const b = this.bill(kind);
    if (!b) return fail('審議中の法案がない');
    if (op === 'withdraw') { delete this.me.bills[kind]; this.event('goal', this.cap, JA`${BILL_LABEL[kind]}の法案 (${this.billText(kind, b.target)}) を引っ込めた`, true); return { ok: true }; }
    if (op !== 'push') return fail('不明な操作');
    b.pushed++;
    if (++b.stage >= ENACT.stages) this.enactBill(kind, b.target, b.S);
    return { ok: true };
  }
  // AI の席の返事: 政治力に余裕があり、支持が 35% 以上なら押す
  billAiReply(dec) { return this.bill(dec.type)?.S >= 0.35 && this.pc >= this.billPushCost(dec.type) + 10 ? 'push' : 'wait'; }
