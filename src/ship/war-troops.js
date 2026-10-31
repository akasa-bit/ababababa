  // 宇宙海賊の襲撃。入植地が増えるほど、時代が進むほど増える。地球は本国艦隊が守っている前提で対象外。
  pirates(h) {
    let hit = false;
    if (this.pirateRaids?.length) { // 着いた海賊 (シミュレーション版)
      const due = this.pirateRaids.filter((r) => r.arrive <= this.year);
      if (due.length) { this.pirateRaids = this.pirateRaids.filter((r) => r.arrive > this.year); for (const r of due) if (this.isColonized(r.sys)) this.pirateRaid(this.system(r.sys), r.power); hit = true; }
    }
    if (this.year < PIRATE_START) return hit;
    const targets = this.colonizedSystems().filter((s) => !this.isHuman(s.id));
    if (!targets.length || this.rand() > 0.05 * Math.sqrt(targets.length) * h) return hit;
    const sys = targets[Math.floor(this.rand() * targets.length)];
    const power = Math.max(1, Math.round(this.pirateBase() * (0.5 + this.rand())));
    if (SIM_ONLY) return this.pirateLaunch(sys, power) || hit;
    this.pirateRaid(sys, power);
    return true;
  }
  // 海賊の船出 (物理。シミュレーション版だけ)。海賊も、どこかの星系のエネルギーで加速し、0.9c で飛んで来る (宇宙の途中から湧いては来ない)。
  // 根城は、襲う星系から一番近い、ほかの国 (か独立した星系) の入植星系。船出のエネルギーはその星系の蓄えから盗む ('pirate' として記帳)。
  // 着くまでは何も起きない (根城を出た光が届くのは、海賊が着くほんの少し前)
  pirateLaunch(sys, power) {
    const realm = this.realmOf(sys.id);
    const others = this.colonizedSystems().filter((s) => s.id !== sys.id);
    const pool = others.filter((s) => this.realmOf(s.id) !== realm);
    const bases = pool.length ? pool : others;
    if (!bases.length) return false;
    const base = bases.reduce((a, b) => (this.sysDist(b.id, sys.id) < this.sysDist(a.id, sys.id) ? b : a));
    const ly = this.sysDist(base.id, sys.id);
    this.bookShip('pirate', power * FLEET_KG, OFFROUTE_SPEED, 'free', base.id, base.id, ly);
    (this.pirateRaids ??= []).push({ sys: sys.id, power, from: base.id, depart: this.year, arrive: this.year + ly / OFFROUTE_SPEED + accelExtra(ly, OFFROUTE_SPEED, ACCEL.crew, this.physics) });
    return false;
  }
  // 海賊の襲撃 (戦力 power)。駐留艦隊が戦力以上なら撃退、足りなければ略奪される
  pirateRaid(sys, power) {
    const g = this.garrison[sys.id] || 0;
    // 兵站: 補給不足の艦隊は戦力が落ちる
    if (g * this.fleetEff(this.supplied[sys.id]?.k) * this.fleetMul(sys.id, sys.id) >= power) {
      const loss = Math.floor((power / 3) * this.rand());
      this.garrison[sys.id] = g - loss;
      this.event('pirate', sys.id, JA`${sys.name} で宇宙海賊 (戦力${power}) を撃退した${loss ? JA` (${loss} 艦隊を喪失)` : ''}`, true);
    } else {
      // 地上では歩兵が抵抗し、歩兵が多いほど被害が小さくなる
      this.garrison[sys.id] = 0;
      const tp = this.troopPower(sys.id);
      const f = power / (power + tp);
      const st = this.stockOf(sys.id);
      for (const r of RES) this.mv(sys.id, r, -0.4 * f * st[r], 'pirate'); // 海賊が持ち去る
      for (const c of this.coloniesIn(sys.id)) c.pop *= 1 - 0.1 * f;
      const lost = Math.min(Math.ceil(power / 2), Math.ceil(tp));
      if (tp) this.loseTroops(sys.id, lost);
      this.event('pirate', sys.id, JA`${sys.name} が宇宙海賊 (戦力${power}) に略奪された${g ? JA` (駐留 ${g} 艦隊は全滅)` : ''}${tp ? JA` — 歩兵の抵抗で被害は ${pct(f)} に (歩兵 ${lost} 連隊を喪失)` : ''}`);
    }
  }

  // --- 先住民との関係 ---
  gift(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    if (!n || n.st.status !== 'independent') return fail('対象がいない');
    if (!this.isColonized(sysId)) return fail('この星系に拠点が必要');
    const paid = this.pay(GIFT_COST, undefined, sysId);
    if (!paid.ok) return paid;
    n.st.rel = Math.min(100, n.st.rel + 10);
    this.message(JA`${n.def.species}に贈り物をした (友好度 ${Math.round(n.st.rel)})`, sysId);
    return { ok: true };
  }
  integrate(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    const c = this.colonyAt(sysId, bodyId, 'planet');
    if (!n || n.st.status !== 'independent') return fail('対象がいない');
    if (!c) return fail('同じ惑星に入植地が必要');
    if (n.st.rel < 80) return fail('友好度80以上が必要');
    this.addPeople(c, n.st.pop, { [n.def.species]: 1 });
    n.st.status = 'integrated';
    this.asRealm(this.realmOf(sysId), () => this.stats.integrated++);
    this.event('natives', sysId, JA`${n.def.species} ${fmtPop(n.st.pop)}が ${c.name} の市民になった`, true);
    return { ok: true };
  }
  conquer(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    if (!n || n.st.status !== 'independent') return fail('対象がいない');
    const need = this.nativeDefense(n);
    const g = this.garrison[sysId] || 0;
    const power = g + this.troopPower(sysId);
    if (g < 1) return fail('制宙権のための艦隊が1つ以上必要');
    if (power < need) return fail(JA`戦力不足 (艦隊+歩兵で ${need} 以上が必要)`);
    // 損害は歩兵から先に受ける
    const tp = this.troopPower(sysId);
    const troopLoss = Math.min(Math.ceil(need / 3), Math.floor(tp));
    this.loseTroops(sysId, troopLoss);
    const loss = Math.min(g, Math.ceil(Math.max(0, need / 3 - troopLoss) / 2));
    this.garrison[sysId] = g - loss;
    this.subjugate(n);
    this.wars = this.wars.filter((w) => !(w.sys === sysId && w.body === bodyId));
    this.event('natives', sysId, JA`${n.def.species}を制圧した (${loss} 艦隊・歩兵 ${troopLoss} 連隊を喪失)。他の先住民の友好度が下がった`);
    return { ok: true };
  }

  // 支配下の先住民の扱い。奴隷化には同じ惑星に入植地が必要で、悪名が増えて他の先住民の友好度が下がる。
  // 奴隷化するとまず市場奴隷になり、軍事奴隷・家畜に切り替えられる。奴隷の人口はふつうに増える。
  //  市場奴隷: 労働力として食料・金属・希少元素・工業品を産む (消費されず、寿命で入れ替わる)
  //  軍事奴隷: 安価な歩兵として毎年徴集される
  //  家畜: 食料を大量に産む。初めて家畜にしたとき悪名がさらに +15
  blame(n, amount) {
    this.infamy += amount;
    for (const st of Object.values(this.natives)) if (st !== n.st && st.status === 'independent') st.rel -= amount;
  }
  enslave(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    if (!n || n.st.status !== 'subjugated') return fail('支配下の先住民がいない');
    if (!this.colonyAt(sysId, bodyId, 'planet')) return fail('同じ惑星に入植地が必要');
    n.st.status = 'enslaved';
    n.st.slave = 'market';
    n.st.rel = -100;
    this.blame(n, 15);
    this.event('natives', sysId, JA`${n.def.species}を奴隷化した (市場奴隷)。他の先住民の友好度が 15 下がった`);
    return { ok: true };
  }
  setSlaveType(sysId, bodyId, type) {
    const n = this.nativeOf(sysId, bodyId);
    if (!n || n.st.status !== 'enslaved') return fail('奴隷がいない');
    if (!SLAVE_TYPES[type] || n.st.slave === type) return fail('変更なし');
    n.st.slave = type;
    if (type === 'livestock' && !n.st.wasLivestock) {
      n.st.wasLivestock = true;
      this.blame(n, 15);
    }
    this.event('natives', sysId, JA`${n.def.species}の扱いを「${SLAVE_TYPES[type]}」にした`);
    return { ok: true };
  }
  liberate(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    if (!n || !['subjugated', 'enslaved'].includes(n.st.status)) return fail('解放できる先住民がいない');
    n.st.status = 'independent';
    n.st.rel = -40;
    this.infamy = Math.max(0, this.infamy - 10);
    for (const st of Object.values(this.natives)) if (st !== n.st && st.status === 'independent') st.rel = Math.min(100, st.rel + 5);
    this.event('natives', sysId, JA`${n.def.species}を解放した。他の先住民の友好度が少し上がった`, true);
    return { ok: true };
  }
  // --- 征服戦争 ---
  // 統一されていない先住民の惑星に入植すると自動で始まる。入植地の戦力 (歩兵 + 星系の艦隊の半分 + 入植者の民兵) と
  // 先住民の残りの戦力が毎年削り合う: 先住民は 入植地の戦力 × 0.5 を失い、さらに疲弊して年7%ずつ弱る。
  // 入植地は 先住民の戦力 × 0.15 の歩兵を失い、人口も少し減る。先住民の戦力が0.5を切れば勝利。
  // 入植地が劣勢 (戦力が先住民に届かず歩兵を失っている) になると、入植船を送った星系が自動で歩兵を送り込む
  startWar(sysId, bodyId) {
    const n = this.nativeOf(sysId, bodyId);
    if (!n || this.wars.some((w) => w.sys === sysId && w.body === bodyId)) return;
    n.st.rel = Math.min(n.st.rel, -60);
    const def = this.nativeDefense(n);
    this.wars.push({ sys: sysId, body: bodyId, start: this.year, progress: 0, def0: def, enemy: def, lost: 0 });
    this.event('war', sysId, JA`${this.target(sysId, bodyId).name} で${n.def.species} (${TECH_LABEL[n.def.tech]}) との征服戦争が始まった`);
    this.warsYearly(true);
  }
  militia(c) { return c ? 0.3 + 0.5 * GM.log10(1 + c.pop) : 0; }
  warPower(w) {
    const c = this.colonyAt(w.sys, w.body, 'planet');
    return (c ? c.troops + SLAVE_TROOP_POWER * c.slaveTroops : 0) + 0.5 * (this.garrison[w.sys] || 0) + this.militia(c);
  }
  warsYearly(first = false) {
    // 戦争方針に照らして、共存中の入植地でも友好度が基準を下回っていれば戦争を始める
    if (!first) {
      for (const c of this.colonies) {
        if (c.kind !== 'planet' || this.wars.some((w) => w.sys === c.sys && w.body === c.body)) continue;
        if (this.hostileNatives(c.sys, c.body)) this.startWar(c.sys, c.body);
      }
    }
    for (const w of [...this.wars]) {
      const n = this.nativeOf(w.sys, w.body);
      const c = this.colonyAt(w.sys, w.body, 'planet');
      if (!n || n.st.status !== 'independent' || !c) { this.wars = this.wars.filter((x) => x !== w); continue; }
      // 旧セーブの戦争は、いまの進捗から先住民の残りの戦力を決める
      w.def0 ??= this.nativeDefense(n);
      w.enemy ??= w.def0 * (1 - w.progress);
      const p = this.warPower(w);
      const win = () => {
        this.subjugate(n);
        this.wars = this.wars.filter((x) => x !== w);
        this.event('war', w.sys, JA`${c.name} の征服戦争に勝利し、${n.def.species}を支配下に置いた (${(this.year - w.start).toFixed(0)} 年、歩兵 ${w.lost} 連隊を喪失)`, true);
      };
      if (first) {
        // 同行した歩兵だけで圧倒できれば、すぐに決着する
        if (p >= w.enemy) {
          w.lost = Math.min(c.troops + c.slaveTroops, Math.ceil(w.enemy / 3));
          this.loseTroops(w.sys, w.lost);
          win();
        }
        continue;
      }
      const e = w.enemy;
      w.enemy = Math.max(0, e * 0.93 - 0.5 * p);
      const before = c.troops + c.slaveTroops;
      w.loss = Math.min(before, (w.loss || 0) + 0.15 * e);
      const lose = Math.floor(w.loss);
      if (lose > 0) { this.loseTroops(w.sys, lose); w.loss -= lose; w.lost = (w.lost || 0) + lose; }
      c.pop = Math.max(POP_FLOOR, c.pop * 0.97);
      n.st.pop *= 0.97;
      w.progress = clamp(1 - w.enemy / w.def0, 0, 1);
      if (w.enemy < 0.5) { win(); continue; }
      if (p < e && (lose > 0 || before === 0)) this.reinforceWar(w, c, e - this.warPower(w));
    }
  }
  // 劣勢の征服戦争へ、入植船を送った星系 (主人) から歩兵を送り込む。交易路でつながっていなければ直行する (0.9c)。
  // 送れる歩兵がいなければ、軍事教練所で訓練を始める
  reinforceWar(w, c, gap) {
    const key = colKey(c);
    if (this.troopMoves.some((m) => m.to === key) || this.year - (w.reinforced ?? -1e9) < 2) return;
    const lord = this.gov(w.sys).lord;
    if (lord === null || lord === undefined || !this.isColonized(lord)) return;
    const src = this.coloniesIn(lord).filter((x) => x !== c).sort((a, b) => (b.troops + b.slaveTroops) - (a.troops + a.slaveTroops))[0];
    if (!src) return;
    const avail = src.troops + src.slaveTroops;
    if (avail < 1) {
      const yard = this.coloniesIn(lord).find((x) => x.lv.barracks >= 1);
      if (yard) this.trainTroop(yard, true);
      return;
    }
    const n = Math.min(avail, Math.ceil(gap) + 1);
    if (this.sendTroops(colKey(src), key, n, true).ok) {
      w.reinforced = this.year;
      this.event('war', w.sys, JA`${c.name} の征服戦争が劣勢のため、${this.system(lord).name} が歩兵 ${n} 連隊を送り込んだ`);
    }
  }
  // 支配下に置く (制圧・征服戦争の共通処理)
  subjugate(n) {
    n.st.status = 'subjugated';
    n.st.pop *= 0.7;
    n.st.rel = -80;
    this.blame(n, 25);
  }

  // 年1回: 奴隷の人口の増加、軍事奴隷の徴集、反乱
  nativesYearly() {
    // 星系の政府は、支配下に置いた先住民を自分の判断で奴隷化する (市場奴隷)。太陽系はプレイヤーが決める (観戦モードでは自動)
    for (const [key, st] of Object.entries(this.natives)) {
      const [sysStr, bodyId] = key.split('|');
      const sys = Number(sysStr);
      if (st.status === 'subjugated' && (!this.isHuman(sys) || this.spectate) && this.colonyAt(sys, bodyId, 'planet')) this.enslave(sys, bodyId);
    }
    for (const [key, st] of Object.entries(this.natives)) {
      const [sysStr, bodyId] = key.split('|');
      const sys = Number(sysStr);
      const n = this.nativeOf(sys, bodyId);
      if (!n || st.status !== 'enslaved') continue;
      st.pop = Math.min(n.def.pop * 2, st.pop * 1.015);
      if (st.slave === 'market') st.pop *= 1 - SLAVE_SALE; // 市場に出た分 (備蓄の奴隷になる)
      const col = this.colonyAt(sys, bodyId, 'planet');
      if (st.slave === 'military' && col && st.pop >= 2) {
        const levy = Math.min(Math.max(1, Math.floor(st.pop / 25)), Math.max(0, Math.floor(st.pop / 5) - col.slaveTroops));
        col.slaveTroops += levy;
        st.pop -= levy * TROOP_DRAFT;
      }
      const guard = (this.garrison[sys] || 0) + this.troopPower(sys);
      if (guard < this.nativeDefense(n) / 2 && this.rand() < 0.05) {
        st.status = 'independent';
        st.rel = -100;
        for (const c of this.coloniesIn(sys)) c.pop *= 0.9;
        this.garrison[sys] = Math.max(0, (this.garrison[sys] || 0) - 1);
        this.event('natives', sys, JA`${n.def.species}の奴隷が反乱を起こし、独立を取り戻した (入植地の人口が1割減少)`);
      }
    }
  }
  // 奴隷が産む資源 [年あたり]
  nativeYield(sys, bodyId, st) {
    if (st.status !== 'enslaved') return {};
    const d = this.target(sys, bodyId)?.deposits || {};
    if (st.slave === 'livestock') return { food: 1.5 * st.pop };
    if (st.slave === 'military') return { food: 0.3 * st.pop };
    return { food: 0.4 * st.pop, metal: 0.3 * st.pop * Math.max(0.3, d.metal || 0), rare: 0.05 * st.pop * (d.rare || 0), goods: 0.1 * st.pop, slaves: SLAVE_SALE * st.pop };
  }

  // --- 歩兵 ---
  troopPower(sysId) { return this.coloniesIn(sysId).reduce((k, c) => k + c.troops + SLAVE_TROOP_POWER * c.slaveTroops, 0); }
  troopCount() { return this.colonies.reduce((k, c) => k + c.troops + c.slaveTroops, 0) + this.troopMoves.reduce((k, m) => k + m.troops + m.slave, 0); }
  troopUpkeep() {
    const all = [...this.colonies, ...this.troopMoves.map((m) => ({ troops: m.troops, slaveTroops: m.slave }))];
    return all.reduce((k, c) => k + TROOP_UPKEEP * c.troops + SLAVE_TROOP_UPKEEP * c.slaveTroops, 0);
  }
  // 歩兵を失う (奴隷兵から先に)
  loseTroops(sysId, n) {
    for (const c of this.coloniesIn(sysId)) {
      const s = Math.min(n, c.slaveTroops); c.slaveTroops -= s; n -= s;
    }
    for (const c of this.coloniesIn(sysId)) {
      const t = Math.min(n, c.troops); c.troops -= t; n -= t;
    }
  }
  trainTroop(c, quiet = false) {
    if (c.lv.barracks < 1) return fail('軍事教練所がない');
    if (c.pop < TROOP_DRAFT * 4) return fail('人口が少なすぎる');
    if (this.pending((j) => j.type === 'troop' && j.col === colKey(c))) return fail('訓練中');
    return this.order(TROOP_COST, c.sys, { type: 'troop', col: colKey(c), quiet, label: JA`${c.name} の歩兵連隊` });
  }
  // 軍事教練所は年に Lv 連隊まで自動で訓練し、Lv×5 連隊を保つ (資金が費用の2倍以上あるとき)
  barracksYearly() {
    for (const c of this.colonies) {
      for (let i = 0; i < c.lv.barracks && c.troops < 5 * c.lv.barracks; i++) {
        if (this.funds(c.sys) < 2 * TROOP_COST.credits || this.procure(TROOP_COST, c.sys).why) break;
        if (!this.trainTroop(c, true).ok) break;
      }
    }
  }
  // 交易路網上の最短経路 (航行年数の合計)。つながっていなければ null。
  // 出発地からの最短経路木 (reach、キャッシュあり) をたどる (同じダイクストラ法なので、途中で打ち切る計算と結果は同じ)
  routePath(a, b) {
    if (a === b) return { path: [a], years: 0 };
    if (typeof a !== 'number' || typeof b !== 'number') return null; // 星系の番号は数 (数でなければ、もとの計算でもつながらない)
    const { dist, prev } = this.reach(a);
    if (dist[b] === undefined) return null;
    const path = [b];
    while (path[0] !== a) path.unshift(prev[path[0]]);
    return { path, years: dist[b] };
  }
  // 歩兵を別の入植地へ送る。同じ星系ならすぐ、別の星系なら交易路をたどって 0.95c で移動する
  sendTroops(fromKey, toKey, n, direct = false) {
    const from = this.colonyByKey(fromKey);
    const to = this.colonyByKey(toKey);
    if (!from || !to || from === to) return fail('送り先が不正');
    const troops = Math.min(n, from.troops);
    const slave = Math.min(n - troops, from.slaveTroops);
    if (troops + slave < 1) return fail('送れる歩兵がいない');
    // 交易路でつながっていなければ送れない (征服戦争の増援だけは直行する: 0.9c)
    const route = this.routePath(from.sys, to.sys) || (direct ? { path: [from.sys, to.sys], years: this.shipYears(from.sys, to.sys, false), direct: true } : null);
    if (!route) return fail('交易路でつながっていない');
    from.troops -= troops;
    from.slaveTroops -= slave;
    if (route.years === 0) {
      to.troops += troops;
      to.slaveTroops += slave;
      return { ok: true };
    }
    let times = [this.year], tly = 0;
    for (let i = 1; i < route.path.length; i++) { times.push(times[i - 1] + this.shipYears(route.path[i - 1], route.path[i], !route.direct)); tly += this.sysDist(route.path[i - 1], route.path[i]); }
    times = SIM_ONLY ? this.stopTimes(route.path, times, () => (route.direct ? OFFROUTE_SPEED : SHIP_SPEED), ACCEL.crew) : withAccel(times, accelExtra(tly, route.direct ? OFFROUTE_SPEED : SHIP_SPEED, ACCEL.crew, this.physics));
    // 交易路なら着く側のレーザーで減速する。直行なら磁気帆と反物質 (どちらも蓄えが負になってもよい)
    if (SIM_ONLY && !route.direct) this.bookPath('troop', (troops + slave) * TROOP_KG, route.path, 'route');
    else this.bookShip('troop', (troops + slave) * TROOP_KG, route.direct ? OFFROUTE_SPEED : SHIP_SPEED, route.direct ? 'free' : 'route', from.sys, to.sys);
    this.troopMoves.push({ id: this.nextShipId++, from: fromKey, to: toKey, path: route.path, times, arrive: times[times.length - 1], troops, slave });
    this.message(JA`${from.name} → ${to.name} へ歩兵 ${troops + slave} 連隊が出発 (${route.direct ? '直行 0.9c' : '交易路経由'}、到着まで ${route.years.toFixed(1)} 年)`, from.sys);
    return { ok: true };
  }
  // 交易路でつながる全入植地の歩兵をこの入植地へ集める
  rallyTroops(toKey) {
    const to = this.colonyByKey(toKey);
    let sent = 0;
    for (const c of this.colonies) {
      if (c === to || c.troops + c.slaveTroops < 1 || !this.routePath(c.sys, to.sys)) continue;
      if (this.sendTroops(colKey(c), toKey, c.troops + c.slaveTroops).ok) sent++;
    }
    return sent ? { ok: true } : fail('集められる歩兵がいない');
  }

