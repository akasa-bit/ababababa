// 人間の代わり (観戦の AI) の公平さ (回 AI5・AI6。docs/ai-behavior.md の 12.2・13): 同じ国 (国家選択の 2 番目) を、人間の席にした試合と、
// AI の国の席にした試合 (人間の席は 3 番目) で回し、終わりの年の星系の数を比べる。同じシードで組にすると、国の始まりの差が消える
// 使い方: node tools/human-seat.js <シード> [年数] [難易度 easy・normal・hard・brutal] [src/index.html] [--c20]
//   1 行の JSON: { seed, hc, h1: 2 番目の国を人間の席にしたときの国ごとの星系, h2: 3 番目の国を人間の席にしたときの国ごとの星系, wars1, wars2: 人間の席の自分の宣戦 }
//   --c20 = 人間の席の星系すべてに、AI の国と同じ入植の補正 (台帳の C20。EDITIONS の aiColonize: 入植船を同時に何隻・何百万人から・何倍の光年まで) をかける (回 AI6)。
//           つけなくても、観戦の AI が動かす人間の国の首都には C20 がかかる (QD-116 = a)
const H = require('./headless');
const c20 = process.argv.includes('--c20');
const [seed = '1', yS = '300', hc = 'normal', src] = process.argv.slice(2).filter((a) => a !== '--c20');
const sim = H.load(src ? { src } : {});
const out = { seed, hc, years: Number(yS), c20 };
for (const who of [1, 2]) {
  const g = sim.newGame(seed, { nations: 6 });
  if (c20) { const a = sim.evaluate('ED.aiColonize'); if (a) g.aiColonize = () => a; }
  g.setPlayerNation(g.nations[who].cap);
  g.setSpectate(true);
  g.handicap = hc;
  let wars = 0;
  const bw = g.beginWar.bind(g);
  g.beginWar = (by, t, from) => { if (g.isHuman(by) && g.stepping) wars++; return bw(by, t, from); };
  sim.run(g, Number(yS));
  out[`h${who}`] = g.nations.map((n) => (g.realmAlive(n.cap) ? g.realmSystems(n.cap).length : 0));
  out[`wars${who}`] = wars;
}
console.log(JSON.stringify(out));
