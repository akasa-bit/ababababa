// 物資移送要求の一覧。情報は光速でしか伝わらないので、要求が届くまでの時間と処理状況を見せる
function requestsTable(g) {
  const name = (id) => esc(g.system(id).name);
  const vis = g.requests.filter((q) => g.departSeen(q.from, q.sent));
  const rows = [...vis].sort((a, b) => a.arrive - b.arrive).slice(0, 40).map((q) => {
    const what = q.kind === 'build' ? `建設資材 (${esc(q.label)})` : q.kind === 'order' ? `指令「${esc(q.label)}」` : q.kind === 'tribute' ? `朝貢 ${fmtAmt(q.amt)} cr` : q.kind === 'grant' ? `資金援助 ${fmtAmt(q.amt)} cr${q.auto ? ' (自動)' : ''}`
      : `${resText(q.res)} ${fmtAmt(q.amt)}${q.shipped ? ` <span class="muted">(発送済み ${fmtAmt(q.shipped)})</span>` : ''}`;
    const seen = q.arrive + (g.spectate ? 0 : g.lightDelay(q.to)); // 届いたことが地球に見える年
    const team = q.kind === 'order' && g.orderYears(q.act, q.d, q.to) > g.lightDelay(q.to) + 1e-9; // 人を船で送る指令 (視察団・医療団)
    const st = q.arrive > g.year
      ? `<span style="color:#c9a2ff">${team ? '船で移動中' : '光速で送信中'}</span> あと ${(q.arrive - g.year).toFixed(1)} 年`
      : seen > g.year ? `届いた (${ME.home}に知らせが来るまで あと ${(seen - g.year).toFixed(1)} 年)`
      : '<span class="hz">送り手で処理中</span> (交易路の空きを待って発送)';
    return `<tr><td>${name(q.from)} → ${name(q.to)}</td><td>${what}</td><td>${st}</td></tr>`;
  }).join('');
  return `<h3>通信 (物資移送要求・指令・朝貢) ${vis.length} 件</h3>
    <p class="note">情報は光速でしか伝わらない。資源が足りない星系や建設地は、交易路でつながった送り手へ物資移送要求を送り、要求が届いてから荷が出発する。地図での表示はヘッダーの「通信」ボタンで切り替える: 表示しない / 光の点 (見かけの位置の点と点線。届いて処理中の要求は送り手に輪)。色は紫: 交易、黄: 建設資材、水色: 指令、緑: 朝貢、金: 資金援助。</p>
    ${rows ? `<div class="scroll"><table class="tbl"><tr><th>要求元 → 送り手</th><th>内容</th><th>状況</th></tr>${rows}</table></div>` : '<p class="note">いま動いている要求はない。</p>'}`;
}

// 国の色 (地球の国は青緑、独立国は首都ごとの色)
// 地球の国の色 (地図)。配色の案で変わる
const OWN = { hex: '#4de3d0', rgb: '77,227,208' };
const TERRITORY_LY = 5; // 入植星系が領土にするまわりの距離 [光年] (星間マップの国の塗り分け)
function realmColor(root) { return root === 0 || root === null || root === undefined ? OWN.hex : REALM_COLORS[root % REALM_COLORS.length]; }

