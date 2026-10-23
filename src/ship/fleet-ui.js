// --- 星間マップでの艦隊の操作 (Hearts of Iron 風) ---
// 地球の艦隊が (地球に届いている情報で) 駐留している星系か: 地球の国の星系か、入植していない星系
function isOwnStack(g, id) {
  if (g.knownGarrison(id) < 1) return false;
  return g.ownStackKnown(id);
}
// 交戦中でない他国の星系 (送ると奇襲攻撃になる)
function isSurpriseTarget(g, id) {
  const k = id === g.cap ? null : g.known(id);
  const realm = k && k.cols.length ? k.realm : null;
  return realm !== null && realm !== undefined && realm !== g.cap && !g.knownAtWar(g.cap, realm);
}
// 選んだ艦隊に移動命令を出す。太陽系以外の艦隊への命令は光速で届く。中立国の星系なら確認してから (奇襲攻撃)
function hasFleetSelection() { return app.fleetSel.size > 0 || app.fleetMove.size > 0; }
// target は行き先の星系、または経由地の列 (長押しで引いた線。順に回る)
function orderFleets(target) {
  const g = app.game;
  const route = Array.isArray(target) ? target : [target];
  const first = route[0];
  const rest = route.slice(1);
  const ids = [...app.fleetSel].filter((id) => id !== first);
  const moving = [...app.fleetMove];
  if (!ids.length && !moving.length) return;
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
  if (route.some((id) => isSurpriseTarget(g, id)) && !same(app.fleetConfirm, route)) {
    app.fleetConfirm = route;
    renderFleetBar();
    return;
  }
  PlayLog.add('fleet', { from: ids, moving: moving.length, route, amount: app.fleetAmount });
  let sent = 0;
  for (const id of ids) {
    const have = g.knownGarrison(id);
    const n = app.fleetAmount === 'all' ? 'all' : app.fleetAmount === 'half' ? Math.max(1, Math.floor(have / 2)) : 1;
    if (issue('fleet', { from: id, sys: first, n, route: rest.length ? rest : undefined }).ok) sent++;
  }
  // 移動中の艦隊: 光速の指令が追いついた地点から進路を変える。地球にはまだ移動中に見えていても実はもう着いていれば、着いた星系から送り直す
  for (const id of moving) {
    const f = g.fleets.find((x) => x.id === id);
    const ghost = f ? null : g.ghosts.fleets.find((x) => x.id === id);
    if (f && issue('sendredirect', { fleet: f.id, sys: first, route: rest }).ok) sent++;
    else if (ghost && issue('fleet', { from: ghost.to, sys: first, n: ghost.n, route: rest.length ? rest : undefined }).ok) sent++;
  }
  uiNote(`${sent} 件の艦隊に ${route.map((id) => g.system(id).name).join(' → ')} への移動を命じた`);
  app.fleetSel.clear();
  app.fleetMove.clear();
  app.fleetConfirm = null;
  app.dirty = true;
  renderFleetBar();
  save();
}
// 選んだ艦隊への既存の指令 (命令による駐留・経由地) を取り消す。太陽系以外へは光速で届く (移動中の艦隊へは追いついた地点で効く)。
// 取り消した艦隊は自動防衛配備に任せる。移動中の艦隊は、いまの行き先までは進む
function clearFleetSelOrders() {
  const g = app.game;
  PlayLog.add('fleetclear', { from: [...app.fleetSel], moving: app.fleetMove.size });
  let sent = 0;
  for (const id of app.fleetSel) if (issue('fleetclear', { sys: id }).ok) sent++;
  for (const id of app.fleetMove) {
    const f = g.fleets.find((x) => x.id === id);
    const ghost = f ? null : g.ghosts.fleets.find((x) => x.id === id);
    if (f && issue('sendclear', { fleet: f.id }).ok) sent++;
    else if (ghost && issue('fleetclear', { sys: ghost.to }).ok) sent++;
  }
  if (!sent) return;
  uiNote(`${sent} 件の艦隊に、指令の取り消しを送った`);
  app.fleetSel.clear();
  app.fleetMove.clear();
  app.fleetConfirm = null;
  app.dirty = true;
  renderFleetBar();
  save();
}
const FLEET_AMOUNT = { all: '全艦', half: '半数', one: '1艦隊' };
function renderFleetBar() {
  const bar = $('fleetbar');
  const g = app.game;
  for (const id of [...app.fleetSel]) if (!isOwnStack(g, id)) app.fleetSel.delete(id);
  for (const id of [...app.fleetMove]) if (!g.fleets.some((f) => f.id === id) && !g.ghosts.fleets.some((f) => f.id === id)) app.fleetMove.delete(id);
  if (app.view !== 'galaxy' || !hasFleetSelection()) { bar.hidden = true; app.fleetConfirm = null; return; }
  const fleetOf = (id) => g.fleets.find((f) => f.id === id) || g.ghosts.fleets.find((f) => f.id === id);
  const total = [...app.fleetSel].reduce((k, id) => k + g.knownGarrison(id), 0) + [...app.fleetMove].reduce((k, id) => k + (fleetOf(id)?.n || 0), 0);
  const confRoute = app.fleetConfirm;
  const conf = confRoute ? g.system(confRoute.find((id) => isSurpriseTarget(g, id)) ?? confRoute[0]) : null;
  const realm = conf ? g.known(conf.id)?.realm : null;
  // 地球の知る限りの既存の指令: 命令による駐留・経由地
  const heldK = [...app.fleetSel].filter((id) => (id === g.cap ? g.held[id] : g.known(id)?.held) > 0).length;
  const routeK = [...app.fleetMove].filter((id) => fleetOf(id)?.route?.length).length;
  const orders = [heldK ? `駐留命令 ${heldK} か所` : '', routeK ? `経由地つき ${routeK}` : ''].filter(Boolean).join('・');
  setHtml(bar, `<b class="lbl">選択中の艦隊</b><span>${app.fleetSel.size ? `${app.fleetSel.size} か所` : ''}${app.fleetSel.size && app.fleetMove.size ? '・' : ''}${app.fleetMove.size ? `移動中 ${app.fleetMove.size}` : ''}・${total} 艦隊</span>
    <span><span class="lbl">送る数</span> ${Object.entries(FLEET_AMOUNT).map(([k, l]) => `<button data-fa="amount" data-v="${k}" class="${app.fleetAmount === k ? 'on' : ''}">${l}</button>`).join('')}</span>
    <span class="muted hint">移動先を右クリック (タッチ操作はタップ)・Shift+クリックで追加・Shift+ドラッグで範囲選択・移動中の艦隊 (三角) も選べる (指令は光速で追いついた地点から効く。送る数は全艦)・長押し (右ドラッグ) で線を引くと、触れた星系を順に回る</span>
    <button data-fa="clear">選択を解除</button>
    <button data-fa="orders" title="命令による駐留と経由地をやめ、自動防衛配備に任せる (Delete キー)。移動中の艦隊はいまの行き先までは進む">指令を取り消す${orders ? ` <small>(${orders})</small>` : ''}</button>
    ${conf ? `<div class="warn">⚠ ${esc(conf.name)} は${esc(g.realmName(realm))}の星系。奇襲攻撃になり、到着した時点で戦争状態に突入します。${confRoute.length > 1 ? `経由地: ${confRoute.map((id) => esc(g.system(id).name)).join(' → ')}。` : `もう一度 ${esc(conf.name)} を右クリック (タップ) しても実行。`} <button data-fa="go">実行</button> <button data-fa="cancel">やめる</button></div>` : ''}`);
  bar.classList.toggle('confirm', !!conf);
  bar.hidden = false;
}

