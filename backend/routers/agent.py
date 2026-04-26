from __future__ import annotations

import os
from typing import Any, Literal

import yfinance as yf
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    # Optional: current ticker context from the UI panel
    ticker: str | None = None


def _default_universe() -> list[str]:
    # Keep this small-ish so yfinance calls are reasonable.
    return [
        "SPY",
        "QQQ",
        "AAPL",
        "MSFT",
        "NVDA",
        "AMZN",
        "META",
        "GOOGL",
        "TSLA",
        "AVGO",
        "AMD",
        "NFLX",
        "JPM",
        "XOM",
        "CVX",
        "UNH",
        "LLY",
        "COST",
        "WMT",
        "BRK-B",
    ]


def _universe_from_env() -> list[str]:
    raw = (os.getenv("AGENT_UNIVERSE_TICKERS") or "").strip()
    if not raw:
        return _default_universe()
    tickers = [t.strip().upper() for t in raw.split(",") if t.strip()]
    return tickers or _default_universe()


def _pct_change(series) -> float | None:
    try:
        s = series.dropna()
        if len(s) < 2:
            return None
        start = float(s.iloc[0])
        end = float(s.iloc[-1])
        if start == 0:
            return None
        return (end / start - 1.0) * 100.0
    except Exception:
        return None


def _top_movers(period: str, top_n: int = 10) -> list[dict[str, Any]]:
    """
    period:
      - "1d" for today-ish
      - "5d" for this week-ish
      - "1mo" etc.
    """
    tickers = _universe_from_env()
    df = yf.download(
        tickers=tickers,
        period=period,
        interval="1d",
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )
    movers: list[dict[str, Any]] = []

    # When requesting multiple tickers, yfinance returns a multi-index columns frame.
    for t in tickers:
        try:
            if isinstance(df.columns, type(getattr(df, "columns", None))) and hasattr(df.columns, "levels"):
                close = df[t]["Close"]
            else:
                # Single ticker fallback
                close = df["Close"]
        except Exception:
            continue

        pct = _pct_change(close)
        if pct is None:
            continue
        movers.append({"ticker": t, "pct_change": round(pct, 2)})

    movers.sort(key=lambda x: x["pct_change"], reverse=True)
    return movers[:top_n]


def _should_include_week_movers(text: str) -> bool:
    t = text.lower()
    return ("best performing" in t or "top performing" in t or "biggest gain" in t or "gainers" in t) and (
        "week" in t or "this week" in t or "past week" in t or "5d" in t
    )


def _should_include_day_movers(text: str) -> bool:
    t = text.lower()
    return ("best performing" in t or "top performing" in t or "biggest gain" in t or "gainers" in t) and (
        "today" in t or "day" in t or "1d" in t
    )


def _terminal_docs() -> str:
    # Keep as a compact internal “help manual” that the model can cite.
    return (
        "AaronTerminal is a web app with a React frontend and FastAPI backend.\n"
        "UI: You can open multiple stock panels; each panel has tabs: CHART, OPTIONS, NEWS, WATCHLIST.\n"
        "Data sources: yfinance by default, Polygon used for quotes when POLYGON_API_KEY is set.\n"
        "\n"
        "CHART: candle chart over selectable ranges (1D/1W/1M/1Y/5Y/MAX).\n"
        "NEWS: RSS-based news aggregation (Yahoo Finance ticker feed plus filtered secondary sources like WSJ/Bloomberg/CNBC).\n"
        "OPTIONS: Options chain + computed Greeks using Black-Scholes.\n"
        "  - delta: price sensitivity to $1 move in underlying\n"
        "  - gamma: delta sensitivity to $1 move\n"
        "  - theta: time decay per day (approx)\n"
        "  - vega: option price sensitivity per 1% vol move\n"
        "  - rho: sensitivity per 1% rate move\n"
        "  - iv: implied volatility used in calculations\n"
        "STOCK METRICS footer:\n"
        "  - MKT CAP: market capitalization\n"
        "  - P/E: trailing price/earnings ratio\n"
        "  - PEG: PE adjusted for growth\n"
        "  - EARNINGS: next earnings date (best-effort)\n"
        "  - VOLUME: reported volume (yfinance)\n"
        "  - TODAY HIGH/LOW: intraday high/low\n"
        "  - 52W HIGH/LOW: trailing 52-week high/low\n"
        "  - DIV YIELD: dividend yield percent (as returned by yfinance)\n"
        "  - SHORT RATIO: days-to-cover proxy (short interest / avg volume)\n"
    )

