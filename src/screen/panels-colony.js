function nativesSummary(g, sys) {
  if (!g.isSurveyed(sys.id)) return '';
  const list = sys.bodies.filter((b) => b.natives).map((b) => {
    const n = g.knownNative(sys.id, b.id);
    return TR`<li>${esc(b.name)}: ${esc(n.def.species)} <span class="muted">${fmtPop(n.st.pop)}・${TECH_LABEL[n.def.tech]}・${nativeStatus(n)}</span></li>`;
  });
  return list.length ? TR`<h3>先住民</h3><ul>${list.join('')}</ul>` : '';
}

function nativeStatus(n) {
  const label = n.st.status === 'enslaved' ? TR`奴隷 (${SLAVE_TYPES[n.st.slave] || TR('市場奴隷')})` : { integrated: TR('市民として統合済み'), subjugated: TR('支配下') }[n.st.status];
  return label || `${relLabel(n.st.rel)} (${Math.round(n.st.rel)})`;
}

function row(k, v) { return `<tr><th>${k}</th><td>${v}</td></tr>`; }

function bodyPanel(app) {
  const g = app.game;
  const sys = g.system(app.sel.sys);
  const b = g.target(sys.id, app.sel.body);
  if (!b) return systemPanel(app);
  const isStar = !!b.label;
  let info;
  if (isStar) {
    info = `<table class="tbl kv">${row(TR('スペクトル型'), b.label)}${row(TR('質量'), `${fmt(b.mass)} M☉`)}${row(TR('半径'), `${fmt(b.radius, 3)} R☉`)}
      ${row(TR('表面温度'), `${Math.round(b.temp)} K`)}${row(TR('光度'), `${fmt(b.lum, 3)} L☉`)}${b.sep ? row(TR('主星からの距離'), `${fmt(b.sep)} AU`) : ''}</table>`;
  } else if (b.type === 'belt') {
    info = `<table class="tbl kv">${row(TR('種類'), TYPE_LABEL.belt)}${row(TR('軌道半径'), `${fmt(b.a)} AU`)}${row(TR('公転周期'), TR`${fmt(b.period)} 年`)}</table>`;
  } else {
    const solid = b.type === 'rocky' || b.type === 'dwarf';
    const host = b.host ? sys.stars.find((x) => x.id === b.host) : null;
    info = `<table class="tbl kv">${row(TR('種類'), TYPE_LABEL[b.type])}${b.known ? row(TR('観測'), TR`観測済みの惑星 (${esc(b.known)})`) : ''}${host ? row(TR('回る恒星'), esc(host.name)) : ''}${row(TR('軌道半径'), `${fmt(b.a)} AU${b.inHZ ? TR(' <span class="hz">(HZ内)</span>') : ''}`)}
      ${row(TR('公転周期'), TR`${fmt(b.period)} 年${b.tidalLock ? TR(' (潮汐固定)') : ''}`)}${row(TR('質量'), `${fmt(b.mass)} M⊕`)}${row(TR('半径'), `${fmt(b.radius)} R⊕`)}
      ${row(solid ? TR('表面重力') : TR('重力(1気圧面)'), `${fmt(b.gravity)} g${solid && b.gravity < 0.5 ? TR(' (弱い重力に何十年も暮らすと体がどうなるかは、まだ分かっていない。分かっているのは、無重力で骨と筋肉が弱ること。居住区を回して重力を足す前提)') : ''}`)}${row(TR('平衡温度'), `${Math.round(b.teq)} K`)}
      ${solid ? row(TR('表面温度'), `${Math.round(b.tSurf)} K (${Math.round(b.tSurf - 273)} ℃)`) : ''}
      ${solid ? row(TR('大気圧'), `${b.pressure < 0.001 ? TR('ほぼ真空') : `${fmt(b.pressure)} atm`}${b.stripped ? TR(' (M 型星の X 線と紫外線で大気が逃げた: 「宇宙の海岸線」より内側。JWST の観測でも、こうした惑星に厚い大気は見つかっていない)') : ''}`) : ''}
      ${solid ? row(TR('地表'), SURFACE_LABEL[b.surface] || '') : ''}
      ${solid ? row(TR('入植適性'), `<b class="grade g${b.settle.grade}">${GRADE_LABEL[b.settle.grade]}</b>${b.settle.notes.length ? ` — ${b.settle.notes.join('、')}` : ''}`) : ''}
      ${solid && b.rad ? row(TR('地表の被曝'), TR`${fmtSv(b.rad.surf)}/年 (フレア ${Math.round(100 * b.rad.flareShare)}%・宇宙線 ${Math.round(100 * (1 - b.rad.flareShare))}%)${b.rad.cover ? TR`。地下に住むなら 土 ${(b.rad.cover / 200).toFixed(1)} m の下 (年 ${fmtSv(RADIATION.limitSv)} まで)` : ''}`) : ''}</table>`;
  }
  const cols = ['planet', 'station'].map((k) => g.knownColonyAt(sys.id, b.id, k)).filter(Boolean);
  return TR`
    <h2>${targetIcon(b, 'big')}${esc(b.name)}</h2>
    <p class="sub">${esc(sys.name)} ${ageBadge(g, sys.id)}</p>
    ${info}
    ${depositRow(b)}
    ${outpostBox(g, sys, b)}
    ${nativesBox(app, sys, b)}
    ${cols.map((c) => colonyBox(g, c)).join('')}
    ${dispatchBox(app, sys, b)}
    <button data-act="back" class="ghost">← 星系の一覧へ</button>`;
}