function militaryBox(app, sys) {
  const g = app.game;
  const n = g.knownGarrison(sys.id);
  // 送れるのは地球の国の艦隊 (地球の国の星系か、入植していない星系に置いた艦隊) だけ
  // (地球に届いている情報で)
  const origins = [g.cap, ...Object.keys(g.snaps).map(Number).filter((id) => id !== g.cap)]
    .filter((id) => id !== sys.id && isOwnStack(g, id))
    .map((id) => ({ s: g.system(id), k: g.knownGarrison(id) }))
    .sort((a, b) => distance(a.s, sys) - distance(b.s, sys));
  const from = origins.some((o) => o.s.id === app.fleetOrigin) ? app.fleetOrigin : origins[0]?.s.id;
  // 一括編成: 1・5・10・20 艦隊をまとめて (費用は数の倍、指令の政治力は1回ぶん)
  const noYard = g.knownColonies(sys.id).some((c) => c.lv.shipyard >= 1) ? '' : '軍事基地がない (入植地で建設できる)';
  const build = g.knownColonized(sys.id)
    ? `<div class="btns batch">${WARSHIP_BATCH.map((n) => costButton(g, `data-act="warship" data-n="${n}"`, `${ico('fleet')}${n === 1 ? '艦隊を編成' : `${n} 艦隊を一括編成`}`, mulCost(WARSHIP_COST, n), sys.id, noYard)).join('')}</div>`
    : '';
  // 交戦中でない他国の星系へ送ると奇襲攻撃になる
  const destRealm = g.known(sys.id)?.cols.length ? g.known(sys.id).realm : null;
  const surprise = destRealm !== null && destRealm !== undefined && destRealm !== g.cap && !g.knownAtWar(g.cap, destRealm);
  const send = origins.length
    ? `${surprise ? `<p class="note bad">⚠ ${esc(g.realmName(destRealm))}の星系。ここへ艦隊を送ると奇襲攻撃になり、到着した時点で${esc(g.realmName(destRealm))}との戦争状態に突入し、そのまま艦隊戦になります。</p>` : ''}<label class="field">艦隊の出発地
        <select data-act="forigin">${origins.map((o) => `<option value="${o.s.id}" ${o.s.id === from ? 'selected' : ''}>${esc(o.s.name)} (${o.k}艦隊・${g.fleetYears(o.s.id, sys.id).toFixed(1)} 年)</option>`).join('')}</select></label>
       <div class="btns"><button data-act="fleet" data-from="${from}" data-n="1">${surprise ? '奇襲攻撃 (1艦隊)' : '1艦隊をここへ'}</button><button data-act="fleet" data-from="${from}" data-n="all">${surprise ? '奇襲攻撃 (全艦隊)' : '全艦隊をここへ'}</button></div>
       ${strikeBox(g, sys, destRealm, from)}`
    : '';
  const queued = queuedWarships(g.knownProjects(), sys.id);
  const pick = isOwnStack(g, sys.id) ? `<button data-act="fleetsel" data-sys="${sys.id}">この艦隊を選ぶ (星間マップで移動先を右クリック/タップ)</button>` : '';
  const heldN = sys.id === g.cap ? g.held[sys.id] || 0 : g.known(sys.id)?.held || 0;
  const unhold = isOwnStack(g, sys.id) && heldN > 0
    ? `<button data-act="fleetclear" data-sys="${sys.id}">指令を取り消す<small>命令で駐留中 ${heldN} 艦隊 → 自動防衛配備に任せる${sys.id === g.cap ? '' : `・届くまで ${g.lightDelay(sys.id).toFixed(1)} 年`}</small></button>` : '';
  return `<h3>軍事</h3>
    ${fortBox(g, sys)}
    ${pick}${unhold}
    ${aweLine(g, sys.id)}
    ${supplyLine(g, sys.id, n)}
    <p class="note">${ico('fleet')}駐留艦隊 <b>${n}</b>${queued ? ` (編成中 ${queued})` : ''}。宇宙海賊の襲撃 (${PIRATE_START}年以降) を防ぎ、先住民の制圧にも使う。1艦隊あたり維持費 ${WARSHIP_UPKEEP} cr/年。艦隊は直行し、交易路が直接結ぶ区間は 0.95c、それ以外は 0.9c。0.9c の 1 艦隊の運動エネルギーは ${fmtJ(FLEET_KE)} (恐竜を滅ぼした衝突の約 ${Math.round(FLEET_KE / 4.2e23 / 1e4)} 万倍) で、ぶつかれば惑星の表面を焼き尽くす</p>
    ${build}${send}${defenseToggle(g)}`;
}

