// プレイ記録 (ホーム画面の「記録を書き出す」のファイル。src/screen/playlog.js) から、人の遊びで楽しさの目標を測る (回 DO3・B-065)
// F01 (最初の 1 回の長さ)・F02 (また遊びに来る割合)・F03 (迷った場所)・F04 (最初の意味のある判断まで)・F05 (判断の間隔)・
// F20 (最初の入植船まで)・F21 (2 時間遊び続ける割合) と、待つだけの時間・判断の数。合格の線は targets/targets.json から読む。
// 1 つのファイル = 1 人 (同じブラウザから何度か書き出したファイルは、セッションの id が重なるので 1 人にまとめる)。
// 決まり (targets.json の rules): 判定するのは見知らぬ試遊者 30 人以上のとき。少ないときは「参考」と出す。作者や会話の参加者の記録は渡さない。
// F07 (SUS) はアンケートなので、ここでは測らない。
// 使い方: node tools/playlog-report.js <記録.json か、記録の入ったフォルダ> … [--players] [--json 結果.json]  → Markdown を標準出力へ
const fs = require('fs');
const path = require('path');

const STD = 1; // 標準の速さ = 1 秒に 1 年 (始めたときの速さ。SPEEDS の 1)。F05 の「標準の速さの秒」は、命令の間に進んだ年 ÷ STD
const CMDS = new Set(['act', 'set', 'fleet', 'fleetclear']); // 命令 (summary の acts と同じ)
const FIRST_ACTS = { send: 'colony', candsend: 'colony', route: 'route', route2: 'route', rule: 'regime' }; // playlog.js と同じ
const RETURN_GAP = 30 * 60e3; // 2 回目と数えるのは、1 回目が終わってから 30 分以上あとに始めたもの
const IDLE_LOST = 60; // F03: 60 秒以上操作のなかった時間を「迷った」に数える
const WAIT = 90; // 待つだけの時間: 命令のない間が、標準の速さで 90 秒 (F05 の線) を超えた分

const median = (xs) => { const v = xs.filter((x) => x !== null && !Number.isNaN(x)).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const quantile = (xs, p) => { const v = xs.filter((x) => x !== null && !Number.isNaN(x)).sort((a, b) => a - b); return v.length ? v[Math.max(0, Math.ceil(p * v.length) - 1)] : null; };
const mean = (xs) => (xs.length ? xs.reduce((k, x) => k + x, 0) / xs.length : null);

// ファイルを読む (フォルダなら中の .json をすべて)。形の合わないファイルは理由をつけて飛ばす
function readLogs(args) {
  const files = args.flatMap((a) => (fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(a, f)) : [a]));
  const logs = [], skipped = [];
  for (const f of files) {
    let d;
    try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { skipped.push([f, '読めない JSON']); continue; }
    if (d?.kind !== 'playlog' || !Array.isArray(d.sessions)) { skipped.push([f, 'プレイ記録の形でない (kind が playlog でない)']); continue; }
    logs.push({ file: f, edition: d.edition, sessions: d.sessions.filter((c) => c && Array.isArray(c.entries) && Number.isFinite(c.startedAt)) });
  }
  // 1 人にまとめる: セッションの id が重なるファイルは同じブラウザ
  const people = [];
  for (const l of logs) {
    const ids = new Set(l.sessions.map((c) => c.id));
    const same = people.find((p) => p.sessions.some((c) => ids.has(c.id)));
    if (same) { for (const c of l.sessions) if (!same.sessions.some((x) => x.id === c.id)) same.sessions.push(c); same.files.push(l.file); }
    else people.push({ files: [l.file], edition: l.edition, sessions: [...l.sessions] });
  }
  for (const p of people) p.sessions.sort((a, b) => a.startedAt - b.startedAt);
  return { people: people.filter((p) => p.sessions.length), skipped };
}

