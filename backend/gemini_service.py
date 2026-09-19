"""BazaarMind Gemini intelligence engine.

All Gemini calls are server-side only. The model is configurable via GEMINI_MODEL.
Gemini is the interpreter, not the product: it turns messy multilingual market
language into structured, uncertainty-preserving signals.
"""
import os
import json
import re
import logging
from typing import Optional, Dict, Any, List

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-pro-preview")

CANONICAL_PRODUCTS = [
    "Tomatoes", "Potatoes", "Onions", "Coriander",
    "Bananas", "Green Chilies", "Carrots", "Spinach",
]

PRODUCT_ALIASES = {
    "tamatar": "Tomatoes", "tomato": "Tomatoes", "tomatoes": "Tomatoes", "टमाटर": "Tomatoes",
    "aloo": "Potatoes", "potato": "Potatoes", "potatoes": "Potatoes", "आलू": "Potatoes",
    "pyaz": "Onions", "pyaaz": "Onions", "onion": "Onions", "onions": "Onions", "प्याज": "Onions",
    "dhaniya": "Coriander", "dhania": "Coriander", "coriander": "Coriander", "cilantro": "Coriander", "धनिया": "Coriander",
    "kela": "Bananas", "banana": "Bananas", "bananas": "Bananas", "केला": "Bananas",
    "hari mirch": "Green Chilies", "mirch": "Green Chilies", "chili": "Green Chilies",
    "chilli": "Green Chilies", "chillies": "Green Chilies", "green chili": "Green Chilies",
    "green chilies": "Green Chilies", "मिर्च": "Green Chilies",
    "gajar": "Carrots", "carrot": "Carrots", "carrots": "Carrots", "गाजर": "Carrots",
    "palak": "Spinach", "spinach": "Spinach", "पालक": "Spinach",
}


def normalize_product(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    key = name.strip().lower()
    if key in PRODUCT_ALIASES:
        return PRODUCT_ALIASES[key]
    for canon in CANONICAL_PRODUCTS:
        if canon.lower() == key or canon.lower()[:-1] == key:
            return canon
    for alias, canon in PRODUCT_ALIASES.items():
        if alias in key:
            return canon
    return name.strip().title()


def _new_chat(session_id: str, system_message: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("gemini", GEMINI_MODEL)


def _extract_json(text: str) -> Any:
    if not text:
        raise ValueError("empty response")
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    # Grab first {...} or [...] block
    match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1)
    return json.loads(cleaned)


SIGNAL_SYSTEM = """You are BazaarMind's signal interpreter for Delhi NCR neighborhood vegetable/fruit markets.
You convert a vendor or shopper's natural multilingual statement (Hindi, Hinglish, English) into ONE structured market signal.

You output ONLY valid JSON, no prose, matching exactly this schema:
{
  "product": string,                 // the primary product mentioned, in English title case
  "availability": "HIGH" | "NORMAL" | "LOW" | "UNKNOWN",
  "demand": "HIGH" | "NORMAL" | "LOW" | "UNKNOWN",
  "reportedPrice": number | null,    // rupees, only if a price is explicitly stated
  "priceUnit": string | null,        // e.g. "kg", "bunch", "dozen"
  "signalType": "DEMAND" | "SUPPLY" | "AVAILABILITY" | "PRICE" | "CONTEXT",
  "language": "HINDI" | "HINGLISH" | "ENGLISH" | "OTHER",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": string,               // one short sentence, plain language
  "clarification": string | null     // if the statement is too ambiguous, a short question; else null
}

Strict rules:
- NEVER invent a price. If no price is explicitly stated, reportedPrice = null and priceUnit = null.
- NEVER invent quantities.
- If the product is unclear, product = "Unknown" and availability/demand = "UNKNOWN".
- Distinguish DEMAND from SUPPLY. "bahut chal raha hai" / "sab maang rahe hain" indicates HIGH demand, NOT low supply.
- "kam aaya hai" / "stock low" indicates LOW availability (SUPPLY).
- A vendor observation is a SIGNAL, not verified market truth. Preserve uncertainty.
- Keep confidence LOW when the statement is vague or a single unverified claim.
"""


async def interpret_signal(text: str, image_base64: Optional[str] = None, session_id: str = "signal") -> Dict[str, Any]:
    chat = _new_chat(session_id, SIGNAL_SYSTEM)
    prompt = f'Interpret this market statement into the JSON signal schema.\nStatement: "{text or "(no text, see image)"}"'
    if image_base64:
        prompt += "\nAn image of the stall is also attached. Use ONLY visible evidence from the image. Never claim exact inventory counts from a photo."
        msg = UserMessage(text=prompt, file_contents=[ImageContent(image_base64=image_base64)])
    else:
        msg = UserMessage(text=prompt)
    raw = await chat.send_message(msg)
    data = _extract_json(raw)
    data["product"] = normalize_product(data.get("product"))
    for k in ("availability", "demand", "signalType", "language", "confidence"):
        if data.get(k):
            data[k] = str(data[k]).upper()
    return data


LIST_SYSTEM = """You are BazaarMind's shopping-list parser for Delhi NCR markets.
A shopper types what they need in Hindi, Hinglish or English. Extract the items.
Output ONLY valid JSON:
{
  "items": [
    { "product": string, "quantity": string | null }
  ],
  "language": "HINDI" | "HINGLISH" | "ENGLISH" | "OTHER"
}
Rules:
- product must be the item name in English title case.
- quantity only if explicitly stated (e.g. "2kg", "1 bunch"); otherwise null. Never invent quantities.
- Ignore filler words.
"""


async def parse_shopping_list(text: str, session_id: str = "list") -> Dict[str, Any]:
    chat = _new_chat(session_id, LIST_SYSTEM)
    raw = await chat.send_message(UserMessage(text=f'Parse this shopping list:\n"{text}"'))
    data = _extract_json(raw)
    items = []
    for it in data.get("items", []):
        prod = normalize_product(it.get("product"))
        if prod:
            items.append({"product": prod, "quantity": it.get("quantity")})
    data["items"] = items
    return data


ASK_SYSTEM = """You are BazaarMind, a calm, trustworthy local market intelligence assistant for Delhi NCR neighborhood markets.
You answer a shopper's or vendor's question using ONLY the market signal evidence provided to you in the context.

Principles:
- AI interprets. Humans decide.
- Prices are reported signals, never guaranteed. Say "reported price signal" / "observed range".
- Never say "official price", "correct price", "cheapest vendor", or rank vendors.
- Never invent real-time facts, numbers, or vendors that are not in the context.
- If the evidence is insufficient, say exactly: "I don't have enough verified signals to answer that yet."
- One vendor's claim is not market truth. Reference corroboration and confidence naturally.
- Reply in the same language style the user used (Hindi/Hinglish/English). Keep it warm, concise, 2-5 short sentences or tight bullets.
- Never output raw JSON or code.
"""


async def ask_bazaar(question: str, market_context: str, session_id: str = "ask") -> str:
    chat = _new_chat(session_id, ASK_SYSTEM)
    prompt = (
        f"Today's market evidence (synthetic demo signals):\n{market_context}\n\n"
        f'User question: "{question}"\n\n'
        "Answer grounded strictly in the evidence above."
    )
    return await chat.send_message(UserMessage(text=prompt))
