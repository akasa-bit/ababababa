const EVENT_KIND = { famine: '飢餓・水不足', shortage: '資源不足', pirate: '海賊', natives: '先住民', war: '征服戦争', politics: '政治', demand: '要求', battle: '戦闘', colony: '入植', migration: '移民', trade: '交易路', story: '出来事', goal: '目標' };
// 通知の段: 3 = 重大 (目立たせる)、2 = 普通 (記録に出す)、1 = 細事 (既定では隠す。種類で絞り込めば見える)
const EVENT_TIER = { politics: 3, demand: 3, battle: 3, famine: 3, goal: 3, war: 2, colony: 2, pirate: 2, natives: 2, story: 2, trade: 2, shortage: 1, migration: 1 };
const TIER_LABEL = { 3: '重大', 2: '普通', 1: '細事' };
const MERGE_KINDS = new Set(['shortage', 'migration', 'famine']); // 一覧で、同じ星系の同じ種類をまとめる
// 種類ごとの表示の好み (見る人ごとなのでブラウザに覚えておく)。未設定なら段で決まる (普通以上を出す)
const EvPrefs = { kinds: {}, mode: 'list' };
try { const p = JSON.parse(localStorage.getItem(`${STORE}-evprefs`) || 'null'); if (p && typeof p === 'object') { EvPrefs.kinds = p.kinds || {}; EvPrefs.mode = p.mode === 'year' ? 'year' : 'list'; } } catch { /* 既定値 */ }
function saveEvPrefs() { try { localStorage.setItem(`${STORE}-evprefs`, JSON.stringify(EvPrefs)); } catch { /* 保存できない環境 */ } }
const evTier = (kind) => EVENT_TIER[kind] ?? 2;
function evShown(kind) { const v = EvPrefs.kinds[kind]; return v === undefined ? evTier(kind) >= 2 : !!v; }

// 節目 (B-046): 入植・交易路の開通・独立・講和の知らせが届いたら、地図に光の輪を広げ、自国の節目なら音を鳴らす (新しい時代は音だけ)
const RING_MS = 2400;
const RING_COLOR = { colony: '#7cc790', route: '#8fb1e6', independence: '#f89a2b', peace: '#ffffff' };
// 新しく届いた節目を返す (1 つの節目は 1 回だけ)。ゲームを開いた・ロードした時点で届いていたものは数えない。
// own = 自国の節目: 自国の星系の入植・自国の交易路・自国の家臣の独立・自国が結んだ講和
function milestonesNew(g, now) {
  if (app.ringGame !== g) { app.ringGame = g; app.ringSeen = new Set(); app.ringSince = g.year; }
  const out = [];
  const mine = (sys) => sys === g.cap || g.known(sys)?.realm === g.cap;
  const add = (key, kind, sys, own) => { if (!app.ringSeen.has(key)) { app.ringSeen.add(key); out.push({ kind, sys, own, t: now }); } };
  for (const e of g.knownEvents()) { // 届いた順の新しいものから
    if ((e.seen ?? e.year) <= app.ringSince) break;
    if (e.kind === 'colony' && e.good && /設立/.test(e.text)) {
      // 知らせと星系の記録は届く時が少しずれる。記録がまだ入植の前なら、届くまで (長くて 2 年) 待ってから決める
      if (g.known(e.sys)?.realm == null && g.year - (e.seen ?? e.year) < 2) continue;
      add(`e${e.id}`, 'colony', e.sys, mine(e.sys));
    }
    else if (e.kind === 'politics' && /独立を宣言/.test(e.text)) {
      const lord = g.galaxy.systems.find((s) => s.name === e.text.match(/ が (.+?) への従属をやめ/)?.[1]); // 元の主人の星系 (知らせの文から)
      add(`e${e.id}`, 'independence', e.sys, !!lord && mine(lord.id));
    } else if (e.kind === 'politics' && /白紙講和を結んだ|講和条約が結ばれた/.test(e.text)) add(`e${e.id}`, 'peace', e.sys ?? g.cap, !!e.good); // 人間の国が結んだ講和は good
    else if (e.kind === 'goal' && /新しい時代が始まった/.test(e.text)) add(`e${e.id}`, 'era', g.cap, true);
  }
  for (const r of g.routes) { // 交易路の開設は知らせの記録に残らないので、開いた年 + 光の遅れで見る
    const seen = r.built + g.lightDelay(r.a);
    if (seen <= app.ringSince || seen > g.year) continue;
    const own = mine(r.a) || mine(r.b);
    add(`r${r.id}`, 'route', r.a, own);
    if (!app.ringSeen.has(`r${r.id}b`)) { app.ringSeen.add(`r${r.id}b`); out.push({ kind: 'route', sys: r.b, own, t: now, quiet: true }); }
  }
  return out;
}

