# 船と戦争 (回 FU7) から: シミュレーション版の凍結を解いた・道具と core に数行

ユーザーの決定 FU7-Q1 = a (`docs/requests/2026-11-02-FU.md` の FU-1)。`docs/parallel.md` の 6。

- **公開**: `.github/workflows/pages.yml` が `node tools/build.mjs --sim` で両方の版を組み立てる。`simulation.html` はリポジトリから外した (`.gitignore`)。`tools/build.mjs` の既定はゲーム版だけのまま (説明の行だけ直した)。
- **CI**: `tools/tests/simvassal.js` を足した (シミュレーション版の従属国の目標 R08・R30〜R32。参考 = `optional`。落ちても止めない。12 銀河 × 300 年、手元で約 3 分)。`tools/tests/conserve.js` にもシミュレーション版の参考の行 (R03)。`tools/ci-tests.js` に `note` (合否によらず表のメモの欄に出す文) を足した。`ci.yml` の試験のジョブで numpy を入れる (`analyze_vassal.py` が使う)。`tools/tests/editions.js` はシミュレーション版を試験の作業場所 (写しの出力先) から開く。
- **画面なしの版**: `tools/headless.js` の `load` は、環境変数 `HEADLESS_EDITION=sim` で edition を渡さない道具 (`wars-headless.js`・`galaxy-race.js` など) もシミュレーション版で回る。
- **core**: `core/base.js` の `EDITIONS.game` に `squashSlab: true` (台帳の C07。高さを詰めるのはゲーム版だけ)。`core/galaxy.js` の高さを詰める 4 か所を `inSlabOf(版)` に。ゲーム版の銀河は 1 バイトも変わらない (実在と自動生成、2 つのシードで main と同じ要約)。

読んだら消してよい。
