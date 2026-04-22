from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import quotes, candles, options, news, pnl

app = FastAPI(title="AaronTerminal API", version="1.0.0")

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


@app.get("/")
def root():
    return {"status": "ok", "service": "AaronTerminal API"}
