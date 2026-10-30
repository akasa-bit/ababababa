// 国ごとの違いの釣り合い (回 SE8・B-029。QD-112 = a): 国家選択 6 か国の観戦で回し、国ごとの特性・開始の大きさ・終わりの星系の数を記録して、
// 特性ごと・開始の大きさの組ごとの勝率 (終わりの年に星系の数が 1 位。同じ数は分ける) を、全体の勝率 (1 ÷ 国の数) との比で出す。
// 特性の釣り合いは開始の大きさをそろえた試合 (--equal。EDITIONS の nationSize = 0) で測る (大きさの差は QD-111 = c で釣り合わせないので、混ぜない)。
// 比が 1.5 を超えるか 0.5 を下回る特性は値を直す (docs/nations.md)。
// 使い方: node tools/nation-balance.js <最初のシード> <最後のシード> [年数 = 150] [--equal] [--src 組み立てた src] [--json 出力.json]   (途中までの結果もシードごとに書き出す)
//        node tools/nation-balance.js --merge a.json,b.json…                                                  (まとめて表にする)
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

function summarize(rows) {
  const nat = rows.flatMap((g) => g.nations.map((n) => ({ ...n, win: n.win })));
  const base = nat.reduce((a, n) => a + n.win, 0) / (nat.length || 1);
  // 地球 (人類) は母星の作りが違うので、地球を除いた国の勝率も出す
  const alien = nat.filter((n) => n.species !== '人類'), earth = nat.filter((n) => n.species === '人類');
  const traits = {};
  for (const n of nat) for (const t of n.traits) { const x = (traits[t] ??= { n: 0, w: 0, an: 0, aw: 0 }); x.n++; x.w += n.win; if (n.species !== '人類') { x.an++; x.aw += n.win; } }
  const abase = alien.reduce((a, n) => a + n.win, 0) / (alien.length || 1);
  const bins = [[0, 0.7, '小 (×0.7 未満)'], [0.7, 1.4, '中 (×0.7〜1.4)'], [1.4, 99, '大 (×1.4 以上)']];
  const sizes = bins.map(([lo, hi, label]) => { const s = nat.filter((n) => n.size >= lo && n.size < hi); return { label, n: s.length, w: s.reduce((a, n) => a + n.win, 0), sys: s.reduce((a, n) => a + n.systems, 0) / (s.length || 1) }; });
  const out = [`### 国ごとの違いの釣り合い (${rows.length} 銀河 × ${rows[0]?.years} 年 × 6 か国、観戦${rows[0]?.equal ? '・開始の大きさをそろえた' : ''})`, '',
    `全体の勝率 ${(100 * base).toFixed(1)}% (国 ${nat.length})・地球の国の勝率 ${earth.length ? ((100 * earth.reduce((a, n) => a + n.win, 0)) / earth.length).toFixed(1) : '—'}%・地球を除いた国の勝率 ${alien.length ? ((100 * alien.reduce((a, n) => a + n.win, 0)) / alien.length).toFixed(1) : '—'}%`, '', '| 特性 | 国の数 | 勝ち | 勝率 | 全体との比 | 判定 | 地球を除いた比 |', '|---|---|---|---|---|---|---|'];
  for (const [t, x] of Object.entries(traits).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)) {
    const r = x.w / x.n / (base || 1);
    out.push(`| ${t} | ${x.n} | ${x.w.toFixed(1)} | ${((100 * x.w) / x.n).toFixed(1)}% | ${r.toFixed(2)} | ${r > 1.5 ? '**強すぎる**' : r < 0.5 ? '**弱すぎる**' : '幅の中'} | ${x.an ? (x.aw / x.an / (abase || 1)).toFixed(2) : '—'} |`);
  }
  out.push('', '| 開始の大きさ | 国の数 | 勝ち | 勝率 | 全体との比 | 終わりの星系の平均 |', '|---|---|---|---|---|---|');
  for (const s of sizes) out.push(`| ${s.label} | ${s.n} | ${s.w.toFixed(1)} | ${s.n ? ((100 * s.w) / s.n).toFixed(1) : '—'}% | ${s.n ? (s.w / s.n / (base || 1)).toFixed(2) : '—'} | ${s.sys.toFixed(1)} |`);
  return { text: out.join('\n'), traits: Object.fromEntries(Object.entries(traits).map(([t, x]) => [t, { n: x.n, win: x.w, ratio: x.w / x.n / (base || 1) }])), sizes, base };
}

if (flag('--merge')) {
  const rows = opt('--merge').split(',').flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const s = summarize(rows);
  console.log(s.text);
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(s, null, 1));
  process.exit(0);
}
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--json', '--src'].includes(args[i - 1])));
const [a = '1', b = '30', years = '150'] = pos;
const H = require(path.resolve(__dirname, 'headless'));
const equal = flag('--equal');
const sim = H.load({ ...(opt('--src') ? { src: opt('--src') } : {}), ...(equal ? { params: { ED: { nationSize: 0 } } } : {}) });
const out = opt('--json');
const rows = [];
for (let seed = Number(a); seed <= Number(b); seed++) {
  const g = sim.newGame(String(seed), { nations: 6 });
  sim.run(g, Number(years));
  const sys = g.nations.map((n) => (g.realmAlive(n.cap) ? g.realmSystems(n.cap).length : 0)), top = Math.max(...sys), nTop = sys.filter((x) => x === top).length;
  rows.push({ seed, years: Number(years), equal, nations: g.nations.map((n, i) => ({ species: n.species, traits: n.traits, size: n.size ?? 1, systems: sys[i], alive: g.realmAlive(n.cap), win: sys[i] === top ? 1 / nTop : 0 })) });
  if (out) fs.writeFileSync(out, JSON.stringify(rows));
}
if (!out) console.log(summarize(rows).text);
