// --- 委任の報告書 (B-057) ---
// 委任した (直轄でない) 自国の家臣の星系は、10 年ごとに総督が「この 10 年に何をしたか・なぜ」を地球へ書き送る。報告も光の遅れで届く。
// 地球に届いた星系の記録 (known) を、前の報告の時のものと比べて、10 年たつごとに書く (画面だけの記録。セーブには入らない。
// 読み込み直すと、そこから 10 年たって最初の報告が届く)
const GOV_REPORT_YEARS = 10;
const GovReports = { game: null, hist: {}, list: [] };
// 委任方針ごとの「なぜ」(星系の政府が自分の資金で動くときの重み。politics/pc-vassal.js の MANDATES)
const MANDATE_WHY = { balanced: '施設と入植を同じくらいに進めた', expand: '新しい入植地と前哨を先にした', develop: '施設の拡張を先にした', arm: '艦隊と守りを先にした' };
function govSummary(k) {
  const cols = k.cols || [];
  const lv = cols.reduce((a, c) => a + Object.values(c.lv || {}).reduce((x, y) => x + (y || 0), 0), 0);
  return { year: k.year, pop: cols.reduce((a, c) => a + (c.pop || 0), 0), cols: cols.length, lv, credits: k.credits || 0, loyalty: k.loyalty ?? null, mandate: k.mandate || 'balanced', unrest: k.unrest?.stage || 0, garrison: k.garrison || 0 };
}
function govReportText(g, id, a, b) {
  const name = g.system(id).name;
  const parts = [];
  if (Math.abs(b.pop - a.pop) >= 0.5) parts.push(`人口 ${fmtPop(a.pop)} → ${fmtPop(b.pop)}`);
  if (b.cols !== a.cols) parts.push(`入植地 ${a.cols} → ${b.cols}`);
  if (b.lv !== a.lv) parts.push(`施設の段 ${b.lv > a.lv ? '+' : ''}${b.lv - a.lv}`);
  if (Math.round(b.garrison) !== Math.round(a.garrison)) parts.push(`駐留艦隊 ${Math.round(a.garrison)} → ${Math.round(b.garrison)}`);
  parts.push(`資金 ${fmtAmt(a.credits)} → ${fmtAmt(b.credits)} cr`);
  const loy = a.loyalty !== null && b.loyalty !== null ? `忠誠度 ${Math.round(a.loyalty)} → ${Math.round(b.loyalty)}` : '';
  const why = `委任方針「${MANDATES[b.mandate] || MANDATES.balanced}」に従い、${MANDATE_WHY[b.mandate] || MANDATE_WHY.balanced}`;
  const mood = b.unrest >= 2 ? '。住民の不満が強く、地球の判断を待っている' : b.unrest >= 1 ? '。住民に不満の兆しがある' : '';
  return `${name} 総督より: ${why}。この ${Math.round(b.year - a.year)} 年で ${parts.join('・')}${loy ? `・${loy}` : ''}${mood}`; // 帯では 2 行で切れるので「なぜ」を先に
}
// 0.5 秒ごと (知らせの帯を作るとき) に呼ぶ。新しい 10 年の記録が届いた星系の報告を作る
function govReportsTick(g) {
  if (GovReports.game !== g) { GovReports.game = g; GovReports.hist = {}; GovReports.list = []; }
  if (g.spectate) return;
  for (const s of g.knownOwnSystems()) {
    if (s.id === g.cap) continue;
    const k = g.known(s.id);
    if (!k || k.direct || k.lord === null || k.lord === undefined || k.realm !== g.cap) continue;
    const base = GovReports.hist[s.id]; // 前の報告 (はじめは、初めて見た記録) の時の要約
    if (!base) { GovReports.hist[s.id] = govSummary(k); continue; }
    if (k.year < base.year + GOV_REPORT_YEARS) continue;
    const now = govSummary(k);
    GovReports.hist[s.id] = now;
    GovReports.list.unshift({ id: `${s.id}-${Math.floor(k.year)}`, sys: s.id, written: k.year, arrived: g.year, text: govReportText(g, s.id, base, now), at: performance.now() });
    if (GovReports.list.length > 40) GovReports.list.pop();
  }
}
// 帯: 届いたばかりの報告 (20 秒) を 1 つ。イベントのタブ: 新しい順に 12 通
function govReportRail(g) {
  const r = GovReports.list[0];
  if (!r || performance.now() - r.at > 20000) return '';
  const n = GovReports.list.filter((x) => performance.now() - x.at <= 20000).length;
  return `<div class="ri info"><button data-act="fly" data-sys="${r.sys}"><span class="t">${ico('inspect')}${esc(r.text)}</span><span class="m">${Math.floor(r.written)}年に書かれ、${(r.arrived - r.written).toFixed(1)}年かけて届いた${n > 1 ? `・ほかに総督の手紙 ${n - 1} 通 (イベントのタブ)` : ''}</span></button><span></span></div>`;
}
function govReportsHtml(g) {
  if (!GovReports.list.length) return '<p class="note">委任した星系の総督は、10 年ごとに報告を送ってくる (光の遅れで届く)。まだ届いていない。</p>';
  return GovReports.list.slice(0, 12).map((r) => `<div class="ev"><span class="yr">${r.arrived.toFixed(1)}<br><small>${(r.arrived - r.written).toFixed(1)}年遅れ</small></span><span class="txt">${esc(r.text)}</span><button data-act="goto" data-sys="${r.sys}">地図</button></div>`).join('');
}
