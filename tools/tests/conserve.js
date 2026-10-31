// 物質とエネルギーの保存の試験 (目標 R03)。1 年ごとに、星系ごと・資源ごとに
//   (記帳した出入りの合計 − 備蓄の増加) ÷ 取扱量 (出入りの絶対値の合計)
// を計算し、絶対値の最大が 1e-9 以下なら合格。あわせて次も確かめる。
//   - 船で運ぶ途中の物: 積み出した量 − 着いた量 = 運んでいる途中の量の増加 (貨物船・入植船の食料と水・積み込みを待つ入植船)
//   - 工業の質量: 低付加価値物品と高付加価値物品の産出の質量 = 投入した金属・低付加価値物品・希少元素の質量 (燃料は燃やして出ていく。高付加価値物品は回 KE5)
//   - 出入りの種類が決まったものだけであること (域外への売却のような「どこからか湧く・どこかへ消える」ものがない)
//   - エネルギー: 政府ごとに (記帳した出入り − 蓄えの増加) ÷ 取扱量 も 1e-9 以下
// 使い方: node tools/tests/conserve.js [シード] [年数]   (NAT=1 で国家選択あり、HTML=… で版を選ぶ)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: ['5', '150'], judge: (o) => (o.trim().split('\n')[0].includes('R03 合格') && o.includes('決まっていない出入り: なし') ? '' : 'R03 不合格') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const { chromium } = require('playwright');
const [seed = '5', years = '150'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; });
  await p.goto(`file://${HTML}?seed=${seed}&home=0`);
  await p.waitForFunction(() => window.__app && __app.game);
  const r = await p.evaluate(([Y, NAT]) => {
    __app.speed = 0;
    const g = __app.game;
    if (NAT) { g.foundNations(6, 'normal'); g.setPlayerNation(g.nations[0].cap); }
    g.setSpectate(true);
    const IN = new Set(['extract', 'make', 'arrive', 'release']), OUT = new Set(['consume', 'use', 'burn', 'build', 'ship', 'supply', 'waste', 'pirate', 'store']); // store・release = 政府の倉との出し入れ (回 KE12。倉の釣り合いは tools/tests/granary.js)
    const stocks = () => JSON.parse(JSON.stringify(g.stock));
    const transit = () => {
      const t = {}; const add = (r, v) => { t[r] = (t[r] || 0) + v; };
      for (const c of g.cargo) for (const [r, v] of Object.entries(c.load)) add(r, v);
      for (const s of g.ships) for (const [r, v] of Object.entries(s.supplies || {})) add(r, v);
      for (const j of g.projects) if (j.type === 'ship') for (const [r, v] of Object.entries(j.supplies || {})) add(r, v);
      return t;
    };
    const energies = () => Object.fromEntries(Object.entries(g.govs).map(([k, v]) => [k, v.E || 0]));
    let worst = 0, worstAt = null, worstE = 0, worstT = 0, worstInd = 0, kindsBad = new Set(), years = 0, through = 0;
    const totals = {};
    for (let y = 0; y < Y; y++) {
      const s0 = stocks(), t0 = transit(), e0 = energies();
      MASS_AUDIT = { flows: {}, energy: {} };
      for (let i = 0; i < 4; i++) g.advance(0.25);
      const s1 = stocks(), t1 = transit(), e1 = energies();
      const F = MASS_AUDIT.flows;
      const shipOut = {}, arriveIn = {};
      let make = 0, use = 0;
      for (const sys of new Set([...Object.keys(s0), ...Object.keys(s1), ...Object.keys(F)])) {
        for (const res of RES) {
          const fl = F[sys]?.[res] || {};
          let sum = 0, abs = 0;
          for (const [k, v] of Object.entries(fl)) {
            sum += v; abs += Math.abs(v);
            if (!(v >= 0 ? IN.has(k) : OUT.has(k)) && Math.abs(v) > 1e-12) kindsBad.add(`${k}:${v > 0 ? '+' : '−'}`);
            totals[k] = (totals[k] || 0) + Math.abs(v) * RES_KG[res];
          }
          shipOut[res] = (shipOut[res] || 0) - (fl.ship || 0); arriveIn[res] = (arriveIn[res] || 0) + (fl.arrive || 0);
          if (res === 'goods' || res === 'hitech') make += (fl.make || 0) * RES_KG[res];
          if (res === 'metal' || res === 'goods' || res === 'rare') use -= (fl.use || 0) * RES_KG[res];
          const d = (s1[sys]?.[res] || 0) - (s0[sys]?.[res] || 0);
          const q = abs ? Math.abs(sum - d) / abs : Math.abs(d);
          through += abs;
          if (q > worst) { worst = q; worstAt = `${g.year.toFixed(0)} 星系 ${sys} ${res}`; }
        }
      }
      for (const res of RES) {
        const moved = (shipOut[res] || 0) + (arriveIn[res] || 0);
        const d = (t1[res] || 0) - (t0[res] || 0);
        if (moved || d) worstT = Math.max(worstT, Math.abs((shipOut[res] || 0) - (arriveIn[res] || 0) - d) / Math.max(moved, 1e-12));
      }
      if (make || use) worstInd = Math.max(worstInd, Math.abs(make - use) / Math.max(make, use));
      for (const id of new Set([...Object.keys(e0), ...Object.keys(e1)])) {
        const fl = MASS_AUDIT.energy[id] || {};
        const sum = Object.values(fl).reduce((a, v) => a + v, 0), abs = Object.values(fl).reduce((a, v) => a + Math.abs(v), 0);
        const d = (e1[id] || 0) - (e0[id] || 0);
        worstE = Math.max(worstE, abs ? Math.abs(sum - d) / abs : (d ? Infinity : 0));
      }
      years++;
    }
    MASS_AUDIT = null;
    return { worst, worstAt, worstE, worstT, worstInd, kindsBad: [...kindsBad], years, totals, colonies: g.colonies.length };
  }, [Number(years), !!process.env.NAT]);
  const e = (v) => Number(v).toExponential(2);
  const ok = r.worst <= 1e-9 && r.worstE <= 1e-9 && r.worstT <= 1e-9 && r.worstInd <= 1e-9 && !r.kindsBad.length;
  console.log(`${r.years} 年・入植地 ${r.colonies} ・ R03 ${ok ? '合格' : '不合格'}`);
  console.log(`  備蓄の収支の誤差 ÷ 取扱量の最大 ${e(r.worst)} (${r.worstAt})`);
  console.log(`  運ぶ途中の物の誤差 ${e(r.worstT)} ・ 工業の質量の誤差 ${e(r.worstInd)} ・ エネルギーの誤差 ${e(r.worstE)}`);
  console.log(`  決まっていない出入り: ${r.kindsBad.length ? r.kindsBad.join(', ') : 'なし'}`);
  console.log('  出入りの種類ごとの質量 [kg]:', Object.entries(r.totals).map(([k, v]) => `${k} ${e(v)}`).join(' / '), errs.slice(0, 3));
  await b.close();
})();
