  // 家臣 id の要求をのむかの材料 (QD-41 = c・B-142。DEMAND_AI)。主人の国 (主人と、主人を通して従う星系) の中で見る。seen = 席の国の判断 (届いている記録で見る)。
  // 人口の割合 = 家臣の星系 ÷ 主人の国、国の広がり = 主人の国の星系の主人からの距離の 2 乗の平均の 2 倍の平方根 (一様に広がった円の半径)、見込み = 拒んで最後通牒の期限が来たら独立を宣言する見込み
  demandTermsOf(id, seen = false) {
    const lord = this.govs[id]?.lord ?? this.realmOf(id);
    const k = seen ? this.known(id) : this.govs[id];
    const sys = (seen ? this.knownOwnSystems() : this.realmSystems(this.realmOf(lord))).map((x) => x.id).filter((x) => x === lord || this.isLordOf(lord, x));
    const pop = (x) => (seen ? this.knownColonies(x) : this.coloniesIn(x)).reduce((a, c) => a + c.pop, 0);
    const all = sys.reduce((a, x) => a + pop(x), 0) + (sys.includes(id) ? 0 : pop(id));
    const far = sys.filter((x) => x !== lord).map((x) => this.sysDist(x, lord));
    const R = far.length ? Math.sqrt((2 * far.reduce((a, d) => a + d * d, 0)) / far.length) : this.sysDist(id, lord);
    return { share: clamp(pop(id) / Math.max(1e-12, all), 1e-12, 1), rel: Math.max(0.01, this.sysDist(id, lord)) / Math.max(0.01, R), risk: k ? this.declareChance(k) : 0.5 };
  }
  demandAcceptP(id, seen = false) { return demandAcceptOf(this.demandTermsOf(id, seen)); }
  // 観戦モードの地球政府の政治の判断 (年1回): 国家方針、決めること
  earthPoliticsYearly() {
    const n = this.realmSystems(this.cap).length;
    const want = this.aiPolicy || (this.enemiesOf(this.cap).length ? 'military' : n < 25 ? 'expand' : 'consolidate'); // aiPolicy は実験用 (自動対戦で方針を固定する)
    if (this.policy?.id !== want && (!this.policy || this.year - this.policy.since >= this.policyYears()) && this.pc >= POLICY_COST + 10 && this.bill('policy')?.target !== want && !(this.year < (this.me.bills?.cool?.policy || 0))) this.command('policy', { value: want }); // 審議中か廃案のすぐあとは出さない (回 SE7)
    for (const dec of this.visibleDecisions()) {
      let k = dec.def;
      // 要求: のむ見込み (家臣の大きさ・遠さ・拒んだら独立する見込み。QD-41 = c) でのむ。拒むなら、首都の艦隊が反乱の 2 倍 + 1 以上あれば威圧する
      if (dec.kind === 'demand') k = this.rand() < this.demandAcceptP(dec.sys, true) ? 'accept' : (this.garrison[this.cap] || 0) >= 2 * this.knownRebelFleet(dec.sys) + 1 ? 'awe' : 'refuse';
      else if (dec.kind === 'pact') k = this.pactAiReply(dec);
      else if (dec.kind === 'bill') k = this.billAiReply(dec); // 審議で押し戻された法案 (回 SE7)
      else {
        // 払える選択肢のうち、いまの国の様子でいちばん選びたいもの (語り手の weigh。少しの揺らぎを足す)
        const ok = dec.opts.filter((o) => (o.cr || 0) <= 0.2 * this.gov(this.cap).credits && this.pcCost('decide', { sys: dec.sys, id: dec.id, opt: o.k }) <= this.pc - 10);
        const w = STORY[dec.type]?.weigh;
        let best = -Infinity;
        for (const o of ok) { const v = (w ? w(this, dec, o.k) : 0) + 0.4 * this.rand(); if (v > best) { best = v; k = o.k; } }
      }
      if (k) this.command('decide', { sys: dec.sys, id: dec.id, opt: k });
    }
  }

