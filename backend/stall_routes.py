import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.astimezone(timezone.utc).isoformat()


def _haversine_km(lat1, lng1, lat2, lng2):
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(min(1.0, a)))


class VendorLocationOn(BaseModel):
    marketId: str
    vendorId: str
    participantId: Optional[str] = None
    vendorName: Optional[str] = None
    stallName: Optional[str] = None
    lat: float
    lng: float
    accuracyMeters: Optional[float] = Field(default=None, ge=0)
    dataSource: str = "DEMO"
    durationMinutes: int = Field(default=480, ge=15, le=720)


class VendorLocationOff(BaseModel):
    vendorId: str
    marketId: str
    dataSource: str = "DEMO"


def build_router(db):
    router = APIRouter()

    async def validate_source(data_source):
        if data_source not in ("DEMO", "PILOT", "REAL"):
            raise HTTPException(400, "Invalid data source.")
        return data_source

    @router.post("/vendor/location/on")
    async def vendor_location_on(req: VendorLocationOn):
        source = await validate_source(req.dataSource)

        if not (-90 <= req.lat <= 90 and -180 <= req.lng <= 180):
            raise HTTPException(400, "Invalid latitude or longitude.")

        market = await db.markets.find_one({"id": req.marketId}, {"_id": 0})
        if not market:
            raise HTTPException(404, "Market not found.")

        if source == "PILOT":
            if not req.participantId:
                raise HTTPException(400, "A pilot vendor participant is required.")
            participant = await db.pilot_participants.find_one(
                {"id": req.participantId, "role": "vendor", "marketId": req.marketId},
                {"_id": 0},
            )
            if not participant:
                raise HTTPException(403, "Vendor is not onboarded for this market.")

        # Do not accept a vendor location wildly outside the selected market.
        mlat = market.get("lat")
        mlng = market.get("lng")
        if mlat is not None and mlng is not None:
            market_distance = _haversine_km(
                req.lat, req.lng, float(mlat), float(mlng)
            )
            if market_distance > 5.0:
                raise HTTPException(
                    400,
                    "Your device is more than 5 km from the selected market. "
                    "Select the correct market before turning on stall location.",
                )

        expires = _now() + timedelta(minutes=req.durationMinutes)

        # One active location per vendor/source/market.
        await db.vendor_locations.update_many(
            {
                "vendorId": req.vendorId,
                "marketId": req.marketId,
                "dataSource": source,
            },
            {"$set": {"active": False, "updatedAt": _iso(_now())}},
        )

        doc = {
            "id": str(uuid.uuid4()),
            "vendorId": req.vendorId,
            "participantId": req.participantId,
            "marketId": req.marketId,
            "vendorName": req.vendorName or "BazaarMind Vendor",
            "stallName": req.stallName or req.vendorName or "Vendor stall",
            "lat": req.lat,
            "lng": req.lng,
            "accuracyMeters": req.accuracyMeters,
            "dataSource": source,
            "synthetic": source == "DEMO",
            "active": True,
            "activatedAt": _iso(_now()),
            "expiresAt": _iso(expires),
            "updatedAt": _iso(_now()),
        }

        await db.vendor_locations.insert_one(doc)

        return {
            "ok": True,
            "location": {k: v for k, v in doc.items() if k != "_id"},
            "message": "Your stall location is now visible to nearby BazaarMind shoppers.",
        }

    @router.post("/vendor/location/off")
    async def vendor_location_off(req: VendorLocationOff):
        source = await validate_source(req.dataSource)
        result = await db.vendor_locations.update_many(
            {
                "vendorId": req.vendorId,
                "marketId": req.marketId,
                "dataSource": source,
                "active": True,
            },
            {"$set": {"active": False, "updatedAt": _iso(_now())}},
        )
        return {"ok": True, "deactivated": result.modified_count}

    @router.get("/vendor/location/status")
    async def vendor_location_status(
        vendorId: str = Query(...),
        marketId: str = Query(...),
        dataSource: str = Query("DEMO"),
    ):
        source = await validate_source(dataSource)
        doc = await db.vendor_locations.find_one(
            {
                "vendorId": vendorId,
                "marketId": marketId,
                "dataSource": source,
                "active": True,
                "expiresAt": {"$gt": _iso(_now())},
            },
            {"_id": 0},
            sort=[("activatedAt", -1)],
        )
        return {"ok": True, "active": bool(doc), "location": doc}

    @router.get("/vendors/nearby")
    async def vendors_nearby(
        lat: float = Query(...),
        lng: float = Query(...),
        marketId: str = Query(...),
        dataSource: str = Query("DEMO"),
        radiusKm: float = Query(2.0, ge=0.05, le=10.0),
        product: Optional[str] = Query(None),
    ):
        source = await validate_source(dataSource)

        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise HTTPException(400, "Invalid latitude or longitude.")

        now = _iso(_now())
        locations = await db.vendor_locations.find(
            {
                "marketId": marketId,
                "dataSource": source,
                "active": True,
                "expiresAt": {"$gt": now},
            },
            {"_id": 0},
        ).to_list(200)

        results = []
        for loc in locations:
            distance = _haversine_km(
                lat, lng, float(loc["lat"]), float(loc["lng"])
            )
            if distance > radiusKm:
                continue

            signal_query = {
                "marketId": marketId,
                "vendorId": loc["vendorId"],
                "source": "VENDOR",
                "status": "confirmed",
                "dataSource": source,
                "expiresAt": {"$gt": now},
            }
            if product:
                signal_query["product"] = product

            signals = await db.market_signals.find(
                signal_query,
                {"_id": 0},
            ).sort("createdAt", -1).limit(30).to_list(30)

            offers = []
            seen = set()
            for signal in signals:
                product_name = signal.get("product")
                if not product_name or product_name in seen:
                    continue
                seen.add(product_name)
                offers.append({
                    "product": product_name,
                    "reportedPrice": signal.get("reportedPrice"),
                    "priceUnit": signal.get("priceUnit"),
                    "availability": signal.get("availability"),
                    "signalType": signal.get("signalType"),
                    "confidence": signal.get("confidence"),
                    "updatedAt": signal.get("createdAt"),
                    "updatedMinutesAgo": max(
                        0,
                        round((_now() - datetime.fromisoformat(signal["createdAt"])).total_seconds() / 60),
                    ) if signal.get("createdAt") else None,
                    "rawText": signal.get("rawText", ""),
                })

            results.append({
                "vendorId": loc["vendorId"],
                "vendorName": loc.get("vendorName") or "BazaarMind Vendor",
                "stallName": loc.get("stallName") or loc.get("vendorName") or "Vendor stall",
                "marketId": marketId,
                "distanceKm": round(distance, 2),
                "locationActive": True,
                "accuracyMeters": loc.get("accuracyMeters"),
                "updatedAt": loc.get("updatedAt"),
                "offers": offers,
            })

        results.sort(key=lambda x: x["distanceKm"])

        return {
            "ok": True,
            "origin": {"lat": lat, "lng": lng},
            "marketId": marketId,
            "dataSource": source,
            "radiusKm": radiusKm,
            "vendors": results,
        }

    async def ensure_indexes():
        try:
            await db.vendor_locations.create_index(
                [("vendorId", 1), ("marketId", 1), ("dataSource", 1), ("active", 1)]
            )
            await db.vendor_locations.create_index([("expiresAt", 1)])
            await db.vendor_locations.create_index([("marketId", 1), ("dataSource", 1)])
        except Exception:
            # Index creation must never prevent the API from starting.
            pass

    router.ensure_indexes = ensure_indexes
    return router
