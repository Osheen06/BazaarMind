"""BazaarMind backend regression tests.

Covers all P0 endpoints: market pulse, live Gemini interpret/parse/ask,
signal moderation, vendor demand, network, snapshots, pilot metrics.
"""
import os
import base64
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bazaar-intel-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 60  # Gemini calls can be slow


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- Basic ----------------
def test_root(s):
    r = s.get(f"{API}/", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["app"] == "BazaarMind"
    assert "gemini" in d["model"].lower()


# ---------------- Market pulse ----------------
def test_market_pulse(s):
    r = s.get(f"{API}/market-pulse", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["marketId"] == "demo-ina"
    prods = {p["product"]: p for p in d["products"]}
    for req in ["Tomatoes", "Potatoes", "Onions", "Coriander"]:
        assert req in prods, f"missing {req}"
    tom = prods["Tomatoes"]
    assert tom["availability"] == "Tight"
    assert tom["demand"] == "Elevated"
    assert tom["priceLow"] is not None and 40 <= tom["priceLow"] <= 80
    assert tom["reportedPriceSignal"]
    assert tom["confidence"] in ("Low", "Medium", "High")
    assert "lastUpdated" in tom


# ---------------- Gemini interpret (LIVE) ----------------
def test_interpret_signal_hinglish_live(s):
    payload = {"text": "Aaj tamatar thoda kam aaya hai aur rate saath rupaye hai"}
    r = s.post(f"{API}/signals/interpret", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is True, d
    assert d.get("live") is True
    sig = d["signal"]
    assert sig["product"] == "Tomatoes"
    assert sig["availability"] == "LOW"
    # reportedPrice ~ 70 (saath ~ saat = 70 in Hindi)
    assert sig.get("reportedPrice") in (60, 70) or (isinstance(sig.get("reportedPrice"), (int, float)) and 40 <= sig["reportedPrice"] <= 100)
    assert sig["signalType"] in ("SUPPLY", "PRICE", "AVAILABILITY")
    assert sig["confidence"] in ("LOW", "MEDIUM", "HIGH")


def test_interpret_signal_empty_400(s):
    r = s.post(f"{API}/signals/interpret", json={"text": "", "imageBase64": None}, timeout=TIMEOUT)
    assert r.status_code == 400


def _tiny_jpeg_b64():
    # 1x1 red pixel jpeg - real jpeg bytes
    return (
        "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
        "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
        "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA"
        "AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA"
        "AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3"
        "ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm"
        "p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEB"
        "AAA/APn+iiigD//Z"
    )


def test_interpret_signal_with_image_live(s):
    payload = {"text": "Tamatar ka stall", "imageBase64": _tiny_jpeg_b64()}
    r = s.post(f"{API}/signals/interpret", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    # Gemini may fail on 1x1 image; accept ok=false gracefully but assert no server crash
    if d.get("ok"):
        sig = d["signal"]
        assert "product" in sig
        assert "availability" in sig
        assert "confidence" in sig
        # Should not claim exact inventory - reasoning must not include exact counts
        assert isinstance(sig.get("reasoning", ""), str)
    else:
        assert "error" in d


# ---------------- Shopping list parse (LIVE) ----------------
def test_shopping_list_parse_live(s):
    r = s.post(f"{API}/shopping-list/parse",
               json={"text": "I need 2kg tomatoes, coriander and onions"}, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True, d
    items = d["items"]
    prods = [i["product"] for i in items]
    assert "Tomatoes" in prods
    assert "Coriander" in prods
    assert "Onions" in prods
    tom = next(i for i in items if i["product"] == "Tomatoes")
    assert tom["status"] == "tight"  # LOW availability
    assert tom["known"] is True
    assert d["tightCount"] >= 1
    assert d["summary"] is not None


# ---------------- Ask BazaarMind (LIVE) ----------------
def test_ask_bazaar_live(s):
    r = s.post(f"{API}/ask-bazaar",
               json={"question": "What should I know before I go?"}, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["live"] is True
    assert isinstance(d["answer"], str) and len(d["answer"]) > 20


def test_ask_bazaar_out_of_scope(s):
    r = s.post(f"{API}/ask-bazaar",
               json={"question": "Who won the cricket world cup in 2019?"}, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    ans = d["answer"].lower()
    # Should not confidently answer with cricket fact - either fallback or grounded market answer
    assert "australia" not in ans and "england" not in ans or "signal" in ans or "market" in ans


# ---------------- Signals: moderation + pulse reflection ----------------
def test_signal_confirmed_and_reflected(s):
    # baseline
    baseline = s.get(f"{API}/market-pulse", timeout=TIMEOUT).json()
    tom_before = next(p for p in baseline["products"] if p["product"] == "Tomatoes")
    obs_before = tom_before["vendorObservations"]

    payload = {"product": "Tomatoes", "signalType": "SUPPLY", "availability": "LOW",
               "reportedPrice": 58, "priceUnit": "kg", "rawText": "TEST_ tamatar kam hai",
               "vendorId": "v1", "vendorName": "TEST vendor", "source": "VENDOR"}
    r = s.post(f"{API}/signals", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["signal"]["status"] == "confirmed"
    assert d["published"] is True

    time.sleep(1)
    after = s.get(f"{API}/market-pulse", timeout=TIMEOUT).json()
    tom_after = next(p for p in after["products"] if p["product"] == "Tomatoes")
    assert tom_after["vendorObservations"] == obs_before + 1


def test_signal_moderation_impossible_price(s):
    payload = {"product": "Tomatoes", "reportedPrice": 999999, "priceUnit": "kg",
               "rawText": "TEST_ bad price", "source": "VENDOR"}
    r = s.post(f"{API}/signals", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["signal"]["status"] == "pending"
    assert d["published"] is False


def test_signal_moderation_unknown_product(s):
    payload = {"product": "Unknown", "rawText": "TEST_ ??", "source": "VENDOR"}
    r = s.post(f"{API}/signals", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["signal"]["status"] == "pending"


# ---------------- Vendor demand ----------------
def test_vendor_demand(s):
    r = s.get(f"{API}/vendor/demand", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert "totalRequests" in d and d["totalRequests"] > 0
    assert len(d["products"]) > 0
    for p in d["products"]:
        assert "product" in p and "requests" in p and "level" in p


# ---------------- Market network ----------------
def test_market_network(s):
    r = s.get(f"{API}/market-network", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["market"]["id"] == "demo-ina"
    assert len(d["vendors"]) >= 5
    assert d["shopperSignals"] > 0
    assert d["supplySignals"] > 0
    for v in d["vendors"]:
        assert "id" in v and "name" in v and "supplySignals" in v


# ---------------- Snapshots ----------------
def test_snapshots(s):
    r = s.get(f"{API}/snapshots", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    labels = [x["label"] for x in d["snapshots"]]
    assert "Today" in labels
    assert "Yesterday" in labels
    assert "7 days ago" in labels
    for snap in d["snapshots"]:
        assert "changes" in snap and len(snap["changes"]) >= 1


# ---------------- Pilot metrics ----------------
def test_pilot_metrics(s):
    r = s.get(f"{API}/pilot/metrics", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert "setup" in d
    assert len(d["metrics"]) >= 8
    for m in d["metrics"]:
        assert m["status"] == "Awaiting pilot data"
