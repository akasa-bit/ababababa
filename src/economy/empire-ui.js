function empireHtml(app) {
  const t = app.empireTab || 'overview';
  const chips = `<div class="chips">${Object.entries(EMPIRE_TABS).map(([k, l]) => `<button data-act="etab" data-t="${k}" class="${k === t ? 'on' : ''}">${ico(EMPIRE_TAB_ICON[k])}${l}</button>`).join('')}</div>`;
  const body = t === 'vassals' ? vassalsSheet(app) : t === 'routes' ? routesSheet(app) : t === 'migration' ? migrationSheet(app) : t === 'military' ? militarySheet(app) : t === 'politics' ? politicsSheet(app) : t === 'goals' ? goalsSheet(app) : empireOverview(app);
  const g = app.game;
  return TR`<h2>${ME.gov} 年次報告 <span class="muted">${Math.floor(g.year)}年 ${Math.floor((g.year % 1) * 12) + 1}月</span></h2>${chips}${body}`; // 見出しは報告書の題 (GA6 の QD-59 の A4 = b)
}

// 帝国 → 従属国 (依頼 KE-4。2026-11-01): 自国の家臣の星系ごとの経済と社会の様子と、定期の資金援助の設定。
// どの値も、その星系から光の遅れのぶん古い記録 (known)。忠誠度の低い順に並べる (離反しそうな星系が上)
function vassalsSheet(app) {
  const g = app.game;
  const ids = vassalIds(g);
  const base = regimeNorm(g.regime) || BASE_REGIME;
  const opts = (sel) => REGIME_ORDER.filter((r) => r !== 'direct').map((r) => `<option value="${r}" ${r === sel ? 'selected' : ''}>${esc(REGIMES[r].label)}${r === base ? TR(' (基本)') : ''}</option>`).join('');
  // 基本統治形式 (依頼 KE-5): 新しい入植地の政府がなる型。入植船の窓の「基本のまま」はこの型 (前は 目標 のタブの「新しい入植地の統治体制」)
  const head = TR`<h3>${ico('vassal')}基本統治形式</h3>
    <p class="note">新しく入植した星系の政府がなる型。入植船を送るときの窓の「基本のまま」はこの型 (入植船ごとに別の型も選べる)。体制によって、離反の起きやすさ・朝貢・指令の通りやすさが変わる。遠い星系ほど通信の遅れが効くので、現地に任せる体制が保ちやすい。</p>
    <label class="field">基本統治形式<select data-act="regimedefault">${REGIME_ORDER.filter((r) => r !== 'direct').map((r) => `<option value="${r}" ${r === base ? 'selected' : ''}>${esc(REGIMES[r].label)} — ${esc(REGIMES[r].note)}</option>`).join('')}</select></label>
    ${regimeCounts(g)}`;
  if (!ids.length) return head + TR('<p class="note">まだ従属している星系がない (入植すると、その星系の政府が家臣になる)。</p>');
  const st = g.me.standing || {};
  const wavg = (cols, f) => { let n = 0, w = 0; for (const c of cols) { const v = f(c); if (Number.isFinite(v) && c.pop > 0) { n += c.pop; w += c.pop * v; } } return n > 0 ? w / n : null; };
  const pctTxt = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);
  const rows = ids.map((id) => {
    const k = g.known(id), cols = k.cols;
    const pop = cols.reduce((a, c) => a + c.pop, 0);
    return { id, k, pop, inc: wavg(cols, (c) => c.incU), home: wavg(cols, (c) => c.sh?.home ?? 0), school: wavg(cols, (c) => c.school), routes: g.routes.filter((r) => (r.a === id || r.b === id) && g.routeKnown(r)).length,
      loy: k.loyalty ?? LOYALTY_START, excl: k.groups?.excl ?? null, top: k.groups?.quint?.[4] ?? null, age: g.year - (k.year ?? g.year) };
  }).sort((a, b) => a.loy - b.loy);
  const gpc = (id) => g.pcCost('grantset', { sys: id, amt: 1 });
  const sel = app.vassalSel || new Set();
  const bv = REGIMES[app.vassalBulk] && app.vassalBulk !== 'direct' ? app.vassalBulk : base;
  const bt = bulkRuleTargets(g, bv), bc = bt.reduce((a, id) => a + g.pcCost('rule', { sys: id }), 0);
  const can = new Set(ruleableIds(g)), allOn = can.size > 0 && [...can].every((id) => sel.has(id));
  const tr = rows.map((x) => {
    const k = x.k, s = g.system(x.id), reg = k.direct ? TR('直轄') : TX(REGIMES[g.knownRegime(k)].label), un = k.unrest?.stage ? UNREST_LABEL[k.unrest.stage] : '';
    const now = st[x.id];
    return TR`<tr><td class="vsel"><input type="checkbox" data-act="vsel" data-sys="${x.id}" ${sel.has(x.id) && can.has(x.id) ? 'checked' : ''} ${can.has(x.id) ? '' : `disabled title="${TR('家臣の家臣 (型はその主人が決める)')}"`} aria-label="${esc(s.name)}"></td><td><button data-act="goto" data-sys="${x.id}">${esc(s.name)}</button><br><span class="muted">${esc(reg)}・${x.age < 0.05 ? TR('いま') : TR`${x.age.toFixed(1)} 年前の記録`}</span></td>
      <td class="num">${fmtPop(x.pop)}</td><td class="num">${x.inc === null ? '—' : TR`${fmtAmt(x.inc)} ドル`}</td><td class="num">${fmtAmt(k.gdp || 0)}</td><td class="num ${k.credits < 1 ? 'bad' : ''}">${fmtAmt(k.credits || 0)}</td>
      <td class="num">${x.routes}</td><td class="num ${x.home > 0.2 ? 'bad' : ''}">${pctTxt(x.home)}</td>
      <td class="num ${x.loy < 35 ? 'bad' : ''}">${Math.round(x.loy)}${un ? `<br><span class="bad">${esc(TX(un))}</span>` : ''}</td><td class="num ${(x.excl || 0) > 0.3 ? 'bad' : ''}">${pctTxt(x.excl)}</td><td class="num">${pctTxt(x.top)}</td><td class="num">${x.school === null ? '—' : TR`${x.school.toFixed(1)} 年`}</td>
      <td class="vgrant"><input id="vgrant-${x.id}" type="number" inputmode="numeric" min="0" step="10" placeholder="0" value="${now ?? ''}"><button data-act="grantset" data-sys="${x.id}" data-read="vgrant-${x.id}" ${g.pc < gpc(x.id) && !now ? 'disabled' : ''}>${now ? TR('変える') : TR('決める')}</button>${now ? TR`<button class="ghost" data-act="grantset" data-sys="${x.id}" data-amt="0">止める</button>` : ''}</td></tr>`;
  }).join('');
  const total = Object.values(st).reduce((a, v) => a + v, 0);
  return head + TR`<h3>家臣の星系</h3><p class="note">${ME.home}の家臣の星系の様子 (どれも光の遅れのぶん古い記録)。忠誠度の低い順。自給 = 市場の外で暮らす人の割合 (交易路がなく市場が崩れた星系で増える)。締め出し = 政治から締め出された集団の人口の割合。上位 20% = 所得の上位 20% の人の取り分。</p>
    <p class="note">定期の資金援助: 星系ごとに毎年の額を決めると、止めるまで${ME.home}が年に 1 回送る (光速の送金。届くと政府の資金になり、忠誠度が上がる)。決めるときに政治力 (ふつうの資金援助と同じ)、${ME.home}の資金が足りない年は送れる分だけ。${total > 0 ? TR`いまの合計 <b>${fmtAmt(total)} cr/年</b>。` : ''}</p>
    <p class="note">一括変更: 表の左の欄で星系を選び (いちばん上の欄ですべて)、型を選んで変える。星系ごとに光速の指令を送る (政治力は星系の数だけ。選べるのは直属の家臣で、家臣の家臣は選べない。直轄は上限があるので星系の欄から)。いまその型の星系と、型を変える指令を送っている星系は数えない。</p>
    <div class="bulk vbulk"><b>${ico('vassal')}一括変更</b><label class="field">型<select data-act="vbulkreg">${opts(bv)}</select></label><button data-act="bulkrule" data-value="${bv}" ${bt.length && bc <= g.pc ? '' : 'disabled'}>${TR`選んだ ${bt.length} 星系をこの型に変える`}<small>${bt.length && bc > g.pc ? TR('政治力不足') : TR`政治力 ${bc}・光速の指令`}</small></button></div>
    <div class="scroll"><table class="tbl vassals"><tr><th class="vsel"><input type="checkbox" data-act="vselall" ${allOn ? 'checked' : ''} aria-label="すべて選ぶ"></th><th>星系</th><th>人口</th><th>1 人あたりの所得</th><th>GDP</th><th>政府の資金</th><th>交易路</th><th>自給</th><th>忠誠度</th><th>締め出し</th><th>上位 20%</th><th>就学</th><th>定期の資金援助 (cr/年)</th></tr>${tr}</table></div>`;
}

