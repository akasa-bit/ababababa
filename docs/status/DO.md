# 道具と検証 (DO) のいまの状態

2026-10-21 の再出発 (`docs/restart.md`。回 R4) で作ったレーン。持つ場所は `tools/`・CI・`src/core/` の世話役 (`docs/parallel.md` の 1・`docs/src-files.md` の 5)。前のレーンの状態は `docs/archive/status/`。

- いま: 回 DO3 が済んだ (B-065。プレイ記録から F01〜F05・F20・F21 と待つだけの時間・判断の数を測る `tools/playlog-report.js`。`docs/fun.md` の 8)。1 波目の DO の回はこれで全部。見知らぬ試遊者の記録はまだないので、値はまだない (試遊の本番 B-062 で回す)。
- 回 DO2 も済んでいる (B-069 の壊れの測り直し・B-071 の F16〜F21 と CI の止める線。`docs/fun.md` の 7)。
- 回 DO2 の結果: F06・F18 (と地球だけの F19) が不合格、F16・F17 は合格。挑戦の「60 星系」「遠征」は 360 試合で 0%、「統一」は何もしないと 100%、何もしないとお金が 500 年で約 7,900 万 cr。直す所は持ち主のレーンに知らせた (`docs/fun.md` の 7.2)。
- 回 DO1 の結果: **拡張の一強は、いまの main では遅れなしでも遅れつきでも出ない** (6 か国・150 年でも、地球だけ・150 年と 500 年でも)。遅れつきにすると拡張はむしろ崩れる (地球だけ・500 年の「入植の間隔なし」: 独立 4.6 → 10.6 回、平均点 314.5 → −11.4)。150 年では内政がいちばん多く勝つ (6 か国・遅れつきで 63%)。探索の最良は、どちらの形でも「交易路 6 本・近さで入植先を選ぶ」(+11〜17%)。
- 前のレーン B のセッション 4 (必勝法を探す AI と面白さの代わりの数を CI に) は #174 でマージした。セッション 5 の測る道具の分は回 DO3 (B-065)。
- いまの面白さの代わりの数 (回 R1): 判断 100 年あたり 8.0 回・待つだけの年 63%・内政が 50% の銀河で 1 位・探索の上積み +0% (`docs/restart-baseline.md` の 5)。

## 済んだ回

回が済んだら (その回の最後の PR で)、ここに 1 行足す (例: `- GA1 (#180)`)。`node tools/session-check.js` が、次の回を始めてよいかをこれで決める。

