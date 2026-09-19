from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import gemini_service
import intelligence
import demo_seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bazaarmind")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="BazaarMind API")
api = APIRouter(prefix="/api")

DEFAULT_MARKET = demo_seed.DEMO_MARKET["id"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ----------------------------- Models -----------------------------
class InterpretRequest(BaseModel):
    text: str = ""
    imageBase64: Optional[str] = None


class SignalCreate(BaseModel):
    marketId: str = DEFAULT_MARKET
    vendorId: Optional[str] = None
    vendorName: Optional[str] = None
    product: str
    signalType: str = "SUPPLY"
    availability: Optional[str] = None
    reportedPrice: Optional[float] = None
    priceUnit: Optional[str] = None
    demandLevel: Optional[str] = None
    language: str = "HINGLISH"
    rawText: str = ""
    imageUrl: Optional[str] = None
    source: str = "VENDOR"
    confidence: str = "MEDIUM"
    reasoning: str = ""


class ShoppingListRequest(BaseModel):
    text: str
    marketId: str = DEFAULT_MARKET


class AskRequest(BaseModel):
    question: str
    marketId: str = DEFAULT_MARKET


class AnalyticsEvent(BaseModel):
    event: str
    props: Dict[str, Any] = {}


# ----------------------------- Basic -----------------------------
@api.get("/")
async def root():
    return {"app": "BazaarMind", "tagline": "The Market That Thinks as One.", "model": gemini_service.GEMINI_MODEL}


@api.get("/markets")
async def get_markets():
    markets = await db.markets.find({}, {"_id": 0}).to_list(100)
    return markets


@api.get("/products")
async def get_products():
    return [{"name": p} for p in gemini_service.CANONICAL_PRODUCTS]


# ----------------------------- Market Pulse -----------------------------
@api.get("/market-pulse")
async def market_pulse(marketId: str = DEFAULT_MARKET):
    market = await db.markets.find_one({"id": marketId}, {"_id": 0})
    pulse = await intelligence.compute_market_pulse(db, marketId)
    pulse["market"] = market or {"id": marketId, "name": "Demo Market"}
    return pulse


# ----------------------------- Gemini: interpret signal -----------------------------
@api.post("/signals/interpret")
async def signals_interpret(req: InterpretRequest):
    if not req.text and not req.imageBase64:
        raise HTTPException(status_code=400, detail="Provide text or an image to interpret.")
    try:
        result = await gemini_service.interpret_signal(
            req.text, req.imageBase64, session_id=str(uuid.uuid4())
        )
        return {"ok": True, "signal": result, "live": True}
    except Exception:  # noqa
        logger.exception("interpret failed")
        return JSONResponse(
            status_code=200,
            content={"ok": False, "error": "BazaarMind couldn't interpret that right now. Please try again."},
        )


# ----------------------------- Persist signal -----------------------------
def _moderate(signal: Dict[str, Any]) -> str:
    """Basic moderation. Suspicious signals become 'pending', never auto-truth."""
    price = signal.get("reportedPrice")
    if price is not None and (price <= 0 or price > 100000):
        return "pending"
    if not signal.get("product") or signal.get("product") == "Unknown":
        return "pending"
    return "confirmed"


@api.post("/signals")
async def create_signal(req: SignalCreate):
    doc = req.model_dump()
    doc["id"] = str(uuid.uuid4())
    created = datetime.now(timezone.utc)
    doc["createdAt"] = created.isoformat()
    doc["expiresAt"] = (created + timedelta(hours=18)).isoformat()
    doc["corroborationCount"] = 1
    doc["synthetic"] = False  # a real, user-submitted signal (into the demo market)
    doc["status"] = _moderate(doc)
    await db.market_signals.insert_one({**doc})
    doc.pop("_id", None)
    return {"ok": True, "signal": doc, "published": doc["status"] == "confirmed"}


@api.get("/signals")
async def list_signals(marketId: str = DEFAULT_MARKET, limit: int = 60):
    cursor = db.market_signals.find({"marketId": marketId}, {"_id": 0}).sort("createdAt", -1).limit(limit)
    return await cursor.to_list(limit)


# ----------------------------- Shopping list -----------------------------
@api.post("/shopping-list/parse")
async def shopping_list_parse(req: ShoppingListRequest):
    try:
        parsed = await gemini_service.parse_shopping_list(req.text, session_id=str(uuid.uuid4()))
    except Exception:
        logger.exception("list parse failed")
        return JSONResponse(status_code=200, content={
            "ok": False, "error": "BazaarMind couldn't read that list right now. Please try again."})

    pulse = await intelligence.compute_market_pulse(db, req.marketId)
    pulse_map = {p["product"]: p for p in pulse["products"]}

    items = []
    tight = 0
    for it in parsed.get("items", []):
        p = pulse_map.get(it["product"])
        if p:
            status = "tight" if p["availabilityCode"] == "LOW" else "ok"
            if status == "tight":
                tight += 1
            items.append({
                "product": it["product"], "quantity": it.get("quantity"),
                "availability": p["availability"], "demand": p["demand"],
                "reportedPriceSignal": p["reportedPriceSignal"], "confidence": p["confidence"],
                "status": status, "known": True,
            })
        else:
            items.append({
                "product": it["product"], "quantity": it.get("quantity"),
                "status": "unknown", "known": False,
            })

    # Persist anonymous demand signals for known products (the flywheel)
    created = datetime.now(timezone.utc)
    demand_docs = []
    for it in items:
        if it["known"]:
            demand_docs.append({
                "id": str(uuid.uuid4()), "marketId": req.marketId, "vendorId": None, "vendorName": None,
                "product": it["product"], "signalType": "DEMAND", "availability": None,
                "reportedPrice": None, "priceUnit": None, "demandLevel": "NORMAL",
                "language": parsed.get("language", "ENGLISH"), "rawText": req.text, "imageUrl": None,
                "source": "SHOPPER", "confidence": "MEDIUM", "reasoning": "Shopper list demand signal.",
                "createdAt": created.isoformat(), "expiresAt": (created + timedelta(hours=12)).isoformat(),
                "status": "confirmed", "corroborationCount": 1, "synthetic": False,
            })
    if demand_docs:
        await db.market_signals.insert_many(demand_docs)

    summary = None
    if tight:
        summary = f"BazaarMind noticed {tight} item{'s' if tight > 1 else ''} with tighter availability today."
    return {"ok": True, "items": items, "tightCount": tight, "summary": summary,
            "language": parsed.get("language", "ENGLISH")}


# ----------------------------- Ask BazaarMind -----------------------------
@api.post("/ask-bazaar")
async def ask_bazaar(req: AskRequest):
    pulse = await intelligence.compute_market_pulse(db, req.marketId)
    market = await db.markets.find_one({"id": req.marketId}, {"_id": 0})
    market_name = market["name"] if market else "Demo Market"
    if not pulse["products"]:
        return {"ok": True, "answer": "I don't have enough signals from this market yet.", "live": True}
    context = intelligence.build_pulse_context(pulse, market_name)
    try:
        answer = await gemini_service.ask_bazaar(req.question, context, session_id=str(uuid.uuid4()))
        return {"ok": True, "answer": answer, "live": True}
    except Exception:
        logger.exception("ask failed")
        return JSONResponse(status_code=200, content={
            "ok": False, "error": "BazaarMind couldn't interpret that right now. Please try again."})


# ----------------------------- Vendor demand -----------------------------
@api.get("/vendor/demand")
async def vendor_demand(marketId: str = DEFAULT_MARKET):
    cursor = db.market_signals.find(
        {"marketId": marketId, "source": "SHOPPER", "status": "confirmed"}, {"_id": 0})
    signals = await cursor.to_list(5000)
    counts: Dict[str, int] = {}
    for s in signals:
        counts[s["product"]] = counts.get(s["product"], 0) + 1
    ranked = sorted(counts.items(), key=lambda x: -x[1])
    total = sum(counts.values())

    def level(c: int) -> str:
        if c >= 18:
            return "High interest"
        if c >= 10:
            return "Medium-high interest"
        if c >= 5:
            return "Medium interest"
        return "Normal"

    return {
        "marketId": marketId,
        "totalRequests": total,
        "products": [{"product": p, "requests": c, "level": level(c)} for p, c in ranked],
    }


# ----------------------------- Market network -----------------------------
@api.get("/market-network")
async def market_network(marketId: str = DEFAULT_MARKET):
    market = await db.markets.find_one({"id": marketId}, {"_id": 0})
    vendors = await db.vendors.find({"marketId": marketId}, {"_id": 0}).to_list(100)
    cursor = db.market_signals.find({"marketId": marketId, "status": "confirmed"}, {"_id": 0})
    signals = await cursor.to_list(5000)

    vendor_counts: Dict[str, int] = {}
    shopper_total = 0
    for s in signals:
        if s.get("source") == "VENDOR" and s.get("vendorId"):
            vendor_counts[s["vendorId"]] = vendor_counts.get(s["vendorId"], 0) + 1
        elif s.get("source") == "SHOPPER":
            shopper_total += 1

    vendor_nodes = [{
        "id": v["id"], "name": v["name"], "stall": v.get("stall"),
        "supplySignals": vendor_counts.get(v["id"], 0),
    } for v in vendors]

    return {
        "market": market or {"id": marketId, "name": "Demo Market"},
        "vendors": vendor_nodes,
        "shopperSignals": shopper_total,
        "supplySignals": sum(vendor_counts.values()),
        "synthetic": True,
    }


# ----------------------------- Snapshots -----------------------------
@api.get("/snapshots")
async def snapshots(marketId: str = DEFAULT_MARKET):
    snaps = await db.market_snapshots.find({"marketId": marketId}, {"_id": 0}).to_list(50)
    order = {"Today": 0, "Yesterday": 1, "7 days ago": 2}
    snaps.sort(key=lambda s: order.get(s.get("label"), 99))
    return {"snapshots": snaps, "synthetic": True}


# ----------------------------- Pilot metrics -----------------------------
@api.get("/pilot/metrics")
async def pilot_metrics():
    return {
        "setup": {
            "community": 1, "market": 1, "vendors": "10–15",
            "households": "20–50", "durationDays": 14,
        },
        "metrics": [
            {"name": "Shopper activation", "target": "60% of onboarded households", "status": "Awaiting pilot data"},
            {"name": "Repeat usage (weekly)", "target": "2–4 visits/week", "status": "Awaiting pilot data"},
            {"name": "7-day retention", "target": "≥ 40%", "status": "Awaiting pilot data"},
            {"name": "Market Pulse views", "target": "1 per shopper per market day", "status": "Awaiting pilot data"},
            {"name": "Shopping-list queries", "target": "≥ 3 per active shopper/week", "status": "Awaiting pilot data"},
            {"name": "Vendor signal frequency", "target": "≥ 1 signal/vendor/day", "status": "Awaiting pilot data"},
            {"name": "Vendor retention", "target": "≥ 60% at day 14", "status": "Awaiting pilot data"},
            {"name": "Signal corroboration", "target": "≥ 3 sources per key product", "status": "Awaiting pilot data"},
            {"name": "Perceived usefulness", "target": "Qualitative interviews", "status": "Awaiting pilot data"},
            {"name": "Willingness to pay", "target": "Validate via interviews", "status": "Awaiting pilot data"},
        ],
    }


# ----------------------------- Analytics -----------------------------
@api.post("/analytics/event")
async def analytics_event(evt: AnalyticsEvent):
    await db.analytics_events.insert_one({
        "id": str(uuid.uuid4()), "event": evt.event, "props": evt.props, "at": now_iso(),
    })
    return {"ok": True}


@api.get("/analytics/summary")
async def analytics_summary():
    pipeline = [{"$group": {"_id": "$event", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    rows = await db.analytics_events.aggregate(pipeline).to_list(100)
    return {"events": [{"event": r["_id"], "count": r["count"]} for r in rows]}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await demo_seed.seed_if_empty(db)
    logger.info("BazaarMind ready. Model=%s", gemini_service.GEMINI_MODEL)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
