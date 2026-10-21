// 独立の見通し (地球に届いている記録で): 忠誠度の目標と内訳、不満の段階、離反の起きやすさ (年あたり) と内訳、
// 最後通牒の期限に独立を宣言する確率 (恐怖度・友好度で下がる)
const OUTLOOK_WARN = 0.03; // 離反の起きやすさが年にこれ以上なら警告する (平均して約 33 年に 1 回)
function independenceOutlook(g, id) {
  const k = id === g.cap ? null : g.known(id);
  const terms = k ? g.knownLoyaltyTerms(id) : null;
  if (!terms) return null;
  let target = 0;
  for (const t of terms) target += t.v;
  target = clamp(target, 0, 100);
  const loyalty = k.loyalty ?? LOYALTY_START;
  const stage = k.unrest?.stage || 0;
  const p = g.declareChance(k);
  const hazard = g.knownSecessionTerms(id);
  const h = hazard ? hazardOf(hazard) : 0;
  const hp = hazardYear(h);
  return { k, terms, target, loyalty, stage, unrest: k.unrest || {}, p, hazard, h, hp, regime: g.knownRegime(k), warn: stage >= 1 || hp >= OUTLOOK_WARN };
}
function outlookText(o, short = false) {
  if (!o) return '';
  const u = o.unrest;
  if (o.stage === 3) {
    return short ? `最後通牒: ${Math.round(u.end)}年に${pct(o.p)}で独立` : `最後通牒を突きつけている。${Math.round(u.end)}年に、${pct(o.p)}の確率で独立を宣言する (恐怖度・主人との友好度・忠誠度が高いほど下がる)${REGIMES[o.regime].peaceful ? `。${REGIMES[o.regime].label}なので戦争にはならない` : ''}`;
  }
  const what = u.kind === 'autonomy' ? '自治' : '朝貢の免除';
  if (o.stage === 2) return short ? `${what}を要求中` : `${what}を求めて返事を待っている。拒めば最後通牒になる`;
  if (o.stage === 1) return short ? `不満 (${Math.round(u.since + UNREST_YEARS)}年に要求)` : `自立を求める動きがある。${Math.round(u.since + UNREST_YEARS)}年ごろまでに忠誠度が${calmAtOf(u)}以上に上がらなければ、減税か自治を要求してくる`;
  return short ? `離反 年${pctH(o.hp)}` : `離反の起きやすさは年 ${pctH(o.hp)} (このままなら平均して約 ${o.h > 0 ? Math.round(1 / o.h) : '∞'} 年に 1 回、自立を求める動きが起きる。忠誠度を上げる・自治の広い統治体制にすると下がる)`;
}
// 星系の詳細欄: 忠誠度の内訳・恐怖度・友好度・独立の見通し
function loyaltyBox(g, id) {
  const o = independenceOutlook(g, id);
  if (!o) return '';
  const k = o.k;
  const sign = (v) => (v > 0.05 ? `+${v.toFixed(0)}` : v < -0.05 ? `−${(-v).toFixed(0)}` : '0');
  const rows = o.terms.filter((t) => Math.abs(t.v) > 0.05).map((t) => `<tr><td>${esc(t.label)}${t.note ? ` <span class="muted">${esc(t.note)}</span>` : ''}</td><td class="${t.v < 0 ? 'bad' : ''}">${sign(t.v)}</td></tr>`).join('');
  const rebel = g.knownRebelFleet(id);
  const earth = Math.min(g.knownGarrison(id), (k.held || 0) + (k.awe || 0));
  const fearT = (k.realm ?? g.cap) === g.cap ? Math.min(100, 50 * earth / rebel) : 0;
  const friendT = g.friendTarget(k.lordTrade || 0);
  return `<h3>忠誠と独立</h3>
    <div class="scroll"><table class="tbl"><tr><th>忠誠度の目標の内訳</th><th></th></tr>${rows}<tr><th>目標</th><th>${Math.round(o.target)}</th></tr></table></div>
    <p class="note">いまの忠誠度 <b>${Math.round(o.loyalty)}</b> (年に最大5ずつ目標へ動く)。恐怖度 <b>${Math.round(k.fear || 0)}</b> → 目標 ${Math.round(fearT)} (駐留する${ME.home}の艦隊 ${earth} / 反乱時の推定艦隊 ${rebel})。友好度 <b>${Math.round(k.friend || 0)}</b> → 目標 ${Math.round(friendT)} (主人筋との貿易 ${fmtAmt(k.lordTrade || 0)} cr/年)。</p>
    ${o.hazard ? `<h3>離反の起きやすさ</h3>
    <div class="scroll"><table class="tbl"><tr><th>内訳 (掛け合わせる)</th><th></th></tr>${o.hazard.map((t, i) => `<tr><td>${esc(t.label)}${t.note ? ` <span class="muted">${esc(t.note)}</span>` : ''}</td><td class="${i && t.f > 1.05 ? 'bad' : ''}">${i ? `×${t.f.toFixed(2)}` : t.f.toFixed(4)}</td></tr>`).join('')}<tr><th>年あたり</th><th>${pctH(o.hp)}</th></tr></table></div>
    <p class="note muted">係数は仮の値。歴史の植民地の独立までの時間 (目標 R08) から推定し直す。</p>` : ''}
    <p class="note ${o.warn ? 'bad' : ''}">${esc(outlookText(o))}</p>${ruleBox(g, id, k)}`;
}
// 統治: 直轄・委任と委任方針、総督の方針、視察団 (地球の国の家臣)
function ruleBox(g, id, k) {
  if (id === g.cap || !k || (k.realm ?? g.cap) !== g.cap || k.lord === null || k.lord === undefined) return '';
  const delay = g.lightDelay(id).toFixed(1);
  const pending = (act) => g.requests.some((q) => q.kind === 'order' && q.act === act && Number(q.d.sys) === id);
  const pcBtn = (attrs, label, act, note, whyNot = '') => {
    const c = g.pcCost(act, { sys: id });
    const why = whyNot || (c > g.pc ? `政治力が足りない (${c} 必要)` : '');
    return `<button ${attrs} ${why ? 'disabled' : ''}>${label}<small>${esc(why || `政治力 ${c}・届くまで ${delay} 年${note ? `・${note}` : ''}`)}</small></button>`;
  };
  const sel = (act, map, cur, notes) => `<select data-act="${act}" data-sys="${id}">${Object.entries(map).map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l} — ${notes[v]}</option>`).join('')}</select>`;
  const direct = !!k.direct;
  const autonomy = (k.autonomy || 0) > g.year;
  const neglect = Math.max(0, g.year - (k.attended ?? k.founded ?? k.year));
  const regime = g.knownRegime(k);
  const ruleBtn = k.lord !== g.cap ? '' : regimeBox(g, id, k, regime, pending('rule'), autonomy);
  const concession = [(k.taxFree || 0) > g.year ? `朝貢の免除 (${Math.round(k.taxFree)}年まで)` : '', autonomy ? `自治 (${Math.round(k.autonomy)}年まで。指令を受けない)` : ''].filter(Boolean).join('・');
  return `<h3>統治</h3>
    <p class="note">${direct ? `<b>直接統治 (直轄)</b>: 星系政府は自分では開発・入植・交易路の開設をせず、${ME.home}の指令をかならず実行する (指令の政治力は半分・朝貢50%・忠誠度の目標 +10・年に政治力 1)。`
      : `<b>${REGIMES[regime].label}</b> (委任方針「${MANDATES[k.mandate || 'balanced']}」): 星系政府が自分の資金で動く。${esc(REGIMES[regime].note)}。`}${k.scar ? ` 強制労働の後遺症 <b class="bad">${pct(k.scar)}</b> (税収 −${pct(FORCED.scarTax * k.scar)})。` : ''}
      主人の関与 (指令・資金援助・${ME.home}が命じた艦隊の来訪・視察) が途絶えて <b class="${neglect > NEGLECT_GRACE ? 'bad' : ''}">${Math.floor(neglect)} 年</b> (${ME.home}の知る限り。${NEGLECT_GRACE}年を過ぎると忠誠度の目標が年${NEGLECT_RATE}ずつ下がる)。${concession ? `認めている要求: ${concession}。` : ''}</p>
    ${ruleBtn}
    ${direct ? '' : `<label class="field">委任方針${pending('mandate') ? ' (変更の指令を送信中)' : ''} — 変えると指令 (政治力 ${g.pcCost('mandate', { sys: id })})${sel('mandate', MANDATES, k.mandate || 'balanced', MANDATE_NOTE)}</label>`}
    ${k.lord === g.cap ? `<label class="field">総督の方針 (不満が要求になったとき)${pending('governor') ? ' (変更の指令を送信中)' : ''} — 変えると指令 (政治力 ${g.pcCost('governor', { sys: id })})${sel('governor', GOVERNOR, k.governor || 'ask', GOVERNOR_NOTE)}</label>` : ''}
    ${pcBtn(`data-act="inspect" data-sys="${id}"`, '視察団を送る', 'inspect', '関与になり、忠誠度 +3', pending('inspect') ? '視察団を送っている' : '')}`;
}

// 史料の欄 (H4-1): 型ごとの当時の言葉・法と実態の差・事例・一次史料の出典・研究者の論争・ゲームで省いたこと。
// 統治の欄の中に畳んで置き、選ぶと別の型も読める (見るだけ。指令ではない)。値は VASSAL_DATA (docs/vassal-typology.md の 3 と事例 131 件)
const END_LABEL = { indep: '独立', transferred: '別の宗主か型へ', annexed: '併合', suzerain_end: '宗主の消滅', merger: '合併', continuing: '続いている' };
function histBox(g, cur) {
  const pick = app.histType && REGIMES[app.histType] ? app.histType : cur;
  const R = REGIMES[pick];
  const t = VASSAL_DATA.types[R.id];
  const d = t.doc || {};
  const opts = REGIME_ORDER.filter((r) => r !== 'encomienda').map((r) => `<option value="${r}" ${r === pick ? 'selected' : ''}>${esc(REGIMES[r].label)}${r === cur ? ' (いま)' : ''}</option>`).join('');
  const row = (label, text) => (text ? `<p><b>${label}</b> ${esc(text)}</p>` : '');
  const cases = t.caseList.map((c) => `${esc(c.name)} (${c.years}・${END_LABEL[c.end] || c.end}${c.violent ? '・暴力' : ''})`).join('、');
  return `<details class="note hist" data-h="hist" ${app.helpOpen?.has('hist') ? 'open' : ''}><summary>史料 — ${esc(R.label)}</summary>
    <label class="field">型<select data-act="histtype">${opts}</select></label>
    <p class="muted">${VASSAL_FAMILIES[t.family]}の家族。束 (事例の最頻) 法 ${bundleText(t.law)}・実態 ${bundleText(t.fact)}。事例 ${t.n} 件の存続の中央値 ${t.median ? `${Math.round(t.median)} 年` : '続いている'}</p>
    ${row('当時の言葉', d.terms)}${row('法と実態の差', d.gap)}<p><b>事例 (事例のデータ)</b> ${cases}</p>${row('一次史料の出典', d.sources)}${row('研究者の論争', d.debates)}${row('ゲームで省いたこと', d.omit)}
    <p class="muted">符号化は 2 人が別々に行い (一致 α = 0.754)、食い違いを裁定した。条文の番号は本文がデジタル化されている 17 件だけ原文で確かめた。出典の一覧は data/raw/vassal/ (README・sources_checked.md)</p></details>`;
}
// 型ごとの仕組み (H3-3): 共同統治の 2 国目の宗主・特許会社の取り分・関税受領官の滞納・同君連合の継承・統治者の任免
function typeExtras(g, id, k, cur, B) {
  const pend = (act) => g.requests.some((q) => q.kind === 'order' && q.act === act && Number(q.d.sys) === id);
  const btn = (act, value, label) => { const c = g.pcCost(act, { sys: id }); const why = pend(act) ? '送信中' : c > g.pc ? '政治力不足' : ''; return `<button data-act="${act}" data-sys="${id}" data-value="${value}" ${why ? 'disabled' : ''}>${label}<small>${why || `政治力 ${c}・届くまで ${g.lightDelay(id).toFixed(1)} 年`}</small></button>`; };
  const out = [];
  if (cur === 'T08') out.push(k.lord2 === undefined ? '共同統治: 2 国目の宗主になる国がまだない。' : `共同統治: 2 国目の宗主は <b>${esc(g.realmName(k.lord2))}</b>。朝貢の ${Math.round(H33.joint * 100)}% を${k.jointCut ? '<b class="bad">断っている</b>' : '送っている'}。${btn('jointcut', k.jointCut ? '' : '1', k.jointCut ? '分け前を戻す' : `分け前を断つ (忠誠度 −${H33.jointCut})`)}`);
  if (cur === 'T09') out.push(`特許会社領: 朝貢の ${Math.round(H33.companyCut * 100)}% は会社が取り、${ME.home}には届かない (直接統治にすれば特許を取り上げられる)。`);
  if (cur === 'T19') out.push(`関税受領官: 払えなかった朝貢は滞納として持ち越し、次の年に先に取る。${(k.arrears || 0) > 0.01 ? `<b class="bad">滞納 ${fmtAmt(k.arrears)} cr</b> (忠誠度の目標 −${H33.arrears})` : '滞納なし'}。`);
  if (cur === 'T15') out.push(`同君連合: 1 世代に 1 度ほど継承の危機が起きる。継承 (実態) が「従」なら、連合は戦争なしに解ける。いまは「${BUNDLE_CODES[B.fact[BUNDLE_ITEMS.indexOf('succ')]]}」。`);
  if (B.fact[BUNDLE_ITEMS.indexOf('appt')] !== 'V') out.push(`統治者の任免: 実態で任免が「${BUNDLE_CODES[B.fact[BUNDLE_ITEMS.indexOf('appt')]]}」なので、現地の統治者を替えられる (実態は約定どおりに戻り、エリートは協力から。忠誠度 −${H33.depose})。${btn('depose', '1', '統治者を替える (改易・廃位)')}`);
  return out.length ? `<br>${out.join('<br>')}<br>` : '';
}
// 統治体制を選ぶ表: いまの型と、型ごとの離反の起きやすさ (いま変えたら)・朝貢・忠誠度の目標の差を、家族ごとに畳んで並べる
function regimeBox(g, id, k, cur, sending, autonomy) {
  const c = g.pcCost('rule', { sys: id });
  const full = g.directPlanned() >= g.directMax();
  const row = (r) => {
    const R = REGIMES[r];
    const t = g.knownSecessionTerms(id, r);
    const hp = t ? hazardYear(hazardOf(t)) : 0;
    const drop = Math.max(0, REGIMES[cur].rank - R.rank);
    const why = r === cur ? '選択中' : sending ? '送信中' : c > g.pc ? '政治力不足' : r === 'direct' && autonomy ? '自治中' : r === 'direct' && full ? `上限 ${g.directMax()}` : '';
    const loy = `${R.loyalty > 0 ? '+' : R.loyalty < 0 ? '−' : '±'}${Math.abs(R.loyalty)}`;
    return `<div class="rg"><div class="rh"><div><b>${esc(R.label)}</b><br><span>離反 年${pctH(hp)}・朝貢 ${pct(R.tribute)}・忠誠度 ${loy}</span>${drop ? `<br><span class="bad">変えると忠誠度 −${Math.round(HAZARD.revoke * drop)} (自治を狭める)</span>` : ''}</div>
      <button data-act="rule" data-sys="${id}" data-value="${r}" ${why ? 'disabled' : ''}>${why || '変える'}</button></div><p>${esc(R.note)}</p></div>`;
  };
  const C = REGIMES[cur];
  const B = g.bundleOf(k);
  const talk = !k.direct && !g.requests.some((q) => q.kind === 'order' && q.act === 'bundle' && Number(q.d.sys) === id);
  const pick = (it, i) => `<select data-act="bundle" data-sys="${id}" data-item="${it}" ${talk && g.pcCost('bundle', { sys: id }) <= g.pc ? '' : 'disabled'}>${['S', 'M', 'V'].map((x) => `<option value="${x}" ${x === B.law[i] ? 'selected' : ''}>${BUNDLE_CODES[x]}</option>`).join('')}</select>`;
  const gap = bundleGap(B.law, B.fact);
  const bundle = `<div class="scroll"><table class="tbl"><tr><th>主権の束</th><th>法 (約定)</th><th>実態</th></tr>${BUNDLE_ITEMS.map((it, i) => `<tr><td>${BUNDLE_LABELS[it]}</td><td>${k.direct ? BUNDLE_CODES[B.law[i]] : pick(it, i)}</td><td class="${B.law[i] !== B.fact[i] ? 'bad' : ''}">${BUNDLE_CODES[B.fact[i]]}</td></tr>`).join('')}</table></div>
    <p class="muted">宗 = 宗主が握る・分 = 分け合う・従 = 従属国が握る。法 = 約定の文、実態 = 実際の力関係。法と実態の差 <b class="${gap > C.gap ? 'bad' : ''}">${gap} 項目</b> (この型の歴史の平均 ${C.gap.toFixed(1)})。差 1 項目ごとに離反が ${GAP_HR.toFixed(2)} 倍起きやすい (事例 131 件)。
    ${k.direct ? '' : typeExtras(g, id, k, cur, B)}
    ${k.direct ? '' : `現地のエリート: <b class="${k.elite === 'resist' ? 'bad' : ''}">${ELITE_LABEL[k.elite || 'bargain']}</b> (忠誠度 ${BUNDLE.coop} 以上で協力して実態が約定へ寄り、${BUNDLE.resist} 未満で抵抗して従属国の側へ寄る)。約定の項目を変えるのは光速の指令 (政治力 ${g.pcCost('bundle', { sys: id })})`}</p>`;
  const groups = [['いまの型と直轄', ['direct', 'encomienda', cur].filter((r, i, a) => a.indexOf(r) === i)], ...Object.entries(VASSAL_FAMILIES).map(([f, label]) => [label, REGIME_ORDER.filter((r) => /^T\d\d$/.test(r) && REGIMES[r].family === f && r !== cur)])].filter(([, rs]) => rs.length);
  const rows = groups.map(([label, rs], i) => (i === 0 ? rs.map(row).join('') : `<details class="note" data-h="fam-${esc(label)}" ${app.helpOpen?.has(`fam-${label}`) ? 'open' : ''}><summary>${esc(label)} (${rs.length})</summary>${rs.map(row).join('')}</details>`)).join('');
  return `${histBox(g, cur)}<div class="regimes"><p class="muted">統治体制 (従属国の型) — いまは <b>${esc(C.label)}</b>。変えるのは光速の指令 (政治力 ${c}・届くまで ${g.lightDelay(id).toFixed(1)} 年)。離反は、いま変えたときの見込み</p>${bundle}${rows}</div>
    <details class="note"><summary>数値の根拠</summary>${REGIME_ORDER.map((r) => `<p><b>${esc(REGIMES[r].label)}</b>: ${esc(REGIMES[r].why)}</p>`).join('')}<p class="muted">離反の起きやすさ = 基準 × 型の倍率 × 通信の遅れ ÷ 1 世代 (${GENERATION_YEARS} 年) × 人口の比 × 忠誠度。型の倍率は法と実態の差から (植民地は COLDAT の推定)。自治を狭める変更は、法の束の点が下がった分だけ忠誠度が下がる (2 点で −${HAZARD.revoke})。</p></details>`;
}
// 情報の古さの表示
function ageBadge(g, id) {
  const age = g.dataAge(id);
  if (id === g.cap) return '<span class="age now">最新</span>';
  if (age === null) return `<span class="age">${ico('light')}情報なし (光で ${g.lightDelay(id).toFixed(1)} 年)</span>`;
  return `<span class="age">${ico('light')}${age.toFixed(1)} 年前の情報</span>`;
}

// 星系の政府: 従属先・資金・従属している星系
function govBox(g, id) {
  if (id === g.cap) {
    const v = g.vassalsOf(id).length;
    return `<p class="note">${ME.gov} (プレイヤー)。資金 ${fmtAmt(g.credits)} cr・直属の従属星系 ${v}</p>`;
  }
  const k = g.known(id);
  if (!k || !k.cols.length) return '';
  const chain = [];
  for (let l = k.lord; l !== null && l !== undefined && chain.length < 8; l = l === g.cap ? null : (g.known(l)?.lord ?? null)) chain.push(l);
  const realm = k.realm ?? 0;
  const war = realm !== g.cap && g.knownAtWar(g.cap, realm);
  const enemies = g.knownEnemiesOf(realm);
  const status = (realm === g.cap ? `${ME.realm}・忠誠度 <b class="${(k.loyalty ?? 70) < 20 ? 'bad' : ''}">${Math.round(k.loyalty ?? LOYALTY_START)}</b>${k.lord !== null && k.lord !== undefined ? `・恐怖度 <b>${Math.round(k.fear || 0)}</b>・友好度 <b class="${(k.friend || 0) >= FRIEND_SAFE ? 'hz' : ''}">${Math.round(k.friend || 0)}</b>` : ''}`
    : `<b class="bad">${realm === id ? '独立国の首都' : `${esc(g.system(realm).name)} の国に属する`}</b>`)
    + (enemies.length ? ` (<span class="bad">${enemies.map((e) => esc(g.realmName(e))).join('・')}と交戦中</span>)` : '');
  const young = k.founded !== undefined && g.year - k.founded <= GRANT_YEARS;
  const gpc = g.pcCost('grant', { sys: id });
  const grant = realm === g.cap && id !== g.cap ? `<div class="btns">${[100, 500, 2000].map((a) => `<button data-act="grant" data-sys="${id}" data-amt="${a}" ${g.credits < a || g.pc < gpc ? 'disabled' : ''}>${ico('grant')}資金援助 ${a} cr<small>光速の送金: 届くまで ${g.travelYears(0, id).toFixed(1)} 年・政治力 ${gpc}</small></button>`).join('')}</div>
    <p class="note">資金援助は${ME.home}の資金から送る。届くと${esc(g.system(id).name)}の政府の資金になり、忠誠度が上がる (10 cr ごとに +1)。${young && k.lord !== null && k.lord !== undefined ? `入植後${GRANT_YEARS}年 (${(k.founded + GRANT_YEARS).toFixed(0)}年まで) は主人の星系から毎年自動でも届く。` : ''}</p>` : '';
  const btn = realm === g.cap ? grant : ''; // 他国への講和・宣戦は欄の上の「よく使う操作」にある
  const siege = (k.siege ? `<p class="note bad">攻囲されている: ${esc(g.system(k.siege.realm).name)} の国の ${k.siege.ships} 艦隊・進捗 ${pct(k.siege.progress)}</p>` : '')
    + (k.battle ? `<p class="note bad">艦隊戦の最中: 攻撃 ${esc(g.system(k.battle.realm).name)} の国 ${Math.ceil(k.battle.a)} 艦隊 (投入 ${Math.round(k.battle.a0)}) 対 防衛 ${Math.ceil(k.battle.d)} 艦隊 (投入 ${Math.round(k.battle.d0)})・${k.battle.start.toFixed(1)}年から</p>` : '');
  return `<p class="note"><span class="dot" style="background:${realmColor(realm)}"></span>${status}。従属先: ${chain.map((l) => esc(g.system(l).name)).join(' → ') || 'なし'}・資金 ${fmtAmt(k.credits)} cr${k.bond > 0 ? `・国債 ${fmtAmt(k.bond)} cr` : ''} (収入 ${fmtAmt(k.income)}/年${k.lord !== null && k.lord !== undefined ? '、その25%を朝貢' : ''})。
    ${k.aid > 0.5 ? `<b>主人から支援 (物資・資金援助) を受けている</b> (年 ${fmtAmt(k.aid)} cr 相当。従属が深まり、忠誠度が上がる)。` : ''}輸入する物資は代金を払う。資源に余裕があれば自分で施設を建て、交易路を引き、入植も行う。指示は光速の指令で送る${realm === 0 ? '' : ' (他国なので従わない)'}。</p>${siege}${btn}`;
}

