// 撮る台本の点検 (回 DO9・B-225・W7-Q3 = a。store/images.md の 2・3): ストアのスクリーンショットと予告編の遊びの筋 (desktop/shots/play.mjs) が、
// いまのゲームでも講和会議まで届くか、撮る場面のセーブを撮るときと同じ設定で開いたときに、画面を隠す窓が出ていないかを見る。
// 前は CI で見ていなかったので、ゲームが変わって筋が講和会議に届かなくなっても (回 SO4 の銀河 20261020・回 AI9 の銀河 7)、
// 重大な知らせの窓が撮る画面を隠していても (回 SO4)、撮り直すときまで気づかなかった。
// 1. 撮る台本の既定の銀河と観戦の年数 (desktop/shots/shoot.mjs の SEED・SPEC) で遊び、5 つの場面のセーブ (decision・reply・offer・front・conference) がそろう
// 2. それぞれのセーブを、撮るときと同じ設定 (遊び方の記録は「記録しない」・重大な知らせの窓は切る) で開き、少し待っても、2 年進めても (予告編の撮り方)、画面を覆う窓が出ていない
// 使い方: node tools/tests/shots.js   (組み立てた index.html。HTML=…・SEED=…・POPUP=1 で変えられる)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)。参考の行 (落ちても CI は止めない)
exports.ci = [{
  optional: '参考', // 表の行は「shots (参考)」 (シミュレーション版の参考の行とは別)
  judge: (o, code) => (code === 0 && /^撮る台本 合格/m.test(o) ? '' : (o.match(/^撮る台本 不合格[^\n]*/m) || ['撮る台本の点検が終わらない'])[0]),
  note: (o) => (o.match(/^撮る台本 (?:合格|不合格) \(([^)]*)\)/m) || [])[1] || '',
}];
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const SCENES = ['decision', 'reply', 'offer', 'front', 'conference'];
// 画面を覆う窓 (src/screen/page.html の position:fixed; inset:0 のもの)
const COVERS = ['endbox', 'home', 'curtain', 'netbox', 'treatybox', 'newsbox', 'regimebox', 'xportbox', 'pick'];

// 撮る台本の既定の値を、台本から読む (台本と試験で値を 2 か所に書かない)
const shoot = fs.readFileSync(path.join(ROOT, 'desktop/shots/shoot.mjs'), 'utf8');
const SEED = process.env.SEED || (shoot.match(/const SEED = arg\('seed', '([^']+)'\)/) || [])[1]; // SEED=… で変えられる (試験が壊れた筋を見つけるかを確かめるとき)
const POPUP = !!process.env.POPUP; // POPUP=1 = 重大な知らせの窓を切らずに開く (窓を見つけられるかを確かめるとき)
const SPEC = Number((shoot.match(/const SPEC = Number\(arg\('spec', '?(\d+)'?\)\)/) || [])[1] || 80);

(async () => {
  const fails = [];
  if (!SEED) fails.push('desktop/shots/shoot.mjs から既定の銀河を読めない');
  const { playInPage } = await import(pathToFileURL(path.join(ROOT, 'desktop/shots/play.mjs')).href);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const errs = [];
  // 撮るときと同じ開き方 (desktop/shots/shoot.mjs の openPage)
  const open = async () => {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((popup) => { try { localStorage.clear(); localStorage.setItem('moribin-playlog-consent', 'no'); if (!popup) localStorage.setItem('moribin-evprefs', JSON.stringify({ popup: false })); } catch { /* 使えない環境では何もしない */ } }, POPUP);
    await p.goto(`${pathToFileURL(HTML).href}?seed=${SEED}&home=0&lang=ja`);
    await p.waitForFunction(() => window.__app && __app.game);
    await p.evaluate(() => setSpeed(0));
    return p;
  };
  let r = { saves: {}, log: [] };
  if (SEED) {
    const p = await open();
    r = await p.evaluate(playInPage, { seed: SEED, spec: SPEC });
    await p.close();
    if (r.error) fails.push(`遊びの筋が止まった: ${r.error}`);
    const miss = SCENES.filter((k) => !r.saves?.[k]);
    if (miss.length) fails.push(`場面のセーブがない: ${miss.join('・')}`);
  }
  const covered = [];
  for (const k of SCENES) {
    if (!r.saves?.[k]) continue;
    const p = await open();
    const ok = await p.evaluate((t) => { const v = loadSave(parseSave(t)); setSpeed(0); __app.dirty = true; return v; }, r.saves[k]);
    if (!ok) fails.push(`場面 ${k} のセーブを読めない`);
    const look = () => p.evaluate((ids) => ids.filter((id) => { const el = document.getElementById(id); return el && !el.hidden && getComputedStyle(el).display !== 'none'; }), COVERS);
    await p.waitForTimeout(1500); // 帯の更新 (0.5 秒ごと) で出る窓も待つ
    const shown = await look();
    if (shown.length) covered.push(`${k}: ${shown.join('・')}`);
    // 予告編は時間を進めながら撮る (desktop/trailer/trailer.mjs)。2 年進めて、届いた知らせで窓が出ないかも見る (回 SO4 で、重大な知らせの窓が撮る画面を隠した)
    await p.evaluate(() => { const g = __app.game; for (let i = 0; i < 8; i++) { g.advance(0.25); railHtml(g); } __app.dirty = true; });
    await p.waitForTimeout(1500);
    const later = (await look()).filter((id) => !shown.includes(id));
    if (later.length) covered.push(`${k} の 2 年あと: ${later.join('・')}`);
    await p.close();
  }
  if (covered.length) fails.push(`画面を覆う窓が出ている (${covered.join(' / ')})`);
  await b.close();
  for (const e of errs) fails.push(`画面の誤り: ${e}`);
  const conf = (r.log || []).find((l) => /講和会議の知らせが届いた/.test(l)) || '';
  const sum = `銀河 ${SEED}・観戦 ${SPEC} 年・場面 ${SCENES.filter((k) => r.saves?.[k]).length} / ${SCENES.length}${conf ? `・${conf.split(' ')[0]} 年に講和会議の知らせ` : ''}`;
  for (const l of r.log || []) console.log(`  ${l}`);
  console.log(fails.length ? `撮る台本 不合格 (${sum})\n${fails.join('\n')}` : `撮る台本 合格 (${sum})`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log(`撮る台本 不合格 (${e.message.split('\n')[0]})`); process.exit(1); });
