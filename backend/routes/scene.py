from fastapi import APIRouter
from pydantic import BaseModel
from services.scenario import analyze_scene
from services.session import add_to_session

router = APIRouter()


class SceneRequest(BaseModel):
    session_id: str
    image_base64: str | None = None
    location_type: str = ""
    weather: str = ""
    equipment: list[str] = []
    responders: int = 1
    hospital_distance: str = ""
    hazards: list[str] = []


class SceneResponse(BaseModel):
    terrain: str
    hazards: list[str]
    equipment_visible: list[str]
    people_count: int
    lighting: str
    notes: str


@router.post("/scene", response_model=SceneResponse)
async def handle_scene(req: SceneRequest):
    form_data = {
        "location_type": req.location_type,
        "weather": req.weather,
        "equipment": req.equipment,
        "responders": req.responders,
        "hospital_distance": req.hospital_distance,
        "hazards": req.hazards,
    }

    result = await analyze_scene(req.image_base64, form_data)

    add_to_session(req.session_id, {"type": "scene", "data": result})

    return SceneResponse(
        terrain=result.get("terrain", "unknown"),
        hazards=result.get("hazards", []),
        equipment_visible=result.get("equipment_visible", []),
        people_count=result.get("people_count", 1),
        lighting=result.get("lighting", "unknown"),
        notes=result.get("notes", ""),
    )
