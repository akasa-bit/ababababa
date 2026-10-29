function autoToggle(g, sysId) {
  if (sysId !== g.cap) return TR('<p class="note">この星系の政府が自分で開発する。</p>');
  return TR`<label class="check auto"><input type="checkbox" data-act="autodev" data-sys="${sysId}" ${g.auto[sysId] ? 'checked' : ''}> ${ico('develop')}自動開発</label>`;
}

function bodyList(app, sys) {
  const g = app.game;
  return TR`<h3>天体</h3><ul class="bodies">${sys.bodies.map((b) => {
    const mark = ['planet', 'station'].filter((k) => g.knownColonyAt(sys.id, b.id, k)).map((k) => ico(k === 'planet' ? 'planetcol' : 'station')).join('')
      + (g.knownOutposts(sys.id).some((o) => o.body === b.id) ? ico('outpost') : '');
    const nat = b.natives && g.isSurveyed(sys.id) ? TR(' <span class="nat">先住民</span>') : '';
    return `<li data-body="${b.id}" class="${b.id === app.sel.body ? 'sel' : ''}">${planetIcon(b)}${esc(b.name)}${nat}
      <span class="muted">${TYPE_LABEL[b.type]} ${fmt(b.a)} AU</span> <span class="mk">${mark}</span></li>`;
  }).join('')}</ul>`;
}

// 星系の備蓄と年あたりの生産・需要
function stockBox(g, sysId) {
  const k = g.known(sysId);
  if (!k) return '';
  const st = k.stock;
  const fl = { prod: k.prod, cons: k.cons };
  const rows = RES.map((r) => {
    const net = fl.prod[r] - fl.cons[r];
    const cls = net < -0.001 && st[r] < fl.cons[r] ? 'bad' : '';
    return `<tr><td>${ico(r)}${RES_LABEL[r]}</td><td>${fmtAmt(st[r])}</td><td>${fmtAmt(fl.prod[r])}</td><td class="${cls}">${fmtAmt(fl.cons[r])}</td></tr>`;
  }).join('');
  return TR`<h3>星系の備蓄 (生産・需要は年あたり) ${ageBadge(g, sysId)}</h3>
    <table class="tbl"><tr><th>資源</th><th>備蓄</th><th>生産</th><th>需要</th></tr>${rows}</table>`;
}

function routeBox(app, sys) {
  const g = app.game;
  const mine = g.routes.filter((r) => (r.a === sys.id || r.b === sys.id) && g.routeKnown(r));
  const others = g.knownSystems()
    .filter((s) => s.id !== sys.id && !g.routeBetween(s.id, sys.id) && !g.knownHostile(sys.id, s.id))
    .sort((a, b) => distance(a, sys) - distance(b, sys));
  const list = mine.map((r) => {
    const out = r.a === sys.id ? 0 : 1;
    const other = g.system(r.a === sys.id ? r.b : r.a);
    const use = g.routeUse(r);
    return TR`<div class="route"><div><b>⇄ ${esc(other.name)}</b> <span class="muted">${distance(sys, other).toFixed(1)} ly ・ Lv${r.lv} (片道 ${fmtAmt(g.routeCap(r))}/年)</span> <span class="${use > 0.9 ? 'bad' : 'muted'}">稼働率 ${pct(Math.min(use, 1))}</span><br>
      <span class="muted">送り ${fmtAmt(r.vol[out])}/年 ・ 受け取り ${fmtAmt(r.vol[1 - out])}/年</span></div>
      ${costButton(g, `data-act="uproute" data-route="${r.id}"`, TR('拡張'), g.routeUpCost(r), r.a, busyText(g, (j) => j.type === 'route' && j.route === r.id))}</div>`;
  }).join('');
  const dest = others.some((s) => s.id === app.routeDest) ? app.routeDest : others[0]?.id;
  const open = others.length
    ? TR`<label class="field">相手の星系
        <select data-act="rdest">${others.map((s) => `<option value="${s.id}" ${s.id === dest ? 'selected' : ''}>${esc(s.name)} (${distance(s, sys).toFixed(1)} ly)</option>`).join('')}</select></label>
       ${costButton(g, `data-act="route" data-dest="${dest}"`, TR`${ico('route')}交易路を開設`, g.routeCost(sys.id, dest), sys.id)}`
    : TR('<p class="note">交易路を結べる相手(他の入植星系)がない</p>');
  const warNote = g.knownSystems().some((s) => s.id !== sys.id && !g.routeBetween(s.id, sys.id) && g.knownHostile(sys.id, s.id))
    ? TR('<p class="note">交戦中の国の星系とは交易路を結べない (既存の交易路は残る)。</p>') : '';
  return TR`<h3>交易路</h3>
    <p class="note">余っている資源を、足りない星系へ自動で運ぶ (0.95c の貨物船)。交易路でつながっていれば、複数の交易路を乗り継いで届ける。荷は受け手が基準価格で買い取る (送り手の輸出収入になる)。代金を払えない星系は、主人から支援として無償で受け取れるが、そのぶん従属が深まる (忠誠度が上がる)。</p>
    ${list}${open}${warNote}`;
}

