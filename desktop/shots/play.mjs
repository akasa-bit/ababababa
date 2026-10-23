// 撮るためのセーブを、人の操作 (画面の指令と同じ issue) で遊んで作る (回 SO3。store/images.md の 2・3)。
// 観戦のまま進めるだけでは、地球の国が勝つ講和会議も、届いた「決めること」に返事をする場面も起きない
// (観戦の AI は守り寄りで、60 個の銀河を 200 年回しても地球の国が勝った講和会議は 0 回だった)。そこで、観戦で少し進めたあと、
// 人が遊ぶのと同じ指令だけで次のように遊ぶ。ゲームの中身は変えない。ゲームの式と乱数だけで進むので、同じ版のゲームなら何度作っても同じ。
//   1. 遠い星系 (光の遅れ 10 年以上) から「決めること」が届いたら、返事を送る (最初の 1 件。いちばん安い選択肢)
//   2. 首都で戦艦を毎年 2 隻ずつ造り、50 隻 (か相手の 3 倍) になったら、艦隊の少ない近くの国に宣戦して、相手の首都でない一番近い星系に集結させる
//      戦争のあいだも戦艦を造り続け、8 年ごとに前線へ集める (前線が落ちたと届いたら、次の一番近い相手の星系へ。首都は最後)
//   3. 地球に届いている戦勝点が 20 以上になったら、講和を申し入れる (6 年ごと。相手の首都に届いて、相手が応じたら講和会議)
//   4. 講和会議の知らせが地球に届いたら止める (条件はまだ選ばない)
// 途中の場面をセーブ (JSON の文字列) にして返す: decision = 決めることが届いた所、reply = 返事を送った直後 (返事の光の球)、
// offer = 講和会議になった申し入れを送った直後 (指令の光の球)、front = 講和のあとに起きた艦隊戦の知らせが地球に届く 3 年前、
// conference = 講和会議の知らせが届いた所。
// ページの中で動く (page.evaluate(playInPage, { seed, spec }))。だから外の変数を使わない。
export function playInPage({ seed, spec = 80, ships = 50, years = 160 }) {
  newGame(seed);
  const g = __app.game;
  g.foundNations(6);
  g.setPlayerNation(g.nations[0].cap);
  g.setSpectate(true);
  for (let i = 0; i < spec * 4; i++) g.advance(0.25);
  g.setSpectate(false);
  const saves = {}, log = [], offers = [];
  const snap = (k) => { saves[k] = saveJSON(g, { speed: 0 }); log.push(`${g.year.toFixed(1)} セーブ ${k}`); };
  const y = () => g.year.toFixed(1);
  let foe = null, target = null, last = -1e9, replied = false, front = null;
  for (let i = 0; i < years * 4; i++) {
    // 1. 決めること
    if (!replied) {
      const d = g.visibleDecisions().find((x) => g.lightDelay(x.sys) >= 10);
      if (d) {
        snap('decision');
        const o = [...d.opts].sort((a, b) => (a.cr || 0) - (b.cr || 0))[0];
        const r = issue('decide', { sys: d.sys, id: d.id, opt: o.k });
        log.push(`${y()} ${g.system(d.sys).name} の「${d.kind}」に「${o.label || o.k}」と返事 (${r?.ok ? '送った' : r?.reason})`);
        if (r?.ok) { replied = true; snap('reply'); }
      }
    }
    // 2. 戦艦を造って、宣戦する
    if (foe === null && i % 4 === 0) {
      const realms = g.nations.map((n) => n.cap).filter((r) => r !== g.cap && g.realmOf(r) === r);
      const weak = realms.filter((r) => g.realmShips(r) * 3 < g.realmShips(g.cap)).sort((a, b) => g.sysDist(g.cap, a) - g.sysDist(g.cap, b))[0];
      if (g.realmShips(g.cap) >= ships && weak !== undefined) {
        foe = weak;
        target = g.realmSystems(foe).filter((s) => s.id !== foe).sort((a, b) => g.sysDist(g.cap, a.id) - g.sysDist(g.cap, b.id))[0]?.id ?? foe;
        issue('declarewar', { sys: foe });
        issue('rally', { sys: target });
        log.push(`${y()} ${g.realmName(foe)}に宣戦し、${g.system(target).name} (${g.sysDist(g.cap, target).toFixed(0)} 光年) に艦隊を集めた (${g.realmShips(g.cap)} 隻)`);
      } else issue('warship', { sys: g.cap, n: 2 });
    }
    // 2b. 戦争のあいだも戦艦を造り続け、8 年ごとに前線へ集める
    if (foe !== null && g.knownAtWar(g.cap, foe) && i % 4 === 0) {
      issue('warship', { sys: g.cap, n: 2 });
      if (i % 32 === 0) {
        // 前線が落ちた (と地球に届いた) ら、地球から見えている相手の星系のうち一番近いものへ進む (首都は最後)
        const left = g.knownSystems().filter((s) => g.known(s.id)?.realm === foe).sort((a, b) => (a.id === foe) - (b.id === foe) || g.sysDist(g.cap, a.id) - g.sysDist(g.cap, b.id));
        if (left.length && !left.some((s) => s.id === target)) { target = left[0].id; log.push(`${y()} 前線を ${g.system(target).name} に移した`); }
        issue('rally', { sys: target });
      }
    }
    // 3. 講和
    if (foe !== null && g.knownAtWar(g.cap, foe) && g.warScore(g.cap, foe) >= 20) {
      if (g.year - last >= 6) {
        const r = issue('peace', { sys: foe });
        if (r?.ok) { last = g.year; offers.push({ year: g.year, arrive: g.year + g.lightDelay(foe), save: saveJSON(g, { speed: 0 }) }); log.push(`${y()} 講和を申し入れた (届くのは ${(g.year + g.lightDelay(foe)).toFixed(1)} 年)`); }
      }
    }
    g.advance(0.25);
    // 講和のあとに起きた艦隊戦の知らせが、もうすぐ地球に届く所 (予告編の「講和のあとも戦う艦隊」)
    const peace = foe !== null && !saves.front && g.peaces.filter((r) => r.key === g.warKey(g.cap, foe)).pop();
    if (peace) {
      const e = g.events.find((x) => x.kind === 'battle' && x.year > peace.year && x.text.includes(g.realmName(foe)) && g.seenOf(x) - g.year <= 3);
      if (e) { snap('front'); front = { sys: e.sys, year: e.year, seen: g.seenOf(e), peace: peace.year, text: e.text }; }
    }
    // 4. 講和会議の知らせが届いた
    const c = g.conferences.find((x) => x.bids.some((b) => b.realm === g.cap && !b.picks));
    if (c) {
      // 会議になった申し入れ = 会議が開いた年より前に届いた、最後の申し入れ。その直後のセーブ (光の球が出ている)
      const ok = offers.filter((o) => o.arrive <= c.year + 1e-6).pop();
      if (ok) saves.offer = ok.save;
      log.push(`${y()} 講和会議の知らせが届いた (${c.year.toFixed(1)} 年に ${g.system(c.from).name} で開いた。持ち点 ${c.bids.find((b) => b.realm === g.cap).pts})`);
      snap('conference');
      return { saves, log, foe, target, peace: c.year, conf: g.year, offer: ok && { year: ok.year, arrive: ok.arrive }, front };
    }
  }
  return { saves, log, foe, target, error: `${years} 年遊んでも講和会議の知らせが届かなかった` };
}
