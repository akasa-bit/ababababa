// 入植集団が続くか (回 FU3・B-033。決まった案 12-3 a。docs/colony.md)。
// 1 人ずつの年ごとのモンテカルロ (Marin & Beluffi 2018 の HERITAGE と同じ形): 毎年、寿命か事故で亡くなり、出産の年齢の女ごとに同じ年齢の幅の男をくじで 1 人選び、
// 不妊・近親 (depth 代前までの共通の祖先から出す近交係数 F)・妊娠の確率を見て子が生まれる (双子もある)。人数が定員 × security より少ないあいだだけ出産を許し、
// 女 1 人の子の数の上限は N(kids)。近親の子 (F > 0) の寿命は inbredLife の割合だけ短い。災害の年に share の人が亡くなる。
// 前提 HERITAGE = 論文の表 1 と 2.2〜2.4 (6,300 年・定員 500・出産 32〜40 歳・近親婚なし・2,500 年目に 30% を失う災害)。目標 R17 の再現 (tools/tests/colony.js)
// 本文に書いていない 2 つ (近親を数える代の深さ depth と、近親なら相手を選び直す回数 tries) は、表 1 の前提で 25 組の結果 (50 ± 15%) が出る値にした (docs/colony.md)。
// settle 年を過ぎて人数が定員の security の 8 割以上なら、そこで「続いた」とする (論文: 1,000 年を過ぎると失敗は 1 つもない。最後まで回したときと 8 つの種で同じ割合 (25 組で 0.53 と 0.53)、計算は 10 分の 1)
const HERITAGE = { years: 6300, capacity: 500, security: 0.9, age0: [20, 1], infertile: { f: 0.1, m: 0.15 }, kids: [3, 1], twins: 0.015, life: { f: [85, 15], m: [79, 15] },
  window: [32, 40], pregnancy: 0.75, consanguinity: 0, inbredLife: 0.5, accident: 0.001, disaster: { year: 2500, share: 0.3 }, depth: 3, tries: 7, settle: 300 };
// 入植地の前提 (ゲームの中の失敗の確率): 惑星に降りた入植集団は、住む場所の上限より十分少ないので出産を止めない。出産は 20〜40 歳、近親は いとこ (F 1/16) まで認める、災害なし。
// 人数が done 人に届けば続くとみなす (そこから先は、ゲームの人口の式と恒星間移民で増える)
const COLONY_RISK = { ...HERITAGE, years: 300, capacity: 1e9, window: [20, 40], consanguinity: 1 / 16, disaster: null, done: 2000, runs: 200 };
// Smith 2014 (Acta Astronautica 97): 150 年 (5 世代) のあいだ遺伝の多様性を保ち、人口の半分ほどを失う災害も見込むと 14,000〜44,000 人 (安全な値 40,000 人・有効な集団 23,400 人)。
// 統計の掛け算で出した値で、計算の中身は要旨に出ていない (Marin & Beluffi 2018 の 3.1 節)。ゲームは結論を幅のまま持つ (目標 R17 の版 26)
const SMITH = { min: 14000, max: 44000, safe: 40000, ne: 23400, years: 150 };

