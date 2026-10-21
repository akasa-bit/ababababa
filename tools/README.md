# 自動対戦の実験台 (tools)

ゲームの仕組みが実際に働いているか、プレイヤーの選び方で結果が変わるかを、数字で確かめるための道具。
ゲーム本体には手を入れず (公開用の `index.html` でも元の `src/index.html` でも動く)、ヘッドレスの Chromium でゲームを開いて、戦略ボットに遊ばせる。

## 必要なもの

- Node.js と Playwright (`npm i playwright`)
- Chromium (Playwright のもの。別の場所の Chromium を使うなら `CHROMIUM=/path/to/chromium`)

## CI (GitHub Actions)

PR ごとに `.github/workflows/ci.yml` が回り、結果の表を PR のコメント (1 つを書き直す) とジョブの要約に出す。

- `node tools/ci-tests.js`: 組み立て → 目標のファイルの固定の確認 → `tools/tests` の試験 (rotate と headless を含む 16 本)。出力から合否を決め (`docs/handoff.md` の 14 と同じ見方)、Markdown の表を出す。1 つでも落ちたら失敗。名前を渡すとその試験だけ (`node tools/ci-tests.js det net`)
- `node tools/ci-report.js <main の src> <PR の src> [銀河の数] [年数] [国の数]`: 画面なしの版で、main と PR を同じシードで回し、入植地・人口・戦争・独立・資金などの平均と 10〜90% を並べる。合否は付けない (釣り合いが知らないうちに動いていないかを見る)
- `node tools/fiscal-panel.js <出力.csv> [銀河の数] [年数] [国の数] [値のファイル.json]`: 画面なしの版で回し、国ごと・年ごとの財政と金融のパネルを、Jordà–Schularick–Taylor と同じ列 (`year, country, gdp, revenue, expenditure, debtgdp, tloans`) で書き出す。`python3 data/build/analyze_fiscal.py <出力.csv>` で、現実と同じ台本で R19〜R22 を出す (`docs/fiscal.md` の 3)
- `node tools/market-panel.js <出力のフォルダ> [銀河の数] [年数] [国の数] [値のファイル.json]`: 画面なしの版で回し、星系ごと・年ごとの値段 (`prices.csv`) と在庫とふだんの消費 (`food.csv`・`goods.csv`) を書き出す。`python3 data/build/analyze_market.py <フォルダ>/prices.csv <フォルダ>/food.csv <フォルダ>/goods.csv` で、現実と同じ台本で R23〜R26 を出す (`docs/market.md` の 2)
- `node tools/sector-panel.js <出力.csv> [銀河の数] [年数] [国の数] [値のファイル.json or -] [開始時の生産性]`: 画面なしの版で回し、星系ごと・年ごとの 1 人あたりの実質の所得 (2011 年の国際ドル) と農業・工業・サービスの就業の割合を書き出す。`python3 data/build/build_sectors.py --game <出力.csv>` で、実データと同じ関数で R10 の合否を出す (`docs/structure.md` の 5)
- `node tools/research-panel.js <出力.csv> [銀河の数] [年数] [国の数] [値のファイル.json]`: 国ごと・年ごとの技術の伸びと研究者の数を書き出す。`python3 data/build/build_ideas.py --game <出力.csv>` で、Bloom ほか 2020 と同じ式で R11 の合否を出す

手元で同じものを回すときは `CHROMIUM=/opt/pw-browsers/chromium node tools/ci-tests.js` (3 分ほど)。

## 画面なしで回せる版 (tools/headless.js)

ブラウザを開かずに、Node だけで試合を回す (6 か国・100 年で約 2 秒)。`src/index.html` の `<script>` をそのまま動かし、画面の部品は何もしない代わりの物で受け流す。

```sh
node tools/headless.js 1 100 6                 # シード 1・100 年・6 か国 → 要約と状態の要約 (hash) を JSON で出す
node tools/headless.js 1 100 6 params.json     # 値のファイルで表を差し替えて回す
```

