// AI の国の最近の判断と理由の内訳 (回 AI2・B-301。docs/ai-behavior.md の 7「理由を出す」)。星系の欄の、その国の首都の節。
// AI の国の首都に届いていた記録で決めた理由。プレイヤーの首都に光が届いた分だけ出す (観戦ではすべて)
function aiLogSec(g, id) {
  const list = (g.aiLog[id] || []).filter((e) => g.spectate || e.y + g.lightDelay(id) <= g.year + 1e-9);
  if (!list.length) return '';
  const rows = list.slice().reverse().map((e) => TR`<li>${Math.floor(e.y)}年: ${esc(TX(e.t))}</li>`).join('');
  return sec('aiwhy', TR`${ico('memo')}この国の判断と理由`, TR`${list.length} 件 (${Math.floor(list[list.length - 1].y)}年まで)`,
    TR`<p class="note">この国が宣戦・講和・協定・拒否を決めたときの理由の内訳。この国の首都に光で届いていた古い記録 (読み違いつき) で決めたもの。${ME.capName}に光が届いた分だけ出る。</p><ul>${rows}</ul>`);
}
