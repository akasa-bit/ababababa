function starRow(s) {
  return `<tr><td>${starIcon([s])}${esc(s.name)}</td><td>${s.label}</td>
    <td>${fmt(s.mass)} M☉</td><td>${Math.round(s.temp)} K</td><td>${fmt(s.lum, 3)} L☉</td></tr>`;
}

// 人口[百万人]の表示。例: 0.2 → 20万人、10000 → 100億人
function fmtPop(m) {
  if (m >= 100) return `${(m / 100).toFixed(m >= 1000 ? 0 : 1)}億人`;
  if (m >= 0.01) return `${(m * 100).toFixed(m >= 1 ? 0 : 1)}万人`;
  return `${Math.round(m * 1e6).toLocaleString()}人`;
}
function fmtAmt(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}k`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return a >= 10 ? v.toFixed(0) : v.toFixed(1);
}
const pct = (v) => `${Math.round(v * 100)}%`;
// エネルギー [J] を SI の接頭語で (1.2 YJ など)
function fmtJ(v) {
  const a = Math.abs(v);
  if (!a) return '0 J';
  const P = [[1e30, 'QJ'], [1e27, 'RJ'], [1e24, 'YJ'], [1e21, 'ZJ'], [1e18, 'EJ'], [1e15, 'PJ'], [1e12, 'TJ'], [1e9, 'GJ'], [1e6, 'MJ'], [1e3, 'kJ'], [1, 'J']];
  const [k, u] = P.find(([x]) => a >= x) || P[P.length - 1];
  const x = v / k;
  return `${Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2)} ${u}`;
}
// 研究の表 (自国の技術の水準と研究者。首都の値なので光の遅れはない)
function researchHtml(g) {
  const T = g.tech[g.cap];
  if (!T) return '';
  const label = { farm: '農業', mine: '鉱業', ind: '工業' };
  const rows = RESEARCH.fields.map((f) => `<tr><th>${label[f]}の技術</th><td>×${T.A[f].toFixed(3)}</td></tr>`).join('');
  return `<h3>${ME.gov}の研究</h3><table class="tbl">${rows}<tr><th>研究者</th><td>${fmtAmt(T.S || 0)} 人</td></tr></table>
    <p class="note">技術の水準は 1 人あたりの産出に掛かる。研究者の数は人口と所得で決まり、分野には付加価値の比で分かれる。研究者 1 人あたりの研究の生産性は、技術が進むほど下がる (アイデアは見つけにくくなる)。</p>`;
}
// 1 人あたりの実質の所得 (2011 年の国際ドル。構造転換の物差し)
const incomeText = (y) => `${Math.round(y || 0).toLocaleString('en-US')} ドル/人`;
// 就業の割合 (農・鉱・工・サービス)。short なら表のための短い形
const shareText = (c, short = false) => {
  const sh = c.sh || sharesOf(c.focus);
  const parts = [['農', sh.farm], ['鉱', sh.mine], ['工', sh.ind], [short ? 'サ' : 'サービス', sh.serv], ...(sh.home > 0.015 ? [[short ? '自' : '自給', sh.home]] : [])].map(([l, v]) => `${l}${short ? Math.round(v * 100) : pct(v)}`);
  return parts.join(short ? ' ' : '・');
};
// 開始の画面で選んだ生産性の倍率 (自分で決めた値は決まった幅に収める)
const productivityOf = (key, k) => (key === 'custom' ? clamp(Number.isFinite(k) && k > 0 ? k : 1, ...PRODUCTIVITY_RANGE) : (PRODUCTIVITY[key] || PRODUCTIVITY.now).k);
// shield = 遮蔽 ÷ 船の質量 (星間の気体と宇宙線の遮蔽。物理のある試合の入植船。docs/physics.md の 5)。エネルギーには入れてある
const costText = (cost) => Object.entries(cost).map(([k, v]) => (k === 'credits' ? `${fmtAmt(v)} cr` : k === 'energy' ? `エネルギー ${fmtJ(v)}` : k === 'shield' ? `遮蔽 ${Math.round(100 * v)}%` : `${RES_LABEL[k]} ${fmtAmt(v)}`)).join('・');
// 資源の名前にアイコンを添える (HTML)。費用は資金も含めてアイコンつきで並べる
const resText = (r) => `${ico(r)}${RES_LABEL[r]}`;
const costHtml = (cost) => Object.entries(cost).map(([k, v]) => (k === 'credits' ? `${ico('credits')}${fmtAmt(v)} cr` : k === 'energy' ? `エネルギー ${fmtJ(v)}` : k === 'shield' ? `遮蔽 ${Math.round(100 * v)}%` : `${resText(k)} ${fmtAmt(v)}`)).join('・');
// 出来事の種類のアイコン (種類の札・知らせの帯)
const KIND_ICON = { battle: 'war', war: 'war', famine: 'food', shortage: 'goods', colony: 'colony', pirate: 'pirate', natives: 'natives', politics: 'loyalty', demand: 'council', migration: 'migration', trade: 'route', goal: 'goal' };
const tagIco = (kind) => ico(KIND_ICON[kind]);

// 費用つきボタン。払えないときは理由を添えて無効化する
function costButton(g, attrs, label, cost, sysId, extraReason = '') {
  // 太陽系以外での行動は光速の指令になる。向こうの最新の懐具合は分からないので、届いてから実行の可否が決まる
  if (sysId !== undefined && sysId !== g.cap) {
    const c = pcCostOf(g.lightDelay(sysId));
    const pc = g.isDirect(sysId) ? Math.max(1, Math.ceil(c / 2)) : c;
    const why = extraReason || (pc > g.pc ? `政治力が足りない (${pc} 必要)` : '');
    const sub = why ? esc(why) : `指令: 届くまで ${g.lightDelay(sysId).toFixed(1)} 年・${ico('pc')}政治力 ${pc}${cost ? `・${costHtml(cost)}` : ''}`;
    return `<button ${attrs} ${why ? 'disabled' : ''}>${label}<small>${sub}</small></button>`;
  }
  const p = cost && !extraReason ? g.procure(cost, sysId) : null;
  const why = extraReason || p?.why || '';
  const sub = why ? esc(why) : (cost ? costHtml(cost) + (p?.eta > 0 ? ` ・資材搬入 ${p.eta.toFixed(1)}年 (${p.aid ? '主人からの支援' : `輸入費 ${Math.ceil(p.imp || 0)} cr`})` : '') : '');
  return `<button ${attrs} ${why ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
}