値のファイルは `{ "表の名前": { "項目": 値 } }` の形 (例: `{ "ED": { "hazardBase": 0.8 }, "TRADE": { "rate": 0.02 } }`)。名前が大文字の表の定数 (と、この版の値 `ED`) だけを書き換えられる。ない項目を書くと止まる。読み込みのときに表から計算してしまう値 (`E_UNIT` など) は変わらない。

ほかの道具からは `const H = require('./headless'); const sim = H.load({ params }); const g = sim.run(sim.newGame('1', { nations: 6 }), 100);` で使う (`g` はゲームの `Game` そのもの。`sim.hash(g)` は状態の要約、`sim.tables` は表)。

## 使い方

```sh
# 5つの戦略 × 8つの銀河 × 500年 (1回あたり数秒〜十数秒)
node tools/bots.js "$PWD/index.html" out 500 1,2,3,4,5,6,7,8 passive,peaceful,warlike,loyalist,expansion
# 集計 (JSON で出る)
node tools/analyze.js out > summary.json
```

## 戦略ボット

| 名前 | 中身 |
|---|---|
| `none` | 何もしない (自動化もすべてオフ) |
| `passive` | 放任: 観戦モードの地球政府の AI に任せる (自動化はすべてオン) |
| `peaceful` | 内政: 宣戦しない。交戦中なら講和を申し入れ続ける。威圧なし |
| `warlike` | 戦争好き: 自分より 1.5 倍以上弱い独立国に宣戦する (AI は 5 倍) |
| `loyalist` | 懐柔: 忠誠度 50 未満の直属の従属星系へ毎年資金援助 (資金に余裕があるとき) |
| `expansion` | 拡張: 地球政府の入植の間隔 (5年) をなくす |
| `mandexpand` | 拡張に振る: 国家方針をいつも拡張期にし、地球の国の星系の委任方針をすべて「拡張」にする |
| `manddevelop` | 内政に振る: 国家方針をいつも整備期にし、委任方針をすべて「内政」にする |
| `neglect` | 放置: 放任と同じだが、政治に手を出さない (国家方針・視察・要求への返事・出来事への返事をしない) |

乱数はシードと戦略から決まる (同じ引数なら同じ結果になる)。ボットは観戦モードの AI を使うので、地球は光の遅れなしに判断する。
観戦モードの AI は政治も自分で決める: 国家方針、要求への返事 (のむか威圧)、語り手の出来事への返事 (払えるなら最初の選択肢)、
放っておかれて30年を過ぎた直属の家臣への視察団 (年1か所まで)。

## 記録するもの

- 10年ごと: 星系の数・地球の国の星系の数・国の数・人口・資金・従属星系の忠誠度/恐怖度/友好度・戦争・艦隊・威圧
- 仕組みの発火回数: 独立・開戦・降伏・講和・艦隊戦・入植船・交易路・支援・資金援助・指令の拒否・施設の拡張・先住民との戦争など
- 年ごとの重要な出来事 (静かな年の割合を出すため)
- 独立したときの忠誠度・恐怖度・友好度・太陽系からの距離
- 政治: 不満の始まり・要求 (地球へ / 他の主人へ)・要求をのんだ・拒んだ・収まった・決めることへの返事と期限切れ・国家方針・視察団・語り手の出来事の種類ごとの回数、
  10年ごとの政治力・議会の支持・不満を抱える家臣・最後通牒・果たした時代の課題・点数、終わりの時点の挑戦の達成

## 戦争の自動対戦 (国家選択のある試合)

```sh
# 3 つの講和の方針 × 8 つの銀河 × 400 年 (6 か国。1 回あたり 40〜60 秒)
node tools/wars.js "$PWD/index.html" wout 400 1,2,3,4,5,6,7,8 normal,hawk,dove 6
node tools/wars-analyze.js wout > wars-summary.json

# 画面なしの版で、戦争の多さ・長さ (平均 ÷ 中央値 = R13)・終わり方 (R14) を数える。2 つめに比べる元の src を渡すと並べる (12 銀河 × 300 年で 1 つ 3 分ほど)
node tools/wars-headless.js src/index.html <main の src> 12 300 6
```

