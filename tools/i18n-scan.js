// 英語の画面に残った日本語を探す道具 (回 T1・docs/i18n.md)。公開用の index.html を ?lang=en で開き、ホームの各ページ・国家選択・
// 地図とタブ・帝国の欄・出来事・いくつかの星系の欄を順に開いて、画面の文字 (文字の部品と title などの属性) と地図に描いた文字 (canvas の fillText) のうち、
// 日本語を含むものを数える。訳の抜け・TR で包んでいない所・状態の文を TX で訳していない所を見つけるためのもの。
// 使い方: node tools/i18n-scan.js [年数] [--json]   (年数 = 観戦で進めてから見る年。既定 150)
//   出力: 残った文と、出た画面と回数 (多い順)。最後の行「英語の画面に残った日本語: n 種類」
const ROOT = require('path').resolve(__dirname, '..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const { chromium } = require('playwright');
const years = Number(process.argv.find((a) => /^\d+$/.test(a)) || 150);

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 780 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    try { localStorage.clear(); } catch {}
    window.__jpDrawn = new Map();
    const JP = /[぀-ヿ㐀-鿿]/;
    const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { if (JP.test(String(t))) window.__jpDrawn.set(String(t), (window.__jpDrawn.get(String(t)) || 0) + 1); return f.call(this, t, ...a); };
  });
  await p.goto(`file://${HTML}?lang=en&seed=3`);
  await p.waitForFunction(() => window.__app && __app.game);
  await p.waitForTimeout(500);
  const found = new Map(); // 文 → { where: Set, n }
  const grab = async (where) => {
    await p.waitForTimeout(250);
    const got = await p.evaluate(() => {
      const JP = /[぀-ヿ㐀-鿿]/, out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!JP.test(n.data) || ['SCRIPT', 'STYLE'].includes(n.parentNode.nodeName)) continue;
        const el = n.parentElement;
        if (el && el.closest('[hidden]') && !el.closest('details')) continue;
        if (el && el.closest('[translate=no]')) continue; // 言語の名前 (日本語・English) は訳さない // 隠れている部品は数えない (開ける説明は数える)
        out.push(n.data.trim());
      }
      for (const el of document.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) for (const a of ['title', 'placeholder', 'aria-label', 'alt']) { const v = el.getAttribute(a); if (v && JP.test(v)) out.push(`@${a}: ${v}`); }
      for (const [t] of window.__jpDrawn) out.push(`canvas: ${t}`);
      window.__jpDrawn.clear();
      return out;
    });
    for (const t of got) { const e = found.get(t) || { where: new Set(), n: 0 }; e.where.add(where); e.n++; found.set(t, e); }
  };
  const click = async (sel) => { const el = await p.$(sel); if (el) { await el.click().catch(() => {}); await p.waitForTimeout(200); } };

  // ホームの各ページ
  await p.evaluate(() => { if ($('home').hidden) openHome(); });
  await grab('home');
  for (const t of ['single', 'load', 'multi', 'nations', 'credits', 'account']) { await p.evaluate((t) => { app.homeTab = t; renderHome(); }, t); await grab(`home:${t}`); }
  // 国家選択 (6 か国)
  await p.evaluate(() => { app.homeTab = 'single'; app.homeNat = 6; renderHome(); });
  await click('[data-home="new"]');
  await grab('pick');
  await click('#pick [data-pick="go"], #pick button.big');
  await p.evaluate(() => { if (!$('pick').hidden) { try { closePick?.(); } catch {} } if (!$('home').hidden) closeHome(); });
  // 試合を進める (観戦で)
  await p.evaluate((y) => { const g = __app.game; if (!g.nations) { g.foundNations(6); g.setPlayerNation(g.nations[1].cap); } __app.speed = 0; g.setSpectate(true); for (let i = 0; i < y * 4; i++) g.advance(0.25); g.setSpectate(false); __app.dirty = true; }, years);
  await grab('map');
  for (const v of ['galaxy', 'system', 'events', 'cands']) { await click(`#tab-${v}`); await grab(`tab:${v}`); }
  await click('#tab-empire');
  for (const t of ['overview', 'goals', 'routes', 'migration', 'military', 'politics']) { await click(`[data-act="etab"][data-t="${t}"]`); await grab(`empire:${t}`); await p.evaluate(() => document.querySelectorAll('#empire details').forEach((d) => { d.open = true; })); await grab(`empire:${t}`); }
  await click('#tab-galaxy');
  // 星系の欄: 首都・家臣・よその国・入植していない星系
  const picks = await p.evaluate(() => {
    const g = __app.game, mine = g.colonies.filter((c) => g.realmOf(c.sys) === g.cap).map((c) => c.sys), other = g.colonies.filter((c) => g.realmOf(c.sys) !== g.cap).map((c) => c.sys);
    const empty = g.galaxy.systems.map((s) => s.id).filter((id) => !g.colonies.some((c) => c.sys === id));
    return [...new Set([g.cap, ...mine.slice(1, 4), ...other.slice(0, 4), ...empty.slice(0, 2)])];
  });
  for (const s of picks) {
    await p.evaluate((s) => { app.sel = { sys: s, body: null }; document.body.classList.remove('nosel'); __app.dirty = true; if (typeof renderPanel === 'function') renderPanel(); }, s);
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelectorAll('aside details').forEach((d) => { d.open = true; }));
    await grab(`system:${s}`);
  }
  await click('#menubtn'); await grab('menu');
  await click('#legend summary'); await grab('legend');

  const rows = [...found].sort((a, b) => b[1].n - a[1].n);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows.map(([t, e]) => ({ t, n: e.n, where: [...e.where] })), null, 1));
  else for (const [t, e] of rows) console.log(`${String(e.n).padStart(4)}  ${t.replace(/\s+/g, ' ').slice(0, 160)}   [${[...e.where].slice(0, 3).join(' ')}]`);
  console.log(`英語の画面に残った日本語: ${rows.length} 種類`, errs.length ? `ページの誤り: ${errs.slice(0, 3).join(' / ')}` : '');
  await b.close();
})();
