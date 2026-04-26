from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from db import init_db
from routers import quotes, candles, options, news, pnl, realestate, agent, auth, watchlist

app = FastAPI(title="AaronTerminal API", version="1.0.0")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quotes.router)
app.include_router(candles.router)
app.include_router(options.router)
app.include_router(news.router)
app.include_router(pnl.router)
app.include_router(realestate.router)
app.include_router(agent.router)
app.include_router(auth.router)
app.include_router(watchlist.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "AaronTerminal API"}
