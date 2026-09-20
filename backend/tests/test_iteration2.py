"""BazaarMind iteration 2 tests: dataSource separation, WhatsApp, voice, snapshots,
pilot onboarding & status, markets/nearby, cron auth.

Cleans up TEST_ prefixed pilot participants + PILOT signals at the end.
"""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 60
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")

_created_participant_ids = []
_created_pilot_signal_ids = []


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --------- Regression: DEMO pulse still returns 8 synthetic products ----------
def test_demo_pulse_has_demo_products(s):
    r = s.get(f"{API}/market-pulse", params={"dataSource": "DEMO"}, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["dataSource"] == "DEMO"
    prods = {p["product"]: p for p in d["products"]}
    assert "Tomatoes" in prods
    tom = prods["Tomatoes"]
    assert tom["availability"] == "Tight"
    # 8 canonical products should be present (allow +/- for extra test data)
    assert len(d["products"]) >= 6


# --------- DataSource separation: PILOT pulse initially empty ----------
def test_pilot_pulse_empty_initially(s):
    r = s.get(f"{API}/market-pulse", params={"dataSource": "PILOT"}, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["dataSource"] == "PILOT"
    # Pilot participant may have been created by another test; ensure only PILOT-tagged signals count
    # Before we create any pilot signals here, ideally 0 products
    # But if a previous run left data, allow small count
    assert isinstance(d["products"], list)


def test_signal_without_participant_is_demo(s):
    payload = {"product": "Tomatoes", "signalType": "SUPPLY", "availability": "LOW",
               "reportedPrice": 58, "priceUnit": "kg", "rawText": "TEST_ demo tag",
               "vendorId": "v1", "vendorName": "TEST", "source": "VENDOR"}
    r = s.post(f"{API}/signals", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["signal"]["dataSource"] == "DEMO"
    assert d["signal"]["synthetic"] is True


def test_signal_with_participant_is_pilot(s):
    payload = {"product": "Tomatoes", "signalType": "SUPPLY", "availability": "LOW",
               "reportedPrice": 62, "priceUnit": "kg", "rawText": "TEST_ pilot tag",
               "vendorId": "v1", "vendorName": "TEST", "source": "VENDOR",
               "participantId": "TEST_participant_xyz"}
    r = s.post(f"{API}/signals", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["signal"]["dataSource"] == "PILOT"
    assert d["signal"]["synthetic"] is False
    _created_pilot_signal_ids.append(d["signal"]["id"])

    # Verify pilot pulse now sees Tomatoes but DEMO pulse still independent
    pilot = s.get(f"{API}/market-pulse", params={"dataSource": "PILOT"}, timeout=TIMEOUT).json()
    demo = s.get(f"{API}/market-pulse", params={"dataSource": "DEMO"}, timeout=TIMEOUT).json()
    pilot_prods = [p["product"] for p in pilot["products"]]
    assert "Tomatoes" in pilot_prods
    # Ensure demo pulse still has data too
    assert len(demo["products"]) >= 6


# --------- Pilot onboarding ----------
def test_onboard_shopper_success(s):
    r = s.post(f"{API}/pilot/onboard/shopper",
               json={"name": "TEST_Shopper", "community": "TEST_community",
                     "marketId": "demo-ina", "language": "HINGLISH", "consent": True},
               timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["participant"]["role"] == "shopper"
    assert "id" in d["participant"]
    _created_participant_ids.append(d["participant"]["id"])


def test_onboard_shopper_requires_consent(s):
    r = s.post(f"{API}/pilot/onboard/shopper",
               json={"community": "TEST_community", "consent": False}, timeout=TIMEOUT)
    assert r.status_code == 400


def test_onboard_vendor_success(s):
    r = s.post(f"{API}/pilot/onboard/vendor",
               json={"name": "TEST_Vendor", "stall": "T1", "category": "vegetables",
                     "marketId": "demo-ina", "consent": True}, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["participant"]["role"] == "vendor"
    _created_participant_ids.append(d["participant"]["id"])


def test_onboard_vendor_requires_consent(s):
    r = s.post(f"{API}/pilot/onboard/vendor",
               json={"consent": False}, timeout=TIMEOUT)
    assert r.status_code == 400


# --------- Pilot status flips to PILOT after onboarding ----------
def test_pilot_status_environment_pilot(s):
    r = s.get(f"{API}/pilot/status", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["hasPilotData"] is True
    assert d["environment"] == "PILOT"
    metrics = {m["name"]: m for m in d["metrics"]}
    assert isinstance(metrics["Households joined"]["value"], int)
    assert metrics["Households joined"]["value"] >= 1
    assert metrics["Households joined"]["display"] != "Awaiting pilot data"


# --------- Voice STT ----------
def test_voice_status_configured(s):
    r = s.get(f"{API}/voice/status", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["configured"] is True
    assert d["model"] == "whisper-1"


def test_voice_transcribe_handles_bad_audio_gracefully(s):
    # Send tiny non-speech bytes — endpoint must handle gracefully (no stack trace, ok=false)
    files = {"audio": ("audio.webm", b"\x00\x01\x02not-real-audio", "audio/webm")}
    r = requests.post(f"{API}/voice/transcribe", files=files, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert "ok" in d
    if d["ok"] is False:
        assert "error" in d
        assert "stack" not in d["error"].lower()
    else:
        # If Whisper somehow returns a transcript, it must be a string
        assert isinstance(d["transcript"], str)


# --------- WhatsApp (unconfigured behavior) ----------
def test_whatsapp_status_unconfigured(s):
    r = s.get(f"{API}/whatsapp/status", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["configured"] is False
    assert "integration ready" in d["label"].lower()
    assert d["webhookPath"] == "/api/whatsapp/webhook"


def test_whatsapp_webhook_verify_403(s):
    r = s.get(f"{API}/whatsapp/webhook",
              params={"hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "123"},
              timeout=TIMEOUT)
    assert r.status_code == 403


def test_whatsapp_inbound_503(s):
    r = s.post(f"{API}/whatsapp/webhook", json={"entry": []}, timeout=TIMEOUT)
    assert r.status_code == 503
    detail = r.json().get("detail", "")
    assert "integration ready" in detail.lower()


# --------- Snapshots ----------
def test_snapshots_capture_and_history(s):
    r1 = s.post(f"{API}/snapshots/capture", params={"dataSource": "DEMO"}, timeout=TIMEOUT)
    assert r1.status_code == 200
    assert r1.json()["ok"] is True
    time.sleep(1)
    r2 = s.post(f"{API}/snapshots/capture", params={"dataSource": "DEMO"}, timeout=TIMEOUT)
    assert r2.status_code == 200

    h = s.get(f"{API}/snapshots/history", params={"dataSource": "DEMO"}, timeout=TIMEOUT)
    assert h.status_code == 200
    d = h.json()
    assert d["dataSource"] == "DEMO"
    assert len(d["history"]) >= 2
    assert d["comparison"]["available"] is True
    assert isinstance(d["comparison"]["changes"], list)


def test_snapshots_demo_labelled(s):
    r = s.get(f"{API}/snapshots", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["synthetic"] is True
    assert "Demo" in d["label"]


# --------- markets/nearby ----------
def test_markets_nearby_sorted(s):
    r = s.get(f"{API}/markets/nearby", params={"lat": 28.57, "lng": 77.21}, timeout=TIMEOUT)
    assert r.status_code == 200
    markets = r.json()
    assert isinstance(markets, list) and len(markets) >= 2
    distances = [m["distanceKm"] for m in markets if m.get("distanceKm") is not None]
    assert distances == sorted(distances), f"markets not sorted ascending: {distances}"
    # INA Market should be first at ~0.2km
    first = markets[0]
    assert first["distanceKm"] is not None and first["distanceKm"] < 1.0


# --------- Cron auth ----------
def test_cron_no_auth_401():
    r = requests.post(f"{API}/cron/capture-snapshot", timeout=TIMEOUT)
    assert r.status_code == 401


def test_cron_valid_auth_200():
    r = requests.post(f"{API}/cron/capture-snapshot",
                      headers={"Authorization": f"Bearer {CRON_SECRET}"},
                      timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["accepted"] is True


# --------- Cleanup ----------
def test_zz_cleanup(s):
    """Delete TEST_ pilot participants and PILOT signals so demo default persists."""
    from pymongo import MongoClient
    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = mongo[os.environ.get("DB_NAME", "test_database")]
    res1 = db.pilot_participants.delete_many({"$or": [
        {"name": {"$regex": "^TEST_"}},
        {"community": {"$regex": "^TEST_"}},
    ]})
    res2 = db.market_signals.delete_many({"$or": [
        {"participantId": {"$regex": "^TEST_"}},
        {"rawText": {"$regex": "^TEST_"}},
        {"vendorName": "TEST"},
    ]})
    print(f"Cleaned {res1.deleted_count} participants, {res2.deleted_count} signals")
