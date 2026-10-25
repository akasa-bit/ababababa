import math
beta=3.045; g=0.0167
def solve(s,kappa,theta=1.0,tau=10.0):
    # steady state: g = g*s*x^-beta + kappa*(theta*exp(-g*tau)/x - 1)  (only if theta*e^{-g tau} > x)
    c=theta*math.exp(-g*tau)
    f=lambda x: g*s*x**(-beta) + (kappa*(c/x-1) if c>x else 0.0) - g
    lo,hi=1e-4,5.0
    for _ in range(200):
        mid=(lo+hi)/2
        if f(mid)>0: lo=mid
        else: hi=mid
    return (lo+hi)/2
s_q1=42.6/4980
print("Jones only Q1/Q5 at equal pop:", s_q1**(1/beta))
for kappa in [0.0,0.005,0.01,0.0137,0.02,0.03,0.05]:
    for tau in [5,10,30]:
        x1=solve(s_q1,kappa,tau=tau); x5=solve(1.0,kappa,tau=tau)
        # scale elasticity around s=0.1 and s=1
        e1=(math.log(solve(0.11,kappa,tau=tau))-math.log(solve(0.09,kappa,tau=tau)))/(math.log(0.11)-math.log(0.09))
        e2=(math.log(solve(0.011,kappa,tau=tau))-math.log(solve(0.009,kappa,tau=tau)))/(math.log(0.011)-math.log(0.009))
        print(f"kappa={kappa:.4f} tau={tau:2d}  x(s=Q1)={x1:.3f} x(s=1)={x5:.3f} ratio={x1/x5:.3f}  elast@s=.1={e1:.3f} elast@s=.01={e2:.3f}")
# convergence speed near steady state: linearize d ln x/dt = g s x^-b + k(c/x-1) - g
def slope(s,kappa,tau=10,theta=1.0):
    c=theta*math.exp(-g*tau); x=solve(s,kappa,theta,tau)
    return beta*g*s*x**(-beta) + kappa*c/x, x
for kappa in [0.005,0.01,0.0137,0.02]:
    print("kappa",kappa,"conv. slope (per log pt, per yr) at Q1:",slope(s_q1,kappa))
# light delay cost on level at g
for tau in [4.24,10,20,40]:
    print("tau",tau,"exp(-g tau)=",math.exp(-g*tau), "with g=0.01:",math.exp(-0.01*tau))
