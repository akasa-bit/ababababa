// 建設期間 (2026-11-08 のユーザーの依頼 common-7「建築・建艦に時間がかかるようにしてほしい」。docs/build-time.md) の試験。画面なしの版で回す
// 1. ゲーム版: 資材がそろっていても、施設の拡張・宇宙要塞・艦隊の編成は建設期間 (BUILD_TIME) のあとに完成する (注文したその場では完成しない)
// 2. 期間は段 (艦隊は数) で伸びる: buildYears の値と、完成までの年 (0.25 年刻み) が合う
// 3. 艦隊の編成は星系の軍事基地で 1 件ずつ: 1 艦隊を 3 回続けて頼むと 1・2・3 年目に完成する
// 4. 自動の開発・AI の国の注文 (stack なし) は、建設中の同じものを重ねて頼めない (施設・要塞)。建設中の艦隊は queuedWarships に数える
// 5. シミュレーション版は前のとおり、資材がそろえば注文したその場で完成する
// 6. セーブと読み込みで建設中の注文が残り、同じ年に完成する
// 7. 予約を重ねる (2026-11-08 の依頼 common-8「建設ボタンを 9 回タップしたらレベル 10 までいけるように」): プレイヤーの命令 (command) は、
//    建設中でも次の段を予約できる。施設は最大の段まで頼めて、その次は断る。同じ物は 1 件ずつ順に建ち (完成の年 = 期間の足し算)、
//    期間と費用は予約した段の値。名前も予約した段。採掘基地・交易路・要塞も同じ。予約のあいだも自動の注文は重ねない
// 使い方: node tools/tests/buildtime.js
// CI での回し方と合否 (tools/ci-tests.js が拾う。書き方は docs/parallel.md の 7 の道具と検証)
const J = require('../ci-judge');
exports.ci = [{ judge: J.passes('建設期間') }];
if (require.main !== module) return;
const H = require('../headless');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const near = (a, b, tol = 0.26) => Math.abs(a - b) <= tol; // 0.25 年刻みで進むので

const sim = H.load({ edition: 'game' });
const BT = sim.evaluate('BUILD_TIME');
check(BT.upgrade && BT.fort && BT.warship && BT.outpost && BT.route, `ゲーム版に建設期間の値がない (${JSON.stringify(BT)})`);
const g = sim.newGame('3', { nations: 5, spectate: false });
g.setPlayerNation(0);
sim.run(g, 20);
const C = g.cap;
g.gov(C).credits += 1e7;
for (const r of Object.keys(g.stockOf(C))) g.stockOf(C)[r] += 1e6; // 資材はすべて首都にある (取り寄せの待ちなし)
const until = (done, max = 80) => { const t0 = g.year; let n = 0; while (!done() && n++ < max) g.advance(0.25); return g.year - t0; };

// 1・2・4: 施設の拡張
const c = g.colonies.find((x) => x.sys === C);
const lv0 = c.lv.factory;
check(g.upgrade(c, 'factory').ok && c.lv.factory === lv0, '施設の拡張が注文したその場で完成した');
check(!g.upgrade(c, 'factory').ok, '自動の注文 (stack なし) が建設中の施設を重ねて頼めた');
const tf = until(() => c.lv.factory === lv0 + 1);
check(c.lv.factory === lv0 + 1 && near(tf, g.buildYears('upgrade', lv0)), `施設の拡張の期間が違う (${tf.toFixed(2)} 年・期待 ${g.buildYears('upgrade', lv0).toFixed(2)} 年)`);
check(near(g.buildYears('upgrade', 9) - g.buildYears('upgrade', 0), 9 * BT.upgrade[1], 1e-9), '段が上がっても施設の建設期間が伸びない');

// 1・2: 宇宙要塞
const f0 = g.fortLevel(C);
check(g.fortUpgrade(C).ok && g.fortLevel(C) === f0, '要塞が注文したその場で完成した');
check(!g.fortUpgrade(C).ok, '自動の注文 (stack なし) が建設中の要塞を重ねて頼めた');
const tt = until(() => g.fortLevel(C) === f0 + 1);
check(near(tt, g.buildYears('fort', f0)), `要塞の期間が違う (${tt.toFixed(2)} 年・期待 ${g.buildYears('fort', f0).toFixed(2)} 年)`);

// 1・2・4: 艦隊の編成 (まとめて)
let k0 = g.garrison[C] || 0;
check(g.buildWarship(C, 10).ok && (g.garrison[C] || 0) === k0, '艦隊の編成が注文したその場で完成した');
check(sim.evaluate('queuedWarships')(g.projects, C) === 10, `建設中の艦隊が queuedWarships に数えられない (${sim.evaluate('queuedWarships')(g.projects, C)})`);
const tw = until(() => (g.garrison[C] || 0) >= k0 + 10);
check(near(tw, g.buildYears('warship', 9)), `10 艦隊の編成の期間が違う (${tw.toFixed(2)} 年・期待 ${g.buildYears('warship', 9).toFixed(2)} 年)`);

