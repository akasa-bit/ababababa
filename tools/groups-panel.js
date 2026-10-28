// 目標 R42 (政治から締め出された人口と分離の紛争) のゲームの側: 家臣の星系・年を、実データと同じ列で書き出す (回 SE6・B-020。docs/groups.md)
// 観戦で回し、年の始めに独立を求める動きがない家臣の星系ごとに 1 行: その年に動きが始まったか (onset)・政治から締め出された人口の割合 (excl)・
// 1 人あたりの所得 (inc。2011 年のドル)・人口 (pop。人)・平和の年数 (peace = 前の動きの始まりか、主従が結ばれてからの年数)。
// 合否は実データと同じ台本で: python3 data/build/analyze_groups.py --game <書き出した CSV>
// 使い方: node tools/groups-panel.js <銀河の数> <年数> <国の数> <書き出す CSV> [src/index.html]
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const [seedsS = '30', yearsS = '300', nS = '6', out = 'groups-panel.csv', src] = process.argv.slice(2);
const sim = H.load(src ? { src: path.resolve(src) } : { edition: 'game' });
const rows = ['seed,sys,year,onset,excl,inc,pop,peace'];
let onsets = 0;
for (let seed = 1; seed <= Number(seedsS); seed++) {
  const g = sim.newGame(String(seed), { nations: Number(nS) });
  const since = {}; // 星系 → 平和の年数を数え始めた年 (主従が結ばれた年か、前の動きの始まり)
  for (let y = 0; y < Number(yearsS); y++) {
    const y0 = g.year, at = [];
    for (const [k, gv] of Object.entries(g.govs)) {
      const id = Number(k);
      if (gv.lord === null || gv.lord === undefined || !g.isColonized(id)) { delete since[id]; continue; }
      since[id] ??= y0;
      if (gv.unrest?.stage) continue;
      const G = g.groupsOf(id);
      if (!G) continue;
      at.push({ id, excl: G.excl, inc: G.inc, pop: g.coloniesIn(id).reduce((a, c) => a + c.pop, 0) * 1e6, lord: gv.lord });
    }
    sim.run(g, 1);
    for (const r of at) {
      const gv = g.govs[r.id];
      const on = gv && gv.lord === r.lord && gv.unrest?.stage >= 1 && gv.unrest.since >= y0 ? 1 : 0;
      rows.push([seed, r.id, Math.floor(y0), on, r.excl.toFixed(5), r.inc.toFixed(1), r.pop.toFixed(0), (y0 - since[r.id]).toFixed(1)].join(','));
      if (on) { onsets++; since[r.id] = g.year; }
    }
  }
  process.stderr.write(`${seed}: 行 ${rows.length - 1}・始まり ${onsets}\n`);
}
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`${out}: 家臣の星系・年 ${rows.length - 1}・始まり ${onsets}`);