function yieldText(y) {
  return Object.entries(y).filter(([, v]) => v > 0.01).map(([r, v]) => `${resText(r)} ${fmtAmt(v)}`).join(TR('・')) || TR('なし');
}

function outpostList(g, sys) {
  const list = g.knownOutposts(sys.id);
  if (!list.length) return '';
  return TR`<h3>${ico('outpost')}採掘基地</h3><ul>${list.map((o) => TR`<li>${esc(g.target(o.sys, o.body).name)} Lv${o.lv} <span class="muted">${yieldText(g.outpostYield(o))} /年</span></li>`).join('')}</ul>`;
}

function outpostBox(g, sys, b) {
  const res = outpostRes(b);
  if (!res.length) return '';
  const o = g.knownOutposts(sys.id).find((x) => x.body === b.id);
  const c = sys.id === g.cap ? g.outpostCheck(sys.id, b.id) : { ok: g.knownColonized(sys.id), reason: TR('同じ星系に入植地が必要') };
  const busy = busyText(g, (j) => j.type === 'outpost' && j.sys === sys.id && j.body === b.id);
  const next = { sys: sys.id, body: b.id, lv: (o?.lv || 0) + 1 };
  return TR`<h3>${ico('outpost')}採掘基地</h3>
    <p class="note">${o ? TR`Lv${o.lv} 稼働中: ${yieldText(g.outpostYield(o))} /年` : TR`無人の採掘基地で${res.map((r) => RES_LABEL[r]).join(TR('と'))}を採る。採れた資源はこの星系の備蓄に入る。`}
      <br>${o ? TR('拡張後') : TR('建設後')}: ${yieldText(g.outpostYield(next))} /年</p>
    ${costButton(g, `data-act="outpost" data-sys="${sys.id}" data-body="${esc(b.id)}"`, o ? TR('採掘基地を拡張') : TR('採掘基地を建設'), g.outpostCost(o, sys.id), sys.id, busy || (c.ok ? '' : c.reason))}`;
}

function depositRow(b) {
  const d = b.deposits || {};
  const has = MINED.filter((r) => d[r] > 0.05);
  const stars = (v) => '★'.repeat(clamp(Math.ceil(v / 0.6), 1, 4));
  return TR`<h3>資源</h3><p class="note">${has.length ? has.map((r) => `${RES_LABEL[r]} <span class="hz">${stars(d[r])}</span>`).join('　') : TR('採掘できる資源はない')}</p>`;
}