// 帝国 → 政治: 各星系の政府の忠誠度、独立国と戦争
function politicsSheet(app) {
  const g = app.game;
  const goto = (s) => `<button data-act="goto" data-sys="${s.id}">${esc(s.name)}</button>`;
  const rows = g.knownSystems().filter((x) => x.id !== g.cap).map((x) => ({ x, k: g.known(x.id) })).sort((a, b) => (a.k.loyalty ?? 100) - (b.k.loyalty ?? 100)).map(({ x, k }) => {
    const realm = k.realm ?? g.cap;
    const status = k.independent && realm === x.id ? '<b class="bad">独立国 (首都)</b>' : realm !== g.cap ? `<span class="bad">${esc(g.realmName(realm))}に属する</span>` : `${ME.realm}`;
    const loyal = k.lord === null || k.lord === undefined ? '—' : `<span class="${k.loyalty < UNREST_AT ? 'bad' : k.loyalty < 50 ? '' : 'hz'}">${Math.round(k.loyalty ?? LOYALTY_START)}</span>`;
    const vassal = k.lord !== null && k.lord !== undefined;
    const neglect = vassal ? Math.max(0, g.year - (k.attended ?? k.founded ?? k.year)) : 0;
    const rule = !vassal || realm !== g.cap ? '—' : k.direct ? `<b>${ico('rg-direct')}直接統治</b>` : `${ico(`rg-${g.knownRegime(k)}`)}${REGIMES[g.knownRegime(k)].label} (${ico(MANDATE_ICON[k.mandate || 'balanced'])}${MANDATES[k.mandate || 'balanced']})`;
    return `<tr><td><span class="dot" style="background:${realmColor(realm)}"></span>${goto(x)}</td><td>${k.lord === null || k.lord === undefined ? '—' : esc(g.system(k.lord).name)}</td>
      <td>${rule}</td>${NEGLECT_MAX ? `<td>${vassal ? `<span class="${neglect > NEGLECT_GRACE ? 'bad' : 'muted'}">${Math.floor(neglect)} 年</span>` : '—'}</td>` : ''}
      <td>${k.unrest?.stage ? `<b class="bad">${UNREST_LABEL[k.unrest.stage]}</b>` : vassal ? '<span class="muted">—</span>' : '—'}</td>
      <td>${loyal}</td><td>${k.lord === null || k.lord === undefined ? '—' : Math.round(k.fear || 0)}</td>
      <td>${k.lord === null || k.lord === undefined ? '—' : `<span class="${(k.friend || 0) >= FRIEND_SAFE ? 'hz' : ''}">${Math.round(k.friend || 0)}</span> <span class="muted">(貿易 ${fmtAmt(k.lordTrade || 0)} cr/年)</span>`}</td><td>${k.aid > 0.5 ? `${fmtAmt(k.aid)} cr/年` : '<span class="muted">—</span>'}</td>
      <td>${(() => { const o = independenceOutlook(g, x.id); return o ? `<span class="${o.warn ? 'bad' : 'muted'}">${esc(outlookText(o, true))}</span>` : '—'; })()}</td><td>${status}</td><td>${ageBadge(g, x.id)}</td></tr>`;
  }).join('');
  const roots = [...new Set(g.knownSystems().map((x) => g.known(x.id)?.realm).filter((r) => r !== null && r !== undefined && r !== g.cap))];
  const realms = roots.map((root) => {
    const war = g.knownAtWar(g.cap, root);
    const n = g.knownSystems().filter((x) => g.known(x.id)?.realm === root).length;
    const others = g.knownEnemiesOf(root).filter((e) => e !== 0);
    return `<tr><td><span class="dot" style="background:${realmColor(root)}"></span>${goto(g.system(root))}</td><td>${n} 星系</td>
      <td>${war ? `<b class="bad">${ME.realm}と交戦中</b> (${(g.warStart(g.warKey(g.cap, root)) ?? g.year).toFixed(0)}年から)` : `${ME.realm}とは平和`}${others.length ? `<br><span class="bad">${others.map((e) => esc(g.realmName(e))).join('・')}と交戦中</span>` : ''}</td>
      <td>${war ? `戦勝点 <b class="${g.warScore(g.cap, root) < 0 ? 'bad' : 'hz'}">${g.warScore(g.cap, root)}</b><br><span class="muted">相手の戦争疲弊 ${Math.round(g.known(root)?.exh || 0)} (${(g.dataAge(root) ?? g.lightDelay(root)).toFixed(0)} 年前)</span>` : '—'}</td>
      <td>${war ? `${(() => { const o = g.peaceOffers.find((x) => x.from === root && x.to === g.cap); return o ? `<button data-act="acceptpeace" data-key="${g.warKey(g.cap, root)}">${ico('peace')}${o.surrender ? '降伏する<small>相手が降伏を求めている (持ち点 100 で相手が条件を選ぶ)</small>' : '講和に応じる<small>相手からの申し入れ</small>'}</button>` : ''; })()}<button data-act="peace" data-sys="${root}">${ico('peace')}講和を申し入れる<small>指令: 届くまで ${g.lightDelay(root).toFixed(1)} 年</small></button>` : `<button data-act="declarewar" data-sys="${root}">${ico('war')}宣戦する</button>`}</td></tr>`;
  }).join('');
  const myEx = Math.round(g.exhaustion[g.cap] || 0);
  const sieges = g.knownSystems().map((x) => ({ x, sg: g.known(x.id)?.siege })).filter((v) => v.sg).map(({ x, sg }) => `<tr><td>${goto(x)}</td>
    <td><span class="dot" style="background:${realmColor(sg.realm)}"></span>${esc(g.system(sg.realm).name)} の国</td><td>${sg.ships} 艦隊</td><td>${pct(sg.progress)}</td><td>${supplyCell(sg.eff, sg.line)}</td><td>${ageBadge(g, x.id)}</td></tr>`).join('');
  const battles = g.knownSystems().map((x) => ({ x, bt: g.known(x.id)?.battle })).filter((v) => v.bt).map(({ x, bt }) => `<tr><td>${goto(x)}</td>
    <td><span class="dot" style="background:${realmColor(bt.realm)}"></span>${esc(g.system(bt.realm).name)} の国</td><td>${Math.ceil(bt.a)} / ${Math.round(bt.a0)} 艦隊</td>
    <td>${Math.ceil(bt.d)} / ${Math.round(bt.d0)} 艦隊</td><td>攻 ${supplyCell(bt.ea, bt.line)}<br>防 ${supplyCell(bt.ed)}</td><td>${bt.start.toFixed(1)}年から</td><td>${ageBadge(g, x.id)}</td></tr>`).join('');
  return `<h3>忠誠と自立</h3>
    <p class="note">星系の政府は忠誠度を持つ。忠誠度の目標は、${NEGLECT_MAX ? `主人の関与 (${ME.home}からの指令・主人からの資金援助・${ME.home}が命じた艦隊の来訪・視察団) が途絶えて${NEGLECT_GRACE}年を過ぎると年${NEGLECT_RATE}ずつ下がり (最大 −${NEGLECT_MAX})、` : ''}主人や首都から遠いほど少し下がる (1光年あたり 0.6 と 0.3)。主人より人口が多い、指令が多すぎても下がり、主人の星系の艦隊・支援・統治体制・認めた要求・国家方針で上下する。遠い星系ほど関与が届くのに時間と政治力がかかる。
      自立を求める動き (<b>不満</b>) は、<b>離反の起きやすさ</b> (年あたりのハザード = 基準 × 統治体制 × 通信の遅れ ÷ 1 世代 (${GENERATION_YEARS} 年) × 主人との人口の比 × 忠誠度) に従って起き、${UNREST_YEARS}年続くと主人へ<b>要求</b> (朝貢の免除か自治) を出す。主人が${ME.home}なら要求は光速で${ME.home}に届き (イベントタブの「決めること」)、返事も光速で戻る。総督の方針を前もって預けておけば、現地ですぐ決まる。のめば不満は収まる。拒めば<b>最後通牒</b>になり、${ULTIMATUM_YEARS}年後に独立を宣言するおそれがある (恐怖度・主人との友好度・忠誠度が高いほど確率が下がる。恐怖度100で 0.1 倍、友好度100で ${1 - FRIEND_DAMP} 倍、忠誠度100で 0.5 倍)。要求を出す前に、忠誠度が${UNREST_CALM}か動きが始まったときの忠誠度 +15 の高いほうまで上がれば収まる。
      恐怖度は、その星系に${ME.home}の艦隊が駐留していると上がる (反乱したときの推定艦隊と同数で50、2倍で100)。主人との友好度は、主人筋との貿易が大きいほど上がる。忠誠度が50未満 (連邦制は70未満) だと指令を拒むことがあり、自治領は指令を受けない。${ME.realm}からの独立は、半々の確率で (${ME.home}の艦隊が駐留していれば必ず) そのまま独立戦争になる (自治領は戦争にならない)。</p>
    <h3>資金援助</h3>
    <p class="note">入植して${GRANT_YEARS}年以内の星系には、主人の星系が毎年、資金の3% (最大 ${GRANT_MAX} cr) を自動で送る。資金援助は支援物資と同じく忠誠度を上げる。チェックを外すと${ME.home}からの自動送金だけが止まる (ほかの星系どうしは続く)。個別の資金援助は星系の詳細欄から送れる。</p>
    <label class="check auto"><input type="checkbox" data-act="autogrant" ${g.autoGrant ? 'checked' : ''}> ${ico('grant')}入植後${GRANT_YEARS}年の自動資金援助 (${ME.home}から)</label>
    <h3>独立国</h3>
    <div class="kpi"><div><span>${ico('war')}${esc(ME.realm)}の戦争疲弊</span><b class="${myEx >= 40 ? 'bad' : ''}">${myEx}</b><span>税収 −${Math.round(EXHAUST.tax * myEx * 100)}%・家臣の忠誠度 −${Math.round(EXHAUST.loyalty * myEx)}${myEx > 20 ? `・議会の支持 −${(EXHAUST.council * (myEx - 20)).toFixed(1)}/年` : ''}</span></div></div>
    ${realms ? `<div class="scroll"><table class="tbl"><tr><th>首都</th><th>規模 (把握分)</th><th>状態</th><th>戦況</th><th></th></tr>${realms}</table></div>` : '<p class="note">いまのところ独立国はない。</p>'}
    ${diplomacyHtml(g, roots)}
    <p class="note"><b>戦争疲弊</b> (0〜100) は、艦隊を失うと 1 艦隊あたり ${EXHAUST.ship}、星系を攻め落とされると ${EXHAUST.system}、戦っている戦争 1 つにつき年 ${EXHAUST.warYear} (攻囲されている星系 1 つにつき年 ${EXHAUST.siegeYear}) 増え、平和なあいだは年 ${EXHAUST.peaceYear} ずつ減る。<b>戦勝点</b> (−100〜100) は、沈めた艦隊の差 (1 艦隊 ${WARSCORE.ship}) と、攻め落とした星系の差 (1 つ ${WARSCORE.system}) で決まる。
      講和は、勝っている側が<b>講和会議</b>で戦勝点 (100 まで) を条件に使う: 従属させる (${TREATY.vassal})・星系の割譲 (人口しだいで 5〜30)・賠償金 (${fmtAmt(TREATY.cash)} cr ごとに ${TREATY.cashPts})。戦勝点の差が 5 未満なら白紙講和。AI の国は、負けているほど・疲れているほど講和に応じ、戦争疲弊が 60 を超えるか戦勝点が −50 を下回ると自分から申し入れてくる。戦闘のないにらみ合いの戦争も、始まってすぐは年 35% ほど、長引くほど低い確率で申し入れてくる (20 年たつと年 6%)。</p>
    <p class="note">戦争中は、艦隊を敵の星系へ送ると艦隊戦になる。艦隊戦は撃ち合いで自動に進み、組織力が尽きた艦は退く (詳しくは帝国 → 軍事の「艦隊戦の報告」)。途中で届いた艦隊はその場で加わる。勝てば攻囲が始まる。攻囲は艦隊の数と地上の抵抗 (歩兵・人口) でゆっくり進み、100%で降伏して攻めた国 (の首都) に従属する。終わらせ方は上の「戦争疲弊」「講和会議」のとおり (仕掛けた側が大差で負ければ、相手に全面的に任せる持ち点 100 の講和会議になる)。独立国どうしも戦争をする (近くの弱い独立国に宣戦する)。交戦中でない国の星系へ艦隊を送ると奇襲攻撃になり、着いた時点で戦争が始まる。交戦中の国どうしでは物資をやり取りしない (各星系は開戦の知らせが光速で届いてから取引をやめる)。講和・降伏で戦争が終わっても、終戦の知らせが主星 (首都) を経て光速で届くまで、各地の艦隊は戦い続け攻囲も続く。</p>
    <h3>戦争</h3>
    ${(() => {
      const rows = g.knownWarKeys().map((k) => {
        const [a, b] = k.split('|').map(Number);
        const by = g.warAggressor(k);
        const att = by === b ? b : a, def = att === a ? b : a;
        return `<tr><td><span class="dot" style="background:${realmColor(att)}"></span>${esc(g.realmName(att))}</td><td><span class="dot" style="background:${realmColor(def)}"></span>${esc(g.realmName(def))}</td><td>${(g.warStart(k) ?? g.year).toFixed(0)}年から</td><td>${Math.round(g.knownRealmShips(att))} 対 ${Math.round(g.knownRealmShips(def))} 艦隊 (把握分)</td></tr>`;
      }).join('');
      return rows ? `<div class="scroll"><table class="tbl"><tr><th>仕掛けた国</th><th>仕掛けられた国</th><th>開戦</th><th>戦力</th></tr>${rows}</table></div>` : '<p class="note">いま戦争はない。</p>';
    })()}
    <h3>艦隊戦</h3>
    ${battles ? `<div class="scroll"><table class="tbl"><tr><th>星系</th><th>攻めている国</th><th>攻撃側 (残り / 投入)</th><th>防衛側 (残り / 投入)</th><th>${ico('supply')}戦力 (兵站)</th><th>開始</th><th>情報</th></tr>${battles}</table></div>` : '<p class="note">なし</p>'}
    <h3>攻囲</h3>
    ${sieges ? `<div class="scroll"><table class="tbl"><tr><th>星系</th><th>攻めている国</th><th>艦隊</th><th>進捗</th><th>${ico('supply')}戦力 (兵站)</th><th>情報</th></tr>${sieges}</table></div>` : '<p class="note">なし</p>'}
    <h3>星系の政府 (忠誠度の低い順)</h3>
    ${rows ? `<div class="scroll"><table class="tbl"><tr><th>星系</th><th>従属先</th><th>統治</th>${NEGLECT_MAX ? '<th>放っておかれた</th>' : ''}<th>不満</th><th>${ico('loyalty')}忠誠度</th><th>${ico('fear')}恐怖度</th><th>${ico('friend')}主人との友好度</th><th>主人からの支援</th><th>見通し</th><th>所属</th><th>情報</th></tr>${rows}</table></div>` : `<p class="note">まだ${ME.home}以外の政府はない。</p>`}`;
}


