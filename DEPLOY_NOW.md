# BazaarMind production deployment

## Backend — Render

Create a Web Service from this repository. The included `render.yaml` can be used as the Blueprint configuration. The backend root is `backend`.

Required secrets: `MONGO_URL`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `CORS_ORIGINS`, and `WEBHOOK_CRON_SECRET`. Keep all secrets in Render Environment, never in Git.

After the service deploys, verify `/health`. It must report `ok: true` and `mongo: true`.

## Frontend — Vercel

Import the repository and set the project root to `frontend`. Build command: `npm run build`. Output directory: `build`. The included `vercel.json` keeps React Router routes such as `/vendor` and `/ask` working after a refresh.

Set the Vercel environment variable: `REACT_APP_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com`.

Then update Render `CORS_ORIGINS` to the exact Vercel origin, for example `https://bazaar-mind.vercel.app`.

## Production smoke test

1. Open the Vercel URL.
2. Visit `/pulse`, `/shop`, `/vendor`, `/ask`, and `/more` directly.
3. Confirm `/health` is green.
4. Use the market picker and verify browser GPS is requested once.
5. On a real market location, turn on vendor location and confirm the backend accepts the same coordinates.
6. Send a text vendor signal and verify it appears in the market pulse.
7. Test Ask BazaarMind with a question that has known signals and one that does not.

## Important

The product must not claim WhatsApp is live unless WhatsApp Cloud API credentials and webhook configuration have actually been completed.
