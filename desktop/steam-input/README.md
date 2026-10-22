# Steam Input の既定の設定 (B-085。回 SO2)

ゲームはコントローラーに対応していない (キーボードとマウスだけ)。Steam Deck とほかのコントローラーで遊べるよう、Steam Input がボタンをキーとマウスに置き換える**既定の設定**を作った (`desktop/controller.md` の 2 の案 A)。Valve は、コントローラーに対応しないゲームに、キーボードとマウスに割り当てた設定を公式の既定として出すことをすすめている (Steam Deck の Verified の条件)。

| ファイル | 中身 |
|---|---|
| [make.mjs](make.mjs) | 割り当ての表 (`GROUPS`) と、ゲームが受けるキーの一覧 (`GAME_KEYS`)。ここから VDF を書く。`--check` で、ファイルが表と同じか・ゲームが受けないキーを割り当てていないかを見る (CI の「包装」) |
| [controller_neptune.vdf](controller_neptune.vdf) | Steam Deck (`controller_neptune`) 用の設定。手で直さず、`node desktop/steam-input/make.mjs` で書き直す |

## 1. 割り当て

| Steam Deck | キー・マウス | ゲームでの働き |
|---|---|---|
| 右トラックパッド | マウスの移動 (押し込みで左クリック) | カーソル |
| R2 | 左クリック | 選ぶ。押したままトラックパッドを動かすと地図が動く |
| L2 | 右クリック | 艦隊を動かす (押したまま動かすと経由地) |
| 左スティック 上・下 | ホイール 上・下 | 拡大・縮小 |
| 十字キー 上・下 | R・F | 地図を傾ける・起こす |
| 十字キー 左・右、L1・R1 | Z・X | 地図を回す |
| A | Space | 止める・動かす |
| B | Esc | 選択を外す・星間マップへ |
| X | S | 星系マップ |
| Y | G | 星間マップ |
| メニュー (≡) | E | 帝国 |
| ビュー (⧉) | Esc | 戻る |
| L4 (背面) | 左 Shift | 押したまま R2 でドラッグすると、艦隊を範囲で選ぶ |
| R4 (背面) | Delete | 艦隊の指名を取り消す |
| 右スティック・左トラックパッド・ジャイロ | なし | — |

- 地図を動かすキーはゲームにないので、左スティックで地図を動かすことはできない。動かすのは R2 を押したままの右トラックパッド。スティックで動かすには、ゲームの中でゲームパッドに対応する (案 B。B-061。画面と最初の体験のレーン)。
- 速さ (1〜7 キー) は画面のボタンをタッチかカーソルで押す。
- 文字の入力 (銀河の番号・部屋のコード) は、Steam のキーボード (Steam ボタン + X) で。画面のキーボードを自動で出すのは案 C (Steamworks をつないでから。B-083)。

## 2. 書き方の出どころと、まだ確かめていないこと

- 形 (`controller_mappings` の `group`・`mode`・`inputs`・`activators` → `Full_Press` → `bindings`、`preset` の `group_source_bindings`) は、Valve の例 `ExampleLocalizedConfiguration.vdf` (https://partner.steamgames.com/doc/features/steam_controller/steam_input_gamepad_emulation_bestpractices からリンク。2026-10-22 に確かめた) と同じにした。**モードは、その例に出てくるもの (`four_buttons`・`dpad`・`trigger`・`absolute_mouse`・`switches`) だけを使った**。トラックパッドをスクロールホイールにするモードなどは、書き方を公式の文書で確かめられなかったので使っていない。
- キーとマウスの書き方 (`key_press SPACE`・`mouse_button LEFT`・`mouse_wheel SCROLL_UP`) は、Steam のクライアントが書き出す設定の形。公式の例はゲームパッドのボタン (`xinput_button`) だけなので、**Steam のクライアントで読み込めるかは、まだ確かめていない**。
- だから、出す前にかならず、Steam のクライアント (Steam Deck の実機) の設定画面でこのファイルを読み込み、割り当てが上の表のとおりに見えるかを確かめ、その画面から書き出し直す (Steam が自分の形で書き直す)。書き出し直したファイルの置き場所は、上の Valve の文書のとおり、Steam のログ (`controller_ui.txt`) に出る `userdata\[STEAMID]\config\controller_configs\apps\[APPID]\…\controller_configuration.vdf`。違いがあれば、`make.mjs` の表を直す。

## 3. Steamworks に出す手順 (ユーザーがすること。`docs/decisions.md` の QD-72)

Steamworks のアカウントができてから (QD-21)。

1. Steam Deck の実機で、上の 2 の確かめをする (読み込む・書き出し直す)。
2. Steamworks の「Steam Input」の設定で、既定の設定を選ぶ。コントローラーに対応しないゲームなので、Valve のすすめに従い、キーボードとマウスに割り当てたこの設定を、公式の既定にする (Steam のクライアントの設定画面から公式の設定として出すか、Steamworks の「Steam Input Template」の欄で「Custom Configuration (Bundled with Game)」を選び、ゲームのフォルダの中の設定のファイルを指す。どちらが使えるかは、アカウントができたときに Steamworks の画面で確かめる)。
3. ほかのコントローラー (Xbox・PlayStation・Switch Pro) は、Steam が Deck の設定から変換できる (Valve の文書: 「Configurations can be auto-converted between most controller types」)。気になる所があれば、コントローラーごとに直す。
4. Steam Deck の Verified の確かめに出す (`store/steamworks.md` の 7)。
