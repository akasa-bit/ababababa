  // --- 外の国への派閥 (回 AI4・B-303。ユーザーの依頼 AI-1: 内政は Victoria 3 を参考に。値は politics/inner-consts.js の INNER.lob。docs/ai-behavior.md の 11) ---
  // 国 r の、権力に加わっている集団の行 ({ w: 声の重さ, q: 所得の分位, sec: 伝統 ↔ 世俗, se: 生存 ↔ 自己表現 })。
  // 声の重さと記録の見え方は billSupport と同じ (席の国は、遠い星系を首都に届いている記録で数える)。同じ刻みのうちは覚えておく。
  // keep = false (画面から) は覚えに触らない (画面を描く呼び出しが、試合の計算の覚えを変えると、ネット対戦の端末どうしで筋が分かれる。回 AI5)
  lobbyRows(r, keep = true) {
    const c = keep ? this.innerC() : { rows: {} };
    if (!(r in c.rows)) {
      const seat = this.isSeat(r);
      const make = () => {
        const out = [];
        for (const s of this.realmSystems(r)) {
          const id = s.id, k = seat && id !== r ? this.known(id) : null;
          if (seat && id !== r && !k) continue;
          const G = k ? k.groups : this.groupsOf(id);
          if (!G) continue;
          const P = (k ? k.cols : this.coloniesIn(id)).reduce((a, x) => a + (x.pop || 0), 0);
          for (const e of G.eth) {
            if (!GROUP_STATUS[e.st]?.incl) continue;
            for (let q = 0; q < 5; q++) {
              const w = P * e.share * 0.2 * GM.pow(5 * (G.quint?.[q] ?? groupQuint(q)), SUPPORT.clout);
              if (!(w > 0)) continue;
              const V = this.groupValuesOf(G, e.k, q);
              out.push({ w, q, sec: V.secular, se: V.selfexp });
            }
          }
        }
        return out;
      };
      c.rows[r] = seat ? this.asRealm(r, make) : make();
    }
    return c.rows[r];
  }
  // 派閥の重み (0〜1): 派閥に入る集団の声の重さ ÷ 国の声の重さ。入る集団はきっかけで決まる (INNER.lob の説明)
  lobbyClout(l, keep = true) {
    const rows = this.lobbyRows(l.r, keep), W = rows.reduce((a, x) => a + x.w, 0);
    if (!(W > 0)) return 0;
    let inIt;
    if (l.why === 'trade') inIt = (x) => x.q >= 3;
    else if (l.why === 'fund') inIt = (x) => x.q === 4;
    else if (l.why === 'thank') { const m = rows.reduce((a, x) => a + x.w * x.se, 0) / W; inIt = (x) => x.se >= m; }
    else { const m = rows.reduce((a, x) => a + x.w * x.sec, 0) / W; inIt = (x) => x.sec <= m; }
    const s = rows.reduce((a, x) => a + (inIt(x) ? x.w : 0), 0) / W;
    return Math.min(1, s * (l.fund > this.year ? 1 + INNER.lob.fundBoost : 1));
  }
  // 国 r の、国 e に向けた派閥 (いまあるもの) の重みの合計 (親・反。どちらも 1 まで) と内訳 list = [{ l, w }]。同じ刻みのうちは覚えておく
  lobbyStance(r, e) {
    const c = this.innerC(), k = `${r}|${e}`;
    if (!(k in c.st)) {
      let pro = 0, anti = 0;
      const list = [];
      for (const l of this.inner.lob) {
        if (l.r !== r || l.to !== e || l.end !== null) continue;
        const w = this.lobbyClout(l);
        if (l.pro) pro += w; else anti += w;
        list.push({ l, w });
      }
      c.st[k] = { pro: Math.min(1, pro), anti: Math.min(1, anti), list };
    }
    return c.st[k];
  }
  // 派閥の名前 (w = 重み。省くと重みを書かない)
  lobbyName(l, w = null) {
    return JA`${l.pro ? '親' : '反'}${this.realmName(l.to)}派 (${LOBBY_WHY[l.why]}${w === null ? '' : JA`・重み ${Math.round(100 * w)}%`})`;
  }
  // 派閥ができる。重みが minClout に届かなければ、できない (集団が加わらない)
  lobbyForm(r, to, pro, why, fund = 0) {
    const l = { r, to, pro, why, y: this.year, end: null, ap: 0, fund };
    const w = this.lobbyClout(l);
    if (w < INNER.lob.minClout) return null;
    this.inner.lob.push(l);
    this.innerC().st = {};
    const t = JA`${this.realmName(r)}に${this.lobbyName(l, w)}ができた`;
    if (!this.isHuman(r)) this.aiNote(r, t);
    this.event('politics', r, t, this.isHuman(r) || this.isHuman(to));
    return l;
  }
  lobbyEnd(l, why) {
    l.end = this.year;
    this.innerC().st = {};
    const t = JA`${this.realmName(l.r)}の${this.lobbyName(l)}が消えた (${why})`;
    if (!this.isHuman(l.r)) this.aiNote(l.r, t);
    this.event('politics', l.r, t, this.isHuman(l.r));
  }
  // 政府の行いへの派閥の満足 (memAdd と makePact から。a が b に k をした)。親 b 派は LOBBY_ACT の向き、反 b 派は逆に動く
  lobbyAct(a, b, k) {
    const s = LOBBY_ACT[k], M = INNER.lob.apMax;
    if (!s || !this.inner) return;
    for (const l of this.inner.lob) if (l.r === a && l.to === b && l.end === null) l.ap = clamp(l.ap + (l.pro ? s : -s), -M, M);
  }
  // 年 1 回 (innerYearly から): 派閥の満足を議会の支持に・満足を薄める・きっかけで派閥ができる、消える・資金の切れた派閥を消す・古い記録を捨てる
  lobbyYearly() {
    const L = INNER.lob;
    // 満足 → 議会の支持 (席の国。人間の国も)。年 council × 重み × 満足
    this.players.forEach((p) => {
      let d = 0;
      for (const l of this.inner.lob) if (l.r === p.cap && l.end === null && l.ap) d += L.council * this.lobbyClout(l) * l.ap;
      if (Math.abs(d) >= 1e-6) this.asRealm(p.cap, () => this.councilAdd(d));
    });
    for (const l of this.inner.lob) if (l.end === null) l.ap = Math.abs(l.ap * L.apDecay) < 0.01 ? 0 : l.ap * L.apDecay;
    const roots = this.colonizedSystems().map((x) => x.id).filter((r) => this.realmOf(r) === r && this.realmAlive(r));
    const has = (r, e, why) => this.inner.lob.find((l) => l.r === r && l.to === e && l.why === why && l.end === null);
    for (const l of this.inner.lob) {
      if (l.end !== null) continue;
      if (!this.realmAlive(l.r) || !this.realmAlive(l.to) || this.realmOf(l.r) !== l.r || this.realmOf(l.to) !== l.to) { l.end = this.year; continue; }
      if (l.why === 'fund' && l.fund <= this.year) this.lobbyEnd(l, '外からの資金が切れた');
    }
    for (const r of roots) {
      for (const e of roots) {
        if (e === r) continue;
        // 交易: 輸送量の割合が trade 以上でできやすく、半分を切ると消える
        const t = this.innerTrade(r, e), lt = has(r, e, 'trade');
        if (lt && t < L.trade / 2) this.lobbyEnd(lt, '交易が細った');
        else if (!lt && t >= L.trade && this.rand() < L.chance) this.lobbyForm(r, e, true, 'trade');
        // 恩と恨み: r が覚えている e の行い (光が届いたもの)
        const lh = has(r, e, 'thank'), lg = has(r, e, 'grudge');
        if (!(this.mem[`${e}|${r}`]?.length) && !lh && !lg) continue;
        const m = this.memView(r, e);
        if (lh && m.thanks < L.mem / 2) this.lobbyEnd(lh, '恩が薄れた');
        else if (!lh && m.thanks >= L.mem && this.rand() < L.chance) this.lobbyForm(r, e, true, 'thank');
        if (lg && m.grudge < L.mem / 2) this.lobbyEnd(lg, '恨みが薄れた');
        else if (!lg && m.grudge >= L.mem && this.rand() < L.chance) this.lobbyForm(r, e, false, 'grudge');
      }
    }
    this.inner.lob = this.inner.lob.filter((l) => l.end === null || this.year - l.end < L.keep);
  }
  // 外の国 from が、国 R の親 from 派に資金を出す (届いた年。k = 払えた割合)。派閥があればいちばん重いものの重みを fundYears 年上げ、なければ fund の派閥ができる
  lobbyFund(R, from, k) {
    const L = INNER.lob, until = this.year + L.fundYears * k;
    const mine = this.inner.lob.filter((l) => l.r === R && l.to === from && l.pro && l.end === null);
    if (mine.length) {
      const best = mine.reduce((a, l) => (this.lobbyClout(l) > this.lobbyClout(a) ? l : a));
      best.fund = Math.max(best.fund, until);
      this.innerC().st = {};
      return JA`${this.lobbyName(best)}の重み ×${1 + L.fundBoost} (${Math.floor(until)}年まで)`;
    }
    const l = this.lobbyForm(R, from, true, 'fund', until);
    return l ? JA`${this.lobbyName(l, this.lobbyClout(l))}ができた` : '加わる集団がなかった';
  }
  // 観る国 o (省くといまの席) から見えている、国 r の派閥 (光が届いた時点でできていて、まだ消えていなかったもの。観戦ではいまの)
  lobbiesSeen(r, o = this.cap) {
    const t0 = this.spectate || r === o ? this.year : this.year - this.sysDist(o, r);
    return this.inner.lob.filter((l) => l.r === r && l.y <= t0 + 1e-9 && (l.end === null || l.end > t0));
  }
