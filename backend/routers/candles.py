from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import pandas as pd

router = APIRouter(prefix="/api/candles", tags=["candles"])

# Maps time-range label → (yfinance interval, yfinance period)
# Candle granularity is chosen to give a readable number of bars across the range.
RANGE_MAP = {
    "1D":  ("2m",   "1d"),
    "1W":  ("15m",  "5d"),
    "1M":  ("60m",  "1mo"),
    "1Y":  ("1d",   "1y"),
    "5Y":  ("1wk",  "5y"),
    "MAX": ("1mo",  "max"),
}


@router.get("/{ticker}")
def get_candles(
    ticker: str,
    interval: str = Query("1Y", enum=list(RANGE_MAP.keys())),
):
    yf_interval, yf_period = RANGE_MAP[interval]
    try:
        df = yf.download(
            ticker.upper(),
            interval=yf_interval,
            period=yf_period,
            progress=False,
            auto_adjust=True,
        )
        if df.empty:
            raise HTTPException(status_code=404, detail="No data returned")
        df = df.dropna()
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
        records = []
        for ts, row in df.iterrows():
            t = int(pd.Timestamp(ts).timestamp())
            records.append({
                "time":   t,
                "open":   round(float(row["Open"]),  4),
                "high":   round(float(row["High"]),  4),
                "low":    round(float(row["Low"]),   4),
                "close":  round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if "Volume" in row else 0,
            })
        return {"ticker": ticker.upper(), "interval": interval, "candles": records}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
