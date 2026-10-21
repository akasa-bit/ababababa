# 5. 市場の数字 (Steam で 1 位を狙うための生データ)

集めた日: 2026-10-20。Valve の公式の文書・Steam の公式の API・分析家 (GameDiscoverCo・How To Market A Game) の記事を、その日に開いて確かめた値です。印の意味は下の「凡例」のとおりで、〔S〕の印の値は、ページの本文を確かめられていない (要確認) ものです。

## この計画にとっての意味 (先に)

| # | 事実 | 計画にとっての意味 |
|---|---|---|
| 1 | Steam の「売上上位」は**売上の額**で決まる (本数ではない)。全世界の週の 1 位は、基本無料の大作 (2026-10-13〜20 は PUBG) が占める | 全世界の 1 位 (L4) は、基本無料の大作の課金を上回る週にしか取れない。[04-plan.md](04-plan.md) の 1 で L2・L3 を確実な目標にした理由 |
| 2 | 発売 4 日で 100 万本売れた日本のインディー (Meccha Chameleon、約 6 ドル) でも全世界 2 位。**日本と韓国では 1 位** | 日本の売上 1 位 (L3) は、話題になればインディーでも取れる |
| 3 | Steam の利用者の言語: 英語 34.2%・**簡体中国語 31.4%**・ロシア語 9.1%・**日本語 2.4%** (2026 年 9 月) | 日本語だけだと、届く市場は 2〜3%。英語と簡体中国語で、届く市場は約 25 倍 |
| 4 | 西洋の戦略ゲームのレビューのうち、中国語は Stellaris 24%・Victoria 3 21%・Civ VII 13%。日本語は 1% 未満 | 戦略ゲームを買う人の大きな塊は中国語圏。ただし中国語のレビューは評価が厳しい (Manor Lords は中国語 53% / 全体 85%) |
| 5 | 2026 年 6 月の Steam のストアの作り直しで、「近日発売の人気」に載るのに要るウィッシュリストが**約 7,000 → 約 10 万**に上がった (分析家の推定)。代わりに「Personal Calendar」(発売の 2 か月前から) が大きな入口になった | 発売前のウィッシュリストの目標を、近日発売の人気ではなく Personal Calendar の段 (上位 100 で約 8,000〜60,000) で立てる |
| 6 | 発売の週の売上は、発売時のウィッシュリストの**約 0.15 倍** (10 ドルを超えるゲームは 0.10 倍)。売れ方が弱かったゲームは、発売 7 日のレビューの中央値が 67%、上位 20 本は 91% | ウィッシュリストと、最初の 1 週間のレビューの両方が要る。フェーズ 0 (最初の 2 時間) がレビューを決める |
| 7 | 宇宙の戦略の同時接続のピーク: Stellaris 約 6.9 万・Sins of a Solar Empire II 約 1.3 万・**Terra Invicta 約 9,800**・Distant Worlds 2 約 5,000 | このゲームにいちばん近い Terra Invicta が、現実的な比べ先。Stellaris 級は大きな当たり |
| 8 | Terra Invicta の全期間のピークは、早期アクセスの開始の月。1.0 では越えられていない。早期アクセスを出たゲームの 1.0 の最初の 30 日の売上は、早期アクセスの最初の 30 日の約 40% (中央値) | 早期アクセスで出すなら、**最初の日がいちばんの山**になる。早期アクセスでも、フェーズ 0〜1 を済ませてから出す |
| 9 | 25〜40 ドルの戦略ゲーム (Against the Storm 95%・Songs of Syx 94%・Workers & Resources 91%・Manor Lords 85%) は、50〜70 ドルの新作 (EU5 66%・Civ VII 49%・Cities: Skylines II 57%) より好評の割合が高い (観察で、因果ではない) | 値段は 25〜40 ドル (日本円で 2,800〜3,980 円) の帯が、似たインディーの戦略ゲームの相場 |
| 10 | Next Fest でデモを遊んだ人のうち、ウィッシュリストに入れるのは中央値 19.3%。Next Fest で増えるウィッシュリストは、開く前の数にほぼ比例する | Next Fest の前に、ストアのページでウィッシュリストを貯めておく |
| 11 | ストアの表示に効くのは「買って遊ばれること・**対応言語**・タグ」。ストアのページの訪問数は効かない (Valve の文書) | 翻訳はそれ自体が「見つけてもらう」ための仕組み |
| 12 | 日本製の戦略ゲームのインディーが、全世界の売上上位に入った例は、今回の調べでは見つからなかった (日本発の世界の当たりは Palworld・8 番出口・Meccha Chameleon で、どれも戦略ではない) | このゲームが入れば、それ自体が話題になる。逆に言えば前例のない挑戦 |
| 13 | Steam Deck の「Verified」の基準: 1280×800 で最小の文字が 9px 以上 (推奨 12px)、既定のコントローラー設定ですべての機能に届くこと | いまのフォントの大きさとコントローラー未対応 (`desktop/controller.md`) を直す根拠 |
| 14 | 返金は「買って 14 日以内・遊んだのが 2 時間未満」。早期アクセスの時間も数える。Playtest の時間は数えない | 最初の 2 時間で引き止める (フェーズ 0)。Playtest は返金を気にせず試せる |
| 15 | 戦略のタグの「売上の中央値」は小さい (大戦略 約 1.5 万ドル・4X 約 5 万ドル。第三者の推定) | 平均的な戦略ゲームは売れない。1 位を狙うのは、分布の端を狙うこと |

以下は調査役がまとめた生データそのものです (書き直していません)。

---


- 取得日: **2026-10-20**（このセッションで WebSearch / WebFetch した内容のみ）
- 対象: 日本発・日本語ファースト・Electron 製のリアル志向宇宙グランドストラテジー（光速遅延命令、臣従政治、実在近傍恒星、データ駆動経済）
- 凡例
  - 【一次】Valve / Steamworks 公式文書、Steam 公式ページ、Steam 公式 API を直接取得したもの
  - 【API】Steam 公式 API（`appreviews` / `appdetails`）から 2026-10-20 に直接取得した生値
  - 【分析】GameDiscoverCo、How To Market A Game などアナリストの一次記事を WebFetch で確認したもの
  - 【二次】報道・Wikipedia（出典 URL は Wikipedia が挙げているもの）
  - 【推定】第三者の推計値、または著者自身が推定と明言しているもの
  - 〔S〕ページ本文は取得できておらず、WebSearch の結果要約にしか出てこない数値。**要確認**
  - 【算出】取得した生値から本ファイルで計算した値（計算式つき）
- 制約: このターンの WebSearch 上限（200 回、エージェント間で共有）に途中で達した。以降は既知 URL の WebFetch と Steam 公式 API だけで収集している。SteamDB は WebFetch に 403 を返すため、同時接続数（CCU）は SteamCharts（steamcharts.com）の月次値と、SteamDB を引用した報道で代替した。SteamCharts は取得漏れの月がある（例: Frostpunk 2 の 2024 年 9 月）。

---

## 1. Steam のランキングと可視性の仕組み（一次ソース中心）

### 1.1 Top Sellers（売上ランキング）
- **ランキングは「売上金額」ベースで、本数ではない。** 「Top Sellers lists are generated automatically based on all revenue sources for a game」。ゲーム内課金、DLC、本体購入は「all contribute equally」。【一次】https://partner.steamgames.com/doc/store/top_sellers （2026-10-20 取得）
- **リアルタイム版**は直前 24 時間の支出合計を使い、「add extra weight to spending in the last 3 hours」。同じゲームの複数エディションは合算される。DLC の売上も本体の順位に加算される。【一次】同上
- **国別と世界**: 「for a set of most popular countries on Steam, we generate country-specific top sellers lists as a default」。ストアのフロントページは既定で地域別に表示される。【一次】同上
- **週間版（Weekly Top Sellers）**: ページの説明は「Top 100 products by revenue published Tuesday 1AM, Pacific Time」。2026-10-13〜10-20 週の世界版は以下のとおり。【一次】https://store.steampowered.com/charts/topsellers/global （2026-10-20 取得）
  - 1位 PUBG: BATTLEGROUNDS（F2P）、2位 Call of Duty: Modern Warfare 4（予約 $69.99）、3位 Dota 2（F2P）、4位 AION 2（F2P）、5位 Counter-Strike 2（F2P）、6位 Planet Zoo 2（$49.99）、9位 Enshrouded、13位 Steam Deck（ハード本体 $789）
  - **含意（事実の整理）**: 世界週間 1 位を取るには、F2P 大作の週間課金収入を上回る必要がある。Steam ハード本体も同じチャートに並ぶ。
