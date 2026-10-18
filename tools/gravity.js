// 交易と距離 (目標 R01) の自動対戦。多数の銀河で観戦モードの試合を回し、星系どうしの取引を、実データ (CEPII) と同じ形の CSV に書き出す。
// 推定は tools/gravity-analyze.py (実データと同じ data/build/gravity.py を使う)。
//   列: year (10 年ごとの区切りの始めの年。銀河ごとに別の値), iso3_o (送った星系), iso3_d (受けた星系), dist (光年), tradeflow (基準価格での額の合計)
//   国の固定効果にあたるものは「銀河・星系 × 10 年」。1 つの組の 10 年の合計が正のものだけを書く (実データの本推定と同じく、空の組は使わない)
// 使い方: node tools/gravity.js [銀河の数=30] [年数=300] [並列=4] [出力=gravity.csv]   (NAT=6 で国家選択あり、HTML=… で版を選ぶ)
//   KIND=t で交易 (物資移送要求) だけ、KIND=b で建設の資材の取り寄せだけ (既定は両方)。TW='TRADE.rate=0.02' のように、試合の前に値を変えられる (較正用)
const ROOT = require('path').resolve(__dirname, '..');
const HTML = process.env.HTML || `${ROOT}/index.html`;
const fs = require('fs');
const { chromium } = require('playwright');
const [N = '30', Y = '300', PAR = '4', OUT = 'gravity.csv'] = process.argv.slice(2);
const NAT = Number(process.env.NAT || 0);
const KIND = process.env.KIND || '';
const TW = process.env.TW || '';
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
  const rows = [];
  const errs = [];
  let next = 1;
  const work = async () => {
    while (next <= Number(N)) {
      const seed = next++;
      const p = await b.newPage();
      p.on('pageerror', (e) => errs.push(`${seed}: ${e.message}`));
      await p.addInitScript(() => { try { localStorage.clear(); } catch {} window.requestAnimationFrame = () => 0; });
      await p.goto(`file://${HTML}?seed=${seed}&home=0`);
      await p.waitForFunction(() => window.__app && __app.game);
      const r = await p.evaluate(([Y, NAT, KIND, TW]) => {
        __app.speed = 0;
        if (TW) (0, eval)(TW);
        const g = __app.game;
        if (NAT) { g.foundNations(NAT, 'normal'); g.setPlayerNation(g.nations[0].cap); }
        g.setSpectate(true);
        TRADE_AUDIT = [];
        for (let i = 0; i < Y * 4; i++) g.advance(0.25);
        const agg = new Map();
        for (const [o, d, y, v, kind] of TRADE_AUDIT) {
          if (o === d || !(v > 0) || (KIND && kind !== KIND)) continue;
          const k = `${o}|${d}|${Math.floor((y - START_YEAR) / 10) * 10}`;
          agg.set(k, (agg.get(k) || 0) + v);
        }
        TRADE_AUDIT = null;
        return [...agg].map(([k, v]) => { const [o, d, t] = k.split('|').map(Number); return [o, d, t, g.sysDist(o, d), v]; });
      }, [Number(Y), NAT, KIND, TW]);
      for (const [o, d, t, dist, v] of r) rows.push([`${seed}:${t}`, `${seed}:${o}`, `${seed}:${d}`, dist, v]);
      process.stderr.write(`銀河 ${seed}: 組 ${r.length}\n`);
      await p.close();
    }
  };
  await Promise.all(Array.from({ length: Number(PAR) }, work));
  fs.writeFileSync(OUT, `year,iso3_o,iso3_d,dist,tradeflow\n${rows.map((x) => x.join(',')).join('\n')}\n`);
  console.log(`${OUT}: ${rows.length} 行`, errs.slice(0, 3));
  await b.close();
})();
