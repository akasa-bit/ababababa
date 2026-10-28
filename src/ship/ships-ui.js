function dispatchBox(app, sys, b) {
  const g = app.game;
  // プレイヤー (地球政府) の入植船は、いつも太陽系から自分で送り出す (ほかの星系への指令にはしない)
  const sel = 0;
  const v = g.voyage(sel, sys.id, OFFROUTE_SPEED);
  const t = v.years;
  const btn = (kind) => {
    const c = g.check(sys.id, b.id, kind);
    return costButton(g, `data-act="send" data-kind="${kind}"`, `${ico(kind === 'planet' ? 'planetcol' : 'station')}${KIND_LABEL[kind]}を建設`, g.shipCost(kind, sel, sys.id), sel, c.ok ? '' : c.reason);
  };
  const sup = (kind) => g.shipSupplies(kind, sel, sys.id);
  return `<h3>入植船を送る</h3>
    <p class="note">入植船は${ME.gov}が${ME.capName}から送り出す (費用は${ME.home}の資金と${ME.capName}の備蓄から。その場で出発の準備に入る)。新しい入植地は${ME.capName}に従属する。ほかの星系の政府は自分の判断で入植する。</p>
    <p class="note">入植船は交易路をたどって (0.95c) 目的地に最も近い星系まで行き、最後だけ交易路の外を 0.9c で直行する${v.path.length > 2 ? ` (経由: ${v.path.slice(1, -1).map((id) => esc(g.system(id).name)).join(' → ')})` : ''}。到着まで <b>${t < 0.01 ? 'ほぼ即時' : `${t.toFixed(2)} 年`}</b>${t < 0.01 ? '' : ` (星々の時計。乗っている人の時計では ${voyageShipTime(g, v).toFixed(2)} 年: 相対論の時間の遅れ)`}。</p>
    <p class="note">入植船は食料と水を約 ${Math.round(g.supplyYears(sel, sys.id))} 年分 (交易路を結んで物資が届き始めるまでの見込み、人口の伸びも見込んで2倍) 積んでいき、入植先の備蓄にする。
      惑星入植地: 食料 ${sup('planet').food}・水 ${sup('planet').water} / ステーション: 食料 ${sup('station').food}・水 ${sup('station').water}</p>
    ${(() => {
      const need = g.escortNeed(sys.id, b.id, 'planet');
      const have = g.coloniesIn(sel).reduce((k, c) => k + c.troops + c.slaveTroops, 0);
      const n = g.isSurveyed(sys.id) ? g.nativeOf(sys.id, b.id) : null;
      const warn = n && g.hostileNatives(sys.id, b.id) ? `<b class="bad">到着すると${esc(n.def.species)}との征服戦争になる (抵抗力 ${need})。</b>` : '';
      return `<p class="note">惑星入植地の入植船には${ME.capName}の歩兵が同行する: ${Math.min(need, have)} / ${need} 連隊 (${ME.capName}の駐留 ${have})。${warn}</p>`;
    })()}
    ${designBox(g)}
    <div class="btns">${btn('station')}${btn('planet')}</div>`;
}
// 入植船団の設計 (B-033。決まった案 12-1 b・12-3 a・FU-1・FU-2): 船団 (1 隻 500 人 × 400 隻 = 20 万人。固定)・ひな形・速さ・積み荷・乗る人の年齢と、続く見込みを幅のまま
function designBox(g) {
  const des = g.designOf(g.cap);
  const sel = (k, vals, label) => `<label class="field">${label}<select data-act="design" data-k="${k}">${vals.map(([v, t]) => `<option value="${v}" ${String(v) === String(des[k]) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const tpl = Object.entries(SHIP_TEMPLATES).map(([k, t]) => `<button data-act="design" data-tpl="${k}">${esc(t.label)}<small>${esc(SHIP_DESIGN.speeds[t.speed])}・工業品 ${t.cargo}</small></button>`).join('');
  const fail = colonyFailP(des.crew);
  return `<h4>入植船団 (${ME.realm}の次の入植から)</h4>
    <p class="note">入植船団は <b>${des.ships} 隻・${fmtPeople(des.crew)}</b> (1 隻 ${fmtPeople(SHIP_DESIGN.perShip)})。</p>
    <div class="btns">${tpl}</div>
    ${sel('speed', Object.entries(SHIP_DESIGN.speeds), '速さ')}${sel('cargo', SHIP_DESIGN.cargos.map((n) => [n, `工業品 ${n}`]), '積み荷')}${sel('ages', Object.entries(SHIP_DESIGN.ages), '乗る人の年齢')}
    <p class="note">住む場所は 1 人 ${SHIP_DESIGN.habitatKg / 1000} t (1 隻 ${((SHIP_DESIGN.perShip * SHIP_DESIGN.habitatKg) / 1e7).toFixed(1)} 万 t)。積み荷は船団でまとめて積む。遅い船はエネルギーが少なくて済むが、着くのが遅い。</p>
    <p class="note">続く見込み (前提ごとの幅のまま): 入植地として降りてから増えていくなら <b>${pctH(1 - fail)}</b>。
      船の上で人数を保つ前提なら、HERITAGE (Marin & Beluffi 2018。定員 500 の船で 6,300 年・近親婚なし) では 98 人で足り、25 組 (50 人) では半分ほどが絶える。
      Smith (2014。150 年・遺伝の多様性を保つ・大きな災害 1 回) では ${fmtPeople(SMITH.min)}〜${fmtPeople(SMITH.max)}が要る (${des.crew >= SMITH.min ? '足りる' : '足りない'})。</p>`;
}

// 建設中ならボタンに添える文言 (例: 建設中 あと 3.2 年)
// 地球から見た星系の歩兵の戦力 (光が届いている記録の入植地から)
function knownTroopPower(g, sysId) { return g.knownColonies(sysId).reduce((k, c) => k + c.troops + SLAVE_TROOP_POWER * c.slaveTroops, 0); }
function busyText(g, pred) {
  const j = g.knownProjects().find(pred); // 地球から見えている建設中の事業
  return j ? `建設中 あと ${(j.ready - g.year).toFixed(1)} 年` : '';
}

// 到着までの年数。着いているはずでも、到着の光が首都に届くまでは「着いたころ」と書く
function arriveText(game, t) { return t > game.year ? `あと ${(t - game.year).toFixed(1)} 年` : '<span class="muted">着いたころ (知らせ待ち)</span>'; }
// 見えている艦隊の区間 (seenFleets の 1 つ)。他国の艦隊は出発地だけ
function fleetLegText(game, x) {
  const from = x.leg.from !== undefined && !x.leg.fromXY ? esc(game.system(x.leg.from).name) : '宇宙の途中';
  if (!x.mine) return `${from} から (${esc(game.realmName(x.f.owner ?? 0))})`;
  return `${from} → ${x.leg.to !== undefined ? esc(game.system(x.leg.to).name) : '宇宙の途中'}`;
}
function shipsHtml(game) {
  const bar = (s) => {
    const f = clamp((game.year - s.depart) / Math.max(1e-9, s.arrive - s.depart), 0, 1);
    return `<span class="bar"><i style="width:${(f * 100).toFixed(0)}%"></i></span> ${arriveText(game, s.arrive)}`;
  };
  const seen = (sys, t) => game.departSeen(sys, t);
  // 船と艦隊は、出発の光が届いてから、到着の光が届くまで (着いたあとも、知らせが届くまでは移動中に見える。B-030)
  const ships = game.seenMoving('ships').map((s) => `<div class="ship">${esc(game.system(s.from).name)} → ${esc(game.system(s.to).name)} <span class="muted">${KIND_LABEL[s.kind]}</span>${bar(s)}</div>`);
  const fleets = game.seenFleets().map((x) => `<div class="ship">${fleetLegText(game, x)} <span class="bad">${x.f.n} 艦隊</span>${x.mine ? bar(x.leg) : ' <span class="muted">行き先は分からない</span>'}</div>`);
  const jobs = game.knownProjects().filter((j) => seen(j.sys, j.start)).map((j) => `<div class="ship">${esc(j.label)} <span class="muted">資材搬入中</span>${bar({ depart: j.start, arrive: j.ready })}</div>`);
  const vm = game.migrants.filter((m) => seen(m.fromSys, m.depart));
  const mig = vm.length
    ? [`<div class="ship"><span style="color:#8fd3ff">移民船 ${vm.length} 隻</span> <span class="muted">計 ${fmtPop(vm.reduce((k, m) => k + m.n, 0))} (帝国タブ → 移民)</span></div>`]
    : [];
  const troops = game.seenMoving('troopMoves').map((m) => `<div class="ship">${esc(game.colonyByKey(m.from)?.name || '?')} → ${esc(game.colonyByKey(m.to)?.name || '?')} <span style="color:#ff9f8f">歩兵 ${m.troops + m.slave}連隊</span>${bar({ depart: m.times[0], arrive: m.arrive })}</div>`);
  const vq = game.requests.filter((q) => seen(q.from, q.sent));
  const orders = vq.filter((q) => q.kind === 'order');
  const req = vq.length
    ? [`<div class="ship"><span style="color:#c9a2ff">通信 ${vq.length} 件</span> <span class="muted">うち${ME.home}からの指令 ${orders.length} (帝国タブ → 交易路)</span></div>`]
    : [];
  const all = [...jobs, ...ships, ...fleets, ...troops, ...mig, ...req];
  return (all.length ? all.join('') : '<span class="muted">見えている航行中の船なし</span>') + `<p class="note">遠くの船は、出発の光が${ME.capName}に届いてから表示され、到着の光が届くまで残る。進路変更も、変えた所からの光が届いてから見える。他国の艦隊の行き先は分からない。</p>`;
}

// 帝国タブ: 全星系の人口・資源・経済・軍事を一覧で管理する
const EMPIRE_TABS = { overview: '概要', goals: '目標', routes: '交易路', migration: '移民', military: '軍事', politics: '政治' };

