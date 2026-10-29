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

// 知らせの予算 (B-048): 知らせの帯で「重大」として目立たせるのは、40 年 (遊んで約 1 時間。500 年を 10〜15 時間で遊ぶ) に 12 件まで。
// 超えた分は帯の「ほかに重大な知らせ」に数えるだけにする (イベントのタブには全部残る)
const NEWS_BUDGET = { years: 40, max: 12 };
// 自分の国に関わる知らせか: 場所のない知らせ・自国 (家臣を含む) の星系・交戦中の相手の星系。よその国どうしの出来事は帯に出さない。
// foes = 自国の交戦相手 (地球が知っている限り。呼ぶ側で 1 回だけ作って渡す)
function evConcerns(g, e, foes) {
  if (e.sys === undefined || e.sys === null || e.sys === g.cap) return true;
  const realm = g.known(e.sys)?.realm;
  if (realm === undefined || realm === null) return false;
  return realm === g.cap || foes.has(realm);
}
const evFoes = (g) => new Set(g.knownEnemiesOf(g.cap));
// 飢餓・水不足と資源不足は、出来事の流れではなく「状態」(地図の星の「!」・イベントのタブの「いま起きている問題」) で見せる
const STATE_KINDS = new Set(['famine', 'shortage']);
// 帯に出す重大な知らせ: 自国に関わるものだけを、同じ星系・同じ種類の続報を束ねてから、予算の中で目立たせる。
// skip(e) = 別の形で出すもの (返事待ちの要求)。戻り値の majors は新しい順、over は予算を超えて数えるだけにした件数
function railNews(g, evs, acked, skip) {
  const foes = evFoes(g);
  const seen = (e) => e.seen ?? e.year;
  const groups = new Map();
  for (const e of evs) { // evs は届いた順の新しいものから
    if (evTier(e.kind) < 3 || e.good || STATE_KINDS.has(e.kind) || !evShown(e.kind) || acked.has(e.id) || g.year - seen(e) >= 60 || skip(e) || !evConcerns(g, e, foes)) continue;
    const k = `${e.kind}|${e.sys}`;
    if (groups.has(k)) groups.get(k).ids.push(e.id); else groups.set(k, { e, ids: [e.id] });
  }
  const majors = [], times = [];
  let over = 0;
  for (const x of [...groups.values()].sort((a, b) => seen(a.e) - seen(b.e))) {
    const t = seen(x.e);
    while (times.length && times[0] <= t - NEWS_BUDGET.years) times.shift();
    if (times.length < NEWS_BUDGET.max) { times.push(t); majors.push(x); } else over += x.ids.length;
  }
  return { majors: majors.reverse(), over, foes };
}
// 地球が知っている、飢餓・水不足の入植地がある自国の星系の数 (地図では赤い「!」)
function famineSystems(g) { return g.knownOwnSystems().filter((x) => g.knownColonies(x.id).some((c) => c.alerts?.food || c.alerts?.water)).length; }

