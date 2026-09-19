# BazaarMind — PRD & Build Log

## Problem Statement
BazaarMind — "The Market That Thinks as One." A mobile-first PWA that is a WhatsApp-first
intelligence layer for neighborhood physical markets in Delhi NCR. It combines shopper demand,
vendor observations, availability and reported price signals, using Gemini to turn messy
multilingual (Hindi/Hinglish/English) market conversations into a trusted local Market Pulse.

Core concept: Every shopper is a signal. Every vendor is a sensor. The market is the network.
Gemini is the interpreter.

## Architecture
- **Frontend**: React 19 (CRA/craco), Tailwind + shadcn/ui, framer-motion, lucide-react. Mobile-first
  PWA (manifest + icons + theme color). Mobile bottom nav (Pulse/Shop/Vendor/Ask/More) + desktop
  command-center sidebar. Warm editorial design system per /app/design_guidelines.json.
- **Backend**: FastAPI, all routes under /api. Clean service layers:
  - `gemini_service.py` — live Gemini (model from GEMINI_MODEL env) for signal interpretation,
    shopping-list parsing, grounded Q&A, and multimodal image interpretation. Strict JSON schema,
    uncertainty-preserving rules, product normalization (tamatar→Tomatoes etc.).
  - `intelligence.py` — Market Intelligence Engine: raw signals → normalization → classification →
    recency → corroboration → confidence → Market Pulse. Confidence is a label (Low/Medium/High).
  - `demo_seed.py` — clearly-labelled synthetic demo dataset seeded on startup (idempotent).
  - `server.py` — API surface + basic moderation (confirmed/pending) + analytics events.
- **DB**: MongoDB (migration-ready; same aggregation shape works on real pilot data).

## User Personas
- Shopper: household that visits the same market 2–4×/week; checks BazaarMind before leaving home.
- Vendor: gives supply observations, receives aggregated neighborhood demand intelligence.

## What's Implemented (2026-06)
- Landing/product home with hero, signal→intelligence diagram, brand lines.
- Market Pulse (flagship): synthetic signal cards (availability, demand, reported price signal,
  evidence counts, confidence, last updated, conflicting-signal handling). Demo-data labelled.
- Shopper WhatsApp-style chat: list → LIVE Gemini parse → compare vs pulse → demand signal persisted.
- Vendor: text/voice(Web Speech API + honest fallback)/photo → LIVE Gemini interpret →
  "Here's what BazaarMind understood" confirm/edit → publish → reflected in Market Pulse.
  Vendor value panel (neighborhood demand, total shopper requests) + recent signals.
- Ask BazaarMind: LIVE Gemini grounded Q&A with "not enough verified signals" fallback.
- Market Network: animated SVG graph (shoppers→demand→market←supply←vendors) + snapshots.
- Pilot & Business: pilot setup, target metrics (Awaiting pilot data), business model
  (USER≠PAYER≠BENEFICIARY), moat, roadmap (Phase 1 built / rest planned), positioning, research qs.
- More: Gemini Intelligence explainer (schema + rules), settings (demo toggle, market selector),
  final product & integrity statements.
- Analytics event tracking; PWA manifest + generated app icon.

## LIVE Gemini vs SYNTHETIC
- LIVE: signal interpretation, shopping-list parsing, Ask Q&A, image interpretation (Gemini 3.1 Pro).
- SYNTHETIC (labelled): all market pulse values, vendor/shopper counts, snapshots, network numbers.
- No fabricated users, pilot results, revenue, partnerships, or testimonials.

## Test Status
- Backend: 15/15 pytest passed (all P0 endpoints incl. live Gemini + image). Frontend core flows 100%.
- Minor fixes applied: option DOM validity in More.jsx; price rounding in intelligence.py.

## Env Vars
- backend/.env: MONGO_URL, DB_NAME, CORS_ORIGINS, EMERGENT_LLM_KEY, GEMINI_MODEL=gemini-3.1-pro-preview
- frontend/.env: REACT_APP_BACKEND_URL

## Expansion (2026-06) — implemented & tested (35/35)
- **Single intelligence engine**: `conversation.process_message` shared by PWA + WhatsApp; no duplicated AI logic.
- **WhatsApp Business (integration-ready)**: `whatsapp_service.py` + `/api/whatsapp/{status,webhook}`.
  Webhook GET verification, POST X-Hub-Signature-256 HMAC check, Graph API send. Unconfigured →
  503 (webhook) / labelled "integration ready — production credentials required". Never simulated.
  Env: WHATSAPP_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET, META_GRAPH_VERSION.
- **Voice signals (LIVE Whisper)**: `voice_service.py` + `/api/voice/transcribe` (whisper-1 via Emergent key).
  Verified live TTS→STT round-trip. Original transcript preserved; interpretation is a separate reviewable step.
  Frontend uses MediaRecorder → server STT (works on any phone), honest fallback when mic unavailable.
- **Persistent snapshots**: `snapshot_history` collection; `/api/snapshots/capture` + `/history` (compare latest two);
  daily capture via `.emergent/crons.yml` → `/api/cron/capture-snapshot` (Bearer WEBHOOK_CRON_SECRET, backgrounded).
- **Pilot onboarding**: `/api/pilot/onboard/{shopper,vendor}` + `/api/pilot/status` (DB-derived; "Awaiting pilot data"
  when empty). Frontend `/join` short forms + `/business` Live Status & Onboard tabs.
- **Location (optional)**: markets carry approx lat/lng; `/api/markets/nearby` (haversine sort). Permission requested
  with explanation; denial falls back to manual selection — never blocks.
- **Data-source separation**: every signal tagged `dataSource` DEMO/PILOT; pulse/network/vendor-demand/ask filter by it.
  participantId validated against pilot_participants (unknown → DEMO, prevents metric inflation). Context toggles
  DEMO/PILOT badge automatically when a participant is onboarded.

## Backlog (future)
- Provide real Meta credentials to activate WhatsApp; map WhatsApp sender → pilot participant for PILOT routing.
- Mongo aggregation + indexes at pilot scale; service-worker offline shell caching; lightweight auth if pilot grows.
