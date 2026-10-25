  // --- 国家間の戦争 ---
  declareWar(root) {
    if (root === this.cap || this.realmOf(root) !== root || this.atWar(this.cap, root)) return fail('宣戦できない');
    this.beginWar(this.cap, root, this.cap);
    this.event('politics', this.cap, `${this.realmName(root)}に宣戦した (相手は攻め落とされるまで降伏しない)`);
    return { ok: true };
  }
  // 講和の申し入れ (光速の指令として相手の首都へ届く)。相手の艦隊が地球の国より少なければ受け入れ、そうでなくても30%
  // 相手が人間の国なら申し入れとして届き、相手が応じるのを待つ。AI の国は戦勝点と戦争疲弊で決める:
  // こちらが勝っていれば (相手が負けていれば) 応じやすく、相手が勝っていても相手が疲れていれば応じる
  offerPeace(root) {
    if (!this.atWar(this.cap, root) || this.realmOf(root) !== root) return fail('交戦中ではない');
    const key = this.warKey(this.cap, root);
    if (this.isHuman(root)) {
      this.postPeaceOffer(key, this.cap, root, this.year); // 指令として相手の首都に届いてから申し入れるので、もう届いている
      this.event('politics', root, `${this.realmName(this.cap)}が${this.realmName(root)}に講和を申し入れた (戦勝点 ${this.warScore(this.cap, root)})`, true);
      return { ok: true };
    }
    if (this.rand() < this.peaceChance(root, this.cap)) {
      this.makePeace(this.cap, root, root); // 講和の申し入れを受けた相手の首都で結ばれる
      return { ok: true };
    }
    return fail(`講和を拒否された (戦勝点 ${this.warScore(this.cap, root)}・相手の戦争疲弊 ${Math.round(this.exhaustion[root] || 0)})`);
  }
  // AI の国 r が、敵 e からの講和に応じる確率
  peaceChance(r, e) {
    if (BARGAIN.on) return this.warScore(r, e) >= this.reservation(r, e) ? PEACE.max : PEACE.min; // 受け入れる線を上回っていれば応じる
    const ws = this.warScore(r, e), ex = this.exhaustion[r] || 0;
    return clamp(ws <= 0 ? PEACE.base - ws / PEACE.loseWs + ex / PEACE.exLose : PEACE.winBase + ex / PEACE.exWin - ws / PEACE.winWs, PEACE.min, PEACE.max);
  }
  // 終戦。from = 講和の結ばれた星系 (終戦の知らせはここから光速で広がる)。
  // 各地の艦隊戦・攻囲は、終戦の知らせが攻める側の主星を経て届くまで続く (fightingAt)
  endWar(a, b, from = this.isHuman(a) ? b : a) {
    const key = this.warKey(a, b);
    if (this.realmWars[key] !== undefined) {
      this.peaces.push({ key, a, b, year: this.year, from, start: this.realmWars[key], by: this.warBy[key], news: this.warNews[key] });
    }
    this.peaces = this.peaces.filter((r) => this.year - r.year < 400);
    delete this.realmWars[key];
    delete this.warBy[key];
    delete this.warNews[key];
  }
  withdraw(g) {
    this.sieges = this.sieges.filter((x) => x !== g);
    const home = this.realmSystems(g.realm).sort((a, b) => distance(a, this.system(g.sys)) - distance(b, this.system(g.sys)))[0];
    if (home && g.ships > 0) this.pushFleet({ id: this.nextShipId++, from: g.sys, to: home.id, n: g.ships, owner: g.realm, auto: true, depart: this.year, arrive: this.year + this.fleetYears(g.sys, home.id) });
  }
  // 艦隊の到着。自国なら駐留 (戦闘中なら防衛に加わる)、交戦中の国の星系なら艦隊戦か攻囲になる
  fleetArrives(f) {
    if (f.strike) return this.strikeArrives(f); // 光速の一撃 (ship/strike.js)
    const owner = f.owner ?? 0;
    const name = this.system(f.to).name;
    // 入植していない星系に他国の艦隊がいる: 交戦中なら艦隊戦 (一度に解く)、そうでなければ引き返す
    if (!this.isColonized(f.to) && (this.garrison[f.to] || 0) > 0 && this.stackRealm(f.to) !== owner) {
      const other = this.stackRealm(f.to);
      if (!this.atWar(owner, other)) {
        this.pushFleet({ ...f, id: this.nextShipId++, from: f.to, to: f.from, depart: this.year, arrive: this.year + this.fleetYears(f.to, f.from), surprise: false, route: undefined });
        this.message(`${f.n} 艦隊は ${name} に${this.realmName(other)}の艦隊がいるので引き返した`, f.to);
        return;
      }
      // 入植していない星系での艦隊戦は、着いた時点で一度に解く (同じ撃ち合い。退く先は、それぞれの国のいちばん近い入植星系)
      const b = { sys: f.to, realm: owner, a: f.n, d: this.garrison[f.to] || 0, a0: f.n, d0: this.garrison[f.to] || 0, start: this.year, ua: [], ud: [], luck: [this.battleLuck(BATTLE.luck), this.battleLuck(BATTLE.luck)], mor: [this.battleLuck(BATTLE.morale), this.battleLuck(BATTLE.morale)], sunk: [0, 0], esc: [0, 0] };
      b.odds = this.battleOdds(b.a, b.d, this.battleEff(b, 0), this.battleEff(b, 1));
      this.battleSync(b);
      const home = this.retreatHome(other, f.to);
      const eff = [this.battleEff(b, 0) * b.luck[0], this.battleEff(b, 1) * b.luck[1]], out = { sunk: [0, 0], esc: [0, 0] }, u = [b.ua, b.ud];
      for (let r = 0; r < BATTLE.rounds * 20 && this.battleRound(u, eff, b.mor, () => this.rand(), [true, home !== undefined], out); r++);
      [b.ua, b.ud] = u;
      this.battleCount(b, out, other, home);
      const win = b.ua.some((x) => x[2] < 0);
      const fin = { sunk: [0, 0], esc: [0, 0] };
      if (win) { fin[home !== undefined ? 'esc' : 'sunk'][1] = b.ud.length; b.ud = []; } else { fin.esc[0] = b.ua.length; b.ua = []; }
      this.battleCount(b, fin, other, home);
      const left = win ? b.ua.length : b.ud.length;
      const rep = this.battleReport(b, win, other);
      this.garrison[f.to] = left;
      if (win) this.setStackOwner(f.to, owner);
      this.event('battle', f.to, `${name} で${this.realmName(owner)}の ${f.n} 艦隊と${this.realmName(other)}の艦隊が戦い、${this.realmName(win ? owner : other)}が勝った (${rep.text}、残り ${left} 艦隊)`, this.isHuman(owner) || this.isHuman(other));
      if (!win || left < 1) return;
      this.held[f.to] = left;
      this.continueRoute(f.to, left, f.route, f.chain ?? f.id);
      return;
    }
    if (!this.isColonized(f.to)) this.setStackOwner(f.to, owner);
    const destRealm = this.isColonized(f.to) ? this.realmOf(f.to) : owner;
    const b = this.battleAt(f.to);
    if (destRealm === owner) {
      if (b && b.realm !== owner) { b.d += f.n; b.d0 += f.n; this.message(`${f.n} 艦隊が ${name} の艦隊戦に防衛側で加わった`, f.to); return; }
      const sg = this.sieges.find((g) => g.sys === f.to && g.realm === owner);
      if (sg) { sg.ships += f.n; if (f.route?.length) sg.route ??= f.route; return; }
      this.garrison[f.to] = (this.garrison[f.to] || 0) + f.n;
      // 地球が命じて送った艦隊の来訪は関与になる (自動防衛配備・威圧の艦隊は数えない)
      if (this.isHuman(owner) && !f.auto && !f.awe && !f.aweBack && this.isColonized(f.to)) this.attend(f.to);
      if (f.awe) this.awe[f.to] = (this.awe[f.to] || 0) + f.n;
      else if (!f.auto) this.held[f.to] = (this.held[f.to] || 0) + f.n;
      this.message(`${f.n} 艦隊が ${name} に到着した${f.route?.length ? ` (経由地。次は ${this.system(f.route[0]).name})` : ''}`, f.to);
      this.continueRoute(f.to, f.n, f.route, f.chain ?? f.id);
      return;
    }
    if (!this.fightingAt(owner, destRealm, f.to) && f.surprise) {
      // 奇襲攻撃: 着いた時点で戦争を始め、そのまま艦隊戦 (守りがいなければ攻囲) に入る。開戦の知らせはこの星系から広がる
      this.beginWar(owner, destRealm, f.to);
      this.event('battle', f.to, `${this.realmName(owner)}の ${f.n} 艦隊が ${name} に奇襲攻撃をかけた。${this.realmName(destRealm)}との戦争が始まった`, false);
    }
    if (!this.fightingAt(owner, destRealm, f.to)) {
      this.pushFleet({ ...f, id: this.nextShipId++, from: f.to, to: f.from, depart: this.year, arrive: this.year + this.fleetYears(f.to, f.from), surprise: false, route: undefined });
      this.message(`${f.n} 艦隊は ${name} (${this.realmName(destRealm)}) と交戦中ではないので入れず、引き返した (攻め込むには先に宣戦する)`, f.to);
      return;
    }
    if (b && b.realm === owner) { b.a += f.n; b.a0 += f.n; if (f.route?.length) b.route ??= f.route; this.message(`${f.n} 艦隊が ${name} の艦隊戦に攻撃側で加わった`, f.to); return; }
    const sg = this.sieges.find((g) => g.sys === f.to && g.realm === owner);
    // 経由地の指令 (route) は艦隊戦・攻囲のあいだも保たれ、攻め落としたら次の経由地へ向かう
    const route = f.route?.length ? f.route : sg?.route;
    if ((this.garrison[f.to] || 0) > 0 || this.fortLevel(f.to) > 0) { // 艦隊か宇宙要塞がいれば艦隊戦
      if (sg) this.sieges = this.sieges.filter((g) => g !== sg);
      this.startBattle(f.to, owner, f.n + (sg ? sg.ships : 0), sg ? sg.progress : 0, route);
    } else if (sg) { sg.ships += f.n; if (route) sg.route = route; }
    else {
      this.sieges.push({ sys: f.to, realm: owner, ships: f.n, progress: 0, start: this.year, route });
      this.event('battle', f.to, `${name} に守りの艦隊はなく、${this.realmName(owner)}の ${f.n} 艦隊が攻囲を始めた`, this.isHuman(owner) || this.isHuman(destRealm));
    }
  }
  // 艦隊戦 (B-034。BATTLE の説明は ship/war-consts.js): 両軍の艦を 1 つずつ動かす撃ち合いを、時間をかけて解く。
  // 戦闘中に着いた艦隊や星系で造られた艦隊は、その場で新しい艦として加わる。b.a・b.d は、戦場に残っている艦 (退いている途中を含む) の数
  battleAt(sys) { return this.battles.find((b) => b.sys === sys); }
  startBattle(sys, realm, ships, progress, route) {
    const d = this.garrison[sys] || 0;
    this.garrison[sys] = 0;
    const b = { sys, realm, a: ships, d, a0: ships, d0: d, start: this.year, progress: progress || 0, route, ua: [], ud: [], luck: [this.battleLuck(BATTLE.luck), this.battleLuck(BATTLE.luck)], mor: [this.battleLuck(BATTLE.morale), this.battleLuck(BATTLE.morale)], sunk: [0, 0], esc: [0, 0], rounds: 0 };
    this.battles.push(b);
    const fl = this.fortLevel(sys);
    const p = this.battleOdds(ships, d, this.battleEff(b, 0), this.battleEff(b, 1), fl);
    b.odds = p;
    this.event('battle', sys, `${this.system(sys).name} で艦隊戦が始まった (攻撃 ${this.realmName(realm)} ${ships} 艦隊 対 防衛 ${d} 艦隊${fl ? `・宇宙要塞 Lv${fl}` : ''}。攻撃側の勝つ見込み ${Math.round(p * 100)}%)`, this.isHuman(realm) || this.isHuman(this.realmOf(sys)));
  }
  battleLuck(w) { return GM.exp(w * this.randNormal()); }
  // 側 s (0 = 攻撃・1 = 防衛) の兵站と国の補正 (攻撃側は補給線の長さと補給の充足率、防衛側は補給の充足率)
  battleEff(b, s) {
    const def = this.isColonized(b.sys) ? this.realmOf(b.sys) : this.stackRealm(b.sys);
    return s === 0 ? this.fleetEff(b.sup, b.line) * this.fleetMul(b.realm, b.sys) : this.fleetEff(b.dsup, 0) * this.fleetMul(def, b.sys);
  }
  // 撃ち合いを 1 回。u = [攻撃側の艦, 防衛側の艦] (艦 = [耐久, 組織力, 退くまでの回数 (−1 = 戦っている)])、
  // eff = 両軍の補正 (兵站 × 国 × 戦機)、mor = 両軍の士気、rnd = 乱数 (0〜1)、canRet = 退ける側。沈んだ数・離れた数を out に足す
  battleRound(u, eff, mor, rnd, canRet, out) {
    const F = [u[0].filter((x) => x[2] < 0), u[1].filter((x) => x[2] < 0)];
    if (!F[0].length || !F[1].length) return false;
    const hits = [[], []];
    for (const s of [0, 1]) {
      const pos = 1 / (1 + BATTLE.pos * Math.max(0, F[s].length / F[1 - s].length - 1));
      const tgt = u[1 - s];
      for (const x of F[s]) if (rnd() < Math.min(0.95, BATTLE.hit * pos * eff[s] * (0.5 + 0.5 * Math.max(0, x[1])))) hits[1 - s].push(tgt[Math.floor(rnd() * tgt.length)]);
    }
    for (const s of [0, 1]) {
      for (const t of hits[s]) { t[0] -= BATTLE.dmg * (0.5 + rnd()); if (!t[3]) t[1] -= (BATTLE.org * (0.5 + rnd())) / mor[s]; } // 要塞の区画 (t[3]) は組織力が減らない
      const keep = [];
      for (const x of u[s]) {
        if (x[0] <= 0) { if (x[3]) out.fort = (out.fort || 0) + 1; else out.sunk[s]++; continue; }
        if (x[2] === 0) { out.esc[s]++; continue; }
        if (x[2] > 0) x[2]--;
        else if (canRet[s] && !x[3] && x[1] < BATTLE.orgRet) x[2] = BATTLE.retRounds; // 要塞は退かない
        keep.push(x);
      }
      u[s] = keep;
    }
    return true;
  }
  // 攻撃 na 艦隊が防衛 nd 艦隊に勝つ見込み (補正 ea・ed)。同じ形の戦いを、試合の乱数とは別の乱数で 64 回解いて数える (画面に出すだけ。試合の筋は変えない)
  battleOdds(na, nd, ea = 1, ed = 1, nf = 0) {
    na = Math.round(na); nd = Math.round(nd);
    if (nd < 1 && nf < 1) return 1;
    if (na < 1) return 0;
    let st = hashSeed(`${na}/${nd}/${ea.toFixed(3)}/${ed.toFixed(3)}${nf ? `/${nf}` : ''}`);
    const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const nrm = () => Math.sqrt(-2 * GM.log(1 - rnd())) * GM.cos(2 * Math.PI * rnd());
    let win = 0;
    const N = 64;
    for (let k = 0; k < N; k++) {
      const u = [Array.from({ length: Math.min(na, 300) }, () => [1, 1, -1]), [...Array.from({ length: Math.min(nd, 300) }, () => [1, 1, -1]), ...Array.from({ length: nf }, () => [FORT.hp, 1, -1, 1])]];
      const eff = [ea * GM.exp(BATTLE.luck * nrm()), ed * GM.exp(BATTLE.luck * nrm())], mor = [GM.exp(BATTLE.morale * nrm()), GM.exp(BATTLE.morale * nrm())];
      const out = { sunk: [0, 0], esc: [0, 0] };
      for (let r = 0; r < BATTLE.rounds * 20 && this.battleRound(u, eff, mor, rnd, [true, true], out); r++);
      if (u[0].some((x) => x[2] < 0) && !u[1].some((x) => x[2] < 0)) win++;
    }
    return win / N;
  }
  // 戦っている艦の数を b.a・b.d に合わせる (増えた分は、着いた艦隊・造られた艦隊。古いセーブの艦隊戦は、ここで艦を作る)
  battleSync(b) {
    b.ua ??= []; b.ud ??= []; b.sunk ??= [0, 0]; b.esc ??= [0, 0];
    b.luck ??= [1, 1]; b.mor ??= [1, 1];
    for (const [k, u] of [['a', b.ua], ['d', b.ud]]) while (u.filter((x) => !x[3]).length < Math.round(b[k])) u.push([1, 1, -1]);
    // 宇宙要塞: 戦いの始めに、段の数だけ区画を防衛側に加える (FORT)
    if (b.fortIn === undefined) { b.fortIn = this.isColonized(b.sys) ? this.fortLevel(b.sys) : 0; for (let i = 0; i < b.fortIn; i++) b.ud.push([FORT.hp, 1, -1, 1]); }
  }
  // 防衛側の艦が退く先: 守る国の、この星系のほかでいちばん近い入植星系 (なければ退けない)
  retreatHome(realm, sys) {
    let best = null;
    for (const x of this.realmSystems(realm)) { if (x.id === sys) continue; const d = this.sysDist(x.id, sys); if (!best || d < best.d) best = { id: x.id, d }; }
    return best?.id;
  }
  battlesStep(dt) {
    for (const b of [...this.battles]) {
      if (!this.fightingAt(b.realm, this.realmOf(b.sys), b.sys)) { // 終戦の知らせが届いた: 防衛側は駐留に戻り、攻撃側は引き揚げる
        this.event('battle', b.sys, `${this.system(b.sys).name} の艦隊戦は、終戦の知らせが届いて終わった`, this.isHuman(b.realm) || this.isHuman(this.realmOf(b.sys)));
        this.battles = this.battles.filter((x) => x !== b);
        this.garrison[b.sys] = (this.garrison[b.sys] || 0) + Math.round(b.d);
        this.withdraw({ sys: b.sys, realm: b.realm, ships: Math.round(b.a) });
        continue;
      }
      b.d += this.garrison[b.sys] || 0;
      b.d0 += this.garrison[b.sys] || 0;
      this.garrison[b.sys] = 0;
      this.battleSync(b);
      const defender = this.realmOf(b.sys);
      const home = this.retreatHome(defender, b.sys);
      const eff = [this.battleEff(b, 0) * b.luck[0], this.battleEff(b, 1) * b.luck[1]];
      const out = { sunk: [0, 0], esc: [0, 0] };
      const u = [b.ua, b.ud];
      const n = Math.max(1, Math.round(dt * BATTLE.rounds));
      let going = true;
      for (let i = 0; i < n && going; i++) { going = this.battleRound(u, eff, b.mor, () => this.rand(), [true, home !== undefined], out); b.rounds = (b.rounds || 0) + 1; }
      [b.ua, b.ud] = u;
      this.battleCount(b, out, defender, home);
      if (going) continue;
      this.battleEnd(b, defender, home);
    }
  }
  // 撃ち合いで沈んだ艦・離れた艦を数える: 沈んだ艦は戦勝点と戦死者に、離れた艦は近くの自国の星系へ戻る
  battleCount(b, out, defender, home) {
    for (const s of [0, 1]) { b.sunk[s] += out.sunk[s]; b.esc[s] += out.esc[s]; }
    if (out.sunk[0]) { this.warLoss(defender, b.realm, out.sunk[0], b.sys); this.warDead(b.realm, defender, out.sunk[0] * BATTLE.crew); }
    if (out.sunk[1]) { this.warLoss(b.realm, defender, out.sunk[1], b.sys); this.warDead(defender, b.realm, out.sunk[1] * BATTLE.crew); }
    if (out.esc[0]) this.withdraw({ sys: b.sys, realm: b.realm, ships: out.esc[0] });
    if (out.esc[1] && home !== undefined) this.pushFleet({ id: this.nextShipId++, from: b.sys, to: home, n: out.esc[1], owner: defender, auto: true, depart: this.year, arrive: this.year + this.fleetYears(b.sys, home) });
    if (out.fort) { b.fortLost = (b.fortLost || 0) + out.fort; this.forts[b.sys] = Math.max(0, this.fortLevel(b.sys) - out.fort); }
    b.a = b.ua.length; b.d = b.ud.filter((x) => !x[3]).length; // 要塞の区画は艦隊に数えない
  }
  // 艦隊戦の終わり: 戦っている艦が残った側の勝ち。負けた側の、退いている途中の艦は離れきる
  battleEnd(b, defender, home) {
    this.battles = this.battles.filter((x) => x !== b);
    const win = b.ua.some((x) => x[2] < 0);
    const out = { sunk: [0, 0], esc: [0, 0] };
    const ships = b.ud.filter((x) => !x[3]).length;
    if (win) { out.esc[1] = home !== undefined ? ships : 0; out.sunk[1] = home !== undefined ? 0 : ships; b.ud = []; }
    else { out.esc[0] = b.ua.length; b.ua = []; }
    this.battleCount(b, out, defender, home);
    const name = this.system(b.sys).name;
    const left = win ? b.ua.length : b.ud.filter((x) => !x[3]).length;
    const rep = this.battleReport(b, win, defender);
    const mine = this.isHuman(b.realm) || this.isHuman(defender);
    if (win) {
      this.sieges.push({ sys: b.sys, realm: b.realm, ships: left, progress: b.progress || 0, start: this.year, route: b.route });
      this.event('battle', b.sys, `${name} の艦隊戦で攻撃側 (${this.realmName(b.realm)}) が勝った (${rep.text}、${left} 艦隊が残る)。攻囲が始まる`, mine);
    } else {
      this.garrison[b.sys] = (this.garrison[b.sys] || 0) + left;
      this.event('battle', b.sys, `${name} の艦隊戦で攻撃側 (${this.realmName(b.realm)}) が退いた (${rep.text}、防衛側は ${left} 艦隊が残る)`, mine);
    }
  }
  // 戦いの報告 (勝つ見込みと損害の内訳)。新しい順に残す
  battleReport(b, win, defender) {
    const r = {
      sys: b.sys, a: b.realm, d: defender, start: b.start, end: this.year, a0: Math.round(b.a0), d0: Math.round(b.d0), win: win ? 1 : 0, odds: b.odds ?? null,
      ...(b.fortIn ? { fort: [b.fortIn, b.fortLost || 0] } : {}), sunk: [...b.sunk], esc: [...b.esc], dead: (b.sunk[0] + b.sunk[1]) * BATTLE.crew, eff: [+this.battleEff(b, 0).toFixed(2), +this.battleEff(b, 1).toFixed(2)], luck: b.luck.map((x) => +x.toFixed(2)), mor: b.mor.map((x) => +x.toFixed(2)),
    };
    this.battleReports.unshift(r);
    this.battleReports.length = Math.min(this.battleReports.length, BATTLE.reports);
    this.battleDone(r);
    return { ...r, text: battleText(r) };
  }
  battleDone() {} // 道具 (tools/battles-headless.js) が戦いの記録を集めるところ
  // 戦死者を数える (by = 死者の出た国、e = 相手)
  warDead(by, e, n) {
    if (n <= 0) return;
    const st = this.warStats[this.warKey(by, e)];
    if (st) st.dead = (st.dead || 0) + n;
  }
  // 攻囲: 年に、攻囲艦隊 ÷ (艦隊 + 地上の抵抗) × 0.12 ずつ進み、100% で降伏。地上の抵抗 = 歩兵 + 4×log10(1+人口)
  // 降伏した星系は、攻めた国の首都に直接従属する (その星系に従属していた星系も一緒に移る)
  siegesYearly() {
    for (const g of [...this.sieges]) {
      if (!this.fightingAt(g.realm, this.realmOf(g.sys), g.sys) || g.ships < 1) {
        if (g.ships >= 1) this.event('battle', g.sys, `終戦の知らせが届き、${this.system(g.sys).name} の攻囲を解いて引き揚げた`, this.isHuman(g.realm) || this.isHuman(this.realmOf(g.sys)));
        this.withdraw(g);
        continue;
      }
      // 守りの艦隊が造られたり届いたりしたら、攻囲を中断して艦隊戦になる (進捗は艦隊戦に勝てば引き継ぐ)
      if ((this.garrison[g.sys] || 0) > 0 || this.fortLevel(g.sys) > 0) { this.sieges = this.sieges.filter((x) => x !== g); this.startBattle(g.sys, g.realm, g.ships, g.progress, g.route); continue; }
      const pop = this.coloniesIn(g.sys).reduce((k, c) => k + c.pop, 0);
      const ground = this.troopPower(g.sys) + 4 * GM.log10(1 + pop);
      // 兵站: 補給線が長いほど・補給が足りないほど攻囲は遅れる。戦力が6割を切ると、年に5%ずつ艦隊が脱落する
      const eff = this.fleetEff(g.sup, g.line) * this.fleetMul(g.realm, g.sys);
      if (eff < 0.6) {
        g.wear = (g.wear || 0) + 0.05 * g.ships;
        while (g.wear >= 1 && g.ships >= 1) { g.wear -= 1; g.ships -= 1; }
        if (g.ships < 1) {
          this.event('battle', g.sys, `補給が続かず、${this.system(g.sys).name} を攻囲していた ${this.realmName(g.realm)}の艦隊が崩れた`, this.isHuman(g.realm) || this.isHuman(this.realmOf(g.sys)));
          this.sieges = this.sieges.filter((x) => x !== g);
          continue;
        }
      }
      // 攻囲された星系の住民は、年 BATTLE.siegeDead ずつ亡くなる (補給を断たれた飢えと病。戦死者に数える)
      let dead = 0;
      for (const c of this.coloniesIn(g.sys)) { const k = c.pop * BATTLE.siegeDead; c.pop -= k; dead += k * 1e6; }
      this.warDead(this.realmOf(g.sys), g.realm, dead);
      g.progress = Math.min(1, g.progress + 0.12 * eff * g.ships / (g.ships + ground));
      if (this.troopPower(g.sys) >= 1) this.loseTroops(g.sys, 1);
      if (g.progress < 1) continue;
      const oldRealm = this.realmOf(g.sys);
      this.warTake(g.realm, oldRealm, g.sys);
      const gv = this.gov(g.sys);
      gv.lord = g.realm;
      gv.independent = false;
      gv.loyalty = 30;
      gv.friend = 0;
      this.garrison[g.sys] = g.ships;
      this.held[g.sys] = (this.held[g.sys] || 0) + g.ships; // 攻め落とした艦隊はそのまま駐留する
      this.sieges = this.sieges.filter((x) => x !== g);
      this.event('battle', g.sys, `${this.system(g.sys).name} が降伏し、${this.realmName(g.realm)}に従属した`, this.isHuman(g.realm));
      // 経由地の指令が残っていれば次へ。攻め落とした星系には守りとして2割 (最低1艦隊) を残す
      if (g.route?.length) {
        const keep = g.ships >= 2 ? Math.max(1, Math.round(g.ships * 0.2)) : 0;
        if (g.ships - keep >= 1) this.continueRoute(g.sys, g.ships - keep, g.route);
      }
      if (oldRealm === g.sys) this.cleanWars(); // 首都が落ちればその国は終わり、戦争も終わる
    }
  }
  // 海賊対策の建艦 (年1回、星系政府の自動開発より先): 海賊が現れる5年前から、各星系の政府は自分の資金で
  // 軍事基地を建て、駐留艦隊 + 向かっている艦隊 + 編成中が海賊の最大戦力に届くまで年1艦隊ずつ編成する
  // (海賊対策を優先するので、資金が費用の1.2倍以上あれば)。太陽系は海賊に狙われないので対象外 (観戦モードの地球政府は自動防衛配備で対応する)
  pirateDefenseYearly() {
    const base = Math.max(1, this.pirateMax());
    for (const s of this.colonizedSystems()) {
      const id = s.id;
      if (this.isHuman(id)) continue;
      const gv = this.gov(id);
      // 委任方針が軍備なら、海賊の最大戦力より2艦隊多く置く (海賊が現れる前から)
      if (this.year < PIRATE_START - 5 && gv.mandate !== 'arm') continue;
      const goal = base + (gv.mandate === 'arm' ? 2 : 0);
      const g = this.garrison[id] || 0;
      const have = g - Math.min(g, this.awe[id] || 0) + this.incoming(id) + queuedWarships(this.projects, id);
      if (have >= goal) continue;
      if (!this.hasShipyard(id)) {
        const big = this.coloniesIn(id).sort((a, b) => b.pop - a.pop)[0];
        if (big && this.funds(id) >= 1.2 * this.upgradeCost(big, 'shipyard').credits && !this.procure(this.upgradeCost(big, 'shipyard'), id).why) this.upgrade(big, 'shipyard');
      } else if (this.funds(id) >= 1.2 * WARSHIP_COST.credits && !this.procure(WARSHIP_COST, id).why) this.buildWarship(id);
    }
  }
  // 独立国の軍備 (年1回、星系政府の自動開発より先): どの独立国も星系ごとに軍事基地を建て、平時は守りの艦隊 (首都5・他3) を保つ。
  // 交戦中は資金の許すかぎり艦隊を編成する
  realmsArm() {
    for (const [key, gv0] of Object.entries(this.govs)) {
      const root = Number(key);
      if (this.isHuman(root) || !gv0.independent || this.realmOf(root) !== root || !this.isColonized(root)) continue;
      const war = this.aiEnemiesOf(root).length > 0;
      for (const x of this.realmSystems(root)) {
        const gv = this.gov(x.id);
        const big = this.coloniesIn(x.id).sort((a, b) => b.pop - a.pop)[0];
        const goal = x.id === root ? 5 : 3;
        if (!this.hasShipyard(x.id)) { if (big && this.funds(x.id) >= 2 * this.upgradeCost(big, 'shipyard').credits) this.upgrade(big, 'shipyard'); }
        else if (this.funds(x.id) >= 2 * WARSHIP_COST.credits && (war || (this.garrison[x.id] || 0) + queuedWarships(this.projects, x.id) < goal)) this.buildWarship(x.id);
        // 戦争中の首都は、資金に余裕があれば宇宙要塞を FORT.aiGoal まで上げる
        if (war && x.id === root && this.fortLevel(root) < FORT.aiGoal && this.funds(root) >= 3 * this.fortCost(root).credits && !this.pending((j) => j.type === 'fort' && j.sys === root)) this.fortUpgrade(root);
      }
    }
  }
  // 国ごとの降伏: 首都が勝った国の首都に従属し、配下の星系もそのまま移る
  surrender(root, winner = 0) {
    const n = this.realmSystems(root).length;
    this.endWar(root, winner, root);
    const gv = this.gov(root);
    gv.lord = winner;
    gv.independent = false;
    gv.loyalty = 30;
    gv.friend = 0;
    gv.orders = 0;
    gv.attended = this.year;
    gv.unrest = { stage: 0 };
    this.asRealm(winner, () => { this.stats.subjugated++; this.councilAdd(10); });
    this.cleanWars();
    this.event('politics', root, `${this.realmName(root)}が降伏し、${this.realmName(winner)}に従属した${n > 1 ? ` (配下の ${n - 1} 星系も従う)` : ''}`, this.isHuman(winner));
  }
  // 独立国の戦争の判断 (年1回)
  // - 交戦中の国の手薄な星系 (20光年以内) を、いちばん艦隊の多い星系から攻める (年1回)
  // - 自分から仕掛けた戦争で大差で負けていれば降伏する: 開戦から5年以上・相手の戦力が5倍以上で年8%。仕掛けられた側は降伏しない
  // - 20年以上たっても互いに2倍の差がつかなければ年5%で講和 (地球から仕掛けた戦争は除く。それは地球が決める)
  // - どことも戦っていなければ、首都から25光年以内の独立国で、自分の1.5倍より弱いところへ年3%の確率で宣戦する
  // (BARGAIN.on のときは、講和と宣戦を上の 3 つの代わりに交渉の型で決める。攻める先の選び方は同じ)
  // --- 交渉の型 (BARGAIN) ---
  // 読み違い (平均 0・分散 1 に近い、一様乱数 4 つの和)
  misread() { return (this.rand() + this.rand() + this.rand() + this.rand() - 2) * 1.7320508075688772; }
  // 国 r から見た、国 e の艦隊の伸び (光が届いている分の、shiftYears 年の年率)。自分のものは遅れなし
  seenGrowth(r, e) {
    const t = this.year - (r === e ? 0 : this.sysDist(r, e));
    const now = this.shipsAt(e, t), then = this.shipsAt(e, t - BARGAIN.shiftYears);
    return now === null || then === null ? 0 : (now - then) / Math.max(1, then) / BARGAIN.shiftYears;
  }
  shipsAt(e, t) {
    let v = null;
    for (const [y, n] of this.shipHist[e] || []) { if (y <= t + 1e-9) v = n; else break; }
    return v;
  }
  // 国 r が戦争 (相手 e) で受け入れる線 (r の取り分の戦勝点、−100〜100)。z を渡せば、その読み違いで (宣戦の見込み)
  reservation(r, e, z = this.warStats[this.warKey(r, e)]?.z?.[r] ?? 0, ws = this.warScore(r, e)) {
    const ours = this.realmShips(r);
    const theirs = (this.seenShips(r, e) + this.pactAllyShips(r, e)) * GM.exp(z * (BARGAIN.sigma0 + BARGAIN.sigmaAge * this.sysDist(r, e))); // 相手の同盟国の艦隊も (政治。B-026)
    let p = (ours + 0.5) / (ours + theirs + 1);
    const st = this.warSeen(r, this.warKey(r, e)); // 首都に届いた戦果で
    if (st && this.atWar(r, e)) {
      const a = st.k[r] || 0, b = st.k[e] || 0, n = a + b;
      p = (BARGAIN.learn * p + n * (a + 1) / (n + 2)) / (BARGAIN.learn + n); // 戦いながら分かっていく
    }
    if (this.atWar(r, e) && p >= WAREND.decisiveP) return 100; // 大きく勝っている: 降伏まで戦う (WAREND)
    const expect = clamp(ws + (2 * p - 1) * BARGAIN.swing, -100, 100);
    const cost = (BARGAIN.cost + BARGAIN.costEx * (this.exhaustion[r] || 0)) * BARGAIN.horizon;
    const shift = BARGAIN.shift * Math.max(0, this.seenGrowth(r, e) - this.seenGrowth(r, r)) * 100;
    return expect - cost + shift;
  }
  // AI の国どうしの講和の交渉 (B-167): r が自分の受け入れる線を添えて申し入れを送り、光速で e の首都に届いてから e が答える。
  // 届く途中の申し入れは、同じ戦争・同じ送り手で 1 つまで
  sendBargain(r, e, key) {
    if (this.bargainSent.some((o) => o.key === key && o.from === r)) return;
    this.bargainSent.push({ key, from: r, to: e, l: this.reservation(r, e), at: this.year + this.sysDist(r, e) });
  }
  // 届いた申し入れに答える (年 1 回。realmsYearly の始め)。答えは届いた首都で決まり、講和はそこで結ばれる
  bargainArrive() {
    if (!this.bargainSent.length) return;
    const due = this.bargainSent.filter((o) => o.at <= this.year + 1e-9);
    this.bargainSent = this.bargainSent.filter((o) => o.at > this.year + 1e-9);
    for (const o of due) {
      const alive = (x) => this.isColonized(x) && this.realmOf(x) === x;
      if (this.realmWars[o.key] === undefined || !alive(o.from) || !alive(o.to)) continue;
      this.bargain(o.from, o.to, o.to, o.l);
    }
  }
  // 講和の交渉: 受け入れる線が重なれば、その真ん中で講和する (from = 結ばれる星系、lr = 申し入れた国の線。申し入れに添えた古い値)
  bargain(r, e, from = r, lr = this.reservation(r, e)) {
    const le = this.reservation(e, r);
    // 大きく勝っている国が降伏を求め (WAREND)、相手に勝てる見込みがなければ、全面降伏 (持ち点 100) の講和会議
    if ((lr >= 100 && le <= WAREND.yieldAt) || (le >= 100 && lr <= WAREND.yieldAt)) {
      const [w, l] = lr >= 100 ? [r, e] : [e, r];
      this.startConference(l, [{ realm: w, pts: 100 }], from);
      return true;
    }
    if (lr + le > 0) return false;
    const x = Math.round((lr - le) / 2); // r の取り分
    const [w, l] = x >= 0 ? [r, e] : [e, r];
    if (Math.abs(x) < TREATY.white) {
      this.endWar(r, e, from);
      this.event('politics', from, `${this.realmName(r)}と${this.realmName(e)}が白紙講和を結んだ`);
    } else this.startConference(l, [{ realm: w, pts: Math.abs(x) >= BARGAIN.capitulate ? 100 : Math.abs(x) }], from);
    return true;
  }
  recordShips() {
    for (const r of new Set(this.colonizedSystems().map((x) => this.realmOf(x.id)))) {
      const list = (this.shipHist[r] ??= []), n = this.realmShips(r), last = list[list.length - 1];
      if (!last || last[1] !== n) list.push([this.year, n]);
      while (list.length > 1 && list[1][0] <= this.year - (this.intelSpan ??= Math.ceil(Math.max(...this.galaxy.systems.map((a) => Math.max(...this.galaxy.systems.map((b) => distance(a, b))))))) - BARGAIN.shiftYears - 1) list.shift(); // intelSpan は読み込みの直後でも計算する (回 KE6)
    }
    for (const k of Object.keys(this.shipHist)) if (!this.isColonized(Number(k)) || this.realmOf(Number(k)) !== Number(k)) delete this.shipHist[k];
  }
  realmsYearly() {
    this.bargainArrive(); // 届いた AI どうしの講和の申し入れ (B-167)
    this.cleanWars();
    const roots = this.colonizedSystems().map((x) => x.id).filter((r) => !this.isHuman(r) && this.realmOf(r) === r && this.gov(r).independent);
    for (const root of roots) {
      if (this.realmOf(root) !== root) continue; // この年のうちに降伏した
      const enemies = this.aiEnemiesOf(root); // 開戦の知らせが首都に届いた戦争だけ
      if (enemies.length) this.aiStrike(root, enemies); // 大きく負けていれば光速の一撃 (ship/strike.js)
      const mine = this.realmSystems(root);
      const strong = mine.filter((x) => (this.garrison[x.id] || 0) >= AI_WAR.minFleet).sort((a, b) => (this.garrison[b.id] || 0) - (this.garrison[a.id] || 0))[0];
      if (strong && enemies.length) {
        const n = this.garrison[strong.id] - 1;
        const foes = new Set(enemies);
        // 1. 救援 (B-168): 首都に届いている記録で、敵の艦隊が攻囲している (いる) 自国の星系
        let relief = null;
        for (const x of mine) {
          if (x.id === strong.id || this.aiOrders.some((o) => o.to === x.id && o.realm === root)) continue;
          const v = this.seenBy(root, x.id);
          const foe = v?.[3] ? Object.entries(v[3]).filter(([r]) => foes.has(Number(r))).reduce((k, [, m]) => k + m, 0) : 0;
          if (foe < 1 || this.battleOdds(n, foe) < AI_WAR.relief) continue;
          const d = distance(x, strong);
          if (!relief || d < relief.d) relief = { id: x.id, d };
        }
        if (relief) this.aiOrder(root, strong.id, relief.id, n);
        else {
          // 2. 攻撃: 首都に届いている記録 (光の遅れのぶん古い) で、range 光年以内の敵の星系の近い順に、駐留 + 要塞の段より多く送れるか (前からの形)、近い tries 個のうち勝つ見込みが attack 以上のもの
          const near = this.galaxy.systems.map((x) => [x, this.seenBy(root, x.id)])
            .filter(([x, v]) => v && foes.has(v[1]) && !this.isHuman(x.id) && distance(x, strong) <= AI_WAR.range)
            .sort((a, b) => distance(a[0], strong) - distance(b[0], strong));
          const target = near.find(([x, v], i) => v[2] + this.fortLevel(x.id) < n || (i < AI_WAR.tries && this.battleOdds(n, v[2], 1, 1, this.fortLevel(x.id)) >= AI_WAR.attack))?.[0]; // 要塞は動かず大きいので、段も見えるものとする
          if (target) this.aiOrder(root, strong.id, target.id, n);
        }
      }
      for (const e of enemies) {
        const key = this.warKey(root, e);
        if (this.realmWars[key] === undefined) continue;
        if (BARGAIN.on) {
          if (this.isHuman(e)) {
            // 人間の国へは、いまの戦勝点で講和してよいときに申し入れる (offerEvery 年に 1 回まで)。大きく勝っていれば降伏を求める (WAREND)
            const res = this.reservation(root, e);
            if (res >= 100 && !this.peaceOfferedRecently(key)) {
              this.postPeaceOffer(key, root, e, undefined, true);
              this.event('politics', root, `${this.realmName(root)}が降伏を求めてきた (応じると、${this.realmName(root)}が持ち点 100 で条件を選ぶ講和会議になる)`, true);
            } else if (this.warScore(root, e) >= res && !this.peaceOfferedRecently(key)) {
              this.postPeaceOffer(key, root, e); // 光速で相手の首都に届いてから見える
              this.event('politics', root, `${this.realmName(root)}が講和を申し入れてきた (戦勝点 ${this.warScoreAt(root, e, root)}・相手の戦争疲弊 ${Math.round(this.exhaustion[root] || 0)})`, true);
            }
          } else if (this.aiKnowsWar(e, key)) this.sendBargain(root, e, key); // 相手も開戦を知っていれば、申し入れを送る (届いてから相手が答える)
          continue;
        }
        const ours = this.realmShips(root), theirs = this.seenShips(root, e), years = this.year - this.aiWarSince(root, key); // 知ってからの年数
        // 自分から仕掛けて大差で負けていれば、相手に全面的に任せる (持ち点 100 の講和会議)
        if (this.warBy[key] === root && years >= 5 && theirs >= 5 * Math.max(1, ours) && this.rand() < 0.08) { this.startConference(root, [{ realm: e, pts: 100 }], root); break; }
        // 疲れた・負けている国は講和を申し入れる。相手が AI なら相手の判断で、人間なら申し入れとして届く (5 年に 1 回まで)
        const ex = this.exhaustion[root] || 0, ws = this.warScore(root, e);
        const st = this.warStats[key];
        const quiet = st && !Object.keys(st.k).length && !Object.keys(st.t).length && this.rand() < PEACE.stalemate / (1 + years / PEACE.stalemateHalf);
        if (!quiet && (years < PEACE.minYears || (ex < PEACE.sueEx && ws > PEACE.sueWs))) continue;
        if (this.isHuman(e)) {
          if (!this.peaceOfferedRecently(key)) {
            this.postPeaceOffer(key, root, e);
            this.event('politics', root, `${this.realmName(root)}が講和を申し入れてきた (戦勝点 ${this.warScoreAt(root, e, root)}・相手の戦争疲弊 ${Math.round(ex)})`, true);
          }
        } else if (this.rand() < this.peaceChance(e, root)) this.makePeace(root, e, root);
      }
      if (BARGAIN.on) {
        if (enemies.length || this.rand() >= BARGAIN.declareChance) continue;
        // 首都に届いている記録で、まだ独立国の相手のうち、開戦の見込みがいちばん良いもの (読み違いはその場で引く)
        let best = null;
        for (const r of roots) {
          if (r === root || this.seenBy(root, r)?.[1] !== r || this.realmOf(r) !== r || this.sysDist(r, root) > BARGAIN.warDist) continue;
          if (this.pactBars(root, r)) continue; // 不可侵と同盟の相手には宣戦しない (政治。B-026。協定の知らせが届いてから)
          const v = this.reservation(root, r, this.misread(), 0);
          if (v > BARGAIN.declare && (!best || v > best.v)) best = { r, v };
        }
        if (best) {
          this.beginWar(root, best.r, root);
          this.event('politics', root, `${this.realmName(root)}が${this.realmName(best.r)}に宣戦した`);
        }
        continue;
      }
      if (!enemies.length && this.rand() < 0.03) {
        const ours = this.realmShips(root);
        const prey = roots.filter((r) => r !== root && !this.pactBars(root, r) && this.seenBy(root, r)?.[1] === r && this.sysDist(r, root) <= 25 && ours >= 1.5 * Math.max(1, this.seenShips(root, r)))
          .sort((a, b) => this.sysDist(a, root) - this.sysDist(b, root))[0];
        if (prey !== undefined) {
          this.beginWar(root, prey, root);
          this.event('politics', root, `${this.realmName(root)}が${this.realmName(prey)}に宣戦した`);
        }
      }
    }
  }