プレイヤーの国 (くじで決まった最初の異星の国) も観戦の AI に任せ、講和の判断だけを方針で差し替える。

| 方針 | 中身 |
|---|---|
| `normal` | 観戦の AI のまま (戦争疲弊 60 を超えるか、相手より 3 割以上弱ければ講和を求める。疲弊 40 超か戦勝点 10 超なら申し入れに応じる) |
| `hawk` | タカ派: 戦争疲弊 90 まで講和を求めない。戦勝点 30 未満の申し入れは断る |
| `dove` | ハト派: 戦争疲弊 30 で講和を求め、申し入れにはすぐ応じる |

記録するもの: 戦争ごとの始まりと終わり・終わり方 (白紙講和・講和条約・全面降伏・首都の陥落)・長さ・沈んだ艦隊・攻め落とした星系・終わったときの戦争疲弊、
国ごとの戦っていた年数、25 年ごとのプレイヤーの国の星系数・人口・資金・戦争疲弊。
集計は、終わり方の内訳・長さの平均と中央値・終わり方ごとの長さの中央値・戦闘のなかった戦争の割合・方針ごとのプレイヤーの国の結果。

## 離反の自動対戦 (統治体制と独立)

```sh
# 6 つの銀河 × 300 年 (6 か国。1 回あたり 20〜40 秒)
node tools/secession.js "$PWD/index.html" sout 300 1,2,3,4,5,6 6
```

プレイヤーの国も観戦の AI に任せ、主従の結びつき (家臣の星系 → 主人) ごとに、始まった年・統治体制・首都と主人からの距離・不満が始まった回数・終わった年と終わり方
(独立・別の国へ移った・入植地がなくなった・試合の終わりまで続いた) を、銀河ごとに `sout/<シード>.json` へ書き出す。
生存時間の分析 (Kaplan–Meier・Cox モデル) で、歴史の植民地の独立までの時間 (目標 R08・R09) と同じ形式で比べるための材料。結果は `docs/governance.md`。

## 公開用 index.html の組み立て

```sh
cd tools && npm ci && cd ..
node tools/build.mjs   # src/index.html → index.html (最小化 + LZMA + 自己展開)
```

## 惑星の頻度 (η⊕)

```sh
node tools/eta.js "$PWD/index.html" 0.5 2   # FGK 型・M 型の主星あたりの、ハビタブルゾーンの 0.5〜1.5 地球半径の惑星 (銀河の版 2)
node tools/eta.js "$PWD/index.html" 1.0 2   # M 型の目標 R06 は 1〜1.5 地球半径
```

## 交易と距離 (目標 R01)

```sh
NAT=6 node tools/gravity.js 30 300 4 gravity.csv   # 30 の銀河 × 300 年の取引を、実データと同じ形の CSV に書き出す (約 15 分)
python3 tools/gravity-analyze.py gravity.csv      # 実データと同じ data/build/gravity.py で推定し、合否を出す
```

`KIND=t` で交易だけ、`KIND=b` で建設の資材だけ。`TW='TRADE.rate=0.03'` のように、試合の前に値を変えられる。結果の読み方は `docs/trade.md`。

## 試験 (tools/tests)

シミュレーション版 (`simulation.html`) は凍結中で組み立て直さないので、`HTML=$PWD/simulation.html` の行は凍結した版を試すだけです (ゲーム版の変更は入りません)。

機能が壊れていないかを確かめる試験です。どれも Playwright で公開用の HTML を開いて動かします。画面の写しは、いまのフォルダの `shots/` に書きます。

