  // --- 国と国のあいだの記憶と評判・指導者 (回 AI3・B-302。MEM・LEADER は politics/memory-consts.js) ---
  // a が b にしたことを帳簿に足す。at = 出来事の星系 (観る国には、そこから光が届いた年から効く)。w = 重さ (贈り物は額 ÷ giftUnit)
  memAdd(a, b, k, at = a, w = 1) {
    if (a === b || a === null || b === null || a === undefined || b === undefined || !(w > 0)) return;
    const key = `${a}|${b}`, list = (this.mem[key] ??= []);
    list.push({ k, y: this.year, at, w: Math.round(w * 1000) / 1000 });
    this.mem[key] = list.filter((e) => this.year - e.y < MEM.keep).slice(-MEM.max);
  }
  // 観る国 o が asOf 年に知っている、a が b にしたことの重み (光が届いたものだけ。半減 half 年で薄れる)
  memSum(o, a, b, asOf = this.year) {
    const out = { agg: 0, betray: 0, rescue: 0, gift: 0, indep: 0 };
    for (const e of this.mem[`${a}|${b}`] || []) {
      if (asOf < e.y + (e.at === o ? 0 : this.sysDist(e.at, o)) - 1e-9) continue;
      out[e.k] = (out[e.k] || 0) + e.w * GM.pow(0.5, (asOf - e.y) / MEM.half);
    }
    return out;
  }
  // r から見た p への恩 (p が r を救った・贈った) と恨み (p が r を侵略した・裏切った・r から分かれた国を支えた)。r の首都に届いた分だけ
  memView(r, p, asOf = this.year) {
    const m = this.memSum(r, p, r, asOf);
    const thanks = m.rescue + m.gift, grudge = m.agg + m.betray + m.indep;
    const L = { agg: '侵略', betray: '裏切り', indep: '独立の支援', rescue: '救援', gift: '贈り物' };
    const parts = Object.keys(L).filter((k) => m[k] >= 0.05).map((k) => JA`${L[k]} ${m[k].toFixed(1)}`);
    return { thanks, grudge, m, text: parts.length ? JA`${this.realmName(p)}の記憶: ${parts.join('・')}` : '' };
  }
  // 宣戦の見込みに足すずれ (realmsYearly から。船と戦争へ頼んだ 1 行): 恨みは仕返しに、恩は思いとどまりに。指導者の経歴のずれも足す
  aiWarBias(root, e) {
    const mv = this.memView(root, e), L = this.leaders[root];
    return MEM.revenge * mv.grudge - MEM.mercy * mv.thanks + (L ? LEADER.careers[L.career].war : 0);
  }
  // 宣戦の理由に添える記憶と指導者の文
  aiWarWhy(root, e) {
    const mv = this.memView(root, e), L = this.leaders[root], parts = [];
    if (mv.text) parts.push(mv.text);
    if (L && LEADER.careers[L.career].war) parts.push(JA`指導者 ${L.name} (${LEADER.careers[L.career].label}) ${LEADER.careers[L.career].war > 0 ? '+' : ''}${LEADER.careers[L.career].war}`);
    return parts.join(JA`・`);
  }
  // --- 指導者 ---
  newLeader() {
    const pick = (xs) => xs[Math.floor(this.rand() * xs.length)];
    const name = `${pick(KANA_A)}${pick(KANA_B)}・${pick(KANA_A)}${pick(KANA_B)}`; // カタカナだけの名前 (英語の画面ではローマ字。outward/i18n.js の romanize)
    const cs = Object.entries(LEADER.careers), tot = cs.reduce((a, [, c]) => a + c.w, 0);
    let r = this.rand() * tot, career = cs[cs.length - 1][0];
    for (const [k, c] of cs) { if ((r -= c.w) < 0) { career = k; break; } }
    return { name, career, since: this.year };
  }
  // 年 1 回 (diplomacyYearly から): 人間が動かしていない国に指導者を置き、年 exit の確率で代える (不規則な退き方は irregular。負けている戦争中は × war)
  leadersYearly() {
    const roots = this.colonizedSystems().map((x) => x.id).filter((r) => this.realmOf(r) === r && (this.gov(r).independent || this.nationOf?.(r)) && !(this.isHuman(r) && !this.spectate));
    for (const r of roots) {
      if (!this.leaders[r]) { this.leaders[r] = this.newLeader(); continue; }
      if (this.rand() >= LEADER.exit) continue;
      const losing = this.enemiesOf(r).some((e) => this.warScore(r, e) < 0);
      this.leaderChange(r, this.rand() < LEADER.irregular * (losing ? LEADER.war : 1));
    }
    for (const k of Object.keys(this.leaders)) if (!this.realmAlive(Number(k))) delete this.leaders[k];
  }
  leaderChange(r, irregular) {
    const old = this.leaders[r], L = this.newLeader();
    L.prev = { name: old.name, career: old.career, since: old.since, until: this.year, irr: irregular ? 1 : 0 };
    this.leaders[r] = L;
    this.aiNote(r, JA`指導者が${old.name} (${LEADER.careers[old.career].label}・${Math.max(1, Math.round(this.year - old.since))} 年) から${L.name} (${LEADER.careers[L.career].label}) に代わった (${irregular ? '政変・反乱など不規則な退き方' : '任期・選挙など決まった退き方'})`);
  }
  // 光の遅れで観る国に届いている指導者 (asOf 年に知っている人)
  leaderSeen(r, asOf = this.year) {
    const L = this.leaders[r];
    if (!L) return null;
    return L.since <= asOf + 1e-9 || !L.prev ? L : { name: L.prev.name, career: L.prev.career, since: L.prev.since };
  }