// 最初の判断の時刻 (秒)。新しい記録は firsts、古い記録 (GA5 より前) は命令の行から
function firstsOf(c) {
  if (c.firsts && Object.keys(c.firsts).length) return { ...c.firsts };
  const out = {};
  for (const e of c.entries) { const w = e.k === 'act' && FIRST_ACTS[e.act]; if (w && out[w] === undefined) out[w] = e.t; }
  return out;
}

// 1 回の遊び (セッション) の数
function measureSession(c) {
  const es = [...c.entries].sort((a, b) => a.t - b.t);
  const cmds = es.filter((e) => CMDS.has(e.k));
  // F05: 続いた命令の間に進んだ年 (0 年 = 止めて続けて出した命令は、同じ判断のうちとみなして数えない)
  const gaps = [];
  for (let i = 1; i < cmds.length; i++) { const dy = (cmds[i].y ?? 0) - (cmds[i - 1].y ?? 0); if (dy > 1e-9) gaps.push(dy / STD); }
  // 待つだけの時間: 命令のない間 (最初から最初の命令まで・命令の間・最後の命令から終わりまで) のうち、WAIT 秒を超えた分の年
  const years = Math.max(0, (c.y1 ?? 0) - (c.y0 ?? 0));
  const marks = [c.y0 ?? 0, ...cmds.map((e) => e.y ?? 0), c.y1 ?? 0];
  let waited = 0;
  for (let i = 1; i < marks.length; i++) waited += Math.max(0, (marks[i] - marks[i - 1]) / STD - WAIT) * STD;
  // F03: 最初の 1 時間 (開いてから 3600 秒) の「分からない」のメモと、60 秒以上の操作なし。画面は記録した画面 (操作なしは、その前に開いた画面)
  let view = 'galaxy';
  const lost = [];
  for (const e of es) {
    if (e.k === 'view') view = e.v;
    if (e.t > 3600) continue;
    if (e.k === 'memo' && e.tag === 'confused') lost.push(e.view || view);
    if (e.k === 'idle' && e.s >= IDLE_LOST) lost.push(view);
  }
  const f = firstsOf(c);
  const ft = Object.values(f).filter(Number.isFinite);
  return {
    minutes: (c.visibleMs || 0) / 60000, years, cmds: cmds.length, decides: cmds.filter((e) => e.act === 'decide').length,
    gaps, gapMedian: median(gaps), waitedShare: years ? waited / years : null, idleShare: c.visibleMs ? (c.idleMs || 0) / c.visibleMs : null,
    lost, lostPerHour: lost.length / Math.max(1 / 60, Math.min(60, (c.visibleMs || 0) / 60000) / 60),
    firstDecisionMin: ft.length ? Math.min(...ft) / 60 : null, firstColonyMin: Number.isFinite(f.colony) ? f.colony / 60 : null,
    oldFormat: !c.firsts,
  };
}

// 1 人の数。F01・F03・F04・F20・F21 は最初の 1 回、F02 は 2 回目、F05 と判断の数はすべての回
function measurePerson(p) {
  const s = p.sessions.map(measureSession);
  const first = p.sessions[0], m0 = s[0];
  // 1 回目の終わり: 見ていた時間と、最後の行の時刻 (開いてからの秒。裏に回していた時間も入る) の長い方
  const end0 = first.startedAt + Math.max(first.visibleMs || 0, 1000 * Math.max(0, ...first.entries.map((e) => e.t || 0)));
  const back = p.sessions.slice(1).some((c) => c.startedAt - end0 >= RETURN_GAP && c.startedAt - first.startedAt <= 7 * 86400e3);
  const visibleH = s.reduce((k, x) => k + x.minutes, 0) / 60, years = s.reduce((k, x) => k + x.years, 0);
  const cmds = s.reduce((k, x) => k + x.cmds, 0);
  return {
    files: p.files, sessions: p.sessions.length,
    f01: m0.minutes, f02: back ? 1 : 0, f03: m0.lostPerHour, lost: m0.lost,
    f04: m0.firstDecisionMin, f05: median(s.flatMap((x) => x.gaps)), f20: m0.firstColonyMin, f21: m0.minutes >= 120 ? 1 : 0,
    cmdsPerHour: visibleH ? cmds / visibleH : null, cmdsPer100y: years ? (cmds / years) * 100 : null, decidesPer100y: years ? (s.reduce((k, x) => k + x.decides, 0) / years) * 100 : null,
    waitedShare: years ? s.reduce((k, x) => k + (x.waitedShare ?? 0) * x.years, 0) / years : null, idleShare: mean(s.map((x) => x.idleShare).filter((x) => x !== null)),
    oldFormat: s.some((x) => x.oldFormat),
  };
}

