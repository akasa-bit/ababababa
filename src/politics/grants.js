  // 朝貢: 年に1回、従属する星系は年間収入の25%を主人の星系へ送る (光速の送金。主人がさらに上へ納めるので連鎖する)
  // 資金援助: 主人の星系から従属星系へ光速で送金する。届くと受け手の資金になり、支援物資と同じく忠誠度が上がる
  sendGrant(from, to, amt, auto = false) {
    amt = Math.min(amt, Math.max(0, this.gov(from).credits));
    if (from === to || amt < 1) return fail('送れる資金がない');
    const q = { id: this.nextShipId++, kind: 'grant', from, to, amt: 0, auto, sent: this.year, arrive: this.year + this.travelYears(from, to), state: 'sending' };
    this.requests.push(q);
    this.earn('grant', -amt, from);
    this.cash('grant', amt, { way: q, f: 'amt' });
    if (!auto) this.message(`${this.system(to).name} へ資金援助 ${fmtAmt(amt)} cr を送った (届くまで ${this.travelYears(from, to).toFixed(1)} 年)`, from);
    return { ok: true };
  }
  // 入植後 GRANT_YEARS 年のあいだ、主人の星系は年に1回、資金の3% (最大 GRANT_MAX cr) を自動で送る (地球は設定で止められる)
  grantsYearly() {
    for (const [key, gv] of Object.entries(this.govs)) {
      const id = Number(key);
      const lord = gv.lord;
      if (lord === null || lord === undefined || !this.isColonized(id) || this.year - (gv.founded ?? this.year) > GRANT_YEARS) continue;
      if (this.isHuman(lord) && this.asRealm(lord, () => !this.autoGrant || (!this.spectate && !this.known(id)?.cols.length))) continue; // 地球は入植を知ってから送る
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

