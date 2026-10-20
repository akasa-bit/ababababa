// 物理の測る道具: 画面なしの版で試合を回し、船 1 便ごとの星間の気体と遮蔽の記録を CSV に書き、種類ごとにまとめる。docs/physics.md の 5。
// 人が判断を入れずに、同じ手順で何度でも同じデータが取れる (シードと値のファイルで決まる)。値のファイルで ISM・SHIELD・PROP を変えて比べられる
//   (例: { "SHIELD": { "crewSv": 1e30, "cargoGy": 1e30 } } で遮蔽なし (元と同じ試合になる)、{ "SHIELD": { "frontShare": 0.5 } } で限度を半分ずつ、
//    { "ISM": { "nNuc": 0.38 } } で一番濃い視線の値、{ "SHIELD": { "crewSv": 0.05 } } で厳しい限度)。
// 使い方: node tools/physics.js <シード> <年数> [国の数] [値のファイル.json] [出力の CSV]
//   --compare を付けると、遮蔽なし (限度を無限に) の試合も回して、入植した星系・入植地・交易路を比べる
const fs = require('fs');
const H = require('./headless');

// 物理はシミュレーション版だけに入っているので、シミュレーション版として回す
function voyages(seed, years, nations, params) {
  const sim = H.load({ params, edition: 'sim' });
  sim.evaluate('ENERGY_AUDIT = []');
  const g = sim.run(sim.newGame(seed, { nations }), years);
  return { rows: sim.evaluate('ENERGY_AUDIT'), g, sim };
}

function summarize(rows) {
  const by = {};
  for (const x of rows) {
    const k = x.kind;
    const b = (by[k] ??= { n: 0, ly: [], frac: [], m: 0, sh: 0, depth: [] });
    b.n++; b.m += x.m; b.sh += x.shield || 0;
    if (x.ly > 0) { b.ly.push(x.ly); b.frac.push((x.shield || 0) / x.m); b.depth.push(x.depth || 0); }
  }
  const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  const out = {};
  for (const [k, b] of Object.entries(by)) {
    out[k] = { n: b.n, lyMedian: med(b.ly), depthMedian: med(b.depth), fracMedian: med(b.frac), fracMax: b.frac.length ? Math.max(...b.frac) : NaN,
      massShare: b.sh / (b.m + b.sh) };
  }
  return out;
}

function shape(g) {
  return { systems: new Set(g.colonies.map((c) => c.sys)).size, colonies: g.colonies.length, routes: g.routes.length };
}

module.exports = { voyages, summarize };

if (require.main === module) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const compare = process.argv.includes('--compare');
  const [seed = '5', years = '150', nations = '0', paramFile, csv] = args;
  const params = paramFile && paramFile !== '-' ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null;
  const t0 = Date.now();
  const { rows, g } = voyages(seed, Number(years), Number(nations), params);
  if (csv) {
    const cols = ['year', 'kind', 'mode', 'beta', 'ly', 'm', 'shield', 'depth', 'side', 'share', 'E'];
    fs.writeFileSync(csv, [cols.join(','), ...rows.map((x) => cols.map((c) => x[c] ?? '').join(','))].join('\n') + '\n');
  }
  const res = { seed, years: Number(years), nations: Number(nations), voyages: rows.length, byKind: summarize(rows), game: shape(g), ms: Date.now() - t0 };
  if (compare) {
    const base = voyages(seed, Number(years), Number(nations), { ...(params || {}), SHIELD: { ...(params?.SHIELD || {}), crewSv: 1e30, cargoGy: 1e30 } });
    res.noShield = { game: shape(base.g), voyages: base.rows.length };
  }
  console.log(JSON.stringify(res, null, 1));
}
