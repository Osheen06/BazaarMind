"""Synthetic demo dataset for BazaarMind.

Everything here is clearly-labelled SYNTHETIC demo data used to demonstrate the
product. It is generated as real MarketSignal documents so the intelligence
engine operates on the same shape it would use with real pilot data.

No fabricated real-world traction, testimonials, users, or pilot results.
"""
import uuid
from datetime import datetime, timezone, timedelta

DEMO_MARKET = {
    "id": "demo-ina",
    "name": "INA Market",
    "area": "South Delhi, Delhi NCR",
    "community": "Green Meadows RWA (demo community)",
    "lat": 28.5687,
    "lng": 77.2094,
    "synthetic": True,
}

# Extra markets for location-based discovery (no seeded signals — discovery only)
EXTRA_MARKETS = [
    {"id": "demo-sarojini", "name": "Sarojini Nagar Market", "area": "South West Delhi, Delhi NCR",
     "community": "Sarojini RWA (demo)", "lat": 28.5775, "lng": 77.1969, "synthetic": True},
    {"id": "demo-ghazipur", "name": "Ghazipur Mandi", "area": "East Delhi, Delhi NCR",
     "community": "Kondli RWA (demo)", "lat": 28.6255, "lng": 77.3255, "synthetic": True},
]

DEMO_VENDORS = [
    {"id": "v1", "name": "Ramesh Sabzi Wala", "stall": "Stall 3"},
    {"id": "v2", "name": "Anita Vegetables", "stall": "Stall 7"},
    {"id": "v3", "name": "Khan Fresh Produce", "stall": "Stall 11"},
    {"id": "v4", "name": "Gupta Fruit Corner", "stall": "Stall 14"},
    {"id": "v5", "name": "Sunita Hari Sabzi", "stall": "Stall 18"},
    {"id": "v6", "name": "Delhi Mandi Supply", "stall": "Stall 22"},
    {"id": "v7", "name": "Verma Vegetables", "stall": "Stall 5"},
    {"id": "v8", "name": "Fresh Roots", "stall": "Stall 9"},
]

DEMO_PRODUCTS = [
    {"name": "Tomatoes", "hindi": "टमाटर"},
    {"name": "Potatoes", "hindi": "आलू"},
    {"name": "Onions", "hindi": "प्याज"},
    {"name": "Coriander", "hindi": "धनिया"},
    {"name": "Bananas", "hindi": "केला"},
    {"name": "Green Chilies", "hindi": "हरी मिर्च"},
    {"name": "Carrots", "hindi": "गाजर"},
    {"name": "Spinach", "hindi": "पालक"},
]

# product -> (availability, demand, price_low, price_high, unit, vendor_obs, shopper_signals)
_SPEC = {
    "Tomatoes":      ("LOW", "HIGH", 55, 60, "kg", 7, 23),
    "Potatoes":      ("HIGH", "NORMAL", 24, 26, "kg", 6, 9),
    "Onions":        ("HIGH", "NORMAL", 30, 35, "kg", 5, 18),
    "Coriander":     ("LOW", "HIGH", 20, 30, "bunch", 4, 14),
    "Bananas":       ("NORMAL", "NORMAL", 50, 60, "dozen", 3, 6),
    "Green Chilies": ("LOW", "HIGH", 80, 100, "kg", 4, 11),
    "Carrots":       ("HIGH", "NORMAL", 38, 42, "kg", 3, 5),
    "Spinach":       ("LOW", "HIGH", 20, 30, "bunch", 3, 12),
}

_VENDOR_TEXTS = {
    "Tomatoes": ["Aaj tamatar thoda kam aaya hai, rate bhi upar hai",
                 "Tomato stock tight today, mandi se kam supply",
                 "टमाटर आज महंगा है, माल कम है"],
    "Potatoes": ["Aloo bahut hai aaji, rate stable", "Potato supply good, no issue"],
    "Onions": ["Pyaz achha stock hai", "Onion normal chal raha hai aaj"],
    "Coriander": ["Dhaniya aaj kam hai, jaldi khatam ho jayega", "धनिया थोड़ा कम है आज"],
    "Bananas": ["Kela normal hai aaj", "Banana stock theek hai"],
    "Green Chilies": ["Hari mirch kam aayi hai, rate zyada", "Green chili tight today"],
    "Carrots": ["Gajar achha maal hai", "Carrot supply fine"],
    "Spinach": ["Palak aaj kam hai", "Spinach limited, fresh lot subah aaya tha"],
}


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _build_signals():
    now = datetime.now(timezone.utc)
    signals = []
    for prod in DEMO_PRODUCTS:
        name = prod["name"]
        avail, demand, plo, phi, unit, vobs, sobs = _SPEC[name]
        texts = _VENDOR_TEXTS.get(name, [f"{name} update"])
        # vendor supply/price/availability observations
        for i in range(vobs):
            vendor = DEMO_VENDORS[i % len(DEMO_VENDORS)]
            created = now - timedelta(minutes=18 + i * 27)
            price = None
            if plo is not None:
                price = plo + (phi - plo) * (i % 3) / 2 if phi != plo else plo
                price = round(price)
            signals.append({
                "id": str(uuid.uuid4()),
                "marketId": DEMO_MARKET["id"],
                "vendorId": vendor["id"],
                "vendorName": vendor["name"],
                "product": name,
                "signalType": "SUPPLY" if price is None else "PRICE",
                "availability": avail,
                "reportedPrice": price,
                "priceUnit": unit if price is not None else None,
                "demandLevel": None,
                "language": "HINGLISH",
                "rawText": texts[i % len(texts)],
                "imageUrl": None,
                "source": "VENDOR",
                "confidence": "MEDIUM",
                "reasoning": "Synthetic demo vendor observation.",
                "createdAt": _iso(created),
                "expiresAt": _iso(created + timedelta(hours=18)),
                "status": "confirmed",
                "corroborationCount": vobs,
                "synthetic": True,
                "dataSource": "DEMO",
            })
        # anonymous shopper demand signals
        for j in range(sobs):
            created = now - timedelta(minutes=5 + j * 11)
            signals.append({
                "id": str(uuid.uuid4()),
                "marketId": DEMO_MARKET["id"],
                "vendorId": None,
                "vendorName": None,
                "product": name,
                "signalType": "DEMAND",
                "availability": None,
                "reportedPrice": None,
                "priceUnit": None,
                "demandLevel": demand,
                "language": "ENGLISH",
                "rawText": f"Shopper wants {name.lower()}",
                "imageUrl": None,
                "source": "SHOPPER",
                "confidence": "MEDIUM",
                "reasoning": "Synthetic demo shopper demand signal.",
                "createdAt": _iso(created),
                "expiresAt": _iso(created + timedelta(hours=12)),
                "status": "confirmed",
                "corroborationCount": sobs,
                "synthetic": True,
                "dataSource": "DEMO",
            })
    return signals


