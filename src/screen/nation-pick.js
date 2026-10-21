// --- 国家選択 (銀河地図の上で国を選ぶ。時間は止めたまま) ---
function nationCard(g, n) {
  const cols = g.colonies.filter((c) => g.realmOf(c.sys) === n.cap);
  const others = g.nations.filter((m) => m.cap !== n.cap).map((m) => ({ m, d: g.sysDist(n.cap, m.cap) })).sort((a, b) => a.d - b.d);
  const near = others[0];
  // 難しさの目安: 近い国が多いほど難しい (地球は議会・時代の課題などの手引きがあるぶん易しめ)
  const crowd = others.filter((o) => o.d < 25).length;
  const stars = clamp((n.cap === 0 ? 1 : 2) + (near && near.d < 18 ? 1 : 0) + (crowd >= 2 ? 1 : 0), 1, 3);
  const home = g.target(n.cap, n.body)?.name || g.system(n.cap).name;
  const hm = app.picking.humans.includes(n.cap);
  return `<div class="nat ${app.picking.cap === n.cap ? 'on' : ''}" data-pick="${n.cap}">
    <span class="dot" style="background:${realmColor(n.cap)}"></span> <b class="nm">${esc(n.name)}</b> <span class="muted">首都 ${esc(home)} (${esc(g.system(n.cap).name)})</span><br>
    ${ico('pop')}人口 ${fmtPop(cols.reduce((a, c) => a + c.pop, 0))}・${ico('colony')}星系 ${g.realmSystems(n.cap).length}・種族 ${esc(n.species)}<br>
    ${n.traits.map((t) => `<span class="tr" title="${esc(SPECIES_TRAITS[t].desc)}">${SPECIES_TRAITS[t].label}</span>`).join('')}
    <div class="muted">${n.traits.map((t) => SPECIES_TRAITS[t].desc).join('・')}</div>
    <div>難しさの目安 <b>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</b> <span class="muted">${near ? `いちばん近い国: ${esc(near.m.name)} ${fmt(near.d, 1)} 光年・25 光年以内に ${crowd} か国` : ''}${n.cap === 0 ? '・議会と時代の課題が道案内をする' : ''}</span></div>
    <div class="nb"><button class="hm ${hm ? 'on' : ''}" data-human="${n.cap}" title="人間が動かす国にする (2つ以上でホットシート・ネット対戦)">${hm ? '✓ 人間が動かす' : '＋人間'}</button>${app.picking.edit === n.cap ? '' : `<button class="edit" data-ed="open" data-cap="${n.cap}">アレンジする</button>`}</div>
    ${app.picking.edit === n.cap ? nationEditor(g, n) : ''}
  </div>`;
}
// --- 国のアレンジ (国の名前・種族の名前・特性・母星) ---
const NATION_TRAITS_MAX = 3;
function nationEditor(g, n) {
  const pk = app.picking;
  const clash = (t) => n.traits.some((x) => x !== t && TRAIT_CLASH.some((c) => c.includes(x) && c.includes(t)));
  let home = `<p>母星: <b>${esc(g.target(n.cap, n.body)?.name || '')}</b> (${esc(g.system(n.cap).name)}・太陽系から ${fmt(g.sysDist(0, n.cap), 1)} 光年)
    ${n.cap === 0 ? '<span class="muted">地球の国の母星は変えられない</span>' : `<button data-ed="home">${pk.homeFor === n.cap ? '地図で星系を押す…' : '母星を選び直す'}</button>`}</p>`;
  if (pk.homeFor === n.cap && pk.homeSys !== undefined) {
    const sys = g.system(pk.homeSys);
    const why = homeworldProblem(g, n.cap, pk.homeSys);
    const bodies = sys.bodies.filter((b) => b.type === 'rocky');
    home += why ? `<p class="bad">${esc(sys.name)}: ${esc(why)}</p>`
      : bodies.length ? `<p>${esc(sys.name)} の岩石惑星から選ぶ:</p><div class="btns">${bodies.map((b) => `<button data-ed="body" data-sys="${sys.id}" data-body="${b.id}">${esc(b.name)} <small>住みやすさ ${b.settle?.grade || 0}${b.natives ? `・先住民 ${esc(b.natives.species)}` : ''}</small></button>`).join('')}</div>`
        : `<p class="bad">${esc(sys.name)} には岩石惑星がない</p>`;
  }
  return `<div class="ed">
    <label>国の名前 <input data-ed="name" maxlength="20" value="${esc(n.name)}"></label>
    <label>種族の名前 <input data-ed="species" maxlength="12" value="${esc(n.species)}" ${n.cap === 0 ? 'disabled title="人類の名前は変えられない"' : ''}></label>
    <p>特性 (${NATION_TRAITS_MAX} つまで。食い違うものは同時に選べない)</p>
    <div class="trs">${Object.entries(SPECIES_TRAITS).map(([k, t]) => `<label title="${esc(t.desc)}"><input type="checkbox" data-tr="${k}" ${n.traits.includes(k) ? 'checked' : ''} ${!n.traits.includes(k) && (n.traits.length >= NATION_TRAITS_MAX || clash(k)) ? 'disabled' : ''}> ${t.label}</label>`).join('')}</div>
    ${home}
    <button data-ed="close">閉じる</button>
  </div>`;
}
// 母星にできない理由 (なければ空)
function homeworldProblem(g, cap, sys) {
  if (sys === 0) return '太陽系は地球の国の母星';
  const near = g.nations.find((m) => m.cap !== cap && g.sysDist(m.cap, sys) < 6);
  if (near) return `${near.name}の首都に近すぎる (6 光年以上離す)`;
  return '';
}
// 国の一覧を書き換えて、開始時の状態を作り直す (国家選択のあいだは、まだ何も進んでいない)
function rebuildNations(edit) {
  const old = app.game;
  const defs = old.nations.map(({ mods, ...n }) => JSON.parse(JSON.stringify(n)));
  edit(defs);
  const cam = { ...galaxyView.cam };
  newGame(old.galaxy.seed, old.galaxy.kind || 'flat', old.galaxy.gen || 1);
  const g = app.game;
  g.endYear = old.endYear;
  g.challenges = old.challenges;
  if (old.spectate) g.setSpectate(true);
  g.applyNations(defs, old.handicap);
  Object.assign(galaxyView.cam, cam);
  app.dirty = true;
}
function pickEdit(e) {
  const pk = app.picking;
  const g = app.game;
  const cap = pk.edit;
  const t = e.target;
  const idx = (defs) => defs.findIndex((x) => x.cap === cap);
  if (t.dataset.ed === 'name' && e.type === 'change') {
    rebuildNations((defs) => { const n = defs[idx(defs)]; n.name = t.value.trim() || nationName(n.species, n.traits); });
  } else if (t.dataset.ed === 'species' && e.type === 'change') {
    const v = t.value.trim();
    if (!v || g.nations.some((m) => m.cap !== cap && m.species === v)) { uiNote(v ? 'ほかの国と同じ種族の名前は使えない' : '種族の名前が空'); return renderPick(); }
    rebuildNations((defs) => { const n = defs[idx(defs)]; const suf = suffixOf(n.name, n.species); if (suf) n.name = `${v.replace(/人$/, '')}${suf}`; n.species = v; });
  } else if (t.dataset.tr && e.type === 'change') {
    rebuildNations((defs) => {
      const n = defs[idx(defs)];
      n.traits = t.checked ? [...n.traits, t.dataset.tr].slice(0, NATION_TRAITS_MAX) : n.traits.filter((x) => x !== t.dataset.tr);
    });
  } else if (e.type !== 'click') return;
  else if (t.closest('[data-ed="close"]')) { pk.edit = pk.homeFor = pk.homeSys = undefined; }
  else if (t.closest('[data-ed="home"]')) { pk.homeFor = pk.homeFor === cap ? undefined : cap; pk.homeSys = undefined; }
  else if (t.closest('[data-ed="body"]')) {
    const b = t.closest('[data-ed="body"]');
    const sys = Number(b.dataset.sys);
    if (homeworldProblem(g, cap, sys)) return;
    rebuildNations((defs) => { const n = defs[idx(defs)]; n.cap = sys; n.body = b.dataset.body; });
    pk.humans = pk.humans.map((c) => (c === cap ? sys : c));
    if (pk.cap === cap) pk.cap = sys;
    pk.edit = sys; pk.homeFor = pk.homeSys = undefined;
    app.selectSystem(sys);
    renderPick();
    return centerPick(app.game.system(sys));
  } else return;
  renderPick();
}
function renderPick() {
  const g = app.game;
  const hs = app.picking.humans;
  $('pick').innerHTML = `<h2>国家選択</h2><p class="muted" style="font-size:12px">カードか地図の首都を押して国を選ぶ。「アレンジする」で国の名前・種族・特性・母星を変えられる。「＋人間」で人間の国を増やすと、ホットシート (1 台を交代で使う) かネット対戦で遊べる。選ばなかった国は AI が動かす。難易度: <b>${HANDICAP[g.handicap].label}</b></p>
    ${g.nations.map((n) => nationCard(g, n)).join('')}
    <div class="go">${hs.length > 1
    ? `<button class="big" data-pick="go">人間 ${hs.length} 人・交代で遊ぶ</button><button class="big" data-pick="net">人間 ${hs.length} 人・ネット対戦</button>`
    : `<button class="big" data-pick="go">${esc(g.nationOf(hs[0]).name)}ではじめる</button>`}</div>`;
}
// 首都を、地図のうちパネルに隠れていない部分の真ん中に出す
function centerPick(sys) {
  galaxyView.centerOn(sys);
  const p = $('pick').getBoundingClientRect(), c = canvas.getBoundingClientRect(), z = galaxyView.cam.zoom;
  if (!p.width) return;
  if (p.bottom >= c.bottom - 20 && p.top > c.top + 40) galaxyView.cam.y += (c.bottom - p.top) / 2 / z; // 下に重なる (縦長の画面)
  else galaxyView.cam.x -= Math.max(0, p.right - c.left) / 2 / z; // 左に重なる
}
// 国を選ぶ (カード・地図の首都)。人間の国が 1 つだけのうちは、選んだ国がそのまま人間の国になる
function pickFocus(cap) {
  app.picking.cap = cap;
  if (app.picking.humans.length <= 1) app.picking.humans = [cap];
}
function openPick(cap = 0) {
  app.picking = { cap, humans: [cap] };
  $('home').hidden = true;
  app.homeOpen = false;
  app.speed = 0; updateSpeedButtons();
  app.setView('galaxy');
  app.selectSystem(cap);
  galaxyView.fit();
  document.documentElement.style.setProperty('--pick-top', `${Math.round(document.querySelector('main').getBoundingClientRect().top) + 10}px`);
  renderPick();
  $('pick').hidden = false;
}
$('pick').onclick = (e) => {
  const g = app.game;
  if (e.target.closest('.ed')) return pickEdit(e);
  const eb = e.target.closest('[data-ed="open"]');
  if (eb) { app.picking.edit = Number(eb.dataset.cap); app.picking.homeFor = app.picking.homeSys = undefined; return renderPick(); }
  const hb = e.target.closest('[data-human]');
  if (hb) {
    const c = Number(hb.dataset.human);
    const hs = app.picking.humans;
    if (hs.includes(c)) { if (hs.length > 1) hs.splice(hs.indexOf(c), 1); } else hs.push(c);
    return renderPick();
  }
  const el = e.target.closest('[data-pick]');
  if (!el) return;
  if (el.dataset.pick === 'go' || el.dataset.pick === 'net') {
    const caps = g.nations.map((n) => n.cap).filter((c) => app.picking.humans.includes(c)); // 国の順
    g.setPlayers(caps);
    g.pi = Math.max(0, caps.indexOf(app.picking.cap));
    app.picking = null;
    $('pick').hidden = true;
    PlayLog.add('home', { act: 'nation', caps });
    for (let i = 0; i < caps.length; i++) if (caps[i] !== 0) g.asPlayer(i, () => { if (caps.length > 1) g.msgTo = i; g.message(`${g.nationOf(caps[i]).name}として歩みはじめた。首都は ${g.system(caps[i]).name}。`); g.msgTo = undefined; });
    app.selectSystem(g.cap);
    galaxyView.centerOn(g.system(g.cap));
    save();
    if (el.dataset.pick === 'net') { closeHome(1); setSpeed(0); return Net.openHost(); }
    closeHome(1);
    if (caps.length > 1) showCurtain(g.pi, false);
    return;
  }
  const cap = Number(el.dataset.pick);
  pickFocus(cap);
  app.selectSystem(cap);
  renderPick();
  centerPick(g.system(cap));
};
$('pick').addEventListener('change', (e) => { if (e.target.closest('.ed')) pickEdit(e); });
// 国家選択中の地図: 各国の首都に国の色の輪と名前
function drawPick(v) {
  const { ctx } = v;
  const g = app.game;
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  for (const n of g.nations) {
    const s = g.system(n.cap);
    const [x, y] = v.toScreen(s.x, s.y, s.z);
    const on = app.picking.cap === n.cap;
    ctx.strokeStyle = realmColor(n.cap);
    ctx.lineWidth = on ? 3 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, on ? 18 : 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = on ? '#fff' : 'rgba(230,236,250,.85)';
    ctx.fillText(n.name, x + 16, y - 12);
  }
  ctx.restore();
}
function renderHome() { $('home').innerHTML = homeHtml(); }
function openHome() {
  if (!app.homeOpen) { app.homeSpeed = app.speed; app.speed = 0; updateSpeedButtons(); }
  app.homeOpen = true;
  app.homeArmed = null;
  app.homeNote = '';
  save();
  renderHome();
  $('home').hidden = false;
}
