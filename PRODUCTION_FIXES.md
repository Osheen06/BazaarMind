# BazaarMind production fix

This source snapshot fixes the location/discovery startup path.

## Critical fixes

1. Vendor GPS is acquired once and the exact `GeolocationPosition` is passed into market discovery. This avoids the second CoreLocation request that was producing `kCLErrorLocationUnknown` after a successful first GPS fix.
2. Vendor discovery selects the nearest market within 5 km. The backend still validates the same coordinates against the selected market.
3. Google Places discovery results are normalized from backend `places` to frontend `markets`.
4. Google-discovered markets are registered only when a vendor actually needs a BazaarMind market record.
5. Shopper market discovery no longer silently changes the selected market.
6. Vendor activation no longer requires a stale/manual market selection before GPS discovery.
7. API errors from the backend are displayed instead of being misreported as location failures.
8. Removed Emergent overlay/visual-edit runtime integrations from the frontend development setup.
9. Frontend API configuration uses CRA's `REACT_APP_API_BASE_URL`.
10. Added MongoDB indexes for vendor locations.
11. Fixed the More page null-market crash.
12. Removed the hardcoded preview URL and cron secret from backend test code.

## Local run

Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install --legacy-peer-deps
printf 'REACT_APP_API_BASE_URL=http://127.0.0.1:8000\\n' > .env.local
npm start
```

## Production

Frontend environment:

```text
REACT_APP_API_BASE_URL=https://YOUR-RENDER-BACKEND.onrender.com
```

Backend environment:

```text
CORS_ORIGINS=https://YOUR-VERCEL-FRONTEND.vercel.app
```

Keep Gemini, Google Places, MongoDB and cron secrets only in the hosting provider's secret/environment settings. Do not commit `.env` files.

## Vendor location behavior

A vendor must actually be within 5 km of the market. BazaarMind does not fabricate GPS coordinates. If Google/browser location cannot provide a position, activation remains blocked until a real device position is available.
