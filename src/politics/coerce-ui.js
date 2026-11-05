// --- 人間の国から威圧する画面 (回 AI8・B-308。中身は politics/coerce.js) ---
// 外交の欄 (politics/politics-ui.js の diplomacyHtml) の下に「威圧」の表: 交戦中でない国ごとに、こちらの記録での見立てと「条件を選んで威圧する」ボタン。
// 条件を選ぶ窓は講和会議と同じ箱 (#treatybox) を使う (同時には開かない)
// こちらの記録で見た、相手が飲む見込み。相手から見た見込みはおおよそ −(こちらの見込む戦勝点 + 両方の戦費) で、−(求める点 + 譲る面目) 以下なら飲む
function coerceOutlook(g, e, pts) {
  const o = {};
  const v = g.reservation(g.cap, e, 0, 0, o);
  const margin = v + 2 * (o.cost || 0) - (pts + COERCE.face);
  return { v, p: o.p ?? 0.5, margin, label: !pts ? '' : margin >= 10 ? TR('飲みそう') : margin > -10 ? TR('五分') : TR('断りそう'), cls: margin >= 10 ? 'hz' : margin > -10 ? '' : 'bad' };
}
function coerceState(g, o) {
  if (o.st === 'go') return TR`光速で送信中 あと ${(o.at - g.year).toFixed(1)} 年`;
  if (o.st === 'back') return TR`返事が戻る途中 あと ${(o.at - g.year).toFixed(1)} 年`;
  if (o.st === 'wait') return TR('断られた。宣戦するか引き下がるかを決める (決めること)');
  return TR('相手が考えている');
}
function coerceHtml(g, roots) {
  if (!COERCE.on) return '';
  const mine = g.coerce.filter((o) => o.from === g.cap);
  const rows = roots.filter((r) => r !== g.cap && g.realmAlive(r) && !g.knownAtWar(g.cap, r)).map((r) => {
    const open = mine.find((o) => o.to === r);
    const ol = coerceOutlook(g, r, 0);
    const act = open ? `<span class="muted">${esc(coerceState(g, open))}</span>` : TR`<button data-act="coerceopen" data-sys="${r}">条件を選んで威圧する<small>政治力 ${g.pcCost('coerce', {})}</small></button>`;
    return TR`<tr><td><span class="dot" style="background:${realmColor(r)}"></span>${esc(g.realmName(r))}<br><span class="muted">${g.sysDist(g.cap, r).toFixed(1)} 光年</span></td><td>勝つ見込み ${Math.round(100 * ol.p)}%・戦えば見込む戦勝点 ${Math.round(ol.v)}</td><td class="wrap">${act}</td></tr>`;
  }).join('');
  if (!rows) return '';
  return TR`<h3>威圧</h3>
    <p class="note">艦隊を見せて、星系の明け渡し・従属・交易協定・資金を求める。求めは光速で相手の首都に届き、相手は首都に届いた記録で、戦えば見込む点が −(求める点 + ${COERCE.face}) 以下なら飲む。返事も光速で戻る。断られたら、宣戦するか引き下がるかを決める (引き下がると議会の支持 −${COERCE.backCouncil})。下の見立ては地球に届いた記録で、相手の見立てとは違う。</p>
    <div class="scroll"><table class="tbl"><tr><th>国</th><th>こちらの見立て</th><th></th></tr>${rows}</table></div>`;
}
// 窓の押し方は、初めて開くときに付ける (このファイルは画面の $ より前に読まれる)
function openCoerce(r) { if (!app.coerceBound) { app.coerceBound = true; $('treatybox').addEventListener('click', coerceClick); } app.coercePick = { r, picks: [] }; renderCoerce(); }
function renderCoerce() {
  const g = app.game, box = $('treatybox'), c = app.coercePick;
  if (!c || !g.realmAlive(c.r) || g.knownAtWar(g.cap, c.r)) { box.hidden = true; app.coercePick = null; return; }
  const opts = g.coerceOptions(g.cap, c.r);
  c.picks = c.picks.filter((k) => opts.some((t) => t.k === k));
  const pts = c.picks.reduce((n, k) => n + (opts.find((t) => t.k === k)?.c || 0), 0);
  const ol = coerceOutlook(g, c.r, pts), dist = g.sysDist(g.cap, c.r);
  box.innerHTML = TR`<div class="card"><h2>威圧: ${esc(g.realmName(c.r))}</h2>
    <p>求める点 <b>${pts}</b>${pts ? TR`・飲む見込み (地球に届いた記録で) <b class="${ol.cls}">${ol.label}</b>` : ''}<br><span class="muted">こちらの見立て: 勝つ見込み ${Math.round(100 * ol.p)}%・戦えば見込む戦勝点 ${Math.round(ol.v)}。相手は自分の首都に届いた記録 (光の遅れと読み違いつき) で決める</span></p>
    <p class="note">届くまで ${dist.toFixed(1)} 年。返事も同じだけかかる。断られたら、宣戦するか引き下がるかを決める (引き下がると議会の支持 −${COERCE.backCouncil})。従属は、ほかの条件と一緒には求められない。政治力 ${g.pcCost('coerce', {})}</p>
    <div class="terms">${opts.map((t) => TR`<button data-co="${t.k}" class="${c.picks.includes(t.k) ? 'on' : ''}">${esc(t.label)} <small>${t.c} 点</small></button>`).join('')}</div>
    <div class="row"><button class="big" data-co="send" ${pts ? '' : 'disabled'}>この条件で威圧する</button><button data-co="close" class="ghost">やめる</button></div></div>`;
  box.hidden = false;
}
function coerceClick(e) {
  const b = e.target.closest('button[data-co]');
  if (!b || !app.coercePick) return;
  const k = b.dataset.co, c = app.coercePick;
  if (k === 'close') { $('treatybox').hidden = true; app.coercePick = null; return; }
  if (k === 'send') { const r = issue('coerce', { sys: c.r, terms: c.picks }); if (r?.ok) { $('treatybox').hidden = true; app.coercePick = null; app.dirty = true; save(); } return; }
  if (c.picks.includes(k)) c.picks = c.picks.filter((x) => x !== k);
  else c.picks = k === 'v' ? ['v'] : [...c.picks.filter((x) => x !== 'v'), k];
  renderCoerce();
}
