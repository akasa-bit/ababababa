// --- 語り手の出来事 ---
// pick(g) は起こせる星系 (なければ null)、start(g, sys) は出来事を起こし、多くは「決めること」を出す。resolve(g, dec, k, local) は返事が届いたときの効果
// (local = 期限までに返事がなく、現地が既定の選択肢で決めた)
const STORY_RESET = new Set(['politics', 'demand', 'battle', 'pirate', 'war', 'natives', 'story', 'famine']);
// 試合の乱数: いま動いているゲームの、シードから続く乱数を使う (同じシードと同じ命令なら同じ結果になる。マルチプレイの前提)
let SIM = null;
const rnd = () => (SIM ? SIM.rand() : Math.random());
const pickOf = (list) => (list.length ? list[Math.floor(rnd() * list.length)] : null);
const earthSystems = (g) => g.realmSystems(g.cap).map((x) => x.id);
const STORY = {
  derelict: {
    pick: (g) => pickOf(earthSystems(g)),
    start(g, sys) {
      g.event('story', sys, `${g.system(sys).name} の近くで、古い漂流船が見つかった`);
      g.addDecision({ kind: 'story', type: 'derelict', sys, deadline: g.year + g.lightDelay(sys) + 15, def: 'leave', text: `${g.system(sys).name} の近くで古い漂流船が見つかった。回収すれば資材になる。`,
        opts: [{ k: 'salvage', label: '回収する', cr: 100, note: '金属 300・希少元素 40 がこの星系の備蓄に入る' }, { k: 'leave', label: '放っておく', note: '何も起きない' }] });
    },
    resolve(g, dec, k) {
      if (k !== 'salvage' || !g.isColonized(dec.sys)) return;
      g.mv(dec.sys, 'metal', 300, 'extract'); g.mv(dec.sys, 'rare', 40, 'extract'); // 宇宙から回収した物質
      g.spendDecision(dec, { pv: dec.sys }); // 回収の代金は、その星系の民間 (回収した人々) へ
      g.message(`${g.system(dec.sys).name} で漂流船を回収した (金属 300・希少元素 40)`, dec.sys);
    },
  },
  accident: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap && g.coloniesIn(id).some((c) => c.pop >= 0.05) && g.year - (g.gov(id).founded ?? g.year) < 100)),
    start(g, sys) {
      const c = g.coloniesIn(sys).sort((a, b) => b.pop - a.pop)[0];
      c.pop *= 0.8;
      g.event('story', sys, `${c.name} で居住施設の事故が起き、人口の2割を失った`);
      g.addDecision({ kind: 'story', type: 'accident', sys, deadline: g.year + g.lightDelay(sys) + 15, def: 'none', text: `${c.name} (${g.system(sys).name}) で居住施設の事故があり、人口の2割を失った。復興を支えるか。`,
        opts: [{ k: 'aid', label: '復興支援を送る', cr: 300, note: '資金 300 cr が届き、忠誠度 +10' }, { k: 'none', label: '送らない', note: '忠誠度 −8' }] });
    },
    resolve(g, dec, k) {
      const gv = g.govs[dec.sys];
      if (!gv || !g.isColonized(dec.sys)) return;
      if (k === 'aid') { g.release('grant', dec, 'cr', dec.sys, dec.payer ?? 0); gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 10); g.attend(dec.sys); g.message(`${g.system(dec.sys).name} に復興支援が届いた`, dec.sys); }
      else { gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 8); g.message(`${g.system(dec.sys).name} は復興支援が来なかったことを恨んでいる (忠誠度 −8)`, dec.sys); }
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
  },
  discovery: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => id !== g.cap)),
    start(g, sys) {
      const r = pickOf(['metal', 'fuel', 'rare', 'water']);
      g.event('story', sys, `${g.system(sys).name} で${RES_LABEL[r]}の豊かな鉱脈が見つかった`, true);
      g.addDecision({ kind: 'story', type: 'discovery', sys, res: r, deadline: g.year + g.lightDelay(sys) + 15, def: 'local', text: `${g.system(sys).name} で${RES_LABEL[r]}の豊かな鉱脈が見つかった。開発を急がせるか。`,
        opts: [{ k: 'rush', label: '開発を急がせる', cr: 200, note: `${RES_LABEL[r]} 800 がこの星系の備蓄に入る` }, { k: 'local', label: '地元に任せる', note: `${RES_LABEL[r]} 250 が備蓄に入る` }] });
    },
    resolve(g, dec, k) {
      if (!g.isColonized(dec.sys)) return;
      g.mv(dec.sys, dec.res, k === 'rush' ? 800 : 250, 'extract');
      if (k === 'rush') g.spendDecision(dec, { pv: dec.sys });
      g.message(`${g.system(dec.sys).name} の鉱脈から${RES_LABEL[dec.res]} ${k === 'rush' ? 800 : 250} を得た`, dec.sys);
    },
  },
  envoy: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => g.system(id).bodies.some((b) => g.nativeOf(id, b.id)?.st.status === 'independent'))),
    start(g, sys) {
      const b = g.system(sys).bodies.find((x) => g.nativeOf(sys, x.id)?.st.status === 'independent');
      const n = g.nativeOf(sys, b.id);
      g.event('story', sys, `${b.name} の${n.def.species}が使節を送ってきた`);
      g.addDecision({ kind: 'story', type: 'envoy', sys, body: b.id, deadline: g.year + g.lightDelay(sys) + 15, def: 'refuse', text: `${b.name} (${g.system(sys).name}) の${n.def.species}が使節を送ってきた (友好度 ${Math.round(n.st.rel)})。`,
        opts: [{ k: 'welcome', label: '歓待する', cr: 150, note: '友好度 +20' }, { k: 'refuse', label: '追い返す', note: '友好度 −10' }] });
    },
    resolve(g, dec, k) {
      const n = g.nativeOf(dec.sys, dec.body);
      if (!n || n.st.status !== 'independent') return;
      n.st.rel = clamp(n.st.rel + (k === 'welcome' ? 20 : -10), -100, 100);
      if (k === 'welcome') g.spendDecision(dec, { nat: `${dec.sys}|${dec.body}` }); // 歓待の費用は、使節への贈り物
      g.message(`${n.def.species}の使節を${k === 'welcome' ? '歓待した' : '追い返した'} (友好度 ${Math.round(n.st.rel)})`, dec.sys);
    },
  },
  plague: {
    pick: (g) => pickOf(earthSystems(g).filter((id) => g.coloniesIn(id).some((c) => c.pop >= 0.5 && !(c.plague > g.year)))),
    start(g, sys) {
      const c = g.coloniesIn(sys).filter((x) => x.pop >= 0.5).sort((a, b) => b.pop - a.pop)[0];
      c.plague = g.year + 15;
      g.event('story', sys, `${c.name} で疫病が広がり始めた (15年のあいだ人口が伸びにくい)`);
      g.addDecision({ kind: 'story', type: 'plague', sys, col: colKey(c), deadline: g.year + g.lightDelay(sys) + 10, def: 'none', text: `${c.name} (${g.system(sys).name}) で疫病が広がっている。医療団を送れば、届いた時点で収まる。`,
        opts: [{ k: 'cure', label: '医療団を送る', cr: 400, note: '届けば疫病が収まり、忠誠度 +5' }, { k: 'none', label: '送らない', note: '疫病は15年続く。忠誠度 −5' }] });
    },
    resolve(g, dec, k) {
      const c = g.colonyByKey(dec.col);
      const gv = g.govs[dec.sys];
      if (!c || !gv) return;
      if (k === 'cure') { g.spendDecision(dec, { pv: dec.sys }); c.plague = 0; gv.loyalty = Math.min(100, (gv.loyalty ?? LOYALTY_START) + 5); g.attend(dec.sys); g.message(`${c.name} に医療団が着き、疫病が収まった`, dec.sys); }
      else if (dec.sys !== g.cap) gv.loyalty = Math.max(0, (gv.loyalty ?? LOYALTY_START) - 5);
    },
  },
  raid: {
    // 海賊が本格的に現れる前の、小さな襲撃
    pick: (g) => (g.year < PIRATE_START + 10 ? pickOf(earthSystems(g).filter((id) => id !== g.cap)) : null),
    start(g, sys) { if (SIM_ONLY) g.pirateLaunch(g.system(sys), 1); else g.pirateRaid(g.system(sys), 1); }, // シミュレーション版は、どこかの星系から飛んで来る
    resolve() {},
  },
};