// 兵站の表示: 戦力の倍率 (補給線の長さと補給の充足率から)。8割を切ったら赤
function supplyCell(eff = 1, line = 0) {
  return `<span class="${eff < 0.8 ? 'bad' : ''}">${pct(eff)}</span>${line > SUPPLY_NEAR && Number.isFinite(line) ? ` <span class="muted">(拠点まで ${line.toFixed(1)} ly)</span>` : ''}`;
}
// 星系の欄の兵站: 駐留艦隊が使う補給物資と、いまの充足率 (地球に届いている情報で)
function supplyLine(g, id, n) {
  if (!n) return '';
  const k = id === g.cap ? g.supplied[id]?.k : g.known(id)?.supply;
  const use = Object.entries(FLEET_SUPPLY).map(([r, v]) => `${RES_LABEL[r]} ${fmtAmt(v * n)}`).join('・');
  return `<p class="note">${ico('supply')}兵站: 駐留艦隊が年に ${use} を備蓄から使う。補給 <b class="${k !== undefined && k < 0.8 ? 'bad' : ''}">${k === undefined ? '—' : pct(k)}</b>${k !== undefined && k < 0.8 ? ' (補給不足。戦力が落ちている)' : ''}</p>`;
}

// 星系の詳細欄: 反乱時の推定艦隊と、駐留する地球の艦隊 (威圧)
function aweLine(g, id) {
  const k = id === g.cap ? null : g.known(id);
  if (!k || !k.cols.length || (k.realm ?? g.cap) !== g.cap) return '';
  const rebel = g.knownRebelFleet(id);
  const earth = Math.min(g.knownGarrison(id), (k.held || 0) + (k.awe || 0));
  const why = k.lord !== g.cap ? '・直属でないので威圧の対象外' : (k.loyalty ?? LOYALTY_START) >= 50 ? '・忠誠度50以上なので威圧の対象外 (いれば引き揚げる)'
    : (k.friend || 0) >= FRIEND_SAFE ? `・友好度${FRIEND_SAFE}以上なので威圧の対象外 (いれば引き揚げる)` : ` / 目標 ${g.aweGoal(id)}`;
  return `<p class="note">恐怖度 <b>${Math.round(k.fear || 0)}</b>。反乱したときの推定艦隊 <b>${rebel}</b> (人口と経済の規模から)。駐留する${ME.home}の艦隊 <b>${earth}</b> (うち威圧 ${g.knownAwe(id)}${why})。</p>`;
}


