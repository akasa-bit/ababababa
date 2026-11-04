# AI の振る舞い (回 AI6・B-306・QD-115 = a) から: 観戦の AI の平時の宣戦を、AI の国と同じ交渉の模型に

`src/ship/earth-war.js` の `earthWarYearly` を直した。

- 平時の宣戦を、新しい `spectateDeclare()` に分けた。中身は `ship/war-ai.js` の `realmsYearly` の AI の国の宣戦と同じ:
  - 開戦を知っている戦争がなければ、年 `BARGAIN.declareChance` の確率で (自分から分かれた国があれば `RECLAIM.chance`) 考える。
  - 首都の記録で `warDist` 光年以内の独立国 (人間の国も) のうち、受け入れる線 + 請求権 + 記憶のずれが `declare` を超えて、いちばん良い相手に宣戦する (`aiDeclare`。理由の内訳つき)。
- 前は、25 光年以内の独立国ごとに、艦隊が 5 倍なら年 5% で宣戦していた (`declareWar`)。人間の代わり (観戦の AI) が AI の国の 17〜31 倍宣戦し、同じ国が人間の席だと AI の席の 0.68 倍の大きさで終わっていた (`docs/ai-behavior.md` の 12.2)。
- 交戦中の判断 (艦隊を差し向ける・講和を申し入れる・講和の申し入れに応じる) は変えていない。
- R29 (国家間戦争の多さ) は人間の席の戦争を含むので下がる。測りと `BARGAIN.declareChance` の合わせ直しは、この回の PR と `docs/ai-behavior.md` の 13。

読んだら消してよい。
