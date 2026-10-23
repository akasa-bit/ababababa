// 画面なしの版 (tools/headless.js) の試験: 同じシード・同じ手順で、Node で回した状態の要約が、公開用の index.html をブラウザで回したものと一致する。
// 国家選択なし・あり (6 か国) の 2 通り。値のファイルで表を書き換えると、結果が変わることも確かめる
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ args: ['100', '1,4,9'], judge: (o, code) => (code === 0 && o.includes('画面なしの版: 一致') ? '' : '画面なしの版がブラウザと違う') }];
if (require.main !== module) return;
const ROOT = require('path').resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const { chromium } = require('playwright');
const H = require('../headless');
const [years = '60', seedsS = '1,4'] = process.argv.slice(2);
const Y = Number(years);
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const sim = H.load();
  const rows = [];
  let allOk = true;
  for (const seed of seedsS.split(',')) for (const nat of [0, 6]) {
    const p = await b.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; });
    await p.goto(`file://${HTML}?seed=${seed}&home=0`);
    await p.waitForFunction(() => window.__app && __app.game);
    const web = await p.evaluate(([seed, Y, nat]) => {
      newGame(String(seed));
      __app.speed = 0;
      const g = __app.game;
      if (nat) { g.foundNations(nat); g.setPlayerNation(g.nations[1].cap); }
      g.setSpectate(true);
      for (let i = 0; i < Y * 4; i++) g.advance(0.25);
      const d = { ...buildSave(g) }; delete d.savedAt;
      const t = JSON.stringify(d);
      let h = 0x811c9dc5;
      for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return (h >>> 0).toString(36);
    }, [seed, Y, nat]);
    await p.close();
    const t0 = Date.now();
    const node = sim.hash(sim.run(sim.newGame(seed, { nations: nat }), Y));
    const ok = web === node && !errs.length;
    allOk &&= ok;
    rows.push({ seed, nations: nat, web, node, ok, nodeMs: Date.now() - t0, errs });
  }
  for (const r of rows) console.log(JSON.stringify(r));
  // 値のファイルが効くこと (離反のハザードを 3 倍にすると、状態が変わる)
  const changed = H.load({ params: { ED: { hazardBase: 3 * sim.tables.ED.hazardBase } } });
  const differs = changed.hash(changed.run(changed.newGame('1', { nations: 6 }), Y)) !== rows.find((r) => r.nations === 6).node;
  let bad = false;
  try { H.load({ params: { ED: { noSuchKey: 1 } } }); } catch { bad = true; }
  console.log(allOk && differs && bad ? '画面なしの版: 一致' : '画面なしの版: 不一致', JSON.stringify({ params: differs, unknownKeyRejected: bad }));
  await b.close();
  process.exit(allOk && differs && bad ? 0 : 1);
})();
