from fastapi import APIRouter
from pydantic import BaseModel
from services.agent import generate_summary
from services.session import get_session

router = APIRouter()


class SummaryResponse(BaseModel):
    approach: str
    risk_inventory: list[dict]
    scenarios_explored: list[dict]
    contingencies: list[str]
    full_text: str


@router.get("/summary/{session_id}", response_model=SummaryResponse)
async def handle_summary(session_id: str):
    session = get_session(session_id)
    return await generate_summary(session)
