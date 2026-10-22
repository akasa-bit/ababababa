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
  // 入植・交易・統治体制の選び方 (B-067)。'auto' と 3・12 は、いまの観戦の AI (首都の星系政府の govsYearly) のまま
  colWait: ['auto', 0, 3, 10, 'never'], // 首都の入植の間隔 (年)。auto = ゲームの canColonize (5 年 + 国家方針)。0 = 間隔なし (bots.js の「拡張に振る」)。never = 入植しない
  colRange: [20, 10, 15, 25], // 首都の入植先を探す光年 (20 = ゲームのまま。ゲームの nearSystems は 25 光年まで)
  colPick: ['grade', 'near', 'best'], // 入植先の選び方: grade = 適性 ×10 − 距離 (ゲームのまま)・near = 適性 ×2 − 距離 (近さ優先)・best = 適性 ×100 − 距離 (適性優先)
  routes: [3, 0, 1, 6], // 首都が引く交易路の本数の上限 (3 = ゲームのまま。0 = 引かない)
  routeRange: [12, 6, 25], // 2 本目からの交易路の相手を探す光年 (12 = ゲームのまま)
  regime: ['auto', 'T01', 'T03', 'T05', 'T10', 'T12', 'T13', 'T14', 'T19', 'encomienda'], // 新しい家臣の統治体制 (auto = 藩王国 T04 のまま)
  direct: [0, 1], // 1 = 近い家臣から直轄の上限まで直轄にする
};
// 人間に近い遅れつきのボット (B-068) の値。戦略の値に足して使う (探索では変えない。humanize を見る)
//   delay: 1 = 自分の判断 (戦争・政治・委任・資金援助) を、首都に光が届いた知らせだけで決める (観戦の AI は光の遅れなしで判断する)
//   every: 判断を何年に 1 回するか (人がずっと見ていない分の遅れ。1 = 毎年)
const HUMAN = { delay: 1, every: 1 };
// 観戦の AI と同じ値 (探索の出発点)
const BASE = { policy: 'auto', warRatio: 5, warChance: 0.05, warRange: 25, sueRatio: 0.7, sueEx: 60, acceptEx: 40, acceptWs: 10, mandate: 'none', grantBelow: 0, peaceArm: 0, colWait: 'auto', colRange: 20, colPick: 'grade', routes: 3, routeRange: 12, regime: 'auto', direct: 0 };
// 決めた 6 つの戦略 (F06 の「6 つ以上の戦略ボット」の最小の組)
const PRESETS = {
  passive: { label: '放任', s: null },
  expand: { label: '拡張', s: { ...BASE, policy: 'expand', mandate: 'expand' } },
  develop: { label: '内政', s: { ...BASE, policy: 'consolidate', mandate: 'develop', grantBelow: 50 } },
  arm: { label: '軍備', s: { ...BASE, policy: 'military', mandate: 'arm', peaceArm: 3000 } },
  peaceful: { label: '平和', s: { ...BASE, warRatio: 0, sueRatio: 10, sueEx: 0, acceptEx: 0, acceptWs: -1000 } },
  warlike: { label: '好戦', s: { ...BASE, warRatio: 1.5, warChance: 0.3, sueRatio: 0.3, sueEx: 95, acceptEx: 90, acceptWs: 30 } },
};
// 決めた 6 つのほかに、拡張の一強を測り直すときに足す戦略 (tools/delay-report.js)。地球だけの試合で 1 位だった bots.js の「拡張に振る」(入植の間隔なし) を、値で書いたもの
const EXTRA = {
  rush: { label: '入植の間隔なし', s: { ...BASE, policy: 'expand', mandate: 'expand', colWait: 0, colRange: 25 } },
};
// 戦略を、人間に近い遅れつきのボットにする (null = 放任は、観戦の AI と同じ値 BASE に遅れを足したもの)
const humanize = (s, h = HUMAN) => ({ ...(s || BASE), ...h });

