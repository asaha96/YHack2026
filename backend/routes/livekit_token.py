"""
LiveKit token generation endpoint.

Generates JWT access tokens for phone, laptop, and agent participants
to join LiveKit rooms with appropriate permissions.
Also dispatches the SurgiVision agent to the room on first join.
"""

import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from livekit import api

log = logging.getLogger("surgivision-token")

router = APIRouter()

# Track rooms where agent has been dispatched to avoid duplicate dispatches
_dispatched_rooms: set[str] = set()

AGENT_NAME = "surgivision-agent"


class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    participant_type: str  # "phone" | "laptop" | "agent"


class TokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str


async def _dispatch_agent_to_room(room_name: str) -> None:
    """Dispatch the SurgiVision agent to a room if not already dispatched."""
    if room_name in _dispatched_rooms:
        return

    livekit_url = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
    api_key = os.getenv("LIVEKIT_API_KEY", "")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "")

    if not api_key or not api_secret:
        return

    try:
        import aiohttp
        from livekit.api.agent_dispatch_service import AgentDispatchService, CreateAgentDispatchRequest

        # Convert ws:// to http:// for the API call
        http_url = livekit_url.replace("wss://", "https://").replace("ws://", "http://")
        async with aiohttp.ClientSession() as session:
            dispatch_service = AgentDispatchService(session, http_url, api_key, api_secret)
            await dispatch_service.create_dispatch(
                CreateAgentDispatchRequest(
                    room=room_name,
                    agent_name=AGENT_NAME,
                )
            )
        _dispatched_rooms.add(room_name)
        log.info("Dispatched agent '%s' to room '%s'", AGENT_NAME, room_name)
    except Exception as e:
        log.warning("Failed to dispatch agent to room '%s': %s", room_name, e)


@router.post("/livekit/token", response_model=TokenResponse)
async def generate_token(req: TokenRequest):
    """Generate a LiveKit access token for a participant."""
    livekit_url = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
    api_key = os.getenv("LIVEKIT_API_KEY", "")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "")

    if not api_key or not api_secret:
        raise HTTPException(
            status_code=503,
            detail="LiveKit API credentials not configured — set LIVEKIT_API_KEY and LIVEKIT_API_SECRET",
        )

    # Set permissions based on participant type
    if req.participant_type == "phone":
        grants = api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=False,
            can_publish_data=True,
        )
    elif req.participant_type == "laptop":
        grants = api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )
    elif req.participant_type == "agent":
        grants = api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid participant_type: {req.participant_type}",
        )

    token = (
        api.AccessToken(api_key=api_key, api_secret=api_secret)
        .with_identity(f"{req.participant_type}-{req.participant_name}")
        .with_name(req.participant_name)
        .with_grants(grants)
        .to_jwt()
    )

    # Dispatch agent to this room when any participant joins
    if req.participant_type in ("phone", "laptop"):
        await _dispatch_agent_to_room(req.room_name)

    return TokenResponse(
        token=token,
        room_name=req.room_name,
        livekit_url=livekit_url,
    )
