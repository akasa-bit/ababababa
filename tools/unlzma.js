// LZMA (生の LZMA1 の流れ) の展開器。lc/lp/pb と展開後の長さは呼ぶ側が渡す
function unlzma(inp, outLen, lc, lp, pb) {
  const out = new Uint8Array(outLen);
  let ip = 1, range = 0xFFFFFFFF, code = 0; // 最初の 1 バイトは常に 0
  for (let i = 0; i < 4; i++) code = ((code << 8) | inp[ip++]) >>> 0;
  const P = (n) => new Uint16Array(n).fill(1024);
  const lit = P(0x300 << (lc + lp)), isMatch = P(192), isRep = P(12), isG0 = P(12), isG1 = P(12), isG2 = P(12), isRep0Long = P(192);
  const slot = P(256), spec = P(115), align = P(16);
  const lenC = () => ({ c: P(2), low: P(256), mid: P(256), high: P(256) });
  const len1 = lenC(), len2 = lenC();
  const bit = (p, i) => {
    const b = (range >>> 11) * p[i];
    let r;
    if (code < b) { range = b; p[i] += (2048 - p[i]) >>> 5; r = 0; } else { range -= b; code -= b; p[i] -= p[i] >>> 5; r = 1; }
    if (range < 16777216) { range = (range << 8) >>> 0; code = ((code << 8) | inp[ip++]) >>> 0; }
    return r;
  };
  const tree = (p, base, n) => { let m = 1; for (let i = 0; i < n; i++) m = (m << 1) | bit(p, base + m); return m - (1 << n); };
  const rtree = (p, base, n) => { let m = 1, s = 0; for (let i = 0; i < n; i++) { const b = bit(p, base + m); m = (m << 1) | b; s |= b << i; } return s; };
  const length = (L, ps) => (bit(L.c, 0) === 0 ? tree(L.low, ps << 3, 3) : bit(L.c, 1) === 0 ? 8 + tree(L.mid, ps << 3, 3) : 16 + tree(L.high, 0, 8));
  let op = 0, state = 0, r0 = 0, r1 = 0, r2 = 0, r3 = 0;
  const pbm = (1 << pb) - 1, lpm = (1 << lp) - 1;
  while (op < outLen) {
    const ps = op & pbm;
    if (bit(isMatch, (state << 4) + ps) === 0) {
      const prev = op ? out[op - 1] : 0, base = 0x300 * (((op & lpm) << lc) + (prev >>> (8 - lc)));
      let s = 1;
      if (state >= 7) {
        let mb = out[op - r0 - 1];
        while (s < 256) { const m = (mb >>> 7) & 1; mb <<= 1; const b = bit(lit, base + ((1 + m) << 8) + s); s = (s << 1) | b; if (m !== b) break; }
      }
      while (s < 256) s = (s << 1) | bit(lit, base + s);
      out[op++] = s & 255;
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
      continue;
    }
    let len;
    if (bit(isRep, state)) {
      if (bit(isG0, state) === 0) {
        if (bit(isRep0Long, (state << 4) + ps) === 0) { state = state < 7 ? 9 : 11; out[op] = out[op - r0 - 1]; op++; continue; }
      } else {
        let d;
        if (bit(isG1, state) === 0) d = r1;
        else { if (bit(isG2, state) === 0) d = r2; else { d = r3; r3 = r2; } r2 = r1; }
        r1 = r0; r0 = d;
      }
      len = length(len2, ps); state = state < 7 ? 8 : 11;
    } else {
      r3 = r2; r2 = r1; r1 = r0;
      len = length(len1, ps); state = state < 7 ? 7 : 10;
      const ls = len < 3 ? len : 3, sl = tree(slot, ls << 6, 6);
      if (sl < 4) r0 = sl;
      else {
        const nd = (sl >>> 1) - 1;
        r0 = (2 | (sl & 1)) * (1 << nd);
        if (sl < 14) r0 += rtree(spec, r0 - sl, nd);
        else {
          for (let i = nd - 4; i > 0; i--) { range >>>= 1; let b = 0; if (code >= range) { code -= range; b = 1; } r0 = r0 + (b << (i + 3)); if (range < 16777216) { range = (range << 8) >>> 0; code = ((code << 8) | inp[ip++]) >>> 0; } }
          r0 += rtree(align, 0, 4);
        }
        if (r0 === 0xFFFFFFFF || r0 < 0) break; // 終わりの印
      }
    }
    for (len += 2; len > 0 && op < outLen; len--, op++) out[op] = out[op - r0 - 1];
  }
  return out;
}
if (typeof module !== 'undefined') module.exports = unlzma;