// 光速の一撃 (B-035): 他国の入植星系へ、減速せずに艦隊を突っ込ませる。取り消せないので、開いてから押す
function strikeBox(g, sys, realm, from) {
  if (realm === null || realm === undefined || realm === g.cap) return '';
  const bodies = new Set(g.knownColonies(sys.id).map((c) => c.body)).size;
  if (!bodies) return '';
  const ly = g.travelYears(from, sys.id);
  return `<details class="strike"><summary class="bad">光速の一撃 (取り消せない)</summary>
    <p class="note">艦隊を減速させずに ${esc(sys.name)} へ突っ込ませる。1 艦隊で 1 つの天体の入植地を焼き (人口の ${STRIKE.survive * 100}% だけが地下に残り、施設・備蓄・歩兵はなくなる)、艦隊は残らない。光の遅れで、${esc(g.realmName(realm))}には着く直前 (約 ${(ly / OFFROUTE_SPEED - ly).toFixed(1)} 年前) まで見えず、止められない。
      知らせが光速で届いた国は宣戦する (撃たれた国はかならず、${STRIKE.reach} 光年以内の国は ${Math.round(STRIKE.retaliate * 100)}%)。自国の家臣は忠誠度が ${STRIKE.loyalty} 下がり、悪名が ${STRIKE.infamy} 増える。いま知っている天体は ${bodies} つ。</p>
    <div class="btns"><button data-act="strike" data-from="${from}" data-n="1" class="bad">1 艦隊で突入</button>${bodies > 1 ? `<button data-act="strike" data-from="${from}" data-n="${bodies}" class="bad">${bodies} 艦隊で突入 (全部の天体)</button>` : ''}</div></details>`;
}

// 宇宙要塞 (星系ごと。入植すると Lv1、あとは手動で Lv10 まで)。地球に届いている記録で
function fortBox(g, sys) {
  const k = sys.id === g.cap ? null : g.known(sys.id);
  if (sys.id !== g.cap && !k?.cols.length) return '';
  const lv = g.knownFort(sys.id);
  const own = sys.id === g.cap || (k?.realm ?? g.cap) === g.cap;
  const busy = busyText(g, (j) => j.type === 'fort' && j.sys === sys.id);
  const btn = own && lv < FORT.max
    ? costButton(g, `data-act="fort" data-sys="${sys.id}"`, `${ico('fleet')}要塞を Lv${lv + 1} に`, g.fortCost(sys.id), sys.id, busy) : '';
  return `<p class="note">宇宙要塞 <b>Lv${lv}</b> / ${FORT.max}${own ? '' : ` (${esc(g.realmName(k.realm))})`}。艦隊戦では段の数だけ要塞の区画 (艦の ${FORT.hp} 倍の耐久、退かない) が守りに加わる。区画が沈むと段が下がる。艦隊がいなくても、要塞があれば攻める艦隊は先に艦隊戦をする。</p>
    ${btn ? `<div class="btns">${btn}</div>` : ''}`;
}
