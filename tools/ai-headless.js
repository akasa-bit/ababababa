// AI の国の振る舞いの自動対戦 (画面なしの版。回 AI2・B-301): 国家選択のある試合を観戦で回し、宣戦の向きと道・協定・先頭への重りを数える。
// 物差しは docs/fun.md の 13 と targets/targets.json の R90・R91・F28・F29:
//   F28 = 組 (AI の国 → 人間の国) あたり 100 年の、AI の国が自分の判断で始めた宣戦の数 ÷ 組 (AI の国 → AI の国) あたりの数 (0.5〜2 倍)
//   F29 = 50 年ごとに点数が先頭の国が、次の 50 年に受けた宣戦と先頭に向けた防衛同盟 (結んだとき受け手の判断に先頭が脅威として入っていたもの) の数 ÷ ほかの国の平均 (1.25 倍以上)
//         点数は画面の点数の大きな 2 項 (星系 ×10 + 人口 200 百万人ごとに 1)。席のない国 (独立した国) も同じ式で比べるため
//   R90 = 国ごとの、結んだ不可侵と防衛同盟の協定の数 ÷ 国である年数 × 100 (20 年以上続いた国) の中央値 (6.13〜15.79)
//   R91 = 防衛同盟のうち、結んだとき受け手の判断に共通の脅威が入っていたもの (協定の th) の割合 (15.7〜73.9%)
// 宣戦の道: own = AI の国が自分の判断で (realmsYearly の宣戦)・ally = 同盟の参戦 (diplomacyYearly)・indep = 独立・strike = 光速の一撃・human = 人間の席 (観戦の AI) の宣戦
// 使い方: node tools/ai-headless.js <src/index.html> [銀河の数] [年数] [国の数]
//   --seeds a-b = 銀河 a〜b だけを回す・--json p.json = 数えた生の値を書く・--merge p1.json,p2.json,… = 分けて回した結果をまとめて表にする
const fs = require('fs');
const H = require('./headless');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const seedsS = opt('--seeds'), jsonOut = opt('--json'), mergeS = opt('--merge');
const [src, nS = '8', yS = '300', natS = '6'] = argv;
const seedList = () => { if (seedsS) { const [lo, hi] = seedsS.split('-').map(Number); return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i); } return Array.from({ length: Number(nS) }, (_, i) => i + 1); };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

function count(file) {
  const sim = H.load({ src: file });
  const out = { galaxies: 0, years: Number(yS), decl: {}, pairYears: { aiHuman: 0, aiAi: 0 }, pactsPerNation: [], ally: 0, allyThreat: 0, allyBandwagon: 0, lead: { leader: 0, others: 0, n: 0 } };
  for (const seed of seedList()) {
    const g = sim.newGame(String(seed), { nations: Number(natS) });
    out.galaxies++;
    const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = (...a) => fn(orig, ...a); };
    const path = [];
    const within = (name, tag) => wrap(name, (orig, ...a) => { path.push(tag); try { return orig(...a); } finally { path.pop(); } });
    within('realmsYearly', 'own'); within('diplomacyYearly', 'ally'); within('declareIndependence', 'indep'); within('aiStrike', 'strike');
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
      return r;
    });
    wrap('makePact', (orig, a, b, kind, gift) => {
      const p = orig(a, b, kind, gift);
      if (kind === 'nap' || kind === 'ally') { nation(a).pacts++; nation(b).pacts++; }
      if (kind === 'ally') { out.ally++; if (p.th !== undefined && p.th !== null) out.allyThreat++; if (p.mode === 'bandwagon') out.allyBandwagon++; if (p.th !== undefined && p.th !== null) recvd(p.th); }
      return p;
    });
    const Y = Number(yS);
    for (let y = 0; y < Y; y++) {
      const rs = alive();
      for (const r of rs) nation(r).to = g.year + 1;
      const ai = rs.filter((r) => !g.isHuman(r)).length, hu = rs.length - ai;
      out.pairYears.aiHuman += ai * hu; out.pairYears.aiAi += ai * (ai - 1);
      if (y % 50 === 0 && y + 50 <= Y) {
        const score = (r) => 10 * g.realmSystems(r).length + g.realmPop(r) / 200;
        const leader = [...rs].sort((a, b) => score(b) - score(a))[0];
        if (leader !== undefined && rs.length > 1) window.push({ from: g.year, leader, alive: new Set(rs), got: new Map() });
      }
      sim.run(g, 1);
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
  const o = { galaxies: 0, years: list[0].years, decl: {}, pairYears: { aiHuman: 0, aiAi: 0 }, pactsPerNation: [], ally: 0, allyThreat: 0, allyBandwagon: 0, lead: { leader: 0, others: 0, n: 0 } };
  for (const x of list) {
    o.galaxies += x.galaxies;
    for (const [k, v] of Object.entries(x.decl)) o.decl[k] = (o.decl[k] || 0) + v;
    o.pairYears.aiHuman += x.pairYears.aiHuman; o.pairYears.aiAi += x.pairYears.aiAi;
    o.pactsPerNation.push(...x.pactsPerNation);
    o.ally += x.ally; o.allyThreat += x.allyThreat; o.allyBandwagon += x.allyBandwagon;
    o.lead.leader += x.lead.leader; o.lead.others += x.lead.others; o.lead.n += x.lead.n;
  }
  return o;
}
function summarize(o) {
  const own = (d) => o.decl[`${d}|own`] || 0;
  const rateAH = (100 * own('A>H')) / Math.max(1, o.pairYears.aiHuman), rateAA = (100 * own('A>A')) / Math.max(1, o.pairYears.aiAi);
  const f28 = rateAA ? rateAH / rateAA : null;
  const f29 = o.lead.others ? o.lead.leader / o.lead.others : null;
  const r90 = median(o.pactsPerNation), r91 = o.ally ? o.allyThreat / o.ally : null;
  return { f28, rateAH, rateAA, f29, r90, r91, ally: o.ally, allyThreat: o.allyThreat, allyBandwagon: o.allyBandwagon, nations: o.pactsPerNation.length, decl: o.decl, galaxies: o.galaxies };
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
    '', `宣戦の向きと道 (A = AI の国・H = 人間の国。own = 自分の判断・ally = 同盟の参戦・indep = 独立・strike = 一撃・human = 人間の席): ${decl}`,
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
