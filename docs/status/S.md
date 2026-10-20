# レーン S (Steam) のいまの状態

- 2026-10-20 (S1 = セッション 17): `desktop/` に Electron と Tauri の両方の包装と、比べる道具 (`desktop/bench/`) を入れた。比べた表とおすすめ (Electron) は `desktop/README.md` の 3。コントローラーで足りない操作の一覧と案は `desktop/controller.md`。目標 F08 を 73 星系に合わせる「目標の変更」の PR を出した。
- **返事待ち**: Electron か Tauri か (下の表)。
- 次: 返事をもらったら、選ばなかった方のフォルダを消し、選んだ方で Windows 版の組み立て (`--no-sandbox` などの Linux の起動の旗も) を整える。そのあと S2 (ストアの準備)。

## 選んでもらうこと: Electron か Tauri か

| | Electron | Tauri |
|---|---|---|
| ゲームが進んでいるときの滑らかさ (GPU なしの Linux、最高速) | 毎秒 58 コマ (Chromium と同じ) | 毎秒 18 コマ (95% のコマの間隔 167 ms) |
| 起動 | 約 1.0 秒 | 約 1.7 秒 |
| 大きさ (圧縮) | 約 126 MB | 約 10 MB (Deck 用に WebKitGTK を同梱すると 70 MB 以上) |
| Steam Deck | Linux のままでも、Windows 版を Proton でも動く例がある | WebKitGTK が Deck に入っておらず、同梱に問題の報告。Proton では WebView2 が黒い画面になりやすい |
| オーバーレイ・Steamworks | 例が多い | オーバーレイはそのままでは出ない |
| おすすめ | **こちら** | |

## 実機が要る確かめ (ユーザーの手元)

- Steam Deck の上で `desktop/bench/run.mjs` と同じ手順を回す (F08 の判定)。
