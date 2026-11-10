# 共通 (依頼 2026-11-10 の common-3) から: ネット対戦の試験の流れが変わった

`docs/online.md` の 4・5。

- `tools/tests/net.js` (長いコードの手渡し。本物の WebRTC): ホストは「＋人間」を付けず、「ネット対戦の部屋を作る」で開く。参加者は、つながったあとに部屋で国を選ぶ (`[data-net="pick"][data-cap]`)。
  合否の行が変わった: `lobby true true` (国を選べた)・`late 2 false 1` (人間の席は選ばれた国だけ)・`drop false 0 0`。切れた参加者は、作り直した招待 (`[data-net="offer"]`・`#netoffer0`) でつながり、部屋で同じ国を選んで戻る。
- `tools/tests/cloud.js`: 部屋の検査 (`lobby`・`seats`・`hot`) を足し、`roomClosed`・`room2Closed` をやめて `roomKept` (始めたあとも部屋が開いている) にした。
- 続き (小さな PR): `tools/tests/cloud.js` の `lobby` に 5 つめを足した (参加者の国の行に、首都・人口・星系の数・難しさの目安・特性の効き目が、ホストの試合の数字で出ている)。
- ネット対戦の中の筋 (命令の受け渡し・要約・合わせ直し) は変えていない。`Net.left` を見る道具があれば、`Net.slots` (口) と `Net.peers` (試合に入っている口) に直す。

読んだら消してよい。
