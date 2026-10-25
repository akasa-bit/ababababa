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
s=42.6/4980
for th,k,tau in [(1,0.02,30),(1,0.0,10),(1,0.02,10)]:
    x=solve(s,k,th,tau); print(th,k,tau,round(x,3),round(el(s,k,th,tau),3),round(s*x**(-beta),2))
