// 銀河の取り合いの目標 R40・R41 (回 SE5・B-028。評論家の計画のフェーズ 2 の 2-1) を測る。
// 画面なしの版で、国家選択 6 か国の観戦 (放任の AI) を回し、2500 年 (開始から 200 年) の様子を数える。
// - R40: 入植されている星系の数 ÷ 銀河の星系の数 の、銀河の平均 (60% 以上 85% 以下で合格)
// - R41: 残っている AI の国 (国家選択の国のうちプレイヤーの国でないもの。星系が 1 つ以上) の星系の数の、全試合を通した中央値 (8 以上で合格)
// ほかに、50 年ごとの入植された割合・国の大きさ・国家選択にない独立国の星系の数も出す (どこで国が小さくなるかを見る)
// 使い方: node tools/galaxy-race.js [銀河の数 = 30] [年数 = 300] [国の数 = 6] [src/index.html] [値のファイル.json]  → Markdown (--json で JSON)
const os = require('os');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const H = require('./headless');

const AT = 200; // 判定する年 (開始の 2300 年から 200 年 = 2500 年)

function play(sim, { seed, years, nations }) {
  const g = sim.newGame(String(seed), { nations });
  const player = g.players[0].cap;
  const ai = g.nations.map((n) => n.cap).filter((c) => c !== player);
  const total = g.galaxy.systems.length;
  const rows = {};
  let done = 0;
  for (let y = 50; y <= years; y += 50) {
    sim.run(g, y - done); done = y;
    const by = {};
    for (const s of g.colonizedSystems()) { const r = g.realmOf(s.id); by[r] = (by[r] || 0) + 1; }
    const nat = new Set(g.nations.map((n) => n.cap));
    rows[y] = {
      share: Object.values(by).reduce((k, v) => k + v, 0) / total,
      player: by[player] || 0,
      ai: ai.map((c) => (g.realmOf(c) === c ? by[c] || 0 : 0)), // 降伏して従属した国は 0 (残っていない)
      other: Object.entries(by).filter(([r]) => !nat.has(Number(r))).reduce((k, [, v]) => k + v, 0), // 国家選択にない独立国の星系
      otherRealms: Object.keys(by).filter((r) => !nat.has(Number(r))).length,
    };
  }
  return { seed, rows };
}

function runAll(jobs, threads = Math.max(1, Math.min(os.cpus().length, Number(process.env.THREADS) || 64))) {
  return new Promise((resolve, reject) => {
    const out = new Array(jobs.length);
    let next = 0, done = 0;
    const n = Math.min(threads, jobs.length);
    for (let w = 0; w < n; w++) {
      const worker = new Worker(__filename);
      const feed = () => { if (next < jobs.length) { const i = next++; worker.postMessage({ i, job: jobs[i] }); } else worker.terminate(); };
      worker.on('message', ({ i, res, err }) => {
        if (err) { worker.terminate(); return reject(new Error(err)); }
        out[i] = res;
        if (++done === jobs.length) resolve(out);
        feed();
      });
      worker.on('error', reject);
      feed();
    }
  });
}

if (!isMainThread) {
  let sim = null;
  parentPort.on('message', ({ i, job }) => {
    try {
      sim ??= H.load({ src: job.src, params: job.params });
      parentPort.postMessage({ i, res: play(sim, job) });
    } catch (e) { parentPort.postMessage({ i, err: String(e.stack || e) }); }
  });
} else {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const json = process.argv.includes('--json');
  const [nS = '30', yS = '300', natS = '6', src = path.join(__dirname, '..', 'src', 'index.html'), pf] = args;
  const params = pf ? JSON.parse(fs.readFileSync(pf, 'utf8')) : null;
  const years = Math.max(AT, Number(yS));
  const jobs = Array.from({ length: Number(nS) }, (_, i) => ({ seed: i + 1, years, nations: Number(natS), src, params }));
  runAll(jobs).then((res) => {
    const mean = (v) => v.reduce((k, x) => k + x, 0) / (v.length || 1);
    const median = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
    const at = res.map((r) => r.rows[AT]);
    const r40 = mean(at.map((r) => r.share));
    const alive = at.flatMap((r) => r.ai.filter((v) => v > 0));
    const r41 = median(alive);
    const out = { galaxies: res.length, r40, r40pass: r40 >= 0.6 && r40 <= 0.85, r41, r41pass: r41 !== null && r41 >= 8, aliveShare: alive.length / at.reduce((k, r) => k + r.ai.length, 0), byYear: {} };
    for (const y of Object.keys(res[0].rows)) {
      const rs = res.map((r) => r.rows[y]);
      const ai = rs.flatMap((r) => r.ai.filter((v) => v > 0));
      out.byYear[y] = { share: mean(rs.map((r) => r.share)), player: mean(rs.map((r) => r.player)), aiMedian: median(ai), aiMean: mean(ai), other: mean(rs.map((r) => r.other)), otherRealms: mean(rs.map((r) => r.otherRealms)) };
    }
    if (json) return console.log(JSON.stringify(out, null, 1));
    const p = (x) => `${(x * 100).toFixed(1)}%`;
    console.log(`### 銀河の取り合い (R40・R41。${res.length} の銀河 × ${years} 年 × ${natS} か国、観戦)\n`);
    console.log(`- R40 (2500 年の入植された割合、幅 60〜85%): **${p(r40)}** ${out.r40pass ? '合格' : '不合格'}`);
    console.log(`- R41 (2500 年に残っている AI の国の星系の数の中央値、8 以上): **${r41}** ${out.r41pass ? '合格' : '不合格'} (残っている AI の国 ${p(out.aliveShare)})\n`);
    console.log('| 年 | 入植された割合 | プレイヤーの国 | AI の国 (中央値・平均) | 国家選択にない独立国 (国・星系) |');
    console.log('|---|---|---|---|---|');
    for (const [y, v] of Object.entries(out.byYear)) console.log(`| ${2300 + Number(y)} | ${p(v.share)} | ${v.player.toFixed(1)} | ${v.aiMedian}・${v.aiMean.toFixed(1)} | ${v.otherRealms.toFixed(1)}・${v.other.toFixed(1)} |`);
  }).catch((e) => { console.error(e); process.exit(1); });
}
