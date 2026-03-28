from fastapi import APIRouter
from pydantic import BaseModel
from services.scenario import generate_scenarios
from services.session import get_session, add_to_session

router = APIRouter()


class ScenarioRequest(BaseModel):
    session_id: str


class Step(BaseModel):
    order: int
    action: str
    duration_sec: int = 0
    critical: bool = False
    warning: str = ""


class Scenario(BaseModel):
    name: str
    survival_probability: float
    time_estimate_min: float
    steps: list[Step]
    equipment_needed: list[str]
    risks: list[str]
    rationale: str


class ScenarioResponse(BaseModel):
    scenarios: list[Scenario]


@router.post("/scenario", response_model=ScenarioResponse)
async def handle_scenario(req: ScenarioRequest):
    session = get_session(req.session_id)

    # Extract scene and assessment from session history
    scene_context = {}
    patient_assessment = {}
    equipment = []
    responders = 1
    hospital_distance = "unknown"

    for entry in session:
        if entry.get("type") == "scene":
            scene_context = entry["data"]
            equipment = scene_context.get("equipment", [])
            responders = scene_context.get("responders", 1)
            hospital_distance = scene_context.get("hospital_distance", "unknown")
        elif entry.get("type") == "assessment":
            patient_assessment = entry["data"]

    scenarios = await generate_scenarios(
        scene_context=scene_context,
        patient_assessment=patient_assessment,
        equipment=equipment,
        responders=responders,
        hospital_distance=hospital_distance,
    )

    add_to_session(req.session_id, {"type": "scenarios", "data": scenarios})

    parsed = []
    for s in scenarios[:3]:
        steps = []
        for st in s.get("steps", []):
            steps.append(Step(
                order=st.get("order", 0),
                action=st.get("action", ""),
                duration_sec=st.get("duration_sec", 0),
                critical=st.get("critical", False),
                warning=st.get("warning", ""),
            ))
        parsed.append(Scenario(
            name=s.get("name", "Plan"),
            survival_probability=s.get("survival_probability", 0),
            time_estimate_min=s.get("time_estimate_min", 0),
            steps=steps,
            equipment_needed=s.get("equipment_needed", []),
            risks=s.get("risks", []),
            rationale=s.get("rationale", ""),
        ))

    return ScenarioResponse(scenarios=parsed)
