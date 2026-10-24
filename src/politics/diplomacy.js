  // --- 遅れて届く外交 (回 SE2・B-026。PACT・PACT_KINDS は politics/diplomacy-consts.js) ---
  realmAlive(r) { return this.isColonized(r) && this.realmOf(r) === r; }
  // --- AI の国が銀河を取りに来る (回 SE5・B-028) ---
  // 入植の補正 (EDITIONS.game.aiRush。補正の台帳 C20): AI の国 (国家選択の国) の星系は、入植の間隔・探す範囲・人口の下限・同時に飛ばせる入植船を緩める
  // 首都 (cap) と首都でない星系で値が違う: 首都は間隔 capWait 年・探す範囲 capRange 光年・同時に飛ばせる入植船 fly 隻。首都でない星系は人口 pop 百万人から・間隔 wait 年・範囲 range 光年
  aiRushOf(id) {
    const r = this.realmOf(id), a = ED.aiRush;
    if (!a || this.isHuman(r) || !this.nationOf(r)) return null;
    return id === r ? { pop: 3, wait: a.capWait, range: a.capRange, fly: a.fly } : { pop: a.pop, wait: a.wait, range: a.range, fly: 1 };
  }
  // 抜けた独立国への権利の主張 (CLAIM。台帳 C21): root の国から独立した国 r なら、開戦の見込みに足す点
  claimOn(root, r) { const c = this.govs[r]?.claim; return !!c && c.realm === root && this.year - c.year <= CLAIM.years && !!this.nationOf(root) && !this.isHuman(root) && this.realmAlive(r); }
  claimBonus(root, r) { return this.claimOn(root, r) ? CLAIM.bonus : 0; }
  // 主張している相手がいれば、開戦を考える年の割合を上げる
  claimChance(root) { return this.colonizedSystems().some((x) => this.claimOn(root, x.id)) ? CLAIM.chance : 0; }
  pactBetween(x, y, kind) { return this.diplo.pacts.find((p) => p.kind === kind && ((p.a === x && p.b === y) || (p.a === y && p.b === x))); }
  // 国 x が協定 p に縛られているか (x の首都に協定の知らせが届いているか)
  pactBound(p, x) { return this.year >= (x === p.a ? p.onA : p.onB) - 1e-9; }
  pactBinds(x, y, kind) { const p = this.pactBetween(x, y, kind); return !!p && this.pactBound(p, x); }
  // 宣戦の判断から呼ぶ (船と戦争へ頼んだ 1 行。docs/status/FU.md): root が target に宣戦しない約束をしているか
  pactBars(root, target) { return this.pactBinds(root, target, 'nap') || this.pactBinds(root, target, 'ally'); }
  // 宣戦の見込みに足す、target の同盟国の艦隊 (root の首都に届いている記録で。船と戦争へ頼んだ 1 行)
  pactAllyShips(root, target) {
    return this.diplo.pacts.filter((p) => p.kind === 'ally' && (p.a === target || p.b === target)).map((p) => (p.a === target ? p.b : p.a))
      .filter((x) => x !== root && this.realmAlive(x)).reduce((k, x) => k + this.seenShips(root, x), 0);
  }
  // 交易協定: 買い手の国が交易協定に縛られていれば関税を掛けない (経済の tariffFor から呼ぶ)
  pactFreeTrade(buyerRealm, sellerRealm) { return buyerRealm !== sellerRealm && this.pactBinds(buyerRealm, sellerRealm, 'trade'); }
  // 国 r の、distrustYears 年のうちの破約の回数
  pactBreaches(r) { return (this.diplo.breach[r] || []).filter((y) => this.year - y < PACT.distrustYears).length; }
  // 共通の脅威: r から見て、近く (宣戦できる距離) の国のうち、自分より強く見えるもの。ships(t) = r が見ている t の艦隊
  pactThreat(r, p, ships) {
    let best = { v: 0, t: null };
    const own = ships(r);
    for (const x of this.colonizedSystems()) {
      const t = x.id;
      if (t === r || t === p || this.realmOf(t) !== t || this.sysDist(r, t) > BARGAIN.warDist) continue;
      const n = ships(t);
      const v = (n - own) / (n + own + 1) + (this.atWar(r, t) ? PACT.atWar : 0);
      if (v > best.v) best = { v, t };
    }
    return best;
  }
  // r が、p からの協定 kind を受けるかの点 (0 以上で受ける) と理由。
  // view: r の見ている艦隊 (既定は r の首都に届いている記録)。z: 読み違い。gift: 添えた贈り物 [cr]
  pactScore(r, p, kind, { gift = 0, z = 0, view = null } = {}) {
    const ships = view || ((t) => (t === r ? this.realmShips(r) : this.seenShips(r, t)));
    const mine = ships(r);
    const seen = ships(p) * GM.exp(z * (BARGAIN.sigma0 + BARGAIN.sigmaAge * this.sysDist(r, p)));
    let s, why;
    if (kind === 'nap') { s = PACT.napBase + (seen - mine) / (seen + mine + 1); why = `${this.realmName(p)}の艦隊を ${Math.round(seen)}、自分を ${Math.round(mine)} と見ている`; }
    else if (kind === 'ally') {
      const th = this.pactThreat(r, p, ships);
      s = PACT.allyBase + th.v + PACT.allyHelp * seen / (seen + mine + 1);
      why = th.t === null ? '共通の脅威が見えない' : `${this.realmName(th.t)}を脅威と見ている`;
    } else { s = PACT.tradeBase; why = '交易の得を見ている'; }
    const b = this.pactBreaches(p);
    if (b) { s -= PACT.distrust * b; why += `。${this.realmName(p)}の破約 ${b} 回`; }
    s += gift / PACT.giftScale;
    return { s, why, seen, mine };
  }
  // プレイヤーの国 (cap) が r へ協定 kind を申し入れたときの見込み (地球に届いている記録で。「何なら受けるか」)。
  // 相手が見ているこちらの艦隊は seenByRival、相手とほかの国の艦隊は、地球が把握している数
  pactOutlook(r, kind) {
    const rival = this.seenByRival(r).n;
    const view = (extra) => (t) => (t === this.cap ? rival + extra : this.knownRealmShips(t));
    const o = this.pactScore(r, this.cap, kind, { view: view(0) });
    const need = { gift: 0, ships: null };
    if (o.s < 0) {
      need.gift = Math.ceil((-o.s * PACT.giftScale) / 100) * 100;
      if (kind !== 'trade') for (let n = 1; n <= 300; n++) if (this.pactScore(r, this.cap, kind, { view: view(n) }).s >= 0) { need.ships = n; break; }
    }
    return { ...o, need, label: o.s >= 0.15 ? '受けそう' : o.s >= 0 ? '五分' : '断りそう' };
  }
  // 協定を申し入れる (命令 pact。政治力 PC_DIPLOMACY)。d.sys = 相手の首都、d.pact = 種類、d.gift = 添える贈り物 [cr] (受けた時点で払う)
  proposePact(d, from = this.cap) {
    const to = Number(d.sys), kind = d.pact, gift = Math.max(0, Math.round(Number(d.gift) || 0));
    if (!PACT_KINDS[kind]) return fail('不明な協定');
    if (to === from || !this.realmAlive(to) || !this.realmAlive(from)) return fail('相手の国がない');
    if (this.pactBetween(from, to, kind)) return fail(`${PACT_KINDS[kind].label}の協定をもう結んでいる`);
    if (this.diplo.sent.some((o) => o.from === from && o.to === to && o.kind === kind)) return fail('同じ申し入れが届く途中');
    if (this.isHuman(from) ? this.knownAtWar(from, to) : this.atWar(from, to)) return fail('交戦中の国とは結べない (講和が先)');
    if (gift > Math.max(0, this.gov(from).credits)) return fail(`贈り物の資金が足りない (${gift} cr)`);
    const at = this.year + this.sysDist(from, to);
    this.diplo.sent.push({ id: this.nextShipId++, kind, from, to, gift, sent: this.year, at });
    if (this.isHuman(from)) this.event('politics', from, `${this.realmName(to)}に${PACT_KINDS[kind].label}の協定を申し入れた (届くまで ${(at - this.year).toFixed(1)} 年${gift ? `・受けたら贈り物 ${gift} cr` : ''})`, true);
    return { ok: true };
  }
  // 協定を結ぶ。a が申し入れた国、b が受けた国。b は今から、a は返事が届いてから縛られる。贈り物は a から b へ (払えるだけ)
  makePact(a, b, kind, gift = 0) {
    const p = { id: this.nextShipId++, kind, a, b, since: this.year, until: this.year + PACT.years, onA: this.year + this.sysDist(a, b), onB: this.year, called: [] };
    this.diplo.pacts.push(p);
    const g = Math.min(gift, Math.max(0, this.gov(a).credits));
    if (g > 0) { this.cash('treaty', -g, { gov: a }); this.cash('treaty', g, { gov: b }); }
    if (this.isHuman(a) || this.isHuman(b)) this.event('politics', b, `${this.realmName(b)}が${this.realmName(a)}との${PACT_KINDS[kind].label}の協定を受けた (${Math.round(p.until)}年まで。${this.realmName(a)}は返事が届く ${p.onA.toFixed(0)} 年から縛られる${g ? `・贈り物 ${fmtAmt(g)} cr` : ''})`, true);
    return p;
  }
  // 国 r が協定を破った (協定の相手に宣戦した・同盟の参戦を断った)
  pactBreach(r, why) {
    (this.diplo.breach[r] ??= []).push(this.year);
    this.diplo.breach[r] = this.diplo.breach[r].filter((y) => this.year - y < PACT.distrustYears);
    if (this.isHuman(r)) this.asRealm(r, () => this.councilAdd(-PACT.breachCouncil, why));
  }
  // AI の国 (と観戦の地球) が、届いた申し入れに答える
  pactAnswerAi(o) {
    const sc = this.pactScore(o.to, o.from, o.kind, { gift: o.gift, z: this.misread() });
    if (sc.s >= 0) return this.makePact(o.from, o.to, o.kind, o.gift);
    if (this.isHuman(o.from)) {
      const need = Math.ceil((-sc.s * PACT.giftScale) / 100) * 100;
      this.event('politics', o.to, `${this.realmName(o.to)}は${PACT_KINDS[o.kind].label}の協定を断った (${sc.why}。贈り物があと ${fmtAmt(need)} cr ほどあれば受けたかもしれない)`);
    }
    return null;
  }
  // 人間の国への申し入れは「決めること」として届く (届いた所 = 自分の首都なので、すぐ見える)
  pactOfferDecision(o) {
    const { label, note } = PACT_KINDS[o.kind];
    this.asRealm(o.to, () => this.addDecision({ kind: 'pact', type: o.kind, sys: o.to, from: o.from, gift: o.gift, deadline: this.year + PACT.replyYears, def: 'refuse',
      text: `${this.realmName(o.from)}が${label}の協定を申し入れてきた (${note}。${PACT.years} 年${o.gift ? `。受ければ贈り物 ${fmtAmt(o.gift)} cr` : ''})。返事は光速で ${this.sysDist(o.to, o.from).toFixed(1)} 年かけて届き、届いた時点から相手が縛られる。`,
      opts: [{ k: 'accept', label: '受ける', note: `いまから${this.realmName(o.to)}が縛られる` }, { k: 'refuse', label: '断る', note: '何も起きない' }] }));
  }
  // 決めること (協定) の返事: resolveDecision から
  resolvePact(dec, k) {
    if (dec.type === 'call') {
      const p = this.diplo.pacts.find((x) => x.id === dec.pact);
      if (k === 'join') { if (this.realmAlive(dec.enemy) && !this.atWar(this.cap, dec.enemy)) { this.beginWar(this.cap, dec.enemy, this.cap); this.event('war', this.cap, `同盟に従い、${this.realmName(dec.enemy)}に宣戦した (${this.realmName(dec.ally)}を守る)`); } }
      else if (p) { this.diplo.pacts = this.diplo.pacts.filter((x) => x !== p); this.pactBreach(this.cap, '同盟の参戦を断った'); this.event('politics', this.cap, `${this.realmName(dec.ally)}との防衛同盟の参戦を断り、同盟は切れた (破約)`); }
      return;
    }
    if (k !== 'accept') { this.event('politics', this.cap, `${this.realmName(dec.from)}からの${PACT_KINDS[dec.type].label}の協定を断った`); return; }
    if (!this.realmAlive(dec.from) || this.atWar(this.cap, dec.from) || this.pactBetween(dec.from, this.cap, dec.type)) return;
    this.makePact(dec.from, this.cap, dec.type, dec.gift || 0);
  }
  // 観戦の地球が、決めること (協定) に答える (earthPoliticsYearly から)
  pactAiReply(dec) {
    if (dec.type === 'call') return 'join';
    return this.pactScore(this.cap, dec.from, dec.type, { gift: dec.gift || 0 }).s >= 0 ? 'accept' : 'refuse';
  }
  // 年 1 回: 申し入れが届く・期限切れ・破約・同盟の参戦・AI の申し入れ
  diplomacyYearly() {
    const D = this.diplo;
    // 届いた申し入れ
    const due = D.sent.filter((o) => o.at <= this.year + 1e-9);
    if (due.length) {
      D.sent = D.sent.filter((o) => !due.includes(o));
      for (const o of due) {
        if (!this.realmAlive(o.from) || !this.realmAlive(o.to) || this.atWar(o.from, o.to) || this.pactBetween(o.from, o.to, o.kind)) continue;
        if (this.isHuman(o.to)) this.pactOfferDecision(o); else this.pactAnswerAi(o);
      }
    }
    // 国でなくなった・期限が切れた協定を外す
    D.pacts = D.pacts.filter((p) => {
      if (!this.realmAlive(p.a) || !this.realmAlive(p.b)) return false;
      if (p.until > this.year) return true;
      if (this.isHuman(p.a) || this.isHuman(p.b)) this.event('politics', this.isHuman(p.a) ? p.b : p.a, `${this.realmName(p.a)}と${this.realmName(p.b)}の${PACT_KINDS[p.kind].label}の協定が期限を迎えた`);
      return false;
    });
    // 破約: 協定の相手と戦争になった。仕掛けた国が、協定に縛られたあとで宣戦していれば破約
    for (const p of [...D.pacts]) {
      if (!this.atWar(p.a, p.b)) continue;
      const by = this.warBy[this.warKey(p.a, p.b)];
      D.pacts = D.pacts.filter((x) => !((x.a === p.a && x.b === p.b) || (x.a === p.b && x.b === p.a)));
      if ((by === p.a || by === p.b) && this.pactBound(p, by) && (this.realmWars[this.warKey(p.a, p.b)] ?? 0) >= Math.min(p.onA, p.onB) - 1e-9) {
        this.pactBreach(by, `${this.realmName(by === p.a ? p.b : p.a)}との協定を破って宣戦した`);
        if (this.isHuman(p.a) || this.isHuman(p.b)) this.event('politics', by === p.a ? p.b : p.a, `${this.realmName(by)}が${PACT_KINDS[p.kind].label}の協定を破って宣戦した (破約。ほかの国も協定を受けにくくなる)`);
      }
    }
    // 防衛同盟: 相手が宣戦されたら、その知らせが首都に届いた年に参戦する
    for (const p of D.pacts) {
      if (p.kind !== 'ally') continue;
      for (const [x, y] of [[p.a, p.b], [p.b, p.a]]) {
        if (!this.pactBound(p, x)) continue;
        for (const e of this.enemiesOf(y)) {
          const key = this.warKey(y, e);
          if (e === x || this.warBy[key] !== e || this.atWar(x, e) || p.called.includes(`${x}|${key}`)) continue;
          const news = this.warNews[key];
          if (news && this.year < news.year + this.sysDist(news.from, x) - 1e-9) continue; // 開戦の知らせがまだ届いていない
          p.called.push(`${x}|${key}`);
          if (this.isHuman(x)) {
            this.asRealm(x, () => this.addDecision({ kind: 'pact', type: 'call', sys: x, pact: p.id, ally: y, enemy: e, deadline: this.year + 3, def: 'join',
              text: `同盟国の${this.realmName(y)}が${this.realmName(e)}に宣戦された。防衛同盟に従って参戦するか。`,
              opts: [{ k: 'join', label: '参戦する', note: `${this.realmName(e)}と戦争になる` }, { k: 'refuse', label: '断る', note: `同盟は切れ、破約になる (議会の支持 −${PACT.breachCouncil}・ほかの国が協定を受けにくくなる)` }] }));
          } else {
            this.beginWar(x, e, x);
            this.event('war', x, `${this.realmName(x)}が、同盟国の${this.realmName(y)}を守るため${this.realmName(e)}に宣戦した`);
          }
        }
      }
    }
    // AI の国 (と観戦の地球) の申し入れ: 首都に届いている記録で、自分の得があり相手も受けそうな相手と種類から、くじで 1 つ
    for (const x of this.colonizedSystems()) {
      const r = x.id;
      if (this.realmOf(r) !== r || (this.isHuman(r) && !this.spectate) || this.rand() >= PACT.aiPropose) continue;
      const cands = [];
      for (const y of this.colonizedSystems()) {
        const t = y.id;
        if (t === r || this.realmOf(t) !== t || this.sysDist(r, t) > BARGAIN.warDist || this.seenBy(r, t)?.[1] !== t || this.atWar(r, t)) continue;
        for (const kind of Object.keys(PACT_KINDS)) {
          if (this.pactBetween(r, t, kind) || D.sent.some((o) => o.from === r && o.to === t && o.kind === kind)) continue;
          const v = Math.min(this.pactScore(r, t, kind).s, this.pactScore(t, r, kind, { view: (u) => (u === t ? this.seenShips(r, t) : u === r ? this.realmShips(r) : this.seenShips(r, u)) }).s); // 自分の得と、相手が受けそうか (自分の見ている数で)
          if (v > 0) cands.push({ t, kind });
        }
      }
      const pick = cands.length ? cands[Math.floor(this.rand() * cands.length)] : null;
      if (pick) this.proposePact({ sys: pick.t, pact: pick.kind }, r);
    }
  }
