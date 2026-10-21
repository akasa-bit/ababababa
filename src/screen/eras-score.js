  realmPop(root = this.cap) { return this.realmSystems(root).reduce((k, x) => k + this.coloniesIn(x.id).reduce((a, c) => a + c.pop, 0), 0); }
  realmRoutes(root = this.cap) { return this.routes.filter((r) => this.realmOf(r.a) === root && this.realmOf(r.b) === root).length; }
  unrestCount(root = this.cap) { return Object.entries(this.govs).filter(([k, v]) => (v.unrest?.stage || 0) >= 1 && this.isColonized(Number(k)) && this.realmOf(Number(k)) === root).length; }
  taskValue(t) {
    switch (t.id) {
      case 'systems': return this.realmSystems(this.cap).length;
      case 'routes': return this.realmRoutes(this.cap);
      case 'pop': return this.realmPop(this.cap);
      case 'calm': return this.unrestCount(this.cap);
      case 'integrate': return this.stats.integrated - (t.base || 0);
      case 'subjugate': return this.stats.subjugated - (t.base || 0);
      default: return 0;
    }
  }
  taskMet(t) { return t.id === 'calm' ? this.taskValue(t) <= t.target : this.taskValue(t) >= t.target; }
  // 時代 n の課題を2つ出す。最初の時代は序盤の道しるべ (入植星系3つ・交易路3本)
  eraTasks(n) {
    const end = START_YEAR + ERA_YEARS * (n + 1);
    if (n === 0) {
      return [
        { id: 'systems', target: 3, check: 'reach', deadline: START_YEAR + 50, label: `${START_YEAR + 50}年までに、${this.realmName(this.cap)}の星系を3つにする` },
        { id: 'routes', target: 3, check: 'reach', deadline: end, label: `${end}年までに、${this.realmName(this.cap)}の中の交易路を3本にする` },
      ];
    }
    const sys = this.realmSystems(this.cap).length;
    const pool = [
      { id: 'systems', target: Math.max(sys + 5, Math.round(sys * 1.4)), check: 'reach', label: '' },
      { id: 'routes', target: this.realmRoutes(this.cap) + 4, check: 'reach', label: '' },
      { id: 'pop', target: Math.round(this.realmPop(this.cap) * 1.4), check: 'reach', label: '' },
      { id: 'calm', target: 0, check: 'end', label: '' },
    ];
    if (Object.values(this.natives).some((s) => s.status === 'independent')) pool.push({ id: 'integrate', target: 1, base: this.stats.integrated, check: 'reach', label: '' });
    if (this.colonizedSystems().some((x) => x.id !== this.cap && this.realmOf(x.id) === x.id && this.gov(x.id).independent)) pool.push({ id: 'subjugate', target: 1, base: this.stats.subjugated, check: 'reach', label: '' });
    const out = [];
    while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(this.rand() * pool.length), 1)[0]);
    for (const tk of out) {
      tk.deadline = end;
      tk.label = {
        systems: `${end}年までに、${this.realmName(this.cap)}を${tk.target}星系にする`, routes: `${end}年までに、${this.realmName(this.cap)}の中の交易路を${tk.target}本にする`,
        pop: `${end}年までに、${this.realmName(this.cap)}の人口を${fmtPop(tk.target)}にする`, calm: `${end}年の時点で、不満を抱える家臣を0にする`,
        integrate: `${end}年までに、先住民を1つ市民として迎える`, subjugate: `${end}年までに、独立国を1つ従属させる`,
      }[tk.id];
    }
    return out;
  }
  erasYearly() {
    const n = Math.floor((this.year - START_YEAR) / ERA_YEARS + 1e-9);
    if (!this.era || this.era.n !== n) {
      let done = 0;
      for (const tk of this.era?.tasks || []) {
        if (tk.status === 'active') { tk.status = 'failed'; this.councilAdd(-10); this.event('goal', this.cap, `時代の課題を果たせなかった: ${tk.label} (議会の支持 −10)`); }
        if (tk.status === 'done') done++;
      }
      this.era = { n, tasks: this.eraTasks(n).map((tk) => ({ ...tk, status: 'active' })), bonus: this.era ? done : 0 };
      this.event('goal', this.cap, `${START_YEAR + ERA_YEARS * n}年、新しい時代が始まった。課題: ${this.era.tasks.map((tk) => tk.label).join(' / ')}${this.era.bonus ? `。前の時代の課題を ${this.era.bonus} つ果たしたので、この時代は政治力が年 +${2 * this.era.bonus}` : ''}`, true);
    }
    for (const tk of this.era.tasks) {
      if (tk.status !== 'active') continue;
      if (tk.check === 'reach' && this.taskMet(tk)) {
        tk.status = 'done'; tk.at = this.year; this.stats.tasksDone++;
        this.councilAdd(15);
        this.event('goal', this.cap, `時代の課題を果たした: ${tk.label} (議会の支持 +15)`, true);
      } else if (this.year >= tk.deadline) {
        if (tk.check === 'end' && this.taskMet(tk)) { tk.status = 'done'; tk.at = this.year; this.stats.tasksDone++; this.councilAdd(15); this.event('goal', this.cap, `時代の課題を果たした: ${tk.label} (議会の支持 +15)`, true); }
        else { tk.status = 'failed'; tk.at = this.year; this.councilAdd(-10); this.event('goal', this.cap, `時代の課題を果たせなかった: ${tk.label} (議会の支持 −10)`); }
      }
    }
  }
  independentRealms() { return this.colonizedSystems().filter((x) => x.id !== this.cap && this.realmOf(x.id) === x.id && this.gov(x.id).independent).length; }
  challengesYearly() {
    const sol = this.system(this.cap);
    const end = this.endYear && this.year >= this.endYear;
    for (const c of this.challenges) {
      if (c.status !== 'active') continue;
      let ok = null;
      if (c.id === 'sixty' && this.realmSystems(this.cap).length >= 60) ok = true;
      if (c.id === 'far' && this.realmSystems(this.cap).some((x) => distance(x, sol) > 40)) ok = true;
      if (end && ok === null) ok = c.id === 'loyal' ? true : c.id === 'unify' ? this.independentRealms() === 0 : false;
      if (ok === null) continue;
      c.status = ok ? 'done' : 'failed';
      c.at = this.year;
      this.event('goal', this.cap, `挑戦「${CHALLENGES[c.id].label}」を${ok ? '果たした' : '果たせなかった'}`, ok);
    }
  }
  // 点数 (いつでも見られる。終わりの年に確定する)
  score() {
    const sys = this.realmSystems(this.cap);
    const vass = Object.entries(this.govs).filter(([k, v]) => Number(k) !== this.cap && v.lord !== null && v.lord !== undefined && this.isColonized(Number(k)) && this.realmOf(Number(k)) === this.cap).map(([, v]) => v);
    const avg = vass.length ? vass.reduce((k, v) => k + (v.loyalty ?? LOYALTY_START), 0) / vass.length : 0;
    const parts = [
      [`${this.realmName(this.cap)}の星系 (×10)`, 10 * sys.length],
      ['人口 (200百万人ごとに1)', Math.round(this.realmPop(this.cap) / 200)],
      ['家臣の平均の忠誠度 (×2)', Math.round(2 * avg)],
      ['果たした時代の課題 (×40)', 40 * this.stats.tasksDone],
      ['果たした挑戦 (×150)', 150 * this.challenges.filter((c) => c.status === 'done').length],
      ['独立を許した回数 (×−30)', -30 * this.stats.indepFromEarth],
      ['独立国が残っていない', this.independentRealms() === 0 ? 100 : 0],
    ];
    return { parts, total: parts.reduce((k, [, v]) => k + v, 0) };
  }
  endYearly() {
    if (!this.endYear || this.ended || this.year < this.endYear) return;
    this.ended = true;
    this.eachPlayer(() => {
    this.challengesYearly();
    this.finalScore = this.score();
    this.event('goal', this.cap, `${Math.round(this.endYear)}年、このゲームの終わりの年になった。点数 ${this.finalScore.total} (このまま続けて遊べる)`, true);
    });
  }
