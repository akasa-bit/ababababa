// 画面の文字列と翻訳 (回 T1・B-073。決まりは docs/i18n.md)。
// 正本はコードの中の日本語の文。道具 (node tools/i18n.js) がそれを集めて、言語ごとの表 (outward/lang-en.js の I18N_EN) の鍵にする。
// - TR`…${x}…` / TR('…'): 画面に出す文。いまの言語の訳を返す (訳がなければ日本語のまま)。差し込む値に日本語があれば TX で訳す。
// - JA`…${x}…`: 試合の状態 (出来事・記録・名前) に入る文。どの言語でも日本語のまま返す (セーブと状態の要約を言語で変えないため)。
//   画面に出すときに TX で訳す (JA で作った文は、作った鍵と値を覚えておくので、そのまま訳せる)。
// - TX(s): 状態から来た日本語の文を、表・覚えた鍵・文の型・名前の作り方の順に探して訳す。見つからない所は日本語のまま。
// 日本語のときは、TR・JA・TX は渡した文をそのまま返す (試合の筋も画面も、翻訳を入れる前と 1 字も変わらない)。
// 言語の切り替えは、読み込み直したときに効く (表を読み込みのときに引く所があるため)。
const LANGS = { ja: '日本語', en: 'English' };
const LANG_KEY = 'nlu-lang';
const LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && LANGS[q]) { try { localStorage.setItem(LANG_KEY, q); } catch { /* 保存できなくても、その画面だけは効く */ } return q; }
    const s = localStorage.getItem(LANG_KEY);
    if (s && LANGS[s]) return s;
    if (typeof navigator !== 'object' || navigator.webdriver) return 'ja'; // 自動の試験 (Playwright) と画面なしの版は日本語
    const l = String((navigator.languages && navigator.languages[0]) || navigator.language || 'ja');
    return /^ja\b/i.test(l) ? 'ja' : 'en';
  } catch { return 'ja'; }
})();
const LOCALE = LANG === 'ja' ? 'ja-JP' : 'en-US'; // 日付と時刻の書き方
function setLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch { /* 保存できない環境 */ } location.reload(); }

const I18N_JP = /[぀-ヿ㐀-鿿！-～]/; // ひらがな・カタカナ・漢字・全角の記号
const I18N_LIMIT = 20000; // 覚えておく文の数 (多すぎたら古いものから捨てる)
const i18nKeys = new WeakMap(); // TR・JA の文の部品 (strings) → 表の鍵
const i18nMemo = new Map(); // JA で作った文 → [鍵, 値]
const i18nCache = new Map(); // TX の答え
function i18nKey(s) {
  let k = i18nKeys.get(s);
  if (k === undefined) { k = s[0]; for (let i = 1; i < s.length; i++) k += `{${i - 1}}${s[i]}`; i18nKeys.set(s, k); }
  return k;
}
function i18nCat(s, v) { let r = s[0]; for (let i = 0; i < v.length; i++) r += String(v[i]) + s[i + 1]; return r; }
function i18nTable() { return LANG === 'en' && typeof I18N_EN === 'object' ? I18N_EN : null; }
function i18nRemember(m, k, v) { if (m.size >= I18N_LIMIT) m.delete(m.keys().next().value); m.set(k, v); }
// 訳の「{0}」に値を入れる。値の日本語も訳す
// 訳の中の書き方: {1:month} = 月の番号を月の名前に (Jan…Dec)
const I18N_FMT = { month: (x) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(x) - 1] ?? x };
const i18nPut = (w, i, f, all) => (+i < w.length ? (f && I18N_FMT[f] ? I18N_FMT[f](w[+i]) : String(w[+i])) : all);
function i18nFill(tr, v) { const w = v.map(TX); return tr.replace(/\{(\d+)(?::(\w+))?\}/g, (all, i, f) => i18nPut(w, i, f, all)); }

