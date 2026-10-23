// CI の試験の合否を決めるときの小さな道具 (tools/tests の各ファイルの exports.ci から使う。tools/ci-tests.js)
// 合否の見方は docs/handoff.md の 14 (試験の「合格」の見え方) と同じ
const last = (out) => out.trim().split('\n').pop().trim();
// ページの誤りがない (最後の行が [] で終わるか、"errs": [] がある)
const noPageErrors = (out) => /\[\]$/.test(last(out)) || /"errs": \[\]/.test(out);
// 出力の中の最初の { から最後の } までを JSON として読む (読めなければ投げる)
const json = (out) => JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
// JSON を読んで good(結果) が真なら合格。読めなければ「出力を読めない」
const byJson = (good, why) => (o) => {
  try { return good(json(o)) ? '' : why; } catch { return '出力を読めない'; }
};
// 終了コード 0 で、出力に「<word> 合格」がある
const passes = (word, why = `${word} 不合格`) => (o, code) => (code === 0 && o.includes(`${word} 合格`) ? '' : why);
// 1 行目に「<word> 合格」がある (終了コードは見ない)
const firstLine = (word, why) => (o) => (o.trim().split('\n')[0].includes(`${word} 合格`) ? '' : why);
module.exports = { last, noPageErrors, json, byJson, passes, firstLine };
