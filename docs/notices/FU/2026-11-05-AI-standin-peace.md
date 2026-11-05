# AI の振る舞い (回 AI9・B-307・B-309) から: 人間の代わりの講和と、不可侵を破る宣戦

- `src/ship/earth-war.js` の `earthWarYearly`: 観戦の人間の代わりは、交戦中の AI の国へ交渉の申し入れ (`sendBargain`) を送り、AI の国どうしと同じ交渉の模型で講和する (`STANDIN.bargain`。`politics/coerce-consts.js`)。交渉の模型のときは、負けているときの命令 `peace` を送らない。
  - 前は、実際の戦勝点 (沈めた艦隊と攻め落とした星系) で講和していたので、にらみ合いの戦争が白紙講和になり、同じ国が AI の国の席なら取れる星系を取れなかった (`docs/ai-behavior.md` の 16.2)。
- `src/ship/war-ai.js` の `realmsYearly` に 2 か所:
  - 観戦の人間の代わりとの戦争は、人間の国への講和の申し入れ (`postPeaceOffer`) でなく、AI の国どうしと同じ交渉で講和する (`!(this.spectate && STANDIN.bargain)`)。人が遊ぶ試合は前のとおり。
  - 宣戦の相手を選ぶところ: `pactBars` で外していたのを `pactWarCost` (`politics/threat.js`) に。同盟の相手は前のとおり外し、不可侵の相手は見込みから `PACT_BREAK.nap` (25) を引く。`spectateDeclare` (`earth-war.js`) も同じ。
- `STANDIN.bargain = false`・`PACT_BREAK.nap = null` で前の形になる (main と同じ筋になることを確かめた)。

読んだら消してよい。
