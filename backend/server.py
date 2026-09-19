import os
import uuid
import math
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Query, UploadFile, File, Header, BackgroundTasks
from fastapi.responses import JSONResponse, PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import gemini_service
import intelligence
import demo_seed
import whatsapp_service
import voice_service
import conversation

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bazaarmind")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")

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
    participantId: Optional[str] = None
    dataSource: Optional[str] = None


class ShoppingListRequest(BaseModel):
    text: str
    marketId: str = DEFAULT_MARKET
    participantId: Optional[str] = None


class AskRequest(BaseModel):
    question: str
    marketId: str = DEFAULT_MARKET
    dataSource: str = "DEMO"


class AnalyticsEvent(BaseModel):
    event: str
    props: Dict[str, Any] = {}


class OnboardShopper(BaseModel):
    name: Optional[str] = None
    community: str
    marketId: str = DEFAULT_MARKET
    language: str = "HINGLISH"
    consent: bool = False


class OnboardVendor(BaseModel):
    name: Optional[str] = None
    stall: Optional[str] = None
    category: Optional[str] = None
    marketId: str = DEFAULT_MARKET
    language: str = "HINGLISH"
    consent: bool = False
    signalMethod: str = "text"


def _resolve_source(participant_id: Optional[str], explicit: Optional[str]) -> str:
    if explicit in ("DEMO", "PILOT", "REAL"):
        return explicit
    return "PILOT" if participant_id else "DEMO"


async def _resolve_source_async(participant_id: Optional[str], explicit: Optional[str]) -> str:
    if explicit in ("DEMO", "PILOT", "REAL"):
        return explicit
    if participant_id:
        exists = await db.pilot_participants.find_one({"id": participant_id}, {"_id": 1})
        return "PILOT" if exists else "DEMO"
    return "DEMO"


# ----------------------------- Basic -----------------------------
@api.get("/")
async def root():
    return {"app": "BazaarMind", "tagline": "The Market That Thinks as One.", "model": gemini_service.GEMINI_MODEL}


@api.get("/markets")
async def get_markets():
    return await db.markets.find({}, {"_id": 0}).to_list(100)


@api.get("/markets/nearby")
async def markets_nearby(lat: float = Query(...), lng: float = Query(...)):
    markets = await db.markets.find({}, {"_id": 0}).to_list(100)

    def haversine(a_lat, a_lng, b_lat, b_lng):
        R = 6371.0
        d_lat = math.radians(b_lat - a_lat)
        d_lng = math.radians(b_lng - a_lng)
        h = (math.sin(d_lat / 2) ** 2 + math.cos(math.radians(a_lat)) *
             math.cos(math.radians(b_lat)) * math.sin(d_lng / 2) ** 2)
        return round(2 * R * math.asin(math.sqrt(h)), 1)

    out = []
    for m in markets:
        if m.get("lat") is not None and m.get("lng") is not None:
            m["distanceKm"] = haversine(lat, lng, m["lat"], m["lng"])
        else:
            m["distanceKm"] = None
        out.append(m)
    out.sort(key=lambda x: (x["distanceKm"] is None, x["distanceKm"] or 0))
    return out


@api.get("/products")
async def get_products():
    return [{"name": p} for p in gemini_service.CANONICAL_PRODUCTS]


# ----------------------------- Market Pulse -----------------------------
@api.get("/market-pulse")
async def market_pulse(marketId: str = DEFAULT_MARKET, dataSource: str = "DEMO"):
    market = await db.markets.find_one({"id": marketId}, {"_id": 0})
    pulse = await intelligence.compute_market_pulse(db, marketId, data_source=dataSource)
    pulse["market"] = market or {"id": marketId, "name": "Demo Market"}
    pulse["dataSource"] = dataSource
    return pulse


