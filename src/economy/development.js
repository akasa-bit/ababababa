  // 他の星系に駐留する全艦をこの星系へ集める
  // --- 採掘基地 ---
  outpostAt(sysId, bodyId) { return this.outposts.find((o) => o.sys === sysId && o.body === bodyId); }
  outpostCost(o, sys = o?.sys) { const k = GM.pow(2, (o ? o.lv : 0)) * (sys === undefined ? 1 : this.modsOf(sys).outpost); return { credits: 200 * k, metal: 100 * k }; } // 鉱夫は ×0.5 (回 SE8)
  outpostYield(o) {
    const b = this.target(o.sys, o.body);
    return Object.fromEntries(outpostRes(b).map((r) => [r, (this.productivity || 1) * STRUCTURE.modern * this.techA(o.sys, 'mine') * YIELD.mine * OUTPOST_RATE * (b.deposits?.[r] || 0) * o.lv]));
  }
  // --- 民間の採掘の能力 (INVEST。回 KE5) ---
  capacityAt(sysId, bodyId) { return this.capacity.find((k) => k.sys === sysId && k.body === bodyId); }
  capacityYield(k) { return this.outpostYield({ sys: k.sys, body: k.body, lv: k.k }); }
  // 年 1 回 (autoDevelop の始め): 能力が古くなり、会社が足りない資源の能力を買い足す (INVEST の説明)
  capacityYearly() {
    for (const k of this.capacity) k.k *= 1 - CAPITAL.delta;
    this.capacity = this.capacity.filter((k) => k.k > 1e-6 && this.isColonized(k.sys));
    if (!MARKET.buy) return;
    for (const s of this.colonizedSystems()) {
      const id = s.id, fl = this.flow[id], m = this.market[id], K = this.util?.[id];
      if (!fl || !m || !K) continue;
      const pr = (r) => this.price(id, r) / basePrice(r), gap = (r) => (pr(r) > 1 + INVEST.margin ? Math.max(0, m.u[r] - fl.prod[r]) : 0);
      const ind = { fuel: 0.2 * gap('goods'), metal: 0.5 * gap('goods'), rare: HITECH.rare * gap('hitech') }; // 地元の工業が動いたら要る原料
      const pipe = zeroRes(); // 建設中の能力の年の産出
      for (const j of this.projects) if (j.type === 'capacity' && j.sys === id) for (const [r, v] of Object.entries(this.capacityYield({ sys: id, body: j.body, k: j.k }))) pipe[r] += v;
      for (const r of INVEST.res) {
        if (pr(r) < 1 + INVEST.margin || K[r] < 0.99) continue; // 値段がふつう、か、いまの設備に余りがある
        const short = m.u[r] + ind[r] - fl.prod[r] - pipe[r];
        if (!(short > 1e-3)) continue;
        const b = this.system(id).bodies.filter((x) => outpostRes(x).includes(r) && (x.deposits?.[r] || 0) > 0.05 && this.outpostCheck(id, x.id).ok)
          .sort((x, y) => y.deposits[r] - x.deposits[r])[0];
        if (!b) continue; // 掘れる天体がなければ取り寄せる
        const q = INVEST.speed * short, y1 = this.capacityYield({ sys: id, body: b.id, k: 1 })[r];
        if (!(y1 > 0)) continue;
        this.order({ credits: INVEST.ky * q * basePrice(r) }, id, { type: 'capacity', body: b.id, k: q / y1, pay: { fm: id }, delay: INVEST.build, label: JA`${b.name} の民間の採掘` });
      }
    }
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
    const label = JA`${prefix}${this.target(sysId, bodyId).name} の採掘基地 ${o ? `Lv${o.lv + 1}` : '建設'}`;
    return this.order(this.outpostCost(o, sysId), sysId, { type: 'outpost', body: bodyId, label });
  }

  // --- 自動開発 ---
  // 自動開発を有効にした星系では、年に1回、生産が需要に届かない資源を1つ選んで手を打つ:
  // 採掘資源なら星系内で最も埋蔵量の多い天体の採掘基地 (なければ入植地の鉱山)、食料は農場、工業品は工場。
  // クレジットは費用の2倍以上あるときだけ使う。
  // 年 1 回: 遠くの持ち分が、資本の入れ替わりの速さ (delta + 地元の実質の所得の伸び) で目標に近づく。目標 = OWNER.fdi × ほかの国の重みの割合
  // (重み = 国の大きさ × 1 人あたりの所得の OWNER.out 乗。その国の首都の家計が持つ)。
  // 持ち主がいなくなった分は地元へ (OWNER。回 KE5)
  // 回 KE9 (B-011): 国有の分 (gv.soe) は目標の外 (残りの民間の分の中でほかの国が持つ)。資本規制 (人間の国の capctl) は、国の星系のほかの国の持ち分の目標と、
  // 国が外へ出す重みを (1 − capctl) 倍にする
  ownYearly() {
    const Y = {}, N = {}, ys = {};
    for (const c of this.colonies) { const v = c.pop * (c.incU ?? c.inc ?? 0), r = this.realmOf(c.sys); Y[r] = (Y[r] || 0) + v; N[r] = (N[r] || 0) + c.pop; ys[c.sys] = (ys[c.sys] || 0) + v; } // 実質の所得 (ならしたもの)
    const W = {}, cc = (r) => (this.isHuman(r) && !this.spectate ? this.fiscalFor(r, r).capctl || 0 : 0); // 資本規制 (国の首都で効いている値)
    for (const [r, v] of Object.entries(Y)) if (v > 0 && N[r] > 0) W[r] = v * GM.pow(v / N[r], OWNER.out) * (1 - cc(Number(r))); // 出す国の重み
    const tot = Object.values(W).reduce((k, v) => k + v, 0);
    for (const [k, gv] of Object.entries(this.govs)) {
      const id = Number(k), y = ys[id] || 0;
      const first = gv.ownY === undefined && !gv.own; // 始めからある星系 (と前の版のセーブ): 2300 年の世界にはもう直接投資があるとみて、目標の持ち分で始める
      const g = gv.ownY > 0 && y > 0 ? clamp(GM.log(y / gv.ownY), 0, OWNER.gmax) : 0;
      gv.ownY = y;
      if (!this.isColonized(id)) { delete gv.own; continue; }
      const me = this.realmOf(id), rest = tot - (W[me] || 0), T = {};
      const open = (1 - (gv.soe || 0)) * (1 - cc(me)); // 国有の分と資本規制の分は、ほかの国が持てない
      if (rest > 0) for (const [r, v] of Object.entries(W)) if (Number(r) !== me) T[r] = (OWNER.fdi * v * open) / rest;
      const own = (gv.own ??= {}), q = first ? 0 : GM.exp(-(CAPITAL.delta + g));
      for (const r of Object.keys(T)) own[r] ??= 0;
      for (const o of Object.keys(own)) {
        own[o] = (T[o] || 0) + (own[o] - (T[o] || 0)) * q;
        if (own[o] < OWNER.min || !this.isColonized(Number(o))) delete own[o];
      }
      if (!Object.keys(own).length) delete gv.own;
    }
  }
  // 国有化と民営化 (回 KE9・B-011。毎刻み。人間の国の星系だけ): その星系で効いている財政の国有の割合 soe に、政府の持ち分 gv.soe をそろえる。
  // 上げる分は、民間の持ち主 (地元の家計と遠くの持ち主) から持ち分に比べて買い取り、割合の差 × 会社の資本 gv.K を国債で払う (遠くの持ち主へは光速で送る)。
  // 下げる分は、地元の家計に同じ値で売る (政府の資金に入る)。どちらも国のすべての純資産は変わらない (物の値打ちと同じ額のお金が入れ替わるだけ)
  soeStep() {
    if (this.spectate) return;
    for (const key of Object.keys(this.govs)) {
      const id = Number(key), gv = this.govs[key];
      if (!this.isColonized(id)) continue;
      const root = this.realmOf(id);
      if (!this.isHuman(root)) continue;
      const want = this.fiscalFor(root, id).soe || 0, cur = gv.soe || 0, d = want - cur, K = Math.max(0, gv.K || 0);
      if (Math.abs(d) < 1e-9) continue;
      if (d > 0) {
        const k = d / (1 - cur), own = gv.own || {}, local = 1 - cur - Object.values(own).reduce((a, s) => a + s, 0);
        const pay = [];
        for (const o of Object.keys(own)) { pay.push([Number(o), own[o] * k * K]); own[o] *= 1 - k; if (own[o] < OWNER.min) delete own[o]; }
        const C = local * k * K + pay.reduce((a, [, x]) => a + x, 0);
        this.bondMove('nationalize', C, id); // 補償は国債で (銀行が国債を買い、持ち主の預金を作る)
        if (local * k * K > 0) this.cash('nationalize', local * k * K, { hh: id });
        for (const [o, x] of pay) this.sendCapital(id, o, x, 'nationalize');
      } else {
        const x = -d * K;
        if (x > 0) { this.cash('privatize', -x, { hh: id }); this.cash('privatize', x, { gov: id }); }
      }
      if (want > 0) gv.soe = want; else delete gv.soe;
    }
  }
  autoDevelop() {
    this.capacityYearly(); // 民間の採掘の能力 (回 KE5)
    this.ownYearly(); // 遠くの持ち主 (回 KE5)
    this.eachPlayer(() => this.chronYearly()); // 財政のグラフの記録 (回 GA9・B-059)
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
      const tag = JA`[自動] `;
      const tryOrder = (cost, run) => (cost && this.funds(id) >= 2 * (cost.credits || 0) && !this.procure(cost, id).why ? run() : null);
      for (const { r } of short) {
        let done = null;
        if (r === 'food' || r === 'goods' || r === 'hitech') { // 高付加価値物品も工場で (回 KE5)
          const fac = r === 'food' ? 'farm' : 'factory';
          const c = cols.find((x) => x.lv[fac] < FACILITY_MAX[fac] && !this.pending((j) => j.type === 'upgrade' && j.col === colKey(x) && j.fac === fac));
          if (c) done = tryOrder(this.upgradeCost(c, fac), () => this.order(this.upgradeCost(c, fac), c.sys, { type: 'upgrade', col: colKey(c), fac, label: JA`${tag}${c.name} の${FACILITY[fac]} Lv${c.lv[fac] + 1}` }));
        } else {
          const bodies = sys.bodies.filter((b) => outpostRes(b).includes(r) && (b.deposits?.[r] || 0) > 0.05 && this.outpostCheck(id, b.id).ok)
            .sort((a, b) => b.deposits[r] - a.deposits[r]);
          if (bodies.length) {
            done = tryOrder(this.outpostCost(this.outpostAt(id, bodies[0].id), id), () => this.buildOutpost(id, bodies[0].id, tag));
          } else {
            const c = cols.filter((x) => (this.target(x.sys, x.body).deposits?.[r] || 0) > 0.05 && x.lv.mine < FACILITY_MAX.mine
              && !this.pending((j) => j.type === 'upgrade' && j.col === colKey(x) && j.fac === 'mine'))[0];
            if (c) done = tryOrder(this.upgradeCost(c, 'mine'), () => this.order(this.upgradeCost(c, 'mine'), c.sys, { type: 'upgrade', col: colKey(c), fac: 'mine', label: JA`${tag}${c.name} の鉱山 Lv${c.lv.mine + 1}` }));
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
          if (this.funds(id) >= 1.5 * cost.credits) { if (this.openRoute(id, near.o.id).ok) this.govDidOnce(id, JA`${name} へ交易路を引いた`, JA`交易路が ${mine.length} 本で、3 本より少なかった`); }
          else this.govDidOnce(id, JA`${name} への交易路を見送った`, '資金が費用の 1.5 倍に届かなかった');
        }
      }
      if (!this.canColonize(id) || gv.mandate === 'develop') continue;
      const best = this.colonyTarget(id);
      if (!best) continue;
      const cost = this.shipCost(best.kind, id, best.t.id);
      const why = gv.mandate === 'expand' ? '委任方針「拡張」に従った' : '入植できる時期になり、資金があった';
      if (this.funds(id) < (gv.mandate === 'expand' ? 1 : 1.2) * cost.credits || this.procure(cost, id).why) { this.govDidOnce(id, JA`${best.t.name} への入植船を見送った`, '資金か資材が足りなかった'); continue; }
      if (this.dispatch(id, best.t.id, best.b.id, best.kind).ok) { gv.lastColony = this.year; this.govDid(id, JA`${best.t.name} へ入植船を出した`, why); }
    }
  }
  // 入植できる状態か: 人口300万以上、入植船を準備・航行中でなく、前の入植から10年 (観戦モードの地球政府は5年) たっている。
  // 委任方針が拡張なら6年。国家方針が拡張期なら −4年、整備期なら +5年 (最短3年)
  canColonize(id) {
    const gv = this.gov(id);
    const pop = this.coloniesIn(id).reduce((k, c) => k + c.pop, 0);
    const ai = this.aiColonize(id);
    const busy = this.projects.some((j) => j.type === 'ship' && j.sys === id) || this.ships.filter((x) => x.from === id).length >= ai.ships + this.modsOf(id).colonyShips; // 多産は 1 隻多く (回 SE8)
    const pol = this.policyAt(id);
    const wait = Math.max(3, (this.isHuman(id) || this.nationOf(id) ? 5 : gv.mandate === 'expand' ? 6 : 10) + (pol === 'expand' ? -4 : pol === 'consolidate' ? 5 : 0));
    return pop >= ai.pop * this.modsOf(id).colonizePop && !busy && this.year - (gv.lastColony ?? gv.founded) >= wait; // 多産は 3 分の 1 の人口から (回 SE8)
  }
  // 入植を急ぐか (ゲーム性の補正。台帳の C20。回 SE5・B-028。政治のレーンが足した): AI の国の星系の政府は、入植船を同時に ships 隻まで飛ばし、人口 pop 百万人から、
  // range 倍の光年まで入植先を探す。人間の国の星系の政府 (と補正なし) は、前のまま 1 隻ずつ・300 万人から・ふだん 10 光年
  aiColonize(id) {
    const a = ED.aiColonize;
    return a && !this.isHuman(this.realmOf(id)) ? a : { ships: 1, pop: 3, range: 1 };
  }
  // 入植先: 未入植で入植できる惑星のうち、適性が高く近いところ。ふだんは10光年以内 (観戦モードの地球政府は20)、
  // 星系内に手の届く建設がなくなった政府 (far) は25光年まで探す。
  // 住める惑星のない星系も、主星を回る宇宙ステーションで押さえる (適性1の惑星より6光年ぶん近いときだけ選ぶ)
  colonyTarget(id) {
    const range = (this.isHuman(id) || this.nationOf(id) ? 20 : this.gov(id).far ? 25 : this.gov(id).mandate === 'expand' ? 15 : 10) * this.aiColonize(id).range; // 探すのは 25 光年まで (nearSystems)
    let best = null;
    const many = this.aiColonize(id).ships + this.modsOf(id).colonyShips > 1; // 何隻も飛ばすときは、入植船が向かっている星系を外す (C20。多産も)
    for (const [tid, d] of this.nearSystems(id)) {
      if (d > range || tid === id || this.isColonized(tid) || (many && this.ships.some((x) => x.to === tid))) continue;
      const t = this.system(tid);
      for (const b of t.bodies) {
        const grade = b.settle?.grade || 0;
        if (grade < 1 || !this.check(t.id, b.id, 'planet', id).ok) continue;
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
    this.ineqYearly(); // 星系の所得の素の偏りを決める (回 KE11・B-127。incidence.js)
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
          cands.push({ cost, w: fac === 'slaveworks' ? 0.5 : 1, what: JA`${c.name} の${FACILITY[fac]} Lv${c.lv[fac] + 1}`, run: () => this.order(cost, id, { type: 'upgrade', col: colKey(c), fac, label: JA`${tag}${c.name} の${FACILITY[fac]} Lv${c.lv[fac] + 1}` }) });
        }
      }
      // 採掘基地は施設より高くつくが産出も大きいので、費用を割り引いて比べる (新設はさらに優先)
      for (const b of s.bodies) {
        if (!this.outpostCheck(id, b.id).ok) continue;
        const o = this.outpostAt(id, b.id);
        const cost = this.outpostCost(o, id);
        cands.push({ cost, w: o ? 0.5 : 0.3, what: JA`${b.name || '天体'} の採掘基地${o ? 'の拡張' : ''}`, run: () => this.buildOutpost(id, b.id, tag) });
      }
      cands.sort((a, b) => a.cost.credits * a.w - b.cost.credits * b.w);
      const cheapest = cands[0];
      gv.far = !cheapest || cheapest.cost.credits > 15 * Math.max(10, this.income(id));
      if (!gv.far) {
        if (this.funds(id) >= reserve + (gv.mandate === 'develop' ? 1.2 : 1.5) * cheapest.cost.credits && !this.procure(cheapest.cost, id).why) { cheapest.run(); this.govDid(id, JA`${cheapest.what}を建て始めた`, '手の届く建設のうち、いちばん安かった'); }
        else if (reserve) this.govDidOnce(id, JA`${cheapest.what}を見送った`, '入植船の費用を取り置いた');
        continue;
      }
      const vassals = Object.entries(this.govs)
        .filter(([k, v]) => v.lord === id && this.isColonized(Number(k)) && this.realmOf(Number(k)) === this.realmOf(id) && (v.loyalty ?? LOYALTY_START) < 85)
        .sort((a, b) => (a[1].loyalty ?? LOYALTY_START) - (b[1].loyalty ?? LOYALTY_START));
      const spare = gv.credits - reserve;
      if (vassals.length && spare > 100) { this.sendGrant(id, Number(vassals[0][0]), Math.min(500, 0.2 * spare)); this.govDidOnce(id, JA`家臣の ${this.system(Number(vassals[0][0])).name} へ資金援助を送った`, '星系の中に手の届く建設がなく、忠誠度の低い家臣がいた'); }
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
