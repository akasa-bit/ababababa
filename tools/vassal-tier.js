// 従属国の型のティアリスト (B-070。評論家の 3-6)。どの型も、首都からのどこかの距離で最善になるか・「全部を直轄にするのが最善」や
// 「維持費のかからない家臣の量産」にならないかを、自動対戦で確かめる。ゲームの中身は変えない (道具の側で包むだけ)。
//
// 1. 距離ごとの型の比べ (--force の実験。tools/vassal-export.js と同じ形): すべての国の新しい家臣の型を 1 つの型にした銀河を、型ごとに同じシードで回し、
//    家臣 1 つ (主従の結びつき 1 つ) ごとに、結ばれてから H 年のうちに主人へ届けた朝貢 (cr)・主人のもとに残った年数・独立 (と戦争になったか) を数える。
//    距離は結ばれたときの家臣と主人の国の首都の光年で、AI が型を選ぶときと同じ 3 つの区分 (陸続き・近い海・遠い海。BUNDLE.aiDist) に分ける。
//    「最善になりうる」= その区分で、朝貢と残った年数の両方で上回る型がほかにない (パレート最適)。直轄 (direct) は上限 (DIRECT_MAX) を外して全部を直轄にしたもの。
// 2. 戦略としての型 (--realm): 遅れつきのボット (tools/strategy.js の humanize) が、新しい家臣の型を 1 つに決めて遊んだときの点数。直轄を上限まで使う (direct: 1) も並べる。
//
// 使い方: node tools/vassal-tier.js [銀河の数] [年数] [国の数] [--horizon 年] [--types T01,T03,…] [--realm 銀河の数,年数] [--skip-forced] [--json 出力.json]
//   (--skip-forced = 1 を回さず 2 だけ)
//   例: node tools/vassal-tier.js 6 300 6 --realm 6,150   (THREADS=n で並べる数を絞る)
const os = require('os');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const H = require('./headless');

const BANDS = ['contiguous', 'near', 'far'];
const BAND_LABEL = { contiguous: '陸続き', near: '近い海', far: '遠い海' };

// 1 つの銀河を、新しい家臣の型を force にして回し、結びつきごとの数を返す
function playForced(sim, { seed, years, nations, force, horizon }) {
  const g = sim.newGame(String(seed), { nations });
  const { BUNDLE } = sim.tables;
  const band = (d) => (d < BUNDLE.aiDist[0] ? 'contiguous' : d < BUNDLE.aiDist[1] ? 'near' : 'far');
  // 型を決める所を差し替える (人間の国も AI の国も)。直轄は、作られたあとに direct にする (上限を外す)
  g.defaultRegime = (root, sysId = null) => (sysId === null || force === 'direct' ? 'T04' : force);
  if (force === 'direct') {
    const add = g.addColony.bind(g);
    g.addColony = function (sysId, ...a) { const fresh = !this.govs[sysId]; const r = add(sysId, ...a); const gv = this.govs[sysId]; if (fresh && gv && gv.lord !== null && gv.lord !== undefined) { gv.direct = true; delete gv.regime; } return r; };
  }
  const open = new Map(), ties = [], y0 = g.year;
  const close = (id, how, war = null) => {
    const t = open.get(id); if (!t) return;
    open.delete(id);
    if (t.start - y0 + horizon > years + 1e-9) return; // H 年を見届けられない結びつきは数えない
    const inH = g.year - t.start <= horizon + 1e-9;
    ties.push({ band: t.band, d: t.d, tribute: t.tribute, kept: Math.min(horizon, g.year - t.start), indep: how === 'independence' && inH ? 1 : 0, war: how === 'independence' && inH && war ? 1 : 0, lost: how !== 'censored' && inH ? 1 : 0 });
  };
  const indep = g.declareIndependence.bind(g);
  g.declareIndependence = function (id) { const r = indep(id); const li = g.lastIndependence; close(id, 'independence', li?.id === id ? li.war : null); return r; };
  // 朝貢: tributeYearly のあいだに家臣の資金から出ていった分 (ほかの支払いはこの中にない)
  const trib = g.tributeYearly.bind(g);
  g.tributeYearly = function () {
    const before = new Map([...open.keys()].map((id) => [id, this.govs[id]?.credits || 0]));
    const r = trib();
    for (const [id, c] of before) { const t = open.get(id); if (t && g.year - t.start < horizon) t.tribute += Math.max(0, c - (this.govs[id]?.credits || 0)); }
    return r;
  };
  for (let y = 0; y < years; y++) {
    sim.run(g, 1);
    for (const [k, gv] of Object.entries(g.govs)) {
      const id = Number(k);
      const t = open.get(id);
      const vassal = gv.lord !== null && gv.lord !== undefined && g.isColonized(id);
      if (!vassal) { if (t) close(id, 'other'); continue; }
      const realm = g.realmOf(id);
      if (t && t.realm !== realm) close(id, 'transfer');
      if (!open.has(id)) { const d = g.sysDist(id, realm); open.set(id, { realm, start: g.year, d, band: band(d), tribute: 0 }); }
    }
  }
  for (const id of [...open.keys()]) close(id, 'censored');
  return ties;
}

