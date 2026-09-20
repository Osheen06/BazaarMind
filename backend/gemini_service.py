"""BazaarMind Gemini intelligence engine using Google's official GenAI SDK."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env before reading any configuration.
load_dotenv(Path(__file__).resolve().parent / ".env")
import json
import re
import base64
import logging
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal, List

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
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


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _client():
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=GEMINI_API_KEY)



def _explicit_price_unit(text: str) -> Optional[str]:
    """Return a price unit only when the user explicitly stated one."""
    t = (text or "").lower()

    unit_patterns = [
        (r'(?:/|per)\s*(?:kg|kilo|kilogram)', 'kg'),
        (r'\b(?:kg|kilo|kilogram)\b', 'kg'),
        (r'(?:/|per)\s*(?:g|gram|grams)', 'g'),
        (r'\b(?:g|gram|grams)\b', 'g'),
        (r'(?:/|per)\s*(?:bunch|bundle)', 'bunch'),
        (r'\b(?:bunch|bundle)\b', 'bunch'),
        (r'(?:/|per)\s*dozen', 'dozen'),
        (r'\bdozen\b', 'dozen'),
        (r'(?:/|per)\s*(?:piece|pc|pcs)', 'piece'),
        (r'\b(?:piece|pc|pcs)\b', 'piece'),
        (r'(?:/|per)\s*(?:litre|liter|litre)', 'litre'),
        (r'\b(?:litre|liter)\b', 'litre'),
    ]

    import re

    for pattern, unit in unit_patterns:
        if re.search(pattern, t):
            return unit

    return None


def normalize_product(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    key = str(name).strip().lower()
    if key in PRODUCT_ALIASES:
        return PRODUCT_ALIASES[key]
    for canon in CANONICAL_PRODUCTS:
        if canon.lower() == key or canon.lower()[:-1] == key:
            return canon
    for alias, canon in PRODUCT_ALIASES.items():
        if alias in key:
            return canon
    return str(name).strip().title()


def _extract_json(text: str) -> Any:
    if not text:
        raise ValueError("empty Gemini response")
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1)
    return json.loads(cleaned)


class SignalSchema(BaseModel):
    product: str = Field(
        description="Primary product mentioned, in English title case."
    )
    availability: Literal["HIGH", "NORMAL", "LOW", "UNKNOWN"]
    demand: Literal["HIGH", "NORMAL", "LOW", "UNKNOWN"]
    reportedPrice: Optional[float] = Field(
        default=None,
        description="Reported price in rupees, only when explicitly stated."
    )
    priceUnit: Optional[str] = Field(
        default=None,
        description="Explicitly stated price unit such as kg, bunch, or dozen."
    )
    signalType: Literal[
        "DEMAND", "SUPPLY", "AVAILABILITY", "PRICE", "CONTEXT"
    ]
    language: Literal["HINDI", "HINGLISH", "ENGLISH", "OTHER"]
    confidence: Literal["LOW", "MEDIUM", "HIGH"]
    reasoning: str = Field(
        description="Very short explanation, maximum 12 words."
    )
    clarification: Optional[str] = Field(
        default=None,
        description="Short clarification question, maximum 10 words, only if needed."
    )


class ShoppingItem(BaseModel):
    product: str = Field(
        description="Item name in English title case."
    )
    quantity: Optional[str] = Field(
        default=None,
        description="Explicit quantity such as 2kg or 1 bunch. Never invent."
    )


class ShoppingListSchema(BaseModel):
    items: List[ShoppingItem]
    language: Literal["HINDI", "HINGLISH", "ENGLISH", "OTHER"]




SIGNAL_SYSTEM = """You are BazaarMind's market-signal interpreter for neighborhood markets in Delhi NCR.

Convert the user's natural-language statement into the required structured market signal.

