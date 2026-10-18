#!/usr/bin/env python3
"""重力モデルの PPML 推定 (Santos Silva & Tenreyro 2006)。実データ (CEPII) とゲームの自動対戦の書き出しに、同じこのコードを使う (目標 R01)。

推定する式: 交易額 X_ij,t = exp(a_i,t + b_j,t + β ln 距離_ij + γ' 制御変数) × 誤差
  a_i,t = 輸出国 × 年の固定効果、b_j,t = 輸入国 × 年の固定効果 (多国間の抵抗。Anderson & van Wincoop 2003)
解き方: 反復重み付き最小二乗 (IRLS)。固定効果は、重み付きの平均を交互に引いて取り除く (Correia, Guimarães & Zylkin 2020 の ppmlhdfe と同じ考え方)。

使い方 (ほかのスクリプトから):
  from gravity import ppml, read_flows
  rows = read_flows('ファイル.csv(.gz)')  # 列: year, iso3_o, iso3_d, dist, tradeflow (と、あれば制御変数)
"""
import csv, gzip, math
import numpy as np


def _groups(keys):
    """文字列などのキーの列を 0 から始まる番号に"""
    ix = {}
    return np.array([ix.setdefault(k, len(ix)) for k in keys], dtype=np.int64), len(ix)


def _demean(v, w, groups, tol=1e-12, maxit=10000):
    """重み w での、固定効果 (groups の各番号) の重み付き平均を交互に引く。v は (n, k)"""
    v = v.copy()
    sw = [np.bincount(g, weights=w, minlength=n) for g, n in groups]
    for _ in range(maxit):
        delta = 0.0
        for (g, n), s in zip(groups, sw):
            for c in range(v.shape[1]):
                m = np.bincount(g, weights=w * v[:, c], minlength=n) / np.where(s > 0, s, 1)
                v[:, c] -= m[g]
                delta = max(delta, float(np.max(np.abs(m))))
        if delta < tol:
            break
    return v


def ppml(y, X, fe, tol=1e-10, maxit=200):
    """y: 交易額 (n,)、X: 説明変数 (n, k)、fe: 固定効果のキーの列のリスト。返り値: 係数 (k,)・反復の回数・使った行の数"""
    y = np.asarray(y, float)
    X = np.asarray(X, float).reshape(len(y), -1)
    groups = [_groups(k) for k in fe]
    # 交易がいつも 0 の固定効果の組は、係数を決めない (推定から外す)
    keep = np.ones(len(y), bool)
    for _ in range(5):
        for g, n in groups:
            tot = np.bincount(g[keep], weights=y[keep], minlength=n)
            keep &= tot[g] > 0
    y, X = y[keep], X[keep]
    groups = [_groups([k for k, ok in zip(keys, keep) if ok]) for keys in fe]
    mu = (y + y.mean()) / 2
    eta = np.log(mu)
    beta = np.zeros(X.shape[1])
    dev_old = math.inf
    for it in range(1, maxit + 1):
        z = eta + (y - mu) / mu
        w = mu
        V = _demean(np.column_stack([z, X]), w, groups)
        zd, Xd = V[:, 0], V[:, 1:]
        WX = Xd * w[:, None]
        beta = np.linalg.solve(WX.T @ Xd, WX.T @ zd)
        eta = z - (zd - Xd @ beta)
        mu = np.exp(np.clip(eta, -700, 700))
        with np.errstate(divide='ignore', invalid='ignore'):
            dev = 2 * float(np.sum(np.where(y > 0, y * np.log(y / mu), 0) - (y - mu)))
        if abs(dev - dev_old) / max(dev, 1e-300) < tol:
            break
        dev_old = dev
    return beta, it, int(keep.sum())


def read_flows(path):
    """書き出しの CSV (gz でもよい) を読む。tradeflow が空の行は None"""
    op = gzip.open if path.endswith('.gz') else open
    with op(path, 'rt', encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def elasticity(rows, dist_col='dist', flow_col='tradeflow', controls=(), zeros=False):
    """距離の弾力性 (ln 距離の係数)。zeros = True なら、空の交易額を 0 として入れる"""
    use = [r for r in rows if r[dist_col] not in ('', None) and float(r[dist_col]) > 0 and all(r[c] not in ('', None) for c in controls)
           and (zeros or r[flow_col] not in ('', None))]
    y = [float(r[flow_col]) if r[flow_col] not in ('', None) else 0.0 for r in use]
    X = np.column_stack([np.log([float(r[dist_col]) for r in use])] + [np.array([float(r[c]) for r in use]) for c in controls])
    fe = [[(r['iso3_o'], r['year']) for r in use], [(r['iso3_d'], r['year']) for r in use]]
    b, it, n = ppml(y, X, fe)
    return {'beta': float(b[0]), 'controls': {c: float(v) for c, v in zip(controls, b[1:])}, 'iterations': it, 'rows': n}
