// 候補地タブ: ハビタブルゾーン内にある未入植の天体
function candidatesHtml(app) {
  const g = app.game;
  const rows = [];
  for (const sys of g.galaxy.systems) {
    for (const b of sys.bodies) {
      if (!b.inHZ || b.type === 'belt' || g.knownColonyAt(sys.id, b.id, 'planet') || g.knownColonyAt(sys.id, b.id, 'station')) continue;
      const grade = b.settle?.grade || 0;
      if (app.candOnly && grade < 1) continue;
      const from = g.system(g.cap); // 入植船はいつも首都から送る
      const d = distance(from, sys);
      const same = sys.id === from.id; // 首都と同じ星系の天体は、時代の課題の「星系の数」に数えない
      const ok = g.check(sys.id, b.id, grade >= 1 ? 'planet' : 'station').ok;
      rows.push({ sys, b, grade, from, d, same, ok, rec: candRec(grade, d) });
    }
  }
  const sort = app.candSort || 'rec';
  rows.sort(sort === 'grade' ? (x, y) => y.grade - x.grade || x.d - y.d : sort === 'dist' ? (x, y) => x.d - y.d
    : (x, y) => x.same - y.same || y.ok - x.ok || y.rec - x.rec || x.d - y.d);
  const top = sort === 'rec' ? rows.find((r) => !r.same && r.ok) : null;
  const stars = (v) => '★'.repeat(clamp(Math.ceil(v / 0.6), 1, 4));
  const body = rows.slice(0, 100).map((row) => {
    const { sys, b, grade, from, d } = row;
    const solid = b.type === 'rocky' || b.type === 'dwarf';
    let nat = TR('なし');
    if (g.isSurveyed(sys.id)) {
      const n = g.nativeOf(sys.id, b.id);
      nat = n ? `<span class="nat">${esc(n.def.species)}</span> <span class="muted">${nativeStatus(n)}</span>` : TR('なし');
    }
    const res = MINED.filter((r) => b.deposits?.[r] > 0.05).map((r) => `${RES_LABEL[r]}${stars(b.deposits[r])}`).join(' ') || '—';
    const kind = grade >= 1 ? 'planet' : 'station';
    const c = g.check(sys.id, b.id, kind);
    const send = costButton(g, `data-act="candsend" data-sys="${sys.id}" data-body="${esc(b.id)}" data-kind="${kind}" data-from="${from.id}"`,
      `${ico(kind === 'planet' ? 'planetcol' : 'station')}${kind === 'planet' ? TR('入植船') : TR('ステーション')}`, g.shipCost(kind, from.id, sys.id), from.id, c.ok ? '' : c.reason);
    const ship = g.ships.find((x) => x.to === sys.id && x.body === b.id && g.departSeen(x.from, x.depart));
    const prep = g.knownProjects().find((j) => j.type === 'ship' && j.to === sys.id && j.body === b.id);
    const status = ship ? TR`<span class="tag colony">${ico('colony')}入植船 航行中</span> <span class="muted">あと ${(ship.arrive - g.year).toFixed(1)} 年</span>`
      : prep ? TR`<span class="tag shortage">${ico('develop')}入植船 準備中</span> <span class="muted">あと ${(prep.ready - g.year).toFixed(1)} 年</span>` : '';
    const mark = row === top ? TR('<span class="tag rec">おすすめ</span>') : row.same ? TR('<span class="tag muted">課題に数えない</span>') : '';
    return TR`<tr class="${ship || prep ? 'enroute' : ''}${row.same ? ' same' : ''}"><td><button data-act="gobody" data-sys="${sys.id}" data-body="${esc(b.id)}">${planetIcon(b)}${esc(b.name)}</button>${mark ? ` ${mark}` : ''}${status ? `<br>${status}` : ''}<div class="send">${send}</div></td>
      <td data-l="首都から">${d.toFixed(1)} ly</td><td data-l="種類">${planetIcon(b)}${TYPE_LABEL[b.type]}</td>
      <td data-l="入植適性">${solid ? `<b class="grade g${grade}">${GRADE_LABEL[grade]}</b>` : TR('<span class="muted">地表なし</span>')}</td>
      <td data-l="環境">${solid ? TR`${Math.round(b.tSurf - 273)} ℃・` : ''}${fmt(b.gravity)} g${solid ? TR`・${b.pressure < 0.001 ? TR('真空') : `${fmt(b.pressure)} atm`}` : ''}</td>
      <td data-l="先住民">${nat}</td><td data-l="資源">${res}</td></tr>`;
  }).join('');
  return TR`<h2>候補地 <span class="muted" style="font-size:13px">ハビタブルゾーン内の未入植の天体 ${rows.length} 件${rows.length > 100 ? TR` (${{ rec: TR('おすすめ順'), dist: TR('近い順'), grade: TR('入植適性の高い順') }[sort]}に100件を表示)` : ''}</span></h2>
    <div class="bulk">
      <label class="check"><input type="checkbox" data-act="candonly" ${app.candOnly ? 'checked' : ''}> 地表に入植できる天体だけ</label>
      並び順 <select data-act="candsort"><option value="rec" ${sort === 'rec' ? 'selected' : ''}>おすすめ順</option><option value="dist" ${sort === 'dist' ? 'selected' : ''}>首都から近い順</option><option value="grade" ${sort === 'grade' ? 'selected' : ''}>入植適性の高い順</option></select>
    </div>
    <div class="scroll"><table class="tbl cands">
      <tr><th>天体・${ico('colony')}入植船を送る</th><th>${ico('dist')}首都から</th><th>種類</th><th>${ico('suit')}入植適性</th><th>${ico('temp')}気温・${ico('gravity')}重力・${ico('atmo')}大気圧</th><th>${ico('natives')}先住民</th><th>${ico('mine')}資源</th></tr>
      ${body}</table></div>
    <p class="note">入植船は首都から出る。地表に入植できない天体には宇宙ステーション (回って遠心力で重力を作る居住区) を送る。入植船が向かっている天体は色付きで、到着までの年数を表示する。</p>
    <p class="note">おすすめ順: 入植適性 (地表に住めないならステーション) の高さを、首都からの距離で割り引いた順 (適性 ÷ (1 + 距離/6 光年)²。6 光年で 4 分の 1、12 光年で 9 分の 1)。首都と同じ星系の天体は、時代の課題の「星系の数」に数えないので下に回す (資源や人口のために送るのはよい)。</p>`;
}
// おすすめの度合い: 入植適性の重み (不可 = ステーション 0.5・困難 1・可 2・良好 3) を、距離の 2 乗で割り引く。遠いほど着くのも知らせが返るのも遅く、交易路も細い
const candRec = (grade, d) => (grade >= 1 ? grade : 0.5) / ((1 + d / 6) * (1 + d / 6));

