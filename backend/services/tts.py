import os
import httpx
from io import BytesIO

ELEVENLABS_VOICE_ID = "UgBBYS2sOqTuMpoF3BR0"


def _get_elevenlabs_key() -> str:
    return os.getenv("ELEVENLABS_API_KEY", "")


async def generate_speech(text: str) -> BytesIO:
    """Generate speech using ElevenLabs TTS."""
    key = _get_elevenlabs_key()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set.")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
            headers={
                "xi-api-key": key,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                },
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return BytesIO(response.content)