if (!isMainThread) {
  const sim = H.load({ ...(workerData.src ? { src: workerData.src } : {}) });
  parentPort.on('message', ({ i, job }) => {
    try { parentPort.postMessage({ i, res: playForced(sim, job) }); }
    catch (e) { parentPort.postMessage({ i, err: String(e.stack || e) }); }
  });
  return;
}

function runAll(jobs, threads) {
  return new Promise((resolve, reject) => {
    const out = new Array(jobs.length);
    let next = 0, done = 0;
    if (!jobs.length) return resolve(out);
    for (let w = 0; w < Math.min(threads, jobs.length); w++) {
      const worker = new Worker(__filename, { workerData: { src: process.env.HTML || null } });
      const feed = () => { if (next < jobs.length) { const i = next++; worker.postMessage({ i, job: jobs[i] }); } else worker.terminate(); };
      worker.on('message', ({ i, res, err }) => {
        if (err) { worker.terminate(); return reject(new Error(err)); }
        out[i] = res;
        if (++done % 10 === 0 || done === jobs.length) process.stderr.write(`${done} / ${jobs.length}\n`);
        if (done === jobs.length) resolve(out);
        feed();
      });
      worker.on('error', reject);
      feed();
    }
  });
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const f1 = (x, k = 1) => (x === null ? '—' : x.toFixed(k));

// 区分ごとに、パレート最適な型 (朝貢の中央値と残った年数の平均の両方で上回る型がない) と、それぞれの 1 位。朝貢は少数の豊かな家臣で平均が大きく振れるので中央値で比べる
function judge(rows) {
  const out = {};
  for (const b of BANDS) {
    const rs = rows.filter((r) => r[b] && r[b].n >= 3).map((r) => ({ type: r.type, ...r[b] }));
    const dominated = (x) => rs.some((y) => y !== x && y.tribMed >= x.tribMed && y.kept >= x.kept && (y.tribMed > x.tribMed || y.kept > x.kept));
    const top = (k) => rs.reduce((a, x) => (!a || x[k] > a[k] ? x : a), null)?.type ?? null;
    out[b] = { front: rs.filter((x) => !dominated(x)).map((x) => x.type), byTribute: top('tribMed'), byKept: top('kept') };
  }
  return out;
}

(async () => {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const horizon = Number(opt('--horizon', '100'));
  const typesArg = opt('--types', null);
  const realmArg = opt('--realm', null);
  const jsonOut = opt('--json', null);
  const skipForced = args.includes('--skip-forced');
  if (skipForced) args.splice(args.indexOf('--skip-forced'), 1);
  const [nS = '6', yS = '300', natS = '6'] = args;
  const sim = H.load({ ...(process.env.HTML ? { src: process.env.HTML } : {}) });
  const { REGIME_ORDER, VASSAL_DATA } = sim.tables;
  const label = (r) => (r === 'encomienda' ? '植民地 + 強制労働' : r === 'direct' ? '直轄 (上限なし)' : VASSAL_DATA.types[r]?.label || r);
  const types = typesArg ? typesArg.split(',') : REGIME_ORDER;
  const threads = Math.max(1, Math.min(os.cpus().length, Number(process.env.THREADS) || 64));
  const seeds = Array.from({ length: Number(nS) }, (_, i) => i + 1);
  const years = Number(yS), nations = Number(natS);

  // 1. 距離ごとの型の比べ
  const jobs = skipForced ? [] : types.flatMap((force) => seeds.map((seed) => ({ kind: 'forced', seed, years, nations, force, horizon })));
  const res = await runAll(jobs, threads);
  const rows = types.map((type) => {
    const ties = res.filter((_, i) => jobs[i].force === type).flat();
    // 始めの離反の倍率: 型の倍率だけ (始めは法 = 型の法、実態 = 型の実態。法と実態の差は型の始めから数えるので (QD-40 = a)、差の項は 1)
    const vt = VASSAL_DATA.types[type === 'direct' || type === 'encomienda' ? 'T20' : type];
    const hr0 = vt ? (type === 'encomienda' ? 1.6 : vt.hr) : null;
    const row = { type, label: label(type), hr0, tributeRate: type === 'encomienda' ? 0.4 : VASSAL_DATA.types[type === 'direct' ? 'T20' : type]?.tribute ?? null };
    for (const b of BANDS) {
      const ts = ties.filter((t) => t.band === b);
      row[b] = { n: ts.length, tribute: mean(ts.map((t) => t.tribute)), tribMed: median(ts.map((t) => t.tribute)), kept: mean(ts.map((t) => t.kept)), indep: mean(ts.map((t) => t.indep)), war: mean(ts.map((t) => t.war)), lost: mean(ts.map((t) => t.lost)) };
    }
    return row;
  });
  const best = judge(rows);
  const everBest = new Set(BANDS.flatMap((b) => best[b].front));
  const never = types.filter((t) => !everBest.has(t));

  if (!skipForced) {
    console.log(`## 従属国の型のティアリスト (B-070)\n`);
    console.log(`銀河 ${nS} × ${years} 年 × ${nations} か国、型ごとに同じシード。すべての国の新しい家臣をその型にした。家臣 1 つあたり、結ばれてから ${horizon} 年のうちの数 (${horizon} 年を見届けられた結びつきだけ)。`);
    console.log(`区分は家臣と主人の国の首都の光年: 陸続き < ${sim.tables.BUNDLE.aiDist[0]}・近い海 < ${sim.tables.BUNDLE.aiDist[1]}・遠い海 (AI が型を選ぶときと同じ)。★ = その区分でパレート最適 (朝貢の中央値と残った年数の両方で上回る型がない)。始めの離反の倍率 = 型の倍率 (結ばれたときは法と実態の差が型の始めのままなので、差の項は 1)。\n`);
    console.log(`| 型 | 朝貢の割合 | 始めの離反の倍率 | ${BANDS.map((b) => `${BAND_LABEL[b]}: 件数・朝貢 cr (中央値 / 平均)・残った年・独立 %`).join(' | ')} |`);
    console.log(`|---|---|---|${BANDS.map(() => '---').join('|')}|`);
    for (const r of rows) {
      const cell = (b) => { const x = r[b]; if (!x.n) return '—'; return `${best[b].front.includes(r.type) ? '★ ' : ''}${x.n}・${f1(x.tribMed, 0)} / ${f1(x.tribute, 0)}・${f1(x.kept)}・${f1(100 * x.indep, 0)}`; };
      console.log(`| ${r.type} ${r.label} | ${r.tributeRate === null ? '—' : `${Math.round(100 * r.tributeRate)}%`} | ${f1(r.hr0, 2)} | ${BANDS.map(cell).join(' | ')} |`);
    }
    console.log('');
    for (const b of BANDS) console.log(`- ${BAND_LABEL[b]}: パレート最適 ${best[b].front.join('・') || '—'} / 朝貢の 1 位 ${best[b].byTribute ?? '—'} / 残った年の 1 位 ${best[b].byKept ?? '—'}`);
    console.log(`- どの区分でも最善になれない型: ${never.length ? never.join('・') : 'なし'}`);
    const allDirect = BANDS.every((b) => best[b].front.length === 1 && best[b].front[0] === 'direct');
    console.log(`- 全部を直轄にするのが最善 (どの区分でも直轄だけがパレート最適): ${allDirect ? '**はい**' : 'いいえ'}`);
  }

  // 2. 戦略としての型
  let realm = null;
  if (realmArg) {
    const [rn, ry] = realmArg.split(',').map(Number);
    const rseeds = Array.from({ length: rn }, (_, i) => i + 1);
    const rtypes = ['auto', ...types];
    // 戦略としての型: 遅れつきのボットが新しい家臣の型を regime にして遊ぶ (direct = 観戦の AI の型のまま、直轄を上限まで)。
    // tools/strategy.js の runAll で回す (このファイルのワーカーで strategy.js を読むと、あちらのワーカーの受け手も動いてしまう)
    const S = require('./strategy');
    const stratOf = (regime) => S.humanize(regime === 'direct' ? { ...S.BASE, direct: 1 } : { ...S.BASE, regime });
    const rjobs = rtypes.flatMap((regime) => rseeds.map((seed) => ({ regime, seed, src: process.env.HTML || undefined, years: ry, nations, strategy: stratOf(regime) })));
    const rres = await S.runAll(rjobs.map(({ regime, ...j }) => ({ ...j, seed: String(j.seed) })), threads);
    realm = rtypes.map((t) => {
      const rs = rres.filter((_, i) => rjobs[i].regime === t);
      return { type: t, score: mean(rs.map((x) => x.score)), systems: mean(rs.map((x) => x.systems)), indep: mean(rs.map((x) => x.indep)), wins: 0 };
    });
    // 銀河ごとの 1 位
    for (const seed of rseeds) {
      const sc = rtypes.map((t) => rres[rjobs.findIndex((j) => j.regime === t && j.seed === seed)].score);
      const m = Math.max(...sc);
      sc.forEach((s, k) => { if (s === m) realm[k].wins++; });
    }
    console.log(`\n### 戦略としての型 (遅れつきのボット・銀河 ${rn} × ${ry} 年 × ${nations} か国。auto = 観戦の AI のまま (藩王国)、direct = 藩王国のまま直轄を上限まで)\n`);
    console.log('| 型 | 平均点 | 星系 | 独立を許した回数 | 1 位の銀河 |');
    console.log('|---|---|---|---|---|');
    for (const r of [...realm].sort((a, b) => b.score - a.score)) console.log(`| ${r.type} ${r.type === 'auto' ? '放任' : label(r.type).replace(' (上限なし)', ' (上限まで)')} | ${f1(r.score)} | ${f1(r.systems)} | ${f1(r.indep)} | ${r.wins} |`);
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ seeds: Number(nS), years, nations, horizon, rows, best, never, realm }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