function colonyBox(g, c) {
  const key = colKey(c);
  const cap = c.cap ?? g.capOf(c);
  const s = c.sat || { food: 1, water: 1, goods: 1 };
  const warn = [];
  if (s.food < 0.99) warn.push(TR('食料'));
  if (g.needsWater(c) && s.water < 0.99) warn.push(TR('水'));
  const facs = Object.keys(FACILITY).map((f) => {
    const max = c.lv[f] >= FACILITY_MAX[f];
    const busy = busyText(g, (j) => j.type === 'upgrade' && j.col === key && j.fac === f);
    return `<div class="fac"><span>${ico(f)}${FACILITY[f]} <b>Lv${c.lv[f]}</b></span>
      ${costButton(g, `data-act="upgrade" data-col="${key}" data-fac="${f}"`, max ? TR('最大') : TR('拡張'), max ? null : g.upgradeCost(c, f), c.sys, max ? TR('最大レベル') : busy)}</div>`;
  }).join('');
  return TR`<h3>${KIND_LABEL[c.kind]}</h3>
    <table class="tbl kv">
      ${row(TR('人口'), TR`${fmtPop(c.pop)} / 上限 ${fmtPop(cap)}`)}
      ${row(TR('人口増加'), TR`<span class="${(c.growth || 0) < 0 ? 'bad' : 'hz'}">${((c.growth || 0) * 100).toFixed(1)}%/年</span>`)}
      ${c.ages ? row(TR('年齢'), ageBarHtml(c.ages)) : ''}
      ${row(TR('充足率'), TR`食料 ${pct(s.food)}${g.needsWater(c) ? TR`・水 ${pct(s.water)}` : ''}・物品 ${pct(s.goods)}`)}
      ${row(TR('工場の稼働'), pct(c.industry ?? 1))}
      ${c.lv.slaveworks ? row(TR('奴隷工房'), TR`稼働 ${pct(c.slaveWork ?? 0)} (奴隷 ${fmtAmt(SLAVEWORKS_USE * c.lv.slaveworks)}人/年を使い、工業品 ${fmtAmt(SLAVEWORKS_OUT * c.lv.slaveworks)}/年)`) : ''}
      ${row(TR('種族'), raceText(c))}
      ${c.inc !== undefined ? row(TR('所得'), `${incomeText(c.inc)} <span class="muted">(${stageName(c.inc)})</span>`) : ''}
    </table>
    ${warn.length ? TR`<p class="note bad">${warn.join(TR('・'))}が足りず人口が減っている。値段が上がれば人がその部門に移る。交易路で運び込むこともできる。</p>` : ''}
    <p class="note">就業 (値段から見た稼ぎの高い部門へ、少しずつ人が移る): ${shareText(c)}</p>
    <div class="facs">${facs}</div>
    ${autoToggle(g, c.sys)}<p class="note">オンにすると、この星系で足りない資源に合わせて農場・鉱山・工場・採掘基地を、過密になれば居住区を自動で建てる。星系の政府は、星系内の空いている天体に宇宙ステーションも自分で建てていく (10年に1つまで)。</p>
    ${troopBox(g, c)}`;
}

