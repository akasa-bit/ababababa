  // --- 中の事情 (回 AI4・B-303。INNER は politics/inner-consts.js。docs/ai-behavior.md の 11) ---
  // 国 r の席の議会の支持 (席のない国は null)
  innerCouncil(r) { const i = this.playerOf(r); return i < 0 ? null : this.players[i].council ?? null; }
  // 国 r の、権力に加わっている集団の軍備の国家方針への支持 (0〜1。席のない国は null)。同じ刻みのうちは覚えておく
  innerGroups(r) {
    const c = (this.innerCache ??= {});
    if (c.y !== this.year) { c.y = this.year; c.g = {}; c.t = null; }
    if (!(r in c.g)) c.g[r] = this.isSeat(r) ? this.asRealm(r, () => this.billSupport('policy', 'military').S) : null;
    return c.g[r];
  }
  // 国 r の交易路の輸送量のうち、国 e との交易路の割合 (両方の向き)。同じ刻みのうちは覚えておく
  innerTrade(r, e) {
    this.innerGroups(r); // 刻みの覚えをそろえる
    const c = this.innerCache;
    if (!c.t) {
      const vol = {}, tot = {};
      for (const x of this.routes) {
        const a = this.realmOf(x.a), b = this.realmOf(x.b), v = (x.vol?.[0] || 0) + (x.vol?.[1] || 0);
        if (!(v > 0)) continue;
        tot[a] = (tot[a] || 0) + v;
        if (a === b) continue;
        tot[b] = (tot[b] || 0) + v;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        vol[k] = (vol[k] || 0) + v;
      }
      c.t = { vol, tot };
    }
    const tot = c.t.tot[r] || 0;
    return tot > 0 ? (c.t.vol[r < e ? `${r}|${e}` : `${e}|${r}`] || 0) / tot : 0;
  }
  // 中の事情の重さ (戦勝点。受け入れる線から引く。正 = 戦いたくない)。人間の国 (観戦でないとき) には 0。out に内訳を書く
  innerCost(r, e, out = null) {
    if (this.isHuman(r) && !this.spectate) return 0;
    const c = this.innerCouncil(r), S = this.innerGroups(r), t = this.innerTrade(r, e);
    const vc = c === null ? 0 : INNER.council * (INNER.councilRef - c) / INNER.councilRef;
    const vg = S === null ? 0 : INNER.groups * (INNER.groupsRef - S) * 2;
    const vt = INNER.trade * Math.min(1, t / INNER.tradeRef);
    const dis = this.inner.gov[this.warKey(r, e)]?.ok === 0 && this.warBy[this.warKey(r, e)] === r ? INNER.disavow : 0;
    const v = vc + vg + vt + dis;
    if (out) out.inner = { c, S, t, vc, vg, vt, dis, ex: this.exhaustion[r] || 0, v };
    return v;
  }
  // 中の事情の理由の文 (o = innerCost の内訳)
  innerText(o) {
    if (!o) return '';
    const sg = (x) => `${Math.round(x) > 0 ? '+' : Math.round(x) < 0 ? '−' : '±'}${Math.abs(Math.round(x))}`, parts = [];
    if (o.c !== null && o.c !== undefined) parts.push(JA`議会の支持 ${Math.round(o.c)} (${sg(-o.vc)})`);
    if (o.S !== null && o.S !== undefined) parts.push(JA`軍備への集団の支え ${Math.round(100 * o.S)}% (${sg(-o.vg)})`);
    if (o.t >= 0.005) parts.push(JA`相手との交易 ${Math.round(100 * o.t)}% (${sg(-o.vt)})`);
    if (o.ex >= 1) parts.push(JA`戦争疲弊 ${Math.round(o.ex)}`);
    if (o.dis) parts.push(JA`総督の独断を否認 (${sg(-o.dis)})`);
    return parts.length ? JA`中の事情: ${parts.join('・')}` : '';
  }
  // 協定の受けやすさのずれ (pactScore から): 議会の支持が低いと批准しにくい。交易の深い相手との交易協定は受けやすい (商人の利害)
  innerPact(r, p, kind) {
    if (this.isHuman(r) && !this.spectate) return null;
    const c = this.innerCouncil(r), t = kind === 'trade' ? this.innerTrade(r, p) : 0;
    const dc = c === null ? 0 : -INNER.pactCouncil * (INNER.councilRef - c) / INNER.councilRef, dt = INNER.pactTrade * Math.min(1, t / INNER.tradeRef);
    const parts = [];
    if (c !== null) parts.push(JA`議会の支持 ${Math.round(c)}`);
    if (t >= 0.005) parts.push(JA`相手との交易 ${Math.round(100 * t)}%`);
    return { ds: dc + dt, text: parts.length ? JA`中の事情: ${parts.join('・')}` : '' };
  }
  // 年 1 回 (diplomacyYearly から): 遠い総督の独断・首都の追認と否認・揺さぶりの到着・AI の国の揺さぶり
  innerYearly() {
    for (const [k, v] of Object.entries(this.inner.gov)) if (this.realmWars[k] === undefined) delete this.inner.gov[k];
    this.governorsYearly();
    this.governorReview();
    this.meddleArrive();
    this.aiMeddleYearly();
  }
  // 遠い総督の独断 (INNER の説明)。AI の国の、首都から遠い星系の政府が、近くに見える外の国に、首都の指令より先に国の名で宣戦する
  governorsYearly() {
    if (!BARGAIN.on) return;
    const roots = this.colonizedSystems().map((x) => x.id).filter((r) => !this.isHuman(r) && this.realmOf(r) === r && this.gov(r).independent && !this.enemiesOf(r).length);
    for (const root of roots) {
      for (const s of this.realmSystems(root)) {
        const id = s.id;
        if (id === root || this.sysDist(id, root) < INNER.farLy || this.rand() >= INNER.govChance) continue;
        // 近くに見える外の国の星系 (govRange 光年以内。いちばん近いもの)
        let near = null;
        for (const x of this.colonizedSystems()) {
          const e = this.realmOf(x.id);
          if (e === root || !this.realmAlive(e) || this.atWar(root, e) || this.pactBars(root, e)) continue;
          const d = distance(s, x);
          if (d <= INNER.govRange && (!near || d < near.d)) near = { e, d, at: x.id };
        }
        if (!near) continue;
        const e = near.e, o = this.governorView(root, e, near.d);
        if (o.v <= BARGAIN.declare) continue;
        this.beginWar(root, e, id); // 知らせは独断した星系から光で広がる (首都にも、そこから届く)
        this.inner.gov[this.warKey(root, e)] = { s: id, y: this.year, ok: null };
        this.memAdd(root, e, 'agg', id); // 侵略の記憶 (回 AI3)。出来事は独断した星系で
        const why = JA`${this.system(id).name}の総督が首都 (${this.sysDist(id, root).toFixed(0)} 光年先) の指令を待たずに。現地の見込みで: 艦隊 自分 ${Math.round(o.ours)}・相手 ${Math.round(o.theirs)}・勝つ見込み ${Math.round(100 * o.p)}%・見込む戦勝点 ${Math.round(o.expect)}・戦費 −${Math.round(o.cost)}・総督の功名心 +${INNER.govBold}`;
        this.event('politics', id, JA`${this.realmName(root)}の${this.system(id).name}の総督が、${this.realmName(e)}に独断で宣戦した (${why})`, this.isHuman(e));
        this.aiNote(root, JA`${this.system(id).name}の総督が${this.realmName(e)}に独断で宣戦した (${why})`);
        break; // 1 つの国で年に 1 つまで
      }
    }
  }
  // 総督の目で見た戦争の見込み (近くの相手は光の遅れが小さいので、いまの艦隊の数で見る。読み違いは近さのぶんだけ)
  governorView(root, e, d) {
    const z = this.misread();
    const ours = this.realmShips(root), allies = this.pactAllyShips(root, e);
    const theirs = (this.realmShips(e) + allies) * GM.exp(z * (BARGAIN.sigma0 + BARGAIN.sigmaAge * d));
    const p = (ours + 0.5) / (ours + theirs + 1);
    const expect = (2 * p - 1) * BARGAIN.swing;
    const cost = (BARGAIN.cost + BARGAIN.costEx * (this.exhaustion[root] || 0)) * BARGAIN.horizon;
    return { ours, theirs, p, expect, cost, v: expect - cost + this.claimBonus(root, e) + this.aiWarBias(root, e) + INNER.govBold };
  }
  // 首都の追認と否認: 独断の知らせが首都に光で届いた年に、首都の記録で見込みを測り直す
  governorReview() {
    for (const [k, v] of Object.entries(this.inner.gov)) {
      if (v.ok !== null) continue;
      const [a, b] = k.split('|').map(Number), root = this.warBy[k], e = root === a ? b : a;
      if (root === undefined || this.isHuman(root) || !this.realmAlive(root)) { delete this.inner.gov[k]; continue; }
      if (this.year < v.y + this.sysDist(v.s, root) - 1e-9) continue;
      const o = {};
      const res = this.reservation(root, e, undefined, undefined, o) + this.claimBonus(root, e) + this.aiWarBias(root, e);
      v.ok = res >= INNER.endorse ? 1 : 0;
      const name = this.system(v.s).name, why = JA`首都に届いた記録で: 受け入れる線 ${Math.round(res)}${o.inner ? JA`・${this.innerText(o.inner)}` : ''}`;
      if (v.ok) this.aiNote(root, JA`${name}の総督が始めた${this.realmName(e)}との戦争を追認した (${why})`);
      else {
        if (this.isColonized(v.s) && this.realmOf(v.s) === root) this.gov(v.s).loyalty = Math.max(0, (this.gov(v.s).loyalty ?? 50) - INNER.disavowLoyalty);
        this.aiNote(root, JA`${name}の総督が始めた${this.realmName(e)}との戦争を否認し、講和に向かう (${why})`);
        this.event('politics', root, JA`${this.realmName(root)}は、${name}の総督が${this.realmName(e)}に独断で始めた戦争を否認した (総督の星系の忠誠度 −${INNER.disavowLoyalty})`, this.isHuman(e));
      }
    }
  }
  // --- 揺さぶり (INNER.meddle の説明) ---
  // 国 from が、外の国の星系 to へ資金を送る (mode = back: 政府・主人の側を支える / undermine: 反対派・分離派を支える)。届くまで光速
  sendMeddle(d, from = this.cap) {
    const to = Number(d.sys), mode = d.mode === 'back' ? 'back' : 'undermine', M = INNER.meddle;
    if (!this.isColonized(to)) return fail('入植地のない星系');
    const R = this.isHuman(from) ? this.known(to)?.realm ?? this.realmOf(to) : this.realmOf(to);
    if (R === from || this.realmOf(to) === from) return fail('自分の国の星系');
    if (to !== R && !this.isColonized(R)) return fail('相手の国がない');
    if (this.inner.sent.some((x) => x.from === from && x.to === to)) return fail('同じ星系への資金が届く途中');
    if (this.gov(from).credits < M.cost) return fail(JA`資金が足りない (${M.cost} cr)`);
    const at = this.year + this.sysDist(from, to); // 資金は届いた年に払う (協定の贈り物と同じ。払えるだけ)
    this.inner.sent.push({ id: this.nextShipId++, from, to, mode, amt: M.cost, sent: this.year, at });
    if (this.isHuman(from)) this.event('politics', from, JA`${this.system(to).name}へ、${mode === 'back' ? '政府の側を支える' : '反対派を支える'}資金 ${M.cost} cr を送った (届くまで ${(at - this.year).toFixed(1)} 年。届いた年に払う)`, true);
    return { ok: true };
  }
  // 届いた揺さぶりの資金: 相手の首都なら議会の支持、家臣の星系なら主人への忠誠度を動かす。揺さぶりは exposed の確率で知られる
  meddleArrive() {
    const M = INNER.meddle, due = this.inner.sent.filter((x) => x.at <= this.year + 1e-9);
    if (!due.length) return;
    this.inner.sent = this.inner.sent.filter((x) => x.at > this.year + 1e-9);
    for (const x of due) {
      if (!this.isColonized(x.to)) continue;
      const R = this.realmOf(x.to);
      if (R === x.from || !this.realmAlive(x.from) || (x.to === R && !this.isSeat(R))) continue; // 議会のない国 (分かれたばかりの国) の首都には効かない
      // 届いた年に、送った国の資金から払う (払えるだけ。半分に届かなければ取りやめ)。支えは相手の政府へ、揺さぶりは反対派 (その星系の家計) へ
      const amt = Math.min(x.amt, Math.max(0, this.gov(x.from).credits));
      if (amt < x.amt / 2) continue;
      this.cash('grant', -amt, { gov: x.from });
      this.cash('grant', amt, x.mode === 'back' ? { gov: x.to } : { hh: x.to });
      const k = amt / x.amt, sign = x.mode === 'back' ? 1 : -1;
      let what;
      if (x.to === R) {
        this.asRealm(R, () => this.councilAdd(sign * k * M.council, x.mode === 'back' ? '外の国の支え' : '外の国の揺さぶり'));
        what = JA`議会の支持 ${sign > 0 ? '+' : '−'}${(k * M.council).toFixed(1)}`;
      } else {
        const gv = this.gov(x.to);
        gv.loyalty = clamp((gv.loyalty ?? 50) + sign * k * M.loyalty, 0, 100);
        what = JA`主人への忠誠度 ${sign > 0 ? '+' : '−'}${(k * M.loyalty).toFixed(1)}`;
      }
      const known = x.mode === 'back' || this.rand() < M.exposed; // 支えは相手の政府が受け取るので知られる。揺さぶりは exposed の確率で
      if (known) this.memAdd(x.from, R, x.mode === 'back' ? 'gift' : 'meddle', x.to, x.mode === 'back' ? amt / MEM.giftUnit : k); // 恩 (贈り物) か、内政への干渉の恨み (回 AI3 の帳簿)
      const t = x.mode === 'back' ? JA`${this.system(x.to).name}に${this.realmName(x.from)}から政府を支える資金が届いた (${what})`
        : known ? JA`${this.system(x.to).name}で、${this.realmName(x.from)}からの資金が反対派に流れている (${what}。内政への干渉として覚えられた)`
          : JA`${this.system(x.to).name}で、出どころの分からない外の資金が反対派に流れている (${what})`;
      this.event('politics', x.to, t, this.isHuman(R) || this.isHuman(x.from));
    }
  }
  // AI の国の揺さぶり: 年 aiChance の確率で、政治力と資金があれば、いちばんの脅威の首都を揺さぶるか、同盟国の首都の政府を支える (命令として。政治力を払う)
  aiMeddleYearly() {
    const M = INNER.meddle;
    this.players.forEach((p, i) => {
      const r = p.cap;
      if (p.human || !this.realmAlive(r) || p.pc < M.aiPc || this.gov(r).credits < M.cost || this.rand() >= M.aiChance) return;
      const al = this.alignOf(r), allies = this.diplo.pacts.filter((x) => x.kind === 'ally' && (x.a === r || x.b === r)).map((x) => (x.a === r ? x.b : x.a)).filter((y) => this.realmAlive(y) && this.isSeat(y));
      const d = al.t !== null && this.isSeat(al.t) && !this.pactBars(r, al.t) ? { sys: al.t, mode: 'undermine' } : allies.length ? { sys: allies[Math.floor(this.rand() * allies.length)], mode: 'back' } : null;
      if (d) this.asPlayer(i, () => this.command('meddle', d));
    });
  }
