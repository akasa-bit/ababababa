// プレイ記録から楽しさの目標を測る道具 (tools/playlog-report.js) の試験 (回 DO3・B-065)
// 1. 答えの分かっている作り物の記録で、F01〜F05・F20・F21 と待つだけの時間・判断の数を確かめる
// 2. 公開用の index.html をブラウザで開き、同意して少し遊んだことにして「記録を書き出す」(exportPlayLog) のファイルを取り、道具がその形を読めるかを見る
// 3. 試遊の感想 (回 GA12。ホームの「友達と遊ぶ」): 作り物の感想を数える・ブラウザで書いた感想が書き出したファイルに入り、道具が読める
//    (画面と最初の体験が記録の形を変えたら、ここで分かる)
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('プレイ記録の道具') }];
if (require.main !== module) return;
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../playlog-report');
const ROOT = path.resolve(__dirname, '../..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const fails = [];
const near = (a, b, what) => { if (!(a === b || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6))) fails.push(`${what}: ${a} (正しくは ${b})`); };

// --- 1. 作り物の記録 ---
const day = 86400e3, t0 = Date.UTC(2026, 9, 1);
const ses = (id, startedAt, visibleMin, entries, extra = {}) => ({ id, startedAt, seed: '1', y0: 2100, y1: entries.length ? Math.max(2100, ...entries.map((e) => e.y)) : 2100, visibleMs: visibleMin * 60e3, runningMs: 0, pausedMs: 0, idleMs: 0, views: {}, entries, ...extra });
// 1 人目: 50 分遊び、3 分で最初の入植船 (と同時に交易路)。命令は年 2100・2100 (同じ判断)・2160・2250。7 日以内にもう 1 回
const p1 = [
  ses(1, t0, 50, [
    { t: 10, y: 2100, k: 'view', v: 'cands' },
    { t: 180, y: 2100, k: 'act', act: 'send' }, { t: 185, y: 2100, k: 'act', act: 'route' },
    { t: 300, y: 2160, k: 'act', act: 'decide' },
    { t: 400, y: 2190, k: 'idle', s: 75 },
    { t: 500, y: 2250, k: 'set', act: 'tax' },
    { t: 4000, y: 2300, k: 'memo', tag: 'confused', view: 'empire/politics' }, // 1 時間より後なので F03 に数えない
  ], { firsts: { colony: 180, route: 185 }, idleMs: 5 * 60e3 }),
  ses(2, t0 + 2 * day, 30, [{ t: 60, y: 2100, k: 'act', act: 'send' }, { t: 120, y: 2130, k: 'act', act: 'decide' }], { firsts: { colony: 60 } }),
];
// 2 人目: 130 分遊ぶが、入植船を送らない (交易路は 5 分)。戻ってこない (2 回目は 8 日後)。古い形 (firsts なし)
const p2 = [
  ses(10, t0, 130, [
    { t: 300, y: 2100, k: 'act', act: 'route2' },
    { t: 600, y: 2140, k: 'memo', tag: 'confused', view: 'galaxy' },
    { t: 900, y: 2200, k: 'act', act: 'decide' },
  ]),
  ses(11, t0 + 8 * day, 10, []),
];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlu-playlog-'));
const write = (name, sessions, survey) => { const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify({ app: 'nolongerubiquitous', edition: 'game', kind: 'playlog', exportedAt: t0, sessions, ...(survey ? { survey } : {}) })); return f; };
// 感想: 1 人目は 2 回書いた (書き出し直したファイルにも同じものが入る)。2 人目は 1 回
const sa = [{ at: t0 + 1, fun: '交易路', again: '3', len: 'long', net: 'retry' }, { at: t0 + 2, fun: '独立された', lost: '光の遅れ', again: '4', len: 'ok', net: 'quick' }];
write('a.json', p1, sa);
write('a-again.json', [p1[1]], sa); // 同じブラウザから書き出し直したもの (セッションの id が重なる) → 1 人
write('b.json', p2, [{ at: t0 + 3, again: '5', len: 'ok', net: 'quick' }]);
fs.writeFileSync(path.join(dir, 'save.json'), JSON.stringify({ year: 2100 })); // プレイ記録でないファイルは飛ばす
const { people, skipped } = R.readLogs([dir]);
near(people.length, 2, '人の数');
near(skipped.length, 1, '飛ばしたファイル');
const [a, b] = people.map(R.measurePerson);
near(a.f01, 50, '1 人目の F01 (分)');
near(a.f02, 1, '1 人目の F02');
near(a.f04, 3, '1 人目の F04 (分)');
near(a.f20, 3, '1 人目の F20 (分)');
near(a.f21, 0, '1 人目の F21');
near(a.f03, 1 / (50 / 60), '1 人目の F03 (操作なし 75 秒が 1 回。50 分あたり)');
near(a.f05, 60, '1 人目の F05 (間の年 60・90 と 2 回目の 30 の中央値。同じ年の命令は数えない)');
near(b.f04, 5, '2 人目の F04 (古い形: 命令の行から)');
near(b.f20, null, '2 人目の F20 (入植船なし)');
near(b.f02, 0, '2 人目の F02 (8 日後は数えない)');
near(b.f21, 1, '2 人目の F21');
near(b.f05, 100, '2 人目の F05');
// 待つだけの年: 1 人目の 1 回目は、年の区切り 2100→2100→2100→2160→2250→2300 (終わり) で、90 年を超えた間はない。2 回目は 2100→2100→2130 で 0
near(a.waitedShare, 0, '1 人目の待つだけの年');
// 2 人目の 1 回目: 2100→2100→2200→2200 (終わり)。間の 100 年のうち 10 年が 90 年を超えた分 → 10 / 100。2 回目は 0 年
near(b.waitedShare, 0.1, '2 人目の待つだけの年');
const r = R.judge(people);
const row = (id) => r.rows.find((x) => x.id === id);
near(row('F04').value, 4, 'F04 の中央値 (3 分と 5 分)');
near(row('F20').value, Infinity, 'F20 の 90% 点 (送らなかった人がいる)');
if (!/参考/.test(row('F01').verdict)) fails.push('30 人より少ないのに判定した');
const md = R.markdown(r, skipped, true);
if (!md.includes('| F05 |') || !md.includes('save.json')) fails.push('表の形が違う');
// 3. 感想: 人ごとにいちばん新しい答えを数える (1 人目は 4・ちょうどよい・すぐ、2 人目は 5・ちょうどよい・すぐ)。書いたことは全部並べる (重ならない)
const sv = R.surveys(people);
near(sv.n, 2, '感想の人数');
near(sv.again, 4.5, '「また遊びたいか」の中央値');
near(sv.counts.len.ok, 2, '「100 年の長さ: ちょうどよい」の人数');
near(sv.counts.net.quick, 2, '「つながり: すぐ」の人数');
r.survey = sv;
const md2 = R.markdown(r, skipped, false);
if (!md2.includes('### 試遊の感想 (2 人') || (md2.match(/  - 交易路/g) || []).length !== 1 || !md2.includes('  - 光の遅れ')) fails.push('感想の表の形が違う (書き出し直したファイルの感想が重なったか、抜けた)');

