"""BazaarMind Market Intelligence Engine.

Converts raw signals into Market Pulse:
RAW SIGNALS -> NORMALIZATION -> CLASSIFICATION -> RECENCY -> CORROBORATION
-> CONFIDENCE -> MARKET SNAPSHOT -> MARKET PULSE

Reads only confirmed, non-expired signals from Mongo. Designed so the same
aggregation can later run over real pilot data without changing the API surface.
"""
from datetime import datetime, timezone
from collections import Counter
from typing import List, Dict, Any, Optional

from gemini_service import CANONICAL_PRODUCTS

AVAILABILITY_DISPLAY = {"HIGH": "Good", "NORMAL": "Normal", "LOW": "Tight", "UNKNOWN": "Unknown"}
DEMAND_DISPLAY = {"HIGH": "Elevated", "NORMAL": "Normal", "LOW": "Low", "UNKNOWN": "Unknown"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _minutes_ago(dt: Optional[datetime]) -> Optional[int]:
    if not dt:
        return None
    return int((_now() - dt).total_seconds() // 60)


def _humanize_minutes(mins: Optional[int]) -> str:
    if mins is None:
        return "unknown"
    if mins < 1:
        return "just now"
    if mins < 60:
        return f"{mins} min ago"
    hours = mins // 60
    if hours < 24:
        return f"{hours} hr ago"
    return f"{hours // 24} d ago"


def _mode(values: List[str]) -> Optional[str]:
    values = [v for v in values if v and v != "UNKNOWN"]
    if not values:
        return None
    return Counter(values).most_common(1)[0][0]


def _confidence(vendor_obs: int, agreement: float, recent_mins: Optional[int]) -> str:
    if vendor_obs <= 1:
        base = "Low"
    elif vendor_obs <= 4:
        base = "Medium"
    else:
        base = "High"
    if agreement < 0.6 and base == "High":
        base = "Medium"
    if agreement < 0.5 and base == "Medium":
        base = "Low"
    if recent_mins is not None and recent_mins > 720:  # stale > 12h
        base = "Low" if base == "Medium" else ("Medium" if base == "High" else base)
    return base


def build_product_pulse(product: str, signals: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    now = _now()
    active = []
    for s in signals:
        exp = _parse_dt(s.get("expiresAt"))
        if exp and exp < now:
            continue
        active.append(s)
    if not active:
        return None

    vendor_signals = [s for s in active if s.get("source") == "VENDOR"]
    shopper_signals = [s for s in active if s.get("source") == "SHOPPER"]

    avail_votes = [s.get("availability") for s in active if s.get("availability")]
    demand_votes = [s.get("demandLevel") for s in active if s.get("demandLevel")]

    avail = _mode(avail_votes)
    demand = _mode(demand_votes)
    # Shopper demand pressure lifts demand if many shoppers want it
    if len(shopper_signals) >= 15 and demand in (None, "NORMAL", "LOW"):
        demand = "HIGH"
    elif len(shopper_signals) >= 6 and demand in (None, "LOW"):
        demand = "NORMAL"

    prices = [(s.get("reportedPrice"), s.get("priceUnit")) for s in active
              if isinstance(s.get("reportedPrice"), (int, float))]
    price_signal = None
    price_low = price_high = price_unit = None
    if prices:
        vals = sorted(p[0] for p in prices)
        price_unit = next((u for _, u in prices if u), "kg")
        price_low, price_high = vals[0], vals[-1]
        if price_low == price_high:
            price_signal = f"₹{int(price_low)}/{price_unit}"
        else:
            price_signal = f"₹{int(price_low)}–₹{int(price_high)}/{price_unit}"

    # agreement = share of the dominant availability vote
    agreement = 1.0
    if avail_votes:
        agreement = Counter(avail_votes).most_common(1)[0][1] / len(avail_votes)

    last_dt = max((_parse_dt(s.get("createdAt")) for s in active if _parse_dt(s.get("createdAt"))),
                  default=None)
    recent_mins = _minutes_ago(last_dt)

    confidence = _confidence(len(vendor_signals), agreement, recent_mins)

    conflicting = bool(avail_votes) and agreement < 0.6

    return {
        "product": product,
        "availability": AVAILABILITY_DISPLAY.get(avail, "Unknown"),
        "availabilityCode": avail or "UNKNOWN",
        "demand": DEMAND_DISPLAY.get(demand, "Unknown"),
        "demandCode": demand or "UNKNOWN",
        "reportedPriceSignal": price_signal,
        "priceLow": price_low,
        "priceHigh": price_high,
        "priceUnit": price_unit,
        "vendorObservations": len(vendor_signals),
        "shopperSignals": len(shopper_signals),
        "signalCount": len(active),
        "confidence": confidence,
        "conflicting": conflicting,
        "lastUpdatedMinutes": recent_mins,
        "lastUpdated": _humanize_minutes(recent_mins),
    }


def _overall_confidence(products: List[Dict[str, Any]]) -> str:
    if not products:
        return "Low"
    score = {"Low": 0, "Medium": 1, "High": 2}
    avg = sum(score[p["confidence"]] for p in products) / len(products)
    if avg >= 1.5:
        return "High"
    if avg >= 0.8:
        return "Medium"
    return "Low"


async def compute_market_pulse(db, market_id: str) -> Dict[str, Any]:
    cursor = db.market_signals.find(
        {"marketId": market_id, "status": "confirmed"}, {"_id": 0}
    )
    signals = await cursor.to_list(5000)

    by_product: Dict[str, List[Dict[str, Any]]] = {}
    for s in signals:
        by_product.setdefault(s.get("product"), []).append(s)

    products = []
    for product in CANONICAL_PRODUCTS:
        pulse = build_product_pulse(product, by_product.get(product, []))
        if pulse:
            products.append(pulse)
    # include any non-canonical products that received signals
    for product, sigs in by_product.items():
        if product not in CANONICAL_PRODUCTS:
            pulse = build_product_pulse(product, sigs)
            if pulse:
                products.append(pulse)

    last_dts = [_parse_dt(s.get("createdAt")) for s in signals if _parse_dt(s.get("createdAt"))]
    last_updated = max(last_dts) if last_dts else None

    return {
        "marketId": market_id,
        "products": products,
        "overallConfidence": _overall_confidence(products),
        "totalSignals": len(signals),
        "lastUpdated": _humanize_minutes(_minutes_ago(last_updated)),
        "generatedAt": _now().isoformat(),
        "synthetic": True,
    }


def build_pulse_context(pulse: Dict[str, Any], market_name: str) -> str:
    """Compact textual evidence used to ground the Ask BazaarMind answers."""
    lines = [f"Market: {market_name} (Delhi NCR). Overall confidence: {pulse['overallConfidence']}."]
    for p in pulse["products"]:
        price = p["reportedPriceSignal"] or "no price reported"
        lines.append(
            f"- {p['product']}: availability {p['availability']}, demand {p['demand']}, "
            f"reported price signal {price}, evidence {p['vendorObservations']} vendor observations "
            f"+ {p['shopperSignals']} shopper signals, confidence {p['confidence']}"
            + (", vendors reporting conflicting conditions" if p['conflicting'] else "")
            + f", updated {p['lastUpdated']}."
        )
    return "\n".join(lines)
