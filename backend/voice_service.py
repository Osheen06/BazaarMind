"""Server-side speech-to-text using Gemini 3.5 Transcribe."""

import asyncio
import os
import tempfile
from pathlib import Path

from google import genai
from google.genai import types


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

TRANSCRIBE_MODEL = os.environ.get(
    "GEMINI_TRANSCRIBE_MODEL",
    "gemini-3.5-transcribe",
)

ALLOWED_EXT = {
    "mp3",
    "mp4",
    "mpeg",
    "mpga",
    "m4a",
    "wav",
    "webm",
    "ogg",
    "flac",
    "aac",
}

MIME_BY_EXT = {
    "mp3": "audio/mp3",
    "mp4": "audio/mp4",
    "mpeg": "audio/mpeg",
    "mpga": "audio/mpeg",
    "m4a": "audio/m4a",
    "wav": "audio/wav",
    "webm": "audio/webm",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "aac": "audio/aac",
}


def is_configured() -> bool:
    """Return whether Gemini speech transcription is configured."""
    return bool(GEMINI_API_KEY)


async def transcribe_audio(
    content: bytes,
    filename: str = "audio.webm",
) -> str:
    """
    Transcribe uploaded audio using Gemini 3.5 Transcribe.

    Uses the current Gemini Interactions API so the transcription
    is returned through interaction.output_text.
    """

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    if not content:
        raise ValueError("empty audio")

    ext = (
        filename.rsplit(".", 1)[-1].lower()
        if "." in filename
        else "webm"
    )

    if ext not in ALLOWED_EXT:
        raise ValueError(f"unsupported audio format: {ext}")

    mime = MIME_BY_EXT[ext]

    with tempfile.NamedTemporaryFile(
        suffix=f".{ext}",
        delete=False,
    ) as tmp:
        tmp.write(content)
        temp_path = Path(tmp.name)

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        # Upload the audio through the Gemini Files API.
        audio_file = await asyncio.to_thread(
            client.files.upload,
            file=str(temp_path),
            config=types.UploadFileConfig(
                mime_type=mime,
            ),
        )

        # Gemini 3.5 Transcribe uses the Interactions API.
        interaction = await asyncio.to_thread(
            client.interactions.create,
            model=TRANSCRIBE_MODEL,
            input=[
                {
                    "type": "audio",
                    "uri": audio_file.uri,
                    "mime_type": audio_file.mime_type or mime,
                }
            ],
            generation_config={
                "transcription_config": {
                    "mode": "smart",
                    "language_codes": [],
                }
            },
        )

        transcript = (interaction.output_text or "").strip()

        if not transcript:
            raise RuntimeError(
                "Gemini returned an empty transcription"
            )

        return transcript

    finally:
        try:
            temp_path.unlink()
        except OSError:
            pass