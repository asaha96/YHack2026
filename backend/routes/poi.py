import json
import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.agent import _call_groq

router = APIRouter()

POI_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "poi_config.json")


@router.get("/poi")
async def get_poi():
    if os.path.exists(POI_PATH):
        with open(POI_PATH) as f:
            return json.load(f)
    return {"points_of_interest": []}


class NarrateRequest(BaseModel):
    poi_id: str
    context: str = ""


@router.post("/poi/narrate")
async def narrate_poi(req: NarrateRequest):
    with open(POI_PATH) as f:
        data = json.load(f)

    poi = next((p for p in data["points_of_interest"] if p["id"] == req.poi_id), None)
    if not poi:
        return JSONResponse(status_code=404, content={"error": "POI not found"})

    # If there's additional context (e.g., "what if I cut here"), get a dynamic response
    if req.context:
        messages = [
            {"role": "system", "content": f"You are a surgical AI assistant. The surgeon is currently looking at: {poi['label']}. Base narration: {poi['narration']}"},
            {"role": "user", "content": req.context},
        ]
        try:
            response = await _call_groq(messages, max_tokens=300)
            return {"narration": response, "poi": poi}
        except Exception:
            return {"narration": poi["narration"], "poi": poi}

    return {"narration": poi["narration"], "poi": poi}
