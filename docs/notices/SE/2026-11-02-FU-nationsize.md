# 船と戦争 (回 FU7) から: 国の開始の大きさの指数の既定を 1 に

`politics/nations.js` の `nationSizeOf`: `ED.nationSize ?? 0` → `?? 1`。値がないシミュレーション版が、補正 (台帳の C21) の 0 を読んで「どの国も 1」になっていたため (`docs/reality-check.md` の 5)。ゲーム版は `EDITIONS.game.nationSize: 0` を書いてあるので変わらない (試験 `nations` 合格)。シミュレーション版は 1820 年の国の人口の散らばりのまま (0.09〜6.25)。

あわせて: シミュレーション版の従属国の目標 (R08・R30〜R32) を CI の参考の行 `simvassal` に出した。数は `docs/reality-check.md` の 6。SE13 (ゲーム版の数値の練り直し) ではシミュレーション版の値は変えない。

読んだら消してよい。
