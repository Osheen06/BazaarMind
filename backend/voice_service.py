"""Server-side speech-to-text for vendor voice notes.

Uses OpenAI Whisper (whisper-1) via emergentintegrations + the Emergent
Universal LLM key. Works on any phone that can upload audio (unlike the
browser-only Web Speech API). The original transcript is always preserved and
returned verbatim; Gemini interpretation happens as a separate, reviewable step.
"""
import os
import tempfile
import logging

from emergentintegrations.llm.openai import OpenAISpeechToText

logger = logging.getLogger("bazaarmind.voice")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "whisper-1")

ALLOWED_EXT = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}


def is_configured() -> bool:
    return bool(EMERGENT_LLM_KEY)


async def transcribe_audio(content: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio bytes to text. Auto-detects Hindi/Hinglish/English."""
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "webm").lower()
    if ext not in ALLOWED_EXT:
        ext = "webm"
    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    tmp = tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False)
    try:
        tmp.write(content)
        tmp.flush()
        tmp.close()
        with open(tmp.name, "rb") as audio_file:
            response = await stt.transcribe(
                file=audio_file,
                model=WHISPER_MODEL,
                response_format="json",
            )
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
    return getattr(response, "text", str(response)).strip()
