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
    ticker: str | None = None


# ─── Universe ─────────────────────────────────────────────────────────────────

def _universe_from_env() -> list[str]:
    raw = (os.getenv("AGENT_UNIVERSE_TICKERS") or "").strip()
    if not raw:
        return [
            "SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL",
            "TSLA", "AVGO", "AMD", "NFLX", "JPM", "XOM", "CVX", "UNH",
            "LLY", "COST", "WMT", "BRK-B",
        ]
    return [t.strip().upper() for t in raw.split(",") if t.strip()]


# ─── Market data helpers ───────────────────────────────────────────────────────

def _pct_change(series) -> float | None:
    try:
        s = series.dropna()
        if len(s) < 2:
            return None
        start, end = float(s.iloc[0]), float(s.iloc[-1])
        return None if start == 0 else (end / start - 1.0) * 100.0
    except Exception:
        return None


def _top_movers(period: str, top_n: int = 10) -> list[dict[str, Any]]:
    tickers = _universe_from_env()
    df = yf.download(
        tickers=tickers, period=period, interval="1d",
        group_by="ticker", auto_adjust=True, progress=False, threads=True,
    )
    movers: list[dict[str, Any]] = []
    for t in tickers:
        try:
            close = df[t]["Close"] if hasattr(df.columns, "levels") else df["Close"]
        except Exception:
            continue
        pct = _pct_change(close)
        if pct is not None:
            movers.append({"ticker": t, "pct_change": round(pct, 2)})
    movers.sort(key=lambda x: x["pct_change"], reverse=True)
    return movers[:top_n]


def _ticker_context(ticker: str) -> dict[str, Any]:
    """Fetch a quick snapshot for the active panel ticker to inject as context."""
    try:
        info = yf.Ticker(ticker).fast_info
        return {
            "ticker": ticker,
            "price": round(float(info.last_price), 2) if info.last_price else None,
            "market_cap": int(info.market_cap) if info.market_cap else None,
            "52w_high": round(float(info.fifty_two_week_high), 2) if info.fifty_two_week_high else None,
            "52w_low": round(float(info.fifty_two_week_low), 2) if info.fifty_two_week_low else None,
            "pe_ratio": round(float(info.pe_ratio), 2) if hasattr(info, "pe_ratio") and info.pe_ratio else None,
        }
    except Exception:
        return {"ticker": ticker}


def _should_include_week_movers(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ("best performing", "top performing", "biggest gain", "gainers", "top movers")) and \
           any(k in t for k in ("week", "this week", "past week", "5d"))


def _should_include_day_movers(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ("best performing", "top performing", "biggest gain", "gainers", "top movers")) and \
           any(k in t for k in ("today", "day", "1d"))


# ─── System prompt ─────────────────────────────────────────────────────────────

def _system_prompt(ticker: str | None, extras: dict[str, Any]) -> str:
    ticker_ctx = ""
    if ticker:
        ctx = _ticker_context(ticker)
        ticker_ctx = f"\nActive panel ticker: {ticker}\nLive snapshot: {ctx}\n"

    return f"""You are the AaronTerminal AI Agent — a personal financial assistant embedded inside a web-based trading terminal.

You have three areas of expertise:

1. TERMINAL NAVIGATION & FEATURES
   You know every feature of AaronTerminal and can guide the user through it.
   Views available per panel: chart | options | news | watchlist
   - chart: TradingView-style candlestick chart (1D / 1W / 1M / 1Y / 5Y / MAX). Header shows price change for the displayed period.
   - options: Full options chain with bid/ask, IV, and all 5 Black-Scholes greeks (delta, gamma, theta, vega, rho).
   - news: Multi-source headlines (Yahoo Finance, WSJ, Bloomberg, CNBC) for the ticker.
   - watchlist: Personal watchlist showing stocks + options with live P&L vs prior close.
   Other features: multi-panel layout (add panels, resize with drag handles), news alert bell (polls watchlist tickers every 5 min), real estate terminal (separate mode), AI agent (this chat).

2. FINANCIAL EDUCATION
   Explain concepts clearly at any depth the user needs:
   - Options: greeks, strategies (covered calls, spreads, straddles, iron condors, etc.), IV crush, pin risk, theta decay curves, put-call parity
   - Equities: valuation (DCF, P/E, PEG, EV/EBITDA), fundamental analysis, technical analysis basics, short interest/squeeze mechanics
   - Macro: Fed policy, interest rate cycles, yield curve, inflation metrics (CPI, PCE), sector rotation, risk-on/risk-off
   - Portfolio: Kelly criterion, position sizing, Sharpe/Sortino, correlation, beta, hedging
   - Real estate investing: cap rate, NOI, cash-on-cash return, DSCR, 1031 exchanges

3. MARKET ANALYSIS
   You can interpret the data shown in the terminal and offer commentary.
   When a user asks about a specific ticker or metric shown, use the live snapshot provided.
   Be upfront that your training data has a knowledge cutoff and live prices come from yfinance (15-min delayed).

NAVIGATION COMMANDS
When it would help the user to look at something specific in the terminal, emit a nav command in your response:
  [NAV:view=chart|ticker=AAPL]     → switches panel to AAPL chart
  [NAV:view=options|ticker=TSLA]   → TSLA options chain
  [NAV:view=news|ticker=SPY]       → SPY news
  [NAV:view=watchlist]             → opens watchlist
  [NAV:ticker=NVDA]                → changes ticker, keeps current view
  [NAV:view=options]               → switches view, keeps current ticker

Nav commands render as clickable buttons in the chat UI — the user can click to jump there instantly. Use them naturally when you recommend looking at something, e.g. "Check the options chain for unusual IV [NAV:view=options|ticker=AAPL]".

STYLE
- Be concise but thorough. Use plain language first, then add jargon with brief definitions.
- Use markdown: **bold** for emphasis, bullet lists for steps, `code` for tickers/values.
- When unsure, say so. Never fabricate specific prices or dates.
- If the user asks a navigation question ("how do I see the Greeks?"), answer AND emit the nav command.
{ticker_ctx}
Market snapshot (if fetched): {extras if extras else "none"}
"""


