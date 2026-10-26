// コンテンツ (資源・施設・種族の特性・出来事・挑戦・国家方針・委任方針・総督の方針・帳簿・協定・難易度・国の名前 など) の一覧と点検。
// コンテンツを足す・直すときの決まり (どこに・どんな形で・ほかに何をそろえるか) は docs/content.md。この道具は、その決まりをいまのソースで確かめる。
// 使い方:
//   node tools/content.js            → 一覧 (Markdown。種類ごとの表の場所・数・中身)
//   node tools/content.js --check    → 点検だけ (足りない名前・アイコン・形の誤り。出来事は実際に起こして、どの選択肢を選んでも壊れないか)。問題があれば終了コード 1
//   node tools/content.js --check --quick → 出来事を起こす点検を省く (速い)
// 点検は画面なしの版 (tools/headless.js) でソースを読み込み、試合を作って確かめる。ゲームの中身は変えない
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const { assemble } = require('./src');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check'), QUICK = args.includes('--quick');
const sim = H.load({ edition: 'game' });
const ev = (code) => sim.evaluate(code);
const T = new Proxy({}, { get: (_, k) => ev(`typeof ${String(k)} === 'undefined' ? undefined : ${String(k)}`) }); // ソースの最上位の名前 (表・関数)

// 名前 → それを宣言しているファイル (src/ からのパス)
const where = (() => {
  const m = new Map();
  for (const l of fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8').split('\n')) {
    const f = l.match(/^\/\/#include (\S+)$/)?.[1];
    if (!f) continue;
    for (const d of fs.readFileSync(path.join(ROOT, 'src', f), 'utf8').matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)) if (!m.has(d[1])) m.set(d[1], f);
  }
  return (name) => m.get(name) || '?';
})();

const problems = [], notes = [];
// 分かっている例外 (直すにはユーザーが選ぶことがあるもの)。落とさずに、理由を添えて出す
const KNOWN = {
  'icon:hitech': '高付加価値物品 (hitech) のアイコンはまだない (アイコンは候補を見せてユーザーに番号で選んでもらう。docs/parallel.md の 7。ないあいだは名前だけ出る)',
};
const bad = (kind, text, known) => { if (known && KNOWN[known]) notes.push(`${kind}: ${KNOWN[known]}`); else problems.push(`${kind}: ${text}`); };
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isIcon = (v) => Array.isArray(v) && isStr(v[0]) && isStr(v[1]); // ICONS の 1 つ: [viewBox, SVG の中身]
const sameKeys = (kind, a, an, b, bn) => {
  for (const k of Object.keys(a)) if (!(k in b)) bad(kind, `${an} の「${k}」が ${bn} にない`);
  for (const k of Object.keys(b)) if (!(k in a)) bad(kind, `${bn} の「${k}」が ${an} にない`);
};

