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
          ships: g.realmShips(0), awe: Object.values(g.awe).reduce((k, v) => k + v, 0), maxDist: Math.max(0, ...earthSys.map((x) => dist0(x.id))) };
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
      return { strategy, seed: g.galaxy.seed, counts, indep, series, yearly, timing, ms: performance.now() - t0 };
    }, [strategy, years]);
    res.errors = errs;
    fs.writeFileSync(out, JSON.stringify(res));
    const last = res.series[res.series.length - 1];
    console.log(`${strategy} seed ${seed}: ${((Date.now() - t0) / 1000).toFixed(0)}s, year ${last.year} systems ${last.systems} earth ${last.earthSystems} realms ${last.realms} indep ${res.indep.length} errs ${errs.length}`);
    await p.close();
  }
  await b.close();
})();