```sh
cd tools && npm ci && cd ..
node tools/build.mjs
export CHROMIUM=/opt/pw-browsers/chromium   # Chromium の場所 (必要なら)
node tools/tests/det.js 3 120                                   # 決定性 (ゲーム版)
HTML=$PWD/simulation.html NAT=1 node tools/tests/det.js 7 120   # 決定性 (シミュレーション版・国家選択あり)
for t in hot treaty edit lib home real net; do node tools/tests/$t.js; done
node tools/tests/cloud.js shots                                 # アカウントとクラウド (偽の Firebase)
for t in pick regime editions; do node tools/tests/$t.js shots; done
node tools/tests/energy.js 5 150                                # 船のエネルギーの記帳 (目標 R07)
HTML=$PWD/simulation.html NAT=1 node tools/tests/energy.js 7 150
node tools/tests/conserve.js 5 150                              # 物質とエネルギーの保存 (目標 R03)
node tools/tests/money.js 5 150                                 # お金の保存 (画面なしの版。6 か国なら 3 つめに 6)
node tools/tests/headless.js 100 1,4,9                          # 画面なしの版がブラウザと一致する
HTML=$PWD/simulation.html NAT=1 node tools/tests/conserve.js 7 150
```

| 試験 | 確かめること |
|---|---|
| `det.js` | 同じシードなら同じ結果・保存→読込→保存が一致・読込後も同じ結果に進む |
| `hot.js` | ホットシートの交代・自動の交代・他国の艦隊への命令の拒否・保存と読込 |
| `net.js` | ネット対戦の命令の受け渡し・状態の要約の一致・壊したときの合わせ直し |
| `treaty.js` | 戦争疲弊・講和の申し入れ・講和会議・条約 |
| `edit.js`・`lib.js` | 国家の編集と保管庫 |
| `home.js`・`pick.js` | ホーム画面と国家選択 (横と縦の画面) |
| `real.js` | 実在の 3 次元の銀河・回す・傾ける |
| `regime.js` | 統治体制の切り替え・自治領・強制労働の後遺症・既定の体制・保存と読込 |
| `rotate.js` | 回したあとの絵が、描き直した絵と一致する |
| `editions.js` | 2 つの版が開き、保存の名前が分かれている |
| `conserve.js` | 1 年ごとに、星系ごと・資源ごとの記帳した出入りと備蓄の増加・運ぶ途中の物・工業の質量・政府ごとのエネルギーが釣り合う (誤差 ÷ 取扱量が 1e-9 以下、目標 R03)。決まっていない出入りがない |
| `cloud.js` | アカウントとクラウド (偽の Firebase で): ゲストのログイン・名前・クラウドのセーブ・自作の国・部屋のコードでのネット対戦 |
| `headless.js` | 画面なしの版で回した状態の要約が、公開用の index.html をブラウザで回したものと一致する (国家選択なし・6 か国)。値のファイルが効き、ない項目を拒む |
| `fiscal.js` | 財政 (税・利子率・予算): 命令と政治力、選べない値を拒む、光速で広がる、税収・利子・予算の記帳、忠誠度・離反の起きやすさ・艦隊の戦力への効き目、保存と読み込み、画面 (横と縦) ([docs/fiscal.md](../docs/fiscal.md)) |
| `market.js` | 市場 (段 5): 値段が決まった幅に入る、在庫が少ないほど高い、就業の割合の合計が 1 でどの部門もほぼ 1% 以上、方針の命令を断る、保存と読み込みで値段と就業が変わらない、開始時の生産性の倍率が産出に効いて保存に残る ([docs/market.md](../docs/market.md)・[docs/productivity.md](../docs/productivity.md)) |
| `money.js` | 1 年ごとに、お金の総額 (政府・民間・先住民・運ぶ途中 − 銀行の貸出) が変わらない、帳簿ごとの記帳した出入りと額の増加が一致する、出入りの種類ごとに帳簿の合計が 0 (誤差 ÷ 取扱量が 1e-9 以下)。決まっていない出入りがなく、手持ちと借りがマイナスにならない ([docs/money.md](../docs/money.md)) |
| `energy.js` | 船 1 便ごとに記帳した推進のエネルギーが、試験の中で計算し直した式と 1 ± 1e-6 で一致する (目標 R07)。太陽系の発電と収支も出す |

各試験は結果を表示します。`[]` で終わる行は、ページの誤りがなかったことを表します。