// 外交 (回 SE2・B-026): 結んでいる協定・届く途中の申し入れ・国ごとの申し入れのボタンと見込み (「何なら受けるか」)
function diplomacyHtml(g, roots) {
  const mine = g.diplo.pacts.filter((p) => p.a === g.cap || p.b === g.cap).map((p) => {
    const other = p.a === g.cap ? p.b : p.a;
    const meOn = p.a === g.cap ? p.onA : p.onB, themOn = p.a === g.cap ? p.onB : p.onA;
    return `<tr><td><span class="dot" style="background:${realmColor(other)}"></span>${esc(g.realmName(other))}</td><td>${ico(PACT_ICON[p.kind])}${PACT_KINDS[p.kind].label}</td><td>${Math.round(p.until)}年まで</td>
      <td>${meOn > g.year ? `<span class="muted">${ME.realm}は ${meOn.toFixed(0)} 年から (返事が届いてから)</span>` : `${ME.realm}も縛られている`}<br><span class="muted">相手は ${themOn.toFixed(0)} 年から</span></td></tr>`;
  }).join('');
  const sent = g.diplo.sent.filter((o) => o.from === g.cap).map((o) => `<tr><td>${esc(g.realmName(o.to))}</td><td>${ico(PACT_ICON[o.kind])}${PACT_KINDS[o.kind].label}</td><td>${o.at > g.year ? `光速で送信中 あと ${(o.at - g.year).toFixed(1)} 年` : '相手が考えている'}${o.gift ? ` (贈り物 ${fmtAmt(o.gift)} cr)` : ''}</td></tr>`).join('');
  const kinds = Object.keys(PACT_KINDS);
  const rows = roots.filter((r) => !g.knownAtWar(g.cap, r) && g.realmAlive(r)).flatMap((r) => kinds.map((kind, i) => {
    const head = i === 0 ? `<td rowspan="${kinds.length}"><span class="dot" style="background:${realmColor(r)}"></span>${esc(g.realmName(r))}<br><span class="muted">${g.sysDist(g.cap, r).toFixed(1)} 光年</span></td>` : '';
    let cell, act = '';
    if (g.pactBetween(g.cap, r, kind)) cell = '<span class="muted">結んでいる</span>';
    else if (g.diplo.sent.some((o) => o.from === g.cap && o.to === r && o.kind === kind)) cell = '<span class="muted">申し入れ中</span>';
    else {
      const o = g.pactOutlook(r, kind);
      cell = `<span class="${o.s >= 0.15 ? 'hz' : o.s >= 0 ? '' : 'bad'}">${o.label}</span><br><span class="muted">${esc(o.why)}${o.s < 0 ? `。${o.need.ships ? `こちらの艦隊があと ${o.need.ships} 見えるか、` : ''}贈り物 ${fmtAmt(o.need.gift)} cr なら受けそう` : ''}</span>`;
      act = `<button data-act="pact" data-sys="${r}" data-pact="${kind}" data-gift="0">申し入れる<small>政治力 ${PC_DIPLOMACY}</small></button>${o.s < 0 ? `<button data-act="pact" data-sys="${r}" data-pact="${kind}" data-gift="${o.need.gift}">贈り物つき<small>${fmtAmt(o.need.gift)} cr (受けたら払う)</small></button>` : ''}`;
    }
    return `<tr>${head}<td>${ico(PACT_ICON[kind])}${PACT_KINDS[kind].label}</td><td class="wrap">${cell}${act ? `<div class="btns">${act}</div>` : ''}</td></tr>`;
  })).join('');
  const breaches = g.pactBreaches(g.cap);
  return `<h3>外交</h3>
    <p class="note">協定は 3 種類 (${Object.values(PACT_KINDS).map((k) => `<b>${k.label}</b>: ${k.note}`).join('・')})。どれも ${PACT.years} 年。申し入れは光速で相手の首都に届き、相手はそこで決める。受けた時点から相手が縛られ、返事が光速で戻った時点から${ME.realm}が縛られる。
      相手は、首都に届いている古い光で見た${ME.realm}の艦隊 (読み違いつき) と、近くの国の艦隊から決める。下の見込みは、地球に届いている記録での見立て。協定の相手に宣戦するか、同盟の参戦を断ると<b>破約</b>になり、議会の支持 −${PACT.breachCouncil}、${PACT.distrustYears} 年のあいだ、どの国も協定を受けにくくなる${breaches ? ` (いま破約 <b class="bad">${breaches}</b> 回)` : ''}。</p>
    ${mine ? `<div class="scroll"><table class="tbl"><tr><th>相手</th><th>協定</th><th>期限</th><th>縛られる時期</th></tr>${mine}</table></div>` : '<p class="note">結んでいる協定はない。</p>'}
    ${sent ? `<div class="scroll"><table class="tbl"><tr><th>相手</th><th>申し入れ</th><th>状況</th></tr>${sent}</table></div>` : ''}
    ${rows ? `<div class="scroll"><table class="tbl"><tr><th>国</th><th>協定</th><th>見込み (地球に届いた記録で)</th></tr>${rows}</table></div>` : ''}`;
}