// 3: 軍事基地で 1 件ずつ
k0 = g.garrison[C] || 0;
const t3 = g.year;
for (let i = 0; i < 3; i++) g.buildWarship(C, 1);
const readies = g.projects.filter((j) => j.type === 'warship' && j.sys === C).map((j) => j.ready - t3).sort((a, b) => a - b);
const w1 = g.buildYears('warship', 0);
check(readies.length === 3 && readies.every((r, i) => near(r, (i + 1) * w1, 1e-9)), `1 艦隊を 3 回頼んでも 1 件ずつにならない (${readies.map((x) => x.toFixed(2)).join(', ')})`);

// 6: セーブと読み込み (建設中の注文が残り、同じ年に完成する)
const d = JSON.parse(JSON.stringify(sim.buildSave(g)));
const g2 = new sim.Game(sim.generateGalaxy({ seed: '3', starCount: 400, meanSpacing: 4, kind: 'real', gen: sim.GALAXY_GEN }));
check(g2.restore(d) && g2.projects.filter((j) => j.type === 'warship' && j.sys === C).length === 3, '建設中の艦隊がセーブから戻らない');
const t2a = until(() => (g.garrison[C] || 0) >= k0 + 3), k2 = g2.garrison[C] || 0;
let n2 = 0; const y2 = g2.year; while ((g2.garrison[C] || 0) < k2 + 3 && n2++ < 80) g2.advance(0.25);
check(near(t2a, 3 * w1) && near(g2.year - y2, t2a, 1e-9), `読み込んだ試合で建設中の艦隊の完成の年がずれる (${t2a.toFixed(2)} / ${(g2.year - y2).toFixed(2)})`);

// 7: 予約を重ねる (プレイヤーの命令)
const fill = (id) => { g.gov(id).credits += 1e7; for (const r of Object.keys(g.stockOf(id))) g.stockOf(id)[r] += 1e6; }; // ここまでの年で政府が使った分を足し直す
fill(C);
const FM = sim.evaluate('FACILITY_MAX');
const ser = (type, lv0, n) => { const out = []; let t = 0; for (let i = 0; i < n; i++) { t += g.buildYears(type, lv0 + i); out.push(t); } return out; }; // 1 件ずつ順に建つときの完成の年
const readyOf = (pred, t0) => g.projects.filter(pred).map((j) => j.ready - t0).sort((a, b) => a - b);
const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
// 施設: いちばん低い段の施設を、最大の段まで 1 回ずつ押す
const key = sim.evaluate('colKey')(c);
const fac = ['farm', 'mine', 'factory', 'habitat'].sort((a, b) => c.lv[a] - c.lv[b])[0];
const s0 = c.lv[fac], ns = FM[fac] - s0, t7 = g.year;
const costs = [];
for (let i = 0; i < ns; i++) { costs.push(g.upgradeCost(c, fac, s0 + i).metal); const r = g.command('upgrade', { col: key, fac }); check(r.ok, `施設の予約の ${i + 1} 回目を断られた (${fac} Lv${s0}→: ${r.reason})`); }
check(!g.command('upgrade', { col: key, fac }).ok, `最大の段 (Lv${FM[fac]}) より上まで予約できた`);
check(!g.upgrade(c, fac).ok, '予約のあいだに自動の注文 (stack なし) が重なった');
const fj = g.projects.filter((j) => j.type === 'upgrade' && j.col === key && j.fac === fac);
check(fj.length === ns && fj.every((j, i) => j.label.endsWith(`Lv${s0 + i + 1}`)), `予約した施設の名前の段が違う (${fj.map((j) => j.label.split(' ').pop()).join(',')})`);
check(costs.every((m, i) => i === 0 || m === 2 * costs[i - 1]), `予約した段の費用 (金属) が段ごとに 2 倍にならない (${costs.join(',')})`);
const fr = readyOf((j) => j.type === 'upgrade' && j.col === key && j.fac === fac, t7), fe = ser('upgrade', s0, ns);
check(same(fr, fe), `予約した施設が 1 件ずつ順に建たない (${fr.map((x) => x.toFixed(2)).join(',')} / 期待 ${fe.map((x) => x.toFixed(2)).join(',')})`);
const tfac = until(() => c.lv[fac] >= FM[fac], 200);
check(c.lv[fac] === FM[fac] && near(tfac, fe[ns - 1]), `予約した施設が Lv${FM[fac]} にならない (Lv${c.lv[fac]}・${tfac.toFixed(2)} 年・期待 ${fe[ns - 1].toFixed(2)} 年)`);
// 要塞: いまの段から Lv10 まで
fill(C);
const z0 = g.fortLevel(C), nz = sim.tables.FORT.max - z0, t8 = g.year;
for (let i = 0; i < nz; i++) { const r = g.command('fort', { sys: C }); check(r.ok, `要塞の予約の ${i + 1} 回目を断られた (Lv${z0}→: ${r.reason})`); }
check(!g.command('fort', { sys: C }).ok, '要塞を最大の段より上まで予約できた');
const zr = readyOf((j) => j.type === 'fort' && j.sys === C, t8), ze = ser('fort', z0, nz);
check(same(zr, ze), `予約した要塞が 1 件ずつ順に建たない (${zr.map((x) => x.toFixed(2)).join(',')} / 期待 ${ze.map((x) => x.toFixed(2)).join(',')})`);
const tz = until(() => g.fortLevel(C) >= sim.tables.FORT.max, 200);
check(g.fortLevel(C) === sim.tables.FORT.max && near(tz, ze[nz - 1]), `予約した要塞が Lv${sim.tables.FORT.max} にならない (Lv${g.fortLevel(C)}・${tz.toFixed(2)} 年)`);
// 採掘基地: 首都の星系の掘れる天体に 3 回
fill(C);
const ob = g.system(C).bodies.find((b) => g.outpostCheck(C, b.id).ok && (g.outpostAt(C, b.id)?.lv || 0) <= 7);
let o0 = 0, tob = 0, oe = [];
if (ob) {
  o0 = g.outpostAt(C, ob.id)?.lv || 0;
  const t9 = g.year;
  for (let i = 0; i < 3; i++) check(g.command('outpost', { sys: C, body: ob.id }).ok, `採掘基地の予約の ${i + 1} 回目を断られた`);
  check(!g.buildOutpost(C, ob.id).ok, '予約のあいだに自動の採掘基地 (stack なし) が重なった');
  oe = ser('outpost', o0, 3);
  const orr = readyOf((j) => j.type === 'outpost' && j.sys === C && j.body === ob.id, t9);
  check(same(orr, oe), `予約した採掘基地が 1 件ずつ順に建たない (${orr.map((x) => x.toFixed(2)).join(',')})`);
  tob = until(() => (g.outpostAt(C, ob.id)?.lv || 0) >= o0 + 3, 100);
  check(g.outpostAt(C, ob.id)?.lv === o0 + 3, `予約した採掘基地が Lv${o0 + 3} にならない (Lv${g.outpostAt(C, ob.id)?.lv || 0})`);
} else fails.push('首都の星系に採掘基地を建てられる天体がない (試験の前提)');
// 交易路: 首都につながる交易路を 2 回 (拡張は交易路の端 r.a で建てる。首都でなければ指令が届いたときの実行 exec で)
const rt = g.routes.find((r) => r.a === C) || g.routes.find((r) => r.b === C);
let r0 = 0;
if (rt) {
  r0 = rt.lv;
  fill(rt.a);
  for (let i = 0; i < 2; i++) { const r = g.exec('uproute', { route: rt.id }); check(r.ok, `交易路の予約の ${i + 1} 回目を断られた (${r.reason})`); }
  check(!g.upgradeRoute(rt).ok, '予約のあいだに自動の交易路の拡張 (stack なし) が重なった');
  until(() => rt.lv >= r0 + 2, 100);
  check(rt.lv === r0 + 2, `予約した交易路が Lv${r0 + 2} にならない (Lv${rt.lv})`);
} else fails.push('首都から出る交易路がない (試験の前提)');