const SHEETS = { empire: empireHtml, events: eventsHtml, cands: candidatesHtml };

// ヘッダーの数字: 資金・政治力・議会の支持 (人口と星系の数は帝国 → 経済・政策へ)。色は意味があるときだけ (赤字・議会が危うい)
function treasuryHtml(g) {
  const inc = g.income();
  const pci = g.pcLast || g.pcIncome().total;
  const sg = (v) => `${v >= 0 ? '+' : '−'}${fmtAmt(Math.abs(v))}`;
  return TR`<span class="k">${ico('credits')}資金</span><span class="v">${fmtAmt(g.credits)} cr</span> <span class="${inc < 0 ? 'bad' : 'muted'}">${sg(inc)}</span>
    <span class="k" style="margin-left:16px" title="政治力 (${ME.home}の意志): 星系の政府への指令に使う。年ごとに貯まる">${ico('pc')}政治力</span><span class="v">${Math.floor(g.pc)}</span> <span class="muted">${sg(pci)}</span>
    <span class="k" style="margin-left:16px" title="${ME.council}の支持: 15を割ると政権交代">${ico('council')}議会</span><span class="v ${g.council < 25 ? 'bad' : ''}">${Math.round(g.council)}</span>`;
}

function ledgerHtml(g) {
  return Object.entries(LEDGER_LABEL).map(([k, l]) => {
    const v = g.ledger[k] || 0;
    return TR`<tr><td>${ico(LEDGER_ICON[k])}${l}</td><td class="${v < 0 ? 'bad' : ''}">${v >= 0 ? '+' : ''}${fmtAmt(v)} cr/年</td></tr>`;
  }).join('');
}

