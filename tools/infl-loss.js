// 物価の外れの政治の損 (QD-27 = b。回 KE9・B-009) の強さを測る (回 DO8。W3-Q6 = a「24 銀河で測り直して片寄っていたらもう一度聞く」)。
// 画面なしの版で観戦の試合を回し、毎年、国 (首都) ごとに:
//   物価の項 = LOSS.loyalty × INFL_LOSS × |物価の上がり方 − 2%| (家臣の忠誠度の目標。src/core/world.js の loyaltyTermsOf と同じ式)
//   税の項   = LOSS.loyalty × 家計の損の割合の合計 (policyLoss。所得への税・消費税・関税)
// を数え、物価の項の大きさの分布・税の項より大きかった国・年の割合・国ごとの片寄り (国の平均の物価の項の、いちばん大きい国 ÷ 中央の国) を出す。
// ゲームの中身は変えない。
// 使い方: node tools/infl-loss.js [銀河の数=24] [年数=150] [国の数=6] [--seeds a-b] [--json 結果.json]   (HTML=… で版を選ぶ)
//         node tools/infl-loss.js --merge a.json,b.json   (分けて回した結果をまとめる)
const fs = require('fs');
const H = require('./headless');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const mergeS = opt('--merge'), seedsS = opt('--seeds'), jsonOut = opt('--json');
const q = (xs, p) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))] : NaN; };
const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);

function run() {
  const [nS = '24', yS = '150', natS = '6'] = args;
  let seeds = Array.from({ length: Number(nS) }, (_, i) => String(i + 1));
  if (seedsS) { const [lo, hi] = seedsS.split('-').map(Number); seeds = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)); }
  const sim = H.load(process.env.HTML ? { src: process.env.HTML } : {});
  const { LOSS, CB } = sim.tables;
  const INFL_LOSS = sim.tables.INFL_LOSS ?? 1;
  const rows = []; // [銀河, 年, 国, 物価の上がり方, 物価の項, 税の項, 家臣の数]
  for (const seed of seeds) {
    const g = sim.newGame(seed, { nations: Number(natS) });
    for (let y = 0; y < Number(yS); y++) {
      sim.run(g, 1);
      const caps = [...new Set(g.colonizedSystems().map((s) => g.realmOf(s.id)))];
      for (const r of caps) {
        if (!g.cb?.[r]) continue;
        const infl = g.inflOf(r), loss = g.policyLoss ? g.policyLoss(r) : { tax: 0 };
        const vassals = g.colonizedSystems().filter((s) => s.id !== r && g.realmOf(s.id) === r).length;
        rows.push([seed, y, r, infl, LOSS.loyalty * INFL_LOSS * Math.abs(infl - CB.pistar), LOSS.loyalty * Object.values(loss).reduce((a, v) => a + v, 0), vassals]);
      }
    }
  }
  return { seeds, years: Number(yS), nations: Number(natS), rows };
}

function report({ seeds, years, nations, rows }) {
  const withV = rows.filter((r) => r[6] > 0); // 家臣のいる国・年 (忠誠度の項が効く所)
  const inf = withV.map((r) => -r[4]), tax = withV.map((r) => -r[5]), pi = withV.map((r) => r[3] * 100);
  const bigger = withV.filter((r) => -r[4] > Math.abs(r[5])).length / withV.length;
  // 国ごとの片寄り: 銀河ごとに、国の平均の物価の項のいちばん大きい国 ÷ 中央の国
  const skew = seeds.map((s) => {
    const by = new Map();
    for (const r of withV.filter((x) => x[0] === s)) { const a = by.get(r[2]) || []; a.push(-r[4]); by.set(r[2], a); }
    const ms = [...by.values()].filter((a) => a.length >= 10).map(mean);
    return ms.length >= 3 ? Math.max(...ms) / Math.max(0.01, q(ms, 0.5)) : null;
  }).filter((x) => x !== null);
  const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  const out = [];
  out.push(`### 物価の外れの政治の損の強さ (画面なしの版・観戦。${seeds.length} の銀河 × ${years} 年 × ${nations} か国。家臣のいる国・年 ${withV.length})`);
  out.push('');
  out.push('| 数 | 中央値 | 90% 点 | 99% 点 | 平均 |');
  out.push('|---|---|---|---|---|');
  out.push(`| 物価の上がり方 (%/年) | ${f1(q(pi, 0.5))} | ${f1(q(pi, 0.9))} | ${f1(q(pi, 0.99))} | ${f1(mean(pi))} |`);
  out.push(`| 物価の項 (家臣の忠誠度の目標を下げる点) | ${f2(q(inf, 0.5))} | ${f2(q(inf, 0.9))} | ${f2(q(inf, 0.99))} | ${f2(mean(inf))} |`);
  out.push(`| 税の項 (同じ。マイナスは上げる) | ${f2(q(tax, 0.5))} | ${f2(q(tax, 0.9))} | ${f2(q(tax, 0.99))} | ${f2(mean(tax))} |`);
  out.push('');
  out.push(`- 物価の項が税の項 (の大きさ) より大きかった国・年: ${Math.round(bigger * 100)}%`);
  out.push(`- 国ごとの片寄り (銀河ごとに、国の平均の物価の項のいちばん大きい国 ÷ 中央の国): 中央値 ${f2(q(skew, 0.5))}・90% 点 ${f2(q(skew, 0.9))} (${skew.length} の銀河)`);
  return out.join('\n');
}

if (mergeS) {
  const parts = mergeS.split(',').map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  console.log(report({ seeds: parts.flatMap((p) => p.seeds), years: parts[0].years, nations: parts[0].nations, rows: parts.flatMap((p) => p.rows) }));
} else {
  const res = run();
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(res));
  console.log(report(res));
}
