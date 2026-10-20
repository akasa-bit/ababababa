// 戦争の自動対戦 (画面なしの版): 国家選択のある試合を観戦で回し、戦争の始まり・終わり方・長さと、国家間戦争の多さを数える。
// 国家間戦争の多さ: 国どうしの戦争 (独立戦争を除く) への参加の始まり (1 つの戦争で 2) ÷ 国・年 × 100。国 = 毎年の独立した国 (国の首都) の数
// tools/wars.js (ブラウザ) と同じ数え方。main と比べるときは、比べる元の src を 2 つめに渡す
// 使い方: node tools/wars-headless.js <src/index.html> [比べる元の src] [銀河の数] [年数] [国の数]
const H = require('./headless');
const [src, baseSrc, nS = '12', yS = '300', natS = '6'] = process.argv.slice(2);
function measure(file) {
  const sim = H.load({ src: file });
  const done = [];
  let gamesYears = 0, realmYears = 0, interstate = 0;
  for (let seed = 1; seed <= Number(nS); seed++) {
    const g = sim.newGame(String(seed), { nations: Number(natS) });
    const wars = new Map();
    const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = (...a) => fn(orig, ...a); };
    let mode = null, inIndep = false;
    wrap('declareIndependence', (orig, ...a) => { inIndep = true; try { return orig(...a); } finally { inIndep = false; } });
    wrap('recordSnapshots', (orig) => { realmYears += new Set(g.colonizedSystems().map((x) => g.realmOf(x.id))).size; return orig(); });
    const finish = (key, how) => { const w = wars.get(key); if (!w) return; wars.delete(key); done.push({ dur: g.year - w.start, how }); };
    wrap('beginWar', (orig, by, target, from) => { const r = orig(by, target, from); wars.set(g.warKey(by, target), { start: g.year }); if (!inIndep) interstate++; return r; });
    wrap('makePeace', (orig, a, c, from) => { mode = Math.abs(g.warScore(a, c)) < 5 ? 'white' : 'treaty'; const r = orig(a, c, from); mode = null; return r; });
    wrap('startConference', (orig, loser, winners, from) => { const m = mode || (winners.length && winners[0].pts >= 100 ? 'capitulation' : 'treaty'); for (const w of winners) finish(g.warKey(w.realm, loser), m); return orig(loser, winners, from); });
    wrap('endWar', (orig, a, c, from) => { finish(g.warKey(a, c), mode || 'white'); return orig(a, c, from); });
    wrap('cleanWars', (orig) => { const before = new Set(Object.keys(g.realmWars)); const r = orig(); for (const k of before) if (g.realmWars[k] === undefined) finish(k, 'conquest'); return r; });
    wrap('surrender', (orig, root, winner) => { finish(g.warKey(root, winner), 'capitulation'); return orig(root, winner); });
    sim.run(g, Number(yS));
    for (const k of [...wars.keys()]) finish(k, 'ongoing');
    gamesYears += Number(yS);
  }
  const ended = done.filter((d) => d.how !== 'ongoing');
  const durs = ended.map((d) => d.dur).sort((a, b) => a - b);
  const med = durs[Math.floor(durs.length / 2)] || 0, mean = durs.reduce((k, x) => k + x, 0) / (durs.length || 1);
  const share = (h) => ended.filter((d) => d.how === h).length / (ended.length || 1);
  return { r19: (2 * interstate / (realmYears || 1)) * 100, per100y: (done.length / gamesYears) * 100, ended: ended.length, ongoing: done.length - ended.length, meanYears: mean, medianYears: med, meanOverMedian: med ? mean / med : null,
    white: share('white'), treaty: share('treaty'), capitulation: share('capitulation'), conquest: share('conquest') };
}
const rows = [['この版', measure(src)], ...(baseSrc && baseSrc !== '-' ? [['比べる元', measure(baseSrc)]] : [])];
const pc = (x) => `${(x * 100).toFixed(0)}%`;
const f = (x) => (typeof x === 'number' ? (Math.abs(x) < 1 && x !== 0 ? `${(x * 100).toFixed(0)}%` : x.toFixed(1)) : String(x));
console.log('| | 国 100 年あたりの国家間戦争 (R29: COW 2.34、±30% は 1.64〜3.04) | 100 年あたりの戦争 | 終わった / 続いている | 長さの平均 / 中央値 (年) | 平均 ÷ 中央値 (R13: 1.80〜3.33) | 白紙講和 | 条約 | 降伏 | 滅亡 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [n, r] of rows) console.log(`| ${n} | ${r.r19.toFixed(2)} | ${f(r.per100y)} | ${r.ended} / ${r.ongoing} | ${f(r.meanYears)} / ${f(r.medianYears)} | ${r.meanOverMedian ? r.meanOverMedian.toFixed(2) : '—'} | ${pc(r.white)} | ${pc(r.treaty)} | ${pc(r.capitulation)} | ${pc(r.conquest)} |`);