- **1位の難しさの基準点**: $6 前後の日本製インディー *Meccha Chameleon* は発売 4 日で 100 万本を超えたが、最高順位は**世界 2 位**だった（韓国では 1 位）。【二次】Inven Global, 2026-06-15 https://www.invenglobal.com/articles/22805/Meccha-chameleon-the-hide-and-seek-game-streamers-love-hits-no-1-in-steam-sales 。日本の売上チャートでは初登場 1 位。【二次】https://en.wikipedia.org/wiki/Meccha_Chameleon
- **年間 Best of**: 総売上で Platinum / Gold / Silver / Bronze の階層に分け、階層内の並びは無作為。新作部門は発売後 2 週間の売上だけを数える。〔S〕https://www.neowin.net/news/valve-reveals-what-games-made-the-most-money-on-steam-in-2024/
- **有料で順位や露出は買えない**: Steamworks の可視性 FAQ は「Nope」と回答している。【一次】https://partner.steamgames.com/doc/marketing/visibility

### 1.2 Most Played（同時接続数）
- Steam Charts の「MOST PLAYED RIGHT NOW」は、ゲーム内のプレイヤー数で上位 100 本を並べる。ライブチャートには Top Sellers、Most Played、Steam Deck の 3 種類がある。【一次】https://store.steampowered.com/charts/ （2026-10-20 取得）
- Steam 全体の同時接続の最高記録は **43,505,724 人（2026-10-11、SteamDB）**。実際にゲーム中なのはそのうち約 3 分の 1 という報道もある。〔S〕https://dotesports.com/general/news/steam-all-time-record-43-5-million-concurrent-users
- Valve 公式の数字（Gamescom 2025 時点）: Steam 全体の同時接続 4,000 万人、ゲーム内 1,200 万人。〔S〕https://gamedevreports.substack.com/p/valve-steam-in-2025

### 1.3 New & Trending
- 「if the title is doing well」なら、ホームと Early Access ページに表示される。ただし「may be bumped off this list quickly if many other popular products are releasing」。【一次】https://partner.steamgames.com/doc/marketing/visibility
- 2026 年 1 月の実測（Zukowski）: 有料作品で掲載されたのは 95 本、掲載日数は平均 4.25 日・中央値 4 日。掲載に必要な売上は「数日で約 $8,000」と著者が推測している。無料版（Trending Free）は 87 本、平均 6 日。デモで約 90 CCU あれば載ったというインディーの報告もある。【分析/推定】How To Market A Game, 2026-02-18 https://howtomarketagame.com/2026/02/18/the-counterintuitive-advantage-of-launching-during-steams-busiest-event/

### 1.4 Popular Upcoming と Top Wishlists（ウィッシュリスト系）
- Valve の説明では、ウィッシュリストはアルゴリズム上の可視性要因ではないが、Popular Upcoming タブだけは例外。【一次】https://partner.steamgames.com/doc/marketing/visibility
- ウィッシュリスト登録者には、発売時（Early Access 開始時と 1.0 の両方）にメールが届く。割引通知は「at or above 20%」かつ 8 時間を超える割引で送られる。「there's no formula to accurately predict sales from wishlists」。【一次】https://partner.steamgames.com/doc/marketing/wishlist
- **2026 年 6 月のストア刷新（重要な変更）**
  - 新しいホームページは 2026-06-04 に全ユーザーへ公開された（4 月 1 日からベータ）。〔S〕https://massivelyop.com/2026/06/05/steam-puts-out-a-refreshed-store-home-page-with-more-personalization-and-features/
  - Valve は Popular Upcoming の変更理由を「better showcase the most anticipated games of the coming month, in response to user feedback」と説明している。【二次】Inven Global, 2026-07-06 https://labs.invenglobal.com/articles/23483/changes-to-the-steam-shop-algorithm-the-rise-of-the-personal-calendar
  - **掲載に必要なウィッシュリスト数は「約 7,000」から「約 100,000」に上がった**（Zukowski の推定）。【分析/推定】https://howtomarketagame.com/2026/06/25/how-the-steam-personal-calendar-affects-your-launch/
  - 新設の **Personal Calendar（パーソナルカレンダー）**: 発売予定日の 2 か月前から掲載対象になり、毎日再計算される。Zukowski が 2026 年 6 月時点で推定した階層は次のとおり。【分析/推定】https://howtomarketagame.com/2022/09/26/how-many-wishlists-should-i-have-when-i-launch-my-game/ （2026-06-25 更新版）
    - Bronze（上位 250）5,000〜32,000 WL
    - Silver（既定表示の上位 100）8,000〜60,000 WL
    - Gold（上位 50）50,000〜120,000 WL
    - Diamond（上位 10）90,000〜360,000 WL
  - クリック率の実例: *Focus Grove* は Popular Upcoming で約 130 万インプレッション・CTR 0.81%・約 1 万訪問、Personal Calendar で 8 万インプレッション・CTR 33.83%・2.7 万訪問。*Starforged Legacy* は PU で 70 万インプレッション・CTR 1.56%、PC で 10 万インプレッション・CTR 31.26%・3.3 万訪問。Personal Calendar 経由のウィッシュリスト増は 1 日 300〜3,000。【二次】Inven Global 2026-07-06（上記 URL）
- 刷新前の Popular Upcoming の実測（2026 年 1 月、163 本）: 掲載日数は平均 2.1 日、中央値 1 日。【分析】https://howtomarketagame.com/2026/02/18/the-counterintuitive-advantage-of-launching-during-steams-busiest-event/
- **Top Wishlists（タグ別に見られる）**: Steam 検索の `filter=popularwishlist` は見出しが「Top Wishlists」で、タグで絞り込める。tags=9,1755（Strategy + Space と推定）の 2026-10-20 時点の上位は次のとおり。【一次】https://store.steampowered.com/search/?filter=popularwishlist&tags=9%2C1755
  - 1 Total War: WARHAMMER 40,000、2 Falling Frontier、3 Fragile Existence、4 Away Team、5 Sanctuary: Shattered Sun、6 C-Beams、7 Capital Command、8 Main Sequence（2026-11-12 発売予定）、9 Planetbase 2、10 Beyond Astra、11 Hull Rupture、12 Alliance of the Sacred Suns、13 Twilight Imperium Digital、14 Stellar Trader、15 Mars Colony Builder
  - これは宇宙ストラテジーで同時期に競合する未発売作の一覧として使える。ただし tag ID と名称の対応は未検証。

### 1.5 Steam Next Fest
- 参加条件: 未発売であること。「titles may only participate in ONE Next Fest」。開始時点で公開デモがあること。開催中に発売しないこと。【一次】https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest
- 並び順: 「the first few days of Next Fest are completely randomized」。その後はログインユーザーごとにアルゴリズムでパーソナライズされる。終了後に「most played demos」のまとめページが出る。【一次】同上
- 2026 年 2 月 Next Fest のアンケート（182 件の回答）で、開催中に増えたウィッシュリストの中央値を開催前の WL 数別に見ると次のとおり。【分析】https://howtomarketagame.com/2025/03/26/benchmarks-how-many-wishlists-can-i-get-from-steam-next-fest/ （2026 年 2 月 Fest のデータで更新済み）
  - 開催前 0〜999（n=71）: 322
  - 1,000〜9,999（n=60）: 1,006
  - 10,000〜99,999（n=36）: 5,215
  - 100,000 以上（n=7）: 12,882
  - 「最も強い相関は開催前の WL 数と、開催中に得た WL 数の間にあった」