function autoRoutesToggle(g) {
  return TR`<label class="check auto"><input type="checkbox" data-act="autoroutes" ${g.autoRoutes ? 'checked' : ''}> ${ME.capName}と直轄の星系の混んだ交易路 (稼働率9割超) を自動で拡張する</label>`;
}

function defenseToggle(g) {
  const bare = g.undefended().length;
  const goal = g.pirateMax();
  return TR`<label class="check auto"><input type="checkbox" data-act="autodefense" ${g.autoDefense ? 'checked' : ''}> ${ico('defense')}自動防衛配備</label>
    <label class="check auto"><input type="checkbox" data-act="autobuild" ${g.autoBuild ? 'checked' : ''} ${g.autoDefense ? '' : 'disabled'}> 足りない艦隊は自動で編成</label>
    <p class="note">年に1回、各入植星系の駐留艦隊を海賊の最大戦力 (いま <b>${goal}</b> 艦隊、${PIRATE_START}年から40年ごとに増える) まで増やす。余っている艦隊を近くから回し、足りなければ${ME.capName}の軍事基地で編成する (資金が費用の2倍以上あるとき、年5艦隊まで。ほかの星系は自分で海賊対策の建艦をする)。命令で送った艦隊 (遠征・攻め落とした星系の守り) と威圧の艦隊は動かさない。${ME.capName}と、海賊が現れる前は1艦隊。目標に届いていない入植星系: ${bare} か所</p>
    ${aweToggle(g)}`;
}
// 反乱防止の威圧 (海賊対策の駐留とは別)
function aweToggle(g) {
  const ts = g.aweTargets();
  const short = ts.filter((s) => g.knownAwe(s.id) < g.aweGoal(s.id)).length;
  return TR`<label class="check auto"><input type="checkbox" data-act="autoawe" ${g.autoAwe ? 'checked' : ''}> ${ico('awe')}反乱防止のための威圧</label>
    <p class="note">年に1回、${ME.home}の直属の従属星系に、反乱 (独立戦争) を起こしたときにその星系が持つであろう艦隊 (人口と経済の規模から推定) の<b>2倍</b>の艦隊を${ME.capName}から送って駐留させる (海賊対策の駐留とは別に数える。忠誠度が50以上か、主人との友好度が${FRIEND_SAFE}以上の星系には送らず、そうなった星系からは威圧の艦隊を${ME.capName}へ引き揚げる。忠誠度の低い順。足りない艦隊は「足りない艦隊は自動で編成」がオンなら、${ME.capName}で資金と資源の続く限り編成)。${ME.home}の艦隊が駐留している星系は<b>恐怖度</b> (忠誠度とは別) が上がり (推定艦隊と同数で50、2倍で100。年に最大10ずつ動く)、恐怖度が高いほど独立を宣言しにくくなる (100で確率が1/10)。それでも独立されたら、駐留していた艦隊はその場で独立軍と艦隊戦になり、勝てば攻囲に移る。威圧の対象 (直属で忠誠度50未満・友好度${FRIEND_SAFE}未満) ${ts.length} か所のうち、目標に届いていない: ${short} か所</p>`;
}

// 艦隊の色: 自艦隊 (地球が動かす艦隊)・従属艦隊 (地球の国の従属星系の守り)・中立国・敵国
const FLEET_COLOR = { own: '#5aa9ff', vassal: '#8be36a', neutral: '#f0c94a', enemy: '#ff5a5a' };
const FLEET_KIND = { own: '自艦隊', vassal: '従属艦隊', neutral: '中立艦隊', enemy: '敵艦隊' };
// 他国の艦隊の数の見え方 (ハンディキャップ表の info)。観戦中と自国・入植していない星系はそのまま
function shipsSeen(g, id, n) {
  const info = HANDICAP[g.handicap]?.info || 'full';
  if (info === 'full' || g.spectate || id === g.cap) return String(n);
  const k = g.known(id);
  if (!k?.cols?.length || (k.realm ?? g.cap) === g.cap) return String(n);
  return info === 'hidden' ? '?' : n ? TR`約${Math.max(5, Math.round(n / 5) * 5)}` : '0';
}
function realmFleetKind(g, realm) { return realm === g.cap ? 'own' : g.knownAtWar(g.cap, realm) ? 'enemy' : 'neutral'; }
