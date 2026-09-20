"""Real-world nearby market discovery for BazaarMind.

Google Places is used only to discover nearby market locations. It does NOT
provide BazaarMind intelligence, vendor prices, inventory, or participation.
Those signals still come from BazaarMind's own vendor/shopper network.
"""

import asyncio
import json
import os
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby"

MARKET_TYPES = [
    "market",
    "farmers_market",
    "flea_market",
    "grocery_store",
    "supermarket",
    "hypermarket",
]

FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryType",
        "places.types",
        "places.googleMapsUri",
    ]
)


def _api_key() -> str:
    # Read at call time rather than import time. This prevents .env import-order
    # problems and also makes environment changes visible after a process restart.
    return os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()


def is_configured() -> bool:
    return bool(_api_key())


def _validate_coordinates(lat: float, lng: float) -> None:
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError("Invalid latitude or longitude.")


def _post_json(url: str, payload: dict, headers: dict, timeout: float = 10.0) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib_request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib_request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


async def search_nearby_markets(
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    max_results: int = 20,
) -> list[dict]:
    """Return nearby real-world market candidates from Google Places."""

    _validate_coordinates(lat, lng)

    api_key = _api_key()
    if not api_key:
        return []

    radius_m = max(100.0, min(radius_km * 1000.0, 50000.0))
    max_results = max(1, min(int(max_results), 20))

    payload = {
        "includedTypes": MARKET_TYPES,
        "maxResultCount": max_results,
        "rankPreference": "DISTANCE",
        "languageCode": "en",
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius_m,
            }
        },
    }

    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    try:
        data = await asyncio.to_thread(
            _post_json,
            PLACES_URL,
            payload,
            headers,
        )
    except HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8")
        except Exception:
            pass
        raise RuntimeError(
            f"Google Places request failed ({exc.code}). {body[:500]}"
        ) from exc
    except URLError as exc:
        raise RuntimeError(
            f"Google Places network error: {exc.reason}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Google Places request failed: {exc}"
        ) from exc

    places = []
    for place in data.get("places", []):
        location = place.get("location") or {}
        place_lat = location.get("latitude")
        place_lng = location.get("longitude")
        if place_lat is None or place_lng is None:
            continue

        display = place.get("displayName") or {}
        place_id = place.get("id")
        if not place_id:
            continue

        places.append(
            {
                "placeId": place_id,
                "name": display.get("text") or "Nearby market",
                "address": place.get("formattedAddress"),
                "lat": float(place_lat),
                "lng": float(place_lng),
                "primaryType": place.get("primaryType"),
                "types": place.get("types") or [],
                "googleMapsUri": place.get("googleMapsUri"),
                "provider": "GOOGLE_PLACES",
                "discoveryOnly": True,
                "intelligenceAvailable": False,
            }
        )

    return places
