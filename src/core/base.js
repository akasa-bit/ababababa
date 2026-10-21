// 版: game = ゲーム版 (遊びやすさを保ったまま、なるべく現実に近づける)、sim = シミュレーション版 (なるべく現実のまま)。
// tools/build.mjs が版ごとに書き換えて、index.html と simulation.html を作る
const EDITION = 'game'; /* EDITION */
const GAME_NAME = 'NoLongerUbiquitous';
const EDITION_LABEL = { game: 'ゲーム版', sim: 'シミュレーション版' };
const EDITION_FILE = { game: 'index.html', sim: 'simulation.html' };
// 保存の名前 (版ごとに分ける。ゲーム版は前の名前 Moribin のころのセーブをそのまま読む)
const STORE = EDITION === 'sim' ? 'nlu-sim' : 'moribin';
const brandHtml = () => `${GAME_NAME}${EDITION === 'sim' ? `<span class="ed">${EDITION_LABEL.sim}</span>` : ''}`;
// 版ごとに違う値 (ここにあるものだけが違う)。根拠は docs/reality-check.md
const EDITIONS = {
  // hazardBase = 離反のハザードの基準 [/年] (植民地の存続年数の中央値に合わせて自動対戦で決めた)、delayExp = 通信の遅れ ÷ 1 世代のべき指数 (Cox モデル)、
  // regimeDelay = 統治体制ごとの遠さへの敏感さを使うか、garrisonWar = 艦隊が駐留していれば独立がかならず戦争になるか、growthCap = 人口の増え方の上限 [/年]、
  // declareDamp = 最後通牒の期限に独立する確率を、友好度と忠誠度でも下げるか
  // physics = 物理の切り替え (docs/physics.md の 10 の P6。2026-10-21 にゲーム版にも入れた): shield = 星間の気体と宇宙線の遮蔽 (船の質量に足す)、
  //   accel = 加速と減速にかかる時間、flare = M 型星のフレアと惑星の地表の被曝 (true = 入植適性も変える。'show' = 惑星の欄に出すだけで適性は変えない)、
  //   pv = フレアの陽子でスウォームの太陽電池が傷む (ゲーム版は保留。docs/physics.md の P10)。
  //   shield・accel・pv は試合ごとにセーブに入る (Game.physics。ないセーブは物理なしのまま続ける = PHYSICS_OFF)。flare は銀河を作るときに効くので版の値を使う
  game: { generation: 100, hazardBase: 0.6, delayExp: 0.33, regimeDelay: true, garrisonWar: true, growthCap: Infinity, declareDamp: true, physics: { shield: true, accel: true, flare: 'show', pv: false } },
  sim: { generation: 28, hazardBase: 1.3, delayExp: -0.15, regimeDelay: false, garrisonWar: false, growthCap: 0.042, declareDamp: false, physics: { shield: true, accel: true, flare: true, pv: true } },
};
const ED = EDITIONS[EDITION];
const PHYSICS_OFF = { shield: false, accel: false, flare: false, pv: false }; // 物理なし (物理を入れる前のセーブ)
const SIM_ONLY = EDITION === 'sim'; // シミュレーション版だけの物理 (途中の星系で止まる・進路変更の慣性・減速のエネルギー・海賊の出どころ・難民・M 型星の惑星の大気・空の背景。docs/sf-critiques.md)
// シード付き乱数 (mulberry32)。同じシードなら同じ銀河が生成される。
function hashSeed(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// 決まった計算 (どのブラウザでも同じ結果になる数学の関数)。四則と平方根 (IEEE 754 で結果が 1 つに決まる) と、ビットの読み書きだけで作る。
// Math.pow・Math.sin などはブラウザの版ごとに末尾の桁が違い、ネット対戦と画面なしの版 (tools/headless.js) で結果がずれる
const DMath = (() => {
  const buf = new DataView(new ArrayBuffer(8));
  const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, INV_LN2 = 1.44269504088896338700e+00, LN10 = 2.302585092994046;
  const PIO2_1 = 1.57079632673412561417e+00, PIO2_2 = 6.07710050630396597660e-11, PIO2_3 = 2.02226624871116645580e-21, INV_PIO2 = 6.36619772367581382433e-01;
  // 2^k (−1022 ≤ k ≤ 1023) をビットで作る
  const two = (k) => { buf.setUint32(0, (k + 1023) << 20); buf.setUint32(4, 0); return buf.getFloat64(0); };
  const scale = (y, k) => {
    while (k > 1023) { y *= two(1023); k -= 1023; }
    while (k < -1022) { y *= two(-1022); k += 1022; }
    return y * two(k);
  };
  function exp(x) {
    if (x !== x) return NaN;
    if (x > 709.782712893384) return Infinity;
    if (x < -745.1332191019412) return 0;
    const k = Math.floor(x * INV_LN2 + 0.5);
    const r = (x - k * LN2_HI) - k * LN2_LO; // |r| ≤ 0.347
    let p = 1;
    for (let n = 14; n >= 1; n--) p = 1 + (r * p) / n; // テイラー級数 (ホーナー法)
    return scale(p, k);
  }
  function log(x) {
    if (x !== x || x < 0) return NaN;
    if (x === 0) return -Infinity;
    if (x === Infinity) return Infinity;
    let e = 0;
    if (x < 2.2250738585072014e-308) { x *= 18014398509481984; e = -54; } // 非正規化数は 2^54 倍してから
    buf.setFloat64(0, x);
    const hi = buf.getUint32(0);
    e += ((hi >>> 20) & 0x7ff) - 1023;
    buf.setUint32(0, (hi & 0x000fffff) | 0x3ff00000);
    let m = buf.getFloat64(0); // 1 ≤ m < 2
    if (m > 1.4142135623730951) { m *= 0.5; e += 1; }
    return e * LN2_HI + (log1pK(m - 1) + e * LN2_LO);
  }
  // log(1 + f) (−0.3 ≤ f ≤ 0.42)。log(1 + f) = 2 atanh(s)、s = f / (2 + f)
  function log1pK(f) {
    const s = f / (2 + f), z = s * s;
    let R = 0;
    for (let n = 12; n >= 1; n--) R = z * (1 / (2 * n + 1) + R);
    return f - s * (f - 2 * R); // = 2s (1 + R)。2s = f − s f を使い、丸めを減らす
  }
  const log1p = (u) => (u >= -0.29 && u <= 0.41 ? log1pK(u) : log(1 + u));
  function pow(x, y) {
    if (y === 0) return 1;
    if (x !== x || y !== y) return NaN;
    if (Number.isInteger(y) && Math.abs(y) <= 1024) {
      let b = x, n = Math.abs(y), p = 1;
      while (n) { if (n & 1) p *= b; b *= b; n >>>= 1; }
      return y < 0 ? 1 / p : p;
    }
    if (x === 1) return 1;
    if (x === 0) return y > 0 ? 0 : Infinity;
    if (x === Infinity) return y > 0 ? Infinity : 0;
    if (x < 0) return Number.isInteger(y) ? (Math.abs(y) % 2 === 1 ? -1 : 1) * exp(y * log(-x)) : NaN;
    return exp(y * log(x));
  }
  // sin と cos: π/2 の整数倍を引いて |r| ≤ π/4 にし、テイラー級数で
  const sinK = (r) => { const z = r * r; let p = 0; for (let n = 19; n >= 3; n -= 2) p = (z / ((n) * (n - 1))) * (1 - p); return r - r * p; };
  const cosK = (r) => { const z = r * r; let p = 0; for (let n = 20; n >= 2; n -= 2) p = (z / (n * (n - 1))) * (1 - p); return 1 - p; };
  function reduce(x) {
    const k = Math.floor(x * INV_PIO2 + 0.5);
    return [((x - k * PIO2_1) - k * PIO2_2) - k * PIO2_3, ((k % 4) + 4) % 4];
  }
  function sin(x) {
    if (!Number.isFinite(x)) return NaN;
    const [r, q] = reduce(x);
    return q === 0 ? sinK(r) : q === 1 ? cosK(r) : q === 2 ? -sinK(r) : -cosK(r);
  }
  function cos(x) {
    if (!Number.isFinite(x)) return NaN;
    const [r, q] = reduce(x);
    return q === 0 ? cosK(r) : q === 1 ? -sinK(r) : q === 2 ? -cosK(r) : sinK(r);
  }
  const cbrt = (x) => (x < 0 ? -pow(-x, 1 / 3) : pow(x, 1 / 3));
  const log10 = (x) => log(x) / LN10;
  const atanh = (x) => 0.5 * log1p((2 * x) / (1 - x));
  const hypot = (...v) => Math.sqrt(v.reduce((k, a) => k + a * a, 0));
  return { exp, log, log1p, pow, sin, cos, cbrt, log10, atanh, hypot };
})();
// 試合と銀河の計算に使う数学 (GM)。ふだんは DMath。銀河の版 3 までの銀河を作り直すときだけ、作ったときと同じブラウザの Math を使う (古いセーブの銀河を変えない)
let GM = DMath;

class Rng {
  constructor(seed) {
    this.state = seed >>> 0;
  }
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  logUniform(a, b) { return GM.exp(this.range(GM.log(a), GM.log(b))); }
  normal(mu = 0, sigma = 1) {
    const u = 1 - this.next();
    const v = this.next();
    return mu + sigma * Math.sqrt(-2 * GM.log(u)) * GM.cos(2 * Math.PI * v);
  }
  poisson(lambda) {
    const L = GM.exp(-lambda);
    let k = 0;
    let p = 1;
    do { k++; p *= this.next(); } while (p > L);
    return k - 1;
  }
  weighted(items, weightOf) {
    const total = items.reduce((s, it) => s + weightOf(it), 0);
    let r = this.next() * total;
    for (const it of items) {
      r -= weightOf(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