- 2026 年 6 月 Next Fest の「デモをプレイした人がウィッシュリストに入れた割合」: 30 パーセンタイル 15.9%、中央値 19.3%、70 パーセンタイル 23.2%。【分析】https://howtomarketagame.com/2026/06/30/nobody-plays-demos-and-that-is-ok/
- Next Fest 直後の発売は混む: 2024 年 6 月は Next Fest 期間に 309 本（1 日約 38 本）、終了後〜サマーセールまでの「Gap」に 479 本（1 日約 53 本）が発売された。【分析】https://howtomarketagame.com/2024/07/08/should-you-launch-your-game-immediately-after-you-appear-in-steam-next-fest/

### 1.6 タグ・ジャンルページ（Strategy / 4X / Grand Strategy / Space）
- 「sales rank」に達すると、関連するジャンルページやタグページの Top Sellers に表示される。正確なタグ付けが掲載を左右する。【一次】https://partner.steamgames.com/doc/marketing/visibility
- 効くもの: プレイヤーが購入してプレイすること、**対応言語**、タグ。効かないもの: ストアページの流入数と転換率。【一次】同上
- Valve の説明（Zukowski による要約）: ローカライズは可視性の要因になる。翻訳済みのゲームは New & Trending や Popular Upcoming などの地域別ウィジェットに多く載るため。【分析】https://howtomarketagame.com/2023/09/04/killing-the-myths-behind-steams-visibility/

### 1.7 レビュー
- スコアに数えるのは、Steam で購入してプレイしたアカウントのレビューだけ。キーでのアクティベーション、無料週末、ファミリーシェアのレビューは数えない。「直近 30 日」と「全期間」の 2 つのスコアが表示される。【一次】https://partner.steamgames.com/doc/store/reviews
- **可視性の閾値**: 「Mixed or above (40%+)」なら、レビュースコアはアルゴリズムの要因にならない。40% を下回ると「less likely to be featured」。【一次】同上
- ラベルの閾値（**Valve は非公開。コミュニティによる推定**）は次のとおり。〔S〕https://www.steampageanalyzer.com/blog/steam-review-score-thresholds
  - Overwhelmingly Positive: 95% 以上かつ 500 件以上
  - Very Positive: 80% 以上かつ 50 件以上
  - Mostly Positive: 70〜79%
  - Mixed: 40〜69%
  - 10 件未満ではスコアが表示されない
- 売上との関係: ウィッシュリスト転換率が低かった作品群は、発売 7 日時点のレビュー中央値が 67%（Mixed）。上位 20 作品は 91%（Very Positive）。【分析】GameDiscoverCo, 2025-10-17 https://newsletter.gamediscover.co/p/the-state-of-steam-wishlist-conversions

### 1.8 Steam Deck Verified
- 判定は Verified / Playable / Unsupported / Unknown の 4 種類。Steam Machine の判定は Deck とは別に付く。【一次】https://partner.steamgames.com/doc/steamdeck/compat
- 文字サイズの基準: 1280x800 で最小の文字が 9px 以上。推奨は 12px。既定のコントローラー設定ですべての機能に到達できること。既定設定で 800p・30fps が出ること。【一次】同上
- 販売上の効果: 判定は「will not affect whether your game is available … but will affect how it is presented」。ライブラリでは互換性で並べ替えや絞り込みができる。Steam Charts には「Steam Deck」のライブチャートがある。【一次】同上、https://store.steampowered.com/charts/
- **Verified が売上をどれだけ押し上げるかの一次データは見つからなかった（データなし）。** 参考として、*Manor Lords* と *Terra Invicta* の appdetails のカテゴリは「Mouse Only Option」で、コントローラー対応の項目はない。【API】https://store.steampowered.com/api/appdetails?appids=1176470

### 1.9 返金ルール
- 「within two weeks of purchase and with less than two hours of playtime」、つまり 14 日以内かつプレイ 2 時間未満。予約購入の 14 日は発売日から数える。Early Access と Advance Access のプレイ時間も 2 時間に含まれる。【一次】https://store.steampowered.com/steam_refunds/
- Playtest のプレイ時間は本編の返金判定に影響しない。【一次】https://partner.steamgames.com/doc/features/playtest

---

## 2. アナリストデータ

### 2.1 GameDiscoverCo（Simon Carless）: ストラテジー系ジャンルの規模
- **ジャンル別シェア**: 生涯売上 $1M 以上の作品に、ジャンルとサブジャンルを 1 つずつ割り当てて集計したもの。【分析】2025-06-27 https://newsletter.gamediscover.co/p/which-genres-have-ruled-steam-a-new
  - Strategy 全体: Steam 総売上の **13.97%**
  - Strategy の内訳
    - MOBA 19.23%（$2.31B）
    - RTS 15.33%（$1.84B）
    - **Grand Strategy 9.70%（$1.16B LTD。代表作 Stellaris、HoI4、EU4）**
    - **4X 8.45%（$1.01B LTD。代表作 Civ VI、Civ V、Endless Legend）**
    - Base Building 7.22%
    - Colony Sim 5.58%
- **タグ別の売上中央値（2021 年）**: 推定純売上の中央値は次のとおり。全タグ中央値のさらに中央値は約 $2,600。【分析】2021-03-03 https://newsletter.gamediscover.co/p/which-genre-should-your-next-pc-game
  - Colony Sim $44,000
  - Roguelike Deckbuilder $38,000
  - 4X $35,000
  - City Builder $22,000
  - Grand Strategy $19,000
- **ヒット作ジャンルの推移（2021→2025）**: RTS は 17 位下落、Turn-Based Strategy は 19 位下落、City Builder は 5 位下げて 7 位。【分析】2026-08-25 https://newsletter.gamediscover.co/p/how-have-the-genres-of-hit-pc-games
- **プレイヤー年齢**: サンプル全体の中央値は 33 歳。平均年齢 36 歳のゲーム群では上位 5 タグに Strategy が 16 回出てくるが、28 歳のゲーム群では 1 回だけ。【分析】2026-05-26 https://newsletter.gamediscover.co/p/how-old-are-your-players-and-does
- **生成 AI の開示への受容度**: 全体では受容 43%、非受容 31%、中立 26%。受容度が最も高いのは「Naval games, 4X, and Grand Strategy」のプレイヤー。【分析】2026-08-18 https://newsletter.gamediscover.co/p/are-steam-players-of-particular-genres
- **市場全体**
  - 2024 年の新作売上は前年比 55% 超の増加。新作で $1M を超えたのは 200 本以上（+15%）。発売初月の売上は、生涯売上の 25% 以下であることが多い。【分析】2025-03-18 https://newsletter.gamediscover.co/p/what-steams-own-data-tells-us-about
  - Valve の GDC 2026 資料: 2025 年に Steam で $100,000 以上稼いだゲームは **5,863 本**（2024 年は約 5,000 本）。【二次】2026-03-11 https://gameworldobserver.com/2026/03/11/in-2025-nearly-6000-games-earned-over-100000-on-steam-a-record

### 2.2 ウィッシュリストの転換率とローンチ指標（GameDiscoverCo / Zukowski）
- **ウィッシュリスト → 初週販売本数**（GameDiscoverCo, 2025-10-17）【分析】https://newsletter.gamediscover.co/p/the-state-of-steam-wishlist-conversions
  - 2024 年の開発者アンケート（10k WL 超）: 中央値 **0.17x**
  - 発売時 25k WL 超の作品: 中央値 **0.15x**（成人向けを除くと 0.14x）
  - **発売時 $10 超の作品: 0.10x**
  - 転換率が低い作品群は、発売前にストアに出ていた期間が平均 411 日。上位 20 作品は平均 214 日。
