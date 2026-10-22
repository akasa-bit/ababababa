// 戦争方針: 統一されていない先住民と戦争するかを友好度で自動判断する
const WAR_POLICIES = [[1000, '常に戦争する'], [80, '友好度80未満なら戦争'], [60, '友好度60未満なら戦争'], [40, '友好度40未満なら戦争 (標準)'], [20, '友好度20未満なら戦争'], [0, '友好度0未満 (敵対的) なら戦争'], [-1000, '戦争しない (共存する)']];
function warPolicyBox(g) {
  return `<label class="field">戦争方針 (統一されていない先住民の惑星に入植したとき)
      <select data-act="warpolicy">${WAR_POLICIES.map(([v, l]) => `<option value="${v}" ${v === g.warThreshold ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="note">入植地が先住民と同じ惑星にあるとき、先住民の友好度が基準を下回っていれば自動で征服戦争を始める (入植した時と、その後も年1回判断)。基準以上なら共存する。最も進んだ文明 (情報時代) は対象外で、同意がなければ入植できない。</p>`;
}

// 帝国 → 軍事: 艦隊と歩兵
function militarySheet(app) {
  const g = app.game;
  const goto = (s) => `<button data-act="goto" data-sys="${s.id}">${esc(s.name)}</button>`;
  const systems = g.knownOwnSystems();
  const seen = g.seenFleets(); // 首都に届いている光で見た移動中の艦隊 (B-030)
  const milIds = [...new Set([...systems.map((s) => s.id), ...Object.keys(g.snaps).map(Number).filter((id) => g.knownGarrison(id) > 0)])];
  const milRows = milIds.map((id) => {
    const s = g.system(id);
    const n = g.knownGarrison(id);
    const coming = seen.filter((x) => x.mine && x.leg.to === id).reduce((k, x) => k + x.f.n, 0); // 自国の艦隊だけ (他国の行き先は分からない)
    const yard = g.knownColonies(id).some((c) => c.lv.shipyard >= 1);
    const build = yard
      ? `<div class="btns batch">${[1, 5, 10].map((k) => costButton(g, `data-act="warship" data-sys="${id}" data-n="${k}"`, k === 1 ? '編成' : `×${k}`, mulCost(WARSHIP_COST, k), id)).join('')}</div>`
      : '<span class="muted">軍事基地なし</span>';
    const awe = g.knownAwe(id);
    const aweT = g.known(id)?.lord === g.cap && (g.known(id)?.realm ?? g.cap) === g.cap && g.known(id)?.cols.length ? g.aweGoal(id) : 0;
    return `<tr><td>${goto(s)}<br>${ageBadge(g, id)}</td><td><b>${n}</b> 艦隊${coming ? ` <span class="muted">(+${coming} 向かっている)</span>` : ''}${awe || aweT ? `<br><span class="muted">うち威圧 ${awe}${aweT ? ` / ${aweT}` : ''}</span>` : ''}</td><td>${build}</td>
      <td><button data-act="rally" data-sys="${id}">全艦隊をここへ集結</button></td></tr>`;
  }).join('');
  const milTable = `<h3>艦隊</h3>${defenseToggle(g)}<div class="scroll"><table class="tbl">
    <tr><th>星系</th><th>駐留</th><th>艦隊の編成</th><th></th></tr>${milRows}</table></div>
    ${g.year < PIRATE_START ? `<p class="note">宇宙海賊は ${PIRATE_START} 年から現れる。</p>` : ''}`;

  const troopRows = systems.flatMap((x) => g.knownColonies(x.id)).sort((a, b) => (b.troops + b.slaveTroops) - (a.troops + a.slaveTroops) || b.pop - a.pop).map((c) => {
    const key = colKey(c);
    const coming = g.seenMoving('troopMoves').filter((m) => m.to === key).reduce((k, m) => k + m.troops + m.slave, 0);
    const train = costButton(g, `data-act="train" data-col="${key}"`, '訓練', TROOP_COST, c.sys,
      c.lv.barracks < 1 ? '教練所なし' : busyText(g, (j) => j.type === 'troop' && j.col === key));
    return `<tr><td><button data-act="gobody" data-sys="${c.sys}" data-body="${esc(c.body)}">${esc(c.name)}</button></td>
      <td>Lv${c.lv.barracks}</td><td><b>${c.troops}</b></td><td>${c.slaveTroops}</td><td>${coming || ''}</td>
      <td>${train}</td><td><button data-act="troopsrally" data-to="${key}">全歩兵をここへ</button></td></tr>`;
  }).join('');
  const warRows = systems.flatMap((x) => g.knownWars(x.id)).map((w) => {
    const n = g.nativeOf(w.sys, w.body);
    return `<tr><td><button data-act="gobody" data-sys="${w.sys}" data-body="${esc(w.body)}">${esc(g.target(w.sys, w.body).name)}</button></td><td>${esc(n?.def.species || '?')}</td>
      <td>${pct(w.progress)}</td><td>${ageBadge(g, w.sys)}</td></tr>`;
  }).join('');
  const moves = g.seenMoving('troopMoves').map((m) => `<tr><td>${esc(g.colonyByKey(m.from)?.name || '?')} → ${esc(g.colonyByKey(m.to)?.name || '?')}</td>
    <td>${m.troops} + 奴隷兵 ${m.slave}</td><td>${m.path.length - 1} 本の交易路</td><td>${arriveText(g, m.arrive)}</td></tr>`).join('');
  const fleets = seen.map((x) => `<tr><td>${fleetLegText(g, x)}</td><td>${x.f.n} 艦隊</td><td>${x.mine ? arriveText(g, x.leg.arrive) : '<span class="muted">行き先は分からない</span>'}</td></tr>`).join('');
  return `<div class="kpi">
      <div><span>${ico('fleet')}艦隊 (把握分)</span><b>${milIds.reduce((k, id) => k + g.knownGarrison(id), 0)} 艦隊</b><span>駐留している分</span></div>
      <div><span>${ico('troops')}歩兵 (把握分)</span><b>${systems.flatMap((x) => g.knownColonies(x.id)).reduce((k, c) => k + c.troops + c.slaveTroops, 0)} 連隊</b><span>駐留している分</span></div>
      <div><span>${ico('pirate')}海賊の最大戦力</span><b>${g.year < PIRATE_START ? '—' : g.pirateMax()}</b><span>${g.year < PIRATE_START ? `${PIRATE_START}年から出現` : '40年ごとに増える'}</span></div>
      <div><span>悪名</span><b>${g.infamy}</b><span>先住民の友好度に影響</span></div>
    </div>
    ${milTable}
    ${rivalViewTable(g)}
    <h3>歩兵</h3>
    <p class="note">歩兵は入植地ごとに駐留し、交易路を通って移動する。軍事教練所 (惑星・ステーションの施設) で訓練するか、軍事奴隷から徴集する。先住民の制圧、奴隷の反乱の抑止、海賊からの地上防衛に使う。</p>
    <div class="scroll"><table class="tbl"><tr><th>入植地</th><th>教練所</th><th>歩兵</th><th>奴隷兵</th><th>向かっている</th><th>訓練</th><th></th></tr>${troopRows}</table></div>
    <h3>征服戦争 (${systems.flatMap((x) => g.knownWars(x.id)).length})</h3>${warPolicyBox(g)}${warRows ? `<div class="scroll"><table class="tbl"><tr><th>惑星</th><th>先住民</th><th>進捗</th><th>情報</th></tr>${warRows}</table></div>` : '<p class="note">なし</p>'}
    <h3>移動中の歩兵</h3>${moves ? `<div class="scroll"><table class="tbl">${moves}</table></div>` : '<p class="note">なし</p>'}
    <h3>移動中の艦隊</h3>${fleets ? `<div class="scroll"><table class="tbl">${fleets}</table></div>` : '<p class="note">なし</p>'}
    <h3>艦隊への指令 (光速で送信中)</h3>${(() => {
      const rows = g.requests.filter((q) => q.kind === 'order' && ['fleet', 'redirect', 'fleetclear'].includes(q.act)).map((q) => {
        const who = q.act === 'fleet' ? `${esc(g.system(Number(q.d.from)).name)} の艦隊 (${q.d.n === 'all' ? '全艦' : `${q.d.n} 艦隊`})`
          : q.act === 'redirect' ? `移動中の ${q.d.n} 艦隊 (進路変更)` : q.d.fleet !== undefined ? `${esc(g.system(Number(q.d.sys)).name)} へ移動中の艦隊` : `${esc(g.system(Number(q.d.sys)).name)} の艦隊`;
        return `<tr><td>${who}</td><td>${q.act === 'fleetclear' ? '指令の取り消し' : `→ ${esc(g.system(Number(q.d.sys)).name)}`}</td><td>指令が届くまで あと ${Math.max(0, q.arrive - g.year).toFixed(1)} 年</td></tr>`;
      }).join('');
      return rows ? `<div class="scroll"><table class="tbl">${rows}</table></div>` : '<p class="note">なし</p>';
    })()}`;
}

// 相手が見ている自分 (B-027): ほかの国の首都に届いている光で見える、こちらの艦隊の数。
// AI の国は、この数に読み違いを掛けて勝つ見込みを出し、宣戦と講和を決める (docs/negotiation.md)
function rivalViewTable(g) {
  const rivals = g.knownSystems().filter((x) => x.id !== g.cap && g.known(x.id)?.realm === x.id && g.known(x.id)?.independent)
    .sort((a, b) => g.sysDist(g.cap, a.id) - g.sysDist(g.cap, b.id)).slice(0, 8);
  if (!rivals.length) return '';
  // こちらが把握している自国の艦隊 (駐留と移動中。これも光の遅れのぶん古い)
  const ours = g.rallySources(-1).reduce((k, id) => k + g.knownGarrison(id), 0) + g.seenFleets().filter((x) => x.mine).reduce((k, x) => k + x.f.n, 0);
  const rows = rivals.map((x) => {
    const v = g.seenByRival(x.id), war = g.knownAtWar(g.cap, x.id);
    return `<tr><td><button data-act="goto" data-sys="${x.id}">${esc(g.realmName(x.id))}</button>${war ? ' <b class="bad">交戦中</b>' : ''}</td><td>${v.age.toFixed(1)} 光年</td>
      <td><b>${v.n}</b> 艦隊<br><span class="muted">${v.age.toFixed(1)} 年前の様子</span></td><td>${v.lo}〜${v.hi} 艦隊</td></tr>`;
  }).join('');
  return `<h3>相手が見ている${esc(g.realmName(g.cap))}の艦隊</h3>
    <p class="note">ほかの国の首都には、こちらの艦隊が光の遅れのぶん古い姿で見えている (こちらが把握している数は ${ours} 艦隊)。AI の国は、その数に読み違いを掛けて勝つ見込みを出し、宣戦や講和を決める。読み違いは相手だけが知っているので、3 回に 2 回はこの幅に入る、という幅で出す。戦争が始まると、戦って沈めた・沈められた数でも見積もりを直す。相手の首都に近い星系へ艦隊を集めると、早く見える。</p>
    <div class="scroll"><table class="tbl"><tr><th>国</th><th>首都までの距離</th><th>相手に見えている数</th><th>相手の見積もりの幅</th></tr>${rows}</table></div>`;
}
