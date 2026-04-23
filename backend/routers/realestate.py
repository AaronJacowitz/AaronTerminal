from fastapi import APIRouter, HTTPException, Query
import httpx
import os
import time
import json

router = APIRouter(prefix="/api/realestate", tags=["realestate"])

RENTCAST_KEY  = os.getenv("RENTCAST_API_KEY", "")
RENTCAST_MOCK = os.getenv("RENTCAST_MOCK", "").lower() in ("1", "true", "yes")
RENTCAST_BASE = "https://api.rentcast.io/v1"
HEADERS = {"X-Api-Key": RENTCAST_KEY, "Accept": "application/json"}

MOCK_LISTINGS = [
    {"id":"m1","address":"142 Maple St","city":"Austin","state":"TX","zipCode":"78701","price":425000,"bedrooms":3,"bathrooms":2,"squareFootage":1650,"lotSize":6200,"yearBuilt":2005,"propertyType":"Single Family","daysOnMarket":12,"pricePerSqFt":258,"monthlyMortgage":2267,"latitude":30.27,"longitude":-97.74,"listingUrl":""},
    {"id":"m2","address":"87 Elmwood Ave","city":"Austin","state":"TX","zipCode":"78702","price":389000,"bedrooms":2,"bathrooms":2,"squareFootage":1120,"lotSize":None,"yearBuilt":2018,"propertyType":"Condo","daysOnMarket":4,"pricePerSqFt":347,"monthlyMortgage":2075,"latitude":30.26,"longitude":-97.72,"listingUrl":""},
    {"id":"m3","address":"310 Riverside Dr","city":"Austin","state":"TX","zipCode":"78704","price":575000,"bedrooms":4,"bathrooms":3,"squareFootage":2200,"lotSize":8500,"yearBuilt":1998,"propertyType":"Single Family","daysOnMarket":31,"pricePerSqFt":261,"monthlyMortgage":3067,"latitude":30.25,"longitude":-97.75,"listingUrl":""},
    {"id":"m4","address":"55 Oak Blvd","city":"Austin","state":"TX","zipCode":"78703","price":310000,"bedrooms":2,"bathrooms":1,"squareFootage":980,"lotSize":None,"yearBuilt":2021,"propertyType":"Condo","daysOnMarket":2,"pricePerSqFt":316,"monthlyMortgage":1654,"latitude":30.28,"longitude":-97.76,"listingUrl":""},
    {"id":"m5","address":"900 Cedar Lane","city":"Austin","state":"TX","zipCode":"78745","price":498000,"bedrooms":3,"bathrooms":2.5,"squareFootage":1890,"lotSize":7100,"yearBuilt":2011,"propertyType":"Single Family","daysOnMarket":19,"pricePerSqFt":264,"monthlyMortgage":2657,"latitude":30.22,"longitude":-97.78,"listingUrl":""},
    {"id":"m6","address":"201 Pine Court","city":"Austin","state":"TX","zipCode":"78748","price":275000,"bedrooms":3,"bathrooms":2,"squareFootage":1400,"lotSize":5800,"yearBuilt":1992,"propertyType":"Single Family","daysOnMarket":67,"pricePerSqFt":196,"monthlyMortgage":1467,"latitude":30.18,"longitude":-97.80,"listingUrl":""},
    {"id":"m7","address":"14 Willow Way","city":"Austin","state":"TX","zipCode":"78741","price":620000,"bedrooms":4,"bathrooms":3.5,"squareFootage":2600,"lotSize":9200,"yearBuilt":2019,"propertyType":"Single Family","daysOnMarket":8,"pricePerSqFt":238,"monthlyMortgage":3308,"latitude":30.24,"longitude":-97.71,"listingUrl":""},
    {"id":"m8","address":"502 Birch St, Unit 4","city":"Austin","state":"TX","zipCode":"78751","price":345000,"bedrooms":2,"bathrooms":2,"squareFootage":1050,"lotSize":None,"yearBuilt":2016,"propertyType":"Multi Family","daysOnMarket":24,"pricePerSqFt":329,"monthlyMortgage":1840,"latitude":30.31,"longitude":-97.73,"listingUrl":""},
]

MOCK_RENT = {
    "m1": {"rentEstimate":2100,"rentRangeLow":1950,"rentRangeHigh":2250},
    "m2": {"rentEstimate":1800,"rentRangeLow":1650,"rentRangeHigh":1950},
    "m3": {"rentEstimate":2800,"rentRangeLow":2600,"rentRangeHigh":3000},
    "m4": {"rentEstimate":1550,"rentRangeLow":1400,"rentRangeHigh":1700},
    "m5": {"rentEstimate":2400,"rentRangeLow":2200,"rentRangeHigh":2600},
    "m6": {"rentEstimate":1700,"rentRangeLow":1550,"rentRangeHigh":1850},
    "m7": {"rentEstimate":3100,"rentRangeLow":2900,"rentRangeHigh":3300},
    "m8": {"rentEstimate":1950,"rentRangeLow":1800,"rentRangeHigh":2100},
}

