function councilChart(v) {
  const n = clamp(Math.round(v), 0, 100);
  const dots = COUNCIL_SEATS.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.6" fill="${i < n ? 'var(--own)' : 'var(--enemy)'}" opacity="${i < n ? 1 : 0.75}"/>`).join('');
  const mark = (k, label) => {
    const a = Math.PI * (1 - k / 100), c = Math.cos(a), sn = Math.sin(a);
    return `<line x1="${(100 + 30 * c).toFixed(1)}" y1="${(100 - 30 * sn).toFixed(1)}" x2="${(100 + 99 * c).toFixed(1)}" y2="${(100 - 99 * sn).toFixed(1)}" stroke="var(--muted)" stroke-width="0.6" stroke-dasharray="2 2"/>
      <text x="${(100 + 102 * c).toFixed(1)}" y="${(100 - 102 * sn).toFixed(1)}" fill="var(--muted)" font-size="7" text-anchor="${c < -0.1 ? 'end' : c > 0.1 ? 'start' : 'middle'}">${label}</text>`;
  };
  return TR`<figure class="council"><svg viewBox="-40 -12 280 120" role="img" aria-label="議会の支持 ${n} / 100 議席">
      ${dots}${mark(15, TR('15 政権交代'))}${mark(50, '50')}
      <text x="100" y="92" fill="var(--fg)" font-size="22" text-anchor="middle" class="num">${n}</text>
      <text x="100" y="104" fill="var(--muted)" font-size="7" text-anchor="middle">/ 100 議席が支持</text>
    </svg><figcaption><span class="sw own"></span>支持 ${n} <span class="sw opp"></span>不支持 ${100 - n}</figcaption></figure>`;
}

