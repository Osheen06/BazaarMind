"""WhatsApp Business Cloud API integration layer.

Status: integration ready — production credentials required.

If WHATSAPP_VERIFY_TOKEN / WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID /
META_APP_SECRET are absent, the webhook cannot be verified and messages cannot
be sent — we NEVER simulate a live WhatsApp connection or fabricate delivery.

The webhook routes inbound messages into the SAME intelligence engine used by
the PWA (gemini_service + intelligence via conversation.process_message). No
business logic is duplicated for WhatsApp.
"""
import os
import hmac
import hashlib
import logging

import httpx

logger = logging.getLogger("bazaarmind.whatsapp")

VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN") or ""
ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN") or ""
PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID") or ""
APP_SECRET = os.environ.get("META_APP_SECRET") or ""
GRAPH_VERSION = os.environ.get("META_GRAPH_VERSION", "v25.0")


def is_configured() -> bool:
    return all((VERIFY_TOKEN, ACCESS_TOKEN, PHONE_NUMBER_ID, APP_SECRET))


def status() -> dict:
    return {
        "configured": is_configured(),
        "verifyToken": bool(VERIFY_TOKEN),
        "accessToken": bool(ACCESS_TOKEN),
        "phoneNumberId": bool(PHONE_NUMBER_ID),
        "appSecret": bool(APP_SECRET),
        "graphVersion": GRAPH_VERSION,
        "webhookPath": "/api/whatsapp/webhook",
        "label": "WhatsApp integration ready — production credentials required"
        if not is_configured() else "WhatsApp integration live",
    }


def verify_challenge(mode: str, token: str, challenge: str):
    if mode == "subscribe" and token and hmac.compare_digest(token, VERIFY_TOKEN):
        return challenge
    return None


def valid_signature(raw: bytes, header: str | None) -> bool:
    if not APP_SECRET or not header or not header.startswith("sha256="):
        return False
    received = header.removeprefix("sha256=")
    expected = hmac.new(APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(received, expected)


async def send_text(to: str, body: str) -> dict:
    if not is_configured():
        return {"sent": False, "reason": "not_configured"}
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body[:4096]},
    }
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.post(
            url,
            headers={"Authorization": f"Bearer {ACCESS_TOKEN}", "Content-Type": "application/json"},
            json=payload,
        )
    if r.is_error:
        logger.error("WhatsApp send failed: %s", r.status_code)
        return {"sent": False, "status": r.status_code}
    return {"sent": True, "response": r.json()}


def extract_text_messages(event: dict):
    """Yield (from_number, text, wamid) for inbound text messages only."""
    for entry in event.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for message in value.get("messages", []):
                if message.get("type") == "text":
                    yield (
                        message.get("from"),
                        (message.get("text") or {}).get("body", ""),
                        message.get("id"),
                    )
