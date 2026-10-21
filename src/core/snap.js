// 星系の記録 (snaps) の JSON の使い回し。記録は取ったあと変わらないので、記録ごとに一度だけ JSON にする
// (変わるのは Game.known が古い記録の欠けた資源を 0 で補うときだけで、そのときは捨てて作り直す)
const SNAP_JSON = new WeakMap();
const TARGET_INDEX = new WeakMap(); // 星系 → 天体の索引 (Game.target)
function snapJSON(x) {
  if (x === null || typeof x !== 'object') return x === undefined ? 'null' : JSON.stringify(x);
  let t = SNAP_JSON.get(x);
  if (t === undefined) { t = JSON.stringify(x); SNAP_JSON.set(x, t); }
  return t;
}
// 不足を出来事として記録するまでの年数 (それより短い不足は状態として見せるだけ)
const WATCH_LOG_YEARS = { shortage: 10, famine: 1 };
