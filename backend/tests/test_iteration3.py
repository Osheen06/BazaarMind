"""Iteration 3 backend tests: snapshot trends, pilot invites, voice transcribe (real speech round-trip)."""
import os
import asyncio
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


# --------------------------- Snapshot Trends ---------------------------
class TestSnapshotTrends:
    def test_trends_demo_returns_7_points_per_product(self):
        r = requests.get(f"{API}/snapshots/trends", params={"dataSource": "DEMO", "days": 7}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["dataSource"] == "DEMO"
        assert data.get("synthetic") is True
        products = data.get("products", [])
        assert len(products) >= 5, f"Expected several products, got {len(products)}"
        names = [p["product"] for p in products]
        assert "Tomatoes" in names
        for p in products:
            assert len(p["points"]) == 7, f"{p['product']} has {len(p['points'])} points"
            for pt in p["points"]:
                assert "date" in pt and "priceMid" in pt and "availability" in pt
                assert "availabilityScore" in pt

    def test_trends_tomatoes_price_rises_and_tightens(self):
        r = requests.get(f"{API}/snapshots/trends", params={"dataSource": "DEMO", "days": 7}, timeout=30)
        data = r.json()
        tom = next(p for p in data["products"] if p["product"] == "Tomatoes")
        prices = [pt["priceMid"] for pt in tom["points"] if pt["priceMid"] is not None]
        assert prices[0] < prices[-1], f"Tomato price should rise: {prices}"
        # Rough range 45-70 window
        assert 40 <= prices[0] <= 60
        assert 55 <= prices[-1] <= 75
        avails = [pt["availability"] for pt in tom["points"]]
        assert avails[0] in ("Normal", "Good")
        assert avails[-1] in ("Tight", "Limited")

    def test_trends_pilot_empty(self):
        r = requests.get(f"{API}/snapshots/trends", params={"dataSource": "PILOT", "days": 7}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["dataSource"] == "PILOT"
        assert data["products"] == []


# --------------------------- Pilot Invites ---------------------------
class TestPilotInvites:
    _code = None

    def test_create_invite_ok(self):
        r = requests.post(f"{API}/pilot/invite", json={"community": "TEST_Green Meadows RWA", "marketId": "demo-ina"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["community"] == "TEST_Green Meadows RWA"
        assert data["marketId"] == "demo-ina"
        assert isinstance(data["code"], str) and len(data["code"]) >= 6
        TestPilotInvites._code = data["code"]

    def test_get_invite_returns_market(self):
        assert TestPilotInvites._code, "invite must be created first"
        r = requests.get(f"{API}/pilot/invite/{TestPilotInvites._code}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["community"] == "TEST_Green Meadows RWA"
        assert data["marketId"] == "demo-ina"
        assert data.get("market", {}).get("name")

    def test_get_invite_bad_code_404(self):
        r = requests.get(f"{API}/pilot/invite/BADCODEZZZZ", timeout=15)
        assert r.status_code == 404


# --------------------------- Voice ---------------------------
class TestVoice:
    def test_voice_status_configured(self):
        r = requests.get(f"{API}/voice/status", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["configured"] is True
        assert data["model"]

    def test_voice_transcribe_real_speech(self):
        """Real TTS -> Whisper round trip via emergentintegrations OpenAI TTS."""
        try:
            from emergentintegrations.llm.openai import OpenAITextToSpeech
        except Exception as e:
            pytest.skip(f"OpenAITextToSpeech unavailable: {e}")
        key = os.environ.get("EMERGENT_LLM_KEY")
        if not key:
            # Try to load from backend/.env
            from pathlib import Path
            for line in Path("/app/backend/.env").read_text().splitlines():
                if line.startswith("EMERGENT_LLM_KEY="):
                    key = line.split("=", 1)[1].strip()
        if not key:
            pytest.skip("EMERGENT_LLM_KEY not available")

        async def synth():
            tts = OpenAITextToSpeech(api_key=key)
            return await tts.generate_speech(
                text="Tomatoes are less today and the rate is seventy rupees",
                model="tts-1", voice="alloy", response_format="mp3",
            )

        try:
            audio_bytes = asyncio.run(synth())
        except Exception as e:
            pytest.skip(f"TTS synthesis failed in this env: {e}")

        assert audio_bytes and len(audio_bytes) > 500

        files = {"audio": ("speech.mp3", audio_bytes, "audio/mpeg")}
        r = requests.post(f"{API}/voice/transcribe", files=files, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True, f"Transcribe failed: {data}"
        transcript = data["transcript"].lower()
        # Very loose match - Whisper should get at least "tomato" or "rupees" or a digit
        assert any(w in transcript for w in ["tomato", "rupee", "seventy", "70", "less"]), \
            f"Transcript missing expected words: {transcript}"


# --------------------------- Regression ---------------------------
class TestRegression:
    def test_market_pulse_demo_returns_8_products(self):
        r = requests.get(f"{API}/market-pulse", params={"dataSource": "DEMO"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["dataSource"] == "DEMO"
        assert len(data["products"]) == 8

    def test_signals_interpret_live(self):
        r = requests.post(f"{API}/signals/interpret",
                          json={"text": "Aaj tamatar thoda kam aaya hai aur rate saath rupaye hai"}, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["signal"].get("product")

    def test_shopper_onboard_flips_env(self):
        # Create a TEST_ shopper
        payload = {"name": "TEST_shopper_i3", "community": "TEST_Community_i3",
                   "marketId": "demo-ina", "language": "HINGLISH", "consent": True}
        r = requests.post(f"{API}/pilot/onboard/shopper", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        s = requests.get(f"{API}/pilot/status", timeout=15).json()
        assert s["environment"] == "PILOT"
        assert s["hasPilotData"] is True


# --------------------------- Cleanup ---------------------------
@pytest.fixture(scope="module", autouse=True)
def cleanup_after():
    yield
    # Remove TEST_ pilot participants and invites
    try:
        import pymongo
        from pathlib import Path
        env = {}
        for line in Path("/app/backend/.env").read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
        mongo_url = env.get("MONGO_URL") or os.environ.get("MONGO_URL")
        db_name = env.get("DB_NAME") or os.environ.get("DB_NAME")
        cli = pymongo.MongoClient(mongo_url)
        db = cli[db_name]
        db.pilot_participants.delete_many({"$or": [{"name": {"$regex": "^TEST_"}}, {"community": {"$regex": "^TEST_"}}]})
        db.pilot_invites.delete_many({"community": {"$regex": "^TEST_"}})
        db.market_signals.delete_many({"dataSource": "PILOT"})
        db.shopping_lists.delete_many({"dataSource": "PILOT"})
    except Exception as e:
        print(f"cleanup skipped: {e}")