// 5: シミュレーション版はすぐ完成する
const ss = H.load({ edition: 'sim' });
const gs = ss.newGame('3', { nations: 5, spectate: false });
gs.setPlayerNation(0);
ss.run(gs, 20);
const Cs = gs.cap;
gs.gov(Cs).credits += 1e7;
for (const r of Object.keys(gs.stockOf(Cs))) gs.stockOf(Cs)[r] += 1e6;
const ks = gs.garrison[Cs] || 0, cs = gs.colonies.find((x) => x.sys === Cs), ls = cs.lv.factory;
check(gs.buildWarship(Cs, 5).ok && (gs.garrison[Cs] || 0) === ks + 5, 'シミュレーション版で艦隊の編成がすぐ完成しない');
check(gs.upgrade(cs, 'factory').ok && cs.lv.factory === ls + 1, 'シミュレーション版で施設の拡張がすぐ完成しない');
check(Object.keys(ss.evaluate('BUILD_TIME')).length === 0, 'シミュレーション版に建設期間の値がある');

console.log(`施設 ${tf.toFixed(2)} 年・要塞 ${tt.toFixed(2)} 年・10 艦隊 ${tw.toFixed(2)} 年・1 艦隊 ×3 は ${readies.map((x) => x.toFixed(2)).join('/')} 年`);
console.log(`予約: ${fac} Lv${s0}→${FM[fac]} を ${ns} 回で ${tfac.toFixed(2)} 年・要塞 Lv${z0}→${sim.tables.FORT.max} を ${nz} 回で ${tz.toFixed(2)} 年・採掘基地 Lv${o0}→${o0 + 3} ${tob.toFixed(2)} 年・交易路 Lv${r0}→${r0 + 2}`);
console.log(fails.length ? `建設期間 不合格\n${fails.join('\n')}` : '建設期間 合格');
process.exit(fails.length ? 1 : 0);
