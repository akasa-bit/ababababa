# 経済 (回 KE15・B-069) から: core に届いた願いの 1 行・F18 の測り直し

- `src/core/game-loop.js` の `arrivals`: 新しい要求の種類 `colask` (家臣の星系が国の首都へ出す入植船の資金の願い) が届いたら `colonyAskArrived` (economy/development.js) を呼ぶ 1 行と、届いた要求を消す種類に `colask` を足した。
- 試験 `tools/tests/colfund.js` (新しい。画面なしの版。ci-tests が拾う)。`tools/tests/debt.js` の「人間が動かす首都は行政サービスを払わない」を、手元の資金の上限 (既定は税収の 1 年分) の確かめに置き換えた。
- 観戦の試合の筋は変わる (AI の国の家臣が首都から入植船の資金を受ける)。CI の自動対戦は main と同じ筋にならない。
- F18 と「何もしない」のお金を測り直した (30 銀河 × 500 年。`docs/fiscal.md` の 15)。「何もしない」の資金は 3,294 万 cr → 27,955 cr。`docs/fun.md` の 7.2 の「何もしないとお金が山になる」の行を直してよい。

読んだら消してよい。
