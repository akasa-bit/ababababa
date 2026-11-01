// --- 指令の予想と答え合わせ (B-056) ---
// 指令を送った瞬間に「届く年・従う見込み (艦隊なら着いた先で勝つ見込み)」を出し、結果の知らせが地球に届いたら「予想 → 実際」を 1 行で出す
// (設計の柱の「すぐ返る手応えと、遅れて届く本当の結果」)。画面だけの記録 (セーブには入らない。読み込み直すと消える)
const Forecast = { list: [] };
const forecastOf = (id) => Forecast.list.find((x) => x.id === id);
const ORDER_ALWAYS = ['peace', 'fleet', 'redirect', 'fleetclear', 'decide', 'strike']; // 届いた所でかならず実行されるもの (obeys と同じ)
// 従う見込み: 地球が知っている忠誠度・統治体制・自治から、届いた星系の obeys と同じ式で
function obeyChance(g, sys, act, arrive) {
  if (sys === g.cap || ORDER_ALWAYS.includes(act)) return 1;
  const k = g.known(sys);
  if (!k || k.realm !== g.cap) return 0;
  if ((k.autonomy || 0) > arrive) return 0;
  if (k.direct) return 1;
  const reg = REGIMES[g.knownRegime(k)];
  if (reg?.noOrders && !['rule', 'bundle', 'jointcut', 'depose'].includes(act)) return 0;
  const at = reg?.refuseAt || 50, loy = k.loyalty ?? LOYALTY_START;
  return loy >= at ? 1 : 1 - (at - loy) / at;
}
// issue で新しく出た指令 (id が after より大きいもの) の予想を作り、画面の下に出す
function forecastSent(g, after) {
  for (const q of g.requests) {
    if (q.kind !== 'order' || q.id <= after || (q.by ?? 0) !== g.cap || forecastOf(q.id)) continue;
    const p = obeyChance(g, q.to, q.act, q.arrive);
    let short = p < 1 ? TR`従う見込み ${Math.round(p * 100)}%` : '';
    // 艦隊を敵の星系へ: いま知っている守りの数で、着いた先で勝つ見込み (FU2 の battleOdds。試合の筋は変えない)
    if (q.act === 'fleet' && q.d?.sys !== undefined) {
      const tgt = Number(q.d.sys), realm = tgt === g.cap ? g.cap : g.known(tgt)?.realm;
      const nd = realm !== undefined && realm !== null && realm !== g.cap && g.knownEnemiesOf(g.cap).includes(realm) ? g.knownGarrison(tgt) : 0;
      if (nd > 0) short = TR`${g.system(tgt).name}で勝つ見込み ${Math.round(100 * g.battleOdds(Number(q.d.n) || g.knownGarrison(q.to), nd))}% (守り ${Math.round(nd)} 艦隊として)`;
    }
    const x = { id: q.id, label: q.label, to: q.to, act: q.act, sent: q.sent, arrive: q.arrive, p, short };
    Forecast.list.push(x);
    if (Forecast.list.length > 60) Forecast.list.shift();
    Net.toast(TR`指令「${q.label}」→ ${g.system(q.to).name}: 届くのは ${q.arrive.toFixed(1)} 年 (あと ${(q.arrive - g.year).toFixed(1)} 年)${short ? TR`・${short}` : ''}。結果が分かるのは ${(q.arrive + g.lightDelay(q.to)).toFixed(1)} 年`);
  }
}
// 結果の知らせ (届いた星系のログ「指令「…」が … に届き、実行された / 実行できなかった」) が地球に届いたら、予想と並べて 1 行で出す
function forecastTick(g) {
  for (const x of Forecast.list) {
    if (x.done || g.year < x.arrive + g.lightDelay(x.to)) continue;
    x.done = true;
    const l = g.knownLog().find((m) => m.sys === x.to && m.year >= x.arrive - 1e-6 && m.year - x.arrive < 1 && m.text.startsWith(`指令「${x.label}」`));
    if (!l) continue; // 記録から落ちたもの
    const ok = !l.text.includes('実行できなかった');
    const real = ok ? TR('届いて実行された') : TR`実行されなかった (${l.text.split(': ').slice(1).join(': ') || TR('理由は不明')})`;
    const line = TR`予想 → 実際: 指令「${x.label}」(${g.system(x.to).name}) — ${x.arrive.toFixed(1)} 年に届く${x.short ? TR`・${x.short}` : ''} → ${real}`;
    uiNote(line);
    if (x.p < 1 || !ok) Net.toast(line); // 見込みが 100% でなかったもの・はずれたものは画面の下にも
  }
}
