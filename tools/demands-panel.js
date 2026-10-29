// 家臣の要求への AI の主人の返事 (QD-41 = c・B-142。docs/demands.md) を書き出す: 観戦で回し、AI が要求をのむかを決めるたびに 1 行
// (人口の割合 share・主人からの距離 ÷ 国の広がり rel・拒んだら独立する見込み risk・のむ見込み p・のんだか accept・席の国の判断か seat)。
// 終わりに、材料の平均 (DEMAND_AI.ref を決めた値) とのんだ割合を出す。傾きは python3 data/build/analyze_demands.py --game <CSV> で実データと比べる
// 使い方: node tools/demands-panel.js <銀河の数> <年数> <国の数> <書き出す CSV> [src/index.html]
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const [seedsS = '12', yearsS = '300', nS = '6', out = 'demands-panel.csv', src] = process.argv.slice(2);
const sim = H.load(src ? { src: path.resolve(src) } : { edition: 'game' });
// AI の判断を横から記録する (のむ見込みの計算はそのまま)。返事は、席の国は返事を送ったとき (sendDecision)、ほかの主人はその場 (grantDemand・refuseDemand) で決まる
sim.evaluate(`(() => {
  globalThis.__log = [];
  const P = Game.prototype, f = P.demandAcceptP, s = P.sendDecision, gr = P.grantDemand, rf = P.refuseDemand;
  P.demandAcceptP = function (id, seen = false) {
    const t = this.demandTermsOf(id, seen), p = f.call(this, id, seen);
    __log.push({ t: 'p', id, year: this.year, seat: seen ? 1 : 0, share: t.share, rel: t.rel, risk: t.risk, p });
    return p;
  };
  P.sendDecision = function (d) {
    const dec = this.decisions.find((x) => x.id === Number(d.id));
    if (dec?.kind === 'demand') __log.push({ t: 'o', id: dec.sys, year: this.year, acc: d.opt === 'accept' ? 1 : 0 });
    return s.call(this, d);
  };
  P.grantDemand = function (id, gv) { __log.push({ t: 'o', id, year: this.year, acc: 1 }); return gr.call(this, id, gv); };
  P.refuseDemand = function (id, gv, ...a) { __log.push({ t: 'o', id, year: this.year, acc: 0 }); return rf.call(this, id, gv, ...a); };
})()`);
const rows = ['seed,sys,year,seat,share,rel,risk,p,accept'];
for (let seed = 1; seed <= Number(seedsS); seed++) {
  const g = sim.newGame(String(seed), { nations: Number(nS) });
  for (let y = 0; y < Number(yearsS); y++) {
    sim.evaluate('__log.length = 0');
    sim.run(g, 1);
    const log = sim.evaluate('__log');
    log.forEach((d, i) => {
      if (d.t !== 'p') return;
      const o = log.slice(i + 1).find((x) => x.t === 'o' && x.id === d.id && x.year === d.year);
      if (o) rows.push([seed, d.id, Math.floor(d.year), d.seat, d.share.toExponential(4), d.rel.toFixed(4), d.risk.toFixed(4), d.p.toFixed(4), o.acc].join(','));
    });
  }
  process.stderr.write(`${seed}: 判断 ${rows.length - 1}\n`);
}
fs.writeFileSync(out, `${rows.join('\n')}\n`);
const v = rows.slice(1).map((r) => r.split(',').map(Number));
const mean = (k) => v.reduce((a, r) => a + r[k], 0) / Math.max(1, v.length);
console.log(`${out}: 判断 ${v.length}・のんだ割合 ${mean(8).toFixed(3)}・のむ見込みの平均 ${mean(7).toFixed(3)}`);
console.log(`材料の平均: ln 人口の割合 ${(v.reduce((a, r) => a + Math.log(r[4]), 0) / v.length).toFixed(3)}・ln 距離 ÷ 広がり ${(v.reduce((a, r) => a + Math.log(r[5]), 0) / v.length).toFixed(3)}・見込み ${mean(6).toFixed(3)}`);
