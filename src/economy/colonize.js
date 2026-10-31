  // --- 調査と先住民 ---
  // 先住民が分かるのは、接触 (入植地か艦隊・入植船が到達したとき) の知らせが光速で届いてから。ただし情報時代の先住民 (tech 3) は電波を出しているので、
  // 接触の前から分かる (回 KE3・B-170。前は、どの先住民も天体観測で入植前から分かるとしていた: docs/research/game-physics-audit.md の 2.8 k。
  // 石器時代の文明を数十光年先の望遠鏡で見分けるのは無理)。viewer = 見ている星系 (既定は、いま操作しているプレイヤーの首都)
  isSurveyed(sysId, viewer = this.cap) {
    if (this.spectate || this.system(sysId)?.bodies.some((b) => b.natives?.tech >= 3)) return true;
    const at = this.surveyAt?.[sysId] ?? (this.contacted(sysId) ? -Infinity : undefined);
    return at !== undefined && at + this.sysDist(viewer, sysId) <= this.year;
  }
  contacted(sysId) { return this.surveyed.includes(sysId); }
  survey(sysId) {
    if (this.contacted(sysId)) return;
    this.surveyed.push(sysId);
    (this.surveyAt ??= {})[sysId] = this.year; // 接触した年 (知らせが光速で広がる。isSurveyed)
    for (const b of this.system(sysId).bodies) {
      if (b.natives) this.event('natives', sysId, JA`${b.name} で先住民「${b.natives.species}」(${TECH_LABEL[b.natives.tech]}) と接触した`);
    }
  }
  nativeOf(sysId, bodyId) {
    const def = this.target(sysId, bodyId)?.natives;
    if (!def) return null;
    const key = `${sysId}|${bodyId}`;
    if (!this.natives[key]) this.natives[key] = { rel: def.mood - this.infamy, status: 'independent', pop: def.pop };
    return { def, st: this.natives[key] };
  }
  // 制圧に必要な戦力(艦隊の数)
  nativeDefense(n) { return Math.max(1, Math.ceil(GM.pow((n.def.tech + 1), 2) * GM.log10(1 + n.st.pop))); }

  // --- 入植地 ---
  capOf(c) {
    if (c.kind === 'planet' && this.isHome(c.sys, c.body)) return 12000 * (1 + 0.25 * c.lv.habitat);
    if (c.kind === 'station') return 2 * (1 + c.lv.habitat);
    const b = this.target(c.sys, c.body);
    const m = this.modsOf(c.sys), grade = b.settle?.grade || 1;
    return [80, 80, 800, 4000][grade] * (grade <= 1 ? m.harsh : 1) * (1 + 0.5 * c.lv.habitat) * m.cap * (m.capBy[b.surface] || 1); // 適応力: 住みにくい惑星 (適性 1) ×3 (回 SE8)
  }
  surfaceOf(c) { return c.kind === 'planet' ? this.target(c.sys, c.body).surface : null; }
  fertility(c) { return { temperate: 1, ocean: 0.6 }[this.surfaceOf(c)] || 0; }
  needsWater(c) { return !this.fertility(c); } // 温暖・海洋の惑星以外は水を消費する

  // 入植可否と理由。惑星入植は適性≥1の固体天体のみ、ステーションは任意の天体の周回軌道に建設できる。
  check(sysId, bodyId, kind, from = this.cap) {
    const t = this.target(sysId, bodyId);
    if (!t) return fail('対象が存在しない');
    if (this.colonyAt(sysId, bodyId, kind)) return fail('建設済み');
    if (this.shipTo(sysId, bodyId, kind)) return fail('入植船が向かっている');
    if (this.projects.some((j) => j.type === 'ship' && j.to === sysId && j.body === bodyId && j.kind === kind)) return fail('入植船を準備中');
    if (kind === 'planet' && !(t.settle && t.settle.grade >= 1)) {
      return fail(t.settle ? t.settle.notes.join('、') || '入植に適さない' : '惑星ではない');
    }
    if (kind === 'planet' && this.modsOf(from).forbid.includes(t.surface)) return fail(JA`${this.speciesOfRealm(this.realmOf(from))}はこの型の惑星に住めない`); // 水棲・寒冷適応・乾燥適応 (回 SE8)
    if (kind === 'planet' && this.isSurveyed(sysId) && this.blockedByNatives(sysId, bodyId)) {
      return fail('最も進んだ未恒星間文明の惑星には同意が必要 (友好度40以上)');
    }
    return { ok: true, reason: '' };
  }
  // 入植に同意が要るのは、最も進んだ未恒星間文明 (情報時代) だけ。それ以外の文明の惑星には勝手に入植でき、
  // 友好度40未満なら到着と同時に征服戦争が始まる
  blockedByNatives(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    return !!n && n.st.status === 'independent' && n.st.rel < 40 && n.def.tech >= 3;
  }
  // 統一されていない先住民と戦争するかは、戦争方針 (友好度の基準) で自動的に決まる。基準未満なら戦争
  hostileNatives(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    return n && n.st.status === 'independent' && n.st.rel < this.warThreshold && n.def.tech < 3 ? n : null;
  }
  // 統一度: 最も進んだ未恒星間文明だけが統一された組織的な抵抗をする。それ以外は部族・国家に分かれていて、征服戦争は自動で進む
  nativeUnity(n) {
    const h = hashSeed(n.def.species) % 30;
    return n.def.tech >= 3 ? 70 + h : 5 + 10 * n.def.tech + Math.floor(h / 3);
  }
  // 入植船に同行させる歩兵の数: 征服戦争になりそうなら先住民の防衛力ぶん、そうでなければ1連隊
  escortNeed(toId, bodyId, kind) {
    if (kind !== 'planet') return 0;
    const n = this.isSurveyed(toId) ? this.hostileNatives(toId, bodyId) : null;
    return n ? this.nativeDefense(n) : 1;
  }

  // 支払い。資源は指定星系の備蓄から払う。
  // 地元の備蓄から買う資材の代金 (市場の値段。MARKET.buy = 0 なら 0)
  materialBill(cost, sysId) { return MARKET.buy && sysId !== undefined ? RES.reduce((k, r) => k + (cost[r] ? cost[r] * this.bulkPrice(sysId, r, cost[r]) : 0), 0) : 0; }
  lack(cost, sysId, payer = sysId ?? 0) {
    const bill = this.materialBill(cost, sysId);
    if ((cost.credits || 0) + bill > this.funds(payer)) return bill ? JA`クレジット不足 (資材の代金 ${Math.ceil(bill)} cr を含む)` : 'クレジット不足';
    if ((cost.energy || 0) > this.energyOf(payer)) return JA`エネルギー不足 (${fmtJ(Math.max(0, this.energyOf(payer)))}/${fmtJ(cost.energy)})`;
    const st = sysId === undefined ? null : this.stockOf(sysId);
    for (const r of RES) {
      if (cost[r] && (!st || st[r] < cost[r])) return JA`${RES_LABEL[r]}が不足 (${Math.floor(st ? st[r] : 0)}/${cost[r]})`;
    }
    return '';
  }
  pay(cost, sysId, payer = sysId ?? 0) {
    cost = this.aiCost(cost, payer);
    const why = this.lack(cost, sysId, payer);
    if (why) return fail(why);
    if (cost.credits) { this.cash('build', -cost.credits, { gov: payer }); this.cash('build', cost.credits, { hh: sysId ?? payer }); } // 建てる星系の家計が受け取る (賃金)
    const bill = this.materialBill(cost, sysId);
    if (bill) { this.cash('build', -bill, { gov: payer }); this.cash('build', bill, { fm: sysId }); } // 資材は、その星系の会社から市場の値段で買う
    this.invNote(sysId ?? payer, (cost.credits || 0) + (bill || 0)); // 投資に数える (回 KE6)
    if (cost.energy) this.bookE('build', -cost.energy, payer);
    for (const r of RES) if (cost[r]) this.mv(sysId, r, -cost[r], 'build');
    return { ok: true };
  }

  // 建設資材の調達計画。地元の備蓄で足りない分は、近い入植星系から順に取り寄せる。
  // 取り寄せ元には1年分の需要 (市場のある版は目標の在庫の厚さぶん) を残す。eta は最も遠い取り寄せ元からの搬入年数 (0 なら即時)。
  // 取り寄せる資材は買い取る (基準価格)。輸入費を払えなければ、主人の星系の備蓄だけから支援として無償で取り寄せる (従属が深まる)
  // funds: 払う人の手持ち (輸送船は造船所の星系で造り、ほかの星系の政府か会社が払う。会社は借りてよいので Infinity。回 KE5)。渡したときは主人の支援もない
  procure(cost, sysId, funds) {
    const p = this.procureFrom(cost, sysId, undefined, funds);
    if (!p.poor || funds !== undefined) return p;
    const lord = this.gov(sysId).lord;
    if (lord === null || lord === undefined) return { why: p.why };
    const a = this.procureFrom(cost, sysId, lord);
    return a.why ? { why: p.why } : { ...a, imp: 0, aid: a.imp };
  }
  procureFrom(cost, sysId, onlyFrom, funds = this.funds(sysId ?? 0)) {
    if ((cost.credits || 0) > funds) return { why: 'クレジット不足' };
    // エネルギー: 船の推進の分と、取り寄せる資材を交易路で減速させる分は受け手、加速させる分は取り寄せ元が払う
    const eHave = this.energyOf(sysId ?? 0) - (cost.energy || 0);
    if (eHave < 0) return { why: JA`エネルギー不足 (${fmtJ(Math.max(0, this.energyOf(sysId ?? 0)))}/${fmtJ(cost.energy)})` };
    const eUsed = new Map();
    let eIn = 0;
    const plan = [];
    let eta = 0;
    for (const r of RES) {
      let need = cost[r] || 0;
      if (!need) continue;
      if (sysId === undefined) return { why: JA`${RES_LABEL[r]}が不足` };
      const local = Math.min(Math.max(this.stockOf(sysId)[r], 0), need);
      if (local > 0) { plan.push({ from: sysId, r, amt: local, ...(MARKET.buy ? { price: this.bulkPrice(sysId, r, local) } : {}) }); need -= local; }
      if (need <= 1e-9) continue;
      // 資材輸送船は交易路しか通れないので、交易路でつながった星系からだけ取り寄せる
      const { dist } = this.reach(sysId);
      const sources = this.colonizedSystems()
        .filter((s) => s.id !== sysId && dist[s.id] !== undefined && !this.tradeBlocked(sysId, s.id) && (onlyFrom === undefined || s.id === onlyFrom))
        // 取り寄せ元に残す量: 前の版は 1 年分の需要。市場のある版は、目標の在庫の厚さぶん (それより多くは、値段で売る。bulkPrice)
        // 取り寄せ元は、光の遅れのぶん古い記録で余りが見える星系から選ぶ (回 KE3)。送れる量は、いまの在庫が上限 (取り寄せの注文が届くまでの遅れは、まだ入れていない)
        .map((s) => ({ id: s.id, t: dist[s.id], d: dist[s.id] + this.travelYears(sysId, s.id), spare: Math.min(this.spareSeen(sysId, s.id, r), this.stockOf(s.id)[r] - (this.flow[s.id]?.cons[r] || 0) * (MARKET.buy ? MARKET.cover[r] : 1)) }))
        .filter((x) => x.spare > 0)
        .sort((a, b) => a.d - b.d);
      for (const x of sources) {
        const eF = this.energyOf(x.id) - (eUsed.get(x.id) || 0), eT = eHave - eIn;
        const kg = RES_KG[r] / UNIT_KG; // 1 単位の質量 [100 万 t]
        const amt = Math.min(x.spare, need, this.routeRoom(x.id, sysId, eF, eT) / kg);
        if (amt <= 1e-9) continue;
        plan.push({ from: x.id, r, amt, price: this.tradePrice(x.id, r, x.t, this.rateAt(sysId), amt) }); // 売り手の値段に、航行の年数ぶんの利子を乗せた値段
        const both = eF >= amt * kg * E_UNIT && eT >= amt * kg * decUnit();
        eUsed.set(x.id, (eUsed.get(x.id) || 0) + amt * kg * (both ? E_UNIT : E_UNIT_FREE));
        if (both) eIn += amt * kg * decUnit();
        need -= amt;
        eta = Math.max(eta, x.d);
        if (need <= 1e-9) break;
      }
      if (need > 1e-6) {
        // 買えなかった注文も需要として値段に効かせる (受注残。足りない分を 1 年で満たしたい需要として、この刻みの需要に足す。同じ刻みの注文は大きいほうだけ)
        // 試合を進めているあいだ (advance の中) だけ記録する。画面がボタンを出すために確かめるときは記録しない (端末ごとに状態が変わらないように)
        if (MARKET.buy && onlyFrom === undefined && this.stepping) { const u = (this.unmet[sysId] ??= zeroRes()); u[r] = Math.max(u[r], need); }
        return { why: JA`${RES_LABEL[r]}が不足 (交易路でつながった星系を含めても足りない)` };
      }
    }
    const imp = plan.filter((x) => x.from !== sysId).reduce((k, x) => k + x.amt * x.price, 0);
    const local = plan.filter((x) => x.from === sysId).reduce((k, x) => k + x.amt * (x.price || 0), 0); // 地元で買う資材の代金 (MARKET.buy)
    if (onlyFrom === undefined && imp + local > 0 && (cost.credits || 0) + imp + local > funds) return { why: JA`資金不足 (資材の代金 ${Math.ceil(imp + local)} cr を含む)`, poor: true };
    return { why: '', eta, plan, imp };
  }
  // 建設を発注する。費用はその場で払い、資材が届いた時点で完成する。
  // ハンディキャップ: AI の国の建設費の倍率 (資金の分だけ)
  aiCost(cost, sysId) {
    if (!this.nations || this.isHuman(this.realmOf(sysId)) || !cost.credits) return cost;
    return { ...cost, credits: Math.round(cost.credits * HANDICAP[this.handicap].aiCost) };
  }
  // job.pay: 払う帳簿 ({ gov: 星系 } か { fm: 星系 })。ないときは建てる星系の政府。輸送船は造船所の星系 sysId で造り、交易路の持ち主が払う (回 KE5)。
  // job.delay: 完成してから使えるまでの年数 (造った輸送船が交易路まで飛ぶ)
  order(cost, sysId, job) {
    const payer = job.pay ?? { gov: sysId }, firm = payer.fm !== undefined;
    if (!firm) cost = this.aiCost(cost, payer.gov);
    const p = this.procure(cost, sysId, firm ? Infinity : payer.gov !== sysId ? this.funds(payer.gov) : undefined);
    if (p.why) return fail(p.why);
    const eta = Math.max(p.eta, job.delay || 0);
    // 支払いは建てる星系の民間へ。入植船の開拓資金は船が運び、着いた星系に渡す
    const seed = job.type === 'ship' ? SEED_FUNDS[job.kind] || 0 : 0;
    if (cost.credits) { this.cash('build', -cost.credits, payer); this.cash('build', cost.credits - seed, { hh: sysId }); } // 賃金は家計へ
    if (seed) this.cash('build', seed, { way: job, f: 'seed' });
    this.invNote(sysId, (cost.credits || 0) - seed); // 投資に数える (回 KE6。入植船の開拓資金は除く)
    if (job.flight && SIM_ONLY && job.flight.path) this.bookPath('settler', job.flight.m, job.flight.path, 'free', { payer: sysId });
    else if (job.flight) this.bookShip('settler', job.flight.m, job.flight.beta, 'free', sysId, sysId, job.flight.ly ?? 0);
    else if (cost.energy) this.bookE('build', -cost.energy, sysId);
    for (const x of p.plan) {
      if (x.from !== sysId && TRADE_AUDIT) TRADE_AUDIT.push([x.from, sysId, this.year, x.amt * PRICE[x.r], 'b', x.r]);
      if (x.from !== sysId) {
        const bMode = this.routeMode(x.from, sysId, (x.amt * RES_KG[x.r]) / UNIT_KG);
        if (SIM_ONLY) this.bookPath('build', x.amt * RES_KG[x.r], this.voyage(x.from, sysId).path, bMode, { offSpeed: SHIP_SPEED }); else this.bookShip('build', x.amt * RES_KG[x.r], SHIP_SPEED, bMode, x.from, sysId);
      }
      this.mv(x.from, x.r, -x.amt, job.type === 'ship' && job.supplies?.[x.r] ? 'ship' : 'build'); // 入植船に積む食料と水は運ばれて入植先の備蓄になる。ほかは建設に使う
      if (MARKET.buy) {
        // 資材は売り手の星系の会社から買う。主人の支援なら、主人の政府が代わりに払う
        const v = x.amt * (x.price || 0);
        this.invNote(sysId, v);
        if (v > 0 && p.aid && x.from !== sysId) { this.cash('grant', -v, { gov: x.from }); this.cash('grant', v, { fm: x.from }); }
        else if (v > 0 && x.from !== sysId) { if (firm) { this.cash('import', -v, payer); this.cash('import', v, { fm: x.from }); } else this.earn('import', -v, payer.gov, { fm: x.from }); }
        else if (v > 0 && payer.fm !== sysId) { this.cash('build', -v, payer); this.cash('build', v, { fm: sysId }); } // 会社が自分の在庫を使うときは払わない
      } else if (x.from !== sysId && !p.aid) { this.earn('import', -x.amt * x.price, payer.gov ?? sysId); this.earn('trade', x.amt * x.price, x.from); }
      if (x.from !== sysId) this.noteLordTrade(sysId, x.from, x.amt * x.price); // 主人との友好度: 支援として無償で受け取った資材も数える
    }
    if (p.aid) this.receiveAid(sysId, p.aid);
    if (eta <= 0) { this.finish({ ...job, sys: sysId }); return { ok: true }; }
    Object.assign(job, {
      id: this.nextShipId++, sys: sysId, start: this.year, ready: this.year + eta,
      from: [...new Set(p.plan.filter((x) => x.from !== sysId).map((x) => x.from))],
      // 物資移送要求が光速で取り寄せ元に届いてから、資材が交易路で出発する
      legs: [...new Set(p.plan.filter((x) => x.from !== sysId).map((x) => x.from))].map((f) => {
        const v = this.voyage(f, sysId);
        const go = this.year + this.travelYears(sysId, f);
        return { path: v.path, times: v.times.map((t) => go + t) };
      }),
    });
    for (const l of job.legs) {
      this.requests.push({ id: this.nextShipId++, kind: 'build', from: sysId, to: l.path[0], job: job.id, label: job.label, sent: this.year, arrive: l.times[0], state: 'sending' });
    }
    this.projects.push(job);
    if (!firm) this.message(JA`${job.label}: 資材を周辺の星系から搬入中 (${p.aid ? JA`主人の ${this.system(this.gov(sysId).lord).name} から支援 ${Math.ceil(p.aid)} cr 相当` : JA`輸入費 ${Math.ceil(p.imp || 0)} cr`}、完成まで ${eta.toFixed(1)} 年)`, sysId);
    return { ok: true };
  }
  pending(pred) { return this.projects.find(pred); }
  finish(job) {
    if (job.type === 'upgrade') {
      const c = this.colonyByKey(job.col);
      if (!c) return;
      c.lv[job.fac]++;
      this.message(JA`${c.name} の${FACILITY[job.fac]}を Lv${c.lv[job.fac]} に拡張した`, c.sys);
    } else if (job.type === 'ships') { // 輸送船 (回 KE5)
      const r = this.routes.find((x) => x.id === job.route);
      if (r) r.ships = this.routeShips(r) + job.n;
    } else if (job.type === 'warship') {
      const n = job.n || 1;
      this.garrison[job.sys] = (this.garrison[job.sys] || 0) + n;
      this.message(JA`${this.system(job.sys).name} で${n > 1 ? ` ${n} ` : ''}艦隊を編成した (駐留 ${this.garrison[job.sys]} 艦隊)`, job.sys);
    } else if (job.type === 'route') {
      const r = this.routes.find((x) => x.id === job.route);
      if (!r) return;
      r.lv++; // 港が広がる。広がった分の船は、運送業の会社が次の年に足す (回 KE5)
      this.message(JA`${this.system(r.a).name} ⇄ ${this.system(r.b).name} の交易路を Lv${r.lv} に拡張した`, r.a);
    } else if (job.type === 'troop') {
      const c = this.colonyByKey(job.col);
      if (!c) return;
      c.troops += 1;
      c.pop = Math.max(POP_FLOOR, c.pop - TROOP_DRAFT);
      if (!job.quiet) this.message(JA`${c.name} で歩兵連隊を訓練した (駐留 ${c.troops} 連隊)`, c.sys);
    } else if (job.type === 'capacity') { // 民間の採掘の能力 (回 KE5)
      const k = this.capacityAt(job.sys, job.body);
      if (k) k.k += job.k; else this.capacity.push({ sys: job.sys, body: job.body, k: job.k, by: job.pay?.fm ?? job.sys });
    } else if (job.type === 'outpost') {
      const o = this.outpostAt(job.sys, job.body);
      if (o) o.lv++;
      else this.outposts.push({ sys: job.sys, body: job.body, lv: 1 });
      this.message(JA`${this.target(job.sys, job.body).name} の採掘基地が Lv${o ? o.lv : 1} になった`, job.sys);
    } else if (job.type === 'fort') {
      this.fortBuilt(job); // 宇宙要塞 (船と戦争。ship/fort.js)
    } else if (job.type === 'ship') {
      this.launch(job.sys, job.to, job.body, job.kind, job.supplies, job);
    }
  }

  // 光 (通信) が届くまでの年数
  travelYears(fromId, toId) {
    // 星系は動かないので、組ごとに一度だけ計算して覚えておく
    const k = Number(fromId) * 65536 + Number(toId);
    const tc = (this.travelCache ??= new Map());
    let v = tc.get(k);
    if (v === undefined) { v = Math.max(this.sysDist(fromId, toId), 0.001); tc.set(k, v); }
    return v;
  }
  // 船で行く年数 (交易路上は SHIP_SPEED、交易路の外は OFFROUTE_SPEED)
  shipYears(fromId, toId, onRoute = true) {
    return this.travelYears(fromId, toId) / (onRoute ? SHIP_SPEED : OFFROUTE_SPEED);
  }

  dispatch(fromId, toId, bodyId, kind) {
    const c = this.check(toId, bodyId, kind, fromId);
    if (!c.ok) return c;
    if (!this.isColonized(fromId)) return fail('出発地に入植地がない');
    const label = JA`${this.target(toId, bodyId).name} への入植船 (${KIND_LABEL[kind]})`;
    const des = this.settlerDesign(fromId); // 入植船の設計 (船と戦争。B-033)。注文したときのものを船に持たせる
    const cost = this.shipCost(kind, fromId, toId, des);
    return this.order(cost, fromId, { type: 'ship', to: toId, body: bodyId, kind, label, design: des, supplies: { food: cost.food, water: cost.water, ...(des.cargo ? { goods: des.cargo } : {}) }, flight: this.settlerFlight(kind, fromId, toId) });
  }
  // 入植船に積む食料と水。交易路を結んで物資移送要求の往復が回り出すまで (5年 + 出発地との往復の年数) を、
  // 人口の伸びも見込んで2倍ぶん積む。到着すると入植先の備蓄になる
  supplyYears(fromId, toId) { return 5 + 2 * this.travelYears(fromId, toId); }
  shipSupplies(kind, fromId, toId, des = this.settlerDesign(fromId)) {
    const y = this.supplyYears(fromId, toId);
    const n = des.crew / 1e6; // 入植船の設計の人数 [百万人] (船と戦争。B-033)
    const up = (x) => Math.ceil(x * 1000) / 1000;
    return { food: up(n * y * 2), water: up(n * 0.1 * y * 2) };
  }
