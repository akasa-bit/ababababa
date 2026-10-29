// 人間が動かす首都の赤字の上限 (1 年に出せる国債 ÷ GDP。財政の画面で選ぶ。DEFICIT_RANGE)。0 は国債を出さない
const POLICY_COST = 20;
const POLICY_YEARS = 30; // 国家方針を変えられる間隔
// 不満の段階: 1 不満 (離反の起きやすさ HAZARD に従って起きる) → UNREST_YEARS 年続くと 2 要求 (減税・自治を主人へ求める)
// → 拒まれると 3 最後通牒 (ULTIMATUM_YEARS 年後に、恐怖度・友好度に応じた確率で独立を宣言する)
const UNREST_LABEL = { 1: '不満', 2: '要求', 3: '最後通牒' };
const UNREST_AT = 30; // 忠誠度がこれ未満なら、画面で低いと示す
const UNREST_CALM = 40; // 不満が収まる忠誠度の下限 (calmAtOf)
const UNREST_YEARS = 10;
const ULTIMATUM_YEARS = 10;
const CONCESSION_YEARS = 30; // 要求をのんだときの減税・自治の期間
// AI の主人が家臣の要求をのむか (QD-41 = c・B-142。docs/demands.md)。のむ見込み = 1 ÷ (1 + exp(−z))、
// z = size × (ln 人口の割合 − ref.size) + dist × (ln (主人からの距離 ÷ 国の広がり) − ref.dist) + risk × (拒んだら独立を宣言する見込み − ref.risk)。
// 3 つの傾きは、自決を求める運動が続いている集団・年に、政府が自治か権力の分け前を譲った年を当てたロジット (Germann & Sambanis 2021 の再現データ・GeoEPR 2021・
// CShapes 2.0。263 集団・7,774 集団・年・譲った年 139。data/build/analyze_demands.py)。実データの「見込み」は前の年に武力の紛争があったか (0 か 1) で、ゲームは見込み (0〜1) を入れる。
// 基準 ref はゲームの AI の要求の材料の平均 (のむ割合の平均を、席を持つ前の AI の国の半々にそろえる。12 銀河 × 300 年で 2 回合わせた。tools/demands-panel.js・docs/demands.md の 3)
const DEMAND_AI = { size: 0.246, dist: 0.363, risk: 0.712, ref: { size: -8.57, dist: -0.568, risk: 0.475 } };
const demandAcceptOf = ({ share, rel, risk }) => 1 / (1 + GM.exp(-(DEMAND_AI.size * (GM.log(share) - DEMAND_AI.ref.size) + DEMAND_AI.dist * (GM.log(rel) - DEMAND_AI.ref.dist) + DEMAND_AI.risk * (risk - DEMAND_AI.ref.risk))));
const NEGLECT_GRACE = 10; // 主人の関与 (指令・援助・艦隊・視察) が途絶えてこの年数を過ぎると、忠誠度の目標が年 NEGLECT_RATE ずつ下がる (最大 −NEGLECT_MAX)
const NEGLECT_RATE = 1.5;
const NEGLECT_MAX = 0; // 2026-10-23 のユーザーの決定で、放っておかれても忠誠度は下がらない (前は 60。この値を戻せば元に戻る)
// 星系の政府が決めたこと (gv.did。総督の手紙の「なぜ」。回 SE4): 直近 years 年ぶん、多くて max 件だけ持つ
const GOV_DID = { years: 10, max: 8 };
// 議会の支持 (0〜100)。毎年0.25ずつ下がり (いら立ち)、時代の課題を果たすと上がる。政治力の増え方を左右し、15を割ると政権交代
const COUNCIL_START = 60;
const ERA_YEARS = 100;
// 終わりの年 (点数を出す)。0 なら終わらない
const END_CHOICES = [[500, '500年 (2800年まで)'], [300, '300年 (2600年まで)'], [0, '終わりなし']];
// 挑戦 (新しいゲームで選ぶ。互いに引っ張り合う)
const CHALLENGES = {
  sixty: { label: '60星系', desc: '終わりの年までに、地球の国を60星系以上にする' },
  loyal: { label: '独立を許さない', desc: '地球の国から一度も独立を許さない' },
  unify: { label: '統一', desc: '終わりの年に独立国が1つも残っておらず、地球の国が15星系以上ある', min: 15 }, // min: 何もしないで果たせないように (QD-39 = a)
  far: { label: '遠征', desc: '太陽系から40光年より遠くに地球の国の星系を持つ' },
};
const relLabel = (r) => (r >= 60 ? '友好' : r >= 20 ? '好意的' : r >= -20 ? '中立' : r >= -60 ? '警戒' : '敵対');
const fail = (reason) => ({ ok: false, reason });

