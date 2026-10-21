function councilChart(v) {
  const n = clamp(Math.round(v), 0, 100);
  const dots = COUNCIL_SEATS.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.6" fill="${i < n ? 'var(--own)' : 'var(--enemy)'}" opacity="${i < n ? 1 : 0.75}"/>`).join('');
  const mark = (k, label) => {
    const a = Math.PI * (1 - k / 100), c = Math.cos(a), sn = Math.sin(a);
    return `<line x1="${(100 + 30 * c).toFixed(1)}" y1="${(100 - 30 * sn).toFixed(1)}" x2="${(100 + 99 * c).toFixed(1)}" y2="${(100 - 99 * sn).toFixed(1)}" stroke="var(--muted)" stroke-width="0.6" stroke-dasharray="2 2"/>
      <text x="${(100 + 102 * c).toFixed(1)}" y="${(100 - 102 * sn).toFixed(1)}" fill="var(--muted)" font-size="7" text-anchor="${c < -0.1 ? 'end' : c > 0.1 ? 'start' : 'middle'}">${label}</text>`;
  };
  return `<figure class="council"><svg viewBox="-40 -12 280 120" role="img" aria-label="議会の支持 ${n} / 100 議席">
      ${dots}${mark(15, '15 政権交代')}${mark(50, '50')}
      <text x="100" y="92" fill="var(--fg)" font-size="22" text-anchor="middle" class="num">${n}</text>
      <text x="100" y="104" fill="var(--muted)" font-size="7" text-anchor="middle">/ 100 議席が支持</text>
    </svg><figcaption><span class="sw own"></span>支持 ${n} <span class="sw opp"></span>不支持 ${100 - n}</figcaption></figure>`;
}

// 帝国 → 目標の「財政」: 税・利子率・予算。変えると光速で広がる (国家方針と同じ)
// 財政のスライダーの値の見せ方 (data-fmt)
function fiscalFmt(fmt, v) {
  v = Number(v);
  if (fmt === 'pct0') return `${Math.round(v * 100)}%`;
  if (fmt === 'pct1') return `${(v * 100).toFixed(1)}%`;
  if (fmt === 'pct2') return `年 ${(v * 100).toFixed(2)}%`;
  if (fmt === 'pct1gdp') return v ? `GDP の ${(v * 100).toFixed(1)}%/年` : 'なし';
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
  const rows = Object.entries(BUDGET).map(([k, b]) => {
    const sh = f.budget?.[k] || 0;
    return `<tr><td>${b.label}</td><td>${slider(k, BUDGET_RANGE, BUDGET_STEP, sh, 'pct0', b.label)}</td><td>${sh ? `${fmtAmt(sh * tax)} cr/年・効き目 ${pct(budgetEffect(sh * paid))}` : '<span class="muted">使わない</span>'}</td><td class="muted wrap">${esc(b.good)}</td></tr>`;
  }).join('');
  return `<h3>${ico('credits')}財政</h3>
    <p class="note">値はスライダーで細かく選ぶ (幅は現実の国で使われた値の 1〜99% 点。離すと決まる)。税率・利子率・赤字の上限を変えるには政治力 ${FISCAL_COST} が要る。予算の割り振りは政治力が要らない。どれも、知らせが光速で届いた星系から効く${pend ? ` (いまの財政がまだ届いていない星系 ${pend})` : ''}。効き目の大きさは仮の値。</p>
    <table class="tbl">
      <tr><td>税率</td><td>${slider('tax', TAX_RANGE, TAX_STEP, taxRate, 'pct1', '税率')}</td><td colspan="2" class="muted wrap">所得への税 (標準 ${(MARKET.tax * 100).toFixed(1)}% の ×${taxK.toFixed(2)})${Math.abs(bK - 1) > 1e-9 ? `・消費税と合わせた重さ ×${bK.toFixed(2)}: 家臣の忠誠度の目標 ${TAX_LOYALTY * (bK - 1) > 0 ? '+' : ''}${(TAX_LOYALTY * (bK - 1)).toFixed(1)}・議会の支持 年 ${TAX_COUNCIL * (bK - 1) > 0 ? '+' : ''}${(TAX_COUNCIL * (bK - 1)).toFixed(2)}` : ''}。自給の所得には掛からない</td></tr>
      <tr><td>消費税</td><td>${slider('ctax', CTAX_RANGE, CTAX_STEP, f.ctax || 0, 'pct1', '消費税')}</td><td colspan="2" class="muted wrap">家計の買い物 (物とサービス) の値段に掛け、星系の政府に入る。所得の低い星系に重い (逆進)。忠誠度と議会への効き目は税率と合わせた重さで決まる</td></tr>
      <tr><td>関税</td><td>${slider('tariff', TARIFF_RANGE, TARIFF_STEP, f.tariff || 0, 'pct1', '関税')}</td><td colspan="2" class="muted wrap">ほかの国からの輸入の値段に掛ける (買い手の会社が、買い手の星系の政府に払う)。高いほど国の中の売り手から買う。政府の資材の買い付けと主人の支援には掛からない</td></tr>
      <tr><td>利子率</td><td>${slider('rate', RATE_RANGE, RATE_STEP, f.rate, 'pct2', '利子率')}</td><td colspan="2" class="muted wrap">政府の貯えにつく利子と、国債・会社と家計の借りに払う利子。高いほど、運ぶ年数ぶん輸入の値段が上がる (e^(利子率 × 年数) 倍)。マイナスなら預金が利子を払う</td></tr>
      <tr><td>赤字の上限</td><td>${slider('deficit', DEFICIT_RANGE, DEFICIT_STEP, f.deficit || 0, 'pct1gdp', '赤字の上限')}</td><td colspan="2" class="muted wrap">資金が足りない分を、1 年にこの額まで国債で借りる (${ME.capName}の GDP ${fmtAmt(cg.fr?.y || 0)} cr/年)。国債 ${fmtAmt(cg.bond || 0)} cr・いま借りられる額 ${fmtAmt(Math.max(0, g.funds(g.cap) - cg.credits))} cr。手元の資金が税収の ${Math.round(DEBT.cash * 12)} か月分を超えると、超えた分で国債を返す。国債 ÷ GDP は ${Math.round(DEBT.limit * 100)}% まで</td></tr>
    </table>
    <h3>予算 (${ME.capName}の税収 ${fmtAmt(tax)} cr/年 のうち ${Math.round(used * 100)}% を使う。合わせて ${BUDGET_TOTAL * 100}% まで)</h3>
    <table class="tbl">${rows}</table>
    ${paid < 0.99 && used ? `<p class="note bad">資金が足りず、予算を ${pct(paid)} しか払えていない (効き目もそのぶん下がる)</p>` : ''}`;
}