- **フォロワー対ウィッシュリスト倍率**: 直近 12 か月の 50k WL 超作品で中央値 16.1x（2021 年は 9.6x、2023 年は 12x）。倍率が低い（＝フォロワー比率が高い）100 作品は初月転換 0.37x、倍率が高い 100 作品は 0.22x。【分析】2026-05-12 https://newsletter.gamediscover.co/p/launch-success-on-steam-are-there
- **初日の最大 CCU → 初週販売本数**（2025 年 3 月デビューの上位 50 作品）【分析】2025-05-13 https://newsletter.gamediscover.co/p/how-your-steam-launch-players-relate
  - 予約なし: 中央値 21.8x
  - 予約あり: 15.4x
  - 全体: 20.4x
  - 全期間最大 CCU を基準にすると中央値 11.4x
- **Early Access を卒業したゲーム（2025 年、225 本）**【分析】2025-12-09 https://newsletter.gamediscover.co/p/the-state-of-steam-early-access-graduates
  - 1.0 発売後 30 日の売上の中央値は、EA 開始後 30 日の売上中央値の約 **40%**
  - 1.0 の方が良かったのは 45 本（20%）
  - EA 期間の中央値は 437 日
- **Zukowski（アーカイブ版。2022 年の基準で、2026 年 6 月に「out of date」と明記）**: Popular Upcoming には約 7,000 WL が必要。掲載中は 1 日約 1,000 WL 増える。広告では「1 wishlist per $1」。フェス参加 1 回で 1,000〜3,000 WL。【分析/推定】https://howtomarketagame.com/2026/06/25/archive-how-many-wishlists-should-i-have-when-i-launch-my-game/
- **Valve の発言（Zukowski による要約）**
  - ウィッシュリストに「no magic number」はない。
  - 「the Steam algorithm only cares about cash」。
  - Daily Deal に載るには最低で約 $250K の総売上が必要（著者推定）。
  - 例: 50,000 WL × 10% × $20 ≈ $100,000 でフロントページ掲載の引き金になる。
  - 【分析/推定】https://howtomarketagame.com/2023/09/04/killing-the-myths-behind-steams-visibility/

### 2.3 Boxleiter 数（レビュー数 → 販売本数の倍率）と推計サイト
- 一般に引用される倍率は「レビュー 1 件あたり 20〜60 本、典型は約 30x」。Jake Birkett の調査では中央値 77x・平均 82x。GameDiscoverCo の 237 作品の調査では生涯中央値 58x、2020 年発売作は 38x。いずれもベンダーブログ経由の数字。〔S〕https://www.steampageanalyzer.com/blog/steam-review-to-sales-multiplier 、https://www.steampageanalyzer.com/blog/boxleiter-method-explained
- Gamalytic は「個別推計の 77% が誤差 30% 以内」と自称している。〔S〕https://www.steampageanalyzer.com/blog/steam-sales-estimate-accuracy
- **【算出】推計サイト Raijin.gg の推計（2026-10-20）はレビュー数の約 24 倍で揃っている。** レビュー数は Steam API の値。
  - *Terra Invicta*: 222,531 本 ÷ 9,112 件 = 24.4x（推計総売上 $5,339,409）https://raijin.gg/app/1176470/Terra_Invicta
  - *Manor Lords*: 1,896,059 ÷ 77,788 = 24.4x（$45,494,040）https://raijin.gg/app/1363080/Manor_Lords
  - *Songs of Syx*: 206,316 ÷ 9,045 = 22.8x（$3,093,502）https://raijin.gg/app/1162750/Songs_of_Syx
  - *Distant Worlds 2*: 65,007 ÷ 2,670 = 24.3x（$1,949,820）https://raijin.gg/app/1531540/Distant_Worlds_2
  - *Sins of a Solar Empire II*: 175,895 ÷ 7,221 = 24.4x（$5,275,795）https://raijin.gg/app/1575940/Sins_of_a_Solar_Empire_II
  - 照合: *Manor Lords* は公表値で「over 3 million」（2025 年 2 月）。Raijin の推計 190 万本はこれより少ない。ただし公表値のプラットフォーム内訳は不明。【二次】https://en.wikipedia.org/wiki/Manor_Lords（出典 https://gamingbolt.com/manor-lords-has-sold-over-3-million-units ）
- **VG Insights** の URL は 2026-10-20 時点で Sensor Tower（app.sensortower.com/vgi/…）に 301 リダイレクトされ、本文は取得できなかった。【一次・観測】
- **Immutable のタグ別ベンチマーク**（2026-09-23 公開。「licensed third-party sales-estimation dataset」による。総売上・Steam 手数料控除前）【推定】https://www.immutable.com/insights/steam-genre-revenue-benchmarks

| タグ | Steam 上の本数 | 販売本数の中央値 | 総売上の中央値 |
|---|---|---|---|
| 4X | 648 | 3,900 | $50,000 |
| Grand Strategy | 1,298 | 1,550 | $14,700 |
| Strategy | 27,804 | 578 | $4,040 |
| RTS | 2,894 | 1,390 | $16,700 |
| Colony Sim | 1,167 | 2,280 | $17,300 |

### 2.4 Steam ユーザーの言語シェア
- **Steam Hardware & Software Survey（2026 年 9 月）**【一次】https://store.steampowered.com/hwsurvey/ （2026-10-20 取得）

| 言語 | シェア | 前月比 |
|---|---|---|
| English | 34.20% | -4.05 |
| Simplified Chinese | **31.39%** | +7.42 |
| Russian | 9.05% | -0.85 |
| Spanish - Spain | 4.08% | -0.45 |
| Portuguese-Brazil | 3.70% | -0.33 |
| German | 2.48% | -0.24 |
| **Japanese** | **2.41%** | -0.09 |
| French | 2.08% | -0.21 |
| Polish | 1.49% | -0.20 |
| Korean | 1.37% | -0.26 |
| Traditional Chinese | 1.27% | -0.04 |

- 調査値は月ごとの振れが大きい。2026 年 2 月は Simplified Chinese が 54.60%（春節の影響とされる）。〔S〕https://www.gamingonlinux.com/2026/03/steam-survey-for-february-2026-shows-a-big-swing-to-simplified-chinese 。2026 年 3 月は English 39.09%、SC 22.75%、Russian 9.21%、Japanese 2.24%。〔S・要確認〕https://www.quantumrun.com/consulting/steam-language-statistics/
- **Valve が発表した「主言語」シェア**（Gamescom 2025 の devcom 講演、2025 年 8 月まで）: Simplified Chinese 33.6%、English 33.0%（前年 33.4%）、Russian 8.4%、Spanish 4.6%、PT-BR 2.8%、Traditional Chinese 約 1%。【二次】2025-08-29 https://wnhub.io/news/stores-and-publishing/item-48667
- Valve の GDC 2026 資料: Steam ユーザーの 66% は主言語が英語以外。2024 年は Simplified Chinese が首位で 33.7%。【二次】https://gameworldobserver.com/2026/03/11/in-2025-nearly-6000-games-earned-over-100000-on-steam-a-record

### 2.5 中国語ローカライズがストラテジーで効く根拠
- Fellow Traveller の Chris Wright によると、中国語ローカライズと現地 PR によって、自社カタログの中国の販売本数比率が「5% or less」から「20% or more」になった。ただし中国は価格が安く、返金も多い。翻訳がないと、中国のユーザーの既定のストア表示にはほぼ出ない（「6,000 games instead of 34,000」の店で戦うのと同じ）。日本語は「if it's also on Switch」なら価値が高い。【分析】GameDiscoverCo, 2021-06-23 https://newsletter.gamediscover.co/p/game-localization-for-discovery-its
- **【API・算出】中国語レビューの比率**（`language=schinese` の件数 ÷ 全言語の件数、2026-10-20）
  - *Stellaris* 24.1%（33,635 / 139,550）
  - *Victoria 3* 20.6%（8,428 / 40,842）
  - *Against the Storm* 15.5%（5,179 / 33,511）
  - *EU5* 13.9%（3,380 / 24,371）
  - *Civ VII* 13.0%（5,914 / 45,331）
  - *Terra Invicta* 10.1%（923 / 9,112）
  - *Sins II* 10.1%（732 / 7,221）
  - *Manor Lords* 8.2%（6,378 / 77,788）
  - *Songs of Syx* 6.2%（565 / 9,045）
  - *Workers & Resources* 5.3%（1,320 / 25,100）
  - *Distant Worlds 2* 5.3%（142 / 2,670。英語のみ対応）
  - ***Hearts of Iron IV* 2.2%（5,867 / 261,144）。2017-11-02 に中国で禁止された。** 【二次】https://en.wikipedia.org/wiki/Hearts_of_Iron_IV
  - 取得 URL の形式: `https://store.steampowered.com/appreviews/{appid}?json=1&language=schinese&num_per_page=0`
