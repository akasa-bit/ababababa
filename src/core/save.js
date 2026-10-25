// --- セーブ ---
// 保存先は IndexedDB (大きなセーブも入る。localStorage は全部で約500万文字までで、大きな帝国では入りきらない)。
// IndexedDB が使えない環境では localStorage を使う。古い版が localStorage に残したセーブは、起動時に IndexedDB へ移す
const SAVE_KEY = `${STORE}-save-v1`;
const Store = {
  db: null,
  ready: false,
  meta: {}, // スロットの概要 { [キー]: { year, sys, seed, spectate, savedAt } } (ホーム画面で毎回セーブ全体を読まないように)
  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open(STORE, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      navigator.storage?.persist?.().catch(() => {}); // 消されにくくする (できれば)
    } catch { this.db = null; }
    if (this.db) {
      for (const k of [SAVE_KEY, ...SLOT_KEYS]) {
        let t = null;
        try { t = localStorage.getItem(k); } catch { /* 使えない環境 */ }
        if (t && await this.put(k, t)) { try { localStorage.removeItem(k); } catch { /* 使えない環境 */ } }
      }
    }
    for (const k of SLOT_KEYS) { const t = await this.get(k); this.meta[k] = t ? saveMeta(parseSave(t)) : null; }
    NationLib.parse(await this.get(NationLib.key));
    this.ready = true;
  },
  get(k) {
    if (!this.db) { try { return Promise.resolve(localStorage.getItem(k)); } catch { return Promise.resolve(null); } }
    return new Promise((res) => {
      try {
        const r = this.db.transaction('kv').objectStore('kv').get(k);
        r.onsuccess = () => res(r.result ?? null);
        r.onerror = () => res(null);
      } catch { res(null); }
    });
  },
  put(k, v) {
    if (!this.db) { try { localStorage.setItem(k, v); return Promise.resolve(true); } catch { return Promise.resolve(false); } }
    return new Promise((res) => {
      try {
        const t = this.db.transaction('kv', 'readwrite');
        t.objectStore('kv').put(v, k);
        t.oncomplete = () => res(true);
        t.onerror = t.onabort = () => res(false);
      } catch { res(false); }
    });
  },
  del(k) {
    if (!this.db) { try { localStorage.removeItem(k); } catch { /* 使えない環境 */ } return Promise.resolve(true); }
    return new Promise((res) => {
      try {
        const t = this.db.transaction('kv', 'readwrite');
        t.objectStore('kv').delete(k);
        t.oncomplete = () => res(true);
        t.onerror = t.onabort = () => res(false);
      } catch { res(false); }
    });
  },
};
// セーブの概要 (ホーム画面の表示用)
function saveMeta(d) {
  if (!d) return null;
  return { year: d.year, sys: new Set((d.colonies || []).map((c) => c.sys)).size, seed: d.seed, spectate: !!d.spectate, savedAt: d.savedAt };
}
// 2026-10-21 (回 R3) までのセーブの項目。前の buildSave と同じ順に並べてある。並びの順がそのままセーブの JSON の並びになり、
// 状態の要約 (Net.hash・tools/headless.js の hash) もこの順で作るので、この一覧は足さない・並べ替えない・消さない。
// 新しい項目は、その仕組みのファイルで saveField(…) を呼んで足す (SAVE_FIELDS。core/base.js)。値が undefined の項目は書かない (前の { …(条件 ? { k: v } : {}) } と同じ)
const SAVE_LEGACY = [
  ['v', (game) => 2],
  ['seed', (game) => game.galaxy.seed],
  ['galaxy', (game) => (game.galaxy.kind === 'real' ? 'real' : undefined)],
  ['gen', (game) => (game.galaxy.gen > 1 ? game.galaxy.gen : undefined)],
  ['rs', (game) => game.rs],
  ['players', (game) => game.players],
  ['pi', (game) => game.pi],
  ['nations', (game) => (game.nations ? game.nations.map(({ mods, ...n }) => n) : undefined)],
  ['handicap', (game) => (game.handicap !== 'normal' ? game.handicap : undefined)],
  ['pvPolicy', (game) => (game.pvPolicy ? game.pvPolicy : undefined)],
  ['physics', (game) => game.physics],
  ['productivity', (game) => (game.productivity !== 1 ? game.productivity : undefined)],
  ['pirateRaids', (game) => (game.pirateRaids?.length ? game.pirateRaids : undefined)],
  ['stackOwner', (game) => (Object.keys(game.stackOwner).length ? game.stackOwner : undefined)],
  ['ghostFleets', (game) => (game.ghosts.fleets.length ? game.ghosts.fleets : undefined)],
  ['year', (game) => game.year],
  ['colonies', (game) => game.colonies],
  ['ships', (game) => game.ships],
  ['log', (game) => game.log],
  ['nextShipId', (game) => game.nextShipId],
  ['credits', (game) => game.credits],
  ['govs', (game) => game.govs],
  ['snaps', (game) => game.snaps],
  ['realmWars', (game) => game.realmWars],
  ['exhaustion', (game) => game.exhaustion],
  ['warStats', (game) => game.warStats],
  ['peaceOffers', (game) => game.peaceOffers],
  ['conferences', (game) => game.conferences],
  ['warBy', (game) => game.warBy],
  ['warNews', (game) => game.warNews],
  ['intel', (game) => (Object.keys(game.intel).length ? game.intel : undefined)],
  ['aiOrders', (game) => (game.aiOrders.length ? game.aiOrders : undefined)],
  ['shipHist', (game) => (Object.keys(game.shipHist).length ? game.shipHist : undefined)],
  ['peaces', (game) => game.peaces],
  ['held', (game) => game.held],
  ['sieges', (game) => game.sieges],
  ['battles', (game) => game.battles],
  ['stock', (game) => game.stock],
  ['market', (game) => game.market],
  ['absorb', (game) => game.absorb],
  ['unmet', (game) => game.unmet],
  ['util', (game) => game.util],
  ['tech', (game) => game.tech],
  ['alpha', (game) => (game.alpha !== undefined ? game.alpha : undefined)],
  ['gpts', (game) => (game.gpts?.length ? game.gpts : undefined)], // 汎用技術 (GPT。回 KE6。経済の gptStep)
  ['aif', (game) => (game.aif ? game.aif : undefined)],
  ['routes', (game) => game.routes],
  ['cargo', (game) => game.cargo],
  ['projects', (game) => game.projects],
  ['requests', (game) => game.requests],
  ['events', (game) => game.events],
  ['outposts', (game) => game.outposts],
  ['auto', (game) => game.auto],
  ['autoTimer', (game) => game.autoTimer],
  ['spectate', (game) => game.spectate],
  ['autoDefense', (game) => game.autoDefense],
  ['autoAwe', (game) => game.autoAwe],
  ['awe', (game) => game.awe],
  ['autoGrant', (game) => game.autoGrant],
  ['autoBuild', (game) => game.autoBuild],
  ['migration', (game) => game.migration],
  ['autoRoutes', (game) => game.autoRoutes],
  ['troopMoves', (game) => game.troopMoves],
  ['wars', (game) => game.wars],
  ['warThreshold', (game) => game.warThreshold],
  ['autoHabitat', (game) => game.autoHabitat],
  ['migrants', (game) => game.migrants],
  ['migLog', (game) => game.migLog],
  ['garrison', (game) => game.garrison],
  ['fleets', (game) => game.fleets],
  ['natives', (game) => game.natives],
  ['infamy', (game) => game.infamy],
  ['surveyed', (game) => game.surveyed],
  ['pc', (game) => game.pc],
  ['council', (game) => game.council],
  ['policy', (game) => game.policy],
  ['decisions', (game) => game.decisions],
  ['story', (game) => game.story],
  ['era', (game) => game.era],
  ['challenges', (game) => game.challenges],
  ['acked', (game) => game.acked],
  ['endYear', (game) => game.endYear],
  ['ended', (game) => game.ended],
  ['endShown', (game) => !!game.endShown],
  ['supplied', (game) => game.supplied],
  ['finalScore', (game) => game.finalScore],
  ['stats', (game) => game.stats],
];
function buildSave(game, extra = {}) {
  const d = {};
  for (const [k, write] of SAVE_LEGACY) { const v = write(game); if (v !== undefined) d[k] = v; }
  for (const f of SAVE_FIELDS) { const v = f.write(game); if (v !== undefined) d[f.key] = v; }
  return { ...d, savedAt: Date.now(), ...extra };
}
// セーブデータの JSON (JSON.stringify(buildSave(...)) と同じ文字列)。いちばん大きい星系の記録は、記録ごとの JSON を使い回してつなぐ
function saveJSON(game, extra) {
  const d = buildSave(game, extra);
  const snaps = d.snaps;
  if (!snaps || typeof snaps !== 'object') return JSON.stringify(d);
  d.snaps = '\u0000SNAPS\u0000';
  const head = JSON.stringify(d);
  const parts = [];
  for (const k of Object.keys(snaps)) {
    const v = snaps[k];
    if (Array.isArray(v)) parts.push(`${JSON.stringify(k)}:[${v.map(snapJSON).join(',')}]`);
    else { const t = JSON.stringify(v); if (t !== undefined) parts.push(`${JSON.stringify(k)}:${t}`); }
  }
  const body = `{${parts.join(',')}}`;
  return head.replace('"\\u0000SNAPS\\u0000"', () => body);
}
function parseSave(text) {
  try {
    const d = JSON.parse(text);
    return d && typeof d === 'object' && d.seed !== undefined && Number.isFinite(d.year) ? d : null;
  } catch { return null; }
}
// 自動セーブ。前に書いた中身と同じ (一時停止中など) なら書き込みを省く (大きなセーブの書き込みは重いので)。
// 比べるときは保存時刻 (savedAt) を除き、書くときに今の時刻を入れる
// 保存先の準備ができるまでは書かない (起動直後の仮のゲームで、本当のセーブを上書きしないように)。
// 書き込みは非同期で、失敗したら次の自動セーブで書き直す
let lastSaved = null;
let saveFailed = false;
function writeSave(game, extra) {
  if (!Store.ready) return true;
  try {
    const cmp = saveJSON(game, { ...extra, savedAt: 0 });
    if (cmp === lastSaved) return !saveFailed;
    lastSaved = cmp;
    Store.put(SAVE_KEY, cmp.replace(/"savedAt":0(?=[,}])/, () => `"savedAt":${Date.now()}`)).then((ok) => {
      saveFailed = !ok;
      if (!ok) { lastSaved = null; $('savestat').textContent = 'セーブできなかった (保存容量が足りないか、この環境では保存できない)'; }
    });
    return !saveFailed;
  } catch { lastSaved = null; return false; }
}
// 古い版が localStorage に残した自動セーブ (起動時にすぐ読めるもの)
function readLegacySave() {
  try { const t = localStorage.getItem(SAVE_KEY); return t ? parseSave(t) : null; } catch { return null; }
}
function clearSave() {
  lastSaved = null;
  Store.del(SAVE_KEY);
}