// イベントタブ: 決めること、いま起きている問題、重要なイベントの履歴
function eventsHtml(app) {
  const g = app.game;
  const f = app.eventFilter || 'all';
  const ALERT = { food: ['famine', '飢餓'], water: ['famine', '水不足'], goods: ['shortage', '工業品不足'], industry: ['shortage', '原料不足'], crowd: ['migration', '人口過密'] };
  const kc = g.knownOwnSystems().flatMap((x) => g.knownColonies(x.id));
  const now = kc.flatMap((c) => Object.entries(c.alerts || {}).filter(([k, on]) => on && ALERT[k]).map(([k]) => ({ c, k })));
  const kwars = g.knownSystems().flatMap((x) => g.knownWars(x.id));
  // 独立のおそれ (地球の国の星系で、不満が高まっているもの)
  const risks = g.knownSystems().filter((x) => x.id !== g.cap && (g.known(x.id)?.realm ?? g.cap) === g.cap)
    .map((x) => ({ x, o: independenceOutlook(g, x.id) })).filter(({ o }) => o && o.warn)
    .sort((a, b) => b.o.stage - a.o.stage || a.o.loyalty - b.o.loyalty);
  const riskHtml = risks.map(({ x, o }) => `<div class="ev major"><span class="tag politics">${esc(UNREST_LABEL[o.stage] || '不満の兆し')}</span><span class="txt">${esc(x.name)}
      <span class="muted">${esc(outlookText(o, true))}・忠誠度 ${Math.round(o.loyalty)} → 目標 ${Math.round(o.target)} ${ageBadge(g, x.id)}</span></span>
      <button data-act="goto" data-sys="${x.id}">地図</button></div>`).join('');
  const wars = kwars.map((w) => {
    const n = g.nativeOf(w.sys, w.body);
    return `<div class="ev"><span class="tag war">${tagIco('war')}征服戦争</span><span class="txt">${esc(g.target(w.sys, w.body).name)} 対 ${esc(n?.def.species || '?')}
      <span class="muted">進捗 ${pct(w.progress)} ${ageBadge(g, w.sys)}</span></span>
      <button data-act="gobody" data-sys="${w.sys}" data-body="${esc(w.body)}">表示</button></div>`;
  }).join('');
  // 資源不足などは状態として、星系ごとにまとめて出す
  const bySys = new Map();
  for (const a of now) { if (!bySys.has(a.c.sys)) bySys.set(a.c.sys, []); bySys.get(a.c.sys).push(a); }
  const alertRow = ([sys, list]) => {
    const kinds = [...new Set(list.map(({ k }) => ALERT[k][1]))];
    const worst = list.some(({ k }) => ALERT[k][0] === 'famine') ? 'famine' : list.some(({ k }) => ALERT[k][0] === 'shortage') ? 'shortage' : 'migration';
    return `<div class="ev"><span class="tag ${worst}">${tagIco(worst)}${esc(kinds.join('・'))}</span><span class="txt">${esc(g.system(sys).name)}
        <span class="muted">${list.map(({ c, k }) => `${esc(c.name)} (${ALERT[k][1]})`).join('・')} ${ageBadge(g, sys)}</span></span>
        <button data-act="goto" data-sys="${sys}">地図</button></div>`;
  };
  // 飢餓・水不足のある星系は1件ずつ、工業品・原料の不足と人口過密だけの星系はまとめてたたむ
  const groups = [...bySys.entries()];
  const famine = groups.filter(([, list]) => list.some(({ k }) => ALERT[k][0] === 'famine'));
  const minor = groups.filter((x) => !famine.includes(x));
  const alertHtml = famine.map(alertRow).join('') + (minor.length ? `<details><summary class="muted">資源不足・人口過密 (${minor.length} 星系。地図では星の右上の「!」)</summary>${minor.map(alertRow).join('')}</details>` : '');
  const nowHtml = (now.length || wars || riskHtml) ? riskHtml + wars + alertHtml : '<p class="note">いま問題が起きている入植地はない。</p>';
  const chips = ['all', ...Object.keys(EVENT_KIND)].map((k) => `<button data-act="evfilter" data-f="${k}" class="${k === f ? 'on' : ''}">${k === 'all' ? 'すべて' : `${tagIco(k)}${EVENT_KIND[k]}`}</button>`).join('');
  const tiers = [3, 2, 1].map((t) => {
    const ks = Object.keys(EVENT_KIND).filter((k) => evTier(k) === t);
    const on = ks.every(evShown), some = ks.some(evShown);
    return `<button data-act="evtier" data-tier="${t}" class="${on ? 'on' : ''}">${TIER_LABEL[t]}${!on && some ? ' (一部)' : ''}</button>`;
  }).join('');
  const kindBoxes = Object.keys(EVENT_KIND).map((k) => `<label class="check"><input type="checkbox" data-act="evkind" data-k="${k}" ${evShown(k) ? 'checked' : ''}> ${EVENT_KIND[k]} <span class="muted">(${TIER_LABEL[evTier(k)]})</span></label>`).join(' ');
  const evs = g.knownEvents().filter((e) => (f === 'all' ? evShown(e.kind) : e.kind === f));
  const evRow = (e, more = 0) => `<div class="ev ${e.good ? 'good' : ''} ${evTier(e.kind) >= 3 && !e.good ? 'major' : ''}">
      <span class="yr">${e.year.toFixed(1)}${(e.seen ?? e.year) - e.year > 0.05 ? `<br><small>${((e.seen ?? e.year) - e.year).toFixed(1)}年遅れ</small>` : ''}</span><span class="tag ${e.kind}">${tagIco(e.kind)}${EVENT_KIND[e.kind] || e.kind}</span>
      <span class="txt">${esc(e.text)}${more ? ` <span class="muted">(同じ星系で ほか ${more} 件)</span>` : ''}</span>${e.sys !== undefined && g.system(e.sys) ? `<button data-act="goto" data-sys="${e.sys}">地図</button>` : ''}</div>`;
  let list = '';
  if (EvPrefs.mode === 'year') {
    // 年ごとの報告: 重大な出来事は1件ずつ、ほかは種類ごとの件数にまとめ、開くと中身が見える
    const years = new Map();
    for (const e of evs) { const y = Math.floor(e.year); if (!years.has(y)) years.set(y, []); years.get(y).push(e); }
    list = [...years.entries()].sort((a, b) => b[0] - a[0]).slice(0, 60).map(([y, es]) => {
      const major = es.filter((e) => evTier(e.kind) >= 3 && !e.good);
      const rest = es.filter((e) => !major.includes(e));
      const counts = {};
      for (const e of rest) counts[e.kind] = (counts[e.kind] || 0) + 1;
      const sum = Object.entries(counts).map(([k, n]) => `${EVENT_KIND[k] || k} ${n}`).join('・');
      return `<div class="yearrep"><div class="yh">${y}年の報告</div>${major.map((e) => evRow(e)).join('')}
        ${rest.length ? `<details><summary>${esc(sum)}</summary>${rest.map((e) => evRow(e)).join('')}</details>` : ''}</div>`;
    }).join('');
  } else {
    // 一覧: 資源不足・移民・飢餓は、同じ星系の同じ種類を新しい1件にまとめる
    const rows = [];
    const merged = new Map();
    for (const e of evs) {
      if (rows.length >= 120) break;
      const key = MERGE_KINDS.has(e.kind) && e.sys !== undefined ? `${e.kind}|${e.sys}|${e.good ? 1 : 0}` : null;
      if (key && merged.has(key)) { merged.get(key).more++; continue; }
      const r = { e, more: 0 };
      rows.push(r);
      if (key) merged.set(key, r);
    }
    list = rows.map((r) => evRow(r.e, r.more)).join('');
  }
  return `<h2>イベント</h2>
    <p class="note">遠い星系の出来事は、光が${ME.home}に届いてから表示される (年は起きた年)。</p>
    ${decisionsHtml(g)}
    <h3>いま起きている問題 (把握分 ${now.length + kwars.length + risks.length})</h3>${nowHtml}
    <h3>履歴</h3>
    <div class="chips"><span class="muted">表示する段</span>${tiers}<span class="muted">表示</span><button data-act="evmode" data-m="list" class="${EvPrefs.mode === 'list' ? 'on' : ''}">一覧</button><button data-act="evmode" data-m="year" class="${EvPrefs.mode === 'year' ? 'on' : ''}">年ごと</button></div>
    <details class="evkinds"><summary class="muted">種類ごとに選ぶ</summary><div class="bulk">${kindBoxes}</div></details>
    <div class="chips">${chips}</div>${list || '<p class="note">まだ記録はない。</p>'}
    <p class="note">「すべて」には選んだ段・種類だけを出す (既定では細事 = 資源不足・移民を隠す)。種類のボタンで絞り込めば、隠した種類も見える。資源不足は10年以上続いたものだけを記録し、いまの不足は上の「いま起きている問題」と地図の印で見る。</p>`;
}

