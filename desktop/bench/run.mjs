// 包装の測り: Electron の包装と、比べの元の Chromium を同じ手順で何回か起動し、起動の速さ・描画の速さ・メモリ・大きさを表にする。
// (2026-10-20 の S1 では Tauri とも比べた。その結果は results/2026-10-20-linux-xvfb.json と desktop/README.md の 3)
// 使い方 (画面のない機械では xvfb-run の中で):
//   node desktop/prepare.mjs && (cd desktop/electron && npm run package:linux)
//   xvfb-run -a -s "-screen 0 1280x800x24" node desktop/bench/run.mjs [回数=3] > 表.md
// 結果の JSON は desktop/bench/results/ に書く。
import { spawn, execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const desk = join(here, '..');
const RUNS = Number(process.argv[2]) || 3;
const electronBin = join(desk, 'electron/out/NoLongerUbiquitous-linux-x64/NoLongerUbiquitous');
const chromiumBin = process.env.CHROMIUM || '/opt/pw-browsers/chromium';

// 子孫も含めたメモリ (PSS。共有の分を割り振るので、足しても重ならない) [MB]
function treePssMB(pid) {
  const kids = new Map();
  for (const d of readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const s = readFileSync(`/proc/${d}/stat`, 'utf8');
      const ppid = Number(s.slice(s.lastIndexOf(')') + 2).split(' ')[1]);
      if (!kids.has(ppid)) kids.set(ppid, []);
      kids.get(ppid).push(Number(d));
    } catch { /* 終わった */ }
  }
  let kb = 0;
  const walk = (p) => {
    try { kb += Number(/Pss:\s+(\d+)/.exec(readFileSync(`/proc/${p}/smaps_rollup`, 'utf8'))[1]); } catch { /* 終わった */ }
    for (const c of kids.get(p) || []) walk(c);
  };
  walk(pid);
  return kb / 1024;
}

// 1 回起動して、probe.js の結果の行を待つ
function runOnce(name, cmd, args, env = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(cmd, args, { env: { ...process.env, NLU_BENCH: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    let peak = 0;
    const timer = setInterval(() => { peak = Math.max(peak, treePssMB(p.pid)); }, 250);
    const kill = setTimeout(() => p.kill('SIGKILL'), 120000);
    const done = (r) => { clearInterval(timer); clearTimeout(kill); resolve(r); };
    const onData = (d) => {
      buf += d;
      const m = /NLU_BENCH (\{.*\})/.exec(buf);
      if (m) {
        const r = JSON.parse(m[1]);
        r.startupMs = r.epochReady - t0; // 起動の命令から、ホーム画面が出て 2 コマ描くまで
        r.peakPssMB = Math.round(peak);
        buf = '';
        p.kill('SIGTERM');
        setTimeout(() => done(r), 500);
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('exit', () => setTimeout(() => done({ error: `${name} が結果なしで終わった`, tail: buf.slice(-2000) }), 600));
  });
}

// 比べの元: Playwright の Chromium (画面あり) に同じ probe.js を差し込む
async function runChromium() {
  const require = createRequire(join(execSync('npm root -g').toString().trim(), 'x.js'));
  const { chromium } = require('playwright');
  const t0 = Date.now();
  const b = await chromium.launch({ executablePath: chromiumBin, headless: false, args: ['--window-size=1280,800'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: join(here, 'probe.js') });
  const page = await ctx.newPage();
  let peak = 0;
  const pid = b.process?.()?.pid; // Playwright の launch() では取れないことがある (そのときメモリは測らない)
  const timer = setInterval(() => { if (pid) peak = Math.max(peak, treePssMB(pid)); }, 250);
  const got = new Promise((res) => page.on('console', (m) => { if (m.text().startsWith('NLU_BENCH ')) res(JSON.parse(m.text().slice(10))); }));
  await page.goto('file://' + join(desk, 'game/index.html'));
  const r = await got;
  clearInterval(timer);
  r.startupMs = r.epochReady - t0;
  r.peakPssMB = pid ? Math.round(peak) : null;
  await b.close();
  return r;
}

const du = (p) => Number(execSync(`du -sb "${p}"`).toString().split('\t')[0]);
const gz = (p) => Number(execSync(`tar -C "${dirname(p)}" -czf - "${p.split('/').pop()}" | wc -c`).toString());
const MB = (b) => +(b / 1048576).toFixed(1);

const targets = [
  ['chromium', null],
  ['electron', () => runOnce('electron', electronBin, ['--no-sandbox'])], // Steam の起動の設定と同じ引数 (desktop/README.md の 1)
];
const results = { date: new Date().toISOString(), env: 'linux x64・Xvfb (GPU なし。描画はソフトウェア)', runs: RUNS, targets: {} };
for (const [name, fn] of targets) {
  const list = [];
  for (let i = 0; i < RUNS; i++) {
    process.stderr.write(`${name} ${i + 1}/${RUNS}\n`);
    list.push(fn ? await fn() : await runChromium());
  }
  results.targets[name] = list;
}
results.size = { electron: { dirMB: MB(du(dirname(electronBin))), tgzMB: MB(gz(dirname(electronBin))) } };

mkdirSync(join(here, 'results'), { recursive: true });
writeFileSync(join(here, 'results', `${results.date.slice(0, 16).replace(':', '')}-electron-linux-xvfb.json`), JSON.stringify(results, null, 2) + '\n');

// 表 (回数の中央値)
const med = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : '—'; };
const col = (name, f) => med(results.targets[name].map(f));
const rows = [
  ['起動 (命令からホーム画面が出るまで) [ms]', (r) => r.startupMs],
  ['ページの中の準備 (読み込みの始めから) [ms]', (r) => r.ready],
  ['止めた地図 [コマ/秒]', (r) => r.idle?.fps],
  ['地図を回し続ける [コマ/秒]', (r) => r.rotate?.fps],
  ['年 1 年 [コマ/秒]', (r) => r.speed1?.fps],
  ['最高速 (年 64 年) [コマ/秒]', (r) => r.speed64?.fps],
  ['最高速の 95% のコマの間隔 [ms]', (r) => r.speed64?.p95],
  ['最高速で 1 秒に進んだ年', (r) => r.yearsPerSec],
  ['メモリの最大 (PSS) [MB]', (r) => r.peakPssMB],
];
console.log(`| | Chromium (比べの元) | Electron |\n|---|---|---|`);
for (const [label, f] of rows) console.log(`| ${label} | ${['chromium', 'electron'].map((n) => col(n, f)).join(' | ')} |`);
console.log(`| 大きさ (展開) [MB] | — | ${results.size.electron.dirMB} |`);
console.log(`| 大きさ (圧縮) [MB] | — | ${results.size.electron.tgzMB} |`);
for (const [n, list] of Object.entries(results.targets)) for (const r of list) if (r.error) console.error(n, r.error, r.tail || '');
