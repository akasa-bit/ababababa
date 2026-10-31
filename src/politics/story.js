// --- 語り手の出来事 ---
// pick(g) は起こせる星系 (なければ null)、start(g, sys) は出来事を起こし、多くは「決めること」を出す。resolve(g, dec, k, local) は返事が届いたときの効果
// (local = 期限までに返事がなく、現地が既定の選択肢で決めた)。
// どの選択肢にも、代わりの得と損を付ける (明らかな最善をなくす。B-049・docs/critique/04-plan.md の 0-9)。
// weigh(g, dec, k) は観戦の AI がその選択肢をどれだけ選びたいか (いまの国の様子で変わる。大きいほど選ぶ)
// 連作 (回 SE3・B-050。docs/decisions.md の「SE3 の案」): next(g, dec, k, local) が続きの段 { type, data, delay, sys } を返すと、
// 返事が届いた年から delay 年あとに同じ星系で続きが起き (start(g, sys, data))、その知らせは光の遅れで地球に届く。続きの段は follow: true (語り手がくじで選ばない)。
// 同じ種類 (頭の出来事) は 1 試合に STORY_MAX 回まで (目標 F19)
const STORY_MAX = 2;
const STORY_RESET = new Set(['politics', 'demand', 'battle', 'pirate', 'war', 'natives', 'story', 'famine']);
// 試合の乱数: いま動いているゲームの、シードから続く乱数を使う (同じシードと同じ命令なら同じ結果になる。マルチプレイの前提)
let SIM = null;
const rnd = () => (SIM ? SIM.rand() : Math.random());
const pickOf = (list) => (list.length ? list[Math.floor(rnd() * list.length)] : null);
const earthSystems = (g) => g.realmSystems(g.cap).map((x) => x.id);
const loyaltyOf = (g, sys) => (sys === g.cap ? 60 : g.known(sys)?.loyalty ?? LOYALTY_START); // 地球に届いている記録で (光の遅れ)。首都は忠誠度を持たないので中ほどと見る
const richer = (g, v) => (g.gov(g.cap).credits > v ? 0.5 : -0.5); // 資金に余裕があれば、払う選択肢を選びやすい
// 忠誠度を動かす。首都 (忠誠度を持たない) では、その 3 分の 1 を議会の支持に
const loyal = (g, sys, d) => {
  if (sys === g.cap) { const c = Math.round(d / 3); if (c) g.councilAdd(c); return; }
  const gv = g.govs[sys];
  if (gv) gv.loyalty = clamp((gv.loyalty ?? LOYALTY_START) + d, 0, 100);
};
const scare = (g, sys, d) => { const gv = g.govs[sys]; if (gv && sys !== g.cap) gv.fear = clamp((gv.fear || 0) + d, 0, 100); };
const ask = (g, type, sys, text, opts, def, more = {}) => g.addDecision({ kind: 'story', type, sys, deadline: g.year + g.lightDelay(sys) + 15, def, text, opts, ...more });
const later = (type, data = {}, sys = undefined) => ({ type, data, sys, delay: 8 + 7 * rnd() }); // 続きは 8〜15 年あと
const here = (g, sys) => (sys === g.cap ? '太陽系' : g.system(sys).name);
const STORY = {
  derelict: {
    pick: (g) => pickOf(earthSystems(g)),
    start(g, sys) {
      g.event('story', sys, JA`${g.system(sys).name} の近くで、古い漂流船が見つかった`);
      g.addDecision({ kind: 'story', type: 'derelict', sys, deadline: g.year + g.lightDelay(sys) + 15, def: 'leave', text: JA`${g.system(sys).name} の近くで古い漂流船が見つかった。回収すれば資材になる。`,
        opts: [{ k: 'salvage', label: '回収する', cr: 100, note: '金属 300・希少元素 40 がこの星系の備蓄に入る。ただし 3 回に 1 回、船に眠っていた無人の戦闘艇が目を覚まし、この星系を襲う' },
          { k: 'leave', label: '地元の業者に払い下げる', note: '金属 100 だけが備蓄に入る (希少元素は業者のもの)。地元が儲かり忠誠度 +3' }] });
    },
    resolve(g, dec, k) {
      if (!g.isColonized(dec.sys)) return;
      if (k !== 'salvage') {
        g.mv(dec.sys, 'metal', 100, 'extract');
        const gv = g.govs[dec.sys];
        if (gv && dec.sys !== g.cap) gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 3);
        g.message(JA`${g.system(dec.sys).name} の業者が漂流船を解体した (金属 100・忠誠度 +3)`, dec.sys);
        return;
      }
      g.mv(dec.sys, 'metal', 300, 'extract'); g.mv(dec.sys, 'rare', 40, 'extract'); // 宇宙から回収した物質
      g.spendDecision(dec, { pv: dec.sys }); // 回収の代金は、その星系の民間 (回収した人々) へ
      g.message(JA`${g.system(dec.sys).name} で漂流船を回収した (金属 300・希少元素 40)`, dec.sys);
      if (g.rand() < 1 / 3) g.pirateRaid(g.system(dec.sys), 1); // 眠っていた戦闘艇 (小さな海賊の襲撃と同じ強さ)
    },
    next: (g, dec, k) => (k === 'salvage' && g.isColonized(dec.sys) ? later('derelict2') : null),
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
      g.event('story', sys, JA`${c.name} で居住施設の事故が起き、人口の2割を失った`);
      g.addDecision({ kind: 'story', type: 'accident', sys, deadline: g.year + g.lightDelay(sys) + 15, def: 'none', text: JA`${c.name} (${g.system(sys).name}) で居住施設の事故があり、人口の2割を失った。復興を支えるか。`,
        opts: [{ k: 'aid', label: '復興支援を送る', cr: 200, note: '資金 200 cr が届き、忠誠度 +10。議会の支持 −1 (遠くへの出費への批判)' },
          { k: 'none', label: '自力で立て直させる', note: '忠誠度 −8。議会の支持 +2 (国庫を守った)' }] });
    },
    resolve(g, dec, k, local) {
      const gv = g.govs[dec.sys];
      if (!gv || !g.isColonized(dec.sys)) return;
      if (k === 'aid') { g.release('grant', dec, 'cr', dec.sys, dec.payer ?? 0); gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 10); g.attend(dec.sys); g.councilAdd(-1, '遠くの復興に資金を出した'); g.message(JA`${g.system(dec.sys).name} に復興支援が届いた`, dec.sys); }
      else { gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 8); if (!local) g.councilAdd(2, '復興を現地に任せた'); g.message(JA`${g.system(dec.sys).name} は復興支援が来なかったことを恨んでいる (忠誠度 −8)`, dec.sys); }
    },
    weigh(g, dec, k) {
      const L = loyaltyOf(g, dec.sys);
      return k === 'aid' ? 1.2 + richer(g, 1000) + (L < 55 ? 0.8 : 0) : 1 + (g.council < 45 ? 0.6 : 0) + (L > 70 ? 0.4 : 0);
    },
  },
  refugees: {
    pick: (g) => (g.colonies.some((c) => c.sys !== g.cap && g.realmOf(c.sys) === g.cap) || g.rand() < 0.3 ? g.cap : null),
    start(g, sys) {
      const species = JA`${pickOf(KANA_A)}${pickOf(KANA_B)}人`;
      g.event('story', sys, JA`異星の難民船が太陽系に現れ、${species} 5万人が保護を求めている`);
      g.addDecision({ kind: 'story', type: 'refugees', sys, species, deadline: g.year + 5, def: 'refuse', text: JA`異星の難民船が${sys === 0 ? '太陽系' : g.system(sys).name}に現れた。${species} 5万人が保護を求めている。受け入れれば、${SIM_ONLY ? 'この星系の入植地に住む' : JA`空きのある${g.realmName(g.cap)}の入植地へ送る`}。`,
        opts: [{ k: 'accept', label: '受け入れる', note: JA`入植地の人口 +5万人 (${species})・議会の支持 −3 (反対派)` }, { k: 'refuse', label: '断る', note: '議会の支持 +2' }] });
    },
    resolve(g, dec, k) {
      if (k === 'refuse') { g.councilAdd(2, '難民を断った'); return; }
      // シミュレーション版: 難民船が着いた星系の入植地に住む (遠くの入植地へ一瞬では移れない)。ゲーム版は国じゅうで一番空きのある入植地
      const c = g.colonies.filter((x) => g.realmOf(x.sys) === g.cap && (!SIM_ONLY || x.sys === dec.sys)).sort((a, b) => (g.capOf(b) - b.pop) - (g.capOf(a) - a.pop))[0];
      if (!c) return;
      g.addPeople(c, 0.05, { [dec.species]: 1 });
      dec.settled = c.sys; // 続き (定住) はここで起きる
      g.councilAdd(-3, '難民を受け入れた');
      g.message(JA`${dec.species} の難民 5万人が ${c.name} に移り住んだ`, c.sys);
    },
    next: (g, dec, k) => (k === 'accept' && dec.settled !== undefined ? later('refugees2', { species: dec.species }, dec.settled) : null),
    weigh(g, dec, k) { return k === 'accept' ? 1 + (g.council > 55 ? 0.6 : 0) : 1 + (g.council < 45 ? 0.6 : 0); },
  },
  discovery: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap)),
    start(g, sys) {
      const r = pickOf(['metal', 'fuel', 'rare', 'water']);
      g.event('story', sys, JA`${g.system(sys).name} で${RES_LABEL[r]}の豊かな鉱脈が見つかった`, true);
      g.addDecision({ kind: 'story', type: 'discovery', sys, res: r, deadline: g.year + g.lightDelay(sys) + 15, def: 'local', text: JA`${g.system(sys).name} で${RES_LABEL[r]}の豊かな鉱脈が見つかった。開発を急がせるか。`,
        opts: [{ k: 'rush', label: '開発を急がせる', cr: 200, note: JA`${RES_LABEL[r]} 800 がこの星系の備蓄に入る。地元の採掘者を押しのけるので忠誠度 −5` },
          { k: 'local', label: '地元に任せる', note: JA`${RES_LABEL[r]} 250 が備蓄に入る。地元が潤い忠誠度 +3` }] });
    },
    resolve(g, dec, k) {
      if (!g.isColonized(dec.sys)) return;
      g.mv(dec.sys, dec.res, k === 'rush' ? 800 : 250, 'extract');
      if (k === 'rush') g.spendDecision(dec, { pv: dec.sys });
      const gv = g.govs[dec.sys];
      if (gv && dec.sys !== g.cap) gv.loyalty = clamp((gv.loyalty ?? LOYALTY_START) + (k === 'rush' ? -5 : 3), 0, 100);
      g.message(JA`${g.system(dec.sys).name} の鉱脈から${RES_LABEL[dec.res]} ${k === 'rush' ? 800 : 250} を得た (忠誠度 ${k === 'rush' ? '−5' : '+3'})`, dec.sys);
    },
    next: (g, dec, k) => (k === 'rush' ? later('discovery2', { res: dec.res }) : null),
    weigh(g, dec, k) {
      const L = loyaltyOf(g, dec.sys);
      return k === 'rush' ? 1.2 + richer(g, 800) + (L > 65 ? 0.5 : 0) : 1 + (L < 50 ? 0.6 : 0);
    },
  },
  envoy: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => g.system(id).bodies.some((b) => g.nativeOf(id, b.id)?.st.status === 'independent'))),
    start(g, sys) {
      const b = g.system(sys).bodies.find((x) => g.nativeOf(sys, x.id)?.st.status === 'independent');
      const n = g.nativeOf(sys, b.id);
      g.event('story', sys, JA`${b.name} の${n.def.species}が使節を送ってきた`);
      g.addDecision({ kind: 'story', type: 'envoy', sys, body: b.id, deadline: g.year + g.lightDelay(sys) + 15, def: 'refuse', text: JA`${b.name} (${g.system(sys).name}) の${n.def.species}が使節を送ってきた (友好度 ${Math.round(n.st.rel)})。`,
        opts: [{ k: 'welcome', label: '歓待する', cr: 150, note: '友好度 +20。議会の支持 −2 (異星の民に甘い、と強硬派)' },
          { k: 'refuse', label: '追い返す', note: '友好度 −10。議会の支持 +2 (強硬派が喜ぶ)' }] });
    },
    resolve(g, dec, k, local) {
      const n = g.nativeOf(dec.sys, dec.body);
      if (!n || n.st.status !== 'independent') return;
      n.st.rel = clamp(n.st.rel + (k === 'welcome' ? 20 : -10), -100, 100);
      if (k === 'welcome') g.spendDecision(dec, { nat: `${dec.sys}|${dec.body}` }); // 歓待の費用は、使節への贈り物
      if (!local) g.councilAdd(k === 'welcome' ? -2 : 2, k === 'welcome' ? '異星の使節を歓待した' : '異星の使節を追い返した');
      g.message(JA`${n.def.species}の使節を${k === 'welcome' ? '歓待した' : '追い返した'} (友好度 ${Math.round(n.st.rel)})`, dec.sys);
    },
    next: (g, dec, k) => (k === 'welcome' ? later('envoy2', { body: dec.body }) : null),
    weigh(g, dec, k) {
      const rel = g.nativeOf(dec.sys, dec.body)?.st.rel ?? 0;
      return k === 'welcome' ? 1.3 + richer(g, 800) + (rel < 0 ? 0.6 : 0) : 1 + (g.council < 40 ? 0.6 : 0) + (rel > 40 ? 0.4 : 0);
    },
  },
  plague: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => g.coloniesIn(id).some((c) => c.pop >= 0.5 && !(c.plague > g.year)))),
    start(g, sys) {
      const c = g.coloniesIn(sys).filter((x) => x.pop >= 0.5).sort((a, b) => b.pop - a.pop)[0];
      c.plague = g.year + 15;
      g.event('story', sys, JA`${c.name} で疫病が広がり始めた (15年のあいだ人口が伸びにくい)`);
      g.addDecision({ kind: 'story', type: 'plague', sys, col: colKey(c), deadline: g.year + g.lightDelay(sys) + 10, def: 'none', text: JA`${c.name} (${g.system(sys).name}) で疫病が広がっている。医療団を送れば、届いた時点で収まる。港を閉じて隔離すれば、費用なしで早く収まるが、閉じ込められた人々は恨む。`,
        opts: [{ k: 'cure', label: '医療団を送る', cr: sys === g.cap ? 200 : 400, ...(sys === g.cap ? {} : { team: true }), note: sys === g.cap ? '疫病が収まる (首都なので遠くへ送らずに済み、費用は半分)' : JA`船で ${g.shipYears(g.cap, sys, !!g.routeBetween(g.cap, sys)).toFixed(1)} 年かけて届けば疫病が収まり、忠誠度 +5` }, { k: 'none', label: '隔離する', note: sys === g.cap ? '疫病は届いてから 5 年で収まる (送らなければ 15 年)。港の封鎖への反発で議会の支持 −4' : '疫病は届いてから 5 年で収まる (送らなければ 15 年)。閉じ込められた恨みで忠誠度 −10' }] });
    },
    resolve(g, dec, k, local) {
      const c = g.colonyByKey(dec.col);
      const gv = g.govs[dec.sys];
      if (!c || !gv) return;
      if (k === 'cure') { g.spendDecision(dec, { pv: dec.sys }); c.plague = 0; gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 5); g.attend(dec.sys); g.message(JA`${c.name} に医療団が着き、疫病が収まった`, dec.sys); }
      else if (local) { if (dec.sys !== g.cap) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 5); } // 返事がなかった: 疫病は 15 年続く
      else {
        c.plague = Math.min(c.plague || 0, g.year + 5);
        if (dec.sys !== g.cap) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 10); else g.councilAdd(-4, '港を封鎖した');
        g.message(JA`${c.name} を隔離した (疫病は ${Math.round(g.year + 5)} 年までに収まる${dec.sys !== g.cap ? '・忠誠度 −10' : ''})`, dec.sys);
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
  // --- 連作の続き (回 SE3) ---
  refugees2: {
    follow: true,
    start(g, sys, d) {
      ask(g, 'refugees2', sys, JA`${here(g, sys)}に移り住んだ${d.species}と元の住民が、言葉と祭りをめぐって対立している (難民の続き 2/3)。`, [
        { k: 'assimilate', label: '同化政策をとる', note: '議会の支持 +2・この星系の忠誠度 −6 (移民の反発)' },
        { k: 'enclave', label: '自治区を認める', note: '忠誠度 +6・議会の支持 −2 (「特別扱い」への批判)' }], 'enclave', { species: d.species });
    },
    resolve(g, dec, k, local) {
      if (k === 'assimilate') { g.councilAdd(2, '移民に同化政策をとった'); loyal(g, dec.sys, -6); } else { loyal(g, dec.sys, 6); if (!local) g.councilAdd(-2, '移民の自治区を認めた'); }
    },
    next: (g, dec, k) => later('refugees3', { species: dec.species, path: k }),
    weigh: (g, dec, k) => (k === 'assimilate' ? 1 + (g.council < 50 ? 0.6 : 0) : 1 + (loyaltyOf(g, dec.sys) < 60 ? 0.6 : 0)),
  },
  refugees3: {
    follow: true,
    start(g, sys, d) {
      if (d.path === 'assimilate') {
        ask(g, 'refugees3', sys, JA`同化政策に反発した${d.species}の地下の抵抗が、${here(g, sys)}で広がっている (難民の続き 3/3)。`, [
          { k: 'crack', label: '取り締まる', note: '恐怖度 +20・忠誠度 −8' },
          { k: 'reconcile', label: '和解金を出す', cr: 250, note: '忠誠度 +10' }], 'crack', { path: d.path });
      } else {
        ask(g, 'refugees3', sys, JA`${here(g, sys)}の${d.species}の自治区が、自前の議会を求めている (難民の続き 3/3)。`, [
          { k: 'grant', label: '認める', note: JA`${CONCESSION_YEARS} 年の自治 (この星系は指令を受けない)・忠誠度 +10` },
          { k: 'deny', label: '拒む', note: '忠誠度 −15' }], 'deny', { path: d.path });
      }
    },
    resolve(g, dec, k) {
      const gv = g.govs[dec.sys];
      if (k === 'crack') { scare(g, dec.sys, 20); loyal(g, dec.sys, -8); }
      else if (k === 'reconcile') { g.spendDecision(dec, { pv: dec.sys }); loyal(g, dec.sys, 10); }
      else if (k === 'grant') { if (gv && dec.sys !== g.cap) gv.autonomy = g.year + CONCESSION_YEARS; loyal(g, dec.sys, 10); }
      else loyal(g, dec.sys, -15);
      g.message(JA`${here(g, dec.sys)}の移民の件が決着した (${dec.opts.find((o) => o.k === k)?.label})`, dec.sys);
    },
    weigh(g, dec, k) {
      const L = loyaltyOf(g, dec.sys);
      if (dec.path === 'assimilate') return k === 'crack' ? 1 + (L > 60 ? 0.6 : 0) : 1 + richer(g, 1500) + (L < 50 ? 0.6 : 0);
      return k === 'grant' ? 1 + (L < 50 ? 0.8 : 0) : 1 + (L > 70 ? 0.6 : 0);
    },
  },
  derelict2: {
    follow: true,
    start(g, sys) {
      ask(g, 'derelict2', sys, JA`${here(g, sys)}で回収した漂流船の航法記録が解読された。どこかの座標が残っている (漂流船の続き 2/3)。`, [
        { k: 'survey', label: '調査隊を送る', cr: 200, note: '半分の確率で、記録の示す先に何かが見つかる (次の段)' },
        { k: 'publish', label: '学会に公開する', note: '政治力 +5・議会の支持 +1。調査はしない' }], 'publish');
    },
    resolve(g, dec, k) {
      if (k === 'survey') { g.spendDecision(dec, { pv: dec.sys }); dec.found = g.rand() < 0.5; if (!dec.found) g.message(JA`${here(g, dec.sys)}の調査隊は何も見つけられなかった`, dec.sys); }
      else { g.pc = Math.min(g.pcCap(), g.pc + 5); g.councilAdd(1, '古い航法記録を公開した'); }
    },
    next: (g, dec, k) => (k === 'survey' && dec.found ? later('derelict3') : null),
    weigh: (g, dec, k) => (k === 'survey' ? 1 + richer(g, 1500) : 1 + (g.pc < 40 ? 0.6 : 0)),
  },
  derelict3: {
    follow: true,
    start(g, sys) {
      ask(g, 'derelict3', sys, JA`記録の示す先に、古い前哨の残骸があった (漂流船の続き 3/3)。`, [
        { k: 'take', label: '持ち帰る', note: '希少元素 120 がこの星系の備蓄に入る。3 回に 1 回、残っていた防衛装置が動き出して星系を襲う' },
        { k: 'keep', label: '史跡として残す', note: '議会の支持 +2・この星系の忠誠度 +5' }], 'keep');
    },
    resolve(g, dec, k) {
      if (!g.isColonized(dec.sys)) return;
      if (k === 'take') { g.mv(dec.sys, 'rare', 120, 'extract'); if (g.rand() < 1 / 3) g.pirateRaid(g.system(dec.sys), 1); }
      else { g.councilAdd(2, '古い前哨を史跡にした'); loyal(g, dec.sys, 5); }
    },
    weigh: (g, dec, k) => (k === 'take' ? 1 + (g.knownGarrison(dec.sys) >= 1 ? 0.6 : -0.4) : 1 + (g.council < 50 ? 0.6 : 0)),
  },
  discovery2: {
    follow: true,
    start(g, sys, d) {
      ask(g, 'discovery2', sys, JA`${here(g, sys)}の、開発を急がせた${RES_LABEL[d.res]}の鉱山で労働争議が起きた (鉱脈の続き 2/3)。`, [
        { k: 'wage', label: '賃上げに応じる', cr: 200, note: '忠誠度 +8' },
        { k: 'suppress', label: '抑え込む', note: '恐怖度 +20・忠誠度 −8' }], 'wage', { res: d.res });
    },
    resolve(g, dec, k) {
      if (k === 'wage') { if (dec.payer !== undefined) g.spendDecision(dec, { pv: dec.sys }); loyal(g, dec.sys, 8); } else { scare(g, dec.sys, 20); loyal(g, dec.sys, -8); }
    },
    next: (g, dec, k) => later('discovery3', { res: dec.res, path: k }),
    weigh: (g, dec, k) => (k === 'wage' ? 1 + richer(g, 1200) + (loyaltyOf(g, dec.sys) < 55 ? 0.6 : 0) : 1 + (loyaltyOf(g, dec.sys) > 65 ? 0.6 : 0)),
  },
  discovery3: {
    follow: true,
    start(g, sys, d) {
      ask(g, 'discovery3', sys, JA`${here(g, sys)}の鉱山会社が、星系の自治を求めている${d.path === 'suppress' ? ' (争議を抑え込まれた恨みがある)' : ''} (鉱脈の続き 3/3)。`, [
        { k: 'grant', label: '自治を認める', note: JA`${CONCESSION_YEARS} 年の自治 (指令を受けない)・${RES_LABEL[d.res]} 600 が備蓄に入る` },
        { k: 'state', label: '国の管理にする', cr: 300, note: JA`忠誠度 −${d.path === 'suppress' ? 15 : 8}` }], 'grant', { res: d.res, path: d.path });
    },
    resolve(g, dec, k) {
      const gv = g.govs[dec.sys];
      if (!gv || !g.isColonized(dec.sys)) return;
      if (k === 'grant') { if (dec.sys !== g.cap) gv.autonomy = g.year + CONCESSION_YEARS; g.mv(dec.sys, dec.res, 600, 'extract'); }
      else { g.spendDecision(dec, { pv: dec.sys }); loyal(g, dec.sys, dec.path === 'suppress' ? -15 : -8); }
    },
    weigh: (g, dec, k) => (k === 'grant' ? 1 + (loyaltyOf(g, dec.sys) < 50 ? 0.8 : 0) : 1 + richer(g, 2000) + (loyaltyOf(g, dec.sys) > 70 ? 0.4 : 0)),
  },
  envoy2: {
    follow: true,
    start(g, sys, d) {
      const n = g.nativeOf(sys, d.body);
      if (!n || n.st.status !== 'independent') return;
      ask(g, 'envoy2', sys, JA`歓待した${n.def.species}が、交易を申し出てきた (使節の続き 2/2)。`, [
        { k: 'trade', label: '受ける', note: '友好度 +15・希少元素 100 がこの星系の備蓄に入る。議会の支持 −1' },
        { k: 'refuse', label: '断る', note: '友好度 −10・議会の支持 +1' }], 'trade', { body: d.body });
    },
    resolve(g, dec, k, local) {
      const n = g.nativeOf(dec.sys, dec.body);
      if (!n || n.st.status !== 'independent') return;
      n.st.rel = clamp(n.st.rel + (k === 'trade' ? 15 : -10), -100, 100);
      if (k === 'trade') { if (g.isColonized(dec.sys)) g.mv(dec.sys, 'rare', 100, 'extract'); if (!local) g.councilAdd(-1, '異星の民と交易を始めた'); } else if (!local) g.councilAdd(1, '異星の民との交易を断った');
    },
    weigh: (g, dec, k) => (k === 'trade' ? 1 + (g.council > 50 ? 0.6 : 0) : 1 + (g.council < 45 ? 0.6 : 0)),
  },
  // --- 新しい連作 (回 SE3) ---
  cult: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap && g.coloniesIn(id).some((c) => c.pop >= 0.1))),
    start(g, sys) {
      g.event('story', sys, JA`${here(g, sys)}で新しい信仰が広がっている`);
      ask(g, 'cult', sys, JA`${here(g, sys)}で新しい信仰が広がっている。信者は星系の人口の 1 割を超えた (新しい信仰 1/3)。`, [
        { k: 'allow', label: '認める', note: '忠誠度 +5・議会の支持 −2 (保守派)' },
        { k: 'suppress', label: '抑える', note: '恐怖度 +15・忠誠度 −6・議会の支持 +1' }], 'allow');
    },
    resolve(g, dec, k, local) {
      if (k === 'allow') { loyal(g, dec.sys, 5); if (!local) g.councilAdd(-2, '新しい信仰を認めた'); } else { scare(g, dec.sys, 15); loyal(g, dec.sys, -6); g.councilAdd(1, '新しい信仰を抑えた'); }
    },
    next: (g, dec, k) => later('cult2', { path: k }),
    weigh: (g, dec, k) => (k === 'allow' ? 1 + (loyaltyOf(g, dec.sys) < 60 ? 0.6 : 0) : 1 + (g.council < 45 ? 0.6 : 0)),
  },
  cult2: {
    follow: true,
    start(g, sys, d) {
      if (d.path === 'allow') {
        ask(g, 'cult2', sys, JA`${here(g, sys)}の信者が、地球の古い遺跡への巡礼船を求めている (新しい信仰 2/3)。`, [
          { k: 'ship', label: '巡礼船を出す', cr: 200, note: '忠誠度 +8' },
          { k: 'deny', label: '断る', note: '忠誠度 −6' }], 'deny', { path: d.path });
      } else {
        ask(g, 'cult2', sys, JA`${here(g, sys)}の信者が地下に潜り、集会を続けている (新しい信仰 2/3)。`, [
          { k: 'raid', label: '集会を摘発する', note: '恐怖度 +15・忠誠度 −8' },
          { k: 'ignore', label: '黙認する', note: '議会の支持 −2' }], 'ignore', { path: d.path });
      }
    },
    resolve(g, dec, k, local) {
      if (k === 'ship') { g.spendDecision(dec, { pv: dec.sys }); loyal(g, dec.sys, 8); }
      else if (k === 'deny') loyal(g, dec.sys, -6);
      else if (k === 'raid') { scare(g, dec.sys, 15); loyal(g, dec.sys, -8); }
      else if (!local) g.councilAdd(-2, '地下の集会を黙認した');
    },
    next: (g, dec, k) => later('cult3', { path: dec.path, last: k }),
    weigh(g, dec, k) {
      const L = loyaltyOf(g, dec.sys);
      if (dec.path === 'allow') return k === 'ship' ? 1 + richer(g, 1200) + (L < 55 ? 0.6 : 0) : 1 + (L > 70 ? 0.6 : 0);
      return k === 'raid' ? 1 + (L > 60 ? 0.6 : 0) : 1 + (g.council > 55 ? 0.6 : 0);
    },
  },
  cult3: {
    follow: true,
    start(g, sys, d) {
      ask(g, 'cult3', sys, JA`${here(g, sys)}の信仰の分派が、星系の独立を口にし始めた (新しい信仰 3/3)。`, [
        { k: 'talk', label: '対話する', pc: 10, note: '政治力 10・忠誠度 +10' },
        { k: 'exile', label: '指導者を流刑にする', note: '恐怖度 +20・議会の支持 +2・忠誠度 −5' }], 'talk');
    },
    resolve(g, dec, k) {
      if (k === 'talk') loyal(g, dec.sys, 10); else { scare(g, dec.sys, 20); g.councilAdd(2, '分派の指導者を流刑にした'); loyal(g, dec.sys, -5); }
    },
    weigh: (g, dec, k) => (k === 'talk' ? 1 + (loyaltyOf(g, dec.sys) < 50 ? 0.8 : 0) : 1 + (g.council < 50 ? 0.6 : 0)),
  },
  scandal: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap && g.year - (g.gov(id).founded ?? g.year) > 20)),
    start(g, sys) {
      g.event('story', sys, JA`${here(g, sys)}の総督に汚職のうわさが立った`);
      ask(g, 'scandal', sys, JA`${here(g, sys)}の総督が、交易の利益を横流ししているといううわさがある (総督の汚職 1/3)。`, [
        { k: 'probe', label: '調査団を送る', pc: 8, note: '政治力 8。証拠が出れば次の段へ' },
        { k: 'ignore', label: '見逃す', note: '議会の支持 −2・忠誠度 +2 (地元の顔役は喜ぶ)' }], 'ignore');
    },
    resolve(g, dec, k, local) {
      if (k === 'ignore') { if (!local) g.councilAdd(-2, '総督の汚職を見逃した'); loyal(g, dec.sys, 2); }
    },
    next: (g, dec, k) => (k === 'probe' ? later('scandal2') : null),
    weigh: (g, dec, k) => (k === 'probe' ? 1 + (g.pc > 40 ? 0.6 : -0.4) : 1 + (loyaltyOf(g, dec.sys) < 50 ? 0.6 : 0)),
  },
  scandal2: {
    follow: true,
    start(g, sys) {
      ask(g, 'scandal2', sys, JA`調査団が、${here(g, sys)}の総督の汚職の証拠をつかんだ (総督の汚職 2/3)。`, [
        { k: 'trial', label: '裁判にかける', note: '議会の支持 +3・忠誠度 +4。総督の派閥が反発する (次の段)' },
        { k: 'quiet', label: '穏便に辞めさせる', note: '議会の支持 −1 (うやむやにした)' }], 'quiet');
    },
    resolve(g, dec, k, local) {
      if (k === 'trial') { g.councilAdd(3, '汚職の総督を裁判にかけた'); loyal(g, dec.sys, 4); } else if (!local) g.councilAdd(-1, '汚職の総督を穏便に辞めさせた');
    },
    next: (g, dec, k) => (k === 'trial' ? later('scandal3') : null),
    weigh: (g, dec, k) => (k === 'trial' ? 1 + (g.council < 55 ? 0.6 : 0) : 1 + (loyaltyOf(g, dec.sys) < 50 ? 0.6 : 0)),
  },
  scandal3: {
    follow: true,
    start(g, sys) {
      ask(g, 'scandal3', sys, JA`裁かれた総督の派閥が、${here(g, sys)}の住民を煽っている (総督の汚職 3/3)。`, [
        { k: 'appease', label: '派閥に譲歩する', cr: 250, note: '忠誠度 +6' },
        { k: 'push', label: '押し切る', note: '忠誠度 −10・恐怖度 +10' }], 'push');
    },
    resolve(g, dec, k) {
      if (k === 'appease') { g.spendDecision(dec, { pv: dec.sys }); loyal(g, dec.sys, 6); } else { loyal(g, dec.sys, -10); scare(g, dec.sys, 10); }
    },
    weigh: (g, dec, k) => (k === 'appease' ? 1 + richer(g, 1500) + (loyaltyOf(g, dec.sys) < 55 ? 0.6 : 0) : 1 + (loyaltyOf(g, dec.sys) > 65 ? 0.6 : 0)),
  },
  signal: {
    pick: (g) => pickOf(earthSystems(g)),
    start(g, sys) {
      g.event('story', sys, JA`${here(g, sys)}の観測所が、遠くからの規則的な信号をとらえた`);
      ask(g, 'signal', sys, JA`${here(g, sys)}の観測所が、遠くからの規則的な信号をとらえた (謎の信号 1/3)。`, [
        { k: 'decode', label: '解読に予算を出す', cr: 150, note: '次の段へ' },
        { k: 'ignore', label: '放っておく', note: '議会の支持 +1 (無駄遣いをしなかった)' }], 'ignore');
    },
    resolve(g, dec, k, local) {
      if (k === 'decode') g.spendDecision(dec, { pv: dec.sys }); else if (!local) g.councilAdd(1, '謎の信号の解読を見送った');
    },
    next: (g, dec, k) => (k === 'decode' ? later('signal2') : null),
    weigh: (g, dec, k) => (k === 'decode' ? 1.3 + richer(g, 800) : 1 + (g.council < 50 ? 0.6 : 0)),
  },
  signal2: {
    follow: true,
    start(g, sys) {
      ask(g, 'signal2', sys, JA`解読した信号は、どこかの座標を示しているらしい (謎の信号 2/3)。`, [
        { k: 'observe', label: '観測所を建てる', cr: 150, note: '次の段で、信号の主が分かる' },
        { k: 'publish', label: '公表する', note: '議会の支持 +3 (人々が沸く)。それ以上は調べない' }], 'publish');
    },
    resolve(g, dec, k) {
      if (k === 'observe') g.spendDecision(dec, { pv: dec.sys }); else g.councilAdd(3, '謎の信号を公表した');
    },
    next: (g, dec, k) => (k === 'observe' ? later('signal3') : null),
    weigh: (g, dec, k) => (k === 'observe' ? 1 + richer(g, 1500) : 1 + (g.council < 55 ? 0.6 : 0)),
  },
  signal3: {
    follow: true,
    start(g, sys) {
      ask(g, 'signal3', sys, JA`信号の主は、数百年前に送り出された古い探査機だった (謎の信号 3/3)。`, [
        { k: 'recover', label: '資料を回収する', note: '希少元素 80 がこの星系の備蓄に入る' },
        { k: 'museum', label: '博物館に収める', note: '議会の支持 +2・この星系の忠誠度 +5' }], 'museum');
    },
    resolve(g, dec, k) {
      if (k === 'recover') { if (g.isColonized(dec.sys)) g.mv(dec.sys, 'rare', 80, 'extract'); } else { g.councilAdd(2, '古い探査機を博物館に収めた'); loyal(g, dec.sys, 5); }
    },
    weigh: (g, dec, k) => (k === 'recover' ? 1 + (g.council > 55 ? 0.6 : 0) : 1 + (g.council < 50 ? 0.6 : 0)),
  },
};

