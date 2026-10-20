// 画面なしで回せる版: src/index.html の <script> を Node の vm で動かし、試合の中身 (Game) だけを使う。
// 画面の部分 (canvas・ボタン・保存) は、何をしても何も起きない代わりの物 (stub) で受け流す。ブラウザと同じ式・同じ乱数なので、
// 同じシード・同じ手順なら、公開用の index.html と同じ状態になる (tools/tests/headless.js で確かめる)。
// 使い方 (ほかの道具から): const H = require('./headless'); const sim = H.load({ params }); const g = sim.newGame('1', { nations: 6 });
// 使い方 (コマンド): node tools/headless.js <シード> <年数> [国の数] [値のファイル.json]   → 要約と状態の要約 (hash) を JSON で出す
// 値のファイル: { "表の名前": { "項目": 値, … }, … } を、試合を作る前に表へ重ねて書く (例: { "ED": { "hazardBase": 0.8 }, "TRADE": { "rate": 0.02 } })。
//   書き換えられるのは、名前が大文字の、表 (オブジェクトか配列) の定数だけ (STEP のような数の定数は変えられない)。
//   読み込みのときに表から計算してしまう値 (E_UNIT = PROP からの 1 便のエネルギー など) は、書き換えても変わらない。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'index.html');

// 何を呼んでも、何を読んでも、自分と同じ物を返す代わりの物 (画面の部品の代わり)
function stub() {
  const f = function () {};
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then' || k === 'length') return k === 'length' ? 0 : undefined;
      if (!(k in t)) t[k] = stub();
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return stub(); },
    construct() { return stub(); },
  });
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}

// 重ねて書く (値のファイル)。配列とオブジェクトは中まで、ほかは置き換える
function overlay(dst, src, where) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') overlay(dst[k], v, `${where}.${k}`);
    else {
      if (!(k in dst)) throw new Error(`値のファイル: ${where}.${k} はない`);
      dst[k] = v;
    }
  }
}

// edition = 'sim' なら、シミュレーション版として読む (src の EDITION の行を書き換える。build.mjs と同じ)
function load({ src = SRC, params = null, edition = null } = {}) {
  let html = fs.readFileSync(src, 'utf8');
  if (edition) html = html.replace("const EDITION = 'game'; /* EDITION */", `const EDITION = '${edition}';`);
  const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const names = [...js.matchAll(/^const ([A-Z][A-Z0-9_]*) = [{[]/gm)].map((m) => m[1]).concat(['ED']); // ED = この版の EDITIONS の値
  const base = {
    console, Math, JSON, Date, Promise, URLSearchParams, TextDecoder, TextEncoder, structuredClone,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance: { now: () => 0 },
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    location: { search: '?home=0', href: 'file:///index.html', hash: '', protocol: 'file:', pathname: '/index.html' },
    history: { replaceState() {} },
  };
  // 知らない名前 (document・canvas・indexedDB など) は代わりの物を返す。JavaScript の組み込みは Node のものを使う
  const ctx = new Proxy(base, {
    has: () => true,
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      if (k in globalThis && !['process', 'require', 'module', 'exports', 'global'].includes(k)) return globalThis[k];
      return (t[k] = stub());
    },
  });
  base.window = ctx; base.globalThis = ctx; base.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(`${js}\n;globalThis.__nlu = { Game, generateGalaxy, buildSave, GALAXY_GEN, EDITION, tables: { ${names.join(', ')} } };`, ctx, { filename: 'index.html.js' });
  const N = base.__nlu;
  if (params) overlay(N.tables, params, '値');
  return {
    ...N,
    // ページの中で式を評価する (試験用の let の値 MASS_AUDIT・MONEY_AUDIT などを読み書きする)
    evaluate: (code) => vm.runInContext(code, ctx),
    // 新しい試合 (ゲームの newGame と同じ銀河)。nations を渡すと国家選択のある試合にし、プレイヤーの国も AI に任せる (観戦)
    newGame(seed, { nations = 0, spectate = true } = {}) {
      const g = new N.Game(N.generateGalaxy({ seed: String(seed), starCount: 400, meanSpacing: 4, kind: 'real', gen: N.GALAXY_GEN }));
      if (nations) { g.foundNations(nations); g.setPlayerNation(g.nations[1].cap); }
      if (spectate) g.setSpectate(true);
      return g;
    },
    // 年数ぶん進める (画面と同じく 0.25 年ずつ)
    run(g, years) { for (let i = 0; i < Math.round(years * 4); i++) g.advance(0.25); return g; },
    // 状態の要約 (ネット対戦の Net.hash と同じ作り方。保存した時刻は除く)
    hash(g) {
      const d = { ...N.buildSave(g) };
      delete d.savedAt;
      const t = JSON.stringify(d);
      let h = 0x811c9dc5;
      for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return (h >>> 0).toString(36);
    },
  };
}

// 試合の要約 (人が読む用)
function summary(g) {
  const realms = new Set(g.colonies.map((c) => g.realmOf(c.sys)));
  return {
    year: Math.round(g.year), colonies: g.colonies.length, systems: new Set(g.colonies.map((c) => c.sys)).size, realms: realms.size,
    pop: Math.round(g.colonies.reduce((k, c) => k + c.pop, 0)), wars: Object.keys(g.realmWars).length,
  };
}

module.exports = { load, summary };

if (require.main === module) {
  const [seed = '1', years = '100', nations = '6', paramFile] = process.argv.slice(2);
  const sim = load({ params: paramFile ? JSON.parse(fs.readFileSync(paramFile, 'utf8')) : null });
  const t0 = Date.now();
  const g = sim.run(sim.newGame(seed, { nations: Number(nations) }), Number(years));
  console.log(JSON.stringify({ seed, ...summary(g), hash: sim.hash(g), ms: Date.now() - t0 }));
}
