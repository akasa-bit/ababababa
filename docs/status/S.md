# レーン S (Steam) のいまの状態

- 2026-10-20 (S1 = セッション 17): `desktop/` に Electron と Tauri の両方の包装と、比べる道具 (`desktop/bench/`) を入れた (#136)。比べた表は `desktop/README.md` の 3。コントローラーで足りない操作の一覧と案は `desktop/controller.md`。目標 F08 を 73 星系に合わせる「目標の変更」の PR を出した (#137)。
- 2026-10-20: ユーザーが **Electron** に決めた (`docs/requests/2026-10-20-S.md` の S-3)。Tauri の試作を消し、Electron で Windows 版と Linux 版を組み立てる命令 (`npm run package:win`・`package:linux`) と、Steam の起動の設定 (Linux は `--no-sandbox`) を書いた。
- 2026-10-20 (S2): `store/` に、ストアのページの下書き (日本語)・画像の案・Steamworks に出すまでの手順と待ち時間を入れた (決まりは公式の文書で確かめた)。
- **返事待ち**: スクリーンショットの大きさ・カプセルの絵の作り方 (`store/images.md` の 4)。値段 (`store/steamworks.md` の 5)。
- 次: ユーザーが Steamworks のアカウントと書類を進める (`store/steamworks.md` の 9)。そのあいだに、スクリーンショットを撮るためのセーブを作り、カプセルの案を作る。英語と中国語のストアの文はセッション 18 のあと。

## 残っていること (S1 の分)

- Windows 版を Windows の上で動かして確かめる (組み立てられることまでは確かめた)。実機か、CI に Windows を足すとき (レーン B と相談)。
- Steam Deck の実機で `desktop/bench/run.mjs` と同じ手順を回す (F08 の判定。ユーザーの手元)。
- 字体の同梱 (いまは Google Fonts をネットから読む。オフラインの Deck では別の字体になる)。包装の側で差し替えるか、ゲームの中で同梱するかを決める。
- Steamworks (`steamworks-ffi-node` か `steamworks.js`)・オーバーレイ (`--in-process-gpu`)・画面のキーボード・Steam Cloud は、Steamworks のアカウントができてから (S2 の手順の一覧のあと)。
- コントローラーの案 B (ゲームの中でゲームパッドに対応) は `src/` に触るので、レーン E かセッション 18 の前後に回す (`desktop/controller.md` の 2)。
