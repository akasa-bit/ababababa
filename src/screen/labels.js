const TYPE_LABEL = {
  rocky: '岩石惑星', 'mini-neptune': 'ミニ・ネプチューン', 'gas-giant': 'ガス巨星', 'ice-giant': '氷巨星',
  dwarf: '矮小天体', belt: '小惑星帯',
};
const SURFACE_LABEL = {
  molten: '溶岩の海', scorched: '灼熱の乾燥地表', frozen: '氷に閉ざされた地表', temperate: '温暖(陸と海)',
  ocean: '海洋が広がる', desert: '乾燥した荒地', barren: '大気のない岩盤',
};
const BODY_COLOR = {
  molten: '#ff5a1f', scorched: '#c27a3a', frozen: '#cfe8f3', temperate: '#4d9a5b', ocean: '#3b82c4',
  desert: '#c9a063', barren: '#9a9a9a',
};
const TYPE_COLOR = {
  'mini-neptune': '#8fb0d9', 'gas-giant': '#d8b07a', 'ice-giant': '#6fb5d6', dwarf: '#8d8d96', belt: '#777',
};
// 恒星のアイコン: 星の数 (単独・連星・三重星) と色がそのまま分かるよう、星の色の丸を数だけ描く (主星がいちばん大きい)
function starIcon(stars, cls = '') {
  const pos = stars.length >= 3 ? [[12, 7.5, 4.6], [6.4, 16.5, 3.8], [17.6, 16.5, 3.3]] : stars.length === 2 ? [[8.3, 12, 5.6], [17.4, 12, 3.9]] : [[12, 12, 7]];
  const body = pos.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r + 2.3}" fill="${stars[i].color}" opacity=".28"/><circle cx="${x}" cy="${y}" r="${r}" fill="${stars[i].color}"/>`).join('');
  return `<svg class="ico body ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
// 惑星のアイコン: 種類ごとに形を変える (岩石 = クレーター、ガス巨星 = 大きく縞、氷巨星 = 環、ミニ・ネプチューン = 縞1本、矮小天体 = 小さな丸、小惑星帯 = 弧に並ぶ粒)
function planetIcon(b, cls = '') {
  const c = bodyColor(b);
  const band = (y, r, w = 1.3, col = 'rgba(0,0,0,.28)') => { const h = Math.sqrt(Math.max(0, r * r - GM.pow((y - 12), 2))) - 0.6; return `<path d="M${(12 - h).toFixed(2)} ${y}H${(12 + h).toFixed(2)}" stroke="${col}" stroke-width="${w}"/>`; };
  const body = {
    rocky: `<circle cx="12" cy="12" r="6.6" fill="${c}"/><circle cx="9.8" cy="10" r="1.5" fill="rgba(0,0,0,.3)"/><circle cx="14.2" cy="14.3" r="1.1" fill="rgba(0,0,0,.3)"/>`,
    dwarf: `<circle cx="12" cy="12" r="3.8" fill="${c}"/>`,
    'mini-neptune': `<circle cx="12" cy="12" r="6.2" fill="${c}"/>${band(12, 6.2, 1.5, 'rgba(255,255,255,.45)')}`,
    'gas-giant': `<circle cx="12" cy="12" r="9" fill="${c}"/>${band(8.2, 9)}${band(11.2, 9, 1.6)}${band(14.6, 9)}`,
    'ice-giant': `<circle cx="12" cy="12" r="6.3" fill="${c}"/><ellipse cx="12" cy="12" rx="10.6" ry="2.8" transform="rotate(-24 12 12)" fill="none" stroke="${c}" stroke-width="1.4" opacity=".85"/>`,
    belt: [[3.5, 15], [7, 11.5], [11, 9.6], [15, 9.8], [18.8, 11.8], [21.2, 15]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 1.3 : 1.8}" fill="${c}"/>`).join(''),
  }[b.type] || `<circle cx="12" cy="12" r="6" fill="${c}"/>`;
  return `<svg class="ico body ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
const targetIcon = (t, cls) => (t.cls ? starIcon([t], cls) : planetIcon(t, cls));
const bodyColor = (b) => (b.surface && BODY_COLOR[b.surface]) || TYPE_COLOR[b.type] || '#aaa';
const GRADE_LABEL = ['不可', '困難', '可', '良好(地球型)'];
const fmt = (v, d = 2) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(d));

// 星間マップ: パン(ドラッグ)・ズーム(ホイール)・星の選択/ダブルクリックで星系を開く。



// プレイヤーごとに持つ値。Game の this.pc などは、いま操作しているプレイヤー (players[pi]) の値を指す
// 画面の文に出す「自分の国」の呼び名 (地球の国なら今までどおり「地球」「地球の国」「地球政府」「地球議会」)
const ME = {
  get g() { return app.game?.players ? app.game : null; },
  get realm() { const g = this.g; return g ? g.realmName(g.cap) : '地球'; },
  get species() { const g = this.g; return g?.nationOf(g.cap)?.species || HUMAN; },
  get gov() { return !this.g || this.g.cap === 0 ? '地球政府' : `${this.species}の政府`; },
  get council() { return !this.g || this.g.cap === 0 ? '地球議会' : `${this.species}の議会`; },
  get home() { const g = this.g; if (!g || g.cap === 0) return '地球'; const n = g.nationOf(g.cap); return (n && g.target(n.cap, n.body)?.name) || g.system(g.cap).name; },
  get capName() { const g = this.g; return !g || g.cap === 0 ? '太陽系' : g.system(g.cap).name; },
};
const PLAYER_KEYS = ['finalScore', 'pc', 'pcLast', 'council', 'policy', 'fiscal', 'decisions', 'story', 'era', 'challenges', 'stats', 'acked', 'aiPolicy',
  'autoBuild', 'autoGrant', 'autoDefense', 'autoAwe', 'autoHabitat', 'autoRoutes', 'migration', 'warThreshold', 'regime'];
for (const k of PLAYER_KEYS) Object.defineProperty(Game.prototype, k, { get() { return this.players[this.pi][k]; }, set(v) { this.players[this.pi][k] = v; }, configurable: true });
Object.defineProperty(Game.prototype, 'me', { get() { return this.players[this.pi]; } });
Object.defineProperty(Game.prototype, 'cap', { get() { return this.players[this.pi].cap; } }); // いま操作しているプレイヤーの首都