// 1 回の旅 (または入植地の始まり)。n = 始めの人数 (男女半々)。戻り値 = { alive (終わりの人数), year (絶えた年。続いたら null), peak }
function heritageRun(n, P, rng) {
  const D = P.depth;
  const sex = [], born = [], dies = [], infert = [], target = [], kids = [], anc = [];
  const cohort = new Map(); // 生まれた年 → その年に生まれた人の番号
  const deaths = new Map(); // 亡くなる年 → 番号
  const dead = [];
  let alive = 0, peak = 0;
  const addDeath = (i, y) => { const k = Math.max(y, 0); (deaths.get(k) || deaths.set(k, []).get(k)).push(i); };
  const person = (s, y, a, F, m, f) => {
    const i = sex.length;
    sex.push(s); born.push(y); infert.push(rng.next() < (s ? P.infertile.f : P.infertile.m)); kids.push(0);
    target.push(s ? Math.max(0, Math.round(rng.normal(P.kids[0], P.kids[1]))) : 0);
    const L = P.life[s ? 'f' : 'm'];
    let life = rng.normal(L[0], L[1]);
    if (F > 0) life *= 1 - P.inbredLife;
    const acc = P.accident > 0 ? Math.floor(GM.log(1 - rng.next()) / GM.log(1 - P.accident)) : Infinity; // 事故で亡くなる年 (年 accident の確率)
    const age = a ?? 0;
    const d = born[i] + Math.max(age + 0.5, Math.min(life, age + acc + 0.5));
    dies.push(d); dead.push(false);
    addDeath(i, Math.floor(d));
    // depth 代前までの祖先と、いちばん近い代 (近交係数を出すため)
    const A = new Map();
    if (m !== undefined) {
      A.set(m, 1); A.set(f, 1);
      for (const p of [m, f]) for (const [x, k] of anc[p]) if (k < D && !(A.get(x) <= k + 1)) A.set(x, k + 1);
    }
    anc.push(A);
    (cohort.get(Math.floor(y)) || cohort.set(Math.floor(y), []).get(Math.floor(y))).push(i);
    alive++;
    return i;
  };
  // 近交係数 F (2 人の子の): 共通の祖先 A ごとに (1/2)^(a までの代 + b までの代 + 1)。片方が他方の祖先なら (1/2)^(代 + 1)
  // limit を超えたら、そこで足すのをやめる (近親かどうかだけ知りたいとき)
  const kinF = (a, b, limit = Infinity) => {
    const Aa = anc[a], Ab = anc[b];
    let F = 0;
    if (Ab.has(a)) F += 0.5 ** (Ab.get(a) + 1);
    if (Aa.has(b)) F += 0.5 ** (Aa.get(b) + 1);
    if (F > limit) return F;
    const [s, l] = Aa.size < Ab.size ? [Aa, Ab] : [Ab, Aa];
    for (const [x, k] of s) { const j = l.get(x); if (j !== undefined) { F += 0.5 ** (k + j + 1); if (F > limit) return F; } }
    return F;
  };
  for (let i = 0; i < n; i++) { const a = Math.max(0, rng.normal(P.age0[0], P.age0[1])); person(i % 2 === 0 ? 1 : 0, -a, a, 0); } // 始めの人は 0 年に age0 歳 (男女半々)
  for (let y = 0; y < P.years; y++) {
    for (const i of deaths.get(y) || []) if (!dead[i] && dies[i] < y + 1) { dead[i] = true; alive--; }
    deaths.delete(y);
    if (P.disaster && y === P.disaster.year) for (let i = 0; i < sex.length; i++) if (!dead[i] && rng.next() < P.disaster.share) { dead[i] = true; alive--; }
    if (alive <= 0) return { alive: 0, year: y, peak };
    if (P.done && alive >= P.done) return { alive, year: null, peak: Math.max(peak, alive) };
    if (P.settle && y >= P.settle && alive >= 0.8 * P.capacity * P.security) return { alive, year: null, peak: Math.max(peak, alive) };
    peak = Math.max(peak, alive);
    if (alive >= P.capacity * P.security) continue; // 定員の security に届いたら、出産を止める
    const women = [], men = [];
    for (let b = y - P.window[1]; b <= y - P.window[0]; b++) for (const i of cohort.get(b) || []) if (!dead[i]) (sex[i] ? women : men).push(i);
    if (!women.length || !men.length) continue;
    for (const w of women) {
      if (infert[w] || kids[w] >= target[w]) continue;
      // 相手は出産の年齢の男からくじで。近親なら tries 回まで選び直す
      let m = -1, F = 0;
      for (let t = 0; t < P.tries; t++) { const x = men[Math.floor(rng.next() * men.length)]; const f = kinF(w, x, P.consanguinity + 1e-12); if (f <= P.consanguinity + 1e-12) { m = x; F = f; break; } }
      if (m < 0 || infert[m]) continue;
      if (rng.next() >= P.pregnancy) continue;
      const k = rng.next() < P.twins ? 2 : 1;
      for (let t = 0; t < k; t++) person(rng.next() < 0.5 ? 1 : 0, y + 1, 0, F, w, m);
      kids[w] += k;
    }
  }
  return { alive, year: alive > 0 ? null : P.years, peak };
}
// runs 回の旅で絶えた割合 (決まった乱数。試合の乱数は使わない)
function heritageRate(n, P = HERITAGE, runs = 100, seed = 1) {
  const rng = new Rng(hashSeed(`heritage/${n}/${seed}`));
  let extinct = 0;
  for (let r = 0; r < runs; r++) if (heritageRun(n, P, rng).alive <= 0) extinct++;
  return extinct / runs;
}
// 入植地が始まりのうちに絶える確率。設計で選べる人数 (98 人から) は、上の式 (heritageRate(n, COLONY_RISK, 200)) で計算した表 COLONY_FAIL を使う
// (1 つの人数に数秒かかるので画面では計算しない。tools/tests/colony.js が表と式を照らす)。表より少ない人数 (前の版の船など) だけ、その場で計算して覚える
const COLONY_FAIL = { 98: 0, 200: 0, 500: 0, 1000: 0 }; // 2026-10-28 に計算。20 人で 0.01・50 人で 0
const COLONY_RISK_MEMO = new Map();
function colonyFailP(n) {
  const k = Math.round(n);
  if (k >= COLONY_RISK.done) return 0;
  const keys = Object.keys(COLONY_FAIL).map(Number).filter((x) => x <= k);
  if (keys.length) return COLONY_FAIL[Math.max(...keys)];
  if (!COLONY_RISK_MEMO.has(k)) COLONY_RISK_MEMO.set(k, heritageRate(k, COLONY_RISK, COLONY_RISK.runs));
  return COLONY_RISK_MEMO.get(k);
}

