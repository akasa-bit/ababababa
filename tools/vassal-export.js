// 従属関係の記録の書き出しと、型だけを変えて比べる実験 (レーン H・セッション H4-2。docs/vassal-export.md)。
// 画面なしの版で銀河を回し、2 つの表を書き出す (ユーザーの決定: 結びつきの表と、星系 × 年のパネルの両方。docs/vassal-decisions.md の 4)。
//   ties.csv  … 1 行 = 1 つの主従の結びつき (ICOW の植民地の歴史と同じく、始まり・終わり・終わり方・独立が戦争になったか)。
//              束 (法と実態) と型も持つので、歴史の事例 (data/raw/vassal/) と同じ統計 (Kaplan–Meier・Cox) がそのまま回せる
//   panel.csv … 1 行 = 1 つの家臣の星系の 1 年 (--every 年ごと)。型・束・現地のエリート・忠誠度・離反のハザード・朝貢の割合
// ゲームの中身は変えない (独立の関数を道具の側で包んで記録するだけ)。
// 比べる実験: --force <型> で、AI の国の新しい家臣の型をすべてその型にする (同じ銀河・同じシードで、型だけが違う)。
//   例: node tools/vassal-export.js out/T04 30 300 6 --force T04 と node tools/vassal-export.js out/T03 30 300 6 --force T03 を比べる
// 使い方: node tools/vassal-export.js <出力のフォルダ> [銀河の数] [年数] [国の数] [--force <型>] [--every <年>] [--from <最初のシード>]
const fs = require('fs');
const path = require('path');
const H = require('./headless');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const force = opt('--force', null);
const every = Number(opt('--every', '5'));
const from = Number(opt('--from', '1'));
const [outDir = 'vassal-out', nS = '30', yS = '300', natS = '6'] = args;
const sim = H.load({ ...(process.env.HTML ? { src: process.env.HTML } : {}) });
const { BUNDLE_ITEMS, VASSAL_DATA } = sim.tables;
const typeId = (r) => (r === 'direct' || r === 'encomienda' ? 'T20' : VASSAL_DATA.types[r] ? r : null); // ゲームの統治体制の名前 → 型の番号
const tributeOf = (r) => (r === 'encomienda' ? 0.4 : typeId(r) ? VASSAL_DATA.types[typeId(r)].tribute : '');
if (force && (!typeId(force) || force === 'T20')) { console.error(`不明な型: ${force} (T01〜T19・direct・encomienda。植民地は direct)`); process.exit(1); }
const family = (r) => (typeId(r) ? VASSAL_DATA.types[typeId(r)].family : '');
const gapOf = (b) => [...b.law].reduce((k, c, i) => k + (c !== b.fact[i] ? 1 : 0), 0);
const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => { const v = r[c]; if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','))].join('\n') + '\n';

const TIE_COLS = ['seed', 'tie', 'vassal', 'vassal_name', 'lord', 'realm', 'human', 'start', 'end', 'duration', 'how', 'war', 'war_p', 'type0', 'family0', 'law0', 'fact0', 'gap0', 'type_end', 'law_end', 'fact_end', 'gap_mean', 'elite_end', 'loyalty_end', 'dist_lord_ly', 'dist_cap_ly'];
const PANEL_COLS = ['seed', 'year', 'vassal', 'lord', 'realm', 'type', 'family', 'law', 'fact', 'gap', 'elite', 'loyalty', 'hazard', 'tribute', 'lord2', 'arrears'];

