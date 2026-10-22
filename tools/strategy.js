// 戦略の値と、それで 1 試合を回して数を集める所 (必勝法を探す AI・面白さの代わりの数の土台。段 12 の最小版)
// 画面なしの版 (tools/headless.js) の国家選択のある試合で、プレイヤーの国 (観戦の AI が動かす) の判断だけを、道具の側で差し替える。
// ゲーム本体 (src/index.html) には手を入れない。戦略を渡さない (null) と「放任」= いまの観戦の AI のまま。
// 使い方 (ほかの道具から): const S = require('./strategy'); const rs = await S.runAll([{ src, seed: '1', years: 150, nations: 6, strategy: S.PRESETS.expand.s }]);
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const H = require('./headless');

// 探索で変える値と、その候補。0 の宣戦の比は「宣戦しない」
const SPACE = {
  policy: ['auto', 'expand', 'consolidate', 'military'], // 国家方針 (auto = 観戦の AI のまま、戦争中は軍備・25 星系までは拡張・そのあと整備)
  warRatio: [0, 1.2, 1.5, 2, 3, 5, 10], // 自分の艦隊が相手の何倍を超えたら宣戦を考えるか
  warChance: [0.02, 0.05, 0.1, 0.3], // そのとき 1 年に宣戦する確率
  warRange: [10, 15, 25, 40, 0], // 首都からこの光年までの国にだけ宣戦する (0 = 遠さを問わない)
  sueRatio: [0.3, 0.5, 0.7, 1, 1.5], // 戦争中、自分の艦隊が相手の何倍を下回ったら講和を求めるか
  sueEx: [30, 45, 60, 80, 95], // 戦争疲弊がいくつを超えたら講和を求めるか
  acceptEx: [10, 25, 40, 60, 90], // 講和の申し入れに応じる戦争疲弊
  acceptWs: [-10, 0, 10, 30, 60], // 講和の申し入れに応じる戦勝点
  mandate: ['none', 'balanced', 'expand', 'develop', 'arm'], // 直属の家臣に送る委任方針 (none = 送らない)
  grantBelow: [0, 30, 50, 70], // 忠誠がこれより低い直属の家臣へ資金援助を送る (0 = 送らない。資金 2000 cr 以上のとき 300 cr)
  peaceArm: [0, 2000, 5000, 10000], // 戦争していなくても、資金がこれを超えたら軍艦を作る (0 = 作らない)
};
// 観戦の AI と同じ値 (探索の出発点)
const BASE = { policy: 'auto', warRatio: 5, warChance: 0.05, warRange: 25, sueRatio: 0.7, sueEx: 60, acceptEx: 40, acceptWs: 10, mandate: 'none', grantBelow: 0, peaceArm: 0 };
// 決めた 6 つの戦略 (F06 の「6 つ以上の戦略ボット」の最小の組)
const PRESETS = {
  passive: { label: '放任', s: null },
  expand: { label: '拡張', s: { ...BASE, policy: 'expand', mandate: 'expand' } },
  develop: { label: '内政', s: { ...BASE, policy: 'consolidate', mandate: 'develop', grantBelow: 50 } },
  arm: { label: '軍備', s: { ...BASE, policy: 'military', mandate: 'arm', peaceArm: 3000 } },
  peaceful: { label: '平和', s: { ...BASE, warRatio: 0, sueRatio: 10, sueEx: 0, acceptEx: 0, acceptWs: -1000 } },
  warlike: { label: '好戦', s: { ...BASE, warRatio: 1.5, warChance: 0.3, sueRatio: 0.3, sueEx: 95, acceptEx: 90, acceptWs: 30 } },
};

