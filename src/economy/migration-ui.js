// 帝国 → 移民: 過密な入植地、受け入れ先、移動中の移民船、到着の記録
function migrationSheet(app) {
  const g = app.game;
  const goto = (s) => `<button data-act="goto" data-sys="${s.id}">${esc(s.name)}</button>`;
  const kc = g.knownOwnSystems().flatMap((x) => g.knownColonies(x.id));
  const capOf = (c) => c.cap ?? g.capOf(c);
  const ratio = (c) => c.pop / capOf(c);
  const crowded = kc.filter((c) => ratio(c) >= 0.85).sort((a, b) => ratio(b) - ratio(a));
  const crowdRows = crowded.map((c) => `<tr><td>${esc(c.name)}</td><td>${goto(g.system(c.sys))}</td><td>${fmtPop(c.pop)} / ${fmtPop(capOf(c))}</td>
    <td class="${ratio(c) >= 0.9 ? 'bad' : ''}">${pct(ratio(c))}</td><td>${ageBadge(g, c.sys)}</td></tr>`).join('');
  const dests = kc.map((c) => ({ c, room: capOf(c) * 0.8 - c.pop })).filter((x) => x.room > 0.001)
    .sort((a, b) => b.room - a.room).slice(0, 15);
  const destRows = dests.map(({ c, room }) => {
    const ok = (c.sat?.food ?? 1) >= 0.99 && (!g.needsWater(c) || (c.sat?.water ?? 1) >= 0.99);
    return `<tr><td>${esc(c.name)}</td><td>${goto(g.system(c.sys))}</td><td>${fmtPop(room)}</td><td>${ageBadge(g, c.sys)}</td>
      <td>${ok ? TR('<span class="hz">受け入れ可</span>') : TR('<span class="bad">食料・水が不足</span>')}</td></tr>`;
  }).join('');
  const seenMig = g.migrants.filter((m) => g.departSeen(m.fromSys, m.depart));
  const flights = [...seenMig].sort((a, b) => a.arrive - b.arrive).slice(0, 30).map((m) => {
    const f = g.colonyByKey(m.from);
    const d = g.colonyByKey(m.to);
    return TR`<tr><td>${esc(f?.name || '?')} → ${esc(d?.name || '?')}</td><td>${fmtPop(m.n)}</td><td>あと ${Math.max(0, m.arrive - g.year).toFixed(1)} 年</td></tr>`;
  }).join('');
  const mlog = g.migLog.filter((m) => (m.seen ?? m.year) <= g.year);
  const total = mlog.reduce((k, m) => k + m.n, 0);
  const log = mlog.slice(0, 30).map((m) => `<tr><td class="muted">${m.year.toFixed(1)}</td><td>${esc(m.from)} → ${esc(m.to)}</td><td>${fmtPop(m.n)}</td></tr>`).join('');
  return TR`<label class="check auto"><input type="checkbox" data-act="migration" ${g.migration ? 'checked' : ''}> ${ico('migration')}恒星間移民を許可する</label>
    <label class="check auto"><input type="checkbox" data-act="autohabitat" ${g.autoHabitat ? 'checked' : ''}> 過密な入植地の居住区を自動で拡張する</label>
    <p class="note">人口が上限の90%を超えた入植地では、居住区の拡張 (オンのとき) と移民が同時に進む。年に1回、人口の3% (上限を超えていれば5%) が移民船で出ていく。行き先は食料と水が足りている入植地のうち、空き (上限の80%まで) が大きく、近いところ。</p>
    <div class="kpi">
      <div><span>過密な入植地</span><b>${crowded.filter((c) => ratio(c) >= 0.9).length} か所</b><span>上限の90%以上</span></div>
      <div><span>移動中 (把握分)</span><b>${fmtPop(seenMig.reduce((k, m) => k + m.n, 0))}</b><span>移民船 ${seenMig.length} 隻</span></div>
      <div><span>最近の到着 (把握分)</span><b>${fmtPop(total)}</b><span>直近 ${mlog.length} 便</span></div>
    </div>
    <h3>過密な入植地 (上限の85%以上)</h3>
    ${crowdRows ? TR`<div class="scroll"><table class="tbl"><tr><th>入植地</th><th>星系</th><th>人口 / 上限</th><th>過密度</th><th>情報</th></tr>${crowdRows}</table></div>` : TR('<p class="note">過密な入植地はない。</p>')}
    <h3>受け入れ先 (空きの大きい順)</h3>
    ${destRows ? TR`<div class="scroll"><table class="tbl"><tr><th>入植地</th><th>星系</th><th>空き</th><th>情報</th><th>状態</th></tr>${destRows}</table></div>` : TR('<p class="note">空きのある入植地がない。</p>')}
    <h3>移動中の移民船</h3>
    ${flights ? TR`<div class="scroll"><table class="tbl"><tr><th>区間</th><th>人数</th><th>到着</th></tr>${flights}</table></div>` : TR('<p class="note">移動中の移民船はない。</p>')}
    <h3>到着の記録</h3>
    ${log ? TR`<div class="scroll"><table class="tbl"><tr><th>年</th><th>区間</th><th>人数</th></tr>${log}</table></div>` : TR('<p class="note">まだ記録はない。</p>')}`;
}

