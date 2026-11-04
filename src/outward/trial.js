// --- 体験版 (回 SO4・B-082。docs/trial.md) ---
// tools/build.mjs --trial で、core/base.js の TRIAL を true にした 1 枚 (demo.html) を作る。中身はゲーム版と同じ (EDITION は game のまま。セーブの形も同じ) で、次だけが違う:
//   - 最初の時代 (2300〜2400 年。TRIAL_YEARS) だけ遊べる。終わりの年は 2400 年に決まり、終わったら先へ進めない (screen/hotseat.js の setSpeed)
//   - ホームにネット対戦とホットシート (マルチプレイ・友達と遊ぶ) の頁を出さない
//   - 保存の名前を分ける (nlu-demo。core/base.js の STORE)。終わりの年が 2400 年でないセーブと、2400 年を越えたセーブは読まない (screen/playlog.js の loadSave)
//   - 終わりの画面に、この時代の答え合わせ・セーブの書き出し・製品版への案内を出す (書き出したファイルは製品版でそのまま読め、2400 年から続けられる)
// 評論家の 4-2 (docs/critique/04-plan.md): 終わりに答え合わせを見せて、続きを遊びたくさせる。Steam Next Fest に出すのはストアのページと Steamworks のアカウント (QD-21) のあと
const TRIAL_HIDE = ['multi', 'friends'];
const TRIAL_STORE_URL = ''; // ストアのページ (Steam のアプリの番号が決まったら入れる。QD-21。空なら案内の文だけ)
const endChoices = () => (TRIAL ? END_CHOICES.filter(([y]) => y === TRIAL_YEARS) : END_CHOICES);
// 体験版で読めるセーブか (ゲーム版はいつでも読める)。終わりの年の処理は年の区切りなので、終わったときは 2400 年を少し過ぎている (1 年まで許す)
function trialSaveOk(d) { return !TRIAL || (!!d && d.endYear === START_YEAR + TRIAL_YEARS && !(d.year > START_YEAR + TRIAL_YEARS + 1)); }
const trialAbout = () => TR`体験版 (最初の時代 ${START_YEAR}〜${START_YEAR + TRIAL_YEARS}年。ネット対戦とホットシートは製品版で)`;
// 終わりの画面 (screen/hotseat.js の showEnd) を体験版の形に: 続けて遊ぶボタンの代わりに、答え合わせ・書き出し・製品版への案内
function trialEndPatch() {
  const card = $('endbox')?.querySelector('.card');
  if (!card) return;
  card.querySelector('#endgo')?.remove();
  const note = [...card.querySelectorAll('p.note')].pop();
  const text = TR`体験版はここまで (最初の時代 ${START_YEAR}〜${START_YEAR + TRIAL_YEARS}年)。製品版では ${START_YEAR + 500}年まで、5 つの時代を続けて遊べる (時代ごとに答え合わせ)。「セーブを書き出す」で作ったファイルを製品版で読めば、この試合を ${START_YEAR + TRIAL_YEARS}年から続けられる。`;
  if (note) note.outerHTML = `<p class="note trial-end">${text}</p>`;
  card.querySelector('.btns')?.insertAdjacentHTML('afterbegin', `<button id="trialreview">${TR('この時代の答え合わせ')}</button><button id="trialexport">${TR('セーブを書き出す')}</button>${TRIAL_STORE_URL ? `<button id="trialstore">${TR('ストアのページ')}</button>` : ''}`);
  $('trialreview').onclick = () => showEraReview(app.game, 0);
  $('trialexport').onclick = () => exportSave();
  if ($('trialstore')) $('trialstore').onclick = () => window.open(TRIAL_STORE_URL, '_blank', 'noopener');
}
