// 光より速く分かる情報をなくす (B-030) と、相手が見ている自分 (B-027) の試験。画面なしの版で回す
// 1. 戦勝点: 戦った星系から首都へ光が届くまで、戦果は数えない (観戦は本当の戦果)
// 2. AI の国から人間の国への講和の申し入れ: 相手の首都に光速で届いてから見える (届く途中は peaceSent。セーブにも入る)
// 3. 人間の国が勝った講和会議: 会議の知らせが首都に届いてから開く。期限はそこから
// 4. 船の一覧: 他国の艦隊は行き先が分からない・進路変更は光が届いてから・着いたあとも到着の光が届くまで残る
// 5. 集結の命令: 首都に届いている記録の駐留から出す
// 6. 相手が見ている自分: 相手の首都に届いている光で数えた、こちらの艦隊の数と幅
// 使い方: node tools/tests/lightwar.js
const H = require('../headless');
const sim = H.load({ edition: 'game' });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const g = sim.newGame('7', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 40);
const e = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.sysDist(g.cap, c) > 2).sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b))[0]; // いちばん近い国
const d = g.sysDist(g.cap, e);
check(d > 2, `相手の首都が近すぎる (${d.toFixed(1)} 光年)`);
const key = g.warKey(g.cap, e);

// 1
g.beginWar(g.cap, e, g.cap);
g.warLoss(g.cap, e, 10, e); // 相手の首都で 10 艦隊を沈めた
check(g.warScore(g.cap, e) === 0, `戦果の光が届く前に戦勝点が動いた (${g.warScore(g.cap, e)})`);
check(g.warScoreAt(null, g.cap, e) === 20, `本当の戦勝点が違う (${g.warScoreAt(null, g.cap, e)})`);
check(g.warScore(e, g.cap) === -20, `戦った星系の国には、すぐ分かるはず (${g.warScore(e, g.cap)})`);
g.setSpectate(true);
check(g.warScore(g.cap, e) === 20, '観戦では本当の戦勝点を見る');
g.setSpectate(false);
const y0 = g.year;
g.year = y0 + d + 0.01;
check(g.warScore(g.cap, e) === 20, `光が届いたあとの戦勝点が違う (${g.warScore(g.cap, e)})`);
g.year = y0;

