// AI の国の振る舞いの自動対戦 (画面なしの版。回 AI2・B-301): 国家選択のある試合を観戦で回し、宣戦の向きと道・協定・先頭への重りを数える。
// 物差しは docs/fun.md の 13 と targets/targets.json の R90・R91・F28・F29:
//   F28 = 組 (AI の国 → 人間の国) あたり 100 年の、AI の国が自分の判断で始めた宣戦の数 ÷ 組 (AI の国 → AI の国) あたりの数 (0.5〜2 倍)
//   F29 = 50 年ごとに点数が先頭の国が、次の 50 年に受けた宣戦と先頭に向けた防衛同盟 (結んだとき受け手の判断に先頭が脅威として入っていたもの) の数 ÷ ほかの国の平均 (1.25 倍以上)
//         点数は画面の点数の大きな 2 項 (星系 ×10 + 人口 200 百万人ごとに 1)。席のない国 (独立した国) も同じ式で比べるため
//   R90 = 国ごとの、結んだ不可侵と防衛同盟の協定の数 ÷ 国である年数 × 100 (20 年以上続いた国) の中央値 (6.13〜15.79)
//   R91 = 防衛同盟のうち、結んだとき受け手の判断に共通の脅威が入っていたもの (協定の th) の割合 (15.7〜73.9%)
//   R92 = 終わった協定 (不可侵と防衛同盟。加盟国が消えて終わったものを除く) のうち、破約で終わったものの割合 (23.1〜51.0%。回 AI3)
//   R93 = 指導者が 10 人以上退いた国ごとの、不規則な退き方 (政変・反乱など) の割合の中央値 (3.3〜37.3%。回 AI3)
//   R94 = 同じ国ごとの、退いた指導者の在任の年数の中央値の、国のあいだの中央値 (1.49〜3.94 年。回 AI3)
// 宣戦の道: own = AI の国が自分の判断で (realmsYearly の宣戦)・ally = 同盟の参戦 (diplomacyYearly)・indep = 独立・strike = 光速の一撃・human = 人間の席 (観戦の AI) の宣戦・
//   gov = 遠い総督の独断 (回 AI4。politics/inner.js の governorsYearly)
// 国どうしの威圧 (回 AI7。politics/coerce.js): 向き (A>A・A>H・H>A) ごとに、送った・飲まれた・断られた・断られて脅しを実行した (宣戦)・引き下がった数。
//   飲まれた割合の的は、1918〜2001 年の強要の脅し 210 件のおよそ 3 割 (Sechser・Fuhrmann 2017。目標にはしていない)
// 中の事情 (回 AI4): 総督の独断の数・首都の追認と否認・AI の国の揺さぶり (反対派) と支え (政府の側) の数
// マルチの点検 (回 AI5・B-304): --humans N で人間の席を N にする (国家選択の 2 番目から N か国。どの席も観戦の AI が動かす。ホットシートもネット対戦も、試合の中身は同じ)。
//   --hc 難易度 (easy・normal・hard・brutal。HANDICAP) で回す。人間の席ごとに、AI の国から受けた宣戦 (道ごと)・協定の申し入れ・防衛同盟・救援 (AI の国が守って参戦)・
//   贈り物・派閥への資金・揺さぶりを数え、終わりの星系と点数と生き残りを残す。50 年ごとに人間の中の先頭を決め、次の 50 年に先頭とほかの人間が受けた
//   AI の国の敵対 (宣戦) と肩入れ (防衛同盟・救援・贈り物・派閥への資金) を比べる (先頭以外が抜けないか・AI が勝敗の決め手になっていないか)。
//   人間の国の入植星系の割合・終わりの年の AI の国の数・AI の国の艦隊 (国あたり、毎年の平均) も出す (難易度の見直し。docs/ai-knowledge.md の 4.1 と同じ数え方)
// 使い方: node tools/ai-headless.js <src/index.html> [銀河の数] [年数] [国の数]
//   --seeds a-b = 銀河 a〜b だけを回す・--json p.json = 数えた生の値を書く・--merge p1.json,p2.json,… = 分けて回した結果をまとめて表にする・--params 値.json = 値を上書きして回す (headless の params。例 {"PACT":{"aiPropose":0.1}})
const fs = require('fs');
const H = require('./headless');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const seedsS = opt('--seeds'), jsonOut = opt('--json'), mergeS = opt('--merge'), paramsF = opt('--params'), humansS = opt('--humans'), hcS = opt('--hc');
const params = paramsF ? JSON.parse(fs.readFileSync(paramsF, 'utf8')) : null;
const [src, nS = '8', yS = '300', natS = '6'] = argv;
const seedList = () => { if (seedsS) { const [lo, hi] = seedsS.split('-').map(Number); return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i); } return Array.from({ length: Number(nS) }, (_, i) => i + 1); };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

