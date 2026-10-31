  // --- 星系の中の集団 (回 SE6・B-020・B-021。定数は politics/groups-consts.js。docs/groups.md) ---
  // 民族の権力への近さ (11-3 b)。key = home (支配する種族のよそ生まれ)・local (同じくここ生まれ)・other (ほかの種族)。fact = 統治体制の束の実態
  // 「統治者の任免」の実態が 宗 (宗主が任じる) なら よそ生まれが優位・ここ生まれは無力 (入植地生まれの締め出し。南北アメリカのクリオーリョ)、
  // 分 (分け合う) なら よそ生まれが上級・ここ生まれが下級の分担、従 (従属国が任じる) なら ここ生まれが優位・よそ生まれが下級の分担。
  // ほかの種族は無力 (強制労働の型か、「宗教と文化」の実態が宗なら差別)。直轄の星系は、手で上書きした分 (include) が先。主人のいない国の首都は、支配する種族がみな優位
  groupStatusOf(key, { lord = true, fact, regime, include = null }) {
    if (!lord) return key === 'other' ? 'powerless' : 'dom';
    const appt = fact[BUNDLE_ITEMS.indexOf('appt')], rel = fact[BUNDLE_ITEMS.indexOf('rel')], o = include?.[key];
    if (key === 'home') return appt === 'S' ? 'dom' : appt === 'M' ? 'senior' : 'junior';
    if (o === 'incl') return 'junior';
    if (key === 'local') return o === 'excl' ? 'powerless' : appt === 'S' ? 'powerless' : appt === 'M' ? 'junior' : 'dom';
    return regime === 'encomienda' || rel === 'S' ? 'discr' : 'powerless';
  }
  // 星系の政府 gv のいまの統治体制での、民族の権力への近さ
  groupStatus(gv, key) {
    const has = gv && gv.lord !== null && gv.lord !== undefined;
    return this.groupStatusOf(key, { lord: has, fact: this.bundleOf(gv).fact, regime: regimeKey(gv), include: has && gv.direct ? gv.include : null });
  }
  // 入植地の人のうち、ここ生まれの割合 (経済の学歴の表の here。表がない入植地は、始めからいる人としてここ生まれ)
  hereShare(c) {
    let h = 0, t = 0;
    for (const [k, g] of Object.entries(c.edu || {})) { const s = g.p.reduce((a, b) => a + b, 0); t += s; if (k === 'here') h += s; }
    return t > 0 ? h / t : 1;
  }
  // 星系の民族の構成と権力への近さ (eth = [{ k, share, st }])・締め出された人口の割合 excl・1 人あたりの所得 inc・価値観の 2 軸 values。入植地がなければ null
  // k は home・local・ほかの種族の名前。集団 = 民族 × 所得の 5 分位 (分位は民族によらず同じ分け前。民族の間の所得の差は入れていない)
  groupsOf(id) {
    const cols = this.coloniesIn(id);
    const ruling = this.speciesOfRealm(this.realmOf(id));
    const share = {};
    let P = 0, inc = 0;
    for (const c of cols) {
      if (!(c.pop > 0)) continue;
      P += c.pop; inc += c.pop * (c.inc ?? STRUCTURE.y0);
      const races = c.races || { [HUMAN]: 1 }, tot = Object.values(races).reduce((k, v) => k + v, 0) || 1, here = this.hereShare(c);
      for (const [s, v] of Object.entries(races)) {
        const n = (c.pop * v) / tot;
        if (s === ruling) { share.home = (share.home || 0) + n * (1 - here); share.local = (share.local || 0) + n * here; } else share[s] = (share[s] || 0) + n;
      }
    }
    if (!(P > 0)) return null;
    const gv = this.govs[id];
    const keep = Object.entries(share).filter(([, n]) => n / P >= 1e-4), K = keep.reduce((a, [, n]) => a + n, 0); // 人口の 0.01% より少ない民族は数えない
    const eth = keep.map(([k, n]) => ({ k, share: n / K, st: this.groupStatus(gv, k === 'home' || k === 'local' ? k : 'other') }));
    const excl = eth.reduce((a, e) => a + (GROUP_STATUS[e.st].incl ? 0 : e.share), 0);
    const y = inc / P;
    return { eth, excl, inc: y, values: groupValues(y), quint: this.quintOf(id) }; // quint = 星系の所得の 5 分位の分け前 (回 KE11)
  }
  // 集団の価値観 (QD-42): 星系の値 + よそ生まれの差 + 所得の分位の差 (q = 0〜4。省くと民族だけ)。よそ生まれの差は、星系の民族の割合で平均すると 0 (星系の値はそのまま)。
  // よそ生まれ = 支配する種族のよそ生まれ (home)。ここ生まれとほかの種族は、ここで生まれた人として数える
  groupValuesOf(G, k, q) {
    const V = GROUPS.values, a = (k === 'home' ? 1 : 0) - (G.eth.find((e) => e.k === 'home')?.share || 0);
    const f = (x) => G.values[x] + V.away[x] * a + (q === undefined ? 0 : V.quint[x][q]);
    return { secular: f('secular'), selfexp: f('selfexp') };
  }
  // 集団の忠誠度の、星系の忠誠度からの差 (11-2 c)。G = groupsOf の値、k = 民族、q = 所得の分位 (0〜4。省くと民族だけ)、terms = 忠誠度の目標の内訳 (税と福祉の予算を読む)
  // 民族: 締め出された集団は権力に加わっている集団より GROUPS.exclLoy 点低い (人口で平均すると 0)。
  // 分位: 税の項 (所得への税・消費税・関税) と福祉の予算の項を、手段ごとの帰着の分け前で分ける (回 KE8・B-012。分位の項 = 星系の項 × incFactor。
  // 所得への税は上の分位に、消費税・関税・福祉は下の分位に重い。どれも人口で平均すると 0)
  groupDev(G, k, q, terms) {
    const e = G.eth.find((x) => x.k === k);
    let d = e ? -GROUPS.exclLoy * ((GROUP_STATUS[e.st].incl ? 0 : 1) - G.excl) : 0;
    if (q !== undefined) {
      const tax = (terms || []).find((t) => t.label.startsWith('税')), wel = (terms || []).find((t) => t.label === '福祉の予算')?.v || 0;
      for (const [i, v] of Object.entries(tax?.parts || {})) if (v) d += v * (this.incFactor(i, q, G.quint) - 1);
      if (wel) d += wel * (this.incFactor('welfare', q, G.quint) - 1);
    }
    return d;
  }
  // 集団ごとの一覧 (人口の割合と忠誠度。忠誠度の低い順)。L = 星系の忠誠度
  groupList(G, L, terms) {
    const out = [];
    for (const e of G.eth) for (let q = 0; q < 5; q++) out.push({ k: e.k, q, st: e.st, share: e.share * 0.2, loyalty: clamp(L + this.groupDev(G, e.k, q, terms), 0, 100) });
    return out.sort((a, b) => a.loyalty - b.loyalty);
  }
  // 現地のエリート (B-021): 支配する種族のここ生まれのいちばん上の分位の集団。ここ生まれが GROUPS.elite より少ない若い入植地は、よそ生まれのいちばん上の分位。
  // 支配する種族がいなければ、いちばん多い民族。協力・駆け引き・抵抗 (bundleYearly) は、この集団の忠誠度で決まる
  eliteKey(G) {
    const loc = G.eth.find((e) => e.k === 'local');
    if (loc && loc.share >= GROUPS.elite) return 'local';
    if (G.eth.some((e) => e.k === 'home')) return 'home';
    return G.eth.reduce((m, e) => (!m || e.share > m.share ? e : m), null)?.k;
  }
  eliteLoyalty(id, gv) {
    const L = gv.loyalty ?? LOYALTY_START, G = this.groupsOf(id);
    return G ? clamp(L + this.groupDev(G, this.eliteKey(G), 4, this.loyaltyTerms(id)), 0, 100) : L;
  }
  // 直轄の星系の民族の権力への近さを手で上書きする (命令 include が届いたとき。key = local・other、value = GROUP_INCLUDE のどれか)
  setInclude(id, key, value) {
    const gv = this.govs[id];
    if (!gv || !gv.direct || !this.isColonized(id)) return fail('直轄の星系だけ');
    if (!['local', 'other'].includes(key) || !GROUP_INCLUDE[value]) return fail('不明な集団');
    gv.include = { ...(gv.include || {}) };
    if (value === 'auto') delete gv.include[key]; else gv.include[key] = value;
    if (!Object.keys(gv.include).length) delete gv.include;
    this.event('politics', id, JA`${this.system(id).name} で${key === 'local' ? 'ここ生まれ' : 'ほかの種族'}を${GROUP_INCLUDE[value]}ことにした`, true);
    return { ok: true };
  }
