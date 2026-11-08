  // --- 宇宙要塞 (FORT の説明は ship/war-consts.js) ---
  fortLevel(sys) { return this.forts?.[sys] || 0; }
  // 年 1 回 (と試合を作ったとき・読んだとき): 入植した星系には Lv FORT.auto を建てる。入植地のなくなった星系の要塞は消す
  fortsYearly() {
    for (const x of this.colonizedSystems()) if (this.forts[x.id] === undefined) this.forts[x.id] = FORT.auto;
    for (const k of Object.keys(this.forts)) if (!this.isColonized(Number(k))) delete this.forts[k];
  }
  // 次の段に上げる費用 (lv = 上げる前の段。予約を重ねるときは、予約した段。依頼 common-8)
  fortCost(sys, lv = this.fortLevel(sys)) {
    const k = GM.pow(FORT.growth, Math.max(0, lv - 1));
    return Object.fromEntries(Object.entries(FORT.cost).map(([r, v]) => [r, Math.round(v * k)]));
  }
  // 要塞を 1 段上げる (命令 fort。建設の注文と同じく、資材が集まってから完成する)。
  // 建設中なら、stack (プレイヤーの命令) のときだけ次の段を予約する (施設の upgrade と同じ。依頼 common-8)。AI の国は前のとおり 1 段ずつ
  fortUpgrade(sys, stack = false) {
    if (!this.isColonized(sys)) return fail('入植した星系にだけ建てられる');
    const q = this.projects.filter((j) => j.type === 'fort' && j.sys === sys).length;
    if (q && !(stack && BUILD_TIME.fort)) return fail('要塞を建設中');
    const lv = this.fortLevel(sys) + q;
    if (lv >= FORT.max) return fail(q ? JA`要塞は Lv${FORT.max} まで予約した` : JA`要塞は Lv${FORT.max} まで`);
    return this.order(this.fortCost(sys, lv), sys, { type: 'fort', label: JA`${this.system(sys).name} の宇宙要塞 Lv${lv + 1}` });
  }
  // 建設が終わった (economy/colonize.js の finish から)。新しい区画は無傷なので、傷の割合は (前の段 ÷ 新しい段) 倍に薄まる (依頼 FU-3)
  fortBuilt(job) {
    if (!this.isColonized(job.sys)) return;
    const lv0 = this.fortLevel(job.sys);
    this.forts[job.sys] = Math.min(FORT.max, lv0 + 1);
    const w = this.fortWearOf(job.sys);
    if (w && this.forts[job.sys] > lv0) this.fortWearSet(job.sys, (w * lv0) / this.forts[job.sys]);
    this.message(JA`${this.system(job.sys).name} の宇宙要塞を Lv${this.forts[job.sys]} にした`, job.sys);
  }
  // 地球に届いている要塞の段 (首都はいまの値)
  knownFort(id) { return id === this.cap ? this.fortLevel(id) : this.known(id)?.fort ?? 0; }

  // --- 要塞の傷 (2026-11-07 のユーザーの依頼 FU-3「要塞もダメージを食らい、壊れるようにしてほしい」。docs/fleet-groups.md の 8) ---
  // 前は、艦隊戦のあとに残った区画は次の戦いで無傷に戻っていた (沈んだ区画の数だけ段が下がるだけ)。
  // いまは、残った区画の傷 (耐久の欠けた割合) を星系ごとに覚え、次の艦隊戦の区画はその耐久で始まる。攻め続ければ要塞は削れて壊れる
  fortWearOf(sys) { return this.fortWear?.[sys] || 0; }
  fortWearSet(sys, w) { if (w > 1e-6 && this.fortLevel(sys) > 0) this.fortWear[sys] = Math.min(0.999, +w.toFixed(4)); else delete this.fortWear[sys]; }
  // 地球に届いている要塞の傷 (首都はいまの値)
  knownFortWear(id) { return id === this.cap ? this.fortWearOf(id) : this.known(id)?.fw || 0; }
  // 艦隊戦が終わったとき (攻め側が退いた・終戦・攻め落とした): 残った区画の耐久から傷を覚える。
  // 戦いのあとに建った区画 (戦いに出ていない分) は無傷として数える。攻め落とされて区画が残らなければ傷も消える
  fortWearKeep(b) {
    if (!FORT.wear) return; // シミュレーション版は傷を残さない (FORT.wear)
    const lv = this.fortLevel(b.sys);
    if (!lv) { delete this.fortWear[b.sys]; return; }
    const fs = (b.ud || []).filter((x) => x[3]).slice(0, lv);
    const hp = fs.reduce((k, x) => k + Math.max(0, Math.min(FORT.hp, x[0])), 0) + (lv - fs.length) * FORT.hp;
    this.fortWearSet(b.sys, 1 - hp / (lv * FORT.hp));
  }
  // 1 歩ごと: 艦隊戦をしていない星系の要塞の傷が、年に FORT.repair ずつ直る (費用なし)。入植地や要塞がなくなった星系の傷は消す
  fortsRepair(dt) {
    for (const k of Object.keys(this.fortWear)) {
      const sys = Number(k);
      if (!this.isColonized(sys) || !this.fortLevel(sys)) { delete this.fortWear[k]; continue; }
      if (this.battleAt(sys)) continue;
      this.fortWearSet(sys, this.fortWear[k] - FORT.repair * dt);
    }
  }
