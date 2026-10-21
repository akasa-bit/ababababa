  // --- 忠誠と独立 ---
  // 忠誠度は年に最大5ずつ目標値へ動く。目標 = 85 − 1.5×主人との距離[ly] − 0.8×国の首都との距離[ly] − 主人より人口が多ければ25
  //   − 最近の指令の数×3 + 主人の星系の駐留艦隊×2 (最大15)。50未満だと指令を拒むことがあり、20未満だと独立を宣言することがある
  //   (独立のしやすさは、忠誠度とは別の恐怖度でも下がる: fearTarget)
  loyaltyTarget(id) {
    const terms = this.loyaltyTerms(id);
    if (!terms) return 100;
    let v = 0;
    for (const t of terms) v += t.v; // 先頭から順に足す (式の順と同じ)
    return clamp(v, 0, 100);
  }
  // 忠誠度の目標の内訳 (いまの実際の値で)。主人がいなければ null
  loyaltyTerms(id) {
    const gv = this.gov(id);
    const lord = gv.lord;
    if (lord === null || lord === undefined) return null;
    const pop = (x) => this.coloniesIn(x).reduce((k, c) => k + c.pop, 0);
    return loyaltyTermsOf({ dLord: this.sysDist(id, lord), dCapital: distance(this.system(id), this.system(this.realmOf(lord))),
      bigger: pop(id) > pop(lord), orders: gv.orders || 0, lordShips: this.garrison[lord] || 0, dep: gv.dep || 0,
      neglect: this.neglectOf(gv), regime: regimeKey(gv), arrears: (gv.arrears || 0) > 0.01, concession: (gv.taxFree || 0) > this.year || (gv.autonomy || 0) > this.year, policy: this.policyAt(id), exhaustion: this.exhaustion[this.realmOf(id)] || 0,
      tax: this.fiscalAt(id).tax, ctax: this.fiscalAt(id).ctax || 0, welfare: this.budgetAt(this.realmOf(id), id, 'welfare') });
  }
  // 地球の知る限りの内訳 (地球に届いている記録で。表示用)
  knownLoyaltyTerms(id) {
    const k = id === this.cap ? null : this.known(id);
    if (!k || k.lord === null || k.lord === undefined) return null;
    const lord = k.lord;
    const pop = (x) => this.knownColonies(x).reduce((a, c) => a + c.pop, 0);
    const capital = lord === this.cap ? this.cap : this.known(lord)?.realm ?? k.realm ?? this.cap;
    // 放っておかれた年数は、記録の時点から今までの年数を足す (そのあと関与が届いたかは、まだ地球には見えない)
    return loyaltyTermsOf({ dLord: this.sysDist(id, lord), dCapital: this.sysDist(id, capital),
      bigger: pop(id) > pop(lord), orders: k.orders || 0, lordShips: this.knownGarrison(lord), dep: k.dep || 0,
      neglect: Math.max(0, this.year - (k.attended ?? k.founded ?? k.year)), regime: this.knownRegime(k), arrears: (k.arrears || 0) > 0.01, concession: (k.taxFree || 0) > this.year || (k.autonomy || 0) > this.year, policy: k.policy ?? null, exhaustion: this.exhaustion[capital] || 0, tax: k.tax || 'normal', welfare: k.welfare || 0 });
  }
  // 統治体制 (主人がいなければ null)
  regimeOf(gv) { return regimeKey(gv); }
  knownRegime(k) { return k ? (k.direct ? 'direct' : regimeNorm(k.regime) || BASE_REGIME) : BASE_REGIME; }
  // 新しい家臣の星系の統治体制: 人間の国はプレイヤーの選んだもの、AI の国は国号から (連邦・合衆国 → 連邦制、王国・公国など → 封建制、帝国 → エンコミエンダ制、自治領 → 自治領)
  // AI の国は、国号ではなく首都からの距離で、歴史の同じ区分 (陸続き・近い海・遠い海) の事例の数に比べた確率で型を選ぶ (VASSAL_DATA.ai)
  defaultRegime(root, sysId = null) {
    const p = this.players[this.playerOf(root)];
    if (p && this.isHuman(root)) { const r = regimeNorm(p.regime); return r && r !== 'direct' ? r : BASE_REGIME; }
    if (sysId === null) return BASE_REGIME;
    const d = this.sysDist(sysId, root);
    const cls = d < BUNDLE.aiDist[0] ? 'contiguous' : d < BUNDLE.aiDist[1] ? 'near' : 'far';
    const w = Object.entries(VASSAL_DATA.ai.types[cls]);
    let x = this.rand() * w.reduce((k, [, n]) => k + n, 0);
    for (const [t, n] of w) { x -= n; if (x < 0) return t; }
    return w[w.length - 1][0];
  }
  // 離反の起きやすさの内訳 (いまの実際の値で)。主人がいなければ null
  secessionTerms(id) {
    const gv = this.govs[id];
    if (!gv || gv.lord === null || gv.lord === undefined) return null;
    const pop = (x) => this.coloniesIn(x).reduce((k, c) => k + c.pop, 0);
    const b = this.bundleOf(gv);
    return secessionTermsOf({ regime: regimeKey(gv), delay: this.sysDist(id, this.realmOf(id)), popRatio: pop(id) / Math.max(1e-3, pop(gv.lord)), loyalty: gv.loyalty ?? LOYALTY_START, security: this.budgetAt(this.realmOf(id), id, 'security'), gap: bundleGap(b.law, b.fact) });
  }
  // 地球の知る限りの内訳 (表示用)。regime を渡すと、その統治体制にしたときの値 (比べる用。忠誠度の目標の差も入れる)
  knownSecessionTerms(id, regime = null) {
    const k = id === this.cap ? null : this.known(id);
    if (!k || k.lord === null || k.lord === undefined) return null;
    const pop = (x) => this.knownColonies(x).reduce((a, c) => a + c.pop, 0);
    const capital = k.lord === this.cap ? this.cap : this.known(k.lord)?.realm ?? k.realm ?? this.cap;
    const cur = this.knownRegime(k);
    const r = regimeNorm(regime) || cur;
    const loyalty = clamp((k.loyalty ?? LOYALTY_START) + (REGIMES[r].loyalty - REGIMES[cur].loyalty) - Math.round(HAZARD.revoke * Math.max(0, this.lawRank(k) - REGIMES[r].rank)), 0, 100);
    const b = this.bundleOf(k);
    const law = r === cur ? b.law : REGIMES[r].law;
    return secessionTermsOf({ regime: r, delay: this.sysDist(id, capital), popRatio: pop(id) / Math.max(1e-3, pop(k.lord)), loyalty, security: k.security || 0, gap: bundleGap(law, b.fact) });
  }
  // 統治体制を変える (指令が届いたとき)。自治の度合いを下げると、下げた段ごとに忠誠度 −HAZARD.revoke
  setRegime(id, regime) {
    const gv = this.govs[id];
    if (!gv || !this.isColonized(id) || gv.lord === null || gv.lord === undefined) return fail('家臣の星系がない');
    regime = regimeNorm(regime);
    if (!regime) return fail('不明な統治体制');
    const old = regimeKey(gv);
    if (old === regime) return { ok: true };
    const drop = Math.max(0, this.lawRank(gv) - REGIMES[regime].rank);
    const fact = this.bundleOf(gv).fact;
    delete gv.direct;
    delete gv.regime;
    delete gv.law;
    if (regime === 'direct') delete gv.fact; else gv.fact = fact; // 直轄はすべて宗主が握る
    if (regime === 'direct') gv.direct = true; else if (regime !== BASE_REGIME) gv.regime = regime;
    if (drop) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - Math.round(HAZARD.revoke * drop));
    this.event('politics', id, `${this.system(id).name} の統治体制を${REGIMES[old].label}から${REGIMES[regime].label}に変えた${drop ? ` (自治を狭めたので忠誠度 −${Math.round(HAZARD.revoke * drop)})` : ''}`, true);
    return { ok: true };
  }
  // 星系の束 (法と実態)。持っていなければ型の雛形
  bundleOf(gv) { const R = REGIMES[gv?.direct ? 'direct' : regimeNorm(gv?.regime) || BASE_REGIME]; return { law: gv?.law || R.law, fact: gv?.fact || R.fact }; }
  lawRank(gv) { return [...this.bundleOf(gv).law].reduce((k, c) => k + BUNDLE_PTS[c], 0) / 2; }
  // 束の 1 項目の法を変える (交渉の指令が届いたとき)。宗主の側へ寄せると、狭めた分だけ忠誠度が下がる (統治体制の変更と同じ物差し)
  setBundleItem(id, item, value) {
    const gv = this.govs[id];
    const i = BUNDLE_ITEMS.indexOf(item);
    if (!gv || gv.lord === null || gv.lord === undefined || !this.isColonized(id)) return fail('家臣の星系がない');
    if (i < 0 || !BUNDLE_CODES[value]) return fail('不明な項目');
    if (gv.direct) return fail('直轄の星系は束を持たない (すべて宗主が握る)');
    const b = this.bundleOf(gv);
    if (b.law[i] === value) return { ok: true };
    const drop = Math.max(0, BUNDLE_PTS[b.law[i]] - BUNDLE_PTS[value]) / 2;
    gv.law = b.law.slice(0, i) + value + b.law.slice(i + 1);
    if (!gv.fact) gv.fact = b.fact;
    if (drop) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - Math.round(HAZARD.revoke * drop));
    this.event('politics', id, `${this.system(id).name} との約定で「${BUNDLE_LABELS[item]}」を${BUNDLE_CODES[b.law[i]]}から${BUNDLE_CODES[value]}にした${drop ? ` (自治を狭めたので忠誠度 −${Math.round(HAZARD.revoke * drop)})` : ''}`, true);
    return { ok: true };
  }
  // 現地のエリートと実態の層 (年1回): 協力なら実態が法へ、抵抗なら「従」へ、項目ごとに年 BUNDLE.p の確率で半段ずつ寄る。直轄は動かない
  bundleYearly() {
    for (const [k, gv] of Object.entries(this.govs)) {
      const id = Number(k);
      if (gv.lord === null || gv.lord === undefined || gv.direct || !this.isColonized(id)) continue;
      const L = gv.loyalty ?? LOYALTY_START;
      const stance = L >= BUNDLE.coop ? 'coop' : L < BUNDLE.resist ? 'resist' : 'bargain';
      if (stance !== (gv.elite || 'bargain')) {
        if (stance === 'resist' && this.realmOf(id) === this.cap) this.event('politics', id, `${this.system(id).name} の現地のエリートが、${this.realmName(this.cap)}への協力をやめて抵抗に回った (実態が従属国の側へ寄っていく)`);
        if (stance === 'bargain') delete gv.elite; else gv.elite = stance;
      }
      if (stance === 'bargain') continue;
      const b = this.bundleOf(gv);
      let f = b.fact;
      for (let i = 0; i < BUNDLE_ITEMS.length; i++) {
        if (this.rand() >= BUNDLE.p) continue;
        const to = stance === 'coop' ? b.law[i] : 'V';
        f = f.slice(0, i) + bundleStep(f[i], to) + f.slice(i + 1);
      }
      if (f !== b.fact) gv.fact = f;
    }
  }
  // 共同統治の 2 国目の宗主: 主な宗主の国のほかで、首都がいちばん近い独立した国 (なければ持たない)
  jointSecond(id) {
    const own = this.realmOf(id);
    let best = null, bd = Infinity;
    for (const x of this.colonizedSystems()) {
      const r = x.id;
      if (r === own || this.realmOf(r) !== r) continue; // 独立した国の首都だけ
      const d = this.sysDist(id, r);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  // 新しい仕組みの要る型 (年1回): 共同統治の 2 国目の宗主を保つ・同君連合の継承の危機
  vassalTypesYearly() {
    for (const [k, gv] of Object.entries(this.govs)) {
      const id = Number(k);
      if (gv.lord === null || gv.lord === undefined || !this.isColonized(id)) continue;
      const key = regimeKey(gv);
      if (key === 'T08') {
        if (gv.lord2 === undefined || !this.isColonized(gv.lord2) || this.realmOf(gv.lord2) !== gv.lord2 || gv.lord2 === this.realmOf(id)) {
          const r = this.jointSecond(id);
          if (r === null) delete gv.lord2; else gv.lord2 = r;
        }
      } else if (gv.lord2 !== undefined || gv.jointCut) { delete gv.lord2; delete gv.jointCut; }
      if (key !== 'T19' && gv.arrears) delete gv.arrears;
      if (key === 'T15' && this.rand() < 1 / GENERATION_YEARS) {
        const succ = this.bundleOf(gv).fact[BUNDLE_ITEMS.indexOf('succ')];
        if (succ === 'V') { gv.unionEnd = true; this.declareIndependence(id); }
        else this.event('politics', id, `${this.system(id).name} で君主の代替わりがあった。継承は${succ === 'S' ? '宗主' : '両国の取り決め'}のもとで行われ、同君連合は続く`, this.realmOf(id) === this.cap);
      }
    }
  }
  // 共同統治の 2 国目への分け前を断つ・戻す (指令が届いたとき)。断つと家臣の忠誠度が下がる
  setJointCut(id, cut) {
    const gv = this.govs[id];
    if (!gv || regimeKey(gv) !== 'T08' || gv.lord2 === undefined) return fail('2 国目の宗主がいない (共同統治の家臣だけ)');
    if (!!gv.jointCut === !!cut) return { ok: true };
    if (cut) { gv.jointCut = true; gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - H33.jointCut); } else delete gv.jointCut;
    this.event('politics', id, `${this.system(id).name} の朝貢の${cut ? `うち${this.realmName(gv.lord2)}への分け前を断った (忠誠度 −${H33.jointCut})` : `${this.realmName(gv.lord2)}への分け前を戻した`}`, true);
    return { ok: true };
  }
  // 統治者の任免 (改易・廃位): 実態で任免を宗主が握るか分け合う家臣だけ。現地の統治者を替えると、実態は約定どおりに戻り、エリートは協力から始まる
  depose(id) {
    const gv = this.govs[id];
    if (!gv || gv.lord === null || gv.lord === undefined || gv.direct) return fail('家臣の星系 (直轄でないもの) だけ');
    const b = this.bundleOf(gv);
    if (b.fact[BUNDLE_ITEMS.indexOf('appt')] === 'V') return fail('任免を実態で従属国が握っているので、統治者を替えられない');
    gv.fact = b.law;
    gv.elite = 'coop';
    gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - H33.depose);
    delete gv.unrest;
    this.event('politics', id, `${this.system(id).name} の統治者を替えた (改易・廃位)。実態は約定どおりに戻ったが、忠誠度 −${H33.depose}`, true);
    return { ok: true };
  }
  // 強制労働の後遺症 (年1回)。独立したあとも残る
  regimeYearly() {
    for (const gv of Object.values(this.govs)) {
      if (regimeKey(gv) === 'encomienda' && gv.lord !== null && gv.lord !== undefined) gv.scar = Math.min(1, (gv.scar || 0) + FORCED.scarRate);
      else if (gv.scar) { gv.scar *= FORCED.scarKeep; if (gv.scar < 0.01) delete gv.scar; }
    }
  }
  // 星系に駐留している地球の国の艦隊 (命令で駐留している分と威圧の分。太陽系はすべて)
  earthFleetAt(id, root = this.cap) {
    const g = this.garrison[id] || 0;
    return id === root ? g : Math.min(g, (this.held[id] || 0) + (this.awe[id] || 0));
  }
  // 反乱 (独立戦争) を起こしたとき、その星系が持つであろう艦隊: 人口と経済 (施設の規模・資金) に応じて
  rebelFleetOf(cols, credits) {
    const pop = cols.reduce((k, c) => k + c.pop, 0);
    const econ = cols.reduce((k, c) => k + Object.values(c.lv || {}).reduce((a, b) => a + b, 0), 0);
    return Math.max(1, Math.round(2 * GM.log10(1 + pop) + econ / 4 + Math.max(0, credits || 0) / 1000));
  }
  rebelFleet(id) { return this.rebelFleetOf(this.coloniesIn(id), this.gov(id).credits); }
  knownRebelFleet(id) { const k = this.known(id); return this.rebelFleetOf(this.knownColonies(id), k?.credits); }
  // 恐怖度 (0〜100): 忠誠度とは別のパラメータ。その星系に駐留する地球の艦隊 (命令で駐留している分と威圧の分) が多いほど高い。
  // 目標 = 50 × 地球の艦隊 / 反乱したときの推定艦隊 (同数で50、2倍で100)。年に最大10ずつ目標へ動く。地球の国の星系だけ
  fearTarget(id) {
    const root = this.realmOf(id);
    if (id === root || !this.isHuman(root)) return 0;
    return Math.min(100, 50 * this.earthFleetAt(id, root) / this.rebelFleet(id) * (this.policyAt(id) === 'military' ? 1.5 : 1));
  }
  // 恐怖度が高いほど独立を宣言しにくい (恐怖度100で確率が1/10)
  fearFactor(fear) { return 1 - 0.9 * clamp(fear || 0, 0, 100) / 100; }
  // 最後通牒の期限に独立を宣言する確率 = 恐怖度 × 友好度 × 忠誠度の倍率 (忠誠度100で半分)
  loyaltyFactor(loyalty) { return 1 - 0.5 * clamp(loyalty ?? LOYALTY_START, 0, 100) / 100; }
  // シミュレーション版は恐怖度だけで決める (忠誠度は離反のハザードにもう入っている。友好度 (貿易) が独立を妨げる大きさは測られていない)
  declareChance(k) { return this.fearFactor(k.fear) * (ED.declareDamp ? this.friendFactor(k.friend) * this.loyaltyFactor(k.loyalty) : 1); }
  // 主人との友好度 (0〜100): 主人筋 (主人、その主人…首都まで) との貿易 (両方向。支援として無償で受け取った物資も含む) の大きさで上下する。
  // 目標 = 50 × log10(1 + 貿易額[cr/年、ここ5年ほどの平均] / 2) (5 cr/年で約27、10で約39、20で約52、50で約71、100で約85)。年に最大10ずつ目標へ動く。
  // 反乱の確率は友好度に比例して下がる (× (1 − FRIEND_DAMP × 友好度/100)。友好度100で 0.4 倍。経済の結びつきが強くても独立した植民地はある)
  friendTarget(trade) { return clamp(50 * GM.log10(1 + Math.max(0, trade || 0) / 2), 0, 100); }
  friendFactor(friend) { return Math.max(0, 1 - FRIEND_DAMP * clamp(friend || 0, 0, 100) / 100); }
  // 主人筋 (主人、その主人…首都まで) との取引を数える。a, b のどちらかがもう一方の主人筋なら、家臣の側に記録する
  isLordOf(x, id) {
    for (let g = this.govs[id], n = 0; g && g.lord !== null && g.lord !== undefined && n < 50; g = this.govs[g.lord], n++) if (g.lord === x) return true;
    return false;
  }
  noteLordTrade(a, b, value) {
    if (!(value > 0) || a === b) return;
    if (this.isLordOf(b, a)) this.govs[a].lordTradeYear = (this.govs[a].lordTradeYear || 0) + value;
    else if (this.isLordOf(a, b)) this.govs[b].lordTradeYear = (this.govs[b].lordTradeYear || 0) + value;
  }
  loyaltyYearly() {
    for (const [key, gv] of Object.entries(this.govs)) {
      const id = Number(key);
      if (gv.lord === null || gv.lord === undefined || !this.isColonized(id)) continue;
      gv.loyalty ??= LOYALTY_START;
      gv.loyalty = clamp(gv.loyalty + clamp(this.loyaltyTarget(id) - gv.loyalty, -5, 5), 0, 100);
      gv.orders = (gv.orders || 0) * 0.7;
      gv.dep = (gv.dep || 0) * 0.8;
      gv.aid = gv.aidYear || 0; // 直近1年に受け取った支援の価値
      gv.aidYear = 0;
      gv.fear = clamp((gv.fear || 0) + clamp(this.fearTarget(id) - (gv.fear || 0), -10, 10), 0, 100);
      // 主人との貿易額[cr/年]。取引は時々まとめて起きるので、ならした値 (指数移動平均、ここ5年ほどの平均) を使う
      gv.lordTrade = 0.8 * (gv.lordTrade || 0) + 0.2 * (gv.lordTradeYear || 0);
      gv.lordTradeYear = 0;
      const friendT = Math.max(0, this.friendTarget(gv.lordTrade) - (this.policyAt(id) === 'military' ? 10 : 0));
      gv.friend = clamp((gv.friend || 0) + clamp(friendT - (gv.friend || 0), -10, 10), 0, 100);
      // 不満の段階を進める (不満 → 要求 → 最後通牒 → 独立)。恐怖度が高いほど、主人との友好度が高いほど独立しにくい
      this.unrestYearly(id, gv);
    }
  }
  // 不満の段階 (年1回)。離反の起きやすさ (secessionTerms) に従って自立を求める動きが起き、UNREST_YEARS 年続くと主人へ減税か自治を要求する。
  // 主人が地球なら要求は光速で地球へ届き、返事も光速で戻る (総督の方針を預けてあれば、現地ですぐ決まる)。主人が地球でなければ主人の政府が決める。
  // のめば不満は収まる。拒めば最後通牒になり、ULTIMATUM_YEARS 年後に (恐怖度・友好度に応じた確率で) 独立を宣言する。
  // 要求の前に忠誠度が calmAtOf まで上がれば収まる
  unrestYearly(id, gv) {
    const u = gv.unrest;
    const loyal = gv.loyalty ?? LOYALTY_START;
    const name = this.system(id).name;
    if (!u || !u.stage) {
      // 独立を求める動きは、離反の起きやすさ (ハザード) に従って起きる
      const terms = this.secessionTerms(id);
      const h = hazardOf(terms);
      if (this.rand() < hazardYear(h)) {
        gv.unrest = { stage: 1, since: this.year, at: Math.round(loyal) };
        const why = terms.slice(1).filter((t) => t.f > 1.2).sort((a, b) => b.f - a.f).slice(0, 2).map((t) => `${t.label} ×${t.f.toFixed(1)}`).join('・');
        this.event('politics', id, `${name} で${this.system(gv.lord).name}からの自立を求める動きが起きた (忠誠度 ${Math.round(loyal)}・離反の起きやすさ 年 ${pctH(hazardYear(h))}${why ? `。主な原因: ${why}` : ''})。このまま${UNREST_YEARS}年続くと、減税か自治を要求してくる`);
      }
      return;
    }
    const calm = calmAtOf(u);
    if (u.stage === 1 && loyal >= calm) return this.calmUnrest(id, gv, `忠誠度が ${Math.round(loyal)} に上がり、不満が収まった`); // 要求を出したあとは、返事が要る
    if (u.stage === 1) { if (this.year - u.since >= UNREST_YEARS) this.raiseDemand(id, gv); return; }
    if (u.stage === 2) {
      if (u.aiAt !== undefined && this.year >= u.aiAt) {
        // 主人の政府の判断 (半々)
        if (this.rand() < 0.5) this.grantDemand(id, gv); else this.refuseDemand(id, gv, `${this.system(gv.lord).name} に要求を拒まれた`);
      } else if (this.year >= (u.timeout ?? Infinity)) this.refuseDemand(id, gv, '返事が届かないので、要求は拒まれたとみなした');
      return;
    }
    if (this.year < u.end) return;
    const p = this.declareChance(gv);
    if (this.rand() < p) this.declareIndependence(id);
    else {
      gv.unrest = { stage: 1, since: this.year, at: Math.round(loyal) };
      this.event('politics', id, `${name} は最後通牒の期限が来たが、独立を思いとどまった (恐怖度 ${Math.round(gv.fear || 0)}・友好度 ${Math.round(gv.friend || 0)}・忠誠度 ${Math.round(loyal)})。不満はまだ残っている`);
    }
  }
  calmUnrest(id, gv, why) {
    gv.unrest = { stage: 0 };
    for (const p of this.players) for (const d of p.decisions || []) if (d.kind === 'demand' && d.sys === id && d.state !== 'done') { d.state = 'done'; d.void = true; }
    this.event('politics', id, `${this.system(id).name}: ${why}`, true);
  }
  demandText(kind) { return kind === 'tax' ? `朝貢の免除 (${CONCESSION_YEARS}年)` : `自治 (${CONCESSION_YEARS}年、主人の指令を受けない)`; }
  raiseDemand(id, gv) {
    const kind = (gv.taxFree || 0) > this.year ? 'autonomy' : 'tax';
    const what = this.demandText(kind);
    const name = this.system(id).name;
    gv.unrest = { stage: 2, since: this.year, kind };
    if (!this.isHuman(gv.lord)) {
      // 主人が人間のプレイヤーでなければ、主人の政府が判断する (要求と返事が光速で往復する)
      gv.unrest.aiAt = this.year + 2 * this.travelYears(id, gv.lord);
      this.event('demand', id, `${name} が${this.system(gv.lord).name}に${what}を求めた`);
      return;
    }
    const gov = gv.governor || 'ask';
    if (gov === 'yield') { this.event('demand', id, `${name} が${what}を求め、総督が方針どおりその場で認めた`); return this.grantDemand(id, gv); }
    if (gov === 'suppress') { this.event('demand', id, `${name} が${what}を求め、総督が方針どおり鎮圧に動いた`); return this.refuseDemand(id, gv, '総督が要求を退けて鎮圧した', 'suppress'); }
    if (gov === 'ignore') {
      gv.unrest.timeout = this.year + 10;
      this.event('demand', id, `${name} が${what}を求めたが、総督は方針どおり返事をしない (10年で拒んだとみなされる)`);
      return;
    }
    // 主人 (人間のプレイヤー) の決めることに加える
    this.asRealm(gv.lord, () => {
    const d = this.lightDelay(id);
    gv.unrest.timeout = this.year + 2 * d + 15;
    this.addDecision({ kind: 'demand', type: kind, sys: id, deadline: this.year + d + 15,
      text: `${name} が${what}を求めている (忠誠度 ${Math.round(gv.loyalty ?? LOYALTY_START)}・恐怖度 ${Math.round(gv.fear || 0)}・友好度 ${Math.round(gv.friend || 0)})。拒めば最後通牒になり、${ULTIMATUM_YEARS}年後に独立を宣言するおそれがある。返事が届かないまま ${(this.year + 2 * d + 15).toFixed(0)}年を過ぎると、拒んだとみなされる。`,
      opts: [
        { k: 'accept', label: 'のむ', note: kind === 'tax' ? `${CONCESSION_YEARS}年朝貢を免除する。忠誠度 +20、その間の目標 +15` : `${CONCESSION_YEARS}年自治を認める (指令を受けず、直轄から外れる)。忠誠度 +20、その間の目標 +15` },
        { k: 'refuse', label: '拒む', note: `最後通牒になる。忠誠度 −10` },
        { k: 'awe', label: '拒んで威圧する', note: '最後通牒になる。すぐ太陽系から威圧の艦隊 (推定独立軍の2倍) を送る。忠誠度 −5' },
      ] });
    this.event('demand', id, `${name} が${this.homeName()}に${what}を求めた (返事は光速で ${d.toFixed(1)} 年かかる)`);
    });
  }
  grantDemand(id, gv) {
    const u = gv.unrest || {};
    if (u.kind === 'autonomy') { gv.autonomy = this.year + CONCESSION_YEARS; delete gv.direct; } else gv.taxFree = this.year + CONCESSION_YEARS;
    gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 20);
    gv.unrest = { stage: 0 };
    this.attend(id);
    this.event('politics', id, `${this.system(id).name} の要求 (${this.demandText(u.kind || 'tax')}) が認められ、不満が収まった`, true);
  }
  refuseDemand(id, gv, why, mode = 'refuse') {
    gv.unrest = { stage: 3, since: this.year, end: this.year + ULTIMATUM_YEARS, kind: gv.unrest?.kind };
    gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - (mode === 'refuse' ? 10 : 5));
    if (mode === 'suppress') gv.fear = Math.min(100, (gv.fear || 0) + ((this.garrison[id] || 0) > 0 ? 25 : 10));
    // 拒むことは関与にならない (放っておかれた年数は戻らない。最後通牒を収めるには、別に関与を届けて忠誠度を戻す)
    this.event('politics', id, `${this.system(id).name}: ${why}。最後通牒を突きつけた — ${Math.round(this.year + ULTIMATUM_YEARS)}年までに態度が変わらなければ独立を宣言する`);
  }
  declareIndependence(id) {
    const gv = this.gov(id);
    const formerRealm = this.realmOf(id);
    const lord = gv.lord;
    // 原因: 忠誠度の目標を最も下げていた2つの要因 (イベントの文に添える)
    const why = (this.loyaltyTerms(id) || []).filter((t) => t.v < -0.5).sort((a, b) => a.v - b.v).slice(0, 2)
      .map((t) => `${t.label} −${(-t.v).toFixed(0)}`).join('・');
    const unionEnd = !!gv.unionEnd;
    delete gv.unionEnd;
    const cause = unionEnd ? '。継承の危機で同君連合が解けた (継承は従属国が握っていた)' : `。忠誠度 ${Math.round(gv.loyalty ?? LOYALTY_START)}・恐怖度 ${Math.round(gv.fear || 0)}・友好度 ${Math.round(gv.friend || 0)}${why ? ` (主な原因: ${why})` : ''}`;
    gv.lord = null;
    gv.independent = true;
    gv.loyalty = 0;
    gv.fear = 0;
    gv.friend = 0;
    gv.unrest = { stage: 0 };
    if (this.tech[formerRealm] && !this.tech[id]) this.tech[id] = { A: { ...this.tech[formerRealm].A } }; // 技術は元の国のものを持っていく
    if (!this.isHuman(id)) (this.aif ??= {})[id] = { ...this.fiscalFor(formerRealm, id) }; // 財政 (税率など) も元の国のものを引き継ぐ (制度は続く)
    const reg = REGIMES[regimeKey(gv)];
    const peaceful = !!reg.peaceful || unionEnd;
    delete gv.direct;
    delete gv.regime;
    delete gv.law;
    delete gv.fact;
    delete gv.elite;
    delete gv.lord2;
    delete gv.jointCut;
    delete gv.arrears;
    for (const p of this.players) for (const d of p.decisions || []) if (d.sys === id && d.state !== 'done') { d.state = 'done'; d.void = true; }
    this.asRealm(formerRealm, () => {
      this.stats.indepFromEarth++;
      this.councilAdd(-8);
      for (const c of this.challenges) if (c.id === 'loyal' && c.status === 'active') { c.status = 'failed'; c.at = this.year; }
    });
    const members = this.colonizedSystems().filter((x) => this.realmOf(x.id) === id);
    const followers = members.length - 1;
    // 地球の国からの独立は、半々の確率で、また地球の艦隊が駐留していれば必ず、そのまま戦争 (独立戦争) になる
    const human = this.isHuman(formerRealm);
    const present = human && members.some((x) => this.earthFleetAt(x.id, formerRealm) >= 1);
    // 戦争になる確率は統治体制ごとの歴史の割合 (ICOW)。ゲーム版は艦隊が駐留していればかならず戦争になる。自治領は戦争なしで独立する
    const war = human && !peaceful && ((ED.garrisonWar && present) || this.rand() < (reg.war ?? VIOLENT_SHARE));
    this.lastIndependence = { id, war, p: peaceful ? 0 : reg.war ?? VIOLENT_SHARE, regime: reg.id || null }; // 測る道具 (tools/secession.js) のため。AI の国どうしの独立は戦争の判定をしないので、確率 p も残す
    let raised = 0;
    const clashes = [];
    if (war) {
      this.beginWar(id, formerRealm, id);
      // 独立戦争: 各星系は人口と経済の規模に応じた艦隊を持つ (それまでの自前の守りも加わる)。
      // 駐留していた地球の艦隊は、その場で艦隊戦を始める (勝てば攻囲に移る)
      for (const x of members) {
        const earth = this.earthFleetAt(x.id, formerRealm);
        const n = this.rebelFleet(x.id);
        raised += n;
        this.garrison[x.id] = (this.garrison[x.id] || 0) - earth + n;
        delete this.held[x.id];
        delete this.awe[x.id];
        if (earth >= 1) clashes.push([x.id, earth]);
      }
    }
    this.event('politics', id, `${this.system(id).name} が ${this.system(lord).name} への従属をやめ、${peaceful ? `${reg.label}から交渉で` : ''}独立を宣言した${followers ? ` (従属する ${followers} 星系も従う)` : ''}${cause}${war ? `。${this.realmName(formerRealm)}と戦争状態に入った (独立軍 ${raised} 艦隊)` : ''}`);
    for (const [x, earth] of clashes) this.startBattle(x, formerRealm, earth, 0);
  }
  // 指令が届いたとき: 地球の国の外なら拒否、忠誠度が50未満なら (50−忠誠度)/50 の確率で拒否
  obeys(id, act = null) {
    if (id === this.cap) return { ok: true };
    if (this.realmOf(id) !== this.cap) return fail(`${this.realmName(this.cap)}に属していないので従わない`);
    const gv = this.gov(id);
    const loyalty = gv.loyalty ?? LOYALTY_START;
    if ((gv.autonomy || 0) > this.year) return fail(`自治を認められているので従わない (${Math.round(gv.autonomy)}年まで)`);
    if (gv.direct) { gv.orders = (gv.orders || 0) + 1; return { ok: true }; } // 直轄の星系はかならず従う
    const reg = REGIMES[regimeKey(gv)];
    if (reg.noOrders && !['rule', 'bundle', 'jointcut', 'depose'].includes(act)) return fail(`${reg.label}なので指令を受けない (統治体制・約定・任免の指令だけは受ける)`);
    const at = reg.refuseAt || 50; // 型ごと (実態で従属国が握る項目が多いほど、高い忠誠度でも拒む)
    if (loyalty < at && this.rand() < (at - loyalty) / at) {
      gv.loyalty = Math.max(0, loyalty - 2);
      return fail(`忠誠度が低く (${Math.round(loyalty)}) 指令を拒否した`);
    }
    gv.orders = (gv.orders || 0) + 1;
    return { ok: true };
  }

  // --- 政治力・統治 (直轄と委任)・国家方針 ---
  isDirect(id) { return !!this.govs[id]?.direct; }
  directCount() { let n = 0; for (const [k, v] of Object.entries(this.govs)) if (v.direct && this.isColonized(Number(k)) && this.realmOf(Number(k)) === this.cap) n++; return n; }
  directMax() { return DIRECT_MAX + (this.policy?.id === 'consolidate' ? 2 : 0); }
  // その星系で効いている国家方針 (変えた知らせが光速で届くまでは前の方針)。地球の国の外では効かない
  policyAt(id) {
    const root = this.realmOf(id);
    const p = this.players[this.playerOf(root)]?.policy;
    if (!p) return null;
    return this.year >= p.since + this.sysDist(root, id) ? p.id : p.prev ?? null;
  }
  // 指令に要る政治力。艦隊への指令・自動の指令・太陽系の中の行動は0。直轄の星系は半分
  pcCost(act, d) {
    if (d.auto || d.awe || d.aweBack || PC_FREE_ACTS.has(act)) return 0;
    if (act === 'declarewar' || act === 'peace') return PC_DIPLOMACY;
    if (act === 'policy') return POLICY_COST;
    if (act === 'fiscal') { const c = this.fiscal || FISCAL_DEFAULT; return taxRateOf(d.tax ?? c.tax) !== taxRateOf(c.tax) || Number(d.ctax ?? c.ctax ?? 0) !== (c.ctax || 0) || Number(d.tariff ?? c.tariff ?? 0) !== (c.tariff || 0) || Number(d.rate ?? c.rate) !== c.rate || Number(d.deficit ?? c.deficit ?? 0) !== (c.deficit || 0) ? FISCAL_COST : 0; }
    const extra = act === 'decide' ? this.decisionOpt(d)?.pc || 0 : 0;
    const target = act === 'grant' || act === 'decide' ? Number(d.sys) : this.cmdTarget(act, d);
    if (target === undefined || target === null || target === this.cap || Number.isNaN(target)) return extra;
    const c = pcCostOf(this.lightDelay(target));
    return extra + (this.isDirect(target) ? Math.max(1, Math.ceil(c / 2)) : c);
  }
  // 政治力の年あたりの増減の内訳
  pcIncome() {
    const parts = [['基本', PC_BASE]];
    const n = this.realmSystems(this.cap).length;
    if (n >= 10) parts.push(['国の大きさ (10星系ごとに +1)', Math.floor(n / 10)]);
    const c = Math.round((this.council - 50) / 10);
    if (c) parts.push(['議会の支持', c]);
    const tp = this.modsOf(this.cap).pc;
    if (tp) parts.push(['種族の特性 (賢明)', tp]);
    if (this.era?.bonus) parts.push(['前の時代の課題', 2 * this.era.bonus]);
    const d = this.directCount();
    if (d) parts.push([`直轄の維持 (${d} 星系)`, -DIRECT_UPKEEP * d]);
    return { parts, total: parts.reduce((k, [, v]) => k + v, 0) };
  }
  pcYearly() {
    this.pcLast = this.pcIncome().total;
    this.pc = clamp(this.pc + this.pcLast, 0, PC_CAP);
  }
  // 主人の関与 (指令・援助・艦隊・視察・回答) が届いた: 放っておかれた年数が0に戻る
  attend(id) { if (!this.isHuman(id) && this.govs[id]) this.govs[id].attended = this.year; }
  neglectOf(gv) { return Math.max(0, this.year - (gv.attended ?? gv.founded ?? this.year)); }