// プレイヤーの国の判断を、戦略 s で差し替える (試合を作った直後に 1 回。sim = headless.load の戻り値)
function apply(g, s, sim) {
  if (!s) return;
  if (s.policy !== 'auto') g.aiPolicy = s.policy;
  // 戦争の判断 (観戦の AI の earthWarYearly と同じ形で、境目を値にしたもの)
  g.earthWarYearly = function () {
    for (const o of this.peaceOffers.filter((x) => x.to === this.cap)) if ((this.exhaustion[this.cap] || 0) > s.acceptEx || this.warScore(this.cap, o.from) > s.acceptWs) this.acceptPeace(o);
    for (const c of [...this.conferences]) { const b = c.bids.find((x) => x.realm === this.cap && !x.picks); if (b) this.submitTreaty({ id: c.id, picks: this.aiTreatyPicks(c, b) }); }
    const ours = this.realmShips(this.cap);
    const ordered = (act, sys) => this.requests.some((q) => q.kind === 'order' && q.act === act && Number(q.d.sys) === sys);
    const atWarAny = this.enemiesOf(this.cap).length > 0;
    if (!atWarAny && s.peaceArm && this.gov(this.cap).credits > s.peaceArm && this.hasShipyard(this.cap)) this.buildWarship(this.cap);
    for (const x of this.colonizedSystems()) {
      const root = x.id;
      if (root === this.cap || this.realmOf(root) !== root || !this.gov(root).independent) continue;
      const theirs = this.realmShips(root);
      if (!this.atWar(this.cap, root)) {
        if (s.warRatio && ours > s.warRatio * Math.max(1, theirs) && (!s.warRange || this.sysDist(this.cap, root) <= s.warRange) && this.rand() < s.warChance) this.declareWar(root);
        continue;
      }
      if (this.hasShipyard(this.cap) && this.funds(this.cap) >= 2 * sim.tables.WARSHIP_COST.credits) this.buildWarship(this.cap);
      if (ours < s.sueRatio * theirs || (this.exhaustion[this.cap] || 0) > s.sueEx) { if (!ordered('peace', root)) this.command('peace', { sys: root }); continue; }
      let best = null;
      for (const t of this.realmSystems(root)) {
        if (ordered('fleet', t.id) || this.fleets.some((f) => f.to === t.id && (f.owner ?? 0) === this.cap)) continue;
        const b = this.battleAt(t.id);
        const need = (this.garrison[t.id] || 0) + (b ? b.d : 0) + 2;
        for (const src of this.realmSystems(this.cap)) {
          const n = (this.garrison[src.id] || 0) - 1;
          if (n < need) continue;
          const d = sim.distance(src, t);
          if (!best || d < best.d) best = { s: src, t, n, d };
        }
      }
      if (best) this.command('fleet', { from: best.s.id, sys: best.t.id, n: best.n });
    }
  };
  // 政治の判断に、委任方針と資金援助を足す
  if (s.mandate !== 'none' || s.grantBelow) {
    const orig = g.earthPoliticsYearly;
    g.earthPoliticsYearly = function () {
      orig.call(this);
      for (const [k, gv] of Object.entries(this.govs)) {
        const id = Number(k);
        if (id === this.cap || gv.lord !== this.cap || !this.isColonized(id) || this.realmOf(id) !== this.cap) continue;
        if (s.mandate !== 'none' && gv.mandate !== s.mandate && !this.requests.some((q) => q.act === 'mandate' && Number(q.d.sys) === id) && this.pc >= this.pcCost('mandate', { sys: id }) + 10) this.command('mandate', { sys: id, value: s.mandate });
        if (s.grantBelow && (gv.loyalty ?? 70) < s.grantBelow && this.gov(this.cap).credits > 2000) this.sendGrant(this.cap, id, 300);
      }
    };
  }
}

