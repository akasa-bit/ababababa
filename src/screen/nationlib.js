// --- 自作の国 (ホーム画面の「国家づくり」) ---
// 作った国はこのブラウザに保存し、どの試合でも人間の国・AI の国として出せる
const NATION_LIB_MAX = 20;
const NationLib = {
  key: `${STORE}-nations`,
  list: [], // [{ id, name, species, traits, env, dist }]
  parse(t) {
    try { const a = JSON.parse(t || '[]'); this.list = Array.isArray(a) ? a.filter((n) => n && n.id && n.name && n.species).map((n) => ({ ...n, traits: (n.traits || []).filter((x) => SPECIES_TRAITS[x]).slice(0, NATION_TRAITS_MAX) })) : []; } catch { this.list = []; }
  },
  save() { Store.put(this.key, JSON.stringify(this.list)); },
  get(id) { return this.list.find((n) => n.id === id); },
};
// 特性の選び方の決まり: 3 つまで、食い違うものは同時に持たない
const traitBlocked = (traits, t) => !traits.includes(t) && (traits.length >= NATION_TRAITS_MAX || traits.some((x) => TRAIT_CLASH.some((c) => c.includes(x) && c.includes(t))));
function suffixOf(name, species) { const stem = species.replace(/人$/, ''); return name.startsWith(stem) ? name.slice(stem.length) : ''; }
function nationsTabHtml() {
  const ed = app.natEdit;
  const card = (n) => `<div class="natc"><div class="info"><b class="nm">${esc(n.name)}</b> <span class="muted">種族 ${esc(n.species)}</span><br>
      ${n.traits.map((t) => `<span class="tr" title="${esc(SPECIES_TRAITS[t].desc)}">${ico(`tr-${t}`)}${SPECIES_TRAITS[t].label}</span>`).join('') || '<span class="muted">特性なし</span>'}
      <div class="muted">母星: ${HOME_ENV[n.env || 'any']}・${HOME_DIST[n.dist || 'any']}</div></div>
    <div class="btns"><button data-home="natedit" data-id="${n.id}">直す</button><button data-home="natcopy" data-id="${n.id}">複製</button><button class="ghost" data-home="natdel" data-id="${n.id}">${app.homeArmed === `nd${n.id}` ? '本当に消す?' : '消す'}</button></div></div>`;
  const editor = ed ? `<div class="nated">
      <h3>${ed.id ? '国を直す' : '新しい国'}</h3>
      <label>種族の名前 <input id="ne-species" maxlength="12" value="${esc(ed.species)}" placeholder="例: ミナーラ人"></label>
      <label>国の名前 <input id="ne-name" maxlength="20" value="${esc(ed.name)}" placeholder="例: ミナーラ独立国"></label>
      <label>接尾辞から選ぶ <select id="ne-suffix"><option value="">(自分で書く)</option>${NATION_SUFFIX.map((x) => `<option value="${esc(x.s)}" ${suffixOf(ed.name, ed.species) === x.s ? 'selected' : ''}>${esc(x.s)} — ${esc(x.ex)}</option>`).join('')}</select></label>
      <p>特性 (${NATION_TRAITS_MAX} つまで。食い違うものは同時に選べない)</p>
      <div class="trs">${Object.entries(SPECIES_TRAITS).map(([k, t]) => `<label title="${esc(t.desc)}"><input type="checkbox" class="ne-tr" value="${k}" ${ed.traits.includes(k) ? 'checked' : ''} ${traitBlocked(ed.traits, k) ? 'disabled' : ''}><span><b>${ico(`tr-${k}`)}${t.label}</b><small>${esc(t.desc)}</small></span></label>`).join('')}</div>
      <label>母星の環境 <select id="ne-env">${Object.entries(HOME_ENV).map(([k, l]) => `<option value="${k}" ${ed.env === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>太陽系からの距離 <select id="ne-dist">${Object.entries(HOME_DIST).map(([k, l]) => `<option value="${k}" ${ed.dist === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="note">母星は、銀河ができたときに、この好みに合う住みやすい岩石惑星から選ぶ (合う星がなければ条件をゆるめる)。銀河ができたあと、国家選択の画面の「アレンジする」で選び直すこともできる。</p>
      ${app.natNote ? `<p class="note bad">${esc(app.natNote)}</p>` : ''}
      <div class="row"><button class="big" data-home="natsave">保存する</button><button class="ghost" data-home="natcancel">やめる</button></div></div>` : '';
  return `<section><h3>国家づくり</h3>
    <p class="note">ここで作った国は、このブラウザに保存され、どの試合にも出せる (新しいゲームの「自作の国を出す」で選ぶ)。国家選択の画面で「＋人間」にすれば自分で動かし、そうでなければ AI が動かす。${NATION_LIB_MAX} か国まで。</p>
    ${editor || `<div class="row"><button class="big" data-home="natnew" ${NationLib.list.length >= NATION_LIB_MAX ? 'disabled' : ''}>新しい国を作る</button></div>`}
    ${NationLib.list.map(card).join('') || (ed ? '' : '<p class="muted">まだ国がない。</p>')}</section>`;
}
// 国の編集欄の中身を app.natEdit に読み込む (描き直しで入力が消えないように)
function readNatForm() {
  const ed = app.natEdit;
  if (!ed || !$('ne-species')) return;
  ed.species = $('ne-species').value.trim();
  ed.name = $('ne-name').value.trim();
  ed.env = $('ne-env').value;
  ed.dist = $('ne-dist').value;
  ed.traits = [...document.querySelectorAll('#home .ne-tr')].filter((x) => x.checked).map((x) => x.value);
}
function natAction(act, id) {
  readNatForm();
  app.natNote = '';
  if (act === 'natnew') { const sp = `${KANA_A[Math.floor(Math.random() * KANA_A.length)]}${KANA_B[Math.floor(Math.random() * KANA_B.length)]}人`; app.natEdit = { id: null, species: sp, name: nationName(sp), traits: [], env: 'any', dist: 'any' }; }
  else if (act === 'natedit') { const n = NationLib.get(id); app.natEdit = n ? JSON.parse(JSON.stringify(n)) : null; }
  else if (act === 'natcopy') { const n = NationLib.get(id); if (n && NationLib.list.length < NATION_LIB_MAX) app.natEdit = { ...JSON.parse(JSON.stringify(n)), id: null, name: `${n.name} (写し)` }; }
  else if (act === 'natdel') {
    if (app.homeArmed !== `nd${id}`) { app.homeArmed = `nd${id}`; return renderHome(); }
    app.homeArmed = null;
    NationLib.list = NationLib.list.filter((n) => n.id !== id);
    app.homeLib = (app.homeLib || []).filter((x) => x !== id);
    NationLib.save();
  } else if (act === 'natcancel') app.natEdit = null;
  else if (act === 'natsave') {
    const ed = app.natEdit;
    const why = !ed.species ? '種族の名前を入れる' : ed.species === HUMAN ? '人類は地球の国の種族' : !ed.name ? '国の名前を入れる'
      : NationLib.list.some((n) => n.id !== ed.id && n.species === ed.species) ? 'ほかの自作の国と同じ種族の名前' : '';
    if (why) { app.natNote = why; return renderHome(); }
    const n = { id: ed.id || `n${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name: ed.name, species: ed.species, traits: ed.traits.slice(0, NATION_TRAITS_MAX), env: ed.env, dist: ed.dist };
    const i = NationLib.list.findIndex((x) => x.id === n.id);
    if (i >= 0) NationLib.list[i] = n; else NationLib.list.push(n);
    NationLib.save();
    app.natEdit = null;
  }
  renderHome();
}
$('home').addEventListener('change', (e) => {
  const t = e.target;
  // 生産性: 「自分で決める」のときだけ倍率を入れられる。ほかは、その選択の倍率を見せる
  if (t.id === 'home-prod') { const k = $('home-prodk'); k.disabled = t.value !== 'custom'; if (t.value !== 'custom') k.value = String(PRODUCTIVITY[t.value].k); return; }
  if (!app.natEdit || !t.closest('.nated')) return;
  readNatForm();
  const ed = app.natEdit;
  if (t.id === 'ne-suffix' && t.value) ed.name = `${ed.species.replace(/人$/, '')}${t.value}`;
  if (t.id === 'ne-species') { const suf = suffixOf(app.natEdit.prevName ?? ed.name, app.natEdit.prevSpecies ?? ed.species); if (suf) ed.name = `${ed.species.replace(/人$/, '')}${suf}`; }
  ed.prevName = ed.name; ed.prevSpecies = ed.species;
  renderHome();
});
$('home').addEventListener('focusin', (e) => { if (e.target.id === 'ne-species' && app.natEdit) { app.natEdit.prevSpecies = e.target.value.trim(); app.natEdit.prevName = $('ne-name').value.trim(); } });

