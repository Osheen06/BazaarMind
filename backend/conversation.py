"""Unified conversation / input layer.

Every channel — PWA, WhatsApp, voice, image, Ask BazaarMind — funnels through
the SAME intelligence engine (gemini_service + intelligence). This module turns
a raw inbound text message into a grounded reply, deciding intent without
duplicating any AI logic.
"""
import re
import logging

import gemini_service
import intelligence

logger = logging.getLogger("bazaarmind.conversation")

_QUESTION_HINTS = ("?", "kya", "kyun", "kaisa", "what", "why", "how", "should", "kaunsa", "kitna")
_LIST_HINTS = ("chahiye", "need", "want", "de do", "lena", "list", "mujhe")


def _looks_like_question(t: str) -> bool:
    low = t.lower()
    return any(h in low for h in _QUESTION_HINTS)


def _looks_like_list(t: str) -> bool:
    low = t.lower()
    if any(h in low for h in _LIST_HINTS):
        return True
    return low.count(",") >= 1


async def process_message(db, text: str, market_id: str, role: str = "shopper") -> dict:
    """Return {intent, reply, data} using the shared engine. Channel-agnostic."""
    text = (text or "").strip()
    if not text:
        return {"intent": "empty", "reply": "Send me your list or a question about the market."}

    # Vendor observation -> structured signal (never auto-published)
    if role == "vendor":
        sig = await gemini_service.interpret_signal(text, session_id="wa-vendor")
        price = f" · ₹{sig['reportedPrice']}/{sig.get('priceUnit') or 'unit'}" if sig.get("reportedPrice") else ""
        reply = (
            f"Here's what BazaarMind understood:\n{sig.get('product')} · availability "
            f"{sig.get('availability')} · demand {sig.get('demand')}{price}\n"
            f"Confidence: {sig.get('confidence')}. Reply CONFIRM to add this signal."
        )
        return {"intent": "vendor_signal", "reply": reply, "data": sig}

    pulse = await intelligence.compute_market_pulse(db, market_id, data_source="DEMO")
    market_name = "your market"

    if _looks_like_question(text) and not _looks_like_list(text):
        if not pulse["products"]:
            return {"intent": "ask", "reply": "I don't have enough signals from this market yet."}
        ctx = intelligence.build_pulse_context(pulse, market_name)
        answer = await gemini_service.ask_bazaar(text, ctx, session_id="wa-ask")
        return {"intent": "ask", "reply": answer}

    # Default: treat as a shopping list
    parsed = await gemini_service.parse_shopping_list(text, session_id="wa-list")
    pulse_map = {p["product"]: p for p in pulse["products"]}
    lines, tight = [], 0
    for it in parsed.get("items", []):
        p = pulse_map.get(it["product"])
        if p:
            flag = "⚠ tight" if p["availabilityCode"] == "LOW" else "✓"
            if p["availabilityCode"] == "LOW":
                tight += 1
            lines.append(f"{flag} {it['product']}: {p['availability']} · {p['demand']} demand"
                         + (f" · {p['reportedPriceSignal']}" if p['reportedPriceSignal'] else ""))
        else:
            lines.append(f"• {it['product']}: not enough signals yet")
    if not lines:
        return {"intent": "list", "reply": "I couldn't spot any items — tell me what you need, e.g. \"2kg tomatoes, coriander, onions\"."}
    reply = "Here's what your market looks like today:\n" + "\n".join(lines)
    if tight:
        reply += f"\n\nBazaarMind noticed {tight} item(s) with tighter availability today."
    return {"intent": "list", "reply": reply, "data": parsed}
