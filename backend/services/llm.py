"""
OpenAI-compatible chat completions (default: K2 Think at api.k2think.ai).

Env:
  K2_API_KEY      — Bearer token (e.g. IFM-...)
  KIMI_BASE_URL   — default https://api.k2think.ai/v1
  KIMI_MODEL      — default MBZUAI-IFM/K2-Think-v2
  KIMI_JSON_MODE  — if 1/true, send response_format json_object (OpenAI-style; K2 Think supports it)

Override KIMI_* to use Moonshot or another OpenAI-compatible provider.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx


class KimiAPIError(Exception):
    """Upstream chat-completions HTTP error (non-retryable or exhausted retries)."""

    def __init__(self, upstream_status: int, detail: str):
        self.upstream_status = upstream_status
        self.detail = detail
        super().__init__(f"Inference API {upstream_status}: {detail[:500]}")


def _base_url() -> str:
    return (os.getenv("KIMI_BASE_URL") or "https://api.k2think.ai/v1").rstrip("/")


def _api_key() -> str:
    return (os.getenv("K2_API_KEY") or "").strip()


def _model() -> str:
    return os.getenv("KIMI_MODEL", "MBZUAI-IFM/K2-Think-v2")


def _model_allows_temperature(model: str) -> bool:
    """Moonshot kimi-k2.5 ignores temperature; K2 Think and most others accept it."""
    return not model.startswith("kimi-k2.5")


def _json_mode_enabled() -> bool:
    v = (os.getenv("KIMI_JSON_MODE") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _extract_message_text(data: dict[str, Any]) -> str:
    """Parse OpenAI-style chat completion JSON; raise KimiAPIError if shape is wrong."""
    try:
        choice = data["choices"][0]
        msg = choice.get("message") or choice.get("delta") or {}
        content = msg.get("content")
        if content is None:
            raise KeyError("missing content")
        if isinstance(content, list):
            # Multimodal / chunk list
            parts = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif isinstance(block, str):
                    parts.append(block)
            return "".join(parts) if parts else str(content)
        return str(content)
    except (KeyError, IndexError, TypeError) as e:
        raise KimiAPIError(
            200,
            f"Unexpected chat/completions response shape: {e!s}. Body: {str(data)[:1200]}",
        ) from e


async def chat_completions(
    messages: list[dict[str, Any]],
    *,
    max_completion_tokens: int = 1500,
    temperature: float | None = None,
) -> str:
    """
    POST .../chat/completions (OpenAI-compatible).
    Raises if K2_API_KEY is missing.
    """
    key = _api_key()
    if not key:
        raise KimiAPIError(
            401,
            "K2_API_KEY is not set. Add it to the project root .env and restart the server.",
        )

    model = _model()
    # K2 Think and many OpenAI-compatible servers expect `max_tokens`; Moonshot also accepts it.
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_completion_tokens,
    }
    if _model_allows_temperature(model):
        payload["temperature"] = 0.7 if temperature is None else temperature
    if _json_mode_enabled():
        payload["response_format"] = {"type": "json_object"}

    last_error: str | None = None
    for attempt in range(3):
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{_base_url()}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=120.0,
                )
            except httpx.RequestError as e:
                raise KimiAPIError(
                    503,
                    f"Cannot reach inference API at {_base_url()}: {e!s}",
                ) from e
            if response.status_code == 429:
                wait = 2**attempt + 1
                print(
                    f"Inference API rate limited, retrying in {wait}s "
                    f"(attempt {attempt + 1}/3)"
                )
                await asyncio.sleep(wait)
                continue
            if response.status_code >= 400:
                raise KimiAPIError(response.status_code, response.text)
            try:
                data = response.json()
            except ValueError as e:
                raise KimiAPIError(
                    200, f"Non-JSON response: {response.text[:800]}"
                ) from e
            return _extract_message_text(data)

    raise KimiAPIError(
        429,
        "Inference API rate limited after 3 retries. Wait and try again.",
    )
