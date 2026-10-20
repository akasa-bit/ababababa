# レーン C (経済) のいまの状態

- いま: まだ始めていない。
- 止めている作業: 財政の差分 `docs/wip/C-fiscal.patch` (セッション 7 で使う。中身と残りは下。`docs/handoff.md` の 5-3 から移した)。
  - **財政 (税・利子率・予算)**: ユーザーの依頼 (requests-log の 121) で作っていたが、地図と Firebase を先にするよう言われて止めた。差分は `docs/wip/C-fiscal.patch` (2026-10-20 に、DMath (#109) のあとの main に当たるよう作り直した。`Math.exp`・`**` の所は `GM.exp`・`GM.pow`。試験 `fiscal.js` は `ok: true`)。
    - 中身: `TAX_LEVELS`・`RATES`・`BUDGET`・`fiscalFor`・`setFiscal`・`budgetStep`・`fleetMul`・帝国 → 目標の「財政」の欄・試験 `tools/tests/fiscal.js`
    - 済んだこと: 試験 `fiscal.js` と det は通った。
    - 残り: ほかの試験を一通り回すこと、`docs/fiscal.md`・README・reality-check を書くこと、効き目の大きさ (仮の値) を G の表に載せること。
    - ふだんの扱い: 既定 (標準の税・年 1%・予算 0) でも、政府の貯えに年 1% の利子がつく。6 銀河 × 150 年で入植した星系がほぼ変わらないことは測った。
    - A の監査の B (お金の保存) と合わせて作り直すかどうかを、ユーザーに聞いてから再開する。
- 次: セッション 6 (段 4 のお金の保存)。
