import json
import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.agent import _call_groq
from services.session import add_to_session

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


class GenerateRequest(BaseModel):
    session_id: str
    anatomy_context: str = "abdominal CT scan showing liver, stomach, kidneys, aorta, portal vein, lungs, spine, and surrounding vasculature"


@router.post("/poi/generate")
async def generate_annotations(req: GenerateRequest):
    """AI agent auto-generates surgical annotations for the anatomy."""
    prompt = f"""You are a surgical planning AI. Analyze this patient's reconstructed anatomy and generate exactly 8 surgical annotations.

Anatomy: {req.anatomy_context}

For each annotation, provide:
- id: short snake_case identifier
- label: short display name (2-5 words)
- type: "danger" (don't cut/watch out), "action" (recommended incision/approach), or "info" (structural note)
- narration: 1-2 sentence surgical insight (be specific with distances, structure names)
- position: [x, y, z] coordinates in the anatomy space (use range -200 to 200 for x/z, 800-1300 for y which is the vertical axis)

Return JSON array:
[
  {{"id": "...", "label": "...", "type": "danger|action|info", "narration": "...", "position": [x, y, z]}}
]

Mix of types: ~3 danger, ~3 action, ~2 info. Be specific and clinically accurate."""

    try:
        messages = [{"role": "user", "content": prompt}]
        response = await _call_groq(messages, max_tokens=1200)

        # Parse JSON from response
        text = response.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]

        try:
            annotations = json.loads(text)
        except json.JSONDecodeError:
            # Find first [ ... ]
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                annotations = json.loads(text[start:end])
            else:
                annotations = []

        if not isinstance(annotations, list):
            annotations = []

        # Add camera positions (offset from annotation position)
        for ann in annotations:
            pos = ann.get("position", [0, -100, 1000])
            ann["camera_position"] = [pos[0] + 150, pos[1] + 50, pos[2] + 200]
            ann["camera_target"] = pos
            ann["tags"] = [ann.get("type", "info"), ann.get("id", "")]

        # Store in session for report generation
        add_to_session(req.session_id, {"type": "ai_annotations", "annotations": annotations})

        return {"annotations": annotations, "count": len(annotations)}

    except Exception as e:
        # Fallback: return the static POIs
        if os.path.exists(POI_PATH):
            with open(POI_PATH) as f:
                data = json.load(f)
            return {"annotations": data.get("points_of_interest", []), "count": len(data.get("points_of_interest", [])), "fallback": True}
        return {"annotations": [], "count": 0, "error": str(e)}
