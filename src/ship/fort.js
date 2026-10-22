  // --- 宇宙要塞 (FORT の説明は ship/war-consts.js) ---
  fortLevel(sys) { return this.forts?.[sys] || 0; }
  // 年 1 回 (と試合を作ったとき・読んだとき): 入植した星系には Lv FORT.auto を建てる。入植地のなくなった星系の要塞は消す
  fortsYearly() {
    for (const x of this.colonizedSystems()) if (this.forts[x.id] === undefined) this.forts[x.id] = FORT.auto;
    for (const k of Object.keys(this.forts)) if (!this.isColonized(Number(k))) delete this.forts[k];
  }
  // 次の段に上げる費用
  fortCost(sys) {
    const k = GM.pow(FORT.growth, Math.max(0, this.fortLevel(sys) - 1));
    return Object.fromEntries(Object.entries(FORT.cost).map(([r, v]) => [r, Math.round(v * k)]));
  }
  // 要塞を 1 段上げる (命令 fort。建設の注文と同じく、資材が集まってから完成する)
  fortUpgrade(sys) {
    if (!this.isColonized(sys)) return fail('入植した星系にだけ建てられる');
    if (this.fortLevel(sys) >= FORT.max) return fail(`要塞は Lv${FORT.max} まで`);
    if (this.pending((j) => j.type === 'fort' && j.sys === sys)) return fail('要塞を建設中');
    return this.order(this.fortCost(sys), sys, { type: 'fort', label: `${this.system(sys).name} の宇宙要塞 Lv${this.fortLevel(sys) + 1}` });
  }
  // 建設が終わった (economy/colonize.js の finish から)
  fortBuilt(job) {
    if (!this.isColonized(job.sys)) return;
    this.forts[job.sys] = Math.min(FORT.max, this.fortLevel(job.sys) + 1);
    this.message(`${this.system(job.sys).name} の宇宙要塞を Lv${this.forts[job.sys]} にした`, job.sys);
  }
  // 地球に届いている要塞の段 (首都はいまの値)
  knownFort(id) { return id === this.cap ? this.fortLevel(id) : this.known(id)?.fort ?? 0; }