- **【算出】中国語レビューは評価が厳しい傾向**（好評率: 中国語 / 全体）
  - *Manor Lords* 52.9% / 84.6%
  - *EU5* 44.3% / 66.1%
  - *Civ VII* 33.9% / 48.8%
  - *Terra Invicta* 66.8% / 80.0%
  - *Victoria 3* 69.4% / 71.8%
  - *Stellaris* 83.5% / 85.7%
  - *Against the Storm* 92.2% / 94.7%
  - **注意**: レビューの言語はプレイヤーの国籍と同じではない。レビューを書く頻度も地域で差がある。
- Paradox は 2016 年に Tencent と提携し、*Cities: Skylines* と *Stellaris* を中国語プラットフォームで配信した。〔S〕https://www.paradoxinteractive.com/media/press-releases/press-release/paradox-interactive-partners-with-tencent-to-publish-cities-skylines-and-stellaris-on-chinese-language-platform
- Hooded Horse（*Manor Lords*、*Against the Storm*、*Terra Invicta*、*Workers & Resources* 1.0 の販売元）は、各作品にローカライズとマーケティングで最低 $100,000 の予算を割り当て、発売後の収益の 65% を開発者に渡している。【二次】https://en.wikipedia.org/wiki/Hooded_Horse（出典 https://www.gamedeveloper.com/marketing/how-hooded-horse-seeks-to-do-right-by-developers ）

---

## 3. ケーススタディ（ストラテジー系）

### 3.1 一覧表
- CCU は SteamCharts の全期間最大。〔DB〕は SteamDB を引用した報道の値。
- レビューは Steam API の値（2026-10-20、`language=all`、既定の purchase_type）。
- 価格は 2026-10-20 時点の定価で、発売時の価格ではない。

| タイトル | Steam 発売 / EA | 全期間最大 CCU | レビュー（好評率・件数） | 定価 US / JP / CN | 中国語レビュー比率 | 2026-09 平均 CCU |
|---|---|---|---|---|---|---|
| Manor Lords | 2024-04-26 EA | 172,605（〔DB〕173,178） | Very Positive 84.6%・77,788 | $39.99 / ¥3,980 / ¥149 | 8.2% | 5,915 |
| Civilization VII | 2025-02-11 | 84,558（2025-02） | Mixed 48.8%・45,331 | $99.99※ / ¥12,650※ | 13.0% | 10,496 |
| Civilization VI（比較） | 2016-10 | 162,314（2016-10） | Very Positive 86.3%・276,940 | $59.99 / ¥7,000 | — | 28,638 |
| Stellaris | 2016-05-09 | 68,517（2016-05） | Very Positive 85.7%・139,550 | $49.99 / ¥6,990 / ¥198 | 24.1% | 10,452 |
| Hearts of Iron IV | 2016-06-06 | **93,196（2024-11）** | Very Positive 90.5%・261,144 | $49.99 / ¥6,990 | 2.2% | 33,887 |
| Europa Universalis V | 2025-11-04 | 72,816（2025-11） | Mixed 66.1%・24,371 | $59.99 / ¥7,990 / ¥238 | 13.9% | 6,088 |
| Europa Universalis IV（比較） | 2013 | 47,844（2020-06） | — | — | — | 8,743 |
| Victoria 3 | 2022-10-25 | 69,663（2022-10） | Mostly Positive 71.8%・40,842 | $49.99 / ¥6,990 | 20.6% | 5,520 |
| Cities: Skylines II | 2023-10-24 | 76,549（2023-10） | Mixed 57.3%・63,745 | $49.99 / ¥6,990 | — | 9,170 |
| Frostpunk 2 | 2024-09-20 | 〔DB〕35,533（SteamCharts は 2024-09 が欠損） | Mostly Positive 74.2%・21,048 | $44.99 / ¥5,200 / ¥149 | — | 581 |
| Against the Storm | EA 2021-10 → 1.0 2023-12-08 | 12,832（2023-11） | Very Positive 94.7%・33,511 | $29.99 / ¥2,980 / ¥99 | 15.5% | 1,428 |
| Terra Invicta | EA 2022-09 → 1.0 2026-01-05 | 9,826（2022-10、EA 開始時） | Mostly Positive 80.0%・9,112 | $39.99 / ¥3,980 / ¥149 | 10.1% | 919 |
| Songs of Syx | EA 2020-09-21（EA 継続中） | 3,412（2026-05） | Very Positive 94.4%・9,045 | $24.99 / ¥2,800 / ¥92 | 6.2% | 801 |
| Workers & Resources: Soviet Republic | EA 2019-03-15 → 1.0 2024-06-20 | 8,221（2024-07） | Very Positive 91.3%・25,100 | $39.99 / ¥3,980 / ¥149 | 5.3% | 2,362 |
| Distant Worlds 2 | 2022-03-10 | 4,974（2022-03） | Mostly Positive 72.1%・2,670 | $49.99 / ¥5,500 | 5.3% | 80 |
| Sins of a Solar Empire II | Steam 版 2024-08-15 | 13,330（2024-08） | Very Positive 83.0%・7,221 | $49.99 / ¥6,200 | 10.1% | 1,002 |
| Homeworld 3 | 2024-05-13 | 4,315（2024-05） | **Mostly Negative 38.5%**・5,456 | $59.99 / ¥7,590 | — | 22 |
| Millennia | 発売日未確認（SteamCharts は 2024-04 から） | 5,907（月は不明） | Mixed 66.9%・2,985 | $39.99 / ¥5,390 | — | 33 |
| Ara: History Untold | 2024-09 | 3,449（2024-09） | Mixed 68.3%・2,148 | $49.99 / ¥7,040 | — | 29 |
| Stormgate | EA 2024-07-30（F2P）→ 1.0 2025-08-05 | 4,456（2024-08） | Mixed 55.1%・2,104 | F2P | — | 9 |
| 三國志8 REMAKE（Koei、日本製） | 発売日未確認（SteamCharts は 2024-11 から） | 17,513（月は不明） | Mixed 49.6%・3,151 | — | **32.8%**（日本語 8.0%） | 417 |

※ *Civ VII* について、API は定価 $99.99（50% オフで $49.99）を返した。どのエディションが最安パッケージとして返されているか未確認。

出典（共通）
- CCU: `https://steamcharts.com/app/{appid}`
  - 1363080, 1295660, 289070, 281990, 394360, 3450310, 236850, 529340, 949230, 1601580, 1336490, 1176470, 1162750, 784150, 1531540, 1575940, 1840080, 1268590, 2021880, 2012510, 2288150
- レビュー: `https://store.steampowered.com/appreviews/{appid}?json=1&language=all&num_per_page=0`
- 価格: `https://store.steampowered.com/api/appdetails?appids=…&filters=price_overview&cc=us|jp|cn`

### 3.2 個別メモ（成功の要因と失敗の兆候）

