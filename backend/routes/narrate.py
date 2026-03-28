from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.tts import generate_speech

router = APIRouter()


class NarrateRequest(BaseModel):
    text: str


@router.post("/narrate")
async def handle_narrate(req: NarrateRequest):
    audio_stream = await generate_speech(req.text)
    return StreamingResponse(audio_stream, media_type="audio/mpeg")
