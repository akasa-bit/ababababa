// 国家方針と財政 (依頼 KE-4: 「経済・政策」のタブにまとめた。前は「目標」のタブ)
function policyHtml(g) {
  const pol = g.policy;
  const canChange = !pol || g.year - pol.since >= g.policyYears();
  const polBtns = Object.entries(POLICIES).map(([id, p]) => {
    const cur = pol?.id === id;
    const why = cur ? TR('いまの方針') : !canChange ? TR`${Math.ceil(pol.since + g.policyYears() - g.year)}年後から変えられる` : g.pc < POLICY_COST ? TR`政治力が足りない (${POLICY_COST} 必要)` : '';
    return TR`<button data-act="policy" data-value="${id}" class="${cur ? 'on' : ''}" ${why && !cur ? 'disabled' : ''}>${ico(`pol-${id}`)}${p.label}<small>${esc(p.good)}<br>代わりに: ${esc(p.bad)}${why ? `<br>${esc(why)}` : TR`<br>政治力 ${POLICY_COST}`}</small></button>`;
  }).join('');
  return TR`<h3>国家方針${pol ? TR` — いまは「${POLICIES[pol.id].label}」(${Math.round(pol.since)}年から)` : ''}</h3>
    <p class="note">国の向きを一つ選ぶ。${g.policyYears()}年に一度だけ変えられる (政治力 ${POLICY_COST})。議会の審議にかけ (国の権力に加わっている集団の支持が ${pct(ENACT.now)} 以上ならすぐ通る)、通ったあと、知らせが光速で届いた星系から順に効く。</p>
    ${billHtml(g, 'policy')}<div class="btns wrap">${polBtns}</div>
    ${fiscalHtml(g)}`;
}
// 帝国 → 目標: 政治力・議会の支持・時代の課題・挑戦・点数・統治体制・直轄の星系 (国家方針と財政は「経済・政策」のタブへ。依頼 KE-4)
function goalsSheet(app) {
  const g = app.game;
  const inc = g.pcIncome();
  const sc = g.ended && g.finalScore ? g.finalScore : g.score();
  const era = g.era;
  // 最初の年の終わりより前は、最初の時代の課題 (決まっている) をそのまま見せる
  const taskRows = (era?.tasks || g.eraTasks(0).map((tk) => ({ ...tk, status: 'active' }))).map((tk) => {
    const v = g.taskValue(tk);
    const prog = tk.id === 'pop' ? `${fmtPop(v)} / ${fmtPop(tk.target)}` : tk.id === 'calm' ? TR`いま ${v}` : `${v} / ${tk.target}`;
    const st = tk.status === 'done' ? TR('<span class="hz">果たした</span>') : tk.status === 'failed' ? TR('<span class="bad">果たせなかった</span>') : TR`あと ${Math.max(0, Math.ceil(tk.deadline - g.year))} 年`;
    return `<tr><td>${esc(tk.label)}</td><td>${prog}</td><td>${st}</td></tr>`;
  }).join('');
  const chRows = g.challenges.map((c) => `<tr><td><b>${ico(`ch-${c.id}`)}${CHALLENGES[c.id].label}</b></td><td>${esc(CHALLENGES[c.id].desc)}</td><td>${c.status === 'done' ? TR('<span class="hz">果たした</span>') : c.status === 'failed' ? TR('<span class="bad">果たせなかった</span>') : TR('挑戦中')}</td></tr>`).join('');
  const direct = g.knownSystems().filter((s) => s.id !== g.cap && g.known(s.id)?.direct).map((s) => `<button data-act="goto" data-sys="${s.id}">${esc(s.name)}</button>`).join(' ');
  const councilNote = g.council < 25 ? TR('<span class="bad">15を割ると政権交代</span>') : g.council >= 70 ? TR('<span class="hz">政治力が増えやすい</span>') : '';
  return TR`<div class="kpi">
      <div><span>政治力</span><b>${Math.floor(g.pc)} / ${g.pcCap()}</b><span>${inc.total >= 0 ? '+' : ''}${inc.total}/年</span></div>
      <div><span>${ico('council')}議会の支持</span><b>${Math.round(g.council)}</b><span>${councilNote || TR('毎年 −0.25')}</span></div>
      <div><span>点数${g.ended ? TR(' (確定)') : ''}</span><b>${sc.total}</b><span>${g.endYear ? TR`${Math.round(g.endYear)}年で確定` : TR('終わりなし')}</span></div>
      <div><span>直轄</span><b>${g.directCount()} / ${g.directMax()}</b><span>星系</span></div>
    </div>
    <h3>政治力 (${ME.home}の意志)</h3>
    <p class="note">星系の政府への指令 (施設・交易路・方針・要求への返事など) には政治力が要る。遠い星系ほど多く (距離 d 光年で 2 + 0.15d、直轄の星系は半分)。宣戦・講和は ${PC_DIPLOMACY}。${ME.capName}の中の行動 (${ME.capName}からの入植船・施設) と艦隊への指令は要らない。年ごとに貯まり、${g.pcCap()} で頭打ちになる。</p>
    <table class="tbl">${inc.parts.map(([l, v]) => TR`<tr><td>${esc(l)}</td><td class="${v < 0 ? 'bad' : ''}">${v >= 0 ? '+' : ''}${v}/年</td></tr>`).join('')}<tr class="total"><td>合計</td><td>${inc.total >= 0 ? '+' : ''}${inc.total}/年</td></tr></table>
    <h3>${ico('council')}議会の支持</h3>
    ${councilChart(g.council)}
    <p class="note">${ME.council}の支持は毎年0.25ずつ下がる (成果を待ついら立ち)。時代の課題を果たすと +15、果たせないと −10、独立を許すと −8、独立国を降伏させると +10、${ME.home}の入植船で新しい星系を拓くと +1。50より高ければ政治力の増え方が増え、低ければ減る (10ごとに年 ±1)。15を割ると政権交代で、国家方針が白紙に戻り、貯めた政治力を失う。</p>
    <h3>${ico('goal')}時代の課題 ${era ? TR`(${START_YEAR + ERA_YEARS * era.n}〜${START_YEAR + ERA_YEARS * (era.n + 1)}年)` : ''}</h3>
    <p class="note">${ERA_YEARS}年ごとに課題が2つ出る。果たすと議会の支持 +15、次の時代は果たした数 × 2 だけ政治力が年に多く増える。</p>
    ${taskRows ? TR`<div class="scroll"><table class="tbl"><tr><th>課題</th><th>いま</th><th>状況</th></tr>${taskRows}</table></div>` : TR('<p class="note">最初の年の終わりに出る。</p>')}
    ${guideSheetHtml(g)}
    <h3>挑戦</h3>
    ${chRows ? `<div class="scroll"><table class="tbl">${chRows}</table></div>` : TR('<p class="note">このゲームでは挑戦を選んでいない (ホーム画面の「新しいゲーム」で選べる)。</p>')}
    <h3>点数${g.ended ? TR(' (確定)') : ` (${g.endYear ? TR`${Math.round(g.endYear)}年に確定` : TR('いまの値')})`}</h3>
    <table class="tbl">${sc.parts.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'bad' : ''}">${v}</td></tr>`).join('')}<tr class="total"><td>合計</td><td>${sc.total}</td></tr></table>
    <h3>統治体制</h3>
    <p class="note">基本統治形式 (新しい入植地の型)・家臣の星系の型ごとの数・型の一括変更は、帝国 → 従属国 のタブ (依頼 KE-5)。星系ごとには星系の詳細欄の「型を選ぶ」から。</p>
    <h3>直轄の星系 (${g.directCount()} / ${g.directMax()})</h3>
    <p class="note">${ME.home}の直属の従属星系を、星系の詳細欄の「統治」から直接統治 (直轄) にできる。直轄の星系は自分では動かないので、施設や交易路は${ME.home}が指令で決める。</p>
    ${direct ? `<div class="bulk">${direct}</div>` : TR('<p class="note">なし</p>')}`;
}
// 作戦の手引き (最初の時代だけ): 手の進み具合と、隠した手引きを出し直すボタン
function guideSheetHtml(g) {
  const gd = g.guideSteps();
  if (!gd) return '';
  return TR`<p class="note">作戦の手引き: ${gd.steps.map((x, i) => `${'①②③'[i]} ${x.done ? TR('済み') : esc(x.label)}`).join('　')}</p>
    ${app.guideHidden ? TR('<div class="btns"><button data-act="guideshow">手引きを知らせの帯に出す</button></div>') : ''}`;
}

