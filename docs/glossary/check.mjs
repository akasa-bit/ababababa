// 用語集 (docs/glossary/terms.json) を、いまのゲームと突き合わせる (B-074)。ゲームの中身は変えない (画面なしの版で表を読むだけ)。
// 1. src のある用語: ゲームの中で src の式を評価し、ja と同じか (配列なら ja を含むか) を見る。違えば、ゲームの言葉が変わったので、用語集を直す。
// 2. 拾い残し: 下の COVER の表の値のうち、用語集にない ja を挙げる (新しい型・資源などが足されたとき)。
// 使い方: node docs/glossary/check.mjs   (合格なら「用語集 合格」。食い違いか拾い残しがあれば終了コード 1)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const H = require(join(here, '..', '..', 'tools', 'headless.js'));
const sim = H.load({});
const { terms } = JSON.parse(readFileSync(join(here, 'terms.json'), 'utf8'));

// 用語集が拾うと決めた表 (式は ja の文字列の配列を返す)。表を足したら、ここにも足す
const COVER = [
  'Object.values(BUNDLE_LABELS)', 'Object.values(BUNDLE_CODES)', 'Object.values(VASSAL_FAMILIES)', 'Object.values(VASSAL_DATA.types).map((t) => t.label)',
  'REGIME_ORDER.map((r) => REGIMES[r].label)', 'Object.values(ELITE_LABEL)', 'Object.values(GOVERNOR)', 'Object.values(MANDATES)',
  'Object.values(POLICIES).map((p) => p.label)', 'Object.values(UNREST_LABEL)', 'Object.values(END_LABEL)', 'Object.values(FLEET_KIND)',
  'Object.values(CHALLENGES).map((c) => c.label)', 'Object.values(HANDICAP).map((h) => h.label)', 'Object.values(RES_LABEL)', 'Object.values(FACILITY)',
  'Object.values(FOCUS).map((f) => f.label)', 'Object.values(BUDGET).map((b) => b.label)', 'Object.values(TAX_LEVELS).map((t) => t.label)',
  'Object.values(LEDGER_LABEL)', 'STRUCTURE.stages.map((s) => s[1])', 'Object.values(SLAVE_TYPES)', 'Object.values(SPECIES_TRAITS).map((t) => t.label)',
  'TECH_LABEL', 'Object.values(EVENT_KIND)', 'Object.values(TIER_LABEL)', 'Object.values(EMPIRE_TABS)', 'Object.values(TYPE_LABEL)', 'Object.values(SURFACE_LABEL)',
  'Object.values(KIND_LABEL)', 'Object.values(EDITION_LABEL)', 'REAL_STARS.s.map((s) => s[3]).filter(Boolean)', 'NATION_SUFFIX.map((x) => x.s)', 'SECEDE_SUFFIX',
];

const ev = (src) => { try { return sim.evaluate(src); } catch (e) { return { error: e.message }; } };
const bad = [];
for (const t of terms) {
  if (!t.src) continue;
  const v = ev(t.src);
  const vals = Array.isArray(v) ? v : typeof v === 'object' && v ? Object.values(v) : [v];
  const ok = Array.isArray(v) || (v && typeof v === 'object' && !v.error) ? vals.includes(t.ja) : v === t.ja;
  if (!ok) bad.push(`${t.id}: ゲームでは ${JSON.stringify(v?.error ? `(${v.error})` : v).slice(0, 80)}、用語集では ${t.ja}`);
}
const known = new Set(terms.map((t) => t.ja));
const missing = [];
for (const src of COVER) {
  const v = ev(src);
  if (!Array.isArray(v)) { bad.push(`拾う表を読めない: ${src}`); continue; }
  for (const ja of v) if (!known.has(ja)) missing.push(`${ja} (${src})`);
}
const noEn = terms.filter((t) => !t.en).map((t) => t.id);
const noZh = terms.filter((t) => !t['zh-Hans']).map((t) => t.id);
for (const b of bad) console.log(`食い違い: ${b}`);
for (const m of [...new Set(missing)]) console.log(`拾い残し: ${m}`);
console.log(`用語 ${terms.length}・src つき ${terms.filter((t) => t.src).length}・英語のない用語 ${noEn.length}・中国語のない用語 ${noZh.length}${noZh.length ? ` (${noZh.join(', ')})` : ''}`);
console.log(bad.length || missing.length ? `用語集 不合格 (食い違い ${bad.length}・拾い残し ${new Set(missing).size})` : '用語集 合格');
process.exit(bad.length || missing.length ? 1 : 0);
