from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import numpy as np
from scipy.stats import norm
from scipy.optimize import brentq
import math

router = APIRouter(prefix="/api/options", tags=["options"])


def _bs_price(S, K, T, r, sigma, opt_type):
    if T <= 0 or sigma <= 0:
        intrinsic = max(0, S - K) if opt_type == "call" else max(0, K - S)
        return intrinsic
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    if opt_type == "call":
        return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    return K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


def _greeks(S, K, T, r, sigma, opt_type):
    if T <= 0 or sigma <= 0:
        return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0, "iv": sigma}
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    nd1 = norm.pdf(d1)
    gamma = nd1 / (S * sigma * math.sqrt(T))
    vega = S * nd1 * math.sqrt(T) / 100  # per 1% move in vol
    if opt_type == "call":
        delta = norm.cdf(d1)
        theta = (-(S * nd1 * sigma) / (2 * math.sqrt(T)) - r * K * math.exp(-r * T) * norm.cdf(d2)) / 365
        rho = K * T * math.exp(-r * T) * norm.cdf(d2) / 100
    else:
        delta = norm.cdf(d1) - 1
        theta = (-(S * nd1 * sigma) / (2 * math.sqrt(T)) + r * K * math.exp(-r * T) * norm.cdf(-d2)) / 365
        rho = -K * T * math.exp(-r * T) * norm.cdf(-d2) / 100
    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 4),
        "theta": round(theta, 4),
        "vega":  round(vega, 4),
        "rho":   round(rho, 4),
        "iv":    round(sigma, 4),
    }


def _implied_vol(market_price, S, K, T, r, opt_type):
    try:
        f = lambda sigma: _bs_price(S, K, T, r, sigma, opt_type) - market_price
        return brentq(f, 1e-6, 20.0, maxiter=200)
    except Exception:
        return None


def _process_chain(df, S, T, r, opt_type):
    rows = []
    for _, row in df.iterrows():
        try:
            mid = (float(row.get("bid", 0) or 0) + float(row.get("ask", 0) or 0)) / 2
            market_p = float(row.get("lastPrice", 0) or 0)
            price_for_iv = mid if mid > 0 else market_p
            iv = row.get("impliedVolatility")
            if iv is None or iv == 0:
                iv = _implied_vol(price_for_iv, S, float(row["strike"]), T, r, opt_type)
            if iv is None:
                iv = 0.3
            greeks = _greeks(S, float(row["strike"]), T, r, iv, opt_type)
            rows.append({
                "contractSymbol": row.get("contractSymbol", ""),
                "strike":         float(row["strike"]),
                "bid":            round(float(row.get("bid", 0) or 0), 2),
                "ask":            round(float(row.get("ask", 0) or 0), 2),
                "lastPrice":      round(market_p, 2),
                "volume":         int(row.get("volume", 0) or 0),
                "openInterest":   int(row.get("openInterest", 0) or 0),
                "inTheMoney":     bool(row.get("inTheMoney", False)),
                **greeks,
            })
        except Exception:
            continue
    return rows


@router.get("/{ticker}/expirations")
def get_expirations(ticker: str):
    try:
        t = yf.Ticker(ticker.upper())
        return {"ticker": ticker.upper(), "expirations": list(t.options)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/chain")
def get_chain(ticker: str, expiration: str = Query(...)):
    try:
        t = yf.Ticker(ticker.upper())
        info = t.fast_info
        S = info.last_price or info.regular_market_price
        if not S:
            raise HTTPException(status_code=404, detail="Could not get current price")

        chain = t.option_chain(expiration)
        from datetime import date
        exp_date = date.fromisoformat(expiration)
        today = date.today()
        T = max((exp_date - today).days, 0) / 365.0
        r = 0.045  # approximate risk-free rate

        calls = _process_chain(chain.calls, S, T, r, "call")
        puts  = _process_chain(chain.puts,  S, T, r, "put")

        return {
            "ticker":     ticker.upper(),
            "expiration": expiration,
            "spot":       round(S, 2),
            "T":          round(T, 4),
            "calls":      calls,
            "puts":       puts,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/greek-history")
def get_greek_history(
    ticker: str,
    expiration: str = Query(...),
    strike: float = Query(...),
    opt_type: str = Query("call", enum=["call", "put"]),
    period: str = Query("1mo", enum=["1wk", "1mo", "1y"]),
):
    """
    Reconstruct historical Greeks by replaying Black-Scholes over historical
    underlying prices. Uses realized vol from rolling 20-day window as IV proxy.
    """
    try:
        # Fetch period + 40 extra trading days to warm the 20-day rolling vol window
        fetch_map = {"1wk": "2mo", "1mo": "3mo", "1y": "15mo"}
        slice_map = {"1wk": "7d", "1mo": "1mo", "1y": "1y"}
        yf_period = fetch_map[period]

        import yfinance as yf
        import pandas as pd
        from datetime import date, timedelta

        hist = yf.download(ticker.upper(), period=yf_period, interval="1d", progress=False, auto_adjust=True)
        if hist.empty:
            raise HTTPException(status_code=404, detail="No history")
        hist.columns = [c[0] if isinstance(c, tuple) else c for c in hist.columns]
        closes = hist["Close"].dropna()

        log_returns = np.log(closes / closes.shift(1)).dropna()
        roll_vol = log_returns.rolling(window=20).std() * np.sqrt(252)

        # Trim to the requested period after computing vol
        cutoff_days = {"1wk": 7, "1mo": 31, "1y": 366}
        cutoff = pd.Timestamp.now(tz=closes.index.tz) - pd.Timedelta(days=cutoff_days[period])
        closes = closes[closes.index >= cutoff]

        exp_date = date.fromisoformat(expiration)
        r = 0.045
        records = []
        for ts, price in closes.items():
            dt = ts.date() if hasattr(ts, "date") else ts
            T = max((exp_date - dt).days, 0) / 365.0
            iv_val = roll_vol.get(ts, None)
            iv = float(iv_val) if iv_val and not np.isnan(iv_val) else 0.3
            g = _greeks(float(price), strike, T, r, iv, opt_type)
            records.append({"date": dt.isoformat(), **g})

        return {
            "ticker": ticker.upper(),
            "strike": strike,
            "expiration": expiration,
            "opt_type": opt_type,
            "period": period,
            "history": records,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