const fmtSv = (v) => (v >= 1 ? `${v.toPrecision(3)} Sv` : v >= 1e-3 ? `${(v * 1e3).toPrecision(3)} mSv` : `${(v * 1e6).toPrecision(3)} µSv`);
// 遮蔽の目安: 10 光年を 0.95c で行く 1 単位の荷と、移民 1 万人の船
function shieldNote(phys) {
  const c = shieldOf('cargo', UNIT_KG, SHIP_SPEED, 10, phys), m = shieldOf('migrant', 1e4 * MIGRANT_KG, SHIP_SPEED, 10, phys);
  const f = (x, kg) => TR`前 水 ${(x.depth / 100).toFixed(0)} m${x.side ? TR`・横 ${(x.side / 100).toFixed(1)} m` : ''} (質量の +${((100 * x.kg) / kg).toFixed(1)}%)`;
  return TR`荷 1 単位: ${f(c, UNIT_KG)}・移民 1 万人: ${f(m, 1e4 * MIGRANT_KG)}`;
}
// 右の欄のエネルギー。首都はいまの値、ほかは光が届いた時点の記録 (known)
function energyBox(g, id, k) {
  const now = id === g.cap;
  const E = now ? g.energyOf(id) : k?.energy || 0, P = now ? g.power(id) : k?.power || 0;
  const sys = g.system(id), lum = sys.stars.reduce((a, x) => a + (x.lum || 0), 0);
  const rf = g.physics.pv ? g.pvOf(id, g.pvDesign(id)).rf : 1; // 太陽電池が陽子で傷んだ分と集光の損 (シミュレーション版だけ)
  const cover = lum ? P / (lum * L_SUN_W * PROP.pv * rf * YEAR_S) : 0;
  return TR`<table class="tbl"><tr><td>蓄え</td><td>${fmtJ(E)} <span class="muted">(上限 ${fmtJ(SWARM.store * P)})</span></td></tr>
    <tr><td>スウォームの発電</td><td>${fmtJ(P)}/年</td></tr><tr><td>恒星の光を覆う割合</td><td>${cover >= 0.01 ? pct(cover) : cover.toExponential(1)}${id === 0 ? TR(' <span class="muted">(地球の方向は空けて回る。地球が受ける光は太陽の光の 22 億分の 1 なので、空けても発電はほとんど減らず、地球の気候も変わらない)</span>') : ''}</td></tr>
    <tr><td>交易路で 1 単位 (100 万 t) を運ぶ</td><td>${decUnit() === E_UNIT ? TR`${fmtJ(E_UNIT)} ずつ (送る側の加速・受ける側の減速)` : TR`送る側の加速 ${fmtJ(E_UNIT)}・受ける側の減速 ${fmtJ(decUnit())} (近づく帆を止める光は少なくて済む)`}</td></tr>
    ${g.physics.pv ? pvDesignRows(g, id) : ''}${g.physics.shield ? TR`<tr><td>星間の気体と宇宙線の遮蔽 (10 光年・0.95c)</td><td>${shieldNote(g.physics)}</td></tr>` : ''}</table>`;
}
// スウォームの素子の作り (シミュレーション版だけ)。作りごとの出力の残りと、覆う割合が倍になる年数。自国の星系なら選べる (光速の指令)
function pvDesignRows(g, id) {
  const cur = g.pvDesign(id), set = g.govs[id]?.pvd ?? g.pvPolicy ?? 'auto';
  const yrs = (r) => (r > 1e-3 ? TR`${(Math.LN2 / r).toFixed(1)} 年` : TR('広がらない'));
  const list = Object.entries(PV_DESIGNS).map(([k, d]) => { const v = g.pvOf(id, k); return TR`<li><b>${k}. ${d.label}</b>${k === cur ? TR(' (いま)') : ''} — 出力の残り ${pct(v.rf)}・倍になる年数 ${yrs(v.rate)} <span class="muted">(${d.note})</span></li>`; }).join('');
  const own = g.realmOf(id) === g.cap && g.isColonized(id);
  const sel = own ? `<select data-act="pvdesign" data-sys="${id}">${['auto', ...Object.keys(PV_DESIGNS)].map((k) => `<option value="${k}" ${k === set ? 'selected' : ''}>${k === 'auto' ? TR`自動 (${PV_PICK.horizon} 年あとの発電が一番大きい作り)` : `${k}. ${PV_DESIGNS[k].label}`}</option>`).join('')}</select>${id === g.cap ? '' : TR` <small class="muted">届くまで ${g.lightDelay(id).toFixed(1)} 年</small>`}` : '';
  return TR`<tr><td>スウォームの素子の作り</td><td>いま <b>${cur}. ${PV_DESIGNS[cur].label}</b> ${sel}<ul>${list}</ul><small class="muted">フレアの陽子が電池を傷める (M 型星で強い)。重い素子ほど自己複製で広がるのが遅い。作りを変えると、いまの覆う割合から新しい速さで広がり直す</small></td></tr>`;
}
// エネルギーの収支 (いまの政府)。使った量は負
function eLedgerHtml(g) {
  const gv = g.gov(g.cap);
  const L = gv.eledger || {};
  const rows = Object.entries(E_LABEL).filter(([k]) => L[k]).map(([k, l]) => TR`<tr><td>${l}</td><td class="${L[k] < 0 ? 'bad' : ''}">${L[k] >= 0 ? '+' : '−'}${fmtJ(Math.abs(L[k]))}/年</td></tr>`).join('');
  return TR`<tr><td>蓄え</td><td>${fmtJ(gv.E || 0)} <span class="muted">(上限 ${fmtJ(SWARM.store * g.power(g.cap))})</span></td></tr>${rows}`;
}
function logHtml(game) {
  // イベントタブで隠している種類 (既定では資源不足・移民) は、右の記録にも出さない
  return game.knownLog().filter((l) => !l.kind || evShown(l.kind)).slice(0, 8).map((l) => {
    const late = (l.seen ?? l.year) - l.year;
    return `<div><span class="muted">${l.year.toFixed(1)}</span> ${esc(l.text)}${late > 0.05 ? TR` <span class="muted">(${late.toFixed(1)}年遅れで届いた)</span>` : ''}</div>`;
  }).join('');
}
function logHtmlOld(game) {
  return game.log.slice(0, 8).map((l) => `<div><span class="muted">${l.year.toFixed(1)}</span> ${esc(l.text)}</div>`).join('');
}








const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const canvas = $('map');
const SPEEDS = [0, 1 / 12, 1 / 4, 1, 4, 16, 64]; // 年/秒 (data-speed はこの添字)