# In-memory cache: key -> (timestamp, data)
# Listings cached 24h (they don't change minute-to-minute)
# Rent estimates cached 7 days (very stable)
_cache: dict[str, tuple[float, any]] = {}
LISTINGS_TTL  = 60 * 60 * 24      # 24 hours
RENT_TTL      = 60 * 60 * 24 * 7  # 7 days


def _cache_get(key: str) -> any:
    entry = _cache.get(key)
    if not entry:
        return None
    ts, data = entry
    if time.time() - ts > _cache.get(key + "__ttl", (0, LISTINGS_TTL))[1]:
        del _cache[key]
        return None
    return data


def _cache_set(key: str, data: any, ttl: float):
    _cache[key] = (time.time(), data)
    _cache[key + "__ttl"] = (0, ttl)


def _mortgage_payment(price: float, down_pct: float = 0.20, rate_annual: float = 0.07, years: int = 30) -> float:
    loan = price * (1 - down_pct)
    r = rate_annual / 12
    n = years * 12
    if r == 0:
        return loan / n
    return loan * r * (1 + r) ** n / ((1 + r) ** n - 1)


@router.get("/listings")
def get_listings(
    city: str = Query(None),
    state: str = Query(None),
    zipCode: str = Query(None),
    address: str = Query(None),
    bedrooms: int = Query(None),
    bathrooms: float = Query(None),
    propertyType: str = Query(None),
    limit: int = Query(20, le=50),
):
    if RENTCAST_MOCK:
        return {"count": len(MOCK_LISTINGS), "listings": MOCK_LISTINGS, "cached": False}

    if not RENTCAST_KEY:
        raise HTTPException(status_code=500, detail="RENTCAST_API_KEY not configured")

    params = {"status": "Active", "limit": limit}
    if city:         params["city"] = city
    if state:        params["state"] = state
    if zipCode:      params["zipCode"] = zipCode
    if address:      params["address"] = address
    if bedrooms:     params["bedrooms"] = bedrooms
    if bathrooms:    params["bathrooms"] = bathrooms
    if propertyType: params["propertyType"] = propertyType

    cache_key = "listings:" + json.dumps(params, sort_keys=True)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    try:
        resp = httpx.get(f"{RENTCAST_BASE}/listings/sale", headers=HEADERS, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    listings = data if isinstance(data, list) else data.get("data", [])

    results = []
    for p in listings:
        price = p.get("price") or 0
        results.append({
            "id":              p.get("id", ""),
            "address":         p.get("formattedAddress") or p.get("address", ""),
            "city":            p.get("city", ""),
            "state":           p.get("state", ""),
            "zipCode":         p.get("zipCode", ""),
            "price":           price,
            "bedrooms":        p.get("bedrooms"),
            "bathrooms":       p.get("bathrooms"),
            "squareFootage":   p.get("squareFootage"),
            "lotSize":         p.get("lotSize"),
            "yearBuilt":       p.get("yearBuilt"),
            "propertyType":    p.get("propertyType", ""),
            "daysOnMarket":    p.get("daysOnMarket"),
            "pricePerSqFt":    round(price / p["squareFootage"], 0) if price and p.get("squareFootage") else None,
            "monthlyMortgage": round(_mortgage_payment(price), 0) if price else None,
            "latitude":        p.get("latitude"),
            "longitude":       p.get("longitude"),
            "listingUrl":      p.get("listingUrl", ""),
        })

    result = {"count": len(results), "listings": results, "cached": False}
    _cache_set(cache_key, result, LISTINGS_TTL)
    return result


@router.get("/rent-estimate")
def get_rent_estimate(
    address: str = Query(...),
    propertyType: str = Query("Single Family"),
    bedrooms: int = Query(None),
    bathrooms: float = Query(None),
    squareFootage: int = Query(None),
):
    if RENTCAST_MOCK:
        match = next((r for id_, r in MOCK_RENT.items()
                      if any(MOCK_LISTINGS[i]["address"] in address
                             for i, l in enumerate(MOCK_LISTINGS) if l["id"] == id_)), None)
        rent = next((r for l, r in zip(MOCK_LISTINGS, MOCK_RENT.values()) if l["address"] == address), list(MOCK_RENT.values())[0])
        return {**rent, "comps": [], "cached": False}

    if not RENTCAST_KEY:
        raise HTTPException(status_code=500, detail="RENTCAST_API_KEY not configured")

    params: dict = {"address": address, "propertyType": propertyType}
    if bedrooms:      params["bedrooms"] = bedrooms
    if bathrooms:     params["bathrooms"] = bathrooms
    if squareFootage: params["squareFootage"] = squareFootage

    cache_key = "rent:" + json.dumps(params, sort_keys=True)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    try:
        resp = httpx.get(f"{RENTCAST_BASE}/avm/rent/long-term", headers=HEADERS, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    rent = data.get("rent") or data.get("rentEstimate") or 0
    low  = data.get("rentRangeLow") or data.get("lowEstimate")
    high = data.get("rentRangeHigh") or data.get("highEstimate")

    result = {
        "rentEstimate": rent,
        "rentRangeLow": low,
        "rentRangeHigh": high,
        "comps": data.get("comps", [])[:5],
        "cached": False,
    }
    _cache_set(cache_key, result, RENT_TTL)
    return result
