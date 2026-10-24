  // 他の星系に駐留する全艦をこの星系へ集める
  // --- 採掘基地 ---
  outpostAt(sysId, bodyId) { return this.outposts.find((o) => o.sys === sysId && o.body === bodyId); }
  outpostCost(o) { const k = GM.pow(2, (o ? o.lv : 0)); return { credits: 200 * k, metal: 100 * k }; }
  outpostYield(o) {
    const b = this.target(o.sys, o.body);
    return Object.fromEntries(outpostRes(b).map((r) => [r, (this.productivity || 1) * STRUCTURE.modern * this.techA(o.sys, 'mine') * YIELD.mine * OUTPOST_RATE * (b.deposits?.[r] || 0) * o.lv]));
  }
  outpostCheck(sysId, bodyId) {
    const b = this.target(sysId, bodyId);
    const res = outpostRes(b);
    if (!res.length) return fail('採掘できる天体ではない');
    if (!res.some((r) => b.deposits?.[r] > 0.05)) return fail('採掘できる資源がない');
    if (!this.isColonized(sysId)) return fail('同じ星系に入植地が必要');
    if (this.colonyAt(sysId, bodyId, 'planet')) return fail('入植地が採掘している');
    if (this.pending((j) => j.type === 'outpost' && j.sys === sysId && j.body === bodyId)) return fail('建設中');
    if ((this.outpostAt(sysId, bodyId)?.lv || 0) >= 10) return fail('最大レベル');
    return { ok: true };
  }
  buildOutpost(sysId, bodyId, prefix = '') {
    const c = this.outpostCheck(sysId, bodyId);
    if (!c.ok) return c;
    const o = this.outpostAt(sysId, bodyId);
    const label = `${prefix}${this.target(sysId, bodyId).name} の採掘基地 ${o ? `Lv${o.lv + 1}` : '建設'}`;
    return this.order(this.outpostCost(o), sysId, { type: 'outpost', body: bodyId, label });
  }

  // --- 自動開発 ---
  // 自動開発を有効にした星系では、年に1回、生産が需要に届かない資源を1つ選んで手を打つ:
  // 採掘資源なら星系内で最も埋蔵量の多い天体の採掘基地 (なければ入植地の鉱山)、食料は農場、工業品は工場。
  // クレジットは費用の2倍以上あるときだけ使う。
  autoDevelop() {
    // 太陽系 (プレイヤー) は自動開発をオンにしたときだけ。他の星系の政府はいつも自分の資金で開発する
    for (const id of this.colonizedSystems().map((x) => x.id).filter((k) => !this.isHuman(k) || this.auto[k])) {
      const fl = this.flow[id];
      if (!fl || !this.isColonized(id)) continue;
      // 自動の発注は1星系あたり同時に2件まで (資材の到着を待たずに積み上げない)
      if (this.projects.filter((j) => j.sys === id && j.label.startsWith('[自動]')).length >= 2) continue;
      const sys = this.system(id);
      const short = RES.map((r) => ({ r, gap: fl.cons[r] - fl.prod[r] }))
        .filter((x) => x.gap > 1e-6)
        .sort((a, b) => b.gap * PRICE[b.r] - a.gap * PRICE[a.r]);
      const cols = this.coloniesIn(id).sort((a, b) => b.pop - a.pop);
      const tag = `[自動] `;
      const tryOrder = (cost, run) => (cost && this.funds(id) >= 2 * (cost.credits || 0) && !this.procure(cost, id).why ? run() : null);
      for (const { r } of short) {
        let done = null;
        if (r === 'food' || r === 'goods' || r === 'hitech') { // 高付加価値物品も工場で (回 KE5)
          const fac = r === 'food' ? 'farm' : 'factory';
          const c = cols.find((x) => x.lv[fac] < FACILITY_MAX[fac] && !this.pending((j) => j.type === 'upgrade' && j.col === colKey(x) && j.fac === fac));
          if (c) done = tryOrder(this.upgradeCost(c, fac), () => this.order(this.upgradeCost(c, fac), c.sys, { type: 'upgrade', col: colKey(c), fac, label: `${tag}${c.name} の${FACILITY[fac]} Lv${c.lv[fac] + 1}` }));
        } else {
          const bodies = sys.bodies.filter((b) => outpostRes(b).includes(r) && (b.deposits?.[r] || 0) > 0.05 && this.outpostCheck(id, b.id).ok)
            .sort((a, b) => b.deposits[r] - a.deposits[r]);
          if (bodies.length) {
            done = tryOrder(this.outpostCost(this.outpostAt(id, bodies[0].id)), () => this.buildOutpost(id, bodies[0].id, tag));
          } else {
            const c = cols.filter((x) => (this.target(x.sys, x.body).deposits?.[r] || 0) > 0.05 && x.lv.mine < FACILITY_MAX.mine
              && !this.pending((j) => j.type === 'upgrade' && j.col === colKey(x) && j.fac === 'mine'))[0];
            if (c) done = tryOrder(this.upgradeCost(c, 'mine'), () => this.order(this.upgradeCost(c, 'mine'), c.sys, { type: 'upgrade', col: colKey(c), fac: 'mine', label: `${tag}${c.name} の鉱山 Lv${c.lv.mine + 1}` }));
          }
        }
        if (done?.ok) break;
      }
    }
  }

  // --- 星系政府の判断 (太陽系以外) ---
  // 交易路: 交易路が3本未満なら、まだ直接結んでいない近くの入植星系 (12光年以内) へ1本引く。
  //   交易路が1本もなければ距離に関係なく最寄りへ。資金が費用の1.5倍以上あるとき、年1本まで
  // 入植: canColonize (人口300万以上、10年に1回まで) のとき、colonyTarget (ふだん10光年以内) へ
  //   (同意が要る文明の惑星は避ける)。資金が入植船の費用の1.2倍以上あるとき。星系内の開発より優先する
  // 星系の政府が決めたことを覚える (政治の govDid。総督の手紙の「なぜ」。回 SE4 からの頼み)。見送ったことなど毎年くり返すものは、覚えている中に同じものがあれば足さない
  govDidOnce(id, what, why) { if (!this.govs[id]?.did?.some((d) => d.what === what)) this.govDid(id, what, why); }
  govsYearly() {
    for (const s of this.colonizedSystems()) {
      const id = s.id;
      if (this.isHuman(id) && !this.spectate) continue; // 地球政府はプレイヤー (観戦モードでは自動で動く)
      const gv = this.gov(id);
      if (gv.direct) continue; // 直轄の星系は地球が動かす
      const mine = this.routes.filter((r) => r.a === id || r.b === id);
      if (mine.length < 3) {
        const near = this.colonizedSystems()
          .filter((o) => o.id !== id && !this.routeBetween(o.id, id) && !this.tradeBlocked(id, o.id))
          .map((o) => ({ o, d: distance(o, s) }))
          .filter((x) => !mine.length || x.d <= 12)
          .sort((a, b) => a.d - b.d)[0];
        if (near) {
          const cost = this.routeCost(id, near.o.id), name = this.system(near.o.id).name;
          if (this.funds(id) >= 1.5 * cost.credits) { if (this.openRoute(id, near.o.id).ok) this.govDidOnce(id, `${name} へ交易路を引いた`, `交易路が ${mine.length} 本で、3 本より少なかった`); }
          else this.govDidOnce(id, `${name} への交易路を見送った`, '資金が費用の 1.5 倍に届かなかった');
        }
      }
      if (!this.canColonize(id) || gv.mandate === 'develop') continue;
      const best = this.colonyTarget(id);
      if (!best) continue;
      const cost = this.shipCost(best.kind, id, best.t.id);
      const why = gv.mandate === 'expand' ? '委任方針「拡張」に従った' : '入植できる時期になり、資金があった';
      if (this.funds(id) < (gv.mandate === 'expand' ? 1 : 1.2) * cost.credits || this.procure(cost, id).why) { this.govDidOnce(id, `${best.t.name} への入植船を見送った`, '資金か資材が足りなかった'); continue; }
      if (this.dispatch(id, best.t.id, best.b.id, best.kind).ok) { gv.lastColony = this.year; this.govDid(id, `${best.t.name} へ入植船を出した`, why); }
    }
  }
  // 入植できる状態か: 人口300万以上、入植船を準備・航行中でなく、前の入植から10年 (観戦モードの地球政府は5年) たっている。
  // 委任方針が拡張なら6年。国家方針が拡張期なら −4年、整備期なら +5年 (最短3年)
  canColonize(id) {
    const gv = this.gov(id);
    const pop = this.coloniesIn(id).reduce((k, c) => k + c.pop, 0);
    const busy = this.projects.some((j) => j.type === 'ship' && j.sys === id) || this.ships.some((x) => x.from === id);
    const pol = this.policyAt(id);
    const wait = Math.max(3, (this.isHuman(id) || this.nationOf(id) ? 5 : gv.mandate === 'expand' ? 6 : 10) + (pol === 'expand' ? -4 : pol === 'consolidate' ? 5 : 0));
    return pop >= 3 && !busy && this.year - (gv.lastColony ?? gv.founded) >= wait;
  }
  // 入植先: 未入植で入植できる惑星のうち、適性が高く近いところ。ふだんは10光年以内 (観戦モードの地球政府は20)、
  // 星系内に手の届く建設がなくなった政府 (far) は25光年まで探す。
  // 住める惑星のない星系も、主星を回る宇宙ステーションで押さえる (適性1の惑星より6光年ぶん近いときだけ選ぶ)
  colonyTarget(id) {
    const range = this.isHuman(id) || this.nationOf(id) ? 20 : this.gov(id).far ? 25 : this.gov(id).mandate === 'expand' ? 15 : 10;
    let best = null;
    for (const [tid, d] of this.nearSystems(id)) {
      if (d > range || tid === id || this.isColonized(tid)) continue;
      const t = this.system(tid);
      for (const b of t.bodies) {
        const grade = b.settle?.grade || 0;
        if (grade < 1 || !this.check(t.id, b.id, 'planet').ok) continue;
        const score = grade * 10 - d;
        if (!best || score > best.score) best = { t, b, kind: 'planet', score };
      }
      const st = t.stars[0];
      if ((!best || 4 - d > best.score) && this.check(t.id, st.id, 'station').ok) best = { t, b: st, kind: 'station', score: 4 - d };
    }
    return best;
  }
  // 使い道のない奴隷 [人/年]: 自分の星系と交易路でつながった星系の、奴隷の生産 − 需要の合計
  slaveSurplus(id) {
    const r = this.reach(id);
    const ids = [id, ...(r.ids ??= Object.keys(r.dist).map(Number)).filter((x) => x !== id)];
    return ids.reduce((k, x) => k + (this.flow[x]?.prod.slaves || 0) - (this.flow[x]?.cons.slaves || 0), 0);
  }
  // 星系政府の開発 (年1回、入植の判断のあと): 他の星系には建設を頼まず、自分の星系の中だけで建てる。
  // 1) 近くに入植先があれば、その入植船の費用 (1.2倍) を取っておく (入植を優先)
  // 2) 残りの資金で、星系内の施設 (農場・鉱山・工場、過密なら居住区) と採掘基地を積極的に建て増す。いちばん安いものから年1件
  //    (資金が取り置きのほかに費用の1.5倍以上あるとき)
  // 3) 手の届く建設がなくなったら (最も安いものでも収入の15年分を超える、またはすべて最大) far になり、
  //    忠誠度85未満の従属星系があれば最も低いところへ資金援助を送り、なければ遠くの星系 (25光年まで) への入植を目指す
  govDevelopYearly() {
    for (const s of this.colonizedSystems()) {
      const id = s.id;
      if (this.isHuman(id) && !this.spectate) continue;
      const gv = this.gov(id);
      if (gv.direct) continue; // 直轄の星系は地球が動かす
      if (this.projects.filter((j) => j.sys === id && j.label.startsWith('[自動]')).length >= 3) continue;
      const target = this.canColonize(id) && gv.mandate !== 'develop' ? this.colonyTarget(id) : null;
      const reserve = target ? 1.2 * this.shipCost(target.kind, id, target.t.id).credits : 0;
      const tag = '[自動] ';
      const cands = [];
      for (const c of this.coloniesIn(id)) {
        const ck = colKey(c);
        for (const fac of ['farm', 'mine', 'factory', 'habitat', 'slaveworks']) {
          if (c.lv[fac] >= FACILITY_MAX[fac] || this.pending((j) => j.type === 'upgrade' && j.col === ck && j.fac === fac)) continue;
          if (fac === 'habitat' && c.pop < 0.6 * this.capOf(c)) continue;
          if (fac === 'mine' && c.kind === 'station') continue;
          // 奴隷工房は、自分の星系か交易路でつながった星系に、使い道のない奴隷 (生産 − 需要) がもう1工房ぶんあるときだけ
          if (fac === 'slaveworks' && this.slaveSurplus(id) < SLAVEWORKS_USE) continue;
          const cost = this.upgradeCost(c, fac);
          cands.push({ cost, w: fac === 'slaveworks' ? 0.5 : 1, what: `${c.name} の${FACILITY[fac]} Lv${c.lv[fac] + 1}`, run: () => this.order(cost, id, { type: 'upgrade', col: colKey(c), fac, label: `${tag}${c.name} の${FACILITY[fac]} Lv${c.lv[fac] + 1}` }) });
        }
      }
      // 採掘基地は施設より高くつくが産出も大きいので、費用を割り引いて比べる (新設はさらに優先)
      for (const b of s.bodies) {
        if (!this.outpostCheck(id, b.id).ok) continue;
        const o = this.outpostAt(id, b.id);
        const cost = this.outpostCost(o);
        cands.push({ cost, w: o ? 0.5 : 0.3, what: `${b.name || '天体'} の採掘基地${o ? 'の拡張' : ''}`, run: () => this.buildOutpost(id, b.id, tag) });
      }
      cands.sort((a, b) => a.cost.credits * a.w - b.cost.credits * b.w);
      const cheapest = cands[0];
      gv.far = !cheapest || cheapest.cost.credits > 15 * Math.max(10, this.income(id));
      if (!gv.far) {
        if (this.funds(id) >= reserve + (gv.mandate === 'develop' ? 1.2 : 1.5) * cheapest.cost.credits && !this.procure(cheapest.cost, id).why) { cheapest.run(); this.govDid(id, `${cheapest.what}を建て始めた`, '手の届く建設のうち、いちばん安かった'); }
        else if (reserve) this.govDidOnce(id, `${cheapest.what}を見送った`, '入植船の費用を取り置いた');
        continue;
      }
      const vassals = Object.entries(this.govs)
        .filter(([k, v]) => v.lord === id && this.isColonized(Number(k)) && this.realmOf(Number(k)) === this.realmOf(id) && (v.loyalty ?? LOYALTY_START) < 85)
        .sort((a, b) => (a[1].loyalty ?? LOYALTY_START) - (b[1].loyalty ?? LOYALTY_START));
      const spare = gv.credits - reserve;
      if (vassals.length && spare > 100) { this.sendGrant(id, Number(vassals[0][0]), Math.min(500, 0.2 * spare)); this.govDidOnce(id, `家臣の ${this.system(Number(vassals[0][0])).name} へ資金援助を送った`, '星系の中に手の届く建設がなく、忠誠度の低い家臣がいた'); }
    }
  }
  // 星系内の拡張: 人口が2百万人以上で資金に余裕 (費用の2倍) のある星系の政府は、自分の星系の空いている天体や恒星
  // (入植地も先住民もいない) に宇宙ステーションを建てる。10年に1つまで。資源の埋蔵が多い天体ほど優先し、恒星はそのあと。
  // 星系内なので入植船はすぐ着く。太陽系は自動開発がオンのときだけ
  stationsYearly() {
    for (const s of this.colonizedSystems()) {
      const id = s.id;
      if (this.isHuman(id) && !this.auto[id]) continue;
      const gv = this.gov(id);
      if (gv.direct) continue;
      if (this.year - (gv.lastStation ?? gv.founded ?? -1e9) < 10) continue;
      if (this.coloniesIn(id).reduce((k, c) => k + c.pop, 0) < 2) continue;
      if (this.projects.some((j) => j.type === 'ship' && j.sys === id && j.to === id) || this.ships.some((x) => x.from === id && x.to === id)) continue;
      const score = (b) => Object.values(b.deposits || {}).reduce((k, v) => k + v, 0) + (b.type === 'gas' ? 0.5 : 0) - (b.cls ? 0.01 : 0);
      const free = this.targetsOf(s)
        .filter((b) => !this.colonies.some((c) => c.sys === id && c.body === b.id) && !b.natives && this.check(id, b.id, 'station').ok)
        .sort((a, b) => score(b) - score(a));
      if (!free.length) continue;
      const cost = this.shipCost('station', id, id);
      if (this.funds(id) < 2 * cost.credits || this.procure(cost, id).why) continue;
      if (this.dispatch(id, id, free[0].id, 'station').ok) gv.lastStation = this.year;
    }
  }
