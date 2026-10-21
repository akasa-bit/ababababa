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
function buildSave(game, extra = {}) {
  return {
    v: 2, seed: game.galaxy.seed, ...(game.galaxy.kind === 'real' ? { galaxy: 'real' } : {}), ...(game.galaxy.gen > 1 ? { gen: game.galaxy.gen } : {}), rs: game.rs, players: game.players, pi: game.pi,
    ...(game.nations ? { nations: game.nations.map(({ mods, ...n }) => n) } : {}), ...(game.handicap !== 'normal' ? { handicap: game.handicap } : {}), ...(game.pvPolicy ? { pvPolicy: game.pvPolicy } : {}), physics: game.physics, ...(game.productivity !== 1 ? { productivity: game.productivity } : {}), ...(game.pirateRaids?.length ? { pirateRaids: game.pirateRaids } : {}), ...(Object.keys(game.stackOwner).length ? { stackOwner: game.stackOwner } : {}), ...(game.ghosts.fleets.length ? { ghostFleets: game.ghosts.fleets } : {}), year: game.year, colonies: game.colonies, ships: game.ships,
    log: game.log, nextShipId: game.nextShipId, credits: game.credits, govs: game.govs, snaps: game.snaps, realmWars: game.realmWars, exhaustion: game.exhaustion, warStats: game.warStats, peaceOffers: game.peaceOffers, conferences: game.conferences, warBy: game.warBy, warNews: game.warNews, ...(Object.keys(game.intel).length ? { intel: game.intel } : {}), ...(game.aiOrders.length ? { aiOrders: game.aiOrders } : {}), ...(Object.keys(game.shipHist).length ? { shipHist: game.shipHist } : {}), peaces: game.peaces, held: game.held, sieges: game.sieges, battles: game.battles, stock: game.stock, market: game.market, absorb: game.absorb, unmet: game.unmet, util: game.util, tech: game.tech, ...(game.alpha !== undefined ? { alpha: game.alpha } : {}), ...(game.aif ? { aif: game.aif } : {}), routes: game.routes,
    cargo: game.cargo, projects: game.projects, requests: game.requests, events: game.events,
    outposts: game.outposts, auto: game.auto, autoTimer: game.autoTimer, spectate: game.spectate, autoDefense: game.autoDefense, autoAwe: game.autoAwe, awe: game.awe, autoGrant: game.autoGrant, autoBuild: game.autoBuild, migration: game.migration, autoRoutes: game.autoRoutes, troopMoves: game.troopMoves, wars: game.wars, warThreshold: game.warThreshold, autoHabitat: game.autoHabitat, migrants: game.migrants, migLog: game.migLog, garrison: game.garrison, fleets: game.fleets, natives: game.natives, infamy: game.infamy,
    surveyed: game.surveyed, pc: game.pc, council: game.council, policy: game.policy, decisions: game.decisions, story: game.story, era: game.era, challenges: game.challenges,
    acked: game.acked, endYear: game.endYear, ended: game.ended, endShown: !!game.endShown, supplied: game.supplied, finalScore: game.finalScore, stats: game.stats, savedAt: Date.now(), ...extra,
  };
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