// 相対論の奇襲の警告 (B-055): 0.95c の艦隊は、出発の光のすぐあとに着く (光より 5% 遅れるだけ)。敵の艦隊の出発が見えたら、
// いちばん早く着ける自国の星系に向かっているとして「到着まで あと n 年」を、決めることと同じ形で帯に出す。
// 行き先は見ているだけでは分からないので、いちばん悪い場合 (いちばん近い自国の星系・いちばん速い船) で数える
const SURPRISE_YEARS = 15; // これより先に着く見込みのものだけ出す
function surpriseWarnings(g) {
  if (g.spectate) return [];
  const foes = new Set(g.knownEnemiesOf(g.cap));
  if (!foes.size) return [];
  const own = [g.system(g.cap), ...g.knownOwnSystems().filter((x) => x.id !== g.cap)];
  const v = Math.max(SHIP_SPEED, OFFROUTE_SPEED);
  const out = [];
  for (const { f, leg, mine } of g.seenFleets()) {
    if (mine || !foes.has(f.owner ?? 0) || (app.surpriseAck || new Set()).has(f.id)) continue;
    const from = g.system(leg.from ?? f.from), t0 = leg.depart ?? f.depart;
    let best = null;
    for (const s of own) {
      if (s.id === from.id) continue;
      const at = t0 + distance(from, s) / v;
      if (at > g.year && (!best || at < best.at)) best = { sys: s.id, at };
    }
    if (best && best.at - g.year <= SURPRISE_YEARS) out.push({ f, from, ...best, seenLag: g.lightDelay(from.id) });
  }
  return out.sort((a, b) => a.at - b.at);
}
function surpriseHtml(g, w) {
  const name = g.system(w.sys).name;
  return TR`<div class="dec warn"><div class="m">${tagIco('war')}奇襲のおそれ・${esc(g.realmName(w.f.owner ?? 0))}の艦隊 ${Math.round(w.f.n || 0)}</div>
    <div class="t">${esc(w.from.name)}を出た艦隊が見えた (出発の光は ${w.seenLag.toFixed(1)} 年かかって届いた)。${esc(name)}に向かっているなら、着くのは ${w.at.toFixed(1)} 年 — <b>あと ${Math.max(0, w.at - g.year).toFixed(1)} 年</b></div>
    <div class="opts"><button data-act="fly" data-sys="${w.sys}">${esc(name)}の守りを見る</button>${g.knownGarrison(g.cap) >= 1 && w.sys !== g.cap ? TR`<button data-act="fleetsel" data-sys="${g.cap}">首都の艦隊を選ぶ</button>` : ''}<button class="ghost" data-act="surpriseack" data-id="${w.f.id}">確かめた</button></div></div>`;
}