fs.mkdirSync(outDir, { recursive: true });
const ties = [], panel = [];
let tieNo = 0;
for (let s = from; s < from + Number(nS); s++) {
  const seed = String(s);
  const g = sim.newGame(seed, { nations: Number(natS) });
  if (force) { const orig = g.defaultRegime.bind(g); g.defaultRegime = (root, sysId = null) => (g.isHuman(root) ? orig(root, sysId) : force); }
  const open = new Map();
  const snap = (id, gv) => { const b = g.bundleOf(gv); return { type: g.regimeOf(gv), law: b.law, fact: b.fact, gap: gapOf(b), elite: gv.elite || 'bargain', loyalty: Math.round(gv.loyalty ?? 70) }; };
  const close = (id, how, extra = {}) => {
    const t = open.get(id); if (!t) return;
    open.delete(id);
    const gv = g.govs[id];
    const e = t.last;
    ties.push({ seed, tie: ++tieNo, vassal: id, vassal_name: g.system(id).name, lord: t.lord, realm: t.realm, human: t.human ? 1 : 0, start: Math.round(t.start), end: how === 'censored' ? '' : Math.round(g.year), duration: +(g.year - t.start).toFixed(2), how,
      war: extra.war === undefined ? '' : extra.war ? 1 : 0, war_p: extra.p ?? '', type0: t.s0.type, family0: family(t.s0.type), law0: t.s0.law, fact0: t.s0.fact, gap0: t.s0.gap,
      type_end: e.type, law_end: e.law, fact_end: e.fact, gap_mean: +(t.gapSum / Math.max(1, t.gapN)).toFixed(3), elite_end: e.elite, loyalty_end: e.loyalty, dist_lord_ly: +t.dLord.toFixed(2), dist_cap_ly: +t.dCap.toFixed(2) });
    void gv;
  };
  const orig = g.declareIndependence.bind(g);
  g.declareIndependence = function (id) { const r = orig(id); const li = g.lastIndependence; close(id, 'independence', li?.id === id ? { war: li.war, p: li.p } : {}); return r; };
  for (let y = 0; y < Number(yS); y++) {
    sim.run(g, 1);
    for (const [k, gv] of Object.entries(g.govs)) {
      const id = Number(k);
      const t = open.get(id);
      const vassal = gv.lord !== null && gv.lord !== undefined && g.isColonized(id);
      if (!vassal) { if (t) close(id, g.isColonized(id) ? 'other' : 'abandoned'); continue; }
      const realm = g.realmOf(id);
      if (t && (t.lord !== gv.lord || t.realm !== realm)) close(id, 'transfer');
      const sn = snap(id, gv);
      if (!open.has(id)) open.set(id, { lord: gv.lord, realm, human: g.isHuman(realm), start: g.year, s0: sn, gapSum: 0, gapN: 0, dLord: g.sysDist(id, gv.lord), dCap: g.sysDist(id, realm) });
      const r = open.get(id);
      r.last = sn; r.gapSum += sn.gap; r.gapN++;
      if (y % every === 0) {
        const terms = g.secessionTerms(id);
        const h = terms ? terms.reduce((k, x) => k * x.f, 1) : 0;
        panel.push({ seed, year: Math.round(g.year), vassal: id, lord: gv.lord, realm, type: sn.type, family: family(sn.type), law: sn.law, fact: sn.fact, gap: sn.gap, elite: sn.elite, loyalty: sn.loyalty,
          hazard: +(1 - Math.exp(-h)).toFixed(5), tribute: tributeOf(sn.type), lord2: gv.lord2 ?? '', arrears: gv.arrears ? +gv.arrears.toFixed(2) : '' });
      }
    }
  }
  for (const id of [...open.keys()]) close(id, 'censored');
  process.stderr.write(`${seed}: 結びつき ${ties.filter((t) => t.seed === seed).length}\n`);
}
fs.writeFileSync(path.join(outDir, 'ties.csv'), csv(ties, TIE_COLS));
fs.writeFileSync(path.join(outDir, 'panel.csv'), csv(panel, PANEL_COLS));
// 要約: Kaplan–Meier の存続の中央値 (どの終わり方でも。続いているものは打ち切り)、100 結びつき年あたりの独立、法と実態の差の平均、独立のうち戦争の割合 (人間の国から) と型の戦争の確率の平均
function km(ts) {
  const ev = ts.map((t) => ({ d: t.duration, e: t.how !== 'censored' })).sort((a, b) => a.d - b.d);
  let S = 1, n = ev.length;
  for (const x of ev) { if (x.e) { S *= 1 - 1 / n; if (S <= 0.5) return +x.d.toFixed(1); } n--; }
  return null;
}
const sum = (ts) => { const yrs = ts.reduce((k, t) => k + t.duration, 0); const ind = ts.filter((t) => t.how === 'independence'); const wp = ind.filter((t) => t.war_p !== ''); return { ties: ts.length, median: km(ts), indepPer100: yrs ? +(100 * ind.length / yrs).toFixed(3) : 0, gapMean: ts.length ? +(ts.reduce((k, t) => k + t.gap_mean, 0) / ts.length).toFixed(2) : null, warP: wp.length ? +(wp.reduce((k, t) => k + Number(t.war_p), 0) / wp.length).toFixed(3) : null }; };
const summary = { all: sum(ties), byFamily: Object.fromEntries([...new Set(ties.map((t) => t.family0))].sort().map((f) => [f, sum(ties.filter((t) => t.family0 === f))])) };
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ seeds: [from, from + Number(nS) - 1], years: Number(yS), nations: Number(natS), force, every, ties: ties.length, panelRows: panel.length, items: BUNDLE_ITEMS, codebook: 'docs/vassal-export.md', summary }, null, 1));
console.log(JSON.stringify({ outDir, force, panelRows: panel.length, ...summary.all }));