**Manor Lords（中世の街づくりとストラテジー。Slavic Magic / Hooded Horse）**
- Steam 史上もっとも多くウィッシュリストされた状態で発売された。
  - 発売前のウィッシュリストは「over 3.2 million」。
  - Early Access 開始は 2024-04-26。「sold over 1 million copies within 24 hours」（Hooded Horse の発表では 30 時間）。
  - SteamDB の最大 CCU は 173,178。都市建設、グランドストラテジー、4X、コロニーシムの中で SteamDB 史上最高。
  - 【二次】Game Developer, 2024-04-29 https://www.gamedeveloper.com/business/manor-lords-tops-1-million-sales-after-garnering-3-2-million-wishlists 、https://www.cgmagonline.com/news/medieval-manor-lords-over-1-million-sold/
- 発売直前に *Hades II* を抜いて Steam で最もウィッシュリストされたゲームになった。開発者の当初の目標は 14,000 WL で、2024 年 1 月に 200 万 WL を超えた。【二次】https://en.wikipedia.org/wiki/Manor_Lords（出典 PC Gamer / GamesRadar）
- 2023 年 10 月の Xbox Partner Preview でデモを公開し、Game Pass 対応も告知した（RPS）。販売元は「we'll run those 25 percent discounts often」と述べている。【二次】同上、Game Developer
- 2025 年 2 月までに 300 万本以上。【二次】Wikipedia（GamingBolt）
- 減衰: SteamCharts では 2024 年 7 月の最大 CCU が 10,566 で、全期間最大の 6.1% まで下がった【算出】。2026 年 8 月は 16,584 まで回復した（アップデートの影響と推測。原因は未確認）。
- 中国語レビューの好評率は 52.9%、全体は 84.6%。【API】

**Civilization VII（失敗寄りの大作）**
- 最大 CCU は 84,558（2025 年 2 月）。前作 *Civ VI* は 162,314（2016 年 10 月）。【一次・SteamCharts】
- 2025 年 4 月の最大 CCU は 18,943 で、ピークの 22.4%【算出】。2026 年 9 月の平均 CCU は *Civ VI* が 28,638、*Civ VII* が 10,496 で、前作の方が多い。
- 現在のレビューは Mixed 48.8%（45,331 件）【API】。発売直後は約 1,400 件で 39% の「Mostly Negative」だった。〔S〕https://wnhub.io/news/stores-and-publishing/item-47024
- 批評家の評価は Metacritic 79 で、プレイヤーの評価と開きがある。Take-Two の CEO は初動を「slow」と述べた（2025 年 8 月）。【二次】https://en.wikipedia.org/wiki/Civilization_VII（出典 IGN）
- 中国語レビューの好評率は 33.9%。【API】

**Stellaris（2016 年。宇宙 4X / グランドストラテジーの基準作）**
- 発売 24 時間未満で 20 万本超を売り、Paradox の初日売上記録を更新した。【二次】Wikipedia 経由 Eurogamer 2016-05-10 https://en.wikipedia.org/wiki/Stellaris_(video_game)
- 「over 500,000 copies sold worldwide」を発売から約 1 か月で達成した。【一次】Paradox PR, 2016-06-21 https://www.paradoxinteractive.com/en/paradox-interactive-announces-grand-successes-for-grand-strategy-titles/
- 300 万本超（Paradox PR、2020 年または 2021 年。日付は資料によって異なる）。【二次】Wikipedia
- 発売月の最大 CCU は 68,517。10 年後の 2026 年 9 月でも平均 10,452、最大 18,826。【一次・SteamCharts】
- 中国語レビュー比率は 24.1%、日本語は 0.57%。【API】

**Hearts of Iron IV**
- 発売 2 週間未満で 20 万本超。【一次】Paradox PR 2016-06-21（上記 URL）
- 2018 年 5 月に 100 万本。【二次】Wikipedia（GamesIndustry.biz）
- **全期間最大 CCU は発売 8 年後の 2024 年 11 月で 93,196。** 発売月の最大は 40,623 だった。【一次・SteamCharts】
- DLC と無料プレイ週間で過去最高を更新してきた。2022 年には約 7 万人（無料週間中）。【二次】Wikipedia（PCGamesN）
- 中国では禁止されている（2017 年）。中国語レビュー比率は 2.2%。【API】

**Europa Universalis V（2025 年）**
- 最大 CCU は 72,816（2025 年 11 月）。2026 年 1 月の最大は 21,844 で、ピークの 30.0%【算出】。2026 年 9 月の平均は 6,088。
- Steam のレビューは Mixed 66.1%。批評家は Metacritic 85、OpenCritic「100%」が推奨。【API】、【二次】https://en.wikipedia.org/wiki/Europa_Universalis_V
- 2025 年 5 月の GameDiscoverCo の週間ランキングで、未発売トレンドの 1 位として初登場した。〔S〕
- 販売本数の公式発表は見つからなかった（未取得）。

**Victoria 3（2022 年）**
- 最大 CCU は 69,663。3 か月目（2022 年 12 月）の最大は 17,363 で 24.9%【算出】。
- Mostly Positive 71.8%。Metacritic 83。【API】、【二次】https://en.wikipedia.org/wiki/Victoria_3
- 販売本数は未取得。

**Frostpunk 2（2024 年）**
- SteamDB の最大 CCU は 35,533。アナリストは 80,000〜100,000 を予想していた。〔S〕https://www.pcgamesn.com/frostpunk-2/player-count-steam
- 発売後 4 日で 35 万本を売り、開発費とマーケティング費を回収した。それでも株価は 38% 下落した（Reuters）。〔S〕https://de.tradingview.com/news/reuters.com,2024:newsml_L1N3L5086:0-shares-of-video-game-maker-11-bit-studios-slump-after-frostpunk-2-release 、【二次】Wikipedia
- 2024 年 12 月時点で 592,000 本、売上は PLN 69.73M（$18.5M）。【二次】Game Developer, 2025-04-17 https://www.gamedeveloper.com/business/frostpunk-2-nears-600-000-sales-after-tough-year-for-developer-11-bit-studios

**Against the Storm（Eremite Games / Hooded Horse）**
- Early Access は 2021 年 10 月、1.0 は 2023-12-08。【二次】https://en.wikipedia.org/wiki/Against_the_Storm_(video_game)
- Steam で 100 万本超（Steam ニュース 2024-03-27）。【一次】https://store.steampowered.com/news/app/1336490/view/4115799931699652974
- Metacritic 91。Steam は 94.7% で、Overwhelmingly Positive の推定閾値 95% にわずかに届かない。【API】

**Terra Invicta（近未来・太陽系・リアル寄りのグランドストラテジー。本作に最も近い比較対象）**
- 開発は *XCOM: Long War* の MOD チームが母体の Pavonis Interactive、販売は Hooded Horse。2020 年の Kickstarter で $216,000 を集めた。Early Access は 2022 年 9 月、1.0 は 2026-01-05。【二次】https://en.wikipedia.org/wiki/Terra_Invicta
- **全期間最大 CCU 9,826 は EA 開始月（2022 年 10 月）のもの。** 1.0 はこれを超えていない。2026 年 8 月の最大は 3,043。【一次・SteamCharts】
- 14 言語に対応し、日本語と簡体字中国語もテキストで対応。Steam のカテゴリは「Mouse Only Option」。【API】https://store.steampowered.com/api/appdetails?appids=1176470
- Mostly Positive 80.0%（9,112 件）。批評家は Metacritic 83。推計販売は約 22.3 万本・総売上約 $5.3M。【API】、【推定】Raijin

**Songs of Syx（Gamatron AB）**
- 2020-09-21 から Early Access が続いている。対応言語は英語と簡体字中国語だけで、日本語はない。デモがある（App 1279600）。【API】https://store.steampowered.com/api/appdetails?appids=1162750
- 94.4%（9,045 件）。全期間最大 CCU 3,412 は EA 開始から 5 年以上たった 2026 年 5 月に記録した。【API】、【SteamCharts】

**Workers & Resources: Soviet Republic（3Division、スロバキア）**
- Early Access は 2019-03-15、1.0 は 2024-06-20（Hooded Horse）。【二次】https://en.wikipedia.org/wiki/Workers_%26_Resources:_Soviet_Republic
- 全期間最大 CCU 8,221 は 1.0 直後の 2024 年 7 月。91.3%。【SteamCharts】、【API】

