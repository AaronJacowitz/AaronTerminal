# Aaron Terminal

A personal web-based trading and real estate investment terminal with real-time charts, options analysis, Greek history, P&L modeling, watchlist tracking, AI agent chat, and property investment metrics.

![Aaron Terminal](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-blue)
![Auth](https://img.shields.io/badge/auth-JWT%20%2B%20PostgreSQL-green)
![Real Estate](https://img.shields.io/badge/real%20estate-mock%20data%20(demo)-orange)

## Features

### Stocks & Options Terminal
- **Price Charts** — Candlestick charts with volume, 1D/1W/1M/1Y/5Y/MAX ranges, and auto-selected candle granularity. Header displays price change for the selected period.
- **Stock Metrics** — Market cap, P/E, PEG, earnings date, 52-week range, dividend yield, short ratio
- **Options Chain** — Full call/put chain with bid/ask, IV, and all five Greeks per strike
- **P&L Modeler** — Black-Scholes expiration P&L curve with breakeven, max loss, and max profit
- **Greek History** — Delta, gamma, theta, vega, rho, and IV charted over 1W/1M/1Y using rolling realized vol
- **News** — Ticker-specific headlines from Yahoo Finance, WSJ, Bloomberg, and CNBC — sorted by most recent
- **News Alerts** — Bell icon in the top bar polls all watchlist tickers every 5 minutes and notifies you of new headlines with toast pop-ups
- **Watchlist** — Track stocks and options with live daily return (P&L vs. prior close), refreshed every 15s
- **AI Agent** — Llama 3.3 70B (via Groq, free tier) chat panel embedded in every panel. Answers financial education questions, explains terminal features, and can issue clickable navigation commands that jump you directly to a view/ticker. Falls back to OpenAI if configured, or a built-in rule-based mode with no key at all.
- **Multi-panel layout** — Add and resize multiple panels side by side; charts fill their panels correctly on every layout change

### Real Estate Terminal

> **⚠️ Demo data notice:** The real estate module is **fully functional** and production-ready, but is currently running in **mock mode** (`RENTCAST_MOCK=true`) to preserve the free-tier Rentcast API quota (50 req/month). All UI, filtering, sorting, investment math, and cash flow calculations are real — only the listing and rent-estimate data is hardcoded sample data. To point it at live listings, add a Rentcast API key to `.env` and set `RENTCAST_MOCK=false`.

- **Property Search** — Search active listings by city/state, zip code, or address (powered by Rentcast)
- **Investment Metrics** — Estimated monthly rent, gross yield, and monthly cash flow per property
- **Full Cost Breakdown** — Est. monthly costs include mortgage, property tax (1.1%/yr), insurance (0.5%/yr), maintenance (1%/yr), CapEx reserve (0.5%/yr), property management (8% of rent), and vacancy (5% of rent)
- **Adjustable Mortgage Assumptions** — Edit down payment % and interest rate per card; cash flow updates live
- **Fuzzy City Search** — Autocomplete with 200+ US cities and common abbreviations (nyc, la, sf, dc, etc.)
- **Sort & Filter** — Sort by price, $/sqft, sq ft, days listed, cash flow, or gross yield; toggle high/low

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, lightweight-charts (TradingView), Recharts |
| Backend | Python, FastAPI, yfinance, scipy (Black-Scholes) |
| Database | PostgreSQL (via psycopg2) |
| Auth | JWT (PyJWT) + PBKDF2-SHA256 password hashing |
| Data — Stocks | yfinance (15-min delayed) + Polygon.io (optional real-time) |
| Data — News | Yahoo Finance RSS, WSJ RSS, Bloomberg RSS, CNBC RSS |
| Data — Real Estate | Rentcast API (listings + rent estimates) · **mock mode active by default** |
| AI Agent | Groq API — free tier, Llama 3.3 70B (falls back to OpenAI if `GROQ_API_KEY` not set) |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ running locally (default: `postgres:postgres@localhost:5432/aaronterminal`)
- A free [Polygon.io](https://polygon.io) API key (optional — used for real-time quotes)
- A [Rentcast](https://rentcast.io) API key (optional — real estate is fully usable with mock data)
- An [OpenAI](https://platform.openai.com) API key (optional — enables the AI Agent panel)

### 1. Clone the repo

```bash
git clone https://github.com/AaronJacowitz/AaronTerminal.git
cd AaronTerminal
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Set up the frontend

```bash
cd frontend
npm install
```

### 4. Run

Open two terminals from the project root:

```bash
# Terminal 1 — backend (port 8000)
bash start-backend.sh

# Terminal 2 — frontend (port 5173)
bash start-frontend.sh
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `POLYGON_API_KEY` | Optional | [Polygon.io](https://polygon.io) key for real-time quote data. Without it, falls back to yfinance (15-min delayed). |
| `RENTCAST_API_KEY` | Optional | [Rentcast](https://rentcast.io) key for property listings and rent estimates. |
| `RENTCAST_MOCK` | Optional | Set to `true` to use hardcoded sample listings instead of live API calls. **Defaults to `true`** in the included `.env` to protect the 50 req/month free quota. Set to `false` (with a valid `RENTCAST_API_KEY`) to enable live data. |
| `JWT_SECRET` | Recommended | Secret key used to sign auth tokens. Change from the default before deploying. |
| `DATABASE_URL` | Required | PostgreSQL connection string. Default: `postgresql://postgres:postgres@localhost:5432/aaronterminal` |
| `GROQ_API_KEY` | Optional (recommended) | **Free** Groq API key from [console.groq.com](https://console.groq.com) — no credit card required. Powers the AI Agent with Llama 3.3 70B. Takes priority over OpenAI if both are set. |
| `GROQ_MODEL` | Optional | Override the Groq model. Default: `llama-3.3-70b-versatile` |
| `OPENAI_API_KEY` | Optional | Fallback if `GROQ_API_KEY` is not set. |

## Project Structure

```
AaronTerminal/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── db.py                 # PostgreSQL connection + schema init (psycopg2)
│   ├── security.py           # PBKDF2 hashing, JWT sign/verify
│   ├── requirements.txt
│   ├── .env.example
│   └── routers/
│       ├── auth.py           # Register, login, /me — JWT auth
│       ├── quotes.py         # Stock quotes, metrics, price history
│       ├── candles.py        # OHLCV candlestick data
│       ├── options.py        # Options chain + Greek history
│       ├── pnl.py            # Black-Scholes P&L modeling
│       ├── news.py           # Multi-source news feed (Yahoo, WSJ, Bloomberg, CNBC)
│       ├── watchlist.py      # Per-user watchlist CRUD
│       ├── agent.py          # OpenAI-powered market analysis agent
│       └── realestate.py     # Rentcast listings + rent estimates (mock mode on)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── realestate/   # Real estate terminal components
│   │   │   │   ├── RealEstateApp.tsx
│   │   │   │   ├── PropertyCard.tsx
│   │   │   │   └── cities.ts
│   │   │   ├── AuthScreen.tsx          # Sign in / create account UI
│   │   │   ├── AgentChat.tsx           # AI agent chat panel
│   │   │   ├── CandleChart.tsx         # TradingView lightweight-charts
│   │   │   ├── NewsNotificationBell.tsx
│   │   │   ├── NewsToasts.tsx
│   │   │   └── ...
│   │   ├── context/
│   │   │   ├── AuthContext.tsx         # JWT auth state (loading/signed_out/signed_in)
│   │   │   └── WatchlistContext.tsx
│   │   ├── hooks/
│   │   │   └── useNewsNotifications.ts
│   │   ├── api/              # Axios client with Bearer auth
│   │   └── App.tsx
│   └── package.json
├── start-backend.sh
└── start-frontend.sh
```

## Data Sources & Accuracy

- Stock prices are **15-minute delayed** via yfinance by default
- With a Polygon.io key, quotes update in near real-time
- Options Greeks are computed via Black-Scholes using yfinance IV data
- Greek history uses a 20-day rolling realized volatility window as the IV proxy
- News is fetched from public RSS feeds; WSJ and Bloomberg articles may require a subscription to read in full
- Real estate listings and rent estimates are provided by Rentcast — **currently running on hardcoded sample data** (`RENTCAST_MOCK=true`). The full pipeline (search, filtering, investment math, cash flow) is wired up and works; only the underlying property data is mocked. Flip `RENTCAST_MOCK=false` in `.env` with a valid API key to go live.

## Auth & Database

User accounts and watchlists are persisted in PostgreSQL. On first run, the backend auto-creates the required tables (`users`, `watchlist_items`). Passwords are hashed with PBKDF2-SHA256 (200k iterations). Auth tokens are signed JWTs valid for 7 days — change `JWT_SECRET` in `.env` before deploying anywhere public.

## License

MIT
