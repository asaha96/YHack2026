"""
LiveKit token generation endpoint.

Generates JWT access tokens for phone, laptop, and agent participants
to join LiveKit rooms with appropriate permissions.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from livekit import api

router = APIRouter()


class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    participant_type: str  # "phone" | "laptop" | "agent"


class TokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str


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

    return TokenResponse(
        token=token,
        room_name=req.room_name,
        livekit_url=livekit_url,
    )