// 2
g.postPeaceOffer(key, e, g.cap);
check(!g.peaceOffers.some((o) => o.key === key) && g.peaceSent.some((o) => o.key === key), '講和の申し入れが光より速く届いた');
check(g.peaceOfferedRecently(key), '届く途中の申し入れも、申し入れたうちに数える');
const saved = JSON.parse(JSON.stringify(sim.buildSave(g)));
check(Array.isArray(saved.peaceSent) && saved.peaceSent.length === 1, '届く途中の申し入れがセーブに入らない');
const g2 = new sim.Game(sim.generateGalaxy({ seed: '7', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(saved) && g2.peaceSent.length === 1, '届く途中の申し入れがセーブから戻らない');
// 届くまで進める (そのあいだに相手が新しく申し入れれば、前のものと置き換わる)
for (let i = 0; i < Math.ceil(3 * d + 4) * 4 && g.atWar(g.cap, e) && !g.peaceOffers.some((x) => x.key === key); i++) { if (g.warStats[key]) g.warStats[key].lastEv = g.year; g.advance(0.25); } // 戦い続けている戦争にする (立ち消えにしない)
const o = g.peaceOffers.find((x) => x.key === key);
check(g.atWar(g.cap, e), '試験の戦争が終わってしまった');
if (g.atWar(g.cap, e)) {
  check(o && o.at <= g.year + 1e-9 && o.until > g.year, '講和の申し入れが届かない');
  check(g.acceptPeace({ key }).ok && !g.atWar(g.cap, e), '届いた講和の申し入れに応じられない');
}

// 3
const loser = e;
if (!g.atWar(g.cap, loser)) g.beginWar(g.cap, loser, g.cap);
const nConf = g.conferences.length;
g.startConference(loser, [{ realm: g.cap, pts: 40 }], loser); // 相手の首都で開いた会議
const c = g.confSent[g.confSent.length - 1];
check(g.conferences.length === nConf && c && Math.abs(c.at - (g.year + d)) < 1e-6 && Math.abs(c.until - (c.at + sim.tables.TREATY.years)) < 1e-6, '講和会議の知らせが光より速く届いた');
for (let i = 0; i < Math.ceil(d + 1.5) * 4; i++) g.advance(0.25);
check(g.conferences.some((x) => x.id === c.id) && !g.confSent.some((x) => x.id === c.id), '講和会議の知らせが届かない');

// 4
const own = g.realmSystems(g.cap).map((x) => x.id).find((id) => id !== g.cap && (g.garrison[id] || 0) >= 1);
g.garrison[g.cap] = (g.garrison[g.cap] || 0) + 3;
g.sendFleet(g.cap, e, 1); // 自国の艦隊 (首都から出るので出発はすぐ見える)
const mine = g.fleets[g.fleets.length - 1];
const sf = g.seenFleets().find((x) => x.f === mine);
check(sf && sf.mine && sf.leg.to === e, '自国の艦隊が一覧に見えない');
g.garrison[e] = (g.garrison[e] || 0) + 2;
g.sendFleet(e, g.cap, 1); // 相手の首都から出た艦隊は、出発の光が届くまで見えない
const theirs = g.fleets[g.fleets.length - 1];
check(!g.seenFleets().some((x) => x.f === theirs), '他国の艦隊の出発が光より速く見えた');
g.year += d + 0.01;
const st = g.seenFleets().find((x) => x.f === theirs);
check(st && !st.mine, '出発の光が届いた他国の艦隊が見えない、か自国のものに見える');
g.year -= d + 0.01;
// 進路変更: 変えた地点からの光が届くまで、前の行き先に見える
const back = own ?? g.realmSystems(g.cap).map((x) => x.id).find((id) => id !== g.cap) ?? g.cap;
g.year += 0.5;
g.redirectFleet(mine.id, back === e ? g.cap : back);
const leg = g.seenLeg(mine);
check(leg !== mine && leg.to === e, '進路変更が光より速く見えた');
g.year += 2 * d + 2;
check(g.seenLeg(mine) === mine, '進路変更の光が届いたのに、前の区間のまま');

// 5
const src = g.rallySources(g.cap);
check(src.every((id) => g.knownGarrison(id) > 0 && g.ownStackKnown(id)) && !src.includes(g.cap), '集結の出発地が、届いている記録と違う');

// 6
const v = g.seenByRival(e);
check(Number.isFinite(v.n) && v.lo <= v.n && v.n <= v.hi && Math.abs(v.age - d) < 1e-9, `相手が見ている数が違う (${JSON.stringify(v)})`);

// 7 (B-167). 戦争疲弊: 損失の知らせが首都に届いてから増える
const [x1, x2] = g.nations.map((n) => n.cap).filter((c) => c !== g.cap && g.isColonized(c) && g.realmOf(c) === c).sort((a, b) => g.sysDist(a, b) - g.sysDist(b, a)).slice(0, 2);
if (x1 !== undefined && x2 !== undefined) {
  if (!g.atWar(x1, x2)) g.beginWar(x1, x2, x1);
  const dx = g.sysDist(x1, x2);
  const ex0 = g.exhaustion[x2] || 0;
  g.warLoss(x1, x2, 4, x1); // x2 の艦隊が x1 の星系で沈んだ
  check((g.exhaustion[x2] || 0) === ex0 && g.exhaustSent.some((o) => o.r === x2), '損失の知らせより先に戦争疲弊が増えた');
  const y1 = g.year;
  g.year = y1 + dx + 0.01;
  g.exhaustionYearly();
  check(!g.exhaustSent.some((o) => o.r === x2 && o.at <= g.year), '届いた損失の知らせが残っている');
  g.year = y1;
  // 8. AI どうしの講和の申し入れ: 光速で相手の首都に届いてから答える
  const k2 = g.warKey(x1, x2);
  g.bargainSent = [];
  g.sendBargain(x1, x2, k2);
  g.sendBargain(x1, x2, k2);
  const bo = g.bargainSent.filter((o) => o.key === k2);
  check(bo.length === 1 && Math.abs(bo[0].at - (g.year + dx)) < 1e-9, '講和の申し入れが光より速いか、二重に送られた');
  g.bargainArrive();
  check(g.bargainSent.length === 1, '講和の申し入れが届く前に答えた');
  // 9. 講和会議の条件は、会議を開いた星系に届いている記録で
  g.year = y1;
  const nc = g.confSent.length + g.conferences.length;
  g.startConference(x2, [{ realm: g.cap, pts: 50 }], x2);
  const cc = [...g.confSent, ...g.conferences].filter((c) => c.loser === x2).sort((a, b) => b.id - a.id)[0];
  check(cc && Array.isArray(cc.sys) && Number.isFinite(cc.cash) && cc.sys.every((id) => g.seenBy(x2, id)?.[1] === x2), '講和会議の条件が、会議を開いた星系に届いた記録で決まっていない');
  check(nc < g.confSent.length + g.conferences.length, '講和会議が開かない');
}

console.log(fails.length ? `光の遅れ 不合格\n${fails.join('\n')}` : `光の遅れ 合格 (相手の首都まで ${d.toFixed(1)} 光年・相手に見えている ${v.n} 艦隊 ${v.lo}〜${v.hi})`);
process.exit(fails.length ? 1 : 0);
