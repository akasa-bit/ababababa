// 統治体制の試験: 指令で変える・朝貢・指令の拒否・自治領・強制労働の後遺症・自治を狭めたときの忠誠度・新しい入植地の既定・保存と読み込み・画面
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`; // 試す版 (HTML=$PWD/simulation.html でシミュレーション版)
require('fs').mkdirSync('shots', { recursive: true }); // 画面の写しは、いまのフォルダの shots/ に書く
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const out = {};
  for (const [tag, vp] of [['land', { width: 1280, height: 780 }], ['port', { width: 854, height: 1200 }]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(`file://${HTML}?seed=11&home=0`); await p.waitForFunction(() => window.__app && __app.game);
    const r = await p.evaluate(() => {
      const g = __app.game; __app.speed = 0;
      g.setSpectate(true); for (let i = 0; i < 280; i++) g.advance(0.25); g.setSpectate(false);
      const res = {};
      // 直属の家臣を 3 つ選ぶ
      const vs = Object.keys(g.govs).map(Number).filter((id) => g.govs[id].lord === 0 && g.known(id)?.lord === 0 && g.isColonized(id) && g.realmOf(id) === 0 && !g.govs[id].autonomy && !g.govs[id].direct) // 地球に届いている記録でも直属の家臣のもの (指令はその記録で判断する).sort((a, c) => g.sysDist(0, a) - g.sysDist(0, c));
      res.vassals = vs.length;
      const [a, c, e] = vs;
      // 試すのは統治体制の仕組みなので、待つあいだに不満から自治を求めて指令を受けなくならないよう、3 つを落ち着かせておく
      for (const x of [a, c, e]) { delete g.govs[x].unrest; g.govs[x].loyalty = 90; g.decisions = g.decisions.filter((q) => q.sys !== x); }
      g.pc = 100;
      res.cmd = [issue('rule', { sys: a, value: 'federal' }).ok, issue('rule', { sys: c, value: 'dominion' }).ok, issue('rule', { sys: e, value: 'encomienda' }).ok, issue('rule', { sys: a, value: 'nonsense' }).ok];
      const far = Math.max(...[a, c, e].map((x) => g.lightDelay(x)));
      for (let i = 0; i < Math.ceil(far * 4) + 4; i++) g.advance(0.25);
      res.regimes = [a, c, e].map((x) => g.regimeOf(g.govs[x]));
      // 自治領は指令を受けない (統治体制の変更は受ける)
      g.pc = 100;
      res.mandate = issue('mandate', { sys: c, value: 'develop' }).ok;
      for (let i = 0; i < Math.ceil(g.lightDelay(c) * 4) + 4; i++) g.advance(0.25);
      res.dominionLog = g.log.filter((m) => /自治領なので指令を受けない/.test(m.text || m.t || '')).length > 0 || JSON.stringify(g.log.slice(-40)).includes('自治領なので');
      res.mandateNow = g.govs[c].mandate || 'balanced';
      // 強制労働の後遺症: 20 年で 0.4 前後
      for (let i = 0; i < 80; i++) g.advance(0.25);
      res.scar = +(g.govs[e].scar || 0).toFixed(2);
      // 自治領 → 直接統治は忠誠度 −32
      const L0 = g.govs[c].loyalty;
      const r1 = g.setRule(c, 'direct');
      res.revoke = [r1.ok, Math.round(L0 - g.govs[c].loyalty)];
      // 強制労働をやめる → 後遺症は残り、ゆっくり消える
      g.setRegime(e, 'indirect');
      const s0 = g.govs[e].scar; for (let i = 0; i < 40; i++) g.advance(0.25);
      res.scarAfter = [+s0.toFixed(3), +(g.govs[e].scar || 0).toFixed(3)];
      // 新しい入植地の既定
      res.setDefault = [issue('set', { key: 'regime', value: 'feudal' }).ok, issue('set', { key: 'regime', value: 'direct' }).ok, g.regime];
      const before = new Set(Object.keys(g.govs));
      g.setSpectate(true); for (let i = 0; i < 200; i++) g.advance(0.25); g.setSpectate(false);
      const fresh = Object.keys(g.govs).filter((k) => !before.has(k) && g.realmOf(Number(k)) === 0 && g.govs[k].lord !== null);
      res.freshFeudal = [fresh.length, fresh.filter((k) => g.regimeOf(g.govs[k]) === 'feudal').length];
      // 離反の起きやすさは 0 より大きく、体制で並ぶ
      const t = (r) => hazardOf(g.knownSecessionTerms(a, r) || [{ f: 0 }]);
      res.hz = ['direct', 'indirect', 'feudal', 'federal', 'dominion', 'encomienda'].map((r) => +t(r).toFixed(4));
      // 保存 → 読み込み
      const s1 = JSON.stringify((() => { const x = buildSave(g); delete x.savedAt; return x; })());
      loadSave(JSON.parse(s1));
      const s2 = JSON.stringify((() => { const x = buildSave(__app.game); delete x.savedAt; return x; })());
      res.saveLoad = s1 === s2;
      __app.openSystem ? null : null;
      __app.selectSystem(a); __app.setView('galaxy'); __app.empireTab = 'gov'; __app.dirty = true;
      window.__sel = a;
      return res;
    });
    await p.waitForTimeout(800);
    // 統治の欄までスクロールして撮る
    await p.evaluate(() => { const el = [...document.querySelectorAll('h3')].find((h) => h.textContent === '統治'); el?.scrollIntoView(); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${process.argv[2]}/regime-${tag}.png` });
    await p.evaluate(() => { const el = [...document.querySelectorAll('h3')].find((h) => h.textContent === '離反の起きやすさ'); el?.scrollIntoView(); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${process.argv[2]}/hazard-${tag}.png` });
    const wide = await p.evaluate(() => [...document.querySelectorAll('table.regimes')].map((t) => [t.scrollWidth, t.parentElement.clientWidth]));
    out[tag] = { ...r, wide, errs: errs.slice(0, 3) };
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
