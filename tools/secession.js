// 離反の自動対戦: 国家選択のある試合 (N か国) を、プレイヤーの国も AI に任せて Y 年進め、
// 主従の結びつき (家臣の星系 → 主人) ごとに、始まった年・統治体制・首都との距離・不満が始まった回数・終わった年と終わり方を記録する。
// 生存時間の分析 (Kaplan–Meier・Cox モデル) で、歴史の実データ (目標 R08・R09) と形を比べるための材料。ゲームの結果は変えない
// 使い方: node secession.js <html の絶対パス> <outdir> <年数> <シード(カンマ区切り)> [国の数] [版ごとの値を差し替える JSON (例: '{"hazardBase":0.1}')]
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [html, outdir, yearsS, seedsS, nS = '6', setS = '{}'] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  for (const seed of seedsS.split(',')) {
    const out = `${outdir}/${seed}.json`;
    if (fs.existsSync(out)) continue;
    const p = await b.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; });
    await p.goto(`file://${html}?seed=${seed}&home=0`);
    await p.waitForFunction(() => window.__app && __app.game);
    const t0 = Date.now();
    const res = await p.evaluate(([seed, years, n, set]) => {
      if (typeof ED !== 'undefined') Object.assign(ED, set); // 較正のために版ごとの値を差し替える
      newGame(String(seed));
      const g = __app.game; __app.speed = 0;
      if (n > 1) { g.foundNations(n); g.setPlayerNation(g.nations[1].cap); }
      g.setSpectate(true);
      const regime = (gv) => (typeof g.regimeOf === 'function' ? g.regimeOf(gv) : gv.direct ? 'direct' : 'indirect');
      const ties = new Map(); // 家臣の星系 → いまの結びつきの記録
      const done = [];
      const close = (id, how) => { const t = ties.get(id); if (!t) return; ties.delete(id); done.push({ ...t, end: g.year, dur: g.year - t.start, how }); };
      const orig = g.declareIndependence.bind(g);
      // 独立のときは、戦争になったか (人間の国からだけ判定) と、型の戦争の確率も残す (従属国の型の目標 R32)
      g.declareIndependence = function (id) { const t = ties.get(id); const r = orig(id); const li = g.lastIndependence; if (t && li?.id === id) { t.war = !!li.war; t.warP = li.p; } close(id, 'independence'); return r; };
      // 法と実態の差 (従属国の型の目標 R31。束がない前の版では null)
      const gapOf = (gv) => (typeof g.bundleOf === 'function' && typeof bundleGap === 'function' ? (() => { const b = g.bundleOf(gv); return bundleGap(b.law, b.fact); })() : null);
      const scan = () => {
        for (const [k, gv] of Object.entries(g.govs)) {
          const id = Number(k);
          const lord = gv.lord;
          const t = ties.get(id);
          if (lord === null || lord === undefined || !g.isColonized(id)) { if (t) close(id, g.isColonized(id) ? 'other' : 'abandoned'); continue; }
          const root = g.realmOf(id);
          if (t && (t.lord !== lord || t.root !== root)) close(id, 'transfer');
          if (!ties.has(id)) ties.set(id, { id, lord, root, start: g.year, regime: regime(gv), regime0: regime(gv), gap0: gapOf(gv), gapSum: 0, gapN: 0, dCap: g.sysDist(id, root), dLord: g.sysDist(id, lord), onsets: 0, human: g.isHuman(root) });
          const r = ties.get(id);
          const st = gv.unrest?.stage || 0;
          if (st >= 1 && !r.inUnrest) r.onsets++;
          r.inUnrest = st >= 1;
          r.regime = regime(gv);
          r.loyalty = Math.round(gv.loyalty ?? 70);
          const gp = gapOf(gv);
          if (gp !== null) { r.gapSum += gp; r.gapN++; }
        }
      };
      for (let y = 0; y < years; y++) { g.advance(1); scan(); }
      for (const id of [...ties.keys()]) close(id, 'censored');
      return { seed, years, nations: n, edition: typeof EDITION === 'undefined' ? null : EDITION, set, ties: done.map(({ inUnrest, gapSum, gapN, ...x }) => ({ ...x, gap: gapN ? +(gapSum / gapN).toFixed(3) : null })) };
    }, [seed, Number(yearsS), Number(nS), JSON.parse(setS)]);
    res.errs = errs.slice(0, 5); res.secs = Math.round((Date.now() - t0) / 1000);
    fs.writeFileSync(out, JSON.stringify(res));
    console.log(`${seed}: 結びつき ${res.ties.length}・独立 ${res.ties.filter((t) => t.how === 'independence').length}・${res.secs} 秒${errs.length ? `・誤り ${errs[0]}` : ''}`);
    await p.close();
  }
  await b.close();
})();
