// 戦争の自動対戦: 国家選択のある試合 (N か国) を、プレイヤーの国も AI に任せて Y 年進め、戦争の始まり・終わり方・長さ・戦果と、
// プレイヤーの国の講和の方針ごとの結果を記録する。参照データ (Correlates of War・UCDP) と形を比べるための材料
// 使い方: node wars.js <html> <outdir> <years> <seeds(カンマ区切り)> <方針(カンマ区切り)> [国の数]
// 方針: normal (観戦の AI のまま) / hawk (戦争疲弊 90 まで講和しない・戦勝点 30 未満の申し入れは断る) / dove (戦争疲弊 30 で講和を求め、申し入れにはすぐ応じる)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [html, outdir, yearsS, seedsS, polS, nS = '6'] = process.argv.slice(2);
  const years = Number(yearsS);
  fs.mkdirSync(outdir, { recursive: true });
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const policy of polS.split(',')) for (const seed of seedsS.split(',')) {
    const out = `${outdir}/${policy}-${seed}.json`;
    if (fs.existsSync(out)) continue;
    const p = await b.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; });
    await p.goto(`file://${html}?seed=${seed}&home=0`);
    await p.waitForFunction(() => window.__app && __app.game);
    const t0 = Date.now();
    const res = await p.evaluate(([seed, policy, years, n]) => {
      newGame(String(seed));
      const g = __app.game; __app.speed = 0;
      g.foundNations(n);
      const me = g.nations[1].cap; // プレイヤーの国 (くじで決まった最初の異星の国)
      g.setPlayerNation(me);
      g.setSpectate(true);
      // --- 戦争の記録 (ゲームの関数を包んで数える。ゲームの結果は変えない) ---
      const wars = new Map(); // key → 記録
      const done = [];
      const P = Game.prototype;
      const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = function (...a) { return fn(orig, ...a); }; };
      wrap('beginWar', (orig, by, target, from) => { const r = orig(by, target, from); const key = g.warKey(by, target); wars.set(key, { key, start: g.year, by, target, nat: !!(g.nationOf(by) && g.nationOf(target)) }); return r; });
      const finish = (key, how, extra = {}) => {
        const w = wars.get(key);
        if (!w) return;
        wars.delete(key);
        const st = g.warStats[key] || { k: {}, t: {} };
        const [a, c] = key.split('|').map(Number);
        done.push({ ...w, end: g.year, dur: g.year - w.start, how, ws: g.warScore(w.by, w.by === a ? c : a), kills: (st.k[a] || 0) + (st.k[c] || 0), takes: (st.t[a] || 0) + (st.t[c] || 0),
          exA: Math.round(g.exhaustion[a] || 0), exB: Math.round(g.exhaustion[c] || 0), me: a === me || c === me, ...extra });
      };
      let mode = null; // いま終わらせている戦争の終わり方
      wrap('makePeace', (orig, a, c, from) => { mode = Math.abs(g.warScore(a, c)) < 5 ? 'white' : 'treaty'; const r = orig(a, c, from); mode = null; return r; });
      wrap('startConference', (orig, loser, winners, from) => { const m = mode || (winners.length && winners[0].pts >= 100 ? 'capitulation' : 'treaty'); for (const w of winners) finish(g.warKey(w.realm, loser), m, { pts: w.pts }); return orig(loser, winners, from); });
      wrap('endWar', (orig, a, c, from) => { if (wars.has(g.warKey(a, c))) finish(g.warKey(a, c), mode || 'white'); return orig(a, c, from); });
      wrap('cleanWars', (orig) => { const before = new Set(Object.keys(g.realmWars)); const r = orig(); for (const k of before) if (g.realmWars[k] === undefined && wars.has(k)) finish(k, 'conquest'); return r; });
      wrap('surrender', (orig, root, winner) => { if (wars.has(g.warKey(root, winner))) finish(g.warKey(root, winner), 'capitulation'); return orig(root, winner); });
      // --- プレイヤーの国の講和の方針 ---
      // 攻め方は観戦の AI のまま。講和の判断 (申し入れに応じるか・自分から求めるか) だけを方針で差し替える
      if (policy !== 'normal') {
        const [sue, acceptWs] = policy === 'hawk' ? [90, 30] : [30, -100];
        const attack = P.earthWarYearly;
        g.earthWarYearly = function () {
          const ex = this.exhaustion[this.cap] || 0;
          for (const o of this.peaceOffers.filter((x) => x.to === this.cap)) if (this.warScore(this.cap, o.from) >= acceptWs || ex >= sue) this.acceptPeace(o);
          for (const c of [...this.conferences]) { const bd = c.bids.find((x) => x.realm === this.cap && !x.picks); if (bd) this.submitTreaty({ id: c.id, picks: this.aiTreatyPicks(c, bd) }); }
          for (const e of this.enemiesOf(this.cap)) if (ex >= sue && !this.requests.some((q) => q.kind === 'order' && q.act === 'peace' && Number(q.d.sys) === e)) this.command('peace', { sys: e });
          // 元の AI が講和を判断しないように、申し入れを隠し、戦争疲弊を 0 に見せて攻め方だけ使う
          const hidden = this.peaceOffers.filter((o) => o.to === this.cap);
          this.peaceOffers = this.peaceOffers.filter((o) => o.to !== this.cap);
          this.exhaustion[this.cap] = 0;
          attack.call(this);
          this.peaceOffers.push(...hidden.filter((o) => this.realmWars[o.key] !== undefined));
          if (ex) this.exhaustion[this.cap] = ex; else delete this.exhaustion[this.cap];
        };
      }
      // --- 進める ---
      const atWar = {}; // 国 → 戦っていた年数
      const series = [];
      for (let y = 0; y < years; y++) {
        for (let i = 0; i < 4; i++) g.advance(0.25);
        for (const nn of g.nations) if (g.isColonized(nn.cap) && g.realmOf(nn.cap) === nn.cap) { atWar[nn.cap] ??= { war: 0, alive: 0 }; atWar[nn.cap].alive++; if (g.enemiesOf(nn.cap).length) atWar[nn.cap].war++; }
        if (y % 25 === 24) {
          const meRealm = g.isColonized(me) && g.realmOf(me) === me;
          series.push({ year: Math.round(g.year), me: meRealm ? { sys: g.realmSystems(me).length, pop: Math.round(g.colonies.filter((c) => g.realmOf(c.sys) === me).reduce((k, c) => k + c.pop, 0)), credits: Math.round(g.gov(me).credits), ex: Math.round(g.exhaustion[me] || 0) } : null,
            nations: g.nations.filter((nn) => g.isColonized(nn.cap) && g.realmOf(nn.cap) === nn.cap).length, wars: Object.keys(g.realmWars).length });
        }
      }
      for (const k of [...wars.keys()]) finish(k, 'ongoing');
      return { seed, policy, years, n, done, atWar: Object.values(atWar), series };
    }, [seed, policy, years, Number(nS)]);
    res.secs = (Date.now() - t0) / 1000;
    res.errs = errs.slice(0, 5);
    fs.writeFileSync(out, JSON.stringify(res));
    console.log(policy, seed, `${res.done.length} wars`, `${res.secs.toFixed(1)}s`, errs.length ? errs[0] : '');
    await p.close();
  }
  await b.close();
})();
