# レーン P (物理) のいまの状態

- 2026-10-20 (`docs/requests/2026-10-20-P.md` の P-1): 物理をフレーバーでなく、測れる物理にした。0.95c の船の代償 (台帳の C09) の 1 本に絞った。中身は `docs/physics.md`。
  - 星間の気体: 近くの星 24 本の視線の H I の柱密度 (Linsky ほか 2019 の表 2) から、航路で前面に当たる核子の平均の数密度を作った (`data/derived/ism.json`)。
  - 遮蔽の線量: Geant4 11.4 で、前 (星間の気体の陽子・ヘリウム) と横 (船の系に直した銀河宇宙線) を測った (`data/derived/shield.json`)。
  - ゲーム: `shieldOf` が 1 便ごとの遮蔽の質量を決め、`bookShip` が推進のエネルギーに入れる。船の太さは遮蔽が一番軽くなる値。
  - 測る道具 `tools/physics.js`、試験 `tools/tests/physics.js` (CI に入れた)、`tools/tests/energy.js` (R07) を遮蔽つきの式に直した。
- **マージしていない** (ユーザーの指示。レーン A・B・C が動いている)。ブランチ `ccr-d03fe6bb-x7nvtx` に push しただけ。PR もまだ作っていない。
- マージの前にすること (`docs/parallel.md` の 3):
  - main を取り込む。2026-10-20 09 時の main (#123 まで) と試しに合わせると、`src/index.html` は自動で合わさり、ぶつかるのは `data/README.md` (両方が末尾に節を足した。両方残す) と `index.html` (`node tools/build.mjs` で作り直す) だけ。
  - `bookShip` に航路の長さ (ly) を渡す所は 4 か所 (入植船・同行する歩兵・艦隊の進路変更・`pushFleet`) と `settlerFlight`。レーン A (艦隊・歩兵) とレーン C (交易・資材) がこの行を変えていたら、ly を渡す形を残す。
  - `node tools/ci-tests.js` を通す (この回の手元では 22 本すべて合格)。自動対戦の表は、取りこんだ main と比べ直す。
  - Geant4 の計算はやり直さなくてよい (`data/derived/g4/` に結果がある。ゲームの式を変えても表は変わらない)。
- 次: `docs/physics.md` の 8 (決めてもらうことと、残りの物理)。
