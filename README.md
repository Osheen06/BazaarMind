# BazaarMind Location Key Fix

This update fixes the Google Places configuration issue.

## Why the API reported configured=false

The previous server imported `location_routes` before calling `load_dotenv()`.
`location_routes` imports `market_discovery`, which previously read
`GOOGLE_MAPS_API_KEY` at module import time. Therefore the key was read as
empty even though it existed in `backend/.env`.

This update:
1. Loads `.env` before importing `location_routes`.
2. Makes `market_discovery.py` read `GOOGLE_MAPS_API_KEY` at call time.

## Install

Replace these two files in the backend:
- `server.py`
- `market_discovery.py`

Keep your existing `backend/.env` and do not commit it.

## Test

Restart Uvicorn completely:

    Ctrl+C
    source .venv/bin/activate
    uvicorn server:app --reload

Then:

    curl -sS http://127.0.0.1:8000/api/markets/discovery/status

Expected:

    {"configured":true,"provider":"GOOGLE_PLACES"}

Then:

    curl -sS "http://127.0.0.1:8000/api/markets/discover-nearby?lat=28.5687&lng=77.2094&radiusKm=10"

If Google returns an error after this, the FastAPI wiring is working and the remaining issue is Google Cloud API/billing/restriction configuration.

## Security

The API credentials previously pasted into chat should be rotated before production.
Do not commit `backend/.env`.