// --- 2. ブラウザで書き出したファイル ---
(async () => {
  const { chromium } = require('playwright');
  const br = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const p = await br.newPage({ viewport: { width: 1280, height: 780 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('moribin-playlog-consent', 'yes'); } catch {} });
  await p.goto(`file://${HTML}?seed=11&home=0`);
  await p.waitForFunction(() => window.__app && __app.game);
  const text = await p.evaluate(async () => {
    // 遊んだことにする: 入植船 (最初の判断の印も)・時間を進めて「決めること」に答える・画面を変える・操作なし・メモ
    PlayLog.add('act', { act: 'send' }); PlayLog.firstAct('send');
    for (let i = 0; i < 40; i++) app.game.advance(0.25);
    PlayLog.add('view', { v: 'events' });
    PlayLog.add('act', { act: 'decide' });
    PlayLog.add('idle', { s: 80 });
    PlayLog.add('memo', { tag: 'confused', text: '試験', view: 'events' });
    PlayLog.tick(2000); PlayLog.cur.y1 = app.game.year;
    // 試遊の感想 (回 GA12): ホームの「友達と遊ぶ」の欄に書いて「感想を残す」を押す
    openHome(); app.homeTab = 'friends'; renderHome();
    $('sv-fun').value = '試験の感想'; $('sv-again').value = '4'; $('sv-len').value = 'ok'; $('sv-net').value = 'none';
    document.querySelector('#home [data-home="survey"]').click();
    // 書き出したファイルを、ダウンロードの代わりに受け取る
    let blob = null;
    const orig = URL.createObjectURL;
    URL.createObjectURL = (b) => { blob = b; return 'blob:test'; };
    HTMLAnchorElement.prototype.click = () => {};
    exportPlayLog();
    URL.createObjectURL = orig;
    return blob ? await blob.text() : null;
  });
  await br.close();
  if (!text) fails.push('書き出したファイルを受け取れなかった');
  else {
    const f = path.join(dir, 'browser.json');
    fs.writeFileSync(f, text);
    const got = R.readLogs([f]);
    if (got.people.length !== 1) fails.push(`ブラウザの記録を 1 人として読めない (${got.skipped.map((x) => x[1]).join('・')})`);
    else {
      const m = R.measurePerson(got.people[0]);
      const c = got.people[0].sessions[got.people[0].sessions.length - 1];
      for (const k of ['startedAt', 'visibleMs', 'y0', 'y1', 'firsts', 'entries', 'idleMs']) if (c[k] === undefined) fails.push(`書き出した記録に ${k} がない`);
      if (!Number.isFinite(m.f04)) fails.push('ブラウザの記録から F04 が出ない');
      if (!(m.f05 > 0)) fails.push(`ブラウザの記録から F05 が出ない (${m.f05})`);
      if (m.lost.length !== 2) fails.push(`ブラウザの記録の迷った回数が 2 でない (${m.lost.length})`);
      console.log('ブラウザの記録:', JSON.stringify({ f04: m.f04, f05: m.f05, lost: m.lost, cmds: c.entries.filter((e) => e.k === 'act').length }));
      const s = R.surveys(got.people);
      if (s.n !== 1 || s.latest[0].fun !== '試験の感想' || s.latest[0].again !== '4' || s.latest[0].len !== 'ok' || s.latest[0].net !== 'none' || !s.latest[0].seed) fails.push(`ブラウザで書いた感想が書き出したファイルに入っていない (${JSON.stringify(s.latest[0] || null)})`);
    }
  }
  if (errs.length) fails.push(`ページの誤り: ${errs.join(' / ')}`);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails.length ? `プレイ記録の道具 不合格: ${fails.join('・')}` : 'プレイ記録の道具 合格');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