// 右の欄: いちばん上に要約 (名前・所属・情報の古さ・数字・いまの状態・よく使う操作)、そのあとは開け閉めできる節。
// 節の見出しの右には、開かなくても分かる一言 (要約) を出す
const EVENT_TONE = { battle: 'enemy', war: 'enemy', pirate: 'enemy', famine: 'enemy', politics: 'warn', demand: 'warn', shortage: 'warn', story: 'info', goal: 'info', natives: 'info', colony: 'good', migration: 'info', trade: 'info' };
function sec(key, title, syn, html, cls = '') {
  if (!html) return '';
  const open = app.secOpen?.[key] ?? false;
  return `<details class="sec" data-sec="${key}" ${open ? 'open' : ''}><summary>${title}<span class="syn ${cls}">${syn}</span></summary>${html.replace(/^\s*<h3>[\s\S]*?<\/h3>/, '')}</details>`;
}
// いまの状態 (色は意味: 赤 = 敵・危険、橙 = 警告、青 = 情報、緑 = 良い)
function sysFlags(g, sys, k, cols) {
  const id = sys.id;
  const realm = id === g.cap ? g.realmOf(id) : k?.realm ?? null;
  const vassal = id !== g.cap && k && k.lord !== null && k.lord !== undefined;
  const flags = [];
  if (cols.length && realm !== null) {
    const enemies = g.knownEnemiesOf(realm);
    if (enemies.length && (realm !== g.cap || id === g.cap)) flags.push(['enemy', `${enemies.map((e) => g.realmName(e)).join('・')}と交戦中`]);
  }
  if (k?.siege) flags.push(['enemy', `攻囲されている: ${g.realmName(k.siege.realm)} ${k.siege.ships} 艦隊・${pct(k.siege.progress)}`]);
  if (k?.battle) flags.push(['enemy', `艦隊戦: ${Math.ceil(k.battle.a)} 対 ${Math.ceil(k.battle.d)} 艦隊`]);
  if (vassal && realm === g.cap) {
    const o = independenceOutlook(g, id);
    if (o?.stage) flags.push([o.stage >= 3 ? 'enemy' : 'warn', UNREST_LABEL[o.stage], outlookText(o, true)]);
    else if (o?.warn) flags.push(['warn', '不満の兆し', outlookText(o, true)]);
    const neglect = Math.max(0, g.year - (k.attended ?? k.founded ?? k.year));
    if (neglect > NEGLECT_GRACE) flags.push(['warn', `放っておかれて ${Math.floor(neglect)} 年`, '視察団・指令・資金援助で戻る']);
    if ((k.autonomy || 0) > g.year) flags.push(['info', `自治を認めている (${Math.round(k.autonomy)}年まで)`]);
    else if ((k.taxFree || 0) > g.year) flags.push(['info', `朝貢を免除している (${Math.round(k.taxFree)}年まで)`]);
    if (k.direct) flags.push(['own', '直轄']);
    else if (k.regime) flags.push([REGIMES[regimeNorm(k.regime)]?.forced ? 'warn' : 'info', REGIMES[regimeNorm(k.regime)]?.label || k.regime]);
  }
  const famine = cols.filter((c) => c.alerts?.food || c.alerts?.water).length;
  const short = cols.filter((c) => c.alerts?.goods || c.alerts?.industry).length;
  if (famine) flags.push(['enemy', `飢餓・水不足 (${famine} か所)`]);
  else if (short) flags.push(['warn', `工業品・原料の不足 (${short} か所)`]);
  const wars = k?.wars?.length || 0;
  if (wars) flags.push(['warn', `先住民との征服戦争 (${wars})`]);
  return flags;
}
function sysHead(g, sys, k, cols) {
  const id = sys.id;
  const realm = id === g.cap ? g.realmOf(id) : k?.realm ?? null;
  const pop = cols.reduce((a, c) => a + c.pop, 0);
  const vassal = id !== g.cap && k && k.lord !== null && k.lord !== undefined;
  const owner = cols.length ? (realm === g.cap ? `${ME.realm}` : realm === id && k?.independent ? '独立国の首都' : `${g.realmName(realm)}`) : '未入植';
  const tiles = [];
  if (cols.length) tiles.push([`${ico('pop')}人口`, fmtPop(pop)]);
  const flags = sysFlags(g, sys, k, cols);
  if (vassal && realm === g.cap) tiles.push([`${ico('loyalty')}忠誠度`, `<span class="${(k.loyalty ?? LOYALTY_START) < UNREST_AT ? 'bad' : ''}">${Math.round(k.loyalty ?? LOYALTY_START)}</span>`]);
  tiles.push([`${ico('fleet')}艦隊`, shipsSeen(g, id, g.knownGarrison(id))]);
  if (cols.length) tiles.push([id === g.cap ? `${ico('credits')}収入/年` : `${ico('credits')}資金`, id === g.cap ? fmtAmt(g.income()) : fmtAmt(k?.credits || 0)]);
  const dot = starIcon(sys.stars, 'big');
  const realmDot = cols.length ? `<span class="dot" style="background:${realmColor(realm)}"></span>` : '';
  return `<div class="syshead"><h2>${dot}${esc(sys.name)}<button class="x" data-act="deselect" title="選択を外す (Esc・地図の何もないところを押しても外れる)" aria-label="選択を外す">✕</button></h2>
    <div class="meta"><span>${realmDot}${esc(owner)}</span><span>${ME.capName}から ${distance(g.system(g.cap), sys).toFixed(1)} ly</span>${ageBadge(g, id)}${sys.cat ? `<span class="muted" title="実在の恒星 (CNS5)。銀河面からの高さ ${fmt(sys.z, 1)} 光年">実在 ${esc(sys.cat)}</span>` : ''}</div>
    <div class="stats">${tiles.map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    ${flags.length ? `<ul class="flags">${flags.map(([c, a, b]) => `<li class="${c}">${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}</li>`).join('')}</ul>` : ''}</div>`;
}
function systemPanel(app) {
  if (app.sel.sys === null) return ''; // 選んでいないときは欄ごと隠れている
  const g = app.game;
  const sys = g.system(app.sel.sys);
  const id = sys.id;
  const k = g.known(id);
  const cols = g.knownColonies(id);
  const colonized = cols.length > 0;
  const realm = id === g.cap ? g.realmOf(id) : k?.realm ?? null;
  // よく使う操作: 星系マップ、この艦隊を選ぶ、他国なら講和・宣戦
  const acts = [`<button data-act="open">星系マップを開く</button>`];
  if (isOwnStack(g, id)) acts.push(`<button data-act="fleetsel" data-sys="${id}">この艦隊を選ぶ<small>地図で移動先を右クリック/タップ</small></button>`);
  if (colonized && realm !== g.cap && realm !== null) {
    acts.push(g.knownAtWar(g.cap, realm) ? `<button data-act="peace" data-sys="${realm}">${ico('peace')}講和を申し入れる<small>届くまで ${g.lightDelay(realm).toFixed(1)} 年・政治力 ${PC_DIPLOMACY}</small></button>`
      : `<button data-act="declarewar" data-sys="${realm}">${ico('war')}${esc(g.system(realm).name)} の国に宣戦<small>政治力 ${PC_DIPLOMACY}</small></button>`);
  }
  if (colonized && realm === g.cap && id !== g.cap && k?.lord !== null && k?.lord !== undefined) acts.push(`<button data-act="inspect" data-sys="${id}" ${g.pc < g.pcCost('inspect', { sys: id }) ? 'disabled' : ''}>${ico('inspect')}視察団を送る<small>関与になる・政治力 ${g.pcCost('inspect', { sys: id })}・届くまで ${g.lightDelay(id).toFixed(1)} 年</small></button>`);
  const o = colonized && id !== g.cap ? independenceOutlook(g, id) : null;
  const pop = cols.reduce((a, c) => a + c.pop, 0);
  const st = k?.stock;
  const lacking = st && k.cons ? RES.filter((r) => k.prod[r] < k.cons[r] - 0.001 && st[r] < k.cons[r]).map((r) => resText(r)) : [];
  const nRoutes = g.routes.filter((r) => (r.a === id || r.b === id) && g.routeKnown(r)).length;
  const natives = g.isSurveyed(id) ? sys.bodies.filter((b) => b.natives).length : 0;
  const govHtml = govBox(g, id);
  return `${sysHead(g, sys, k, cols)}
    <div class="acts">${acts.join('')}</div>
    ${app.view === 'system' ? bodyList(app, sys) : ''}
    ${sec('gov', `${ico('credits')}政府と資金`, colonized ? (id === g.cap ? `資金 ${fmtAmt(g.credits)} cr` : `資金 ${fmtAmt(k?.credits || 0)} cr${k?.bond > 0 ? `・国債 ${fmtAmt(k.bond)} cr` : ''}・収入 ${fmtAmt(k?.income || 0)}/年${k?.hh > 0 || k?.loan > 0 ? `・家計の預金 ${fmtAmt(k.hh || 0)} cr・会社の借り ${fmtAmt(k.loan || 0)} cr` : ''}`) : '', govHtml)}
    ${colonized ? sec('energy', 'エネルギー', `蓄え ${fmtJ(id === g.cap ? g.energyOf(id) : k?.energy || 0)}`, energyBox(g, id, k)) : ''}
    ${o ? sec('loyal', `${ico('loyalty')}忠誠と統治`, outlookText(o, true), loyaltyBox(g, id), o.warn ? 'warn' : '') : ''}
    ${colonized ? sec('cols', `${ico('colony')}入植地と採掘基地`, `${cols.length} か所・${fmtPop(pop)}`, `<ul>${cols.map((c) => `<li>${esc(c.name)} — ${KIND_LABEL[c.kind]} <span class="muted">人口 ${fmtPop(c.pop)}</span></li>`).join('')}</ul>${outpostList(g, sys)}${id === 0 ? `${autoToggle(g, id)}<p class="note">オンにすると、生産が需要に届かない資源を年に1回選び、惑星上の施設 (農場・鉱山・工場) や採掘基地を自動で建てる。過密な入植地では居住区も拡張し、${ME.capName}の空いている天体には宇宙ステーションも建てる (10年に1つまで。資金が費用の2倍以上あるとき)。</p>` : ''}`) : ''}
    ${colonized ? sec('stock', `${ico('goods')}備蓄`, lacking.length ? `足りない: ${lacking.join('・')}` : '足りている', stockBox(g, id), lacking.length ? 'warn' : '') : ''}
    ${colonized ? sec('routes', `${ico('route')}交易路`, `${nRoutes} 本`, routeBox(app, sys)) : ''}
    ${sec('mil', `${ico('war')}軍事`, `駐留 ${shipsSeen(g, id, g.knownGarrison(id))} 艦隊`, militaryBox(app, sys))}
    ${natives ? sec('natives', `${ico('natives')}先住民`, `${natives} つ`, nativesSummary(g, sys)) : ''}
    ${sec('star', `${starIcon(sys.stars)}恒星`, `${sys.stars[0].label} ${sys.stars.length > 1 ? `${sys.stars.length}重星系` : '単独星'}・惑星 ${sys.bodies.filter((b) => b.type !== 'belt').length}`, `<table class="tbl"><tr><th>恒星</th><th>型</th><th>質量</th><th>表面温度</th><th>光度</th></tr>${sys.stars.map(starRow).join('')}</table>${sys.stars.slice(1).map((s) => `<p class="note">${esc(s.name)} は主星から約 ${fmt(s.sep)} AU</p>`).join('')}`)}`;
}
// 説明文は「説明」を押したときだけ開く (短い注意書きと、赤・緑の状態の文はそのまま出す)。開いたかは覚えておく
function helpify(html) {
  return html.replace(/<p class="note">([\s\S]*?)<\/p>/g, (all, inner) => {
    const plain = inner.replace(/<[^>]+>/g, '');
    if (plain.length < 50) return all;
    let h = 0;
    for (let i = 0; i < Math.min(plain.length, 80); i++) h = (h * 31 + plain.charCodeAt(i)) | 0;
    const key = `h${h}`;
    return `<details class="help" data-h="${key}" ${app.helpOpen?.has(key) ? 'open' : ''}><summary>説明</summary><p class="note">${inner}</p></details>`;
  });
}
// 地図の左上の知らせの帯: 決めること (返事のボタンつき)、まだ確かめていない重大な知らせ (✓ で消す)、新しい普通の知らせ (10秒ほどで流れて消える)。
// 押すと地図がその星系へ飛ぶ。古い知らせほど薄い
const railHidden = () => app.railHidden ?? $('stage').clientWidth < 480;
// 作戦の手引き (B-043): 最初の時代のあいだ、知らせの帯の一番上に、次の一手と時代の課題を出す
function guideHtml(g) {
  const gd = app.guideHidden ? null : g.guideSteps();
  if (!gd) return '';
  const st = gd.steps[gd.now];
  let go = '';
  if (gd.now === 0 && st.pick) {
    const p = st.pick;
    go = costButton(g, `data-act="candsend" data-sys="${p.sys}" data-body="${esc(p.body)}" data-kind="${p.kind}" data-from="${g.cap}"`, `${ico(p.kind === 'planet' ? 'planetcol' : 'station')}入植船を送る`, g.shipCost(p.kind, g.cap, p.sys), g.cap, '')
      + `<button data-act="gobody" data-sys="${p.sys}" data-body="${esc(p.body)}">天体を見る</button>`;
  } else if (gd.now === 0) go = '<button data-act="view" data-v="cands">候補地を開く</button>';
  else if (st.sys !== undefined) go = `<button data-act="fly" data-sys="${st.sys}">${esc(g.system(st.sys).name)}へ</button>`;
  return `<div class="dec guide"><div class="m">${ico('goal')}作戦の手引き・最初の時代 (${START_YEAR}〜${START_YEAR + ERA_YEARS}年)</div>
    <ol>${gd.steps.map((x, i) => `<li class="${x.done ? 'done' : i === gd.now ? 'now' : ''}">${x.done ? '✓ ' : ''}${esc(x.label)}</li>`).join('')}</ol>
    ${app.awaitFirst ? '<div class="m">時間は止まっている。入植船を送ると動きはじめる</div>' : ''}
    <div class="opts">${go}<button class="ghost" data-act="guidehide">手引きを隠す</button></div>
    <div class="m">時代の課題: ${gd.tasks.map((tk) => esc(tk.label)).join(' / ')}</div></div>`;
}
function railHtml(g) {
  const now = performance.now();
  // 新しいゲーム・ロードのときは数え直す (それまでの出来事は「新しい知らせ」として流さない)
  if (app.railGame !== g) { app.railGame = g; app.railFirst = new Map(); app.railSince = g.year; Forecast.list = []; }
  forecastTick(g);
  const acked = new Set(g.acked || []);
  const evs = g.knownEvents();
  let fresh = false;
  for (const e of evs) if ((e.seen ?? e.year) > app.railSince && !app.railFirst.has(e.id)) { app.railFirst.set(e.id, now); app.railNewest = now; fresh = true; }
  const decs = g.visibleDecisions().sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0));
  const decSys = new Set(decs.filter((d) => d.kind === 'demand').map((d) => d.sys)); // 返事待ちの要求は、知らせではなく「決めること」として出す
  const news = railNews(g, evs, acked, (e) => e.kind === 'demand' && decSys.has(e.sys));
  const majors = news.majors;
  // 音: 帯で目立たせる重大な知らせ・決めることが新しく届いたとき (B-047。音の素材が入るまでは鳴らない)
  if (fresh && majors.some((x) => app.railFirst.get(x.e.id) === now)) Sound.play('warn');
  const decIds = decs.map((d) => String(d.id));
  if (app.railDecs && decIds.some((id) => !app.railDecs.includes(id))) Sound.play('decide');
  app.railDecs = decIds;
  const inMajor = new Set(majors.flatMap((x) => x.ids));
  // 届いたばかりの普通の知らせ (10 秒で薄れて消える) も、自国に関わるものだけ。飢餓と不足は「状態」の行に任せる
  const recent = evs.filter((e) => !inMajor.has(e.id) && !(e.kind === 'demand' && decSys.has(e.sys)) && !STATE_KINDS.has(e.kind) && evShown(e.kind) && evTier(e.kind) >= 2 && now - (app.railFirst.get(e.id) ?? -1e9) < 10000 && evConcerns(g, e, news.foes)).slice(0, 3);
  const hungry = evShown('famine') ? famineSystems(g) : 0;
  // 講和会議 (自分が条件を選ぶもの) と、自分への講和の申し入れ
  const diplo = [
    ...g.conferences.filter((c) => c.bids.some((b) => b.realm === g.cap && !b.picks)).map((c) => `<div class="dec"><div class="m">講和会議・${Math.floor(c.until)}年までに選ぶ (選ばなければ自動)</div>
      <div class="t">${esc(g.realmName(c.loser))}との講和会議。持ち点 ${c.bids.find((b) => b.realm === g.cap).pts} で条件を選ぶ</div>
      <div class="opts"><button data-act="treatyopen" data-id="${c.id}">${ico('peace')}条件を選ぶ</button></div></div>`),
    ...g.peaceOffers.filter((o) => o.to === g.cap).map((o) => `<div class="dec"><div class="m">講和の申し入れ・${Math.floor(o.until)}年まで</div>
      <div class="t">${esc(g.realmName(o.from))}が講和を申し入れている (戦勝点 ${g.warScore(g.cap, o.from)}。勝っている側が講和会議で条件を選ぶ)</div>
      <div class="opts"><button data-act="acceptpeace" data-key="${o.key}">${ico('peace')}講和に応じる</button></div></div>`),
  ];
  const guide = guideHtml(g);
  const surprise = surpriseWarnings(g);
  if (surprise.some((w) => !(app.surpriseSeen ||= new Set()).has(w.f.id))) { for (const w of surprise) app.surpriseSeen.add(w.f.id); Sound.play('warn'); }
  const n = decs.length + majors.length + diplo.length + (guide ? 1 : 0) + (hungry ? 1 : 0) + surprise.length;
  // 地図が狭いときは、帯を畳んだ形 (件数だけのボタン) から始める。帯が地図を覆ってタップを邪魔しないように
  if (railHidden()) return `<div class="railbar"><button data-act="railtoggle"${decs.length ? ' class="due"' : ''}>${n ? `知らせ ${n} 件を出す` : '知らせを出す'}</button></div>`;
  if (!n && !recent.length && !news.over) return '';
  const place = (sys) => (sys !== undefined && g.system(sys) ? g.system(sys).name : '');
  const when = (e) => {
    const ago = g.year - e.year, late = (e.seen ?? e.year) - e.year;
    return `${place(e.sys)}・${ago < 0.5 ? 'いま' : `${Math.round(ago)}年前`}${late >= 0.5 ? ` (${Math.round(late)}年遅れで届いた)` : ''}`;
  };
  // ids = 束ねた続報 (重大な知らせだけ)。✓ で束ごと確かめる
  const item = (e, major, ids = [e.id]) => {
    const fade = major ? 1 : clamp((10000 - (now - (app.railFirst.get(e.id) ?? now))) / 3000, 0.35, 1);
    const more = ids.length > 1 ? ` (同じ星系の続報 ほか ${ids.length - 1} 件)` : '';
    return `<div class="ri ${e.good ? 'good' : EVENT_TONE[e.kind] || ''}" style="opacity:${fade.toFixed(2)}">
      <button data-act="fly" data-sys="${e.sys ?? 0}"><span class="t">${tagIco(e.kind)}${esc(e.text)}</span><span class="m">${esc(when(e) + more)}</span></button>
      ${major ? `<button class="ack" data-act="ack" data-id="${ids.join(',')}" aria-label="確かめた">✓</button>` : '<span></span>'}</div>`;
  };
  const dec = (d) => `<div class="dec"><div class="m">${d.kind === 'demand' ? '要求' : '出来事'}・${esc(place(d.sys))}${d.kind === 'demand' ? '' : `・${Math.round(d.deadline)}年までに返事`}${d.sys === g.cap ? '' : `・返事は ${g.lightDelay(d.sys).toFixed(0)} 年で届く`}</div>
    <div class="t clamp3">${esc(d.text)}</div>
    <div class="opts">${d.opts.map((o) => {
      const pc = g.pcCost('decide', { sys: d.sys, id: d.id, opt: o.k });
      const why = (o.cr || 0) > g.funds(g.cap) ? '資金が足りない' : pc > g.pc ? '政治力が足りない' : '';
      return `<button data-act="decide" data-sys="${d.sys}" data-id="${d.id}" data-opt="${o.k}" ${why ? 'disabled' : ''} title="${esc(o.note || '')}">${esc(o.label)}<small>${esc(why || [o.cr ? `${o.cr} cr` : '', pc ? `政治力 ${pc}` : ''].filter(Boolean).join('・') || '費用なし')}</small><small class="clamp2">${esc(o.note || '')}</small></button>`;
    }).join('')}</div></div>`;
  const shownMajors = majors.slice(0, 3);
  const moreN = majors.slice(3).reduce((k, x) => k + x.ids.length, 0) + news.over;
  return `${surprise.slice(0, 2).map((w) => surpriseHtml(g, w)).join('')}${guide}${diplo.join('')}${decs.slice(0, 2).map(dec).join('')}${decs.length > 2 ? `<div class="more">ほかに決めること ${decs.length - 2} 件 (イベント)</div>` : ''}
    ${hungry ? `<button class="state" data-act="view" data-v="events">${tagIco('famine')}飢餓・水不足の星系 ${hungry} — 地図の赤い「!」</button>` : ''}
    ${shownMajors.map((x) => item(x.e, true, x.ids)).join('')}${moreN ? `<button class="more" data-act="view" data-v="events">ほかに重大な知らせ ${moreN} 件 (イベントのタブ)</button>` : ''}
    ${recent.map((e) => item(e, false)).join('')}
    <div class="railbar">${majors.length > 1 ? '<button data-act="ackall">重大な知らせをすべて確かめた</button>' : ''}<button data-act="railtoggle">隠す</button></div>`;
}