function count(file) {
  const sim = H.load({ src: file, params });
  const out = { galaxies: 0, years: Number(yS), decl: {}, pairYears: { aiHuman: 0, aiAi: 0 }, pactsPerNation: [], ally: 0, allyThreat: 0, allyBandwagon: 0, honor: { join: 0, refuse: 0 }, lead: { leader: 0, others: 0, n: 0 }, pactEnd: { breach: 0, other: 0 }, leaderStats: [], inner: { endorse: 0, disavow: 0, undermine: 0, back: 0, lobby: 0, trade: 0, thank: 0, grudge: 0, fund: 0, lobYears: 0, lobW: 0 }, coerce: {} };
  for (const seed of seedList()) {
    const g = sim.newGame(String(seed), { nations: Number(natS) });
    const NH = Math.max(1, Number(humansS || 1));
    if (NH > 1) { g.setPlayers(g.nations.slice(1, 1 + NH).map((n) => n.cap)); g.setSpectate(true); }
    if (hcS) g.handicap = hcS;
    out.galaxies++;
    // マルチの点検 (回 AI5): 人間の席ごとの記録
    const M = (out.multi ??= { humans: NH, hc: hcS || 'normal', seats: [], games: [], lead: { hostL: 0, hostO: 0, supL: 0, supO: 0, n: 0 } });
    const hs = new Map(g.humans().map((p) => [p.cap, { decl: {}, offer: 0, ally: 0, rescue: 0, gift: 0, lobby: 0, undermine: 0 }]));
    const hseat = (r) => (g.isHuman(r) ? hs.get(r) : null);
    const hwin = []; // { from, leader, alive: [人間], host: Map, sup: Map }
    const hgot = (r, kind) => { for (const w of hwin) if (g.year < w.from + 50 && w.alive.includes(r)) w[kind].set(r, (w[kind].get(r) || 0) + 1); };
    const hscore = (r) => (g.realmAlive(r) ? 10 * g.realmSystems(r).length + g.realmPop(r) / 200 : 0);
    let fleetSum = 0, fleetN = 0;
    const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = (...a) => fn(orig, ...a); };
    const path = [];
    const within = (name, tag) => wrap(name, (orig, ...a) => { path.push(tag); try { return orig(...a); } finally { path.pop(); } });
    within('realmsYearly', 'own'); within('diplomacyYearly', 'ally'); within('declareIndependence', 'indep'); within('aiStrike', 'strike');
    if (g.governorsYearly) {
      within('governorsYearly', 'gov');
      wrap('governorReview', (orig) => { const was = Object.fromEntries(Object.entries(g.inner.gov).map(([k, v]) => [k, v.ok])); const r = orig(); for (const [k, v] of Object.entries(g.inner.gov)) if (was[k] === null && v.ok !== null) out.inner[v.ok ? 'endorse' : 'disavow']++; return r; });
      wrap('sendMeddle', (orig, d, from) => { const r = orig(d, from); if (r.ok && !g.isHuman(from ?? g.cap)) out.inner[d.mode === 'undermine' ? 'undermine' : d.mode === 'lobby' ? 'lobby' : 'back']++; return r; });
      // 外の国への派閥 (回 AI4): できた数 (きっかけごと) と、いまある派閥の国・年あたりの数と重みの平均 (年の終わりに数える)
      wrap('lobbyForm', (orig, ...a) => { const l = orig(...a); if (l) out.inner[l.why]++; return l; });
      wrap('lobbyYearly', (orig) => { const r = orig(); for (const l of g.inner.lob) if (l.end === null) { out.inner.lobYears++; out.inner.lobW += g.lobbyClout(l); } return r; });
    }
    const life = new Map(); // 国 → { from, to, pacts }
    const alive = () => g.colonizedSystems().map((x) => x.id).filter((r) => g.realmOf(r) === r && (g.isHuman(r) || g.gov(r).independent));
    const nation = (r) => { let n = life.get(r); if (!n) { n = { from: g.year, to: g.year, pacts: 0 }; life.set(r, n); } return n; };
    const window = []; // 先頭への重り: { from, leader, alive: Set } と、その 50 年に受けた数
    const recvd = (r, k = 1) => { for (const w of window) if (g.year < w.from + 50 && w.alive.has(r)) w.got.set(r, (w.got.get(r) || 0) + k); };
    wrap('beginWar', (orig, by, target, from) => {
      const r = orig(by, target, from);
      let p = path[path.length - 1] || 'other';
      if (p === 'own' && g.isHuman(by)) p = 'human';
      if (g.isHuman(by) && p !== 'indep') p = 'human';
      const dir = `${g.isHuman(by) ? 'H' : 'A'}>${g.isHuman(target) ? 'H' : 'A'}`;
      out.decl[`${dir}|${p}`] = (out.decl[`${dir}|${p}`] || 0) + 1;
      if (p !== 'indep') recvd(target);
      const h = hseat(target);
      if (h && !g.isHuman(by)) { h.decl[p] = (h.decl[p] || 0) + 1; if (p !== 'indep') hgot(target, 'host'); }
      return r;
    });
    wrap('makePact', (orig, a, b, kind, gift, info) => {
      const p = orig(a, b, kind, gift, info);
      if (kind === 'nap' || kind === 'ally') { nation(a).pacts++; nation(b).pacts++; }
      if (kind === 'ally') { out.ally++; if (p.th !== undefined && p.th !== null) out.allyThreat++; if (p.mode === 'bandwagon') out.allyBandwagon++; if (p.th !== undefined && p.th !== null) recvd(p.th); }
      if (kind === 'ally') for (const [x, y] of [[a, b], [b, a]]) { const h = hseat(x); if (h && !g.isHuman(y)) { h.ally++; hgot(x, 'sup'); } }
      return p;
    });
    const breached = new Set(), exits = new Map(); // 破約のあった組 (その年)・国 → [在任, 不規則]
    wrap('pactBreach', (orig, r, why, victim) => { if (victim !== null && victim !== undefined) breached.add(`${Math.min(r, victim)}|${Math.max(r, victim)}`); return orig(r, why, victim); });
    if (g.leaderChange) wrap('leaderChange', (orig, r, irr) => { const old = g.leaders[r]; if (old) { const l = exits.get(r) || []; l.push([g.year - old.since, irr ? 1 : 0]); exits.set(r, l); } return orig(r, irr); });
    let prevPacts = new Map();
    wrap('proposePact', (orig, d, from) => { const r = orig(d, from); const f = from ?? g.cap, t = g.realmOf(Number(d.sys)); if (r?.ok && !g.isHuman(f) && hseat(t)) hseat(t).offer++; return r; });
    if (g.memAdd) wrap('memAdd', (orig, a, b, k, ...x) => { const h = hseat(b); if (h && !g.isHuman(a) && (k === 'rescue' || k === 'gift')) { h[k]++; hgot(b, 'sup'); } return orig(a, b, k, ...x); });
    if (g.sendMeddle) wrap('sendMeddle', (orig, d, from) => { const f = from ?? g.cap, r = orig(d, from), t = g.realmOf(Number(d.sys)), h = hseat(t); if (r?.ok && h && !g.isHuman(f)) { if (d.mode === 'undermine') { h.undermine++; hgot(t, 'host'); } else { h.lobby++; hgot(t, 'sup'); } } return r; });
    // 国どうしの威圧 (回 AI7): 向きごとの数
    const cdir = (a, b) => `${g.isHuman(a) ? 'H' : 'A'}>${g.isHuman(b) ? 'H' : 'A'}`, cadd = (d, k) => { const c = (out.coerce[d] ??= { sent: 0, ok: 0, no: 0, follow: 0, back: 0, pts: 0 }); c[k]++; return c; };
    if (g.coerceSend) {
      wrap('coerceSend', (orig, r, e, ...a) => { const x = orig(r, e, ...a); if (x) cadd(cdir(r, e), 'sent').pts += g.coerce[g.coerce.length - 1].pts; return x; });
      wrap('coerceReply', (orig, o, ok) => { cadd(cdir(o.from, o.to), ok ? 'ok' : 'no'); return orig(o, ok); });
      wrap('coerceBack', (orig, o) => { const r = orig(o); if (!o.ok) cadd(cdir(o.from, o.to), g.atWar(o.from, o.to) ? 'follow' : 'back'); return r; });
    }
    if (g.aiHonor) wrap('aiHonor', (orig, ...a) => { const h = orig(...a); out.honor[h.join ? 'join' : 'refuse']++; return h; });
    const Y = Number(yS);
    for (let y = 0; y < Y; y++) {
      const rs = alive();
      for (const r of rs) nation(r).to = g.year + 1;
      const ai = rs.filter((r) => !g.isHuman(r)).length, hu = rs.length - ai;
      out.pairYears.aiHuman += ai * hu; out.pairYears.aiAi += ai * (ai - 1);
      for (const r of rs) if (!g.isHuman(r)) { fleetSum += g.realmShips(r); fleetN++; }
      if (y % 50 === 0 && y + 50 <= Y) {
        const ha = [...hs.keys()].filter((r) => g.realmAlive(r));
        if (ha.length > 1) hwin.push({ from: g.year, leader: [...ha].sort((a, b) => hscore(b) - hscore(a))[0], alive: ha, host: new Map(), sup: new Map() });
        const score = (r) => 10 * g.realmSystems(r).length + g.realmPop(r) / 200;
        const leader = [...rs].sort((a, b) => score(b) - score(a))[0];
        if (leader !== undefined && rs.length > 1) window.push({ from: g.year, leader, alive: new Set(rs), got: new Map() });
      }
      sim.run(g, 1);
      const now = new Map(g.diplo.pacts.filter((p) => p.kind !== 'trade').map((p) => [p.id, p]));
      for (const [id, p] of prevPacts) {
        if (now.has(id) || !g.realmAlive(p.a) || !g.realmAlive(p.b)) continue;
        out.pactEnd[breached.has(`${Math.min(p.a, p.b)}|${Math.max(p.a, p.b)}`) ? 'breach' : 'other']++;
      }
      prevPacts = now; breached.clear();
    }
    for (const l of exits.values()) if (l.length >= 10) out.leaderStats.push([median(l.map((x) => x[0])), l.reduce((k, x) => k + x[1], 0) / l.length]);
    // マルチの点検: 終わりの年の人間の席と、試合ごとの数
    const all = g.colonizedSystems().length, roots = alive();
    const fin = [...hs.keys()].map((r) => ({ r, sc: hscore(r) })).sort((a, b) => b.sc - a.sc);
    fin.forEach(({ r, sc }, i) => M.seats.push({ seed, rank: i + 1, alive: g.realmAlive(r), sys: g.realmAlive(r) ? g.realmSystems(r).length : 0, score: sc, share: all ? (g.realmAlive(r) ? g.realmSystems(r).length : 0) / all : 0, ...hs.get(r) }));
    // 国家選択で始まった AI の国 (人間の席でない国) の、終わりの星系の数の平均 (消えた国は 0)。人間の席の星系の数の平均と比べる (難易度の見直し)
    const fsys = g.nations.map((n) => n.cap).filter((c) => !hs.has(c)).map((c) => (g.realmAlive(c) ? g.realmSystems(c).length : 0));
    M.games.push({ seed, humanShare: all ? fin.reduce((k, x) => k + (g.realmAlive(x.r) ? g.realmSystems(x.r).length : 0), 0) / all : 0, aiAlive: roots.filter((r) => !g.isHuman(r)).length, fleetSum, fleetN,
      humanSys: fin.reduce((k, x) => k + (g.realmAlive(x.r) ? g.realmSystems(x.r).length : 0), 0) / Math.max(1, fin.length), founderSys: fsys.length ? fsys.reduce((a, b) => a + b, 0) / fsys.length : null });
    for (const w of hwin) {
      const others = w.alive.filter((r) => r !== w.leader);
      M.lead.hostL += w.host.get(w.leader) || 0; M.lead.supL += w.sup.get(w.leader) || 0;
      M.lead.hostO += others.reduce((k, r) => k + (w.host.get(r) || 0), 0) / others.length; M.lead.supO += others.reduce((k, r) => k + (w.sup.get(r) || 0), 0) / others.length;
      M.lead.n++;
    }
    for (const w of window) {
      const others = [...w.alive].filter((r) => r !== w.leader);
      out.lead.leader += w.got.get(w.leader) || 0;
      out.lead.others += others.reduce((k, r) => k + (w.got.get(r) || 0), 0) / others.length;
      out.lead.n++;
    }
    for (const n of life.values()) if (n.to - n.from >= 20) out.pactsPerNation.push((100 * n.pacts) / (n.to - n.from));
  }
  return out;
}
function merge(list) {
  const o = { galaxies: 0, years: list[0].years, decl: {}, pairYears: { aiHuman: 0, aiAi: 0 }, pactsPerNation: [], ally: 0, allyThreat: 0, allyBandwagon: 0, honor: { join: 0, refuse: 0 }, lead: { leader: 0, others: 0, n: 0 }, pactEnd: { breach: 0, other: 0 }, leaderStats: [], inner: { endorse: 0, disavow: 0, undermine: 0, back: 0, lobby: 0, trade: 0, thank: 0, grudge: 0, fund: 0, lobYears: 0, lobW: 0 }, coerce: {} };
  for (const x of list) {
    o.galaxies += x.galaxies;
    for (const [k, v] of Object.entries(x.decl)) o.decl[k] = (o.decl[k] || 0) + v;
    o.pairYears.aiHuman += x.pairYears.aiHuman; o.pairYears.aiAi += x.pairYears.aiAi;
    o.pactsPerNation.push(...x.pactsPerNation);
    o.pactEnd.breach += x.pactEnd?.breach || 0; o.pactEnd.other += x.pactEnd?.other || 0; o.leaderStats.push(...(x.leaderStats || []));
    o.honor.join += x.honor?.join || 0; o.honor.refuse += x.honor?.refuse || 0;
    for (const k of Object.keys(o.inner)) o.inner[k] += x.inner?.[k] || 0;
    for (const [d, c] of Object.entries(x.coerce || {})) { const m = (o.coerce[d] ??= { sent: 0, ok: 0, no: 0, follow: 0, back: 0, pts: 0 }); for (const k of Object.keys(m)) m[k] += c[k] || 0; }
    o.ally += x.ally; o.allyThreat += x.allyThreat; o.allyBandwagon += x.allyBandwagon;
    o.lead.leader += x.lead.leader; o.lead.others += x.lead.others; o.lead.n += x.lead.n;
    if (x.multi) {
      const m = (o.multi ??= { humans: x.multi.humans, hc: x.multi.hc, seats: [], games: [], lead: { hostL: 0, hostO: 0, supL: 0, supO: 0, n: 0 } });
      m.seats.push(...x.multi.seats); m.games.push(...x.multi.games);
      for (const k of Object.keys(m.lead)) m.lead[k] += x.multi.lead[k] || 0;
    }
  }
  return o;
}
function summarize(o) {
  const own = (d) => o.decl[`${d}|own`] || 0;
  const rateAH = (100 * own('A>H')) / Math.max(1, o.pairYears.aiHuman), rateAA = (100 * own('A>A')) / Math.max(1, o.pairYears.aiAi);
  const f28 = rateAA ? rateAH / rateAA : null;
  const f29 = o.lead.others ? o.lead.leader / o.lead.others : null;
  const r90 = median(o.pactsPerNation), r91 = o.ally ? o.allyThreat / o.ally : null;
  const ends = o.pactEnd.breach + o.pactEnd.other, r92 = ends ? o.pactEnd.breach / ends : null;
  const r93 = o.leaderStats.length ? median(o.leaderStats.map((x) => x[1])) : null, r94 = o.leaderStats.length ? median(o.leaderStats.map((x) => x[0])) : null;
  return { r92, r93, r94, pactEnd: o.pactEnd, leaderNations: o.leaderStats.length, f28, rateAH, rateAA, f29, r90, r91, ally: o.ally, allyThreat: o.allyThreat, allyBandwagon: o.allyBandwagon, honor: o.honor, nations: o.pactsPerNation.length, decl: o.decl, coerce: o.coerce, pairYears: o.pairYears, galaxies: o.galaxies, inner: o.inner, multi: o.multi ? multiSummary(o.multi, o.years) : null };
}
// マルチの点検の数 (回 AI5)。席・100 年あたりの数と、人間の中の先頭・終わりの順位ごとの比べ
function multiSummary(m, years) {
  const S = m.seats, G = m.games, per = (n, k) => (k ? (100 * n) / (k * years) : null);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const se = (xs) => { if (xs.length < 2) return null; const mu = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / (xs.length - 1) / xs.length); };
  const host = (x) => Object.entries(x.decl).filter(([k]) => k !== 'indep').reduce((a, [, v]) => a + v, 0) + x.undermine;
  const sup = (x) => x.ally + x.rescue + x.gift + x.lobby;
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
  const top = S.filter((x) => x.rank === 1), rest = S.filter((x) => x.rank > 1);
  return {
    humans: m.humans, hc: m.hc, seats: S.length, games: G.length,
    humanShare: mean(G.map((x) => x.humanShare)), humanShareSE: se(G.map((x) => x.humanShare)),
    aiAlive: mean(G.map((x) => x.aiAlive)), aiFleet: sum(G, (x) => x.fleetSum) / Math.max(1, sum(G, (x) => x.fleetN)),
    // 人間の席の星系の数 ÷ 国家選択で始まった AI の国の星系の数 (試合ごとの比の平均。記録のある試合だけ)
    vsFounder: (() => { const r = G.filter((x) => x.founderSys > 0).map((x) => x.humanSys / x.founderSys); return r.length ? { mean: mean(r), se: se(r), n: r.length } : null; })(),
    alive: S.length ? S.filter((x) => x.alive).length / S.length : null,
    declOwn: per(sum(S, (x) => x.decl.own || 0), S.length), declGov: per(sum(S, (x) => x.decl.gov || 0), S.length), declAlly: per(sum(S, (x) => (x.decl.ally || 0) + (x.decl.other || 0)), S.length),
    offer: per(sum(S, (x) => x.offer), S.length), ally: per(sum(S, (x) => x.ally), S.length), rescue: per(sum(S, (x) => x.rescue), S.length),
    gift: per(sum(S, (x) => x.gift), S.length), lobby: per(sum(S, (x) => x.lobby), S.length), undermine: per(sum(S, (x) => x.undermine), S.length),
    // 終わりの年に人間の中で 1 位だった席とほかの席の、AI の国からの肩入れと敵対 (席あたり)
    topSup: top.length ? sum(top, sup) / top.length : null, restSup: rest.length ? sum(rest, sup) / rest.length : null,
    topHost: top.length ? sum(top, host) / top.length : null, restHost: rest.length ? sum(rest, host) / rest.length : null,
    restAlive: rest.length ? rest.filter((x) => x.alive).length / rest.length : null,
    // 50 年ごとの人間の中の先頭が、次の 50 年に受けた数 ÷ ほかの人間の平均
    leadHost: m.lead.hostO ? m.lead.hostL / m.lead.hostO : null, leadSup: m.lead.supO ? m.lead.supL / m.lead.supO : null, leadN: m.lead.n,
  };
}
function multiTable(u) {
  if (!u) return [];
  const f = (v, d = 2) => (v === null || v === undefined ? '—' : v.toFixed(d)), pc = (v) => (v === null ? '—' : `${(100 * v).toFixed(1)}%`);
  return ['', `### マルチの点検 (回 AI5。人間の席 ${u.humans}・難易度 ${u.hc}・${u.games} 試合・人間の席 ${u.seats})`, '',
    '| 数 | 値 |', '|---|---|',
    `| 人間の国の入植星系の割合 (人間の席の合計。± 標準誤差) | ${pc(u.humanShare)} (± ${u.humanShareSE === null ? '—' : (100 * u.humanShareSE).toFixed(1)}) |`,
    `| 終わりの年の AI の国の数・AI の国の艦隊 (国あたり、毎年の平均) | ${f(u.aiAlive, 1)}・${f(u.aiFleet, 1)} |`,
    `| 人間の席の星系 ÷ 国家選択で始まった AI の国の星系 (試合ごとの比の平均。± 標準誤差) | ${u.vsFounder ? `${f(u.vsFounder.mean)} (± ${f(u.vsFounder.se)}。${u.vsFounder.n} 試合)` : '—'} |`,
    `| 終わりの年に生き残った人間の席 (1 位でない席) | ${pc(u.alive)} (${pc(u.restAlive)}) |`,
    `| AI の国から受けた宣戦 (席・100 年。自分の判断・総督・同盟の参戦ほか) | ${f(u.declOwn)}・${f(u.declGov)}・${f(u.declAlly)} |`,
    `| AI の国からの協定の申し入れ・防衛同盟・救援・贈り物 (席・100 年) | ${f(u.offer)}・${f(u.ally)}・${f(u.rescue)}・${f(u.gift)} |`,
    `| AI の国からの派閥への資金・揺さぶり (席・100 年) | ${f(u.lobby)}・${f(u.undermine)} |`,
    `| 人間の中の先頭が受けた敵対・肩入れ ÷ ほかの人間 (50 年ごと ${u.leadN} 回) | ${f(u.leadHost)}・${f(u.leadSup)} |`,
    `| 終わりの 1 位の席が受けた肩入れ・敵対 (席あたり) と、ほかの席 | ${f(u.topSup, 1)}・${f(u.topHost, 1)} / ${f(u.restSup, 1)}・${f(u.restHost, 1)} |`];
}
// 国どうしの威圧の行 (回 AI7)
function coerceTable(s) {
  const c = s.coerce || {}, sum = (k) => Object.values(c).reduce((a, x) => a + (x[k] || 0), 0), pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}% (${a} / ${b})` : '—');
  if (!sum('sent')) return [];
  const ans = sum('ok') + sum('no'), py = s.pairYears || { aiHuman: 0, aiAi: 0 }, per = (d, n) => (n ? (100 * (c[d]?.sent || 0)) / n : null), ah = per('A>H', py.aiHuman), aa = per('A>A', py.aiAi);
  return [
    `| 威圧が飲まれた割合 (AI7。的は約 30%: Sechser・Fuhrmann 2017) | ${pct(sum('ok'), ans)} | — |`,
    `| 断られた威圧のうち脅しを実行した (宣戦した) 割合 | ${pct(sum('follow'), sum('follow') + sum('back'))} | — |`,
    `| 威圧の数 (銀河・100 年)・1 件の点の平均 | ${(100 * sum('sent') / Math.max(1, s.galaxies) / Number(yS)).toFixed(2)}・${(sum('pts') / sum('sent')).toFixed(1)} | — |`,
    `| 人間に向けた AI の威圧 (AI → 人間 ÷ AI → AI。組・100 年あたり) | ${ah !== null && aa ? `${(ah / aa).toFixed(2)} (${ah.toFixed(3)} ÷ ${aa.toFixed(3)})` : '—'} | — |`,
    `| 向きごと (送った・飲まれた・断られた・実行・引き下がり) | ${Object.entries(c).sort().map(([d, x]) => `${d} ${x.sent}・${x.ok}・${x.no}・${x.follow}・${x.back}`).join(' / ')} | — |`,
  ];
}
function table(s) {
  const f = (v, d = 2) => (v === null || v === undefined ? '—' : v.toFixed(d));
  const ok = (v, lo, hi) => (v === null ? '' : v >= lo && (hi === null || v <= hi) ? ' 合格' : ' 外');
  const decl = Object.entries(s.decl).sort().map(([k, v]) => `${k} ${v}`).join('・');
  return [
    `### AI の国の振る舞い (画面なしの版。${s.galaxies} 銀河 × ${yS} 年 × ${natS} か国、観戦)`, '',
    '| 物差し | 値 | 合格の幅 |', '|---|---|---|',
    `| F28 人間に向けた AI の宣戦 (AI → 人間 ÷ AI → AI。組・100 年あたりの自分の判断の宣戦) | ${f(s.f28)} (${f(s.rateAH, 3)} ÷ ${f(s.rateAA, 3)})${ok(s.f28, 0.5, 2)} | 0.5〜2 |`,
    `| F29 先頭への重り (先頭が受けた宣戦と先頭に向けた防衛同盟 ÷ ほかの国の平均) | ${f(s.f29)}${ok(s.f29, 1.25, null)} | 1.25 以上 |`,
    `| R90 国が新しく結ぶ協定の数 (国・100 年。${s.nations} か国の中央値) | ${f(s.r90)}${ok(s.r90, 6.13, 15.79)} | 6.13〜15.79 |`,
    `| R91 共通の脅威に向けた防衛同盟 (${s.allyThreat} / ${s.ally}。うち便乗 ${s.allyBandwagon}) | ${s.r91 === null ? '—' : `${(100 * s.r91).toFixed(1)}%`}${ok(s.r91, 0.1571, 0.7386)} | 15.7〜73.9% |`,
    `| R92 破られる協定 (${s.pactEnd.breach} / ${s.pactEnd.breach + s.pactEnd.other}) | ${s.r92 === null ? '—' : `${(100 * s.r92).toFixed(1)}%`}${ok(s.r92, 0.2308, 0.51)} | 23.1〜51.0% |`,
    `| R93 指導者の不規則な退き方 (${s.leaderNations} か国の中央値) | ${s.r93 === null ? '—' : `${(100 * s.r93).toFixed(1)}%`}${ok(s.r93, 0.0333, 0.3725)} | 3.3〜37.3% |`,
    `| R94 指導者の在任期間 (年。同じ国の中央値) | ${f(s.r94)}${ok(s.r94, 1.49, 3.94)} | 1.49〜3.94 |`,
    `| 防衛同盟の参戦に応じた割合 (AI の国。Leeds ほか 2000 の 74.5% に較正) | ${s.honor.join + s.honor.refuse ? `${(100 * s.honor.join / (s.honor.join + s.honor.refuse)).toFixed(1)}% (${s.honor.join} / ${s.honor.join + s.honor.refuse})` : '—'} | — |`,
    ...coerceTable(s),
    '', `宣戦の向きと道 (A = AI の国・H = 人間の国。own = 自分の判断・ally = 同盟の参戦・indep = 独立・strike = 一撃・human = 人間の席・gov = 遠い総督の独断): ${decl}`,
    ...(s.inner ? ['', (() => { const gw = (s.decl['A>A|gov'] || 0) + (s.decl['A>H|gov'] || 0), ow = (s.decl['A>A|own'] || 0) + (s.decl['A>H|own'] || 0), i = s.inner; return `中の事情 (回 AI4): 遠い総督の独断 ${gw} (自分の判断の宣戦との合計の ${ow + gw ? (100 * gw / (ow + gw)).toFixed(1) : '—'}%)・首都の追認 ${i.endorse}・否認 ${i.disavow}・AI の国の揺さぶり ${i.undermine}・派閥への資金 ${i.lobby || 0}・主人の側への支え ${i.back} (銀河・100 年あたり ${(100 * (i.undermine + i.back + (i.lobby || 0)) / Math.max(1, s.galaxies * Number(yS))).toFixed(1)})`; })(),
      (() => { const i = s.inner, f = (i.trade || 0) + (i.thank || 0) + (i.grudge || 0) + (i.fund || 0); return `派閥 (回 AI4。Victoria 3 の形): できた数 ${f} (交易 ${i.trade || 0}・恩 ${i.thank || 0}・恨み ${i.grudge || 0}・外からの資金 ${i.fund || 0}。銀河・100 年あたり ${(100 * f / Math.max(1, s.galaxies * Number(yS))).toFixed(1)})・いまある派閥 銀河・年あたり ${((i.lobYears || 0) / Math.max(1, s.galaxies * Number(yS))).toFixed(1)}・重みの平均 ${i.lobYears ? (100 * i.lobW / i.lobYears).toFixed(0) : '—'}%`; })()] : []),
    ...multiTable(s.multi),
  ].join('\n');
}
if (mergeS) {
  const s = summarize(merge(mergeS.split(',').map((p) => JSON.parse(fs.readFileSync(p, 'utf8')))));
  console.log(table(s));
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(s));
} else {
  const raw = count(src || 'src/index.html');
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(raw));
  console.log(table(summarize(raw)));
}
