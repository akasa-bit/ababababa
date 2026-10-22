// 艦隊戦の法則を測る (R16。B-034)。画面なしの版のゲームの撃ち合い (Game.battleRound) で、CDB90 と同じ回帰をする:
// 1. 攻撃側の勝ちを、兵力比の対数でロジスティック回帰した傾き (CDB90 0.48、95% 区間 0.24〜0.72)
// 2. 損害の比の対数を兵力比の対数で回帰した傾き → ランチェスター則の指数 = −傾き (CDB90 −0.29、区間 −0.44〜−0.14。二乗則なら 1、一乗則なら 0)
// 戦いは、攻撃側 2〜41 艦隊・兵力比 e^(−1.1〜1.1) (CDB90 の兵力比の 9 割が入る幅) を一様に引いて作る。兵站と国の補正は 1 (同じ条件)。
// 試合の中の艦隊戦は少ない (AI の国は守りの薄い星系を攻める) ので、法則は作った戦いで測る。
// 使い方: node tools/battles-headless.js [src/index.html] [戦いの数] [版 game|sim]
//         EDITION_BATTLE='{"pos":1.6,"luck":1.6}' で補正の値を上書きして測る (補正を外したときに CDB90 に入るかを見る)
const path = require('path');
const H = require('./headless');
const [src = path.join(__dirname, '..', 'src', 'index.html'), nS = '4000', edition = 'game'] = process.argv.slice(2);
const sim = H.load({ src, edition, params: process.env.EDITION_BATTLE ? { BATTLE: JSON.parse(process.env.EDITION_BATTLE) } : undefined });
const B = sim.tables.BATTLE;
const g = sim.newGame('battles', { nations: 0 });

function logit(x, y) {
  let b0 = 0, b1 = 0;
  for (let it = 0; it < 40; it++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (let i = 0; i < x.length; i++) { const p = 1 / (1 + Math.exp(-(b0 + b1 * x[i]))), w = p * (1 - p); g0 += y[i] - p; g1 += (y[i] - p) * x[i]; h00 += w; h01 += w * x[i]; h11 += w * x[i] * x[i]; }
    const det = h00 * h11 - h01 * h01; b0 += (h11 * g0 - h01 * g1) / det; b1 += (h00 * g1 - h01 * g0) / det;
  }
  return [b0, b1];
}
function ols(x, y) { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } return sxy / sxx; }
const med = (a) => a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)];

const X = [], Y = [], CX = [], CY = [], years = [], lossW = [], lossL = [];
for (let i = 0; i < Number(nS); i++) {
  const na = 2 + Math.floor(g.rand() * 40), nd = Math.max(1, Math.round(na / Math.exp((g.rand() * 2 - 1) * 1.1)));
  const u = [Array.from({ length: na }, () => [1, 1, -1]), Array.from({ length: nd }, () => [1, 1, -1])];
  const eff = [g.battleLuck(B.luck), g.battleLuck(B.luck)], mor = [g.battleLuck(B.morale), g.battleLuck(B.morale)];
  const out = { sunk: [0, 0], esc: [0, 0] };
  let r = 0;
  while (r < B.rounds * 20 && g.battleRound(u, eff, mor, () => g.rand(), [true, true], out)) r++;
  const win = u[0].some((x) => x[2] < 0) && !u[1].some((x) => x[2] < 0) ? 1 : 0;
  X.push(Math.log(na / nd)); Y.push(win); years.push(r / B.rounds);
  if (out.sunk[0] > 0 && out.sunk[1] > 0) { CX.push(Math.log(na / nd)); CY.push(Math.log(out.sunk[0] / out.sunk[1])); }
  (win ? lossW : lossL).push(out.sunk[0] / na); (win ? lossL : lossW).push(out.sunk[1] / nd);
}
const [b0, b1] = logit(X, Y), e = -ols(CX, CY);
const p2 = 1 / (1 + Math.exp(-(b0 + b1 * Math.log(2))));
const inSlope = b1 >= 0.2356 && b1 <= 0.7233, inExp = e >= -0.439 && e <= -0.141;
console.log(`艦隊戦 (${edition}・pos ${B.pos}・luck ${B.luck}・${X.length} 戦)`);
console.log(`| 数 | ゲーム | CDB90 (95% 区間) |\n|---|---|---|`);
console.log(`| 勝ちの傾き (R16) | ${b1.toFixed(2)} (切片 ${b0.toFixed(2)}。2 倍の兵力で ${(p2 * 100).toFixed(0)}%) | 0.48 (0.24〜0.72) ${inSlope ? '合格' : '区間の外'} |`);
console.log(`| ランチェスター則の指数 | ${e.toFixed(2)} (両方が沈んだ ${CX.length} 戦) | −0.29 (−0.44〜−0.14) ${inExp ? '合格' : '区間の外'} |`);
console.log(`| 戦いの長さの中央値 | ${med(years).toFixed(2)} 年 | — |`);
console.log(`| 沈んだ割合の中央値 (勝った側 / 負けた側) | ${(med(lossW) * 100).toFixed(0)}% / ${(med(lossL) * 100).toFixed(0)}% | 損害 6% / 16% (戦死と負傷。艦の沈没とは違う) |`);
console.log(`R16 ${inSlope && inExp ? '合格' : '不合格'}`);