// 従属国のタブの星系 (地球の知る限り、自国の家臣で入植地のある星系)
function vassalIds(g) { return g.knownSystems().map((s) => s.id).filter((id) => id !== g.cap && g.known(id)?.realm === g.cap && g.known(id)?.cols?.length); }
// 型を選べる星系 (直属の家臣。家臣の家臣は、その主人が決める。commands.js の 'rule' と同じ)
function ruleableIds(g) { return vassalIds(g).filter((id) => g.known(id)?.lord === g.cap); }
// 一括変更で型を変える星系 (依頼 KE-5): 選んだ星系のうち、いまも自国の家臣で、型が違い、型を変える指令を送っていないもの
function bulkRuleTargets(g, v) {
  const ids = new Set(ruleableIds(g));
  return [...(app.vassalSel || [])].filter((id) => ids.has(id) && g.knownRegime(g.known(id)) !== v && !g.requests.some((q) => q.kind === 'order' && q.act === 'rule' && Number(q.d.sys) === id));
}
// 自分の国の家臣の星系を、統治体制ごとに数える (地球の知る限り)
function regimeCounts(g) {
  const n = {};
  for (const s of g.knownSystems()) {
    const k = s.id === g.cap ? null : g.known(s.id);
    if (!k || k.lord === null || k.lord === undefined || (k.realm ?? g.cap) !== g.cap || !k.cols?.length) continue;
    const r = g.knownRegime(k);
    n[r] = (n[r] || 0) + 1;
  }
  const parts = REGIME_ORDER.filter((r) => n[r]).map((r) => `${ico(`rg-${r}`)}${REGIMES[r].label} ${n[r]}`);
  return TR`<p class="note">いまの家臣の星系: ${parts.length ? parts.join(TR('・')) : TR('なし')}</p>`;
}

