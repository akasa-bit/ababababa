// 審議中の法案の欄 (回 SE7・B-022。財政の欄と国家方針の欄の上に出す)。支持・進んだ段・押し戻された回数・次の関門と、支持と反対に傾く集団 (声の重さ × (見込み − 半分))。
// 集団の内訳は年に 1 回だけ数え直す (画面から状態を作らない。支持そのものは関門ごとの値 b.S)
function billHtml(g, kind) {
  const b = g.bill(kind);
  if (!b) return '';
  const key = `${kind}|${b.since}|${Math.floor(g.year)}|${g.cap}`;
  if (g._billView?.key !== key) g._billView = { key, groups: g.billSupport(kind, b.target).groups };
  const list = g._billView.groups, W = list.reduce((a, x) => a + x.w, 0) || 1;
  const sp = (id) => g.speciesOfRealm(g.realmOf(id));
  const name = (x) => TR`${x.sys === g.cap ? ME.capName : g.system(x.sys).name}の${x.k === 'home' ? TR`${sp(x.sys)} (よそ生まれ)` : x.k === 'local' ? TR`${sp(x.sys)} (ここ生まれ)` : x.k}・所得${GROUP_QUINT_LABEL[x.q]}の分位`;
  const top = (f) => list.map((x) => ({ x, v: f(x) })).sort((a, c) => c.v - a.v).slice(0, 3).filter((y) => y.v > 0.002 * W).map(({ x }) => TR`${esc(name(x))} (支持 ${pct(x.p)}・声 ${pct(x.w / W)})`).join('、');
  const cost = g.billPushCost(kind);
  return TR`<div class="note"><b>審議中: ${BILL_LABEL[kind]}の法案</b> (${esc(g.billText(kind, b.target))})。支持 ${pct(b.S)} (${pct(ENACT.now)} あればすぐ通る)・進んだ段 ${b.stage}/${ENACT.stages}・押し戻された ${b.back}/${ENACT.setbacks} 回・次の関門 ${b.at.toFixed(1)} 年。
    関門ごとに、支持が高いほど進み (${pct((1 - ENACT.stall) * (0.25 + 0.5 * b.S))})、低いほど押し戻される (${pct((1 - ENACT.stall) * (0.75 - 0.5 * b.S))})。${ENACT.stages} 段進めば通り、${ENACT.setbacks} 回押し戻されると廃案。
    <br>支持に傾く集団: ${top((x) => x.w * (x.p - 0.5)) || TR('なし')}<br>反対に傾く集団: ${top((x) => x.w * (0.5 - x.p)) || TR('なし')}
    <br><button data-act="bill" data-bill="${kind}" data-op="push" ${g.pc < cost ? 'disabled' : ''}>押す (1 段進める。政治力 ${cost})</button> <button data-act="bill" data-bill="${kind}" data-op="withdraw">引っ込める</button></div>`;
}