# ----------------------------- Gemini: interpret signal -----------------------------
@api.post("/signals/interpret")
async def signals_interpret(req: InterpretRequest):
    if not req.text and not req.imageBase64:
        raise HTTPException(status_code=400, detail="Provide text or an image to interpret.")
    try:
        result = await gemini_service.interpret_signal(req.text, req.imageBase64, session_id=str(uuid.uuid4()))
        return {"ok": True, "signal": result, "live": True}
    except Exception:
        logger.exception("interpret failed")
        return JSONResponse(status_code=200, content={"ok": False, "error": "BazaarMind couldn't interpret that right now. Please try again."})


# ----------------------------- Persist signal -----------------------------
def _moderate(signal: Dict[str, Any]) -> str:
    price = signal.get("reportedPrice")
    if price is not None and (price <= 0 or price > 100000):
        return "pending"
    if not signal.get("product") or signal.get("product") == "Unknown":
        return "pending"
    return "confirmed"


@api.post("/signals")
async def create_signal(req: SignalCreate):
    doc = req.model_dump()
    participant_id = doc.pop("participantId", None)
    explicit = doc.pop("dataSource", None)
    doc["dataSource"] = await _resolve_source_async(participant_id, explicit)
    doc["participantId"] = participant_id
    doc["id"] = str(uuid.uuid4())
    created = datetime.now(timezone.utc)
    doc["createdAt"] = created.isoformat()
    doc["expiresAt"] = (created + timedelta(hours=18)).isoformat()
    doc["corroborationCount"] = 1
    doc["synthetic"] = doc["dataSource"] == "DEMO"
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
        return JSONResponse(status_code=200, content={"ok": False, "error": "BazaarMind couldn't read that list right now. Please try again."})

    data_source = await _resolve_source_async(req.participantId, None)
    pulse = await intelligence.compute_market_pulse(db, req.marketId, data_source=data_source)
    pulse_map = {p["product"]: p for p in pulse["products"]}

    items, tight = [], 0
    for it in parsed.get("items", []):
        p = pulse_map.get(it["product"])
        if p:
            status = "tight" if p["availabilityCode"] == "LOW" else "ok"
            if status == "tight":
                tight += 1
            items.append({"product": it["product"], "quantity": it.get("quantity"),
                          "availability": p["availability"], "demand": p["demand"],
                          "reportedPriceSignal": p["reportedPriceSignal"], "confidence": p["confidence"],
                          "status": status, "known": True})
        else:
            items.append({"product": it["product"], "quantity": it.get("quantity"), "status": "unknown", "known": False})

    created = datetime.now(timezone.utc)
    demand_docs = []
    for it in items:
        if it["known"]:
            demand_docs.append({
                "id": str(uuid.uuid4()), "marketId": req.marketId, "vendorId": None, "vendorName": None,
                "product": it["product"], "signalType": "DEMAND", "availability": None, "reportedPrice": None,
                "priceUnit": None, "demandLevel": "NORMAL", "language": parsed.get("language", "ENGLISH"),
                "rawText": req.text, "imageUrl": None, "source": "SHOPPER", "confidence": "MEDIUM",
                "reasoning": "Shopper list demand signal.", "createdAt": created.isoformat(),
                "expiresAt": (created + timedelta(hours=12)).isoformat(), "status": "confirmed",
                "corroborationCount": 1, "synthetic": data_source == "DEMO", "dataSource": data_source,
                "participantId": req.participantId,
            })
    if demand_docs:
        await db.market_signals.insert_many(demand_docs)

    await db.shopping_lists.insert_one({
        "id": str(uuid.uuid4()), "marketId": req.marketId, "rawText": req.text,
        "items": [i["product"] for i in items], "dataSource": data_source,
        "participantId": req.participantId, "createdAt": created.isoformat(),
    })

    summary = f"BazaarMind noticed {tight} item{'s' if tight > 1 else ''} with tighter availability today." if tight else None
    return {"ok": True, "items": items, "tightCount": tight, "summary": summary, "language": parsed.get("language", "ENGLISH")}


