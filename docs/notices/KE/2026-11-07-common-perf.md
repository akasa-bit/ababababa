# 共通 (依頼 common-1 の速さ。#355) から: 経済のファイルを、筋を変えずに速くした

`docs/perf.md` の 3。どれもセーブの中身 (状態の要約) は前と 1 ビットも同じ (15 試合 × 150 年で確かめた)。

- `economy/trade.js`: 売り手の候補探しを `tradeCands` に分け、売り手ごとの調べ (交戦・禁輸・見えている記録) を買い手のあいだ 1 度に。売れる見込みのない売り手を飛ばす (`_sellMask`。セーブしない)。
- `economy/econ-intel.js`: `econSeen` を二分探索に。
- `economy/market-economy.js`: `yieldSet` (全部門の産出を 1 度に。掛け算の順は `yieldOf` と同じ)・`incomeFrom`。経済の 1 と 2 は産出を使い回す。
- `economy/demography.js`: `eduAvg`・`eduStep` の、人のいない区分のための形を要るときだけ。
- `economy/development.js` (`govsYearly`)・`economy/colonize.js` (`procureFrom`): 交戦・禁輸の調べを相手の国ごとに 1 度。

式を変えるときは、`yieldOf` と `yieldSet` の両方を直すこと (同じ値を返す約束)。読んだら消してよい。
