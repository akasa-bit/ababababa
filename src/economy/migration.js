  // --- 恒星間移民 ---
  // 人口が上限の90%を超えた入植地から、年に1回、人口の3% (上限超えなら5%) が移民船で出ていく。
  // 行き先は食料と水が足りている入植地のうち、空き (上限の80%まで) が大きく近いところ。
  // 過密な入植地の居住区を拡張する (移民と並行して進む)。自動拡張がオンか、その星系の自動開発がオンのとき。
  // 資金が費用の2倍以上あり、資材を調達できるときだけ。建設中なら重ねて発注しない。
  expandHabitat(c) {
    if (!(!this.isHuman(c.sys) || this.auto[c.sys] || this.players[this.playerOf(c.sys)].autoHabitat) || c.lv.habitat >= FACILITY_MAX.habitat) return;
    const col = colKey(c);
    if (this.pending((j) => j.type === 'upgrade' && j.col === col && j.fac === 'habitat')) return;
    const cost = this.upgradeCost(c, 'habitat');
    if (this.funds(c.sys) < 2 * cost.credits || this.procure(cost, c.sys).why) return;
    this.order(cost, c.sys, { type: 'upgrade', col, fac: 'habitat', label: `[過密] ${c.name} の居住区 Lv${c.lv.habitat + 1}` });
  }
  // 恒星間移民を許すか: 人間の国はそのプレイヤーの設定、AI の国はいつも許す
  migrationOn(sys) { const i = this.playerOf(this.realmOf(sys)); return i < 0 ? true : this.players[i].migration; }
  migrantsTo(c) { const k = colKey(c); return this.migrants.filter((m) => m.to === k).reduce((s, m) => s + m.n, 0); }
  migrate() {
    // 向かっている移民の数 (行き先ごと)。一覧を毎回数え直す migrantsTo と同じ値を、送り出すたびに足して保つ
    const incoming = new Map();
    for (const m of this.migrants) incoming.set(m.to, (incoming.get(m.to) || 0) + m.n);
    const migrantsTo = (d) => incoming.get(colKey(d)) || 0;
    for (const c of this.colonies) {
      const ratio = c.pop / this.capOf(c);
      if (!c.alerts) c.alerts = {};
      // 人口過密は状態として持ち (イベントタブの「いま起きている問題」に出る)、記録には入植地ごとに最初の1回だけ書く
      if (!c.alerts.crowd && ratio >= 0.9) {
        c.alerts.crowd = true;
        if (!c.crowdLogged) { c.crowdLogged = true; this.event('migration', c.sys, `${c.name} が初めて人口過密になった (上限の ${pct(ratio)})${this.migrationOn(c.sys) ? '。恒星間移民が始まる' : ''}`); }
      } else if (c.alerts.crowd && ratio < 0.85) {
        c.alerts.crowd = false;
      }
      if (ratio >= 0.9) this.expandHabitat(c);
      if (!this.migrationOn(c.sys) || ratio < 0.9) continue;
      const want = c.pop * (ratio >= 1 ? 0.05 : 0.03);
      // 行き先は、光の遅れのぶん古い記録 (econSeen) で、食べ物と水が足りていて空きのある入植地 (回 KE3。前はいまの様子を見ていた。同じ星系の中はいまの様子)
      const seen = (d) => (d.sys === c.sys ? [(d.sat?.food ?? 1) >= 0.99 && (!this.needsWater(d) || (d.sat?.water ?? 1) >= 0.99) ? 1 : 0, this.capOf(d) * 0.8 - d.pop] : this.econSeen(c.sys, d.sys)?.[2][colKey(d)]);
      const dests = this.colonies
        .filter((d) => d !== c && seen(d)?.[0] === 1)
        .map((d) => ({ d, room: seen(d)[1] - migrantsTo(d), t: this.voyage(c.sys, d.sys).years }))
        .filter((x) => x.room > 0.001)
        .sort((a, b) => b.room / (1 + b.t / 10) - a.room / (1 + a.t / 10));
      if (!dests.length) continue;
      const { d, room, t } = dests[0];
      // 移民船は交易路を通る。送る側と受ける側の蓄えで運べるだけ
      const n = Math.min(want, room * 0.5, c.sys === d.sys ? Infinity : (this.routeRoom(c.sys, d.sys) * UNIT_KG) / (1e6 * MIGRANT_KG));
      if (n < 0.001) continue;
      c.pop -= n;
      c.migOut = (c.migOut || 0) + n;
      const v = this.voyage(c.sys, d.sys);
      if (c.sys !== d.sys) {
        const mMode = this.routeMode(c.sys, d.sys, (n * 1e6 * MIGRANT_KG) / UNIT_KG);
        if (SIM_ONLY) this.bookPath('migrant', n * 1e6 * MIGRANT_KG, v.path, mMode, { offSpeed: SHIP_SPEED }); else this.bookShip('migrant', n * 1e6 * MIGRANT_KG, SHIP_SPEED, mMode, c.sys, d.sys);
      }
      this.migrants.push({ id: this.nextShipId++, from: colKey(c), to: colKey(d), fromSys: c.sys, toSys: d.sys, n, races: { ...(c.races || { [HUMAN]: 1 }) }, edu: this.eduAges(c), // 移民は自分の年齢の区分ごとの就学年数と学力を運ぶ (回 KE5)
        path: v.path, times: v.times.map((x) => this.year + x), depart: this.year, arrive: this.year + t });
      incoming.set(colKey(d), (incoming.get(colKey(d)) || 0) + n);
    }
  }

  rally(to) {
    const from = Object.keys(this.garrison).map(Number).filter((id) => id !== to && this.garrison[id] > 0 && this.stackRealm(id) === this.cap);
    if (!from.length) return fail('集められる艦隊がない');
    for (const id of from) this.sendFleet(id, to, this.garrison[id]);
    return { ok: true };
  }
  setFocusAll(focus) {
    if (MARKET.buy) return fail('方針はなくなった (就業は値段で決まる)');
    if (!FOCUS[focus]) return fail('方針が不正');
    for (const c of this.colonies) c.focus = focus;
    this.message(`全入植地の方針を「${FOCUS[focus].label}」にした`);
    return { ok: true };
  }