Rules:
- Understand Hindi, Hinglish, and English.
- Normalize common Hindi/Hinglish product names to English product names.
- Distinguish demand from supply/availability.
- "Bahut bik raha hai", "bahut chal raha hai", or similar language usually indicates HIGH demand, not low supply.
- "Kam aaya hai", "stock kam hai", "nahi aaya" or similar language indicates LOW availability/supply when that is what the statement means.
- Never invent an exact price.
- Only populate reportedPrice when the user explicitly states a price.
- Never invent quantities.
- A vendor observation is a signal, not verified market truth.
- If the statement is vague or ambiguous, use UNKNOWN where appropriate and lower confidence.
- If an important clarification is needed, provide a short clarification question.
- Preserve the distinction between price, demand, availability, and context.
- Do not claim that a price is official, guaranteed, cheapest, or universally true.
- Confidence reflects the clarity of the statement, not whether the claim has been independently verified.
"""



async def interpret_signal(text: str, image_base64: Optional[str] = None, session_id: str = "signal", image_mime_type: str = "image/jpeg") -> Dict[str, Any]:
    del session_id
    client = _client()
    prompt = "Interpret this market statement into the required JSON schema. Preserve uncertainty.\nStatement: " + (text or "(no text, see image)")
    contents = [prompt]
    if image_base64:
        try:
            raw = base64.b64decode(image_base64, validate=True)
        except Exception as exc:
            raise ValueError("invalid imageBase64") from exc
        if len(raw) > 8 * 1024 * 1024:
            raise ValueError("image is too large; maximum is 8 MB")
        contents.append(types.Part.from_bytes(data=raw, mime_type=image_mime_type or "image/jpeg"))
        contents.append("Use the image only as supporting visible evidence. Never infer exact inventory quantities.")

    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SIGNAL_SYSTEM,
            response_mime_type="application/json",
            response_schema=SignalSchema,
            max_output_tokens=1200,
        ),
    )
    # Prefer the SDK's parsed Pydantic object.
    parsed = getattr(response, "parsed", None)

    if parsed is not None:
        if hasattr(parsed, "model_dump"):
            data = parsed.model_dump()
        elif isinstance(parsed, dict):
            data = parsed
        else:
            data = dict(parsed)
    else:
        # Fallback: validate the complete JSON returned by Gemini.
        raw_text = (response.text or "").strip()
        if not raw_text:
            raise RuntimeError("Gemini returned an empty structured response.")

        try:
            data = SignalSchema.model_validate_json(raw_text).model_dump()
        except Exception as exc:
            finish_reason = None
            try:
                finish_reason = response.candidates[0].finish_reason
            except Exception:
                pass

            raise RuntimeError(
                f"Gemini returned invalid structured output "
                f"(finish_reason={finish_reason}): {raw_text[:1000]}"
            ) from exc

    data["product"] = normalize_product(data.get("product"))

    # Never let Gemini invent a price unit that was not explicitly stated.
    data["priceUnit"] = _explicit_price_unit(text)

    for key in ("availability", "demand", "signalType", "language", "confidence"):
        if data.get(key):
            data[key] = str(data[key]).upper()
    if data.get("reportedPrice") is not None:
        try:
            data["reportedPrice"] = float(data["reportedPrice"])
        except (TypeError, ValueError):
            data["reportedPrice"] = None
    return data


LIST_SYSTEM = """You are BazaarMind's shopping-list parser for Delhi NCR markets.
Extract requested fruits and vegetables from Hindi, Hinglish, or English.
Never invent quantities. Ignore filler words.
"""


async def parse_shopping_list(text: str, session_id: str = "list") -> Dict[str, Any]:
    del session_id
    client = _client()
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=f'Parse this shopping list:\n"{text}"',
        config=types.GenerateContentConfig(
            system_instruction=LIST_SYSTEM,
            response_mime_type="application/json",
            response_schema=ShoppingListSchema,
            max_output_tokens=500,
        ),
    )
    # Gemini structured output is already parsed by the Google GenAI SDK.
    parsed = getattr(response, "parsed", None)

    if parsed is not None:
        if hasattr(parsed, "model_dump"):
            data = parsed.model_dump()
        elif isinstance(parsed, dict):
            data = parsed
        else:
            data = dict(parsed)
    else:
        data = _extract_json(response.text)

    items = []
    for item in data.get("items", []):
        product = normalize_product(item.get("product"))
        if product:
            items.append({"product": product, "quantity": item.get("quantity")})
    data["items"] = items
    return data


ASK_SYSTEM = """You are BazaarMind, a calm, trustworthy local market intelligence assistant for Delhi NCR neighborhood markets.
Answer ONLY from the supplied market evidence.
Rules:
- AI interprets. Humans decide.
- Prices are reported signals, never guaranteed.
- Never say official price, correct price, cheapest vendor, or rank vendors.
- Never invent real-time facts, numbers, or vendors.
- If evidence is insufficient, say: "I don't have enough verified signals to answer that yet."
- One vendor claim is not market truth; reference corroboration and confidence naturally.
- Reply in the user's language style: Hindi, Hinglish, or English.
- Keep answers concise: 2-5 short sentences or tight bullets.
"""


async def ask_bazaar(question: str, market_context: str, session_id: str = "ask", data_source: str = "DEMO") -> str:
    del session_id
    client = _client()
    source_label = "synthetic DEMO signals" if data_source == "DEMO" else f"{data_source} signals"
    prompt = f"Market evidence source: {source_label}.\n{market_context}\n\nUser question: \"{question}\"\n\nAnswer strictly from the evidence above."
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=ASK_SYSTEM,
            max_output_tokens=500,
        ),
    )
    return (response.text or "").strip()
