// --- ホーム画面 (新しいゲーム・続きから・セーブスロット・ファイル) ---
// ホーム画面を開いているあいだは時間を止める。スロットは自動セーブとは別に保存する
const SLOT_KEYS = [1, 2, 3].map((i) => `${STORE}-slot-${i}`);
// m = セーブの概要 (saveMeta)
function saveInfo(m) {
  if (!m) return '<span class="muted">空き</span>';
  return `西暦 ${Math.floor(m.year)}年・入植星系 ${m.sys}・銀河 #${esc(String(m.seed))}${m.spectate ? '・<b>観戦</b>' : ''}
    ${m.savedAt ? `<br><span class="muted">${esc(new Date(m.savedAt).toLocaleString('ja-JP'))}</span>` : ''}`;
}
function homeHtml() {
  const armed = (k) => app.homeArmed === k;
  const slots = SLOT_KEYS.map((k, i) => {
    const d = Store.meta[k];
    return `<div class="row"><div class="info"><b>スロット ${i + 1}</b><br>${saveInfo(d)}</div>
      <button data-home="slotsave" data-i="${i}">${armed(`save${i}`) ? '上書きする?' : 'ここにセーブ'}</button>
      <button data-home="slotload" data-i="${i}" ${d ? '' : 'disabled'}>ロード</button>
      <button class="ghost" data-home="slotdel" data-i="${i}" ${d ? '' : 'disabled'}>${armed(`del${i}`) ? '本当に削除?' : '削除'}</button></div>`;
  }).join('');
  const tabs = `<div class="htabs"><button data-home="tab" data-t="game" class="${!['nations', 'account'].includes(app.homeTab) ? 'on' : ''}">ゲーム</button><button data-home="tab" data-t="nations" class="${app.homeTab === 'nations' ? 'on' : ''}">国家づくり (${NationLib.list.length})</button><button data-home="tab" data-t="account" class="${app.homeTab === 'account' ? 'on' : ''}">アカウント${Cloud.user ? ' ✓' : ''}</button></div>`;
  if (app.homeTab === 'nations') return `<div class="card"><h1>${brandHtml()}</h1>${tabs}${nationsTabHtml()}</div>`;
  if (app.homeTab === 'account') return `<div class="card"><h1>${brandHtml()}</h1>${tabs}${accountTabHtml()}</div>`;
  // はじめて開いた人には「はじめる」1 つだけを見せ、細かい設定は「詳しい設定」に畳む (B-045)。
  // 銀河の番号つきの URL で開いたときは、その番号が見えるように開いておく
  const more = app.homeMore ?? params.get('seed') !== null;
  const going = homeGoing();
  return `<div class="card">
    <div class="cover"><h1>${brandHtml()}</h1><p>光速の壁の向こうへ広がる恒星間植民</p>
      <div class="go"><button class="big" data-home="start">${armed('start') ? '本当に? いまのゲームは消える' : 'はじめる'}</button>
        ${going ? `<button data-home="resume">${app.started ? 'ゲームに戻る' : '続きから'}<small>${saveInfo(saveMeta(buildSave(app.game)))}</small></button>` : ''}</div>
      <p class="hint">地球から最初の入植船を送るところから。</p></div>
    ${app.homeNote ? `<p class="note bad">${esc(app.homeNote)}</p>` : ''}
    ${tabs}
    <p class="muted">${EDITION_LABEL[EDITION]} (<a href="${EDITION_FILE[EDITION === 'sim' ? 'game' : 'sim']}">${EDITION_LABEL[EDITION === 'sim' ? 'game' : 'sim']}を開く</a>)</p>
    <details class="sec" data-home-more="settings" ${more ? 'open' : ''}><summary>詳しい設定<span class="syn">${homeSettingsSyn()}</span></summary>
      <div class="row"><label>銀河の番号 <input id="home-seed" type="text" inputmode="numeric" placeholder="空欄ならランダム" value="${esc(app.homeSeed || '')}"></label>
        <label><input id="home-spectate" type="checkbox" ${app.homeSpectate ? 'checked' : ''}> 観戦モード</label></div>
      <div class="row"><label>国の数 <select id="home-nat">${NATION_COUNTS.map((n) => `<option value="${n}" ${n === (app.homeNat ?? 1) ? 'selected' : ''}>${n === 1 ? '地球だけ (国家選択なし)' : `${n} か国から選ぶ`}</option>`).join('')}</select></label>
        <label>難易度 <select id="home-hc">${Object.entries(HANDICAP).map(([k, h]) => `<option value="${k}" ${k === (app.homeHc ?? 'normal') ? 'selected' : ''}>${h.label}</option>`).join('')}</select></label></div>
      <div class="row"><label>生産性 <select id="home-prod">${Object.entries(PRODUCTIVITY).map(([k, p]) => `<option value="${k}" ${k === (app.homeProd ?? 'now') ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
        <label>倍率 <input id="home-prodk" type="number" inputmode="decimal" min="${PRODUCTIVITY_RANGE[0]}" max="${PRODUCTIVITY_RANGE[1]}" step="any" value="${esc(String(app.homeProdK ?? 1))}" ${(app.homeProd ?? 'now') === 'custom' ? '' : 'disabled'}></label></div>
      <p class="note">生産性: 1 人あたりの産出 (農業・鉱業・工業・採掘基地) の倍率。「現代のまま」は 2023 年の最前線の国の生産性。「2300 年の予測」は、1890〜2023 年の米国の労働生産性の伸び (年 2.0%) とコンドラチェフの波から延ばした値で、最近の伸び (年 1.3%) が続くなら ×33。「自分で決める」は ${PRODUCTIVITY_RANGE[0]}〜${PRODUCTIVITY_RANGE[1]} 倍。</p>
      ${NationLib.list.length ? `<div class="row"><span class="muted">自作の国を出す</span>${NationLib.list.map((n) => `<label><input type="checkbox" class="home-lib" value="${n.id}" ${(app.homeLib || []).includes(n.id) ? 'checked' : ''}> ${esc(n.name)}</label>`).join('')}</div>` : ''}
      ${ED.physics.pv ? `<div class="row"><label>スウォームの素子の作り (全部の星系の既定) <select id="home-pv">${['auto', ...Object.keys(PV_DESIGNS)].map((k) => `<option value="${k}" ${k === (app.homePv ?? 'auto') ? 'selected' : ''}>${k === 'auto' ? '星系ごとに自動' : `${k}. ${PV_DESIGNS[k].label} — ${PV_DESIGNS[k].note}`}</option>`).join('')}</select></label></div>` : ''}
      <div class="row"><label>終わりの年 <select id="home-end">${END_CHOICES.map(([y, l]) => `<option value="${y}" ${y === (app.homeEnd ?? 500) ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="row"><span class="muted">挑戦 (選ばなくてもよい)</span>${Object.entries(CHALLENGES).map(([k, c]) => `<label title="${esc(c.desc)}"><input type="checkbox" class="home-ch" value="${k}" ${(app.homeCh || []).includes(k) ? 'checked' : ''}> ${c.label}</label>`).join('')}
        <button data-home="new">${armed('new') ? '本当に? いまのゲームは消える' : 'この設定ではじめる'}</button></div>
      <p class="note">挑戦: ${Object.values(CHALLENGES).map((c) => `<b>${c.label}</b> = ${esc(c.desc)}`).join('。')}。「60星系」と「独立を許さない」は引っ張り合う (広げるほど遠い家臣が増える)。終わりの年に点数が確定する (そのあとも続けて遊べる)。</p>
      <p class="note">国の数を2つ以上にすると、銀河地図の上でどの国を動かすか選ぶ。選ばなかった国は AI が動かす。国ごとに種族と特性 (人口の増え方・得意な産業など) が違う。<br>難易度 (ハンディキャップ表): ${Object.values(HANDICAP).map((h) => `<b>${h.label}</b> = AI の国の収入 ×${h.aiIncome}・建設費 ×${h.aiCost}・他国の艦隊${INFO_LABEL[h.info]}`).join('。')}。AI の考え方は変わらない。</p>
      <p class="note">いまのゲームは、スロットにセーブしておかないと新しいゲームで上書きされる (自動セーブは1つだけ)。</p>
      <p class="note">観戦モード: 光の遅れなしに実際の様子 (船の実際の位置・各星系のいまの状態) を見られ、${ME.gov}も自動で入植・開発・防衛・戦争をする。ゲーム中でも上の「観戦」ボタンで切り替えられる。</p>
    </details>
    <details class="sec" data-home-more="saves" ${app.homeSaves ? 'open' : ''}><summary>セーブ・ファイル・プレイ記録</summary>
    <section><h3>セーブスロット</h3>${slots}</section>
    <section><h3>ファイル</h3><div class="row"><button data-home="export">ファイルに書き出し</button><button data-home="import">ファイルから読み込み</button></div></section>
    ${playLogHtml()}
    </details>
    <section><h3>ネット対戦</h3>
      <div class="row"><div class="info">別の端末の人と、サーバーなしでつないで遊ぶ。ホストは国家選択で「＋人間」を 2 つ以上にして「ネット対戦」を選ぶ (いまのゲームに人間が 2 人以上いれば、ここからもホストになれる)。参加する人は、ホストの招待コードを貼る。</div>
        ${app.game.humans().length > 1 ? '<button data-home="nethost">ホストになる</button>' : ''}<button data-home="netjoin">参加する</button></div></section>
  </div>`;
}
// いまのゲームを続ける意味があるか (始めたあと・セーブを読んだあと。開いたばかりの仮のゲームは数えない)
function homeGoing() { return !!app.started || app.game.year > START_YEAR + 0.01; }
// 「詳しい設定」を閉じていても、いまの設定が分かるように 1 行で
function homeSettingsSyn() {
  const parts = [];
  if (app.homeSeed) parts.push(`銀河 #${esc(app.homeSeed)}`);
  if ((app.homeNat ?? 1) > 1) parts.push(`${app.homeNat} か国`);
  if ((app.homeHc ?? 'normal') !== 'normal') parts.push(HANDICAP[app.homeHc]?.label);
  if ((app.homeProd ?? 'now') !== 'now') parts.push(`生産性 ${PRODUCTIVITY[app.homeProd]?.label}`);
  if ((app.homeCh || []).length) parts.push(`挑戦 ${app.homeCh.length}`);
  if (app.homeSpectate) parts.push('観戦');
  return parts.length ? parts.join('・') : '標準 (地球だけ・ふつう・500 年)';
}
// ホーム画面の「アカウント」タブ: ログイン・名前・クラウドのセーブ・国家の保管庫・Firebase の設定
function accountTabHtml() {
  const C = Cloud;
  const st = C.status ? `<p class="note">${esc(C.status)}</p>` : '';
  const cfg = `<section><h3>Firebase の設定</h3>
      <p class="note">${FIREBASE_CONFIG ? 'このゲームには Firebase の設定が入っている。' : 'このゲームには、まだ Firebase の設定が入っていない。'}Firebase のコンソールで作ったウェブアプリの設定 (firebaseConfig の JSON) を貼ると、この端末だけで使える。</p>
      <textarea id="acct-cfg" rows="4" placeholder='{"apiKey": "…", "authDomain": "…", "projectId": "…", "appId": "…"}'>${esc(localStorage.getItem?.(C.configKey) || '')}</textarea>
      <div class="row"><button data-home="acctcfg">設定を使う</button><button class="ghost" data-home="acctcfgdel">貼った設定を消す</button></div></section>`;
  if (!C.available()) return `<section><h3>アカウント</h3><p>アカウントを作ると、セーブと自作の国をクラウドに置いて別の端末でも使えるようになり、ネット対戦も部屋のコードだけでつなげる。</p></section>${st}${cfg}`;
  if (!C.api) { C.init(); return `<section><h3>アカウント</h3><p class="muted">Firebase につないでいる…</p></section>${st}${cfg}`; }
  if (!C.user) {
    return `<section><h3>ログイン</h3>
      <div class="row"><button class="big" data-home="acctgoogle">Google でログイン</button><button data-home="acctguest">ゲストではじめる</button></div>
      <div class="row"><input id="acct-email" type="email" autocomplete="email" placeholder="メールアドレス"><input id="acct-pw" type="password" autocomplete="current-password" placeholder="パスワード (6 文字以上)"></div>
      <div class="row"><button data-home="acctlogin">メールでログイン</button><button data-home="acctsignup">メールで新しく作る</button></div>
      <p class="note">ゲストは、この端末のブラウザの中だけのアカウント (あとで消えることがある)。</p></section>${st}${cfg}`;
  }
  if (!C.saves) C.listSaves().then(() => C.refresh()).catch((e) => { C.status = `セーブの一覧を読めなかった: ${e.message || e}`; C.saves = []; C.refresh(); });
  const saves = (C.saves || []).map((m) => `<div class="row"><div class="info">${saveInfo(m)}${(m.ed || 'game') !== EDITION ? ` <span class="muted">(${EDITION_LABEL[m.ed || 'game']})</span>` : ''}</div>
      <button data-home="acctload" data-id="${esc(m.id)}" ${(m.ed || 'game') !== EDITION ? 'disabled' : ''}>ロード</button><button class="ghost" data-home="acctdel" data-id="${esc(m.id)}">${app.homeArmed === `cdel${m.id}` ? '本当に削除?' : '削除'}</button></div>`).join('');
  return `<section><h3>アカウント</h3>
      <div class="row"><div class="info"><b>${esc(C.name())}</b>${C.user.email ? ` <span class="muted">${esc(C.user.email)}</span>` : ''}${C.user.guest ? ' <span class="muted">(ゲスト)</span>' : ''}</div><button class="ghost" data-home="acctout">ログアウト</button></div>
      <div class="row"><input id="acct-name" maxlength="20" value="${esc(C.user.name || '')}" placeholder="ネット対戦で見せる名前"><button data-home="acctname">名前を変える</button></div></section>
    ${st}
    <section><h3>クラウドのセーブ</h3>
      <div class="row"><div class="info">いまのゲーム: ${saveInfo(saveMeta(buildSave(app.game)))}</div><button data-home="acctsave">クラウドに保存</button></div>
      ${C.saves ? saves || '<p class="muted">まだない</p>' : '<p class="muted">読んでいる…</p>'}</section>
    <section><h3>自作の国 (国家づくり)</h3>
      <div class="row"><div class="info">この端末に ${NationLib.list.length} つ</div><button data-home="acctnatpush">クラウドへ送る</button><button data-home="acctnatpull">クラウドから足す</button></div></section>
    <section><h3>ネット対戦</h3><p class="note">ログインしていれば、ネット対戦のホストは「部屋を作る」でコードを出し、参加する人はそのコードを入れるだけでつながる。</p></section>
    ${cfg}`;
}
