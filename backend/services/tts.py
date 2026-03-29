import os
import httpx
from io import BytesIO


def _get_groq_key() -> str:
    """Optional: Groq is only used for TTS; LLM inference uses Kimi (K2_API_KEY)."""
    return os.getenv("GROQ_API_KEY", "")


async def generate_speech(text: str) -> BytesIO:
    """Generate speech using Groq TTS (PlayAI Dialog). Requires GROQ_API_KEY."""
    if not _get_groq_key():
        raise RuntimeError(
            "GROQ_API_KEY is not set. Narration TTS still uses Groq; "
            "add GROQ_API_KEY for /api/narrate and the LiveKit agent, or disable TTS."
        )
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/speech",
            headers={
                "Authorization": f"Bearer {_get_groq_key()}",
                "Content-Type": "application/json",
            },
            json={
                "model": "playai-tts",
                "input": text,
                "voice": "Arista-PlayAI",
                "response_format": "mp3",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return BytesIO(response.content)