// 年齢 3 区分の帯と扶養比 (回 KE2。10-5 の a)。s = ageShares() か、記録 (known) の cols[].ages。星系の欄 (画面のレーン) からも呼べる
function ageBarHtml(s) {
  if (!s) return '<span class="muted">—</span>';
  const seg = (v, col, label) => `<span title="${label} ${pct(v)}" style="display:inline-block;height:0.7em;width:${(v * 100).toFixed(1)}%;background:${col}"></span>`;
  return TR`<span class="agebar" style="display:inline-flex;width:8em;vertical-align:middle;border:1px solid var(--line)">${seg(s.young, 'var(--info)', TR('0〜14 歳'))}${seg(s.work, 'var(--fg)', TR('15〜64 歳'))}${seg(s.old, 'var(--warn)', TR('65 歳〜'))}</span>
    <span class="muted">子ども ${pct(s.young)}・働き手 ${pct(s.work)}・高齢 ${pct(s.old)}・扶養比 <span class="${s.dep > DEMO.alert ? 'bad' : ''}">${Math.round(s.dep * 100)}</span></span>`;
}
// 帝国 → 目標の「財政」: 税・中央銀行と政策金利・予算。変えると光速で広がる (国家方針と同じ)
// 財政のスライダーの値の見せ方 (data-fmt)
function fiscalFmt(fmt, v) {
  v = Number(v);
  if (fmt === 'pct0') return `${Math.round(v * 100)}%`;
  if (fmt === 'pct1') return `${(v * 100).toFixed(1)}%`;
  if (fmt === 'pct2') return TR`年 ${(v * 100).toFixed(2)}%`;
  if (fmt === 'pct1gdp') return v ? TR`GDP の ${(v * 100).toFixed(1)}%/年` : TR('なし');
  return String(v);
}
function fiscalHtml(g) {
  const f = g.fiscal || FISCAL_DEFAULT;
  const cg = g.gov(g.cap);
  const tax = Math.max(0, g.gov(g.cap).ledger?.tax || 0);
  const pend = g.fiscal ? g.realmSystems(g.cap).filter((s) => g.year < f.since + g.sysDist(g.cap, s.id)).length : 0;
  // 値はスライダーで細かく選ぶ (幅と刻みは docs/policy-ranges.md)。離すと命令になる。動かしているあいだは値だけ変わる (onPanelInput)
  const slider = (k, [lo, hi], step, cur, fmt, label) => `<label class="slider"><input type="range" data-act="fiscal" data-k="${k}" data-fmt="${fmt}" min="${lo}" max="${hi}" step="${step}" value="${cur}" aria-label="${label}"><output>${fiscalFmt(fmt, cur)}</output></label>`;
  const used = Object.keys(BUDGET).reduce((a, k) => a + (f.budget?.[k] || 0), 0);
  const paid = g.gov(g.cap).bpaid ?? 1;
  const taxRate = taxRateOf(f.tax), taxK = taxRate / MARKET.tax, bK = burdenK(f);
  const rule = (f.cb ?? 1) === 1, cbRate = g.cbRateAt(g.cap), cbs = g.cb[g.cap] || { pi: CB.pistar }; // 中央銀行 (回 KE1。画面から状態を作らない)
  const rows = Object.entries(BUDGET).map(([k, b]) => {
    const sh = f.budget?.[k] || 0;
    const T = g.tech[g.cap], w = T?.rd && T.S > 0 ? T.rd.spend / T.S : 0; // 研究は、払った額 ÷ 研究者 1 人の費用だけ公の研究者を足す (回 KE6)
    const eff = k === 'education' ? TR`教育の支出 GDP の ${g.eduSpendPct({ sys: g.cap }).toFixed(1)}%` : k === 'research' ? TR`公の研究者 +${fmtAmt(w > 0 ? (sh * paid * tax) / w : 0)} 人 (効くのは ${RND.lag[0]}〜${RND.lag[1]} 年あと)` : TR`効き目 ${pct(budgetEffect(sh * paid))}`; // 教育は budgetEffect でなく教育の支出 ÷ GDP で効く (回 KE5)
    return `<tr><td>${ico(BUDGET_ICON[k])}${b.label}</td><td>${slider(k, BUDGET_RANGE, BUDGET_STEP, sh, 'pct0', b.label)}</td><td>${sh ? TR`${fmtAmt(sh * tax)} cr/年・${eff}` : TR('<span class="muted">使わない</span>')}</td><td class="muted wrap">${esc(b.good)}</td></tr>`;
  }).join('');
  return TR`<h3>${ico('credits')}財政</h3>
    <p class="note">値はスライダーで細かく選ぶ (幅は現実の国で使われた値の 1〜99% 点。離すと決まる)。税率・政策金利・赤字の上限を変えるには政治力 ${FISCAL_COST} が要る。予算の割り振りは政治力が要らない。どれも、知らせが光速で届いた星系から効く${pend ? TR` (いまの財政がまだ届いていない星系 ${pend})` : ''}。効き目の大きさは仮の値。</p>
    <table class="tbl">
      <tr><td>税率</td><td>${slider('tax', TAX_RANGE, TAX_STEP, taxRate, 'pct1', TR('税率'))}</td><td colspan="2" class="muted wrap">所得への税 (標準 ${(MARKET.tax * 100).toFixed(1)}% の ×${taxK.toFixed(2)})${Math.abs(bK - 1) > 1e-9 ? TR`・消費税と合わせた重さ ×${bK.toFixed(2)}: 家臣の忠誠度の目標 ${TAX_LOYALTY * (bK - 1) > 0 ? '+' : ''}${(TAX_LOYALTY * (bK - 1)).toFixed(1)}・議会の支持 年 ${TAX_COUNCIL * (bK - 1) > 0 ? '+' : ''}${(TAX_COUNCIL * (bK - 1)).toFixed(2)}` : ''}。自給の所得には掛からない</td></tr>
      <tr><td>消費税</td><td>${slider('ctax', CTAX_RANGE, CTAX_STEP, f.ctax || 0, 'pct1', TR('消費税'))}</td><td colspan="2" class="muted wrap">家計の買い物 (物とサービス) の値段に掛け、星系の政府に入る。所得の低い星系に重い (逆進)。忠誠度と議会への効き目は税率と合わせた重さで決まる</td></tr>
      <tr><td>関税</td><td>${slider('tariff', TARIFF_RANGE, TARIFF_STEP, f.tariff || 0, 'pct1', TR('関税'))}</td><td colspan="2" class="muted wrap">ほかの国からの輸入の値段に掛ける (買い手の会社が、買い手の星系の政府に払う)。高いほど国の中の売り手から買う。政府の資材の買い付けと主人の支援には掛からない</td></tr>
      <tr><td>中央銀行</td><td><select data-act="fiscal" data-k="cb" aria-label="政策金利の決め方"><option value="1"${rule ? ' selected' : ''}>任せる (テイラー則)</option><option value="0"${rule ? '' : ' selected'}>自分で決める</option></select></td><td colspan="2" class="muted wrap">任せると、中央銀行が物価の上がり方と景気の速さを見て政策金利を決める (中立の金利 年 ${(g.rstarOf(g.cap) * 100).toFixed(2)}% + 物価の上がり方 + ${CB.phiPi} × (物価の上がり方 − 目標 ${(CB.pistar * 100).toFixed(0)}%) + ${CB.phiY} × 景気のずれ)。中立の金利は、1 人あたりの生産力の伸びが速いほど高い。政策金利を動かすと「自分で決める」になる</td></tr>
      <tr><td>政策金利</td><td>${slider('rate', RATE_RANGE, RATE_STEP, rule ? cbRate : f.rate, 'pct2', TR('政策金利'))}</td><td colspan="2" class="muted wrap">名目の金利。会社と家計の借り・預金・交易の運ぶ年数には、物価の上がり方を引いた実質の金利 (いま 年 ${(g.rateAt(g.cap) * 100).toFixed(2)}%) が効く (運ぶ年数ぶん輸入の値段が e^(実質の金利 × 年数) 倍)。物価より低いまま止めると、物価の上がり方が上がっていく</td></tr>
      <tr><td>物価</td><td class="num">年 ${(cbs.pi * 100).toFixed(1)}%</td><td colspan="2" class="muted wrap">物価の上がり方 (目標 ${(CB.pistar * 100).toFixed(0)}%)。物価の指数 ${g.cpiOf(g.cap).toFixed(2)} (始め 1)。帳簿は始めの値段で数えるので、思ったより物価が上がると、預金と国債の重さがそのぶん減る</td></tr>
      <tr><td>長期の国債の利回り</td><td class="num">年 ${(g.longYield(g.cap) * 100).toFixed(2)}%</td><td colspan="2" class="muted wrap">10 年の国債: 政策金利の見込み + 期間の上乗せ + 信用の上乗せ (国債 ÷ GDP × ${(CB.credit * 100).toFixed(2)}%。いま ${(CB.credit * Math.min(CB.dmax, (cg.bond || 0) / Math.max(cg.fr?.y || 0, 1e-9)) * 100).toFixed(2)}%)。国債 ÷ GDP が ${Math.round(CB.dmax * 100)}% を超えると不履行になり、国債の ${Math.round(CB.haircut * 100)}% を払わない (預金がそのぶん目減りする)。不履行のあと ${Math.round(CB.exclude)} 年は新しく国債を出せず、戻ったあとも ${CB.spread[2]} 年まで利回りに上乗せがつく${g.dfltOut(cg) ? TR`(いまは不履行のあとで、あと ${(CB.exclude - (g.year - cg.dflt)).toFixed(1)} 年借りられない)` : ''}</td></tr>
      <tr><td>赤字の上限</td><td>${slider('deficit', DEFICIT_RANGE, DEFICIT_STEP, f.deficit || 0, 'pct1gdp', TR('赤字の上限'))}</td><td colspan="2" class="muted wrap">資金が足りない分を、1 年にこの額まで国債で借りる (${ME.capName}の GDP ${fmtAmt(cg.fr?.y || 0)} cr/年)。国債 ${fmtAmt(cg.bond || 0)} cr・いま借りられる額 ${fmtAmt(Math.max(0, g.funds(g.cap) - cg.credits))} cr。手元の資金が税収の ${Math.round(DEBT.cash * 12)} か月分を超えると、超えた分で国債を返す。国債 ÷ GDP は ${Math.round(DEBT.limit * 100)}% まで</td></tr>
      ${(() => { const T = g.tech[g.cap], rd = T?.rd, Y = rd?.y || 0; return TR`<tr><td>研究開発の税額控除</td><td>${slider('rdcredit', RDCREDIT_RANGE, RDCREDIT_STEP, f.rdcredit ?? FISCAL_DEFAULT.rdcredit, 'pct1', TR('研究開発の税額控除'))}</td><td colspan="2" class="muted wrap">会社の研究開発費のこの割合を政府が返す (いま ${fmtAmt(rd?.credit || 0)} cr/年。研究開発費は GDP の ${Y > 0 ? ((100 * rd.spend) / Y).toFixed(2) : '0'}%、そのうち政府が出す分 ${rd?.spend > 0 ? pct(rd.pub / rd.spend) : '—'})。既定は ${(FISCAL_DEFAULT.rdcredit * 100).toFixed(1)}% (現実の国の中央値)。控除を上げると会社の研究者が増える (研究開発の値段への弾力性 ${RND.elastic}。${RND.adjust} 年ほどで寄る)</td></tr>`; })()}
      ${(() => { const Y = g.realmSystems(g.cap).reduce((k, x) => k + (g.govs[x.id]?.fr?.y || 0), 0), pin = cg.pinY || 0; return TR`<tr><td>外との配当</td><td class="num">${pin >= 0 ? '+' : '−'}${fmtAmt(Math.abs(pin))} cr/年</td><td colspan="2" class="muted wrap">国民総所得 (GNI) = GDP + ほかの国の会社の持ち分から受け取る配当 − ほかの国の持ち主に払う配当。国の GDP ${fmtAmt(Y)} cr/年 に対して GNI ÷ GDP ${Y > 0 ? ((Y + pin) / Y).toFixed(3) : '—'}。新しい投資の ${Math.round(OWNER.fdi * 100)}% はほかの国が出す (豊かな国ほど多く出す)</td></tr>` + TR`<tr><td>景気</td><td class="num">${(g.demand?.[g.cap]?.d || 0) >= 0 ? '+' : '−'}${Math.abs((g.demand?.[g.cap]?.d || 0) * 100).toFixed(1)}%</td><td colspan="2" class="muted wrap">需要のずれ: 家計の工業品の買い物が、ふだんよりこれだけ多い (マイナスなら少ない)。作る量と所得もこれについてくる。実質の政策金利を中立より高くする・税率を上げると下がり、${DEMAND.adj} 年ほどで寄り、${DEMAND.trend} 年ほどでふだんに戻る</td></tr>`; })()}
    </table>
    ${(() => { // 年金と医療 (回 KE2)。首都の星系の年齢と、払った額
      const c = g.coloniesIn(g.cap).sort((a, b) => b.pop - a.pop)[0];
      const L = cg.ledger || {};
      return c ? TR`<h3>年齢と、年金・医療</h3><table class="tbl"><tr><td>${esc(c.name)}の年齢</td><td>${ageBarHtml(g.ageShares(c))}</td></tr>
        <tr><td>年金・医療</td><td>${fmtAmt(-(L.pension || 0))} cr/年・${fmtAmt(-(L.health || 0))} cr/年${(cg.apaid ?? 1) < 0.99 ? TR` <span class="bad">(資金が足りず ${pct(cg.apaid)} しか払えていない)</span>` : ''} <span class="muted">高齢 (65 歳〜。ゲームの年数は 100 ÷ 28 倍) が多いほど増える。政府が自動で払う</span></td></tr></table>` : '';
    })()}
    <h3>予算 (${ME.capName}の税収 ${fmtAmt(tax)} cr/年 のうち ${Math.round(used * 100)}% を使う。合わせて ${BUDGET_TOTAL * 100}% まで)</h3>
    <table class="tbl">${rows}</table>
    ${paid < 0.99 && used ? TR`<p class="note bad">資金が足りず、予算を ${pct(paid)} しか払えていない (効き目もそのぶん下がる)</p>` : ''}`;
}