# ----------------------------- Ask BazaarMind -----------------------------
@api.post("/ask-bazaar")
async def ask_bazaar(req: AskRequest):
    pulse = await intelligence.compute_market_pulse(db, req.marketId, data_source=req.dataSource)
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
        return JSONResponse(status_code=200, content={"ok": False, "error": "BazaarMind couldn't interpret that right now. Please try again."})


# ----------------------------- Voice (Whisper STT) -----------------------------
@api.get("/voice/status")
async def voice_status():
    return {"configured": voice_service.is_configured(), "model": voice_service.WHISPER_MODEL,
            "label": "Live speech-to-text (Whisper)" if voice_service.is_configured() else "Speech-to-text unavailable"}


@api.post("/voice/transcribe")
async def voice_transcribe(audio: UploadFile = File(...)):
    if not voice_service.is_configured():
        return JSONResponse(status_code=200, content={"ok": False, "error": "Speech-to-text is not configured in this environment."})
    try:
        content = await audio.read()
        transcript = await voice_service.transcribe_audio(content, audio.filename or "audio.webm")
        return {"ok": True, "transcript": transcript, "live": True}
    except Exception:
        logger.exception("transcription failed")
        return JSONResponse(status_code=200, content={"ok": False, "error": "BazaarMind couldn't transcribe that audio. Please try again."})


# ----------------------------- Vendor demand -----------------------------
@api.get("/vendor/demand")
async def vendor_demand(marketId: str = DEFAULT_MARKET, dataSource: str = "DEMO"):
    cursor = db.market_signals.find({"marketId": marketId, "source": "SHOPPER", "status": "confirmed", "dataSource": dataSource}, {"_id": 0})
    signals = await cursor.to_list(5000)
    counts: Dict[str, int] = {}
    for s in signals:
        counts[s["product"]] = counts.get(s["product"], 0) + 1
    ranked = sorted(counts.items(), key=lambda x: -x[1])
    total = sum(counts.values())

    def level(c):
        if c >= 18: return "High interest"
        if c >= 10: return "Medium-high interest"
        if c >= 5: return "Medium interest"
        return "Normal"

    return {"marketId": marketId, "totalRequests": total,
            "products": [{"product": p, "requests": c, "level": level(c)} for p, c in ranked]}


# ----------------------------- Market network -----------------------------
@api.get("/market-network")
async def market_network(marketId: str = DEFAULT_MARKET, dataSource: str = "DEMO"):
    market = await db.markets.find_one({"id": marketId}, {"_id": 0})
    vendors = await db.vendors.find({"marketId": marketId}, {"_id": 0}).to_list(100)
    cursor = db.market_signals.find({"marketId": marketId, "status": "confirmed", "dataSource": dataSource}, {"_id": 0})
    signals = await cursor.to_list(5000)

    vendor_counts: Dict[str, int] = {}
    shopper_total = 0
    for s in signals:
        if s.get("source") == "VENDOR" and s.get("vendorId"):
            vendor_counts[s["vendorId"]] = vendor_counts.get(s["vendorId"], 0) + 1
        elif s.get("source") == "SHOPPER":
            shopper_total += 1

    vendor_nodes = [{"id": v["id"], "name": v["name"], "stall": v.get("stall"),
                     "supplySignals": vendor_counts.get(v["id"], 0)} for v in vendors]
    return {"market": market or {"id": marketId, "name": "Demo Market"}, "vendors": vendor_nodes,
            "shopperSignals": shopper_total, "supplySignals": sum(vendor_counts.values()), "dataSource": dataSource}


# ----------------------------- Snapshots -----------------------------
@api.get("/snapshots")
async def snapshots(marketId: str = DEFAULT_MARKET):
    snaps = await db.market_snapshots.find({"marketId": marketId}, {"_id": 0}).to_list(50)
    order = {"Today": 0, "Yesterday": 1, "7 days ago": 2}
    snaps.sort(key=lambda s: order.get(s.get("label"), 99))
    return {"snapshots": snaps, "synthetic": True, "label": "Demo historical data"}