def _no_key_answer(user_text: str, ticker: str | None, extras: dict[str, Any]) -> str:
    """
    Fallback when no LLM key is configured.
    Still answers:
      - terminal functionality + metric explanations (from docs)
      - top movers requests (from yfinance snapshot)
    """
    t = (user_text or "").strip()
    tl = t.lower()

    if not t:
        return "Ask a question about the terminal, metrics, or recent market performance."

    if "how" in tl and ("terminal" in tl or "this app" in tl or "use" in tl):
        return (
            "Here’s the quick tour:\n"
            + _terminal_docs()
            + (f"\nActive ticker context: {ticker}\n" if ticker else "")
        )

    # Movers answers if we have them
    if "top_movers_week" in extras:
        movers = extras["top_movers_week"]
        uni = ", ".join(_universe_from_env())
        lines = "\n".join([f"- {m['ticker']}: {m['pct_change']}%" for m in movers])
        return (
            "Best performers **this week** (approx 5 trading days) from the configured universe:\n"
            f"{lines}\n\n"
            f"Universe used: {uni}\n"
            "If you want the *whole market / S&P 500 / your watchlist*, we can expand the universe source."
        )

    if "top_movers_today" in extras:
        movers = extras["top_movers_today"]
        uni = ", ".join(_universe_from_env())
        lines = "\n".join([f"- {m['ticker']}: {m['pct_change']}%" for m in movers])
        return (
            "Best performers **today** (approx 1 trading day) from the configured universe:\n"
            f"{lines}\n\n"
            f"Universe used: {uni}\n"
            "If you want *all US stocks* or a different list, tell me what universe to use."
        )

    # Metric explanations: pull from the docs and give a tiny interpretation.
    metric_map = {
        "mkt cap": "MKT CAP is market capitalization (share price × shares outstanding). Bigger caps tend to be more stable; smaller caps can be more volatile.",
        "p/e": "P/E is price divided by trailing earnings. Higher can mean higher growth expectations (or overvaluation); compare within the same industry.",
        "peg": "PEG is P/E adjusted for growth. Rough rule-of-thumb: ~1 can be “fair” for growth, but it’s very assumption-sensitive.",
        "earnings": "EARNINGS is the next earnings date (best-effort from yfinance). Expect elevated volatility into/after the print.",
        "volume": "VOLUME is shares traded. Spikes often signal news/flows; low volume can make moves less reliable.",
        "52w": "52W high/low shows the trailing 52-week range—useful for context, but not support/resistance by itself.",
        "div": "DIV YIELD is dividend yield %. Compare to payout ratio + dividend growth + business stability.",
        "short ratio": "SHORT RATIO is a days-to-cover style proxy (short interest / avg volume). Higher can mean crowding and potential squeeze risk, but it’s not a timing signal alone.",
        "delta": "Delta: option price sensitivity to a $1 move in the underlying (roughly). Calls: 0→1, puts: -1→0.",
        "gamma": "Gamma: how fast delta changes as the underlying moves; highest near-the-money and near expiration.",
        "theta": "Theta: estimated time decay per day; typically most negative for near-the-money options as expiration approaches.",
        "vega": "Vega: sensitivity to implied volatility; higher vega means the option reacts more to vol changes.",
        "rho": "Rho: sensitivity to interest rates; usually smaller for equities, larger for longer-dated options.",
        "iv": "IV (implied vol): the volatility level that makes the option price fit the model; not a forecast, but a pricing input.",
    }
    for k, v in metric_map.items():
        if k in tl:
            return v + (f"\n\nIf you tell me the ticker/expiry/strike you’re looking at, I can help interpret it in context." if "option" in tl or k in ["delta", "gamma", "theta", "vega", "rho", "iv"] else "")

    return (
        "I’m running in **no-key mode** right now, so I can answer terminal/metrics questions from built-in docs and provide basic movers snapshots.\n\n"
        "To enable full LLM-style answers, set `OPENAI_API_KEY` in `backend/.env` and restart the backend."
    )

@router.post("/chat")
def chat(req: ChatRequest):
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    user_text = ""
    for m in reversed(req.messages):
        if m.role == "user":
            user_text = m.content
            break

    extras: dict[str, Any] = {}
    try:
        if user_text and _should_include_week_movers(user_text):
            extras["top_movers_week"] = _top_movers("5d", top_n=10)
        elif user_text and _should_include_day_movers(user_text):
            extras["top_movers_today"] = _top_movers("1d", top_n=10)
    except Exception:
        # Never fail the chat because market snapshot failed.
        extras["movers_note"] = "Top movers snapshot unavailable (data fetch failed)."

    # No-key fallback: still returns something useful.
    if not api_key:
        return {"answer": _no_key_answer(user_text, req.ticker, extras), "extras": extras, "mode": "no_key"}

    # Lazy import so the rest of the app works without the dependency during dev.
    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"openai package missing or broken: {e}")

    system = (
        "You are AaronTerminal Agent.\n"
        "You answer questions about:\n"
        "- How the terminal works and where to find features\n"
        "- What metrics mean and how to analyze them\n"
        "- Market questions (today/recent), using provided snapshots when available\n"
        "\n"
        "Rules:\n"
        "- If asked about the app, answer concretely using the provided 'Terminal docs'.\n"
        "- If asked about market performance, be explicit about the universe and timeframe used.\n"
        "- If you are missing data, say what you’d need and give a best-effort general answer.\n"
        "\n"
        "Terminal docs:\n"
        f"{_terminal_docs()}\n"
        "\n"
        f"Current UI ticker context (if any): {req.ticker or 'none'}\n"
        f"Market snapshot (JSON): {extras}\n"
    )

    client = OpenAI(api_key=api_key)

    msgs = [{"role": "system", "content": system}]
    for m in req.messages[-20:]:
        msgs.append({"role": m.role, "content": m.content})

    try:
        resp = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            messages=msgs,
            temperature=0.3,
        )
        text = (resp.choices[0].message.content or "").strip()
        return {"answer": text, "extras": extras, "mode": "llm"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