// 帝国 → 交易路: 全交易路の一覧と開設
function routesSheet(app) {
  const g = app.game;
  const goto = (s) => `<button data-act="goto" data-sys="${s.id}">${esc(s.name)}</button>`;
  const top = (tr) => RES.filter((r) => tr[r] > 0.05).sort((a, b) => tr[b] * PRICE[b] - tr[a] * PRICE[a]).slice(0, 3)
    .map((r) => `${resText(r)} ${fmtAmt(tr[r])}`).join(TR('・')) || TR('<span class="muted">なし</span>');
  const rows = g.routes.filter((r) => g.routeKnown(r)).sort((x, y) => (y.vol[0] + y.vol[1]) - (x.vol[0] + x.vol[1])).map((r) => {
    const a = g.system(r.a);
    const b = g.system(r.b);
    const cap = g.routeCap(r);
    const use = g.routeUse(r);
    const busy = busyText(g, (j) => j.type === 'route' && j.route === r.id);
    return TR`<tr><td>${goto(a)} ⇄ ${goto(b)}</td><td>${distance(a, b).toFixed(1)} ly</td><td>Lv${r.lv} <span class="muted">(輸送船 ${Math.round(g.routeShips(r))} 隻・${fmtAmt(cap)}/年)</span></td>
      <td>${fmtAmt(r.vol[0])}/年</td><td>${fmtAmt(r.vol[1])}/年</td><td class="${use > 0.9 ? 'bad' : ''}">${pct(Math.min(use, 1))}</td>
      <td>${top(r.transit[0])}</td><td>${top(r.transit[1])}</td>
      <td>${costButton(g, `data-act="uproute" data-route="${r.id}"`, TR('拡張'), g.routeUpCost(r), r.a, busy)}</td></tr>`;
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
        ${costButton(g, `data-act="route2" data-a="${a}" data-b="${b}"`, TR`${ico('route')}交易路を開設`, g.routeCost(a, b), a)}` : TR('<span class="muted">結べる相手がない</span>')}
      </div>`
    : TR('<p class="note">交易路を結ぶには入植星系が2つ以上必要。</p>');
  return TR`<div class="kpi">
      <div><span>${ico('route')}交易路 (把握分)</span><b>${g.routes.filter((r) => g.routeKnown(r)).length} 本</b><span>各星系が自分で引く</span></div>
      <div><span>${ME.home}の輸出収入</span><b>${fmtAmt(g.ledger.trade || 0)} cr</b><span>年あたり</span></div>
      <div><span>${ME.home}の輸入支出</span><b>${fmtAmt(-(g.ledger.import || 0))} cr</b><span>年あたり</span></div>
    </div>
    <h3>新しい交易路</h3>${open}
    ${requestsTable(g)}
    <h3>${ico('route')}交易路の一覧</h3>
    <p class="note">送れる量は輸送船の数と港の容量 (規模) の小さいほうで、質量 (100 万 t) で数える。船は 30 年で古くなり、交易路を開いた星系の運送業の会社が運賃で造り直し、港が広がったら足す。</p>
    ${rows ? TR`<div class="scroll"><table class="tbl">
      <tr><th>区間 (A ⇄ B)</th><th>距離</th><th>規模</th><th>A→B</th><th>B→A</th><th>稼働率</th><th>通過中の荷 A→B</th><th>通過中の荷 B→A</th><th></th></tr>${rows}</table></div>
      <p class="note">稼働率が100%近い交易路は、拡張すると運べる量が増える。稼働率が9割を超えると知らせが出て、端の星系 (A) の政府が自動で拡張する (資金が費用の1.5倍以上あるとき)。</p>` : TR('<p class="note">まだ交易路はない。</p>')}
    ${autoRoutesToggle(g)}`;
}

