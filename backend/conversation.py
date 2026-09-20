"""
Unified conversation / input layer for BazaarMind.

Every conversational channel funnels through the same intelligence stack:

    PWA
    WhatsApp
    Voice transcription
    Shopper messages
    Vendor observations
            ↓
        conversation.py
            ↓
        gemini_service
            ↓
      intelligence engine
            ↓
       grounded reply

Important:
- AI interprets signals.
- AI does not independently verify vendor claims.
- Market Pulse is always grounded in stored signals.
- DEMO and PILOT data sources remain separate.
"""

import logging
from typing import Optional

import gemini_service
import intelligence


logger = logging.getLogger(
    "bazaarmind.conversation"
)


# ---------------------------------------------------------
# Intent hints
# ---------------------------------------------------------

_QUESTION_HINTS = (
    "?",
    "kya",
    "kyun",
    "kaisa",
    "kaisi",
    "what",
    "why",
    "how",
    "should",
    "kaunsa",
    "kaunsi",
    "kitna",
    "kitni",
    "which",
    "where",
    "when",
)

_LIST_HINTS = (
    "chahiye",
    "need",
    "want",
    "de do",
    "lena",
    "leni",
    "list",
    "mujhe",
    "buy",
    "shopping",
)


# ---------------------------------------------------------
# Intent helpers
# ---------------------------------------------------------

def _looks_like_question(
    text: str,
) -> bool:
    """
    Lightweight deterministic question detection.

    Gemini is used for interpretation of market meaning,
    not for basic routing when simple rules are sufficient.
    """

    low = text.lower()

    return any(
        hint in low
        for hint in _QUESTION_HINTS
    )


def _looks_like_list(
    text: str,
) -> bool:
    """
    Detect likely shopping-list messages.
    """

    low = text.lower()

    if any(
        hint in low
        for hint in _LIST_HINTS
    ):
        return True

    # Comma-separated input is usually a list.
    if low.count(",") >= 1:
        return True

    # Common shopping-list connectors.
    if " aur " in low:
        return True

    if " and " in low:
        return True

    return False


# ---------------------------------------------------------
# Main conversation processor
# ---------------------------------------------------------

