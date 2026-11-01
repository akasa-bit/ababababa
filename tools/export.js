// データの書き出し (回 DO6・B-072。docs/export.md)。画面なしの版で銀河を回し、現実の統計と同じ形の表を CSV で書き出す。
// ゲームの中身は変えない (出入りの関数を道具の側で包んで数えるだけ。tools/fiscal-panel.js・tools/tests/ledger.js と同じやり方)。
// 表 (列の名前は SNA 2008・GFS 2014・COFOG・BACI・COW の符号。意味と単位は docs/export.md のコードブック):
//   sna.csv      国 × 年: 人口・GDP と内訳 (家計の消費・政府の買い付け・政府の建設・輸出入)・賃金・税・政府の純貸出
//   gfs.csv      国 × 年: 一般政府の収入 (税の種類・移転・財産所得) と、目的別の支出 (COFOG)
//   balance.csv  国 × 年 (年の終わり): 部門 (家計・会社・政府・先住民・銀行) の預金・貸出・国債
//   rates.csv    国 × 年: 物価の指数・物価の上がり方・政策金利・長期の国債の利回り
//   prices.csv   星系 × 年: 資源ごとの市場の値段
//   trade.csv    年 × 輸出国 × 輸入国 × 品目 (BACI の形): 額と量。国の中の輸送は入れない
//   wars.csv     戦争 1 つ = 1 行 (COW の国家間戦争の形。2 国の組で 1 つの戦争と数える)
//   wars_part.csv 戦争 × 参加国 (COW の参加国の表の形)
//   policy.csv   政策の出来事 (Romer & Romer の形): 年・国・政策・前の値・後の値
//   meta.json    設定・ゲームの版・シード・行の数
// 使い方: node tools/export.js <設定.json>
//         node tools/export.js --out <フォルダ> [--seeds 30 | --seeds 1,2,3] [--years 150] [--nations 6] [--params 値.json]
//   設定のファイル = { "out": "export-out", "seeds": 30, "years": 150, "nations": 6, "params": null }。HTML=… で別の版を回せる
const fs = require('fs');
const path = require('path');
const H = require('./headless');

// 設定: ファイル 1 つか、引数
function config(argv) {
  if (argv[0] && !argv[0].startsWith('--')) return { ...JSON.parse(fs.readFileSync(argv[0], 'utf8')), file: argv[0] };
  const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  return { out: arg('out', 'export-out'), seeds: arg('seeds', '3'), years: Number(arg('years', 150)), nations: Number(arg('nations', 6)), params: arg('params', null) };
}
const seedList = (s) => (Array.isArray(s) ? s.map(String) : String(s).includes(',') ? String(s).split(',') : Array.from({ length: Number(s) }, (_, i) => String(i + 1)));

// 列・数え方は src/core/export-rec.js (EXPORT_COLS・exportRecorder。ゲームの中の「データを書き出す」と同じもの。回 GA11・B-196)

// onYear(g, y) = 年の始めに呼ぶ (試験でわざと政策を変えるため)
function play(sim, seed, years, nations, emit, onYear = null) {
  const g = sim.newGame(seed, { nations });
  const st = {};
  const rec = sim.evaluate('exportRecorder')(g, emit, st, seed);
  for (let y = 0; y < years; y++) {
    rec.yearBegin();
    if (onYear) onYear(g, y);
    sim.run(g, 1);
    rec.yearEnd();
  }
  sim.evaluate('exportWars')(st, emit, seed);
  return g;
}

function main() {
  const cfg = config(process.argv.slice(2));
  const seeds = seedList(cfg.seeds ?? 3), years = Number(cfg.years ?? 150), nations = Number(cfg.nations ?? 6);
  const params = typeof cfg.params === 'string' ? JSON.parse(fs.readFileSync(cfg.params, 'utf8')) : cfg.params || null;
  const sim = H.load({ params, ...(process.env.HTML ? { src: process.env.HTML } : {}) });
  const COLS = sim.evaluate('EXPORT_COLS');
  const out = cfg.out || 'export-out';
  fs.mkdirSync(out, { recursive: true });
  const rows = Object.fromEntries(Object.keys(COLS).map((k) => [k, []]));
  const emit = (t, row) => rows[t].push(row);
  const t0 = Date.now();
  for (const seed of seeds) { play(sim, seed, years, nations, emit); process.stderr.write(`銀河 ${seed} (${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`); }
  const csvCell = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const [t, cols] of Object.entries(COLS)) fs.writeFileSync(path.join(out, `${t}.csv`), `${[cols.join(','), ...rows[t].map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')}\n`);
  const meta = { app: 'nolongerubiquitous', edition: sim.EDITION?.id ?? sim.EDITION ?? null, seeds, years, nations, params: cfg.params ?? null, config: cfg.file ?? null, rows: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])), codebook: 'docs/export.md', exportedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify({ out, ...meta.rows }));
  return { out, rows, meta };
}

module.exports = { play, cols: (sim) => sim.evaluate('EXPORT_COLS') }; // 列は src/core/export-rec.js の EXPORT_COLS
if (require.main === module) main();