**Distant Worlds 2 / Sins of a Solar Empire II（宇宙ストラテジーの中規模作）**
- *DW2*（Slitherine、英語のみ）: 最大 CCU 4,974、72.1%、推計約 6.5 万本、2026 年 9 月の平均 80。【SteamCharts】、【API】、【推定】
- *Sins II*（Stardock、日本語と中国語に対応）: Steam 版の最大 CCU 13,330、83.0%、推計約 17.6 万本。【SteamCharts】、【API】、【推定】

**Homeworld 3（失敗）**
- 4 回延期した末、2024-05-13 に発売。最大 CCU は 4,315 で、翌月の最大は 728。Mostly Negative 38.5%。批評家は Metacritic 75 で、プレイヤーの評価と大きく食い違う。2024-11-18 に「最後のアップデート」を告知した。【SteamCharts】、【API】、【二次】https://en.wikipedia.org/wiki/Homeworld_3

**Cities: Skylines II（期待外れ）**
- 2023-10-24 発売。最大 CCU は SteamCharts で 76,549、IGN の報道では 100,000 超。2024 年 2 月までに 100 万本超。
- 性能面の問題、コンソール版の無期限延期、*Beach Properties* DLC（発売 3 日後の好評率 4%）の返金があった。2025-11-17 に Colossal Order が開発から離れた。
- 現在は Mixed 57.3%。
- 【SteamCharts】、【API】、【二次】https://en.wikipedia.org/wiki/Cities:_Skylines_II

**Millennia / Ara: History Untold / Stormgate（不振）**
- 3 作とも最大 CCU は 3,400〜5,900 で、レビューは Mixed（55〜69%）。2026 年 9 月の平均 CCU は 9〜33。
- *Stormgate* は総額 $35M 超の投資（シード $5M + $5M + シリーズ A $25M）と約 $2M の Kickstarter を集め、F2P で EA を始めた。【二次】https://en.wikipedia.org/wiki/Stormgate

### 3.3 横断的に見えること（すべて上の数値から）
- **ストラテジーの最大 CCU の上限**
  - 超大型ヒット: 約 7 万〜17 万（*Manor Lords* 173k、*Civ VI* 162k、*HoI4* 93k、*Civ VII* 85k、*CS2* 77k、*EU5* 73k、*Vic3* 70k、*Stellaris* 69k）
  - 宇宙もの: *Stellaris* 以外は 1.4 万以下（*Sins II* 13k、*Terra Invicta* 9.8k、*DW2* 5k、*HW3* 4.3k）
- **【算出】発売 3 か月目の最大 CCU ÷ 全期間最大**: *Civ VII* 22%、*Vic3* 25%、*CS2* 27%、*EU5* 30%、*Manor Lords* 6%（EA）、*HW3* 5%、*Stormgate* 7%
- **長期の尾**: Paradox 作品は DLC で何年も CCU を保つか、更新する（*HoI4* は 8 年後に最高、*Stellaris* は 10 年後も平均 1 万）。
- **EA の扱い**: EA 開始がピークになりやすい（*Terra Invicta*、*Manor Lords*）。GameDiscoverCo の中央値では、1.0 の初月売上は EA 初月の約 40%。
- **Hooded Horse の作品が多い**: *Manor Lords*、*Against the Storm*、*Terra Invicta*、*W&R* 1.0 がそうだ。ローカライズとマーケティングに 1 作あたり最低 $100k を出す方針（2.5 節）。
- **配信者の役割**: ストラテジー作品については、配信者の貢献を数値で示した一次データは今回見つからなかった（データなし）。対照的に、非ストラテジーの日本製ヒット（4 節）は配信者と短尺動画が主因と報じられている。

---

## 4. 日本発ゲームの世界チャート進出と、Steam の日本語市場

### 4.1 日本語市場の大きさ
- Steam 調査の日本語シェアは **2.41%（2026 年 9 月、7 位）**。【一次】https://store.steampowered.com/hwsurvey/ 。2022 年 3 月の 2.34% が当時の過去最高だった。〔S〕https://automaton-media.com/articles/newsjp/20220414-198993/
- Valve（Erik Peterson、Gamescom 2025 の devcom）: 2020〜2025 年に新規ユーザーの伸びが大きかった市場は「Japan, Brazil, China, Germany, and the USA」。1 日平均 10.9 万人が初めて Steam で購入している。【二次】https://wnhub.io/news/stores-and-publishing/item-48667
- Peterson（2022 年）: 日本の PC ゲーム市場は世界トップ 10 に入り、伸び率では「the best potential in the world」。【二次】https://exputer.com/news/industry/japan-valve-steam-deck/
- 2025 年 1〜8 月の Steam インストール数のうち、日本に本社がある開発元が 15% を占めた（米国は 38%）。〔S〕https://gamedevreports.substack.com/p/valve-steam-in-2025
- 『ファミ通ゲーム白書 2026』: 2025 年の国内ゲームコンテンツ市場は 2 兆 5,885 億円（+8.0%）。PC ゲームは +5.8%。2023 年の PC ゲームは +24.9%。PC ゲーム単独の金額は取得できていない。〔S〕https://gamebiz.jp/news/430671 、https://www.gamebusiness.jp/article/2024/08/22/23416.html
- **【API・算出】西洋ストラテジーでの日本語レビュー比率は 1% 未満**
  - *Stellaris* 0.57%（789 件）
  - *HoI4* 0.79%（2,068 件）
  - *Manor Lords* 0.45%（350 件）
  - *Civ VII* 0.86%（390 件）
  - 日本製の *三國志8 REMAKE* でも日本語は 8.0%（253 件）で、簡体字中国語の 32.8%（1,033 件）の方がはるかに多い。

### 4.2 日本発の世界ヒット（すべて非ストラテジー）
- **Palworld**（Pocketpair、東京・品川）【二次】https://en.wikipedia.org/wiki/Palworld（出典 Gematsu、Windows Central、SteamDB）
  - Early Access 開始は 2024-01-19。
  - 8 時間で 100 万本、6 日で 800 万本、2024-02-22 に Steam で 1,500 万本。
  - **Steam の最大 CCU は 2,101,867（2024-01-27）。**
- **The Exit 8（8番出口）**（コタケクリエイト、個人開発）【二次】https://en.wikipedia.org/wiki/The_Exit_8
  - 2023-11-29 発売。初日 3 万本、2024 年 4 月に Steam で 50 万本、2025 年 8 月に 200 万本超。
  - HIKAKIN、さくらみこなどが実況し、YouTube の再生は 1 億回超（2025 年 2 月）。
  - 東宝が実写映画化した。
- **Meccha Chameleon**（lemorion_1224 / Haganeiro、2026-06-10 発売、約 $6）【二次】https://en.wikipedia.org/wiki/Meccha_Chameleon 、https://www.invenglobal.com/articles/22805/Meccha-chameleon-the-hide-and-seek-game-streamers-love-hits-no-1-in-steam-sales
  - 開発期間は約 2 か月。
  - 2 日で 50 万本、5 日で 200 万本、2026-08-12 までに 2,000 万本（Wikipedia。別の報道では「1,500 万本」）。
  - 最大 CCU は 340,535（2026-06-22、Steam 史上 44 位）。
  - 日本と韓国で売上 1 位、世界 2 位。発売日の Twitch 視聴は最大 12.7 万人。
- 3 作に共通するのは、低価格または話題性、配信者や短尺動画による拡散。**日本製のストラテジー系インディーが世界の Top Sellers で上位に入った例は、今回の取得範囲では見つからなかった（データなし）。**

---

## 5. 価格とデモ / Playtest

