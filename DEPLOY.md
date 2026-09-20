# Deployment

## 1. Backend

From `backend/`:

```bash
python -m compileall .
docker build -t bazaarmind-api .
docker run --name bazaarmind-api --restart unless-stopped -p 8000:8000 --env-file .env bazaarmind-api
```

Use your hosting provider's HTTPS endpoint/reverse proxy in front of port 8000.

Required environment variables:
- `MONGO_URL`
- `DB_NAME`
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.5-flash-lite`
- `GEMINI_TRANSCRIBE_MODEL=gemini-3.5-transcribe`
- `GOOGLE_MAPS_API_KEY`
- `CORS_ORIGINS`
- `WEBHOOK_CRON_SECRET`

Optional WhatsApp:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`

## 2. Frontend

From `frontend/`:

```bash
npm ci
npm run build
```

Set:

```env
REACT_APP_API_BASE_URL=https://YOUR-BACKEND-DOMAIN
```

Deploy the generated `build/` directory to an HTTPS static host.

## 3. Smoke test

```bash
curl -fsS https://YOUR-BACKEND-DOMAIN/health
```

Then test the frontend's location flow over HTTPS.

## 4. Before public launch

- Rotate any API keys that were previously exposed.
- Keep the real `.env` out of Git.
- Restrict the Google Maps API key to the APIs/origins appropriate for your deployment.
- Use a private/authenticated MongoDB deployment.
- Set `CORS_ORIGINS` to the actual frontend origin.
- Remove any placeholder vendor records.
- Do not describe DEMO synthetic signals as real traction.
- WhatsApp remains integration-ready until its production credentials are configured.
