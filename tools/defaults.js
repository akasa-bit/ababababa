// 星系の政府の国債の不履行と、軍の維持費の重さを数える (回 KE10・B-175。docs/money.md の 5.6 の表と同じ数え方)。
// 画面なしの版で観戦の試合を回し、不履行 (sovDefault) を数え、毎年の終わりに、入植星系ごとの軍の維持費 (駐留の艦隊と兵。払い手の分け方は無視して
// その星系に置かれた分) ÷ その星系の GDP (政府の fr.y) を集める。ゲームの中身は変えない。
// 使い方: node tools/defaults.js [銀河の数=8] [年数=150] [国の数=6] [--seeds a-b] [--json 結果.json]   (HTML=… で版を選ぶ)
//         node tools/defaults.js --merge a.json,b.json
const fs = require('fs');
const H = require('./headless');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const mergeS = opt('--merge'), seedsS = opt('--seeds'), jsonOut = opt('--json');
const q = (xs, p) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))] : NaN; };

function run() {
  const [nS = '8', yS = '150', natS = '6'] = args;
  let seeds = Array.from({ length: Number(nS) }, (_, i) => String(i + 1));
  if (seedsS) { const [lo, hi] = seedsS.split('-').map(Number); seeds = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)); }
  const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
  const { WARSHIP_UPKEEP = 5, TROOP_UPKEEP = 2 } = sim.tables;
  const out = { seeds, years: Number(yS), nations: Number(natS), defaults: 0, again: 0, debtAt: [], burden: [], fleets: 0, sysYears: 0 };
  for (const seed of seeds) {
    const g = sim.newGame(seed, { nations: Number(natS) });
    const last = {};
    const orig = g.sovDefault.bind(g);
    g.sovDefault = (id, ...rest) => {
      const gv = g.govs[id];
      if (gv?.fr?.y > 0) out.debtAt.push((gv.bond || 0) / gv.fr.y);
      out.defaults++;
      if (last[id] !== undefined && g.year - last[id] <= 10) out.again++;
      last[id] = g.year;
      return orig(id, ...rest);
    };
    for (let y = 0; y < out.years; y++) {
      sim.run(g, 1);
      for (const s of g.colonizedSystems()) {
        const gv = g.govs[s.id], Y = gv?.fr?.y || 0;
        if (!(Y > 0)) continue;
        const ships = g.garrison[s.id] || 0, troops = g.coloniesIn(s.id).reduce((a, c) => a + (c.troops || 0), 0);
        out.burden.push((ships * WARSHIP_UPKEEP + troops * TROOP_UPKEEP) / Y);
        out.fleets += ships; out.sysYears++;
      }
    }
  }
  return out;
}

function report(r) {
  const b = r.burden, f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  return [
    `### 不履行と軍の維持費の重さ (画面なしの版・観戦。${r.seeds.length} の銀河 × ${r.years} 年 × ${r.nations} か国)`,
    '',
    `| 不履行 | 10 年以内の再不履行 | 不履行のときの債務 ÷ GDP の中央値 | 維持費 ÷ GDP の中央値 | 90% 点 | 1 を超えた星系・年 | 星系・年あたりの駐留艦隊 |`,
    '|---|---|---|---|---|---|---|',
    `| ${r.defaults} | ${r.again} | ${f2(q(r.debtAt, 0.5))} | ${f2(q(b, 0.5))} | ${f2(q(b, 0.9))} | ${Math.round((100 * b.filter((x) => x > 1).length) / Math.max(1, b.length))}% | ${f2(r.fleets / Math.max(1, r.sysYears))} |`,
  ].join('\n');
}

if (mergeS) {
  const parts = mergeS.split(',').map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const m = { seeds: parts.flatMap((p) => p.seeds), years: parts[0].years, nations: parts[0].nations, defaults: 0, again: 0, debtAt: [], burden: [], fleets: 0, sysYears: 0 };
  for (const p of parts) { m.defaults += p.defaults; m.again += p.again; m.debtAt.push(...p.debtAt); m.burden.push(...p.burden); m.fleets += p.fleets; m.sysYears += p.sysYears; }
  console.log(report(m));
} else {
  const r = run();
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(r));
  console.log(report(r));
}
