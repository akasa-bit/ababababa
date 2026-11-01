  // 朝貢: 年に1回、従属する星系は年間収入の25%を主人の星系へ送る (光速の送金。主人がさらに上へ納めるので連鎖する)
  // 資金援助: 主人の星系から従属星系へ光速で送金する。届くと受け手の資金になり、支援物資と同じく忠誠度が上がる
  // standing = 定期の資金援助で送ったもの (依頼 KE-4。届いた知らせと一覧で分ける)
  sendGrant(from, to, amt, auto = false, standing = false) {
    amt = Math.min(amt, Math.max(0, this.gov(from).credits));
    if (from === to || amt < 1) return fail('送れる資金がない');
    const q = { id: this.nextShipId++, kind: 'grant', from, to, amt: 0, auto, ...(standing ? { standing: true } : {}), sent: this.year, arrive: this.year + this.travelYears(from, to), state: 'sending' };
    this.requests.push(q);
    this.earn('grant', -amt, from);
    this.cash('grant', amt, { way: q, f: 'amt' });
    if (!auto) this.message(JA`${this.system(to).name} へ資金援助 ${fmtAmt(amt)} cr を送った (届くまで ${this.travelYears(from, to).toFixed(1)} 年)`, from);
    return { ok: true };
  }
  // 定期の資金援助 (依頼 KE-4。2026-11-01): プレイヤーが自国の星系ごとに「毎年 amt cr」を決めておくと、止めるまで首都が年に 1 回送る
  // (光速で届き、届くと受け手の資金になって忠誠度が上がる。ふつうの資金援助と同じ)。首都の資金が足りない年は、送れる分だけ送る。
  // 設定はプレイヤーごと (players[i].standing = { 星系: cr/年 })。自国の星系でなくなったら設定を消す
  setStandingGrant(sys, amt) {
    const to = Number(sys), v = Math.round(Math.max(0, Math.min(STANDING_MAX, Number(amt) || 0)));
    if (to === this.cap || !this.isColonized(to) || this.realmOf(to) !== this.cap) return fail(JA`${this.realmName(this.cap)}の星系にだけ送れる`);
    const st = (this.me.standing ??= {});
    if (v < 1) { if (!(to in st)) return fail('定期の資金援助は決めていない'); delete st[to]; return { ok: true, msg: JA`${this.system(to).name} への定期の資金援助を止めた` }; }
    st[to] = v;
    return { ok: true, msg: JA`${this.system(to).name} へ毎年 ${fmtAmt(v)} cr の資金援助を送る (止めるまで続ける)` };
  }
  standingGrantsYearly() {
    this.players.forEach((p, pi) => {
      if (!p.standing) return;
      for (const k of Object.keys(p.standing)) {
        const id = Number(k);
        if (!this.isColonized(id) || this.realmOf(id) !== p.cap || id === p.cap) { delete p.standing[k]; continue; }
        this.asPlayer(pi, () => this.sendGrant(p.cap, id, p.standing[k], true, true));
      }
    });
  }
  // 入植後 GRANT_YEARS 年のあいだ、主人の星系は年に1回、資金の3% (最大 GRANT_MAX cr) を自動で送る (地球は設定で止められる)
  grantsYearly() {
    this.standingGrantsYearly();
    for (const [key, gv] of Object.entries(this.govs)) {
      const id = Number(key);
      const lord = gv.lord;
      if (lord === null || lord === undefined || !this.isColonized(id) || this.year - (gv.founded ?? this.year) > GRANT_YEARS) continue;
      if (this.isSeat(lord) && this.asRealm(lord, () => !this.autoGrant || (!this.spectate && !this.known(id)?.cols.length))) continue; // 席の国 (人間の国と AI の国) は入植を知ってから送る
      if (this.realmOf(id) !== this.realmOf(lord)) continue;
      const amt = Math.min(GRANT_MAX, 0.03 * this.gov(lord).credits);
      if (amt >= 1) this.sendGrant(lord, id, amt, true);
    }
  }
  tributeYearly() {
    for (const [key, gv] of Object.entries(this.govs)) {
      const id = Number(key);
      const inc = gv.inc || 0;
      gv.inc = 0;
      if (gv.lord === null || gv.lord === undefined || !this.isColonized(id)) continue;
      const vt = regimeKey(gv);
      const rate = (gv.taxFree || 0) > this.year ? 0 : REGIMES[vt].tribute * (vt === 'T09' ? 1 - H33.companyCut : 1); // 減税中は免除。ほかは統治体制ごと。特許会社領は会社が一部を取る
      let owed = Math.max(0, inc) * rate + (vt === 'T19' ? gv.arrears || 0 : 0); // 関税受領官: 滞納を先に取る
      const amt = Math.min(Math.max(0, gv.credits), owed);
      if (vt === 'T19') { const left = owed - amt; if (left > 0.01) gv.arrears = left; else delete gv.arrears; }
      if (amt < 0.01) continue;
      // 共同統治: 2 国目の宗主へ朝貢の一部 (主な宗主が断っていなければ)
      const second = vt === 'T08' && gv.lord2 !== undefined && !gv.jointCut && this.isColonized(gv.lord2) && this.realmOf(gv.lord2) === gv.lord2 ? gv.lord2 : null;
      const sends = second !== null ? [[gv.lord, amt * (1 - H33.joint)], [second, amt * H33.joint]] : [[gv.lord, amt]];
      for (const send of sends) {
        const dest = send[0], part = send[1];
        if (part < 0.005) continue;
        const q = { id: this.nextShipId++, kind: 'tribute', from: id, to: dest, amt: 0, sent: this.year, arrive: this.year + this.travelYears(id, dest), state: 'sending' };
        this.requests.push(q);
        this.earn('tribute', -part, id);
        this.cash('tribute', part, { way: q, f: 'amt' }); // 届くまでは運ぶ途中
      }
    }
  }

