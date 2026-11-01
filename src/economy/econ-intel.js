  // --- 経済の記録 (回 KE3・B-170。saveField の econIntel の説明) ---
  // 年が変わったら、入植している星系の余りと、入植地の移民の受け入れを記録する (trade の始めに呼ぶ)
  recordEconIntel(flow) {
    const E = this.econIntel, y = Math.floor(this.year);
    if (y <= E.y) return;
    E.y = y;
    const span = this.intelSpanYears() + 1;
    const r3 = (v) => Number(v.toPrecision(3));
    for (const x of this.colonizedSystems()) {
      const id = x.id, st = this.stockOf(id);
      const spare = RES.map((r) => r3(st[r] - 2 * (flow[id]?.cons[r] || 0)));
      const cols = {};
      for (const c of this.coloniesIn(id)) cols[colKey(c)] = [(c.sat?.food ?? 1) >= 0.99 && (!this.needsWater(c) || (c.sat?.water ?? 1) >= 0.99) ? 1 : 0, r3(this.capOf(c) * 0.8 - c.pop)];
      (E.s[id] ??= []).push([y, spare, cols, r3(Math.max(0, this.energyOf(id)))]); // 4 つめ = 蓄えのエネルギー (交易路の受け手の減速を、送り手が光の遅れのぶん古い値で見る。回 FU6・B-173)
    }
    for (const key of Object.keys(E.s)) {
      const list = E.s[key];
      let i = 0;
      while (i + 1 < list.length && list[i + 1][0] <= y - span) i++;
      if (i) list.splice(0, i);
      if (!list.length) delete E.s[key];
    }
  }
  // 星系 viewer から見えている星系 id の経済の記録 [年, 余り, 入植地]。光がまだ届いていなければ null。自分の星系は記録の最新
  econSeen(viewer, id) {
    const list = this.econIntel.s[id];
    if (!list?.length) return null;
    if (viewer === id) return list[list.length - 1];
    const t = this.year - this.sysDist(viewer, id);
    let best = null;
    for (const e of list) { if (e[0] <= t) best = e; else break; }
    return best;
  }
  // viewer から見えている、星系 id の資源 res の余り (見えなければ 0)
  spareSeen(viewer, id, res) { return this.econSeen(viewer, id)?.[1][RES_INDEX[res]] ?? 0; }
