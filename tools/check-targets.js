// 合わせる目標 (targets/targets.json) の形を確かめ、固定したときのハッシュ (targets/targets.lock) と一致するかを見る。
// 目標を書き換えたら、ハッシュが合わなくなって失敗する (書き換えは「目標の変更」だけの PR で行い、--lock で固定し直す)
// 使い方: node tools/check-targets.js          確かめる
//         node tools/check-targets.js --lock   いまの内容で固定し直す
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = path.join(__dirname, '..', 'targets');
const text = fs.readFileSync(path.join(dir, 'targets.json'), 'utf8');
const t = JSON.parse(text);
const errs = [];
const ids = new Set();
const need = (o, keys, where) => { for (const k of keys) if (o[k] === undefined || o[k] === '') errs.push(`${where}: ${k} がない`); };
need(t, ['version', 'fixedAt', 'rules', 'realism', 'fun'], 'targets');
for (const r of t.realism || []) {
  need(r, ['id', 'area', 'name', 'statistic', 'sim', 'pass', 'split'], r.id || '(id なし)');
  if (!['calibration', 'holdout', 'test'].includes(r.split)) errs.push(`${r.id}: split は calibration / holdout / test のどれか`);
  if (r.band !== null && !(Array.isArray(r.band) && r.band.length === 2)) errs.push(`${r.id}: band は null か [下限, 上限]`);
  if (ids.has(r.id)) errs.push(`${r.id}: id が重複`); ids.add(r.id);
}
for (const f of t.fun || []) {
  need(f, ['id', 'name', 'data', 'statistic', 'pass'], f.id || '(id なし)');
  if (ids.has(f.id)) errs.push(`${f.id}: id が重複`); ids.add(f.id);
}
const hash = crypto.createHash('sha256').update(text).digest('hex');
const lockFile = path.join(dir, 'targets.lock');
if (process.argv.includes('--lock')) {
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  fs.writeFileSync(lockFile, `${hash}  targets.json  ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`固定した: ${hash}`);
  process.exit(0);
}
const locked = fs.existsSync(lockFile) ? fs.readFileSync(lockFile, 'utf8').split(/\s+/)[0] : null;
if (locked !== hash) errs.push(`targets.json が固定したときの内容と違う (固定 ${locked}、いま ${hash})。目標の変更は専用の PR で理由を書き、--lock で固定し直す`);
const open = (t.realism || []).filter((r) => r.band === null).length;
console.log(`現実の目標 ${t.realism.length} (幅を生データから決めるもの ${open})・楽しさの目標 ${t.fun.length}`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log('目標のファイルは固定したときのまま');
