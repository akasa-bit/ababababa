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
        { id: 'systems', target: 3, check: 'reach', deadline: START_YEAR + 50, label: JA`${START_YEAR + 50}年までに、${this.realmName(this.cap)}の星系を3つにする` },
        { id: 'routes', target: 3, check: 'reach', deadline: end, label: JA`${end}年までに、${this.realmName(this.cap)}の中の交易路を3本にする` },
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
        systems: JA`${end}年までに、${this.realmName(this.cap)}を${tk.target}星系にする`, routes: JA`${end}年までに、${this.realmName(this.cap)}の中の交易路を${tk.target}本にする`,
        pop: JA`${end}年までに、${this.realmName(this.cap)}の人口を${fmtPop(tk.target)}にする`, calm: JA`${end}年の時点で、不満を抱える家臣を0にする`,
        integrate: JA`${end}年までに、先住民を1つ市民として迎える`, subjugate: JA`${end}年までに、独立国を1つ従属させる`,
      }[tk.id];
    }
    return out;
  }
  erasYearly() {
    const n = Math.floor((this.year - START_YEAR) / ERA_YEARS + 1e-9);
    if (!this.era || this.era.n !== n) {
      let done = 0;
      for (const tk of this.era?.tasks || []) {
        if (tk.status === 'active') { tk.status = 'failed'; this.councilAdd(-10); this.event('goal', this.cap, JA`時代の課題を果たせなかった: ${tk.label} (議会の支持 −10)`); }
        if (tk.status === 'done') done++;
      }
      this.era = { n, tasks: this.eraTasks(n).map((tk) => ({ ...tk, status: 'active' })), bonus: this.era ? done : 0 };
      this.event('goal', this.cap, JA`${START_YEAR + ERA_YEARS * n}年、新しい時代が始まった。課題: ${this.era.tasks.map((tk) => tk.label).join(' / ')}${this.era.bonus ? JA`。前の時代の課題を ${this.era.bonus} つ果たしたので、この時代は政治力が年 +${2 * this.era.bonus}` : ''}`, true);
    }
    for (const tk of this.era.tasks) {
      if (tk.status !== 'active') continue;
      if (tk.check === 'reach' && this.taskMet(tk)) {
        tk.status = 'done'; tk.at = this.year; this.stats.tasksDone++;
        this.councilAdd(15);
        this.event('goal', this.cap, JA`時代の課題を果たした: ${tk.label} (議会の支持 +15)`, true);
      } else if (this.year >= tk.deadline) {
        if (tk.check === 'end' && this.taskMet(tk)) { tk.status = 'done'; tk.at = this.year; this.stats.tasksDone++; this.councilAdd(15); this.event('goal', this.cap, JA`時代の課題を果たした: ${tk.label} (議会の支持 +15)`, true); }
        else { tk.status = 'failed'; tk.at = this.year; this.councilAdd(-10); this.event('goal', this.cap, JA`時代の課題を果たせなかった: ${tk.label} (議会の支持 −10)`); }
      }
    }
  }
  // 最初の時代の「作戦の手引き」(B-043。QD-07 = b): 別のチュートリアルの画面は作らず、時代の課題に向けて手を 1 つずつ導く。
  // 状態を読むだけで、試合は変えない (画面からだけ呼ぶ)。地球が知っていることから作る
  guideSteps() {
    if ((this.era?.n ?? 0) > 0 || this.spectate) return null;
    const cap = this.cap;
    const own = this.knownOwnSystems().filter((s) => s.id !== cap);
    const sent = own.length > 0 || this.ships.some((s) => s.body !== undefined && this.realmOf(s.from) === cap) || this.knownProjects().some((j) => j.type === 'ship');
    const routed = this.routes.some((r) => r.a === cap || r.b === cap) || this.requests.some((q) => q.state === 'sending' && /^route/.test(q.act));
    const answered = this.decisions.some((d) => d.sentAt !== undefined); // 自分で返事を送ったもの (期限切れで現地が決めたものは数えない)
    const pick = sent ? null : this.guidePick();
    const col = own[0];
    const dec = this.visibleDecisions()[0];
    const went = this.ships.find((s) => s.body !== undefined && this.realmOf(s.from) === cap) || this.knownProjects().find((j) => j.type === 'ship');
    const steps = [
      { done: sent, label: pick ? JA`${distance(this.system(cap), this.system(pick.sys)).toFixed(1)} 光年の${pick.name}に入植船を送る` : went ? JA`${this.target(went.to, went.body).name}へ入植船を送った` : own.length ? JA`${own[0].name}に入植した` : '候補地のタブから、入植船を送る', pick },
      { done: routed, label: col ? JA`${col.name}と${this.system(cap).name}を交易路で結ぶ (星系の欄の「交易路」から)` : JA`入植船が着いたら、${this.system(cap).name}と交易路で結ぶ`, sys: col?.id },
      { done: answered, label: dec ? JA`届いた要求に返事をする (${this.system(dec.sys).name}。知らせの帯で答えを選ぶ)` : '星系から要求が届いたら、返事をする', sys: dec?.sys },
    ];
    if (steps.every((x) => x.done)) return null;
    return { steps, now: steps.findIndex((x) => !x.done), tasks: this.era?.tasks ?? this.eraTasks(0) };
  }
  // 手引きの最初の行き先: 候補地のおすすめ順 (candRec) のいちばん上 (首都と同じ星系と、送れない天体は除く)
  guidePick() {
    const from = this.system(this.cap);
    let best = null;
    for (const sys of this.galaxy.systems) {
      if (sys.id === from.id) continue;
      for (const b of sys.bodies) {
        if (!b.inHZ || b.type === 'belt' || this.knownColonyAt(sys.id, b.id, 'planet') || this.knownColonyAt(sys.id, b.id, 'station')) continue;
        const grade = b.settle?.grade || 0, kind = grade >= 1 ? 'planet' : 'station';
        if (!this.check(sys.id, b.id, kind).ok) continue;
        const r = candRec(grade, distance(from, sys));
        if (!best || r > best.r) best = { r, sys: sys.id, body: b.id, kind, name: b.name };
      }
    }
    return best;
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
      if (end && ok === null) ok = c.id === 'loyal' ? true : c.id === 'unify' ? this.independentRealms() === 0 && this.realmSystems(this.cap).length >= (CHALLENGES.unify.min || 0) : false;
      if (ok === null) continue;
      c.status = ok ? 'done' : 'failed';
      c.at = this.year;
      this.event('goal', this.cap, JA`挑戦「${CHALLENGES[c.id].label}」を${ok ? '果たした' : '果たせなかった'}`, ok);
    }
  }
  // 点数 (いつでも見られる。終わりの年に確定する)
  score() {
    const sys = this.realmSystems(this.cap);
    const vass = Object.entries(this.govs).filter(([k, v]) => Number(k) !== this.cap && v.lord !== null && v.lord !== undefined && this.isColonized(Number(k)) && this.realmOf(Number(k)) === this.cap).map(([, v]) => v);
    const avg = vass.length ? vass.reduce((k, v) => k + (v.loyalty ?? LOYALTY_START), 0) / vass.length : 0;
    const parts = [
      [JA`${this.realmName(this.cap)}の星系 (×10)`, 10 * sys.length],
      ['人口 (200百万人ごとに1)', Math.round(this.realmPop(this.cap) / 200)],
      ['家臣の平均の忠誠度 (×2)', Math.round(2 * avg)],
      ['果たした時代の課題 (×40)', 40 * this.stats.tasksDone],
      ['果たした挑戦 (×150)', 150 * this.challenges.filter((c) => c.status === 'done').length],
      ['独立を許した回数 (×−30)', -30 * this.stats.indepFromEarth],
      ['独立国が残っていない', this.independentRealms() === 0 ? 100 : 0],
    ];
    return { parts, total: parts.reduce((k, [, v]) => k + v, 0) };
  }
  // 結末の型 (B-058): 終わりの年の銀河の形から、4 つの型のどれかと、その原因の内訳を出す (状態を読むだけ。自動対戦の道具からも呼べる)。
  // 衰え = ほかの国が自国の 1.5 倍以上 (または自国が銀河の 1 割未満)。連邦への移行 = 家臣 3 つ以上の半分以上が自治の型
  // (入植者の自治・法と交易だけ)。帝国の維持 = 自国がほかのどの国の 1.5 倍以上で、独立は 3 回まで。どれでもなければ、多くの国の均衡
  ending() {
    const cap = this.cap;
    const sizes = new Map();
    for (const x of this.colonizedSystems()) { const r = this.realmOf(x.id); sizes.set(r, (sizes.get(r) || 0) + 1); }
    const total = [...sizes.values()].reduce((a, b) => a + b, 0) || 1;
    const own = sizes.get(cap) || 0, share = own / total;
    const [rival, rivalN] = [...sizes.entries()].filter(([r]) => r !== cap).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const vass = this.realmSystems(cap).filter((x) => x.id !== cap && this.gov(x.id).lord !== null && this.gov(x.id).lord !== undefined);
    const fam = {};
    for (const x of vass) { const f = this.gov(x.id).direct ? 'colony' : REGIMES[regimeKey(this.gov(x.id))]?.family || 'colony'; fam[f] = (fam[f] || 0) + 1; }
    const loose = vass.length ? ((fam.settler || 0) + (fam.legal || 0)) / vass.length : 0;
    const indep = this.stats.indepFromEarth;
    const loyal = vass.length ? vass.reduce((a, x) => a + (this.gov(x.id).loyalty ?? LOYALTY_START), 0) / vass.length : null;
    const far = vass.length ? vass.reduce((a, x) => a + this.sysDist(cap, x.id), 0) / vass.length : 0;
    const big = [...sizes.values()].filter((n) => n / total >= 0.1).length;
    const type = rivalN >= 1.5 * own || share < 0.1 ? 'decline' : vass.length >= 3 && loose >= 0.5 ? 'federation' : own >= 1.5 * rivalN && indep <= 3 ? 'empire' : 'balance';
    const causes = [
      [JA`${this.realmName(cap)}の星系`, `${own} / ${total} (${Math.round(share * 100)}%)`],
      ['いちばん大きいほかの国', rival === null ? 'なし' : JA`${this.realmName(rival)} ${rivalN} 星系`],
      ['銀河の 1 割以上を持つ国', JA`${big} か国`],
      ['独立を許した回数', JA`${indep} 回`],
      ['家臣の平均の忠誠度', loyal === null ? '家臣なし' : `${Math.round(loyal)}`],
      ['家臣までの平均の距離 (通信の遅れ)', vass.length ? JA`${far.toFixed(1)} 光年 (指令の往復 ${(2 * far).toFixed(0)} 年)` : '—'],
      ['家臣の統治の型', Object.entries(fam).map(([f, n]) => `${VASSAL_FAMILIES[f] || f} ${n}`).join('・') || '—'],
    ];
    return { type, ...ENDINGS[type], share, own, total, indep, loose, causes };
  }
  endYearly() {
    if (!this.endYear || this.ended || this.year < this.endYear) return;
    this.ended = true;
    this.eachPlayer(() => {
    this.challengesYearly();
    this.finalScore = this.score();
    this.event('goal', this.cap, JA`${Math.round(this.endYear)}年、このゲームの終わりの年になった。点数 ${this.finalScore.total} (このまま続けて遊べる)`, true);
    });
  }