function raceText(c) {
  return Object.entries(c.races || { [HUMAN]: 1 }).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${pct(v)}`).join(TR('・'));
}

// 入植地の歩兵: 駐留数、訓練、ほかの入植地から呼び寄せる
function troopBox(g, c) {
  const key = colKey(c);
  const app = window.__app;
  // 呼び寄せ元は、地球から見えている入植地の歩兵で選ぶ
  const origins = g.knownSystems().flatMap((x) => g.knownColonies(x.id)).filter((o) => o.key !== colKey(c) && colKey(o) !== colKey(c) && o.troops + o.slaveTroops >= 1)
    .map((o) => ({ o, r: g.routePath(o.sys, c.sys) })).filter((x) => x.r)
    .sort((a, b) => a.r.years - b.r.years);
  const fromKey = origins.some((x) => colKey(x.o) === app?.troopOrigin) ? app.troopOrigin : origins[0] && colKey(origins[0].o);
  const coming = g.troopMoves.filter((m) => m.to === key && g.departSeen(m.path[0], m.times[0])).reduce((k, m) => k + m.troops + m.slave, 0);
  const train = costButton(g, `data-act="train" data-col="${key}"`, TR`${ico('troops')}歩兵を訓練`, TROOP_COST, c.sys,
    c.lv.barracks < 1 ? TR('軍事教練所が必要') : busyText(g, (j) => j.type === 'troop' && j.col === key));
  const send = origins.length ? TR`<label class="field">歩兵を呼び寄せる (交易路経由)
      <select data-act="torigin">${origins.map(({ o, r }) => TR`<option value="${colKey(o)}" ${colKey(o) === fromKey ? 'selected' : ''}>${esc(o.name)} (${o.troops}+奴隷兵${o.slaveTroops}・${r.years < 0.01 ? TR('星系内') : TR`${r.years.toFixed(1)} 年`})</option>`).join('')}</select></label>
    <div class="btns"><button data-act="troopsend" data-from="${fromKey}" data-to="${key}" data-n="1">1連隊</button><button data-act="troopsend" data-from="${fromKey}" data-to="${key}" data-n="all">全部隊</button></div>`
    : TR('<p class="note">交易路でつながった入植地に、呼び寄せられる歩兵がいない。</p>');
  return TR`<h3>${ico('troops')}歩兵</h3>
    <p class="note">駐留: 歩兵 <b>${c.troops}</b> 連隊・奴隷兵 <b>${c.slaveTroops}</b> 連隊${coming ? TR` (+${coming} 向かっている)` : ''}。
      軍事教練所 Lv${c.lv.barracks}${c.lv.barracks ? TR` — 年に ${c.lv.barracks} 連隊まで自動で訓練し、${5 * c.lv.barracks} 連隊を保つ` : ''}。
      歩兵は先住民の制圧・奴隷の反乱の抑止・海賊からの地上防衛に使う。1連隊で人口 ${fmtPop(TROOP_DRAFT)} を徴集、維持費 ${TROOP_UPKEEP} cr/年。</p>
    ${train}${send}`;
}

function nativesBox(app, sys, b) {
  const g = app.game;
  if (!g.isSurveyed(sys.id)) {
    return mayHaveNatives(b) ? TR('<h3>先住民</h3><p class="note">未調査。入植地を作るか艦隊が到達すると分かる。</p>') : '';
  }
  const n = g.knownNative(sys.id, b.id);
  if (!n) return '';
  const ind = n.st.status === 'independent';
  const need = g.nativeDefense(n);
  const unity = g.nativeUnity(n);
  const war = g.knownWars(sys.id).find((w) => w.body === b.id);
  const warHtml = war ? TR`<p class="note bad">征服戦争中 — 進捗 ${pct(war.progress)}。入植地の戦力 ${fmt(g.warPower(war), 1)} (歩兵 + 星系の艦隊の半分 + 入植者の民兵) と先住民の残りの戦力 ${fmt(war.enemy ?? need * (1 - war.progress), 1)} が毎年削り合う (先住民は疲弊して年7%ずつも弱る)。劣勢になると入植船を送った星系が歩兵を送り込む。</p>
    <span class="bar"><i style="width:${(war.progress * 100).toFixed(0)}%"></i></span>` : '';
  const unityHtml = row(TR('統一度'), `${unity} ${n.def.tech >= 3 ? TR('<span class="bad">(統一国家・組織的な抵抗あり)</span>') : TR('<span class="muted">(分裂・組織的な抵抗なし)</span>')}`);
  const presence = g.knownColonized(sys.id);
  const col = g.knownColonyAt(sys.id, b.id, 'planet');
  const actions = ind ? `<div class="btns">
      ${costButton(g, 'data-act="gift"', TR('贈り物 (友好度+10)'), GIFT_COST, undefined, presence ? '' : TR('この星系に拠点が必要'))}
      ${costButton(g, 'data-act="integrate"', TR('市民として迎える'), null, undefined, !col ? TR('同じ惑星に入植地が必要') : n.st.rel < 80 ? TR('友好度80以上が必要') : '')}
    </div>
    ${(() => {
      const ships = g.knownGarrison(sys.id);
      const power = ships + knownTroopPower(g, sys.id);
      const why = ships < 1 ? TR('制宙権のため艦隊が1つ以上必要') : power < need ? TR`戦力が足りない (艦隊+歩兵 ${fmt(power, 1)}/${need})` : '';
      return costButton(g, 'data-act="conquer"', TR`武力で制圧 (艦隊+歩兵の戦力 ${need} 以上)`, null, undefined, why);
    })()}` : '';
  const st = n.st.status;
  const noCol = col ? '' : TR('同じ惑星に入植地が必要');
  const yieldNow = g.nativeYield(sys.id, b.id, n.st);
  const guard = g.knownGarrison(sys.id) + knownTroopPower(g, sys.id);
  const ruled = st === 'subjugated' ? TR`
    ${costButton(g, 'data-act="enslave"', TR('奴隷化する (市場奴隷)'), null, undefined, noCol)}
    <p class="note">奴隷化すると市場奴隷になり、あとで軍事奴隷・家畜に切り替えられる。悪名 +15 (他の先住民の友好度が下がり、同じ惑星の入植地は不穏になる)。</p>` : '';
  const kept = st === 'enslaved' ? TR`
    <div class="btns">${Object.entries(SLAVE_TYPES).map(([k, l]) => `<button data-act="slavetype" data-type="${k}" class="${n.st.slave === k ? 'on' : ''}" ${n.st.slave === k ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    <p class="note">市場奴隷: 労働力として食料・金属・希少元素・工業品を産む (消費されず、寿命で入れ替わる)。<br>
      軍事奴隷: 安価な歩兵 (戦力 ${SLAVE_TROOP_POWER}・維持費 ${SLAVE_TROOP_UPKEEP} cr/年) として毎年徴集され、同じ惑星の入植地に配属される。<br>
      家畜: 食料を大量に産む。初めて家畜にすると悪名がさらに +15。<br>
      産出: ${yieldText(yieldNow)} /年。奴隷の人口は年1.5%増える。艦隊+歩兵の戦力が ${Math.ceil(need / 2)} 未満 (いま ${fmt(guard, 1)}) だと年5%の確率で反乱が起きる。</p>` : '';
  const free = ['subjugated', 'enslaved'].includes(st)
    ? costButton(g, 'data-act="liberate"', TR('解放する (悪名 −10)'), null) : '';
  return TR`<h3>先住民</h3>
    <table class="tbl kv">
      ${row(TR('種族'), esc(n.def.species))}${row(TR('人口'), fmtPop(n.st.pop))}${row(TR('文明'), TECH_LABEL[n.def.tech])}
      ${row(TR('関係'), nativeStatus(n))}${unityHtml}
    </table>${warHtml}
    ${ind ? TR`<p class="note">${n.def.tech >= 3
      ? TR('最も進んだ未恒星間文明で、入植には同意 (友好度40以上) が必要。')
      : TR`統一されていない文明なので、同意なしで入植できる。戦争方針により${g.warThreshold >= 1000 ? TR('入植すると必ず') : g.warThreshold <= -1000 ? TR('戦争はせず') : TR`友好度${g.warThreshold}未満なら`}${g.warThreshold <= -1000 ? TR('共存する') : TR('征服戦争になる')} (入植船には歩兵が同行する。方針は帝国 → 軍事で変更)。`}
      拠点があると友好度は少しずつ上がる。40以上で交易 (収入・希少元素) が可能。80以上なら市民として迎えられる。制圧すると貢納を得るが、他の先住民の友好度が下がる。制圧には艦隊が1つ以上と、艦隊+歩兵の戦力が必要。制圧後は奴隷化もできる。</p>` : ''}
    ${actions}${ruled}${kept}${free}
    ${g.infamy ? TR`<p class="note">帝国の悪名: ${g.infamy} (新たに出会う先住民の友好度がこのぶん低い)</p>` : ''}`;
}

