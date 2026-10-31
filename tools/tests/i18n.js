// 翻訳の試験 (回 T1・B-073。docs/i18n.md):
// 1. 翻訳の表 (src/outward/lang-en.js) が、コードの中の日本語の文とそろっていて、すべて訳してあり、{0} と HTML の札が鍵と同じ (node tools/i18n.js と同じ確かめ)
// 2. 試合の状態は言語によらない: 同じシード・同じ手順なら、日本語と英語で状態の要約 (hash) が 1 字も違わない (記録・出来事・名前は日本語のまま入る)。
//    画面なしの版の観戦の筋 (時代の課題が変わる 2400 年をまたぐ) と、ブラウザで画面を押して始めた試合 (ホーム → 国家選択 → はじめる → 観戦で進める) の 2 つ
// 3. 英語の訳の引き方: 文の型・名前・数の書き方が訳せる (TX の小さな例)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: ['130', '1,7'], judge: J.passes('翻訳') }];
if (require.main !== module) return;
const I = require('../i18n');
const H = require('../headless');
const [years = '60', seedsS = '1,7'] = process.argv.slice(2);
const bad = [];

const r = I.check('en');
if (r.missing.length) bad.push(`表にない鍵 ${r.missing.length} (node tools/i18n.js --sync で足して訳す。例: ${r.missing[0].file}:${r.missing[0].line} ${r.missing[0].key.slice(0, 40)})`);
if (r.untranslated.length) bad.push(`訳のない鍵 ${r.untranslated.length} (例: ${r.untranslated[0].file}:${r.untranslated[0].line} ${r.untranslated[0].key.slice(0, 40)})`);
if (r.stale.length) bad.push(`コードにない鍵 ${r.stale.length} (node tools/i18n.js --sync で消す)`);
if (r.bad.length) bad.push(`訳の形の食い違い ${r.bad.length} (例: ${r.bad[0].slice(0, 80)})`);
console.log(`表: 鍵 ${r.keys.length}・訳のない鍵 ${r.missing.length + r.untranslated.length}・形の食い違い ${r.bad.length}`);

const ja = H.load({ lang: 'ja' }), en = H.load({ lang: 'en' });
if (ja.evaluate('LANG') !== 'ja' || en.evaluate('LANG') !== 'en') bad.push('言語の切り替えが効かない');
for (const seed of seedsS.split(',')) for (const nat of [0, 6]) {
  const a = ja.run(ja.newGame(seed, { nations: nat }), Number(years)), b = en.run(en.newGame(seed, { nations: nat }), Number(years));
  const ha = ja.hash(a), hb = en.hash(b);
  console.log(`シード ${seed}・国 ${nat}・${years} 年: 日本語 ${ha}・英語 ${hb} ${ha === hb ? '一致' : '違う'}`);
  if (ha !== hb) bad.push(`シード ${seed}・国 ${nat}: 状態の要約が言語で違う (試合の状態に英語が入ったか、文で決まる所がある)`);
}

// ブラウザで、画面を押して始めた試合 (国家選択の名前や、画面で作る文が試合に入らないか)
(async () => {
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const { chromium } = require('playwright');
const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
const web = {};
for (const lang of ['ja', 'en']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 780 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto(`file://${HTML}?lang=${lang}&seed=3`);
  await p.waitForFunction(() => window.__app && __app.game);
  await p.evaluate(() => { if ($('home').hidden) openHome(); app.homeTab = 'single'; app.homeNat = 6; app.homeSeed = '3'; renderHome(); });
  await p.click('[data-home="new"]');
  await p.waitForSelector('#pick [data-pick="go"]');
  await p.click('#pick [data-pick="go"]');
  web[lang] = await p.evaluate((y) => {
    const g = __app.game; setSpeed(0); g.setSpectate(true);
    for (let i = 0; i < y * 4; i++) g.advance(0.25);
    const d = { ...buildSave(g) }; delete d.savedAt;
    const t = JSON.stringify(d); let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return [(h >>> 0).toString(36), document.documentElement.lang, $('tab-galaxy').textContent.trim()];
  }, Math.min(Number(years), 120));
  if (errs.length) bad.push(`${lang} の画面の誤り: ${errs[0]}`);
  await p.close();
}
await b.close();
console.log(`画面から始めた試合: 日本語 ${web.ja[0]} (${web.ja[2]})・英語 ${web.en[0]} (${web.en[2]}) ${web.ja[0] === web.en[0] ? '一致' : '違う'}`);
if (web.ja[0] !== web.en[0]) bad.push('画面から始めた試合の状態の要約が言語で違う (画面で作った英語の文が試合に入った)');
if (web.ja[1] !== 'ja' || web.en[1] !== 'en' || web.ja[2] === web.en[2]) bad.push('ブラウザで言語が切り替わらない');

// 引き方の小さな例: 表・数の書き方・種族の名前・国の名前・つないだ文・日本語のときはそのまま
const ex = [
  ['TX("食料")', 'Food'],
  ['TX("3 万人")', '30k people'],
  ['TX("120億人")', '12B'],
  ['TX("カラ人")', 'Kara'],
  ['TX("カラ王国")', 'Kingdom of Kara'],
  ['TX("シリウス b")', 'Sirius b'],
];
for (const [code, want] of ex) {
  const got = en.evaluate(code);
  if (got !== want) bad.push(`${code} が「${got}」 (「${want}」のはず)`);
}
if (ja.evaluate('TX("食料") + TR`${3}年`') !== '食料3年') bad.push('日本語のときに TX・TR が文を変えた');

})().then(() => {
console.log(bad.length ? `翻訳 不合格\n${bad.map((x) => `- ${x}`).join('\n')}` : '翻訳 合格');
process.exit(bad.length ? 1 : 0);
});
