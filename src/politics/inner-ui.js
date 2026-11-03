// 外の国の中の勢力への手 (回 AI4・B-303。politics/inner.js の揺さぶり。docs/ai-behavior.md の 11)。星系の欄の、外の国の星系の節。
// 相手の国の首都なら議会の支持を、家臣の星系なら主人への忠誠度を、政府の側か反対派の側に動かす資金を送る (光速で届き、届いた年に払う)
function meddleSec(g, id, realm) {
  if (g.spectate || realm === null || realm === undefined || realm === g.cap) return '';
  const M = INNER.meddle, cap = id === realm, pc = g.pcCost('meddle', { sys: id });
  const what = cap ? TR`${esc(g.realmName(realm))}の議会の支持を ${M.council}` : TR`主人 (${esc(g.realmName(realm))}) への忠誠度を ${M.loyalty}`;
  const going = g.inner.sent.find((x) => x.from === g.cap && x.to === id);
  const btns = going
    ? TR`<p>資金が届く途中 (${Math.floor(going.at)}年に届く)</p>`
    : TR`<button data-act="meddle" data-sys="${id}" data-mode="back">政府の側を支える<small>政治力 ${pc}・${M.cost} cr</small></button><button data-act="meddle" data-sys="${id}" data-mode="undermine">反対派を支える<small>政治力 ${pc}・${M.cost} cr</small></button>`;
  return sec('meddle', TR`${ico('council')}中の勢力への手`, cap ? TR`議会の支持` : TR`忠誠度`,
    TR`<p class="note">資金 ${M.cost} cr を光速で送り、届いた年に払う。届くと${what}だけ上げる (政府の側) か下げる (反対派の側)。政府の側への資金は相手の政府が受け取るので恩として覚えられ、反対派への資金は ${Math.round(100 * M.exposed)}% の見込みで知られて、内政への干渉として恨まれる。</p>${btns}`);
}
