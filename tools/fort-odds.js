// 宇宙要塞のある星系を攻めたときの艦隊戦の分かれ方 (依頼 2026-11-07 の FU-1 のあとの質問。docs/fleet-groups.md の 7)。
// 画面なしの版のゲームの撃ち合い (Game.battleRound) で、攻撃 na 艦隊 対 防衛 nd 艦隊 + 要塞 Lv L を N 回ずつ解き、
// 要塞の段 L・攻撃側の戦力の倍率 eff (補給の充足率から。0.5 = 補給なし)・攻撃側が退けるか (艦隊群の「退かない」) ごとに、勝ち・かかった年・損害を数える。
// 使い方: node tools/fort-odds.js [攻撃の数 20] [防衛の数 1] [回数 4000] [要塞の傷 0] [--json] [--twice]
//         要塞の傷 = 区画の耐久の欠けた割合 (依頼 FU-3。前の戦いの傷が残る)
//         --twice = 1 回目に負けたら、残った要塞 (段と傷) と守りの艦に、すぐ同じ数でもう 1 回攻める。傷が残る (いま) と残らない (前) を比べる
//         EDITION_BATTLE='{"luck":0.5}'・EDITION_FORT='{"hp":2}' で値を上書きして測る (釣り合いを変える案の効き目を見る)
const H = require('./headless');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [na = 20, nd = 1, N = 4000, wear = 0] = args.map(Number);
const params = {};
if (process.env.EDITION_BATTLE) params.BATTLE = JSON.parse(process.env.EDITION_BATTLE);
if (process.env.EDITION_FORT) params.FORT = JSON.parse(process.env.EDITION_FORT);
const sim = H.load({ edition: 'game', params: Object.keys(params).length ? params : undefined });
const g = sim.newGame('3', { nations: 2 });
const BATTLE = sim.evaluate('BATTLE'), FORT = sim.evaluate('FORT');
// 試合の乱数とは別の乱数 (毎回同じ結果になるように、種を決めておく)
let st = 12345;
const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nrm = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
// 1 回の艦隊戦 (war-ai.js の battlesStep と同じ: 戦いごとに戦機と士気のくじを引き、どちらかの戦っている艦がいなくなるまで撃ち合う)
function fight(L, eff, canRetA, w = wear, ndNow = nd) {
  const u = [Array.from({ length: na }, () => [1, 1, -1]), [...Array.from({ length: ndNow }, () => [1, 1, -1]), ...Array.from({ length: L }, () => [FORT.hp * (1 - w), 1, -1, 1])]];
  const e = [eff * Math.exp(BATTLE.luck * nrm()), Math.exp(BATTLE.luck * nrm())], mor = [Math.exp(BATTLE.morale * nrm()), Math.exp(BATTLE.morale * nrm())];
  const out = { sunk: [0, 0], esc: [0, 0] };
  let r = 0;
  for (; r < BATTLE.rounds * 20 && g.battleRound(u, e, mor, rnd, [canRetA, true], out); r++);
  const win = u[0].some((x) => x[2] < 0) && !u[1].some((x) => x[2] < 0);
  const fs = u[1].filter((x) => x[3]);
  // 戦いのあとの要塞: 残った段と、残った区画の傷 (ship/fort.js の fortWearKeep と同じ数え方)。守りの艦は退いていない分だけ残る
  const after = { L: fs.length, w: fs.length ? 1 - fs.reduce((k, x) => k + Math.max(0, x[0]), 0) / (fs.length * FORT.hp) : 0, nd: u[1].filter((x) => !x[3] && x[2] < 0).length };
  return { win, years: r / BATTLE.rounds, sunkA: out.sunk[0], escA: out.esc[0] + (win ? 0 : u[0].length), sunkD: out.sunk[1], fortsLost: L - fs.length, after };
}
const rows = [];
for (const L of [0, 1, 2, 3, 5]) for (const eff of [1, 0.5]) for (const canRetA of [true, false]) {
  const s = { win: 0, years: 0, sunkA: 0, escA: 0, sunkD: 0, fortsLost: 0 };
  for (let i = 0; i < N; i++) { const o = fight(L, eff, canRetA); for (const k of Object.keys(s)) s[k] += Number(o[k]); }
  rows.push({ L, eff, canRetA, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v / N])) });
}
// --twice: 1 回目に負けたら、すぐ同じ数でもう 1 回。傷が残る (いま) と、無傷に戻る (前) を比べる (倍率 1・攻めは退く)
const twice = [];
if (process.argv.includes('--twice')) {
  for (const L of [1, 2, 3, 5]) {
    const t = { L, first: 0, keep: 0, reset: 0, lost: 0, wAfter: 0, lostL: 0 };
    for (let i = 0; i < N; i++) {
      const o = fight(L, 1, true);
      if (o.win) { t.first++; continue; }
      t.lost++; t.wAfter += o.after.w; t.lostL += L - o.after.L;
      if (fight(o.after.L, 1, true, o.after.w, o.after.nd).win) t.keep++;
      if (fight(o.after.L, 1, true, 0, o.after.nd).win) t.reset++;
    }
    twice.push({ L, first: t.first / N, secondKeep: t.lost ? t.keep / t.lost : null, secondReset: t.lost ? t.reset / t.lost : null, wearAfterLoss: t.lost ? t.wAfter / t.lost : null, sectionsLostInLoss: t.lost ? t.lostL / t.lost : null, losses: t.lost });
  }
}
if (process.argv.includes('--json')) { console.log(JSON.stringify({ na, nd, N, wear, BATTLE, FORT, rows, twice })); process.exit(0); }
console.log(`攻撃 ${na} 艦隊 対 防衛 ${nd} 艦隊 + 宇宙要塞 (区画は艦の ${FORT.hp} 倍の耐久${wear ? `・傷 ${Math.round(wear * 100)}%` : ''})。${N} 回ずつ`);
console.log('要塞 倍率 攻めが退くか  勝ち   年  攻めの沈没 攻めの退却 守りの艦の沈没 要塞の区画の沈没');
for (const r of rows) console.log(`Lv${r.L}  ${r.eff.toFixed(1)}  ${r.canRetA ? '退く    ' : '退かない'}  ${(100 * r.win).toFixed(1).padStart(5)}% ${r.years.toFixed(2)} ${r.sunkA.toFixed(2).padStart(8)} ${r.escA.toFixed(2).padStart(9)} ${r.sunkD.toFixed(2).padStart(12)} ${r.fortsLost.toFixed(2).padStart(14)}`);
if (twice.length) {
  console.log('\n1 回目に負けたら、すぐ同じ数でもう 1 回 (倍率 1・攻めは退く)');
  console.log('要塞 1回目の勝ち 負けたときの傷 負けたときに壊した区画 2回目の勝ち(傷が残る) 2回目の勝ち(無傷に戻る)');
  for (const t of twice) console.log(`Lv${t.L}  ${(100 * t.first).toFixed(1).padStart(6)}% ${t.wearAfterLoss === null ? '—' : (100 * t.wearAfterLoss).toFixed(1).padStart(8) + '%'} ${t.sectionsLostInLoss === null ? '—' : t.sectionsLostInLoss.toFixed(2).padStart(10)} ${t.secondKeep === null ? '—' : (100 * t.secondKeep).toFixed(1).padStart(14) + '%'} ${t.secondReset === null ? '—' : (100 * t.secondReset).toFixed(1).padStart(14) + '%'}`);
}
