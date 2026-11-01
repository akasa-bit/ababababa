// 戦争の自動対戦 (画面なしの版): 国家選択のある試合を観戦で回し、戦争の始まり・終わり方・長さと、国家間戦争の多さを数える。
// 国家間戦争の多さ: 国どうしの戦争 (独立戦争を除く) への参加の始まり (1 つの戦争で 2) ÷ 国・年 × 100。国 = 毎年の独立した国 (国の首都) の数
// tools/wars.js (ブラウザ) と同じ数え方。main と比べるときは、比べる元の src を 2 つめに渡す
// 使い方: node tools/wars-headless.js <src/index.html> [比べる元の src] [銀河の数] [年数] [国の数]
//   --seeds a-b = 銀河 a〜b だけを回す・--json p.json = 数えた生の値を書く・--params 値.json = 値を上書きして回す (headless の params。例 {"BARGAIN":{"warDist":20}})
//   --merge p1.json,p2.json,… = 分けて回した結果をまとめて表にする (回 FU6。.github/workflows/measure.yml で実行機に分ける用)
const fs = require('fs');
const H = require('./headless');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const seedsS = opt('--seeds'), jsonOut = opt('--json'), mergeS = opt('--merge'), paramsF = opt('--params');
const [src, baseSrc, nS = '12', yS = '300', natS = '6'] = argv;
const params = paramsF ? JSON.parse(fs.readFileSync(paramsF, 'utf8')) : null;
const seedList = () => { if (seedsS) { const [lo, hi] = seedsS.split('-').map(Number); return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i); } return Array.from({ length: Number(nS) }, (_, i) => i + 1); };
// 数える (生の値)。summarize で表の数にする
function count(file) {
  const sim = H.load({ src: file, params });
  const done = [];
  let gamesYears = 0, realmYears = 0, interstate = 0, sieged = 0;
  const battles = []; // 試合の中の艦隊戦 [ln(攻撃 ÷ 防衛), 攻撃側の勝ち] (B-168)
  const seeds = seedList();
  for (const seed of seeds) {
    const g = sim.newGame(String(seed), { nations: Number(natS) });
    const wars = new Map();
    const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = (...a) => fn(orig, ...a); };
    let mode = null, inIndep = false;
    wrap('declareIndependence', (orig, ...a) => { inIndep = true; try { return orig(...a); } finally { inIndep = false; } });
    wrap('recordSnapshots', (orig) => { realmYears += new Set(g.colonizedSystems().map((x) => g.realmOf(x.id))).size; return orig(); });
    const finish = (key, how) => { const w = wars.get(key); if (!w) return; wars.delete(key); done.push({ dur: g.year - w.start, how, dead: g.warStats[key]?.dead || 0 }); };
    wrap('beginWar', (orig, by, target, from) => { const r = orig(by, target, from); wars.set(g.warKey(by, target), { start: g.year }); if (!inIndep) interstate++; return r; });
    wrap('makePeace', (orig, a, c, from) => { mode = Math.abs(g.warScore(a, c)) < 5 ? 'white' : 'treaty'; const r = orig(a, c, from); mode = null; return r; });
    wrap('startConference', (orig, loser, winners, from) => { const m = mode || (winners.length && winners[0].pts >= 100 ? 'capitulation' : 'treaty'); for (const w of winners) finish(g.warKey(w.realm, loser), m); return orig(loser, winners, from); });
    wrap('endWar', (orig, a, c, from) => { finish(g.warKey(a, c), mode || 'white'); return orig(a, c, from); });
    wrap('cleanWars', (orig) => { const before = new Set(Object.keys(g.realmWars)); const r = orig(); for (const k of before) if (g.realmWars[k] === undefined) finish(k, 'conquest'); return r; });
    wrap('surrender', (orig, root, winner) => { finish(g.warKey(root, winner), 'capitulation'); return orig(root, winner); });
    wrap('startBattle', (orig, ...a) => { sieged++; return orig(...a); });
    g.battleDone = (r) => battles.push([Math.log(Math.max(1, r.a0) / Math.max(1, r.d0 + (r.fort?.[0] || 0) * sim.tables.FORT.hp)), r.win]); // 要塞の区画は艦の hp 倍で数える
    sim.run(g, Number(yS));
    for (const k of [...wars.keys()]) finish(k, 'ongoing');
    gamesYears += Number(yS);
  }
  return { games: seeds.length, years: Number(yS), done, battles, gamesYears, realmYears, interstate, sieged };
}
function summarize({ done, battles, gamesYears, realmYears, interstate, sieged }) {
  const ended = done.filter((d) => d.how !== 'ongoing');
  const durs = ended.map((d) => d.dur).sort((a, b) => a - b);
  const med = durs[Math.floor(durs.length / 2)] || 0, mean = durs.reduce((k, x) => k + x, 0) / (durs.length || 1);
  const share = (h) => ended.filter((d) => d.how === h).length / (ended.length || 1);
  // 試合の中の艦隊戦で測った R16 の勝ちの傾き (ロジスティック回帰。数が少なければ出さない)
  let slope = null;
  if (battles.length >= 30) {
    let b0 = 0, b1 = 0;
    for (let it = 0; it < 40; it++) {
      let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
      for (const [x, y] of battles) { const p = 1 / (1 + Math.exp(-(b0 + b1 * x))), w = p * (1 - p); g0 += y - p; g1 += (y - p) * x; h00 += w; h01 += w * x; h11 += w * x * x; }
      const det = h00 * h11 - h01 * h01; if (!(Math.abs(det) > 1e-12)) break; b0 += (h11 * g0 - h01 * g1) / det; b1 += (h00 * g1 - h01 * g0) / det;
    }
    slope = b1;
  }
  const r15 = powerTail(done.map((d) => d.dead).filter((x) => x > 0));
  return { battles: battles.length, sieged, slope, r15, deadWars: done.filter((d) => d.dead > 0).length, r19: (2 * interstate / (realmYears || 1)) * 100, per100y: (done.length / gamesYears) * 100, ended: ended.length, ongoing: done.length - ended.length, meanYears: mean, medianYears: med, meanOverMedian: med ? mean / med : null,
    white: share('white'), treaty: share('treaty'), capitulation: share('capitulation'), conquest: share('conquest') };
}
// 戦死者数の裾のべき指数 (R15。Clauset–Shalizi–Newman の方法の連続版: xmin ごとに最尤の α を出し、KS 距離が一番小さい xmin を選ぶ。p 値のブートストラップはしない)
function powerTail(xs) {
  xs = xs.slice().sort((a, b) => a - b);
  let best = null;
  for (const xmin of [...new Set(xs)]) {
    const tail = xs.filter((x) => x >= xmin);
    if (tail.length < 10) break;
    const a = 1 + tail.length / tail.reduce((k, x) => k + Math.log(x / xmin), 0);
    let D = 0;
    tail.forEach((x, i) => { D = Math.max(D, Math.abs((i + 1) / tail.length - (1 - (x / xmin) ** (1 - a)))); });
    if (!best || D < best.D) best = { alpha: a, xmin, n: tail.length, D };
  }
  return best;
}
let raws;
if (mergeS) {
  const parts = mergeS.split(',').map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const join = (k) => { const ps = parts.map((p) => p[k]).filter(Boolean); return ps.length ? { games: 0, years: ps[0].years, done: [], battles: [], gamesYears: 0, realmYears: 0, interstate: 0, sieged: 0, ...ps.reduce((m, p) => ({ games: (m.games || 0) + p.games, years: p.years, done: [...(m.done || []), ...p.done], battles: [...(m.battles || []), ...p.battles], gamesYears: (m.gamesYears || 0) + p.gamesYears, realmYears: (m.realmYears || 0) + p.realmYears, interstate: (m.interstate || 0) + p.interstate, sieged: (m.sieged || 0) + p.sieged }), {}) } : null; };
  raws = [['この版', join('cur')], ['比べる元', join('base')]].filter(([, r]) => r);
} else {
  raws = [['この版', count(src)], ...(baseSrc && baseSrc !== '-' && baseSrc !== '' ? [['比べる元', count(baseSrc)]] : [])];
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ cur: raws[0][1], base: raws[1]?.[1] }));
}
const rows = raws.map(([n, r]) => [n, { ...summarize(r), games: r.games, years: r.years }]);
const pc = (x) => `${(x * 100).toFixed(0)}%`;
const f = (x) => (typeof x === 'number' ? (Math.abs(x) < 1 && x !== 0 ? `${(x * 100).toFixed(0)}%` : x.toFixed(1)) : String(x));
console.log('| | 国 100 年あたりの国家間戦争 (R29: COW 2.34、±30% は 1.64〜3.04) | 100 年あたりの戦争 | 終わった / 続いている | 長さの平均 / 中央値 (年) | 平均 ÷ 中央値 (R13: 1.80〜3.33) | 白紙講和 | 条約 | 降伏 | 滅亡 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [n, r] of rows) console.log(`| ${n} | ${r.r19.toFixed(2)} | ${f(r.per100y)} | ${r.ended} / ${r.ongoing} | ${f(r.meanYears)} / ${f(r.medianYears)} | ${r.meanOverMedian ? r.meanOverMedian.toFixed(2) : '—'} | ${pc(r.white)} | ${pc(r.treaty)} | ${pc(r.capitulation)} | ${pc(r.conquest)} |`);
console.log('\n| | R15 戦死者数の裾のべき指数 α (COW 1.55、合格 1.25〜1.85) | 裾の始まり xmin (人) | 裾の戦争の数 | KS 距離 | 死者の出た戦争 |');
console.log('|---|---|---|---|---|---|');
for (const [n, r] of rows) console.log(`| ${n} | ${r.r15 ? r.r15.alpha.toFixed(2) : '—'} | ${r.r15 ? Math.round(r.r15.xmin) : '—'} | ${r.r15 ? r.r15.n : '—'} | ${r.r15 ? r.r15.D.toFixed(3) : '—'} | ${r.deadWars} |`);
console.log('\n| | 試合の中の艦隊戦 (100 年あたり、1 つの銀河) | うち入植星系の艦隊戦 | その戦いで測った勝ちの傾き (R16 のゲーム版の補正: 作った戦いで 1.80) |');
console.log('|---|---|---|---|');
for (const [n, r] of rows) console.log(`| ${n} | ${(r.battles / r.games / r.years * 100).toFixed(1)} | ${(r.sieged / r.games / r.years * 100).toFixed(1)} | ${r.slope === null ? '— (30 戦より少ない)' : r.slope.toFixed(2)} |`);