// 目標の線 (targets.json)
function targets() {
  const t = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'targets', 'targets.json'), 'utf8'));
  return Object.fromEntries(t.fun.map((f) => [f.id, f]));
}
const inBand = (x, b) => x !== null && Number.isFinite(x) && (b[0] === null || x >= b[0]) && (b[1] === null || x <= b[1]);

// 人の数から、目標ごとの値と判定を出す
function judge(people, minPeople = 30) {
  const T = targets();
  const ps = people.map(measurePerson);
  const n = ps.length;
  const inf = (x) => (x === null ? Infinity : x); // 判断・入植船がなかった人は「間に合わなかった」として数える
  const lostAll = ps.flatMap((p) => p.lost);
  const views = {};
  for (const v of lostAll) views[v] = (views[v] || 0) + 1;
  const topView = Object.entries(views).sort((a, b) => b[1] - a[1])[0] || null;
  const rows = [
    ['F01', median(ps.map((p) => p.f01)), (x) => `${x.toFixed(1)} 分 (中央値)`],
    ['F02', mean(ps.map((p) => p.f02)), (x) => `${Math.round(x * 100)}%`],
    ['F03', median(ps.map((p) => p.f03)), (x) => `1 時間に ${x.toFixed(1)} 回 (中央値)${topView ? `。いちばん多い画面は ${topView[0]} で ${Math.round((topView[1] / lostAll.length) * 100)}%` : ''}`, () => !topView || topView[1] / lostAll.length <= 0.3],
    ['F04', median(ps.map((p) => inf(p.f04))), (x) => (Number.isFinite(x) ? `${x.toFixed(1)} 分 (中央値)` : '半分より多くの人が判断しなかった')],
    ['F05', median(ps.map((p) => p.f05)), (x) => `${x.toFixed(0)} 秒 (標準の速さ。人ごとの中央値の中央値)`],
    ['F20', quantile(ps.map((p) => inf(p.f20)), 0.9), (x) => (Number.isFinite(x) ? `${x.toFixed(1)} 分 (90% 点)` : '1 割より多くの人が入植船を送らなかった')],
    ['F21', mean(ps.map((p) => p.f21)), (x) => `${Math.round(x * 100)}%`],
  ].map(([id, x, fmt, extra]) => {
    const t = T[id];
    const pass = x !== null && (Number.isFinite(x) || x === Infinity) && inBand(x, t.band) && (!extra || extra());
    return { id, name: t.name, pass: t.pass, value: x, text: x === null ? '—' : fmt(x), verdict: x === null ? 'データなし' : n < minPeople ? `参考 (${n} 人。30 人から判定)` : pass ? '合格' : '不合格', ok: pass };
  });
  const extra = {
    cmdsPerHour: median(ps.map((p) => p.cmdsPerHour)), cmdsPer100y: median(ps.map((p) => p.cmdsPer100y)), decidesPer100y: median(ps.map((p) => p.decidesPer100y)),
    waitedShare: median(ps.map((p) => p.waitedShare)), idleShare: median(ps.map((p) => p.idleShare)), oldFormat: ps.filter((p) => p.oldFormat).length,
  };
  return { n, rows, extra, people: ps };
}