def _build_snapshots():
    now = datetime.now(timezone.utc)
    return [
        {
            "id": "snap-today", "marketId": DEMO_MARKET["id"], "label": "Today",
            "capturedAt": _iso(now), "synthetic": True,
            "changes": [
                {"product": "Tomatoes", "field": "availability", "from": "Normal", "to": "Tight"},
                {"product": "Coriander", "field": "demand", "from": "Normal", "to": "Elevated"},
                {"product": "Green Chilies", "field": "availability", "from": "Normal", "to": "Tight"},
            ],
        },
        {
            "id": "snap-yesterday", "marketId": DEMO_MARKET["id"], "label": "Yesterday",
            "capturedAt": _iso(now - timedelta(days=1)), "synthetic": True,
            "changes": [
                {"product": "Onions", "field": "price", "from": "₹28/kg", "to": "₹32/kg"},
                {"product": "Spinach", "field": "availability", "from": "Good", "to": "Limited"},
            ],
        },
        {
            "id": "snap-7d", "marketId": DEMO_MARKET["id"], "label": "7 days ago",
            "capturedAt": _iso(now - timedelta(days=7)), "synthetic": True,
            "changes": [
                {"product": "Tomatoes", "field": "price", "from": "₹40/kg", "to": "₹48/kg"},
                {"product": "Bananas", "field": "demand", "from": "Low", "to": "Normal"},
            ],
        },
    ]


_AVAIL_DISP = {"HIGH": "Good", "NORMAL": "Normal", "LOW": "Tight", "UNKNOWN": "Unknown"}
_DEMAND_DISP = {"HIGH": "Elevated", "NORMAL": "Normal", "LOW": "Low", "UNKNOWN": "Unknown"}


def _build_snapshot_history():
    """7 days of DEMO snapshot bundles so week-long trends render (clearly synthetic)."""
    now = datetime.now(timezone.utc)
    docs = []
    for d in range(6, -1, -1):
        i = 6 - d  # 0 (7d ago) .. 6 (today)
        captured = now - timedelta(days=d, hours=2)
        products = []
        for prod in DEMO_PRODUCTS:
            name = prod["name"]
            avail, demand, plo, phi, unit, vobs, sobs = _SPEC[name]
            # gentle rising price trend across the week
            factor = 0.9 + 0.03 * i
            lo = round(plo * factor) if plo is not None else None
            hi = round(phi * factor) if phi is not None else None
            av = avail
            if name == "Tomatoes":
                av = "NORMAL" if i < 4 else "LOW"
            elif name == "Coriander":
                av = "NORMAL" if i < 5 else "LOW"
            price_signal = (f"₹{lo}/{unit}" if lo == hi else f"₹{lo}–₹{hi}/{unit}") if lo is not None else None
            products.append({
                "product": name, "availability": _AVAIL_DISP.get(av, "Unknown"),
                "demand": _DEMAND_DISP.get(demand, "Normal"), "reportedPriceSignal": price_signal,
                "priceLow": lo, "priceHigh": hi, "confidence": "Medium",
                "signalCount": vobs + sobs, "vendorObservations": vobs, "shopperSignals": sobs,
            })
        docs.append({
            "id": f"{DEMO_MARKET['id']}-DEMO-hist-{i}", "marketId": DEMO_MARKET["id"],
            "dataSource": "DEMO", "capturedAt": captured.isoformat(),
            "overallConfidence": "Medium", "totalSignals": 133, "products": products,
        })
    return docs


async def seed_if_empty(db):
    existing = await db.markets.count_documents({})
    if existing == 0:
        await db.markets.insert_one({**DEMO_MARKET})
        await db.markets.insert_many([{**m} for m in EXTRA_MARKETS])
        await db.vendors.insert_many([{**v, "marketId": DEMO_MARKET["id"]} for v in DEMO_VENDORS])
        await db.products.insert_many([{**p, "id": p["name"].lower().replace(" ", "-")} for p in DEMO_PRODUCTS])

    sig_count = await db.market_signals.count_documents({"synthetic": True})
    if sig_count == 0:
        await db.market_signals.insert_many(_build_signals())

    snap_count = await db.market_snapshots.count_documents({})
    if snap_count == 0:
        await db.market_snapshots.insert_many(_build_snapshots())

    hist_count = await db.snapshot_history.count_documents({"dataSource": "DEMO"})
    if hist_count == 0:
        await db.snapshot_history.insert_many(_build_snapshot_history())
