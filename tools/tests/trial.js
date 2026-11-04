// 体験版 (回 SO4・B-082。src/outward/trial.js・docs/trial.md) の試験。体験版をその場で組み立て (tools/build.mjs --trial-to)、ブラウザで開く
// 1. 体験版: 題と札が「体験版」・ホームにマルチプレイと友達と遊ぶの頁がない・終わりの年は 100 年 (2400 年) だけ
// 2. 2400 年まで進めると、時代の答え合わせ (ボタンは「結果へ」) → 終わりの画面 (続けて遊ぶボタンがなく、答え合わせ・セーブの書き出し・製品版への案内)
// 3. 終わったあと、速さを上げても進まない。終わりの年の違うセーブ (製品版のもの) は読まない。書き出したセーブは終わりの年が 2400 年
// 4. ゲーム版 (index.html) の 100 年の試合も、答え合わせのあとに終わりの画面が出て (前は同じ時に開いて答え合わせが消えていた)、続けて遊べる
// 使い方: node tools/tests/trial.js   (ゲーム版は組み立てた index.html。HTML=… で変えられる)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
exports.ci = [{ judge: (o, code) => (code === 0 && /^体験版 合格/m.test(o) ? '' : '体験版が違う') }]; // 画面の誤りは試験の中で数えて不合格にする
if (require.main !== module) return;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const TRIAL = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nlu-trial-')), 'demo.html');
execFileSync('node', [path.join(ROOT, 'tools/build.mjs'), '--trial-to', TRIAL], { stdio: 'pipe' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

// 1 試合を始めて、最初の時代の終わりまで進める (時代の印を数えはじめてから)。答え合わせと終わりの画面の様子を返す
async function playEra(p) {
  await p.evaluate(() => { app.homeTab = 'single'; app.homeSeed = '3'; renderHome(); });
  await p.click('[data-home="new"]');
  await p.waitForTimeout(800);
  await p.evaluate(() => [...document.querySelectorAll('#endbox button')].find((x) => /記録しない|Don't record/.test(x.textContent))?.click()); // 遊び方の記録の同意
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const g = __app.game; setSpeed(0);
    for (let i = 0; i < 8; i++) g.advance(0.25);
    railHtml(g); // 時代の印を数えはじめる (画面の 0.5 秒ごとの更新と同じ)
    for (let i = 0; i < 400 && !g.ended; i++) g.advance(0.25);
    return { endYear: g.endYear, ended: g.ended, year: g.year };
  });
  await p.waitForTimeout(2500);
  r.review = await p.evaluate(() => ({ shown: !$('endbox').hidden && !!document.querySelector('#endbox .review'), btn: $('rvgo')?.textContent }));
  if (r.review.shown) await p.click('#rvgo');
  await p.waitForTimeout(800);
  r.end = await p.evaluate(() => ({ shown: !$('endbox').hidden, h2: document.querySelector('#endbox h2')?.textContent || '', endgo: !!$('endgo'), ids: [...document.querySelectorAll('#endbox .btns button')].map((x) => x.id) }));
  return r;
}

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const errs = [];
  // 1〜3. 体験版
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 780 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(`file://${TRIAL}?lang=ja`);
    await p.waitForFunction(() => window.__app && __app.game);
    const m = await p.evaluate(() => ({ title: document.title, brand: $('brand').textContent, items: [...document.querySelectorAll('#home .items button')].map((x) => x.dataset.t).filter(Boolean), trial: TRIAL, store: STORE }));
    check(m.trial === true && /体験版/.test(m.title) && /体験版/.test(m.brand) && m.store === 'nlu-trial', `体験版の題・札・保存の名前が違う (${JSON.stringify(m)})`);
    check(!m.items.includes('multi') && !m.items.includes('friends') && m.items.includes('single'), `体験版のホームにマルチプレイか友達と遊ぶが出る (${m.items})`);
    await p.evaluate(() => { app.homeTab = 'single'; renderHome(); });
    const ends = await p.evaluate(() => [...document.querySelectorAll('#home-end option')].map((o) => o.value));
    check(ends.join() === '100', `体験版の終わりの年が 100 年だけでない (${ends})`);
    const r = await playEra(p);
    check(r.endYear === 2400 && r.ended && Math.abs(r.year - 2400) < 0.5, `体験版が 2400 年で終わらない (${JSON.stringify(r)})`);
    check(r.review.shown && r.review.btn === '結果へ', `体験版の終わりに答え合わせが出ないか、ボタンが「結果へ」でない (${JSON.stringify(r.review)})`);
    check(r.end.shown && /2400年/.test(r.end.h2) && !r.end.endgo && r.end.ids.includes('trialreview') && r.end.ids.includes('trialexport'), `体験版の終わりの画面が違う (${JSON.stringify(r.end)})`);
    const after = await p.evaluate(async () => {
      $('endbox').hidden = true;
      const y0 = __app.game.year;
      setSpeed(4);
      await new Promise((res) => setTimeout(res, 1200));
      const d = JSON.parse(JSON.stringify(buildSave(__app.game)));
      const full = { ...d, endYear: 2800, year: 2350 };
      return { speed: app.speed, moved: __app.game.year - y0, endAgain: !$('endbox').hidden, saveEnd: d.endYear, loadFull: loadSave(full), note: app.homeNote, loadOwn: loadSave(d) };
    });
    check(after.speed === 0 && after.moved < 1e-6 && after.endAgain, `体験版が終わりの年から先へ進む (${JSON.stringify(after)})`);
    check(after.saveEnd === 2400 && after.loadFull === false && /体験版/.test(after.note || '') && after.loadOwn === true, `体験版のセーブの読み書きが違う (${JSON.stringify(after)})`);
    // 英語の画面
    await p.goto(`file://${TRIAL}?lang=en`);
    await p.waitForFunction(() => window.__app && __app.game);
    const en = await p.evaluate(() => document.title);
    check(/Demo/.test(en), `英語の題に Demo がない (${en})`);
    await p.close();
  }
  // 4. ゲーム版の 100 年の試合
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 780 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(`file://${HTML}?lang=ja`);
    await p.waitForFunction(() => window.__app && __app.game);
    const m = await p.evaluate(() => ({ trial: TRIAL, items: [...document.querySelectorAll('#home .items button')].map((x) => x.dataset.t).filter(Boolean) }));
    check(m.trial === false && m.items.includes('multi'), `ゲーム版が体験版になっている (${JSON.stringify(m)})`);
    await p.evaluate(() => { app.homeEnd = 100; });
    const r = await playEra(p);
    check(r.ended && r.review.shown && r.review.btn === '結果へ' && r.end.shown && r.end.endgo, `ゲーム版の 100 年の試合で、答え合わせのあとに終わりの画面が出ない (${JSON.stringify(r)})`);
    const go = await p.evaluate(async () => { $('endgo').click(); setSpeed(4); const y0 = __app.game.year; await new Promise((res) => setTimeout(res, 1200)); return __app.game.year - y0; });
    check(go > 0, 'ゲーム版の試合が、終わりの年のあとに続けて遊べない');
    await p.close();
  }
  await b.close();
  for (const e of errs) console.log(`画面の誤り: ${e}`);
  if (errs.length) fails.push(`画面の誤り ${errs.length}`);
  console.log(fails.length ? `体験版 不合格\n${fails.join('\n')}` : '体験版 合格 (体験版: 2400 年で答え合わせ → 終わりの画面・先へ進めない・製品版のセーブは読まない。ゲーム版の 100 年の試合も答え合わせのあとに終わりの画面)');
  process.exit(fails.length ? 1 : 0);
})();