// 1 試合を回し、成績と面白さの代わりの数を返す
function play(sim, { seed, years = 150, nations = 6, strategy = null, rankYear = 50 }) {
  const g = sim.newGame(seed, { nations });
  const cap = g.cap;
  apply(g, strategy, sim);
  // 1. 判断を求められた回数: 決めること (要求・語り手の出来事)・プレイヤーの国への講和の申し入れ・プレイヤーの国が入る講和会議
  let asks = 0;
  const origAdd = g.addDecision.bind(g);
  g.addDecision = (dec) => { asks++; return origAdd(dec); };
  const origConf = g.startConference.bind(g);
  g.startConference = (loser, winners, from) => { const n = g.conferences.length; const r = origConf(loser, winners, from); if (g.conferences.length > n && g.conferences[g.conferences.length - 1].bids.some((b) => b.realm === cap && !b.picks)) asks++; return r; };
  // 会議の知らせが光速で首都に届いてから開く会議 (B-030。届く途中は confSent。前の版にはない)
  if (g.conferencesArrive) {
    const origArrive = g.conferencesArrive.bind(g);
    g.conferencesArrive = () => { const n = g.conferences.length; const r = origArrive(); for (const c of g.conferences.slice(n)) if (c.bids.some((b) => b.realm === cap && !b.picks)) asks++; return r; };
  }
  const offersSeen = new Set();
  // 2. 待つだけの年: プレイヤーの国の星系での出来事も、判断を求められることもなかった年
  let lastEv = Math.max(0, ...g.events.map((e) => e.id));
  let quietYears = 0, run = 0, longestQuiet = 0;
  // 5. 逆転: rankYear 年目と終わりの年で、国の順位 (星系の数) の 1 位が変わったか
  const leader = () => { let best = null; for (const n of g.nations || []) { const k = g.realmSystems(n.cap).length; if (!best || k > best.k) best = { cap: n.cap, k }; } return best?.cap ?? null; };
  let midLeader = null;
  const t0 = Date.now();
  for (let y = 1; y <= years; y++) {
    const a0 = asks;
    for (let i = 0; i < 4; i++) g.advance(0.25);
    for (const o of g.peaceOffers) if (o.to === cap && !offersSeen.has(o)) { offersSeen.add(o); asks++; }
    const ours = new Set(g.realmSystems(cap).map((x) => x.id));
    const evs = g.events.filter((e) => e.id > lastEv);
    lastEv = Math.max(lastEv, ...g.events.map((e) => e.id));
    const busy = asks > a0 || evs.some((e) => e.sys === cap || ours.has(e.sys));
    if (busy) run = 0; else { quietYears++; run++; longestQuiet = Math.max(longestQuiet, run); }
    if (y === rankYear) midLeader = leader();
  }
  const systems = g.realmSystems(cap).length;
  const score = systems ? g.asRealm(cap, () => g.score().total) : 0;
  return {
    seed: String(seed), score, systems, pop: g.realmPop(cap), credits: g.gov(cap).credits, alive: systems > 0 ? 1 : 0,
    asksPer100: (asks / years) * 100, quietShare: quietYears / years, longestQuiet,
    reversal: midLeader === null ? null : midLeader !== leader() ? 1 : 0, ms: Date.now() - t0, hash: sim.hash(g),
  };
}

// いくつもの試合を、CPU の数だけ並べて回す。jobs = [{ src, seed, years, nations, strategy }]。順番どおりの結果を返す
function runAll(jobs, threads = Math.max(1, Math.min(os.cpus().length, Number(process.env.THREADS) || 64))) {
  return new Promise((resolve, reject) => {
    const out = new Array(jobs.length);
    let next = 0, done = 0;
    if (!jobs.length) return resolve(out);
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
  const sims = new Map(); // 同じファイルは 1 回だけ読む
  parentPort.on('message', ({ i, job }) => {
    try {
      const src = job.src || path.join(__dirname, '..', 'src', 'index.html');
      if (!sims.has(src)) sims.set(src, H.load({ src }));
      parentPort.postMessage({ i, res: play(sims.get(src), job) });
    } catch (e) { parentPort.postMessage({ i, err: String(e.stack || e) }); }
  });
}

module.exports = { SPACE, BASE, PRESETS, apply, play, runAll };
