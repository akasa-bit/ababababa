import math
beta=3.045; g=0.0167
def solve(s,kappa,theta=1.0,tau=10.0):
    c=theta*math.exp(-g*tau)
    f=lambda x: g*s*x**(-beta) + (kappa*(c/x-1) if c>x else 0.0) - g
    lo,hi=1e-5,5.0
    for _ in range(200):
        mid=(lo+hi)/2
        if f(mid)>0: lo=mid
        else: hi=mid
    return (lo+hi)/2
def el(s,k,th,tau):
    return (math.log(solve(s*1.1,k,th,tau))-math.log(solve(s/1.1,k,th,tau)))/(2*math.log(1.1))
s_q1=42.6/4980
print("labour-aug conversion with labsh=0.6: Q1",0.347**(1/0.6),"Q5",0.849**(1/0.6),"ratio",(0.347/0.849)**(1/0.6))
print("Hicks ratio", 0.347/0.849)
for th in [1.0,0.7,0.5]:
  for k in [0.01,0.02,0.03,0.05]:
    x=solve(s_q1,k,th,10); 
    print(f"theta={th} kappa={k}: x(Q1 density, tau=10)={x:.3f}  own-research share of growth={g*s_q1*x**(-beta)/g:.2f}  pop-elast@s=Q1={el(s_q1,k,th,10):.3f} @s=0.1={el(0.1,k,th,10):.3f}")
# Social return check: dS/S=10% -> long-run dA/A = 1/beta*10%
print("long-run A gain from +10% S (Jones only):", 1.1**(1/beta)-1)
r=0.05; RD=0.025
ben=(1.1**(1/beta)-1)/r; cost=0.1*RD/r
print("benefit/cost ignoring transition:", ben/cost)
# transition: A gap closes at rate beta*g
lam=beta*g; print("transition rate",lam,"half-life",math.log(2)/lam)
# PV with transition: benefit(t)=0.0318*(1-exp(-lam t)) ; PV = 0.0318*(1/r - 1/(r+lam))
gain=1.1**(1/beta)-1
pv=gain*(1/r-1/(r+lam)); print("benefit/cost with transition:", pv/cost)
# GPT folded into A: post-jump Jones growth
for G in [0.15,0.20,0.25]:
    print("GPT jump",G,"Jones growth right after (pct/yr):",100*g*math.exp(G)**(-beta))
# logistic
for sig in [0.055,0.123,0.15,0.218]:
    print("sigma",sig,"10->90 years",math.log(81)/sig,"1->50 years",math.log(99)/sig)
print("GPT mean contribution G/60:",0.20/60)