// 値を属性 (value="…"・data-…="…" など) に入れる所は訳さない (選んだ値が指令や名前になって、試合の状態に入るため)
const I18N_ATTR = /\b(?:value|data-[\w-]+|id|class|name|href|src|style|for|type)=["']?[^"'<>]*$/i;
function i18nVals(s, v) { return v.map((x, i) => (I18N_ATTR.test(s[i]) ? x : TX(x))); }
function TR(s, ...v) {
  if (LANG === 'ja') return Array.isArray(s) ? i18nCat(s, v) : s;
  const tbl = i18nTable();
  if (Array.isArray(s)) {
    const tr = tbl && tbl[i18nKey(s)], w = i18nVals(s, v);
    return typeof tr === 'string' ? tr.replace(/\{(\d+)(?::(\w+))?\}/g, (all, i, f, at) => (at === 0 ? i18nCap(i18nPut(w, i, f, all)) : i18nPut(w, i, f, all))) : i18nCat(s, w); // 訳の頭に来た値は大文字で始める
  }
  return TX(s);
}
function JA(s, ...v) {
  const r = i18nCat(s, v);
  if (LANG !== 'ja' && I18N_JP.test(r)) i18nRemember(i18nMemo, r, [i18nKey(s), v]);
  return r;
}

// 文の型 (「{0}」を含む鍵) を正規表現にしたもの。初めて TX が要るときに作る
let i18nPatterns = null;
function i18nCompile(tbl) {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = [];
  for (const [k, tr] of Object.entries(tbl)) {
    if (typeof tr !== 'string' || !/\{\d+\}/.test(k)) continue;
    const parts = k.split(/\{(\d+)\}/); // [文, 番号, 文, 番号, …]
    const lits = parts.filter((_, i) => i % 2 === 0);
    const lit = lits.join('');
    if ((lit.replace(/[万億兆人]/g, '').match(/[\u3040-\u30fa\u30fc-\u30ff\u3400-\u9fff]/g) || []).length < 2) continue; // 数の単位 (「{0}万人」) は数の書き方 (i18nUnits) で直す // 日本語の字が 2 つない型 (「{0}{1}」「{0}・{1}」など) は当てずっぽうになるので使わない
    const order = parts.filter((_, i) => i % 2 === 1).map(Number);
    let src = '^';
    parts.forEach((p, i) => { src += i % 2 === 0 ? esc(p) : '((?:(?! / |\\n)[\\s\\S])+?)'; }); // 値は「 / 」と改行をまたがない (いくつかの文をつないだ記録を、1 つの型で取り違えないように)
    const key = lits.reduce((a, b) => (b.length > a.length ? b : a), '');
    out.push({ re: new RegExp(`${src}$`), order, tr, key, score: lit.length });
    // 「。{0}…」「 — {0}…」のように区切りで始まる型は、区切りで分けたあとの切れ端にも当てる (訳の頭の区切りも外す)
    const lead = parts[0].match(/^(。|、|・| — |: |；)/);
    if (lead) {
      const l2 = [parts[0].slice(lead[0].length), ...lits.slice(1)], key2 = l2.reduce((a, b) => (b.length > a.length ? b : a), '');
      out.push({ re: new RegExp(`^${src.slice(1 + esc(lead[0]).length)}$`), order, tr: tr.replace(/^[\s.,;:—·-]+/, ''), key: key2, score: lit.length - lead[0].length });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
function i18nMatch(s, tbl, depth) {
  i18nPatterns ??= i18nCompile(tbl);
  for (const p of i18nPatterns) {
    if (p.score > s.length || !s.includes(p.key)) continue;
    const m = s.match(p.re);
    if (!m) continue;
    const v = [];
    p.order.forEach((n, i) => { v[n] = m[i + 1]; });
    const w = v.map((x) => (x === undefined ? x : i18nTX(x, depth + 1)));
    return p.tr.replace(/\{(\d+)(?::(\w+))?\}/g, (all, i, f) => (w[+i] === undefined ? all : i18nPut(w, i, f, all)));
  }
  return null;
}

// 数の書き方: 日本語の「万・億・兆」を英語の k・M・B に。人口の書き方 (fmtPop) は試合の記録の文にも入るので日本語のまま作り、出すときにここで直す。
// 「3 万人」(数と単位のあいだに空白。記録の文) は people を付け、「120億人」(表の欄) は付けない
function i18nNum(x) { const a = Math.abs(x), f = (v, u) => `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(2).replace(/\.?0+$/, '')}${u}`; return a >= 1e12 ? f(x / 1e12, 'T') : a >= 1e9 ? f(x / 1e9, 'B') : a >= 1e6 ? f(x / 1e6, 'M') : a >= 1e4 ? f(x / 1e3, 'k') : String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
const I18N_UNIT = { 万: 1e4, 億: 1e8, 兆: 1e12 };
function i18nUnits(s) {
  const m = s.match(/^(-?[\d,]+(?:\.\d+)?)( ?)(万|億|兆)?(人)?$/);
  if (!m || (!m[3] && !m[4])) return null;
  const x = Number(m[1].replace(/,/g, '')) * (I18N_UNIT[m[3]] || 1);
  return m[4] && (m[2] || !m[3]) ? `${i18nNum(x)} ${x === 1 ? 'person' : 'people'}` : i18nNum(x);
}
// 名前: 作った星系の名前 (カタカナ → 作ったときの英字の形)。銀河を作るときに覚える (銀河は読み込みのたびにシードから作り直す)
const i18nNames = new Map();
function nameAlias(ja, en) { if (ja && en && ja !== en) i18nNames.set(ja, en); }
// 種族の名前の語幹など、表にないカタカナの名前を英字にする (作った名前は音節の表から、ほかはヘボン式に近い書き方で)
const KANA_ROMA = (() => {
  const base = 'アa イi ウu エe オo カka キki クku ケke コko サsa シshi スsu セse ソso タta チchi ツtsu テte トto ナna ニni ヌnu ネne ノno ハha ヒhi フfu ヘhe ホho マma ミmi ムmu メme モmo ヤya ユyu ヨyo ラra リri ルru レre ロro ワwa ヲo ンn ガga ギgi グgu ゲge ゴgo ザza ジji ズzu ゼze ゾzo ダda ヂji ヅzu デde ドdo バba ビbi ブbu ベbe ボbo パpa ピpi プpu ペpe ポpo ヴvu';
  const m = new Map(base.split(' ').map((x) => [x[0], x.slice(1)]));
  const two = 'ヴァva ヴィvi ヴェve ヴォvo ファfa フィfi フェfe フォfo ティti ディdi トゥtu ドゥdu シェshe ジェje チェche ウィwi ウェwe ウォwo キャkya キュkyu キョkyo シャsha シュshu ショsho チャcha チュchu チョcho ニャnya ニュnyu ニョnyo ヒャhya ヒュhyu ヒョhyo ミャmya ミュmyu ミョmyo リャrya リュryu リョryo ギャgya ギュgyu ギョgyo ジャja ジュju ジョjo ビャbya ビュbyu ビョbyo ピャpya ピュpyu ピョpyo';
  for (const x of two.split(' ')) m.set(x.slice(0, 2), x.slice(2));
  return m;
})();
function i18nSyllables(k) {
  // 作った名前の音節 (KANA_A・KANA_B・KANA_C と SYL_A・SYL_B・SYL_C は同じ順) で、長いものから区切る
  const pairs = [];
  try { if (!(KANA_A.length && KANA_B.length && KANA_C.length && SYL_A.length)) return null; } catch { return null; } // 表を読み込む前 (画面の骨組みを訳す所) は使わない
  KANA_A.forEach((x, i) => pairs.push([x, SYL_A[i]]));
  KANA_B.forEach((x, i) => pairs.push([x, SYL_B[i]]));
  KANA_C.forEach((x, i) => x && pairs.push([x, SYL_C[i]]));
  pairs.sort((a, b) => b[0].length - a[0].length);
  let out = '', i = 0;
  while (i < k.length) {
    const p = pairs.find(([x]) => k.startsWith(x, i));
    if (!p) return null;
    out += p[1]; i += p[0].length;
  }
  return out;
}
function romanize(k) {
  let r = i18nSyllables(k);
  if (r === null) {
    r = '';
    for (let i = 0; i < k.length; i++) {
      const c = k[i], two = KANA_ROMA.get(k.slice(i, i + 2));
      if (two) { r += two; i++; continue; }
      if (c === 'ー') { r += r.slice(-1).match(/[aiueo]/) ? r.slice(-1) : ''; continue; }
      if (c === 'ッ') { const nx = KANA_ROMA.get(k[i + 1]) || ''; r += nx[0] || ''; continue; }
      if (c === '・') { r += ' '; continue; }
      if (/[ァィゥェォャュョ]/.test(c)) { r += { ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o', ャ: 'ya', ュ: 'yu', ョ: 'yo' }[c]; continue; }
      const one = KANA_ROMA.get(c);
      if (one === undefined) return null;
      r += one;
    }
  }
  return r.replace(/(^|\s)([a-z])/g, (all, s, c) => s + c.toUpperCase());
}
// 名前の作り方 (docs/glossary/terms.json の rules)。表の suffix.* と同じ形 (I18N_EN の「{0}王国」など) は文の型で訳せるので、ここは語幹と番号だけ
function i18nName(s, depth) {
  const n = i18nNames.get(s);
  if (n) return n;
  if (/^[゠-ヿ]+$/.test(s)) return romanize(s); // カタカナだけの名前
  const sp = s.match(/^([゠-ヿ]+)人$/); // 種族 (「カラ人」→「Kara」。用語集の names.species)
  if (sp) { const r = romanize(sp[1]); if (r) return r; }
  return null;
}
// 名前と記号の組み立て (国の名前・番号つきの名前・括弧・終わりの句読点)。覚えた文と文の型で訳せなかったときに使う
function i18nStruct(s, depth) {
  const tbl = i18nTable();
  // 国の名前 = 語幹 + 接尾辞 (表の「{stem}王国」の型。語幹は種族の名前か星系の名前。長い接尾辞から)
  for (let i = 1; i < s.length; i++) {
    const tr = tbl[`{stem}${s.slice(i)}`];
    if (typeof tr !== 'string') continue;
    const stem = s.slice(0, i), r = i18nTX(stem, depth + 1);
    if (r !== stem && !I18N_JP.test(r)) return tr.replace('{stem}', r);
  }
  const num = s.match(/^(.+) ([A-Za-z0-9]+)$/); // 「セリス 2」「シリウス b」「セリス A」「金属 50」
  if (num) { const r = i18nTX(num[1], depth + 1); if (r !== num[1]) return `${r} ${num[2]}`; }
  const uni = s.match(/^(.+?) (-?[\d,]+(?:\.\d+)? ?(?:万|億|兆)?人?)$/); // 「ネリス 4.8万人」
  if (uni) { const n = i18nUnits(uni[2]); if (n !== null) return `${i18nTX(uni[1], depth + 1)} ${n}`; }
  const fac = s.match(/^(.+?)(\s*[×÷+−-]\s?[\d.,]+%?(?:\/年)?)$/); // 「X ×1.2」「X +5」「X −10」
  if (fac) { const r = i18nTX(fac[1], depth + 1); if (r !== fac[1]) return r + fac[2].replace('/年', '/yr'); }
  if (/^[宗分従]{2,}$/.test(s) && [...'宗分従'].every((c) => typeof tbl[c] === 'string')) return [...s].map((c) => tbl[c]).join(''); // 主権の束の記号 (宗・分・従)
  if (s.endsWith(')')) { // 「X (Y)」(Y の中の括弧も数える)
    let d = 0, j = s.length - 1;
    for (; j >= 0; j--) { if (s[j] === ')') d++; else if (s[j] === '(' && --d === 0) break; }
    if (j > 0) {
      const x0 = s.slice(0, j).replace(/ $/, ''), y0 = s.slice(j + 1, -1), x = i18nTX(x0, depth + 1), y = i18nTX(y0, depth + 1);
      if (x !== x0 || y !== y0) return `${x} (${y})`;
    }
  }
  const punct = s.match(/^(.+?)([,，:：;]+)$/); // 終わりの句読点
  if (punct) { const r = i18nTX(punct[1], depth + 1); if (r !== punct[1]) return r + punct[2].replace('，', ',').replace('：', ':'); }
  return null;
}
// 表の言葉 (と名前) を、長いものから文の中で探して置き換える (いくつかの言葉や名前をつないだ文のため)
let i18nPhrases = null;
function i18nPhrase(s) {
  const tbl = i18nTable();
  if (!i18nPhrases) {
    i18nPhrases = new Map();
    for (const [k, v] of Object.entries(tbl)) if (typeof v === 'string' && k.length >= 2 && !/\{\w+\}/.test(k) && !/[<>]/.test(k) && I18N_JP.test(k) && !/^[\u30a0-\u30ff]+$/.test(k)) { const l = i18nPhrases.get(k[0]) || []; l.push(k); i18nPhrases.set(k[0], l); }
    for (const l of i18nPhrases.values()) l.sort((a, b) => b.length - a.length);
  }
  let out = '', changed = false;
  for (let i = 0; i < s.length;) {
    const c = s[i];
    let hit = null;
    if (I18N_JP.test(c)) {
      for (const k of i18nPhrases.get(c) || []) if (s.startsWith(k, i)) { hit = [k, tbl[k]]; break; }
      for (const [k, v] of i18nNames) if ((!hit || k.length > hit[0].length) && k[0] === c && s.startsWith(k, i)) hit = [k, v];
    }
    if (!hit && /[\u30a0-\u30ff]/.test(c) && c !== '・' && c !== 'ー') { // カタカナの続きは名前として (表の音節 1 つずつにはしない)
      const w = s.slice(i).match(/^[\u30a0-\u30ff]+/)[0], r = i18nKana(w);
      if (r) hit = [w, r];
    }
    if (hit && s[i + hit[0].length] === '人' && /^[\u30a0-\u30ff]+$/.test(hit[0])) hit = [`${hit[0]}人`, hit[1]]; // 種族の名前 (「エルソル人」→「Elsor」)
    if (hit) { const prev = out.slice(-1), sp = prev && /[A-Za-z0-9)]/.test(prev) && /^[A-Za-z(]/.test(hit[1]) ? ' ' : ''; out += sp + hit[1]; i += hit[0].length; changed = true; } else { out += c; i++; }
  }
  return changed ? out : null;
}
// カタカナの続き: 表 (実在の地名・人名) → 作った名前 → 英字にする。「・」でつないだものは、まとめて見つからなければ 1 つずつ
function i18nKana(w) {
  const tbl = i18nTable(), one = (x) => (typeof tbl[x] === 'string' ? tbl[x] : i18nNames.get(x) ?? romanize(x));
  const r = typeof tbl[w] === 'string' ? tbl[w] : i18nNames.get(w);
  if (r) return r;
  if (w.includes('・')) { const ps = w.split('・').map((x) => (x ? one(x) : x)); if (ps.every((x) => x !== null)) return ps.join(' · ').replace(/^ · | · $/g, ''); }
  return romanize(w);
}
// 最後の手: 日本語の切れ目ごと (かな・漢字の続き) に、表と名前で訳せる所だけを訳す
function i18nRuns(s, depth) {
  const tbl = i18nTable();
  const out = s.replace(/[\u3040-\u30ff\u3400-\u9fff]+/g, (w) => (/^[\u30a0-\u30ff]+$/.test(w) ? i18nKana(w) ?? w : typeof tbl[w] === 'string' ? tbl[w] : w));
  return out !== s ? out : null;
}
// 区切りで分けて訳す (いくつかの文や言葉をつないだ記録のため)。区切りの位置で、頭から「表・覚えた文・文の型で訳せるいちばん長い切れ」を取っていく
// (「・」「、」は 1 つの言葉の中にもあるので、決まった強さで切るのでなく、訳せる長さで切る)
const I18N_SEP = / \/ |\n| — | → | ← |: |。|；| · |・|、|, /g; // 「, 」は join(TR('・')) で英語の区切りになった所
const I18N_SEP_EN = { '。': '. ', '、': ', ', '・': ', ', '；': '; ' };
function i18nKnown(x, depth) {
  const tbl = i18nTable();
  if (typeof tbl[x] === 'string') return tbl[x];
  const m = i18nMemo.get(x), tr = m && tbl[m[0]];
  if (typeof tr === 'string') return i18nFill(tr, m[1]);
  const r = i18nName(x, depth) ?? i18nMatch(x, tbl, depth);
  if (r !== null) return r;
  const st = i18nStruct(x, depth);
  return st !== null && !/[\u3040-\u30ff\u3400-\u9fff]/.test(st) ? st : null;
}
function i18nSplit(s, depth) {
  const seps = [...s.matchAll(I18N_SEP)];
  if (!seps.length) return null;
  const cuts = [{ start: 0, end: 0, sep: '' }, ...seps.map((m) => ({ start: m.index, end: m.index + m[0].length, sep: m[0] })), { start: s.length, end: s.length, sep: '' }];
  let out = '', i = 0, changed = false;
  while (i < cuts.length - 1) {
    const from = cuts[i].end;
    let got = null, j = cuts.length - 1;
    for (; j > i + 1; j--) { const x = s.slice(from, cuts[j].start); if (x && I18N_JP.test(x)) { got = i18nKnown(x, depth + 1); if (got !== null) break; } }
    if (got === null) { j = i + 1; const x = s.slice(from, cuts[j].start); got = x ? i18nTX(x, depth + 1) : x; }
    if (got !== s.slice(from, cuts[j].start)) changed = true;
    out += got + (I18N_SEP_EN[cuts[j].sep] ?? cuts[j].sep);
    i = j;
  }
  return changed ? out.replace(/ +$/, '') : null;
}
function i18nTX(s, depth) {
  if (typeof s !== 'string' || !I18N_JP.test(s)) return s;
  const tbl = i18nTable();
  if (!tbl) return s;
  const hit = i18nCache.get(s);
  if (hit !== undefined) return hit;
  let r = null;
  const lead = s.match(/^[\s:：—·、。,;]*/)[0], tail = s.match(/\s*$/)[0], core = s.slice(lead.length, s.length - tail.length); // 頭の区切り (「: 」「 — 」) は外して訳す
  if (typeof tbl[s] === 'string') { r = tbl[s]; i18nRemember(i18nCache, s, r); return r; } // 前後の空白も鍵のうち (「 (…)」のような切れ端)
  if (typeof tbl[core] === 'string') r = tbl[core];
  if (r === null) r = i18nUnits(core);
  const deep = depth < 12 && !/<[a-z/!]/i.test(core); // HTML の切れ端は、表と覚えた文だけで訳す (文の型で切ると札が壊れる)
  if (r === null && deep) r = i18nName(core, depth); // 名前は覚えた文より先に (種族の名前「カラ人」は、音節ごとの訳でなく 1 語にする)
  if (r === null) { // JA で作った文 (前後の空白も含めて覚えているので、まず s のまま)
    const full = i18nMemo.get(s), m = full || i18nMemo.get(core), tr = m && tbl[m[0]];
    if (typeof tr === 'string') { r = i18nFill(tr, m[1]); if (full) { i18nRemember(i18nCache, s, r); return r; } }
  }
  if (r === null && deep) r = i18nMatch(core, tbl, depth);
  if (r === null && deep) { // 区切りで分ける・名前と記号の組み立て・表の言葉を文の中で探す、を試して、日本語の残りが少ないもの (同じなら前のもの)
    const jp = (x) => (x.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
    const sp = i18nSplit(core, depth), st = sp !== null && !jp(sp) ? null : i18nStruct(core, depth), ph = (sp !== null && !jp(sp)) || (st !== null && !jp(st)) ? null : i18nPhrase(core);
    const cands = [sp, st, sp && jp(sp) ? i18nPhrase(sp) : null, ph, ph && jp(ph) ? i18nRuns(ph, depth) : null].filter((x) => x !== null);
    r = cands.length ? cands.reduce((a, b) => (jp(b) < jp(a) ? b : a)) : i18nRuns(core, depth);
  }
  const cut = r === null && depth >= 12; // 深すぎて試さなかった (覚えない。浅い所から呼ばれたら試す)
  r = r === null ? s : lead.replace(/。/g, '. ').replace(/[、，]/g, ', ').replace(/：/g, ': ').replace(/；/g, '; ') + r + tail;
  if (!cut) i18nRemember(i18nCache, s, r);
  return r;
}
function TX(s) { return LANG === 'ja' ? s : i18nTX(s, 0); }

// 組み立て済みの HTML の文字の部品と、title・placeholder・aria-label・alt の属性を訳す (画面の骨組み page.html と、下の安全網)
const I18N_ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
// 要素の文字の頭か (前にあるのが、文字のない部品 (アイコン) だけ)
function i18nLeads(n) { for (let p = n.previousSibling; p; p = p.previousSibling) if (p.nodeType === 3 ? p.data.trim() : p.textContent.trim()) return false; return true; }
// 札 (要素の文字の頭) は、頭を大文字にする (表の言葉は文の中で使う小文字の形で持っているため。「朝貢」→「Tribute」)
const i18nCap = (t) => t.replace(/^(\s*)([a-z])/, (all, sp, c) => sp + c.toUpperCase());
function i18nText(n) {
  if (!I18N_JP.test(n.data) || n.parentElement?.closest('[translate=no]') || n.parentNode?.nodeName === 'SCRIPT' || n.parentNode?.nodeName === 'STYLE') return;
  let t = TX(n.data);
  if (t !== n.data && i18nLeads(n)) t = i18nCap(t);
  if (t !== n.data) n.data = t;
}
function i18nAttrs(el) { if (el.closest?.('[translate=no]')) return; for (const a of I18N_ATTRS) { const v = el.getAttribute?.(a); if (v && I18N_JP.test(v)) { const t = TX(v); if (t !== v) el.setAttribute(a, t); } } }
function localizeDom(root) {
  if (LANG === 'ja' || !root || typeof document === 'undefined') return;
  if (root.nodeType === 3) return i18nText(root);
  if (root.nodeType !== 1) return;
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) i18nText(n);
  i18nAttrs(root);
  for (const el of root.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) i18nAttrs(el);
}
// 画面の骨組み (page.html) は、このファイルを読んだ所で訳す (骨組みは <script> より前にある)。
// 日本語のほかは、安全網として、画面に入った文字と地図に描く文字のうち日本語のまま残ったもの (表の値を TR の外で差し込んだ所など) も、入ったときに TX で訳す
if (LANG !== 'ja' && typeof Node === 'function' && typeof document === 'object' && document.body instanceof Node) {
  document.documentElement.lang = LANG;
  localizeDom(document.body);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') i18nText(m.target);
      else if (m.type === 'attributes') i18nAttrs(m.target);
      else for (const n of m.addedNodes) localizeDom(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
  if (typeof CanvasRenderingContext2D === 'function') {
    const P = CanvasRenderingContext2D.prototype;
    for (const k of ['fillText', 'strokeText', 'measureText']) { const f = P[k]; P[k] = function (t, ...a) { return f.call(this, typeof t === 'string' && I18N_JP.test(t) ? TX(t) : t, ...a); }; }
  }
} else if (typeof document === 'object' && document.documentElement && typeof Node === 'function' && document.body instanceof Node) document.documentElement.lang = LANG;
