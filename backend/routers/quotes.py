from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import os
from datetime import datetime, timedelta
from polygon import RESTClient

router = APIRouter(prefix="/api/quotes", tags=["quotes"])

POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")


def _polygon_quote(ticker: str):
    if not POLYGON_KEY:
        return None
    try:
        client = RESTClient(POLYGON_KEY)
        snap = client.get_snapshot_ticker("stocks", ticker.upper())
        d = snap.day
        prev = snap.prev_day
        return {
            "ticker": ticker.upper(),
            "price": snap.last_trade.price if snap.last_trade else None,
            "open": d.open if d else None,
            "high": d.high if d else None,
            "low": d.low if d else None,
            "volume": d.volume if d else None,
            "prev_close": prev.close if prev else None,
            "change": round(snap.todays_change, 2) if snap.todays_change else None,
            "change_pct": round(snap.todays_change_percent, 4) if snap.todays_change_percent else None,
            "source": "polygon",
        }
    except Exception:
        return None


def _parse_earnings_date(t) -> str | None:
    """Return next earnings date as MM/DD, trying multiple yfinance APIs."""
    try:
        cal = t.calendar
        if isinstance(cal, dict):
            dates = cal.get("Earnings Date", [])
            if dates:
                d = dates[0]
                if hasattr(d, "strftime"):
                    return d.strftime("%m/%d")
    except Exception:
        pass

    try:
        info = t.info
        for key in ("earningsTimestamp", "earningsTimestampStart", "earningsTimestampEnd"):
            ts = info.get(key)
            if ts:
                return datetime.fromtimestamp(int(ts)).strftime("%m/%d")
    except Exception:
        pass

    return None


@router.get("/{ticker}/info")
def get_stock_info(ticker: str):
    try:
        t = yf.Ticker(ticker.upper())
        info = t.info
        fast = t.fast_info

        earnings_date = _parse_earnings_date(t)
        mkt_cap = info.get("marketCap") or getattr(fast, "market_cap", None)

        def _r(v):
            try: return round(float(v), 4) if v else None
            except: return None

        raw_div = info.get("dividendYield")
        # yfinance returns dividendYield already as a decimal percentage (e.g. 1.14 means 1.14%)
        # Do NOT multiply by 100 again
        div_yield = _r(raw_div)

        return {
            "ticker":        ticker.upper(),
            "name":          info.get("longName") or info.get("shortName", ""),
            "sector":        info.get("sector", ""),
            "market_cap":    mkt_cap,
            "pe_ratio":      _r(info.get("trailingPE")),
            "peg_ratio":     _r(info.get("pegRatio")),
            "earnings_date": earnings_date,
            "volume":        int(info.get("volume") or getattr(fast, "three_month_average_volume", 0) or 0),
            "day_high":      _r(getattr(fast, "day_high", None)),
            "day_low":       _r(getattr(fast, "day_low", None)),
            "week_52_high":  _r(getattr(fast, "year_high", None)),
            "week_52_low":   _r(getattr(fast, "year_low", None)),
            "dividend_yield": div_yield,
            "short_ratio":   _r(info.get("shortRatio")),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/price-at")
def get_price_at(
    ticker: str,
    date: str = Query(..., description="YYYY-MM-DD"),
    time: str = Query("", description="HH:MM in 24-hour local market time"),
):
    """
    Return the price nearest to the requested date+time.
    Uses 1m intraday data when within 7 days, 5m within 60 days,
    otherwise falls back to the daily closing price.
    """
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    try:
        t = yf.Ticker(ticker.upper())
        days_ago = (datetime.now() - dt).days

        if time:
            # Pick the finest interval available for the date's age
            if days_ago <= 6:
                intraday_interval = "1m"
            elif days_ago <= 59:
                intraday_interval = "5m"
            else:
                intraday_interval = None  # too old for intraday

            if intraday_interval:
                start = date
                end   = (dt + timedelta(days=1)).strftime("%Y-%m-%d")
                hist  = t.history(start=start, end=end, interval=intraday_interval)
                if not hist.empty:
                    idx = hist.index.tz_localize(None) if hist.index.tz is not None else hist.index
                    target_dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
                    diffs = abs(idx - target_dt)
                    best  = diffs.argmin()
                    price = round(float(hist["Close"].iloc[best]), 2)
                    actual = idx[best]
                    return {
                        "ticker":    ticker.upper(),
                        "date":      actual.strftime("%Y-%m-%d"),
                        "time":      actual.strftime("%H:%M"),
                        "price":     price,
                        "precision": intraday_interval,
                    }
            # Intraday unavailable — fall through to daily close below

        # Daily close fallback
        start = (dt - timedelta(days=10)).strftime("%Y-%m-%d")
        end   = (dt + timedelta(days=1)).strftime("%Y-%m-%d")
        hist  = t.history(start=start, end=end)
        if hist.empty:
            raise HTTPException(status_code=404, detail="No price data for that date")
        idx   = hist.index.tz_localize(None) if hist.index.tz is not None else hist.index
        valid = hist[idx.normalize() <= dt]
        if valid.empty:
            valid = hist
        price = round(float(valid["Close"].iloc[-1]), 2)
        return {
            "ticker":    ticker.upper(),
            "date":      date,
            "price":     price,
            "precision": "daily",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}")
def get_quote(ticker: str):
    poly = _polygon_quote(ticker)
    if poly and poly["price"]:
        return poly
    try:
        t = yf.Ticker(ticker.upper())
        info = t.fast_info
        prev_close = info.previous_close or 0
        price = info.last_price or info.regular_market_price or 0
        change = price - prev_close
        return {
            "ticker": ticker.upper(),
            "price": round(price, 2),
            "open": round(info.open or 0, 2),
            "high": round(info.day_high or 0, 2),
            "low": round(info.day_low or 0, 2),
            "volume": int(info.three_month_average_volume or 0),
            "prev_close": round(prev_close, 2),
            "change": round(change, 2),
            "change_pct": round((change / prev_close * 100) if prev_close else 0, 4),
            "source": "yfinance",
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