async def process_message(
    db,
    text: str,
    market_id: str,
    role: str = "shopper",
    data_source: str = "DEMO",
) -> dict:
    """
    Process one conversational message.

    Parameters
    ----------
    db:
        MongoDB database handle.

    text:
        Raw user/vendor message.

    market_id:
        BazaarMind market context.

    role:
        "shopper" or "vendor".

    data_source:
        "DEMO", "PILOT", or "REAL".

    Returns
    -------
    dict
        {
            "intent": ...,
            "reply": ...,
            "data": ...
        }
    """

    # -----------------------------------------------------
    # Normalize input
    # -----------------------------------------------------

    text = (
        text or ""
    ).strip()

    if not text:
        return {
            "intent": "empty",
            "reply": (
                "Send me your shopping list or "
                "ask me something about the market."
            ),
        }

    # -----------------------------------------------------
    # Normalize data source
    # -----------------------------------------------------

    if data_source not in (
        "DEMO",
        "PILOT",
        "REAL",
    ):
        data_source = "DEMO"

    # -----------------------------------------------------
    # Vendor flow
    # -----------------------------------------------------

    if role == "vendor":

        try:
            signal = (
                await gemini_service.interpret_signal(
                    text,
                    session_id="conversation-vendor",
                )
            )

        except Exception:
            logger.exception(
                "Vendor signal interpretation failed"
            )

            return {
                "intent": "vendor_signal",
                "reply": (
                    "I couldn't understand that market "
                    "observation right now. Please try "
                    "again with the product and what "
                    "you are seeing."
                ),
            }

        product = (
            signal.get("product")
            or "Unknown product"
        )

        availability = (
            signal.get("availability")
            or "UNKNOWN"
        )

        demand = (
            signal.get("demand")
            or "UNKNOWN"
        )

        confidence = (
            signal.get("confidence")
            or "LOW"
        )

        price = signal.get(
            "reportedPrice"
        )

        price_unit = (
            signal.get("priceUnit")
            or "unit"
        )

        if price is not None:
            price_text = (
                f" · ₹{price}/{price_unit}"
            )
        else:
            price_text = ""

        reply = (
            "Here's what BazaarMind understood:\n"
            f"{product} · availability "
            f"{availability} · demand {demand}"
            f"{price_text}\n"
            f"Confidence: {confidence}.\n\n"
            "Reply CONFIRM to add this observation "
            "to the market signal stream."
        )

        return {
            "intent": "vendor_signal",
            "reply": reply,
            "data": signal,
            "dataSource": data_source,
            "marketId": market_id,
        }

    # -----------------------------------------------------
    # Shopper market context
    # -----------------------------------------------------

    pulse = (
        await intelligence.compute_market_pulse(
            db,
            market_id,
            data_source=data_source,
        )
    )

    # -----------------------------------------------------
    # Question flow
    # -----------------------------------------------------

    if (
        _looks_like_question(text)
        and not _looks_like_list(text)
    ):

        if not pulse["products"]:

            return {
                "intent": "ask",
                "reply": (
                    "I don't have enough signals from "
                    "this market yet."
                ),
                "dataSource": data_source,
                "marketId": market_id,
            }

        context = (
            intelligence.build_pulse_context(
                pulse,
                market_name="your market",
            )
        )

        try:
            answer = (
                await gemini_service.ask_bazaar(
                    text,
                    context,
                    session_id="conversation-ask",
                )
            )

        except Exception:
            logger.exception(
                "Ask BazaarMind failed"
            )

            return {
                "intent": "ask",
                "reply": (
                    "BazaarMind couldn't answer that "
                    "right now. Please try again."
                ),
                "dataSource": data_source,
                "marketId": market_id,
            }

        return {
            "intent": "ask",
            "reply": answer,
            "data": {
                "pulse": pulse,
            },
            "dataSource": data_source,
            "marketId": market_id,
        }

    # -----------------------------------------------------
    # Shopper shopping-list flow
    # -----------------------------------------------------

    try:
        parsed = (
            await gemini_service.parse_shopping_list(
                text,
                session_id="conversation-list",
            )
        )

    except Exception:
        logger.exception(
            "Shopping-list parsing failed"
        )

        return {
            "intent": "list",
            "reply": (
                "I couldn't read that shopping list "
                "right now. Try something like "
                "\"2kg tomatoes, coriander, onions\"."
            ),
            "dataSource": data_source,
            "marketId": market_id,
        }

    pulse_map = {
        product["product"]: product
        for product in pulse["products"]
    }

    lines = []
    tight = 0

    # -----------------------------------------------------
    # Ground every parsed product in Market Pulse
    # -----------------------------------------------------

    for item in parsed.get(
        "items",
        [],
    ):

        product_name = item.get(
            "product"
        )

        if not product_name:
            continue

        pulse_product = (
            pulse_map.get(
                product_name
            )
        )

        if pulse_product:

            availability_code = (
                pulse_product.get(
                    "availabilityCode"
                )
            )

            if availability_code == "LOW":
                flag = "⚠"
                tight += 1
            else:
                flag = "✓"

            line = (
                f"{flag} {product_name}: "
                f"{pulse_product.get('availability', 'Unknown')} "
                f"· {pulse_product.get('demand', 'Unknown')} demand"
            )

            price_signal = (
                pulse_product.get(
                    "reportedPriceSignal"
                )
            )

            if price_signal:
                line += (
                    f" · {price_signal}"
                )

            lines.append(line)

        else:

            lines.append(
                f"• {product_name}: "
                "not enough signals yet"
            )

    # -----------------------------------------------------
    # No recognized products
    # -----------------------------------------------------

    if not lines:

        return {
            "intent": "list",
            "reply": (
                "I couldn't spot any items. "
                "Tell me what you need, for example: "
                "\"2kg tomatoes, coriander, onions\"."
            ),
            "dataSource": data_source,
            "marketId": market_id,
        }

    # -----------------------------------------------------
    # Build shopper response
    # -----------------------------------------------------

    reply = (
        "Here's what your market looks like today:\n"
        + "\n".join(lines)
    )

    if tight:
        reply += (
            f"\n\nBazaarMind noticed "
            f"{tight} item"
            f"{'s' if tight != 1 else ''} "
            "with tighter availability today."
        )

    return {
        "intent": "list",
        "reply": reply,
        "data": parsed,
        "dataSource": data_source,
        "marketId": market_id,
    }