# ─── No-key fallback ──────────────────────────────────────────────────────────

def _no_key_answer(user_text: str, ticker: str | None, extras: dict[str, Any]) -> str:
    tl = (user_text or "").lower()

    if "top_movers_week" in extras:
        lines = "\n".join(f"- `{m['ticker']}`: {m['pct_change']:+.2f}%" for m in extras["top_movers_week"])
        return f"**Best performers this week** (approx 5 trading days):\n{lines}\n\nUniverse: {', '.join(_universe_from_env())}"

    if "top_movers_today" in extras:
        lines = "\n".join(f"- `{m['ticker']}`: {m['pct_change']:+.2f}%" for m in extras["top_movers_today"])
        return f"**Best performers today**:\n{lines}\n\nUniverse: {', '.join(_universe_from_env())}"

    quick = {
        "delta": "**Delta** — how much the option price moves per $1 move in the stock. Calls: 0→1, Puts: −1→0. At-the-money ≈ 0.50.",
        "gamma": "**Gamma** — how fast delta changes. Highest near-the-money and near expiration. High gamma = delta can shift quickly.",
        "theta": "**Theta** — time decay per day. Negative for option buyers (you lose value as time passes). Accelerates near expiration.",
        "vega": "**Vega** — sensitivity to a 1% change in implied volatility. Buying before earnings (high IV) and selling after (IV crush) is a common risk.",
        "rho": "**Rho** — sensitivity to interest rates. Usually small for equities; matters more for longer-dated options (LEAPS).",
        "iv": "**Implied Volatility (IV)** — the market's expectation of future volatility priced into the option. High IV = expensive options. Compare IV to historical vol (HV) to judge whether options are cheap or rich.",
        "p/e": "**P/E ratio** — price ÷ trailing earnings. Higher = more expensive relative to current earnings. Compare within same sector.",
        "peg": "**PEG** — P/E ÷ growth rate. Rule of thumb: ~1 = fairly valued for a growth stock, <1 = potentially cheap, >2 = pricey.",
        "short ratio": "**Short ratio** (days-to-cover) — short interest ÷ avg daily volume. High values mean it would take many days to unwind shorts → potential squeeze fuel.",
        "cap rate": "**Cap rate** — Net Operating Income ÷ property value. Higher = better yield but often higher risk. 5–8% is typical for residential.",
        "iron condor": "**Iron condor** — sell an OTM call spread + sell an OTM put spread. Profits when the stock stays range-bound. Max profit = net credit received.",
        "covered call": "**Covered call** — own 100 shares, sell a call above current price. Caps upside but collects premium. Good in sideways/mild bull markets.",
        "yield curve": "**Yield curve** — plots Treasury yields across maturities. Normal = long rates > short rates. Inverted (short > long) has historically preceded recessions.",
    }
    for k, v in quick.items():
        if k in tl:
            return v

    return (
        "I'm in **no-key mode** — I can answer basic terminal and metrics questions from built-in knowledge.\n\n"
        "To unlock full AI responses (free):\n"
        "1. Sign up at **console.groq.com** — no credit card needed\n"
        "2. Create an API key\n"
        "3. Add `GROQ_API_KEY=your_key_here` to `backend/.env`\n"
        "4. Restart the backend\n\n"
        "Groq uses Llama 3.3 70B — fast, free, and excellent at financial questions."
    )


# ─── Route ────────────────────────────────────────────────────────────────────

@router.post("/chat")
def chat(req: ChatRequest):
    user_text = next((m.content for m in reversed(req.messages) if m.role == "user"), "")

    # Fetch market snapshot only when needed
    extras: dict[str, Any] = {}
    try:
        if _should_include_week_movers(user_text):
            extras["top_movers_week"] = _top_movers("5d", top_n=10)
        elif _should_include_day_movers(user_text):
            extras["top_movers_today"] = _top_movers("1d", top_n=10)
    except Exception:
        pass

    # Prefer Groq (free) → fall back to OpenAI → no-key mode
    groq_key   = os.getenv("GROQ_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    if not groq_key and not openai_key:
        return {"answer": _no_key_answer(user_text, req.ticker, extras), "extras": extras, "mode": "no_key"}

    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"openai package missing: {e}")

    if groq_key:
        client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
        model  = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        mode   = "groq"
    else:
        client = OpenAI(api_key=openai_key)
        model  = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        mode   = "openai"

    system = _system_prompt(req.ticker, extras)
    msgs   = [{"role": "system", "content": system}]
    for m in req.messages[-24:]:
        msgs.append({"role": m.role, "content": m.content})

    try:
        resp = client.chat.completions.create(
            model=model, messages=msgs, temperature=0.35, max_tokens=1024,
        )
        text = (resp.choices[0].message.content or "").strip()
        return {"answer": text, "extras": extras, "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
