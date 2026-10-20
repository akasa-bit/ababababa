// 包装の比べ: 起動の速さと描画の速さを、ページの中から測る。
// 包装 (Electron・Tauri) と比べの元の Chromium が、環境変数 NLU_BENCH のときだけページに差し込む。ゲームの中身には入らない。
// 結果は 1 行の JSON で返す (Tauri は bench_report の命令、ほかは console.log の 'NLU_BENCH ' の行)。
(() => {
  if (window.__nluProbe) return;
  window.__nluProbe = true;
  const out = { ua: navigator.userAgent, epochOrigin: performance.timeOrigin };
  const report = (o) => {
    const j = JSON.stringify(o);
    const t = window.__TAURI_INTERNALS__;
    if (t) t.invoke('bench_report', { json: j });
    else console.log('NLU_BENCH ' + j);
  };
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // ms のあいだ、画面の更新ごとの時刻を集める (each は毎回呼ぶ。地図を回し続けるときに使う)
  const frames = (ms, each) => new Promise((res) => {
    const ts = [];
    const f = (t) => {
      ts.push(t);
      if (each) each();
      if (t - ts[0] < ms) requestAnimationFrame(f); else res(ts);
    };
    requestAnimationFrame(f);
  });
  const stat = (ts) => {
    const dt = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
    const q = (p) => dt[Math.min(dt.length - 1, Math.floor(p * dt.length))];
    return { fps: +((ts.length - 1) / (ts[ts.length - 1] - ts[0]) * 1000).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), worst: +dt[dt.length - 1].toFixed(1) };
  };
  const year = () => {
    const m = /(\d+)年\s*(\d+)月/.exec($('date')?.textContent || '');
    return m ? Number(m[1]) + (Number(m[2]) - 1) / 12 : NaN;
  };
  const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  (async () => {
    try {
      // 準備ができた = ホーム画面が出て、地図の canvas があり、2 コマ描いた
      while (!($('home') && !$('home').hidden && $('map'))) await sleep(5);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const nav = performance.getEntriesByType('navigation')[0];
      out.dcl = Math.round(nav ? nav.domContentLoadedEventEnd : NaN);
      out.ready = Math.round(performance.now());
      out.epochReady = Date.now();
      // 同じ銀河で比べる
      $('home-seed').value = '20261020';
      for (let i = 0; i < 3 && !$('home').hidden; i++) { document.querySelector('[data-home="new"]')?.click(); await sleep(400); }
      out.started = $('home').hidden;
      key('1'); // 止める
      await sleep(500);
      out.idle = stat(await frames(3000));
      out.rotate = stat(await frames(3000, () => key('z'))); // 地図を回し続ける (描き直しが毎コマ要る)
      key('4'); // 年 1 年
      await sleep(300);
      out.speed1 = stat(await frames(3000));
      key('7'); // 最高速 (年 64 年)
      await sleep(300);
      const y0 = year();
      const t0 = performance.now();
      out.speed64 = stat(await frames(10000));
      out.yearsPerSec = +((year() - y0) / ((performance.now() - t0) / 1000)).toFixed(2);
      key('1');
      if (performance.memory) out.jsHeapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
    } catch (e) {
      out.error = String(e && e.stack || e);
    }
    report(out);
  })();
})();