- DO1 (#187)
- DO2 (#189・#194)
- DO3 (#210)

## 次にやること

1. ~~回 DO1~~ (済み)。
2. ~~回 DO2~~ (済み)。もとの段取り: (B-069 の測り直しは `node tools/delay-report.js` と `node tools/search.js --delay` を使う。直す所の表に入れるもの: どの戦略でも 150 年で 5〜8 星系しか取れない・内政がいちばん多く勝つ・首都の交易路の本数 (3 本まで) が探索の上積みのほとんど・`fun.md` の 6.4 の光より速く知れる所): 壊れの測り直し (B-069)・面白さの物差しを F 系の目標に・CI の止める線 (B-071)。
3. ~~回 DO3~~ (済み)。試遊の本番 (B-062) で記録が集まったら `node tools/playlog-report.js <フォルダ>` を回す。

## 知らせ

(ほかのレーンからの知らせは、ここに 1 行ずつ)
- 2026-10-22 画面と最初の体験 (回 GA5・B-060) から: プレイ記録の形 (DO3 の道具が読むもの)。ホームの「記録を書き出す」のファイル = `{ app: 'nolongerubiquitous', edition, kind: 'playlog', exportedAt, sessions: [...] }`。セッションは `{ id, startedAt, seed, y0, y1, visibleMs, runningMs, pausedMs, idleMs, views: { 画面: ms }, vw, vh, ed, firsts: { colony, route, regime } (開いてからの秒), entries: [{ t: 開いてからの秒, y: ゲームの年, k, ... }], summary }`。`k` は act・set・fleet・fleetclear (命令)・speed・view・ui・home・idle (30 秒以上の操作なし。s = 秒)・memo (tag・text・snap・at・view)・first (what)。F04 は `firsts` の最小、F05 は止めていない間の命令の間隔、F03 は memo の confused と idle、F01・F02 は startedAt と visibleMs。同意 (QD-55 = a) した人だけが記録される。古い記録 (GA5 より前) には vw・vh・ed・firsts がない。
- 2026-10-22 画面と最初の体験 (回 GA4・B-058) から: 評論家の 2-6 の「結末の型の分布 (自動対戦)」を測るときは、`g.ending()` (`src/screen/eras-score.js`。状態を読むだけ) が `{ type: 'empire' | 'federation' | 'balance' | 'decline', label, causes, share, indep, loose }` を返す。手元の 10 試合 (300 年): 地球だけの銀河 4 つはどれも帝国の維持、6 か国の銀河 6 つは均衡 5・衰え 1、連邦への移行は 0 (AI の家臣の既定の型が自治の家族でないため)。

- 2026-10-22 政治 (回 SE2・B-026) から: 試験 `tools/tests/pacts.js` (遅れて届く外交) を足し、`tools/ci-tests.js` に落ちたら止める行として入れた。core は `commands.js` の `commandRaw` に 1 行 (命令 `pact`)、`game-loop.js` の `politicsYearly` に 1 行 (`diplomacyYearly`)。観戦の地球も協定を申し入れ・受けるので、判断を求められる回数 (面白さの代わりの数 1) に協定の申し入れが入る。

- 2026-10-22 画面と最初の体験 (回 GA2・B-048) から: 評論家の 0-7 の「1 時間あたりの重大な知らせの数を CI の表に出す」を道具の側でするときは、`src/screen/events-ui.js` の `railNews(g, g.knownEvents(), new Set(g.acked), () => false)` が、知らせの帯で目立たせる知らせ (自国に関わる・飢餓と不足は除く・同じ星系と種類の続報は束ねる・40 年に 12 件まで) をそのまま返す (`majors` と、予算を超えた件数 `over`)。40 年 ≈ 遊んで 1 時間。GA2 の手元の測り (銀河 1・4・9・11 × 300 年 × 6 か国): 前は 40 年あたり平均 78・最大 192 件、後は平均約 9・最大 12 件。
- 2026-10-22 政治 (回 SE1・#185) から: `tools/tests/save.js` の 1 を直した (ユーザーの許可あり。`docs/requests/2026-10-22-SE.md` の SE-2)。前は「回 R1 の前のゲームのセーブを読んで 40 年進めた筋が、前のゲームで続けた筋と同じ」を見ていたので、遊びを変えて乱数の並びが変わる PR は、どのレーンでもかならず落ちた。いまは「前のゲームのセーブがいまのゲームで読める」と「読んだものを保存して読み直しても、続けた筋が同じ (保存で何も落ちない)」を見る。前のゲームの筋との比べは外した。

## 気をつけること

- 遅れつきのボット (`humanize`) は、判断のあいだだけ `g.spectate` を切って `known` などを光の遅れで読む。ゲームの側で `known`・`seenBy`・`seenShips`・`knownAtWar`・`visibleDecisions` の形が変わったら、`tools/tests/strategy.js` (CI の `strategy`) で確かめる。
- 観戦の AI (`src/ship/earth-war.js` の `earthWarYearly`) を、`tools/strategy.js` が写している。船と戦争がそこを変えると、CI の表の「観戦の AI と同じ値の戦略が放任と同じ筋になった銀河」が減る。そのときは `strategy.js` を合わせ直す (どのレーンが直してもよい)。
- プレイ記録の形 (`src/screen/playlog.js`) を、`tools/playlog-report.js` が読む。画面と最初の体験が形を変えたら、`tools/tests/playlog.js` (CI の `playlog`) が落ちるので、道具を合わせる。
- `src/core/` の世話役: ほかのレーンが core を触る PR (登録の形か 1 行の呼び出し) を見て、core が太り続けないようにする。分けたファイルの間でメソッドを動かす PR は、中身を変えない 1 本にする (`docs/src-files.md` の 1)。
- CI は `node tools/src.js --ref origin/main` で main を 1 枚に組み立ててから比べる。
