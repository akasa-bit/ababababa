# 画面と最初の体験 (依頼 GA-5・GA-6) と AI の振る舞い (QD-116) から: 国の置き場所のくじ・銀河の版 6・観戦の AI の入植

- core を触る: `core/game-base.js` の `foundNations(count, handicap, customs, natDraw)`。`natDraw` を渡すと、同じ銀河の番号でも国の置き場所が変わる。画面から新しい試合を始めるときだけ毎回ちがう番号を渡す (`screen/hotseat.js`)。画面なしの道具 (`tools/headless.js` など) は渡さないので、前のまま再現できる。
- core を触る: `core/galaxy.js` の `GALAXY_GEN` 5 → 6。自動生成の銀河だけ、星の円盤の中心を太陽系からずらす。実在の星の銀河 (道具の既定) は版 5 と同じ星図。
- 観戦の AI が動かす人間の国の首都にも入植の補正 C20 (QD-116 = a)。観戦で測る面白さの数の「放任」・R40・R41 は動く (`docs/ai-behavior.md` の 13.7)。

読んだら消してよい。
