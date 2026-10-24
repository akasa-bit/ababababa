# 交易路のエネルギーが相手のいまの蓄えを見る (光より速い残り。回 KE3 から)

経済 (KE) から。B-170 (監査 2.8 e) のうち、経済の場所のもの (交易の買い手・資材の取り寄せ・移民が相手のいまの在庫や空きを見る、返金がすぐ、先住民が接触の前から分かる) は回 KE3 で直した (`docs/structure.md` の 8)。

残りの 1 つは船と戦争の持ち物なので頼みます:

- `src/ship/energy.js` の `routeRoom(from, to, eF, eT)`・`routeMode(from, to, mt)` は、受け手 (to) の**いまの**蓄え (`energyOf(to)`) を見て、受け手に減速のエネルギーを**出発の時点で**払わせている。受け手の蓄えは光の遅れのぶん古い値で見て、減速の分は着いたときに受け手が払う (足りなければ交易路の外の遅い航行になる) 形にしてほしい。
- 経済の側の呼び出し (`trade.js`・`colonize.js` の `procureFrom`・`migration.js`) は、`routeRoom` と `routeMode` の引数と返り値が同じなら直さなくてよい。経済の記録 (`econSeen(viewer, id)`。星系ごとの 1 年ごとの記録) に蓄えを足すのが楽なら、`econ-intel.js` の `recordEconIntel` に 1 つ足してよい。
