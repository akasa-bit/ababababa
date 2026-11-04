// 外の国の中の勢力への手と、国の中の派閥 (回 AI4・B-303。politics/inner.js・lobby.js。docs/ai-behavior.md の 11)。星系の欄の節。
// 相手の国の首都なら親 (自分の国) 派を育てるか議会の支持を下げ、家臣の星系なら主人への忠誠度を動かす資金を送る (光速で届き、届いた年に払う)
function meddleSec(g, id, realm) {
  if (g.spectate || realm === null || realm === undefined || realm === g.cap) return '';
  const M = INNER.meddle, L = INNER.lob, cap = id === realm, pc = g.pcCost('meddle', { sys: id });
  const going = g.inner.sent.find((x) => x.from === g.cap && x.to === id);
  const cost = TR`<small>政治力 ${pc}・${M.cost} cr</small>`;
  const btns = going
    ? TR`<p>資金が届く途中 (${Math.floor(going.at)}年に届く)</p>`
    : cap
      ? TR`<button data-act="meddle" data-sys="${id}" data-mode="lobby">親${esc(g.realmName(g.cap))}派に資金を出す${cost}</button><button data-act="meddle" data-sys="${id}" data-mode="undermine">反対派を支える${cost}</button>`
      : TR`<button data-act="meddle" data-sys="${id}" data-mode="back">主人の側を支える${cost}</button><button data-act="meddle" data-sys="${id}" data-mode="undermine">分離派を支える${cost}</button>`;
  const note = cap
    ? TR`<p class="note">資金 ${M.cost} cr を光速で送り、届いた年に払う。親${esc(g.realmName(g.cap))}派に出すと、派閥があれば重みが ${L.fundYears} 年 ×${1 + L.fundBoost} になり、なければいちばん上の所得の集団で派閥ができる (相手の国は協定を受けやすく、${esc(g.realmName(g.cap))}と戦いにくくなる)。反対派を支えると、${esc(g.realmName(realm))}の議会の支持が ${M.council} 下がる。どちらも ${Math.round(100 * M.exposed)}% の見込みで知られて、内政への干渉として恨まれる。</p>`
    : TR`<p class="note">資金 ${M.cost} cr を光速で送り、届いた年に払う。届くと主人 (${esc(g.realmName(realm))}) への忠誠度を ${M.loyalty} だけ上げる (主人の側。相手の政府が受け取るので恩として覚えられる) か下げる (分離派の側。${Math.round(100 * M.exposed)}% の見込みで知られて恨まれる)。</p>`;
  return sec('meddle', TR`${ico('council')}中の勢力への手`, cap ? TR`派閥・議会の支持` : TR`忠誠度`, `${note}${btns}`);
}
// 国の首都の星系の欄: その国の中の派閥 (外の国への親 X 派・反 X 派)。外の国は、光が届いた時点の様子 (観戦ではいまの)
function lobbySec(g, id) {
  const list = g.lobbiesSeen(id);
  if (!list.length) return '';
  const own = id === g.cap || g.spectate;
  const rows = list.map((l) => {
    const w = g.lobbyClout(l), ap = Math.round(10 * l.ap) / 10;
    return TR`<li>${esc(g.lobbyName(l, w))}${own && ap ? TR`・満足 ${ap > 0 ? '+' : '−'}${Math.abs(ap)}` : ''}・${Math.floor(l.y)}年から</li>`;
  }).join('');
  return sec('lobby', TR`${ico('council')}国の中の派閥`, TR`${list.length} つ`,
    TR`<p class="note">権力に加わっている集団が、外の国に向けて同じ立場をとると派閥になる (交易・恩・恨み・外からの資金がきっかけ)。重みはその集団の声の重さの割合。親 X 派は X との協定を受けやすく、戦争を選びにくくし、反 X 派は逆。政府が派閥の望む向きに動くと満足が上がり、逆なら下がって、議会の支持が動く。</p><ul>${rows}</ul>`);
}
