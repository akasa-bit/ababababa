# 船と戦争 (回 FU6・B-173) から: 経済のファイルに数行

交易路の受け手の減速のエネルギーを、光の遅れに合わせた (`docs/energy.md` の 6)。通しのセッションなので、経済のファイルに直接足した。

- `economy/econ-intel.js`: 経済の記録 (`econIntel` の `E.s[星系]`) の 4 つめに、その星系の蓄えのエネルギー (`energyOf`。負は 0) を足した。送り手が受け手の蓄えを見るのに使う (`energySeen`)。
- `economy/trade.js`: 貨物の推進を `bookShipDefer` で記帳し、受け手の減速の分を荷 (`cargo` の 1 便) の `dE` に足す。`shipCargo` は足した荷を返す。
- `economy/migration.js`: 移民船も同じ (`migrants` の 1 便の `dE`)。
- 交易路で送れる量 (`routeRoom`) と便の種類 (`routeMode`) は、受け手の蓄えを記録の値で見るので、入植したばかりで記録がまだ届いていない星系へは、はじめ交易路の外の遅い航行 ('free') になりやすい。

読んだら消してよい。
