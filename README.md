# Aaron Terminal

A personal web-based trading terminal with real-time charts, options chain analysis, Greek history, P&L modeling, and a live watchlist.

![Aaron Terminal](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-blue)

## Features

- **Price Charts** — Candlestick charts with volume, 1D/1W/1M/1Y/5Y/MAX ranges, and auto-selected candle granularity
- **Stock Metrics** — Market cap, P/E, PEG, earnings date, 52-week range, dividend yield, short ratio
- **Options Chain** — Full call/put chain with bid/ask, IV, and all five Greeks per strike
- **P&L Modeler** — Black-Scholes expiration P&L curve with breakeven, max loss, and max profit
- **Greek History** — Delta, gamma, theta, vega, rho, and IV charted over 1W/1M/1Y using rolling realized vol
- **News** — Ticker-specific news feed with keyword search
- **Watchlist** — Track stocks and options with live daily return (P&L vs. prior close), refreshed every 15s
- **Multi-panel layout** — Add and arrange multiple panels side by side

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Recharts, lightweight-charts (TradingView) |
| Backend | Python, FastAPI, yfinance, scipy (Black-Scholes) |
| Data | yfinance (15-min delayed) + Polygon.io (optional real-time) |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A free [Polygon.io](https://polygon.io) API key (optional — used for real-time quotes)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/AaronTerminal.git
cd AaronTerminal
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your Polygon API key (optional)
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

## Project Structure

```
AaronTerminal/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   └── routers/
│       ├── quotes.py         # Stock quotes, metrics, price history
│       ├── candles.py        # OHLCV candlestick data
│       ├── options.py        # Options chain + Greek history
│       ├── pnl.py            # Black-Scholes P&L modeling
│       └── news.py           # Ticker news feed
├── frontend/
│   ├── src/
│   │   ├── components/       # React UI components
│   │   ├── context/          # Watchlist global state
│   │   ├── api/              # API client (axios)
│   │   └── App.tsx
│   └── package.json
├── start-backend.sh
└── start-frontend.sh
```

## Data Sources & Accuracy

- Prices are **15-minute delayed** via yfinance by default
- With a Polygon.io key, quotes update in near real-time
- Options Greeks are computed via Black-Scholes using yfinance IV data
- Greek history uses a 20-day rolling realized volatility window as the IV proxy

## License

MIT
