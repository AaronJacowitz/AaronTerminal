from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import math
from scipy.stats import norm

router = APIRouter(prefix="/api/pnl", tags=["pnl"])


class PnLRequest(BaseModel):
    opt_type: str          # "call" | "put"
    strike: float
    expiration: str        # ISO date
    spot: float            # current underlying price
    entry_price: float     # premium paid per share (per contract = * 100)
    num_contracts: int     # number of contracts
    iv: float              # current implied vol (decimal, e.g. 0.35)
    r: float = 0.045


def _bs_price(S, K, T, r, sigma, opt_type):
    if T <= 0 or sigma <= 0:
        intrinsic = max(0, S - K) if opt_type == "call" else max(0, K - S)
        return intrinsic
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    if opt_type == "call":
        return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    return K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


@router.post("/calculate")
def calculate_pnl(req: PnLRequest):
    from datetime import date
    try:
        exp_date = date.fromisoformat(req.expiration)
        today = date.today()
        T = max((exp_date - today).days, 0) / 365.0
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid expiration date")

    cost_basis = req.entry_price * req.num_contracts * 100

    # Payoff curve at expiration across a price range
    lo = req.spot * 0.5
    hi = req.spot * 1.5
    prices = np.linspace(lo, hi, 200)

    def pnl_at_expiry(S):
        if req.opt_type == "call":
            payout = max(0, S - req.strike) * req.num_contracts * 100
        else:
            payout = max(0, req.strike - S) * req.num_contracts * 100
        return round(payout - cost_basis, 2)

    expiry_curve = [{"price": round(float(p), 2), "pnl": pnl_at_expiry(p)} for p in prices]

    # Current theoretical value
    current_value = _bs_price(req.spot, req.strike, T, req.r, req.iv, req.opt_type)
    current_pnl = round((current_value - req.entry_price) * req.num_contracts * 100, 2)

    # Breakeven
    if req.opt_type == "call":
        breakeven = req.strike + req.entry_price
    else:
        breakeven = req.strike - req.entry_price

    # Mid-life PnL curve (T/2 remaining)
    T_mid = T / 2 if T > 0 else 0
    mid_curve = []
    for p in prices:
        val = _bs_price(float(p), req.strike, T_mid, req.r, req.iv, req.opt_type)
        mid_curve.append({
            "price": round(float(p), 2),
            "pnl": round((val - req.entry_price) * req.num_contracts * 100, 2),
        })

    # Summary stats
    if req.opt_type == "call":
        max_loss = round(-cost_basis, 2)
        max_profit = None  # theoretically unlimited
    else:
        max_loss = round(-cost_basis, 2)
        max_profit = round((req.strike - req.entry_price) * req.num_contracts * 100, 2)

    return {
        "opt_type":       req.opt_type,
        "strike":         req.strike,
        "expiration":     req.expiration,
        "num_contracts":  req.num_contracts,
        "entry_price":    req.entry_price,
        "cost_basis":     round(cost_basis, 2),
        "current_value":  round(current_value, 4),
        "current_pnl":    current_pnl,
        "breakeven":      round(breakeven, 2),
        "max_loss":       max_loss,
        "max_profit":     max_profit,
        "T_remaining":    round(T * 365),
        "expiry_curve":   expiry_curve,
        "mid_curve":      mid_curve,
    }
