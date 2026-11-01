// 帝国の「従属国」と「経済・政策」のタブ (依頼 KE-4・KE-5。2026-11-01) と、入植のときの型の窓 (KE-5) の試験。公開用の index.html をブラウザで開いて確かめる:
//   1. 「従属国」のタブに家臣の星系が 1 行ずつ並び (忠誠度の低い順)、欄に額を入れて「決める」を押すと定期の資金援助が決まる
//   2. 「従属国」のタブに基本統治形式の選択があり、一括変更で 2 つの星系を選んで型を変えると、星系ごとに型を変える指令が出る
//   3. 「経済・政策」のタブに収支・国家方針・財政・人口・資源があり、「目標」のタブには国家方針と財政・基本統治形式がない
//   4. 候補地のタブで「入植船を送る」を押すと型の窓が開き、「基本のまま」があり、型を選んで送ると入植船がその型を持つ
//   5. 横 1280×780 と縦 854×1200 で、ページが横にはみ出さない
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: (c) => [c.shots], judge: J.byJson((j) => ['land', 'port'].every((t) => j[t]?.rows > 0 && j[t].sorted && j[t].set === 150 && j[t].base && j[t].bulk >= 1 && j[t].bulk === j[t].two && j[t].econ && j[t].goalsClean && j[t].pick && j[t].shipReg && j[t].wide && !j[t].errs.length), '従属国と経済・政策のタブの結果が違う') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const SHOTS = process.argv[2] || 'shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const out = {};
  for (const [tag, vp] of [['land', { width: 1280, height: 780 }], ['port', { width: 854, height: 1200 }]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const until = (fn, arg) => p.waitForFunction(fn, arg, { timeout: 8000 }).catch(() => {}); // 決まった時間ではなく、画面が変わるまで待つ (CI の重いときにも)
    await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('moribin-playlog-consent', 'no'); localStorage.setItem('moribin-evprefs', JSON.stringify({ popup: false })); } catch {} }); // 重大な知らせの窓は newspop で見る
    await p.goto(`file://${HTML}?seed=11&home=0`); await p.waitForFunction(() => window.__app && __app.game); await p.waitForTimeout(600);
    // 家臣を育てる: 観戦で 100 年進め (開始時の生産性は「2300 年の予測」で早く育てる)、プレイヤーに戻す
    await p.evaluate(() => { __app.speed = 0; const g = __app.game; g.productivity = PRODUCTIVITY.forecast.k; g.setSpectate(true); for (let i = 0; i < 400; i++) g.advance(0.25); g.setSpectate(false); g.pc = 100; g.cash('test', 5000, { gov: g.cap }); __app.speed = 0; });
    await p.evaluate(() => { $('endbox').hidden = true; app.setView('empire'); app.empireTab = 'vassals'; app.dirty = true; }); // 振り返りなどの窓が出ていれば閉じる
    await until(() => document.querySelectorAll('#empire table.vassals tr').length > 1);
    const r = { errs };
    const loys = await p.evaluate(() => [...document.querySelectorAll('#empire table.vassals tr')].slice(1).map((tr) => Number(tr.children[8]?.textContent.match(/\d+/)?.[0])));
    r.rows = loys.length;
    r.sorted = loys.every((v, i) => i === 0 || loys[i - 1] <= v);
    // 今も自国の星系である行で、定期の資金援助を決める
    const sys = await p.evaluate(() => [...document.querySelectorAll('#empire [data-act="grantset"][data-read]')].map((x) => Number(x.dataset.sys)).find((id) => __app.game.realmOf(id) === __app.game.cap));
    if (sys !== undefined) {
      await p.fill(`#vgrant-${sys}`, '150');
      await p.click(`#empire [data-act="grantset"][data-read="vgrant-${sys}"]`);
      await until((s) => __app.game.me.standing?.[s] !== undefined, sys);
      r.set = await p.evaluate((s) => __app.game.me.standing?.[s], sys);
    }
    r.base = await p.evaluate(() => !!document.querySelector('#empire select[data-act="regimedefault"]'));
    // 一括変更: 自国の家臣の星系を 2 つ選び、いまの型と違う型 (T08 か T13) に変える
    const two = await p.evaluate(() => { const g = __app.game; return [...document.querySelectorAll('#empire [data-act="vsel"]')].map((x) => Number(x.dataset.sys)).filter((id) => g.known(id)?.lord === g.cap && !g.isDirect(id)).slice(0, 2); });
    const to = await p.evaluate((ids) => (ids.every((id) => __app.game.knownRegime(__app.game.known(id)) !== 'T08') ? 'T08' : 'T13'), two);
    r.two = two.length; // 直属の家臣が 1 つしかない試合もある (そのときは 1 つ)
    for (const id of two) { await p.click(`#empire [data-act="vsel"][data-sys="${id}"]`); await until((id) => __app.vassalSel?.has(id) && document.querySelector(`#empire [data-act="vsel"][data-sys="${id}"]`)?.checked, id); }
    await p.selectOption('#empire select[data-act="vbulkreg"]', to); await until((v) => document.querySelector('#empire [data-act="bulkrule"]')?.dataset.value === v, to);
    await p.screenshot({ path: `${SHOTS}/vassaltab-${tag}.png` });
    await p.click('#empire [data-act="bulkrule"]'); await until((v) => __app.game.requests.some((q) => q.act === 'rule' && q.d.value === v), to);
    r.bulk = await p.evaluate(([ids, v]) => __app.game.requests.filter((q) => q.kind === 'order' && q.act === 'rule' && q.d.value === v && ids.includes(Number(q.d.sys))).length, [two, to]);
    r.wide = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const heads = async (t) => { await p.evaluate((t) => { app.empireTab = t; app.dirty = true; }, t); await until((t) => document.querySelector(`#empire [data-act="etab"][data-t="${t}"]`)?.classList.contains('on'), t); await p.waitForTimeout(200); return p.evaluate(() => [...document.querySelectorAll('#empire h3')].map((h) => h.textContent)); };
    const econ = await heads('overview');
    r.econ = ['収支', '国家方針', '財政', '人口と入植地', '資源'].every((w) => econ.some((h) => h.includes(w)));
    r.tab = await p.evaluate(() => document.querySelector('#empire [data-act="etab"][data-t="overview"]')?.textContent.trim());
    await p.screenshot({ path: `${SHOTS}/econtab-${tag}.png` });
    const goals = await heads('goals');
    r.goalsClean = !goals.some((h) => h.includes('国家方針') || h.startsWith('財政')) && goals.some((h) => h.includes('政治力')) && !(await p.evaluate(() => !!document.querySelector('#empire select[data-act="regimedefault"]')));
    // 4. 入植のときの型の窓
    await p.evaluate(() => { const g = __app.game; g.cash('test', 1e6, { gov: g.cap }); g.gov(g.cap).E = 1e40; Object.assign(g.stockOf(g.cap), { goods: 1e5, food: 1e5, water: 1e5 }); app.setView('cands'); app.dirty = true; }); // 入植船を出せるだけの資金と物資 (100 年後の首都で足りない試合もある) await until(() => document.querySelector('#empire [data-act="candsend"]:not([disabled])'));
    await p.click('#empire [data-act="candsend"]:not([disabled])'); await until(() => !$('regimebox').hidden);
    r.pick = await p.evaluate(() => !$('regimebox').hidden && !!document.querySelector('#regimebox [data-regime=""]') && document.querySelector('#regimebox').textContent.includes('基本のまま'));
    await p.click('#regimebox [data-rp="T08"]'); await until(() => document.querySelector('#regimebox [data-regime="T08"]'));
    await p.screenshot({ path: `${SHOTS}/colonypick-${tag}.png` });
    r.wide = r.wide && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.click('#regimebox [data-regime="T08"]'); await until(() => $('regimebox').hidden);
    r.shipReg = await p.evaluate(() => $('regimebox').hidden && [...(__app.game.projects || []), ...(__app.game.ships || [])].some((x) => x.regime === "T08"));
    r.wide = r.wide && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    out[tag] = r;
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