@api.post("/snapshots/capture")
async def snapshots_capture(marketId: str = DEFAULT_MARKET, dataSource: str = "DEMO"):
    pulse = await intelligence.compute_market_pulse(db, marketId, data_source=dataSource)
    if not pulse["products"]:
        return {"ok": False, "reason": "No signals to snapshot for this market/data source yet."}
    doc = await intelligence.capture_snapshot(db, marketId, dataSource)
    return {"ok": True, "snapshot": doc}


@api.get("/snapshots/history")
async def snapshots_history(marketId: str = DEFAULT_MARKET, dataSource: str = "DEMO"):
    cursor = db.snapshot_history.find({"marketId": marketId, "dataSource": dataSource}, {"_id": 0}).sort("capturedAt", -1).limit(14)
    history = await cursor.to_list(14)
    comparison = await intelligence.compare_snapshots(db, marketId, dataSource)
    return {"history": history, "comparison": comparison, "dataSource": dataSource}


# ----------------------------- Pilot -----------------------------
@api.get("/pilot/metrics")
async def pilot_metrics():
    return {
        "setup": {"community": 1, "market": 1, "vendors": "10–15", "households": "20–50", "durationDays": 14},
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


@api.post("/pilot/onboard/shopper")
async def onboard_shopper(req: OnboardShopper):
    if not req.consent:
        raise HTTPException(status_code=400, detail="Consent is required to join the pilot.")
    doc = {"id": str(uuid.uuid4()), "role": "shopper", **req.model_dump(), "createdAt": now_iso()}
    await db.pilot_participants.insert_one({**doc})
    doc.pop("_id", None)
    return {"ok": True, "participant": doc}


@api.post("/pilot/onboard/vendor")
async def onboard_vendor(req: OnboardVendor):
    if not req.consent:
        raise HTTPException(status_code=400, detail="Consent is required to join the pilot.")
    doc = {"id": str(uuid.uuid4()), "role": "vendor", **req.model_dump(), "createdAt": now_iso()}
    await db.pilot_participants.insert_one({**doc})
    doc.pop("_id", None)
    return {"ok": True, "participant": doc}


@api.get("/pilot/status")
async def pilot_status(marketId: str = DEFAULT_MARKET):
    households = await db.pilot_participants.count_documents({"role": "shopper"})
    vendors = await db.pilot_participants.count_documents({"role": "vendor"})
    pilot_signals = await db.market_signals.count_documents({"dataSource": "PILOT"})
    pilot_lists = await db.shopping_lists.count_documents({"dataSource": "PILOT"})
    pulse_views = await db.analytics_events.count_documents({"event": "market_pulse_viewed"})
    has_pilot = households > 0 or vendors > 0
    AWAIT = "Awaiting pilot data"
    return {
        "hasPilotData": has_pilot,
        "environment": "PILOT" if has_pilot else "DEMO",
        "target": {"households": "20–50", "vendors": "10–15", "durationDays": 14},
        "metrics": [
            {"name": "Households joined", "value": households, "display": households if has_pilot else AWAIT},
            {"name": "Vendors joined", "value": vendors, "display": vendors if has_pilot else AWAIT},
            {"name": "Signals contributed", "value": pilot_signals, "display": pilot_signals if has_pilot else AWAIT},
            {"name": "Shopping lists created", "value": pilot_lists, "display": pilot_lists if has_pilot else AWAIT},
            {"name": "Market Pulse views", "value": pulse_views, "display": pulse_views if has_pilot else AWAIT},
            {"name": "Vendor participation", "value": vendors, "display": f"{vendors} vendors" if has_pilot else AWAIT},
            {"name": "Signal corroboration", "value": pilot_signals, "display": f"{pilot_signals} signals" if has_pilot else AWAIT},
        ],
    }


# ----------------------------- WhatsApp (integration-ready) -----------------------------
@api.get("/whatsapp/status")
async def whatsapp_status():
    return whatsapp_service.status()


@api.get("/whatsapp/webhook")
async def whatsapp_verify(request: Request):
    if not whatsapp_service.is_configured():
        raise HTTPException(status_code=503, detail="integration ready — production credentials required")
    params = request.query_params
    challenge = whatsapp_service.verify_challenge(
        params.get("hub.mode", ""), params.get("hub.verify_token", ""), params.get("hub.challenge", ""))
    if challenge is not None:
        return PlainTextResponse(content=challenge, status_code=200)
    raise HTTPException(status_code=403, detail="verification failed")


@api.post("/whatsapp/webhook")
async def whatsapp_inbound(request: Request):
    if not whatsapp_service.is_configured():
        raise HTTPException(status_code=503, detail="integration ready — production credentials required")
    raw = await request.body()
    if not whatsapp_service.valid_signature(raw, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(status_code=401, detail="invalid signature")
    import json
    event = json.loads(raw)
    for from_number, text, wamid in whatsapp_service.extract_text_messages(event):
        existing = await db.messages.find_one({"wamid": wamid})
        if existing:
            continue
        await db.messages.insert_one({"id": str(uuid.uuid4()), "wamid": wamid, "conversationId": from_number,
                                      "direction": "inbound", "text": text, "channel": "whatsapp", "at": now_iso()})
        result = await conversation.process_message(db, text, DEFAULT_MARKET, role="shopper")
        reply = result.get("reply", "")
        send = await whatsapp_service.send_text(from_number, reply)
        await db.messages.insert_one({"id": str(uuid.uuid4()), "conversationId": from_number, "direction": "outbound",
                                      "text": reply, "channel": "whatsapp", "sent": send.get("sent"), "at": now_iso()})
    return {"received": True}


# ----------------------------- Analytics -----------------------------
@api.post("/analytics/event")
async def analytics_event(evt: AnalyticsEvent):
    await db.analytics_events.insert_one({"id": str(uuid.uuid4()), "event": evt.event, "props": evt.props, "at": now_iso()})
    return {"ok": True}


@api.get("/analytics/summary")
async def analytics_summary():
    pipeline = [{"$group": {"_id": "$event", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    rows = await db.analytics_events.aggregate(pipeline).to_list(100)
    return {"events": [{"event": r["_id"], "count": r["count"]} for r in rows]}


# ----------------------------- Cron -----------------------------
async def _capture_all_snapshots():
    markets = await db.markets.find({}, {"_id": 0, "id": 1}).to_list(100)
    for m in markets:
        for src in ("DEMO", "PILOT"):
            try:
                pulse = await intelligence.compute_market_pulse(db, m["id"], data_source=src)
                if pulse["products"]:
                    await intelligence.capture_snapshot(db, m["id"], src)
            except Exception:
                logger.exception("snapshot capture failed for %s/%s", m["id"], src)


@api.post("/cron/capture-snapshot")
async def cron_capture_snapshot(background: BackgroundTasks, authorization: str = Header(None), x_webhook_id: str = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization.split(" ", 1)[1]
    if not WEBHOOK_CRON_SECRET or token != WEBHOOK_CRON_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")
    background.add_task(_capture_all_snapshots)
    return {"ok": True, "accepted": True, "runId": x_webhook_id}


app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await demo_seed.seed_if_empty(db)
    logger.info("BazaarMind ready. Gemini=%s WhatsApp configured=%s Voice=%s",
                gemini_service.GEMINI_MODEL, whatsapp_service.is_configured(), voice_service.is_configured())


@app.on_event("shutdown")
async def _shutdown():
    client.close()
