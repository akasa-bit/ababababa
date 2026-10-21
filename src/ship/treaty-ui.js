// --- 講和会議で条件を選ぶ ---
// 選んだ順が入札の順番 (同時入札で先に取りたいものから)。持ち点を超える分は取れない
function openTreaty(id) { app.treaty = { id, picks: [] }; renderTreaty(); }
function renderTreaty() {
  const g = app.game;
  const c = g.conferences.find((x) => x.id === app.treaty?.id);
  const bid = c?.bids.find((b) => b.realm === g.cap);
  const box = $('treatybox');
  if (!c || !bid || bid.picks) { box.hidden = true; app.treaty = null; return; }
  const terms = g.treatyTerms(c);
  const picks = app.treaty.picks;
  const used = picks.reduce((k, id) => k + (terms.find((t) => t.id === id)?.cost || 0), 0);
  const others = c.bids.filter((b) => b !== bid);
  box.innerHTML = `<div class="card"><h2>${ico('peace')}講和会議: ${esc(g.realmName(c.loser))}</h2>
    <p>持ち点 <b>${bid.pts}</b>・選んだ条件 <b class="${used > bid.pts ? 'bad' : ''}">${used}</b>${others.length ? `<br><span class="muted">ほかの勝った国: ${others.map((b) => `${esc(g.realmName(b.realm))} (持ち点 ${b.pts})`).join('・')}。同じ条件を選んだら、残りの持ち点の多い国が取る</span>` : ''}</p>
    <p class="note">押した順に入札する。持ち点を超えた分は取れない。${Math.floor(c.until)}年までに選ばなければ自動で選ぶ。</p>
    <div class="terms">${terms.map((t) => { const i = picks.indexOf(t.id); return `<button data-tr="${t.id}" class="${i >= 0 ? 'on' : ''}">${i >= 0 ? `<b>${i + 1}.</b> ` : ''}${esc(t.label)} <small>${t.cost} 点</small></button>`; }).join('')}</div>
    <div class="row"><button class="big" data-tr="send">この条件で講和する</button><button data-tr="auto">おまかせで選ぶ</button><button data-tr="close" class="ghost">あとで</button></div></div>`;
  box.hidden = false;
}
$('treatybox').onclick = (e) => {
  const b = e.target.closest('button[data-tr]');
  if (!b || !app.treaty) return;
  const g = app.game;
  const k = b.dataset.tr;
  if (k === 'close') { $('treatybox').hidden = true; app.treaty = null; return; }
  if (k === 'auto') { const c = g.conferences.find((x) => x.id === app.treaty.id); app.treaty.picks = g.aiTreatyPicks(c, c.bids.find((x) => x.realm === g.cap)); return renderTreaty(); }
  if (k === 'send') { issue('treaty', { id: app.treaty.id, picks: app.treaty.picks }); $('treatybox').hidden = true; app.treaty = null; app.dirty = true; return save(); }
  const p = app.treaty.picks;
  if (p.includes(k)) p.splice(p.indexOf(k), 1); else p.push(k);
  renderTreaty();
};