### 5.1 価格の実データ（2026-10-20 の定価）【API】
- **USD → JPY**
  - Hooded Horse 系: $39.99 → ¥3,980（*Manor Lords*、*Terra Invicta*、*W&R*）、$29.99 → ¥2,980（*Against the Storm*）
  - *Songs of Syx*: $24.99 → ¥2,800
  - Paradox: $49.99 → ¥6,990（*Stellaris*、*HoI4*、*Vic3*、*CS2*）、$59.99 → ¥7,990（*EU5*）
  - その他: *DW2* $49.99 → ¥5,500、*Sins II* ¥6,200、*Ara* ¥7,040、*Millennia* $39.99 → ¥5,390
- **USD → CNY**: $24.99 → ¥92、$29.99 → ¥99、$39.99 → ¥149、$44.99 → ¥149、$49.99 → ¥198、$59.99 → ¥238
- 日本円の価格は 100 円単位で設定しなければならない（「Must be charged in increments of 100 sen」）。【一次】https://partner.steamgames.com/doc/store/pricing/currencies
- 取得日時点のセール例: *Against the Storm* -70%、*W&R* -75%、*Homeworld 3* -67%、*Civ VII* -50%、*Manor Lords* -35%。【API】
- **価格と転換率**: 発売時 $10 超の作品は、ウィッシュリスト → 初週の中央値が 0.10x（全体は 0.15x）。【分析】GameDiscoverCo 2025-10-17
- **価格とレビュー**: 3.1 の表では、$25〜$40 帯の作品（*Against the Storm* 94.7%、*Songs of Syx* 94.4%、*W&R* 91.3%、*Manor Lords* 84.6%）が、$50〜$70 帯の新作（*EU5* 66.1%、*Civ VII* 48.8%、*CS2* 57.3%、*HW3* 38.5%）より好評率が高い。ただしこれは観察であって、因果関係は示していない。【算出】
- Immutable の中央値から逆算した単価（総売上の中央値 ÷ 本数の中央値）: 4X 約 $12.8、Grand Strategy 約 $9.5。異なる母集団の中央値どうしの割り算なので、参考値にとどめる。【算出・参考】

### 5.2 デモ
- デモは「can appear anywhere in Steam that a free game could appear」で、New & Trending やタグ・ジャンルページに載れる。【一次】https://partner.steamgames.com/doc/store/application/demos
  - デモの初回公開から 14 日以内に、ウィッシュリスト登録者へ 1 回だけ通知できる。
  - 通知は App ID ごとに 2 週間のクールダウンがある。
  - Valve の推奨は「We generally recommend waiting until launch」。ただし、触らないと理解しにくいゲームでは発売前のデモが有効だとしている。
- Next Fest への参加にはデモが必須（1.5 節）。デモをプレイした人のうちウィッシュリストに入れるのは中央値 19.3%（2026 年 6 月）。
- 冬のセール中にデモを出した例: *How Many Dudes* はウィッシュリストが 8,387（2025-12-18）から 150,292（2026-01-31）に増え、デモのダウンロードは 366,064。*Cairn* はデモのダウンロードが 50 万。【分析】https://howtomarketagame.com/2026/02/18/the-counterintuitive-advantage-of-launching-during-steams-busiest-event/
- ストラテジーでは *Songs of Syx* がデモを常設している（App 1279600）。【API】

### 5.3 Playtest
- 別の App ID で運用し、参加受付は本編のストアページに置く。「A customer's wishlist for your game won't be impacted」。【一次】https://partner.steamgames.com/doc/features/playtest
  - 無料でなければならない（有料にするなら Early Access を使う）。
  - Playtest の参加者は本編のレビューを書けない。
  - 本編の上書きキーは通常 2,500 本までに制限される。Playtest キーが 50,000 を超えるならオープン化を検討すべきとしている。
  - Steam は Playtest の開始をメールで知らせないため、告知はイベントとアナウンスで行う。

---

## 未取得・限界（正直な申告）
- SteamDB は WebFetch で 403 になる。CCU は SteamCharts と報道で代替した。SteamCharts は一部の月が欠けている。
- 次の項目は検索予算を使い切ったため取得できていない。
  - *Victoria 3* と *EU5* の公式販売本数
  - *Manor Lords* が世界週間 Top Sellers で 1 位になったかどうか
  - Steam Deck Verified による売上効果の数値
  - Valve の Next Fest 総括（参加作品数、プレイ数）
  - VG Insights と Gamalytic のジャンル別国別データ（VG Insights は Sensor Tower に統合されていてログインが必要。Gamalytic は JS 描画で本文を取得できなかった）
- 中国語レビューと日本語レビューの比率は、プレイヤーの国別比率の代わりに使った値であって、実際の国別比率ではない。
- 価格は 2026-10-20 時点の定価で、発売時の価格ではない。

---

## 生データの一覧

| データソース名 | 何を測るか | URL | 無料 / 有料 |
|---|---|---|---|
| Steamworks Documentation（Visibility / Top Sellers / Reviews / Wishlist / Next Fest / Demos / Playtest / Deck Compat / Currencies） | Valve 公式の仕様と閾値 | https://partner.steamgames.com/doc/ | 無料 |
| Steam Charts（Valve 公式）| 週間とリアルタイムの売上順位（金額）、Most Played、Steam Deck、月間 Top Releases | https://store.steampowered.com/charts/ | 無料 |
| Steam 検索の Top Wishlists フィルタ | タグ別の未発売作ウィッシュリスト順位 | https://store.steampowered.com/search/?filter=popularwishlist&tags= | 無料 |
| Steam appreviews API | 好評数・不評数と、言語別のレビュー件数 | https://store.steampowered.com/appreviews/{appid}?json=1&language=all | 無料 |
| Steam appdetails API | 国別価格、対応言語、発売日、デモの有無 | https://store.steampowered.com/api/appdetails?appids={id}&cc=us | 無料 |
| Steam Hardware & Software Survey | OS と言語のシェア（月次、自己申告） | https://store.steampowered.com/hwsurvey/ | 無料 |
| SteamDB | CCU、フォロワー、ウィッシュリスト順位 | https://steamdb.info/ | 無料（WebFetch では 403） |
| SteamCharts | 月次の平均と最大 CCU | https://steamcharts.com/app/{appid} | 無料 |
| GameDiscoverCo | 転換率、ジャンル分析、EA 卒業データ、年齢と AI 受容 | https://newsletter.gamediscover.co/ | 無料記事と有料 Pro |
| How To Market A Game（Chris Zukowski） | ウィッシュリスト、Next Fest、Personal Calendar のベンチマーク | https://howtomarketagame.com/ | 無料ブログ（有料講座もあるが要確認） |
| Raijin.gg | 販売本数と売上の推計（約 24x レビュー） | https://raijin.gg/app/{appid}/ | 無料 |
| Gamalytic | 販売本数と売上の推計（10 万本超の DB） | https://gamalytic.com/ | 無料と有料（Pricing ページあり、詳細は要確認） |
| VG Insights（現在は Sensor Tower） | 販売推計 | https://vginsights.com/ → https://app.sensortower.com/vgi/ | ログインが必要（有料と思われるが要確認） |
| Immutable Steam Genre Revenue Benchmarks | タグ別の本数と売上の中央値 | https://www.immutable.com/insights/steam-genre-revenue-benchmarks | 無料 |
| Steam Page Analyzer | レビュー閾値と Boxleiter の解説（ベンダー） | https://www.steampageanalyzer.com/blog/ | 無料 |
| Valve の講演（GDC / Gamescom devcom） | 言語シェア、新規購入者数、$100k 超のタイトル数 | https://wnhub.io/news/stores-and-publishing/item-48667 、https://gameworldobserver.com/2026/03/11/in-2025-nearly-6000-games-earned-over-100000-on-steam-a-record | 無料（報道経由） |
| 『ファミ通ゲーム白書』 | 日本国内市場の規模 | https://gamebiz.jp/news/430671 | 本体は有料、要約は無料 |
| パブリッシャーの IR / PR（Paradox、11 bit） | 公式の販売本数 | https://www.paradoxinteractive.com/media/press-releases | 無料 |
