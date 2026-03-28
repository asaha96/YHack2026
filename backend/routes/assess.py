from fastapi import APIRouter
from pydantic import BaseModel
from services.scenario import parse_injuries
from services.session import add_to_session

router = APIRouter()


class AssessRequest(BaseModel):
    session_id: str
    transcript: str


class Injury(BaseModel):
    location: str
    type: str
    severity: str


class AssessResponse(BaseModel):
    injuries: list[Injury]
    consciousness: str
    age_estimate: str
    mechanism: str
    summary: str


@router.post("/assess", response_model=AssessResponse)
async def handle_assess(req: AssessRequest):
    result = await parse_injuries(req.transcript)

    add_to_session(req.session_id, {"type": "assessment", "data": result})

    return AssessResponse(
        injuries=[Injury(**inj) for inj in result.get("injuries", [])],
        consciousness=result.get("consciousness", "unknown"),
        age_estimate=result.get("age_estimate", "unknown"),
        mechanism=result.get("mechanism", "unknown"),
        summary=result.get("summary", req.transcript),
    )