// イベントタブ: 決めること、いま起きている問題、重要なイベントの履歴
function eventsHtml(app) {
  const g = app.game;
  const f = app.eventFilter || 'all';
  const ALERT = { food: ['famine', TR('飢餓')], water: ['famine', TR('水不足')], goods: ['shortage', TR('物品不足')], industry: ['shortage', TR('原料不足')], crowd: ['migration', TR('人口過密')], aging: ['shortage', TR('高齢化 (扶養比 70 超)')] };
  const kc = g.knownOwnSystems().flatMap((x) => g.knownColonies(x.id));
  const now = kc.flatMap((c) => Object.entries(c.alerts || {}).filter(([k, on]) => on && ALERT[k]).map(([k]) => ({ c, k })));
  const kwars = g.knownSystems().flatMap((x) => g.knownWars(x.id));
  // 独立のおそれ (地球の国の星系で、不満が高まっているもの)
  const risks = g.knownSystems().filter((x) => x.id !== g.cap && (g.known(x.id)?.realm ?? g.cap) === g.cap)
    .map((x) => ({ x, o: independenceOutlook(g, x.id) })).filter(({ o }) => o && o.warn)
    .sort((a, b) => b.o.stage - a.o.stage || a.o.loyalty - b.o.loyalty);
  const riskHtml = risks.map(({ x, o }) => TR`<div class="ev major"><span class="tag politics">${esc(UNREST_LABEL[o.stage] || TR('不満の兆し'))}</span><span class="txt">${esc(x.name)}
      <span class="muted">${esc(outlookText(o, true))}・忠誠度 ${Math.round(o.loyalty)} → 目標 ${Math.round(o.target)} ${ageBadge(g, x.id)}</span></span>
      <button data-act="goto" data-sys="${x.id}">${ico('goto')}地図</button></div>`).join('');
  const wars = kwars.map((w) => {
    const n = g.nativeOf(w.sys, w.body);
    return TR`<div class="ev"><span class="tag war">${tagIco('war')}征服戦争</span><span class="txt">${esc(g.target(w.sys, w.body).name)} 対 ${esc(n?.def.species || '?')}
      <span class="muted">進捗 ${pct(w.progress)} ${ageBadge(g, w.sys)}</span></span>
      <button data-act="gobody" data-sys="${w.sys}" data-body="${esc(w.body)}">表示</button></div>`;
  }).join('');
  // 資源不足などは状態として、星系ごとにまとめて出す
  const bySys = new Map();
  for (const a of now) { if (!bySys.has(a.c.sys)) bySys.set(a.c.sys, []); bySys.get(a.c.sys).push(a); }
  const alertRow = ([sys, list]) => {
    const kinds = [...new Set(list.map(({ k }) => ALERT[k][1]))];
    const worst = list.some(({ k }) => ALERT[k][0] === 'famine') ? 'famine' : list.some(({ k }) => ALERT[k][0] === 'shortage') ? 'shortage' : 'migration';
    return TR`<div class="ev"><span class="tag ${worst}">${tagIco(worst)}${esc(kinds.join(TR('・')))}</span><span class="txt">${esc(g.system(sys).name)}
        <span class="muted">${list.map(({ c, k }) => `${esc(c.name)} (${ALERT[k][1]})`).join(TR('・'))} ${ageBadge(g, sys)}</span></span>
        <button data-act="goto" data-sys="${sys}">${ico('goto')}地図</button></div>`;
  };
  // 飢餓・水不足のある星系は1件ずつ、工業品・原料の不足と人口過密だけの星系はまとめてたたむ
  const groups = [...bySys.entries()];
  const famine = groups.filter(([, list]) => list.some(({ k }) => ALERT[k][0] === 'famine'));
  const minor = groups.filter((x) => !famine.includes(x));
  const alertHtml = famine.map(alertRow).join('') + (minor.length ? TR`<details><summary class="muted">資源不足・人口過密 (${minor.length} 星系。地図では星の右上の「!」)</summary>${minor.map(alertRow).join('')}</details>` : '');
  const nowHtml = (now.length || wars || riskHtml) ? riskHtml + wars + alertHtml : TR('<p class="note">いま問題が起きている入植地はない。</p>');
  const chips = ['all', ...Object.keys(EVENT_KIND)].map((k) => `<button data-act="evfilter" data-f="${k}" class="${k === f ? 'on' : ''}">${k === 'all' ? TR('すべて') : `${tagIco(k)}${EVENT_KIND[k]}`}</button>`).join('');
  const tiers = [3, 2, 1].map((t) => {
    const ks = Object.keys(EVENT_KIND).filter((k) => evTier(k) === t);
    const on = ks.every(evShown), some = ks.some(evShown);
    return `<button data-act="evtier" data-tier="${t}" class="${on ? 'on' : ''}">${TIER_LABEL[t]}${!on && some ? TR(' (一部)') : ''}</button>`;
  }).join('');
  const kindBoxes = Object.keys(EVENT_KIND).map((k) => `<label class="check"><input type="checkbox" data-act="evkind" data-k="${k}" ${evShown(k) ? 'checked' : ''}> ${EVENT_KIND[k]} <span class="muted">(${TIER_LABEL[evTier(k)]})</span></label>`).join(' ');
  const evs = g.knownEvents().filter((e) => (f === 'all' ? evShown(e.kind) : e.kind === f));
  const evRow = (e, more = 0) => `<div class="ev ${e.good ? 'good' : ''} ${evTier(e.kind) >= 3 && !e.good ? 'major' : ''}">
      <span class="yr">${e.year.toFixed(1)}${(e.seen ?? e.year) - e.year > 0.05 ? TR`<br><small>${((e.seen ?? e.year) - e.year).toFixed(1)}年遅れ</small>` : ''}</span><span class="tag ${e.kind}">${tagIco(e.kind)}${EVENT_KIND[e.kind] || e.kind}</span>
      <span class="txt">${esc(e.text)}${more ? TR` <span class="muted">(同じ星系で ほか ${more} 件)</span>` : ''}</span>${e.sys !== undefined && g.system(e.sys) ? TR`<button data-act="goto" data-sys="${e.sys}">${ico('goto')}地図</button>` : ''}</div>`;
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
      const sum = Object.entries(counts).map(([k, n]) => `${EVENT_KIND[k] || k} ${n}`).join(TR('・'));
      return TR`<div class="yearrep"><div class="yh">${y}年の報告</div>${major.map((e) => evRow(e)).join('')}
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
  // 見出しは報告書の題にする (QD-59 の A4)。頭の説明は「説明」に畳む (A5)
  return TR`<h2>${ME.gov} 出来事の記録 <span class="muted">${Math.floor(g.year)}年 ${Math.floor((g.year % 1) * 12) + 1}月</span></h2>
    <details class="help" data-h="evhead" ${app.helpOpen?.has('evhead') ? 'open' : ''}><summary>説明</summary><p class="note">遠い星系の出来事は、光が${ME.home}に届いてから表示される (年は起きた年)。</p></details>
    ${decisionsHtml(g)}
    <h3>いま起きている問題 (把握分 ${now.length + kwars.length + risks.length})</h3>${nowHtml}
    <h3>${ico('inspect')}総督の手紙 (委任した星系の 10 年ごとの報告)</h3>${govReportsHtml(g)}
    <h3>履歴</h3>
    <div class="chips"><span class="muted">表示する段</span>${tiers}<span class="muted">表示</span><button data-act="evmode" data-m="list" class="${EvPrefs.mode === 'list' ? 'on' : ''}">一覧</button><button data-act="evmode" data-m="year" class="${EvPrefs.mode === 'year' ? 'on' : ''}">年ごと</button></div>
    <details class="evkinds"><summary class="muted">種類ごとに選ぶ</summary><div class="bulk">${kindBoxes}</div></details>
    <div class="chips">${chips}</div>${list || TR('<p class="note">まだ記録はない。</p>')}
    <p class="note">「すべて」には選んだ段・種類だけを出す (既定では細事 = 資源不足・移民を隠す)。種類のボタンで絞り込めば、隠した種類も見える。資源不足は10年以上続いたものだけを記録し、いまの不足は上の「いま起きている問題」と地図の印で見る。</p>`;
}

// 決めること (要求・出来事): 知らせが地球に届いたもの。返事は光速の指令で送り、届いた時点で効く
function decisionsHtml(g) {
  const list = g.visibleDecisions().sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0));
  const sent = g.decisions.filter((d) => d.state === 'sent').slice(-6);
  const rows = list.map((d) => {
    const btns = d.opts.map((o) => {
      const pc = g.pcCost('decide', { sys: d.sys, id: d.id, opt: o.k });
      const why = (o.cr || 0) > g.funds(g.cap) ? TR`資金が足りない (${o.cr} cr)` : pc > g.pc ? TR`政治力が足りない (${pc} 必要)` : '';
      const sub = [o.cr ? `${o.cr} cr` : '', pc ? TR`政治力 ${pc}` : '', o.note].filter(Boolean).join(TR('・'));
      return `<button data-act="decide" data-sys="${d.sys}" data-id="${d.id}" data-opt="${o.k}" ${why ? 'disabled' : ''}>${esc(o.label)}<small>${esc(why || sub)}</small></button>`;
    }).join('');
    const def = d.opts.find((o) => o.k === d.def);
    const limit = d.kind === 'demand' ? '' : TR`・${Math.round(d.deadline)}年までに返事がなければ「${def ? def.label : '?'}」`;
    return TR`<div class="decide"><div><span class="tag ${d.kind === 'demand' ? 'demand' : 'story'}">${d.kind === 'demand' ? TR('要求') : TR('出来事')}</span> <b>${esc(g.system(d.sys).name)}</b>
      <span class="muted">${d.year.toFixed(0)}年に起きた・${d.sys === g.cap ? TR('返事はすぐ届く') : TR`返事が届くまで ${g.lightDelay(d.sys).toFixed(1)} 年`}${limit}</span></div>
      <p class="note">${esc(d.text)}</p><div class="btns wrap">${btns}</div></div>`;
  }).join('');
  const sentRows = sent.map((d) => TR`<p class="note muted">${esc(g.system(d.sys).name)} へ「${esc(d.opts.find((o) => o.k === d.reply)?.label || d.reply)}」と返事を送った (届くのは ${(d.sentAt + g.lightDelay(d.sys)).toFixed(1)}年)</p>`).join('');
  return TR`<h3>決めること (${list.length})</h3>${rows || TR('<p class="note">いま決めることはない。</p>')}${sentRows}`;
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