// 決めること (要求・出来事): 知らせが地球に届いたもの。返事は光速の指令で送り、届いた時点で効く
function decisionsHtml(g) {
  const list = g.visibleDecisions().sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0));
  const sent = g.decisions.filter((d) => d.state === 'sent').slice(-6);
  const rows = list.map((d) => {
    const btns = d.opts.map((o) => {
      const pc = g.pcCost('decide', { sys: d.sys, id: d.id, opt: o.k });
      const why = (o.cr || 0) > g.funds(g.cap) ? `資金が足りない (${o.cr} cr)` : pc > g.pc ? `政治力が足りない (${pc} 必要)` : '';
      const sub = [o.cr ? `${o.cr} cr` : '', pc ? `政治力 ${pc}` : '', o.note].filter(Boolean).join('・');
      return `<button data-act="decide" data-sys="${d.sys}" data-id="${d.id}" data-opt="${o.k}" ${why ? 'disabled' : ''}>${esc(o.label)}<small>${esc(why || sub)}</small></button>`;
    }).join('');
    const def = d.opts.find((o) => o.k === d.def);
    const limit = d.kind === 'demand' ? '' : `・${Math.round(d.deadline)}年までに返事がなければ「${def ? def.label : '?'}」`;
    return `<div class="decide"><div><span class="tag ${d.kind === 'demand' ? 'demand' : 'story'}">${d.kind === 'demand' ? '要求' : '出来事'}</span> <b>${esc(g.system(d.sys).name)}</b>
      <span class="muted">${d.year.toFixed(0)}年に起きた・${d.sys === g.cap ? '返事はすぐ届く' : `返事が届くまで ${g.lightDelay(d.sys).toFixed(1)} 年`}${limit}</span></div>
      <p class="note">${esc(d.text)}</p><div class="btns wrap">${btns}</div></div>`;
  }).join('');
  const sentRows = sent.map((d) => `<p class="note muted">${esc(g.system(d.sys).name)} へ「${esc(d.opts.find((o) => o.k === d.reply)?.label || d.reply)}」と返事を送った (届くのは ${(d.sentAt + g.lightDelay(d.sys)).toFixed(1)}年)</p>`).join('');
  return `<h3>決めること (${list.length})</h3>${rows || '<p class="note">いま決めることはない。</p>'}${sentRows}`;
}

// 議会の議席図 (政治でよく見る扇形)。100 議席を同心の半円に並べ、支持の数だけ左から白 (地球の色)、残りを赤橙で塗る。
// 15 (割ると政権交代) と 50 (政治力の増え方の境目) に目印を引く
const COUNCIL_SEATS = (() => {
  const rows = 6, seats = [], radii = Array.from({ length: rows }, (_, i) => 0.42 + (0.58 * i) / (rows - 1));
  const sum = radii.reduce((k, r) => k + r, 0);
  const counts = radii.map((r) => Math.round((100 * r) / sum));
  counts[rows - 1] += 100 - counts.reduce((k, n) => k + n, 0);
  radii.forEach((r, i) => { for (let j = 0; j < counts[i]; j++) { const a = Math.PI * (1 - j / (counts[i] - 1)); seats.push({ a, x: 100 + 92 * r * Math.cos(a), y: 100 - 92 * r * Math.sin(a) }); } });
  return seats.sort((p, q) => q.a - p.a);
})();
