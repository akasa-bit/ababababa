function empireOverview(app) {
  const g = app.game;
  // 地球に光が届いている範囲の情報をつなぎ合わせて表示する (太陽系だけ最新)
  const popOf = (id) => g.knownColonies(id).reduce((s, c) => s + c.pop, 0);
  const systems = g.knownOwnSystems().sort((a, b) => popOf(b.id) - popOf(a.id));
  const net = (fl, r) => fl.prod[r] - fl.cons[r];
  const flowOf = (id) => { const k = g.known(id); return k ? { prod: k.prod, cons: k.cons } : { prod: zeroRes(), cons: zeroRes() }; };
  const signed = (v) => (Math.abs(v) < 0.05 ? '<span class="muted">±0</span>' : `<span class="${v < 0 ? 'bad' : 'hz'}">${v > 0 ? '+' : ''}${fmtAmt(v)}</span>`);
  const goto = (s) => `<button data-act="goto" data-sys="${s.id}">${esc(s.name)}</button>`;
  const inc = g.income();

  const kpi = TR`<div class="kpi">
    <div><span>${ico('credits')}クレジット</span><b>${fmtAmt(g.credits)} cr</b><span class="${inc < 0 ? 'bad' : 'hz'}">${inc >= 0 ? '+' : ''}${fmtAmt(inc)}/年</span></div>
    <div><span>エネルギーの蓄え</span><b>${fmtJ(g.energyOf(g.cap))}</b><span>発電 ${fmtJ(g.power(g.cap))}/年</span></div>
    <div><span>${ico('pop')}総人口 (把握分)</span><b>${fmtPop(systems.reduce((k, x) => k + popOf(x.id), 0))}</b><span>入植地 ${systems.reduce((k, x) => k + g.knownColonies(x.id).length, 0)}・星系 ${systems.length}</span></div>
    <div><span>${ico('fleet')}艦隊 (把握分)</span><b>${systems.reduce((k, x) => k + g.knownGarrison(x.id), 0)} 艦隊</b><span>駐留している分</span></div>
    <div><span>${ico('route')}交易路 (把握分)</span><b>${g.routes.filter((r) => g.routeKnown(r)).length} 本</b><span></span></div>
  </div>
  <p class="note">資金と収支は${ME.gov}のもの。各星系の数値は、その星系から光が${ME.home}に届いた時点の様子 (表の「情報」が古さ)。</p>`;

  const ledger = TR`<h3>${ico('credits')}${ME.gov}の収支 (cr/年)</h3><table class="tbl">${ledgerHtml(g)}</table>
    <h3>${ME.gov}のエネルギー (J/年)</h3><table class="tbl">${eLedgerHtml(g)}</table>
    <p class="note">エネルギーはダイソン・スウォームの発電 (恒星の光を覆う割合 ${pct(g.swarmCover(g.cap))})。船は加速をレーザー光帆、減速を交易路では着く側のレーザー、交易路の外では磁気帆と反物質で行う。蓄えは ${SWARM.store} 年分の発電まで。</p>
    ${researchHtml(g)}`;

  const colonies = systems.flatMap((x) => g.knownColonies(x.id)).sort((a, b) => b.pop - a.pop).map((c) => {
    const s = c.sat || { food: 1, water: 1, goods: 1 };
    const low = Math.min(s.food, g.needsWater(c) ? s.water : 1);
    return `<tr><td>${esc(c.name)}</td><td>${goto(g.system(c.sys))}</td><td>${c.kind === 'planet' ? TR('惑星') : TR('ステーション')}</td>
      <td>${fmtPop(c.pop)}</td><td class="muted">${fmtPop(c.cap ?? g.capOf(c))}</td>
      <td class="${(c.growth || 0) < 0 ? 'bad' : 'hz'}">${((c.growth || 0) * 100).toFixed(1)}%</td>
      <td class="${low < 0.99 ? 'bad' : ''}">${pct(low)}</td><td class="${s.goods < 0.99 ? 'bad' : ''}">${pct(s.goods)}</td>
      <td class="muted">${shareText(c, true)}</td><td class="muted">${c.inc !== undefined ? `${stageName(c.inc)} ${Math.round(c.inc / 100) / 10}k$` : '—'}</td>
      <td>${speciesCell(g, c)}</td><td>${ageBadge(g, c.sys)}</td></tr>`;
  }).join('');
  const bulk = '';
  const popTable = TR`<h3>人口と入植地</h3>${bulk}<div class="scroll"><table class="tbl">
    <tr><th>入植地</th><th>星系</th><th>種類</th><th>人口</th><th>上限</th><th>増加/年</th><th>生活物資</th><th>物品</th><th>就業</th><th>段階 (所得)</th><th>種族 (この惑星)</th><th>情報</th></tr>${colonies}</table></div>`;

  const totals = zeroRes();
  const totalNet = zeroRes();
  const resRows = systems.map((s) => {
    const st = g.known(s.id)?.stock || zeroRes();
    const fl = flowOf(s.id);
    return `<tr><td>${goto(s)}<br>${ageBadge(g, s.id)}</td><td>${autoToggle(g, s.id)}</td>${RES.map((r) => {
      totals[r] += st[r];
      totalNet[r] += net(fl, r);
      return `<td>${fmtAmt(st[r])} <small>${signed(net(fl, r))}</small></td>`;
    }).join('')}</tr>`;
  }).join('');
  const resTable = TR`<h3>資源 (備蓄 と 年あたりの増減)</h3><div class="scroll"><table class="tbl">
    <tr><th>星系</th><th></th>${RES.map((r) => `<th>${resText(r)}</th>`).join('')}</tr>${resRows}
    <tr class="total"><td>合計</td><td></td>${RES.map((r) => `<td>${fmtAmt(totals[r])} <small>${signed(totalNet[r])}</small></td>`).join('')}</tr></table></div>
    <p class="note">増減は生産−需要。交易路での出入りは含まない。</p>`;

  return `${kpi}${ledger}${popTable}${resTable}`;
}

// 惑星ごとの種族数と内訳 (住民の種族・同じ惑星の先住民)
function speciesCell(g, c) {
  const list = [];
  for (const [k, v] of Object.entries(c.races || { [HUMAN]: 1 })) if (v * c.pop >= 0.0005) list.push({ name: k, pop: v * c.pop, role: '市民' }); // 役割は比べるので日本語のまま (出すときに TR の値として訳す)
  const n = c.kind === 'planet' ? g.knownNative(c.sys, c.body) : null;
  if (n && n.st.status !== 'integrated') list.push({ name: n.def.species, pop: n.st.pop, role: n.st.status === 'enslaved' ? SLAVE_TYPES[n.st.slave] : n.st.status === 'subjugated' ? '支配下' : '先住民' });
  list.sort((a, b) => b.pop - a.pop);
  const names = new Set(list.map((x) => x.name));
  return TR`<b>${names.size}</b> 種族 <span class="muted">${list.slice(0, 4).map((x) => `${esc(TX(x.name))} ${TX(fmtPop(x.pop))}${x.role === '市民' ? '' : ` (${TX(x.role)})`}`).join(TR('・'))}${list.length > 4 ? ' …' : ''}</span>`;
}

