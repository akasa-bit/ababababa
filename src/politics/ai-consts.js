// --- AI の国の判断の記録 (回 AI2・B-301。docs/ai-behavior.md の 7「理由を出す」) ---
// AI の国 (席のない独立した国も) が宣戦・講和・協定・拒否をしたとき、その国の首都に届いていた記録で作った理由の内訳を覚える。
// 星系の欄 (その国の首都) に、光の遅れで届いた分だけ出す (politics/threat-ui.js)。years 年より古いもの・max 件を超えた古いものは捨てる
const AI_LOG = { years: 60, max: 8 };
saveField('aiLog', (game) => (Object.keys(game.aiLog).length ? game.aiLog : undefined), {
  init: (game) => { game.aiLog = {}; },
  read: (game, d) => {
    const o = d.aiLog && typeof d.aiLog === 'object' ? d.aiLog : {};
    game.aiLog = Object.fromEntries(Object.entries(o).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.filter((e) => e && Number.isFinite(e.y) && typeof e.t === 'string')]));
  },
});
