// 戦略ボットの自動対戦: シード × 戦略ごとに、新しいゲームから Y 年進めて、状態の推移・仕組みの発火回数・静かな年を記録する
// 使い方: node bots.js <html> <outdir> <years> <seeds(カンマ区切り)> <strategies(カンマ区切り)>
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [html, outdir, yearsS, seedsS, stratS] = process.argv.slice(2);
  const years = Number(yearsS);
  const seeds = seedsS.split(',');
  const strategies = stratS.split(',');
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const strategy of strategies) for (const seed of seeds) {
    const out = `${outdir}/${strategy}-${seed}.json`;
    if (fs.existsSync(out)) continue;
    const p = await b.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((rs) => {
      let a = rs; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      try { localStorage.clear(); } catch {}
    }, [...(seed + strategy)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7));
    await p.goto(`file://${html}?seed=${seed}&home=0`);
    await p.waitForTimeout(300);
    const t0 = Date.now();
    const res = await p.evaluate(([strategy, years]) => {
      const g = __app.game; __app.speed = 0;
      const dist0 = (id) => Math.hypot(g.system(id).x - g.system(0).x, g.system(id).y - g.system(0).y);
      // --- 戦略 ---
      if (strategy === 'none') { g.autoDefense = false; g.autoBuild = false; g.autoAwe = false; g.autoGrant = false; g.autoHabitat = false; g.auto[0] = false; }
      else g.setSpectate(true);
      if (strategy === 'peaceful') {
        g.autoAwe = false;
        g.earthWarYearly = function () { for (const x of this.colonizedSystems()) { const r = x.id; if (r !== 0 && this.realmOf(r) === r && this.atWar(0, r) && !this.requests.some((q) => q.kind === 'order' && q.act === 'peace' && Number(q.d.sys) === r)) this.command('peace', { sys: r }); } };
      }
      if (strategy === 'warlike') {
        const orig = g.earthWarYearly.bind(g);
        g.earthWarYearly = function () {
          const ours = this.realmShips(0);
          for (const x of this.colonizedSystems()) { const r = x.id; if (r === 0 || this.realmOf(r) !== r || !this.gov(r).independent || this.atWar(0, r)) continue; if (ours > 1.5 * Math.max(1, this.realmShips(r)) && Math.random() < 0.3) this.declareWar(r); }
          orig();
        };
      }
      if (strategy === 'loyalist') {
        const orig = g.grantsYearly.bind(g);
        g.grantsYearly = function () {
          orig();
          for (const [k, gv] of Object.entries(this.govs)) { const id = Number(k); if (id === 0 || gv.lord !== 0 || !this.isColonized(id) || (gv.loyalty ?? 70) >= 50) continue; if (this.gov(0).credits > 2000) this.sendGrant(0, id, 300); }
        };
      }
      // 新しい梃子の比較: 委任方針と国家方針をそろえる (拡張に振る / 内政と整備に振る)
      if (strategy === 'mandexpand' || strategy === 'manddevelop') {
        const [mand, pol] = strategy === 'mandexpand' ? ['expand', 'expand'] : ['develop', 'consolidate'];
        g.aiPolicy = pol;
        const orig = g.earthPoliticsYearly.bind(g);
        g.earthPoliticsYearly = function () {
          orig();
          for (const [k, gv] of Object.entries(this.govs)) { const id = Number(k); if (id !== 0 && this.isColonized(id) && this.realmOf(id) === 0 && gv.mandate !== mand && !this.requests.some((q) => q.act === 'mandate' && Number(q.d.sys) === id) && this.pc >= this.pcCost('mandate', { sys: id }) + 10) this.command('mandate', { sys: id, value: mand }); }
        };
      }
      // 放置: 政治に手を出さない (視察しない、要求には返事をしない、語り手の出来事も放っておく)。ほかは放任と同じ
      if (strategy === 'neglect') g.earthPoliticsYearly = function () {};
      if (strategy === 'expansion') {
        const origC = g.canColonize.bind(g);
        g.canColonize = function (id) { if (id === 0) this.gov(0).lastColony = -1e9; return origC(id); };
      }
      // --- 計測 ---
      const counts = {};
      const add = (k, v = 1) => { counts[k] = (counts[k] || 0) + v; };
      const indep = [];
      const wrap = (name, after) => { const o = g[name].bind(g); g[name] = (...a) => { const before = after?.pre?.(...a); const r = o(...a); after?.post?.(r, a, before); add(name); return r; }; };
      wrap('declareIndependence', { pre: (id) => ({ formerEarth: g.realmOf(id) === 0, loyalty: g.gov(id).loyalty, fear: g.gov(id).fear || 0, friend: g.gov(id).friend || 0, d0: dist0(id), dl: g.gov(id).lord != null ? Math.hypot(g.system(id).x - g.system(g.gov(id).lord).x, g.system(id).y - g.system(g.gov(id).lord).y) : 0 }),
        post: (r, a, pre) => { indep.push({ year: g.year, war: g.atWar(0, a[0]), ...pre }); add(pre.formerEarth ? 'indep_from_earth' : 'indep_other'); } });
      wrap('beginWar', { post: (r, [by, target]) => add(by === 0 || target === 0 ? 'war_earth' : 'war_other') });
      wrap('surrender'); wrap('endWar'); wrap('startBattle'); wrap('declareWar'); wrap('offerPeace');
      wrap('dispatch', { post: (r, [from]) => { if (r?.ok) add(from === 0 ? 'colony_ship_earth' : 'colony_ship_gov'); } });
      wrap('addColony');
      wrap('openRoute', { post: (r) => { if (r?.ok) add('route_opened'); } });
      wrap('sendGrant'); wrap('receiveAid', { post: (r, [id, v]) => add('aid_value', v) });
      wrap('obeys', { post: (r) => { if (!r.ok) add('order_refused'); } });
      wrap('buildWarship'); wrap('upgrade', { post: (r) => { if (r?.ok) add('upgrade_ok'); } });
      wrap('startWar'); wrap('enslave'); wrap('integrate'); wrap('conquer'); wrap('gift');
      wrap('sendFleet', { post: (r, a) => { if (r?.ok) add('fleet_sent'); } });
      // 政治 (不満の段階・要求・決めること・語り手・時代の課題)
      wrap('raiseDemand', { pre: (id) => ({ earth: g.gov(id).lord === 0 }), post: (r, a, pre) => add(pre.earth ? 'demand_earth' : 'demand_other') });
      wrap('grantDemand'); wrap('refuseDemand'); wrap('calmUnrest'); wrap('pirateRaid');
      wrap('unrestYearly', { pre: (id, gv) => gv.unrest?.stage || 0, post: (r, [id, gv], before) => { if (!before && gv.unrest?.stage === 1) add('unrest_start'); } });
      for (const [type, def] of Object.entries(STORY)) { const o = def.start; def.start = (gg, sys) => { add(`story_${type}`); return o(gg, sys); }; }
      wrap('sendDecision', { post: (r) => { if (r?.ok) add('decision_reply'); } });
      wrap('resolveDecision', { post: (r, [id, k, local]) => { if (local) add('decision_default'); } });
      wrap('setPolicy', { post: (r) => { if (r?.ok) add('policy_set'); } });
      wrap('command', { post: (r, [act]) => { if (r?.ok) add(`cmd_${act}`); else if (/政治力/.test(r?.reason || '')) add('cmd_no_pc'); } });
      // 年ごとの記録
      const series = [];
      const quiet = []; // 年ごとの重要な出来事の数
      let lastEv = Math.max(0, ...g.events.map((e) => e.id));
      const yearly = [];
      const sample = () => {
        const sys = g.colonizedSystems();
        const earthSys = sys.filter((x) => g.realmOf(x.id) === 0);
        const vass = Object.entries(g.govs).filter(([k, v]) => Number(k) !== 0 && v.lord !== null && v.lord !== undefined && g.isColonized(Number(k)) && g.realmOf(Number(k)) === 0).map(([, v]) => v);
        const roots = new Set(sys.map((x) => g.realmOf(x.id)));
        const pop = (ids) => ids.reduce((k, x) => k + g.coloniesIn(x.id).reduce((a, c) => a + c.pop, 0), 0);
        return { year: Math.round(g.year), systems: sys.length, earthSystems: earthSys.length, realms: roots.size, earthPop: pop(earthSys), credits: g.gov(0).credits,
          loyaltyAvg: vass.length ? vass.reduce((k, v) => k + (v.loyalty ?? 70), 0) / vass.length : null, loyaltyLow: vass.filter((v) => (v.loyalty ?? 70) < 20).length,
          fearAvg: vass.length ? vass.reduce((k, v) => k + (v.fear || 0), 0) / vass.length : null, friendAvg: vass.length ? vass.reduce((k, v) => k + (v.friend || 0), 0) / vass.length : null,
          friend50: vass.filter((v) => (v.friend || 0) >= 50).length, blockedByFriend: vass.filter((v) => (v.loyalty ?? 70) < 20 && (v.friend || 0) >= 50).length,
          wars: Object.keys(g.realmWars).length, earthWars: Object.keys(g.realmWars).filter((k) => k.split('|').map(Number).includes(0)).length,
          ships: g.realmShips(0), awe: Object.values(g.awe).reduce((k, v) => k + v, 0), maxDist: Math.max(0, ...earthSys.map((x) => dist0(x.id))),
          pc: g.pc, council: g.council, unrest: vass.filter((v) => (v.unrest?.stage || 0) >= 1).length, ultimatum: vass.filter((v) => v.unrest?.stage === 3).length,
          tasksDone: g.stats?.tasksDone || 0, score: g.score ? g.score().total : 0, policy: g.policy?.id || null };
      };
      const t0 = performance.now();
      const timing = [];
      for (let y = 1; y <= years; y++) {
        const ty = performance.now();
        for (let i = 0; i < 4; i++) g.advance(0.25);
        const newEv = g.events.filter((e) => e.id > lastEv);
        lastEv = Math.max(lastEv, ...g.events.map((e) => e.id));
        const kinds = {};
        for (const e of newEv) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
        yearly.push({ y, n: newEv.length, bad: newEv.filter((e) => !e.good).length, kinds });
        if (y % 10 === 0) { series.push(sample()); timing.push({ y, ms: performance.now() - ty, heap: performance.memory?.usedJSHeapSize || 0 }); }
      }
      const challenges = { sixty: g.realmSystems(0).length >= 60, loyal: (g.stats?.indepFromEarth || 0) === 0, unify: g.independentRealms ? g.independentRealms() === 0 : null };
      return { strategy, seed: g.galaxy.seed, counts, indep, series, yearly, timing, ms: performance.now() - t0, era: g.era, stats: g.stats, challenges };
    }, [strategy, years]);
    res.errors = errs;
    fs.writeFileSync(out, JSON.stringify(res));
    const last = res.series[res.series.length - 1];
    console.log(`${strategy} seed ${seed}: ${((Date.now() - t0) / 1000).toFixed(0)}s, year ${last.year} systems ${last.systems} earth ${last.earthSystems} realms ${last.realms} indep ${res.indep.length} errs ${errs.length}`);
    await p.close();
  }
  await b.close();
})();
