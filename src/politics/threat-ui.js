// AI の国の最近の判断と理由の内訳 (回 AI2・B-301。docs/ai-behavior.md の 7「理由を出す」)。星系の欄の、その国の首都の節。
// AI の国の首都に届いていた記録で決めた理由。プレイヤーの首都に光が届いた分だけ出す (観戦ではすべて)。
// 回 AI3 から: 指導者 (名前・経歴・在任) と、この国が覚えているプレイヤーの国への恩と恨み (光が届いた時点の様子) も出す
function aiLogSec(g, id) {
  const asOf = g.spectate ? g.year : g.year - g.lightDelay(id);
  const list = (g.aiLog[id] || []).filter((e) => e.y <= asOf + 1e-9);
  const L = g.leaderSeen?.(id, asOf), mv = g.memView && id !== g.cap ? g.memView(id, g.cap, asOf) : null;
  if (!list.length && !L) return '';
  const rows = list.slice().reverse().map((e) => TR`<li>${Math.floor(e.y)}年: ${esc(TX(e.t))}</li>`).join('');
  const lead = L ? TR`<p>指導者: <b>${esc(TX(L.name))}</b> (${esc(TX(LEADER.careers[L.career].label))}・${Math.floor(L.since)}年から)</p>` : '';
  const memo = mv?.text ? TR`<p class="note">${esc(TX(mv.text))}</p>` : '';
  return sec('aiwhy', TR`${ico('memo')}この国の判断と理由`, L ? TR`${esc(TX(L.name))}・${list.length} 件` : TR`${list.length} 件`,
    TR`${lead}${memo}<p class="note">この国が宣戦・講和・協定・拒否を決めたときの理由の内訳。この国の首都に光で届いていた古い記録 (読み違いつき) で決めたもの。${ME.capName}に光が届いた分だけ出る。</p>${rows ? `<ul>${rows}</ul>` : ''}`);
}
