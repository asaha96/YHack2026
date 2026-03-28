from fastapi import APIRouter
from pydantic import BaseModel
from services.agent import process_action
from services.session import get_session, add_to_session

router = APIRouter()


class ActionRequest(BaseModel):
    session_id: str
    action_type: str  # "point", "incision", "pinch"
    coordinates: list[list[float]]  # [[x,y,z], ...]
    surface: str  # organ name
    description: str = ""  # optional natural language from user


class ActionResponse(BaseModel):
    narration: str
    risks: list[dict]
    modifications: list[dict]
    recommendations: list[str]


@router.post("/action", response_model=ActionResponse)
async def handle_action(req: ActionRequest):
    session = get_session(req.session_id)
    result = await process_action(
        session=session,
        action_type=req.action_type,
        coordinates=req.coordinates,
        surface=req.surface,
        description=req.description,
    )
    add_to_session(req.session_id, {"action": req.model_dump(), "response": result})
    return result