function markdown(r, skipped, withPeople) {
  const pc = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);
  const f1 = (x) => (x === null ? '—' : x.toFixed(1));
  const out = [];
  out.push(`### 人の遊びで測る楽しさの目標 (プレイ記録 ${r.n} 人)`);
  out.push('');
  out.push('| ID | 目標 | いまの値 | 合格の線 | 判定 |');
  out.push('|---|---|---|---|---|');
  for (const x of r.rows) out.push(`| ${x.id} | ${x.name} | ${x.text} | ${x.pass} | ${x.verdict === '不合格' ? '**不合格**' : x.verdict} |`);
  out.push('');
  out.push('| 待つだけの時間と判断の数 (人ごとの値の中央値) | 値 |');
  out.push('|---|---|');
  out.push(`| 命令の数 (見ていた 1 時間あたり) | ${f1(r.extra.cmdsPerHour)} |`);
  out.push(`| 命令の数 (ゲームの 100 年あたり。自動対戦の「判断を求められる回数」と比べる) | ${f1(r.extra.cmdsPer100y)} |`);
  out.push(`| 「決めること」に答えた数 (100 年あたり) | ${f1(r.extra.decidesPer100y)} |`);
  out.push(`| 待つだけの年の割合 (進めた年のうち、命令のない間が標準の速さで ${WAIT} 秒を超えた分) | ${pc(r.extra.waitedShare)} |`);
  out.push(`| 操作のない時間の割合 (見ていた時間のうち、30 秒以上の操作なし) | ${pc(r.extra.idleShare)} |`);
  out.push('');
  out.push(`- 標準の速さ = 1 秒に 1 年 (始めたときの速さ)。F05 の秒は、続いた命令の間に進んだ年から出す (止めて続けて出した命令は、同じ判断のうちとして数えない)。`);
  out.push(`- F01・F03・F04・F20・F21 は 1 人の最初の 1 回 (いちばん早く始めたセッション)、F02 は 1 回目が終わって 30 分以上あとから 7 日以内に始めた回があるか。判断や入植船がなかった人は「間に合わなかった」として数える。`);
  if (r.extra.oldFormat) out.push(`- GA5 より前の形の記録 (最初の判断の印がない) が ${r.extra.oldFormat} 人。最初の判断は命令の行から出した。`);
  if (skipped.length) out.push(`- 読まなかったファイル: ${skipped.map(([f, why]) => `${path.basename(f)} (${why})`).join('・')}`);
  if (withPeople) {
    out.push('');
    out.push('| 人 | 回数 | F01 分 | F02 | F03 回/時 | F04 分 | F05 秒 | F20 分 | 命令/時 | 待つだけ |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    r.people.forEach((p, i) => out.push(`| ${i + 1} (${p.files.map((f) => path.basename(f)).join('・')}) | ${p.sessions} | ${f1(p.f01)} | ${p.f02 ? 'はい' : 'いいえ'} | ${f1(p.f03)} | ${f1(p.f04)} | ${p.f05 === null ? '—' : p.f05.toFixed(0)} | ${f1(p.f20)} | ${f1(p.cmdsPerHour)} | ${pc(p.waitedShare)} |`));
  }
  return out.join('\n');
}

module.exports = { readLogs, measureSession, measurePerson, judge, markdown, STD, WAIT };

if (require.main === module) {
  const a = process.argv.slice(2);
  const jsonOut = a.includes('--json') ? a[a.indexOf('--json') + 1] : null;
  const inputs = a.filter((x, i) => !x.startsWith('--') && a[i - 1] !== '--json');
  if (!inputs.length) { console.error('使い方: node tools/playlog-report.js <記録.json か フォルダ> … [--players] [--json 結果.json]'); process.exit(2); }
  const { people, skipped } = readLogs(inputs);
  const r = judge(people);
  console.log(markdown(r, skipped, a.includes('--players')));
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(r, null, 1));
}
