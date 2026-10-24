function empireHtml(app) {
  const t = app.empireTab || 'overview';
  const chips = `<div class="chips">${Object.entries(EMPIRE_TABS).map(([k, l]) => `<button data-act="etab" data-t="${k}" class="${k === t ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const body = t === 'routes' ? routesSheet(app) : t === 'migration' ? migrationSheet(app) : t === 'military' ? militarySheet(app) : t === 'politics' ? politicsSheet(app) : t === 'goals' ? goalsSheet(app) : empireOverview(app);
  const g = app.game;
  return `<h2>${ME.gov} 年次報告 <span class="muted">${Math.floor(g.year)}年 ${Math.floor((g.year % 1) * 12) + 1}月</span></h2>${chips}${body}`; // 見出しは報告書の題 (GA6 の QD-59 の A4 = b)
}

// 帝国 → 交易路: 全交易路の一覧と開設
function routesSheet(app) {
  const g = app.game;
  const goto = (s) => `<button data-act="goto" data-sys="${s.id}">${esc(s.name)}</button>`;
  const top = (tr) => RES.filter((r) => tr[r] > 0.05).sort((a, b) => tr[b] * PRICE[b] - tr[a] * PRICE[a]).slice(0, 3)
    .map((r) => `${resText(r)} ${fmtAmt(tr[r])}`).join('・') || '<span class="muted">なし</span>';
  const rows = g.routes.filter((r) => g.routeKnown(r)).sort((x, y) => (y.vol[0] + y.vol[1]) - (x.vol[0] + x.vol[1])).map((r) => {
    const a = g.system(r.a);
    const b = g.system(r.b);
    const cap = g.routeCap(r);
    const use = g.routeUse(r);
    const busy = busyText(g, (j) => j.type === 'route' && j.route === r.id);
    return `<tr><td>${goto(a)} ⇄ ${goto(b)}</td><td>${distance(a, b).toFixed(1)} ly</td><td>Lv${r.lv} <span class="muted">(輸送船 ${Math.round(g.routeShips(r))} 隻・${fmtAmt(cap)}/年)</span></td>
      <td>${fmtAmt(r.vol[0])}/年</td><td>${fmtAmt(r.vol[1])}/年</td><td class="${use > 0.9 ? 'bad' : ''}">${pct(Math.min(use, 1))}</td>
      <td>${top(r.transit[0])}</td><td>${top(r.transit[1])}</td>
      <td>${costButton(g, `data-act="uproute" data-route="${r.id}"`, '拡張', g.routeUpCost(r), r.a, busy)}</td></tr>`;
  }).join('');
  const cols = g.knownOwnSystems().sort((x, y) => x.name.localeCompare(y.name));
  const a = cols.some((s) => s.id === app.routeA) ? app.routeA : cols[0]?.id;
  const others = cols.filter((s) => s.id !== a && !g.routeBetween(s.id, a) && !g.knownHostile(s.id, a)).sort((x, y) => distance(x, g.system(a)) - distance(y, g.system(a)));
  const b = others.some((s) => s.id === app.routeB) ? app.routeB : others[0]?.id;
  const opt = (list, sel, f = () => '') => list.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}${f(s)}</option>`).join('');
  const open = cols.length > 1
    ? `<div class="bulk">
        <select data-act="ra">${opt(cols, a)}</select> ⇄
        ${others.length ? `<select data-act="rb">${opt(others, b, (s) => ` (${distance(s, g.system(a)).toFixed(1)} ly)`)}</select>
        ${costButton(g, `data-act="route2" data-a="${a}" data-b="${b}"`, `${ico('route')}交易路を開設`, g.routeCost(a, b), a)}` : '<span class="muted">結べる相手がない</span>'}
      </div>`
    : '<p class="note">交易路を結ぶには入植星系が2つ以上必要。</p>';
  return `<div class="kpi">
      <div><span>${ico('route')}交易路 (把握分)</span><b>${g.routes.filter((r) => g.routeKnown(r)).length} 本</b><span>各星系が自分で引く</span></div>
      <div><span>${ME.home}の輸出収入</span><b>${fmtAmt(g.ledger.trade || 0)} cr</b><span>年あたり</span></div>
      <div><span>${ME.home}の輸入支出</span><b>${fmtAmt(-(g.ledger.import || 0))} cr</b><span>年あたり</span></div>
    </div>
    <h3>新しい交易路</h3>${open}
    ${requestsTable(g)}
    <h3>${ico('route')}交易路の一覧</h3>
    <p class="note">送れる量は輸送船の数と港の容量 (規模) の小さいほうで、質量 (100 万 t) で数える。船は 30 年で古くなり、交易路を開いた星系の運送業の会社が運賃で造り直し、港が広がったら足す。</p>
    ${rows ? `<div class="scroll"><table class="tbl">
      <tr><th>区間 (A ⇄ B)</th><th>距離</th><th>規模</th><th>A→B</th><th>B→A</th><th>稼働率</th><th>通過中の荷 A→B</th><th>通過中の荷 B→A</th><th></th></tr>${rows}</table></div>
      <p class="note">稼働率が100%近い交易路は、拡張すると運べる量が増える。稼働率が9割を超えると知らせが出て、端の星系 (A) の政府が自動で拡張する (資金が費用の1.5倍以上あるとき)。</p>` : '<p class="note">まだ交易路はない。</p>'}
    ${autoRoutesToggle(g)}`;
}