// プレイヤーの国の判断を、戦略 s で差し替える (試合を作った直後に 1 回。sim = headless.load の戻り値)
// s.delay のとき (人間に近い遅れつきのボット) は、判断のあいだだけ観戦モードを切り、首都に光が届いた知らせ
// (known・knownSystems・seenBy・seenShips・knownAtWar・visibleDecisions) だけで決める。自分の首都の星系の開発・入植・交易路は、
// 首都のことなので遅れなしのまま (ゲームの govsYearly などの自動)。s.every 年に 1 回しか判断しない (間の年は何もしない)
function apply(g, s, sim) {
  if (!s) return;
  const D = !!s.delay, every = Math.max(1, s.every || 1), y0 = g.year;
  if (s.policy !== 'auto') g.aiPolicy = s.policy;
  if (s.regime && s.regime !== 'auto') g.command('set', { key: 'regime', value: s.regime });
  // 判断のあいだだけ、光が届いた分で見る
  const seeing = (fn) => function (...a) {
    if (!D) return fn.apply(this, a);
    const sp = this.spectate;
    this.spectate = false;
    try { return fn.apply(this, a); } finally { this.spectate = sp; }
  };
  const awake = () => every === 1 || Math.round(g.year - y0) % every === 0;
  // 知っていること。D なら首都に届いた光で、そうでなければ実際の様子 (観戦の AI と同じ)
  const realmKnown = (id) => (id === g.cap ? g.realmOf(id) : g.known(id)?.realm);
  const V = {
    // 宣戦・攻める相手の候補 (独立した国の首都。ゲームの並びの順)
    roots: () => (D ? g.knownSystems().filter((x) => x.id !== g.cap && g.known(x.id)?.realm === x.id && g.known(x.id).independent)
      : g.colonizedSystems().filter((x) => x.id !== g.cap && g.realmOf(x.id) === x.id && g.gov(x.id).independent)).map((x) => x.id),
    ships: (root) => (D ? g.seenShips(g.cap, root) : g.realmShips(root)),
    atWar: (root) => (D ? g.knownAtWar(g.cap, root) : g.atWar(g.cap, root)),
    enemies: () => (D ? g.enemiesOf(g.cap).filter((e) => g.knownAtWar(g.cap, e)) : g.enemiesOf(g.cap)),
    systems: (root) => (D ? g.knownSystems().filter((x) => realmKnown(x.id) === root) : g.realmSystems(root)),
    // 攻める星系の守り (駐留の艦隊 + 艦隊戦で守っている分)
    defense: (id, root) => { if (!D) { const b = g.battleAt(id); return (g.garrison[id] || 0) + (b ? b.d : 0); } const v = g.seenBy(g.cap, id); return v ? v[2] + (v[3]?.[root] || 0) : 0; },
    garrison: (id) => (D ? g.knownGarrison(id) : g.garrison[id] || 0),
    // 首都に届いた講和の申し入れ
    offers: () => g.peaceOffers.filter((x) => x.to === g.cap && (!D || x.year + g.sysDist(x.from, g.cap) <= g.year + 1e-9)),
    // 直属の家臣 [{ id, mandate, loyalty }]
    vassals: () => (D ? g.knownSystems().filter((x) => x.id !== g.cap && g.known(x.id)?.lord === g.cap && (g.known(x.id).realm ?? g.cap) === g.cap).map((x) => { const k = g.known(x.id); return { id: x.id, mandate: k.mandate, loyalty: k.loyalty, direct: k.direct }; })
      : Object.entries(g.govs).map(([k, gv]) => ({ id: Number(k), gv })).filter(({ id, gv }) => id !== g.cap && gv.lord === g.cap && g.isColonized(id) && g.realmOf(id) === g.cap).map(({ id, gv }) => ({ id, mandate: gv.mandate, loyalty: gv.loyalty, direct: !!gv.direct }))),
  };
  // 戦争の判断 (観戦の AI の earthWarYearly と同じ形で、境目を値にしたもの)
  g.earthWarYearly = seeing(function () {
    if (!awake()) return;
    for (const o of V.offers()) if ((this.exhaustion[this.cap] || 0) > s.acceptEx || this.warScore(this.cap, o.from) > s.acceptWs) this.acceptPeace(o);
    for (const c of [...this.conferences]) { const b = c.bids.find((x) => x.realm === this.cap && !x.picks); if (b) this.submitTreaty({ id: c.id, picks: this.aiTreatyPicks(c, b) }); }
    const ours = this.realmShips(this.cap);
    const ordered = (act, sys) => this.requests.some((q) => q.kind === 'order' && q.act === act && Number(q.d.sys) === sys);
    const atWarAny = this.enemiesOf(this.cap).length > 0;
    if (!atWarAny && s.peaceArm && this.gov(this.cap).credits > s.peaceArm && this.hasShipyard(this.cap)) this.buildWarship(this.cap);
    for (const root of V.roots()) {
      const theirs = V.ships(root);
      if (!V.atWar(root)) {
        if (s.warRatio && ours > s.warRatio * Math.max(1, theirs) && (!s.warRange || this.sysDist(this.cap, root) <= s.warRange) && this.rand() < s.warChance) this.declareWar(root);
        continue;
      }
      if (this.hasShipyard(this.cap) && this.funds(this.cap) >= 2 * sim.tables.WARSHIP_COST.credits) this.buildWarship(this.cap);
      if (ours < s.sueRatio * theirs || (this.exhaustion[this.cap] || 0) > s.sueEx) { if (!ordered('peace', root)) this.command('peace', { sys: root }); continue; }
      let best = null;
      for (const t of V.systems(root)) {
        if (ordered('fleet', t.id) || this.fleets.some((f) => f.to === t.id && (f.owner ?? 0) === this.cap)) continue;
        const need = V.defense(t.id, root) + 2;
        for (const src of V.systems(this.cap)) {
          const n = V.garrison(src.id) - 1;
          if (n < need) continue;
          const d = sim.distance(src, t);
          if (!best || d < best.d) best = { s: src, t, n, d };
        }
      }
      if (best) this.command('fleet', { from: best.s.id, sys: best.t.id, n: best.n });
    }
  });
  // 首都の入植の間隔と入植先 (B-067)。ほかの星系の政府はゲームのまま
  if (s.colWait !== undefined && s.colWait !== 'auto') {
    const orig = g.canColonize;
    g.canColonize = function (id) {
      if (id !== this.cap) return orig.call(this, id);
      if (s.colWait === 'never') return false;
      const gv = this.gov(id);
      const pop = this.coloniesIn(id).reduce((k, c) => k + c.pop, 0);
      const busy = this.projects.some((j) => j.type === 'ship' && j.sys === id) || this.ships.some((x) => x.from === id);
      return pop >= 3 && !busy && this.year - (gv.lastColony ?? gv.founded) >= s.colWait;
    };
  }
  if ((s.colRange !== undefined && s.colRange !== 20) || (s.colPick && s.colPick !== 'grade')) {
    const orig = g.colonyTarget, W = { grade: 10, near: 2, best: 100 }[s.colPick || 'grade'], range = s.colRange ?? 20;
    // ゲームの colonyTarget と同じ形で、範囲 (nearSystems は 25 光年まで) と適性の重みだけを変える。ステーションは適性 1 の惑星より 6 光年ぶん近いときだけ (重みに合わせる)
    g.colonyTarget = function (id) {
      if (id !== this.cap) return orig.call(this, id);
      let best = null;
      for (const [tid, d] of this.nearSystems(id)) {
        if (d > range || tid === id || this.isColonized(tid)) continue;
        const t = this.system(tid);
        for (const b of t.bodies) {
          const grade = b.settle?.grade || 0;
          if (grade < 1 || !this.check(t.id, b.id, 'planet').ok) continue;
          const score = grade * W - d;
          if (!best || score > best.score) best = { t, b, kind: 'planet', score };
        }
        const st = t.stars[0];
        if ((!best || W - 6 - d > best.score) && this.check(t.id, st.id, 'station').ok) best = { t, b: st, kind: 'station', score: W - 6 - d };
      }
      return best;
    };
  }
  // 首都の交易路 (B-067): ゲームの govsYearly が首都から引く分を止め、本数と遠さを変えて引き直す
  const ownRoutes = (s.routes !== undefined && s.routes !== 3) || (s.routeRange !== undefined && s.routeRange !== 12);
  let routing = false;
  if (ownRoutes) {
    const orig = g.openRoute;
    g.openRoute = function (a, b) { if (a === this.cap && !routing) return { ok: false, reason: '戦略で止めた' }; return orig.call(this, a, b); };
  }
  const capRoutes = function () {
    const id = this.cap, here = this.system(id);
    const mine = this.routes.filter((r) => r.a === id || r.b === id);
    if (mine.length >= s.routes) return;
    const near = (D ? this.knownSystems() : this.colonizedSystems())
      .filter((o) => o.id !== id && !this.routeBetween(o.id, id) && !(D ? this.knownHostile(id, o.id) : this.tradeBlocked(id, o.id)))
      .map((o) => ({ o, d: sim.distance(o, here) }))
      .filter((x) => !mine.length || x.d <= s.routeRange)
      .sort((a, b) => a.d - b.d)[0];
    if (!near || this.funds(id) < 1.5 * this.routeCost(id, near.o.id).credits) return;
    routing = true;
    try { this.openRoute(id, near.o.id); } finally { routing = false; }
  };
  // 政治の判断に、委任方針・資金援助・直轄・交易路を足す。D なら国家方針も知っていることで選ぶ
  const origPol = g.earthPoliticsYearly;
  const sent = {}; // 送った委任方針 (指令が届いて、その知らせが戻るまでのあいだに送り直さない)
  g.earthPoliticsYearly = seeing(function () {
    if (!awake()) return;
    if (D && s.policy === 'auto') {
      const keep = this.aiPolicy;
      this.aiPolicy = V.enemies().length ? 'military' : V.systems(this.cap).length < 25 ? 'expand' : 'consolidate';
      try { origPol.call(this); } finally { this.aiPolicy = keep; }
    } else origPol.call(this);
    if (s.mandate !== 'none' || s.grantBelow || s.direct) {
      for (const v of V.vassals()) {
        const id = v.id;
        if (s.mandate !== 'none' && (v.mandate || 'balanced') !== s.mandate && sent[id] !== s.mandate && !this.requests.some((q) => q.act === 'mandate' && Number(q.d.sys) === id) && this.pc >= this.pcCost('mandate', { sys: id }) + 10) {
          this.command('mandate', { sys: id, value: s.mandate });
          if (D) sent[id] = s.mandate;
        }
        if (s.grantBelow && (v.loyalty ?? 70) < s.grantBelow && this.gov(this.cap).credits > 2000) this.sendGrant(this.cap, id, 300);
      }
      // 直轄: 近い家臣から、上限まで (年に 1 か所)
      if (s.direct && this.directPlanned() < this.directMax()) {
        const v = V.vassals().filter((x) => !x.direct && !this.requests.some((q) => q.act === 'rule' && Number(q.d.sys) === x.id)).sort((a, b) => this.sysDist(this.cap, a.id) - this.sysDist(this.cap, b.id))[0];
        if (v && this.pc >= this.pcCost('rule', { sys: v.id, value: 'direct' }) + 10) this.command('rule', { sys: v.id, value: 'direct' });
      }
    }
    if (ownRoutes) capRoutes.call(this);
  });
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
    seed: String(seed), score, systems, pop: g.realmPop(cap), credits: g.gov(cap).credits, alive: systems > 0 ? 1 : 0, indep: g.asRealm(cap, () => g.stats?.indepFromEarth || 0),
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

module.exports = { SPACE, BASE, HUMAN, PRESETS, EXTRA, humanize, apply, play, runAll };
