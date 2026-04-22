from fastapi import APIRouter, HTTPException, Query
import feedparser
import httpx
import asyncio

router = APIRouter(prefix="/api/news", tags=["news"])

RSS_FEEDS = {
    "yahoo": "https://finance.yahoo.com/rss/headline?s={ticker}",
    "seeking_alpha": "https://seekingalpha.com/api/sa/combined/{ticker}.xml",
}

GENERAL_FEEDS = [
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories/"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
]


def _parse_feed(url: str, source_label: str, limit: int = 10):
    try:
        feed = feedparser.parse(url)
        items = []
        for entry in feed.entries[:limit]:
            items.append({
                "title":     entry.get("title", ""),
                "link":      entry.get("link", ""),
                "published": entry.get("published", ""),
                "summary":   entry.get("summary", "")[:300],
                "source":    source_label,
            })
        return items
    except Exception:
        return []


@router.get("/{ticker}")
async def get_news(
    ticker: str,
    limit: int = Query(20, le=50),
    q: str = Query("", description="Filter articles by keyword"),
):
    ticker = ticker.upper()
    loop = asyncio.get_event_loop()

    yahoo_url = RSS_FEEDS["yahoo"].format(ticker=ticker)
    articles = await loop.run_in_executor(None, lambda: _parse_feed(yahoo_url, "Yahoo Finance", limit))

    if len(articles) < 5:
        for label, url in GENERAL_FEEDS:
            more = await loop.run_in_executor(None, lambda u=url, l=label: _parse_feed(u, l, 5))
            articles.extend(more)

    if q:
        q_lower = q.lower()
        articles = [
            a for a in articles
            if q_lower in a["title"].lower() or q_lower in a.get("summary", "").lower()
        ]

    return {"ticker": ticker, "articles": articles[:limit]}
