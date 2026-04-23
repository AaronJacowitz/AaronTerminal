from fastapi import APIRouter, HTTPException, Query
import feedparser
import httpx
import asyncio
from email.utils import parsedate_to_datetime
from datetime import timezone

router = APIRouter(prefix="/api/news", tags=["news"])

RSS_FEEDS = {
    "yahoo": "https://finance.yahoo.com/rss/headline?s={ticker}",
    "seeking_alpha": "https://seekingalpha.com/api/sa/combined/{ticker}.xml",
}

GENERAL_FEEDS = [
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories/"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
]

# Always-fetched secondary sources (filtered by ticker/company in title+summary)
SECONDARY_FEEDS = [
    ("WSJ",      "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"),
    ("WSJ",      "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml"),
    ("Bloomberg","https://feeds.bloomberg.com/markets/news.rss"),
    ("Bloomberg","https://feeds.bloomberg.com/technology/news.rss"),
    ("CNBC",     "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664"),
    ("CNBC",     "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135"),
]

# Ticker → common name terms used in headlines (lowercase)
TICKER_NAMES: dict[str, list[str]] = {
    "AAPL": ["apple"], "MSFT": ["microsoft"], "GOOGL": ["google", "alphabet"],
    "GOOG": ["google", "alphabet"], "META": ["meta", "facebook", "instagram", "whatsapp"],
    "AMZN": ["amazon"], "TSLA": ["tesla"], "NVDA": ["nvidia"], "NFLX": ["netflix"],
    "AMD": ["amd", "advanced micro"], "INTC": ["intel"], "QCOM": ["qualcomm"],
    "ORCL": ["oracle"], "CRM": ["salesforce"], "ADBE": ["adobe"], "IBM": ["ibm"],
    "UBER": ["uber"], "LYFT": ["lyft"], "SNAP": ["snap", "snapchat"],
    "TWTR": ["twitter", "x corp"], "PINS": ["pinterest"], "SPOT": ["spotify"],
    "SHOP": ["shopify"], "SQ": ["square", "block"], "PYPL": ["paypal"],
    "V": ["visa"], "MA": ["mastercard"], "JPM": ["jpmorgan", "jp morgan"],
    "BAC": ["bank of america"], "WFC": ["wells fargo"], "GS": ["goldman sachs"],
    "MS": ["morgan stanley"], "C": ["citigroup", "citibank"],
    "BRK": ["berkshire"], "WMT": ["walmart"], "TGT": ["target"],
    "COST": ["costco"], "AMGN": ["amgen"], "PFE": ["pfizer"], "JNJ": ["johnson"],
    "MRK": ["merck"], "LLY": ["eli lilly", "lilly"], "ABBV": ["abbvie"],
    "XOM": ["exxon"], "CVX": ["chevron"], "BA": ["boeing"], "GE": ["general electric"],
    "F": ["ford"], "GM": ["general motors"], "RIVN": ["rivian"],
    "DIS": ["disney"], "CMCSA": ["comcast"], "T": ["at&t"], "VZ": ["verizon"],
    "COIN": ["coinbase"], "HOOD": ["robinhood"], "SOFI": ["sofi"],
}


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
    yahoo_limit = max(10, limit - 8)  # reserve up to 8 slots for secondary sources

    # Fetch Yahoo (ticker-specific) + WSJ secondary feeds in parallel
    tasks = [loop.run_in_executor(None, lambda: _parse_feed(yahoo_url, "Yahoo Finance", yahoo_limit))]
    for label, url in SECONDARY_FEEDS:
        tasks.append(loop.run_in_executor(None, lambda u=url, l=label: _parse_feed(u, l, 20)))

    results = await asyncio.gather(*tasks)
    yahoo_articles = results[0]
    secondary_articles = []
    for batch in results[1:]:
        secondary_articles.extend(batch)

    # Filter secondary feeds to articles mentioning the ticker or company name
    search_terms = [ticker.lower()] + TICKER_NAMES.get(ticker, [])
    def _matches(article: dict) -> bool:
        haystack = (article["title"] + " " + article.get("summary", "")).lower()
        return any(term in haystack for term in search_terms)
    relevant_secondary = [a for a in secondary_articles if _matches(a)]

    articles = yahoo_articles + relevant_secondary

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

    def _pub_ts(article: dict) -> float:
        try:
            return parsedate_to_datetime(article["published"]).astimezone(timezone.utc).timestamp()
        except Exception:
            return 0.0

    articles.sort(key=_pub_ts, reverse=True)

    return {"ticker": ticker, "articles": articles[:limit]}
