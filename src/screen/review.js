// --- 時代の終わりの答え合わせ (B-054) ---
// 100 年ごとの時代が終わったら、その時代に「地球が見ていた歴史」(届いた順) と「本当の歴史」(起きた順) を並べて早回しで見せる。
// 本当の歴史には、まだ地球に届いていない出来事も入る (時代の振り返りとして見せる。評論家の 1-3。リセットではなく続きの歴史)
const REVIEW_MS = 9000; // 早回しの長さ
const REVIEW_ROWS = 12;
function eraReview(g, n) {
  const y0 = START_YEAR + ERA_YEARS * n, y1 = y0 + ERA_YEARS;
  const foes = evFoes(g);
  const pick = (e) => evTier(e.kind) >= 2 && !['migration', 'trade'].includes(e.kind) && !STATE_KINDS.has(e.kind) && evConcerns(g, e, foes);
  const seenOf = (e) => g.seenOf(e);
  const all = g.events.filter((e) => e.year >= y0 && e.year < y1 && pick(e));
  const known = all.filter((e) => seenOf(e) < y1).sort((a, b) => seenOf(a) - seenOf(b));
  const truth = [...all].sort((a, b) => a.year - b.year);
  const unseen = all.filter((e) => seenOf(e) >= y1);
  const late = known.reduce((m, e) => (!m || seenOf(e) - e.year > seenOf(m) - m.year ? e : m), null);
  const points = [];
  if (late && seenOf(late) - late.year >= 1) points.push(`いちばん遅れて届いた知らせ: ${late.text} — ${Math.floor(late.year)}年に起き、地球が知ったのは ${Math.floor(seenOf(late))}年 (${(seenOf(late) - late.year).toFixed(0)} 年遅れ)`);
  // 講和を結んだあとも、遠い前線では戦いが続いていた (講和の知らせが届くまで)
  const peace = all.filter((e) => e.kind === 'politics' && e.good && /白紙講和を結んだ|講和条約が結ばれた/.test(e.text)).pop();
  if (peace) {
    const after = all.filter((e) => e.kind === 'battle' && e.year > peace.year);
    if (after.length) points.push(`${Math.floor(peace.year)}年に講和を結んだあとも、艦隊戦が ${after.length} 回起きていた (最後は ${Math.floor(after[after.length - 1].year)}年・${g.system(after[after.length - 1].sys)?.name || ''})`);
  }
  if (unseen.length) points.push(`この時代に起きたのに、まだ地球に届いていない出来事が ${unseen.length} 件ある (例: ${unseen[0].text})`);
  if (!points.length) points.push('この時代、地球に届いた知らせと本当の歴史は、ほとんど同じ順だった (近い星系が多かった)');
  // 並べる行: 遅れの大きい出来事から REVIEW_ROWS 個 (同じ出来事を、左は届いた順・右は起きた順に並べるので、順の入れ替わりが見える)
  const rows = new Set([...all].sort((a, b) => seenOf(b) - b.year - (seenOf(a) - a.year) || b.year - a.year).slice(0, REVIEW_ROWS));
  return { n, y0, y1, known: known.filter((e) => rows.has(e)), truth: truth.filter((e) => rows.has(e)), points, seenOf };
}
function showEraReview(g, n) {
  const r = eraReview(g, n);
  setSpeed(0);
  const row = (e, t, side) => `<li data-t="${t.toFixed(3)}" data-side="${side}"><span class="yr">${Math.floor(t)}</span> ${esc(e.text)}${side === 'k' && r.seenOf(e) - e.year >= 1 ? ` <span class="muted">(${Math.floor(e.year)}年の出来事)</span>` : ''}${side === 't' && r.seenOf(e) >= r.y1 ? ' <span class="bad">まだ届いていない</span>' : ''}</li>`;
  $('endbox').innerHTML = `<div class="card review"><h2>${r.y0}〜${r.y1}年の答え合わせ</h2>
    <p class="muted">地球が見ていた歴史と、本当の歴史。<span id="rv-year">${r.y0}</span>年</p>
    <ul class="points">${r.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <div class="cols"><div><h3>地球が見ていた歴史 (届いた順)</h3><ol>${r.known.map((e) => row(e, r.seenOf(e), 'k')).join('') || '<li class="muted">なし</li>'}</ol></div>
      <div><h3>本当の歴史 (起きた順)</h3><ol>${r.truth.map((e) => row(e, e.year, 't')).join('') || '<li class="muted">なし</li>'}</ol></div></div>
    <div class="btns"><button id="rvgo">次の時代へ</button><button id="rvagain" class="ghost">もう一度早回し</button></div></div>`;
  $('endbox').hidden = false;
  $('rvgo').onclick = () => { $('endbox').hidden = true; app.reviewAnim = null; };
  $('rvagain').onclick = () => playEraReview(r);
  PlayLog.add('ui', { act: 'review', n });
  playEraReview(r);
}
// 早回し: 年の針が時代の始めから終わりまで進み、その年までに起きた (届いた) 行が順に灯る
function playEraReview(r) {
  const t0 = performance.now();
  const anim = (app.reviewAnim = {});
  const step = (now) => {
    if (app.reviewAnim !== anim || $('endbox').hidden) return;
    const k = Math.min(1, (now - t0) / REVIEW_MS);
    const y = r.y0 + (r.y1 - r.y0) * k;
    const yEl = $('rv-year');
    if (yEl) yEl.textContent = Math.floor(y);
    document.querySelectorAll('#endbox li[data-t]').forEach((li) => li.classList.toggle('lit', Number(li.dataset.t) <= y));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// 0.5 秒ごと (知らせの帯を作るとき) に呼ぶ。時代が変わったら、終わった時代の答え合わせを出す (開いた・ロードした時点の時代は数えない)
function eraReviewTick(g) {
  const n = g.era?.n;
  if (n === undefined || g.spectate || Net.on) return;
  if (app.reviewGame !== g) { app.reviewGame = g; app.reviewN = n; return; }
  if (n > app.reviewN && n >= 1) { app.reviewN = n; showEraReview(g, n - 1); }
}
