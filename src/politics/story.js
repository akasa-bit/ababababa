// --- 語り手の出来事 ---
// pick(g) は起こせる星系 (なければ null)、start(g, sys) は出来事を起こし、多くは「決めること」を出す。resolve(g, dec, k, local) は返事が届いたときの効果
// (local = 期限までに返事がなく、現地が既定の選択肢で決めた)。
// どの選択肢にも、代わりの得と損を付ける (明らかな最善をなくす。B-049・docs/critique/04-plan.md の 0-9)。
// weigh(g, dec, k) は観戦の AI がその選択肢をどれだけ選びたいか (いまの国の様子で変わる。大きいほど選ぶ)
const STORY_RESET = new Set(['politics', 'demand', 'battle', 'pirate', 'war', 'natives', 'story', 'famine']);
// 試合の乱数: いま動いているゲームの、シードから続く乱数を使う (同じシードと同じ命令なら同じ結果になる。マルチプレイの前提)
let SIM = null;
const rnd = () => (SIM ? SIM.rand() : Math.random());
const pickOf = (list) => (list.length ? list[Math.floor(rnd() * list.length)] : null);
const earthSystems = (g) => g.realmSystems(g.cap).map((x) => x.id);
const loyaltyOf = (g, sys) => (sys === g.cap ? g.govs[sys]?.loyalty : g.known(sys)?.loyalty) ?? LOYALTY_START; // 地球に届いている記録で (光の遅れ)
const richer = (g, v) => (g.gov(g.cap).credits > v ? 0.5 : -0.5); // 資金に余裕があれば、払う選択肢を選びやすい
const STORY = {
  derelict: {
    pick: (g) => pickOf(earthSystems(g)),
    start(g, sys) {
      g.event('story', sys, `${g.system(sys).name} の近くで、古い漂流船が見つかった`);
      g.addDecision({ kind: 'story', type: 'derelict', sys, deadline: g.year + g.lightDelay(sys) + 15, def: 'leave', text: `${g.system(sys).name} の近くで古い漂流船が見つかった。回収すれば資材になる。`,
        opts: [{ k: 'salvage', label: '回収する', cr: 100, note: '金属 300・希少元素 40 がこの星系の備蓄に入る。ただし 3 回に 1 回、船に眠っていた無人の戦闘艇が目を覚まし、この星系を襲う' },
          { k: 'leave', label: '地元の業者に払い下げる', note: '金属 100 だけが備蓄に入る (希少元素は業者のもの)。地元が儲かり忠誠度 +3' }] });
    },
    resolve(g, dec, k) {
      if (!g.isColonized(dec.sys)) return;
      if (k !== 'salvage') {
        g.mv(dec.sys, 'metal', 100, 'extract');
        const gv = g.govs[dec.sys];
        if (gv && dec.sys !== g.cap) gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 3);
        g.message(`${g.system(dec.sys).name} の業者が漂流船を解体した (金属 100・忠誠度 +3)`, dec.sys);
        return;
      }
      g.mv(dec.sys, 'metal', 300, 'extract'); g.mv(dec.sys, 'rare', 40, 'extract'); // 宇宙から回収した物質
      g.spendDecision(dec, { pv: dec.sys }); // 回収の代金は、その星系の民間 (回収した人々) へ
      g.message(`${g.system(dec.sys).name} で漂流船を回収した (金属 300・希少元素 40)`, dec.sys);
      if (g.rand() < 1 / 3) g.pirateRaid(g.system(dec.sys), 1); // 眠っていた戦闘艇 (小さな海賊の襲撃と同じ強さ)
    },
    weigh(g, dec, k) {
      const guard = g.knownGarrison(dec.sys) >= 1; // 守りがあれば、目を覚ました戦闘艇を追い払える
      return k === 'salvage' ? 1 + richer(g, 1000) + (guard ? 0.4 : -0.6) : 1 + (loyaltyOf(g, dec.sys) < 50 ? 0.6 : 0);
    },
  },
  accident: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap && g.coloniesIn(id).some((c) => c.pop >= 0.05) && g.year - (g.gov(id).founded ?? g.year) < 100)),
    start(g, sys) {
      const c = g.coloniesIn(sys).sort((a, b) => b.pop - a.pop)[0];
      c.pop *= 0.8;
      g.event('story', sys, `${c.name} で居住施設の事故が起き、人口の2割を失った`);
      g.addDecision({ kind: 'story', type: 'accident', sys, deadline: g.year + g.lightDelay(sys) + 15, def: 'none', text: `${c.name} (${g.system(sys).name}) で居住施設の事故があり、人口の2割を失った。復興を支えるか。`,
        opts: [{ k: 'aid', label: '復興支援を送る', cr: 300, note: '資金 300 cr が届き、忠誠度 +10。議会の支持 −1 (遠くへの出費への批判)' },
          { k: 'none', label: '自力で立て直させる', note: '忠誠度 −8。議会の支持 +2 (国庫を守った)' }] });
    },
    resolve(g, dec, k, local) {
      const gv = g.govs[dec.sys];
      if (!gv || !g.isColonized(dec.sys)) return;
      if (k === 'aid') { g.release('grant', dec, 'cr', dec.sys, dec.payer ?? 0); gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 10); g.attend(dec.sys); g.councilAdd(-1, '遠くの復興に資金を出した'); g.message(`${g.system(dec.sys).name} に復興支援が届いた`, dec.sys); }
      else { gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 8); if (!local) g.councilAdd(2, '復興を現地に任せた'); g.message(`${g.system(dec.sys).name} は復興支援が来なかったことを恨んでいる (忠誠度 −8)`, dec.sys); }
    },
    weigh(g, dec, k) {
      const L = loyaltyOf(g, dec.sys);
      return k === 'aid' ? 1 + richer(g, 1500) + (L < 50 ? 0.8 : 0) : 1 + (g.council < 45 ? 0.6 : 0) + (L > 70 ? 0.6 : 0);
    },
  },
  refugees: {
    pick: (g) => (g.colonies.some((c) => c.sys !== g.cap && g.realmOf(c.sys) === g.cap) || g.rand() < 0.3 ? g.cap : null),
    start(g, sys) {
      const species = `${pickOf(KANA_A)}${pickOf(KANA_B)}人`;
      g.event('story', sys, `異星の難民船が太陽系に現れ、${species} 5万人が保護を求めている`);
      g.addDecision({ kind: 'story', type: 'refugees', sys, species, deadline: g.year + 5, def: 'refuse', text: `異星の難民船が${sys === 0 ? '太陽系' : g.system(sys).name}に現れた。${species} 5万人が保護を求めている。受け入れれば、${SIM_ONLY ? 'この星系の入植地に住む' : `空きのある${g.realmName(g.cap)}の入植地へ送る`}。`,
        opts: [{ k: 'accept', label: '受け入れる', note: `入植地の人口 +5万人 (${species})・議会の支持 −3 (反対派)` }, { k: 'refuse', label: '断る', note: '議会の支持 +2' }] });
    },
    resolve(g, dec, k) {
      if (k === 'refuse') { g.councilAdd(2, '難民を断った'); return; }
      // シミュレーション版: 難民船が着いた星系の入植地に住む (遠くの入植地へ一瞬では移れない)。ゲーム版は国じゅうで一番空きのある入植地
      const c = g.colonies.filter((x) => g.realmOf(x.sys) === g.cap && (!SIM_ONLY || x.sys === dec.sys)).sort((a, b) => (g.capOf(b) - b.pop) - (g.capOf(a) - a.pop))[0];
      if (!c) return;
      g.addPeople(c, 0.05, { [dec.species]: 1 });
      g.councilAdd(-3, '難民を受け入れた');
      g.message(`${dec.species} の難民 5万人が ${c.name} に移り住んだ`, c.sys);
    },
    weigh(g, dec, k) { return k === 'accept' ? 1 + (g.council > 55 ? 0.6 : 0) : 1 + (g.council < 45 ? 0.6 : 0); },
  },
  discovery: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap)),
    start(g, sys) {
      const r = pickOf(['metal', 'fuel', 'rare', 'water']);
      g.event('story', sys, `${g.system(sys).name} で${RES_LABEL[r]}の豊かな鉱脈が見つかった`, true);
      g.addDecision({ kind: 'story', type: 'discovery', sys, res: r, deadline: g.year + g.lightDelay(sys) + 15, def: 'local', text: `${g.system(sys).name} で${RES_LABEL[r]}の豊かな鉱脈が見つかった。開発を急がせるか。`,
        opts: [{ k: 'rush', label: '開発を急がせる', cr: 200, note: `${RES_LABEL[r]} 800 がこの星系の備蓄に入る。地元の採掘者を押しのけるので忠誠度 −5` },
          { k: 'local', label: '地元に任せる', note: `${RES_LABEL[r]} 250 が備蓄に入る。地元が潤い忠誠度 +3` }] });
    },
    resolve(g, dec, k) {
      if (!g.isColonized(dec.sys)) return;
      g.mv(dec.sys, dec.res, k === 'rush' ? 800 : 250, 'extract');
      if (k === 'rush') g.spendDecision(dec, { pv: dec.sys });
      const gv = g.govs[dec.sys];
      if (gv && dec.sys !== g.cap) gv.loyalty = clamp((gv.loyalty ?? LOYALTY_START) + (k === 'rush' ? -5 : 3), 0, 100);
      g.message(`${g.system(dec.sys).name} の鉱脈から${RES_LABEL[dec.res]} ${k === 'rush' ? 800 : 250} を得た (忠誠度 ${k === 'rush' ? '−5' : '+3'})`, dec.sys);
    },
    weigh(g, dec, k) {
      const L = loyaltyOf(g, dec.sys);
      return k === 'rush' ? 1 + richer(g, 1200) + (L > 65 ? 0.5 : 0) : 1 + (L < 55 ? 0.8 : 0);
    },
  },
  envoy: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => g.system(id).bodies.some((b) => g.nativeOf(id, b.id)?.st.status === 'independent'))),
    start(g, sys) {
      const b = g.system(sys).bodies.find((x) => g.nativeOf(sys, x.id)?.st.status === 'independent');
      const n = g.nativeOf(sys, b.id);
      g.event('story', sys, `${b.name} の${n.def.species}が使節を送ってきた`);
      g.addDecision({ kind: 'story', type: 'envoy', sys, body: b.id, deadline: g.year + g.lightDelay(sys) + 15, def: 'refuse', text: `${b.name} (${g.system(sys).name}) の${n.def.species}が使節を送ってきた (友好度 ${Math.round(n.st.rel)})。`,
        opts: [{ k: 'welcome', label: '歓待する', cr: 150, note: '友好度 +20。議会の支持 −2 (異星の民に甘い、と強硬派)' },
          { k: 'refuse', label: '追い返す', note: '友好度 −10。議会の支持 +2 (強硬派が喜ぶ)' }] });
    },
    resolve(g, dec, k, local) {
      const n = g.nativeOf(dec.sys, dec.body);
      if (!n || n.st.status !== 'independent') return;
      n.st.rel = clamp(n.st.rel + (k === 'welcome' ? 20 : -10), -100, 100);
      if (k === 'welcome') g.spendDecision(dec, { nat: `${dec.sys}|${dec.body}` }); // 歓待の費用は、使節への贈り物
      if (!local) g.councilAdd(k === 'welcome' ? -2 : 2, k === 'welcome' ? '異星の使節を歓待した' : '異星の使節を追い返した');
      g.message(`${n.def.species}の使節を${k === 'welcome' ? '歓待した' : '追い返した'} (友好度 ${Math.round(n.st.rel)})`, dec.sys);
    },
    weigh(g, dec, k) {
      const rel = g.nativeOf(dec.sys, dec.body)?.st.rel ?? 0;
      return k === 'welcome' ? 1 + richer(g, 1000) + (rel < 0 ? 0.6 : 0) : 1 + (g.council < 45 ? 0.8 : 0) + (rel > 40 ? 0.4 : 0);
    },
  },
  plague: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => g.coloniesIn(id).some((c) => c.pop >= 0.5 && !(c.plague > g.year)))),
    start(g, sys) {
      const c = g.coloniesIn(sys).filter((x) => x.pop >= 0.5).sort((a, b) => b.pop - a.pop)[0];
      c.plague = g.year + 15;
      g.event('story', sys, `${c.name} で疫病が広がり始めた (15年のあいだ人口が伸びにくい)`);
      g.addDecision({ kind: 'story', type: 'plague', sys, col: colKey(c), deadline: g.year + g.lightDelay(sys) + 10, def: 'none', text: `${c.name} (${g.system(sys).name}) で疫病が広がっている。医療団を送れば、届いた時点で収まる。港を閉じて隔離すれば、費用なしで早く収まるが、閉じ込められた人々は恨む。`,
        opts: [{ k: 'cure', label: '医療団を送る', cr: sys === g.cap ? 200 : 400, note: sys === g.cap ? '疫病が収まる (首都なので遠くへ送らずに済み、費用は半分)' : '届けば疫病が収まり、忠誠度 +5' }, { k: 'none', label: '隔離する', note: sys === g.cap ? '疫病は届いてから 5 年で収まる (送らなければ 15 年)。港の封鎖への反発で議会の支持 −4' : '疫病は届いてから 5 年で収まる (送らなければ 15 年)。閉じ込められた恨みで忠誠度 −10' }] });
    },
    resolve(g, dec, k, local) {
      const c = g.colonyByKey(dec.col);
      const gv = g.govs[dec.sys];
      if (!c || !gv) return;
      if (k === 'cure') { g.spendDecision(dec, { pv: dec.sys }); c.plague = 0; gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 5); g.attend(dec.sys); g.message(`${c.name} に医療団が着き、疫病が収まった`, dec.sys); }
      else if (local) { if (dec.sys !== g.cap) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 5); } // 返事がなかった: 疫病は 15 年続く
      else {
        c.plague = Math.min(c.plague || 0, g.year + 5);
        if (dec.sys !== g.cap) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 10); else g.councilAdd(-4, '港を封鎖した');
        g.message(`${c.name} を隔離した (疫病は ${Math.round(g.year + 5)} 年までに収まる${dec.sys !== g.cap ? '・忠誠度 −10' : ''})`, dec.sys);
      }
    },
    weigh(g, dec, k) {
      if (dec.sys === g.cap) return k === 'cure' ? 1 + richer(g, 1500) + (g.council < 50 ? 0.6 : 0) : 1 + (g.council > 60 ? 0.6 : 0);
      const L = loyaltyOf(g, dec.sys);
      return k === 'cure' ? 1 + richer(g, 3000) + (L < 55 ? 0.8 : 0) : 1 + (L > 70 ? 0.6 : 0);
    },
  },
  raid: {
    // 海賊が本格的に現れる前の、小さな襲撃
    pick: (g) => (g.year < PIRATE_START + 10 ? pickOf(earthSystems(g).filter((id) => id !== g.cap)) : null),
    start(g, sys) { if (SIM_ONLY) g.pirateLaunch(g.system(sys), 1); else g.pirateRaid(g.system(sys), 1); }, // シミュレーション版は、どこかの星系から飛んで来る
    resolve() {},
  },
};

