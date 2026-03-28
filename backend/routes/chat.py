from fastapi import APIRouter
from pydantic import BaseModel
from services.agent import process_chat
from services.session import get_session, add_to_session

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    narration: str
    risks: list[dict]
    modifications: list[dict]
    recommendations: list[str]


@router.post("/chat", response_model=ChatResponse)
async def handle_chat(req: ChatRequest):
    session = get_session(req.session_id)
    result = await process_chat(session=session, message=req.message)
    add_to_session(req.session_id, {"chat": req.message, "response": result})
    return result
