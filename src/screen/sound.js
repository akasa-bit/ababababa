// --- 音 (B-047) ---
// QD-09 = b: 使用許諾つきの素材を買って入れる (買うのはユーザー。候補の表は docs/decisions.md)。買うまでは、鳴らす所だけを作り、音は空にしておく。
// 素材が届いたら assets/sound/ に置き、下の表にファイルの名前を書くだけで鳴る。鳴らす所は Sound.play(名前) を呼ぶ。
// 効果音 10: send = 指令・船を送った、colony = 入植船が着いて入植地ができた、route = 交易路の開通、independence = 独立、peace = 講和、
//   warn = 重大な悪い知らせが届いた、decide = 決めることが届いた、era = 新しい時代、stop = 「次の知らせまで進む」が止まった、click = ボタン
// 曲 2〜3: bgm (環境音。順に流す)
const SOUND_FILES = { send: null, colony: null, route: null, independence: null, peace: null, warn: null, decide: null, era: null, stop: null, click: null, bgm: [] };
const Sound = {
  // 見る人ごとの好み (ブラウザに覚えておく)。音の素材が入るまではボタンを出さない
  on: (() => { try { return localStorage.getItem(`${STORE}-sound`) !== 'off'; } catch { return true; } })(),
  last: {},
  // 同じ音は 0.4 秒に 1 回まで (知らせがまとめて届いたときに重ならないように)
  play(name) {
    const f = SOUND_FILES[name];
    if (!f || !this.on || typeof Audio === 'undefined') return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < 400) return;
    this.last[name] = now;
    try { const a = new Audio(`assets/sound/${f}`); a.volume = 0.6; a.play().catch(() => { /* 操作の前は鳴らせない */ }); } catch { /* 音の出ない環境 */ }
  },
};
document.addEventListener('click', (e) => { if (e.target.closest?.('button')) Sound.play('click'); }, true);
