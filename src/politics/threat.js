  // --- 脅威への均衡と便乗・AI の判断の理由 (回 AI2・B-301。docs/ai-behavior.md の 2 と 7。W5-Q6 = a で補正なし) ---
  // r の首都に届いている記録の艦隊 (自分は本当の数。pactScore と同じ見え方)
  threatView(r) { return (t) => (t === r ? this.realmShips(r) : this.seenShips(r, t)); }
  // いちばん脅威な国と、均衡か便乗か (Walt 1987 の脅威への均衡。脅威 = 力の総量 (艦隊)・近さ (宣戦できる距離のうち)・攻める意図 (交戦中)。
  // 式は協定の共通の脅威 pactThreat と同じ: 近くの国のうち自分より強く見えるもの)。
  // 分かれ目は Walt 1987 の 5 章 (弱く、頼れる味方のいない国は便乗する。Schweller 1994): t を同じく脅威と見ていそうな近くの国
  // (r と t の両方から宣戦できる距離にいて、t より弱く見え、r と交戦中でなく、t の同盟国でない国) を仲間に数え、
  // r と仲間の艦隊の合計が t に届けば均衡 (t に対して同盟を組む)、届かなければ便乗 (t と結ぶ)
  alignOf(r, ships = this.threatView(r)) {
    const th = this.pactThreat(r, null, ships);
    if (th.t === null) return { t: null, v: 0, n: 0, coal: 0, mates: [], mode: null };
    const n = ships(th.t);
    let coal = ships(r);
    const mates = [];
    for (const x of this.colonizedSystems()) {
      const u = x.id;
      if (u === r || u === th.t || this.realmOf(u) !== u || this.sysDist(r, u) > BARGAIN.warDist || this.sysDist(u, th.t) > BARGAIN.warDist) continue;
      if (this.atWar(r, u) || this.pactBetween(u, th.t, 'ally')) continue;
      const m = ships(u);
      if (m >= n) continue;
      coal += m;
      mates.push(u);
    }
    return { t: th.t, v: th.v, n, coal, mates, mode: coal >= n ? 'balance' : 'bandwagon' };
  }
  // 脅威の内訳の文 (r から見た t): 艦隊・距離・交戦中
  threatText(r, t, ships = this.threatView(r)) {
    return JA`${this.realmName(t)}の艦隊 ${Math.round(ships(t))}・自分 ${Math.round(ships(r))}・${this.sysDist(r, t).toFixed(0)} 光年${this.atWar(r, t) ? JA`・交戦中` : ''}`;
  }
  // AI の国の宣戦 (realmsYearly から。船と戦争へ頼んだ 1 行)。z = 判断のときに引いた読み違い。理由の内訳を知らせと記録に付ける
  aiDeclare(root, e, z) {
    const o = {};
    this.reservation(root, e, z, 0, o);
    const claim = this.claimBonus(root, e);
    const al = this.alignOf(root);
    this.beginWar(root, e, root);
    const why = JA`首都に届いた記録で: 艦隊 自分 ${Math.round(o.ours)}・相手 ${Math.round(o.theirs)}${o.allies >= 0.5 ? JA` (相手の同盟国 ${Math.round(o.allies)} を含む)` : ''}・勝つ見込み ${Math.round(100 * o.p)}%・見込む戦勝点 ${Math.round(o.expect)}・戦費 −${Math.round(o.cost)}${o.shift >= 0.5 ? JA`・相手の伸び +${Math.round(o.shift)}` : ''}${claim ? JA`・請求権 +${Math.round(claim)}` : ''}${al.t === e ? JA`・いちばんの脅威` : ''}`;
    this.event('politics', root, JA`${this.realmName(root)}が${this.realmName(e)}に宣戦した (${why})`, false);
    this.aiNote(root, JA`${this.realmName(e)}に宣戦した (${why})`);
  }
  // AI の国の判断を記録に足す (星系の欄に、光の遅れで届いた分だけ出す。AI_LOG)
  aiNote(r, t) {
    if (this.isHuman(r) && !this.spectate) return;
    const list = (this.aiLog[r] ??= []);
    list.push({ y: this.year, t });
    this.aiLog[r] = list.filter((e) => this.year - e.y < AI_LOG.years).slice(-AI_LOG.max);
    for (const k of Object.keys(this.aiLog)) if (!this.realmAlive(Number(k))) delete this.aiLog[k];
  }
  // 講和の判断の理由の内訳 (r が e との講和を考えるとき。r の首都に届いた戦果と記録で): 戦勝点・受け入れる線 (交渉の模型の reservation)・艦隊・勝つ見込み・戦争疲弊
  peaceWhy(r, e) {
    const o = {};
    const res = this.reservation(r, e, undefined, undefined, o);
    return JA`戦勝点 ${Math.round(this.warScore(r, e))}・受け入れる線 ${res >= 100 ? JA`降伏まで戦う` : Math.round(res)} (艦隊 自分 ${Math.round(o.ours ?? this.realmShips(r))}・相手 ${Math.round(o.theirs ?? this.seenShips(r, e))}${o.p !== undefined ? JA`・勝つ見込み ${Math.round(100 * o.p)}%` : ''})・戦争疲弊 ${Math.round(this.exhaustion[r] || 0)}`;
  }
