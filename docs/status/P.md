# レーン P (物理) のいまの状態

- 2026-10-20 (`docs/requests/2026-10-20-P.md` の P-1・P-2): 物理をフレーバーでなく、測れる物理にして、**シミュレーション版にだけ**入れた (`EDITIONS.<版>.physics`)。中身は `docs/physics.md`。
  - 星間の気体と銀河宇宙線の遮蔽 (Geant4)・加速にかかる時間 (P1)・M 型星のフレアと惑星の地表の被曝 (TESS の光度曲線から自分で数えた)。
  - P2 (回折) と P3 (乗る人の限度 0.6 Sv) は今のまま。
  - ゲーム版は物理なしで、main と同じ試合 (3 つの銀河で 150 年まで確かめた)。
  - ほかのレーンには「シミュレーション版は一旦無視する」と書いた (`docs/parallel.md` の 6・`docs/session-start.md` の 3)。CI の「シミュレーション版・参考」の行は落ちても CI を止めない。
- シミュレーション版 (`simulation.html`) は `node tools/build.mjs --sim` で、この回に組み立て直した。
- 計算をやり直すとき:
  - Geant4: `data/build/g4_all.sh` (4 コアで 3 時間ほど)。結果は `data/derived/g4/`。
  - TESS: `data/fetch/fetch_tess.py <置き場>` (約 290 MB) → `data/build/flares_tess.py <置き場>` → `data/build/build_flares.py`。
- 次 (`docs/physics.md` の 9): P6 ゲーム版にも物理を入れるか、P7 フレアをスウォームの太陽電池の劣化に効かせるか。
