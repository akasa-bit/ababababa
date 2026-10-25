import sys, numpy as np, pandas as pd
X = pd.read_csv(sys.argv[1], index_col=0)
def ols(y, Xm):
    b = np.linalg.lstsq(Xm, y, rcond=None)[0]; e = y - Xm @ b
    return b, 1 - e @ e / ((y - y.mean()) @ (y - y.mean()))
d = X[["res", "lgdp", "hci", "hlos"]].dropna(); d = d[d.res > 0]
y = np.log(d.res.values)
b1, r1 = ols(y, np.column_stack([np.ones(len(d)), d.lgdp]))
b2, r2 = ols(y, np.column_stack([np.ones(len(d)), d.lgdp, d.hci]))
b3, r3 = ols(y, np.column_stack([np.ones(len(d)), d.lgdp, d.hlos / 100]))
print(f"same sample n={len(d)}: lgdp only b={b1[1]:.3f} R2={r1:.3f} | +HCI: lgdp {b2[1]:.3f} hci {b2[2]:.3f} R2={r2:.3f} | +HLO/100: lgdp {b3[1]:.3f} hlo {b3[2]:.3f} R2={r3:.3f}")
d = X[["res", "lgdp"]].dropna(); d = d[d.res > 0]
b, r = ols(np.log(d.res.values), np.column_stack([np.ones(len(d)), d.lgdp]))
for g in [2000, 5000, 10000, 20000, 50000, 80000]:
    print(f"fitted researchers/million at GDPpc PPP {g}: {np.exp(b[0] + b[1]*np.log(g)):.0f}")
# residual dispersion
e = np.log(d.res.values) - (b[0] + b[1]*d.lgdp.values); print(f"resid SD (log) = {e.std(ddof=2):.3f}, n={len(d)}")
# share researchers*pop