// --- 種類ごとの点検 (docs/content.md の決まり) ---
const KINDS = [
  {
    name: '資源', tables: ['RES', 'RES_LABEL', 'PRICE', 'RES_KG', 'ICONS', 'MARKET'],
    list: () => T.RES.map((r) => `${r} (${T.RES_LABEL[r]})`),
    check() {
      const { RES, RES_LABEL, PRICE, RES_KG, ICONS, MARKET, MINED, RES_INDEX } = { RES: T.RES, RES_LABEL: T.RES_LABEL, PRICE: T.PRICE, RES_KG: T.RES_KG, ICONS: T.ICONS, MARKET: T.MARKET, MINED: T.MINED, RES_INDEX: T.RES_INDEX };
      if (new Set(RES).size !== RES.length) bad('資源', 'RES に同じ名前が 2 回ある');
      RES.forEach((r, i) => {
        if (!isStr(RES_LABEL[r])) bad('資源', `「${r}」の名前 (RES_LABEL) がない`);
        if (!(isNum(PRICE[r]) && PRICE[r] > 0)) bad('資源', `「${r}」の基準の値段 (PRICE) がない`);
        if (!(isNum(RES_KG[r]) && RES_KG[r] > 0)) bad('資源', `「${r}」の 1 単位の質量 (RES_KG。ship/physics.js) がない`);
        if (!isIcon(ICONS[r])) bad('資源', `「${r}」のアイコン (ICONS。screen/icons.js) がない`, `icon:${r}`);
        if (!isNum(MARKET.cover[r])) bad('資源', `「${r}」の在庫の厚さ (MARKET.cover。economy/market-consts.js) がない`);
        if (RES_INDEX && RES_INDEX[r] !== i) bad('資源', `「${r}」の番号 (RES_INDEX) が並びと違う`);
      });
      for (const r of MINED) if (!RES.includes(r)) bad('資源', `掘る資源 (MINED) の「${r}」が RES にない`);
    },
  },
  {
    name: '施設', tables: ['FACILITY', 'FACILITY_MAX', 'LV0', 'ICONS'],
    list: () => Object.entries(T.FACILITY).map(([k, v]) => `${k} (${v}・最大 Lv${T.FACILITY_MAX[k]})`),
    check() {
      const F = T.FACILITY, MAX = T.FACILITY_MAX, lv0 = ev('LV0()'), ICONS = T.ICONS;
      sameKeys('施設', F, 'FACILITY', MAX, 'FACILITY_MAX');
      sameKeys('施設', F, 'FACILITY', lv0, 'LV0');
      for (const [k, v] of Object.entries(F)) {
        if (!isStr(v)) bad('施設', `「${k}」の名前がない`);
        if (!(Number.isInteger(MAX[k]) && MAX[k] >= 1)) bad('施設', `「${k}」の最大の段 (FACILITY_MAX) は 1 以上の整数`);
        if (lv0[k] !== 0) bad('施設', `「${k}」の始めの段 (LV0) は 0`);
        if (!isIcon(ICONS[k])) bad('施設', `「${k}」のアイコン (ICONS) がない`);
      }
    },
  },
  {
    name: '種族の特性', tables: ['SPECIES_TRAITS', 'HUMAN_TRAITS', 'TRAIT_CLASH', 'traitMods'],
    list: () => Object.entries(T.SPECIES_TRAITS).map(([k, v]) => `${k} (${v.label}: ${v.desc})`),
    check() {
      const S = T.SPECIES_TRAITS, surf = T.SURFACE_LABEL;
      // traitMods が読む値。ほかの名前を書いても効かないので、足すときは traitMods にも足す (docs/content.md)
      const EFFECT = ['growth', 'cap', 'fleet', 'ind', 'mine', 'trade', 'pc', 'capBy'];
      for (const [k, t] of Object.entries(S)) {
        if (!isStr(t.label) || !isStr(t.desc)) bad('種族の特性', `「${k}」の label と desc (画面に出す名前と説明) がない`);
        for (const [f, v] of Object.entries(t)) {
          if (f === 'label' || f === 'desc') continue;
          if (!EFFECT.includes(f)) { bad('種族の特性', `「${k}」の「${f}」は効き目の名前にない (traitMods が読むのは ${EFFECT.join('・')})`); continue; }
          if (f === 'capBy') { for (const [s, x] of Object.entries(v)) { if (!(s in surf)) bad('種族の特性', `「${k}」の capBy の「${s}」は地表 (SURFACE_LABEL) にない`); if (!isNum(x)) bad('種族の特性', `「${k}」の capBy.${s} は数`); } }
          else if (!isNum(v)) bad('種族の特性', `「${k}」の ${f} は数`);
        }
        const m = ev(`traitMods(${JSON.stringify([k])})`);
        if (!m || Object.values(m).some((x) => typeof x === 'number' && !Number.isFinite(x))) bad('種族の特性', `「${k}」の倍率 (traitMods) が数にならない`);
      }
      for (const k of T.HUMAN_TRAITS) if (!(k in S)) bad('種族の特性', `人類の特性 (HUMAN_TRAITS) の「${k}」がない`);
      for (const g of T.TRAIT_CLASH) for (const k of g) if (!(k in S)) bad('種族の特性', `食い違う特性 (TRAIT_CLASH) の「${k}」がない`);
    },
  },
  {
    name: '挑戦', tables: ['CHALLENGES'],
    list: () => Object.entries(T.CHALLENGES).map(([k, v]) => `${k} (${v.label})`),
    check() { for (const [k, v] of Object.entries(T.CHALLENGES)) if (!isStr(v.label) || !isStr(v.desc)) bad('挑戦', `「${k}」の label と desc がない`); },
  },
  {
    name: '国家方針', tables: ['POLICIES', 'POLICY_LOYALTY'],
    list: () => Object.entries(T.POLICIES).map(([k, v]) => `${k} (${v.label})`),
    check() {
      for (const [k, v] of Object.entries(T.POLICIES)) if (!isStr(v.label) || !isStr(v.good) || !isStr(v.bad)) bad('国家方針', `「${k}」の label・good・bad (名前・効果・代わりに) がない`);
      sameKeys('国家方針', T.POLICIES, 'POLICIES', T.POLICY_LOYALTY, 'POLICY_LOYALTY');
    },
  },
  {
    name: '委任方針', tables: ['MANDATES', 'MANDATE_NOTE', 'MANDATE_WHY'],
    list: () => Object.entries(T.MANDATES).map(([k, v]) => `${k} (${v})`),
    check() { sameKeys('委任方針', T.MANDATES, 'MANDATES', T.MANDATE_NOTE, 'MANDATE_NOTE'); for (const k of Object.keys(T.MANDATES)) if (!isStr(T.MANDATE_WHY[k])) bad('委任方針', `「${k}」の報告の文 (MANDATE_WHY。screen/reports.js) がない`); },
  },
  {
    name: '総督の方針', tables: ['GOVERNOR', 'GOVERNOR_NOTE'],
    list: () => Object.entries(T.GOVERNOR).map(([k, v]) => `${k} (${v})`),
    check() { sameKeys('総督の方針', T.GOVERNOR, 'GOVERNOR', T.GOVERNOR_NOTE, 'GOVERNOR_NOTE'); },
  },
  {
    name: '収支の帳簿', tables: ['LEDGER_LABEL', 'LEDGER_ICON', 'E_LABEL'],
    list: () => Object.entries(T.LEDGER_LABEL).map(([k, v]) => `${k} (${v})`),
    check() {
      for (const [k, v] of Object.entries(T.LEDGER_LABEL)) if (!isStr(v)) bad('収支の帳簿', `「${k}」の名前がない`);
      for (const [k, ic] of Object.entries(T.LEDGER_ICON)) { if (!(k in T.LEDGER_LABEL)) bad('収支の帳簿', `LEDGER_ICON の「${k}」が LEDGER_LABEL にない`); if (!isIcon(T.ICONS[ic])) bad('収支の帳簿', `「${k}」のアイコン「${ic}」が ICONS にない`); }
      for (const [k, v] of Object.entries(T.E_LABEL)) if (!isStr(v)) bad('収支の帳簿', `エネルギーの帳簿 (E_LABEL) の「${k}」の名前がない`);
    },
  },
  {
    name: '出来事の種類 (知らせ)', tables: ['EVENT_KIND', 'EVENT_TIER'],
    list: () => Object.entries(T.EVENT_KIND).map(([k, v]) => `${k} (${v})`),
    check() {
      sameKeys('出来事の種類', T.EVENT_KIND, 'EVENT_KIND', T.EVENT_TIER, 'EVENT_TIER');
      for (const [k, v] of Object.entries(T.EVENT_TIER)) if (![1, 2, 3].includes(v)) bad('出来事の種類', `「${k}」の段 (EVENT_TIER) は 1 (細事)・2 (普通)・3 (重大) のどれか`);
      // ソースの中で g.event('種類', …) と書いた種類が、どれも EVENT_KIND にある (ないと知らせの欄で名前が出ない)
      const src = assemble({ file: path.join(ROOT, 'src/index.html') });
      for (const k of new Set([...src.matchAll(/\.event\('([a-z]+)'/g)].map((m) => m[1]))) if (!(k in T.EVENT_KIND)) bad('出来事の種類', `event('${k}', …) の種類「${k}」が EVENT_KIND (screen/events-ui.js) にない`);
    },
  },
  {
    name: '協定', tables: ['PACT_KINDS'],
    list: () => Object.entries(T.PACT_KINDS).map(([k, v]) => `${k} (${v.label})`),
    check() { for (const [k, v] of Object.entries(T.PACT_KINDS)) if (!isStr(v.label) || !isStr(v.note)) bad('協定', `「${k}」の label と note がない`); },
  },
  {
    name: '難易度', tables: ['HANDICAP'],
    list: () => Object.entries(T.HANDICAP).map(([k, v]) => `${k} (${v.label})`),
    check() {
      for (const [k, v] of Object.entries(T.HANDICAP)) {
        if (!isStr(v.label) || !isNum(v.aiIncome) || !isNum(v.aiCost)) bad('難易度', `「${k}」の label・aiIncome・aiCost がない`);
        if (!['full', 'fuzzy', 'hidden'].includes(v.info)) bad('難易度', `「${k}」の info は full・fuzzy・hidden のどれか`);
      }
    },
  },
  {
    name: '国の名前', tables: ['NATION_SUFFIX', 'SECEDE_SUFFIX', 'HOME_ENV', 'HOME_DIST', 'HOME_DIST_RANGE'],
    list: () => [`国号 ${T.NATION_SUFFIX.length} 個・独立国の接尾辞 ${T.SECEDE_SUFFIX.length} 個`],
    check() {
      for (const x of T.NATION_SUFFIX) {
        if (!isStr(x.s) || !(isNum(x.w) && x.w > 0)) bad('国の名前', `国号 (NATION_SUFFIX) の 1 つに s (国号) か w (選ばれやすさ。正の数) がない: ${JSON.stringify(x)}`);
        for (const t of x.t || []) if (!(t in T.SPECIES_TRAITS)) bad('国の名前', `国号「${x.s}」の t の「${t}」が種族の特性 (SPECIES_TRAITS) にない`);
      }
      for (const x of T.SECEDE_SUFFIX) if (!isStr(x)) bad('国の名前', `独立国の接尾辞 (SECEDE_SUFFIX) に空のものがある`);
      sameKeys('国の名前', T.HOME_DIST, 'HOME_DIST', T.HOME_DIST_RANGE, 'HOME_DIST_RANGE');
      for (const k of Object.keys(T.HOME_ENV)) if (k !== 'any' && !(k in T.SURFACE_LABEL)) bad('国の名前', `母星の環境 (HOME_ENV) の「${k}」が地表 (SURFACE_LABEL) にない`);
    },
  },
  {
    name: '語り手の出来事', tables: ['STORY'],
    list: () => Object.entries(T.STORY).map(([k, v]) => `${k}${v.follow ? ' (続きの段)' : ''}`),
    check() {
      const S = T.STORY;
      for (const [k, s] of Object.entries(S)) {
        if (typeof s.start !== 'function' || typeof s.resolve !== 'function') bad('語り手の出来事', `「${k}」に start と resolve がない`);
        if (s.follow ? s.pick : typeof s.pick !== 'function') bad('語り手の出来事', `「${k}」は、頭の出来事なら pick を、続きの段なら follow: true を持つ (片方だけ)`);
        if (s.weigh !== undefined && typeof s.weigh !== 'function') bad('語り手の出来事', `「${k}」の weigh は関数`);
        if (s.next !== undefined && typeof s.next !== 'function') bad('語り手の出来事', `「${k}」の next は関数`);
      }
      if (!QUICK) storyRuns();
    },
  },
];

// 出来事を実際に起こして、どの選択肢を選んでも壊れないか (決めることの形・返事の効果・連作の続き・その後の 1 年) を確かめる
function storyRuns() {
  const S = T.STORY;
  const setSim = ev('(g) => { SIM = g; }'); // 語り手の乱数は、いま動いている試合のもの
  const fresh = (d) => { const g = new sim.Game(sim.generateGalaxy({ seed: String(d.seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: d.gen ?? sim.GALAXY_GEN })); g.restore(JSON.parse(JSON.stringify(d))); setSim(g); return g; };
  // 起こせる星系のある試合を探す (出来事ごとに、いくつかのシードと年で)
  const games = [];
  // プレイヤーの国も AI に任せて (観戦) 広げた試合。国家選択のない試合 (地球だけ) も混ぜる
  for (const [seed, nations, years] of [['7', 6, 25], ['1', 6, 60], ['2', 0, 80], ['3', 6, 150], ['4', 0, 200], ['5', 6, 250], ['6', 0, 40]]) {
    try { games.push(sim.buildSave(sim.run(sim.newGame(seed, { nations }), years))); }
    catch (e) { bad('語り手の出来事', `試合を回している途中で止まった (シード ${seed}・${years} 年。語り手が起こした出来事かもしれない): ${String(e.stack).split('\n').slice(0, 2).join(' ')}`); }
  }
  const reached = new Set();
  const tryOne = (type, d, sys, data, depth, tag) => {
    reached.add(type);
    let g = fresh(d);
    const n0 = g.decisions.length;
    try { S[type].start(g, sys, data); } catch (e) { bad('語り手の出来事', `「${type}」の start が止まった (${tag}): ${e.message}`); return; }
    const decs = g.decisions.slice(n0).filter((x) => x.kind === 'story');
    if (!decs.length) return; // 決めることを出さない出来事 (知らせだけ) もある
    const dec = decs[decs.length - 1];
    const ks = (dec.opts || []).map((o) => o.k);
    if (!ks.length) { bad('語り手の出来事', `「${type}」の決めることに選択肢 (opts) がない`); return; }
    if (new Set(ks).size !== ks.length) bad('語り手の出来事', `「${type}」の選択肢の k が重なっている (${ks.join(',')})`);
    for (const o of dec.opts) if (!isStr(o.label) || !isStr(o.note)) bad('語り手の出来事', `「${type}」の選択肢「${o.k}」の label と note (名前と、代わりの得と損) がない`);
    if (!ks.includes(dec.def)) bad('語り手の出来事', `「${type}」の既定の選択肢 def「${dec.def}」が選択肢にない`);
    const saved = sim.buildSave(g);
    for (const k of ks) {
      g = fresh(saved);
      const dd = g.decisions.find((x) => x.id === dec.id);
      try {
        const q0 = g.story?.queue?.length || 0;
        for (const local of [false]) g.resolveDecision(dd.id, k, local);
        const q = (g.story?.queue || []).slice(q0);
        for (const n of q) {
          if (!S[n.type]) bad('語り手の出来事', `「${type}」の next が、ない種類「${n.type}」を返した`);
          else if (!S[n.type].follow) bad('語り手の出来事', `「${type}」の next の「${n.type}」は続きの段 (follow: true) にする`);
          else if (depth < 4) tryOne(n.type, sim.buildSave(g), n.sys, n.data, depth + 1, `${tag} → ${type}:${k}`);
        }
        sim.run(g, 1); // 返事の効果のあと、試合が 1 年進む
      } catch (e) { bad('語り手の出来事', `「${type}」で「${k}」を選ぶと止まった (${tag}): ${e.message}`); }
    }
  };
  for (const [type, s] of Object.entries(S)) {
    if (!s.pick) continue;
    for (const d of games) {
      const g = fresh(d);
      let sys = null;
      try { sys = s.pick(g); } catch (e) { bad('語り手の出来事', `「${type}」の pick が止まった: ${e.message}`); break; }
      if (sys === null || sys === undefined) continue;
      tryOne(type, d, sys, undefined, 0, `シード ${d.seed}・${Math.round(d.year)} 年`);
      break;
    }
  }
  storyRuns.unreached = Object.keys(S).filter((k) => !reached.has(k));
}

for (const k of KINDS) {
  try { k.check(); } catch (e) { bad(k.name, `点検の途中で止まった: ${e.stack.split('\n').slice(0, 2).join(' ')}`); }
}

if (!CHECK) {
  console.log('# コンテンツの一覧\n');
  console.log('足し方・直し方の決まりは docs/content.md。`node tools/content.js --check` で点検する。\n');
  console.log('| 種類 | 表 (ファイル) | 数 | 中身 |');
  console.log('|---|---|---|---|');
  for (const k of KINDS) {
    const items = k.list();
    const tables = k.tables.map((t) => `\`${t}\` (${where(t)})`).join('<br>');
    console.log(`| ${k.name} | ${tables} | ${items.length} | ${items.join('・')} |`);
  }
  console.log('');
}
const unreached = storyRuns.unreached || [];
console.log(`コンテンツの点検 ${problems.length ? '不合格' : '合格'} (${KINDS.length} 種類${QUICK || !CHECK && !unreached.length ? '' : `・起こして確かめた出来事 ${Object.keys(T.STORY).length - unreached.length}/${Object.keys(T.STORY).length}`})`);
for (const p of problems) console.log(`  × ${p}`);
for (const n of notes) console.log(`  (分かっている例外) ${n}`);
if (unreached.length) console.log(`  (起こせる状態を見つけられず、確かめていない出来事: ${unreached.join('・')})`);
process.exit(problems.length ? 1 : 0);