// 入植船の設計 (B-033。決まった案 12-1 b・12-2 b・12-4 a・10-4 b。docs/proposals/12-ship.md・docs/colony.md)。速さ・乗る人数・積み荷・乗る人の年齢を国ごとに選ぶ。
// 船の質量 = 住む場所 (乗る人 × habitatKg の工業品) + 積み荷 + 食料と水 + 乗る人。遮蔽は物理の形 (shieldOf) で足し、推進は前と同じく bookShip で記帳する。
// 費用の資金 = 住む場所の工業品 1 単位あたり credits + 開拓資金 (SEED_FUNDS)。AI の国はひな形の「小」のまま
const SHIP_DESIGN = {
  crew: [98, 44000], // 乗る人 [人]: HERITAGE (Marin & Beluffi 2018) の 98 人 〜 Smith 2014 の上端 44,000 人
  crews: [98, 200, 500, 1000, 2000, 5000, 10000, 20000, 40000, 44000], // 画面で選べる人数
  habitatKg: 2.5e5, // 1 人あたりの住む場所 (船の構造) [kg]。前の入植船と同じ 250 t (仮の値。docs/energy.md の 3)
  credits: 3, // 住む場所の工業品 1 単位あたりの費用 [cr] (前の入植船の 300 cr ÷ 工業品 100 単位)
  speeds: { std: '標準 (交易路 0.95c・外 0.9c)', 0.7: '0.7c', 0.5: '0.5c' },
  cargos: [0, 1, 5, 10, 30], // 積んでいく工業品 [単位] (着いたら入植地の備蓄になる)
  ages: { migrant: '国連の国際移民の年齢 (標準)', young: '働き手と子ども', home: '送り出す星系と同じ' },
};
const POP_FLOOR = 1e-5; // 入植地の人口の下限 [百万人] = 10 人 (前は 0.001 = 1,000 人で、設計の 500 人の入植地が 1,000 人に持ち上がった)
const fmtPeople = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 人`; // 人数 (端末によらない書式。記録に入るので toLocaleString は使わない)
const SHIP_TEMPLATES = {
  small: { label: '小 (標準)', crew: 500, speed: 'std', cargo: 0, ages: 'migrant' },
  mid: { label: '中', crew: 10000, speed: 'std', cargo: 5, ages: 'migrant' },
  large: { label: '大', crew: 40000, speed: 0.7, cargo: 10, ages: 'migrant' },
};
// 乗る人の年齢の形 (5 歳きざみの区分ごとの割合。DEMO はこのファイルより後で決まるので、使うときに作る)。young = 国際移民の形のうち、子ども (0〜14 歳) と働き盛り (20〜39 歳) だけ
const ageShape = (k) => (k === 'young' ? DEMO.migrant.map((v, a) => (a <= 2 || (a >= 4 && a <= 7) ? v : 0)) : DEMO.migrant);
// 国ごとの設計 { [国の首都]: { crew, speed, cargo, ages } } (ないときはひな形の「小」)
saveField('designs', (game) => (Object.keys(game.designs).length ? game.designs : undefined), {
  init: (game) => { game.designs = {}; },
  read: (game, d) => { game.designs = d.designs && typeof d.designs === 'object' ? d.designs : {}; },
});
