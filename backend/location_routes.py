"""
BazaarMind location and real-world market discovery routes.

Google Places is used only to discover nearby real-world market locations.
It does not provide BazaarMind intelligence, vendor prices, inventory,
participation, or shopper demand.
"""

import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from market_discovery import search_nearby_markets, is_configured


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad)
        * math.cos(lat2_rad)
        * math.sin(delta_lng / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(a))


class RegisterDiscoveredMarket(BaseModel):
    placeId: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    address: Optional[str] = None
    lat: float
    lng: float
    primaryType: Optional[str] = None
    types: list[str] = Field(default_factory=list)
    googleMapsUri: Optional[str] = None


def build_router(db):
    router = APIRouter()

    @router.get("/markets/discovery/status")
    async def discovery_status():
        configured = is_configured()
        return {
            "ok": True,
            "configured": configured,
            "provider": "GOOGLE_PLACES" if configured else None,
        }

    @router.get("/markets/discover-nearby")
    async def discover_markets(
        lat: float = Query(..., ge=-90, le=90),
        lng: float = Query(..., ge=-180, le=180),
        radiusKm: float = Query(10.0, gt=0, le=50.0),
        maxResults: int = Query(20, ge=1, le=20),
    ):
        try:
            places = await search_nearby_markets(
                lat=lat,
                lng=lng,
                radius_km=radiusKm,
                max_results=maxResults,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Market discovery failed: {exc}",
            ) from exc

        normalized = []
        for place in places:
            place_lat = place.get("lat")
            place_lng = place.get("lng")
            if not isinstance(place_lat, (int, float)) or not isinstance(place_lng, (int, float)):
                continue

            normalized.append({
                **place,
                "distanceKm": round(
                    haversine_km(lat, lng, float(place_lat), float(place_lng)),
                    3,
                ),
                "discoveryOnly": True,
                "intelligenceAvailable": False,
            })

        normalized.sort(key=lambda item: item["distanceKm"])
        configured = is_configured()

        return {
            "ok": True,
            "configured": configured,
            "provider": "GOOGLE_PLACES" if configured else None,
            "origin": {"lat": lat, "lng": lng},
            "radiusKm": radiusKm,
            "count": len(normalized),
            "places": normalized,
        }

    @router.post("/markets/register-discovered")
    async def register_discovered_market(payload: RegisterDiscoveredMarket):
        if not (-90 <= payload.lat <= 90):
            raise HTTPException(status_code=400, detail="Invalid latitude.")
        if not (-180 <= payload.lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid longitude.")

        market_id = f"google-{payload.placeId}"
        now = now_iso()

        # IMPORTANT: createdAt is ONLY in $setOnInsert.
        # Putting it in both $set and $setOnInsert causes MongoDB's
        # "Updating the path 'createdAt' would create a conflict" error.
        market_doc = {
            "id": market_id,
            "name": payload.name,
            "address": payload.address or "",
            "lat": float(payload.lat),
            "lng": float(payload.lng),
            "placeId": payload.placeId,
            "primaryType": payload.primaryType,
            "types": payload.types,
            "googleMapsUri": payload.googleMapsUri,
            "area": payload.address or "",
            "community": None,
            "synthetic": False,
            "discoveryOnly": True,
            "discoveryProvider": "GOOGLE_PLACES",
            "intelligenceAvailable": False,
            "dataSource": "REAL",
            "updatedAt": now,
        }

        try:
            result = await db.markets.update_one(
                {"placeId": payload.placeId},
                {
                    "$set": market_doc,
                    "$setOnInsert": {"createdAt": now},
                },
                upsert=True,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Could not register discovered market: {exc}",
            ) from exc

        market = await db.markets.find_one(
            {"placeId": payload.placeId},
            {"_id": 0},
        )
        if not market:
            raise HTTPException(
                status_code=500,
                detail="Market was registered but could not be retrieved.",
            )

        return {
            "ok": True,
            "market": market,
            "created": result.upserted_id is not None,
            "updated": result.modified_count > 0 and result.upserted_id is None,
        }

    @router.get("/markets/discovered/{market_id}")
    async def get_discovered_market(market_id: str):
        market = await db.markets.find_one(
            {"id": market_id},
            {"_id": 0},
        )
        if not market:
            raise HTTPException(status_code=404, detail="Market not found.")
        return {"ok": True, "market": market}

    async def ensure_indexes():
        try:
            await db.markets.create_index(
                [("placeId", 1)],
                unique=True,
                sparse=True,
            )
            await db.markets.create_index([("dataSource", 1)])
            await db.markets.create_index([("discoveryProvider", 1)])
        except Exception:
            # Do not prevent application startup because of an index issue.
            pass

    router.ensure_indexes = ensure_indexes
    return router
